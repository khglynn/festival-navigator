// "Get the latest version" (v90, Kevin at Portola, 2026-09-25): his iPhone
// kept the old build, and a private tab — which loses who you are — was the
// only way to the new one. Settings → App now says which build this phone
// runs and, on a tap, asks the worker registration for a newer one: the same
// machinery every release already rides. A newer worker installs, takes
// over, and index.html's glue reloads the page when nothing is in progress.
// The check only CALLS that machinery and says what happened; it never
// clears a cache or touches storage (the offline app and every festival this
// phone can open live there), and it does nothing at all offline.
//
// These are the check's decisions, on a fake page; tests/update-row.test.mjs
// is the row in the real shell.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://fest.kevinhg.com/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = dom.window.location;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const { checkForUpdate, updateWords, updateRow, updateEnv } = await import('../js/v3/settings.js');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// A worker whose install the test drives: `to(state)` moves it on.
class Worker extends EventTarget {
  constructor(state) { super(); this.state = state; }
  to(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
}

// A fake page: v89 running, v89 in charge, online, no strip — unless told.
function page(over = {}) {
  const calls = { update: 0, reload: 0 };
  const reg = {
    active: { build: 'v89' },
    installing: null,
    waiting: null,
    update: async () => { calls.update += 1; if (over.update) await over.update(reg); },
  };
  let behind = !!over.behind;
  const env = {
    online: () => over.online !== false,
    registration: async () => {
      if (over.lookup) throw new Error(over.lookup);
      return over.noWorker ? null : reg;
    },
    pageBuild: async () => ('page' in over ? over.page : 'v89'),
    activeBuild: async (r) => (r && r.active ? r.active.build : null),
    behind: () => behind,
    busy: () => (typeof over.busy === 'function' ? over.busy() : over.busy || null),
    settles: over.settles || (async (w) => w.state),
    sleep: async () => { if (over.onSleep) behind = over.onSleep() || behind; },
    reload: () => { calls.reload += 1; },
  };
  return { env, reg, calls };
}
const run = async (p) => {
  const said = [];
  const last = await checkForUpdate(p.env, (s) => said.push(s.state));
  return { last, said };
};

test('nothing newer: it checks, and says which build this phone runs', async () => {
  const p = page();
  const { last, said } = await run(p);
  assert.equal(p.calls.update, 1, 'the registration was asked');
  assert.deepEqual(said, ['checking', 'latest']);
  assert.equal(updateWords(last), 'You’re on the latest — v89');
  assert.equal(p.calls.reload, 0, 'nothing to switch to, so no reload');
});

test('offline: it says so and asks nothing', async () => {
  const p = page({ online: false });
  const { last, said } = await run(p);
  assert.deepEqual(said, ['offline']);
  assert.equal(p.calls.update, 0, 'no network call on one bar that is not there');
  assert.equal(updateWords(last), 'You’re offline — this phone keeps v89 until you have signal');
});

test('a newer build already took over and the strip is up: ready without a network, and the check never runs', async () => {
  const p = page({ behind: true, online: false });
  p.reg.active = { build: 'v90' };
  const { last, said } = await run(p);
  assert.deepEqual(said, ['ready']);
  assert.equal(p.calls.update, 0);
  assert.equal(updateWords(last), 'v90 is ready — tap to use it');
});

test('a newer build downloads and takes over: the glue reloads a quiet page; one that stays is told it is ready', async () => {
  const w = new Worker('installing');
  const p = page({
    update: async (reg) => { reg.installing = w; },
    settles: async (worker) => { worker.to('activated'); p.reg.active = { build: 'v90' }; return worker.state; },
    // The glue found something in progress and put up the strip.
    onSleep: () => true,
  });
  const { last, said } = await run(p);
  assert.deepEqual(said, ['checking', 'downloading', 'switching', 'ready']);
  assert.equal(updateWords(last), 'v90 is ready — tap to use it');
  assert.equal(last.page, 'v89', 'the page still runs what it loaded');
  assert.equal(p.calls.reload, 0, 'the check itself never reloads');
});

test('a page no worker controlled when it loaded: behind with no strip still reads ready', async () => {
  const w = new Worker('installing');
  const p = page({
    update: async (reg) => { reg.installing = w; },
    settles: async (worker) => { worker.to('activated'); p.reg.active = { build: 'v90' }; return worker.state; },
  });
  const { last } = await run(p);
  assert.equal(last.state, 'ready');
  assert.equal(last.next, 'v90');
});

test('the download fails (a worker goes redundant): say so, keep what is running', async () => {
  const p = page({ update: async (reg) => { reg.installing = new Worker('installing'); }, settles: async () => 'redundant' });
  const { last, said } = await run(p);
  assert.deepEqual(said, ['checking', 'downloading', 'failed']);
  assert.equal(updateWords(last), 'Couldn’t download it — try again with more signal');
});

test('a slow download is left to finish by itself', async () => {
  const p = page({ update: async (reg) => { reg.installing = new Worker('installing'); }, settles: async () => 'timeout' });
  const { last } = await run(p);
  assert.equal(last.state, 'slow');
  assert.equal(updateWords(last), 'Still downloading — it switches over by itself when it’s done');
});

test('the server cannot be reached: a refused check and a hung one both say so', async () => {
  const refused = page({ update: async () => { throw new TypeError('Failed to update a ServiceWorker'); } });
  assert.equal((await run(refused)).last.state, 'unreachable');
  const thrown = page();
  thrown.reg.update = () => { throw new DOMException('gone', 'InvalidStateError'); };
  assert.equal((await run(thrown)).last.state, 'unreachable', 'a synchronous throw too');

  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const hung = page({ update: () => new Promise(() => {}) });
    const pending = run(hung);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    mock.timers.tick(15000);
    const { last } = await pending;
    assert.equal(last.state, 'unreachable', 'a network that hangs is given up on');
    assert.equal(updateWords(last), 'Couldn’t check — try again with more signal');
  } finally {
    mock.timers.reset();
  }
});

test('no worker at all (a private window, a browser without one): the reload is already the latest', async () => {
  const { last } = await run(page({ noWorker: true }));
  assert.equal(last.state, 'no-worker');
  assert.match(updateWords(last), /reload always gets the latest/);
});

// ---- review round (Codex on e4d40ca, 2026-09-25) ------------------------------------
// A "ready" tap must never reload through running work (a Spotify scan marks
// body[data-busy]; a reload throws it away). And a registration lookup that
// throws or hangs is not "this browser keeps no offline copy".

test('ready while a Spotify scan runs: held, and the words say what it waits for', async () => {
  const w = new Worker('installing');
  const p = page({
    busy: 'spotify-scan',
    update: async (reg) => { reg.installing = w; },
    settles: async (worker) => { worker.to('activated'); p.reg.active = { build: 'v90' }; return worker.state; },
    onSleep: () => true,
  });
  const { last, said } = await run(p);
  assert.deepEqual(said, ['checking', 'downloading', 'switching', 'held']);
  assert.equal(updateWords(last), 'v90 switches in once the Spotify scan finishes — tap again then');
  const strip = page({ behind: true, busy: 'something-new' });
  strip.reg.active = { build: 'v90' };
  const held = (await run(strip)).last;
  assert.equal(held.state, 'held', 'the strip already up, work running: held too');
  assert.equal(updateWords(held), 'v90 switches in once what’s running finishes — tap again then', 'work it cannot name still holds');
});

test('the row: a tap on ready while work runs does NOT reload; the first tap after it finishes does', async () => {
  let busy = null;
  const p = page({ behind: true, busy: () => busy });
  p.reg.active = { build: 'v90' };
  const row = updateRow(() => p.env);
  document.body.appendChild(row);
  const words = () => row.querySelector('.row-sub').textContent;
  const tap = async () => { row.click(); for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)); };
  await tap();
  assert.equal(row.dataset.update, 'ready');
  assert.equal(words(), 'v90 is ready — tap to use it');
  busy = 'spotify-scan'; // a scan starts
  await tap();
  assert.equal(p.calls.reload, 0, 'the scan is not thrown away');
  assert.equal(row.dataset.update, 'held');
  assert.equal(words(), 'v90 switches in once the Spotify scan finishes — tap again then');
  await tap();
  assert.equal(p.calls.reload, 0, 'still running, still held');
  busy = null; // the scan finishes
  await tap();
  assert.equal(p.calls.reload, 1, 'the first tap after it is done switches');
  row.remove();
});

test('a registration lookup that fails is not "no offline copy": it says it could not check', async () => {
  const p = page({ lookup: 'getRegistration rejected' });
  const { last, said } = await run(p);
  assert.deepEqual(said, ['lookup-failed']);
  assert.equal(p.calls.update, 0);
  assert.equal(updateWords(last), 'Couldn’t check just now — try again in a moment');
  assert.doesNotMatch(updateWords(last), /offline copy|always gets the latest/);
  // Offline still says offline first: that is the truer reason.
  assert.equal((await run(page({ lookup: 'x', online: false }))).last.state, 'offline');
});

test('the real page side: a throwing or hanging getRegistration is a failed lookup; only a real "none" is no-worker', async () => {
  const nav = dom.window.navigator;
  const withContainer = async (container, drive) => {
    Object.defineProperty(nav, 'serviceWorker', { value: container, configurable: true });
    try {
      const env = { ...updateEnv(), pageBuild: async () => 'v89', online: () => true };
      return await drive(env);
    } finally {
      delete nav.serviceWorker;
    }
  };
  const base = () => Object.assign(new dom.window.EventTarget(), { startMessages() {} });
  const threw = await withContainer(Object.assign(base(), { getRegistration: () => Promise.reject(new DOMException('no', 'SecurityError')) }), (env) => checkForUpdate(env));
  assert.equal(threw.state, 'lookup-failed', 'a rejected lookup');
  const threwSync = await withContainer(Object.assign(base(), { getRegistration: () => { throw new TypeError('boom'); } }), (env) => checkForUpdate(env));
  assert.equal(threwSync.state, 'lookup-failed', 'a lookup that throws outright');
  const none = await withContainer(Object.assign(base(), { getRegistration: async () => undefined }), (env) => checkForUpdate(env));
  assert.equal(none.state, 'no-worker', 'the browser answered: none registered');
  const noApi = await withContainer(undefined, (env) => checkForUpdate(env));
  assert.equal(noApi.state, 'no-worker', 'no worker API at all');

  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const hung = await withContainer(Object.assign(base(), { getRegistration: () => new Promise(() => {}) }), async (env) => {
      const pending = checkForUpdate(env);
      for (let i = 0; i < 5; i++) await Promise.resolve();
      mock.timers.tick(5000);
      return pending;
    });
    assert.equal(hung.state, 'lookup-failed', 'a lookup that never answers is given up on, and is not a no');
  } finally {
    mock.timers.reset();
  }
});

test('every state has plain words, and an unknown build never prints "null"', () => {
  for (const state of ['idle', 'checking', 'latest', 'downloading', 'switching', 'ready', 'held', 'slow', 'offline', 'unreachable', 'lookup-failed', 'failed', 'no-worker']) {
    const w = updateWords({ state, page: null, next: null });
    assert.ok(w && !/null|undefined/.test(w), `${state}: "${w}"`);
  }
  assert.equal(updateWords({ state: 'idle', page: 'v89' }), 'This phone runs v89');
});

test('the update code clears nothing: no cache, no storage, no reload stored bare', () => {
  const src = readFileSync(join(ROOT, 'js/v3/settings.js'), 'utf8');
  const from = src.indexOf('// ---- get the latest version');
  const to = src.indexOf('// Open a settings drill by its router key');
  assert.ok(from > 0 && to > from, 'the section is where it says');
  const code = src.slice(from, to).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.doesNotMatch(code, /caches\s*\.|CacheStorage/, 'Cache Storage is never touched (the offline app and festival data live there)');
  assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|removeLS|saveLS/, 'storage holds the person token and the picks');
  assert.doesNotMatch(code, /unregister/, 'the worker that serves offline is never removed');
  assert.doesNotMatch(code, /[=:(,]\s*(window\.)?location\.reload\b(?!\()/, 'a DOM method stored bare throws "Illegal invocation"');
});
