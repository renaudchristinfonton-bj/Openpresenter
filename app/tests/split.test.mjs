// A-07 → A-07j : découpage lisible (EF-13).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitText, splitAnnotationHtml, tokenize, countWords,
  sanitizeAnnotationHtml, DEFAULT_SETTINGS
} from '../src/core/split.mjs';

/** Fabrique un texte de n mots, éventuellement ponctué toutes les `punctEvery` mots. */
function words(n, { punctEvery = 0, mark = ',' } = {}) {
  const list = [];
  for (let i = 1; i <= n; i++) {
    list.push(punctEvery && i % punctEvery === 0 ? `mot${i}${mark}` : `mot${i}`);
  }
  return list.join(' ');
}

test('A-07 — 60 mots, 3 virgules, limite 25 : 3 parties coupées sur les virgules', () => {
  const text = words(60, { punctEvery: 20 });
  const { parts, meta } = splitText(text, { maxWordsPerScreen: 25 });
  assert.equal(parts.length, 3);
  assert.equal(meta.count, 3);
  // Les deux premières parties se terminent sur la virgule.
  assert.ok(parts[0].endsWith(','), parts[0]);
  assert.ok(parts[1].endsWith(','), parts[1]);
  // Aucun mot n'est perdu ni dupliqué.
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), text);
});

test('A-07b — 60 mots sans ponctuation : 3 parties, coupes proches de la limite', () => {
  const text = words(60);
  const { parts, meta } = splitText(text, { maxWordsPerScreen: 25 });
  assert.equal(parts.length, 3);
  // Les parties pleines saturent la limite ; la dernière peut être plus courte.
  assert.equal(meta.wordCounts[0], 25);
  assert.equal(meta.wordCounts[1], 25);
  assert.ok(meta.wordCounts[2] <= 25, String(meta.wordCounts));
  assert.equal(parts.join(' ').split(/\s+/).length, 60);
});

test('A-07c — 27 mots, limite 25 : une seule partie (pas d’orphelin)', () => {
  const text = words(27);
  const { parts } = splitText(text, { maxWordsPerScreen: 25 });
  assert.equal(parts.length, 1);
  assert.equal(parts[0], text);
});

test('A-07d — 52 mots, limite 25 : 2 parties équilibrées', () => {
  const text = words(52);
  const { parts } = splitText(text, { maxWordsPerScreen: 25 });
  assert.equal(parts.length, 2);
  const counts = parts.map(countWords);
  assert.ok(Math.abs(counts[0] - counts[1]) <= 3, JSON.stringify(counts));
});

test('A-07d bis — sans équilibrage : chaque partie sature la limite avant la suivante', () => {
  const text = words(120);
  const { parts } = splitText(text, { maxWordsPerScreen: 25, balanceParts: false });
  assert.ok(parts.length >= 4, String(parts.length));
  for (const part of parts.slice(0, -1)) assert.equal(countWords(part), 25);
  assert.equal(parts.join(' ').split(/\s+/).length, 120);
});

test('A-07c bis — le dernier reste est rattaché plutôt que laissé orphelin', () => {
  const text = words(52);
  const { meta } = splitText(text, { maxWordsPerScreen: 25, balanceParts: false });
  assert.ok(meta.wordCounts.every((c) => c >= 3), JSON.stringify(meta.wordCounts));
});

test('A-07e — saut de ligne au mot 20 : coupe prioritaire sur le saut de ligne', () => {
  const list = words(40).split(' ');
  const text = `${list.slice(0, 20).join(' ')}\n${list.slice(20).join(' ')}`;
  const { parts } = splitText(text, { maxWordsPerScreen: 25 });
  assert.equal(countWords(parts[0]), 20, parts[0]);
  assert.equal(parts[0], list.slice(0, 20).join(' '));
});

test('A-07f — guillemets : jamais séparés de leur contenu', () => {
  const text = '« Voici, je fais toutes choses nouvelles »';
  const { parts } = splitText(text, { maxWordsPerScreen: 4 });
  assert.ok(parts[0].startsWith('«'), parts[0]);
  for (const part of parts.slice(0, -1)) {
    assert.ok(!part.endsWith('«'), `guillemet ouvrant isolé : ${part}`);
  }
  assert.ok(parts[parts.length - 1].endsWith('»'), parts.join(' | '));
  assert.ok(!parts.some((p) => p.startsWith('»')), parts.join(' | '));
});

test('A-07g — 500 mots, limite 25 : 20 parties, aucune vide', () => {
  const text = words(500);
  const { parts } = splitText(text, { maxWordsPerScreen: 25 });
  assert.equal(parts.length, 20);
  assert.ok(parts.every((p) => p.trim().length > 0));
  assert.equal(parts.flatMap((p) => p.split(/\s+/)).length, 500);
});

test('A-07h — aucune partie de moins de 3 mots (fusion automatique)', () => {
  const cases = [
    words(26), words(27), words(28), words(51), words(52), words(53),
    words(60, { punctEvery: 7 }), words(77, { punctEvery: 3 })
  ];
  for (const text of cases) {
    const { parts } = splitText(text, { maxWordsPerScreen: 25, minWordsPerPart: 3 });
    for (const part of parts.slice(0, -1)) {
      assert.ok(countWords(part) >= 3, `partie trop courte (${countWords(part)}) : ${part}`);
    }
    // La dernière partie ne peut être plus courte que si la fusion dépasserait la
    // limite de plus de 15 % (EF-13.6 : on ne fusionne que ce qui reste raisonnable).
    const last = countWords(parts[parts.length - 1]);
    const prev = parts.length > 1 ? countWords(parts[parts.length - 2]) : 0;
    assert.ok(last >= 3 || prev + last > 28, `dernière partie orpheline (${last} mots) : ${parts.join(' | ')}`);
  }
});

test('A-07i — annotations à cheval : le balisage est reporté sur les deux parties', () => {
  const html = 'Car Dieu a tant <b>aimé le monde qu\'il a donné son Fils unique</b>, afin que quiconque croit en lui ne périsse point.';
  const { parts } = splitAnnotationHtml(html, { maxWordsPerScreen: 8 });
  assert.ok(parts.length >= 2);
  const bolded = parts.filter((p) => /<b>/.test(p));
  assert.ok(bolded.length >= 2, parts.join(' | '));
  for (const part of bolded) {
    assert.match(part, /<b>[^<]+<\/b>/);
  }
});

test('A-07j — déterminisme : deux exécutions identiques', () => {
  const text = words(133, { punctEvery: 9 });
  const a = splitText(text, { maxWordsPerScreen: 25 });
  const b = splitText(text, { maxWordsPerScreen: 25 });
  assert.deepEqual(a.parts, b.parts);
  assert.deepEqual(a.meta, b.meta);
});

test('découpage : mode none renvoie le texte entier', () => {
  const text = words(200);
  const { parts, meta } = splitText(text, { splitMode: 'none' });
  assert.equal(parts.length, 1);
  assert.equal(meta.reason, 'mode-none');
});

test('découpage : mode lignes respecte maxLinesPerScreen', () => {
  const text = Array.from({ length: 7 }, (_, i) => `ligne ${i + 1}`).join('\n');
  const { parts } = splitText(text, { splitBy: 'lines', maxLinesPerScreen: 3 });
  assert.equal(parts.length, 3);
  assert.equal(parts[0].split('\n').length, 3);
});

test('découpage : mode caractères borne la longueur', () => {
  const text = words(40);
  const { parts } = splitText(text, { splitBy: 'chars', maxCharsPerScreen: 60 });
  assert.ok(parts.length > 1);
  for (const part of parts) assert.ok(part.length <= 75, `${part.length} : ${part}`);
});

test('découpage : espaces insécables respectées', () => {
  const text = 'Le Seigneur\u00a0: « Je suis\u00a0» dit-il, puis il partit.';
  const { parts } = splitText(text, { maxWordsPerScreen: 3 });
  for (const part of parts) {
    assert.ok(!part.startsWith(':'), part);
    assert.ok(!part.endsWith('«'), part);
  }
});

test('découpage : un nombre reste collé à son unité', () => {
  const tokens = tokenize('Il y a 1 000 ans et 3 h de marche');
  const joined = tokens.map((t) => t.text);
  assert.ok(joined.includes('1 000'), joined.join(' | '));
  assert.ok(joined.includes('3 h'), joined.join(' | '));
});

test('découpage : entrée vide ou blanche', () => {
  for (const value of ['', '   ', '\n\n', null, undefined]) {
    const result = splitText(value);
    assert.deepEqual(result.parts, []);
    assert.equal(result.meta.count, 0);
  }
});

test('assainissement des annotations : scripts et attributs d’évènement retirés', () => {
  const dirty = '<b onclick="alert(1)">gras</b><script>alert(2)</script><img src=x onerror=alert(3)><a href="javascript:x">lien</a>';
  const clean = sanitizeAnnotationHtml(dirty);
  assert.ok(!/script/i.test(clean), clean);
  assert.ok(!/onclick|onerror/i.test(clean), clean);
  assert.ok(!/<img/i.test(clean), clean);
  assert.match(clean, /<b>gras<\/b>/);
});

test('réglages par défaut conformes au chapitre 09', () => {
  assert.equal(DEFAULT_SETTINGS.maxWordsPerScreen, 25);
  assert.equal(DEFAULT_SETTINGS.minWordsPerPart, 3);
  assert.equal(DEFAULT_SETTINGS.balanceParts, true);
  assert.equal(DEFAULT_SETTINGS.splitBy, 'words');
});
