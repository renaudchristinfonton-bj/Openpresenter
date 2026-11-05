// A-08 → A-08g : navigation dans une sélection (EF-12.29 → EF-12.33).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSelection, navigate, currentItem, partCount, positionLabel,
  stagePreview, actionForKey, isTypingTarget, indexOfVerse
} from '../src/core/bible/navigation.mjs';
import { splitText } from '../src/core/split.mjs';

const verses = [
  { num: 16, text: 'Car Dieu a tant aimé le monde qu\'il a donné son Fils unique.' },
  { num: 17, text: 'Dieu, en effet, n\'a pas envoyé son Fils dans le monde pour qu\'il juge le monde.' },
  { num: 18, text: 'Celui qui croit en lui n\'est point jugé.' }
];

const split = (text) => splitText(text, { maxWordsPerScreen: 8 }).parts;

function selection(overrides = {}) {
  return buildSelection({
    bookNum: 43, bookName: 'Jean', chapter: 3, verses, split, ...overrides
  });
}

test('A-08 — → traverse toutes les parties puis le verset suivant', () => {
  let sel = selection();
  const total = partCount(sel);
  assert.ok(total > 3, `parties : ${total}`);
  const first = currentItem(sel);
  assert.equal(first.verse, 16);
  assert.equal(first.partIndex, 0);

  for (let i = 1; i < total; i++) {
    sel = navigate(sel, 'next').selection;
  }
  assert.equal(sel.index, total - 1);
  assert.equal(currentItem(sel).verse, 18);
});

test('A-08 — au dernier élément, → ne fait rien', () => {
  let sel = selection();
  sel = navigate(sel, 'last').selection;
  const before = sel;
  const result = navigate(sel, 'next');
  assert.equal(result.changed, false);
  assert.equal(result.selection.index, before.index);
});

test('A-08e — au premier élément, ← ne fait rien', () => {
  const sel = selection();
  const result = navigate(sel, 'prev');
  assert.equal(result.changed, false);
  assert.equal(result.selection.index, 0);
});

test('A-08c — Maj+→ va au verset suivant (saute les parties restantes)', () => {
  let sel = selection();
  // On se place au milieu des parties du verset 16.
  const lastPartOf16 = sel.items.filter((it) => it.verse === 16).length - 1;
  assert.ok(lastPartOf16 >= 1);
  sel = navigate(sel, 'nextVerse').selection;
  assert.equal(currentItem(sel).verse, 17);
  assert.equal(currentItem(sel).partIndex, 0);
});

test('A-08d — Maj+← revient à la première partie du verset précédent', () => {
  let sel = selection();
  // avancer jusqu'au verset 18
  while (currentItem(sel).verse !== 18) sel = navigate(sel, 'next').selection;
  sel = navigate(sel, 'prevVerse').selection;
  assert.equal(currentItem(sel).verse, 17);
  assert.equal(currentItem(sel).partIndex, 0);
});

test('A-08 — Ctrl+→ / Ctrl+← demandent un changement de chapitre', () => {
  const sel = selection();
  const next = navigate(sel, 'nextChapter');
  assert.equal(next.chapter.delta, 1);
  assert.equal(next.chapter.verse, 16);
  const prev = navigate(sel, 'prevChapter');
  assert.equal(prev.chapter.delta, -1);
});

test('A-08 — Début / Fin vont au premier et au dernier élément', () => {
  let sel = selection();
  const total = partCount(sel);
  sel = navigate(sel, 'last').selection;
  assert.equal(sel.index, total - 1);
  assert.equal(currentItem(sel).verse, 18);
  sel = navigate(sel, 'first').selection;
  assert.equal(sel.index, 0);
  assert.equal(currentItem(sel).verse, 16);
  assert.equal(currentItem(sel).partIndex, 0);
});

test('A-08 — navigation immuable : la sélection d’origine n’est pas modifiée', () => {
  const sel = selection();
  const rev = sel.rev;
  const after = navigate(sel, 'next').selection;
  assert.equal(sel.index, 0);
  assert.equal(sel.rev, rev);
  assert.equal(after.index, 1);
  assert.equal(after.rev, rev + 1);
});

test('A-08f — les touches sont inactives dans un champ de saisie', () => {
  const input = { tagName: 'INPUT', isContentEditable: false, closest: () => null };
  const textarea = { tagName: 'TEXTAREA', closest: () => null };
  const div = { tagName: 'DIV', closest: () => null };
  const editor = { tagName: 'DIV', closest: (q) => (q.includes('contenteditable') ? {} : null) };
  const editable = { tagName: 'DIV', isContentEditable: true, closest: () => null };
  assert.equal(isTypingTarget(input), true);
  assert.equal(isTypingTarget(textarea), true);
  assert.equal(isTypingTarget(editor), true);
  assert.equal(isTypingTarget(editable), true);
  assert.equal(isTypingTarget(div), false);
  assert.equal(isTypingTarget(null), false);
});

test('A-08b — un clicker USB (PageUp / PageDown) fonctionne sans configuration', () => {
  assert.equal(actionForKey({ key: 'PageDown' }), 'next');
  assert.equal(actionForKey({ key: 'PageUp' }), 'prev');
  // Aucune touche modificatrice : le clicker n'en envoie pas.
  assert.equal(actionForKey({ key: 'PageDown', shiftKey: false, ctrlKey: false }), 'next');
});

test('table des touches du § 9.4.2', () => {
  assert.equal(actionForKey({ key: 'ArrowRight' }), 'next');
  assert.equal(actionForKey({ key: 'ArrowDown' }), 'next');
  assert.equal(actionForKey({ key: ' ' }), 'next');
  assert.equal(actionForKey({ key: 'ArrowLeft' }), 'prev');
  assert.equal(actionForKey({ key: 'ArrowUp' }), 'prev');
  assert.equal(actionForKey({ key: 'ArrowRight', shiftKey: true }), 'nextVerse');
  assert.equal(actionForKey({ key: 'ArrowLeft', shiftKey: true }), 'prevVerse');
  assert.equal(actionForKey({ key: 'ArrowRight', ctrlKey: true }), 'nextChapter');
  assert.equal(actionForKey({ key: 'ArrowLeft', ctrlKey: true }), 'prevChapter');
  assert.equal(actionForKey({ key: 'ArrowRight', metaKey: true }), 'nextChapter');
  assert.equal(actionForKey({ key: 'Home' }), 'first');
  assert.equal(actionForKey({ key: 'End' }), 'last');
  assert.equal(actionForKey({ key: 'Enter' }), 'repeat');
  assert.equal(actionForKey({ key: 'Escape' }), 'clear');
  assert.equal(actionForKey({ key: '3' }), 'verse:3');
  assert.equal(actionForKey({ key: 'a' }), null);
  assert.equal(actionForKey({ key: 'ArrowRight', altKey: true }), null);
});

test('A-08g — deux versions : découpage indépendant, indice borné', () => {
  const short = buildSelection({ bookNum: 43, bookName: 'Jean', chapter: 3, verses: [verses[0]], split: () => ['une seule partie'] });
  const long = selection();
  assert.equal(partCount(short), 1);
  assert.ok(partCount(long) > 1);
  const moved = navigate(short, 'next');
  assert.equal(moved.changed, false);
  assert.equal(moved.selection.index, 0);
});

test('positionLabel : « partie 2 / 3 » et « v. 17 »', () => {
  let sel = selection();
  const multi = sel.items.find((it) => it.partCount > 1);
  assert.ok(multi, 'aucun verset découpé');
  const at = indexOfVerse(sel, multi.verse, 1);
  sel = { ...sel, index: at };
  assert.match(positionLabel(sel), /^partie 2 \/ \d+$/);
  const single = sel.items.findIndex((it) => it.partCount === 1);
  if (single >= 0) {
    assert.match(positionLabel({ ...sel, index: single }), /^v\. \d+$/);
  }
});

test('stagePreview : la partie courante et la suivante', () => {
  const sel = selection();
  const preview = stagePreview(sel);
  assert.equal(preview.current, sel.items[0]);
  assert.equal(preview.next, sel.items[1]);
  assert.equal(preview.total, partCount(sel));
  const atEnd = stagePreview({ ...sel, index: sel.items.length - 1 });
  assert.equal(atEnd.next, null);
});

test('sélection vide : navigation sans erreur', () => {
  const empty = buildSelection({ bookNum: 43, bookName: 'Jean', chapter: 3, verses: [], split });
  assert.equal(partCount(empty), 0);
  assert.equal(currentItem(empty), null);
  assert.equal(navigate(empty, 'next').changed, false);
  assert.equal(positionLabel(empty), '');
});

test('plage de versets : seuls les versets demandés entrent dans la sélection', () => {
  const sel = buildSelection({
    bookNum: 43, bookName: 'Jean', chapter: 3, verses, split, range: { first: 17, last: 18 }
  });
  const nums = [...new Set(sel.items.map((it) => it.verse))];
  assert.deepEqual(nums, [17, 18]);
});
