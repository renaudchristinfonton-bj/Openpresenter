import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import Engine from '../src/core/engine.mjs';

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
    { html: 'obs/output.html', temp: 'obs/.output-smoke-module.mjs', url: 'http://localhost:8788/openpresenter2/obs/output.html?scene=annexe&lockMode=bottom' },
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

    const channel = channels.at(-1);
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
      assert.ok(revokedURLs.includes('blob:smoke-2'), 'OBS revokes media on hide');
    } else {
      assert.equal(window.document.getElementById('stage-text').textContent, 'Bonjour');
      window.document.getElementById('stage-next').click();
      assert.ok(channel.messages.some((message) => message.action === 'remoteCommand' && message.command === 'part-next'));
      channel.onmessage({
        data: {
          action: 'show',
          scene: Engine.defaultScene('full', 'timer'),
          bindings: { title: 'CULTE', timer: '05:00' },
        },
      });
      assert.equal(window.document.getElementById('stage-text').textContent, '05:00');
      assert.ok(revokedURLs.includes('blob:smoke-3'), 'stage revokes media when switching to a non-image scene');
      channel.onmessage({ data: { action: 'hide' } });
    }
    await window.happyDOM.abort();
  }
});
