// Profils : gabarits réutilisables (EF-20, tests A-11 → A-11i).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { freshProject, cleanup, freePort, startServer, json } from './helpers.mjs';
import { ensureProject } from '../src/core/project.mjs';
import { readOutputs, list } from '../src/core/library.mjs';
import { readProject } from '../src/core/project.mjs';

async function boot() {
  const { base: folder, dir } = await freshProject();
  await ensureProject({ name: 'Profils' });
  const srv = await startServer({ projectDir: dir, port: await freePort() });
  return { base: srv.base, dir, srv, folder };
}

test('A-11 — les trois profils sont livrés, avec sorties et looks comptés', async () => {
  const { base, srv, folder } = await boot();
  try {
    const { data, status } = await json(base, '/api/profiles');
    assert.equal(status, 200);
    assert.equal(data.profiles.length, 3);
    const byKind = Object.fromEntries(data.profiles.map((p) => [p.kind, p]));
    assert.equal(byKind.church.outputs, 2);
    assert.equal(byKind.church.looks, 2);
    assert.equal(byKind.conference.outputs, 3);
    assert.equal(byKind.stream.outputs, 3);
    for (const profile of data.profiles) {
      assert.equal(typeof profile.color, 'string');
      assert.ok(profile.name.length > 2);
    }
  } finally { await srv.stop(); await cleanup(folder); }
});

test('A-11 — passer de « Église » à « Stream live » change sorties, looks et scènes', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const applied = await json(base, '/api/profiles/prof_stream/apply', { method: 'POST', body: {} });
    assert.equal(applied.status, 200, JSON.stringify(applied.data));
    const report = applied.data;
    assert.equal(report.applied, true);
    assert.deepEqual(report.outputs.created.sort(), ['out_lower', 'out_media', 'out_stream']);
    assert.ok(report.outputs.disabled.includes('out_full'), 'la sortie plein écran est désactivée');

    const outputs = (await readOutputs()).outputs;
    const full = outputs.find((o) => o.id === 'out_full');
    assert.equal(full.enabled, false);
    assert.match(full.notes, /Désactivée par le profil/);
    const stream = outputs.find((o) => o.id === 'out_stream');
    assert.equal(stream.enabled, true);
    assert.equal(stream.transparent, true);
    assert.equal(stream.receives.media, false);

    // Le look par défaut fournit ses scènes : elles sont copiées dans le projet.
    assert.ok(report.scenes.copied.length >= 2);
    const scenes = await list('scenes');
    const copied = scenes.filter((scene) => report.scenes.copied.includes(scene.id));
    assert.equal(copied.length, report.scenes.copied.length);
    assert.ok(copied.every((scene) => /^scn_bible_|^scn_songs_/.test(scene.id)));
    assert.ok(stream.scenesByKind.bible.startsWith('scn_bible_'));

    const project = await readProject();
    assert.equal(project.settings.activeProfileId, 'prof_stream');
    assert.equal(project.settings.stage.enabled, false, 'la vue scène du profil stream est désactivée');
    assert.equal(project.settings.splitDefaults.bible.maxWordsPerScreen, 18);

    const listAfter = await json(base, '/api/profiles');
    assert.equal(listAfter.data.profiles.find((p) => p.id === 'prof_stream').active, true);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('A-11i — appliquer un profil pendant une diffusion demande confirmation', async () => {
  const { base, srv, folder } = await boot();
  try {
    await json(base, '/api/live/show', {
      method: 'POST',
      body: { targets: ['out_full'], kind: 'bible', payload: { verse: 'Paix', reference: 'Jn 14:27' } }
    });
    const refused = await json(base, '/api/profiles/prof_conference/apply', { method: 'POST', body: {} });
    assert.equal(refused.status, 409);
    assert.equal(refused.data.error.code, 'LIVE_CONFIRM');
    assert.match(refused.data.error.message, /^TXT: Appliquer le profil « Conférence » \?/);
    assert.match(refused.data.error.message, /\[A\] Appliquer/);
    // Rien n'a bougé.
    assert.equal((await readProject()).settings.activeProfileId, 'prof_eglise');

    const forced = await json(base, '/api/profiles/prof_conference/apply', { method: 'POST', body: { force: true } });
    assert.equal(forced.status, 200);
    assert.equal(forced.data.applied, true);
    assert.ok(forced.data.outputs.created.includes('out_stage'));
  } finally { await srv.stop(); await cleanup(folder); }
});

test('A-11f — un profil qui référence un objet absent est appliqué avec un rapport', async () => {
  const { base, srv, folder } = await boot();
  try {
    const created = await json(base, '/api/profiles', {
      method: 'POST',
      body: {
        id: 'prof_brise',
        name: 'Profil incomplet',
        kind: 'custom',
        outputs: [
          { ref: 'out_full', name: 'Plein écran', receives: { bible: true }, scenesByKind: { bible: 'scn_inexistante' } }
        ],
        looks: ['look_absent'],
        defaultLook: 'look_absent'
      }
    });
    assert.equal(created.status, 201);
    const applied = await json(base, '/api/profiles/prof_brise/apply', { method: 'POST', body: { force: true } });
    assert.equal(applied.status, 200);
    assert.deepEqual(applied.data.missing.looks, ['look_absent']);
    assert.deepEqual(applied.data.missing.scenes, ['scn_inexistante']);
    assert.equal(applied.data.outputs.created.length, 0);
    assert.equal(applied.data.outputs.updated.includes('out_full'), true);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-20.4 → EF-20.8 — capturer, dupliquer, exporter, importer', async () => {
  const { base, srv, folder } = await boot();
  try {
    // La configuration actuelle est capturée telle quelle.
    const captured = await json(base, '/api/profiles/capture', { method: 'POST', body: { name: 'Mon dimanche' } });
    assert.equal(captured.status, 201);
    assert.equal(captured.data.profile.name, 'Mon dimanche');
    assert.equal(captured.data.profile.outputs.length, 2);
    assert.ok(captured.data.profile.outputs.every((entry) => entry.ref.startsWith('out_')));
    const id = captured.data.profile.id;

    // A-11g : dupliquer puis modifier ne touche pas l'original.
    const duplicated = await json(base, `/api/profiles/${id}/duplicate`, { method: 'POST' });
    assert.equal(duplicated.status, 201);
    const copyId = duplicated.data.profile.id;
    assert.equal(duplicated.data.profile.name, 'Mon dimanche (copie)');
    await json(base, `/api/profiles/${copyId}`, {
      method: 'PUT', body: { ...duplicated.data.profile, name: 'Dimanche soir', rev: 1 }
    });
    const original = await json(base, `/api/profiles/${id}`);
    assert.equal(original.data.name, 'Mon dimanche');

    // EF-20.6 : export JSON, sans binaire.
    const exported = await json(base, `/api/profiles/${id}/export`);
    assert.equal(exported.status, 200);
    assert.equal(exported.data.format, 'openpresenter.profile');
    assert.equal(exported.data.profile.outputs.length, 2);
    assert.equal(JSON.stringify(exported.data).includes('"sha256"'), false);

    // EF-20.8 : importer crée une copie à côté, sans écraser.
    const imported = await json(base, '/api/profiles/import', {
      method: 'POST', body: { bundle: exported.data, mode: 'copy' }
    });
    assert.equal(imported.status, 201);
    assert.notEqual(imported.data.profile.id, id);
    assert.equal(imported.data.profile.name, 'Mon dimanche (copie)');

    // `merge` met à jour le profil de même identifiant.
    const merged = await json(base, '/api/profiles/import', {
      method: 'POST', body: { bundle: exported.data, mode: 'merge' }
    });
    assert.equal(merged.status, 200);
    assert.equal(merged.data.merged, true);
    assert.equal(merged.data.profile.id, id);

    // Un fichier quelconque est refusé avec le texte du contrat.
    const bad = await json(base, '/api/profiles/import', { method: 'POST', body: { bundle: { hello: 1 } } });
    assert.equal(bad.status, 400);
    assert.match(bad.data.error.message, /^TXT: Ce fichier n'est pas un profil OpenPresenter\./);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('un profil actif ne peut pas être supprimé', async () => {
  const { base, srv, folder } = await boot();
  try {
    const refused = await json(base, '/api/profiles/prof_eglise', { method: 'DELETE' });
    assert.equal(refused.status, 409);
    assert.match(refused.data.error.message, /Ce profil est actif/);

    const captured = await json(base, '/api/profiles/capture', { method: 'POST', body: { name: 'Temporaire' } });
    const removed = await json(base, `/api/profiles/${captured.data.profile.id}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    const after = await json(base, '/api/profiles');
    assert.equal(after.data.profiles.length, 3);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('les profils livrés ne sont pas écrits dans un projet neuf', async () => {
  const { base: folder, dir } = await freshProject();
  try {
    await ensureProject({ name: 'Vide' });
    const profiles = await fs.readdir(path.join(dir, 'library', 'profiles')).catch(() => []);
    assert.deepEqual(profiles, [], 'un projet neuf reste vide (règle A-03)');
    // Ils sont pourtant disponibles immédiatement.
    const { listProfiles } = await import('../src/core/profiles.mjs');
    assert.equal((await listProfiles()).length, 3);
  } finally { await cleanup(folder); }
});

test('les looks livrés sont applicables sans être copiés dans le projet', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const list1 = await json(base, '/api/looks');
    assert.equal(list1.status, 200);
    assert.equal(list1.data.items.length, 6);
    const sobre = list1.data.items.find((look) => look.id === 'look_sobre');
    assert.equal(sobre.name, 'Sobre');
    assert.ok(sobre.kinds.includes('bible'));

    const look = await json(base, '/api/looks/look_sobre');
    assert.equal(look.status, 200);
    assert.ok(look.data.scenes.bible.embed.layers.length >= 2);
    // Rien n'a été écrit : un look livré n'encombre pas le dossier.
    assert.deepEqual(await fs.readdir(path.join(dir, 'library', 'looks')).catch(() => []), []);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('l’accueil affiche le profil actif et permet de l’appliquer (EF-20.1, EF-20.9)', async () => {
  const html = await fs.readFile(path.join(process.cwd(), 'app', 'web', 'accueil.html'), 'utf8');
  for (const id of ['profileGrid', 'activeProfile', 'captureProfile', 'profileDlg',
    'profileName', 'profileKind', 'profileColor', 'profileOutputs', 'profileLooks']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /\/api\/profiles\/\$\{encodeURIComponent\(id\)\}\/apply/);
  assert.match(html, /LIVE_CONFIRM/);
  assert.match(html, /Enregistrer cette configuration/);
});
