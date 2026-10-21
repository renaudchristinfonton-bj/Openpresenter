// Canon protestant (66 livres) : noms français, abréviations reconnues, nombre de
// chapitres. Table livrée, surchargeable par `project/library/book-abbr.json`
// (EF-12.12) — la surcharge est appliquée par `reference.mjs`, jamais ici.

export const BOOKS = [
  { num: 1, name: 'Genèse', abbr: 'Gn', alt: ['gn', 'gen', 'ge', 'genes'], chapters: 50, testament: 'AT' },
  { num: 2, name: 'Exode', abbr: 'Ex', alt: ['ex', 'exo'], chapters: 40, testament: 'AT' },
  { num: 3, name: 'Lévitique', abbr: 'Lv', alt: ['lv', 'lev', 'levit'], chapters: 27, testament: 'AT' },
  { num: 4, name: 'Nombres', abbr: 'Nb', alt: ['nb', 'nom', 'nomb'], chapters: 36, testament: 'AT' },
  { num: 5, name: 'Deutéronome', abbr: 'Dt', alt: ['dt', 'deu', 'deut'], chapters: 34, testament: 'AT' },
  { num: 6, name: 'Josué', abbr: 'Jos', alt: ['jos', 'josu'], chapters: 24, testament: 'AT' },
  { num: 7, name: 'Juges', abbr: 'Jg', alt: ['jg', 'jug'], chapters: 21, testament: 'AT' },
  { num: 8, name: 'Ruth', abbr: 'Rt', alt: ['rt', 'ru', 'ruth'], chapters: 4, testament: 'AT' },
  { num: 9, name: '1 Samuel', abbr: '1S', alt: ['1s', '1sa', '1sam'], chapters: 31, testament: 'AT' },
  { num: 10, name: '2 Samuel', abbr: '2S', alt: ['2s', '2sa', '2sam'], chapters: 24, testament: 'AT' },
  { num: 11, name: '1 Rois', abbr: '1R', alt: ['1r', '1ro', '1roi'], chapters: 22, testament: 'AT' },
  { num: 12, name: '2 Rois', abbr: '2R', alt: ['2r', '2ro', '2roi'], chapters: 25, testament: 'AT' },
  { num: 13, name: '1 Chroniques', abbr: '1Ch', alt: ['1ch', '1chr'], chapters: 29, testament: 'AT' },
  { num: 14, name: '2 Chroniques', abbr: '2Ch', alt: ['2ch', '2chr'], chapters: 36, testament: 'AT' },
  { num: 15, name: 'Esdras', abbr: 'Esd', alt: ['esd', 'esdr'], chapters: 10, testament: 'AT' },
  { num: 16, name: 'Néhémie', abbr: 'Né', alt: ['ne', 'neh', 'nemi'], chapters: 13, testament: 'AT' },
  { num: 17, name: 'Esther', abbr: 'Est', alt: ['est', 'esth'], chapters: 10, testament: 'AT' },
  { num: 18, name: 'Job', abbr: 'Jb', alt: ['jb', 'job'], chapters: 42, testament: 'AT' },
  { num: 19, name: 'Psaumes', abbr: 'Ps', alt: ['ps', 'psa', 'psaume'], chapters: 150, testament: 'AT' },
  { num: 20, name: 'Proverbes', abbr: 'Pr', alt: ['pr', 'pro', 'prov'], chapters: 31, testament: 'AT' },
  { num: 21, name: 'Ecclésiaste', abbr: 'Ec', alt: ['ec', 'ecc', 'eccl'], chapters: 12, testament: 'AT' },
  { num: 22, name: 'Cantique des cantiques', abbr: 'Ct', alt: ['ct', 'cant', 'cantique'], chapters: 8, testament: 'AT' },
  { num: 23, name: 'Ésaïe', abbr: 'És', alt: ['es', 'esa', 'esai', 'is', 'isa', 'esai'], chapters: 66, testament: 'AT' },
  { num: 24, name: 'Jérémie', abbr: 'Jr', alt: ['jr', 'jer', 'jere'], chapters: 52, testament: 'AT' },
  { num: 25, name: 'Lamentations', abbr: 'Lm', alt: ['lm', 'lam'], chapters: 5, testament: 'AT' },
  { num: 26, name: 'Ézéchiel', abbr: 'Éz', alt: ['ez', 'eze', 'ezech'], chapters: 48, testament: 'AT' },
  { num: 27, name: 'Daniel', abbr: 'Dn', alt: ['dn', 'dan'], chapters: 12, testament: 'AT' },
  { num: 28, name: 'Osée', abbr: 'Os', alt: ['os', 'ose'], chapters: 14, testament: 'AT' },
  { num: 29, name: 'Joël', abbr: 'Jl', alt: ['jl', 'joel'], chapters: 3, testament: 'AT' },
  { num: 30, name: 'Amos', abbr: 'Am', alt: ['am', 'amo'], chapters: 9, testament: 'AT' },
  { num: 31, name: 'Obadia', abbr: 'Ab', alt: ['ab', 'abd', 'oba'], chapters: 1, testament: 'AT' },
  { num: 32, name: 'Jonas', abbr: 'Jon', alt: ['jon', 'jonas'], chapters: 4, testament: 'AT' },
  { num: 33, name: 'Michée', abbr: 'Mi', alt: ['mi', 'mic', 'miche'], chapters: 7, testament: 'AT' },
  { num: 34, name: 'Nahum', abbr: 'Na', alt: ['na', 'nah'], chapters: 3, testament: 'AT' },
  { num: 35, name: 'Habacuc', abbr: 'Ha', alt: ['ha', 'hab'], chapters: 3, testament: 'AT' },
  { num: 36, name: 'Sophonie', abbr: 'So', alt: ['so', 'sop', 'soph'], chapters: 3, testament: 'AT' },
  { num: 37, name: 'Aggée', abbr: 'Ag', alt: ['ag', 'agg'], chapters: 2, testament: 'AT' },
  { num: 38, name: 'Zacharie', abbr: 'Za', alt: ['za', 'zac', 'zach'], chapters: 14, testament: 'AT' },
  { num: 39, name: 'Malachie', abbr: 'Ml', alt: ['ml', 'mal'], chapters: 4, testament: 'AT' },
  { num: 40, name: 'Matthieu', abbr: 'Mt', alt: ['mt', 'mat', 'matt'], chapters: 28, testament: 'NT' },
  { num: 41, name: 'Marc', abbr: 'Mc', alt: ['mc', 'mar', 'marc'], chapters: 16, testament: 'NT' },
  { num: 42, name: 'Luc', abbr: 'Lc', alt: ['lc', 'luc'], chapters: 24, testament: 'NT' },
  { num: 43, name: 'Jean', abbr: 'Jn', alt: ['jn', 'jea', 'jean'], chapters: 21, testament: 'NT' },
  { num: 44, name: 'Actes', abbr: 'Ac', alt: ['ac', 'act', 'actes'], chapters: 28, testament: 'NT' },
  { num: 45, name: 'Romains', abbr: 'Rm', alt: ['rm', 'rom', 'romain'], chapters: 16, testament: 'NT' },
  { num: 46, name: '1 Corinthiens', abbr: '1Co', alt: ['1co', '1cor'], chapters: 16, testament: 'NT' },
  { num: 47, name: '2 Corinthiens', abbr: '2Co', alt: ['2co', '2cor'], chapters: 13, testament: 'NT' },
  { num: 48, name: 'Galates', abbr: 'Ga', alt: ['ga', 'gal'], chapters: 6, testament: 'NT' },
  { num: 49, name: 'Éphésiens', abbr: 'Ép', alt: ['ep', 'eph', 'ephes'], chapters: 6, testament: 'NT' },
  { num: 50, name: 'Philippiens', abbr: 'Ph', alt: ['ph', 'phi', 'phil'], chapters: 4, testament: 'NT' },
  { num: 51, name: 'Colossiens', abbr: 'Col', alt: ['col', 'colos'], chapters: 4, testament: 'NT' },
  { num: 52, name: '1 Thessaloniciens', abbr: '1Th', alt: ['1th', '1thes'], chapters: 5, testament: 'NT' },
  { num: 53, name: '2 Thessaloniciens', abbr: '2Th', alt: ['2th', '2thes'], chapters: 3, testament: 'NT' },
  { num: 54, name: '1 Timothée', abbr: '1Tm', alt: ['1tm', '1tim'], chapters: 6, testament: 'NT' },
  { num: 55, name: '2 Timothée', abbr: '2Tm', alt: ['2tm', '2tim'], chapters: 4, testament: 'NT' },
  { num: 56, name: 'Tite', abbr: 'Tt', alt: ['tt', 'tit', 'tite'], chapters: 3, testament: 'NT' },
  { num: 57, name: 'Philémon', abbr: 'Phm', alt: ['phm', 'phile'], chapters: 1, testament: 'NT' },
  { num: 58, name: 'Hébreux', abbr: 'Hé', alt: ['he', 'heb', 'hebr'], chapters: 13, testament: 'NT' },
  { num: 59, name: 'Jacques', abbr: 'Jc', alt: ['jc', 'jac', 'jq'], chapters: 5, testament: 'NT' },
  { num: 60, name: '1 Pierre', abbr: '1P', alt: ['1p', '1pi', '1pie'], chapters: 5, testament: 'NT' },
  { num: 61, name: '2 Pierre', abbr: '2P', alt: ['2p', '2pi', '2pie'], chapters: 3, testament: 'NT' },
  { num: 62, name: '1 Jean', abbr: '1Jn', alt: ['1jn', '1jea'], chapters: 5, testament: 'NT' },
  { num: 63, name: '2 Jean', abbr: '2Jn', alt: ['2jn', '2jea'], chapters: 1, testament: 'NT' },
  { num: 64, name: '3 Jean', abbr: '3Jn', alt: ['3jn', '3jea'], chapters: 1, testament: 'NT' },
  { num: 65, name: 'Jude', abbr: 'Jd', alt: ['jd', 'jud'], chapters: 1, testament: 'NT' },
  { num: 66, name: 'Apocalypse', abbr: 'Ap', alt: ['ap', 'apo', 'apoc'], chapters: 22, testament: 'NT' }
];

export const BOOK_COUNT = BOOKS.length;

export function bookByNum(num) {
  return BOOKS.find((b) => b.num === num) || null;
}

/** Normalise une chaîne : minuscules, sans accents, espaces réduits (EF-12.5). */
export function fold(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Table de recherche prête à l'emploi (livrée + surcharge utilisateur). */
export function buildIndex(overrides = {}) {
  const extra = overrides.abbreviations && typeof overrides.abbreviations === 'object'
    ? overrides.abbreviations
    : {};
  const aliases = new Map();
  for (const book of BOOKS) {
    const names = new Set([book.name, book.abbr, ...(book.alt || [])]);
    for (const [key, target] of Object.entries(extra)) {
      if (target === book.num || target === book.name) names.add(key);
    }
    aliases.set(book.num, [...names].map(fold).filter(Boolean));
  }
  return { books: BOOKS, aliases, overrides };
}
