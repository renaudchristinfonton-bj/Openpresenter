// Sections, arrangements et navigation d'un chant (EF-15.8 → EF-15.16).
//
// Module **pur** : aucun import. Le studio s'en sert pour le conducteur, et la
// vue scène pour l'affichage. Une sélection de chant est une **liste plate**
// d'éléments, exactement comme une sélection de Bible (ch. 09 § 9.4) : l'indice
// courant est un entier, il n'y a donc aucun cas limite de fin de section.

import { splitText } from '../split.mjs';
import { SECTION_LABELS, SECTION_TYPES } from './parser.mjs';

export const DEFAULT_SPLIT = {
  splitMode: 'auto',
  splitBy: 'words',
  maxWordsPerScreen: 20,
  maxCharsPerScreen: 140,
  maxLinesPerScreen: 3,
  minWordsPerPart: 3,
  balanceParts: true
};

export const ACTIONS = ['next', 'prev', 'sectionNext', 'sectionPrev', 'repeat', 'first', 'last', 'clear'];

/**
 * Arrangement par défaut d'une liste de sections (EF-15.8).
 * @param {{id: string}[]} sections
 */
export function defaultArrangement(sections) {
  return {
    id: 'arr_default',
    name: 'Ordre standard',
    order: sections.map((section) => section.id)
  };
}

/** Section d'un chant par identifiant. */
export function findSection(song, sectionId) {
  return (song?.sections || []).find((section) => section.id === sectionId) || null;
}

/** Arrangement actif, avec repli sur le premier : un chant a toujours un ordre. */
export function activeArrangement(song, arrangementId = null) {
  const list = song?.arrangements || [];
  if (!list.length) return defaultArrangement(song?.sections || []);
  const wanted = arrangementId || song.activeArrangementId;
  return list.find((arrangement) => arrangement.id === wanted) || list[0];
}

/**
 * Découpe le texte d'une section en parties affichables.
 * On coupe **entre les lignes** d'abord (la mise en forme du chant est
 * conservée, EF-15.4) ; une ligne trop longue est découpée par le moteur commun
 * de la Bible (EF-15.16).
 * @param {{lines: string[]}} section
 * @param {object} settings
 * @returns {string[]}
 */
export function splitSection(section, settings = {}) {
  const options = { ...DEFAULT_SPLIT, ...settings };
  const maxWords = Math.max(1, Number(options.maxWordsPerScreen) || 20);
  const parts = [];
  let current = [];

  const flush = () => {
    if (!current.length) return;
    const text = current.join('\n').trim();
    if (text) parts.push(text);
    current = [];
  };

  for (const rawLine of section.lines || []) {
    const line = String(rawLine ?? '').replace(/\s+$/, '');
    if (!line.trim()) {
      // Une ligne vide interne reste dans la partie courante : elle sépare des
      // strophes à l'intérieur d'une même section (EF-15.7).
      if (current.length) current.push('');
      continue;
    }
    const words = line.trim().split(/\s+/).length;
    if (words > maxWords) {
      // Ligne très longue : on la découpe avec le moteur commun.
      flush();
      const pieces = splitText(line, { ...options, maxWordsPerScreen: maxWords });
      for (const piece of pieces.parts || []) parts.push(piece);
      continue;
    }
    const currentWords = current.join(' ').split(/\s+/).filter(Boolean).length;
    if (current.length && currentWords + words > maxWords) flush();
    current.push(line.trim());
  }
  flush();
  return parts.length ? parts : [''];
}

/**
 * Construit la sélection aplatie d'un chant selon son arrangement.
 *
 * Chaque élément porte `step` (l'étape de l'arrangement), `sectionId`,
 * `sectionType`, `partIndex`, `partCount` : de quoi afficher le conducteur et
 * naviguer sans ambiguïté quand une section revient plusieurs fois (EF-15.11).
 *
 * @param {object} song
 * @param {{arrangementId?: string, settings?: object}} [options]
 */
export function buildSongSelection(song, { arrangementId = null, settings = {} } = {}) {
  const arrangement = activeArrangement(song, arrangementId);
  const items = [];

  arrangement.order.forEach((sectionId, step) => {
    const section = findSection(song, sectionId);
    if (!section) return;
    const parts = splitSection(section, settings);
    parts.forEach((text, partIndex) => {
      items.push({
        step,
        sectionId,
        sectionName: section.name,
        sectionType: section.type,
        sectionLabel: SECTION_LABELS[section.type] || section.type,
        partIndex,
        partCount: parts.length,
        text,
        // Le dernier élément d'une section est repéré par `isSectionEnd`.
        isSectionEnd: partIndex === parts.length - 1
      });
    });
  });

  return {
    songId: song?.id || '',
    title: song?.title || '',
    arrangementId: arrangement.id,
    arrangementName: arrangement.name,
    arrangements: (song?.arrangements || []).map(({ id, name }) => ({ id, name })),
    steps: arrangement.order.map((sectionId, step) => {
      const section = findSection(song, sectionId);
      return {
        step,
        sectionId,
        name: section?.name || sectionId,
        type: section?.type || 'verse',
        parts: items.filter((item) => item.step === step).length
      };
    }),
    items,
    index: 0,
    rev: 1
  };
}

export function currentSongItem(selection) {
  if (!selection?.items?.length) return null;
  return selection.items[clamp(selection.index, 0, selection.items.length - 1)];
}

/** Vrai quand on est sur la dernière partie de la dernière étape (EF-15.15). */
export function atEnd(selection) {
  return Boolean(selection?.items?.length) && selection.index >= selection.items.length - 1;
}

/**
 * Navigation : renvoie une **nouvelle** sélection, jamais de mutation en place.
 * @returns {{selection: object, changed: boolean, action: string, ended: boolean, message: string}}
 */
export function navigateSong(selection, action) {
  if (!selection?.items?.length) {
    return { selection, changed: false, action, ended: false, message: '' };
  }
  const last = selection.items.length - 1;
  let index = selection.index;
  let ended = false;

  switch (action) {
    case 'next':
      // EF-15.15 : à la fin, on ne dépasse pas ; on le dit à l'opérateur.
      if (index >= last) ended = true;
      else index += 1;
      break;
    case 'prev':
      index = Math.max(0, index - 1);
      break;
    case 'sectionNext':
      index = jumpSection(selection, 1);
      if (index === selection.index && atEnd(selection)) ended = true;
      break;
    case 'sectionPrev':
      index = jumpSection(selection, -1);
      break;
    case 'first':
      index = 0;
      break;
    case 'last':
      index = last;
      break;
    case 'repeat':
    case 'clear':
      return { selection, changed: false, action, ended: false, message: '' };
    default:
      return { selection, changed: false, action, ended: false, message: '' };
  }

  const changed = index !== selection.index;
  return {
    selection: changed ? { ...selection, index, rev: (selection.rev || 1) + 1 } : selection,
    changed,
    action,
    ended,
    message: ended ? `Fin du chant « ${selection.title} ».` : ''
  };
}

/** Première partie de la section suivante (`+1`) ou précédente (`-1`). */
function jumpSection(selection, delta) {
  const current = selection.items[selection.index];
  if (!current) return selection.index;
  const targetStep = current.step + delta;
  const found = selection.items.findIndex((item) => item.step === targetStep);
  return found >= 0 ? found : selection.index;
}

/** Va directement à la n-ième étape de l'arrangement (touches `1`…`9`). */
export function goToStep(selection, stepNumber) {
  const step = Number(stepNumber) - 1;
  if (!selection?.items?.length || !(step >= 0)) return selection;
  const found = selection.items.findIndex((item) => item.step === step);
  if (found < 0) return selection;
  return { ...selection, index: found, rev: (selection.rev || 1) + 1 };
}

/** Position lisible : « Couplet 2 · partie 1/2 » (§ 10.2.3). */
export function songPositionLabel(selection) {
  const item = currentSongItem(selection);
  if (!item) return '';
  const step = `${item.step + 1}/${selection.steps?.length || 1}`;
  const part = item.partCount > 1 ? ` · partie ${item.partIndex + 1}/${item.partCount}` : '';
  return `${step} ${item.sectionName}${part}`;
}

/**
 * Change d'arrangement en **préservant la position** (EF-15.12).
 *
 * Règle : si l'opérateur est sur un refrain, il reste sur un refrain — le
 * premier du nouvel arrangement. Sinon on cherche la même section, puis la même
 * étape, puis on borne l'indice.
 */
export function switchArrangement(selection, song, arrangementId, { settings = {} } = {}) {
  const next = buildSongSelection(song, { arrangementId, settings });
  if (!next.items.length) return { selection: next, moved: false };
  const current = currentSongItem(selection);
  if (!current) return { selection: next, moved: true };

  const findFirst = (predicate) => next.items.findIndex(predicate);
  let index = current.sectionType === 'chorus'
    ? findFirst((item) => item.sectionType === 'chorus')
    : -1;
  if (index < 0) index = findFirst((item) => item.sectionId === current.sectionId);
  if (index < 0) index = findFirst((item) => item.step === current.step);
  if (index < 0) index = clamp(selection.index, 0, next.items.length - 1);

  return {
    selection: { ...next, index, rev: (selection.rev || 1) + 1 },
    moved: index !== 0
  };
}

// ---------------------------------------------------------------------------
// Édition d'arrangement en direct (EF-15.9, EF-15.13, EF-15.14)
// ---------------------------------------------------------------------------

function withArrangement(song, arrangementId, mutate) {
  const arrangement = activeArrangement(song, arrangementId);
  const order = mutate([...arrangement.order]);
  const exists = (song.arrangements || []).some((item) => item.id === arrangement.id);
  const arrangements = exists
    ? song.arrangements.map((item) => (item.id === arrangement.id ? { ...item, order } : item))
    : [...(song.arrangements || []), { ...arrangement, order }];
  return { ...song, arrangements };
}

/** « + Refrain à la fin » : ajoute la première section de type refrain. */
export function appendChorus(song, arrangementId = null) {
  const chorus = (song.sections || []).find((section) => section.type === 'chorus');
  if (!chorus) return { song, changed: false, reason: 'no-chorus' };
  return {
    song: withArrangement(song, arrangementId, (order) => [...order, chorus.id]),
    changed: true,
    sectionId: chorus.id
  };
}

/** « ↻ Répéter » : duplique l'étape courante juste après elle-même. */
export function repeatCurrentStep(song, selection, arrangementId = null) {
  const current = currentSongItem(selection);
  if (!current) return { song, changed: false };
  return {
    song: withArrangement(song, arrangementId, (order) => {
      const next = [...order];
      next.splice(current.step + 1, 0, current.sectionId);
      return next;
    }),
    changed: true
  };
}

/** « ⤼ Sauter » : retire l'étape courante, sauf si c'est la dernière. */
export function skipCurrentStep(song, selection, arrangementId = null) {
  const current = currentSongItem(selection);
  if (!current) return { song, changed: false, reason: 'empty' };
  const arrangement = activeArrangement(song, arrangementId);
  if (arrangement.order.length <= 1) return { song, changed: false, reason: 'last-step' };
  return {
    song: withArrangement(song, arrangementId, (order) => {
      const next = [...order];
      next.splice(current.step, 1);
      return next;
    }),
    changed: true
  };
}

/** Ajoute un arrangement (copie de l'ordre courant par défaut, EF-15.9). */
export function addArrangement(song, name, order = null) {
  const base = activeArrangement(song);
  const id = `arr_${(song.arrangements?.length || 0) + 1}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    ...song,
    arrangements: [...(song.arrangements || []), {
      id,
      name: String(name || 'Nouvel arrangement').slice(0, 60),
      order: order ? [...order] : [...base.order]
    }]
  };
}

/** Renomme une section sans changer son `id` (EF-15.5). */
export function renameSection(song, sectionId, name) {
  return {
    ...song,
    sections: (song.sections || []).map((section) =>
      section.id === sectionId ? { ...section, name: String(name || section.name).slice(0, 60) } : section)
  };
}

/** Duplique une section (`Couplet 1` → `Couplet 1 (copie)`, EF-15.6). */
export function duplicateSection(song, sectionId) {
  const source = findSection(song, sectionId);
  if (!source) return { song, changed: false };
  const used = new Set((song.sections || []).map((section) => section.id));
  let n = song.sections.length + 1;
  let id = `sec_${n}`;
  while (used.has(id)) { n += 1; id = `sec_${n}`; }
  const copy = { ...source, id, name: `${source.name} (copie)`.slice(0, 60), lines: [...source.lines] };
  const index = song.sections.findIndex((section) => section.id === sectionId);
  const sections = [...song.sections];
  sections.splice(index + 1, 0, copy);
  const arrangements = (song.arrangements || []).map((arrangement) => ({
    ...arrangement,
    order: arrangement.order.flatMap((step) => (step === sectionId ? [step, id] : [step]))
  }));
  return { song: { ...song, sections, arrangements }, changed: true, sectionId: id };
}

// ---------------------------------------------------------------------------
// Accords (EF-15.24 → EF-15.27) — vue scène uniquement
// ---------------------------------------------------------------------------

const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Transpose un accord de `semitones` demi-tons (EF-15.27).
 * Ne modifie jamais la source : c'est un affichage.
 * @param {string} chord
 * @param {number} semitones
 * @param {'sharp'|'flat'} [preference]
 */
export function transposeChord(chord, semitones, preference = 'flat') {
  const m = /^([A-G])([#b]?)(.*)$/.exec(String(chord ?? '').trim());
  if (!m) return chord;
  const [, letter, accidental, suffix] = m;
  const base = NOTE_INDEX[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  const target = ((base + Number(semitones || 0)) % 12 + 12) % 12;
  const scale = preference === 'sharp' ? SHARP_SCALE : FLAT_SCALE;
  const root = scale[target];
  // Un accord avec basse (`/G`) voit sa basse transposée aussi.
  const slash = /^(.*)\/([A-G])([#b]?)$/.exec(suffix);
  if (slash) {
    const bass = transposeChord(`${slash[2]}${slash[3] || ''}`, semitones, preference);
    return `${root}${slash[1]}/${bass}`;
  }
  return `${root}${suffix}`;
}

/** Transpose tous les accords d'une section pour l'affichage. */
export function transposeSectionChords(song, sectionId, semitones, preference = 'flat') {
  const entries = song?.chords?.[sectionId] || [];
  return entries.map(([chord, offset]) => [transposeChord(chord, semitones, preference), offset]);
}

/**
 * Prépare les accords d'une section en lignes positionnées en caractères,
 * pour un rendu au-dessus du texte (EF-15.26). Utilisé par la vue scène.
 */
export function chordLinesForSection(song, sectionId) {
  const section = findSection(song, sectionId);
  const entries = song?.chords?.[sectionId] || [];
  if (!section || !entries.length) return [];
  const lines = [];
  let offset = 0;
  for (const line of section.lines) {
    const onLine = entries
      .filter(([, position]) => position >= offset && position <= offset + line.length)
      .map(([chord, position]) => ({ chord, column: position - offset }));
    lines.push({ text: line, chords: onLine });
    offset += line.length + 1;
  }
  return lines;
}

export function isSectionType(value) {
  return SECTION_TYPES.includes(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
