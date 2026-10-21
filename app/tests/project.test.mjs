// A-03 (dossier = projet), verrou, session, objets métier.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { freshProject, cleanup, fakePng, walk } from './helpers.mjs';

test('A-03 — copier le dossier restitue tout (test fondateur)', async () => {
  const { base, dir } = await freshProject();
  const target = path.join(os.tmpdir(), `op-copie-${Date.now()}`);
  try {
    const { ensureProject, readProject } = await import('../src/core/project.mjs');
    await ensureProject({ name: 'Église du Plateau' });
    const { importBuffer } = await import('../src/core/assets.mjs');
    const { put, writeOutputs, writeVerses } = await import('../src/core/library.mjs');

    const asset = await importBuffer(fakePng('c', 2500), { name: 'fond.png', mime: 'image/png' });

    await put('bibles', 'bible_test0001', {
      id: 'bible_test0001', name: 'Louis Segond', abbreviation: 'LSG',
      books: [{ num: 43, name: 'Jean', abbr: 'Jn', chapters: 21 }]
    });
    await writeVerses('bible_test0001', { chapters: [{ b: 43, c: 3, v: ['Car Dieu a tant aimé le monde'] }] });

    await put('songs', 'sng_test0001', {
      id: 'sng_test0001', title: 'Que ma bouche chante ta louange', artist: 'Auteur inconnu',
      sections: [{ id: 'sec_1', name: 'Couplet 1', type: 'verse', lines: ['Que ma bouche chante'] }],
      arrangements: [{ id: 'arr_1', name: 'Défaut', order: ['sec_1'] }]
    });
    await put('looks', 'look_test0001', { id: 'look_test0001', name: 'Bandeau sobre', kind: 'bible', layers: [] });
    await put('scenes', 'scn_test0001', { id: 'scn_test0001', name: 'Bandeau bas', looks: {}, layers: [] });
    await put('profiles', 'prof_test0001', { id: 'prof_test0001', name: 'Église', studio: { density: 'confort' } });
    await put('orgs', 'org_test0001', { id: 'org_test0001', name: 'Église du Plateau', timezone: 'Africa/Porto-Novo' });
    await put('events', 'evt_test0001', {
      id: 'evt_test0001', name: 'Culte du dimanche', date: '2026-10-25',
      plan: [{ kind: 'songs', refId: 'sng_test0001' }]
    });
    await writeOutputs({
      rev: 1,
      outputs: [{
        id: 'out_main', name: 'Écran principal', order: 1, enabled: true,
        receives: { bible: true, songs: true, media: true, announcements: true, lowerthird: false, timer: false, plan: false },
        scenesByKind: { bible: 'scn_test0001' },
        logoAssetId: asset.asset.assetId,
        resolution: { width: 1920, height: 1080 }
      }]
    });

    const before = await walk(dir);
    await fs.cp(dir, target, { recursive: true });
    const after = await walk(target);
    assert.deepEqual(after.sort(), before.sort(), 'la copie ne contient pas les mêmes fichiers');

    // Le projet copié est lisible avec la même API, sans cache navigateur.
    process.env.OPENPRESENTER_PROJECT = target;
    const { list, readOutputs, readVerses } = await import('../src/core/library.mjs');
    const { readProject: read2 } = await import('../src/core/project.mjs');
    const project = await read2();
    assert.equal(project.name, 'Église du Plateau');

    assert.equal((await list('songs')).length, 1);
    assert.equal((await list('looks')).length, 1);
    assert.equal((await list('events')).length, 1);
    const outputs = await readOutputs();
    assert.equal(outputs.outputs[0].logoAssetId, asset.asset.assetId);
    assert.equal((await readVerses('bible_test0001')).chapters[0].v[0], 'Car Dieu a tant aimé le monde');

    // Aucun chemin absolu de l'ancien emplacement dans les fichiers texte.
    for (const rel of after) {
      if (!/\.(json|txt|md)$/.test(rel)) continue;
      const text = await fs.readFile(path.join(target, rel), 'utf8');
      assert.ok(!text.includes(dir), `chemin absolu dans ${rel}`);
    }
  } finally {
    process.env.OPENPRESENTER_PROJECT = dir;
    await fs.rm(target, { recursive: true, force: true }).catch(() => {});
    await cleanup(base);
  }
});

test('projet : création de l’arborescence normative et de project.json', async () => {
  const { base, dir } = await freshProject();
  try {
    const { ensureProject, defaultProject } = await import('../src/core/project.mjs');
    const { ESSENTIAL_DIRS } = await import('../src/core/paths.mjs');
    const { created, project } = await ensureProject({ name: 'Test' });
    assert.equal(created, true);
    assert.match(project.id, /^prj_[0-9a-f]{12}$/);
    assert.equal(project.formatVersion, 3);
    for (const sub of ESSENTIAL_DIRS) {
      const st = await fs.stat(path.join(dir, sub));
      assert.ok(st.isDirectory(), `dossier manquant : ${sub}`);
    }
    // Second appel : idempotent, ne recrée pas.
    const again = await ensureProject();
    assert.equal(again.created, false);
    assert.equal(again.project.id, project.id);
    // Le jeton LAN fait 4 caractères non ambigus.
    assert.match(defaultProject('x').settings.lanToken, /^[A-HJ-NP-Z2-9]{4}$/);
  } finally { await cleanup(base); }
});

test('projet : verrou — second lancement refusé, verrou obsolète repris', async () => {
  const { base, dir } = await freshProject();
  try {
    const { ensureProject, acquireLock, readLock, releaseLock, lockIsStale, LOCK_FILE } = await import('../src/core/project.mjs');
    await ensureProject();

    const first = await acquireLock();
    assert.equal(first.ok, true);
    const lockPath = path.join(dir, LOCK_FILE);
    assert.ok(await fs.stat(lockPath));

    // Même processus : déjà acquis, pas de conflit.
    const same = await acquireLock();
    assert.equal(same.ok, true);

    // Autre processus vivant simulé : refus.
    await fs.writeFile(lockPath, JSON.stringify({ pid: 999999, heartbeatAt: new Date().toISOString() }));
    const conflict = await acquireLock();
    assert.equal(conflict.ok, false);
    assert.equal(conflict.code, 'LOCKED');

    // Verrou obsolète : repris.
    const stale = { pid: 999999, heartbeatAt: new Date(Date.now() - 120_000).toISOString() };
    await fs.writeFile(lockPath, JSON.stringify(stale));
    assert.equal(lockIsStale(stale), true);
    const recovered = await acquireLock();
    assert.equal(recovered.ok, true);
    assert.equal((await readLock()).pid, process.pid);

    await releaseLock(recovered.lock);
    assert.equal(await readLock(), null);
  } finally { await cleanup(base); }
});

test('projet : nettoyage des fichiers .tmp- orphelins', async () => {
  const { base, dir } = await freshProject();
  try {
    const { ensureProject, cleanupTemps } = await import('../src/core/project.mjs');
    await ensureProject();
    await fs.writeFile(path.join(dir, 'library', '.songs.json.tmp-abcdef123456'), 'x');
    await fs.writeFile(path.join(dir, 'outputs', '.outputs.json.tmp-0123456789ab'), 'x');
    const removed = await cleanupTemps();
    assert.equal(removed.length, 2);
    const left = await walk(dir);
    assert.ok(!left.some((f) => f.includes('.tmp-')));
  } finally { await cleanup(base); }
});

test('objets métier : conflit de révision détecté, création idempotente', async () => {
  const { base } = await freshProject();
  try {
    const { ensureProject } = await import('../src/core/project.mjs');
    await ensureProject();
    const { put, get, list, remove, isValidId } = await import('../src/core/library.mjs');

    const created = await put('songs', 'sng_abc123', { id: 'sng_abc123', title: 'Chant' });
    assert.equal(created.rev, 1);
    const updated = await put('songs', 'sng_abc123', { ...created, rev: 1, title: 'Chant (v2)' });
    assert.equal(updated.rev, 2);

    await assert.rejects(
      () => put('songs', 'sng_abc123', { title: 'écrasement', rev: 1 }),
      (err) => err.code === 'CONFLICT'
    );

    await assert.rejects(
      () => put('songs', 'sng_abc123', { title: 'x' }, { mode: 'create' }),
      (err) => err.code === 'CONFLICT'
    );
    await assert.rejects(
      () => put('songs', 'mauvais_id', { title: 'x' }),
      (err) => err.code === 'VALIDATION'
    );

    assert.equal(isValidId('songs', 'sng_abc123'), true);
    assert.equal(isValidId('songs', 'look_abc'), false);
    assert.equal((await list('songs')).length, 1);
    await remove('songs', 'sng_abc123');
    assert.equal(await get('songs', 'sng_abc123'), null);
  } finally { await cleanup(base); }
});

test('sorties : plafond de 32 et identifiants uniques', async () => {
  const { base } = await freshProject();
  try {
    const { ensureProject } = await import('../src/core/project.mjs');
    await ensureProject();
    const { writeOutputs, readOutputs } = await import('../src/core/library.mjs');

    const many = Array.from({ length: 33 }, (_, i) => ({ id: `out_${String(i).padStart(2, '0')}`, name: `Sortie ${i}` }));
    await assert.rejects(() => writeOutputs({ outputs: many }), /Maximum : 32 sorties/);

    await assert.rejects(
      () => writeOutputs({ outputs: [{ id: 'out_aa' }, { id: 'out_aa' }] }),
      /en double/
    );
    await assert.rejects(
      () => writeOutputs({ outputs: [{ id: 'mauvais' }] }),
      /Identifiant de sortie invalide/
    );

    const saved = await writeOutputs({ rev: 1, outputs: [{ id: 'out_main', name: 'Principal' }] });
    assert.equal(saved.outputs.length, 1);
    assert.equal((await readOutputs()).outputs[0].name, 'Principal');

    const second = await writeOutputs({ rev: 1, outputs: [{ id: 'out_main', name: 'Principal 2' }] });
    assert.equal(second.rev, 2);
    await assert.rejects(() => writeOutputs({ rev: 1, outputs: [] }), (err) => err.code === 'CONFLICT');
  } finally { await cleanup(base); }
});
