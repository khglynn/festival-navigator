// "Get the latest version" in the real shell (v90, Kevin at Portola,
// 2026-09-25): the row sits in Settings → App beside Diagnostics, names the
// build this phone runs, and a tap asks the worker registration for a newer
// one — offline it says so and asks nothing. Across every tap, nothing the
// phone keeps is thrown away: no cache deleted (the offline app and every
// festival this phone can open), no storage key removed or changed (the
// person token, the crew link, the picks). tests/update-check.test.mjs holds
// the check's decisions case by case; this is the row a person taps.
//
// The real shell, booted as a warm open (the network never answers) on a
// pinned clock, so nothing is live and NOW never renders. jsdom has no service
// worker, so the page's container is a stand-in with the real one's shape:
// getRegistration(), a controller, and workers that answer "build?" the way
// service-worker.js does.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-10T17:00:00Z').getTime() });

const { bootShell, settle } = await import('./helpers/shell-rig.mjs');
const { FID, INDEX, FEST, crewDoc, heldNetwork, cachesHolding, within, SCREENS } = await import('./helpers/warm-rig.mjs');

const TOKEN = 'updaterow_0123456789abcd'; // a made-up crew, never a real link
globalThis.caches = cachesHolding({ '/data/festivals/index.json': INDEX, [`/data/festivals/${FID}.json`]: FEST });
const net = heldNetwork();
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(crewDoc({ Kevin: { colorIndex: 0 } })),
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; mock.timers.reset(); });
const { $, dom } = shell;
const win = dom.window;

// The page's CacheStorage, as the page reaches it: every delete is counted.
let cacheDeletes = 0;
win.caches = {
  keys: async () => ['festival-nav-v89', 'festival-nav-data-v1'],
  delete: async () => { cacheDeletes += 1; return true; },
  open: async () => ({ keys: async () => [], match: async () => undefined, delete: async () => { cacheDeletes += 1; return true; } }),
  match: async () => undefined,
};

// A service-worker container with the real one's shape.
const container = new win.EventTarget();
container.startMessages = () => {};
class Worker extends win.EventTarget {
  constructor(build, state = 'activated') { super(); this.build = build; this.state = state; }
  postMessage(m) {
    if (!m || m.fn !== 'build?') return;
    const data = { fnBuild: `festival-nav-${this.build}`, fnStamp: '0123abcd' };
    setTimeout(() => container.dispatchEvent(new win.MessageEvent('message', { data })), 1);
  }
  to(state) { this.state = state; this.dispatchEvent(new win.Event('statechange')); }
}
const v89 = new Worker('v89');
const reg = { active: v89, installing: null, waiting: null, updates: 0, next: null };
reg.update = async () => { reg.updates += 1; if (reg.next) reg.next(); };
container.controller = v89;
container.getRegistration = async () => reg;
Object.defineProperty(win.navigator, 'serviceWorker', { value: container, configurable: true });
let online = true;
Object.defineProperty(win.navigator, 'onLine', { get: () => online, configurable: true });

// What the phone keeps that a reload must never lose, read key by key.
const KEYS = ['fn_crews_v3', `fn_me_v3_${TOKEN}`, `fn_crew_doc_v3_${TOKEN}`, `fn_crew_fest_v3_${TOKEN}`];
const kept = () => KEYS.map((k) => globalThis.localStorage.getItem(k));

const row = () => [...$('settings-root').querySelectorAll('button.list-row')].find((b) => /Get the latest version/.test(b.textContent));
const words = () => row().querySelector('.row-sub').textContent;
const tap = async (ms = 20) => { row().click(); await settle(ms); };

test('the row sits beside Diagnostics and names the build this phone runs', async () => {
  assert.notEqual(await within(1500, () => SCREENS.filter((id) => $(id).style.display !== 'none').includes('screen-app')), null, 'the wall');
  $('gear-btn').click();
  await settle(20);
  assert.ok(row(), 'the row is in Settings');
  const titles = [...$('settings-root').querySelectorAll('.list-row .row-title')].map((t) => t.textContent);
  const at = titles.indexOf('Get the latest version');
  assert.ok(at >= 0 && /^Diagnostics/.test(titles[at + 1]), `right before Diagnostics (${titles.join(' / ')})`);
  assert.equal(row().tagName, 'BUTTON', 'a real button: the keyboard reaches it and it wears the touch floor');
  assert.notEqual(await within(1500, () => words() === 'This phone runs v89'), null, `it names the build (${words()})`);
  assert.equal(row().querySelector('.row-sub').getAttribute('aria-live'), 'polite', 'and a screen reader hears each state');
});

test('offline: it says so and asks nothing', async () => {
  const before = kept();
  online = false;
  await tap();
  assert.equal(words(), 'You’re offline — this phone keeps v89 until you have signal');
  assert.equal(reg.updates, 0, 'no update asked for');
  online = true;
  assert.deepEqual(kept(), before);
  assert.equal(cacheDeletes, 0);
});

test('online with nothing newer: one check, "you’re on the latest"', async () => {
  await tap();
  assert.notEqual(await within(1500, () => /on the latest/.test(words())), null, words());
  assert.equal(words(), 'You’re on the latest — v89');
  assert.equal(reg.updates, 1);
});

test('a newer build: downloading, then ready once it has taken over — and nothing the phone keeps is touched', async () => {
  const before = kept();
  const v90 = new Worker('v90', 'installing');
  reg.next = () => { reg.installing = v90; };
  await tap(10);
  assert.equal(words(), 'Downloading the new version…');
  assert.equal(row().dataset.update, 'downloading');
  row().click(); // a second tap while it runs starts nothing
  await settle(10);
  assert.equal(reg.updates, 2, 'one check per run');
  reg.installing = null;
  reg.active = v90;
  v90.to('activated');
  await settle(10);
  assert.equal(words(), 'Got it — switching over…');
  // In a browser the glue reloads here when nothing is in progress; jsdom has
  // no glue, so the page stays — the case where something WAS in progress.
  assert.notEqual(await within(3000, () => row().dataset.update === 'ready'), null, words());
  assert.equal(words(), 'v90 is ready — tap to use it');
  assert.deepEqual(kept(), before, 'the crew, the person and the picks are all still here');
  assert.equal(cacheDeletes, 0, 'no cache deleted — the offline app and the festival data stay');
});

test('a download that fails says so and leaves the running build alone', async () => {
  // A fresh row, as Settings renders it when you come back.
  $('settings-root').querySelector('.back-btn').click();
  await settle(10);
  reg.active = v89;
  const bad = new Worker('v91', 'installing');
  reg.next = () => { reg.installing = bad; setTimeout(() => { reg.installing = null; bad.to('redundant'); }, 5); };
  $('gear-btn').click();
  await settle(20);
  await tap(10);
  assert.notEqual(await within(1500, () => row().dataset.update === 'failed'), null, words());
  assert.equal(words(), 'Couldn’t download it — try again with more signal');
  assert.equal(cacheDeletes, 0);
});
