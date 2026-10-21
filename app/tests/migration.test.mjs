// A-03b — migration de `openpresenter-sauvegarde-2026-08-09.json` (fichier réel du dépôt).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { freshProject, cleanup, walk, ROOT } from './helpers.mjs';

const SAVE = path.join(ROOT, 'openpresenter-sauvegarde-2026-08-09.json');
const hasSave = await fs.stat(SAVE).then((s) => s.isFile()).catch(() => false);

test('A-03b — analyse : rapport exact avant écriture', { skip: !hasSave && 'sauvegarde absente' }, async () => {
  const { base, dir } = await freshProject();
  try {
    const { ensureProject } = await import('../src/core/project.mjs');
    await ensureProject();

    const payload = JSON.parse(await fs.readFile(SAVE, 'utf8'));
    const { analyze, detectSource } = await import('../src/migration/v1.mjs');
    assert.equal(detectSource(payload), 'v1-export');

    const report = analyze(payload);
    assert.equal(report.kind, 'v1-export');
    assert.equal(report.items.songs, 9);
    assert.equal(report.items.media, 1);
    assert.equal(report.total > 0, true);
    assert.equal(Array.isArray(report.warnings), true);

    // L'analyse n'écrit rien.
    assert.equal((await walk(path.join(dir, 'library'))).length, 0);
  } finally { await cleanup(base); }
});

test('A-03b — migration : tous les chants sont restitués, sans perte', { skip: !hasSave && 'sauvegarde absente' }, async () => {
  const { base, dir } = await freshProject();
  try {
    const { ensureProject } = await import('../src/core/project.mjs');
    await ensureProject();

    const payload = JSON.parse(await fs.readFile(SAVE, 'utf8'));
    const sourceSongs = payload.indexedDB.lyricsProStorage.songs;

    const { run } = await import('../src/migration/v1.mjs');
    const { journal } = await run(payload);

    assert.equal(journal.errors.length, 0, JSON.stringify(journal.errors));
    const imported = journal.items.filter((i) => i.type === 'song');
    assert.equal(imported.length, sourceSongs.length);

    const { list } = await import('../src/core/library.mjs');
    const songs = await list('songs');
    assert.equal(songs.length, sourceSongs.length);

    // Chaque titre source retrouve une fiche, avec toutes ses parties.
    for (const source of sourceSongs) {
      const mapped = songs.find((s) => s.title === source.title);
      assert.ok(mapped, `chant perdu : ${source.title}`);
      const sourceLines = source.sections.reduce(
        (sum, s) => sum + s.text.split(/\r?\n/).filter((l) => l.trim()).length, 0);
      const gotLines = mapped.sections.reduce((sum, s) => sum + s.lines.length, 0);
      assert.equal(gotLines, sourceLines, `lignes perdues dans ${source.title}`);
      assert.equal(mapped.arrangements[0].order.length, mapped.sections.length);
      assert.match(mapped.id, /^sng_[0-9a-f]{10}$/);
    }

    // Le média (vidéo de fond, 2,5 Mo) est copié comme asset.
    const media = journal.items.filter((i) => i.type === 'media');
    assert.equal(media.length, 1);
    const { readIndex, kindPath } = await import('../src/core/assets.mjs');
    const idx = await readIndex();
    const entry = Object.values(idx.assets)[0];
    assert.equal(entry.kind, 'background');
    assert.ok((await fs.stat(kindPath(entry.path))).size > 1_000_000);
  } finally { await cleanup(base); }
});

test('A-03b — migration idempotente : deux exécutions, aucun doublon', { skip: !hasSave && 'sauvegarde absente' }, async () => {
  const { base } = await freshProject();
  try {
    const { ensureProject } = await import('../src/core/project.mjs');
    await ensureProject();
    const payload = JSON.parse(await fs.readFile(SAVE, 'utf8'));
    const { run } = await import('../src/migration/v1.mjs');

    await run(payload);
    const { list } = await import('../src/core/library.mjs');
    const { readIndex } = await import('../src/core/assets.mjs');
    const songs1 = (await list('songs')).length;
    const assets1 = Object.keys((await readIndex()).assets).length;

    const second = await run(payload);
    assert.equal(second.journal.items.filter((i) => i.type === 'song').length, 0);
    assert.equal((await list('songs')).length, songs1);
    assert.equal(Object.keys((await readIndex()).assets).length, assets1);
    assert.ok(second.journal.skipped.length > 0);
  } finally { await cleanup(base); }
});

test('A-03b — le journal de migration est téléchargeable et suffisant', { skip: !hasSave && 'sauvegarde absente' }, async () => {
  const { base, dir } = await freshProject();
  try {
    const { ensureProject } = await import('../src/core/project.mjs');
    await ensureProject();
    const payload = JSON.parse(await fs.readFile(SAVE, 'utf8'));
    const { run } = await import('../src/migration/v1.mjs');
    const { journal } = await run(payload);
    await fs.writeFile(path.join(dir, 'backups', 'migration-v1.json'), JSON.stringify(journal, null, 2));
    const back = JSON.parse(await fs.readFile(path.join(dir, 'backups', 'migration-v1.json'), 'utf8'));
    assert.equal(back.summary.imported, journal.items.length);
    assert.equal(back.errors.length, 0);
  } finally { await cleanup(base); }
});

test('migration : source inconnue refusée explicitement', async () => {
  const { base } = await freshProject();
  try {
    const { ensureProject } = await import('../src/core/project.mjs');
    await ensureProject();
    const { analyze, detectSource } = await import('../src/migration/v1.mjs');
    assert.equal(detectSource({ hello: 'world' }), null);
    assert.throws(() => analyze({ hello: 'world' }), (err) => err.code === 'UNSUPPORTED_SOURCE');
  } finally { await cleanup(base); }
});

test('migration : chant vide ou section sans texte ignoré proprement', async () => {
  const { base } = await freshProject();
  try {
    const { ensureProject } = await import('../src/core/project.mjs');
    await ensureProject();
    const { run } = await import('../src/migration/v1.mjs');
    const payload = {
      version: 1,
      indexedDB: {
        lyricsProStorage: {
          songs: [
            { id: 's_1', title: 'Vide', sections: [] },
            { id: 's_2', title: 'Blanc', sections: [{ id: 'a', label: 'Couplet', text: '   ' }] },
            { id: 's_3', title: 'Valide', sections: [{ id: 'b', label: 'Refrain', text: 'Alléluia\nAmen' }] }
          ],
          media: []
        }
      }
    };
    const { journal } = await run(payload);
    assert.equal(journal.items.filter((i) => i.type === 'song').length, 1);
    assert.equal(journal.skipped.filter((s) => s.type === 'song').length, 2);
    const { list } = await import('../src/core/library.mjs');
    const song = (await list('songs'))[0];
    assert.equal(song.sections[0].type, 'chorus');
    assert.deepEqual(song.sections[0].lines, ['Alléluia', 'Amen']);
  } finally { await cleanup(base); }
});

test('migration : version biblique au format Books/Chapters mappée', async () => {
  const { base } = await freshProject();
  try {
    const { ensureProject } = await import('../src/core/project.mjs');
    await ensureProject();
    const { run } = await import('../src/migration/v1.mjs');
    const payload = {
      version: 1,
      indexedDB: {
        bibleProStorage: {
          versions: [{
            name: 'Louis Segond 1910',
            abbreviation: 'LSG',
            language: 'fr',
            books: [{
              name: 'Jean',
              abbreviation: 'Jn',
              chapters: [{ verses: ['Au commencement était la Parole', { text: 'Elle était au commencement' }] }]
            }]
          }]
        },
        lyricsProStorage: { songs: [], media: [] }
      }
    };
    const { journal } = await run(payload);
    assert.equal(journal.items.filter((i) => i.type === 'bible').length, 1);
    const { list, readVerses } = await import('../src/core/library.mjs');
    const [meta] = await list('bibles');
    assert.equal(meta.counts.verses, 2);
    assert.equal(meta.books[0].name, 'Jean');
    const verses = await readVerses(meta.id);
    assert.equal(verses.chapters[0].v[1], 'Elle était au commencement');
  } finally { await cleanup(base); }
});
