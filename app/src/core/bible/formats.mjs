// Détection et analyse des formats bibliques (EF-11.3 → EF-11.8).
//
// Aucune dépendance : le XML est lu par un automate de balises tolérant, pas par un
// analyseur DOM. Un fichier de 4 Mo reste analysable en quelques dizaines de millisecondes
// et une balise mal fermée ne fait jamais échouer tout l'import.
//
// Formats reconnus :
//   - Beblia  : <XMLBIBLE><BIBLEBOOK bnumber><CHAPTER cnumber><VERS vnumber>
//   - Zefania : <XMLBIBLE><BIBLEBOOK number><CHAPTER number><VERS number>
//   - OSIS    : <osis><osisText><div type="book"><chapter><verse>
//   - USFX    : <usfx><book id><c id/><v id/>texte…

import { BOOKS } from '../books.mjs';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Décode les entités XML (nommées courantes + numériques). */
export function decodeEntities(text) {
  return String(text).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return whole;
      try { return String.fromCodePoint(code); } catch { return whole; }
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, body.toLowerCase())
      ? ENTITIES[body.toLowerCase()] : whole;
  });
}

/** Texte affichable : entités décodées, espaces normalisés, notes retirées. */
function cleanText(raw) {
  return decodeEntities(String(raw).replace(/<[^>]*>/g, ' '))
    .replace(/[\u00a0\u2009\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Balises dont le contenu n'est pas du texte biblique. */
const SKIP = new Set(['NOTE', 'FIGURE', 'HEADER', 'FOOTNOTE', 'CATCHWORD', 'MILESTONE']);

/** Codes OSIS / USFX → numéro de livre canonique (66 livres protestants). */
const CODES = {
  GEN: 1, EXO: 2, LEV: 3, NUM: 4, DEU: 5, JOS: 6, JDG: 7, RUT: 8, RTH: 8,
  '1SA': 9, '2SA': 10, '1KI': 11, '2KI': 12, '1CH': 13, '2CH': 14,
  EZR: 15, NEH: 16, EST: 17, JOB: 18, PSA: 19, PS: 19, PRO: 20, ECC: 21, SNG: 22, SOS: 22,
  ISA: 23, JER: 24, LAM: 25, EZK: 26, EZE: 26, DAN: 27, HOS: 28, JOL: 29, JOE: 29,
  AMO: 30, OBA: 31, JON: 32, MIC: 33, NAM: 34, NAH: 34, HAB: 35, ZEP: 36,
  HAG: 37, ZEC: 38, MAL: 39,
  MAT: 40, MRK: 41, MAR: 41, LUK: 42, JHN: 43, JOH: 43, ACT: 44, ROM: 45,
  '1CO': 46, '2CO': 47, GAL: 48, EPH: 49, PHP: 50, PHI: 50, COL: 51, '1TH': 52, '2TH': 53,
  '1TI': 54, '2TI': 55, TIT: 56, PHM: 57, HEB: 58, JAS: 59, JAM: 59,
  '1PE': 60, '2PE': 61, '1JN': 62, '2JN': 63, '3JN': 64, JUD: 65, REV: 66
};

const OSIS_NAMES = {
  Gen: 1, Exod: 2, Lev: 3, Num: 4, Deut: 5, Josh: 6, Judg: 7, Ruth: 8,
  '1Sam': 9, '2Sam': 10, '1Kgs': 11, '2Kgs': 12, '1Chr': 13, '2Chr': 14,
  Ezra: 15, Neh: 16, Esth: 17, Job: 18, Ps: 19, Prov: 20, Eccl: 21, Song: 22,
  Isa: 23, Jer: 24, Lam: 25, Ezek: 26, Dan: 27, Hos: 28, Joel: 29, Amos: 30,
  Obad: 31, Jonah: 32, Mic: 33, Nah: 34, Hab: 35, Zeph: 36, Hag: 37, Zech: 38, Mal: 39,
  Matt: 40, Mark: 41, Luke: 42, John: 43, Acts: 44, Rom: 45,
  '1Cor': 46, '2Cor': 47, Gal: 48, Eph: 49, Phil: 50, Col: 51, '1Thess': 52, '2Thess': 53,
  '1Tim': 54, '2Tim': 55, Titus: 56, Phlm: 57, Heb: 58, Jas: 59,
  '1Pet': 60, '2Pet': 61, '1John': 62, '2John': 63, '3John': 64, Jude: 65, Rev: 66
};

/** Découpe un XML en jetons texte / balise, sans DOM. */
export function tokenize(xml) {
  const tokens = [];
  const re = /<[^>]*>/g;
  let cursor = 0;
  let match;
  while ((match = re.exec(xml))) {
    if (match.index > cursor) tokens.push({ t: 'text', v: xml.slice(cursor, match.index) });
    const raw = match[0];
    cursor = match.index + raw.length;
    if (/^<[?!]/.test(raw)) continue; // prologue, DOCTYPE, commentaire
    const name = (raw.match(/^<\/?\s*([A-Za-z0-9:_.-]+)/) || [])[1];
    if (!name) continue;
    const attrs = {};
    const attrRe = /([A-Za-z0-9:_.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let attr;
    while ((attr = attrRe.exec(raw))) {
      attrs[attr[1].toLowerCase()] = decodeEntities(attr[3] ?? attr[4] ?? '');
    }
    tokens.push({
      t: raw[1] === '/' ? 'close' : 'open',
      name: name.toUpperCase(),
      attrs,
      self: /\/>$/.test(raw)
    });
  }
  if (cursor < xml.length) tokens.push({ t: 'text', v: xml.slice(cursor) });
  return tokens;
}

/** Détecte le format d'un fichier ; `null` si ce n'est pas une Bible reconnue (EF-11.5). */
export function detectFormat(xml) {
  const head = String(xml).slice(0, 8192);
  if (/<usfx[\s/>]/i.test(head)) return 'usfx';
  if (/<osis[\s/>]/i.test(head) || /<osisText[\s/>]/i.test(head)) return 'osis';
  if (/<XMLBIBLE[\s/>]/i.test(head)) {
    // Zefania ajoute un bloc <INFORMATION><BIBLEVERSIONS> ; Beblia n'en a pas.
    if (/<BIBLEVERSIONS[\s/>]/i.test(head)) return 'zefania';
    if (/<BIBLEBOOK[\s/>]/i.test(head)) return 'beblia';
    if (/<BOOK[\s/>]/i.test(head)) return 'zefania';
    // Le premier livre peut arriver après l'en-tête <INFORMATION>.
    const rest = String(xml).slice(0, 200000);
    if (/<BIBLEVERSIONS[\s/>]/i.test(rest)) return 'zefania';
    if (/<BIBLEBOOK[\s/>]/i.test(rest)) return 'beblia';
    if (/<BOOK[\s/>]/i.test(rest)) return 'zefania';
    return null;
  }
  return null;
}

export const FORMAT_LABELS = {
  beblia: 'Beblia XML',
  zefania: 'Zefania XML',
  osis: 'OSIS',
  usfx: 'USFX'
};

function firstNumber(attrs, names) {
  for (const key of names) {
    const value = attrs[key];
    if (value === undefined) continue;
    const direct = Number(value);
    if (Number.isInteger(direct) && direct > 0) return direct;
    const tail = String(value).split(/[.\s:]/).filter(Boolean).pop();
    const parsed = Number(tail);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function bookNumber(attrs, order) {
  const explicit = firstNumber(attrs, ['bnumber', 'number', 'n', 'id']);
  if (explicit && explicit >= 1 && explicit <= 66) return explicit;
  const code = String(attrs.osisid || attrs.id || '').toUpperCase().split('.')[0];
  if (CODES[code]) return CODES[code];
  const osis = String(attrs.osisid || '').split('.')[0];
  if (OSIS_NAMES[osis]) return OSIS_NAMES[osis];
  const name = fold(attrs.bname || attrs.name || '');
  const known = BOOKS.find((b) => fold(b.name) === name || b.alt.includes(name));
  if (known) return known.num;
  return order; // ordre d'apparition : seul repère restant
}

function fold(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function bookName(attrs, num) {
  const canon = BOOKS.find((b) => b.num === num);
  // Le nom déclaré par la version importée (« Genesis », « Genèse ») est prioritaire :
  // la table d'abréviations reste française, les noms viennent du fichier (EF-12.11).
  const declared = (attrs.bname || attrs.name || '').trim();
  if (declared && /[A-Za-zÀ-ÿ]{3,}/.test(declared)) return declared.replace(/[_-]+/g, ' ').slice(0, 60);
  // À défaut (OSIS/USFX ne donnent qu'un code), on affiche le nom canonique français.
  return canon?.name || `Livre ${num}`;
}

function rootAttr(tokens, names) {
  for (const token of tokens) {
    if (token.t !== 'open') continue;
    if (!names.includes(token.name)) continue;
    for (const key of ['biblename', 'name', 'title', 'version', 'osisidwork', 'description']) {
      if (token.attrs[key]) return token.attrs[key];
    }
  }
  return '';
}

function infoText(tokens, tag) {
  let inside = false;
  let buffer = '';
  for (const token of tokens) {
    if (token.t === 'open' && token.name === tag) { inside = true; continue; }
    if (token.t === 'close' && token.name === tag) {
      if (buffer.trim()) return cleanText(buffer);
      inside = false;
      continue;
    }
    if (inside && token.t === 'text') buffer += token.v;
  }
  return '';
}

/**
 * Analyse un XML biblique déjà détecté.
 * @returns {{format:string, label:string, name:string, language:string, direction:string,
 *            books:Array, counts:{books:number,chapters:number,verses:number}, preview:object|null}}
 */
export function parseBibleXml(xml) {
  const format = detectFormat(xml);
  if (!format) {
    throw Object.assign(new Error('Ce fichier n’est pas une Bible reconnue.'), {
      code: 'UNSUPPORTED_FORMAT',
      message:
        "TXT: Ce fichier n'est pas une Bible reconnue.\n" +
        '     Formats acceptés : Beblia XML, Zefania XML, OSIS, USFX.\n' +
        '     Source de fichiers libres : https://github.com/Beblia/Holy-Bible-XML-Format'
    });
  }

  const tokens = tokenize(String(xml));
  const books = [];
  let book = null;
  let chapter = null;
  let verse = null;
  let buffer = '';
  let skipDepth = 0;
  let order = 0;
  const divStack = [];

  const flushVerse = () => {
    if (!verse || !chapter) { buffer = ''; return; }
    const text = cleanText(buffer) || '…';
    // L'index du tableau vaut `numéro - 1` : un trou de numérotation est comblé pour
    // que « Jean 3:16 » reste le verset 16 même si la source commence ailleurs.
    while (chapter.verses.length < verse.num - 1 && chapter.verses.length < 200) {
      chapter.verses.push('…');
    }
    chapter.verses.push(text);
    if (text !== '…') chapter.count += 1;
    buffer = '';
    verse = null;
  };

  const startBook = (attrs) => {
    flushVerse();
    chapter = null;
    order += 1;
    const num = bookNumber(attrs, order);
    book = { num, name: bookName(attrs, num), chapters: [] };
    books.push(book);
    return book;
  };

  const startChapter = (attrs, fallback) => {
    flushVerse();
    if (!book) startBook(attrs);
    const num = firstNumber(attrs, ['cnumber', 'number', 'osisid', 'id', 'n']) || fallback || book.chapters.length + 1;
    chapter = { num, verses: [], count: 0 };
    book.chapters.push(chapter);
    return chapter;
  };

  const startVerse = (attrs, fallback) => {
    flushVerse();
    if (!chapter) startChapter({}, 1);
    const num = firstNumber(attrs, ['vnumber', 'number', 'osisid', 'id', 'n']) || fallback || chapter.verses.length + 1;
    verse = { num };
    buffer = '';
    return verse;
  };

  for (const token of tokens) {
    if (token.t === 'text') {
      if (verse && skipDepth === 0) buffer += ` ${token.v}`;
      continue;
    }

    const { name, attrs } = token;

    if (token.t === 'open' && SKIP.has(name)) { skipDepth += 1; continue; }
    if (token.t === 'close' && SKIP.has(name)) { skipDepth = Math.max(0, skipDepth - 1); continue; }

    if (name === 'BIBLEBOOK' || name === 'BOOK') {
      if (token.t === 'open') startBook(attrs);
      else { flushVerse(); chapter = null; book = null; }
      continue;
    }
    if (name === 'DIV') {
      const type = String(attrs.type || '').toLowerCase();
      if (token.t === 'open') {
        divStack.push(type);
        if (type === 'book') startBook(attrs);
        else if (type === 'chapter') startChapter(attrs);
      } else {
        const closed = divStack.pop();
        if (closed === 'book') { flushVerse(); chapter = null; book = null; }
      }
      continue;
    }
    if (name === 'CHAPTER' || name === 'C') {
      if (token.t === 'open') startChapter(attrs);
      else flushVerse();
      continue;
    }
    if (name === 'VERS' || name === 'VERSE' || name === 'V') {
      if (token.t === 'open') startVerse(attrs);
      else flushVerse();
      continue;
    }
  }
  flushVerse();

  const parsedBooks = books
    .filter((entry) => entry.chapters.length)
    .map((entry) => ({
      num: entry.num,
      name: entry.name,
      abbr: BOOKS.find((b) => b.num === entry.num)?.abbr || '',
      chapters: entry.chapters.map((c) => ({ num: c.num, verses: c.verses }))
    }))
    .sort((a, b) => a.num - b.num);

  const counts = {
    books: parsedBooks.length,
    chapters: books.reduce((total, entry) => total + entry.chapters.length, 0),
    verses: books.reduce((total, entry) => total + entry.chapters
      .reduce((sum, c) => sum + (c.count || 0), 0), 0)
  };

  if (!counts.verses) {
    throw Object.assign(new Error('Aucun verset n’a pu être lu dans ce fichier.'), {
      code: 'VALIDATION',
      message: 'TXT: Ce fichier ne contient aucun verset lisible.\n'
        + '     Vérifiez qu’il s’agit bien d’une Bible complète, pas d’un index.'
    });
  }

  const detected = infoText(tokens, 'LANGUAGE')
    || rootAttr(tokens, ['XMLBIBLE', 'OSIS', 'OSISTEXT']).match(/\b[a-z]{2}(-[A-Z]{2})?\b/)?.[0]
    || '';
  const language = /^[a-z]{2}(-[a-z]{2})?$/i.test(detected.trim()) ? detected.trim().toLowerCase().slice(0, 12) : 'und';
  const direction = /rtl/i.test(String(rootAttr(tokens, ['OSISTEXT']) || '') + String(xml.slice(0, 2000)))
    || /^(he|ar|fa|ur)/i.test(language) ? 'rtl' : 'ltr';

  const name = (infoText(tokens, 'TITLE') || rootAttr(tokens, ['XMLBIBLE', 'OSISTEXT'])
    || '').slice(0, 120).trim();

  const preview = buildPreview(parsedBooks);

  return {
    format,
    label: FORMAT_LABELS[format],
    name,
    language,
    direction,
    books: parsedBooks,
    counts,
    preview
  };
}

/** Aperçu de contrôle avant validation : premier verset lisible du fichier. */
export function buildPreview(books) {
  for (const book of books) {
    for (const chapter of book.chapters) {
      for (let index = 0; index < chapter.verses.length; index += 1) {
        const text = chapter.verses[index];
        if (text && text !== '…') {
          return {
            reference: `${book.name} ${chapter.num}:${index + 1}`,
            text: text.length > 220 ? `${text.slice(0, 217)}…` : text
          };
        }
      }
    }
  }
  return null;
}
