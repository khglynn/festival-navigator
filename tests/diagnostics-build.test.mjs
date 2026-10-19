// The build line in the Diagnostics paste (Settings → App → Diagnostics, v116,
// LEDGER follow-up 2's leftover). AGENTS.md tells whoever reads a "still
// broken" report to trust that line first, and it was a guess: the first
// festival-nav-v* cache name on the phone, which after an update names
// whichever cache the browser lists first, and with no cache says
// 'no-cache'. It now gives the answer crash reports give — the worker that
// served this page when it loaded; else the page's own fn-build meta; else
// the cache guess — and says which one it is (`buildFrom`).
//
// Each case gets a fresh page and a fresh copy of the module (a query string
// makes a new module instance): the build is settled once per page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let instance = 0;
const settle = (ms = 5) => new Promise((r) => setTimeout(r, ms));

// A page: its fn-build meta (or none), the cache names the phone holds (or
// no Cache API at all), and a worker that answers with `answers` (or none in
// control, or one that never answers: answers === 'silent').
async function page({ meta = null, caches = null, answers = null } = {}) {
  const head = meta === null ? '' : `<meta name="fn-build" content="${meta}">`;
  const dom = new JSDOM(`<!doctype html><html><head>${head}</head><body></body></html>`, { url: 'https://fest.kevinhg.com/' });
  globalThis.window = dom.window;
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, writable: true,
    value: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  });
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  if (caches) dom.window.caches = { keys: async () => caches.slice() };
  let worker = null;
  if (answers) {
    const container = new dom.window.EventTarget();
    worker = {
      answers,
      postMessage(msg) {
        if (!msg || msg.fn !== 'build?' || this.answers === 'silent') return;
        const e = new dom.window.Event('message');
        e.data = { fnBuild: `festival-nav-${this.answers}`, fnStamp: '0123abcd' };
        setTimeout(() => container.dispatchEvent(e), 0);
      },
    };
    container.controller = worker;
    Object.defineProperty(dom.window.navigator, 'serviceWorker', { configurable: true, value: container });
  }
  const m = await import(`../js/errlog.js?diag=${++instance}`);
  return { dom, m, worker };
}

test('two caches on the phone, a worker in control: the worker’s build, not the first cache name', async () => {
  // After an update both versions can sit in Cache Storage for a moment, and
  // the browser lists them in its own order.
  const { m } = await page({ meta: 'v116', caches: ['festival-nav-v115', 'festival-nav-v116', 'festival-nav-data-v1'], answers: 'v116' });
  const d = await m.diagnostics();
  assert.equal(d.build, 'v116');
  assert.equal(d.buildFrom, 'worker');
});

test('the worker’s answer wins over the page’s meta: it served the modules', async () => {
  // A returning phone's first open after a release: this release's page from
  // the network, the previous release's modules from the old worker.
  const { m } = await page({ meta: 'v116', caches: ['festival-nav-v115'], answers: 'v115' });
  const d = await m.diagnostics();
  assert.equal(d.build, 'v115');
  assert.equal(d.buildFrom, 'worker');
});

test('no worker in control: the page’s own build, never a cache name', async () => {
  const { m } = await page({ meta: 'v116', caches: ['festival-nav-v115', 'festival-nav-data-v1'] });
  const d = await m.diagnostics();
  assert.equal(d.build, 'v116');
  assert.equal(d.buildFrom, 'page');
});

test('no worker and no meta (an old page): the cache name, and it says so', async () => {
  const { m } = await page({ caches: ['festival-nav-data-v1', 'festival-nav-v99'] });
  const d = await m.diagnostics();
  assert.equal(d.build, 'v99', 'the data cache is never a build');
  assert.equal(d.buildFrom, 'cache-guess');
});

test('no worker, no meta, no Cache API: unknown, not a guess', async () => {
  const { m } = await page();
  const d = await m.diagnostics();
  assert.equal(d.build, null);
  assert.equal(d.buildFrom, 'unknown');
});

test('a worker that never answers (v87 and before): the page’s own build', async () => {
  const { m } = await page({ meta: 'v116', caches: ['festival-nav-v87'], answers: 'silent' });
  const d = await m.diagnostics();
  assert.equal(d.build, 'v116');
  assert.equal(d.buildFrom, 'page');
});

test('reports off: the build is still asked at boot, so a newer worker taking over later does not rename this page', async () => {
  // With reports off nothing used to ask until the paste was copied — by
  // then a newer worker may control the page (the new-build strip is up)
  // and would answer with ITS build while this page still runs the old one.
  // Asking is a message to this phone's own worker: nothing leaves.
  const { m, worker } = await page({ meta: 'v115', caches: ['festival-nav-v115'], answers: 'v115' });
  m.hookGlobalErrors(); // index.html, at boot; no report key: reports are off
  await settle(20);
  worker.answers = 'v116'; // the newer worker took over; the page has not reloaded
  const d = await m.diagnostics();
  assert.equal(d.build, 'v115');
  assert.equal(d.buildFrom, 'worker');
  assert.equal(d.reports, 'not set up', 'and still nothing is reported');
});
