// Festival Navigator service worker — offline-first app shell.
// Bump CACHE_VERSION whenever you change cached static assets.
const CACHE_VERSION = 'festival-nav-v12';

const APP_SHELL = [
  '/',
  '/index.html',
  '/assets/tailwind.css',
  '/assets/custom.css',
  '/vendor/html2canvas.min.js',
  '/js/app.js',
  '/js/state.js',
  '/js/sync.js',
  '/js/crew.js',
  '/js/festivals.js',
  '/js/merge.js',
  '/js/time.js',
  '/js/overlap.js',
  '/js/parse.js',
  '/js/util.js',
  '/js/ui.js',
  '/js/ai.js',
  '/js/tools.js',
  '/js/render/grid.js',
  '/js/render/list.js',
  '/js/render/people.js',
  '/js/spotify.js',
  '/js/access.js',
  '/spotify-callback',
  '/data/festivals/index.json',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
];
// Per-festival JSONs are cached at first fetch by the handler below, so a
// festival you have opened once keeps working offline.

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Best-effort: don't fail install if one asset hiccups.
      Promise.all(APP_SHELL.map((url) =>
        cache.add(new Request(url)).catch(() => {})
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API calls: always go to the network (sync needs fresh data). If offline,
  // the app already has localStorage, so a failed fetch is handled client-side.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response('{}', {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Static + app shell: cache-first, then update the cache in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((resp) => {
        if (resp && (resp.ok || resp.type === 'opaque')) {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
