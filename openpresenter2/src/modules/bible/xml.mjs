// Bible XML import normalizer: KJV/OpenSong-style and Zefania XML structures.
const FRENCH_BOOKS = [
  'Genèse', 'Exode', 'Lévitique', 'Nombres', 'Deutéronome', 'Josué', 'Juges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Rois', '2 Rois', '1 Chroniques', '2 Chroniques', 'Esdras', 'Néhémie',
  'Esther', 'Job', 'Psaumes', 'Proverbes', 'Ecclésiaste', 'Cantique des cantiques', 'Ésaïe', 'Jérémie',
  'Lamentations', 'Ézéchiel', 'Daniel', 'Osée', 'Joël', 'Amos', 'Abdias', 'Jonas', 'Michée', 'Nahum',
  'Habacuc', 'Sophonie', 'Aggée', 'Zacharie', 'Malachie', 'Matthieu', 'Marc', 'Luc', 'Jean', 'Actes',
  'Romains', '1 Corinthiens', '2 Corinthiens', 'Galates', 'Éphésiens', 'Philippiens', 'Colossiens',
  '1 Thessaloniciens', '2 Thessaloniciens', '1 Timothée', '2 Timothée', 'Tite', 'Philémon', 'Hébreux',
  'Jacques', '1 Pierre', '2 Pierre', '1 Jean', '2 Jean', '3 Jean', 'Jude', 'Apocalypse',
];
const BOOK_TAGS = new Set(['book', 'biblebook']);
const CHAPTER_TAGS = new Set(['chapter', 'chap']);
const VERSE_TAGS = new Set(['verse', 'vers', 'verset', 'v']);

function localName(element) {
  return String(element.localName || element.nodeName || '').split(':').pop().toLowerCase();
}
function attribute(element, names) {
  const attrs = element?.attributes;
  if (!attrs) return '';
  const lookup = new Map(Array.from(attrs).map((attr) => [attr.name.toLowerCase(), attr.value]));
  for (const name of names) {
    const value = lookup.get(name.toLowerCase());
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}
function descendants(element) {
  return Array.from(element.getElementsByTagName('*'));
}
function parsePositiveInt(value, fallback) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : fallback;
}
function nameFromNode(node, names) {
  return attribute(node, names);
}

export function parseBibleXML(xmlText, fallbackName = 'Bible importée') {
  if (typeof DOMParser === 'undefined') throw new Error('L’import XML doit être lancé dans un navigateur compatible.');
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(xmlText || '').replace(/^\uFEFF/, ''), 'application/xml');
  if (Array.from(doc.getElementsByTagName('*')).some((element) => localName(element) === 'parsererror')) {
    throw new Error('XML invalide ou mal formé.');
  }

  const root = doc.documentElement;
  const rootName = nameFromNode(root, ['translation', 'biblename', 'name', 'title', 'description']);
  const metadata = descendants(root).find((element) => ['information', 'info', 'identification'].includes(localName(element)));
  const translation = rootName || (metadata && (nameFromNode(metadata, ['name', 'title', 'description']) || metadata.textContent.trim())) || fallbackName;
  const all = descendants(root);
  const bookNodes = all.filter((element) => BOOK_TAGS.has(localName(element)));
  if (!bookNodes.length) throw new Error('Aucun élément Livre reconnu. Formats acceptés : standard <book> et Zefania <BIBLEBOOK>.');

  const books = [];
  let testamentOffset = 0;
  let previousRawNumber = 0;
  bookNodes.forEach((bookNode, bookIndex) => {
    let rawNumber = parsePositiveInt(attribute(bookNode, ['number', 'bnumber', 'booknumber', 'book', 'num', 'id']), bookIndex + 1);
    if (rawNumber === 1 && previousRawNumber >= 39 && testamentOffset === 0) testamentOffset = 39;
    const number = rawNumber <= 39 && testamentOffset ? rawNumber + testamentOffset : rawNumber;
    previousRawNumber = rawNumber;
    const explicitName = nameFromNode(bookNode, ['name', 'bname', 'bookname', 'longname', 'osisid']);
    const name = explicitName || FRENCH_BOOKS[number - 1] || `Livre ${number}`;

    const chapterNodes = descendants(bookNode).filter((element) => CHAPTER_TAGS.has(localName(element)));
    const chapters = chapterNodes.map((chapterNode, chapterIndex) => {
      const chapterNumber = parsePositiveInt(attribute(chapterNode, ['number', 'cnumber', 'chapternumber', 'num', 'n']), chapterIndex + 1);
      const verseNodes = descendants(chapterNode).filter((element) => VERSE_TAGS.has(localName(element)));
      const verses = verseNodes.map((verseNode, verseIndex) => ({
        num: parsePositiveInt(attribute(verseNode, ['number', 'vnumber', 'versenumber', 'vnum', 'num', 'n']), verseIndex + 1),
        text: String(verseNode.textContent || '').replace(/\s+/g, ' ').trim(),
      })).filter((verse) => verse.text.length > 0).sort((a, b) => a.num - b.num);
      return { num: chapterNumber, verses };
    }).filter((chapter) => chapter.verses.length > 0).sort((a, b) => a.num - b.num);

    if (chapters.length) books.push({ name, num: number, chapters });
  });
  if (!books.length) throw new Error('Aucun chapitre ou verset reconnu dans ce fichier XML.');
  return { id: `bible_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, name: translation || fallbackName, books };
}

export { FRENCH_BOOKS };
