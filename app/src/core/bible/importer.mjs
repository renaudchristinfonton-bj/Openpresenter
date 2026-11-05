// Import d'une version biblique depuis un fichier (EF-11.1 → EF-11.10).
//
// Séquence imposée par le cahier des charges :
//   1. lecture et détection du format       → `parseBibleXml`
//   2. copie du fichier dans `assets/bibles/` (P4 : le projet reste auto-porteur)
//   3. écriture `library/bibles/<id>.json` + `<id>.verses.json`
//   4. détection des doublons par empreinte
//   5. sélection automatique si c'est la première version du projet

import fs from 'node:fs/promises';
import path from 'node:path';
import { projectDir } from '../paths.mjs';
import { readJson, writeJson, exists } from '../json-store.mjs';
import { list } from '../library.mjs';
import { importBuffer } from '../assets.mjs';
import { readProject, patchSettings } from '../project.mjs';
import { BOOKS } from '../books.mjs';
import { parseBibleXml, detectFormat } from './formats.mjs';

const MAX_BYTES = 64 * 1024 * 1024;

/** Abréviation courte et unique dans le projet (2 à 6 caractères, EF-11.7). */
export function suggestAbbreviation(name, taken = []) {
  const letters = String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z ]/g, ' ')
    .split(/\s+/).filter(Boolean);
  let base = letters.length > 1
    ? letters.slice(0, 4).map((word) => word[0]).join('').toUpperCase()
    : (letters[0] || 'BIB').slice(0, 3).toUpperCase();
  if (base.length < 2) base = 'BIB';
  if (!taken.some((code) => code.toLowerCase() === base.toLowerCase())) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base.slice(0, 4)}${i}`;
    if (!taken.some((code) => code.toLowerCase() === candidate.toLowerCase())) return candidate;
  }
  return base.slice(0, 4) + 'X';
}

function slug(text) {
  const plain = String(text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return plain.slice(0, 20) || 'bible';
}

/**
 * Analyse **sans écriture** : sert à la prévisualisation avant validation (EF-11.2).
 * @param {string} xml
 * @param {{filename?:string}} [options]
 */
function analyse(xml, { filename = '' } = {}) {
  const bytes = Buffer.byteLength(String(xml), 'utf8');
  if (bytes > MAX_BYTES) {
    throw Object.assign(new Error('Ce fichier dépasse la taille maximale autorisée (64 Mo).'), {
      code: 'TOO_LARGE',
      message: 'TXT: Ce fichier dépasse 64 Mo.\n     Choisissez une Bible au format XML non compressé.'
    });
  }
  const parsed = parseBibleXml(xml);
  const suggestedName = parsed.name || filename.replace(/\.xml$/i, '').replace(/[_-]+/g, ' ') || 'Bible';
  return {
    parsed,
    preview: {
      format: parsed.format,
      formatLabel: parsed.label,
      name: suggestedName.slice(0, 120),
      language: parsed.language === 'und' ? null : parsed.language,
      direction: parsed.direction,
      counts: parsed.counts,
      preview: parsed.preview,
      sizeBytes: bytes,
      filename: filename || null
    }
  };
}

export function previewBible(xml, options = {}) {
  return analyse(xml, options).preview;
}

/**
 * Importe une Bible : copie de la source, index de versets, méta.
 * @param {string} xml contenu du fichier
 * @param {{filename?:string, name?:string, abbreviation?:string, license?:string, language?:string}} [options]
 * @returns {Promise<{bible:object, created:boolean, deduplicated:boolean, summary:object}>}
 */
export async function importBibleXml(xml, options = {}) {
  const { parsed, preview } = analyse(xml, options);
  const buffer = Buffer.from(String(xml), 'utf8');

  // 2. copie dans `assets/bibles/<sha8>.xml` : le fichier d'origine reste dans le projet.
  let asset = null;
  try {
    const result = await importBuffer(buffer, {
      name: options.filename || `${slug(preview.name)}.xml`,
      mime: 'application/xml',
      kind: 'bible'
    });
    asset = result.asset;
  } catch {
    // L'asset est un confort : son échec ne bloque jamais l'import des versets.
  }

  const id = `bible_${slug(options.name || preview.name)}_${(asset?.sha256 || Date.now().toString(16)).slice(0, 6)}`;
  const existing = await readJson(path.join(projectDir(), 'library', 'bibles', `${id}.json`), null);
  if (existing) {
    return {
      bible: existing,
      created: false,
      deduplicated: true,
      summary: summarise(existing)
    };
  }

  const bibles = await list('bibles');
  const abbreviation = (options.abbreviation
    || suggestAbbreviation(options.name || preview.name, bibles.map((b) => b.abbreviation).filter(Boolean)))
    .slice(0, 6);

  const meta = {
    id,
    rev: 1,
    name: (options.name || preview.name).slice(0, 120),
    shortName: (options.name || preview.name).slice(0, 40),
    abbreviation,
    language: (options.language || (parsed.language !== 'und' ? parsed.language : '') || 'fr').slice(0, 12),
    direction: parsed.direction,
    source: {
      kind: 'file',
      format: parsed.format,
      originalName: options.filename || null,
      license: (options.license || '').slice(0, 120) || null,
      assetId: asset?.assetId || null,
      sha256: asset?.sha256 || null
    },
    counts: parsed.counts,
    books: parsed.books.map((book) => ({
      num: book.num,
      name: book.name,
      abbr: book.abbr || BOOKS.find((entry) => entry.num === book.num)?.abbr || '',
      chapters: book.chapters.length
    })),
    favorites: 0,
    annotations: {}
  };

  // 5. index de versets : un fichier séparé, lu à la demande.
  const verses = {
    bibleId: id,
    chapters: parsed.books.flatMap((book) => book.chapters.map((chapter) => ({
      b: book.num,
      c: chapter.num,
      v: chapter.verses
    })))
  };

  await writeJson(path.join(projectDir(), 'library', 'bibles', `${id}.json`), meta);
  await writeJson(path.join(projectDir(), 'library', 'bibles', `${id}.verses.json`), verses);

  // 6. première version du projet → elle devient la version par défaut.
  const project = await readProject();
  if (project && !project.settings?.defaultBibleId) {
    await patchSettings({ defaultBibleId: id }).catch(() => {});
  }

  return {
    bible: meta,
    created: true,
    deduplicated: Boolean(asset?.deduplicated),
    summary: summarise(meta)
  };
}

function summarise(meta) {
  return {
    id: meta.id,
    name: meta.name,
    abbreviation: meta.abbreviation,
    language: meta.language,
    counts: meta.counts,
    direction: meta.direction
  };
}

/** Supprime une version et son index de versets. Le texte d'origine reste dans les assets. */
export async function removeBible(id) {
  const file = path.join(projectDir(), 'library', 'bibles', `${id}.json`);
  if (!(await exists(file))) {
    throw Object.assign(new Error("Cette version biblique n'existe plus."), { code: 'NOT_FOUND' });
  }
  await fs.rm(file, { force: true });
  await fs.rm(path.join(projectDir(), 'library', 'bibles', `${id}.verses.json`), { force: true });
  const project = await readProject();
  if (project?.settings?.defaultBibleId === id) {
    const remaining = await list('bibles');
    await patchSettings({ defaultBibleId: remaining[0]?.id || null }).catch(() => {});
  }
  return { id, removed: true };
}

/** Met à jour nom, abréviation, langue d'une version déjà importée (EF-11.6). */
export async function renameBible(id, patch = {}) {
  const file = path.join(projectDir(), 'library', 'bibles', `${id}.json`);
  const meta = await readJson(file, null);
  if (!meta) throw Object.assign(new Error("Cette version biblique n'existe plus."), { code: 'NOT_FOUND' });
  const next = {
    ...meta,
    rev: (meta.rev || 1) + 1,
    name: typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim().slice(0, 120) : meta.name,
    shortName: typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim().slice(0, 40) : meta.shortName,
    abbreviation: typeof patch.abbreviation === 'string' && patch.abbreviation.trim()
      ? patch.abbreviation.trim().slice(0, 6) : meta.abbreviation,
    language: typeof patch.language === 'string' && patch.language.trim()
      ? patch.language.trim().slice(0, 12) : meta.language
  };
  await writeJson(file, next);
  return next;
}

export { detectFormat };
