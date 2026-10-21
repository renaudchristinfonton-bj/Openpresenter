// A-06 → A-06g : saisie clavier de la Bible (EF-12).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntry, STATE, parseReference, parseVerseRange, MESSAGES } from '../src/core/bible/reference.mjs';

/** Comptes de versets simplifiés pour les tests (Jean 3 = 36, Ésaïe 40 = 31). */
function verseCount(bookNum, chapter) {
  if (bookNum === 43 && chapter === 3) return 36;
  if (bookNum === 23 && chapter === 40) return 31;
  if (bookNum === 19 && chapter === 23) return 6;
  return null;
}

/** Rejoue une séquence de frappes comme le ferait l'interface. */
function play(entry, keys) {
  let action = null;
  for (const key of keys) {
    const s = entry.state;
    let result;
    if (key === 'Entrée') result = entry.enter();
    else if (key === 'Espace') result = s.mode === STATE.CHAPTER ? entry.toVerseState() : entry.typeText(' ');
    else if (key === '↓') result = entry.move(1);
    else if (key === '↑') result = entry.move(-1);
    else if (key === 'Échap') result = entry.escape();
    else if (key === 'Retour') result = entry.backspace();
    else if (/^\d$/.test(key)) result = entry.typeDigits(key);
    else if (key === '-' || key === ',' || key === '–') result = entry.typeSeparator(key);
    else result = entry.typeText(key);
    if (result?.action) action = result.action;
    else if (result && typeof result === 'object' && 'action' in result) action = result.action;
  }
  return action;
}

test('A-06 — « j e Entrée 3 Espace 1 6 Entrée » diffuse Jean 3:16', () => {
  const entry = createEntry({ verseCount });
  const action = play(entry, ['j', 'e', 'Entrée', '3', 'Espace', '1', '6', 'Entrée']);
  assert.deepEqual(action, {
    kind: 'range', bookNum: 43, chapter: 3, first: 16, last: 16, preview: false
  });
  // Après diffusion, le champ revient à l'état 1 en conservant le livre (EF-12.20).
  entry.afterBroadcast();
  assert.equal(entry.state.mode, STATE.CHAPTER);
  assert.equal(entry.state.bookNum, 43);
  assert.equal(entry.state.chapterText, '3');
});

test('A-06b — « jn Entrée » sélectionne Jean par abréviation', () => {
  const entry = createEntry({ verseCount });
  play(entry, ['j', 'n', 'Entrée']);
  assert.equal(entry.state.bookNum, 43);
  assert.equal(entry.state.mode, STATE.CHAPTER);
});

test('A-06c — « ésa Entrée 40 Espace 31 Entrée » diffuse Ésaïe 40:31', () => {
  const entry = createEntry({ verseCount });
  const action = play(entry, ['é', 's', 'a', 'Entrée', '4', '0', 'Espace', '3', '1', 'Entrée']);
  assert.deepEqual(action, { kind: 'range', bookNum: 23, chapter: 40, first: 31, last: 31, preview: false });
});

test('A-06d — coller « 1 Corinthiens 13:4-7 » diffuse la plage', () => {
  const entry = createEntry({ verseCount });
  const result = entry.paste('1 Corinthiens 13:4-7');
  assert.deepEqual(result.action, { kind: 'range', bookNum: 46, chapter: 13, first: 4, last: 7 });
  assert.equal(entry.state.bookNum, 46);
  assert.equal(entry.state.mode, STATE.VERSE);
});

test('A-06e — « xyz Entrée » : message d’erreur, champ non vidé', () => {
  const entry = createEntry({ verseCount });
  play(entry, ['x', 'y', 'z']);
  entry.enter();
  assert.equal(entry.state.message, MESSAGES.unknownBook('xyz'));
  assert.equal(entry.state.messageKind, 'error');
  assert.equal(entry.state.query, 'xyz');
  assert.equal(entry.state.mode, STATE.BOOK);
});

test('A-06f — « je ↓ Entrée » sélectionne le deuxième livre de la liste', () => {
  const entry = createEntry({ verseCount });
  play(entry, ['j', 'e']);
  const first = entry.state.suggestions[0];
  const second = entry.state.suggestions[1];
  assert.ok(second, 'au moins deux suggestions pour « je »');
  entry.move(1);
  entry.enter();
  assert.equal(entry.state.bookNum, second.num);
  assert.notEqual(entry.state.bookNum, first?.num === second.num ? -1 : first?.num);
});

test('A-06g — « Jean Entrée 99 » : message de plage de chapitres', () => {
  const entry = createEntry({ verseCount });
  play(entry, ['J', 'e', 'a', 'n', 'Entrée']);
  play(entry, ['9', '9']);
  assert.equal(entry.state.message, MESSAGES.chapterTooHigh('Jean', 21));
  assert.equal(entry.state.messageKind, 'warning');
  // La frappe n'est pas bloquée : l'utilisateur peut corriger.
  assert.equal(entry.state.chapterText, '99');
  entry.backspace();
  assert.equal(entry.state.chapterText, '9');
  assert.equal(entry.state.message, null);
});

test('saisie : accents et casse indifférents (EF-12.5)', () => {
  for (const query of ['esa', 'ésa', 'ESA', 'Ésa', 'esai']) {
    const entry = createEntry({ verseCount });
    for (const ch of query) entry.typeText(ch);
    assert.equal(entry.state.suggestions[0]?.num, 23, `échec pour « ${query} »`);
  }
});

test('saisie : au plus 8 suggestions, la première est en surbrillance (EF-12.7/12.8)', () => {
  const entry = createEntry({ verseCount });
  entry.typeText('a');
  assert.ok(entry.state.suggestions.length <= 8);
  assert.equal(entry.state.highlight, 0);
});

test('saisie : pertinence — préfixe exact avant inclusion', () => {
  const entry = createEntry({ verseCount });
  for (const ch of 'jea') entry.typeText(ch);
  assert.equal(entry.state.suggestions[0].num, 43, JSON.stringify(entry.state.suggestions.map((s) => s.name)));
  assert.equal(entry.state.suggestions[0].match, 'prefix');
});

test('saisie : ↑↓ circulaires dans la liste', () => {
  const entry = createEntry({ verseCount });
  entry.typeText('a');
  const count = entry.state.suggestions.length;
  entry.move(-1);
  assert.equal(entry.state.highlight, count - 1);
  entry.move(1);
  assert.equal(entry.state.highlight, 0);
});

test('saisie : Entrée sans chapitre → message explicite (TXT-061)', () => {
  const entry = createEntry({ verseCount });
  play(entry, ['j', 'e', 'a', 'n', 'Entrée']);
  entry.enter();
  assert.equal(entry.state.message, MESSAGES.chapterMissing());
  assert.equal(entry.state.mode, STATE.CHAPTER);
});

test('saisie : Entrée avec un chapitre seul diffuse le chapitre entier', () => {
  const entry = createEntry({ verseCount });
  play(entry, ['j', 'e', 'a', 'n', 'Entrée', '3', 'Entrée']);
  assert.equal(entry.state.mode, STATE.CHAPTER);
});

test('saisie : Échap recule d’un état sans perdre le parcours', () => {
  const entry = createEntry({ verseCount });
  play(entry, ['j', 'e', 'a', 'n', 'Entrée', '3', 'Espace']);
  assert.equal(entry.state.mode, STATE.VERSE);
  entry.escape();
  assert.equal(entry.state.mode, STATE.CHAPTER);
  entry.escape();
  assert.equal(entry.state.mode, STATE.BOOK);
  assert.equal(entry.state.bookNum, null);
});

test('saisie : Retour arrière en état 1 vide le chapitre puis revient au livre', () => {
  const entry = createEntry({ verseCount });
  play(entry, ['j', 'e', 'a', 'n', 'Entrée', '3']);
  entry.backspace();
  assert.equal(entry.state.mode, STATE.CHAPTER);
  entry.backspace();
  assert.equal(entry.state.mode, STATE.BOOK);
});

test('saisie : plage de versets trop large refusée (200 max)', () => {
  const entry = createEntry({ verseCount: () => 400 });
  play(entry, ['j', 'e', 'a', 'n', 'Entrée', '3', 'Espace', '1', '-', '3', '0', '0', 'Entrée']);
  assert.match(entry.state.message, /^Plage trop large \(200 versets maximum\)\.$/);
});

test('saisie : verset hors limites refusé avec les bornes (TXT-063)', () => {
  const entry = createEntry({ verseCount });
  play(entry, ['j', 'e', 'a', 'n', 'Entrée', '3', 'Espace', '4', '2', 'Entrée']);
  assert.equal(entry.state.message, 'Jean 3 ne contient pas de verset 42 (1 à 36).');
  assert.equal(entry.state.verseText, '42');
});

test('saisie : plage partiellement hors limites tronquée avec avertissement (TXT-059)', () => {
  const entry = createEntry({ verseCount });
  const result = entry.paste('Jean 3:30-45');
  assert.equal(result.action.last, 36);
  assert.equal(result.message, 'Versets 30 à 36 affichés (le chapitre s’arrête à 36).'.replace('’', "'"));
});

test('saisie : après diffusion, le champ est vidé mais le livre conservé', () => {
  const entry = createEntry({ verseCount });
  play(entry, ['j', 'e', 'a', 'n', 'Entrée', '3', 'Espace', '1', '6']);
  entry.enter();
  assert.equal(entry.state.verseText, '');
  entry.afterBroadcast();
  assert.equal(entry.state.chapterText, '3');
  assert.equal(entry.state.verseText, '');
});

test('saisie : Maj+Entrée conserve l’état 2 (aperçu sans diffusion)', () => {
  const entry = createEntry({ verseCount });
  play(entry, ['j', 'e', 'a', 'n', 'Entrée', '3', 'Espace', '1', '6']);
  const result = entry.enter({ preview: true });
  assert.equal(result.action.preview, true);
  assert.equal(entry.state.mode, STATE.VERSE);
});

test('libellé du champ : « Jean ▸ 3 16 »', () => {
  const entry = createEntry({ verseCount });
  play(entry, ['j', 'e', 'a', 'n', 'Entrée', '3', 'Espace', '1', '6']);
  assert.equal(entry.label, 'Jean ▸ 3 16');
});

// ---------------------------------------------------------------------------
// Analyse de références (fonctions pures)
// ---------------------------------------------------------------------------

test('parseReference : formes acceptées', () => {
  const cases = [
    ['Jean 3:16', { bookNum: 43, chapter: 3, first: 16, last: 16 }],
    ['Jean 3.16', { bookNum: 43, chapter: 3, first: 16, last: 16 }],
    ['Jean 3 16', { bookNum: 43, chapter: 3, first: 16, last: 16 }],
    ['1 Corinthiens 13:4-7', { bookNum: 46, chapter: 13, first: 4, last: 7 }],
    ['1 co 13:4', { bookNum: 46, chapter: 13, first: 4, last: 4 }],
    ['Ps 23', { bookNum: 19, chapter: 23, first: undefined }],
    ['ésaïe 40:31', { bookNum: 23, chapter: 40, first: 31, last: 31 }],
    ['jn 3:16-18', { bookNum: 43, chapter: 3, first: 16, last: 18 }]
  ];
  for (const [input, expected] of cases) {
    const parsed = parseReference(input);
    assert.ok(parsed, `non reconnu : ${input}`);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(parsed[key], value, `${input} → ${key}`);
    }
  }
});

test('parseReference : formes refusées', () => {
  for (const input of ['', 'xyz', 'Jean', '3:16', 'Jean trois:16']) {
    assert.equal(parseReference(input), null, `accepté à tort : ${input}`);
  }
});

test('parseVerseRange : formes tolérées du § 9.3.5', () => {
  assert.deepEqual(parseVerseRange('16'), { first: 16, last: 16 });
  assert.deepEqual(parseVerseRange('16-18'), { first: 16, last: 18 });
  assert.deepEqual(parseVerseRange('16 - 18'), { first: 16, last: 18 });
  assert.deepEqual(parseVerseRange('16–18'), { first: 16, last: 18 });
  assert.deepEqual(parseVerseRange('16 18'), { first: 16, last: 18 });
  assert.deepEqual(parseVerseRange('16,18'), { first: 16, last: 18 });
  assert.deepEqual(parseVerseRange('16,'), { first: 16, last: 16 });
  // EF-12.17 : inversion silencieuse.
  assert.deepEqual(parseVerseRange('18-16'), { first: 16, last: 18 });
  assert.equal(parseVerseRange(''), null);
  assert.equal(parseVerseRange('abc'), null);
});
