// OpenPresenter — serveur local (phase 0).
// HTTP + WebSocket écrits à la main sur `node:http` : aucune dépendance npm.
//
// Responsabilités :
//   - API REST sur le dossier `project/` (D-02 : le disque est la source de vérité)
//   - relais temps réel pour la régie, les sorties et la vue scène
//   - service des fichiers de l'interface (`app/web/`)
//   - sécurité locale : jeton LAN, vérification d'origine, chemins confinés

import http from 'node:http';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';

import {
  projectDir, WEB_DIR, APP_DIR, APP_VERSION, FORMAT_VERSION, lanAddresses
} from './src/core/paths.mjs';
import {
  ensureProject, readProject, writeProject, patchSettings, checkFormat,
  acquireLock, releaseLock, heartbeatLock, cleanupTemps, readSessionState,
  writeSessionState, backupNow, readLock, seedSampleSongs
} from './src/core/project.mjs';
import { readJson, writeJson, exists } from './src/core/json-store.mjs';
import {
  RESOURCES, isResource, list, get, put, remove,
  readOutputs, writeOutputs, readVerses, writeVerses
} from './src/core/library.mjs';
import {
  importStream, importBuffer, readIndex, findAsset, kindPath, publicAsset,
  integrityReport, recountRefs, purgeOrphans
} from './src/core/assets.mjs';
import { buildExport, importArchive, saveExport } from './src/core/exporter.mjs';
import { analyze, run as runMigration, detectSource } from './src/migration/v1.mjs';
import { Relay } from './src/core/ws.mjs';
import * as live from './src/core/live.mjs';
import { channelFor } from './src/core/live.mjs';
import { log, readLogs, purgeLogs, setVerbose } from './src/core/log.mjs';
import { isPreviewMode, previewRequestAllowed } from './src/core/preview.mjs';
import {
  seedSampleBible, listBibles, resolveBible, buildBibleSelection, makeVerseCounter
} from './src/core/bible/service.mjs';
import { parseReference, parseVerseRange, MESSAGES } from './src/core/bible/reference.mjs';
import { previewBible, importBibleXml, removeBible, renameBible } from './src/core/bible/importer.mjs';
import {
  normalizeOrg, removeOrg } from './src/core/events.mjs';
import {
  normalizeEvent, duplicateEvent, materializeOccurrences, appendHistory,
  historyCsv, eventOverview, openEvent, planDuration } from './src/core/events.mjs';
import {
  parsePlanText, parsePlanningCenter, planToText, readPlanPosition, savePlanPosition,
  clampIndex, planView, normalizeCues, refToRange } from './src/core/plan.mjs';
import {
  listProfiles, getProfile, saveProfile, applyProfile, captureProfile,
  duplicateProfile, removeProfile, exportProfile, importProfile, toSummary,
  allLooks, getLook
} from './src/core/profiles.mjs';
import { BOOKS } from './src/core/books.mjs';
import { parseSongText, importSummary } from './src/core/songs/parser.mjs';
import { buildSongSelection } from './src/core/songs/arrangement.mjs';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 0) || 8788;
const BODY_LIMIT = 512 * 1024 * 1024; // 512 Mo (vidéos)
const JSON_LIMIT = 64 * 1024 * 1024;

let PROJECT = null;          // project.json en mémoire (source : disque)
let READ_ONLY = false;
let LOCK = null;
let RELAY = null;
const startedAt = Date.now();

setVerbose(process.env.OPENPRESENTER_VERBOSE === '1');
const PREVIEW_MODE = isPreviewMode();

// ---------------------------------------------------------------------------
// Utilitaires HTTP
// ---------------------------------------------------------------------------

function sendJSON(res, status, body, extraHeaders = {}) {
  const payload = Buffer.from(JSON.stringify(body, null, 2) + '\n', 'utf8');
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...extraHeaders
  };
  res.writeHead(status, headers);
  res.end(payload);
}

function sendError(res, status, code, message, detail) {
  sendJSON(res, status, { error: { code, message, ...(detail ? { detail } : {}) } });
}

const STATUS_BY_CODE = {
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  TOO_LARGE: 413,
  UNSUPPORTED: 415,
  WRITE_FAILED: 500,
  READ_ONLY: 403,
  BAD_ARCHIVE: 400,
  FORMAT_TOO_RECENT: 409,
  OFFLINE: 503,
  TIMEOUT: 504,
  CHECKSUM: 422,
  UNKNOWN_TYPE: 400,
  LAST_ITEM: 409,
  LOCKED: 503,
  UNSUPPORTED_SOURCE: 400,
  INVALID_JSON: 422,
  FORBIDDEN: 403,
  LIVE_CONFIRM: 409
};

function fail(res, err) {
  const code = err?.code && STATUS_BY_CODE[err.code] ? err.code : 'WRITE_FAILED';
  const status = STATUS_BY_CODE[code] || 500;
  if (status >= 500) {
    log('error', 'write.failed', err.message, { route: err.route });
  }
  sendError(res, status, code, err.publicMessage || err.message || 'Erreur inattendue.', err.detail || err.path);
}

async function readBody(req, limit = JSON_LIMIT) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      throw Object.assign(new Error('Ce fichier dépasse la taille maximale autorisée.'), { code: 'TOO_LARGE' });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req, limit = JSON_LIMIT) {
  const raw = await readBody(req, limit);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Corps JSON invalide.'), { code: 'VALIDATION', path: '' });
  }
}

function isLoopback(req) {
  const addr = req.socket.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function authorized(req, url) {
  if (isLoopback(req)) return true;
  // Prévisualisation derrière le proxy de l'hébergeur : l'hôte du proxy est de
  // confiance, le jeton réseau reste exigé pour toute autre adresse (EF-04.6).
  if (PREVIEW_MODE && previewRequestAllowed(req.headers, { mode: true })) return true;
  const token = url.searchParams.get('t') || req.headers['x-op-token'];
  const expected = PROJECT?.settings?.lanToken;
  if (!PROJECT?.settings?.lanTokenEnabled || !expected) return true;
  if (typeof token !== 'string' || token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

function writeBlocked() {
  if (READ_ONLY) {
    return Object.assign(new Error('Le projet est en lecture seule.'), { code: 'READ_ONLY' });
  }
  return null;
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ---------------------------------------------------------------------------
// Fichiers statiques (interface)
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

async function serveStatic(req, res, pathname) {
  // Les modules purs (références, découpage, navigation) sont servis **tels quels**
  // au navigateur : une seule implémentation, testée côté Node (ch. 02 § 2.3).
  if (pathname.startsWith('/shared/')) {
    return serveShared(req, res, pathname.slice('/shared/'.length));
  }
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  const target = path.resolve(WEB_DIR, rel);
  if (!target.startsWith(WEB_DIR + path.sep) && target !== path.join(WEB_DIR, 'index.html')) {
    sendError(res, 403, 'FORBIDDEN', "Accès refusé.");
    return;
  }
  let data;
  try {
    data = await fs.readFile(target);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end("Cette page n'existe pas.\n");
    return;
  }
  const ext = path.extname(target).toLowerCase();
  const headers = {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  };
  const acceptsGzip = /gzip/.test(req.headers['accept-encoding'] || '');
  const textLike = /^(text\/|application\/(json|javascript))/.test(headers['content-type']);
  if (acceptsGzip && textLike && data.length > 1024) {
    const gz = zlib.gzipSync(data);
    headers['content-encoding'] = 'gzip';
    headers['content-length'] = gz.length;
    res.writeHead(200, headers);
    res.end(gz);
    return;
  }
  headers['content-length'] = data.length;
  res.writeHead(200, headers);
  res.end(data);
}

/** Sert `app/src/core/**` en lecture seule, sans exposer les modules serveur. */
async function serveShared(req, res, rel) {
  const root = path.join(APP_DIR, 'src', 'core');
  const target = path.resolve(root, rel);
  // Liste blanche : uniquement des modules purs, sans `node:*`, partagés entre
  // le serveur, l'éditeur et la page de sortie (ENF-42).
  const allowed = [
    'books.mjs', 'split.mjs', 'ids.mjs', 'scene.mjs', 'looks.mjs', 'history.mjs', 'overlay.mjs',
    'bible/reference.mjs', 'bible/navigation.mjs',
    'songs/parser.mjs', 'songs/arrangement.mjs',
    'render/engine.mjs', 'render/content.mjs', 'render/autofit.mjs', 'render/contrast.mjs'
  ];
  const clean = path.relative(root, target).split(path.sep).join('/');
  if (!allowed.includes(clean)) {
    return sendError(res, 404, 'NOT_FOUND', 'Module introuvable.');
  }
  try {
    const data = await fs.readFile(target);
    res.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff'
    });
    return res.end(data);
  } catch {
    return sendError(res, 404, 'NOT_FOUND', 'Module introuvable.');
  }
}

// ---------------------------------------------------------------------------
// Recherche unifiée (EF-06.8 → EF-06.18)
// ---------------------------------------------------------------------------

function normalize(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Recherche unifiée (EF-06.8 → EF-06.18) : **uniquement** sur l'index local,
 * aucun appel réseau. Insensible à la casse et aux accents, 50 résultats
 * maximum par groupe, groupes vides omis.
 */
async function search(q, kinds) {
  const needle = normalize(q).trim();
  if (needle.length < 2) return { groups: [], total: 0 };
  const ALL = ['songs', 'bibles', 'media', 'announcements', 'looks'];
  const wanted = (kinds ? String(kinds).split(',') : ALL).filter((k) => ALL.includes(k));
  const LIMIT = 50;
  const groups = [];

  if (wanted.includes('songs')) {
    const items = [];
    for (const song of await list('songs')) {
      if (items.length >= LIMIT) break;
      const hay = normalize([
        song.title, song.artist, song.composer,
        (song.sections || []).map((section) => (section.lines || []).join(' ')).join(' ')
      ].join(' '));
      if (!hay.includes(needle)) continue;
      items.push({
        id: song.id,
        kind: 'songs',
        title: song.title,
        subtitle: song.artist || song.composer || '',
        // Ligne de paroles qui a déclenché la correspondance (contexte utile).
        detail: firstMatchingLine(song, needle),
        url: `/api/library/songs/${song.id}`
      });
    }
    if (items.length) groups.push({ kind: 'songs', label: 'Chants', count: items.length, items });
  }

  if (wanted.includes('bibles')) {
    const items = [];
    for (const bible of await list('bibles')) {
      if (items.length >= LIMIT) break;
      const verses = await readVerses(bible.id);
      const books = new Map((bible.books || []).map((book) => [book.num, book]));
      for (const chapter of verses?.chapters || []) {
        for (const [i, text] of (chapter.v || []).entries()) {
          if (items.length >= LIMIT) break;
          if (!normalize(text).includes(needle)) continue;
          const book = books.get(chapter.b);
          const verseNum = i + 1;
          items.push({
            id: `${bible.id}-${chapter.b}-${chapter.c}-${verseNum}`,
            kind: 'bibles',
            title: `${book?.name || 'Livre'} ${chapter.c}:${verseNum}`,
            subtitle: `${bible.abbreviation || bible.shortName || ''} · ${text.slice(0, 90)}`,
            detail: text,
            // De quoi construire une sélection sans relire tout le fichier.
            payload: {
              bibleId: bible.id,
              bookNum: chapter.b,
              bookName: book?.name || '',
              chapter: chapter.c,
              verse: verseNum,
              text
            },
            url: `/api/bibles/${bible.id}/verses`
          });
        }
      }
    }
    if (items.length) groups.push({ kind: 'bibles', label: 'Versets', count: items.length, items });
  }

  if (wanted.includes('media')) {
    const idx = await readIndex();
    const items = Object.values(idx.assets)
      .filter((asset) => normalize(asset.originalName || asset.path || '').includes(needle))
      .slice(0, LIMIT)
      .map((asset) => ({
        id: asset.assetId || asset.sha256.slice(0, 12),
        kind: 'media',
        title: asset.originalName || asset.path,
        subtitle: `${asset.kind || 'média'} · ${(asset.bytes / 1024).toFixed(0)} Ko`,
        payload: { assetId: asset.assetId || null, sha256: asset.sha256, name: asset.originalName },
        url: `/api/assets/${asset.sha256}`
      }));
    if (items.length) groups.push({ kind: 'media', label: 'Médias', count: items.length, items });
  }

  if (wanted.includes('announcements')) {
    const items = (await list('announcements'))
      .filter((announcement) => normalize(`${announcement.title} ${announcement.body}`).includes(needle))
      .slice(0, LIMIT)
      .map((announcement) => ({
        id: announcement.id,
        kind: 'announcements',
        title: announcement.title,
        subtitle: (announcement.body || '').slice(0, 90),
        payload: { title: announcement.title, text: announcement.body || '' },
        url: `/api/library/announcements/${announcement.id}`
      }));
    if (items.length) groups.push({ kind: 'announcements', label: 'Annonces', count: items.length, items });
  }

  if (wanted.includes('looks')) {
    const items = (await list('looks'))
      .filter((look) => normalize(`${look.name || ''} ${look.description || ''}`).includes(needle))
      .slice(0, LIMIT)
      .map((look) => ({
        id: look.id,
        kind: 'looks',
        title: look.name,
        subtitle: look.description || Object.keys(look.scenes || {}).join(', '),
        payload: { lookId: look.id },
        url: `/api/library/looks/${look.id}`
      }));
    if (items.length) groups.push({ kind: 'looks', label: 'Looks', count: items.length, items });
  }

  return {
    groups,
    total: groups.reduce((sum, group) => sum + group.count, 0),
    query: needle
  };
}

/** Première ligne d'un chant qui contient le terme cherché. */
function firstMatchingLine(song, needle) {
  for (const section of song.sections || []) {
    for (const line of section.lines || []) {
      if (normalize(line).includes(needle)) return line.slice(0, 90);
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Routes API
// ---------------------------------------------------------------------------

async function handleApi(req, res, url, pathname) {
  const method = req.method || 'GET';
  const segments = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);

  if (WRITE_METHODS.has(method)) {
    const blocked = writeBlocked();
    if (blocked) throw blocked;
  }

  // --- santé -------------------------------------------------------------
  if (segments[0] === 'health' && method === 'GET') {
    return sendJSON(res, 200, {
      ok: true,
      app: 'OpenPresenter',
      version: APP_VERSION,
      formatVersion: PROJECT?.formatVersion ?? FORMAT_VERSION,
      projectId: PROJECT?.id ?? null,
      projectName: PROJECT?.name ?? null,
      port: actualPort,
      lan: lanAddresses(),
      lanToken: PROJECT?.settings?.lanTokenEnabled ? PROJECT.settings.lanToken : null,
      readOnly: READ_ONLY,
      uptimeMs: Date.now() - startedAt,
      ws: RELAY ? RELAY.stats() : { clients: 0, channels: {} },
      runtime: process.version,
      platform: process.platform
    });
  }

  // --- projet ------------------------------------------------------------
  if (segments[0] === 'project') {
    if (method === 'GET') return sendJSON(res, 200, PROJECT);
    if (method === 'PUT') {
      const body = await readJsonBody(req);
      if (body.settings) {
        const allowed = ['port', 'lanTokenEnabled', 'activeProfileId', 'activeEventId',
          'defaultBibleId', 'maxAssetWarnBytes', 'autoBackup', 'autoBackupKeep',
          'catalogEnabled', 'blankOnStartup', 'verboseLog', 'readOnly'];
        const patch = {};
        for (const k of allowed) if (k in body.settings) patch[k] = body.settings[k];
        PROJECT = await patchSettings(patch);
        setVerbose(Boolean(PROJECT.settings.verboseLog));
      }
      if (typeof body.name === 'string' && body.name.trim()) {
        PROJECT = await writeProject({ ...PROJECT, name: body.name.trim().slice(0, 120) });
      }
      return sendJSON(res, 200, PROJECT);
    }
  }

  // --- état de session ---------------------------------------------------
  if (segments[0] === 'session') {
    if (method === 'GET') return sendJSON(res, 200, (await readSessionState()) || {});
    if (method === 'PUT' || method === 'POST') {
      const body = await readJsonBody(req);
      // Fusion : le minuteur du studio, l'antenne et le plan partagent ce fichier.
      // Écrire l'un ne doit jamais effacer les autres (EF-18.8).
      const previous = (await readSessionState()) || {};
      const merged = { ...previous };
      for (const [key, value] of Object.entries(body || {})) {
        if (value === null || value === undefined) delete merged[key];
        else merged[key] = value;
      }
      await writeSessionState(merged);
      return sendJSON(res, 200, { ok: true, session: merged });
    }
  }

  // --- profils (EF-20) ---------------------------------------------------
  if (segments[0] === 'profiles') return handleProfiles(req, res, url, segments, method);

  // --- organisations et événements (EF-21, EF-22) ------------------------
  if (segments[0] === 'orgs') return handleOrgs(req, res, segments, method);
  if (segments[0] === 'events') return handleEvents(req, res, url, segments, method);

  // --- catalogue des looks (livrés + projet) ------------------------------
  // `GET /api/library/looks` reste la liste des looks **enregistrés** ; cette route
  // ajoute les looks livrés, qui peuvent être appliqués sans être copiés sur disque.
  if (segments[0] === 'looks' && method === 'GET') {
    if (!segments[1]) {
      const looks = await allLooks();
      return sendJSON(res, 200, {
        items: looks.map((look) => ({
          id: look.id,
          name: look.name,
          description: look.description || '',
          kinds: [...new Set(Object.keys(look.scenes || {}).map((key) => key.split(':')[0]))]
        }))
      });
    }
    const look = await getLook(segments[1]);
    if (!look) throw Object.assign(new Error("Ce look n'existe plus."), { code: 'NOT_FOUND' });
    return sendJSON(res, 200, look);
  }

  // --- objets métier -----------------------------------------------------
  if (segments[0] === 'library' || segments[0] === 'outputs' ||
      segments[0] === 'scenes' || segments[0] === 'profiles' ||
      segments[0] === 'orgs' || segments[0] === 'events') {
    return handleResources(req, res, segments, method);
  }

  // --- versets -----------------------------------------------------------
  if (segments[0] === 'bibles' && segments[2] === 'verses') {
    const bibleId = segments[1];
    if (!/^bible_[a-z0-9_]{2,40}$/.test(bibleId)) {
      throw Object.assign(new Error('Identifiant invalide.'), { code: 'VALIDATION', path: 'id' });
    }
    if (method === 'GET') {
      const verses = await readVerses(bibleId);
      if (!verses) throw Object.assign(new Error('Fichier de versets introuvable.'), { code: 'NOT_FOUND' });
      return sendJSON(res, 200, verses);
    }
    if (method === 'PUT') {
      const body = await readJsonBody(req);
      await writeVerses(bibleId, body);
      return sendJSON(res, 200, { ok: true });
    }
  }

  // --- diffusion (état d'antenne) ----------------------------------------
  if (segments[0] === 'live') {
    if (segments[1] === 'state' && method === 'GET') {
      return sendJSON(res, 200, { channels: live.snapshot(), outputs: (await readOutputs()).outputs });
    }
    if (segments[1] === 'show' && method === 'POST') {
      const body = await readJsonBody(req);
      const targets = Array.isArray(body.targets) && body.targets.length
        ? body.targets.map(String)
        : (await readOutputs()).outputs.filter((o) => o.targetByDefault !== false).map((o) => o.id);
      const kinds = ['bible', 'songs', 'media', 'announcements', 'lowerthird', 'timer', 'plan'];
      if (!kinds.includes(body.kind)) {
        throw Object.assign(new Error('Type de contenu inconnu.'), { code: 'VALIDATION', path: 'kind' });
      }
      const result = await live.show(RELAY, {
        targets, kind: body.kind, payload: body.payload || {}, origin: body.origin || 'studio'
      });
      await log('info', 'live.show', `${body.kind} diffusé`, { delivered: result.delivered.length, refused: result.refused.length });
      // EF-22.6 : si un événement est ouvert, chaque diffusion entre dans son historique.
      const activeEventId = PROJECT?.settings?.activeEventId;
      if (activeEventId && body.origin !== 'plan-preview') {
        const payload = body.payload || {};
        await appendHistory(activeEventId, {
          label: String(payload.reference || payload.title || payload.label || body.kind).slice(0, 160),
          kind: body.kind,
          outputs: result.delivered
        }).catch(() => {});
      }
      return sendJSON(res, 200, result);
    }
    if (segments[1] === 'clear' && method === 'POST') {
      const body = await readJsonBody(req);
      return sendJSON(res, 200, await live.clear(RELAY, { targets: body.targets, kind: body.kind }));
    }
  }

  // --- bible -------------------------------------------------------------
  if (segments[0] === 'bible') return handleBible(req, res, url, segments, method);

  // --- médias (EF-16) : ce que le module Médias peut afficher --------------
  if (segments[0] === 'media' && method === 'GET' && !segments[1]) {
    const idx = await readIndex();
    const needle = String(url.searchParams.get('q') || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const items = Object.values(idx.assets || {})
      .map((entry) => publicAsset(entry))
      .filter((entry) => /^(image|video|pdf|presentation)$/.test(String(entry.kind || ''))
        || /^(image\/|video\/|application\/pdf)/.test(String(entry.mime || '')))
      .map((entry) => ({
        assetId: entry.assetId,
        name: (entry.originalName || entry.path || 'média').split('/').pop(),
        kind: entry.kind,
        mime: entry.mime,
        bytes: entry.bytes,
        importedAt: entry.importedAt,
        thumb: entry.thumb ? `/api/assets/${entry.sha256}/thumb` : null,
        url: `/api/assets/${entry.sha256}`
      }))
      .filter((entry) => !needle || `${entry.name}`.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(needle))
      .sort((a, b) => String(b.importedAt || '').localeCompare(String(a.importedAt || '')));
    return sendJSON(res, 200, { items, total: items.length });
  }

  // --- assets ------------------------------------------------------------
  if (segments[0] === 'assets') {
    // Index complet (accueil, bibliothèque) : rien de sensible, que des métadonnées.
    if (method === 'GET' && segments.length === 1) {
      const idx = await readIndex();
      return sendJSON(res, 200, { version: idx.version || 1, assets: idx.assets || {} });
    }
    if (method === 'POST' && segments.length === 1) {
      const name = url.searchParams.get('name') || req.headers['x-file-name'] || 'fichier';
      const mime = req.headers['content-type'] || 'application/octet-stream';
      const kind = url.searchParams.get('kind') || undefined;
      const thumb = req.headers['x-thumb-b64'] || undefined;
      const result = await importStream(req, {
        name: decodeURIComponent(String(name)),
        mime,
        kind,
        thumbB64: thumb ? String(thumb) : undefined
      });
      return sendJSON(res, 201, result);
    }
    if (method === 'GET' && segments.length >= 2) {
      const sha = segments[1];
      if (segments[2] === 'thumb') {
        const entry = await findAsset(sha);
        if (!entry?.thumb) throw Object.assign(new Error('Miniature introuvable.'), { code: 'NOT_FOUND' });
        const file = path.join(projectDir(), 'cache', entry.thumb);
        const data = await fs.readFile(file);
        res.writeHead(200, {
          'content-type': 'image/webp',
          'cache-control': 'public, max-age=31536000, immutable',
          'content-length': data.length
        });
        return res.end(data);
      }
      const entry = await findAsset(sha);
      if (!entry) throw Object.assign(new Error('Fichier introuvable.'), { code: 'NOT_FOUND' });
      const file = kindPath(entry.path);
      const stat = await fs.stat(file).catch(() => null);
      if (!stat) throw Object.assign(new Error('Fichier introuvable.'), { code: 'NOT_FOUND' });

      const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
      if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Number(range[2]) : stat.size - 1;
        res.writeHead(206, {
          'content-type': entry.mime || 'application/octet-stream',
          'content-range': `bytes ${start}-${end}/${stat.size}`,
          'accept-ranges': 'bytes',
          'content-length': end - start + 1,
          'cache-control': 'public, max-age=31536000, immutable'
        });
        return pipeline(fsSync.createReadStream(file, { start, end }), res).catch(() => {});
      }

      res.writeHead(200, {
        'content-type': entry.mime || 'application/octet-stream',
        'content-length': stat.size,
        'cache-control': 'public, max-age=31536000, immutable',
        'accept-ranges': 'bytes'
      });
      return pipeline(fsSync.createReadStream(file), res).catch(() => {});
    }
  }

  // --- chants : analyse et import (EF-15.1 → EF-15.7) --------------------
  if (segments[0] === 'songs') {
    if (segments[1] === 'parse' && method === 'POST') {
      // Aperçu **sans écriture** : l'opérateur valide avant d'importer.
      const body = await readJsonBody(req);
      const text = typeof body.text === 'string' ? body.text
        : typeof body.content === 'string' ? body.content : '';
      if (!text.trim()) {
        throw Object.assign(new Error('Collez le texte du chant ou choisissez un fichier.'), { code: 'VALIDATION', path: 'text' });
      }
      if (text.length > 2_000_000) {
        throw Object.assign(new Error('Ce chant dépasse la taille maximale autorisée.'), { code: 'TOO_LARGE' });
      }
      const song = parseSongText(text, { filename: body.filename || '' });
      return sendJSON(res, 200, { song, summary: importSummary(song) });
    }

    // Deux chants d'exemple, à la demande (bouton « chants d'exemple »).
    if (segments[1] === 'samples' && method === 'POST') {
      await seedSampleSongs();
      return sendJSON(res, 201, { items: await list('songs') });
    }

    if (segments[1] === 'import' && method === 'POST') {
      const body = await readJsonBody(req);
      const text = typeof body.text === 'string' ? body.text
        : typeof body.content === 'string' ? body.content : '';
      if (!text.trim()) {
        throw Object.assign(new Error('Aucun contenu à importer.'), { code: 'VALIDATION', path: 'text' });
      }
      const parsed = parseSongText(text, { filename: body.filename || '' });
      // EF-15.2 : le fichier d'origine est conservé dans `assets/songs/`.
      let sourceAssetId = null;
      if (body.keepSource !== false) {
        try {
          const { asset } = await importBuffer(Buffer.from(text, 'utf8'), {
            name: body.filename || `${parsed.title || 'chant'}.txt`,
            mime: 'text/plain',
            kind: 'song'
          });
          sourceAssetId = asset?.assetId || null;
        } catch {
          // L'asset est un confort, jamais un blocage d'import.
        }
      }
      const id = body.id && /^sng_[a-z0-9_]{2,40}$/.test(body.id) ? body.id : songId(parsed.title);
      const song = {
        ...parsed,
        id,
        rev: 1,
        ...(sourceAssetId ? { sourceAssetId } : {})
      };
      const saved = await put('songs', id, song);
      await log('info', 'songs.import', 'chant importé', { id, sections: song.sections.length, format: song.format });
      RELAY?.broadcast('op_project', {
        t: 'project:changed', resource: `library/songs/${id}`, rev: saved.rev, ts: Date.now()
      });
      return sendJSON(res, 201, { song: saved, summary: importSummary(saved) });
    }

    // `GET /api/songs/<id>/selection` : ce que le studio affiche et diffuse.
    if (method === 'GET' && segments[1] && segments[2] === 'selection') {
      const song = await get('songs', segments[1]);
      if (!song) throw Object.assign(new Error("Ce chant n'existe plus."), { code: 'NOT_FOUND' });
      const settings = splitSettings(url);
      const selection = buildSongSelection(song, {
        arrangementId: url.searchParams.get('arrangement') || null,
        settings
      });
      selection.label = song.title;
      selection.songId = song.id;
      return sendJSON(res, 200, selection);
    }
  }

  // --- recherche ---------------------------------------------------------
  if (segments[0] === 'search' && method === 'GET') {
    return sendJSON(res, 200, await search(url.searchParams.get('q') || '', url.searchParams.get('kinds')));
  }

  // --- intégrité et maintenance -----------------------------------------
  if (segments[0] === 'integrity' && method === 'GET') {
    await recountRefs();
    return sendJSON(res, 200, await integrityReport());
  }

  if (segments[0] === 'maintenance' && method === 'POST') {
    const body = await readJsonBody(req);
    const action = body.action;
    if (action === 'purge-orphans') {
      return sendJSON(res, 200, await purgeOrphans());
    }
    if (action === 'clear-cache') {
      let bytes = 0;
      const dir = path.join(projectDir(), 'cache');
      const walk = async (d) => {
        for (const e of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
          const full = path.join(d, e.name);
          if (e.isDirectory()) await walk(full);
          else bytes += (await fs.stat(full)).size;
        }
      };
      await walk(dir);
      await fs.rm(dir, { recursive: true, force: true });
      await fs.mkdir(path.join(dir, 'thumb'), { recursive: true });
      await fs.mkdir(path.join(dir, 'browser'), { recursive: true });
      return sendJSON(res, 200, { action, bytes });
    }
    if (action === 'recount-refs') {
      const idx = await recountRefs();
      return sendJSON(res, 200, { action, assets: Object.keys(idx.assets).length });
    }
    if (action === 'backup') {
      return sendJSON(res, 200, await backupNow());
    }
    if (action === 'purge-logs') {
      return sendJSON(res, 200, { action, removed: await purgeLogs(Number(body.days) || 30) });
    }
    throw Object.assign(new Error('Action inconnue.'), { code: 'VALIDATION', path: 'action' });
  }

  // --- export / import ---------------------------------------------------
  if (segments[0] === 'export' && method === 'GET') {
    const includeMedia = url.searchParams.get('media') !== '0';
    const { buffer, manifest } = await buildExport({ includeMedia });
    res.writeHead(200, {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="openpresenter-${manifest.projectId}.zip"`,
      'content-length': buffer.length,
      'cache-control': 'no-store'
    });
    return res.end(buffer);
  }

  if (segments[0] === 'export' && segments[1] === 'local' && method === 'POST') {
    const { buffer, manifest } = await buildExport({ includeMedia: true });
    const file = await saveExport(buffer);
    return sendJSON(res, 200, { file: path.relative(projectDir(), file), bytes: buffer.length, manifest: manifest.counts });
  }

  if (segments[0] === 'import' && method === 'POST') {
    const raw = await readBody(req, BODY_LIMIT);
    const mode = url.searchParams.get('mode') === 'replace' ? 'replace' : 'merge';
    const report = await importArchive(raw, { mode });
    PROJECT = await readProject();
    return sendJSON(res, 200, report);
  }

  // --- migration ---------------------------------------------------------
  if (segments[0] === 'migrate' && (segments[1] === 'analyze' || segments[1] === 'run')) {
    const body = await readJsonBody(req, JSON_LIMIT);
    const payload = body.payload || body;
    if (!detectSource(payload)) {
      throw Object.assign(new Error("Cette source de données n'est pas reconnue."), { code: 'UNSUPPORTED_SOURCE' });
    }
    if (segments[1] === 'analyze') return sendJSON(res, 200, analyze(payload));
    const result = await runMigration(payload);
    return sendJSON(res, 200, result);
  }

  // --- catalogue (seule route réseau, désactivée par défaut) -------------
  if (segments[0] === 'catalog' && method === 'GET') {
    if (!PROJECT?.settings?.catalogEnabled) {
      throw Object.assign(new Error('Aucune connexion Internet.'), { code: 'OFFLINE' });
    }
    const sources = await readJson(path.join(APP_DIR_DATA, 'catalog-sources.json'), { sources: [] });
    return sendJSON(res, 200, sources);
  }

  // --- journal -----------------------------------------------------------
  if (segments[0] === 'logs' && method === 'GET') {
    const entries = await readLogs({
      days: Number(url.searchParams.get('days') || 1),
      level: url.searchParams.get('level') || null,
      q: url.searchParams.get('q') || null,
      limit: Number(url.searchParams.get('limit') || 200)
    });
    return sendJSON(res, 200, { entries, count: entries.length });
  }

  // --- diagnostic consolidé ---------------------------------------------
  if (segments[0] === 'diagnostic' && method === 'GET') {
    return sendJSON(res, 200, await diagnosticPayload());
  }

  throw Object.assign(new Error("Cette ressource n'existe pas."), { code: 'NOT_FOUND' });
}

const APP_DIR_DATA = path.join(APP_DIR, 'data');

// ---------------------------------------------------------------------------
// Ressources génériques
// ---------------------------------------------------------------------------

async function handleResources(req, res, segments, method) {
  const root = segments[0];

  if (root === 'outputs') {
    if (method === 'GET') return sendJSON(res, 200, await readOutputs());
    if (method === 'PUT') {
      const body = await readJsonBody(req);
      return sendJSON(res, 200, await writeOutputs(body));
    }
  }

  const typeMap = {
    library: segments[1],
    scenes: 'scenes',
    profiles: 'profiles',
    orgs: 'orgs',
    events: 'events'
  };
  const type = typeMap[root];
  if (!type) throw Object.assign(new Error("Cette ressource n'existe pas."), { code: 'NOT_FOUND' });
  if (!isResource(type)) {
    throw Object.assign(new Error('Type de contenu inconnu.'), { code: 'UNKNOWN_TYPE' });
  }

  const id = root === 'library' ? segments[2] : segments[1];

  if (!id) {
    if (method !== 'GET') {
      throw Object.assign(new Error('Identifiant manquant.'), { code: 'VALIDATION', path: 'id' });
    }
    return sendJSON(res, 200, { type, items: await list(type) });
  }

  if (method === 'GET') {
    const obj = await get(type, id);
    if (!obj) throw Object.assign(new Error("Cet élément n'existe plus."), { code: 'NOT_FOUND' });
    return sendJSON(res, 200, obj);
  }
  if (root === 'events' && segments[2] === 'duplicate' && (method === 'POST')) {
    const source = await get('events', id);
    if (!source) throw Object.assign(new Error("Cet élément n'existe plus."), { code: 'NOT_FOUND' });
    const copy = structuredClone(source);
    copy.id = `evt_${crypto.randomBytes(6).toString('hex')}`;
    copy.name = `${source.name} (copie)`;
    copy.rev = 1;
    copy.history = [];
    delete copy.createdAt;
    delete copy.updatedAt;
    return sendJSON(res, 201, await put('events', copy.id, copy));
  }

  if (method === 'PUT' || method === 'POST') {
    const body = await readJsonBody(req);
    const saved = await put(type, id, body);
    RELAY?.broadcast('op_project', {
      t: 'project:changed', resource: `${RESOURCES[type].dir}/${id}`, rev: saved.rev, ts: Date.now()
    });
    // Une scène modifiée doit s'appliquer **sans rechargement** aux sorties qui
    // l'utilisent : on publie aussi sur leur canal (une seule connexion par page).
    if (type === 'scenes') {
      const outputs = await readOutputs();
      const message = {
        t: 'project:changed', resource: `${RESOURCES[type].dir}/${id}`,
        sceneId: id, rev: saved.rev, ts: Date.now()
      };
      for (const output of outputs.outputs || []) {
        if (Object.values(output.scenesByKind || {}).includes(id)) {
          RELAY?.publish(channelFor(output.id), message);
        }
      }
    }
    return sendJSON(res, method === 'POST' ? 201 : 200, saved);
  }
  if (method === 'DELETE') {
    return sendJSON(res, 200, await remove(type, id));
  }

  throw Object.assign(new Error('Méthode non autorisée.'), { code: 'VALIDATION' });
}

// ---------------------------------------------------------------------------
// Organisations et lieux (EF-21)
// ---------------------------------------------------------------------------

async function handleOrgs(req, res, segments, method) {
  const id = segments[1];

  if (method === 'GET' && !id) {
    return sendJSON(res, 200, { items: await list('orgs') });
  }
  if (method === 'POST' && !id) {
    const body = await readJsonBody(req);
    const org = normalizeOrg(body);
    const saved = await put('orgs', org.id, org);
    RELAY?.broadcast('op_project', { t: 'project:changed', resource: `orgs/${saved.id}`, rev: saved.rev, ts: Date.now() });
    return sendJSON(res, 201, saved);
  }
  if (!id) throw Object.assign(new Error('Identifiant manquant.'), { code: 'VALIDATION', path: 'id' });

  if (method === 'GET') {
    const org = await get('orgs', id);
    if (!org) throw Object.assign(new Error("Cette organisation n'existe plus."), { code: 'NOT_FOUND' });
    const events = (await list('events')).filter((event) => event.orgId === id);
    return sendJSON(res, 200, { ...org, events: events.map((event) => ({ id: event.id, name: event.name, startsAt: event.startsAt })) });
  }
  if (method === 'PUT' || method === 'POST') {
    const body = await readJsonBody(req);
    const existing = await get('orgs', id);
    const org = normalizeOrg({ ...(existing || {}), ...body, id });
    const saved = await put('orgs', id, org);
    RELAY?.broadcast('op_project', { t: 'project:changed', resource: `orgs/${id}`, rev: saved.rev, ts: Date.now() });
    return sendJSON(res, 200, saved);
  }
  if (method === 'DELETE') {
    const result = await removeOrg(id);
    RELAY?.broadcast('op_project', { t: 'project:changed', resource: `orgs/${id}`, rev: 0, removed: true, ts: Date.now() });
    return sendJSON(res, 200, result);
  }
  throw Object.assign(new Error('Méthode non autorisée.'), { code: 'VALIDATION' });
}

// ---------------------------------------------------------------------------
// Événements (EF-22)
// ---------------------------------------------------------------------------

async function handleEvents(req, res, url, segments, method) {
  const id = segments[1];

  if (method === 'GET' && !id) {
    return sendJSON(res, 200, await eventOverview());
  }
  if (method === 'POST' && !id) {
    const body = await readJsonBody(req);
    const event = normalizeEvent({ ...body, id: null });
    const saved = await put('events', event.id, event);
    await log('info', 'event.create', `événement « ${event.name} » créé`, { id: event.id });
    RELAY?.broadcast('op_project', { t: 'project:changed', resource: `events/${event.id}`, rev: 1, ts: Date.now() });
    return sendJSON(res, 201, saved);
  }
  if (!id) throw Object.assign(new Error('Identifiant manquant.'), { code: 'VALIDATION', path: 'id' });

  // --- plan de déroulement (EF-23) ---------------------------------------
  if (method === 'GET' && segments[2] === 'plan' && segments[3] === 'print') {
    const event = await get('events', id);
    if (!event) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
    const org = event.orgId ? await get('orgs', event.orgId) : null;
    const place = org && event.placeId ? (org.places || []).find((p) => p.id === event.placeId) : null;
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(planToText(event, { org, place }));
  }

  if (method === 'GET' && segments[2] === 'plan') {
    const event = await get('events', id);
    if (!event) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
    const cues = event.plan?.cues || [];
    const position = await readPlanPosition();
    const index = position.eventId === id ? position.index : -1;
    return sendJSON(res, 200, {
      eventId: id,
      cues,
      view: planView(cues, index),
      position,
      estimatedSec: planDuration(cues)
    });
  }

  if (method === 'PUT' && segments[2] === 'plan') {
    const event = await get('events', id);
    if (!event) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
    const body = await readJsonBody(req);
    const cues = normalizeCues(body.cues);
    const saved = await put('events', id, {
      ...event, rev: (event.rev || 1) + 1, plan: { id: event.plan?.id || `plan_${Date.now().toString(36)}`, cues }
    });
    RELAY?.broadcast('op_project', { t: 'project:changed', resource: `events/${id}`, rev: saved.rev, ts: Date.now() });
    return sendJSON(res, 200, { event: saved, estimatedSec: planDuration(cues) });
  }

  if (method === 'POST' && segments[2] === 'plan' && segments[3] === 'import') {
    const body = await readJsonBody(req);
    const songs = await list('songs');
    const bibles = await listBibles();
    let parsed;
    if (body.source === 'planning-center') {
      parsed = parsePlanningCenter(body.payload ?? body, { songs });
    } else {
      parsed = parsePlanText(body.text || '', { songs, bibles });
    }
    if (body.mode === 'preview' || !body.mode) {
      return sendJSON(res, 200, { preview: true, ...parsed });
    }
    const event = await get('events', id);
    if (!event) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
    const cues = body.mode === 'append'
      ? normalizeCues([...(event.plan?.cues || []), ...parsed.cues])
      : normalizeCues(parsed.cues);
    const saved = await put('events', id, { ...event, rev: (event.rev || 1) + 1, plan: { id: event.plan?.id || `plan_${Date.now().toString(36)}`, cues } });
    return sendJSON(res, 200, { event: saved, report: parsed.report, cues: cues.length, estimatedSec: planDuration(cues) });
  }

  if (method === 'POST' && segments[2] === 'plan' && segments[3] === 'advance') {
    const body = await readJsonBody(req);
    const event = await get('events', id);
    if (!event) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
    const cues = event.plan?.cues || [];
    if (!cues.length) {
      return sendJSON(res, 200, {
        atEnd: true, message: 'TXT: Fin du plan.', index: 0, total: 0, delivered: []
      });
    }
    const position = await readPlanPosition();
    const start = position.eventId === id ? clampIndex(cues, position.index) : -1;
    let index = Number.isInteger(body.toIndex) ? clampIndex(cues, body.toIndex) : start;
    if (!Number.isInteger(body.toIndex)) {
      const direction = body.delta === -1 ? -1 : 1;
      index = start + direction;
      // Une étape sautée (`skipped`) est franchie sans s'y arrêter (EF-23.7).
      while (index >= 0 && index < cues.length && cues[index].skipped) index += direction;
      if (index < 0) index = start < 0 ? -1 : 0;
      if (index >= cues.length) {
        return sendJSON(res, 200, {
          atEnd: true, message: 'TXT: Fin du plan.', index: start, total: cues.length,
          view: planView(cues, start), delivered: []
        });
      }
    }

    const cue = cues[index] || null;
    if (!cue) {
      await savePlanPosition(id, -1);
      return sendJSON(res, 200, { index: -1, atStart: true, view: planView(cues, -1), total: cues.length, delivered: [] });
    }
    let delivered = [];
    let note = false;
    if (cue.kind === 'note') {
      // EF-23.8 : le libellé s'affiche dans le studio, rien ne va à l'antenne.
      note = true;
      RELAY?.broadcast(live.STUDIO_CHANNEL, {
        t: 'plan:note', eventId: id, index, label: cue.label, ts: Date.now()
      });
    } else if (cue.kind === 'blank') {
      await live.clear(RELAY, { targets: body.targets });
    } else {
      const payload = await resolvePlanPayload(cue, body.targets);
      if (payload) {
        const result = await live.show(RELAY, {
          targets: payload.targets, kind: payload.kind, payload: payload.payload, origin: 'plan'
        });
        delivered = result.delivered;
      }
    }
    await savePlanPosition(id, index);
    RELAY?.broadcast('op_project', { t: 'plan:position', eventId: id, index, ts: Date.now() });
    return sendJSON(res, 200, {
      index,
      note,
      delivered,
      view: planView(cues, index),
      total: cues.length,
      message: note ? `TXT: ${cue.label}` : null
    });
  }

  if (method === 'POST' && segments[2] === 'plan' && segments[3] === 'reset') {
    await savePlanPosition(id, 0);
    return sendJSON(res, 200, { eventId: id, index: 0 });
  }

  if (method === 'GET' && segments[2] === 'history.csv') {
    const event = await get('events', id);
    if (!event) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
    res.writeHead(200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="historique-${id}.csv"`,
      'cache-control': 'no-store'
    });
    return res.end(historyCsv(event));
  }

  if (method === 'GET') {
    const event = await get('events', id);
    if (!event) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
    return sendJSON(res, 200, event);
  }

  if (method === 'POST' && segments[2] === 'open') {
    const result = await openEvent(id);
    // Le serveur garde le projet en mémoire : il doit voir l'événement ouvert,
    // sinon les diffusions suivantes ne seraient pas journalisées (EF-22.6).
    PROJECT = await readProject();
    return sendJSON(res, 200, result);
  }

  if (method === 'POST' && segments[2] === 'duplicate') {
    const body = await readJsonBody(req);
    const copy = await duplicateEvent(id, { startsAt: body.startsAt });
    return sendJSON(res, 201, copy);
  }

  if (method === 'POST' && segments[2] === 'occurrences') {
    const body = await readJsonBody(req);
    const result = await materializeOccurrences(id, { count: Math.min(24, Number(body.count) || 4) });
    return sendJSON(res, 201, result);
  }

  if (method === 'POST' && segments[2] === 'history') {
    const body = await readJsonBody(req);
    return sendJSON(res, 201, await appendHistory(id, body));
  }

  if (method === 'PUT' || method === 'POST') {
    const body = await readJsonBody(req);
    const existing = await get('events', id);
    if (!existing) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
    // EF-22.8 : un événement passé est en lecture seule, sauf « Modifier quand même ».
    if (eventOverview && new Date(existing.endsAt) < new Date() && body.force !== true
      && !['duplicate', 'occurrences', 'history', 'open'].includes(segments[2])) {
      return sendJSON(res, 409, {
        error: {
          code: 'PAST_EVENT',
          message: "TXT: Cet événement est passé.\n\n"
            + '     Il est en lecture seule pour protéger son historique.\n'
            + '     Utilisez « Modifier quand même » pour le corriger.'
        },
        readOnly: true,
        event: existing
      });
    }
    const merged = normalizeEvent({ ...structuredClone(existing), ...body, id, force: undefined });
    const saved = await put('events', id, merged);
    RELAY?.broadcast('op_project', { t: 'project:changed', resource: `events/${id}`, rev: saved.rev, ts: Date.now() });
    return sendJSON(res, 200, saved);
  }

  if (method === 'DELETE') {
    const event = await get('events', id);
    if (!event) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
    const body = await readJsonBody(req).catch(() => ({}));
    const cues = event.plan?.cues?.length || 0;
    if (body.confirm !== true) {
      return sendJSON(res, 409, {
        error: {
          code: 'DELETE_CONFIRM',
          message: `TXT: Supprimer « ${event.name} » ?\n\n     Cet événement contient ${cues} étape(s) de plan.\n     Son historique de diffusion sera également supprimé.\n\n     [Supprimer]      [Annuler]`
        },
        requiresConfirmation: true,
        cues
      });
    }
    await remove('events', id);
    return sendJSON(res, 200, { id, removed: true, cues });
  }
  throw Object.assign(new Error('Méthode non autorisée.'), { code: 'VALIDATION' });
}


/** Traduit une étape en message diffusé (EF-23, § 14.4.1). */
async function resolvePlanPayload(cue, targets) {
  const wanted = Array.isArray(cue.payload?.outputs) && cue.payload.outputs.length
    ? cue.payload.outputs.map(String)
    : targets;
  const pick = async (kind) => {
    const outputs = await readOutputs();
    const eligible = outputs.outputs.filter((output) => output.enabled !== false && output.receives?.[kind]);
    const chosen = wanted && wanted.length
      ? eligible.filter((output) => wanted.includes(output.id))
      : eligible;
    return chosen.map((output) => output.id);
  };

  if (cue.kind === 'bible') {
    const range = refToRange(cue.payload?.ref);
    if (!range) return null;
    const bible = await resolveBible(cue.payload?.bibleId, PROJECT);
    if (!bible) return null;
    const selection = await buildBibleSelection({
      bible, bookNum: range.bookNum, chapter: range.chapter, first: range.first, last: range.last
    });
    const item = selection.items[0];
    if (!item) return null;
    return {
      kind: 'bible',
      targets: await pick('bible'),
      payload: {
        reference: selection.label,
        text: item.text,
        badge: bible.abbreviation || bible.shortName || '',
        partIndex: item.partIndex,
        partCount: item.partCount,
        verse: item.verse
      }
    };
  }

  if (cue.kind === 'song') {
    const song = cue.payload?.songId ? await get('songs', cue.payload.songId) : null;
    if (!song) return null;
    const selection = buildSongSelection(song, { arrangementId: cue.payload?.arrangementId || null });
    const item = selection.items.find((entry) => entry.text);
    if (!item) return null;
    return {
      kind: 'songs',
      targets: await pick('songs'),
      payload: { reference: song.title, text: item.text, badge: arrangementLabel(song, selection), sectionId: item.sectionId }
    };
  }

  if (cue.kind === 'announcement') {
    const announcement = cue.payload?.announcementId ? await get('announcements', cue.payload.announcementId) : null;
    if (!announcement) return null;
    return {
      kind: 'announcements',
      targets: await pick('announcements'),
      payload: { title: announcement.title, text: announcement.body || announcement.text || '' }
    };
  }

  if (cue.kind === 'media') {
    const asset = cue.payload?.assetId ? await findAsset(cue.payload.assetId) : null;
    return {
      kind: 'media',
      targets: await pick('media'),
      payload: {
        assetId: cue.payload?.assetId || null,
        mediaName: asset?.name || cue.label,
        mediaKind: asset?.kind || null
      }
    };
  }

  if (cue.kind === 'lowerthird') {
    return {
      kind: 'lowerthird',
      targets: await pick('lowerthird'),
      payload: { title: cue.payload?.title || cue.label, text: cue.payload?.text || '' }
    };
  }

  if (cue.kind === 'timer') {
    return {
      kind: 'timer',
      targets: await pick('timer'),
      payload: { action: cue.payload?.action || 'start', minutes: cue.payload?.minutes || null, label: cue.label }
    };
  }

  return null;
}

function arrangementLabel(song, selection) {
  const arrangements = song.arrangements || [];
  return arrangements.find((entry) => entry.id === selection.arrangementId)?.name || '';
}

// ---------------------------------------------------------------------------
// Profils (EF-20)
// ---------------------------------------------------------------------------

async function handleProfiles(req, res, url, segments, method) {
  const id = segments[1];

  if (method === 'GET' && !id) {
    const project = await readProject();
    return sendJSON(res, 200, {
      profiles: await listProfiles(),
      active: project?.settings?.activeProfileId || null
    });
  }

  // « Enregistrer la configuration actuelle comme profil » (EF-20.4).
  if (method === 'POST' && id === 'capture') {
    const body = await readJsonBody(req);
    const profile = await captureProfile({
      name: typeof body.name === 'string' ? body.name : undefined,
      kind: typeof body.kind === 'string' ? body.kind : 'custom',
      color: body.color,
      icon: body.icon
    });
    const saved = await saveProfile(profile);
    RELAY?.broadcast('op_project', {
      t: 'project:changed', resource: `library/profiles/${saved.id}`, rev: saved.rev, ts: Date.now()
    });
    return sendJSON(res, 201, { profile: saved, summary: toSummary(saved, null) });
  }

  if (method === 'POST' && id === 'import') {
    const body = await readJsonBody(req);
    const result = await importProfile(body.bundle || body, { mode: body.mode === 'merge' ? 'merge' : 'copy' });
    RELAY?.broadcast('op_project', {
      t: 'project:changed', resource: `library/profiles/${result.profile.id}`, rev: result.profile.rev, ts: Date.now()
    });
    return sendJSON(res, result.created ? 201 : 200, result);
  }

  // Création libre : l'identifiant est proposé par le serveur.
  if (!id) {
    if (method !== 'POST') {
      throw Object.assign(new Error('Identifiant manquant.'), { code: 'VALIDATION', path: 'id' });
    }
    const body = await readJsonBody(req);
    const saved = await saveProfile({ ...body, id: body.id });
    RELAY?.broadcast('op_project', {
      t: 'project:changed', resource: `profiles/${saved.id}`, rev: saved.rev, ts: Date.now()
    });
    return sendJSON(res, 201, { profile: saved, summary: toSummary(saved, null) });
  }

  if (method === 'GET' && segments[2] === 'export') {
    const bundle = await exportProfile(id);
    const name = bundle.profile.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'profil';
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${name}.opprofile.json"`,
      'cache-control': 'no-store'
    });
    return res.end(JSON.stringify(bundle, null, 2));
  }

  if (method === 'GET') {
    const profile = await getProfile(id);
    if (!profile) throw Object.assign(new Error("Ce profil n'existe pas."), { code: 'NOT_FOUND' });
    return sendJSON(res, 200, profile);
  }

  // Application d'un profil (§ 13.5). `onAir` est calculé ici : l'interface n'a pas
  // à savoir ce qui est diffusé pour demander la confirmation.
  if (method === 'POST' && segments[2] === 'apply') {
    const body = await readJsonBody(req);
    const onAir = Object.keys(live.snapshot() || {}).length > 0;
    const report = await applyProfile(id, { force: body.force === true, onAir });
    PROJECT = await readProject();
    await log('info', 'profile.apply', `profil « ${report.profile.name} » appliqué`, {
      created: report.outputs.created, updated: report.outputs.updated, disabled: report.outputs.disabled
    });
    RELAY?.broadcast('op_project', {
      t: 'project:changed', resource: 'outputs', rev: 0, ts: Date.now()
    });
    return sendJSON(res, 200, report);
  }

  if (method === 'POST' && segments[2] === 'duplicate') {
    const copy = await duplicateProfile(id);
    return sendJSON(res, 201, { profile: copy, summary: toSummary(copy, null) });
  }

  if (method === 'PUT' || method === 'POST') {
    const body = await readJsonBody(req);
    const saved = await saveProfile({ ...body, id });
    RELAY?.broadcast('op_project', {
      t: 'project:changed', resource: `library/profiles/${id}`, rev: saved.rev, ts: Date.now()
    });
    return sendJSON(res, method === 'POST' ? 201 : 200, { profile: saved, summary: toSummary(saved, null) });
  }

  if (method === 'DELETE') {
    return sendJSON(res, 200, await removeProfile(id));
  }

  throw Object.assign(new Error('Méthode non autorisée.'), { code: 'VALIDATION' });
}

// ---------------------------------------------------------------------------
// Module Bible (EF-12, EF-13)
// ---------------------------------------------------------------------------

const SPLIT_DEFAULTS = {
  splitMode: 'auto', splitBy: 'words', maxWordsPerScreen: 25,
  maxCharsPerScreen: 165, maxLinesPerScreen: 3, minWordsPerPart: 3, balanceParts: true
};

/** Identifiant de chant stable et lisible : `sng_grace_infinie_a1b2`. */
function songId(title) {
  const slug = slugify(title).slice(0, 24).replace(/_+$/, '') || 'chant';
  return `sng_${slug}_${crypto.randomBytes(3).toString('hex')}`;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function splitSettings(url) {
  const settings = { ...SPLIT_DEFAULTS };
  for (const key of ['splitMode', 'splitBy']) {
    const value = url.searchParams.get(key);
    if (value) settings[key] = value;
  }
  for (const key of ['maxWordsPerScreen', 'maxCharsPerScreen', 'maxLinesPerScreen', 'minWordsPerPart']) {
    const value = url.searchParams.get(key);
    if (value !== null && value !== '') settings[key] = Number(value);
  }
  if (url.searchParams.get('balanceParts') === '0') settings.balanceParts = false;
  return settings;
}

async function handleBible(req, res, url, segments, method) {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
    throw Object.assign(new Error('Méthode non autorisée.'), { code: 'VALIDATION' });
  }

  // Liste des versions + catalogue des livres.
  if (segments[1] === 'versions' && !segments[2] && method === 'GET') {
    return sendJSON(res, 200, { versions: await listBibles(), books: BOOKS.length });
  }
  if (segments[1] === 'books') {
    return sendJSON(res, 200, { books: BOOKS });
  }

  // --- import d'une version (EF-11.1 → EF-11.10) -------------------------
  // Ces routes passent **avant** la résolution de la version courante : un projet
  // encore vide doit pouvoir importer sa première Bible.
  if (segments[1] === 'import') {
    if (method !== 'POST') throw Object.assign(new Error('Méthode non autorisée.'), { code: 'VALIDATION' });
    const body = await readJsonBody(req);
    const text = typeof body.text === 'string' ? body.text : typeof body.content === 'string' ? body.content : '';
    if (!text.trim()) {
      throw Object.assign(new Error('Choisissez un fichier de Bible (.xml).'), { code: 'VALIDATION', path: 'text' });
    }
    const filename = typeof body.filename === 'string' ? body.filename.slice(0, 200) : '';

    // `/api/bible/import/preview` : analyse sans écriture (étape 4 du § 9.2.2).
    if (segments[2] === 'preview') {
      try {
        return sendJSON(res, 200, { preview: previewBible(text, { filename }) });
      } catch (err) {
        if (err.code === 'UNSUPPORTED_FORMAT') {
          return sendJSON(res, 422, {
            error: { code: 'UNSUPPORTED_FORMAT', message: err.message },
            preview: null
          });
        }
        throw err;
      }
    }

    const result = await importBibleXml(text, {
      filename,
      name: typeof body.name === 'string' ? body.name : undefined,
      abbreviation: typeof body.abbreviation === 'string' ? body.abbreviation : undefined,
      license: typeof body.license === 'string' ? body.license : undefined,
      language: typeof body.language === 'string' ? body.language : undefined
    });
    await log('info', 'bible.import', result.created ? 'bible importée' : 'bible déjà présente', {
      id: result.bible.id, format: result.bible.source?.format, verses: result.bible.counts?.verses
    });
    if (result.created) {
      RELAY?.broadcast('op_project', {
        t: 'project:changed', resource: `library/bibles/${result.bible.id}`, rev: result.bible.rev, ts: Date.now()
      });
    }
    return sendJSON(res, result.created ? 201 : 200, result);
  }

  // --- gestion des versions déjà importées (EF-11.6) ---------------------
  if (segments[1] === 'versions' && segments[2]) {
    const id = segments[2];
    if (method === 'PUT') {
      const body = await readJsonBody(req);
      return sendJSON(res, 200, { bible: await renameBible(id, body) });
    }
    if (method === 'DELETE') {
      const removed = await removeBible(id);
      RELAY?.broadcast('op_project', {
        t: 'project:changed', resource: `library/bibles/${id}`, rev: 0, removed: true, ts: Date.now()
      });
      return sendJSON(res, 200, removed);
    }
  }

  const bible = await resolveBible(url.searchParams.get('bible'), PROJECT);
  if (!bible) {
    throw Object.assign(new Error('Aucune version biblique dans ce projet.'), { code: 'NOT_FOUND' });
  }

  // Analyse d'une référence collée : « Jean 3:16 », « 1 Corinthiens 13:4-7 ».
  if (segments[1] === 'parse') {
    const ref = url.searchParams.get('ref') || '';
    const parsed = parseReference(ref);
    if (!parsed) {
      return sendJSON(res, 422, {
        error: { code: 'VALIDATION', message: MESSAGES.unknownBook(ref) },
        parsed: null
      });
    }
    const counter = await makeVerseCounter(bible.id);
    const max = counter(parsed.bookNum, parsed.chapter);
    if (max === null) return sendJSON(res, 200, { parsed, versesAvailable: null });
    if (parsed.first && parsed.first > max) {
      return sendJSON(res, 422, {
        error: {
          code: 'VALIDATION',
          message: MESSAGES.verseOutOfRange(parsed.bookName, parsed.chapter, parsed.first, max)
        },
        parsed,
        versesAvailable: max
      });
    }
    const last = parsed.last ? Math.min(parsed.last, max) : parsed.last;
    return sendJSON(res, 200, {
      parsed: { ...parsed, last },
      versesAvailable: max,
      warning: last && parsed.last && last < parsed.last
        ? MESSAGES.rangeTruncated(parsed.first, last, max)
        : null
    });
  }

  // Sélection affichable : « Jean 3:16-18 » découpé selon les réglages de la scène.
  if (segments[1] === 'selection') {
    const bookNum = Number(url.searchParams.get('book'));
    const chapter = Number(url.searchParams.get('chapter'));
    if (!Number.isInteger(bookNum) || bookNum < 1 || bookNum > BOOKS.length) {
      throw Object.assign(new Error('Livre invalide.'), { code: 'VALIDATION', path: 'book' });
    }
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 200) {
      throw Object.assign(new Error('Chapitre invalide.'), { code: 'VALIDATION', path: 'chapter' });
    }
    const first = url.searchParams.get('first') ? Number(url.searchParams.get('first')) : undefined;
    const last = url.searchParams.get('last') ? Number(url.searchParams.get('last')) : undefined;
    const selection = await buildBibleSelection({
      bible, bookNum, chapter, first, last, settings: splitSettings(url)
    });
    if (!selection.items.length) {
      return sendJSON(res, 200, {
        ...selection,
        empty: true,
        message: `${selection.bookName} ${chapter} n'est pas dans cette version.`
      });
    }
    // Le champ de saisie est préparé pour enchaîner (EF-12.20).
    return sendJSON(res, 200, {
      ...selection,
      empty: false,
      range: first ? { first, last: last && last > first ? last : first } : null
    });
  }

  throw Object.assign(new Error("Cette ressource n'existe pas."), { code: 'NOT_FOUND' });
}

// ---------------------------------------------------------------------------
// Diagnostic consolidé (ch. 23)
// ---------------------------------------------------------------------------

async function diagnosticPayload() {
  const started = Date.now();
  const checks = [];
  const push = (id, name, status, value, extra = {}) => checks.push({ id, name, status, value, ...extra });

  push('DIAG-01', 'Serveur local', 'ok', `en marche · port ${actualPort}`);
  push('DIAG-03', 'Dossier du projet', (await isWritable(projectDir())) ? 'ok' : 'warn',
    (await isWritable(projectDir())) ? 'inscriptible' : 'lecture seule');
  push('DIAG-04', 'Version du format', PROJECT?.formatVersion === FORMAT_VERSION ? 'ok' : 'warn',
    `${PROJECT?.formatVersion} · application ${FORMAT_VERSION}`);
  push('DIAG-05', 'Runtime Node.js', Number(process.versions.node.split('.')[0]) >= 20 ? 'ok' : 'err', process.version);

  const outputs = await readOutputs();
  const ws = RELAY?.stats() || { clients: 0, channels: {} };
  const connected = Object.entries(ws.channels)
    .filter(([c]) => /^op_out_/.test(c))
    .map(([c]) => c);
  const expected = (outputs.outputs || []).filter((o) => o.enabled !== false);
  push('DIAG-06', 'Sorties connectées', connected.length >= expected.length && expected.length ? 'ok'
    : connected.length ? 'warn' : (expected.length ? 'warn' : 'na'),
  `${connected.length} sur ${expected.length}`, { detail: { connected, expected: expected.map((o) => o.id) } });
  push('DIAG-09', 'WebSocket', ws.clients >= 0 ? 'ok' : 'warn', `${ws.clients} client(s)`);

  const integrity = await integrityReport();
  push('DIAG-10', 'Intégrité du projet',
    integrity.assets.missing.length || integrity.brokenRefs.length ? 'warn' : 'ok',
    `${integrity.assets.orphan.length} orphelin(s) · ${integrity.assets.missing.length} manquant(s)`,
    { detail: integrity });

  const backups = (await fs.readdir(path.join(projectDir(), 'backups')).catch(() => []))
    .filter((f) => f.endsWith('.zip')).sort();
  push('DIAG-11', 'Dernière sauvegarde',
    backups.length ? 'ok' : 'warn',
    backups.length ? backups[backups.length - 1] : 'aucune sauvegarde');

  // DIAG-12 : l'index de recherche vit dans cache/ ; s'il manque, il est reconstruit
  // immédiatement et la ligne passe en orange une seule fois (A-18d).
  const cacheIndex = path.join(projectDir(), 'cache', 'browser', 'index.json');
  if (!(await exists(cacheIndex))) {
    const t0 = Date.now();
    const rebuilt = await rebuildSearchCache();
    push('DIAG-12', 'Index de recherche', 'warn',
      `absent — reconstruit en ${Date.now() - t0} ms (${rebuilt} entrée(s))`);
  } else {
    const idx = await readJson(cacheIndex, { count: 0 });
    push('DIAG-12', 'Index de recherche', 'ok', `${idx.count || 0} entrée(s) indexée(s)`);
  }
  push('DIAG-13c', 'Accès Internet', PROJECT?.settings?.catalogEnabled ? 'ok' : 'na',
    PROJECT?.settings?.catalogEnabled ? 'catalogue activé' : 'désactivé par réglage');

  const errors = await readLogs({ days: 1, limit: 20 });
  return {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    version: APP_VERSION,
    project: { id: PROJECT?.id, name: PROJECT?.name, formatVersion: PROJECT?.formatVersion },
    checks,
    ok: checks.filter((c) => c.status === 'ok').length,
    warn: checks.filter((c) => c.status === 'warn').length,
    err: checks.filter((c) => c.status === 'err').length,
    recentErrors: errors.filter((e) => e.level === 'warn' || e.level === 'error').slice(-20)
  };
}

/** Reconstruit l'index de recherche (cache reconstructible, EF-01.4). */
async function rebuildSearchCache() {
  const entries = [];
  for (const type of ['songs', 'bibles', 'announcements', 'looks']) {
    for (const item of await list(type)) {
      entries.push({ type, id: item.id, title: item.title || item.name || item.shortName || '' });
    }
  }
  for (const asset of Object.values((await readIndex()).assets)) {
    entries.push({ type: 'media', id: asset.assetId, title: asset.originalName || '' });
  }
  const dir = path.join(projectDir(), 'cache', 'browser');
  await fs.mkdir(dir, { recursive: true });
  await writeJson(path.join(dir, 'index.json'), {
    rebuiltAt: new Date().toISOString(),
    count: entries.length,
    entries: entries.slice(0, 5000)
  });
  return entries.length;
}

async function isWritable(dir) {
  const probe = path.join(dir, `.probe-${crypto.randomBytes(4).toString('hex')}`);
  try {
    await fs.writeFile(probe, 'ok');
    await fs.rm(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Serveur
// ---------------------------------------------------------------------------

let actualPort = PORT;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (pathname.startsWith('/api/')) {
      if (!authorized(req, url)) {
        await log('warn', 'auth.token_failed', 'jeton manquant ou invalide', { path: pathname });
        return sendError(res, 401, 'FORBIDDEN', "Code d'accès incorrect.");
      }
      return await handleApi(req, res, url, pathname);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendError(res, 405, 'VALIDATION', 'Méthode non autorisée.');
    }
    // L'accueil est la porte d'entrée (EF-05) ; le studio vit sur /studio.html,
    // l'état du socle sur /socle.html.
    if (pathname === '/') {
      return await serveStatic(req, res, '/accueil.html');
    }
    // Chaque sortie a son URL stable : /o/<outputId>?kind=<type> (ch. 07 § 7.3).
    if (/^\/o\/[\w.-]+\/?$/.test(pathname)) {
      return await serveStatic(req, res, '/output.html');
    }
    return await serveStatic(req, res, pathname);
  } catch (err) {
    if (res.headersSent) {
      try { res.end(); } catch { /* ignore */ }
      return;
    }
    if (err.code === 'ENOENT') return sendError(res, 404, 'NOT_FOUND', 'Fichier introuvable.');
    fail(res, err);
  }
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  if (!authorized(req, url)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  const origin = req.headers.origin;
  const host = req.headers.host;
  const verifyOrigin = () => {
    if (!origin) return true; // client non navigateur (OBS/vMix)
    try {
      const o = new URL(origin);
      return o.host === host || o.hostname === 'localhost' || o.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  };
  RELAY.handleUpgrade(req, socket, head, url);
});

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

async function start() {
  const { created, project } = await ensureProject();
  PROJECT = project;

  const format = await checkFormat(PROJECT);
  if (!format.ok && format.code === 'FORMAT_TOO_RECENT') {
    READ_ONLY = true;
    await log('error', 'project.readonly', 'format de projet trop récent', { format: format.projectFormat });
  }
  if (PROJECT.settings?.readOnly || process.env.OPENPRESENTER_READONLY === '1') READ_ONLY = true;

  await cleanupTemps();

  // Une version d'exemple permet d'essayer l'application dès le premier lancement.
  const seeded = await seedSampleBible();
  if (seeded) await log('info', 'bible.seeded', 'Bible d’exemple installée', { bibleId: 'bible_sample_fr' });

  const lock = await acquireLock();
  if (!lock.ok) {
    const existing = lock.lock || {};
    process.stderr.write(
      `OpenPresenter est déjà lancé sur ce dossier (pid ${existing.pid}).\n` +
      `Ouvrez http://127.0.0.1:${PROJECT.settings?.port || PORT}/ dans votre navigateur.\n`
    );
    await log('warn', 'project.lock.conflict', 'second lancement détecté', { pid: existing.pid });
    process.exit(0);
  }
  LOCK = lock.lock;
  setInterval(() => heartbeatLock(LOCK), 20_000).unref();

  RELAY = new Relay({
    verifyOrigin: () => true,
    onLog: (level, event, msg, ctx) => log(level, event, msg, ctx)
  });

  const desired = Number(process.env.PORT || 0) || PROJECT.settings?.port || PORT;
  actualPort = await listen(desired);

  if (!PROJECT.settings?.port || PROJECT.settings.port !== actualPort) {
    if (!process.env.PORT && PROJECT.settings) {
      PROJECT = await patchSettings({ port: actualPort });
    }
  }

  const restoredLive = await live.restore();
  if (restoredLive) await log('info', 'live.restored', 'état d’antenne restauré', { outputs: restoredLive });

  await log('info', 'server.start', 'serveur démarré', {
    port: actualPort, projectId: PROJECT.id, created
  });

  const addrs = lanAddresses();
  process.stdout.write(
    `\nOpenPresenter ${APP_VERSION}\n` +
    `  Projet   : ${projectDir()}\n` +
    `  Local    : http://127.0.0.1:${actualPort}/\n` +
    (addrs.length ? `  Réseau   : http://${addrs[0].address}:${actualPort}/  (jeton ${PROJECT.settings.lanToken})\n` : '') +
    (PREVIEW_MODE
      ? '  Aperçu   : accès proxy *.e2b.app sans jeton (OPENPRESENTER_PREVIEW=1)\n'
      : '') +
    (READ_ONLY ? '  Mode     : lecture seule\n' : '') +
    '\n'
  );

  process.stdout.write(`__OP_READY__ ${actualPort}\n`);
}

function listen(port, attempt = 0) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.removeListener('listening', onListening);
      if (err.code === 'EADDRINUSE' && attempt < 20) {
        return resolve(listen(port + 1, attempt + 1));
      }
      if (err.code === 'EADDRINUSE') {
        return reject(Object.assign(new Error('Aucun port disponible.'), { code: 'NO_PORT' }));
      }
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(server.address().port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, HOST);
  });
}

async function shutdown(signal) {
  await log('info', 'server.shutdown', `arrêt (${signal})`);
  RELAY?.closeAll();
  await releaseLock(LOCK);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', async (err) => {
  await log('error', 'server.crash', err.message, { stack: (err.stack || '').split('\n')[1]?.trim() });
  process.exit(1);
});

start().catch(async (err) => {
  await log('error', 'server.start.failed', err.message);
  process.stderr.write(`Le serveur n'a pas démarré : ${err.message}\n`);
  process.exit(1);
});

export { server, start };
