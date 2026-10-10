import test from 'node:test';
import assert from 'node:assert/strict';
import { buildObsOutputUrl } from '../src/core/output-url.mjs';

const output = { id: 'stage_music', name: 'Écran musiciens', width: 1280, height: 720, fit: 'contain' };

test('OBS links preserve custom output identity, source dimensions, and contain framing without layout locks', () => {
  const url = new URL(buildObsOutputUrl('http://localhost:8788/openpresenter2/', output));
  assert.equal(url.pathname, '/openpresenter2/obs/output.html');
  assert.equal(url.searchParams.get('scene'), 'stage_music');
  assert.equal(url.searchParams.get('res'), '1280x720');
  assert.equal(url.searchParams.get('fit'), 'contain');
  assert.equal(url.searchParams.has('lockMode'), false, 'OBS must render the exact editable scene, never force a hidden preset');
});

test('OBS links accept custom ids and named content without deriving ids from output names', () => {
  const renamed = { ...output, name: 'Caméra entrée / scène', id: 'out_entry' };
  const url = new URL(buildObsOutputUrl('https://localhost/openpresenter2/index.html', renamed));
  assert.equal(url.searchParams.get('scene'), renamed.id);
  assert.equal(url.searchParams.get('scene'), 'out_entry');
  assert.equal(url.origin, 'https://localhost');
});

test('OBS URL builder rejects unsafe channel ids and impossible browser-source dimensions', () => {
  assert.throws(() => buildObsOutputUrl('http://localhost/openpresenter2/', { ...output, id: '../main' }), /invalide/i);
  assert.throws(() => buildObsOutputUrl('http://localhost/openpresenter2/', { ...output, width: 100 }), /résolution/i);
});
