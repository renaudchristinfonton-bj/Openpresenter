// Modèle de scène : bornes, presets, calques, validation (EF-09.1 → EF-09.10).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KINDS, PRESETS, LAYER_TYPES,
  clampLayer, textLayer, backgroundLayer, overlayLayer, imageLayer,
  sceneFromPreset, defaultScenes, normalizeScene, validateScene,
  addLayer, removeLayer, duplicateLayer, moveLayer, sendToEdge, updateLayer
} from '../src/core/scene.mjs';

test('les presets et types couvrent le cahier des charges', () => {
  for (const preset of ['full', 'screen80', 'bottom', 'bottom-right', 'lowerthird']) {
    assert.ok(PRESETS.includes(preset), preset);
  }
  for (const kind of ['bible', 'songs', 'media', 'announcements', 'lowerthird', 'timer', 'plan']) {
    assert.ok(KINDS.includes(kind), kind);
  }
  for (const type of ['background', 'overlay', 'text', 'image', 'group']) {
    assert.ok(LAYER_TYPES.includes(type), type);
  }
});

test('EF-09.3 : la largeur reste dans [2 ; 300]', () => {
  assert.equal(clampLayer({ w: 0 }).w, 2);
  assert.equal(clampLayer({ w: -40 }).w, 2);
  assert.equal(clampLayer({ w: 900 }).w, 300);
  assert.equal(clampLayer({ w: 55 }).w, 55);
});

test('EF-09.3 : la hauteur reste dans [2 ; 300] ou nulle (auto)', () => {
  assert.equal(clampLayer({ h: 0 }).h, 2);
  assert.equal(clampLayer({ h: 500 }).h, 300);
  assert.equal(clampLayer({ h: null }).h, null);
  assert.equal(clampLayer({ h: undefined }).h, null);
});

test('EF-09.4 : un calque ne peut pas sortir entièrement du canevas', () => {
  // Centre borné à ±w/2 ∓ 1 : il reste toujours 1 % visible de chaque côté.
  const large = clampLayer({ x: -500, w: 40 });
  assert.equal(large.x, -19);
  const right = clampLayer({ x: 500, w: 40 });
  assert.equal(right.x, 119);
  // Une valeur déjà dans les bornes n'est jamais déplacée.
  assert.equal(clampLayer({ x: 0, w: 300 }).x, 0);
  assert.equal(clampLayer({ x: 249, w: 300 }).x, 249);
  assert.equal(clampLayer({ x: 260, w: 300 }).x, 249);
});

test('une scène de preset est valide et porte des calques attendus', () => {
  for (const preset of ['full', 'bottom']) {
    const scene = sceneFromPreset({ id: `scn_test_${preset}`, name: preset, kind: 'bible', preset });
    const report = validateScene(scene);
    assert.equal(report.ok, true, `${preset} : ${JSON.stringify(report.errors)}`);
    assert.ok(scene.layers.some((layer) => layer.bind === 'verse'));
    assert.ok(scene.layers.some((layer) => layer.bind === 'ref'));
  }
});

test('le bandeau « bas centré » a un fond semi-transparent et aucun alignement fantôme', () => {
  const scene = sceneFromPreset({ id: 'scn_bottom01', name: 'Bandeau', kind: 'bible', preset: 'bottom' });
  const overlay = scene.layers.find((layer) => layer.type === 'overlay');
  assert.ok(overlay, 'bandeau présent');
  assert.match(overlay.bg, /rgba/);
  const ref = scene.layers.find((layer) => layer.bind === 'ref');
  assert.equal(ref.style.align, 'right');
  assert.equal(ref.style.textAlign, undefined, 'aucune clé de style inventée');
});

test('scenes par défaut : une par sortie et par type, identifiants conformes', () => {
  const list = defaultScenes();
  assert.equal(list.length, 4);
  const pairs = new Set(list.map((entry) => `${entry.outputId}/${entry.kind}`));
  assert.deepEqual([...pairs].sort(), ['out_bottom/bible', 'out_bottom/songs', 'out_full/bible', 'out_full/songs']);
  for (const entry of list) {
    assert.match(entry.scene.id, /^scn_[a-z0-9_]{3,40}$/, entry.scene.id);
    assert.equal(validateScene(entry.scene).ok, true);
  }
});

test('normalizeScene complète les manques sans écraser les valeurs fournies', () => {
  const scene = normalizeScene({ id: 'scn_norm_01', kind: 'bible', layers: [{ type: 'text', bind: 'verse', x: 50, y: 40 }] });
  assert.equal(scene.layers[0].w, 100);
  assert.equal(scene.layers[0].x, 50);
  assert.equal(scene.layers[0].visible, true);
  assert.match(scene.layers[0].id, /^lyr_/);
  assert.equal(scene.layers[0].style.align, 'center');
});

test('validateScene signale un calque inconnu et un alignement invalide', () => {
  const scene = normalizeScene({
    id: 'scn_bad_01',
    name: 'Scène abîmée',
    kind: 'bible',
    layers: [
      { id: 'lyr_a', type: 'hologram', x: 50, y: 50, w: 40, h: 10 },
      { id: 'lyr_b', type: 'text', bind: 'verse', x: 50, y: 50, w: 40, h: 10, style: { align: 'diagonale' } }
    ]
  });
  const report = validateScene(scene);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => /type de calque inconnu/i.test(error.message)));
  assert.ok(report.errors.some((error) => /alignement inconnu/i.test(error.message)));
});

test('validateScene refuse un identifiant hors format', () => {
  const scene = normalizeScene({ id: 'pas-un-id', kind: 'bible', layers: [] });
  const report = validateScene(scene);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.path.includes('id')));
});

test('EF-09.1 : ajouter, dupliquer, supprimer et déplacer des calques', () => {
  let scene = normalizeScene({ id: 'scn_edit_01', name: 'Édition', kind: 'bible', layers: [textLayer({ id: 'lyr_aa', name: 'A' })] });
  assert.equal(scene.layers.length, 1);

  scene = addLayer(scene, textLayer({ id: 'lyr_bb', name: 'B' }));
  assert.equal(scene.layers.length, 2);
  assert.equal(scene.layers[1].name, 'B');

  scene = duplicateLayer(scene, 'lyr_aa');
  assert.equal(scene.layers.length, 3);
  assert.notEqual(scene.layers[2].id, 'lyr_aa', 'la copie reçoit un identifiant neuf');

  // `moveLayer` prend un **déplacement relatif** (ch. 08 § 8.5).
  scene = moveLayer(scene, 'lyr_bb', -1);
  assert.equal(scene.layers[0].id, 'lyr_bb');

  scene = sendToEdge(scene, 'lyr_bb', 'front');
  assert.equal(scene.layers.at(-1).id, 'lyr_bb');

  scene = removeLayer(scene, 'lyr_aa');
  assert.equal(scene.layers.length, 2);
  assert.equal(updateLayer(scene, 'lyr_bb', { name: 'B2' }).layers.find((l) => l.id === 'lyr_bb').name, 'B2');
});

test('les fabriques de calques produisent des objets valides et indépendants', () => {
  const background = backgroundLayer();
  const overlay = overlayLayer();
  const image = imageLayer();
  const text = textLayer();
  assert.equal(background.type, 'background');
  assert.equal(overlay.type, 'overlay');
  assert.equal(image.type, 'image');
  assert.equal(text.type, 'text');
  assert.notEqual(text.style, textLayer().style, 'pas de style partagé entre calques');
  for (const layer of [background, overlay, image, text]) {
    assert.match(layer.id, /^lyr_[a-z0-9]{2,40}$/);
  }
});

test('la géométrie déclarée reste dans les bornes après normalisation', () => {
  const scene = normalizeScene({
    id: 'scn_geo_01',
    kind: 'bible',
    layers: [{ id: 'lyr_x', type: 'text', bind: 'verse', x: 400, y: -200, w: 12, h: 4 }]
  });
  const [layer] = scene.layers;
  assert.ok(layer.x >= -layer.w / 2 + 1, 'bord gauche visible');
  assert.ok(layer.x <= 100 + layer.w / 2 - 1, 'bord droit visible');
  assert.ok(layer.y >= -(layer.h ?? 0) / 2 + 1);
  assert.ok(layer.y <= 100 + (layer.h ?? 0) / 2 - 1);
});
