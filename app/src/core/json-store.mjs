// Écritures atomiques et sérialisées (ENF-22, EF-01.6 → EF-01.10).
//
// Séquence imposée :
//   1. écrire dans <cible>.tmp-<aléatoire>
//   2. fsync du fichier
//   3. rename (atomique sur les 3 OS)
//   4. fsync du dossier parent (best effort sur Windows)

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const queues = new Map(); // chemin → promesse de la dernière opération

function randomSuffix() {
  return crypto.randomBytes(6).toString('hex');
}

/** Sérialise les écritures d'un même fichier (EF-01.8). */
function enqueue(file, task) {
  const key = path.resolve(file);
  const previous = queues.get(key) || Promise.resolve();
  const next = previous.then(task, task);
  // On garde la chaîne vivante mais on n'accumule pas les erreurs.
  queues.set(key, next.catch(() => {}));
  return next;
}

async function fsyncDir(dir) {
  try {
    const fh = await fs.open(dir, 'r');
    try { await fh.sync(); } finally { await fh.close(); }
  } catch {
    // Windows refuse l'ouverture d'un dossier : non bloquant.
  }
}

/** Écrit un fichier de façon atomique. */
export async function writeFileAtomic(file, data) {
  return enqueue(file, async () => {
    const dir = path.dirname(file);
    await fs.mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `.${path.basename(file)}.tmp-${randomSuffix()}`);
    const fh = await fs.open(tmp, 'w');
    try {
      await fh.writeFile(data);
      await fh.sync();
    } finally {
      await fh.close();
    }
    await fs.rename(tmp, file);
    await fsyncDir(dir);
  });
}

/** Écrit un JSON stable (clés triées, 2 espaces, \n final). */
export async function writeJson(file, value) {
  const text = JSON.stringify(sortKeys(value), null, 2) + '\n';
  await writeFileAtomic(file, text);
}

/** Lecture tolérante : renvoie `fallback` si le fichier est absent. */
export async function readJson(file, fallback = null) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

/** Lecture stricte : lève une erreur explicite si le JSON est invalide. */
export async function readJsonStrict(file) {
  const raw = await fs.readFile(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    const e = new Error(`JSON invalide dans ${path.basename(file)} : ${err.message}`);
    e.code = 'INVALID_JSON';
    e.file = file;
    throw e;
  }
}

/** Tri récursif des clés : des diffs Git lisibles (ch. 04 § 4.8). */
export function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
    return out;
  }
  return value;
}

/** Supprime les fichiers `.tmp-*` orphelins (EF-01.7). */
export async function removeOrphanTemps(dir, acc = []) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return acc;
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      await removeOrphanTemps(full, acc);
    } else if (/\.tmp-[0-9a-f]{12}$/.test(entry.name) || /^\.\S+\.tmp-\w+$/.test(entry.name)) {
      await fs.rm(full, { force: true });
      acc.push(full);
    }
  }
  return acc;
}

/** Déplace un fichier ou dossier, en créant la destination (jamais d'écrasement). */
export async function moveAside(from, to) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  let target = to;
  let i = 1;
  while (await exists(target)) target = `${to}-${i++}`;
  await fs.rename(from, target);
  return target;
}

export async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function listDir(dir) {
  try {
    return await fs.readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}
