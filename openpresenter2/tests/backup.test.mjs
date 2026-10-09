import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { OpenPresenterDB } from '../src/core/database.mjs';
import { createBackupZip, importBackupZip } from '../src/core/backup.mjs';

test('backup exports and restores IndexedDB records and binary assets as an OpenPresenter ZIP', async () => {
  const source = new OpenPresenterDB('backup-source');
  await source.setSetting('lastTheme', 'neon');
  await source.saveBible({ id: 'bible-demo', name: 'Démo', books: [{ name: 'Jean', chapters: [] }] });
  await source.saveScene('main.bible', { preset: 'full', layers: [] });
  await source.saveSong({ id: 'song-demo', title: 'Louange', sections: [] });
  await source.put('notes', { id: 'note-demo', kind: 'annotation', text: 'À revoir' });
  await source.saveAsset(new Blob(['op-image-bytes'], { type: 'image/png' }), 'asset-demo');

  const archive = await createBackupZip(source, JSZip);
  assert.ok(archive.size > 100);
  const inspect = await JSZip.loadAsync(archive);
  assert.ok(inspect.file('manifest.json'));
  assert.ok(inspect.file('assets/00001.png'));
  const manifest = JSON.parse(await inspect.file('manifest.json').async('string'));
  assert.equal(manifest.format, 'openpresenter-backup');
  assert.equal(manifest.stores.bibles[0].name, 'Démo');

  const target = new OpenPresenterDB('backup-target');
  const result = await importBackupZip(archive, target, JSZip);
  assert.equal(result.imported.bibles, 1);
  assert.equal((await target.getSetting('lastTheme')), 'neon');
  assert.equal((await target.get('songs', 'song-demo')).title, 'Louange');
  assert.equal((await target.get('assets', 'asset-demo')).blob.size, 'op-image-bytes'.length);
  assert.equal(await (await target.get('assets', 'asset-demo')).blob.text(), 'op-image-bytes');
});

test('backup importer rejects unrelated archives and traversal paths', async () => {
  const db = new OpenPresenterDB('backup-invalid');
  const unrelated = new JSZip(); unrelated.file('hello.txt', 'not a backup');
  const unrelatedFile = await unrelated.generateAsync({ type: 'blob' });
  await assert.rejects(() => importBackupZip(unrelatedFile, db, JSZip), /manifeste|compatible/i);

  for (const path of ['assets/../evil.bin', 'assets/..\\evil.bin']) {
    const malicious = new JSZip();
    malicious.file(path, 'not an image', { createFolders: false });
    malicious.file('manifest.json', JSON.stringify({
      format: 'openpresenter-backup', version: 1,
      meta: { application: 'OpenPresenter 2', schema: 1 },
      stores: {}, assets: [{ id: 'asset-evil', name: 'evil.bin', type: 'image/png', path }],
    }));
    const maliciousFile = await malicious.generateAsync({ type: 'blob' });
    await assert.rejects(() => importBackupZip(maliciousFile, db, JSZip), /Chemin de média/);
  }
});
