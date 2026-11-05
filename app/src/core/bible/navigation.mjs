// Sélection et navigation dans la Bible (EF-12.29 → EF-12.33, ch. 09 § 9.4).
//
// Une sélection est une **liste plate** d'éléments `{verse, partIndex}`.
// L'indice courant est un entier dans cette liste : pas de cas limite.

/**
 * Construit une sélection à partir de versets et d'un découpage.
 *
 * @param {object} options
 * @param {number} options.bookNum
 * @param {string} options.bookName
 * @param {number} options.chapter
 * @param {{num:number, text:string, html?:string}[]} options.verses
 * @param {{first:number, last:number}} [options.range]
 * @param {(text:string) => string[]} options.split
 *   fonction de découpage (injectée : `splitText(...).parts`)
 * @returns {object} sélection
 */
export function buildSelection({ bookNum, bookName, chapter, verses, range, split, label }) {
  const items = [];
  const ordered = [...verses].sort((a, b) => a.num - b.num);
  for (const verse of ordered) {
    if (range && (verse.num < range.first || verse.num > range.last)) continue;
    const parts = split(verse.text) || [];
    const safeParts = parts.length ? parts : [verse.text];
    safeParts.forEach((text, partIndex) => {
      items.push({
        bookNum,
        bookName,
        chapter,
        verse: verse.num,
        partIndex,
        partCount: safeParts.length,
        text,
        html: verse.html || null
      });
    });
  }

  return {
    label: label || `${bookName} ${chapter}${items.length ? ':' + ordered[0]?.num : ''}`,
    bookNum,
    bookName,
    chapter,
    range: range || null,
    items,
    index: 0,
    rev: 1
  };
}

export function currentItem(selection) {
  if (!selection?.items?.length) return null;
  return selection.items[clamp(selection.index, 0, selection.items.length - 1)];
}

/** Nombre total de parties affichables. */
export function partCount(selection) {
  return selection?.items?.length || 0;
}

/** Indice du verset dans la sélection plate (-1 si absent). */
export function indexOfVerse(selection, verseNum, partIndex = 0) {
  if (!selection?.items) return -1;
  return selection.items.findIndex((it) => it.verse === verseNum && it.partIndex === partIndex);
}

/**
 * Navigation : renvoie une **nouvelle** sélection (jamais de mutation en place).
 * @param {object} selection
 * @param {string} action voir ACTIONS
 */
export const ACTIONS = {
  next: (s) => step(s, 1),
  prev: (s) => step(s, -1),
  nextVerse: (s) => jumpVerse(s, 1),
  prevVerse: (s) => jumpVerse(s, -1),
  nextChapter: (s) => 'chapter+1',
  prevChapter: (s) => 'chapter-1',
  first: (s) => setIndex(s, 0),
  last: (s) => setIndex(s, (s.items?.length || 1) - 1)
};

export function navigate(selection, action) {
  if (!selection?.items?.length) return { selection, changed: false, chapter: null };
  const handler = ACTIONS[action];
  if (!handler) return { selection, changed: false, chapter: null };
  const result = handler(selection);
  if (typeof result === 'string') {
    const delta = result === 'chapter+1' ? 1 : -1;
    return { selection, changed: false, chapter: { delta, verse: currentItem(selection)?.verse ?? 1 } };
  }
  const changed = result.index !== selection.index;
  return { selection: result, changed, chapter: null };
}

function step(selection, delta) {
  const next = clamp(selection.index + delta, 0, selection.items.length - 1);
  // Aux bornes on ne fait **rien** (EF-12.30 / A-08e), pas de bouclage.
  if (next === selection.index) return selection;
  return { ...selection, index: next, rev: (selection.rev || 1) + 1 };
}

function jumpVerse(selection, delta) {
  const current = selection.items[selection.index];
  if (!current) return selection;
  const verses = [...new Set(selection.items.map((it) => it.verse))];
  const position = verses.indexOf(current.verse);
  const targetVerse = verses[position + delta];
  if (targetVerse === undefined) return selection;
  const targetIndex = selection.items.findIndex((it) => it.verse === targetVerse);
  if (targetIndex < 0) return selection;
  return { ...selection, index: targetIndex, rev: (selection.rev || 1) + 1 };
}

function setIndex(selection, index) {
  const next = clamp(index, 0, selection.items.length - 1);
  if (next === selection.index) return selection;
  return { ...selection, index: next, rev: (selection.rev || 1) + 1 };
}

/** Position d'un élément dans un groupe de versets (pour l'indicateur `2 / 3`). */
export function positionLabel(selection) {
  const item = currentItem(selection);
  if (!item) return '';
  if (item.partCount <= 1) return `v. ${item.verse}`;
  return `partie ${item.partIndex + 1} / ${item.partCount}`;
}

/** Ce que doit afficher la vue scène : la partie courante **et** la suivante. */
export function stagePreview(selection, { ahead = 1 } = {}) {
  const items = selection?.items || [];
  const start = clamp(selection?.index || 0, 0, Math.max(0, items.length - 1));
  return {
    current: items[start] || null,
    next: items[start + ahead] || null,
    index: start,
    total: items.length
  };
}

/**
 * Traduction d'une touche en action (table du § 9.4.2).
 * @returns {string|null} nom d'action, ou null si la touche n'agit pas
 */
export function actionForKey(event) {
  const { key, shiftKey, ctrlKey, metaKey, altKey } = event;
  if (altKey) return null;
  const mod = ctrlKey || metaKey;

  if (mod) {
    if (key === 'ArrowRight') return 'nextChapter';
    if (key === 'ArrowLeft') return 'prevChapter';
    return null;
  }
  if (shiftKey) {
    if (key === 'ArrowRight') return 'nextVerse';
    if (key === 'ArrowLeft') return 'prevVerse';
    return null;
  }
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case ' ':
    case 'Spacebar':
    case 'PageDown':
      return 'next';
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      return 'prev';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'Enter':
      return 'repeat';
    case 'Escape':
      return 'clear';
    default:
      break;
  }
  if (/^[1-9]$/.test(key)) return `verse:${Number(key)}`;
  return null;
}

/** Les touches de navigation sont inactives dans un champ (EF-12.30). */
export function isTypingTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest?.('[contenteditable="true"], .modal, .editor'));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
