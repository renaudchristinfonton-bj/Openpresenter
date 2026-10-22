// Accueil et recherche unifiée (EF-05, EF-06.8 → EF-06.18).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { freshProject, cleanup, freePort, startServer, json, ROOT } from './helpers.mjs';
import { ensureProject, seedSampleSongs } from '../src/core/project.mjs';
import { seedSampleBible } from '../src/core/bible/service.mjs';

async function boot() {
  const { base: folder, dir } = await freshProject();
  await ensureProject({ name: 'Accueil' });
  await seedSampleBible();
  await seedSampleSongs();
  const srv = await startServer({ projectDir: dir, port: await freePort() });
  return { base: srv.base, dir, srv, folder };
}

test('EF-05 : la racine ouvre l’accueil, le studio reste sur /studio.html', async () => {
  const { base, srv, folder } = await boot();
  try {
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /OpenPresenter — Accueil/);
    // Les quatre zones du § 5.2 et l'action principale.
    for (const id of ['livePill', 'clearAll', 'cards', 'openStudio', 'clock', 'lan']) {
      assert.match(html, new RegExp(`id="${id}"`), id);
    }
    assert.match(html, /Ouvrir le Studio Unifié/);
    // Le même moteur de rendu que la sortie (EF-05.2 / ENF-42).
    assert.match(html, /from '\/shared\/render\/engine\.mjs'/);
    assert.match(html, /mountScene\(/);

    const studio = await fetch(`${base}/studio.html`);
    assert.equal(studio.status, 200);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-05.4 : « Tout couper » vide toutes les sorties', async () => {
  const { base, srv, folder } = await boot();
  try {
    await json(base, '/api/live/show', {
      method: 'POST',
      body: { targets: ['out_full', 'out_bottom'], kind: 'bible', payload: { text: 'Car Dieu…', reference: 'Jean 3:16' } }
    });
    const before = await json(base, '/api/live/state');
    assert.equal(Object.keys(before.data.channels).length, 2);

    const cleared = await json(base, '/api/live/clear', { method: 'POST', body: {} });
    assert.equal(cleared.status, 200);
    const after = await json(base, '/api/live/state');
    assert.deepEqual(after.data.channels, {});
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-06.9/14 : recherche groupée, plusieurs versets par Bible', async () => {
  const { base, srv, folder } = await boot();
  try {
    const res = await json(base, '/api/search?q=gr%C3%A2ce');
    assert.equal(res.status, 200);
    const kinds = res.data.groups.map((group) => group.kind);
    assert.ok(kinds.includes('songs'), 'les chants sont cherchés');
    for (const group of res.data.groups) {
      assert.equal(group.count, group.items.length, `compte cohérent pour ${group.kind}`);
      assert.ok(group.label, `libellé de groupe pour ${group.kind}`);
    }

    // Les paroles sont indexées (EF-06.14) et plusieurs versets peuvent remonter.
    const verses = await json(base, '/api/search?q=' + encodeURIComponent('monde'));
    const bibleGroup = verses.data.groups.find((group) => group.kind === 'bibles');
    assert.ok(bibleGroup, 'un verset contenant « monde » est trouvé');
    assert.ok(bibleGroup.items.length >= 1);
    const item = bibleGroup.items[0];
    assert.ok(item.payload?.bookNum > 0, 'de quoi construire une sélection');
    assert.ok(item.payload?.verse >= 1);
    assert.match(item.title, /\d+:\d+/);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-06.15 : casse, accents et espaces sont ignorés', async () => {
  const { base, srv, folder } = await boot();
  try {
    const plain = await json(base, '/api/search?q=grace');
    const accented = await json(base, '/api/search?q=gr%C3%A2ce');
    const upper = await json(base, '/api/search?q=GRACE');
    assert.ok(plain.data.total > 0);
    assert.equal(plain.data.total, accented.data.total);
    assert.equal(plain.data.total, upper.data.total);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-06.18 : les filtres de type limitent les groupes, une lettre ne cherche pas', async () => {
  const { base, srv, folder } = await boot();
  try {
    const onlySongs = await json(base, '/api/search?q=gr%C3%A2ce&kinds=songs');
    assert.deepEqual(onlySongs.data.groups.map((group) => group.kind), ['songs']);

    const none = await json(base, '/api/search?q=g');
    assert.deepEqual(none.data.groups, []);
    assert.equal(none.data.total, 0);

    const unknown = await json(base, '/api/search?q=zzzzzzzz');
    assert.deepEqual(unknown.data.groups, []);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-06.16 : 50 résultats maximum par groupe', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    // 60 chants qui contiennent tous le même mot.
    const dirSongs = path.join(dir, 'library', 'songs');
    await fs.mkdir(dirSongs, { recursive: true });
    for (let i = 0; i < 60; i++) {
      const id = `sng_masse${String(i).padStart(4, '0')}`;
      await fs.writeFile(path.join(dirSongs, `${id}.json`), JSON.stringify({
        id, rev: 1, title: `Chant ${i} miséricorde`,
        sections: [{ id: 'sec_1', name: 'Couplet', type: 'verse', lines: ['miséricorde'] }],
        arrangements: [{ id: 'arr_default', name: 'Ordre standard', order: ['sec_1'] }]
      }), 'utf8');
    }
    const res = await json(base, '/api/search?q=mis%C3%A9ricorde&kinds=songs');
    const group = res.data.groups.find((item) => item.kind === 'songs');
    assert.ok(group);
    assert.equal(group.items.length, 50);
    assert.equal(group.count, 50);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('la recherche des looks est branchée (EF-06.14)', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const dirLooks = path.join(dir, 'library', 'looks');
    await fs.mkdir(dirLooks, { recursive: true });
    await fs.writeFile(path.join(dirLooks, 'look_paques0001.json'), JSON.stringify({
      id: 'look_paques0001', rev: 1, name: 'Pâques lumineux', description: 'fond doré',
      scenes: { bible: { sceneId: 'scn_bible_full', embed: { id: 'scn_bible_full' } } }
    }), 'utf8');
    const res = await json(base, '/api/search?q=p%C3%A2ques');
    const group = res.data.groups.find((item) => item.kind === 'looks');
    assert.ok(group, 'le look est trouvé');
    assert.equal(group.items[0].title, 'Pâques lumineux');
  } finally { await srv.stop(); await cleanup(folder); }
});

test('la palette Ctrl+K est présente dans le studio et suit le contrat clavier', async () => {
  const html = await fs.readFile(path.join(ROOT, 'app', 'web', 'studio.html'), 'utf8');
  for (const id of ['palette', 'paletteInput', 'paletteResults', 'paletteFilters']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  // Ouverture au clavier, débounce 120 ms, aperçu sans diffusion, fermeture.
  assert.match(html, /event\.key\.toLowerCase\(\) === 'k'/);
  assert.match(html, /setTimeout\(\(\) => runSearch\(value\), 120\)/);
  assert.match(html, /activate\(event\.shiftKey\)/);
  assert.match(html, /closePalette\(\)/);
  assert.match(html, /\/api\/search\?q=/);
});
