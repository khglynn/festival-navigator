// Festival Navigator service worker — offline-first app shell.
// Bump CACHE_VERSION whenever you change cached static assets — `node
// scripts/sw-stamp.mjs` does the bump and re-stamps; the suite fails when the
// stamp is stale, so a silent asset change can never ship under an old version.
const CACHE_VERSION = 'festival-nav-v95'; // v44 = the notes/desktop round: threads, the zoom morph, the day whisper, aura sheets; pick-as moved to Settings (v43 was its first cut)
const ASSET_STAMP = '3f1dc2b8'; // sha1 of APP_CORE — node scripts/sw-stamp.mjs after any cached-asset change (the suite checks it)

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
  '/js/v3/crew-entry.js',
  '/js/v3/welcome.js',
  '/js/v3/join-shelf.js',
  '/js/v3/wall.js',
  '/js/v3/card-facts.js',
  '/js/v3/who-motion.js',
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
  '/js/v3/events.js',
  '/js/v3/motion.js',
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

// "Which build am I?" (js/errlog.js, v88). The worker that controlled a page
// when it loaded served that page's modules, so ITS version is the page's
// build — even after a newer worker takes over and the page has not reloaded
// yet. Crash reports carry the answer. A worker from before v88 never
// answers, and the page falls back to the cache names.
self.addEventListener('message', (event) => {
  const d = event.data;
  if (!d || d.fn !== 'build?' || !event.source) return;
  try { event.source.postMessage({ fnBuild: CACHE_VERSION, fnStamp: ASSET_STAMP }); } catch { /* the page is gone */ }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin (api.spotify.com, accounts.spotify.com), the platform's own
  // paths (/_vercel/) and the crash-report door (/fn-i/, rewritten to PostHog
  // by vercel.json): never ours to cache — a cache-first Spotify API response
  // made every re-scan one scan stale, silently (SPOT-4), and a shell hit is
  // never refreshed. Reports are POSTs, which never reach this line; the
  // path is named anyway so no future GET there is ever answered from a
  // cache. Let the browser handle them.
  if (url.origin !== location.origin || url.pathname.startsWith('/_vercel/') || url.pathname.startsWith('/fn-i/')) return;

  // API calls: always go to the network (sync needs fresh data). If offline,
  // the app already has localStorage, so a failed fetch is handled client-side.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response('{}', {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Navigations: network-first so a stale worker can never pin an old shell
  // on a returning device (PS-2) — but only for as long as a person will
  // stare at a white screen. A network that hangs, fails or errors gets this
  // worker's OWN precached shell: the one page that matches the JS it serves.
  // Navigations are never stored — a live page written into this cache would
  // be the next build's HTML over this build's modules on the next offline
  // open.
  if (request.mode === 'navigate') {
    event.respondWith(navigationNetworkFirst(request));
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

  // Static assets: this worker's install snapshot, and nothing else. A hit is
  // served with no network call and no write — every cached-asset change
  // bumps CACHE_VERSION (the stamp test), so fresh bytes arrive with a new
  // worker, whole, never trickled into this build's cache one file at a time
  // (a background refresh did exactly that, and a failed install then left
  // half of two builds' modules to boot offline). Only this worker's own
  // cache answers: caches.match() would search an older version first. A
  // miss (an asset outside the install lists) is fetched and kept, and the
  // write lands before the response is handed back, so nothing needs a late
  // waitUntil. A miss with a dead network is an honest network error, never
  // respondWith(undefined).
  event.respondWith(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.match(request))
      .then((hit) => {
        if (hit) return hit;
        const miss = fetchAndStore(request, CACHE_VERSION);
        return miss.response.then((resp) => miss.done.then(() => resp));
      })
      .catch(() => Response.error())
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

// The network's answer if it arrives inside the budget, otherwise null — what
// each network-first strategy spends before the cache answers.
const NETWORK_MS = 4000; // festival data: a set-times drop is worth a few seconds
// Navigations spend less (2026-09-23). The page is the first thing anyone
// waits for — before a single pixel of the app, not even the loader — and on
// a network that hangs (Pier 80, 40k phones) 4 s of blank screen was a
// quarter of a lie-fi cold open. Losing this race costs nothing that matters:
// the fallback is this worker's own shell, the one page that matches the JS it
// serves. And it cannot hold a new build back: the browser checks the worker
// SCRIPT on every navigation, and index.html's glue asks again whenever the tab
// comes back — neither request passes through this handler — so a new worker
// still installs, takes over and reloads the page when it is quiet, or puts up
// the new-build strip. A phone with no shell cached still waits for the network.
const NAVIGATION_MS = 1500;
function inTime(response, ms = NETWORK_MS) {
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), ms));
  return Promise.race([response.catch(() => null), timeout]);
}

// Live copy if the network answers in time; otherwise the cached copy (any
// bucket — index.json is also precached in the shell), and if there is no
// cached copy at all, the network request however long it takes. A late
// network success still refreshes the data cache — and that write is held
// open by waitUntil, so a phone that got the cached copy at the 4 s mark and
// then heard back from the network keeps the fresh copy for its next open
// even if the browser reaps the worker. Never a 503 for data we hold.
function dataNetworkFirst(event) {
  const { request } = event;
  const refresh = fetchAndStore(request, DATA_CACHE);
  event.waitUntil(refresh.done);
  return inTime(refresh.response).then((live) => {
    if (live && live.ok) return live;
    return caches.match(request).then((cached) => cached || refresh.response);
  });
}

// The live page unless the server errored (5xx) or the network failed or ran
// out of time. Everything else is the server's real answer and passes through
// untouched: a navigation fetch runs redirect:manual, so a 302 or cleanUrls'
// 308 arrives as an opaqueredirect with status 0 and ok=false, and the WYA
// page is a deliberate 404. With no shell cached, the network however long.
function navigationNetworkFirst(request) {
  const live = fetch(request);
  return inTime(live, NAVIGATION_MS).then((resp) => {
    if (resp && resp.status < 500) return resp;
    return caches.open(CACHE_VERSION).then((cache) => cache.match('/')).then((shell) => shell || live);
  });
}
