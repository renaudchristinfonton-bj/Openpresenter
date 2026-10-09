import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const indexPath = fileURLToPath(new URL('../index.html', import.meta.url));
const html = readFileSync(indexPath, 'utf8');

// Exercise the actual module script against a browser-like DOM. Geometry is zero in
// happy-dom, but lifecycle, event wiring, importing, Preview/Program and editor mount
// all run through the real controller code.
test('controller boots, loads the demo Bible, previews, takes live, and opens editor', async (t) => {
  const window = new Window({ url: 'http://localhost:8000/openpresenter2/index.html' });
  const previous = new Map();
  const globals = {
    window,
    document: window.document,
    location: window.location,
    DOMParser: window.DOMParser,
    HTMLElement: window.HTMLElement,
    CSS: window.CSS,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    indexedDB: window.indexedDB,
    confirm: () => true,
    prompt: () => null,
  };
  Object.defineProperty(window.CSS, 'escape', { value: window.CSS.escape || ((value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&')), configurable: true });
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const channels = [];
  window.RemoteChannel = class {
    constructor(name) { this.name = name; this.messages = []; this.onmessage = null; channels.push(this); }
    postMessage(message) { this.messages.push(message); }
  };
  const modulePath = fileURLToPath(new URL('../.controller-smoke-module.mjs', import.meta.url));
  t.after(async () => {
    await window.happyDOM.abort();
    try { unlinkSync(modulePath); } catch { /* already removed */ }
    for (const [key] of Object.entries(globals)) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  window.document.write(html.replace(/<script[\s\S]*?<\/script>/gi, ''));
  const moduleSource = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(moduleSource, 'controller module script exists');
  writeFileSync(modulePath, moduleSource);
  await import(`${pathToFileURL(modulePath).href}?smoke=${Date.now()}`);
  await new Promise((resolve) => setTimeout(resolve, 60));

  window.document.getElementById('bible-load-sample').click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(window.document.querySelector('.book-item')?.querySelector('span')?.textContent, 'Jean');
  assert.equal(window.document.querySelectorAll('.verse-item').length, 4);

  window.document.querySelector('.verse-item').click();
  assert.equal(window.document.getElementById('btn-take').disabled, false, 'a selected verse is available in Preview');
  window.document.getElementById('btn-take').click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(window.document.querySelectorAll('#out-main-canvas .scene-root').length, 1);
  assert.equal(window.document.querySelectorAll('#out-annexe-canvas .scene-root').length, 1);
  assert.ok(channels.some((channel) => channel.messages.some((message) => message.action === 'show')));
  const mainChannel = channels.find((channel) => channel.name === 'op_channel_main');
  mainChannel.onmessage({ data: { action: 'ready', scene: 'main' } });
  mainChannel.onmessage({ data: { action: 'remoteHello', scene: 'main' } });
  mainChannel.onmessage({ data: { action: 'remoteCommand', command: 'next', scene: 'main' } });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(mainChannel.messages.some((message) => message.action === 'remoteAck'));
  assert.ok(mainChannel.messages.some((message) => message.action === 'show' && message.bindings.ref === 'Jean 3:17'));

  // The chapter picker should remain visible after selecting a book.
  window.document.getElementById('bible-back').click();
  window.document.querySelector('.book-item').click();
  assert.equal(window.document.getElementById('chapters-grid').classList.contains('visible'), true);
  [...window.document.querySelectorAll('#chapters-grid .chapter-btn')].find((button) => button.textContent === '3').click();
  assert.equal(window.document.querySelectorAll('.verse-item').length, 4);

  window.document.getElementById('output-scene-select').value = 'annexe';
  window.document.getElementById('btn-editor').click();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(window.document.querySelectorAll('.se-modal').length, 1);
  assert.equal(window.document.querySelectorAll('.se-preset').length, 5);
  assert.ok(window.document.querySelectorAll('.se-layer-row').length >= 4);
  const editorCanvas = window.document.getElementById('se-canvas');
  editorCanvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 960, bottom: 540, width: 960, height: 540 });
  window.dispatchEvent(new window.Event('resize'));
  window.document.querySelector('.se-theme-card[title="Néon"]').click();
  const verseLayerRow = [...window.document.querySelectorAll('.se-layer-row')].find((row) => row.textContent.includes('Verset'));
  verseLayerRow.querySelector('.se-layer-select').click();
  const layerSelector = `#se-canvas-inner [data-layer-id="${verseLayerRow.dataset.layerId}"]`;
  const verseLayer = window.document.querySelector(layerSelector);
  const startX = Number(verseLayer.style.left.replace('%', ''));
  verseLayer.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 480, clientY: 270 }));
  window.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true, button: 0, clientX: 510, clientY: 270 }));
  window.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 510, clientY: 270 }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  const movedX = Number(window.document.querySelector(layerSelector).style.left.replace('%', ''));
  assert.ok(movedX > startX, 'WYSIWYG layer dragging updates the normalized scene geometry');
  window.document.getElementById('se-save').click();
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.ok(channels.find((channel) => channel.name === 'op_channel_annexe').messages.some((message) => message.action === 'show' && message.scene.themeId === 'neon' && message.scene.layers.some((layer) => layer.name === 'Verset' && layer.x > 53)));
  assert.ok(channels.find((channel) => channel.name === 'op_channel_main').messages.some((message) => message.action === 'show' && message.scene.themeId === 'cinema'));

  window.document.querySelector('.nav-btn[data-module="songs"]').click();
  window.document.getElementById('songs-new').click();
  window.document.getElementById('song-edit-title').value = 'Amazing Grace';
  window.document.getElementById('song-edit-artist').value = 'John Newton';
  window.document.getElementById('song-edit-source').value = '[Verse 1]\nAmazing grace\n\n[Chorus]\nI will sing';
  window.document.getElementById('song-edit-source').dispatchEvent(new window.Event('input', { bubbles: true }));
  window.document.getElementById('song-edit-save').click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(window.document.getElementById('song-title').textContent, 'Amazing Grace');
  assert.equal(window.document.querySelectorAll('.song-section-card').length, 2);
  window.document.getElementById('song-take').click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(channels.find((channel) => channel.name === 'op_channel_main').messages.some((message) => message.action === 'show' && message.scene.kind === 'songs' && message.bindings.title === 'Amazing Grace'));

  window.document.querySelector('.nav-btn[data-module="slides"]').click();
  window.document.getElementById('announcement-title').value = 'Bienvenue';
  window.document.getElementById('announcement-body').value = 'Nous sommes heureux de vous accueillir.';
  window.document.getElementById('announcement-save').click();
  await new Promise((resolve) => setTimeout(resolve, 30));
  window.document.getElementById('announcement-preview').click();
  window.document.getElementById('slides-take').click();
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.ok(mainChannel.messages.some((message) => message.action === 'show' && message.scene.kind === 'announcements' && message.bindings.announcement.includes('accueillir')));

  window.document.getElementById('announcement-new').click();
  window.document.getElementById('announcement-title').value = 'Annonce suivante';
  window.document.getElementById('announcement-body').value = 'Deuxième annonce de la séquence.';
  window.document.getElementById('announcement-save').click();
  await new Promise((resolve) => setTimeout(resolve, 30));
  mainChannel.onmessage({ data: { action: 'remoteCommand', command: 'next', scene: 'main' } });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.ok([...mainChannel.messages].reverse().find((message) => message.action === 'show')?.bindings.title === 'Annonce suivante', 'remote next advances the live announcement');
  mainChannel.onmessage({ data: { action: 'remoteCommand', command: 'prev', scene: 'main' } });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.ok([...mainChannel.messages].reverse().find((message) => message.action === 'show')?.bindings.title === 'Bienvenue', 'remote previous returns to the prior live announcement');

  window.document.querySelector('.nav-btn[data-module="timer"]').click();
  window.document.getElementById('timer-minutes').value = '0';
  window.document.getElementById('timer-seconds').value = '3';
  window.document.getElementById('timer-seconds').dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.getElementById('timer-preview').click();
  window.document.getElementById('timer-take').click();
  window.document.getElementById('timer-start').click();
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.ok(mainChannel.messages.some((message) => message.action === 'show' && message.scene.kind === 'timer' && message.bindings.timer === '00:02'));
  const bibleSelectionBeforeTimerNavigation = window.document.getElementById('bible-selection-info').textContent;
  const liveUpdatesBeforeTimerNavigation = mainChannel.messages.filter((message) => message.action === 'show').length;
  mainChannel.onmessage({ data: { action: 'remoteCommand', command: 'next', scene: 'main' } });
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(window.document.getElementById('bible-selection-info').textContent, bibleSelectionBeforeTimerNavigation, 'remote next while the timer is live must not navigate the Bible');
  assert.equal(mainChannel.messages.filter((message) => message.action === 'show').length, liveUpdatesBeforeTimerNavigation, 'remote next while the timer is live must not replace the live timer');
  window.document.getElementById('timer-pause').click();
});
