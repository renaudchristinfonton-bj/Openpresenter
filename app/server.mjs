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
  writeSessionState, backupNow, readLock
} from './src/core/project.mjs';
import { readJson, writeJson, exists } from './src/core/json-store.mjs';
import {
  RESOURCES, isResource, list, get, put, remove,
  readOutputs, writeOutputs, readVerses, writeVerses
} from './src/core/library.mjs';
import {
  importStream, readIndex, findAsset, kindPath,
  integrityReport, recountRefs, purgeOrphans
} from './src/core/assets.mjs';
import { buildExport, importArchive, saveExport } from './src/core/exporter.mjs';
import { analyze, run as runMigration, detectSource } from './src/migration/v1.mjs';
import { Relay } from './src/core/ws.mjs';
import * as live from './src/core/live.mjs';
import { log, readLogs, purgeLogs, setVerbose } from './src/core/log.mjs';
import {
  seedSampleBible, listBibles, resolveBible, buildBibleSelection, makeVerseCounter
} from './src/core/bible/service.mjs';
import { parseReference, parseVerseRange, MESSAGES } from './src/core/bible/reference.mjs';
import { BOOKS } from './src/core/books.mjs';

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
  FORBIDDEN: 403
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
  const allowed = ['books.mjs', 'split.mjs', 'bible/reference.mjs', 'bible/navigation.mjs'];
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

async function search(q, kinds) {
  const needle = normalize(q).trim();
  if (needle.length < 2) return { groups: [], total: 0 };
  const wanted = (kinds ? String(kinds).split(',') : ['songs', 'bibles', 'media', 'announcements'])
    .filter((k) => ['songs', 'bibles', 'media', 'announcements', 'looks'].includes(k));
  const groups = [];
  const LIMIT = 50;

  if (wanted.includes('songs')) {
    const items = [];
    for (const song of await list('songs')) {
      const hay = normalize(song.title + ' ' + (song.artist || '') + ' ' +
        (song.sections || []).map((s) => s.lines?.join(' ')).join(' '));
      if (hay.includes(needle)) {
        items.push({
          id: song.id, title: song.title, subtitle: song.artist || '',
          kind: 'songs', url: `/api/library/songs/${song.id}`
        });
      }
      if (items.length >= LIMIT) break;
    }
    if (items.length) groups.push({ kind: 'songs', count: items.length, items });
  }

  if (wanted.includes('bibles')) {
    const items = [];
    outer:
    for (const bible of await list('bibles')) {
      const verses = await readVerses(bible.id);
      for (const chapter of verses?.chapters || []) {
        for (const [i, text] of chapter.v.entries()) {
          if (normalize(text).includes(needle)) {
            const book = bible.books.find((b) => b.num === chapter.b);
            items.push({
              id: `${bible.id}-${chapter.b}-${chapter.c}-${i + 1}`,
              title: `${book?.name || 'Livre'} ${chapter.c}:${i + 1}`,
              subtitle: `${bible.abbreviation || bible.shortName || ''} · ${text.slice(0, 80)}`,
              kind: 'bibles', url: `/api/bibles/${bible.id}/verses`
            });
            break outer;
          }
          if (items.length >= LIMIT) break outer;
        }
      }
    }
    if (items.length) groups.push({ kind: 'bibles', count: items.length, items });
  }

  if (wanted.includes('media')) {
    const idx = await readIndex();
    const items = Object.values(idx.assets)
      .filter((a) => normalize(a.originalName || '').includes(needle))
      .slice(0, LIMIT)
      .map((a) => ({
        id: a.assetId || a.sha256.slice(0, 12),
        title: a.originalName || a.path,
        subtitle: `${a.kind} · ${(a.bytes / 1024).toFixed(0)} Ko`,
        kind: 'media', url: `/api/assets/${a.sha256}`
      }));
    if (items.length) groups.push({ kind: 'media', count: items.length, items });
  }

  if (wanted.includes('announcements')) {
    const items = (await list('announcements'))
      .filter((a) => normalize(`${a.title} ${a.body}`).includes(needle))
      .slice(0, LIMIT)
      .map((a) => ({ id: a.id, title: a.title, subtitle: (a.body || '').slice(0, 80), kind: 'announcements', url: `/api/library/announcements/${a.id}` }));
    if (items.length) groups.push({ kind: 'announcements', count: items.length, items });
  }

  return { groups, total: groups.reduce((s, g) => s + g.count, 0) };
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
      await writeSessionState(body);
      return sendJSON(res, 200, { ok: true });
    }
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
      return sendJSON(res, 200, result);
    }
    if (segments[1] === 'clear' && method === 'POST') {
      const body = await readJsonBody(req);
      return sendJSON(res, 200, await live.clear(RELAY, { targets: body.targets }));
    }
  }

  // --- bible -------------------------------------------------------------
  if (segments[0] === 'bible') return handleBible(req, res, url, segments, method);

  // --- assets ------------------------------------------------------------
  if (segments[0] === 'assets') {
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
    return sendJSON(res, method === 'POST' ? 201 : 200, saved);
  }
  if (method === 'DELETE') {
    return sendJSON(res, 200, await remove(type, id));
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
  if (method !== 'GET' && method !== 'POST') {
    throw Object.assign(new Error('Méthode non autorisée.'), { code: 'VALIDATION' });
  }

  // Liste des versions + catalogue des livres.
  if (segments[1] === 'versions') {
    return sendJSON(res, 200, { versions: await listBibles(), books: BOOKS.length });
  }
  if (segments[1] === 'books') {
    return sendJSON(res, 200, { books: BOOKS });
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
    // Le studio est la porte d'entrée ; l'état du socle vit sur /socle.html.
    if (pathname === '/') {
      return await serveStatic(req, res, '/studio.html');
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
