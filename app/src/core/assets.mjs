// Registre d'assets (ch. 04 § 4.4) : import, empreinte SHA-256 en flux,
// déduplication, miniature, références, orphelins.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { projectDir, timeStamp } from './paths.mjs';
import { readJson, writeJson, exists, moveAside } from './json-store.mjs';
import { log } from './log.mjs';

export const KIND_DIRS = {
  media: 'media',
  background: 'backgrounds',
  logo: 'logos',
  font: 'fonts',
  bible: 'bibles',
  song: 'songs'
};

export const MIME_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'image/svg+xml': 'svg', 'image/avif': 'avif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/xml': 'xml', 'application/xml': 'xml', 'application/json': 'json',
  'text/plain': 'txt', 'application/octet-stream': 'bin',
  'font/ttf': 'ttf', 'font/otf': 'otf', 'font/woff2': 'woff2'
};

const INDEX = 'assets/index.json';

export function indexPath() {
  return path.join(projectDir(), INDEX);
}

export async function readIndex() {
  const idx = await readJson(indexPath(), null);
  if (!idx || typeof idx !== 'object' || !idx.assets) return { version: 1, assets: {} };
  return idx;
}

export async function writeIndex(idx) {
  await writeJson(indexPath(), idx);
}

export function assetId(sha256) {
  return 'as_' + sha256.slice(0, 12);
}

/** Devine le type d'asset à partir du type MIME et du nom. */
export function guessKind(mime = '', name = '') {
  if (/^font\//.test(mime)) return 'font';
  if (/xml$/.test(mime) || /\.xml$/i.test(name)) return 'bible';
  if (/image|video|pdf|presentationml/.test(mime)) return 'media';
  return 'media';
}

/**
 * Importe un flux entrant : calcule l'empreinte **sans charger le fichier entier**
 * quand le flux est fourni en morceaux (EF-02.1 → EF-02.5).
 */
export async function importStream(stream, { name, mime, kind, thumbB64 } = {}) {
  const resolvedKind = KIND_DIRS[kind] ? kind : guessKind(mime, name);
  const hash = crypto.createHash('sha256');
  const tmpDir = path.join(projectDir(), 'cache');
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `.import-${crypto.randomBytes(6).toString('hex')}.part`);
  const out = await fs.open(tmpFile, 'w');
  let bytes = 0;
  try {
    for await (const chunk of stream) {
      bytes += chunk.length;
      hash.update(chunk);
      await out.write(chunk);
    }
  } finally {
    await out.close();
  }
  const sha256 = hash.digest('hex');
  const idx = await readIndex();

  if (idx.assets[sha256]) {
    const entry = idx.assets[sha256];
    entry.refs = (entry.refs || 0) + 1;
    if (name && !entry.originalName) entry.originalName = name;
    if (name && entry.originalName !== name) {
      entry.altNames = [...new Set([...(entry.altNames || []), name])].slice(-5);
    }
    await writeIndex(idx);
    await fs.rm(tmpFile, { force: true });
    await log('info', 'asset.dedup', 'asset déjà présent', { sha: sha256.slice(0, 8), bytes });
    return { asset: publicAsset(entry), deduplicated: true };
  }

  const ext = (MIME_EXT[mime] || path.extname(name || '').replace('.', '') || 'bin').toLowerCase();
  const rel = `${KIND_DIRS[resolvedKind]}/${sha256.slice(0, 8)}.${ext}`;
  const abs = path.join(projectDir(), 'assets', rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.rename(tmpFile, abs);

  const entry = {
    assetId: assetId(sha256),
    sha256,
    path: rel,
    mime: mime || 'application/octet-stream',
    ext,
    bytes,
    originalName: name || path.basename(rel),
    importedAt: new Date().toISOString(),
    kind: resolvedKind,
    linked: false,
    refs: 1
  };
  if (thumbB64) {
    const thumbPath = path.join(projectDir(), 'cache', 'thumb', `${sha256.slice(0, 8)}.webp`);
    await fs.mkdir(path.dirname(thumbPath), { recursive: true });
    try {
      await fs.writeFile(thumbPath, Buffer.from(thumbB64, 'base64'));
      entry.thumb = `thumb/${sha256.slice(0, 8)}.webp`;
    } catch { /* miniature facultative */ }
  }
  idx.assets[sha256] = entry;
  await writeIndex(idx);
  await log('info', 'asset.import', 'asset importé', {
    sha: sha256.slice(0, 8), bytes, kind: resolvedKind
  });
  return { asset: publicAsset(entry), deduplicated: false };
}

/** Import depuis un Buffer (migration, restauration d'archive). */
export async function importBuffer(buffer, meta = {}) {
  const { Readable } = await import('node:stream');
  return importStream(Readable.from([buffer]), meta);
}

export function publicAsset(entry) {
  return {
    assetId: entry.assetId || assetId(entry.sha256),
    sha256: entry.sha256,
    path: entry.path,
    mime: entry.mime,
    ext: entry.ext,
    bytes: entry.bytes,
    originalName: entry.originalName,
    importedAt: entry.importedAt,
    kind: entry.kind,
    linked: Boolean(entry.linked),
    refs: entry.refs || 0,
    thumb: entry.thumb || null,
    url: `/api/assets/${entry.sha256}`
  };
}

/** Résout un asset par `as_…`, par empreinte complète ou par empreinte courte. */
export async function findAsset(ref) {
  if (!ref) return null;
  const idx = await readIndex();
  if (idx.assets[ref]) return idx.assets[ref];
  const short = String(ref).replace(/^as_/, '');
  for (const [sha, entry] of Object.entries(idx.assets)) {
    if (sha.startsWith(short) || (entry.assetId || '').replace(/^as_/, '').startsWith(short)) return entry;
  }
  return null;
}

export async function assetPath(ref) {
  const entry = await findAsset(ref);
  if (!entry) return null;
  return kindPath(entry.path);
}

export function kindPath(rel) {
  return path.join(projectDir(), 'assets', rel);
}

/** Recalcule `refs` en scannant les objets métier (EF-02.4). */
export async function recountRefs() {
  const idx = await readIndex();
  for (const entry of Object.values(idx.assets)) entry.refs = 0;

  const refs = new Map();
  const bump = (ref) => {
    if (!ref || typeof ref !== 'string') return;
    const short = ref.replace(/^as_/, '');
    if (short.length < 8) return;
    for (const sha of Object.keys(idx.assets)) {
      if (sha.startsWith(short)) refs.set(sha, (refs.get(sha) || 0) + 1);
    }
  };

  const scan = (value, depth = 0) => {
    if (depth > 12 || value == null) return;
    if (Array.isArray(value)) return value.forEach((v) => scan(v, depth + 1));
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'string' && /(assetId|AssetId|logoAssetId|imageAssetId)$/i.test(k)) bump(v);
        else scan(v, depth + 1);
      }
    }
  };

  for (const dir of ['library', 'scenes', 'profiles', 'outputs', 'orgs', 'events']) {
    for (const file of await walkJson(path.join(projectDir(), dir))) {
      try { scan(JSON.parse(await fs.readFile(file, 'utf8'))); } catch { /* ignoré */ }
    }
  }
  for (const [sha, count] of refs) if (idx.assets[sha]) idx.assets[sha].refs = count;
  await writeIndex(idx);
  return idx;
}

async function walkJson(dir, acc = []) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walkJson(full, acc);
    else if (e.name.endsWith('.json')) acc.push(full);
  }
  return acc;
}

/** Rapport d'intégrité (EF-01.15). */
export async function integrityReport() {
  const idx = await readIndex();
  const report = {
    checkedAt: new Date().toISOString(),
    assets: { total: 0, orphan: [], missing: [], linked: [], thumbMissing: [] },
    temps: [],
    brokenRefs: []
  };
  for (const entry of Object.values(idx.assets)) {
    report.assets.total++;
    if (!(await exists(kindPath(entry.path)))) report.assets.missing.push(publicAsset(entry));
    if (!entry.refs) report.assets.orphan.push(publicAsset(entry));
    if (entry.linked) report.assets.linked.push(publicAsset(entry));
    if (entry.thumb && !(await exists(path.join(projectDir(), 'cache', entry.thumb)))) {
      report.assets.thumbMissing.push(publicAsset(entry));
    }
  }
  report.temps = await findTemps();
  report.brokenRefs = await findBrokenRefs();
  return report;
}

async function findTemps(dir = projectDir(), acc = []) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'backups'].includes(e.name)) continue;
      await findTemps(full, acc);
    } else if (/\.part$|\.tmp-[0-9a-f]{12}$/.test(e.name)) {
      acc.push(path.relative(projectDir(), full).split(path.sep).join('/'));
    }
  }
  return acc;
}

async function findBrokenRefs() {
  const broken = [];
  const sceneIds = new Set();
  for (const f of await walkJson(path.join(projectDir(), 'scenes'))) {
    try { sceneIds.add(JSON.parse(await fs.readFile(f, 'utf8')).id); } catch { /* ignoré */ }
  }
  const outputs = await readJson(path.join(projectDir(), 'outputs', 'outputs.json'), null);
  for (const out of outputs?.outputs || []) {
    for (const [kind, sceneId] of Object.entries(out.scenesByKind || {})) {
      if (sceneId && !sceneIds.has(sceneId)) broken.push({ outputId: out.id, kind, sceneId });
    }
  }
  return broken;
}

/** Déplace les assets orphelins dans backups/orphelins-<date>/ (EF-01.17). */
export async function purgeOrphans() {
  const idx = await readIndex();
  const moved = [];
  const target = path.join(projectDir(), 'backups', `orphelins-${timeStamp()}`);
  for (const [sha, entry] of Object.entries(idx.assets)) {
    if (entry.refs > 0) continue;
    const abs = kindPath(entry.path);
    if (await exists(abs)) {
      await moveAside(abs, path.join(target, path.basename(entry.path)));
      moved.push({ sha: sha.slice(0, 8), path: entry.path, bytes: entry.bytes });
    }
    delete idx.assets[sha];
  }
  if (moved.length) {
    await writeIndex(idx);
    await log('info', 'asset.orphan.purged', `${moved.length} asset(s) orphelin(s) déplacé(s)`, { count: moved.length });
  }
  return { moved, bytes: moved.reduce((s, m) => s + (m.bytes || 0), 0) };
}
