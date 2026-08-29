// ============================================================
// sw.js — Service Worker OpenPresenter
// ============================================================
// Rend l'application installable (PWA) et disponible hors ligne :
//   - fichiers statiques du projet (pages, js, css, polices, icônes) :
//     stratégie « stale-while-revalidate » — réponse instantanée depuis le
//     cache, mise à jour en arrière-plan pour la prochaine fois ;
//   - données utilisateur (/data/...) et API : TOUJOURS le réseau (jamais
//     mises en cache — ce sont les données live de la régie) ;
//   - WebSocket (/ws) : hors périmètre (géré par les pages).
const CACHE = 'openpresenter-v1';
const CORE = [
  '/', 'index.html', 'studio_unifie.html', 'cue_list.html', 'mur_previews.html',
  'vue_pasteur.html', 'pasteur_control.html', 'stage_display.html', 'looks_editor.html',
  'guide.html',
  'bible_control_display_pro.html', 'lyrics_control_display_pro.html',
  'media_control_display_pro.html', 'obs_lower_third_ultimate_studio.html',
  'timer-control-updated.html', 'timer-display-updated.html',
  'store.js', 'manifest.webmanifest',
  'vendor/fonts/fonts.css', 'vendor/js/jszip.min.js', 'vendor/js/pdf.min.js', 'vendor/js/pdf.worker.min.js',
  'css/tw-bible_control_display_pro.css', 'css/tw-lyrics_control_display_pro.css',
  'css/tw-media_control_display_pro.css', 'css/tw-obs_lower_third_ultimate_studio.css',
  'js/remote-channel.js', 'js/live-mutex.js', 'js/obs-links.js', 'js/ui.js', 'js/qrcode.js',
  'js/looks.js', 'js/pwa.js', 'js/demo-content.js', 'js/remote-commands.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;           // CDN externes : hors ligne = tant pis (déjà en cache navigateur au 1er passage)
  if (url.pathname.startsWith('/data/') || url.pathname.startsWith('/api/')) return; // données live : réseau uniquement
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: false });
      const fetchPromise = fetch(e.request).then((response) => {
        if (response && response.ok) cache.put(e.request, response.clone());
        return response;
      }).catch(() => null);
      if (cached) { e.waitUntil(fetchPromise); return cached; }   // stale-while-revalidate
      const fresh = await fetchPromise;
      if (fresh) return fresh;
      return new Response('Hors ligne et absent du cache.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })
  );
});
