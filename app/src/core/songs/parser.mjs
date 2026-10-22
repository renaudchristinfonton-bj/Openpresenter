// Import et analyse des chants (EF-15.1 → EF-15.7, EF-15.17) — module **pur**.
//
// Aucun import : ce fichier tourne à l'identique dans Node et dans le navigateur
// (aperçu d'import dans le studio), comme les modules de la Bible.
//
// Formats reconnus : texte brut, ChordPro, OpenSong XML, export CCLI/SongSelect.
// Le format est détecté, jamais demandé : l'opérateur colle ou dépose un fichier.

export const SONG_FORMATS = ['chordpro', 'opensong', 'ccli', 'text'];

export const SECTION_TYPES = ['verse', 'chorus', 'bridge', 'prechorus', 'intro', 'outro', 'tag', 'interlude'];

/** Nom par défaut par type de section (ch. 10 § 10.2.1). */
export const SECTION_LABELS = {
  verse: 'Couplet',
  chorus: 'Refrain',
  bridge: 'Pont',
  prechorus: 'Pré-refrain',
  intro: 'Intro',
  outro: 'Fin',
  tag: 'Tag',
  interlude: 'Interlude'
};

/** Couleur d'identification (l'interface s'en sert, pas la sortie). */
export const SECTION_COLORS = {
  verse: '#60a5fa',
  chorus: '#a78bfa',
  bridge: '#fb923c',
  prechorus: '#93c5fd',
  intro: '#9ca3af',
  outro: '#9ca3af',
  tag: '#34d399',
  interlude: '#f5b942'
};

// Marqueurs de section en tête de ligne. L'ordre compte : « Pré-refrain » doit
// être testé avant « Refrain ».
const HEADER_RULES = [
  { type: 'prechorus', re: /^(?:pr[ée][- ]?refrain|pre[- ]?chorus|pc)\b\.?\s*(\d+)?/i },
  { type: 'chorus', re: /^(?:refrain|chorus|chœur|cheur|c)\b\.?\s*(\d+)?/i },
  { type: 'verse', re: /^(?:couplet|verse|strophe|v)\s*\.?\s*(\d+)?/i },
  { type: 'bridge', re: /^(?:pont|bridge|b)\b\.?\s*(\d+)?/i },
  { type: 'intro', re: /^(?:intro|introduction)\b\.?\s*(\d+)?/i },
  { type: 'outro', re: /^(?:fin|outro|ending|final)\b\.?\s*(\d+)?/i },
  { type: 'tag', re: /^(?:tag|reprise)\b\.?\s*(\d+)?/i },
  { type: 'interlude', re: /^(?:interlude|instrumental)\b\.?\s*(\d+)?/i }
];

const CHORD_RE = /^([A-G](#|b)?)(maj|min|m|dim|aug|sus[24]?|add[0-9]{1,2}|[0-9]{1,2})?(\/[A-G](#|b)?)?$/;
const CHORD_TOKEN_RE = /\[([A-G][^\]]{0,12})\]/g;

/**
 * Reconnaît un en-tête de section (« Couplet 1 », « Refrain », « V2 », « C »…).
 * Une ligne de paroles ordinaire ne doit jamais être prise pour un en-tête :
 * seules les lignes **courtes** sont examinées (EF-15.3).
 * @param {string} line
 * @returns {{type: string, name: string, number: number|null}|null}
 */
export function sectionHeader(line) {
  const raw = String(line ?? '').trim();
  if (!raw || raw.length > 42) return null;
  // Un en-tête ne contient pas de ponctuation de phrase ni de parenthèse ouverte.
  if (/[.!?;:]$/.test(raw) && raw.length > 14) return null;
  if (/[«»"]/.test(raw)) return null;

  for (const rule of HEADER_RULES) {
    const m = rule.re.exec(raw);
    if (!m) continue;
    // La règle doit couvrir **toute** la ligne : « C'est fini » n'est pas « C ».
    // Un suffixe court entre parenthèses reste un en-tête (« Couplet 2 (final) »).
    const rest = raw.slice(m[0].length).trim();
    // Qualificatifs usuels : « Refrain final », « Couplet 2 bis », « Pont x2 ».
    const QUALIFIER = /^(?:final|finale|dernier|derni[eè]re|fin|bis|ter|x\s?[2-4]|reprise|court|long|acoustique)$/i;
    const allowed = /^[\s\-–—:.]*$/.test(rest)
      || /^[\s\-–—:.]*\([^)]{1,24}\)[\s\-–—:.]*$/.test(rest)
      || /^[\s\-–—:.]*[0-9][\s\-–—:.]*$/.test(rest)
      || rest.split(/[\s\-–—:.]+/).filter(Boolean).every((word) => QUALIFIER.test(word) || /^[0-9]$/.test(word));
    if (rest && !allowed) continue;
    const number = m[1] ? String(Number(m[1])) : '';
    const type = rule.type;
    let name = SECTION_LABELS[type];
    if (number) name = `${name} ${number}`;
    // Un libellé qui apporte une information (« Refrain final », « Couplet 2
    // (final) ») est conservé tel quel : c'est le nom que l'opérateur connaît.
    const extra = rest.replace(/[\s\-–—:.]/g, '');
    if (/[A-Za-z]{3,}/.test(extra)) name = raw.replace(/\s+/g, ' ');
    return { type, name, number: m[1] ? Number(m[1]) : null };
  }
  return null;
}

/** Vrai si la ligne ne contient que des accords (« G  C  D »). */
export function isChordLine(line) {
  const tokens = String(line ?? '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens.length > 16) return false;
  return tokens.every((token) => CHORD_RE.test(token));
}

/** Vrai si la ligne porte des accords entre crochets (`[G]Grâce`). */
export function hasInlineChords(line) {
  CHORD_TOKEN_RE.lastIndex = 0;
  return CHORD_TOKEN_RE.test(String(line ?? ''));
}

/**
 * Détecte le format d'un contenu collé ou lu depuis un fichier (EF-15.1).
 * @param {string} text
 * @returns {'chordpro'|'opensong'|'ccli'|'text'}
 */
export function detectFormat(text) {
  const value = String(text ?? '');
  if (/<song\b[^>]*>[\s\S]*<\/song>/i.test(value)) return 'opensong';
  if (/\{\s*(?:title|t|start_of_chorus|soc|start_of_verse|sov|comment)\s*:/i.test(value)) return 'chordpro';
  if (CHORD_TOKEN_RE.test(value)) { CHORD_TOKEN_RE.lastIndex = 0; return 'chordpro'; }
  CHORD_TOKEN_RE.lastIndex = 0;
  if (/CCLI\s*(?:Song\s*)?#?\s*\d{3,8}/i.test(value)) return 'ccli';
  return 'text';
}

function cleanValue(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function metaFromDirectives(lines) {
  const meta = {};
  const kept = [];
  for (const line of lines) {
    const m = /^\{\s*([a-z_]+)\s*:\s*([^}]*)\}\s*$/i.exec(line);
    if (!m) { kept.push(line); continue; }
    const key = m[1].toLowerCase();
    const value = cleanValue(m[2]);
    switch (key) {
      case 'title': case 't': meta.title = value; break;
      case 'artist': case 'artist_name': meta.artist = value; break;
      case 'composer': case 'author': meta.composer = value; break;
      case 'copyright': case 'c': meta.copyright = value; break;
      case 'key': meta.key = value; break;
      case 'tempo': meta.tempo = Number(value) || undefined; break;
      case 'time': case 'time_signature': meta.timeSignature = value; break;
      case 'ccli': meta.ccli = value; break;
      case 'language': case 'lang': meta.language = value; break;
      default: break; // {comment}, {soc}… traités plus bas
    }
  }
  return { meta, lines: kept };
}

/**
 * Retire les accords d'une ligne en conservant les positions (EF-15.26).
 * @returns {{text: string, chords: {chord: string, index: number}[]}}
 */
export function stripInlineChords(line) {
  const chords = [];
  let text = '';
  let last = 0;
  CHORD_TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = CHORD_TOKEN_RE.exec(line)) !== null) {
    text += line.slice(last, m.index);
    chords.push({ chord: m[1].trim(), index: text.length });
    last = m.index + m[0].length;
  }
  text += line.slice(last);
  return { text, chords };
}

/** Normalise une ligne en `{text, chords}` : un seul type de ligne en interne. */
function toEntry(line) {
  if (line && typeof line === 'object') return { text: String(line.text ?? ''), chords: line.chords || [] };
  return { text: String(line ?? ''), chords: [] };
}

/** Regroupe les lignes en sections, en suivant les en-têtes et les lignes vides. */
function buildSections(rawLines) {
  const lines = rawLines.map(toEntry);
  const sections = [];
  let current = null;

  const open = (header, explicit) => {
    current = {
      type: header?.type || 'verse',
      name: header?.name || null,
      explicit: Boolean(explicit),
      lines: []
    };
    sections.push(current);
  };

  const pushLine = (entry) => {
    if (!current) open(null, false);
    current.lines.push(entry);
  };

  for (const entry of lines) {
    const line = entry.text;
    if (!line.trim()) {
      // Une ligne vide **ferme** une section qui n'a pas d'en-tête explicite
      // (EF-15.4). Dans une section nommée, elle est conservée : c'est une
      // strophe interne (EF-15.7). Une nouvelle section s'ouvre alors sur la
      // prochaine ligne, qu'elle ait un en-tête ou non.
      if (current && current.lines.length && !current.explicit) current = null;
      else if (current && current.lines.length) current.lines.push({ text: '', chords: [] });
      continue;
    }
    // En-tête explicite posé sur sa propre ligne.
    const header = sectionHeader(line);
    if (header) {
      // Un en-tête après du contenu ferme la section précédente ; un en-tête en
      // tête de section la nomme simplement (cas le plus courant).
      if (!current || current.lines.length) open(header, true);
      else {
        current.type = header.type;
        current.name = header.name;
        current.explicit = true;
      }
      continue;
    }
    // Ligne de titre collée au premier couplet : on l'ignore (elle est déjà
    // récupérée comme métadonnée).
    pushLine(entry);
  }
  return sections;
}

/** Numérote les sections et applique les noms par défaut (« Couplet 1 », « Couplet 2 »). */
function nameSections(sections) {
  const counters = new Map();
  return sections
    .filter((section) => section.lines.some((entry) => entry.text.trim()))
    .map((section, index) => {
      const count = (counters.get(section.type) || 0) + 1;
      counters.set(section.type, count);
      const base = SECTION_LABELS[section.type] || 'Section';
      // Un nom explicite (« Couplet 3 », « Refrain final ») est conservé tel quel.
      const name = section.name || (count > 1 ? `${base} ${count}` : base);
      return {
        id: `sec_${index + 1}`,
        name,
        type: section.type,
        entries: section.lines
      };
    });
}

/** Construit le document `song.schema.json` à partir de sections analysées. */
export function buildSong({ title, sections, meta = {}, format = 'text', warnings = [] }) {
  const named = nameSections(sections).map((section) => {
    // Les lignes vides internes sont conservées (EF-15.7), les lignes finales non.
    const entries = trimBlankEntryEdges(section.entries);
    const chords = [];
    let offset = 0;
    for (const entry of entries) {
      for (const chord of entry.chords || []) {
        const at = offset + Math.min(chord.index, entry.text.length);
        chords.push([chord.chord, at]);
      }
      offset += entry.text.length + 1;
    }
    return {
      id: section.id,
      name: section.name,
      type: SECTION_TYPES.includes(section.type) ? section.type : 'verse',
      lines: entries.map((entry) => entry.text),
      chords
    };
  }).filter((section) => section.lines.length);

  const cleanSections = named.map(({ chords, ...section }) => section);
  const chordMap = {};
  for (const section of named) {
    if (section.chords.length) chordMap[section.id] = section.chords;
  }

  const song = {
    id: meta.id || '',
    rev: 1,
    title: cleanValue(title) || 'Chant sans titre',
    sections: cleanSections,
    arrangements: [{
      id: 'arr_default',
      name: 'Ordre standard',
      order: cleanSections.map((section) => section.id)
    }],
    activeArrangementId: 'arr_default',
    chords: chordMap,
    format,
    warnings: [...warnings],
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    folders: Array.isArray(meta.folders) ? meta.folders : [],
    language: meta.language || 'fr'
  };
  if (meta.titleOriginal) song.titleOriginal = cleanValue(meta.titleOriginal);
  if (meta.artist) song.artist = cleanValue(meta.artist);
  if (meta.composer) song.composer = cleanValue(meta.composer);
  if (meta.copyright) song.copyright = cleanValue(meta.copyright);
  if (meta.ccli) song.ccli = String(meta.ccli).slice(0, 20);
  if (meta.key && /^([A-G](#|b)?)(maj|min)?$/.test(meta.key)) song.key = meta.key;
  if (Number.isFinite(meta.tempo) && meta.tempo >= 20 && meta.tempo <= 300) song.tempo = Math.round(meta.tempo);
  if (meta.timeSignature && /^[0-9]{1,2}\/[0-9]{1,2}$/.test(meta.timeSignature)) song.timeSignature = meta.timeSignature;
  if (Number.isFinite(meta.durationSec)) song.durationSec = Math.round(meta.durationSec);
  if (meta.sourceAssetId) song.sourceAssetId = meta.sourceAssetId;
  delete song.id;
  return song;
}

function trimBlankEntryEdges(entries) {
  const out = [...entries];
  while (out.length && !out[0].text.trim()) out.shift();
  while (out.length && !out[out.length - 1].text.trim()) out.pop();
  return out;
}

/**
 * Analyse un texte ChordPro : directives de section, accords entre crochets.
 * Les accords sont **retirés** du texte ; ils sont recomposés ensuite par
 * `collectChords()` à partir du texte source, pour des décalages exacts.
 */
function parseChordPro(raw) {
  const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
  const warnings = [];
  let title = '';
  const out = [];

  for (const line of lines) {
    const directive = /^\{\s*([a-z_]+)\s*:?\s*([^}]*)\}\s*$/i.exec(line.trim());
    if (directive) {
      const key = directive[1].toLowerCase();
      const value = cleanValue(directive[2]);
      switch (key) {
        case 'title': case 't': title = value; break;
        // Une directive de section ouvre une section nommée ; la ligne vide qui
        // suit est ignorée par `buildSections()`.
        case 'start_of_chorus': case 'soc': out.push('Refrain'); break;
        case 'start_of_verse': case 'sov': out.push('Couplet'); break;
        case 'start_of_bridge': case 'sob': out.push('Pont'); break;
        case 'start_of_tab': case 'sot': break;
        case 'end_of_chorus': case 'eoc':
        case 'end_of_verse': case 'eov':
        case 'end_of_bridge': case 'eob':
          if (out.length && out[out.length - 1].trim()) out.push('');
          break;
        default: break;
      }
      continue;
    }
    out.push(stripInlineChords(line));
  }
  return { lines: out, title, warnings, meta: {}, chords: {} };
}

/**
 * Analyse un export OpenSong.
 * OpenSong place les accords sur la ligne **au-dessus** des paroles ; on
 * convertit d'abord en ChordPro (`[G]Paroles`), puis on réutilise le même
 * analyseur : un seul chemin de code pour les deux formats à accords.
 */
function parseOpenSong(raw) {
  const pick = (tag) => {
    const m = new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`, 'i').exec(raw);
    return m ? m[1].trim() : '';
  };
  const meta = {
    title: pick('title'),
    artist: pick('author'),
    composer: pick('author'),
    copyright: pick('copyright'),
    key: pick('key'),
    tempo: Number(pick('tempo')) || undefined,
    timeSignature: pick('time_sig'),
    ccli: pick('ccli')
  };
  const lyrics = (pick('lyrics') || pick('verse') || '').replace(/\r\n?/g, '\n');
  return { chordPro: openSongToChordPro(lyrics), title: meta.title, warnings: [], meta };
}

/**
 * Convertit un bloc de paroles OpenSong en ChordPro : chaque ligne d'accords est
 * plaquée sur la ligne de paroles qui la suit, en conservant les colonnes.
 */
export function openSongToChordPro(lyrics) {
  const lines = String(lyrics ?? '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isChordLine(line) && line.trim()) {
      const next = lines[i + 1];
      if (next !== undefined && next.trim() && !isChordLine(next)) {
        out.push(applyChordColumns(next, line));
        i += 1;
        continue;
      }
      // Ligne d'accords seule (intro instrumentale) : on la garde entre crochets.
      out.push(line.trim().split(/\s+/).map((chord) => `[${chord}]`).join(''));
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

function applyChordColumns(lyricLine, chordLine) {
  const inserts = [];
  let cursor = 0;
  for (const token of chordLine.trim().split(/\s+/)) {
    if (!token) continue;
    const at = chordLine.indexOf(token, cursor);
    cursor = at + token.length;
    inserts.push({ chord: token, at: Math.max(0, Math.min(at, lyricLine.length)) });
  }
  let text = lyricLine;
  // On insère de droite à gauche pour ne pas décaler les positions suivantes.
  for (const { chord, at } of [...inserts].sort((a, b) => b.at - a.at)) {
    text = `${text.slice(0, at)}[${chord}]${text.slice(at)}`;
  }
  return text;
}

/**
 * Analyse un texte brut ou un export CCLI.
 * L'en-tête (titre, crédits, numéro CCLI) est séparé du corps : les lignes qui
 * précèdent la première section ne deviennent jamais des paroles.
 */
function parsePlain(raw) {
  const warnings = [];
  const meta = {};

  const ccliMatch = /CCLI\s*(?:Song\s*)?#?\s*(\d{3,8})/i.exec(raw);
  if (ccliMatch) meta.ccli = ccliMatch[1];

  // Les lignes CCLI (« CCLI Song #… », « CCLI License #… ») ne sont pas chantées.
  const lines = String(raw)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !/^\s*CCLI\b/i.test(line))
    .map((line) => line.replace(/\s+$/, ''));

  const firstHeader = lines.findIndex((line) => line.trim() && sectionHeader(line));
  const headEnd = firstHeader >= 0 ? firstHeader : lines.findIndex((line, i) => i > 0 && false);
  const headerZone = (firstHeader >= 0 ? lines.slice(0, firstHeader) : lines.slice(0, 2))
    .map((line) => line.trim())
    .filter(Boolean);

  let title = '';
  let body;
  if (firstHeader >= 0) {
    title = headerZone[0] || '';
    assignCredits(headerZone.slice(1), meta);
    body = lines.slice(firstHeader);
  } else {
    // Pas d'en-tête : le titre est la première ligne, les crédits suivent.
    const firstContent = lines.findIndex((line) => line.trim());
    title = firstContent >= 0 ? lines[firstContent].trim() : '';
    let i = firstContent + 1;
    const credits = [];
    while (i < lines.length && credits.length < 3) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (sectionHeader(line)) break;
      if (/^(par|by|auteur|author|composer|artiste|artist)\s*[:\-]\s*.+$/i.test(line.trim()) || line.trim().length <= 60) {
        credits.push(line.trim());
        i++;
        continue;
      }
      break;
    }
    assignCredits(credits, meta);
    body = lines.slice(i);
  }

  // Accords posés seuls sur leur ligne (accords au-dessus des paroles).
  const kept = [];
  for (const line of body) {
    if (isChordLine(line) && line.trim()) { kept.push(''); continue; }
    kept.push(line);
  }
  return { lines: kept, title, warnings, meta, chords: {} };
}

function assignCredits(lines, meta) {
  for (const line of lines) {
    const credit = /^(par|by|auteur|author|composer|artiste|artist)\s*[:\-]\s*(.+)$/i.exec(line);
    if (credit) {
      const key = /artist|artiste/i.test(credit[1]) ? 'artist' : 'composer';
      meta[key] = cleanValue(credit[2]);
      continue;
    }
    // Ligne de crédit sans préfixe : un seul nom, pas une phrase.
    if (!line || line.length > 60 || /[.!?]/.test(line)) continue;
    if (!meta.composer) meta.composer = cleanValue(line);
  }
}

/**
 * Analyse un contenu de chant et renvoie un **aperçu** complet (EF-15.1).
 * Aucune écriture : c'est ce que l'opérateur valide avant l'import.
 *
 * @param {string} text
 * @param {{filename?: string}} [options]
 */
export function parseSongText(text, { filename = '' } = {}) {
  const raw = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const format = detectFormat(raw);
  const warnings = [];

  let parsed;
  if (format === 'opensong') {
    // OpenSong : conversion en ChordPro, puis analyse commune (accords compris).
    const open = parseOpenSong(raw);
    parsed = { ...parseChordPro(open.chordPro), title: open.title, meta: open.meta };
  } else if (format === 'chordpro') {
    parsed = parseChordPro(raw);
  } else {
    parsed = parsePlain(raw);
  }

  const meta = { ...(parsed.meta || {}) };
  let lines = parsed.lines;

  // Directives ChordPro restantes ({artist:}, {key:}…) même hors format strict.
  if (format !== 'chordpro') {
    const extracted = metaFromDirectives(lines);
    Object.assign(meta, extracted.meta);
    lines = extracted.lines;
  } else {
    const directives = raw.match(/\{\s*(artist|composer|copyright|key|tempo|time|ccli)\s*:\s*([^}]*)\}/gi) || [];
    for (const token of directives) {
      const m = /^\{\s*([a-z_]+)\s*:\s*([^}]*)\}$/i.exec(token);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const value = cleanValue(m[2]);
      if (key === 'artist' && !meta.artist) meta.artist = value;
      if (key === 'composer' && !meta.composer) meta.composer = value;
      if (key === 'copyright' && !meta.copyright) meta.copyright = value;
      if (key === 'key' && !meta.key) meta.key = value;
      if (key === 'tempo' && !meta.tempo) meta.tempo = Number(value) || undefined;
      if (key === 'ccli' && !meta.ccli) meta.ccli = value;
    }
  }

  const sections = buildSections(lines);
  if (!sections.length) {
    warnings.push('Aucune parole détectée : vérifiez le fichier.');
  }

  const title = cleanValue(parsed.title || meta.title || deriveTitleFromFilename(filename));
  const song = buildSong({ title, sections, meta, format, warnings: parsed.warnings || [] });

  if (Object.keys(song.chords).length && format === 'text') {
    warnings.push('Les accords ont été lus en mode texte : vérifiez leur alignement.');
  }
  song.warnings = [...(parsed.warnings || []), ...warnings];
  if (!song.sections.length) {
    song.sections = [{ id: 'sec_1', name: 'Section', type: 'verse', lines: [''] }];
    song.arrangements = [{ id: 'arr_default', name: 'Ordre standard', order: ['sec_1'] }];
  }
  return song;
}

function deriveTitleFromFilename(filename) {
  const base = String(filename || '').split(/[\\/]/).pop() || '';
  return base.replace(/\.[a-z0-9]{1,6}$/i, '').replace(/[_-]+/g, ' ').trim();
}

/** Résumé lisible pour la boîte d'aperçu d'import (§ 10.1.1). */
export function importSummary(song) {
  const sections = song.sections.map((section) => section.name);
  const chords = [...new Set(Object.values(song.chords || {}).flat().map(([chord]) => chord))];
  return {
    title: song.title,
    format: song.format,
    sections: song.sections.length,
    sectionNames: sections,
    hasChords: chords.length > 0,
    chords,
    metadata: {
      artist: song.artist || '',
      composer: song.composer || '',
      key: song.key || '',
      tempo: song.tempo || '',
      ccli: song.ccli || ''
    },
    warnings: song.warnings || [],
    lines: song.sections.reduce((total, section) => total + section.lines.length, 0)
  };
}
