import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const indexPath = fileURLToPath(new URL('../index.html', import.meta.url));
const modulePath = fileURLToPath(new URL('../.media-smoke-module.mjs', import.meta.url));
const html = readFileSync(indexPath, 'utf8');

async function waitFor(check, message, timeout = 2500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(message);
}

test('media import, grouping, preview, per-output layout, take, and video controls run through the controller', async (t) => {
  const window = new Window({ url: 'http://localhost:8788/openpresenter2/index.html' });
  const previous = new Map();
  const nativeURL = globalThis.URL;
  const urlRecords = [];
  class URLShim extends nativeURL {
    static createObjectURL(blob) { const url = `blob:media-smoke-${urlRecords.length + 1}`; urlRecords.push({ blob, url }); return url; }
    static revokeObjectURL() {}
  }
  const globals = {
    window,
    document: window.document,
    location: window.location,
    DOMParser: window.DOMParser,
    HTMLElement: window.HTMLElement,
    Event: window.Event,
    Blob: window.Blob,
    URL: URLShim,
    CSS: window.CSS,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    indexedDB: window.indexedDB,
    confirm: () => true,
    prompt: () => 'Louange',
    fetch: async (url) => {
      assert.equal(url, './api/network-addresses');
      return { ok: true, json: async () => ({ port: 8788, addresses: [] }) };
    },
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
  assert.ok(moduleSource);
  writeFileSync(modulePath, moduleSource);
  await import(`${pathToFileURL(modulePath).href}?smoke=${Date.now()}`);
  await waitFor(() => window.document.querySelector('#output-cards .output-block'), 'controller booted');
  assert.equal(window.document.getElementById('media-take-button').disabled, true, 'Diffuser starts disabled without a selected item');

  const stageChannel = channels.find((channel) => channel.name === 'op_stage');
  stageChannel.onmessage({ data: { action: 'stageCommand', command: 'message-send', text: 'Le chœur est prêt.', tone: 'important', author: 'Régie' } });
  await waitFor(() => stageChannel.messages.some((message) => message.action === 'stageUpdate' && message.messages?.[0]?.text === 'Le chœur est prêt.'), 'stage message is persisted and broadcast to the pastor view');
  const timerLabel = window.document.getElementById('timer-label');
  const timerMinutes = window.document.getElementById('timer-minutes');
  timerLabel.value = 'Louange'; timerMinutes.value = '5'; timerMinutes.dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.getElementById('timer-add-queue').click();
  timerLabel.value = 'Prédication'; timerMinutes.value = '10'; timerMinutes.dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.getElementById('timer-add-queue').click();
  assert.equal(window.document.getElementById('timer-queue-count').textContent, '2');
  window.document.querySelector('.timer-queue-item button[title="Descendre"]').click();
  assert.equal(window.document.querySelector('.timer-queue-item .timer-queue-title').textContent, 'Prédication', 'the countdown order can be changed');
  window.document.getElementById('timer-queue-start').click();
  assert.equal(window.document.getElementById('timer-display').textContent, '10:00');
  window.document.getElementById('timer-pause').click();

  window.document.getElementById('media-new-group').click();
  await waitFor(() => [...window.document.getElementById('media-import-group').options].some((option) => option.value === 'Louange'), 'media group was created');
  window.document.getElementById('media-import-group').value = 'Louange';
  const imageFile = new window.File(['png test'], 'cover.png', { type: 'image/png' });
  const input = window.document.getElementById('media-import-files');
  Object.defineProperty(input, 'files', { configurable: true, value: [imageFile] });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => window.document.querySelector('.media-item-row[data-media-id]'), 'imported image appears in the library');
  await waitFor(() => window.document.querySelector('#media-preview-stage img'), 'imported image appears in the media preview');
  const imageRow = window.document.querySelector('.media-item-row[data-media-id]');
  assert.match(imageRow.textContent, /cover\.png/);
  assert.equal(imageRow.querySelector('select').value, 'Louange');
  assert.equal(window.document.getElementById('media-take-button').disabled, false);

  window.document.getElementById('media-fit-mode').value = 'cover';
  window.document.getElementById('media-fit-mode').dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.getElementById('media-preview-button').click();
  await waitFor(() => window.document.querySelector('#out-preview-canvas .scene-root'), 'preview canvas rendered');
  assert.equal(window.document.querySelector('#out-preview-canvas .layer-image img')?.style.objectFit, 'cover');
  window.document.getElementById('output-scene-select').value = 'annexe';
  window.document.getElementById('output-scene-select').dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(window.document.getElementById('media-fit-mode').value, 'contain', 'the other output keeps its independent fit setting');
  window.document.getElementById('output-scene-select').value = 'main';
  window.document.getElementById('output-scene-select').dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(window.document.getElementById('media-fit-mode').value, 'cover');

  window.document.getElementById('media-take-button').click();
  const mainChannel = channels.find((channel) => channel.name === 'op_channel_main');
  const imageShow = await waitFor(() => [...mainChannel.messages].reverse().find((message) => message.action === 'show' && message.scene?.kind === 'media'), 'image was sent to the OBS output');
  assert.equal(imageShow.bindings.mediaName, 'cover.png');
  assert.ok(imageShow.bindings.media, 'the original local image payload is sent to the output');
  assert.equal(imageShow.bindings.media.type, 'image/png');
  assert.equal(imageShow.bindings.media.type, 'image/png', 'the image MIME type is sent to the output');
  assert.equal(window.document.querySelectorAll('#out-main-canvas .layer-image img').length, 1);
  assert.equal(window.document.querySelector('#out-main-canvas .layer-image img').style.objectFit, 'cover');

  const videoFile = new window.File(['video test'], 'clip.mp4', { type: 'video/mp4' });
  Object.defineProperty(input, 'files', { configurable: true, value: [videoFile] });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => window.document.querySelector('#media-preview-stage video#media-panel-video'), 'imported video appears in the media preview');
  const panelVideo = window.document.getElementById('media-panel-video');
  panelVideo.play = () => Promise.resolve();
  panelVideo.pause = () => {};
  window.document.getElementById('media-take-button').click();
  await waitFor(() => [...mainChannel.messages].reverse().find((message) => message.action === 'show' && message.scene?.kind === 'media' && message.bindings.mediaType === 'video'), 'video was sent to the OBS output');
  window.document.getElementById('media-video-play').click();
  await waitFor(() => mainChannel.messages.some((message) => message.action === 'mediaControl' && message.mediaItemId && message.control?.play === true), 'video play command reached the live output');
  window.document.getElementById('media-video-muted').checked = false;
  window.document.getElementById('media-video-muted').dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => mainChannel.messages.some((message) => message.action === 'mediaControl' && message.control?.muted === false), 'video mute command reached the live output');
  assert.equal(window.document.querySelector('#out-main-canvas video.scene-media-video')?.muted, false);

  window.document.getElementById('btn-search').click();
  const search = window.document.getElementById('global-search-input');
  search.value = 'cover'; search.dispatchEvent(new window.Event('input', { bubbles: true }));
  await waitFor(() => window.document.querySelector('.global-search-result'), 'unified search finds an imported media item');
  search.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await waitFor(() => [...mainChannel.messages].reverse().find((message) => message.action === 'show' && message.scene?.kind === 'media' && message.bindings.mediaName === 'cover.png'), 'search result can be diffused with Enter');
});
