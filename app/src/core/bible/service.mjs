// Accès disque aux bibles + construction des sélections affichables.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectDir } from '../paths.mjs';
import { readJson, writeJson, exists } from '../json-store.mjs';
import { list, readVerses } from '../library.mjs';
import { splitText, splitAnnotationHtml } from '../split.mjs';
import { buildSelection } from './navigation.mjs';
import { createEntry } from './reference.mjs';
import { BOOKS } from '../books.mjs';

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data');

/** Installe la Bible d'exemple dans un projet neuf (source.kind = « sample »). */
export async function seedSampleBible() {
  const target = path.join(projectDir(), 'library', 'bibles', 'bible_sample_fr.json');
  if (await exists(target)) return false;
  const meta = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'sample-bible.json'), 'utf8'));
  const verses = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'sample-bible.verses.json'), 'utf8'));
  await writeJson(target, meta);
  await writeJson(path.join(projectDir(), 'library', 'bibles', 'bible_sample_fr.verses.json'), verses);
  return true;
}

export async function listBibles() {
  const bibles = await list('bibles');
  return bibles.map((b) => ({
    id: b.id,
    name: b.name,
    shortName: b.shortName || b.abbreviation || b.name,
    abbreviation: b.abbreviation || '',
    language: b.language || 'fr',
    counts: b.counts || null,
    books: b.books || []
  }));
}

/** Bible à utiliser par défaut : celle demandée, sinon la première du projet. */
export async function resolveBible(requestedId, project) {
  const bibles = await list('bibles');
  if (!bibles.length) return null;
  if (requestedId) {
    const found = bibles.find((b) => b.id === requestedId);
    if (found) return found;
  }
  const preferred = project?.settings?.defaultBibleId;
  if (preferred) {
    const found = bibles.find((b) => b.id === preferred);
    if (found) return found;
  }
  return bibles[0];
}

/** Nombre de versets d'un chapitre, ou `null` si la version ne le contient pas. */
export async function makeVerseCounter(bibleId) {
  const data = await readVerses(bibleId);
  const index = new Map();
  for (const chapter of data?.chapters || []) {
    index.set(`${chapter.b}-${chapter.c}`, chapter.v.length);
  }
  return (bookNum, chapter) => index.get(`${bookNum}-${chapter}`) ?? null;
}

export async function chapterVerses(bibleId, bookNum, chapter) {
  const data = await readVerses(bibleId);
  const found = (data?.chapters || []).find((c) => c.b === bookNum && c.c === chapter);
  if (!found) return [];
  return found.v.map((text, i) => ({ num: i + 1, text }));
}

function bookMeta(bible, bookNum) {
  return (bible?.books || []).find((b) => b.num === bookNum)
    || BOOKS.find((b) => b.num === bookNum)
    || { num: bookNum, name: `Livre ${bookNum}`, abbr: `L${bookNum}`, chapters: 0 };
}

/**
 * Construit la sélection affichable pour une plage de versets.
 * @param {object} params
 * @param {object} params.bible méta de la bible
 * @param {number} params.bookNum
 * @param {number} params.chapter
 * @param {number} [params.first]
 * @param {number} [params.last]
 * @param {object} [params.settings] réglages de découpage (par scène)
 */
export async function buildBibleSelection({ bible, bookNum, chapter, first, last, settings = {}, source }) {
  const book = bookMeta(bible, bookNum);
  const all = source || await chapterVerses(bible.id, bookNum, chapter);
  const range = first ? { first, last: last && last > first ? last : first } : null;
  const verses = range ? all.filter((v) => v.num >= range.first && v.num <= range.last) : all;

  const split = (text) => splitText(text, settings).parts;
  const annotated = settings.annotated
    ? (text) => splitAnnotationHtml(text, settings).parts
    : split;

  const selection = buildSelection({
    bookNum,
    bookName: book.name,
    chapter,
    verses,
    range,
    split: annotated,
    label: `${book.name} ${chapter}${range
      ? (range.first === range.last ? ':' + range.first : ':' + range.first + '-' + range.last)
      : ''}`
  });

  return {
    ...selection,
    bibleId: bible.id,
    bibleName: bible.shortName || bible.name,
    versesAvailable: all.length,
    settings: { ...settings }
  };
}

/** Machine de saisie prête à l'emploi pour une bible donnée. */
export async function makeEntry(bibleId) {
  const counter = await makeVerseCounter(bibleId);
  return createEntry({ verseCount: counter });
}

export { DATA_DIR };
