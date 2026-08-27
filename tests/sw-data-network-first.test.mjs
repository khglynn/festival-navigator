// The service worker's festival-data strategy, run against the REAL
// service-worker.js in a sandbox (Portola set-times drop, 2026-08-27).
//
// Festival JSONs live in a persistent cache that survives shell bumps — which
// is why they can't be served cache-first: a set-times drop would reach every
// phone one open late. So data is network-first with a bounded wait, and the
// cache answers when the network doesn't. Shell assets stay cache-first.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW_SRC = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
const ORIGIN = 'https://fest.kevinhg.com';

// Boot the worker with a fake caches/fetch. Timeouts are scaled down so the
// 4 s data budget becomes ~40 ms — the ratio between "network" delays and the
// budget is what the strategy is about, not the wall-clock number.
function bootWorker({ cached = {}, fetchImpl }) {
  const handlers = {};
  const store = new Map(Object.entries(cached).map(([path, body]) => [ORIGIN + path, body]));
  const puts = [];
  const cacheObj = {
    match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined),
    put: async (req, resp) => { puts.push(req.url); store.set(req.url, await resp.text()); },
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

async function dispatch(worker, path) {
  let responded;
  worker.handlers.fetch({
    request: new Request(ORIGIN + path),
    respondWith: (p) => { responded = Promise.resolve(p); },
  });
  assert.ok(responded, `worker did not respondWith for ${path}`);
  const resp = await responded;
  return resp ? resp.text() : null;
}

const delayed = (body, ms) => new Promise((resolve) => setTimeout(() => resolve(new Response(body)), ms));
const never = () => new Promise(() => {});

test('festival data: a live network answer beats the cached copy, and refreshes the cache', async () => {
  const w = bootWorker({
    cached: { '/data/festivals/portola-2026.json': '{"status":"lineup"}' },
    fetchImpl: async () => new Response('{"status":"scheduled"}'),
  });
  assert.equal(await dispatch(w, '/data/festivals/portola-2026.json'), '{"status":"scheduled"}');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(w.store.get(`${ORIGIN}/data/festivals/portola-2026.json`), '{"status":"scheduled"}', 'cache updated for next time');
});

test('festival data: a dead network serves the cached copy', async () => {
  const w = bootWorker({
    cached: { '/data/festivals/portola-2026.json': '{"status":"lineup"}' },
    fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
  });
  assert.equal(await dispatch(w, '/data/festivals/portola-2026.json'), '{"status":"lineup"}');
});

test('festival data: a network that never answers serves the cached copy after the budget, not a blank page', async () => {
  const w = bootWorker({
    cached: { '/data/festivals/portola-2026.json': '{"status":"lineup"}' },
    fetchImpl: never,
  });
  const t0 = Date.now();
  assert.equal(await dispatch(w, '/data/festivals/portola-2026.json'), '{"status":"lineup"}');
  assert.ok(Date.now() - t0 < 1000, 'bounded wait — the scaled 4 s budget, not forever');
});

test('festival data: nothing cached + slow network = wait for the network (a first open must not 503)', async () => {
  const w = bootWorker({ fetchImpl: () => delayed('{"status":"scheduled"}', 80) });
  assert.equal(await dispatch(w, '/data/festivals/seismic-9.json'), '{"status":"scheduled"}');
});

test('festival data: a non-OK network answer falls back to the cached copy', async () => {
  const w = bootWorker({
    cached: { '/data/festivals/portola-2026.json': '{"status":"lineup"}' },
    fetchImpl: async () => new Response('nope', { status: 502 }),
  });
  assert.equal(await dispatch(w, '/data/festivals/portola-2026.json'), '{"status":"lineup"}');
});

test('shell assets stay cache-first: the cached copy answers even when the network is alive', async () => {
  const w = bootWorker({
    cached: { '/js/v3/app.js': 'old' },
    fetchImpl: async () => new Response('new'),
  });
  assert.equal(await dispatch(w, '/js/v3/app.js'), 'old');
});

test('the data cache is a separate, persistent bucket and CACHE_VERSION was bumped for this drop', () => {
  assert.match(SW_SRC, /const DATA_CACHE = 'festival-nav-data-v1'/);
  const m = SW_SRC.match(/CACHE_VERSION = 'festival-nav-v(\d+)'/);
  assert.ok(m && Number(m[1]) >= 39, 'CACHE_VERSION >= v39');
});
