// API des chants : aperçu d'import, import disque, sélection et diffusion (EF-15).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { freshProject, cleanup, freePort, startServer, json, sleep } from './helpers.mjs';

const CHORDPRO = `{title: Grâce infinie}
{artist: John Newton}
{key: G}

Couplet 1
[G]Grâce infinie, quel doux [C]son
Qui a sauvé un misérable [G]comme moi

Refrain
[G]J'étais perdu, mais je suis [D]retrouvé

Couplet 2
[G]C'est la grâce qui m'a [C]appris
À craindre Dieu et [G]à croire

Pont
[G]Quand nous aurons chanté [D]dix mille ans

Refrain final
[C]Comme au premier jour [G]nous chanterons

Couplet 3
[G]Bien des dangers, bien des [C]peines
J'ai déjà [G]traversés`;

async function boot() {
  const { base: folder, dir } = await freshProject();
  const srv = await startServer({ projectDir: dir, port: await freePort() });
  return { base: srv.base, dir, srv, folder };
}

test('un projet neuf reste vide, les chants d’exemple s’ajoutent à la demande', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const empty = await json(base, '/api/library/songs');
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.data.items, [], 'aucun contenu semé dans le dos de l’utilisateur');

    const seeded = await json(base, '/api/songs/samples', { method: 'POST' });
    assert.equal(seeded.status, 201);
    const twice = await json(base, '/api/songs/samples', { method: 'POST' });
    assert.equal(twice.data.items.length, 2, 'idempotent : aucun doublon');

    const res = await json(base, '/api/library/songs');
    const titles = res.data.items.map((song) => song.title).sort();
    assert.deepEqual(titles, ['Grâce infinie', 'Tu es saint']);
    for (const song of res.data.items) {
      assert.match(song.id, /^sng_[a-z0-9_]{2,40}$/);
      assert.ok(song.sections.length >= 2, song.title);
      assert.ok(song.arrangements.length >= 1);
      const file = path.join(dir, 'library', 'songs', `${song.id}.json`);
      assert.ok((await fs.stat(file)).size > 100);
    }
  } finally { await srv.stop(); await cleanup(folder); }
});

test('A-12f (chants) : l’aperçu d’import ne touche pas au disque', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const before = await fs.readdir(path.join(dir, 'library', 'songs'));
    const res = await json(base, '/api/songs/parse', { method: 'POST', body: { text: CHORDPRO } });
    assert.equal(res.status, 200);
    assert.equal(res.data.summary.sections, 6);
    assert.equal(res.data.summary.title, 'Grâce infinie');
    assert.equal(res.data.summary.hasChords, true);
    assert.deepEqual(res.data.summary.chords.sort(), ['C', 'D', 'G']);
    assert.equal(res.data.song.sections.length, 6);
    const after = await fs.readdir(path.join(dir, 'library', 'songs'));
    assert.deepEqual(after.sort(), before.sort(), 'aucune écriture pendant l’aperçu');
  } finally { await srv.stop(); await cleanup(folder); }
});

test('un aperçu vide est refusé avec un message clair', async () => {
  const { base, srv, folder } = await boot();
  try {
    const res = await json(base, '/api/songs/parse', { method: 'POST', body: { text: '   ' } });
    assert.equal(res.status, 400);
    assert.match(res.data.error.message, /Collez le texte/);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-15.2 : importer un chant écrit le JSON et copie la source', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const res = await json(base, '/api/songs/import', {
      method: 'POST',
      body: { text: CHORDPRO, filename: 'grace-infinie.chordpro' }
    });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    const song = res.data.song;
    assert.match(song.id, /^sng_grace_infinie_[a-f0-9]{6}$/);
    assert.equal(song.sections.length, 6);
    assert.ok(song.sourceAssetId, 'fichier d’origine conservé');

    const file = path.join(dir, 'library', 'songs', `${song.id}.json`);
    const disk = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.equal(disk.title, 'Grâce infinie');
    assert.equal(disk.rev, 1);

    // La source est bien un asset du projet, dans `assets/songs/`.
    assert.match(song.sourceAssetId, /^as_[a-f0-9]{12}$/);
    const assets = await json(base, `/api/assets/${song.sourceAssetId}`);
    assert.equal(assets.status, 200);

    // Le chant importé apparaît dans la bibliothèque et dans la recherche.
    const list = await json(base, '/api/library/songs');
    assert.ok(list.data.items.some((item) => item.id === song.id));
    const search = await json(base, '/api/search?q=gr%C3%A2ce');
    assert.ok(search.data.groups.some((group) => group.kind === 'songs'));
  } finally { await srv.stop(); await cleanup(folder); }
});

test('la sélection d’un chant est plate, découpée et navigable', async () => {
  const { base, srv, folder } = await boot();
  try {
    const seeded = await json(base, '/api/songs/samples', { method: 'POST' });
    assert.equal(seeded.status, 201);
    const res = await json(base, '/api/songs/sng_grace_infinie/selection?maxWordsPerScreen=6');
    assert.equal(res.status, 200);
    const sel = res.data;
    assert.equal(sel.songId, 'sng_grace_infinie');
    assert.equal(sel.arrangementId, 'arr_default');
    assert.ok(sel.items.length >= sel.steps.length, 'au moins une partie par étape');
    assert.ok(sel.steps.length >= 3);
    for (const item of sel.items) {
      assert.ok(['verse', 'chorus', 'bridge'].includes(item.sectionType), item.sectionType);
      assert.ok(item.text.length > 0);
      assert.equal(typeof item.partIndex, 'number');
    }
    // On peut demander un autre arrangement : le nom est celui du chant.
    assert.equal(sel.title, 'Grâce infinie');

    const missing = await json(base, '/api/songs/sng_inexistant/selection');
    assert.equal(missing.status, 404);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('diffusion d’un chant : payload complet, filtres respectés', async () => {
  const { base, srv, folder } = await boot();
  try {
    await json(base, '/api/songs/samples', { method: 'POST' });
    const sel = await json(base, '/api/songs/sng_tu_es_saint/selection');
    const item = sel.data.items[0];
    const show = await json(base, '/api/live/show', {
      method: 'POST',
      body: {
        targets: ['out_full', 'out_bottom'],
        kind: 'songs',
        payload: {
          text: item.text,
          title: sel.data.title,
          partIndex: item.partIndex,
          partCount: item.partCount,
          step: item.step
        }
      }
    });
    assert.equal(show.status, 200);
    assert.deepEqual(show.data.delivered.sort(), ['out_bottom', 'out_full']);

    const state = await json(base, '/api/live/state');
    const channel = state.data.channels.out_full;
    assert.equal(channel.kind, 'songs');
    assert.equal(channel.payload.text, item.text);
    await sleep(20);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('les modules de chants sont servis au navigateur, sans import Node', async () => {
  const { base, srv, folder } = await boot();
  try {
    for (const module of ['songs/parser.mjs', 'songs/arrangement.mjs']) {
      const res = await fetch(`${base}/shared/${module}`);
      assert.equal(res.status, 200, module);
      const code = await res.text();
      assert.ok(!/from ['"]node:/.test(code), module);
      assert.ok(!/require\(/.test(code), module);
    }
  } finally { await srv.stop(); await cleanup(folder); }
});
