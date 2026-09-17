// The service worker's fetch strategies, run against the REAL
// service-worker.js in a sandbox.
//
// Festival JSONs live in a persistent cache that survives shell bumps — which
// is why they can't be served cache-first: a set-times drop would reach every
// phone one open late. So data is network-first with a bounded wait, and the
// cache answers when the network doesn't (Portola set-times drop, 2026-08-27).
// Every background cache write is registered with waitUntil SYNCHRONOUSLY, so
// a browser that reaps the worker after the response cannot discard the write
// (Codex gate, 2026-08-27).
//
// The shell is the worker's install snapshot and nothing else (2026-09-16):
// a hit in its own version cache is served with no network call and no write,
// and navigations are never stored. A background refresh used to write NEW
// build bytes into the OLD build's cache whenever a page opened after a
// deploy; if the new worker's install then failed, the next offline open ran
// half of one build's modules against half of the other's — a black screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW_SRC = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
const ORIGIN = 'https://fest.kevinhg.com';
const CURRENT = SW_SRC.match(/CACHE_VERSION = '([^']+)'/)[1];
const DATA = SW_SRC.match(/DATA_CACHE = '([^']+)'/)[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Boot the worker with fake caches/fetch. Caches are real buckets: `open(name)`
// is that bucket, `caches.match` searches every bucket in creation order (as
// browsers do). `cached` seeds paths into the bucket they live in — festival
// data in the data cache, everything else in this worker's version cache;
// `older` seeds an older version's cache, created first. Timeouts are scaled
// down so the 4 s budget becomes ~40 ms — the ratio between "network" delays
// and the budget is what the strategy is about, not the wall-clock number.
function bootWorker({ cached = {}, older = null, fetchImpl, putDelay = 0 }) {
  const handlers = {};
  const buckets = new Map();
  const puts = [];
  let fetches = 0;
  const keyOf = (req) => (typeof req === 'string' ? new URL(req, ORIGIN).href : req.url);
  const bucket = (name) => {
    if (!buckets.has(name)) {
      const store = new Map();
      buckets.set(name, {
        store,
        match: async (req) => (store.has(keyOf(req)) ? new Response(store.get(keyOf(req))) : undefined),
        put: async (req, resp) => {
          const body = await resp.text();
          if (putDelay) await sleep(putDelay);
          puts.push(`${name} ${keyOf(req)}`); store.set(keyOf(req), body);
        },
        keys: async () => [], add: async () => {}, addAll: async () => {},
      });
    }
    return buckets.get(name);
  };
  if (older) for (const [path, body] of Object.entries(older)) bucket('festival-nav-v36').store.set(ORIGIN + path, body);
  for (const [path, body] of Object.entries(cached)) {
    bucket(path.startsWith('/data/festivals/') ? DATA : CURRENT).store.set(ORIGIN + path, body);
  }
  const ctx = {
    self: { addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: {
      open: async (name) => bucket(name),
      match: async (req) => {
        for (const b of buckets.values()) { const hit = await b.match(req); if (hit) return hit; }
        return undefined;
      },
      keys: async () => [...buckets.keys()], delete: async () => true,
    },
    fetch: (...args) => { fetches += 1; return fetchImpl(...args); },
    location: { origin: ORIGIN },
    setTimeout: (fn, ms) => setTimeout(fn, Math.round(ms / 100)),
    clearTimeout,
    URL, Request, Response, Promise, console,
  };
  vm.runInNewContext(SW_SRC, ctx);
  return {
    handlers, puts,
    get fetches() { return fetches; },
    cachedBody: (name, path) => bucket(name).store.get(ORIGIN + path),
  };
}

// Dispatch one fetch event. `waited` collects every promise the worker hands
// to waitUntil — the test's proof that a background write is held open.
async function dispatch(worker, path, init = {}) {
  let responded;
  const waited = [];
  // Node's Request refuses mode:'navigate'; the worker only reads url/method/
  // mode off the request, so a plain object stands in for a navigation.
  const request = init.mode === 'navigate'
    ? { url: ORIGIN + path, method: 'GET', mode: 'navigate' }
    : new Request(ORIGIN + path, init);
  worker.handlers.fetch({
    request,
    respondWith: (p) => { responded = Promise.resolve(p); },
    waitUntil: (p) => { waited.push(p); },
  });
  // Snapshot BEFORE the first await: a waitUntil that arrives after the
  // dispatch window is an InvalidStateError in real browsers.
  const registeredSync = waited.length;
  assert.ok(responded, `worker did not respondWith for ${path}`);
  const resp = await responded;
  const readable = resp && resp.type !== 'error' && typeof resp.text === 'function';
  return { resp, body: readable ? await resp.text() : null, waited, registeredSync };
}

const delayed = (body, ms, status = 200) => new Promise((resolve) => setTimeout(() => resolve(new Response(body, { status })), ms));
const never = () => new Promise(() => {});

test('festival data: a live network answer beats the cached copy, and refreshes the cache', async () => {
  const w = bootWorker({
    cached: { '/data/festivals/portola-2026.json': '{"status":"lineup"}' },
    fetchImpl: async () => new Response('{"status":"scheduled"}'),
  });
  const { body, waited } = await dispatch(w, '/data/festivals/portola-2026.json');
  assert.equal(body, '{"status":"scheduled"}');
  await Promise.all(waited);
  assert.equal(w.cachedBody(DATA, "/data/festivals/portola-2026.json"), '{"status":"scheduled"}', 'cache updated for next time');
});

test('festival data: a dead network serves the cached copy', async () => {
  const w = bootWorker({
    cached: { '/data/festivals/portola-2026.json': '{"status":"lineup"}' },
    fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
  });
  const { body, waited } = await dispatch(w, '/data/festivals/portola-2026.json');
  assert.equal(body, '{"status":"lineup"}');
  await assert.doesNotReject(Promise.all(waited), 'the waitUntil promise never rejects');
});

test('festival data: a network that never answers serves the cached copy after the budget, not a blank page', async () => {
  const w = bootWorker({
    cached: { '/data/festivals/portola-2026.json': '{"status":"lineup"}' },
    fetchImpl: never,
  });
  const t0 = Date.now();
  const { body } = await dispatch(w, '/data/festivals/portola-2026.json');
  assert.equal(body, '{"status":"lineup"}');
  assert.ok(Date.now() - t0 < 1000, 'bounded wait — the scaled 4 s budget, not forever');
});

test('festival data: a LATE network answer still lands in the cache, and that write is held open by waitUntil', async () => {
  // Network answers after the (scaled) budget; the cache write itself is slow.
  const w = bootWorker({
    cached: { '/data/festivals/portola-2026.json': '{"status":"lineup"}' },
    fetchImpl: () => delayed('{"status":"scheduled"}', 80),
    putDelay: 40,
  });
  const { body, waited, registeredSync } = await dispatch(w, '/data/festivals/portola-2026.json');
  assert.equal(body, '{"status":"lineup"}', 'the phone got the cached copy at the budget');
  assert.equal(registeredSync, 1, 'exactly one background promise registered, synchronously, inside the dispatch window');
  assert.notEqual(w.cachedBody(DATA, "/data/festivals/portola-2026.json"), '{"status":"scheduled"}', 'not written yet — the network is still out');
  await Promise.all(waited);
  assert.equal(w.cachedBody(DATA, "/data/festivals/portola-2026.json"), '{"status":"scheduled"}', 'settled only after the late write landed');
});

test('festival data: nothing cached + slow network = wait for the network (a first open must not 503)', async () => {
  const w = bootWorker({ fetchImpl: () => delayed('{"status":"scheduled"}', 80) });
  const { body } = await dispatch(w, '/data/festivals/seismic-9.json');
  assert.equal(body, '{"status":"scheduled"}');
});

test('festival data: a non-OK network answer falls back to the cached copy', async () => {
  const w = bootWorker({
    cached: { '/data/festivals/portola-2026.json': '{"status":"lineup"}' },
    fetchImpl: async () => new Response('nope', { status: 502 }),
  });
  const { body } = await dispatch(w, '/data/festivals/portola-2026.json');
  assert.equal(body, '{"status":"lineup"}');
});

test('shell assets: a hit in this worker\'s own cache is served as-is — no network call, no write, nothing held open', async () => {
  const w = bootWorker({
    cached: { '/js/v3/app.js': 'this build' },
    fetchImpl: () => delayed('next build', 5),
  });
  const { body, waited } = await dispatch(w, '/js/v3/app.js');
  assert.equal(body, 'this build');
  await sleep(30); // long enough for any background refresh to have landed
  assert.equal(w.fetches, 0, 'no background request competing with /api/crew for one bar');
  assert.deepEqual(w.puts, [], 'the next build\'s bytes never enter this build\'s cache');
  assert.equal(waited.length, 0);
  assert.equal(w.cachedBody(CURRENT, '/js/v3/app.js'), 'this build');
});

test('shell assets: an OLDER version\'s cache never answers for this worker (caches.match searches oldest first)', async () => {
  // An old version cache survives an activate whose festival-data rescue
  // failed — and caches.match() would search it before the live one.
  const w = bootWorker({
    older: { '/js/v3/wall.js': 'older build' },
    cached: { '/js/v3/wall.js': 'this build' },
    fetchImpl: never,
  });
  const { body } = await dispatch(w, '/js/v3/wall.js');
  assert.equal(body, 'this build');
});

test('shell assets: a miss goes to the network and is kept in this worker\'s cache before the page gets it', async () => {
  const w = bootWorker({ fetchImpl: () => delayed('icon bytes', 10), putDelay: 10 });
  const { body } = await dispatch(w, '/icon-maskable-512.png');
  assert.equal(body, 'icon bytes');
  assert.equal(w.cachedBody(CURRENT, '/icon-maskable-512.png'), 'icon bytes', 'stored by the time the response was handed back — no late waitUntil');
  assert.deepEqual(w.puts, [`${CURRENT} ${ORIGIN}/icon-maskable-512.png`]);
});

test('shell assets: a cold miss with a dead network is an explicit error response, never respondWith(undefined)', async () => {
  const w = bootWorker({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  const { resp } = await dispatch(w, '/js/v3/nowhere.js');
  assert.ok(resp, 'a Response object came back');
  assert.equal(resp.type, 'error');
});

test('navigations: the live page wins when the network answers, and it is never stored', async () => {
  const w = bootWorker({ cached: { '/': 'this build\'s shell' }, fetchImpl: () => delayed('live shell', 10) });
  const a = await dispatch(w, '/', { mode: 'navigate' });
  assert.equal(a.body, 'live shell');
  await Promise.all(a.waited);
  await sleep(30);
  assert.deepEqual(w.puts, [], 'a navigation never writes — the offline shell stays the one that matches this worker\'s JS');
  assert.equal(w.cachedBody(CURRENT, '/'), 'this build\'s shell');
});

test('navigations: offline, a hanging network, or a server error all open this worker\'s own precached shell', async () => {
  const shell = { cached: { '/': 'this build\'s shell' }, older: { '/': 'older shell' } };
  const offline = bootWorker({ ...shell, fetchImpl: async () => { throw new TypeError('offline'); } });
  assert.equal((await dispatch(offline, '/f/portola-2026', { mode: 'navigate' })).body, 'this build\'s shell', 'any path, offline: the shell');

  const hanging = bootWorker({ ...shell, fetchImpl: never });
  const t0 = Date.now();
  assert.equal((await dispatch(hanging, '/', { mode: 'navigate' })).body, 'this build\'s shell');
  assert.ok(Date.now() - t0 < 1000, 'bounded wait — the scaled 4 s budget, not the OS socket timeout');

  const erroring = bootWorker({ ...shell, fetchImpl: () => delayed('<h1>502</h1>', 5, 502) });
  assert.equal((await dispatch(erroring, '/', { mode: 'navigate' })).body, 'this build\'s shell');
});

test('navigations: a redirect or the 404 page is the server\'s real answer and passes straight through', async () => {
  // A navigation's fetch runs redirect:manual, so a 302 (/f/<unknown> -> /)
  // or a cleanUrls 308 reaches the worker as an opaqueredirect with status 0
  // and ok=false. "Not ok" must not mean "serve the shell" or the browser
  // never follows it.
  const opaque = { type: 'opaqueredirect', status: 0, ok: false };
  const redirect = bootWorker({ cached: { '/': 'shell' }, fetchImpl: async () => opaque });
  assert.equal((await dispatch(redirect, '/f/nope', { mode: 'navigate' })).resp, opaque);
  const missing = bootWorker({ cached: { '/': 'shell' }, fetchImpl: () => delayed('WYA?', 5, 404) });
  assert.equal((await dispatch(missing, '/nowhere', { mode: 'navigate' })).body, 'WYA?');
});

test('the data cache is a separate, persistent bucket and CACHE_VERSION was bumped for this drop', () => {
  assert.match(SW_SRC, /const DATA_CACHE = 'festival-nav-data-v1'/);
  const m = SW_SRC.match(/CACHE_VERSION = 'festival-nav-v(\d+)'/);
  assert.ok(m && Number(m[1]) >= 41, 'CACHE_VERSION >= v41 (the wall filters + now line shell)');
});

// ---- activate: the rescue migration must never delete a device's only copy ----

function bootForActivate({ oldEntries, putFails = false, openDataFails = false }) {
  const handlers = {};
  const deleted = [];
  const dataStore = new Map();
  const mkCache = (entries) => ({
    keys: async () => [...entries.keys()].map((u) => new Request(u)),
    match: async (req) => (entries.has(req.url) ? new Response(entries.get(req.url)) : undefined),
    put: async (req, resp) => { if (putFails) throw new Error('QuotaExceededError'); entries.set(req.url, await resp.text()); },
  });
  // The live shell cache is whatever CACHE_VERSION says today — read it from
  // the source so a version bump never turns the current cache into an "old"
  // one in this fixture.
  const CURRENT = SW_SRC.match(/CACHE_VERSION = '([^']+)'/)[1];
  const caches = {
    keys: async () => ['festival-nav-v36', 'festival-nav-data-v1', CURRENT],
    open: async (name) => {
      if (name === 'festival-nav-data-v1') { if (openDataFails) throw new Error('storage'); return mkCache(dataStore); }
      if (name === 'festival-nav-v36') return mkCache(oldEntries);
      return mkCache(new Map());
    },
    delete: async (name) => { deleted.push(name); return true; },
    match: async () => undefined,
  };
  const ctx = {
    self: { addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches, fetch: async () => new Response(''), location: { origin: ORIGIN }, setTimeout, clearTimeout,
    URL, Request, Response, Promise, console,
  };
  vm.runInNewContext(SW_SRC, ctx);
  const run = async () => {
    let done;
    handlers.activate({ waitUntil: (p) => { done = p; } });
    await done;
  };
  return { run, deleted, dataStore };
}

test('activate: festival data in an old shell cache is rescued into the data cache, then the old cache goes', async () => {
  const old = new Map([[`${ORIGIN}/data/festivals/portola-2026.json`, '{"old":true}'], [`${ORIGIN}/js/v3/app.js`, 'shell']]);
  const w = bootForActivate({ oldEntries: old });
  await w.run();
  assert.equal(w.dataStore.get(`${ORIGIN}/data/festivals/portola-2026.json`), '{"old":true}');
  assert.deepEqual(w.deleted, ['festival-nav-v36']);
});

test('activate: when the rescue write FAILS, the old cache is kept — it is that device\'s only offline copy', async () => {
  const old = new Map([[`${ORIGIN}/data/festivals/portola-2026.json`, '{"old":true}']]);
  const w = bootForActivate({ oldEntries: old, putFails: true });
  await w.run();
  assert.deepEqual(w.deleted, [], 'nothing deleted');
  const w2 = bootForActivate({ oldEntries: old, openDataFails: true });
  await w2.run();
  assert.deepEqual(w2.deleted, [], 'nothing deleted when the data cache cannot even open');
});

test('activate: an old cache with no festival data is simply deleted', async () => {
  const w = bootForActivate({ oldEntries: new Map([[`${ORIGIN}/js/v3/app.js`, 'shell']]), openDataFails: true });
  await w.run();
  assert.deepEqual(w.deleted, ['festival-nav-v36']);
});
