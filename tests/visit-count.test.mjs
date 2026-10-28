// Vercel's visit count (js/errlog.js countVisits / visitEvent, v117; Kevin,
// 2026-10-28). Vercel's script sends `location.href` whole, and on this app
// the hash is `#g=<crew token>`, the crew's only credential. So the count
// loads only on the three production hosts, only while "Send crash reports
// and usage to Kevin" is on and Stay offline is off, once the page is idle —
// and every event it would send passes visitEvent(), which keeps origin and
// path and nothing else, re-reading the switch at send time.
//
// Each case gets a fresh page (a new JSDOM) and a fresh copy of the module (a
// query string makes a new module instance), as in errlog-queue.test.mjs.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { JSDOM } from 'jsdom';

const KEY = 'phc_testkeyForFestivalNavigatorCI01'; // gitleaks:allow (the made-up key errlog-queue.test.mjs uses)
const SCRIPT = '/_vercel/insights/script.js';
const crewToken = () => randomBytes(20).toString('base64url'); // made up, never a real crew

let instance = 0;
async function fresh({ url = 'https://crew.kevinhg.com/', key = KEY, settings = null, online = true, idle = true } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head><meta name="fn-report-key" content="${key}" data-hosts="kevinhg.com"></head><body></body></html>`, { url });
  globalThis.window = dom.window;
  const store = new Map();
  if (settings) store.set('fn_settings_v1', JSON.stringify(settings));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  });
  Object.defineProperty(dom.window.navigator, 'onLine', { configurable: true, get: () => online });
  // A receiver-strict requestIdleCallback that holds its callback until the
  // test says the page is idle (AGENTS.md, WebIDL receivers).
  const idleQueue = [];
  if (idle) {
    dom.window.requestIdleCallback = function requestIdleCallback(fn) {
      if (this !== dom.window) throw new TypeError('Illegal invocation');
      idleQueue.push(fn);
      return idleQueue.length;
    };
  }
  const m = await import(`../js/errlog.js?visits=${++instance}`);
  const scripts = () => [...dom.window.document.querySelectorAll('script')].map((s) => ({ src: new URL(s.src).pathname, defer: s.defer, inHead: s.parentNode === dom.window.document.head }));
  const goIdle = () => { while (idleQueue.length) idleQueue.shift()(); };
  return { dom, store, m, scripts, goIdle, idleQueue };
}

// What Vercel's script does with the queue when it loads (va.vercel-scripts.com
// v1, read 2026-10-28): every queued call runs before the first page view, so
// the beforeSend we queue applies to it.
function vercelBeforeSend(dom) {
  let hook = null;
  for (const args of dom.window.vaq || []) if (args[0] === 'beforeSend') hook = args[1];
  return hook;
}

test('on a production host, once idle: one deferred script, and a beforeSend queued first', async () => {
  const { dom, m, scripts, goIdle, idleQueue } = await fresh();
  m.countVisits();
  assert.deepEqual(scripts(), [], 'nothing before the page is idle');
  assert.equal(idleQueue.length, 1);
  goIdle();
  assert.deepEqual(scripts(), [{ src: SCRIPT, defer: true, inHead: true }]);
  assert.equal(typeof dom.window.va, 'function', 'the queue Vercel documents for plain HTML');
  assert.equal(vercelBeforeSend(dom), m.visitEvent, 'every event goes through visitEvent');
  m.countVisits();
  goIdle();
  assert.equal(scripts().length, 1, 'asked twice, loaded once');
});

test('the crew link never leaves: the URL is cut to origin and path', async () => {
  const token = crewToken();
  const { dom, m, goIdle } = await fresh({ url: `https://crew.kevinhg.com/?f=edc-orlando-2026#g=${token}&view=list` });
  m.countVisits();
  goIdle();
  const before = { type: 'pageview', url: dom.window.location.href };
  const after = vercelBeforeSend(dom)(before);
  assert.deepEqual(after, { type: 'pageview', url: 'https://crew.kevinhg.com/' });
  assert.ok(!JSON.stringify(after).includes(token));
  assert.equal(before.url.includes(token), true, 'the event handed in is left alone');
  assert.deepEqual(m.visitEvent({ type: 'pageview', url: 'https://fest.kevinhg.com/f/edc-orlando-2026?utm=x' }), { type: 'pageview', url: 'https://fest.kevinhg.com/f/edc-orlando-2026' });
});

test('a path the scrubber would touch, or no URL at all, is dropped rather than sent', async () => {
  const { m } = await fresh();
  assert.equal(m.visitEvent({ type: 'pageview', url: `https://crew.kevinhg.com/${crewToken()}` }), null);
  assert.equal(m.visitEvent({ type: 'pageview', url: 'not a url' }), null);
  assert.equal(m.visitEvent({ type: 'pageview' }), null);
  assert.equal(m.visitEvent(null), null);
});

test('the switch is read again at send time: Off or Stay offline after loading sends nothing', async () => {
  const { store, m, goIdle } = await fresh();
  m.countVisits();
  goIdle();
  const ev = { type: 'pageview', url: 'https://crew.kevinhg.com/' };
  assert.notEqual(m.visitEvent(ev), null);
  store.set('fn_settings_v1', JSON.stringify({ crashReports: false }));
  assert.equal(m.visitEvent(ev), null, 'reports switched off');
  store.set('fn_settings_v1', JSON.stringify({ stayOffline: true }));
  assert.equal(m.visitEvent(ev), null, 'Stay offline');
});

for (const [why, opts] of [
  ['localhost (tests and local runs)', { url: 'http://localhost:3000/' }],
  ['a Vercel preview', { url: 'https://festival-navigator-git-x-kevinhg.vercel.app/' }],
  ['the old staging host', { url: 'https://stage.fest.kevinhg.com/' }],
  ['a fork on its own domain', { url: 'https://fest.example.com/' }],
  ['reports switched off', { settings: { crashReports: false } }],
  ['Stay offline', { settings: { stayOffline: true } }],
  ['no report key (a fork that emptied it)', { key: '' }],
  ['no signal', { online: false }],
]) {
  test(`never loaded: ${why}`, async () => {
    const { dom, m, scripts, goIdle } = await fresh(opts);
    m.countVisits();
    goIdle();
    assert.deepEqual(scripts(), []);
    assert.equal(dom.window.vaq, undefined);
  });
}

test('switched off while the page was waiting to be idle: nothing loads', async () => {
  const { store, m, scripts, goIdle } = await fresh();
  m.countVisits();
  store.set('fn_settings_v1', JSON.stringify({ crashReports: false }));
  goIdle();
  assert.deepEqual(scripts(), []);
});

test('a browser with no requestIdleCallback (older Safari) waits two seconds instead', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { m, scripts } = await fresh({ idle: false });
    m.countVisits();
    mock.timers.tick(1999);
    assert.deepEqual(scripts(), []);
    mock.timers.tick(1);
    assert.deepEqual(scripts().map((s) => s.src), [SCRIPT]);
  } finally {
    mock.timers.reset();
  }
});

test('index.html starts it beside the error hook, looked up so an older errlog.js cannot break the hook', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /import \* as errlog from '\/js\/errlog\.js';\s*errlog\.hookGlobalErrors\(\);\s*if \(typeof errlog\.countVisits === 'function'\) errlog\.countVisits\(\);/);
  assert.ok(!html.includes(SCRIPT), 'no static tag: only countVisits loads it');
  for (const page of ['gallery.html', '404.html', 'spotify-callback.html']) {
    const text = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
    assert.ok(!/countVisits|_vercel\/insights/.test(text), `${page} is never counted`);
  }
});
