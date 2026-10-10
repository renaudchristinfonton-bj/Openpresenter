const CACHE = 'openpresenter2-shell-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './test-engine.html',
  './css/tokens.css', './css/components.css',
  './src/core/engine.mjs', './src/core/database.mjs', './src/core/backup.mjs', './src/core/output.mjs', './src/core/themes.mjs',
  './src/modules/bible/xml.mjs', './src/modules/songs/parser.mjs', './src/modules/songs/SongEditor.mjs', './src/components/SceneEditor.mjs',
  './obs/output.html', './app/remote.html', './app/stage.html',
  './js/remote-channel.js', './js/qrcode.js', './vendor/js/jszip.min.js', './vendor/fonts/fonts.css', './assets/op-icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('openpresenter2-') && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.url.startsWith('ws:') || request.url.startsWith('wss:')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/ws') || url.pathname.endsWith('/api/network-addresses')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
        return response;
      } catch {
        return await caches.match(request, { ignoreSearch: true }) || await caches.match('./index.html');
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') (await caches.open(CACHE)).put(request, response.clone());
      return response;
    } catch {
      return new Response('Offline — cette ressource n’a pas encore été mise en cache.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
