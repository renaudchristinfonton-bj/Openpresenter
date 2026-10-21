// A-04 (copie à l'import) et A-05 (déduplication).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { freshProject, cleanup, fakePng, walk } from './helpers.mjs';
import { ensureProject } from '../src/core/project.mjs';
import {
  importStream, importBuffer, readIndex, findAsset, kindPath, recountRefs,
  purgeOrphans, integrityReport
} from '../src/core/assets.mjs';

test('A-04 — copie à l’import : aucune référence au chemin d’origine', async () => {
  const { base, dir } = await freshProject();
  try {
    await ensureProject();
    const outside = path.join(base, 'fond.jpg');
    const data = fakePng('f', 2048);
    await fs.writeFile(outside, data);

    // Import par flux, comme le fait le serveur avec un corps HTTP.
    const res = await importStream(Readable.from([data]), { name: 'fond.jpg', mime: 'image/jpeg' });
    assert.equal(res.deduplicated, false);
    assert.equal(res.asset.bytes, data.length);
    assert.ok(res.asset.path.startsWith('media/'), res.asset.path);

    // Le fichier d'origine disparaît : le projet reste intact.
    await fs.rm(outside);
    const stored = await fs.readFile(kindPath(res.asset.path));
    assert.deepEqual([...stored], [...data]);

    // Aucune occurrence de /tmp/ ni du nom de dossier temporaire dans project/.
    const files = await walk(dir);
    for (const rel of files) {
      if (!/\.(json|txt|md)$/.test(rel)) continue;
      const text = await fs.readFile(path.join(dir, rel), 'utf8');
      assert.ok(!text.includes(base), `chemin absolu trouvé dans ${rel}`);
      assert.ok(!text.includes('/tmp/'), `chemin /tmp trouvé dans ${rel}`);
    }
  } finally { await cleanup(base); }
});

test('A-05 — même fichier importé deux fois : un seul binaire, refs = 2', async () => {
  const { base, dir } = await freshProject();
  try {
    await ensureProject();
    const data = fakePng('d', 3000);
    const first = await importBuffer(data, { name: 'logo.png', mime: 'image/png' });
    const second = await importBuffer(data, { name: 'logo.png', mime: 'image/png' });
    assert.equal(first.deduplicated, false);
    assert.equal(second.deduplicated, true);
    assert.equal(first.asset.sha256, second.asset.sha256);

    const bins = (await walk(path.join(dir, 'assets'))).filter((f) => f.endsWith('.png'));
    assert.equal(bins.length, 1, 'plusieurs copies du même binaire');

    const idx = await readIndex();
    const entry = idx.assets[first.asset.sha256];
    assert.equal(entry.refs, 2);
  } finally { await cleanup(base); }
});

test('A-05 — contenu identique, noms différents : un binaire, deux noms mémorisés', async () => {
  const { base } = await freshProject();
  try {
    await ensureProject();
    const data = fakePng('n', 1200);
    const a = await importBuffer(data, { name: 'Fond dimanche.jpg', mime: 'image/jpeg' });
    await importBuffer(data, { name: 'fond-dimanche-copie.jpg', mime: 'image/jpeg' });
    const idx = await readIndex();
    const entry = idx.assets[a.asset.sha256];
    assert.equal(entry.originalName, 'Fond dimanche.jpg');
    assert.deepEqual(entry.altNames, ['fond-dimanche-copie.jpg']);
    const total = Object.keys(idx.assets).length;
    assert.equal(total, 1);
  } finally { await cleanup(base); }
});

test('assets : résolution par identifiant court et empreinte', async () => {
  const { base } = await freshProject();
  try {
    await ensureProject();
    const { asset } = await importBuffer(fakePng('r', 500), { name: 'r.png', mime: 'image/png' });
    assert.ok(await findAsset(asset.assetId));
    assert.ok(await findAsset(asset.sha256));
    assert.ok(await findAsset(asset.sha256.slice(0, 10)));
    assert.equal(await findAsset('as_inexistant'), null);
  } finally { await cleanup(base); }
});

test('assets : comptage des références et orphelins déplacés (A-18k)', async () => {
  const { base, dir } = await freshProject();
  try {
    await ensureProject();
    const used = await importBuffer(fakePng('u', 400), { name: 'utilise.png', mime: 'image/png' });
    const orphan = await importBuffer(fakePng('o', 400), { name: 'orphelin.png', mime: 'image/png' });

    await fs.mkdir(path.join(dir, 'scenes'), { recursive: true });
    await fs.writeFile(path.join(dir, 'scenes', 'scn_a.json'), JSON.stringify({
      id: 'scn_a',
      layers: [{ kind: 'image', imageAssetId: used.asset.assetId }]
    }));

    const idx = await recountRefs();
    assert.equal(idx.assets[used.asset.sha256].refs, 1);
    assert.equal(idx.assets[orphan.asset.sha256].refs, 0);

    const report = await integrityReport();
    assert.equal(report.assets.orphan.length, 1);
    assert.equal(report.assets.orphan[0].sha256, orphan.asset.sha256);

    const purged = await purgeOrphans();
    assert.equal(purged.moved.length, 1);
    assert.ok(purged.moved[0].bytes > 0);

    // Le fichier est déplacé, pas supprimé.
    const backups = await walk(path.join(dir, 'backups'));
    assert.ok(backups.some((f) => f.endsWith('.png')), 'orphelin non conservé');
    const idxAfter = await readIndex();
    assert.equal(idxAfter.assets[orphan.asset.sha256], undefined);
  } finally { await cleanup(base); }
});

test('assets : rapport d’intégrité détecte un binaire manquant', async () => {
  const { base } = await freshProject();
  try {
    await ensureProject();
    const { asset } = await importBuffer(fakePng('m', 300), { name: 'm.png', mime: 'image/png' });
    await fs.rm(kindPath(asset.path), { force: true });
    const report = await integrityReport();
    assert.equal(report.assets.missing.length, 1);
  } finally { await cleanup(base); }
});

test('import : gros fichier en flux, empreinte exacte', async () => {
  const { base } = await freshProject();
  try {
    await ensureProject();
    const chunks = [];
    for (let i = 0; i < 8; i++) chunks.push(Buffer.alloc(256 * 1024, i + 1));
    const res = await importStream(Readable.from(chunks), { name: 'video.mp4', mime: 'video/mp4' });
    assert.equal(res.asset.bytes, 2 * 1024 * 1024);
    const crypto = await import('node:crypto');
    const expected = crypto.createHash('sha256').update(Buffer.concat(chunks)).digest('hex');
    assert.equal(res.asset.sha256, expected);
  } finally { await cleanup(base); }
});
