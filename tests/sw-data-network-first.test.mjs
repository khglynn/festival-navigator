// The service worker's festival-data strategy, run against the REAL
// service-worker.js in a sandbox (Portola set-times drop, 2026-08-27).
//
// Festival JSONs live in a persistent cache that survives shell bumps — which
// is why they can't be served cache-first: a set-times drop would reach every
// phone one open late. So data is network-first with a bounded wait, and the
// cache answers when the network doesn't. Shell assets stay cache-first. Every
// background cache write is registered with waitUntil SYNCHRONOUSLY, so a
// browser that reaps the worker after the response cannot discard the write
// (Codex gate, 2026-08-27).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW_SRC = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
const ORIGIN = 'https://fest.kevinhg.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Boot the worker with a fake caches/fetch. Timeouts are scaled down so the
// 4 s data budget becomes ~40 ms — the ratio between "network" delays and the
// budget is what the strategy is about, not the wall-clock number.
function bootWorker({ cached = {}, fetchImpl, putDelay = 0 }) {
  const handlers = {};
  const store = new Map(Object.entries(cached).map(([path, body]) => [ORIGIN + path, body]));
  const puts = [];
  const cacheObj = {
    match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined),
    put: async (req, resp) => {
      const body = await resp.text();
      if (putDelay) await sleep(putDelay);
      puts.push(req.url); store.set(req.url, body);
    },
    keys: async () => [], add: async () => {}, addAll: async () => {},
  };
  const ctx = {
    self: { addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open: async () => cacheObj, match: async (req) => cacheObj.match(req), keys: async () => [], delete: async () => true },
    fetch: fetchImpl,
    location: { origin: ORIGIN },
    setTimeout: (fn, ms) => setTimeout(fn, Math.round(ms / 100)),
    clearTimeout,
    URL, Request, Response, Promise, console,
  };
  vm.runInNewContext(SW_SRC, ctx);
  return { handlers, store, puts };
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
  return { resp, body: resp && resp.type !== 'error' ? await resp.text() : null, waited, registeredSync };
}

const delayed = (body, ms) => new Promise((resolve) => setTimeout(() => resolve(new Response(body)), ms));
const never = () => new Promise(() => {});

test('festival data: a live network answer beats the cached copy, and refreshes the cache', async () => {
  const w = bootWorker({
    cached: { '/data/festivals/portola-2026.json': '{"status":"lineup"}' },
    fetchImpl: async () => new Response('{"status":"scheduled"}'),
  });
  const { body, waited } = await dispatch(w, '/data/festivals/portola-2026.json');
  assert.equal(body, '{"status":"scheduled"}');
  await Promise.all(waited);
  assert.equal(w.store.get(`${ORIGIN}/data/festivals/portola-2026.json`), '{"status":"scheduled"}', 'cache updated for next time');
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
  assert.notEqual(w.store.get(`${ORIGIN}/data/festivals/portola-2026.json`), '{"status":"scheduled"}', 'not written yet — the network is still out');
  await Promise.all(waited);
  assert.equal(w.store.get(`${ORIGIN}/data/festivals/portola-2026.json`), '{"status":"scheduled"}', 'settled only after the late write landed');
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

test('shell assets stay cache-first, and their background refresh is held open by waitUntil too', async () => {
  const w = bootWorker({
    cached: { '/js/v3/app.js': 'old' },
    fetchImpl: () => delayed('new', 20),
    putDelay: 20,
  });
  const { body, waited, registeredSync } = await dispatch(w, '/js/v3/app.js');
  assert.equal(body, 'old');
  assert.equal(registeredSync, 1);
  await Promise.all(waited);
  assert.equal(w.store.get(`${ORIGIN}/js/v3/app.js`), 'new', 'the shell copy refreshed in the background');
});

test('shell assets: a cold miss with a dead network is an explicit error response, never respondWith(undefined)', async () => {
  const w = bootWorker({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  const { resp } = await dispatch(w, '/js/v3/nowhere.js');
  assert.ok(resp, 'a Response object came back');
  assert.equal(resp.type, 'error');
});

test('navigations: network-first, the cached shell when offline, and the background write held open by waitUntil', async () => {
  const online = bootWorker({ cached: { '/': 'old shell' }, fetchImpl: () => delayed('new shell', 10), putDelay: 20 });
  const a = await dispatch(online, '/', { mode: 'navigate' });
  assert.equal(a.body, 'new shell');
  assert.equal(a.registeredSync, 1, 'the navigation cache write is registered inside the dispatch window');
  await Promise.all(a.waited);
  assert.equal(online.store.get(`${ORIGIN}/`), 'new shell');
  const offline = bootWorker({ cached: { '/': 'old shell' }, fetchImpl: async () => { throw new TypeError('offline'); } });
  const b = await dispatch(offline, '/', { mode: 'navigate' });
  assert.equal(b.body, 'old shell', 'offline falls back to the cached shell');
});

test('the data cache is a separate, persistent bucket and CACHE_VERSION was bumped for this drop', () => {
  assert.match(SW_SRC, /const DATA_CACHE = 'festival-nav-data-v1'/);
  const m = SW_SRC.match(/CACHE_VERSION = 'festival-nav-v(\d+)'/);
  assert.ok(m && Number(m[1]) >= 39, 'CACHE_VERSION >= v39');
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
  const caches = {
    keys: async () => ['festival-nav-v36', 'festival-nav-data-v1', 'festival-nav-v39'],
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
