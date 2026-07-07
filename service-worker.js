// Festival Navigator service worker — offline-first app shell.
// Bump CACHE_VERSION whenever you change cached static assets.
const CACHE_VERSION = 'festival-nav-v5';

const APP_SHELL = [
  '/',
  '/index.html',
  '/data/festivals.js',
  '/data/spotify-affinity.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Best-effort: don't fail install if a CDN asset hiccups.
      Promise.all(APP_SHELL.map((url) =>
        cache.add(new Request(url, { mode: 'no-cors' })).catch(() => {})
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
