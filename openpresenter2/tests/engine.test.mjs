import test from 'node:test';
import assert from 'node:assert/strict';
import Engine, { createLayer, defaultScene, splitSmart, hexToRgba, rgbToHex } from '../src/core/engine.mjs';

const presets = ['full', 'screen80', 'bottom', 'bottom-right', 'lowerthird'];
const kinds = ['bible', 'songs', 'announcements', 'timer'];

test('the engine is importable without a browser DOM', () => {
  assert.equal(typeof Engine.render, 'function');
  assert.equal(Engine.render(defaultScene('full', 'bible'), null), null);
});

test('all supplied presets build complete independent scenes for every module', () => {
  for (const kind of kinds) {
    for (const preset of presets) {
      const scene = defaultScene(preset, kind);
      assert.equal(scene.preset, preset);
      assert.equal(scene.kind, kind);
      assert.ok(scene.layers.length >= 4, `${kind}/${preset} should contain design layers`);
      assert.equal(new Set(scene.layers.map((layer) => layer.id)).size, scene.layers.length, 'layer ids should be unique');
      for (const layer of scene.layers) {
        assert.ok(['background', 'overlay', 'text', 'image'].includes(layer.type));
        assert.ok(Number.isFinite(layer.x) && layer.x >= 0 && layer.x <= 100);
        assert.ok(Number.isFinite(layer.y) && layer.y >= 0 && layer.y <= 100);
        assert.ok(Number.isFinite(layer.w) && layer.w > 0 && layer.w <= 100);
      }
    }
  }
});

test('announcement scenes contain a bound, editable media-image layer and timer scenes bind their clock', () => {
  const announcement = defaultScene('full', 'announcements');
  assert.ok(announcement.layers.some((layer) => layer.type === 'image' && layer.bind === 'image'));
  assert.ok(announcement.layers.some((layer) => layer.type === 'text' && layer.bind === 'announcement'));
  const timer = defaultScene('full', 'timer');
  assert.ok(timer.layers.some((layer) => layer.type === 'text' && layer.bind === 'timer'));
});

test('scenes are deeply independent between instances', () => {
  const first = defaultScene('bottom', 'bible');
  first.layers[1].bg = '#ff00ff';
  first.layers.push(createLayer('text'));
  const second = defaultScene('bottom', 'bible');
  assert.notEqual(second.layers[1].bg, '#ff00ff');
  assert.equal(second.layers.length, first.layers.length - 1);
});

test('createLayer rejects unsupported types and merges supplied options', () => {
  assert.throws(() => createLayer('video'), /Type de calque inconnu/);
  const layer = createLayer('text', { name: 'Reference', bind: 'ref', x: 22 });
  assert.equal(layer.name, 'Reference');
  assert.equal(layer.bind, 'ref');
  assert.equal(layer.x, 22);
  assert.equal(layer.style.fontFamily, 'Merriweather');
});

test('splitSmart covers long text without losing words or punctuation', () => {
  const source = 'Au commencement Dieu créa les cieux et la terre. Puis il dit : que la lumière soit ! Et la lumière fut, et le jour se leva sur la terre.';
  const parts = splitSmart(source, 43);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((part) => part.length <= 43));
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), source.replace(/\s+/g, ' '));
  assert.deepEqual(splitSmart('Court.', 20), ['Court.']);
  assert.deepEqual(splitSmart('', 20), ['']);
});

test('split bindings follow each output scene without mutating the full source content', () => {
  const source = { ref: 'Jean 3:16', verse: 'Au commencement, Dieu créa les cieux et la terre. '.repeat(5) };
  const fullScene = defaultScene('full', 'bible');
  const bottomScene = defaultScene('bottom', 'bible');
  bottomScene.splitChars = 52;

  const full = Engine.prepareBindingsForScene(fullScene, 'bible', source);
  const bottom = Engine.prepareBindingsForScene(bottomScene, 'bible', source, 1);
  assert.equal(full.parts, undefined, 'a scene configured for full text does not inherit another output’s split');
  assert.equal(full.verse, source.verse);
  assert.ok(bottom.parts.length > 1);
  assert.equal(bottom.partIndex, 1);
  assert.equal(bottom.verse, bottom.parts[1]);
  assert.equal(source.verse, 'Au commencement, Dieu créa les cieux et la terre. '.repeat(5), 'source bindings stay intact for other outputs');

  const announcement = Engine.prepareBindingsForScene(
    { splitMode: 'auto', splitChars: 40 }, 'announcements', { announcement: 'Bienvenue à notre rassemblement. '.repeat(4) },
  );
  assert.ok(announcement.parts.length > 1, 'announcement messages use the same output-specific splitting engine');
  assert.equal(announcement.announcement, announcement.parts[0]);
});

test('color helpers support short hex, full hex, alpha, and rgb conversion', () => {
  assert.equal(hexToRgba('#abc', 0.5), 'rgba(170,187,204,0.5)');
  assert.equal(hexToRgba('#112233', 1), 'rgba(17,34,51,1)');
  assert.equal(rgbToHex('rgba(17, 34, 51, .5)'), '#112233');
  assert.equal(rgbToHex('#abc'), '#aabbcc');
});
