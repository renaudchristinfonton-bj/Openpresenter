// Socle : écritures atomiques, ZIP, chemins, journal.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { freshProject, cleanup, fakePng } from './helpers.mjs';

test('écriture atomique : jamais de fichier partiel visible', async () => {
  const { base, dir } = await freshProject();
  try {
    const { writeJson, readJson } = await import('../src/core/json-store.mjs');
    const file = path.join(dir, 'essai.json');
    await writeJson(file, { a: 1, b: [1, 2, 3] });
    const data = await readJson(file);
    assert.deepEqual(data, { a: 1, b: [1, 2, 3] });

    // 25 écritures concurrentes : le contenu final doit être l'un des états complets.
    await Promise.all(Array.from({ length: 25 }, (_, i) => writeJson(file, { i, pad: 'x'.repeat(i * 100) })));
    const final = await readJson(file);
    assert.equal(typeof final.i, 'number');
    assert.equal(final.pad.length, final.i * 100);

    // Aucun .tmp- résiduel.
    const files = await fs.readdir(dir);
    assert.ok(!files.some((f) => f.includes('.tmp-')), 'fichiers temporaires résiduels');
  } finally { await cleanup(base); }
});

test('écriture atomique : 0 fichier vide sous concurrence forte', async () => {
  const { base, dir } = await freshProject();
  try {
    const { writeFileAtomic } = await import('../src/core/json-store.mjs');
    const file = path.join(dir, 'burst.txt');
    const reads = [];
    const writers = Array.from({ length: 40 }, (_, i) =>
      writeFileAtomic(file, 'contenu-' + i).then(() => fs.readFile(file, 'utf8')).then((t) => {
        assert.match(t, /^contenu-\d+$/);
      }));
    await Promise.all(writers);
    const stat = await fs.stat(file);
    assert.ok(stat.size > 0);
  } finally { await cleanup(base); }
});

test('tri des clés : des diffs stables', async () => {
  const { sortKeys } = await import('../src/core/json-store.mjs');
  const a = sortKeys({ z: 1, a: { y: 2, b: 3 }, m: [sortKeys({ q: 1, c: 2 })] });
  assert.deepEqual(Object.keys(a), ['a', 'm', 'z']);
  assert.deepEqual(Object.keys(a.a), ['b', 'y']);
});

test('ZIP : aller-retour fidèle et UTF-8', async () => {
  const { createArchive, readArchive, crc32 } = await import('../src/core/zip.mjs');
  const files = [
    { path: 'a.json', data: Buffer.from('{"é":"à"}') },
    { path: 'dossier/b.bin', data: fakePng('z', 700) },
    { path: 'dossier/sous/c.txt', data: Buffer.from('ligne\n') }
  ];
  const buffer = createArchive(files);
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  const back = readArchive(buffer);
  assert.equal(back.size, 3);
  assert.equal(back.get('a.json').toString('utf8'), '{"é":"à"}');
  assert.deepEqual([...back.get('dossier/b.bin')], [...files[1].data]);
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('ZIP : refuse les chemins sortants (zip slip)', async () => {
  const { createArchive, readArchive } = await import('../src/core/zip.mjs');
  for (const evil of ['../evasion.txt', '/etc/passwd', 'a/../../b.txt', 'C:\\Windows\\x.dll']) {
    const archive = createArchive([{ path: evil, data: Buffer.from('x') }]);
    assert.throws(() => readArchive(archive), /Chemin interdit/, `accepté : ${evil}`);
  }
});

test('chemins : adresses LAN, dossiers essentiels', async () => {
  const { ESSENTIAL_DIRS, CACHE_DIRS, lanAddresses, projectDir } = await import('../src/core/paths.mjs');
  assert.ok(ESSENTIAL_DIRS.includes('library/songs'));
  assert.ok(ESSENTIAL_DIRS.includes('assets/media'));
  assert.ok(CACHE_DIRS.every((d) => d === 'cache' || d.startsWith('cache/')));
  assert.equal(typeof projectDir(), 'string');
  for (const a of lanAddresses()) {
    assert.ok(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(a.address));
  }
});

test('journal : aucun chemin absolu, aucun jeton en clair', async () => {
  const { base, dir } = await freshProject();
  try {
    const { log, readLogs, sanitizeCtx } = await import('../src/core/log.mjs');
    const ctx = sanitizeCtx({
      path: '/home/jean/Eglise/fichier.json',
      winPath: 'C:\\Users\\jean\\secret.txt',
      lanToken: 'AB12',
      ok: 'court'
    });
    assert.equal(ctx.path, 'fichier.json');
    assert.equal(ctx.winPath, 'secret.txt');
    assert.equal(ctx.lanToken, '****');

    await log('error', 'test.absolute', 'ouverture impossible', { file: '/home/jean/projet/x.json' });
    const entries = await readLogs({ days: 1, limit: 10 });
    const serialized = JSON.stringify(entries);
    assert.ok(!serialized.includes('/home/jean'), 'chemin absolu présent dans le journal');
    assert.equal(entries.at(-1).event, 'test.absolute');
  } finally { await cleanup(base); }
});

test('journal : rotation et purge', async () => {
  const { base } = await freshProject();
  try {
    const { log, readLogs, purgeLogs, logFile } = await import('../src/core/log.mjs');
    await log('info', 'rotation.test', 'ligne');
    assert.ok(logFile().endsWith('.log'));
    const entries = await readLogs({ q: 'rotation', days: 1 });
    assert.ok(entries.length >= 1);
    const purged = await purgeLogs(0);
    assert.ok(purged >= 1);
  } finally { await cleanup(base); }
});
