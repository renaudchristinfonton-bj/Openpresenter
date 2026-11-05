// A-13 → A-13e : export complet, fusion sans doublon, archive endommagée,
// format futur refusé, aucune archive partielle.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { freshProject, cleanup, fakePng, walk } from './helpers.mjs';
import { createArchive, readArchive } from '../src/core/zip.mjs';

async function sampleProject() {
  const { ensureProject } = await import('../src/core/project.mjs');
  const { importBuffer } = await import('../src/core/assets.mjs');
  const { put, writeOutputs } = await import('../src/core/library.mjs');
  await ensureProject({ name: 'Culte' });
  const png = fakePng('e', 4096);
  const asset = await importBuffer(png, { name: 'fond.png', mime: 'image/png' });
  await put('songs', 'sng_export1', { id: 'sng_export1', title: 'Chant exporté', sections: [] });
  await put('looks', 'look_export1', { id: 'look_export1', name: 'Look exporté', layers: [] });
  await put('scenes', 'scn_export1', { id: 'scn_export1', name: 'Scène', layers: [] });
  await put('events', 'evt_export1', { id: 'evt_export1', name: 'Événement', plan: [] });
  await writeOutputs({ rev: 1, outputs: [{ id: 'out_main', name: 'Principal' }] });
  return { png, asset };
}

test('A-13 — export complet puis restauration sur une autre machine', async () => {
  const { base, dir } = await freshProject();
  const other = await fs.mkdtemp(path.join(os.tmpdir(), 'op-ailleurs-'));
  try {
    const { png, asset } = await sampleProject();
    const { buildExport, importArchive } = await import('../src/core/exporter.mjs');

    const { buffer, manifest } = await buildExport();
    assert.ok(buffer.length > png.length);
    assert.equal(manifest.formatVersion, 3);
    assert.ok(manifest.files.some((f) => f.path === 'project.json'));
    assert.ok(manifest.files.some((f) => f.path === `assets/${asset.asset.path}`));
    assert.equal(manifest.counts.songs, 1);

    // Restauration dans un dossier vierge.
    process.env.OPENPRESENTER_PROJECT = other;
    const { ensureProject } = await import('../src/core/project.mjs');
    await ensureProject({ name: 'vide' });
    const report = await importArchive(buffer, { mode: 'replace' });
    assert.equal(report.written > 0, true);
    assert.equal(report.mode, 'replace');

    const { list, readOutputs } = await import('../src/core/library.mjs');
    const { readProject } = await import('../src/core/project.mjs');
    assert.equal((await readProject()).name, 'Culte');
    assert.equal((await list('songs'))[0].title, 'Chant exporté');
    assert.equal((await list('looks')).length, 1);
    assert.equal((await readOutputs()).outputs[0].name, 'Principal');

    const restored = await fs.readFile(path.join(other, 'assets', asset.asset.path));
    assert.deepEqual([...restored], [...png]);
  } finally {
    process.env.OPENPRESENTER_PROJECT = dir;
    await cleanup(base);
    await fs.rm(other, { recursive: true, force: true }).catch(() => {});
  }
});

test('A-13b — restaurer « Fusionner » deux fois : aucun doublon', async () => {
  const { base, dir } = await freshProject();
  try {
    await sampleProject();
    const { buildExport } = await import('../src/core/exporter.mjs');
    const { buffer } = await buildExport();
    process.env.OPENPRESENTER_PROJECT = dir; // même projet

    const { importArchive } = await import('../src/core/exporter.mjs');
    const first = await importArchive(buffer, { mode: 'merge' });
    assert.equal(first.written, 0, 'la fusion a réécrit des fichiers identiques');
    assert.ok(first.skipped > 0);

    const second = await importArchive(buffer, { mode: 'merge' });
    assert.equal(second.written, 0);

    const { list } = await import('../src/core/library.mjs');
    const songs = await list('songs');
    assert.equal(songs.length, 1);
    const { readIndex } = await import('../src/core/assets.mjs');
    assert.equal(Object.keys((await readIndex()).assets).length, 1);
  } finally { await cleanup(base); }
});

test('A-13c — archive dont un média est absent : signalée, aucune écriture', async () => {
  const { base, dir } = await freshProject();
  try {
    const { asset } = await sampleProject();
    const { buildExport } = await import('../src/core/exporter.mjs');
    const { manifest } = await buildExport();
    const raw = [];
    for (const entry of manifest.files) {
      if (entry.path === `assets/${asset.asset.path}`) continue; // média retiré
      raw.push({ path: entry.path, data: Buffer.from('{}') });
    }
    raw.push({ path: 'manifest.json', data: Buffer.from(JSON.stringify(manifest)) });
    const broken = createArchive(raw);

    const { importArchive } = await import('../src/core/exporter.mjs');
    await assert.rejects(
      () => importArchive(broken, { mode: 'replace' }),
      (err) => err.code === 'BAD_ARCHIVE' && /endommagée|incomplète/i.test(err.message)
    );

    // Rien n'a été déplacé : les données d'origine sont toujours là.
    const { list } = await import('../src/core/library.mjs');
    assert.equal((await list('songs')).length, 1);
    assert.ok(await fs.stat(path.join(dir, 'library', 'songs', 'sng_export1.json')));
  } finally { await cleanup(base); }
});

test('A-13d — archive d’un format plus récent : refus, aucune écriture', async () => {
  const { base } = await freshProject();
  try {
    await sampleProject();
    const { buildExport } = await import('../src/core/exporter.mjs');
    const { manifest } = await buildExport();
    const future = { ...manifest, formatVersion: 99 };
    const archive = createArchive([
      { path: 'manifest.json', data: Buffer.from(JSON.stringify(future)) },
      { path: 'project.json', data: Buffer.from('{"id":"x"}') }
    ]);
    const before = await walk(base);
    const { importArchive } = await import('../src/core/exporter.mjs');
    await assert.rejects(
      () => importArchive(archive, { mode: 'replace' }),
      (err) => err.code === 'FORMAT_TOO_RECENT'
    );
    assert.deepEqual((await walk(base)).sort(), before.sort());
  } finally { await cleanup(base); }
});

test('A-13e — aucune archive partielle : l’archive n’existe qu’entière', async () => {
  const { base } = await freshProject();
  try {
    await sampleProject();
    const { buildExport } = await import('../src/core/exporter.mjs');
    const { buffer } = await buildExport();
    // Une archive tronquée est refusée, jamais interprétée partiellement.
    const truncated = buffer.subarray(0, Math.floor(buffer.length / 2));
    await assert.rejects(async () => readArchive(truncated), /ZIP invalide/);
    const { importArchive } = await import('../src/core/exporter.mjs');
    await assert.rejects(() => importArchive(truncated), /manifeste|ZIP|invalide/i);
    // L'archive complète, elle, reste valide.
    assert.ok(readArchive(buffer).get('manifest.json'));
  } finally { await cleanup(base); }
});

test('export sans médias : les binaires ne sont pas inclus, les JSON oui', async () => {
  const { base } = await freshProject();
  try {
    await sampleProject();
    const { buildExport } = await import('../src/core/exporter.mjs');
    const { buffer, manifest } = await buildExport({ includeMedia: false });
    assert.equal(manifest.includesMedia, false);
    assert.ok(!manifest.files.some((f) => f.path.startsWith('assets/media/')));
    assert.ok(manifest.files.some((f) => f.path === 'outputs/outputs.json'));
    const back = readArchive(buffer);
    assert.ok(back.has('library/songs/sng_export1.json'));
  } finally { await cleanup(base); }
});

test('sauvegarde automatique : rotation à N fichiers', async () => {
  const { base, dir } = await freshProject();
  try {
    await sampleProject();
    const { backupNow } = await import('../src/core/project.mjs');
    for (let i = 0; i < 4; i++) await backupNow({ keep: 2 });
    const files = (await fs.readdir(path.join(dir, 'backups'))).filter((f) => f.startsWith('auto-'));
    assert.equal(files.length, 2);
    for (const f of files) {
      assert.ok((await fs.stat(path.join(dir, 'backups', f))).size > 0);
    }
  } finally { await cleanup(base); }
});
