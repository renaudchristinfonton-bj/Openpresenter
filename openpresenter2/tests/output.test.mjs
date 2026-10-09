import test from 'node:test';
import assert from 'node:assert/strict';
import Engine from '../src/core/engine.mjs';
import { applyLockedPreset } from '../src/core/output.mjs';

test('output lock applies preset geometry while preserving the output theme', () => {
  const source = Engine.defaultScene('full', 'bible');
  const reference = source.layers.find((layer) => layer.bind === 'ref');
  reference.style.color = '#37d6cc';
  reference.x = 13;
  const image = Engine.createLayer('image', { name: 'Logo', assetId: 'asset-logo', src: 'blob:logo', x: 8, y: 10 });
  source.layers.push(image);
  const locked = applyLockedPreset(source, 'bottom');
  const bottomReference = locked.layers.find((layer) => layer.bind === 'ref');
  assert.equal(locked.preset, 'bottom');
  assert.equal(bottomReference.style.color, '#37d6cc');
  assert.notEqual(bottomReference.x, 13, 'locked layout uses the selected preset geometry');
  assert.equal(locked.layers.find((layer) => layer.name === 'Logo').src, 'blob:logo');
  assert.notEqual(locked.layers.find((layer) => layer.name === 'Logo'), image, 'output clone must not mutate controller state');
});

test('matching output lock does not overwrite custom WYSIWYG positions', () => {
  const scene = Engine.defaultScene('bottom', 'songs');
  scene.layers[1].x = 23.5;
  assert.equal(applyLockedPreset(scene, 'bottom'), scene);
  assert.equal(scene.layers[1].x, 23.5);
});

test('locked announcement output keeps its built-in image once and preserves extra movable images', () => {
  const source = Engine.defaultScene('full', 'announcements');
  const announcementImage = source.layers.find((layer) => layer.type === 'image');
  announcementImage.src = 'blob:announcement-background';
  announcementImage.assetId = 'asset-announcement';
  announcementImage.fit = 'contain';
  source.layers.push(Engine.createLayer('image', { name: 'Logo', src: 'blob:logo', assetId: 'asset-logo', x: 84, y: 14 }));

  const locked = applyLockedPreset(source, 'bottom');
  const images = locked.layers.filter((layer) => layer.type === 'image');
  assert.equal(images.length, 2, 'one bound announcement image plus one extra logo');
  const bound = images.find((layer) => layer.name === 'Image annonce');
  assert.equal(bound.src, 'blob:announcement-background');
  assert.equal(bound.assetId, 'asset-announcement');
  assert.equal(bound.fit, 'contain');
  assert.equal(bound.x, 17, 'the built-in image follows the locked bottom preset geometry');
  const logo = images.find((layer) => layer.name === 'Logo');
  assert.equal(logo.src, 'blob:logo');
  assert.equal(logo.x, 84, 'extra decorative images retain their own geometry');
});
