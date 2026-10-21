// Scènes vues depuis l'API et modules partagés avec le navigateur (A-10, ENF-42).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { freshProject, cleanup, freePort, startServer, json } from './helpers.mjs';

async function boot() {
  const { base: folder, dir } = await freshProject();
  const srv = await startServer({ projectDir: dir, port: await freePort() });
  return { base: srv.base, dir, srv, folder };
}

test('scènes : un projet neuf reçoit une scène par sortie et par type', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const res = await json(base, '/api/scenes');
    assert.equal(res.status, 200);
    assert.equal(res.data.items.length, 4);
    const ids = res.data.items.map((item) => item.id).sort();
    assert.deepEqual(ids, ['scn_bible_bottom', 'scn_bible_full', 'scn_songs_bottom', 'scn_songs_full']);

    // Les fichiers sont bien sur le disque, à l'endroit attendu (D-02).
    for (const id of ids) {
      const file = path.join(dir, 'scenes', `${id}.json`);
      const scene = JSON.parse(await fs.readFile(file, 'utf8'));
      assert.equal(scene.id, id);
      assert.ok(scene.layers.length >= 2, id);
    }

    const outputs = await json(base, '/api/outputs');
    const full = outputs.data.outputs.find((o) => o.id === 'out_full');
    const bottom = outputs.data.outputs.find((o) => o.id === 'out_bottom');
    assert.equal(full.scenesByKind.bible, 'scn_bible_full');
    assert.equal(bottom.scenesByKind.bible, 'scn_bible_bottom');
  } finally { await srv.stop(); await cleanup(folder); }
});

test('scènes : lecture, modification et persistance d’une scène', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const one = await json(base, '/api/scenes/scn_bible_full');
    assert.equal(one.status, 200);
    assert.equal(one.data.kind, 'bible');
    const verse = one.data.layers.find((layer) => layer.bind === 'verse');
    assert.ok(verse, 'calque du verset présent');

    const updated = {
      ...one.data,
      rev: one.data.rev || 1,
      layers: one.data.layers.map((layer) => (layer.id === verse.id
        ? { ...layer, style: { ...layer.style, fontSize: 110, color: '#ffe9a8' } }
        : layer))
    };
    const saved = await json(base, `/api/scenes/${one.data.id}`, { method: 'PUT', body: updated });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));

    const reread = await json(base, '/api/scenes/scn_bible_full');
    const rereadVerse = reread.data.layers.find((layer) => layer.id === verse.id);
    assert.equal(rereadVerse.style.fontSize, 110);
    assert.equal(rereadVerse.style.color, '#ffe9a8');

    const disk = JSON.parse(await fs.readFile(path.join(dir, 'scenes', 'scn_bible_full.json'), 'utf8'));
    assert.equal(disk.layers.find((layer) => layer.id === verse.id).style.fontSize, 110);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('scènes : une scène inconnue répond 404, un identifiant invalide est refusé', async () => {
  const { base, srv, folder } = await boot();
  try {
    const missing = await json(base, '/api/scenes/scn_inexistante');
    assert.equal(missing.status, 404);
    const bad = await json(base, '/api/scenes/../../etc/passwd');
    assert.ok(bad.status === 404 || bad.status === 403 || bad.status === 400, String(bad.status));
  } finally { await srv.stop(); await cleanup(folder); }
});

test('modules partagés : le moteur de scène est servi au navigateur, sans import Node', async () => {
  const { base, srv, folder } = await boot();
  try {
    for (const module of ['scene.mjs', 'ids.mjs', 'render/engine.mjs', 'render/content.mjs', 'render/autofit.mjs', 'render/contrast.mjs']) {
      const res = await fetch(`${base}/shared/${module}`);
      assert.equal(res.status, 200, module);
      assert.match(res.headers.get('content-type'), /javascript/, module);
      const code = await res.text();
      assert.ok(!/from ['"]node:/.test(code), `${module} ne doit importer aucun module Node`);
      assert.ok(!/require\(/.test(code), `${module} reste un module ES pur`);
    }
    // La liste blanche ne laisse pas fuir le serveur ni les données du projet.
    for (const forbidden of ['server.mjs', '../server.mjs', 'project.mjs', 'live.mjs', 'render/../../server.mjs']) {
      const res = await fetch(`${base}/shared/${forbidden}`);
      assert.equal(res.status, 404, forbidden);
    }
  } finally { await srv.stop(); await cleanup(folder); }
});

test('la page de sortie utilise le moteur partagé, plus de rendu ad hoc', async () => {
  const { base, srv, folder } = await boot();
  try {
    const res = await fetch(`${base}/o/out_bottom?kind=bible`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /from '\/shared\/render\/engine\.mjs'/);
    assert.match(html, /from '\/shared\/render\/content\.mjs'/);
    assert.match(html, /mountScene\(/);
    // Aucune règle de style de contenu propre à la page : tout vient de SCENE_CSS.
    assert.ok(!/\.layer\s*\{/.test(html), 'pas de mise en forme de texte locale');
    assert.ok(!/\.op-text|\.op-layer|\.op-scene\{/.test(html), 'aucun style de scène dupliqué');
    assert.ok(!/autoFit\(|scrollHeight/.test(html), 'aucune mesure d’ajustement locale');
  } finally { await srv.stop(); await cleanup(folder); }
});
