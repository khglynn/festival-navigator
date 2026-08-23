// Festival Navigator service worker — offline-first app shell.
// Bump CACHE_VERSION whenever you change cached static assets.
const CACHE_VERSION = 'festival-nav-v38'; // v38 = two-weekend scheduled support (ACL-ready: weekend-filtered grid, per-weekend day dates)

// Festival JSONs live in their OWN cache, outside the version-keyed shell
// cache — because activate deletes every old version cache wholesale, and
// per-festival files only ever entered the cache at first fetch. So any SW
// update (phone updates on camp WiFi, walks into the field) wiped every
// festival a device had opened, and the first OFFLINE board-open after the
// update was the fatal screen (gate find, 2026-08-23). Data is content-
// addressed by URL and revalidated on every fetch — it has no business dying
// with a shell version.
const DATA_CACHE = 'festival-nav-data-v1';
const isFestivalData = (url) => url.pathname.startsWith('/data/festivals/');

// The shell that MUST be complete for offline to be real: if any of these
// fail, install fails and the old worker keeps serving — a half-cached shell
// that claims offline-ready is a lie that surfaces in a muddy field (PS-1).
const APP_CORE = [
  '/',
  '/index.html',
  '/assets/v3-tokens.css',
  '/assets/v3.css',
  '/assets/fonts/fonts.css',
  '/assets/fonts/anton-400-latin.woff2',
  '/assets/fonts/inter-var-latin.woff2',
  '/js/state.js',
  '/js/sync.js',
  '/js/crew.js',
  '/js/festivals.js',
  '/js/merge.js',
  '/js/time.js',
  '/js/overlap.js',
  '/js/parse.js',
  '/js/util.js',
  '/js/spotify.js',
  '/js/name-rules.mjs',
  '/js/v3/app.js',
  '/js/v3/wall.js',
  '/js/v3/notes.js',
  '/js/v3/settings.js',
  '/js/v3/tools.js',
  '/js/v3/model.js',
  '/js/v3/aura.js',
  '/js/v3/palette.js',
  '/js/v3/favicon.js',
  '/js/v3/router.js',
  '/js/v3/sort-control.js',
  '/data/festivals/index.json',
];

// Nice-to-have: failures here never block install.
const APP_EXTRAS = [
  '/404.html',
  '/vendor/html2canvas.min.js',
  '/spotify-callback',
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
      // Atomic core (addAll fails install if ANY core asset fails), then
      // best-effort extras.
      cache.addAll(APP_CORE).then(() =>
        Promise.all(APP_EXTRAS.map((url) => cache.add(new Request(url)).catch(() => {})))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Rescue festival data cached under pre-v37 version-keyed caches into the
    // persistent data cache BEFORE deleting them — an upgrading device keeps
    // every festival it has ever opened. Best-effort per entry: a rescue
    // failure must never block activation (the old worker would keep serving
    // a stale shell forever).
    try {
      const data = await caches.open(DATA_CACHE);
      for (const k of keys) {
        if (k === CACHE_VERSION || k === DATA_CACHE) continue;
        const old = await caches.open(k);
        for (const req of await old.keys()) {
          try {
            if (!isFestivalData(new URL(req.url))) continue;
            if (await data.match(req)) continue; // newer copy already there
            const hit = await old.match(req);
            if (hit) await data.put(req, hit);
          } catch { /* one bad entry must not strand the rest */ }
        }
      }
    } catch { /* no rescue is still better than no activation */ }
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION && k !== DATA_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin (api.spotify.com, accounts.spotify.com, analytics): never
  // ours to cache — a cache-first Spotify API response made every re-scan
  // one scan stale, silently (SPOT-4). Let the browser handle it untouched.
  if (url.origin !== location.origin) return;

  // API calls: always go to the network (sync needs fresh data). If offline,
  // the app already has localStorage, so a failed fetch is handled client-side.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response('{}', {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Navigations: network-first so a stale worker can never pin an old shell
  // on a returning device (PS-2); cache is the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => caches.match(request, { ignoreSearch: true }).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Static assets: cache-first, then update the cache in the background.
  // Festival data revalidates into the PERSISTENT data cache (never the
  // version-keyed shell cache), so it survives every CACHE_VERSION bump;
  // caches.match() searches both, so first-load-after-install still hits the
  // precached index.json.
  const bucket = isFestivalData(url) ? DATA_CACHE : CACHE_VERSION;
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(bucket).then((c) => c.put(request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
