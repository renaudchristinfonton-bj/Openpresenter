// Looks et annonces : persistance sur disque et utilisation par l'interface (EF-10, EF-17).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { freshProject, cleanup, freePort, startServer, json } from './helpers.mjs';
import { ensureProject } from '../src/core/project.mjs';
import { createLook, applyLookToOutput, lookScenes } from '../src/core/looks.mjs';
import { renderScene } from '../src/core/render/engine.mjs';

async function boot() {
  const { base: folder, dir } = await freshProject();
  await ensureProject({ name: 'Looks' });
  const srv = await startServer({ projectDir: dir, port: await freePort() });
  return { base: srv.base, dir, srv, folder };
}

test('A-10f : un look enregistré sur disque ne bouge plus quand la scène change', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const scene = await json(base, '/api/scenes/scn_bible_full');
    const look = createLook({ name: 'Pâques', scenes: [{ kind: 'bible', scene: scene.data }] });

    const saved = await json(base, `/api/library/${'looks'}/${look.id}`, { method: 'PUT', body: look });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const file = path.join(dir, 'library', 'looks', `${look.id}.json`);
    const onDisk = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.equal(onDisk.name, 'Pâques');
    assert.ok(onDisk.scenes.bible.embed.layers.length >= 2);

    const before = renderScene({ scene: lookScenes(onDisk)[0].scene, content: { verse: 'Paix', reference: 'Jn 14:27' } }).html;

    // La scène d'origine change (comme un opérateur qui retouche sa scène).
    await json(base, '/api/scenes/scn_bible_full', {
      method: 'PUT',
      body: {
        ...scene.data,
        rev: scene.data.rev,
        layers: scene.data.layers.map((layer) => layer.type === 'text'
          ? { ...layer, style: { ...layer.style, fontSize: 150 } }
          : layer)
      }
    });

    const reread = await json(base, `/api/library/looks/${look.id}`);
    const after = renderScene({ scene: lookScenes(reread.data)[0].scene, content: { verse: 'Paix', reference: 'Jn 14:27' } }).html;
    assert.equal(before, after, 'le look n’a pas suivi la modification');
  } finally { await srv.stop(); await cleanup(folder); }
});

test('appliquer un look donne une scène indépendante, avec un identifiant propre', () => {
  const scene = { id: 'scn_source01', kind: 'bible', layers: [{ id: 'lyr_a1', type: 'text', bind: 'verse' }] };
  const look = createLook({ name: 'Test', scenes: [{ kind: 'bible', scene }] });
  const output = { id: 'out_full', scenesByKind: { songs: 'scn_songs_full' } };
  const applied = applyLookToOutput(look, output);
  assert.equal(applied.scenes.length, 1);
  assert.match(applied.scenes[0].scene.id, /^scn_bible_/);
  assert.notEqual(applied.scenes[0].scene.id, 'scn_source01');
  assert.equal(applied.output.scenesByKind.songs, 'scn_songs_full', 'les autres types sont conservés');
  assert.equal(applied.output.scenesByKind.bible, applied.scenes[0].scene.id);
});

test('annonces : création, relecture, recherche et suppression', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const id = 'ann_test0001';
    const created = await json(base, `/api/library/announcements/${id}`, {
      method: 'PUT',
      body: { id, rev: 1, title: 'Réunion de prière', body: 'Mercredi 18 h 30, salle annexe.', kind: 'text' }
    });
    assert.equal(created.status, 200);
    const onDisk = JSON.parse(await fs.readFile(path.join(dir, 'library', 'announcements', `${id}.json`), 'utf8'));
    assert.equal(onDisk.title, 'Réunion de prière');

    const list = await json(base, '/api/library/announcements');
    assert.ok(list.data.items.some((item) => item.id === id));

    const found = await json(base, '/api/search?q=' + encodeURIComponent('prière'));
    const group = found.data.groups.find((item) => item.kind === 'announcements');
    assert.ok(group, 'l’annonce est trouvée par la recherche');
    assert.equal(group.items[0].payload.title, 'Réunion de prière');

    // Diffusion : la sortie plein écran reçoit le texte de l'annonce.
    const shown = await json(base, '/api/live/show', {
      method: 'POST',
      body: { targets: ['out_full'], kind: 'announcements', payload: { title: 'Réunion', text: 'Mercredi' } }
    });
    assert.equal(shown.data.delivered.length, 1);

    const removed = await json(base, `/api/library/announcements/${id}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    await assert.rejects(fs.stat(path.join(dir, 'library', 'announcements', `${id}.json`)));
  } finally { await srv.stop(); await cleanup(folder); }
});

test('l’éditeur expose les looks et le studio expose les annonces', async () => {
  const scene = await fs.readFile(path.join(process.cwd(), 'app', 'web', 'scene.html'), 'utf8');
  for (const id of ['looks', 'saveLook']) assert.match(scene, new RegExp(`id="${id}"`), id);
  assert.match(scene, /structuredClone\(scene\)/, 'le look embarque une copie');

  const studio = await fs.readFile(path.join(process.cwd(), 'app', 'web', 'studio.html'), 'utf8');
  for (const id of ['mod-ann', 'annList', 'annNew', 'annSearch']) {
    assert.match(studio, new RegExp(`id="${id}"`), id);
  }
  assert.match(studio, /Alt\+3/);
});
