// Import d'une version biblique (EF-11.1 → EF-11.10, § 9.2 du cahier des charges).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { freshProject, cleanup, freePort, startServer, json } from './helpers.mjs';
import { ensureProject } from '../src/core/project.mjs';
import { detectFormat, parseBibleXml } from '../src/core/bible/formats.mjs';
import { suggestAbbreviation } from '../src/core/bible/importer.mjs';

const BEBLIA = `<?xml version="1.0" encoding="utf-8"?>
<XMLBIBLE biblename="Bible de test">
  <INFORMATION>
    <language>fr</language>
  </INFORMATION>
  <BIBLEBOOK bnumber="1" bname="Genèse">
    <CHAPTER cnumber="1">
      <VERS vnumber="1">Au commencement, Dieu créa les cieux et la terre.</VERS>
      <VERS vnumber="2">La terre était informe et vide.</VERS>
    </CHAPTER>
    <CHAPTER cnumber="2">
      <VERS vnumber="1">Ainsi furent achevés les cieux et la terre.</VERS>
    </CHAPTER>
  </BIBLEBOOK>
  <BIBLEBOOK bnumber="43" bname="Jean">
    <CHAPTER cnumber="3">
      <VERS vnumber="16">Car Dieu a tant aimé le monde qu'il a donné son Fils unique.</VERS>
    </CHAPTER>
  </BIBLEBOOK>
</XMLBIBLE>`;

async function boot() {
  const { base: folder, dir } = await freshProject();
  await ensureProject({ name: 'Bible' });
  const srv = await startServer({ projectDir: dir, port: await freePort() });
  return { base: srv.base, dir, srv, folder };
}

test('les quatre formats du § 9.2.1 sont détectés automatiquement (EF-11.4)', () => {
  assert.equal(detectFormat(BEBLIA), 'beblia');
  assert.equal(detectFormat('<XMLBIBLE><INFORMATION><BIBLEVERSIONS/></INFORMATION>'
    + '<BIBLEBOOK bnumber="1"><CHAPTER cnumber="1"><VERS vnumber="1">x</VERS></CHAPTER></BIBLEBOOK></XMLBIBLE>'),
  'zefania');
  assert.equal(detectFormat('<osis><osisText><div type="book" osisID="Gen"><chapter osisID="Gen.1">'
    + '<verse osisID="Gen.1.1">Au commencement.</verse></chapter></div></osisText></osis>'), 'osis');
  assert.equal(detectFormat('<usfx><book id="GEN"><c id="1"/><v id="1"/>Au commencement.</book></usfx>'), 'usfx');
  assert.equal(detectFormat('<html><body>Bonjour</body></html>'), null);
});

test('l’analyse donne livres, chapitres, versets et un aperçu (EF-11.1 → EF-11.3)', () => {
  const parsed = parseBibleXml(BEBLIA);
  assert.equal(parsed.format, 'beblia');
  assert.equal(parsed.label, 'Beblia XML');
  assert.equal(parsed.language, 'fr');
  assert.deepEqual(parsed.counts, { books: 2, chapters: 3, verses: 4 });
  assert.equal(parsed.preview.reference, 'Genèse 1:1');
  assert.match(parsed.preview.text, /Au commencement/);
  assert.deepEqual(parsed.books.map((b) => b.num), [1, 43]);
});

test('OSIS : les codes de livre deviennent les numéros canoniques', () => {
  const parsed = parseBibleXml(`<osis><osisText><header><work><title>LSG</title></work></header>
    <div type="book" osisID="Ps"><chapter osisID="Ps.23"><verse osisID="Ps.23.1">L'Éternel est mon berger.</verse></chapter></div>
    <div type="book" osisID="John"><chapter osisID="John.3"><verse osisID="John.3.16">Car Dieu a tant aimé.</verse></chapter></div>
  </osisText></osis>`);
  assert.deepEqual(parsed.books.map((b) => b.num), [19, 43]);
  assert.equal(parsed.books[0].name, 'Psaumes');
  assert.equal(parsed.name, 'LSG');
});

test('un fichier non reconnu renvoie le message du § 9.2.1 (EF-11.5)', async () => {
  const { base, srv, folder } = await boot();
  try {
    const res = await json(base, '/api/bible/import/preview', {
      method: 'POST', body: { text: '<html>non</html>', filename: 'notes.xml' }
    });
    assert.equal(res.status, 422);
    assert.equal(res.data.error.code, 'UNSUPPORTED_FORMAT');
    assert.match(res.data.error.message, /Formats acceptés : Beblia XML, Zefania XML, OSIS, USFX/);
    assert.match(res.data.error.message, /Beblia\/Holy-Bible-XML-Format/);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('import : copie de la source, index de versets, sélection utilisable', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const preview = await json(base, '/api/bible/import/preview', {
      method: 'POST', body: { text: BEBLIA, filename: 'bible-test.xml' }
    });
    assert.equal(preview.status, 200);
    assert.equal(preview.data.preview.counts.verses, 4);
    assert.equal(preview.data.preview.formatLabel, 'Beblia XML');
    // Aperçu sans écriture (étape 4) : rien n'est encore sur le disque.
    const before = await fs.readdir(path.join(dir, 'library', 'bibles'));
    assert.ok(!before.some((f) => f.startsWith('bible_bible_de_test')));

    const imported = await json(base, '/api/bible/import', {
      method: 'POST',
      body: { text: BEBLIA, filename: 'bible-test.xml', name: 'Bible de test', license: 'Domaine public' }
    });
    assert.equal(imported.status, 201, JSON.stringify(imported.data));
    const id = imported.data.bible.id;
    assert.match(id, /^bible_[a-z0-9_]{2,40}$/);
    assert.equal(imported.data.bible.counts.verses, 4);
    assert.equal(imported.data.bible.abbreviation.length <= 6, true);

    // EF-11.9 : le fichier d'origine est dans `assets/bibles/`.
    const asset = imported.data.bible.source;
    assert.equal(asset.format, 'beblia');
    assert.ok(asset.sha256, 'empreinte enregistrée');
    const index = JSON.parse(await fs.readFile(path.join(dir, 'assets', 'index.json'), 'utf8'));
    const entry = Object.values(index.assets).find((a) => a.sha256 === asset.sha256);
    assert.ok(entry, 'fichier source indexé');
    assert.match(entry.path, /^bibles\//);

    const verses = JSON.parse(await fs.readFile(path.join(dir, 'library', 'bibles', `${id}.verses.json`), 'utf8'));
    const chapter = verses.chapters.find((c) => c.b === 43 && c.c === 3);
    // Le verset 16 de la source reste le 16ᵉ : les trous de numérotation sont comblés.
    assert.equal(chapter.v[15].includes('tant aimé'), true);
    assert.equal(chapter.v[0], '…');
    assert.equal(imported.data.bible.counts.verses, 4, 'les trous ne comptent pas comme des versets');

    // Le studio peut lire la sélection dans la nouvelle version.
    const selection = await json(base, `/api/bible/selection?bible=${id}&book=43&chapter=3&first=16`);
    assert.equal(selection.status, 200);
    assert.match(JSON.stringify(selection.data), /Fils unique/);

    // La version importée devient la version par défaut du projet.
    const project = JSON.parse(await fs.readFile(path.join(dir, 'project.json'), 'utf8'));
    assert.equal(project.settings.defaultBibleId, id);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('réimporter le même fichier ne crée pas de doublon (EF-11.10)', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const first = await json(base, '/api/bible/import', { method: 'POST', body: { text: BEBLIA, name: 'Bible de test' } });
    assert.equal(first.status, 201);
    const second = await json(base, '/api/bible/import', { method: 'POST', body: { text: BEBLIA, name: 'Bible de test' } });
    assert.equal(second.status, 200);
    assert.equal(second.data.created, false);
    assert.equal(second.data.deduplicated, true);
    assert.equal(second.data.bible.id, first.data.bible.id);
    const files = (await fs.readdir(path.join(dir, 'library', 'bibles'))).filter((f) => !f.includes('.verses.'));
    assert.equal(files.filter((f) => f.startsWith('bible_bible_de_test')).length, 1);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('renommer et supprimer une version (EF-11.6, EF-11.7)', async () => {
  const { base, srv, folder } = await boot();
  try {
    const imported = await json(base, '/api/bible/import', { method: 'POST', body: { text: BEBLIA, name: 'Bible de test' } });
    const id = imported.data.bible.id;

    const renamed = await json(base, `/api/bible/versions/${id}`, {
      method: 'PUT', body: { name: 'Segond de test', abbreviation: 'SGT' }
    });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.data.bible.name, 'Segond de test');
    assert.equal(renamed.data.bible.abbreviation, 'SGT');
    assert.equal(renamed.data.bible.rev, 2);

    const versions = await json(base, '/api/bible/versions');
    assert.ok(versions.data.versions.some((v) => v.id === id && v.name === 'Segond de test'));

    const removed = await json(base, `/api/bible/versions/${id}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    const after = await json(base, '/api/bible/versions');
    assert.ok(!after.data.versions.some((v) => v.id === id));

    const missing = await json(base, `/api/bible/versions/${id}`, { method: 'DELETE' });
    assert.equal(missing.status, 404);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('l’abréviation suggérée tient en 2 à 6 caractères et reste unique', () => {
  assert.equal(suggestAbbreviation('Louis Segond 1910'), 'LS');
  assert.equal(suggestAbbreviation('Bible'), 'BIB');
  assert.equal(suggestAbbreviation('Louis Segond 1910', ['ls']), 'LS2');
  for (const name of ['Segond', 'King James Version', 'עברית', '']) {
    const code = suggestAbbreviation(name);
    assert.ok(code.length >= 2 && code.length <= 6, `${name} → ${code}`);
  }
});

test('le studio propose l’import de Bible avec prévisualisation (§ 9.2.3)', async () => {
  const studio = await fs.readFile(path.join(process.cwd(), 'app', 'web', 'studio.html'), 'utf8');
  for (const id of ['bibleDlg', 'bibleFile', 'biblePreview', 'bibleName', 'bibleAbbr', 'bibleLicense',
    'bibleConfirm', 'bibleCancel', 'bibleOpenImport', 'bibleVersion']) {
    assert.match(studio, new RegExp(`id="${id}"`), id);
  }
  // Rien n'est importé avant validation : l'aperçu passe par /preview.
  assert.match(studio, /\/api\/bible\/import\/preview/);
  assert.match(studio, /showModal\(\)/);
});
