import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenPresenterDB } from '../src/core/database.mjs';

test('database memory fallback handles settings, scenes, and library records', async () => {
  const db = new OpenPresenterDB('test-memory-only');
  assert.equal(await db.ready(), false);
  await db.setSetting('lastTheme', 'warm');
  assert.equal(await db.getSetting('lastTheme'), 'warm');
  assert.equal(await db.getSetting('missing', 'cinema'), 'cinema');
  await db.saveScene('main.bible', { preset: 'full', layers: [] });
  assert.equal((await db.get('scenes', 'main.bible')).preset, 'full');
  await db.saveBible({ id: 'bible-1', name: 'Démo', books: [] });
  assert.equal((await db.all('bibles')).length, 1);
  await db.saveMedia({ id: 'media-1', name: 'Eglise.jpg', type: 'image' });
  assert.equal((await db.all('media')).length, 1);
  await db.delete('bibles', 'bible-1');
  assert.equal((await db.all('bibles')).length, 0);
});

test('database rejects missing keys and unknown stores', async () => {
  const db = new OpenPresenterDB('test-validation');
  await assert.rejects(() => db.put('scenes', { preset: 'full' }), /doit contenir/);
  await assert.rejects(() => db.all('unknown'), /Magasin inconnu/);
});
