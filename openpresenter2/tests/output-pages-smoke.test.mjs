import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import Engine from '../src/core/engine.mjs';
import { computeViewport } from '../src/core/viewport.mjs';

function savedGlobals(keys) {
  return new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
}
function restoreGlobals(previous) {
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}

// Exercise the actual OBS and stage page modules with the same scene packets used
// by the controller. Happy-dom has no pixel renderer, but DOM and media lifecycle run.
test('OBS and stage pages render remote image blobs, release old URLs, and show module content', async (t) => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const pages = [
    { html: 'obs/output.html', temp: 'obs/.output-smoke-module.mjs', url: 'http://localhost:8788/openpresenter2/obs/output.html?scene=annexe&fit=contain&res=1920x1080&debug=1' },
    { html: 'app/stage.html', temp: 'app/.stage-smoke-module.mjs', url: 'http://localhost:8788/openpresenter2/app/stage.html?scene=main' },
  ];
  const globals = ['window', 'document', 'location', 'Blob', 'URL', 'requestAnimationFrame', 'cancelAnimationFrame', 'setInterval', 'clearInterval'];
  const previous = savedGlobals(globals);
  const createdURLs = [];
  const revokedURLs = [];
  const nativeURL = globalThis.URL;
  class URLShim extends nativeURL {
    static createObjectURL(blob) {
      assert.ok(blob instanceof Blob);
      const url = `blob:smoke-${createdURLs.length + 1}`;
      createdURLs.push(url); return url;
    }
    static revokeObjectURL(url) { revokedURLs.push(url); }
  }
  globalThis.URL = URLShim;
  const channels = [];
  let window;
  t.after(async () => {
    await window?.happyDOM.abort();
    for (const page of pages) {
      try { unlinkSync(`${root}/${page.temp}`); } catch { /* already removed */ }
    }
    restoreGlobals(previous);
    globalThis.URL = nativeURL;
  });

  for (const page of pages) {
    window = new Window({ url: page.url });
    if (page.html.startsWith('obs/')) {
      window.innerWidth = 960; window.innerHeight = 540;
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    }
    globalThis.window = window;
    globalThis.document = window.document;
    globalThis.location = window.location;
    globalThis.Blob = Blob;
    globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
    globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    globalThis.setInterval = window.setInterval.bind(window);
    globalThis.clearInterval = window.clearInterval.bind(window);
    window.RemoteChannel = class {
      constructor(name) { this.name = name; this.messages = []; this.onmessage = null; channels.push(this); }
      postMessage(message) { this.messages.push(message); }
    };
    const html = readFileSync(`${root}/${page.html}`, 'utf8');
    window.document.write(html.replace(/<script[\s\S]*?<\/script>/gi, ''));
    const moduleSource = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(moduleSource, `${page.html} contains a module script`);
    writeFileSync(`${root}/${page.temp}`, moduleSource);
    await import(`${pathToFileURL(`${root}/${page.temp}`).href}?smoke=${Date.now()}`);

    if (page.html.startsWith('obs/')) {
      const stage = window.document.getElementById('stage');
      const configuredViewport = computeViewport(960, 540, 'contain');
      assert.equal(stage.dataset.scaleX, String(configuredViewport.scaleX), 'a half-size CEF CSS viewport is kept in CSS pixels even when the OBS source is 1920×1080');
      assert.equal(stage.dataset.scaleY, String(configuredViewport.scaleY));
      assert.equal(stage.style.left, '0px'); assert.equal(stage.style.top, '0px');
      assert.equal(stage.style.transformOrigin, 'top left');
      assert.equal(window.document.getElementById('viewport-debug').hidden, false);
      assert.match(window.document.getElementById('viewport-debug').textContent, /CEF viewport: 960×540 CSS px · DPR 2/);
      assert.match(window.document.getElementById('viewport-debug').textContent, /Applied: 960×540 · scale 0\.500×0\.500/);
      window.innerWidth = 1280; window.innerHeight = 1024;
      window.dispatchEvent(new window.Event('resize'));
      const portraitishViewport = computeViewport(1280, 1024, 'contain');
      assert.equal(stage.dataset.scaleX, String(portraitishViewport.scaleX));
      assert.equal(stage.dataset.offsetY, String(portraitishViewport.offsetY));
      assert.equal(stage.style.top, '152px', 'letterboxing is applied as an explicit pixel offset, not a compound transform');
      window.innerWidth = 1920; window.innerHeight = 1080;
      window.dispatchEvent(new window.Event('resize'));
      assert.equal(stage.dataset.scaleX, '1', 'OBS resize resets the design canvas to a 1:1 frame');
      assert.equal(stage.dataset.offsetY, '0');
    }

    const sceneKey = new URL(page.url).searchParams.get('scene') || 'main';
    const channel = channels.findLast((candidate) => candidate.name === `op_channel_${sceneKey}`);
    const firstImage = new Blob(['first image'], { type: 'image/png' });
    channel.onmessage({
      data: {
        action: 'show',
        scene: Engine.defaultScene('full', 'announcements'),
        bindings: { title: 'Bienvenue', section: 'ANNONCE', announcement: 'Bonjour', image: firstImage },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const canvas = window.document.querySelector(page.html.startsWith('obs/') ? '#stage' : '#stage-canvas');
    assert.equal(canvas.querySelectorAll('.layer-image img').length, 1, `${page.html} renders the bound image once`);
    assert.equal(canvas.querySelector('.layer-image img').getAttribute('src'), createdURLs.at(-1));
    assert.ok(canvas.querySelector('.scene-root').classList.contains('scene-enter-fade'), `${page.html} applies the scene’s entrance transition`);

    if (page.html.startsWith('obs/')) {
      const secondImage = new Blob(['second image'], { type: 'image/png' });
      channel.onmessage({
        data: {
          action: 'show',
          scene: Engine.defaultScene('full', 'announcements'),
          bindings: { title: 'Deuxième', announcement: 'Suite', image: secondImage },
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.deepEqual(revokedURLs, ['blob:smoke-1'], 'OBS revokes the prior image URL when a new slide arrives');
      channel.onmessage({ data: { action: 'hide' } });
      assert.ok(window.document.querySelector('#stage .scene-root')?.classList.contains('scene-exit-fade'), 'OBS applies the scene’s exit transition before clearing it');
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.ok(revokedURLs.includes('blob:smoke-2'), 'OBS revokes media after the hide transition completes');
      const logoBlob = new Blob(['lower-third logo'], { type: 'image/png' });
      const lowerThirdScene = Engine.defaultScene('lowerthird', 'lowerthird');
      channel.onmessage({ data: { action: 'show', scene: lowerThirdScene, bindings: { title: 'Jean Dupont', announcement: 'Invité', image: logoBlob, imageAssetId: 'lowerthird-logo-1', mediaType: 'image' } } });
      await new Promise((resolve) => setTimeout(resolve, 20));
      const cachedLogoURL = createdURLs.at(-1);
      assert.equal(window.document.querySelector('#stage .layer-image img')?.getAttribute('src'), cachedLogoURL, 'OBS renders a lower-third logo from the cached image binding');
      channel.onmessage({ data: { action: 'show', scene: lowerThirdScene, bindings: { title: 'Jean Dupont', announcement: 'Invité', imageAssetId: 'lowerthird-logo-1', mediaType: 'image' } } });
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(createdURLs.at(-1), cachedLogoURL, 'repeated lower-third shows reuse the logo object URL');
      channel.onmessage({ data: { action: 'hide' } });
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(revokedURLs.includes(cachedLogoURL), false, 'the cached logo survives a timed hide for fast replay');
      const videoBlob = new Blob(['video bytes'], { type: 'video/mp4' });
      channel.onmessage({ data: { action: 'show', scene: Engine.defaultScene('full', 'media'), bindings: {
        title: 'Clip de culte', media: videoBlob, mediaAssetId: 'media-video-1', mediaType: 'video', mediaItemId: 'media-video-1', mediaMuted: true, mediaLoop: true,
      } } });
      await new Promise((resolve) => setTimeout(resolve, 20));
      const video = window.document.querySelector('#stage video.scene-media-video');
      assert.ok(video, 'the OBS browser source renders a media video layer');
      const cachedVideoURL = createdURLs.at(-1);
      assert.equal(video.getAttribute('src'), cachedVideoURL);
      channel.onmessage({ data: { action: 'show', scene: Engine.defaultScene('full', 'media'), bindings: {
        title: 'Clip de culte', mediaAssetId: 'media-video-1', mediaType: 'video', mediaItemId: 'media-video-1', mediaMuted: true, mediaLoop: true,
      } } });
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(createdURLs.at(-1), cachedVideoURL, 'repeated video sends reuse the cached object URL instead of creating another one');
      const cachedVideo = window.document.querySelector('#stage video.scene-media-video');
      assert.equal(cachedVideo.getAttribute('src'), cachedVideoURL, 'the cached video stays attached to the repeated scene');
      Object.defineProperty(cachedVideo, 'paused', { value: false, writable: true, configurable: true });
      Object.defineProperty(cachedVideo, 'currentTime', { value: 0, writable: true, configurable: true });
      cachedVideo.pause = () => { cachedVideo.paused = true; };
      cachedVideo.play = () => { cachedVideo.paused = false; return Promise.resolve(); };
      channel.onmessage({ data: { action: 'mediaControl', mediaItemId: 'media-video-1', control: {
        play: false, seek: 12, muted: false, volume: .4, rate: 1.5, loop: false,
      } } });
      assert.equal(cachedVideo.paused, true);
      assert.equal(cachedVideo.currentTime, 12);
      assert.equal(cachedVideo.muted, false);
      assert.equal(cachedVideo.volume, .4);
      assert.equal(cachedVideo.playbackRate, 1.5);
      assert.equal(cachedVideo.loop, false);
      channel.onmessage({ data: { action: 'mediaControl', mediaItemId: 'media-video-1', control: { play: true } } });
      assert.equal(cachedVideo.paused, false, 'the OBS output accepts play commands for its current media item');
      channel.onmessage({ data: { action: 'hide' } });
      assert.equal(revokedURLs.includes(cachedVideoURL), false, 'hiding retains the cached video URL for a quick replay');
      await new Promise((resolve) => setTimeout(resolve, 300));
      window.dispatchEvent(new window.Event('beforeunload'));
      assert.ok(revokedURLs.includes(cachedVideoURL), 'OBS releases cached media URLs when its page unloads');
      assert.ok(revokedURLs.includes(cachedLogoURL), 'OBS releases the cached lower-third logo URL when its page unloads');
    } else {
      assert.equal(window.document.getElementById('stage-text').textContent, 'Bonjour');
      const stageImageURL = createdURLs.at(-1);
      window.document.getElementById('stage-next').click();
      assert.ok(channel.messages.some((message) => message.action === 'remoteCommand' && message.command === 'part-next'));
      const statusChannel = channels.find((candidate) => candidate.name === 'op_stage');
      statusChannel.onmessage({ data: { action: 'stageUpdate', timer: { label: 'Prédication', durationMs: 300000, remainingMs: 78000, running: false, endAt: 0 }, queue: [{ label: 'Louange', durationMs: 180000 }], messages: [{ id: 'urgent-1', text: 'Montez le retour de scène.', author: 'Régie', tone: 'urgent', createdAt: 1700000000000 }, { id: 'history-1', text: 'Merci pour la transition.', author: 'Régie', tone: 'info', createdAt: 1700000001000 }] } });
      assert.equal(window.document.getElementById('stage-timer-value').textContent, '01:18');
      assert.match(window.document.getElementById('stage-timer-next').textContent, /Louange/);
      assert.equal(window.document.getElementById('stage-message-current').textContent, 'Montez le retour de scène.');
      assert.equal(window.document.getElementById('stage-message-card').dataset.tone, 'urgent');
      assert.match(window.document.getElementById('stage-message-history').textContent, /Merci pour la transition/);
      window.document.getElementById('stage-admin-toggle').click();
      window.document.getElementById('stage-admin-message').value = 'Prêt pour la suite';
      window.document.getElementById('stage-admin-send').click();
      assert.ok(statusChannel.messages.some((message) => message.action === 'stageCommand' && message.command === 'message-send' && message.text === 'Prêt pour la suite'));
      window.document.getElementById('stage-admin-start').click();
      assert.ok(statusChannel.messages.some((message) => message.action === 'stageCommand' && message.command === 'timer-start'));
      channel.onmessage({
        data: {
          action: 'show',
          scene: Engine.defaultScene('full', 'timer'),
          bindings: { title: 'CULTE', timer: '05:00' },
        },
      });
      assert.equal(window.document.getElementById('stage-text').textContent, '05:00');
      assert.ok(revokedURLs.includes(stageImageURL), 'stage revokes media when switching to a non-image scene');
      const stageVideoBlob = new Blob(['stage video'], { type: 'video/mp4' });
      channel.onmessage({ data: { action: 'show', scene: Engine.defaultScene('full', 'media'), bindings: {
        title: 'Retour vidéo', media: stageVideoBlob, mediaAssetId: 'stage-media-video-1', mediaType: 'video', mediaItemId: 'stage-media-video-1',
      } } });
      await new Promise((resolve) => setTimeout(resolve, 20));
      const stageVideo = window.document.querySelector('#stage-canvas video.scene-media-video');
      assert.ok(stageVideo, 'the stage page renders the media payload');
      const stageVideoURL = createdURLs.at(-1);
      channel.onmessage({ data: { action: 'show', scene: Engine.defaultScene('full', 'media'), bindings: {
        title: 'Retour vidéo', mediaAssetId: 'stage-media-video-1', mediaType: 'video', mediaItemId: 'stage-media-video-1',
      } } });
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(createdURLs.at(-1), stageVideoURL, 'stage reuses the materialized media binding on repeated sends');
      assert.equal(window.document.querySelector('#stage-canvas video.scene-media-video').getAttribute('src'), stageVideoURL);
      const stageLogoBlob = new Blob(['stage lower-third logo'], { type: 'image/png' });
      const lowerThirdScene = Engine.defaultScene('lowerthird', 'lowerthird');
      channel.onmessage({ data: { action: 'show', scene: lowerThirdScene, bindings: { title: 'Jean Dupont', announcement: 'Invité', image: stageLogoBlob, imageAssetId: 'stage-lowerthird-logo', mediaType: 'image' } } });
      await new Promise((resolve) => setTimeout(resolve, 20));
      const stageLogoURL = createdURLs.at(-1);
      channel.onmessage({ data: { action: 'show', scene: lowerThirdScene, bindings: { title: 'Jean Dupont', announcement: 'Invité', imageAssetId: 'stage-lowerthird-logo', mediaType: 'image' } } });
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(createdURLs.at(-1), stageLogoURL, 'stage reuses the cached lower-third logo URL');
      channel.onmessage({ data: { action: 'hide' } });
      assert.equal(revokedURLs.includes(stageVideoURL), false, 'hiding keeps stage media cached for a replay');
      await new Promise((resolve) => setTimeout(resolve, 300));
      window.dispatchEvent(new window.Event('beforeunload'));
      assert.ok(revokedURLs.includes(stageVideoURL), 'stage releases cached media URLs when it unloads');
      assert.ok(revokedURLs.includes(stageLogoURL), 'stage releases the lower-third logo when it unloads');
    }
    await window.happyDOM.abort();
  }
});
