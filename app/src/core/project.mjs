// Cycle de vie d'un projet disque (ch. 04) : arborescence, project.json, verrou.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {
  projectDir, FORMAT_VERSION, APP_VERSION, ESSENTIAL_DIRS, CACHE_DIRS,
  BACKUP_DIR, timeStamp
} from './paths.mjs';
import { readJson, writeJson, exists, removeOrphanTemps } from './json-store.mjs';
import { log } from './log.mjs';

export const LOCK_FILE = '.lock';
export const STALE_MS = 60_000;

export function projectFile(name) {
  return path.join(projectDir(), name);
}

/** Crée l'arborescence normative et `project.json` si nécessaire. */
export async function ensureProject({ name } = {}) {
  const dir = projectDir();
  const created = !(await exists(path.join(dir, 'project.json')));
  await fs.mkdir(dir, { recursive: true });
  for (const sub of [...ESSENTIAL_DIRS, ...CACHE_DIRS, 'logs', BACKUP_DIR]) {
    await fs.mkdir(path.join(dir, sub), { recursive: true });
  }
  let project = await readJson(path.join(dir, 'project.json'));
  if (!project) {
    project = defaultProject(name || path.basename(path.resolve(dir)));
    await writeJson(path.join(dir, 'project.json'), project);
    await log('info', 'project.open', 'project.json créé', { projectId: project.id });
  }
  await seedDefaultOutputs();
  return { created, project };
}

export function defaultProject(name) {
  const now = new Date().toISOString();
  return {
    id: 'prj_' + crypto.randomBytes(6).toString('hex'),
    name: name || 'Mon projet',
    formatVersion: FORMAT_VERSION,
    appVersion: APP_VERSION,
    createdAt: now,
    updatedAt: now,
    language: 'fr',
    settings: {
      port: 8788,
      lanToken: randomToken(),
      lanTokenEnabled: true,
      activeProfileId: null,
      activeEventId: null,
      defaultBibleId: null,
      maxAssetWarnBytes: 500 * 1024 * 1024,
      autoBackup: true,
      autoBackupKeep: 10,
      readOnly: false,
      catalogEnabled: false,
      blankOnStartup: true,
      verboseLog: process.env.OPENPRESENTER_VERBOSE === '1'
    }
  };
}

/**
 * Les deux sorties créées avec le projet (ch. 07 § 7.2.1) :
 * « Plein écran — Salle » et « Bas centré — Stream » (transparente).
 */
export const DEFAULT_OUTPUTS = [
  {
    id: 'out_full',
    name: 'Plein écran — Salle',
    preset: 'full',
    width: 1920,
    height: 1080,
    fit: 'contain',
    transparent: false,
    enabled: true,
    targetByDefault: true,
    receives: {
      bible: true, songs: true, media: true, announcements: true,
      lowerthird: false, timer: false, plan: false
    },
    scenesByKind: {},
    notes: 'Projecteur de salle.'
  },
  {
    id: 'out_bottom',
    name: 'Bas centré — Stream',
    preset: 'bottom',
    width: 1920,
    height: 1080,
    fit: 'contain',
    transparent: true,
    enabled: true,
    targetByDefault: true,
    receives: {
      bible: true, songs: true, media: true, announcements: true,
      lowerthird: true, timer: true, plan: false
    },
    scenesByKind: {},
    notes: 'Bandeau à superposer dans OBS ou vMix.'
  }
];

export async function seedDefaultOutputs() {
  const file = path.join(projectDir(), 'outputs', 'outputs.json');
  const existing = await readJson(file, null);
  if (existing) return false;
  await writeJson(file, { rev: 1, outputs: structuredClone(DEFAULT_OUTPUTS) });
  return true;
}

export function randomToken() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(4);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export async function readProject() {
  return readJson(path.join(projectDir(), 'project.json'));
}

export async function writeProject(project) {
  const next = { ...project, updatedAt: new Date().toISOString(), appVersion: APP_VERSION };
  await writeJson(path.join(projectDir(), 'project.json'), next);
  return next;
}

export async function patchSettings(patch) {
  const project = await readProject();
  if (!project) throw Object.assign(new Error('Projet introuvable'), { code: 'NOT_FOUND' });
  project.settings = { ...project.settings, ...patch };
  return writeProject(project);
}

/** Vérifie la compatibilité de format ; refuse d'écrire sur une version future. */
export async function checkFormat(project) {
  if (!project) return { ok: false, code: 'NO_PROJECT' };
  if (project.formatVersion > FORMAT_VERSION) {
    return { ok: false, code: 'FORMAT_TOO_RECENT', projectFormat: project.formatVersion };
  }
  if (project.formatVersion < FORMAT_VERSION) {
    return { ok: true, migrate: true, from: project.formatVersion };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Verrou de projet (EF-01.9)
// ---------------------------------------------------------------------------

export async function readLock() {
  return readJson(path.join(projectDir(), LOCK_FILE));
}

export function lockIsStale(lock) {
  if (!lock) return true;
  const beat = Date.parse(lock.heartbeatAt || lock.startedAt || 0);
  return !Number.isFinite(beat) || Date.now() - beat > STALE_MS;
}

/**
 * Tente d'acquérir le verrou.
 * - libre ou obsolète → acquis
 * - détenu par ce processus → déjà acquis
 * - détenu par un autre processus vivant → refus
 */
export async function acquireLock() {
  const file = path.join(projectDir(), LOCK_FILE);
  const existing = await readLock();
  if (existing && existing.pid === process.pid) return { ok: true, lock: existing };
  if (existing && !lockIsStale(existing)) {
    return { ok: false, code: 'LOCKED', lock: existing };
  }
  if (existing) {
    await log('warn', 'project.lock.stale', 'verrou obsolète repris', { pid: existing.pid });
  }
  const lock = {
    pid: process.pid,
    host: os.hostname(),
    startedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString()
  };
  await fs.writeFile(file, JSON.stringify(lock, null, 2) + '\n', 'utf8');
  return { ok: true, lock };
}

export async function heartbeatLock(lock) {
  if (!lock || lock.pid !== process.pid) return;
  lock.heartbeatAt = new Date().toISOString();
  try {
    await fs.writeFile(path.join(projectDir(), LOCK_FILE), JSON.stringify(lock, null, 2) + '\n', 'utf8');
  } catch { /* verrou perdu : non bloquant */ }
}

export async function releaseLock(lock) {
  if (!lock || lock.pid !== process.pid) return;
  try { await fs.rm(path.join(projectDir(), LOCK_FILE), { force: true }); } catch { /* ignore */ }
}

/** Nettoyage de démarrage : `.tmp-*` orphelins (EF-01.7). */
export async function cleanupTemps() {
  const removed = await removeOrphanTemps(projectDir());
  if (removed.length) {
    await log('warn', 'write.tmp_orphan_removed', `${removed.length} fichier(s) temporaire(s) supprimé(s)`);
  }
  return removed;
}

// ---------------------------------------------------------------------------
// État de session (reprise après plantage)
// ---------------------------------------------------------------------------

export async function readSessionState() {
  return readJson(path.join(projectDir(), 'session-state.json'), null);
}

export async function writeSessionState(state) {
  await writeJson(path.join(projectDir(), 'session-state.json'), {
    savedAt: new Date().toISOString(),
    ...state
  });
}

// ---------------------------------------------------------------------------
// Sauvegarde automatique (EF-26.1)
// ---------------------------------------------------------------------------

export async function backupNow({ keep } = {}) {
  const { createArchive } = await import('./zip.mjs');
  const project = await readProject();
  const keepCount = keep || project?.settings?.autoBackupKeep || 10;
  const name = await uniqueBackupName('auto');
  const target = path.join(projectDir(), BACKUP_DIR, name);

  const files = await collectBackupFiles();
  const buffer = createArchive(files, { includesMedia: false });
  await fs.writeFile(target, buffer);
  await pruneBackups(keepCount);
  await log('info', 'backup.done', `sauvegarde ${name}`, { bytes: buffer.length });
  return { file: name, bytes: buffer.length };
}

/** Fichiers inclus dans une sauvegarde : jamais les binaires par défaut. */
async function collectBackupFiles() {
  const root = projectDir();
  const files = [];
  const add = async (rel) => {
    const abs = path.join(root, rel);
    try {
      const st = await fs.stat(abs);
      if (st.isFile()) files.push({ path: rel, data: await fs.readFile(abs) });
    } catch { /* absent */ }
  };
  await add('project.json');
  await add('assets/index.json');
  for (const dir of ['library', 'scenes', 'outputs', 'profiles', 'orgs', 'events']) {
    for (const rel of await walkRel(path.join(root, dir))) await add(rel);
  }
  return files;
}

export async function collectFullFiles() {
  const root = projectDir();
  const files = [];
  const add = async (rel) => {
    const abs = path.join(root, rel);
    try {
      const st = await fs.stat(abs);
      if (st.isFile()) files.push({ path: rel, data: await fs.readFile(abs) });
    } catch { /* absent */ }
  };
  await add('project.json');
  for (const dir of ['library', 'assets', 'outputs', 'scenes', 'profiles', 'orgs', 'events']) {
    for (const rel of await walkRel(path.join(root, dir))) {
      if (/\.tmp-/.test(rel)) continue;
      await add(rel);
    }
  }
  return files;
}

async function walkRel(dirAbs, base = null, acc = []) {
  const baseDir = base ?? dirAbs;
  let entries = [];
  try { entries = await fs.readdir(dirAbs, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const abs = path.join(dirAbs, e.name);
    if (e.isDirectory()) await walkRel(abs, baseDir, acc);
    else acc.push(path.relative(projectDir(), abs).split(path.sep).join('/'));
  }
  return acc;
}

/** Nom de sauvegarde unique (deux sauvegardes dans la même seconde). */
async function uniqueBackupName(prefix) {
  const dir = path.join(projectDir(), BACKUP_DIR);
  const base = `${prefix}-${timeStamp()}`;
  let candidate = `${base}.zip`;
  let i = 1;
  while (await exists(path.join(dir, candidate))) candidate = `${base}-${i++}.zip`;
  return candidate;
}

async function pruneBackups(keep) {
  const dir = path.join(projectDir(), BACKUP_DIR);
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.startsWith('auto-') && f.endsWith('.zip')).sort();
  } catch { return; }
  while (files.length > keep) {
    const oldest = files.shift();
    await fs.rm(path.join(dir, oldest), { force: true });
  }
}

export { walkRel };
