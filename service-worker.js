// Festival Navigator service worker — offline-first app shell.
// Bump CACHE_VERSION whenever you change cached static assets — `node
// scripts/sw-stamp.mjs` does the bump and re-stamps; the suite fails when the
// stamp is stale, so a silent asset change can never ship under an old version.
const CACHE_VERSION = 'festival-nav-v72'; // v44 = the notes/desktop round: threads, the zoom morph, the day whisper, aura sheets; pick-as moved to Settings (v43 was its first cut)
const ASSET_STAMP = '01d44581'; // sha1 of APP_CORE — node scripts/sw-stamp.mjs after any cached-asset change (the suite checks it)

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
  '/js/errlog.js',
  '/js/spotify.js',
  '/js/name-rules.mjs',
  '/js/v3/app.js',
  '/js/v3/wall.js',
  '/js/v3/card-facts.js',
  '/js/v3/notes.js',
  '/js/v3/settings.js',
  '/js/v3/tools.js',
  '/js/v3/model.js',
  '/js/v3/aura.js',
  '/js/v3/palette.js',
  '/js/v3/favicon.js',
  '/js/v3/router.js',
  '/js/v3/sort-control.js',
  '/js/v3/filters.js',
  '/js/v3/now.js',
  '/data/festivals/index.json',
];
// Every module app.js imports (transitively) must be listed above, or an
// offline boot after an update fails on the first missing import — a v40
// worker once cached app.js + wall.js without the two modules they had just
// grown (Codex gate, 2026-08-27). tests/app-shell-complete.test.mjs walks the
// import graph and fails when this list falls behind.

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
    // a stale shell forever) — but it must not delete the fallback either. An
    // old cache holding a festival copy that could NOT be rescued (quota,
    // storage trouble) is that device's only offline copy: keep it —
    // caches.match() searches every cache — and let the next activate retry.
    let data = null;
    try { data = await caches.open(DATA_CACHE); } catch { data = null; }
    for (const k of keys) {
      if (k === CACHE_VERSION || k === DATA_CACHE) continue;
      let rescuedAll = true;
      try {
        const old = await caches.open(k);
        for (const req of await old.keys()) {
          try {
            if (!isFestivalData(new URL(req.url))) continue;
            if (!data) { rescuedAll = false; continue; }
            if (await data.match(req)) continue; // newer copy already there
            const hit = await old.match(req);
            if (hit) await data.put(req, hit); else rescuedAll = false;
          } catch { rescuedAll = false; }
        }
      } catch { rescuedAll = false; }
      if (rescuedAll) { try { await caches.delete(k); } catch { /* next activate */ } }
    }
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
    const nav = fetchAndStore(request, CACHE_VERSION);
    event.waitUntil(nav.done);
    event.respondWith(
      nav.response.catch(() => caches.match(request, { ignoreSearch: true }).then((cached) => cached || caches.match('/')).then((cached) => cached || Response.error()))
    );
    return;
  }

  // Festival data: NETWORK-FIRST, cache as the offline fallback. The data
  // cache is persistent on purpose (it survives shell bumps — see DATA_CACHE),
  // which is exactly why it can't be served cache-first: a set-times drop
  // would reach every phone one open LATE — the crew reads "app is updated",
  // opens it, sees last week's lineup, and the fresh grid only lands on the
  // open after that. Festival JSONs are small; a bounded wait for the live
  // copy is cheap on a good network and the cache answers on a dead one.
  if (isFestivalData(url)) {
    event.respondWith(dataNetworkFirst(event));
    return;
  }

  // Static assets: cache-first, then update the cache in the background.
  // The background write is registered with waitUntil SYNCHRONOUSLY (a late
  // waitUntil after the response has been handed back is an error, and an
  // unregistered write can be killed with the worker before it lands).
  const refresh = fetchAndStore(request, CACHE_VERSION);
  event.waitUntil(refresh.done);
  // A cold miss with a dead network is an honest network error, never
  // respondWith(undefined).
  event.respondWith(
    caches.match(request).then((cached) => cached || refresh.response.catch(() => Response.error()))
  );
});

// fetch() plus a cache write that the caller can register with waitUntil.
// `response` settles as soon as the network answers (the caller can hand it
// back without waiting for storage); `done` settles after the write, and
// never rejects, so it is safe to hand to waitUntil as-is.
function fetchAndStore(request, bucket) {
  let stored = Promise.resolve();
  const response = fetch(request).then((resp) => {
    if (resp && resp.ok) {
      const copy = resp.clone();
      stored = caches.open(bucket).then((c) => c.put(request, copy)).catch(() => {});
    }
    return resp;
  });
  const done = response.then(() => stored, () => {});
  return { response, done };
}

// Live copy if the network answers inside DATA_NETWORK_MS; otherwise the
// cached copy (any bucket — index.json is also precached in the shell), and
// if there is no cached copy at all, the network request however long it
// takes. A late network success still refreshes the data cache — and that
// write is held open by waitUntil, so a phone that got the cached copy at
// the 4 s mark and then heard back from the network keeps the fresh copy
// for its next open even if the browser reaps the worker. Never a 503 for
// data we hold.
const DATA_NETWORK_MS = 4000;
function dataNetworkFirst(event) {
  const { request } = event;
  const refresh = fetchAndStore(request, DATA_CACHE);
  event.waitUntil(refresh.done);
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), DATA_NETWORK_MS));
  return Promise.race([refresh.response.catch(() => null), timeout]).then((live) => {
    if (live && live.ok) return live;
    return caches.match(request).then((cached) => cached || refresh.response);
  });
}
