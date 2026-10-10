import test from 'node:test';
import assert from 'node:assert/strict';
import { applyViewport, computeViewport, resolveBrowserSourceViewport } from '../src/core/viewport.mjs';

test('16:9 browser sources map the 1920×1080 design one-to-one with no offset', () => {
  assert.deepEqual(computeViewport(1920, 1080), {
    scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0,
    viewportWidth: 1920, viewportHeight: 1080, mode: 'contain',
  });
  const hd = computeViewport(1280, 720);
  assert.equal(hd.scaleX, 2 / 3);
  assert.equal(hd.scaleY, 2 / 3);
  assert.equal(hd.offsetX, 0);
  assert.equal(hd.offsetY, 0);
});

test('OBS keeps the browser-reported CSS viewport instead of promoting high-DPI sizes to physical pixels', () => {
  assert.deepEqual(resolveBrowserSourceViewport(960, 540, { width: 1920, height: 1080 }), { width: 960, height: 540 });
  assert.deepEqual(resolveBrowserSourceViewport(640, 360, { width: 1280, height: 720 }), { width: 640, height: 360 });
  assert.deepEqual(resolveBrowserSourceViewport(1365, 768, { width: 1920, height: 1080 }), { width: 1365, height: 768 });
  assert.deepEqual(resolveBrowserSourceViewport(0, Number.NaN, { width: 1920, height: 1080 }), { width: 1920, height: 1080 }, 'configured output dimensions are used only when CEF reports an invalid CSS viewport');
});

test('contain preserves the whole frame and computes centered transparent letterboxes', () => {
  const viewport = computeViewport(1280, 1024, 'contain');
  assert.equal(viewport.scaleX, 2 / 3);
  assert.equal(viewport.scaleY, 2 / 3);
  assert.equal(viewport.offsetX, 0);
  assert.equal(viewport.offsetY, 152);
});

test('cover centers intentional crop and stretch fills all pixels without translation', () => {
  const cover = computeViewport(1024, 768, 'cover');
  assert.equal(cover.scaleX, 768 / 1080);
  assert.ok(cover.offsetX < 0);
  assert.equal(cover.offsetY, 0);
  const stretch = computeViewport(1024, 768, 'stretch');
  assert.equal(stretch.scaleX, 1024 / 1920);
  assert.equal(stretch.scaleY, 768 / 1080);
  assert.equal(stretch.offsetX, 0);
  assert.equal(stretch.offsetY, 0);
});

test('viewport DOM transform uses explicit top-left offsets without percentage translation', () => {
  const element = { style: {}, dataset: {} };
  applyViewport(element, 1280, 1024, 'contain');
  assert.equal(element.style.width, '1920px');
  assert.equal(element.style.height, '1080px');
  assert.equal(element.style.left, '0px');
  assert.equal(element.style.top, '152px');
  assert.equal(element.style.transformOrigin, 'top left');
  assert.equal(element.style.transform, `scale(${2 / 3}, ${2 / 3})`);
  assert.equal(element.dataset.offsetY, '152');

  applyViewport(element, 1280, 1024, 'cover');
  assert.ok(Number.parseFloat(element.style.left) < 0, 'cover crop is centered with a negative horizontal offset');
  assert.equal(element.style.top, '0px');
});

test('invalid viewport geometry is rejected instead of creating shifted or NaN output', () => {
  for (const args of [[0, 1080], [1920, -1], ['not-a-size', 1080], [1920, 1080, 'bad', 0, 1080]]) {
    assert.throws(() => computeViewport(...args), /dimensions/i);
  }
});
