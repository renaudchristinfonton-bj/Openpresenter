// Saisie clavier unifiée (EF-12, ch. 09 § 9.3) : machine à états
// LIVRE → CHAPITRE → VERSET, plus l'analyse d'une référence collée d'un bloc.
//
// Ce module est **pur** : il ne lit pas le disque et ne connaît pas le DOM.
// L'interface se contente de lui passer les frappes et d'afficher son état.

import { BOOKS, BOOK_COUNT, fold, buildIndex } from '../books.mjs';

export const STATE = { BOOK: 0, CHAPTER: 1, VERSE: 2 };

export const MESSAGES = {
  unknownBook: (q) => `Aucun livre ne correspond à « ${q} ».`,
  chapterMissing: () => 'Saisissez un numéro de chapitre, puis Espace et le verset.',
  chapterTooHigh: (book, max) => `${book} compte ${max} chapitres.`,
  chapterOutOfRange: (book, n, max) => `${book} ne contient pas de chapitre ${n} (1 à ${max}).`,
  verseOutOfRange: (book, chapter, n, max) => `${book} ${chapter} ne contient pas de verset ${n} (1 à ${max}).`,
  rangeTooLarge: (max) => `Plage trop large (${max} versets maximum).`,
  rangeTruncated: (from, to, max) => `Versets ${from} à ${to} affichés (le chapitre s'arrête à ${max}).`,
  verseMissing: (book, chapter) => `Saisissez un numéro de verset pour ${book} ${chapter}.`
};

export const MAX_RANGE = 200;
const MAX_SUGGESTIONS = 8;

/**
 * Crée une machine à états de saisie.
 * @param {object} deps
 * @param {(bookNum:number, chapter:number) => number|null} deps.verseCount
 *        nombre de versets d'un chapitre, `null` si inconnu
 * @param {object} [deps.overrides] surcharge d'abréviations (project/library/book-abbr.json)
 */
export function createEntry({ verseCount = () => null, overrides = {}, books = BOOKS } = {}) {
  const index = buildIndex(overrides);
  const byNum = new Map(books.map((b) => [b.num, b]));
  const extraBooks = Array.isArray(overrides.books) ? overrides.books : [];
  for (const book of extraBooks) byNum.set(book.num, { ...book, chapters: book.chapters || 0 });

  let state = {
    mode: STATE.BOOK,
    query: '',
    bookNum: null,
    chapterText: '',
    verseText: '',
    suggestions: [],
    highlight: 0,
    message: null,
    messageKind: null,
    history: []
  };

  const emit = (changes = {}) => {
    state = { ...state, ...changes };
    return state;
  };

  const book = () => (state.bookNum ? byNum.get(state.bookNum) : null);

  // -------------------------------------------------------------------------
  // Suggestions de livres (EF-12.5 → EF-12.10)
  // -------------------------------------------------------------------------
  function suggest(rawQuery) {
    const q = fold(rawQuery);
    if (!q) return books.slice(0, MAX_SUGGESTIONS);
    const scored = [];
    const titleWords = (b) => fold(b.name).split(' ');

    books.forEach((b, position) => {
      const names = index.aliases.get(b.num) || [fold(b.name)];
      let best = null;
      const consider = (score, kind) => {
        if (best === null || score < best.score) best = { score, kind };
      };

      const name = fold(b.name);
      if (name === q) consider(0, 'exact');
      else if (name.startsWith(q)) consider(1, 'prefix');
      else if (titleWords(b).some((w) => w.startsWith(q))) consider(2, 'word');
      else if (names.some((n) => n === q)) consider(3, 'abbr');
      else if (names.some((n) => n.startsWith(q))) consider(4, 'abbrPrefix');
      else if (name.includes(q)) consider(5, 'contains');

      if (best) scored.push({ book: b, ...best, position });
    });

    // À pertinence égale, le nom le plus court passe devant : « je » doit mener à
    // Jean, pas à Jérémie (A-06), puis l'ordre canonique (EF-12.7).
    scored.sort((a, b) => a.score - b.score
      || a.book.name.length - b.book.name.length
      || a.position - b.position);
    return scored.slice(0, MAX_SUGGESTIONS).map((s) => ({
      num: s.book.num,
      name: s.book.name,
      abbr: s.book.abbr,
      chapters: s.book.chapters,
      match: s.kind
    }));
  }

  // -------------------------------------------------------------------------
  // Sélection d'un livre
  // -------------------------------------------------------------------------
  function selectBook(numOrName) {
    let target = typeof numOrName === 'number' ? byNum.get(numOrName) : null;
    if (!target && typeof numOrName === 'string') {
      const q = fold(numOrName);
      const found = suggest(q)[0];
      if (found) target = byNum.get(found.num);
    }
    if (!target) {
      return emit({
        message: MESSAGES.unknownBook(state.query),
        messageKind: 'error',
        highlighting: false
      });
    }
    return emit({
      mode: STATE.CHAPTER,
      bookNum: target.num,
      query: '',
      chapterText: '',
      verseText: '',
      suggestions: [],
      highlight: 0,
      message: null,
      messageKind: null
    });
  }

  // -------------------------------------------------------------------------
  // Frappes
  // -------------------------------------------------------------------------

  /** Saisie de texte libre (état 0 uniquement). */
  function typeText(text) {
    if (state.mode !== STATE.BOOK) return state;
    const next = (state.query + text).slice(0, 60);
    return emit({
      query: next,
      suggestions: suggest(next),
      highlight: 0,
      message: null,
      messageKind: null
    });
  }

  /** Saisie de chiffres : chapitre (état 1) ou verset (état 2). */
  function typeDigits(digits) {
    if (state.mode === STATE.CHAPTER) {
      const next = (state.chapterText + digits).replace(/\D/g, '').slice(0, 3);
      const bookInfo = book();
      let message = null;
      let kind = null;
      if (bookInfo && Number(next) > bookInfo.chapters) {
        message = MESSAGES.chapterTooHigh(bookInfo.name, bookInfo.chapters);
        kind = 'warning';
      }
      return emit({ chapterText: next, message, messageKind: kind });
    }
    if (state.mode === STATE.VERSE) {
      // On ne nettoie que les chiffres entrants : le tiret de plage saisi avant
      // doit survivre (« 16-18 »).
      const next = (state.verseText + String(digits).replace(/\D/g, '')).slice(0, 8);
      return emit({ verseText: next, message: null, messageKind: null });
    }
    // État 0 : un chiffre commence une référence (ex. « 1 Corinthiens »).
    return typeText(digits);
  }

  /** Séparateur de plage : « - », « – », « , » (état 2 uniquement). */
  function typeSeparator(char = '-') {
    if (state.mode !== STATE.VERSE) return state;
    if (state.verseText.includes('-')) return state;
    return emit({ verseText: `${state.verseText}${char === ',' ? ',' : '-'}` });
  }

  /** Déplacement de la surbrillance (↑ / ↓), circulaire. */
  function move(delta) {
    if (state.mode !== STATE.BOOK) {
      // En état 1/2, ↑↓ parcourt les chapitres / versets.
      if (state.mode === STATE.CHAPTER) {
        const current = Number(state.chapterText) || 0;
        const max = book()?.chapters || 0;
        const next = clamp(current + delta, 1, max);
        return emit({ chapterText: String(next) });
      }
      if (state.mode === STATE.VERSE) {
        const chapter = Number(state.chapterText) || 1;
        const max = verseCount(state.bookNum, chapter) || 200;
        const current = Number(state.verseText) || 1;
        const next = clamp(current + delta, 1, max);
        return emit({ verseText: String(next) });
      }
    }
    const count = state.suggestions.length;
    if (!count) return state;
    const next = (state.highlight + delta + count) % count;
    return emit({ highlight: next });
  }

  /** Touche Entrée — le comportement dépend de l'état. */
  function enter({ preview = false } = {}) {
    if (state.mode === STATE.BOOK) {
      if (!state.suggestions.length) {
        if (state.query === '') return state;
        return emit({ message: MESSAGES.unknownBook(state.query), messageKind: 'error' });
      }
      const chosen = state.suggestions[state.highlight] || state.suggestions[0];
      return selectBook(chosen.num);
    }

    if (state.mode === STATE.CHAPTER) {
      const bookInfo = book();
      if (!state.chapterText) {
        return emit({ message: MESSAGES.chapterMissing(), messageKind: 'error' });
      }
      const chapter = Number(state.chapterText);
      if (chapter < 1 || chapter > bookInfo.chapters) {
        return emit({
          message: MESSAGES.chapterOutOfRange(bookInfo.name, chapter, bookInfo.chapters),
          messageKind: 'error'
        });
      }
      // Entrée sans verset : on diffuse le chapitre entier.
      return {
        ...emit({ verseText: '' }),
        action: { kind: 'chapter', bookNum: bookInfo.num, chapter, preview }
      };
    }

    // État 2 — verset ou plage.
    const bookInfo = book();
    const chapter = Number(state.chapterText);
    const range = parseVerseRange(state.verseText);
    if (!range) {
      return emit({ message: MESSAGES.verseMissing(bookInfo.name, chapter), messageKind: 'error' });
    }
    if (range.last - range.first + 1 > MAX_RANGE) {
      return emit({ message: MESSAGES.rangeTooLarge(MAX_RANGE), messageKind: 'error' });
    }
    const max = verseCount(bookInfo.num, chapter);
    if (max === null) {
      // Version sans données pour ce chapitre : on accepte la référence telle quelle.
      return {
        ...emit({ verseText: '' }),
        action: { kind: 'range', bookNum: bookInfo.num, chapter, first: range.first, last: range.last, preview }
      };
    }
    const messages = [];
    if (range.first > max) {
      return emit({
        message: MESSAGES.verseOutOfRange(bookInfo.name, chapter, range.first, max),
        messageKind: 'error'
      });
    }
    const last = Math.min(range.last, max);
    if (last < range.last) {
      messages.push({ text: MESSAGES.rangeTruncated(range.first, last, max), kind: 'warning' });
    }
    return {
      ...emit({ verseText: '' }),
      message: messages[0]?.text || null,
      messageKind: messages[0]?.kind || null,
      action: { kind: 'range', bookNum: bookInfo.num, chapter, first: range.first, last, preview }
    };
  }

  /** Espace / « : » / « . » — passage à l'état 2 (chemin principal du besoin). */
  function toVerseState() {
    if (state.mode === STATE.CHAPTER && state.chapterText) {
      return emit({ mode: STATE.VERSE, verseText: '' });
    }
    if (state.mode === STATE.BOOK) return typeText(' ');
    return state;
  }

  /** Retour arrière. */
  function backspace() {
    if (state.mode === STATE.BOOK) {
      const next = state.query.slice(0, -1);
      return emit({ query: next, suggestions: suggest(next), highlight: 0, message: null, messageKind: null });
    }
    if (state.mode === STATE.CHAPTER) {
      if (!state.chapterText) return emit({ mode: STATE.BOOK, bookNum: null, suggestions: suggest('') });
      return emit({ chapterText: state.chapterText.slice(0, -1), message: null, messageKind: null });
    }
    if (!state.verseText) return emit({ mode: STATE.CHAPTER });
    return emit({ verseText: state.verseText.slice(0, -1) });
  }

  /** Échap : recule d'un état, sans jamais perdre le livre tant qu'on reste dedans. */
  function escape() {
    if (state.mode === STATE.VERSE) return emit({ mode: STATE.CHAPTER, verseText: '' });
    if (state.mode === STATE.CHAPTER) {
      return emit({ mode: STATE.BOOK, bookNum: null, chapterText: '', suggestions: suggest('') });
    }
    return emit({ query: '', suggestions: suggest(''), message: null, messageKind: null });
  }

  /** Saisie d'une référence complète (collage) — EF-12.22. */
  function paste(text) {
    const parsed = parseReference(text, { verseCount, books, index });
    if (!parsed) {
      return emit({ message: MESSAGES.unknownBook(String(text).trim()), messageKind: 'error' });
    }
    const bookInfo = byNum.get(parsed.bookNum);
    const max = verseCount(parsed.bookNum, parsed.chapter);
    let last = parsed.last ?? null;
    let message = null;
    let kind = null;
    if (max !== null && last !== null && last > max) {
      last = max;
      message = MESSAGES.rangeTruncated(parsed.first ?? 1, last, max);
      kind = 'warning';
    }
    const next = emit({
      mode: STATE.CHAPTER,
      bookNum: bookInfo.num,
      chapterText: String(parsed.chapter),
      verseText: last === null ? '' : (parsed.first === last ? String(last) : `${parsed.first}-${last}`),
      message,
      messageKind: kind
    });
    if (parsed.first === undefined) {
      return { ...next, action: { kind: 'chapter', bookNum: bookInfo.num, chapter: parsed.chapter } };
    }
    // L'état interne doit réellement passer en état 2 (et pas seulement la copie
    // renvoyée) : l'utilisateur doit pouvoir corriger le verset après un collage.
    emit({ mode: STATE.VERSE });
    return {
      ...next,
      mode: STATE.VERSE,
      action: {
        kind: 'range', bookNum: bookInfo.num, chapter: parsed.chapter,
        first: parsed.first, last: last ?? parsed.first
      }
    };
  }

  /** Remise à un état de repos après diffusion (EF-12.20 : le livre est conservé). */
  function afterBroadcast() {
    if (state.mode === STATE.VERSE || state.mode === STATE.CHAPTER) {
      return emit({ mode: STATE.CHAPTER, verseText: '', message: null, messageKind: null });
    }
    return state;
  }

  /** Libellé affiché dans le champ (`Jean ▸ 3 16`). */
  function label() {
    const bookInfo = book();
    if (!bookInfo) return state.query;
    if (state.mode === STATE.CHAPTER) return `${bookInfo.name} ▸ ${state.chapterText}`;
    return `${bookInfo.name} ▸ ${state.chapterText} ${state.verseText}`;
  }

  return {
    get state() { return state; },
    get label() { return label(); },
    suggest,
    selectBook,
    typeText,
    typeDigits,
    typeSeparator,
    move,
    enter,
    toVerseState,
    backspace,
    escape,
    paste,
    afterBroadcast,
    history: () => state.history
  };
}

// ---------------------------------------------------------------------------
// Analyse d'une référence collée
// ---------------------------------------------------------------------------

/**
 * Grammaire acceptée : `Livre C:V`, `Livre C V`, `Livre C:V-V2`, `Livre C`,
 * `1 Corinthiens 13:4-7`, `Jean 3.16`, `Jn 3 16`.
 */
export function parseReference(input, { books = BOOKS, index = buildIndex() } = {}) {
  const text = String(input ?? '').trim();
  if (!text) return null;

  const re = /^(?<book>\d?\s*[^\d]+?)\s*(?<chapter>\d{1,3})(?:\s*[:.,\s]\s*(?<first>\d{1,3})(?:\s*[-–—,]\s*(?<last>\d{1,3}))?)?$/u;
  const m = re.exec(text);
  if (!m) return null;

  const bookLabel = m.groups.book.trim().replace(/[.,;:]+$/, '');
  const book = findBook(bookLabel, books, index);
  if (!book) return null;

  const chapter = Number(m.groups.chapter);
  const first = m.groups.first !== undefined ? Number(m.groups.first) : undefined;
  let last = m.groups.last !== undefined ? Number(m.groups.last) : (first ?? undefined);
  if (first !== undefined && last !== undefined && last < first) [last] = [first, last].reverse();

  return {
    bookNum: book.num,
    bookName: book.name,
    chapter,
    first,
    last
  };
}

function findBook(label, books, index) {
  const q = fold(label);
  // Un libellé sans aucune lettre n'est pas un livre (« 3:16 » n'est pas « 3 Jean »).
  if (!q || !/[a-z]/.test(q)) return null;
  const exactName = books.find((b) => fold(b.name) === q || fold(b.abbr) === q);
  if (exactName) return exactName;
  const aliasHit = books.find((b) => (index.aliases.get(b.num) || []).includes(q));
  if (aliasHit) return aliasHit;
  const prefix = books.filter((b) => fold(b.name).startsWith(q) || (index.aliases.get(b.num) || []).some((a) => a.startsWith(q)));
  return prefix.length === 1 ? prefix[0] : null;
}

// ---------------------------------------------------------------------------
// Plages de versets (état 2)
// ---------------------------------------------------------------------------

/**
 * Analyse la saisie de l'état 2 :
 * `16` · `16-18` · `16 - 18` · `16–18` · `16 18` · `16,18` · `16,`
 */
export function parseVerseRange(input) {
  // Une virgule ou un point final est toléré (saisie rapide au pavé numérique).
  const text = String(input ?? '').trim().replace(/[,;.]+$/, (m) => (m.length && /^\d+$/.test(String(input).trim().slice(0, -m.length)) ? '' : m));
  if (!text) return null;
  const re = /^(?<first>\d{1,3})(?:\s*(?:[-–—,]|\s)\s*(?<last>\d{1,3}))?$/u;
  const m = re.exec(text);
  if (!m) return null;
  let first = Number(m.groups.first);
  let last = m.groups.last !== undefined ? Number(m.groups.last) : first;
  if (last < first) [first, last] = [last, first]; // EF-12.17 : inversion silencieuse
  if (first < 1) return null;
  return { first, last };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export { BOOK_COUNT };
