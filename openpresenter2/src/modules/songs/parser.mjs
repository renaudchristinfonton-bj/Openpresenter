const SECTION_NAMES = {
  verse: 'Couplet', verse1: 'Couplet', v: 'Couplet', chorus: 'Refrain', refrain: 'Refrain',
  refrain1: 'Refrain', c: 'Refrain', bridge: 'Pont', bridge1: 'Pont', b: 'Pont', pont: 'Pont',
  intro: 'Intro', outro: 'Outro', tag: 'Tag', prechorus: 'Pré-refrain', interlude: 'Interlude',
  ending: 'Final', couplet: 'Couplet',
};
const DIRECTIVES = new Set(['title', 'subtitle', 'artist', 'composer', 'lyricist', 'copyright', 'key', 'tempo', 'time', 'capo', 'duration', 'album', 'tuning', 'comment', 'start_of_chorus', 'soc', 'end_of_chorus', 'eoc', 'start_of_verse', 'sov', 'end_of_verse', 'eov', 'start_of_bridge', 'sob', 'end_of_bridge', 'eob', 'start_of_tab', 'sot', 'end_of_tab', 'eot', 'start_of_grid', 'sog', 'end_of_grid', 'eog']);
const CHORD = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add|6|7|9|11|13|2|4|5|°|ø|\+|-)*(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?$/i;

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[ _-]/g, '');
}
function attr(node, names) {
  for (const name of names) {
    const value = node.getAttribute?.(name);
    if (value?.trim()) return value.trim();
  }
  return '';
}
function findText(root, names) {
  const wanted = new Set(names.map(normalize));
  const node = Array.from(root.getElementsByTagName('*')).find((item) => wanted.has(normalize(item.localName || item.nodeName)));
  return node?.textContent?.trim() || '';
}
function parseOpenSongXML(source) {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (Array.from(doc.getElementsByTagName('*')).some((node) => (node.localName || node.nodeName).toLowerCase() === 'parsererror')) return null;
  const root = doc.documentElement;
  const title = findText(root, ['title']) || attr(root, ['title']);
  const artist = findText(root, ['author', 'artist', 'composer']);
  const lyrics = findText(root, ['lyrics', 'lyric', 'text']);
  if (!lyrics) return null;
  return { title, artist, lyrics };
}
function sectionHeader(line) {
  let value = line.trim();
  const bracket = value.match(/^\[\s*([^\]]+)\s*\]$/);
  if (bracket) value = bracket[1];
  else value = value.replace(/\s*:\s*$/, '');
  const key = normalize(value);
  let match = key.match(/^(verse|v|couplet)(\d*)$/);
  if (match) return { type: 'verse', number: match[2] };
  match = key.match(/^(chorus|refrain|c)(\d*)$/);
  if (match) return { type: 'chorus', number: match[2] };
  match = key.match(/^(bridge|pont|b)(\d*)$/);
  if (match) return { type: 'bridge', number: match[2] };
  match = key.match(/^(intro|outro|tag|prechorus|interlude|ending)(\d*)$/);
  if (match) return { type: match[1], number: match[2] };
  return null;
}
function chordLyrics(line) {
  let lyrics = '';
  const chords = [];
  const token = /\[([^\]]+)\]/g;
  let last = 0;
  let match;
  while ((match = token.exec(line)) !== null) {
    lyrics += line.slice(last, match.index);
    const chord = match[1].trim();
    if (CHORD.test(chord)) chords.push({ chord, at: lyrics.length });
    else lyrics += match[0];
    last = token.lastIndex;
  }
  lyrics += line.slice(last);
  return { lyrics: lyrics.replace(/\s+$/g, ''), chords };
}
function sectionName(raw, number = '') {
  const key = normalize(raw);
  const label = SECTION_NAMES[key] || SECTION_NAMES[key.replace(/\d+$/, '')] || raw;
  const suffix = number || key.match(/\d+$/)?.[0] || '';
  return `${label}${suffix ? ` ${suffix}` : ''}`;
}

export function parseSongFile(sourceText, filename = 'Chant.txt') {
  let text = String(sourceText || '').replace(/^\uFEFF/, '').replace(/\r/g, '');
  const rawText = text;
  if (!text.trim()) throw new Error('Le fichier est vide.');
  const extension = String(filename).split('.').pop().toLowerCase();
  let metadata = { title: '', artist: '', lyrics: text };
  if (extension === 'xml' || /^\s*</.test(text)) {
    const parsed = parseOpenSongXML(text);
    if (parsed) metadata = { ...metadata, ...parsed };
  }
  text = metadata.lyrics;
  let title = metadata.title || String(filename).replace(/\.[^.]+$/, '').trim() || 'Chant sans titre';
  let artist = metadata.artist || '';
  const sections = [];
  let current = { name: 'Couplet 1', lines: [], chordLines: [] };
  let verseCount = 1;
  let detectedSection = false;
  const finish = () => {
    if (current.lines.some((line) => line.trim())) sections.push(current);
  };

  for (const original of text.split('\n')) {
    const line = original.trim();
    if (!line) {
      if (current.lines.length && current.lines.at(-1) !== '') { current.lines.push(''); current.chordLines.push([]); }
      continue;
    }
    const directive = line.match(/^\{\s*([\w-]+)(?:\s*:\s*([^}]*))?\s*\}$/i);
    if (directive) {
      const key = normalize(directive[1]); const value = (directive[2] || '').trim();
      if (key === 'title' && value) title = value;
      if (['artist', 'composer', 'lyricist', 'author'].includes(key) && value && !artist) artist = value;
      if (key.startsWith('endof') || (DIRECTIVES.has(key) && !['soc', 'sov', 'sob'].includes(key))) continue;
      const sectionMatch = key.match(/^(?:startof)?(verse|chorus|bridge|refrain|intro|outro|tag|prechorus|interlude|ending|sov|soc|sob)(\d*)$/);
      if (sectionMatch) {
        finish();
        const type = ({ sov: 'verse', soc: 'chorus', sob: 'bridge' })[sectionMatch[1]] || sectionMatch[1];
        if (sections.length || current.lines.length) current = { name: sectionName(type, sectionMatch[2]), lines: [], chordLines: [] };
        else current.name = sectionName(type, sectionMatch[2]);
        detectedSection = true; continue;
      }
    }
    const header = sectionHeader(line);
    if (header) {
      finish();
      current = { name: sectionName(header.type, header.number || (header.type === 'verse' ? String(verseCount++) : '')), lines: [], chordLines: [] };
      detectedSection = true; continue;
    }
    // Plain-text heading, e.g. "VERSE 2", "CHORUS", "Pont :".
    if (!line.includes('[') && /^[\p{L}\s0-9-]+:?$/u.test(line)) {
      const plainHeader = sectionHeader(line.replace(/\s+(\d+)$/, '$1'));
      if (plainHeader && (line.length < 30 || /^(verse|chorus|refrain|bridge|couplet|pont|intro|outro)/i.test(line))) {
        finish();
        current = { name: sectionName(plainHeader.type, plainHeader.number || (plainHeader.type === 'verse' ? String(verseCount++) : '')), lines: [], chordLines: [] };
        detectedSection = true; continue;
      }
    }
    if (/^\{\s*(?:comment|comment_italic)\s*:/i.test(line)) continue;
    const cleaned = chordLyrics(line);
    const lyric = cleaned.lyrics.replace(/\s{2,}/g, ' ').trim();
    if (lyric) {
      current.lines.push(lyric);
      current.chordLines.push(cleaned.chords.map((item) => ({ ...item })));
    }
  }
  finish();
  const normalized = sections.filter((section) => section.lines.some((line) => line.trim()));
  if (!normalized.length) throw new Error('Aucune parole lisible trouvée dans le fichier.');
  // If no section marker was present, keep the familiar Couplet 1 label.
  if (!detectedSection && normalized.length === 1) normalized[0].name = 'Couplet 1';
  return {
    id: `song_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title, artist, sections: normalized, source: filename, rawText, updatedAt: Date.now(),
  };
}

export { chordLyrics, sectionHeader };
