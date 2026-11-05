// Objets métier sur disque : lecture, écriture, conflits de révision.
// Un fichier par objet (sauf `outputs`), nommé par son identifiant.

import fs from 'node:fs/promises';
import path from 'node:path';
import { projectDir } from './paths.mjs';
import { readJson, writeJson } from './json-store.mjs';

export const RESOURCES = {
  bibles: { dir: 'library/bibles', prefix: 'bible', label: 'Bible' },
  songs: { dir: 'library/songs', prefix: 'sng', label: 'Chant' },
  looks: { dir: 'library/looks', prefix: 'look', label: 'Look' },
  announcements: { dir: 'library/announcements', prefix: 'ann', label: 'Annonce' },
  timers: { dir: 'library/timers', prefix: 'tmr', label: 'Minuteur' },
  lowerthirds: { dir: 'library/lowerthirds', prefix: 'lt', label: 'Habillage' },
  scenes: { dir: 'scenes', prefix: 'scn', label: 'Scène' },
  profiles: { dir: 'profiles', prefix: 'prof', label: 'Profil' },
  orgs: { dir: 'orgs', prefix: 'org', label: 'Organisation' },
  events: { dir: 'events', prefix: 'evt', label: 'Événement' }
};

export function isResource(type) {
  return Object.prototype.hasOwnProperty.call(RESOURCES, type);
}

export function resourceDir(type) {
  const def = RESOURCES[type];
  if (!def) throw Object.assign(new Error('Type de contenu inconnu.'), { code: 'UNKNOWN_TYPE' });
  return path.join(projectDir(), def.dir);
}

export function fileFor(type, id) {
  return path.join(resourceDir(type), `${id}.json`);
}

export function isValidId(type, id) {
  const def = RESOURCES[type];
  if (!def) return false;
  if (!/^[a-z0-9_-]{3,48}$/.test(id || '')) return false;
  return id.startsWith(`${def.prefix}_`) || type === 'events' || type === 'orgs';
}

export async function list(type) {
  const dir = resourceDir(type);
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json') && !f.includes('.verses.'));
  } catch {
    return [];
  }
  const out = [];
  for (const f of files.sort()) {
    const obj = await readJson(path.join(dir, f), null);
    if (obj && obj.id) out.push(obj);
  }
  return out;
}

export async function get(type, id) {
  return readJson(fileFor(type, id), null);
}

export async function put(type, id, obj, { mode = 'upsert' } = {}) {
  if (!isValidId(type, id)) {
    throw Object.assign(new Error('Identifiant invalide.'), { code: 'VALIDATION', path: 'id' });
  }
  if (!obj || typeof obj !== 'object') {
    throw Object.assign(new Error('Objet attendu.'), { code: 'VALIDATION', path: '' });
  }
  const existing = await get(type, id);
  if (existing && mode === 'create') {
    throw Object.assign(new Error('Cet élément existe déjà.'), { code: 'CONFLICT', path: 'id' });
  }
  if (existing) {
    const incoming = Number.isInteger(obj.rev) ? obj.rev : existing.rev || 1;
    if (incoming < (existing.rev || 1)) {
      const err = Object.assign(new Error('Cet élément a été modifié ailleurs.'), { code: 'CONFLICT' });
      err.current = existing;
      throw err;
    }
    obj.rev = Math.max(incoming, (existing.rev || 1)) + 1;
  } else {
    obj.rev = Number.isInteger(obj.rev) && obj.rev > 0 ? obj.rev : 1;
  }
  obj.id = id;
  // Les schémas de l'annexe 24 n'autorisent pas de champ d'horodatage par objet :
  // la date de dernière écriture vit dans le journal et dans l'index de recherche.
  await writeJson(fileFor(type, id), obj);
  return obj;
}

export async function remove(type, id) {
  const existing = await get(type, id);
  if (!existing) throw Object.assign(new Error("Cet élément n'existe plus."), { code: 'NOT_FOUND' });
  if (type === 'bibles') {
    await fs.rm(path.join(resourceDir(type), `${id}.verses.json`), { force: true });
  }
  await fs.rm(fileFor(type, id), { force: true });
  return { deleted: id };
}

// ---------------------------------------------------------------------------
// Sorties : fichier unique `outputs/outputs.json` (ch. 04 § 4.7.3)
// ---------------------------------------------------------------------------

export function outputsFile() {
  return path.join(projectDir(), 'outputs', 'outputs.json');
}

export async function readOutputs() {
  const data = await readJson(outputsFile(), null);
  return data || { rev: 1, outputs: [] };
}

export async function writeOutputs(next) {
  const raw = await readJson(outputsFile(), null);
  const current = raw || { rev: 0, outputs: [] };
  const exists = Boolean(raw);
  const rev = Number.isInteger(next.rev) ? next.rev : current.rev || 1;
  if (rev < (current.rev || 1)) {
    const err = Object.assign(new Error('Cet élément a été modifié ailleurs.'), { code: 'CONFLICT' });
    err.current = current;
    throw err;
  }
  if (!Array.isArray(next.outputs)) {
    throw Object.assign(new Error('`outputs` doit être une liste.'), { code: 'VALIDATION', path: 'outputs' });
  }
  if (next.outputs.length > 32) {
    throw Object.assign(new Error('Maximum : 32 sorties.'), { code: 'VALIDATION', path: 'outputs' });
  }
  const seen = new Set();
  for (const [i, out] of next.outputs.entries()) {
    if (!out || typeof out !== 'object') {
      throw Object.assign(new Error('Sortie invalide.'), { code: 'VALIDATION', path: `outputs[${i}]` });
    }
    if (!/^out_[a-z0-9_]{2,40}$/.test(out.id || '')) {
      throw Object.assign(new Error('Identifiant de sortie invalide.'), { code: 'VALIDATION', path: `outputs[${i}].id` });
    }
    if (seen.has(out.id)) {
      throw Object.assign(new Error('Identifiant de sortie en double.'), { code: 'VALIDATION', path: `outputs[${i}].id` });
    }
    seen.add(out.id);
  }
  const payload = {
    rev: exists ? Math.max(rev, current.rev || 1) + 1 : Math.max(rev, 1),
    outputs: next.outputs.map(normalizeOutput)
  };
  await writeJson(outputsFile(), payload);
  return payload;
}

/** Valeurs par défaut d'une sortie, conformes à `outputs.schema.json` (§ 24.6). */
export function normalizeOutput(input) {
  const kindMap = {
    bible: true, songs: true, media: true, announcements: true,
    lowerthird: false, timer: false, plan: false
  };
  const out = {
    preset: 'full',
    width: 1920,
    height: 1080,
    fit: 'contain',
    transparent: false,
    enabled: true,
    targetByDefault: false,
    ...input
  };
  out.receives = { ...kindMap, ...(input.receives || {}) };
  out.scenesByKind = { ...(input.scenesByKind || {}) };
  return out;
}

// ---------------------------------------------------------------------------
// Versets : fichier séparé (EF-11.1)
// ---------------------------------------------------------------------------

export function versesFile(bibleId) {
  return path.join(resourceDir('bibles'), `${bibleId}.verses.json`);
}

export async function readVerses(bibleId) {
  return readJson(versesFile(bibleId), null);
}

export async function writeVerses(bibleId, verses) {
  await writeJson(versesFile(bibleId), { bibleId, ...verses });
  return { bibleId };
}
