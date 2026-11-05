// Migration des données OpenPresenter 1 (sauvegarde JSON globale).
// Format source vérifié sur `openpresenter-sauvegarde-2026-08-09.json` :
//   { version, exportedAt, localStorage:{…}, server:{…}, indexedDB:{
//       bibleProStorage:{versions:[]}, lyricsProStorage:{songs:[],media:[]},
//       mediaProStorage:{items:[]} } }

import crypto from 'node:crypto';
import { writeJson, readJson } from '../core/json-store.mjs';
import { projectDir } from '../core/paths.mjs';
import path from 'node:path';
import { importBuffer } from '../core/assets.mjs';
import { log } from '../core/log.mjs';

export const SOURCE_KIND = 'v1-export';

export function detectSource(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.indexedDB || payload.server || payload.localStorage) return SOURCE_KIND;
  if (payload.formatVersion && payload.projectId) return 'v3-export';
  return null;
}

/** Analyse **sans écrire** : renvoie le rapport affiché avant confirmation (EF-26.2). */
export function analyze(payload) {
  const kind = detectSource(payload);
  if (!kind) {
    throw Object.assign(new Error("Cette source de données n'est pas reconnue."), {
      code: 'UNSUPPORTED_SOURCE'
    });
  }
  if (kind !== SOURCE_KIND) {
    return { kind, items: {}, total: 0, warnings: ["Cette archive n'est pas une sauvegarde OpenPresenter 1."] };
  }

  const idb = payload.indexedDB || {};
  const songs = idb?.lyricsProStorage?.songs || [];
  const media = idb?.lyricsProStorage?.media || [];
  const mediaItems = idb?.mediaProStorage?.items || [];
  const bibles = idb?.bibleProStorage?.versions || [];
  const settings = Object.keys(payload.localStorage || {}).length +
    Object.keys(payload.server || {}).length;

  const mediaBytes = media.reduce((sum, m) => sum + dataUrlBytes(m?.blob?.data), 0) +
    mediaItems.reduce((sum, m) => sum + dataUrlBytes(m?.data || m?.blob?.data), 0);

  const big = [...media, ...mediaItems].filter((m) => dataUrlBytes(m?.blob?.data || m?.data) > 500 * 1024 * 1024);

  return {
    kind,
    exportedAt: payload.exportedAt || null,
    items: {
      bibles: bibles.length,
      songs: songs.length,
      media: media.length + mediaItems.length,
      looks: looksFromSettings(payload).length,
      settings
    },
    bytes: { media: mediaBytes },
    warnings: [
      ...(big.length ? [`${big.length} média(s) dépassent 500 Mo : un avertissement sera affiché à l'import.`] : []),
      ...(bibles.length === 0 ? ['Aucune version biblique dans cette sauvegarde : les favoris de versets seront conservés seuls.'] : [])
    ],
    total: bibles.length + songs.length + media.length + mediaItems.length + settings
  };
}

function dataUrlBytes(data) {
  if (typeof data !== 'string') return 0;
  const comma = data.indexOf(',');
  return comma < 0 ? 0 : Math.floor((data.length - comma - 1) * 0.75);
}

function looksFromSettings(payload) {
  const ls = payload.localStorage || {};
  const looks = [];
  if (ls.bibleDisplaySettings) looks.push({ kind: 'bible', settings: ls.bibleDisplaySettings });
  if (ls.lyricsDisplaySettings) looks.push({ kind: 'songs', settings: ls.lyricsDisplaySettings });
  return looks;
}

/**
 * Exécute la migration. **Idempotente** (EF-26.3) : les identifiants des objets
 * dérivent du contenu, les binaires sont dédupliqués par empreinte.
 */
export async function run(payload) {
  const report = analyze(payload);
  const journal = { startedAt: new Date().toISOString(), items: [], skipped: [], errors: [] };

  const idb = payload.indexedDB || {};

  // 1. Chants -------------------------------------------------------------
  for (const song of idb?.lyricsProStorage?.songs || []) {
    try {
      const mapped = mapSong(song);
      if (!mapped) { journal.skipped.push({ type: 'song', reason: 'vide', title: song?.title }); continue; }
      const file = path.join(projectDir(), 'library', 'songs', `${mapped.id}.json`);
      const existing = await readJson(file, null);
      if (existing) {
        journal.skipped.push({ type: 'song', reason: 'déjà présent', id: mapped.id });
        continue;
      }
      await writeJson(file, mapped);
      journal.items.push({ type: 'song', id: mapped.id, title: mapped.title });
    } catch (err) {
      journal.errors.push({ type: 'song', title: song?.title, message: err.message });
    }
  }

  // 2. Médias -------------------------------------------------------------
  const blobs = [
    ...(idb?.lyricsProStorage?.media || []).map((m) => ({ ...m, _origin: 'lyrics' })),
    ...(idb?.mediaProStorage?.items || []).map((m) => ({ ...m, _origin: 'media' }))
  ];
  for (const item of blobs) {
    try {
      const data = item?.blob?.data || item?.data;
      const parsed = parseDataUrl(data);
      if (!parsed) { journal.skipped.push({ type: 'media', reason: 'binaire absent', id: item?.id }); continue; }
      const name = item.filename || item.name || `${item.id || 'media'}.${parsed.ext}`;
      const res = await importBuffer(parsed.buffer, {
        name,
        mime: parsed.mime,
        kind: item.id === 'background' ? 'background' : 'media'
      });
      journal.items.push({
        type: 'media', sha: res.asset.sha256.slice(0, 8),
        name, bytes: parsed.buffer.length, deduplicated: res.deduplicated
      });
    } catch (err) {
      journal.errors.push({ type: 'media', id: item?.id, message: err.message });
    }
  }

  // 3. Bibles (best effort : format variable selon les versions) ----------
  for (const version of idb?.bibleProStorage?.versions || []) {
    try {
      const mapped = mapBible(version);
      if (!mapped) { journal.skipped.push({ type: 'bible', reason: 'format non pris en charge', name: version?.name }); continue; }
      const file = path.join(projectDir(), 'library', 'bibles', `${mapped.id}.json`);
      if (await readJson(file, null)) {
        journal.skipped.push({ type: 'bible', reason: 'déjà présent', id: mapped.id });
        continue;
      }
      await writeJson(file, mapped.meta);
      await writeJson(path.join(projectDir(), 'library', 'bibles', `${mapped.id}.verses.json`), mapped.verses);
      journal.items.push({ type: 'bible', id: mapped.id, name: mapped.meta.name });
    } catch (err) {
      journal.errors.push({ type: 'bible', name: version?.name, message: err.message });
    }
  }

  // 4. Réglages et favoris (conservés pour la phase 1) --------------------
  const settings = {
    v1: {
      localStorage: payload.localStorage || {},
      server: payload.server || {},
      migratedAt: new Date().toISOString()
    }
  };
  const settingsFile = path.join(projectDir(), 'library', 'looks', 'look_v1_settings.json');
  if (!(await readJson(settingsFile, null))) {
    await writeJson(settingsFile, {
      id: 'look_v1_settings',
      rev: 1,
      name: 'Réglages importés (OpenPresenter 1)',
      kind: 'bible',
      importedSettings: settings.v1,
      layers: []
    });
    journal.items.push({ type: 'look', id: 'look_v1_settings' });
  }

  journal.finishedAt = new Date().toISOString();
  journal.summary = {
    imported: journal.items.length,
    skipped: journal.skipped.length,
    errors: journal.errors.length
  };
  await log('info', 'migrate.done', 'migration V1 terminée', journal.summary);
  return { report, journal };
}

function parseDataUrl(data) {
  if (typeof data !== 'string') return null;
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(data);
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  const buffer = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  const ext = (mime.split('/')[1] || 'bin').replace('quicktime', 'mov').replace('svg+xml', 'svg');
  return { mime, buffer, ext };
}

export function mapSong(song) {
  if (!song || !song.title) return null;
  const rawSections = Array.isArray(song.sections) ? song.sections : [];
  const sections = rawSections
    .filter((s) => s && typeof s.text === 'string' && s.text.trim())
    .map((s, i) => ({
      id: 'sec_' + (s.id ? slug(s.id) : `part${i + 1}`),
      name: s.label || `Partie ${i + 1}`,
      type: guessSectionType(s.label),
      lines: s.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    }));
  if (!sections.length) return null;

  const stable = crypto.createHash('sha1')
    .update(`${song.title}|${song.artist || ''}`).digest('hex').slice(0, 10);

  return {
    id: `sng_${stable}`,
    rev: 1,
    title: String(song.title).slice(0, 200),
    artist: song.artist ? String(song.artist).slice(0, 200) : '',
    language: 'fr',
    tags: [],
    folders: [],
    sections,
    arrangements: [{
      id: 'arr_default',
      name: 'Ordre d’origine',
      order: sections.map((s) => s.id)
    }],
    activeArrangementId: 'arr_default',
    sourceAssetId: null
  };
}

function guessSectionType(label = '') {
  const l = String(label).toLowerCase();
  if (/refrain|chorus/.test(l)) return 'chorus';
  if (/pont|bridge/.test(l)) return 'bridge';
  if (/intro/.test(l)) return 'intro';
  if (/final|outro|coda/.test(l)) return 'outro';
  if (/pré-?refrain|prechorus/.test(l)) return 'prechorus';
  return 'verse';
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'sec';
}

/** Convertit une version biblique si sa structure est reconnue. */
export function mapBible(version) {
  if (!version || !Array.isArray(version.books) || !version.books.length) return null;
  const books = [];
  const chapters = [];
  version.books.forEach((book, bi) => {
    const num = bi + 1;
    const bookChapters = Array.isArray(book.chapters) ? book.chapters : [];
    books.push({
      num,
      name: book.name || `Livre ${num}`,
      abbr: (book.abbreviation || book.name || `L${num}`).slice(0, 6),
      chapters: bookChapters.length
    });
    bookChapters.forEach((chapter, ci) => {
      const verses = Array.isArray(chapter.verses)
        ? chapter.verses.map((v) => (typeof v === 'string' ? v : v.text || '')).filter(Boolean)
        : [];
      if (verses.length) chapters.push({ b: num, c: ci + 1, v: verses });
    });
  });
  if (!books.length) return null;

  const stable = crypto.createHash('sha1')
    .update(`${version.name || ''}|${books.length}`).digest('hex').slice(0, 10);
  const id = `bible_${stable}`;
  return {
    id,
    meta: {
      id,
      rev: 1,
      name: version.name || 'Version importée',
      shortName: (version.abbreviation || version.name || 'IMP').slice(0, 24),
      abbreviation: (version.abbreviation || 'IMP').slice(0, 12),
      language: version.language || 'fr',
      direction: 'ltr',
      source: { kind: 'import', format: 'beblia', originalName: 'migration V1', importedAt: new Date().toISOString() },
      counts: {
        books: books.length,
        chapters: chapters.length,
        verses: chapters.reduce((s, c) => s + c.v.length, 0)
      },
      books,
      favorites: [],
      annotations: {}
    },
    verses: { bibleId: id, chapters }
  };
}
