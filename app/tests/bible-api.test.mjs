// Module Bible et diffusion, vus depuis l'API (A-06 → A-09, phase 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { freshProject, cleanup, freePort, startServer, json, sleep } from './helpers.mjs';

async function boot() {
  const { base: folder, dir } = await freshProject();
  const srv = await startServer({ projectDir: dir, port: await freePort() });
  return { base: srv.base, dir, srv, folder };
}

test('bible : la version d’exemple est installée au premier lancement', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const versions = await json(base, '/api/bible/versions');
    assert.equal(versions.status, 200);
    assert.equal(versions.data.versions.length, 1);
    assert.equal(versions.data.versions[0].id, 'bible_sample_fr');
    assert.ok(await fs.stat(path.join(dir, 'library', 'bibles', 'bible_sample_fr.verses.json')));
    assert.equal(versions.data.books, 66);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('bible : sélection Jean 3:16 découpée en parties lisibles', async () => {
  const { base, srv, folder } = await boot();
  try {
    const sel = await json(base, '/api/bible/selection?book=43&chapter=3&first=16&last=16&maxWordsPerScreen=12');
    assert.equal(sel.status, 200);
    assert.equal(sel.data.label, 'Jean 3:16');
    assert.ok(sel.data.items.length >= 2, String(sel.data.items.length));
    const joined = sel.data.items.map((i) => i.text).join(' ');
    assert.match(joined, /^Car Dieu a tant aimé le monde/);
    for (const item of sel.data.items) {
      assert.equal(item.verse, 16);
      assert.ok(item.text.split(/\s+/).length <= 14, item.text);
      assert.ok(item.partCount === sel.data.items.length);
    }
    // Aucun mot perdu : la concaténation des parties redonne le verset d'origine.
    const source = JSON.parse(await fs.readFile(
      path.join(new URL('../data/sample-bible.verses.json', import.meta.url).pathname), 'utf8'
    ));
    const verse16 = source.chapters.find((c) => c.b === 43 && c.c === 3).v[15];
    assert.equal(sel.data.items.map((i) => i.text).join(' ').replace(/\s+/g, ' '), verse16);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('bible : plage de versets et défauts du chapitre', async () => {
  const { base, srv, folder } = await boot();
  try {
    const range = await json(base, '/api/bible/selection?book=19&chapter=23&first=1&last=3');
    const verses = [...new Set(range.data.items.map((i) => i.verse))];
    assert.deepEqual(verses, [1, 2, 3]);
    assert.equal(range.data.label, 'Psaumes 23:1-3');

    const chapter = await json(base, '/api/bible/selection?book=43&chapter=3');
    assert.equal(chapter.data.items.length > 10, true);
    assert.equal(chapter.data.label, 'Jean 3');
  } finally { await srv.stop(); await cleanup(folder); }
});

test('bible : analyse d’une référence collée et messages d’erreur', async () => {
  const { base, srv, folder } = await boot();
  try {
    const ok = await json(base, '/api/bible/parse?ref=' + encodeURIComponent('1 Corinthiens 13:4-7'));
    assert.equal(ok.status, 200);
    assert.equal(ok.data.parsed.bookNum, 46);
    assert.equal(ok.data.parsed.chapter, 13);
    assert.equal(ok.data.parsed.first, 4);
    assert.equal(ok.data.parsed.last, 7);

    const unknown = await json(base, '/api/bible/parse?ref=xyz');
    assert.equal(unknown.status, 422);
    assert.equal(unknown.data.error.message, 'Aucun livre ne correspond à « xyz ».');

    const outOfRange = await json(base, '/api/bible/parse?ref=' + encodeURIComponent('Jean 3:42'));
    assert.equal(outOfRange.status, 422);
    assert.match(outOfRange.data.error.message, /^Jean 3 ne contient pas de verset 42 \(1 à 24\)\.$/);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('bible : un chapitre absent de la version est signalé, pas inventé', async () => {
  const { base, srv, folder } = await boot();
  try {
    const sel = await json(base, '/api/bible/selection?book=43&chapter=12');
    assert.equal(sel.status, 200);
    assert.equal(sel.data.empty, true);
    assert.match(sel.data.message, /n'est pas dans cette version/);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('bible : paramètres invalides refusés', async () => {
  const { base, srv, folder } = await boot();
  try {
    assert.equal((await json(base, '/api/bible/selection?book=99&chapter=1')).status, 400);
    assert.equal((await json(base, '/api/bible/selection?book=43&chapter=0')).status, 400);
    assert.equal((await json(base, '/api/bible/selection?book=abc&chapter=1')).status, 400);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('diffusion : deux sorties par défaut, lien stable par sortie', async () => {
  const { base, srv, folder } = await boot();
  try {
    const outs = await json(base, '/api/outputs');
    assert.equal(outs.data.outputs.length, 2);
    const ids = outs.data.outputs.map((o) => o.id);
    assert.deepEqual(ids, ['out_full', 'out_bottom']);
    const bottom = outs.data.outputs[1];
    assert.equal(bottom.preset, 'bottom');
    assert.equal(bottom.transparent, true);

    const page = await fetch(`${base}/o/out_bottom?kind=bible`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('diffusion : show met à jour l’état et refuse une sortie filtrée (A-09)', async () => {
  const { base, srv, folder } = await boot();
  try {
    const payload = { text: 'Car Dieu a tant aimé le monde', reference: 'Jean 3:16', partIndex: 0, partCount: 2 };
    const show = await json(base, '/api/live/show', {
      method: 'POST', body: { targets: ['out_full', 'out_bottom'], kind: 'bible', payload }
    });
    assert.equal(show.status, 200);
    assert.deepEqual(show.data.delivered.sort(), ['out_bottom', 'out_full']);

    // `timer` est refusé par out_full (receives.timer = false) sans bloquer les autres.
    const timer = await json(base, '/api/live/show', {
      method: 'POST', body: { targets: ['out_full', 'out_bottom'], kind: 'timer', payload: { remainingMs: 60000 } }
    });
    assert.deepEqual(timer.data.delivered, ['out_bottom']);
    assert.deepEqual(timer.data.refused, [{ id: 'out_full', reason: 'filtered', kind: 'timer' }]);

    const state = await json(base, '/api/live/state');
    assert.equal(state.data.channels.out_full.kind, 'bible');
    assert.equal(state.data.channels.out_bottom.kind, 'timer');

    const cleared = await json(base, '/api/live/clear', { method: 'POST', body: { targets: ['out_bottom'] } });
    assert.deepEqual(cleared.data.cleared, ['out_bottom']);
    const after = await json(base, '/api/live/state');
    assert.equal(after.data.channels.out_bottom, undefined);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('diffusion : une sortie inconnue est refusée explicitement', async () => {
  const { base, srv, folder } = await boot();
  try {
    const res = await json(base, '/api/live/show', {
      method: 'POST', body: { targets: ['out_inexistante'], kind: 'bible', payload: {} }
    });
    assert.deepEqual(res.data.refused, [{ id: 'out_inexistante', reason: 'unknown' }]);
    const bad = await json(base, '/api/live/show', { method: 'POST', body: { kind: 'inconnu' } });
    assert.equal(bad.status, 400);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('diffusion : le dernier état survit à un rechargement de la sortie (A-09e)', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    await json(base, '/api/live/show', {
      method: 'POST',
      body: { targets: ['out_full'], kind: 'bible', payload: { text: 'Psaume 23', reference: 'Psaumes 23:1' } }
    });
    await sleep(1100); // la sauvegarde de session est différée

    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws?channel=op_out_out_full`);
    const messages = [];
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
      setTimeout(() => reject(new Error('ouverture trop lente')), 4000);
    });
    ws.addEventListener('message', (e) => messages.push(JSON.parse(e.data)));
    ws.send(JSON.stringify({ t: 'hello' }));
    await sleep(300);
    assert.ok(messages.some((m) => m.t === 'show' && m.payload.text === 'Psaume 23'));
    ws.close();
    await sleep(100);

    // L'état est aussi écrit sur disque (session-state.json).
    const saved = JSON.parse(await fs.readFile(path.join(dir, 'session-state.json'), 'utf8'));
    assert.equal(saved.live.out_full.payload.text, 'Psaume 23');
  } finally { await srv.stop(); await cleanup(folder); }
});

test('interface : studio et sortie servis, modules partagés accessibles', async () => {
  const { base, srv, folder } = await boot();
  try {
    for (const route of ['/studio.html', '/output.html']) {
      const res = await fetch(base + route);
      assert.equal(res.status, 200, route);
    }
    for (const mod of ['books.mjs', 'split.mjs', 'bible/reference.mjs', 'bible/navigation.mjs']) {
      const res = await fetch(`${base}/shared/${mod}`);
      assert.equal(res.status, 200, mod);
      assert.match(res.headers.get('content-type'), /javascript/);
    }
    // Seuls les modules purs sont exposés.
    for (const forbidden of ['assets.mjs', 'project.mjs', 'bible/service.mjs', 'log.mjs']) {
      const res = await fetch(`${base}/shared/${forbidden}`);
      assert.equal(res.status, 404, forbidden);
    }
  } finally { await srv.stop(); await cleanup(folder); }
});

test('interface : les pages du studio n’ont aucune dépendance réseau (A-01)', async () => {
  const { base, srv, folder } = await boot();
  try {
    for (const route of ['/studio.html', '/output.html']) {
      const html = await (await fetch(base + route)).text();
      const externals = html.match(/https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+/gi) || [];
      assert.deepEqual(externals, [], `${route} : ${externals.join(', ')}`);
    }
  } finally { await srv.stop(); await cleanup(folder); }
});
