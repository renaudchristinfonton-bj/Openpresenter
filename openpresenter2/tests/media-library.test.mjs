import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaRecord, detectMediaType, groupMediaItems, mediaTypeLabel, normalizeMediaGroup, pptxSlideToSvg } from '../src/modules/media/library.mjs';

test('media library recognizes V1 image, video, PDF and PowerPoint imports', () => {
  assert.equal(detectMediaType({ name: 'photo.webp', type: '' }), 'image');
  assert.equal(detectMediaType({ name: 'clip.mov', type: '' }), 'video');
  assert.equal(detectMediaType({ name: 'programme.pdf', type: 'application/octet-stream' }), 'pdf');
  assert.equal(detectMediaType({ name: 'office.pptx', type: '' }), 'pptx');
  assert.equal(detectMediaType({ name: 'notes.docx', type: '' }), null);
  const item = createMediaRecord({ name: ' louange.pptx ', type: '', size: 42 }, 'Culte', () => 'media-test');
  assert.equal(item.id, 'media-test');
  assert.equal(item.type, 'pptx');
  assert.equal(item.group, 'Culte');
  assert.equal(item.muted, true);
  assert.equal(item.loop, true);
  assert.equal(mediaTypeLabel(item.type), 'PowerPoint');
});

test('media groups are normalized and bucketed without losing ungrouped items', () => {
  assert.equal(normalizeMediaGroup('  Louange\n'), 'Louange');
  const grouped = groupMediaItems([
    { id: 'a', group: 'Images' }, { id: 'b', group: null }, { id: 'c', group: 'Unknown' },
  ], ['Images', 'Vidéos']);
  assert.deepEqual(grouped.map(([name, items]) => [name, items.map(({ id }) => id)]), [
    ['Images', ['a']], ['', ['b', 'c']],
  ]);
});

test('PowerPoint slide conversion escapes text and embeds only supported image data URLs', () => {
  const svg = decodeURIComponent(pptxSlideToSvg({ widthEMU: 1000, heightEMU: 500 }, {
    background: '#ffffff', shapes: [
      { type: 'text', x: 10, y: 20, w: 500, h: 100, text: '<hello>', color: '#123456', align: 'center', fontSizePt: 24, bold: true },
      { type: 'image', x: 5, y: 5, w: 50, h: 30, dataUrl: 'data:image/png;base64,AAAA' },
      { type: 'image', x: 1, y: 1, w: 20, h: 20, dataUrl: 'javascript:alert(1)' },
    ],
  }).split(',')[1]);
  assert.match(svg, /&lt;hello&gt;/);
  assert.match(svg, /href="data:image\/png;base64,AAAA"/);
  assert.doesNotMatch(svg, /javascript:|<hello>/i);
});
