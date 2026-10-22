// Tests des chants : import, sections, arrangements, navigation (EF-15, ch. 10).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectFormat, parseSongText, importSummary, sectionHeader, isChordLine,
  stripInlineChords, SECTION_TYPES, SECTION_LABELS
} from '../src/core/songs/parser.mjs';
import {
  buildSongSelection, navigateSong, currentSongItem, atEnd, goToStep,
  switchArrangement, appendChorus, repeatCurrentStep, skipCurrentStep,
  duplicateSection, renameSection, addArrangement, songPositionLabel,
  transposeChord, transposeSectionChords, chordLinesForSection, splitSection,
  defaultArrangement, activeArrangement
} from '../src/core/songs/arrangement.mjs';
import { renderScene } from '../src/core/render/engine.mjs';
import { contentFromPayload, resolveBind, BINDS } from '../src/core/render/content.mjs';
import { sceneFromPreset } from '../src/core/scene.mjs';

// Chant ChordPro de référence : 6 sections, 3 accords distincts (A-12f).
const CHORDPRO = `{title: Grâce infinie}
{artist: John Newton}
{key: G}
{tempo: 72}

Couplet 1
[G]Grâce infinie, quel doux [C]son
Qui a sauvé un misérable [G]comme moi

Refrain
[G]J'étais perdu, mais je suis [D]retrouvé
[C]J'étais aveugle, mais maintenant [G]je vois

Couplet 2
[G]C'est la grâce qui m'a [C]appris
À craindre Dieu et [G]à croire

Couplet 3
[G]Bien des dangers, bien des [C]peines
J'ai déjà [G]traversés

Pont
[G]Quand nous aurons chanté [D]dix mille ans
[C]Comme au premier jour [G]nous chanterons

Refrain final
[G]J'étais perdu, mais je suis [D]retrouvé`;

function song() {
  return { ...parseSongText(CHORDPRO, { filename: 'grace.txt' }), id: 'sng_grace001' };
}

test('EF-15.1 : le format est détecté sans le demander', () => {
  assert.equal(detectFormat(CHORDPRO), 'chordpro');
  assert.equal(detectFormat('{title: Test}\n\nCouplet\nParoles'), 'chordpro');
  assert.equal(detectFormat('[G]Paroles'), 'chordpro');
  assert.equal(detectFormat('<?xml version="1.0"?><song><title>X</title></song>'), 'opensong');
  assert.equal(detectFormat('CCLI Song #1234567\nGrâce infinie\n\nCouplet 1\nParoles'), 'ccli');
  assert.equal(detectFormat('Couplet 1\nDe simples paroles\nsans accords'), 'text');
});

test('A-12f (chants) : un ChordPro donne titre, sections et accords', () => {
  const s = song();
  assert.equal(s.title, 'Grâce infinie');
  assert.equal(s.format, 'chordpro');
  assert.equal(s.artist, 'John Newton');
  assert.equal(s.key, 'G');
  assert.equal(s.tempo, 72);

  // 6 sections : 3 couplets, 2 refrains, 1 pont.
  assert.equal(s.sections.length, 6, s.sections.map((x) => x.name).join(', '));
  assert.deepEqual(s.sections.map((x) => x.type),
    ['verse', 'chorus', 'verse', 'verse', 'bridge', 'chorus']);
  assert.deepEqual(s.sections.map((x) => x.name),
    ['Couplet 1', 'Refrain', 'Couplet 2', 'Couplet 3', 'Pont', 'Refrain final']);

  // Les accords sont retirés du texte et conservés à part.
  assert.ok(!s.sections[0].lines.join(' ').includes('['));
  assert.equal(s.sections[0].lines[0], 'Grâce infinie, quel doux son');
  const chords = new Set(Object.values(s.chords).flat().map(([chord]) => chord));
  assert.deepEqual([...chords].sort(), ['C', 'D', 'G']);

  // Chaque décalage tombe sur un caractère existant de la section.
  for (const [sectionId, entries] of Object.entries(s.chords)) {
    const section = s.sections.find((x) => x.id === sectionId);
    const text = section.lines.join('\n');
    for (const [, offset] of entries) {
      assert.ok(offset >= 0 && offset <= text.length, `${sectionId} offset ${offset}/${text.length}`);
    }
  }

  const summary = importSummary(s);
  assert.equal(summary.sections, 6);
  assert.equal(summary.hasChords, true);
  assert.deepEqual(summary.chords.sort(), ['C', 'D', 'G']);
  assert.equal(summary.metadata.artist, 'John Newton');
});

test('EF-15.4 : les lignes vides séparent les sections et la mise en forme est gardée', () => {
  const s = parseSongText('Couplet 1\nPremière ligne\nDeuxième ligne\n\nRefrain\nOh oh oh');
  assert.equal(s.sections.length, 2);
  assert.deepEqual(s.sections[0].lines, ['Première ligne', 'Deuxième ligne']);
  assert.equal(s.sections[1].type, 'chorus');
});

test('EF-15.7 : une ligne vide interne à une section est conservée', () => {
  const s = parseSongText('{title: Test}\nCouplet 1\nLigne un\n\nLigne deux après un blanc\n\nRefrain\nRefrain ici');
  assert.equal(s.sections.length, 2);
  assert.deepEqual(s.sections[0].lines, ['Ligne un', '', 'Ligne deux après un blanc']);
});

test('EF-15.3 : sectionHeader reconnaît les en-têtes usuels et ignore les paroles', () => {
  const cases = {
    'Couplet 1': 'verse',
    'Couplet': 'verse',
    'V2': 'verse',
    'Refrain': 'chorus',
    'REFRAIN 2': 'chorus',
    'C': 'chorus',
    'Pré-refrain': 'prechorus',
    'Pre-chorus': 'prechorus',
    'Pont': 'bridge',
    'B': 'bridge',
    'Intro': 'intro',
    'Fin': 'outro',
    'Tag': 'tag'
  };
  for (const [line, type] of Object.entries(cases)) {
    assert.equal(sectionHeader(line)?.type, type, line);
  }
  // Des paroles ne doivent jamais devenir un en-tête.
  for (const line of [
    'Car Dieu a tant aimé le monde',
    "C'est fini, tout est accompli",
    'Viens, Seigneur, viens',
    'Refrain de ma vie entière, je chanterai',
    'Bien des dangers, bien des peines'
  ]) {
    assert.equal(sectionHeader(line), null, line);
  }
});

test('un nom explicite de section est conservé, un type inconnu retombe sur couplet', () => {
  const s = parseSongText('{title: X}\nCouplet 2 (final)\nParoles ici\n\nRefrain\nOh');
  assert.equal(s.sections[0].name, 'Couplet 2 (final)');
  assert.equal(s.sections[0].type, 'verse');
  for (const section of s.sections) assert.ok(SECTION_TYPES.includes(section.type));
  assert.equal(SECTION_LABELS.chorus, 'Refrain');
});

test('EF-15.8 : un chant importé a toujours un arrangement « Ordre standard »', () => {
  const s = song();
  assert.equal(s.arrangements.length, 1);
  const [arrangement] = s.arrangements;
  assert.equal(arrangement.id, 'arr_default');
  assert.equal(arrangement.name, 'Ordre standard');
  assert.deepEqual(arrangement.order, s.sections.map((section) => section.id));
  assert.deepEqual(activeArrangement(s), arrangement);
  // Sans arrangements (donnée ancienne), un ordre est reconstruit.
  assert.deepEqual(defaultArrangement(s.sections).order, arrangement.order);
});

test('les identifiants respectent les schémas du disque', () => {
  const s = song();
  assert.match(s.id ?? 'sng_grace001', /^sng_[a-z0-9_]{2,40}$/);
  for (const section of s.sections) assert.match(section.id, /^sec_[a-z0-9_]{1,30}$/);
  for (const arrangement of s.arrangements) assert.match(arrangement.id, /^arr_[a-z0-9_]{1,30}$/);
});

test('EF-15.5 / EF-15.6 : renommer garde l’identifiant, dupliquer crée une section', () => {
  const s = song();
  const renamed = renameSection(s, 'sec_1', 'Couplet d’ouverture');
  assert.equal(renamed.sections[0].id, 'sec_1');
  assert.equal(renamed.sections[0].name, 'Couplet d’ouverture');

  const { song: copied, changed, sectionId } = duplicateSection(s, 'sec_1');
  assert.equal(changed, true);
  assert.equal(copied.sections.length, s.sections.length + 1);
  assert.equal(copied.sections[1].name, 'Couplet 1 (copie)');
  assert.equal(copied.sections[1].id, sectionId);
  assert.notEqual(sectionId, 'sec_1');
  // La copie est insérée dans l'ordre, juste après sa source.
  assert.deepEqual(copied.arrangements[0].order.slice(0, 2), ['sec_1', sectionId]);
  assert.deepEqual(copied.sections[1].lines, s.sections[0].lines);
});

test('le découpage conserve les lignes et respecte maxWordsPerScreen', () => {
  const section = { lines: ['Ligne courte', 'Une autre ligne courte'] };
  assert.deepEqual(splitSection(section, { maxWordsPerScreen: 20 }), ['Ligne courte\nUne autre ligne courte']);
  const tight = splitSection(section, { maxWordsPerScreen: 3 });
  assert.equal(tight.length, 2);
  assert.equal(tight[0], 'Ligne courte');
});

test('une ligne très longue est découpée par le moteur commun de la Bible', () => {
  const long = Array.from({ length: 40 }, (_, i) => `mot${i}`).join(' ');
  const parts = splitSection({ lines: [long] }, { maxWordsPerScreen: 10 });
  assert.ok(parts.length >= 4, String(parts.length));
  assert.equal(parts.join(' ').replace(/\s+/g, ' ').trim(), long);
});

test('la sélection est plate : une étape par section de l’arrangement', () => {
  const s = song();
  const selection = buildSongSelection(s, { settings: { maxWordsPerScreen: 20 } });
  assert.equal(selection.songId, s.id);
  assert.equal(selection.title, s.title);
  assert.equal(selection.arrangementId, 'arr_default');
  assert.equal(selection.steps.length, 6);
  assert.equal(selection.items.length, 6);
  assert.equal(selection.index, 0);
  assert.equal(currentSongItem(selection).sectionName, 'Couplet 1');
  assert.match(songPositionLabel(selection), /^1\/6 Couplet 1/);
});

test('EF-15.11 : une même section peut revenir plusieurs fois dans l’arrangement', () => {
  const s = song();
  const selection = buildSongSelection({
    ...s,
    arrangements: [{ id: 'arr_default', name: 'Ordre standard', order: ['sec_1', 'sec_2', 'sec_1', 'sec_2'] }]
  });
  assert.equal(selection.steps.length, 4);
  assert.deepEqual(selection.steps.map((step) => step.type), ['verse', 'chorus', 'verse', 'chorus']);
  // Même section, deux étapes distinctes : la navigation reste sans ambiguïté.
  assert.equal(selection.items[0].sectionId, selection.items[2].sectionId);
  assert.notEqual(selection.items[0].step, selection.items[2].step);
});

test('A-12i (chants) : arriver à la fin ne dépasse pas et le dit', () => {
  const s = song();
  let selection = buildSongSelection(s);
  for (let i = 0; i < selection.items.length - 1; i++) {
    const result = navigateSong(selection, 'next');
    assert.equal(result.changed, true);
    assert.equal(result.ended, false);
    selection = result.selection;
  }
  assert.equal(atEnd(selection), true);
  const over = navigateSong(selection, 'next');
  assert.equal(over.changed, false);
  assert.equal(over.ended, true);
  assert.equal(over.selection.index, selection.items.length - 1);
  assert.equal(over.message, `Fin du chant « ${s.title} ».`);
  // Revenir en arrière fonctionne toujours après le message de fin.
  assert.equal(navigateSong(selection, 'prev').selection.index, selection.items.length - 2);
});

test('navigation par section (Maj + flèches) et accès direct 1…9', () => {
  const s = song();
  const selection = buildSongSelection(s);
  const next = navigateSong(selection, 'sectionNext');
  assert.equal(next.selection.index, 1);
  assert.equal(currentSongItem(next.selection).sectionName, 'Refrain');
  const back = navigateSong(next.selection, 'sectionPrev');
  assert.equal(back.selection.index, 0);
  // Aux bornes, on reste sur place.
  assert.equal(navigateSong(selection, 'sectionPrev').changed, false);

  const fourth = goToStep(selection, 4);
  assert.equal(currentSongItem(fourth).sectionName, 'Couplet 3');
  assert.equal(goToStep(selection, 9).index, 0, 'une étape inexistante ne bouge pas');
});

test('A-12h (chants) : changer d’arrangement au refrain reste sur un refrain', () => {
  const s = song();
  // Un second arrangement qui commence par un couplet et place le refrain plus loin.
  const withTwo = addArrangement(s, 'Version courte', ['sec_3', 'sec_2', 'sec_5']);
  const selection = buildSongSelection(withTwo);
  // On se place sur le refrain (étape 2).
  const atChorus = goToStep(selection, 2);
  assert.equal(currentSongItem(atChorus).sectionType, 'chorus');

  const switched = switchArrangement(atChorus, withTwo, withTwo.arrangements[1].id);
  const item = currentSongItem(switched.selection);
  assert.equal(item.sectionType, 'chorus', 'toujours sur un refrain');
  assert.equal(switched.selection.arrangementId, withTwo.arrangements[1].id);
  assert.equal(switched.selection.steps.length, 3);

  // Depuis un couplet, on retrouve la même section.
  const atVerse = goToStep(selection, 3);
  assert.equal(currentSongItem(atVerse).sectionType, 'verse');
  const back = switchArrangement(atVerse, withTwo, withTwo.arrangements[1].id);
  assert.equal(currentSongItem(back.selection).sectionId, currentSongItem(atVerse).sectionId);
});

test('EF-15.13 : boutons rapides du conducteur', () => {
  const s = song();
  const selection = buildSongSelection(s);
  const atSecond = goToStep(selection, 2);

  const repeated = repeatCurrentStep(s, atSecond);
  assert.equal(repeated.changed, true);
  assert.deepEqual(repeated.song.arrangements[0].order.slice(0, 3), ['sec_1', 'sec_2', 'sec_2']);

  const skipped = skipCurrentStep(s, atSecond);
  assert.equal(skipped.changed, true);
  assert.deepEqual(skipped.song.arrangements[0].order.slice(0, 2), ['sec_1', 'sec_3']);

  const appended = appendChorus(s);
  assert.equal(appended.changed, true);
  assert.equal(appended.song.arrangements[0].order.at(-1), 'sec_2', 'le dernier ajouté est un refrain');

  // Une seule étape : la sauter est refusé (on ne vide pas un arrangement).
  const single = { ...s, arrangements: [{ id: 'arr_default', name: 'Seul', order: ['sec_1'] }] };
  const onlyOne = buildSongSelection(single);
  assert.deepEqual(skipCurrentStep(single, onlyOne).changed, false);
  assert.equal(skipCurrentStep(single, onlyOne).reason, 'last-step');
});

test('EF-15.14 : une modification d’arrangement est immédiate dans la sélection', () => {
  const s = song();
  const before = buildSongSelection(s);
  const longer = repeatCurrentStep(s, before).song;
  const after = buildSongSelection(longer);
  assert.equal(after.items.length, before.items.length + 1);
  assert.equal(after.steps.length, before.steps.length + 1);
});

test('un chant sans refrain n’a rien à ajouter (message clair, pas d’exception)', () => {
  const s = parseSongText('{title: Sans refrain}\nCouplet 1\nUne ligne');
  const result = appendChorus(s);
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'no-chorus');
});

test('EF-15.2 / EF-15.17 : les métadonnées restent dans le contrôleur', () => {
  const s = song();
  // Aucune liaison de scène ne projette les métadonnées d'import.
  assert.ok(!BINDS.includes('ccli'));
  assert.ok(!BINDS.includes('copyright'));
  const payload = contentFromPayload({ text: 'Paroles', title: s.title }, 'songs');
  assert.equal(payload.lyrics, 'Paroles');
  assert.equal(resolveBind('lyrics', { bind: 'lyrics' }, payload), 'Paroles');
  assert.equal(resolveBind('ref', { bind: 'ref' }, payload), '', 'aucune référence par défaut');
});

test('EF-15.24 → EF-15.26 : les accords sont positionnés en caractères, jamais projetés', async () => {
  const s = song();
  const lines = chordLinesForSection(s, 'sec_1');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, 'Grâce infinie, quel doux son');
  assert.deepEqual(lines[0].chords, [
    { chord: 'G', column: 0 },
    { chord: 'C', column: 25 }
  ]);

  // Aucune liaison `chords` : une sortie ne peut pas les afficher (EF-15.25).
  assert.ok(!BINDS.includes('chords'));
  const scene = sceneFromPreset({ id: 'scn_songs_test', name: 'Chants', kind: 'songs', preset: 'full' });
  const content = contentFromPayload({ text: lines[0].text, reference: s.title }, 'songs');
  const { html } = renderScene({ scene, content });
  assert.ok(html.includes('Grâce infinie, quel doux son'));
  assert.ok(!/class="[^"]*chord/.test(html), 'aucun élément d’accord dans le rendu');
});

test('EF-15.27 : transposition sans modifier la source', () => {
  assert.equal(transposeChord('G', 2), 'A');
  assert.equal(transposeChord('G', -1), 'Gb');
  assert.equal(transposeChord('Bm', -2), 'Am');
  assert.equal(transposeChord('D/F#', 1), 'Eb/G');
  assert.equal(transposeChord('C', 12), 'C');
  assert.equal(transposeChord('nawak', 3), 'nawak');

  const s = song();
  const shifted = transposeSectionChords(s, 'sec_1', 2);
  assert.deepEqual(shifted.map(([chord]) => chord), ['A', 'D', 'A']);
  // La source n'a pas bougé.
  assert.deepEqual(s.chords.sec_1.map(([chord]) => chord), ['G', 'C', 'G']);
});

test('un texte brut : le titre vient de la première ligne, les crédits des métadonnées', () => {
  const s = parseSongText('Tu es saint\nPar: Jean Koffi\n\nCouplet 1\nTu es saint, tu es saint\n\nRefrain\nSaint, saint, saint');
  assert.equal(s.title, 'Tu es saint');
  assert.equal(s.composer, 'Jean Koffi');
  assert.equal(s.sections.length, 2);
  assert.equal(s.format, 'text');
});

test('un export OpenSong est lu sans bibliothèque XML', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<song>
  <title>Grâce infinie</title>
  <author>John Newton</author>
  <key>G</key>
  <copyright>Domaine public</copyright>
  <lyrics>
    <![CDATA[Couplet 1
G           C
Grâce infinie, quel doux son

Refrain
G
J'étais perdu]]>
  </lyrics>
</song>`;
  const s = parseSongText(xml, { filename: 'grace.xml' });
  assert.equal(s.format, 'opensong');
  assert.equal(s.title, 'Grâce infinie');
  assert.equal(s.artist, 'John Newton');
  assert.equal(s.copyright, 'Domaine public');
  assert.equal(s.sections.length, 2);
  assert.equal(s.sections[0].type, 'verse');
  assert.equal(s.sections[1].type, 'chorus');
  assert.ok(!s.sections[0].lines.some((line) => isChordLine(line) && line.trim()), 'les lignes d’accords ne sont pas chantées');
  assert.ok(Object.keys(s.chords).length >= 1, 'les accords sont récupérés');
});

test('un export CCLI récupère le titre, le numéro et les sections', () => {
  const s = parseSongText(`CCLI Song #7154321
Grâce infinie
John Newton

Couplet 1
Grâce infinie, quel doux son
Qui a sauvé un misérable comme moi

Refrain
J'étais perdu, mais je suis retrouvé`);
  assert.equal(s.format, 'ccli');
  assert.equal(s.title, 'Grâce infinie');
  assert.equal(s.ccli, '7154321');
  assert.equal(s.sections.length, 2);
});

test('stripInlineChords garde les positions exactes', () => {
  assert.deepEqual(stripInlineChords('[G]Grâce [C]infinie'), {
    text: 'Grâce infinie',
    chords: [{ chord: 'G', index: 0 }, { chord: 'C', index: 6 }]
  });
  assert.deepEqual(stripInlineChords('sans accord'), { text: 'sans accord', chords: [] });
});

test('un contenu vide ne produit pas de scène cassée', () => {
  const s = parseSongText('');
  assert.equal(s.sections.length, 1, 'une section de repli');
  assert.equal(s.arrangements.length, 1);
  assert.equal(s.title, 'Chant sans titre');
  const selection = buildSongSelection(s);
  assert.equal(selection.items.length, 1);
  assert.equal(navigateSong(selection, 'next').ended, true);
});

test('la sélection d’un chant vide ne lève pas d’exception', () => {
  const empty = buildSongSelection({ id: 'sng_vide', title: 'Vide', sections: [], arrangements: [] });
  assert.equal(empty.items.length, 0);
  assert.equal(currentSongItem(empty), null);
  assert.equal(navigateSong(empty, 'next').changed, false);
  assert.equal(songPositionLabel(empty), '');
  assert.equal(atEnd(empty), false);
});
