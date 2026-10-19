// Festival Navigator service worker — offline-first app shell.
// Bump CACHE_VERSION whenever you change cached static assets — `node
// scripts/sw-stamp.mjs` does the bump and re-stamps; the suite fails when the
// stamp is stale, so a silent asset change can never ship under an old version.
const CACHE_VERSION = 'festival-nav-v116'; // bumped by node scripts/sw-stamp.mjs; what each build shipped is in DEVLOG.md
const ASSET_STAMP = 'ec092997'; // sha1 of APP_CORE — node scripts/sw-stamp.mjs after any cached-asset change (the suite checks it)

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
  '/js/fold.mjs',
  '/js/v3/app.js',
  '/js/v3/crew-entry.js',
  '/js/v3/welcome.js',
  '/js/v3/join-shelf.js',
  '/js/v3/people-menu.js',
  '/js/v3/wall.js',
  '/js/v3/card-facts.js',
  '/js/v3/who-motion.js',
  '/js/v3/notes.js',
  '/js/v3/settings.js',
  '/js/v3/tools.js',
  '/js/v3/import.js',
  '/js/v3/import-match.js',
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
  '/js/v3/plan.js',
  '/js/v3/plan-rows.js',
  '/js/v3/plan-shelf.js',
  '/js/v3/foot.js',
  // The Invite sheet's QR (find your crew, slice 1): app.js loads it only
  // through import(), but it is core, not an extra — an extra is best-effort,
  // and a phone whose install skipped it would have no QR in a field.
  '/js/v3/qr.js',
  '/vendor/uqr.mjs',
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
  if (!d) return;
  if (d.fn === 'repair') { answerRepair(event); return; }
  if (d.fn !== 'build?' || !event.source) return;
  try { event.source.postMessage({ fnBuild: CACHE_VERSION, fnStamp: ASSET_STAMP }); } catch { /* the page is gone */ }
});

// "Repair your copy" (v116, review round 3), asked by index.html's watchdog
// when a page this worker serves cannot link on a reload: this cache holds a
// copy that cannot work, and a plain reload would serve it again. The repair
// is whole or nothing, and only ever THIS build:
//   1. the page ('/') first, no-cache: a page that names another build in its
//      fn-build means the network serves another release, whose own worker is
//      the fix (the page asks the browser for it) — nothing more is fetched
//      and nothing is written ("newer"). A page with no fn-build at all is not
//      our server answering (a Wi-Fi login page): "failed", the signal's;
//   2. every other APP_CORE file, no-cache, and the set checked against
//      ASSET_STAMP exactly as scripts/sw-stamp.mjs computes it — so a deploy
//      landing mid-fetch, or two CDN edges on two deployments, can never write
//      a mixed copy ("mismatch");
//   3. only then every entry overwritten in this build's own cache, the page
//      included. Never another cache: not a newer worker's, not the festival
//      data cache.
// One run at a time (a second ask joins it), with a deadline that ABORTS the
// run — every fetch is cancelled and every write checks first — so a hung
// network ends in a "timeout" answer and nothing lands after it. The answer
// is sent once the run has settled: "repaired" means every write is done.
// A worker from before v116 ignores the ask and never answers; the page
// waits only a moment for the first word ("started") before saying so.
const BUILD = CACHE_VERSION.replace('festival-nav-', '');
const REPAIR_MS = 20000; // the whole copy (~1.5 MB) on a slow bar; past it, the signal is the problem
function answerRepair(event) {
  const port = event.ports && event.ports[0];
  if (!port) return;
  const say = (word) => { try { port.postMessage({ fnRepair: word }); } catch { /* the page is gone */ } };
  say('started');
  event.waitUntil(repair().then(say));
}
let repairing = null;
function repair() {
  if (!repairing) repairing = repairShell().catch(() => 'failed').finally(() => { repairing = null; });
  return repairing;
}
// The files ASSET_STAMP covers, in its order: every APP_CORE path but '/'
// (sw-stamp's pattern skips it; it is the same page as /index.html, which it
// hashes — the repair proves the two are byte for byte the same).
const STAMPED = APP_CORE.filter((p) => p !== '/' && p !== '/service-worker.js');
const TEXT_RE = /\.(?:js|mjs|css|html|json|svg|txt|md)$/i;
// scripts/sw-stamp.mjs assetStamp, over bytes in hand: sha1 of each path then
// its bytes — text decoded as UTF-8 (a BOM kept, as Node keeps it) with CRLF
// made LF, binaries (the fonts) as they are — the first 8 hex digits.
// tests/sw-data-network-first.test.mjs holds this equal to ASSET_STAMP over
// the real files: if the two ever drifted, every repair would say "mismatch".
async function stampOf(bodies) {
  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8', { ignoreBOM: true });
  const parts = [];
  STAMPED.forEach((p, i) => {
    const b = bodies[i];
    const raw = ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : new Uint8Array(b);
    parts.push(enc.encode(p), TEXT_RE.test(p) ? enc.encode(dec.decode(raw).replace(/\r\n/g, '\n')) : raw);
  });
  const all = new Uint8Array(parts.reduce((n, x) => n + x.byteLength, 0));
  let at = 0;
  for (const x of parts) { all.set(x, at); at += x.byteLength; }
  const sum = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
  return Array.from(sum, (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 8);
}
async function repairShell() {
  const reg = self.registration;
  if (reg && (reg.installing || reg.waiting)) return 'newer'; // its install replaces this copy
  const ac = new AbortController();
  const { signal } = ac;
  const deadline = setTimeout(() => ac.abort(), REPAIR_MS);
  try {
    const cache = await caches.open(CACHE_VERSION); // opened first: an activate that deletes it mid-run takes these writes with it
    const get = async (p) => {
      const r = await fetch(new Request(new URL(p, location.origin).href, { cache: 'no-cache', signal }));
      if (!r.ok) throw new Error('server');
      return { p, r, bytes: await r.clone().arrayBuffer() };
    };
    const page = await get('/');
    const build = /<meta name="fn-build" content="([^"]+)"/.exec(new TextDecoder().decode(page.bytes));
    if (!build) return 'failed';
    if (build[1] !== BUILD) return 'newer';
    const rest = await Promise.all(STAMPED.map(get));
    const index = new Uint8Array(rest[STAMPED.indexOf('/index.html')].bytes);
    const top = new Uint8Array(page.bytes);
    if (index.length !== top.length || index.some((x, i) => x !== top[i])) return 'mismatch';
    if (await stampOf(rest.map((x) => x.bytes)) !== ASSET_STAMP) return 'mismatch';
    for (const { p, r } of [page, ...rest]) {
      if (signal.aborted) return 'timeout';
      await cache.put(p, r);
    }
    return 'repaired';
  } catch (e) {
    if (signal.aborted) return 'timeout';
    return e && e.message === 'server' ? 'server' : 'failed';
  } finally {
    ac.abort(); // whatever is still in flight goes with the answer
    clearTimeout(deadline);
  }
}

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
