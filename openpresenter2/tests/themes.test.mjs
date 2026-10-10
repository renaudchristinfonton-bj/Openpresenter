import test from 'node:test';
import assert from 'node:assert/strict';
import Engine from '../src/core/engine.mjs';
import { THEMES, applyThemeToScene, getTheme } from '../src/core/themes.mjs';

test('all six V1 look palettes are available as reusable V2 themes', () => {
  const expected = ['sobre', 'festif', 'careme', 'noel', 'aube', 'mission'];
  for (const id of expected) assert.ok(THEMES.some((theme) => theme.id === id), `${id} palette should be registered`);
  assert.equal(getTheme('careme').name, 'Carême');
  assert.equal(getTheme('noel').accent, '#ef4444');
});

test('applying a theme updates scene background, panel geometry, accent and foreground text', () => {
  const scene = Engine.defaultScene('full', 'bible');
  const overlay = scene.layers.find((layer) => layer.type === 'overlay');
  const title = scene.layers.find((layer) => layer.bind === 'ref');
  applyThemeToScene(scene, 'festif');
  assert.equal(scene.themeId, 'festif');
  assert.equal(scene.accentColor, '#facc15');
  assert.equal(scene.textColor, '#ffffff');
  assert.equal(scene.shapeRadius, 32);
  assert.equal(scene.layers.find((layer) => layer.type === 'background').source.color1, '#4c1d95');
  assert.equal(overlay.radius, 32);
  assert.equal(title.style.color, '#facc15');
});

test('applying themes preserves a custom image background and maps light-theme text colors', () => {
  const scene = Engine.defaultScene('full', 'songs');
  const background = scene.layers.find((layer) => layer.type === 'background');
  background.source = { kind: 'image', image: 'blob:test-image', assetId: 'asset_test', fit: 'cover', blur: 6 };
  applyThemeToScene(scene, 'aube');
  assert.equal(background.source.image, 'blob:test-image');
  assert.equal(background.source.blur, 6);
  assert.equal(scene.layers.find((layer) => layer.type === 'overlay').radius, 28);
  assert.equal(scene.layers.find((layer) => layer.bind === 'lyrics').style.color, '#1e293b');
});
