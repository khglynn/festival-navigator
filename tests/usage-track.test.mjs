// Usage events through the one door (js/errlog.js track, v108, 2026-10-01).
//
// Kevin, 2026-10-01: "Let's not hold till after ACL for the full tracking —
// do it now." How the app is used may leave the phone; what is IN it never
// does. So track() takes only the events and values on its allowlist
// (USAGE): an unknown event, an unknown property, or a value outside its
// shape is dropped and counted — never sent, never coerced into something
// sendable. The same switch as crash reports, the same queue (usage goes
// first when it is full), and a queue holding only usage leaves at most
// every two minutes: a radio woken on every poll for a tap count is a
// battery cost at a festival. When the page hides, the stretch it held goes
// as one session_end of counts.
//
// Each case gets a fresh page and a fresh module instance (errlog-queue's rig).
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'phc_testkeyForFestivalNavigatorCI01';

// The page loads at T0, and most cases then stand past its first two minutes
// (a fresh page holds usage alone that long — its own case below).
const T0 = new Date('2026-10-03T19:00:00Z').getTime();
const LATER = T0 + 2 * 60 * 1000 + 1;
test.afterEach(() => mock.timers.reset());

let instance = 0;
async function fresh({ key = KEY, settings = null, online = true, timers = [], at = LATER } = {}) {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date', ...timers], now: T0 });
  const dom = new JSDOM(`<!doctype html><html><head><meta name="fn-report-key" content="${key}" data-hosts="kevinhg.com"><meta name="fn-build" content="v108"></head>`
    + '<body><div id="screen-app"></div><span id="sync-label">online</span></body></html>', { url: 'https://fest.kevinhg.com/' });
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
  const sent = [];
  dom.window.fetch = async (url, opts) => { sent.push(JSON.parse(opts.body)); return { ok: true, status: 200 }; };
  const m = await import(`../js/errlog.js?usage=${++instance}`);
  mock.timers.setTime(at);
  const queue = () => JSON.parse(store.get('fn_telemetry_q_v1') || '[]');
  const events = () => sent.flatMap((b) => b.batch);
  return { dom, store, sent, m, queue, events };
}
const hide = (dom) => {
  Object.defineProperty(dom.window.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange', { bubbles: true }));
};

test('an allowlisted event leaves with its allowed values and the base every report carries', async () => {
  const { m, events } = await fresh();
  m.track('pick', { from: 0, to: 2, via: 'click', surface: 'card' });
  assert.equal(await m.flushReports(), true);
  const [ev] = events();
  assert.equal(ev.event, 'pick');
  assert.equal(ev.properties.from, 0);
  assert.equal(ev.properties.to, 2);
  assert.equal(ev.properties.via, 'click');
  assert.equal(ev.properties.surface, 'card');
  assert.equal(ev.properties.$process_person_profile, false);
  assert.equal(ev.properties.screen, 'wall');
  assert.ok(ev.properties.distinct_id && ev.properties.session, 'device and page load');
  assert.ok(!('strip_route' in ev.properties) && !('sync_state' in ev.properties), 'what usage has no use for stays home');
  // Every property is one usage names: the event's own, or its named base.
  // A field added to the crash report's base does not reach usage by default.
  const named = new Set([...m.USAGE_BASE, ...Object.keys(m.USAGE.pick), 'count']);
  for (const k of Object.keys(ev.properties)) assert.ok(named.has(k), `${k} rides usage without being named`);
});

test('nothing off the list leaves: an unknown event, an unknown property, a value outside its shape', async () => {
  const { m, events } = await fresh();
  m.track('artist_clicked', { artist: 'Robyn' });               // not an event
  m.track('pick', { from: 0, to: 9, via: 'swipe', artist: 'Robyn', surface: 'https://fest.kevinhg.com/#g=abcdefghijklmnopqrstuvwxyz' });
  m.track('first_paint', { ms_to_wall: '1234', nav_ms: 1234.7, path: 'warm' });
  m.track('now_tap', { stops: -1, highlight: 'yes', landed: 'card' });
  await m.flushReports();
  const got = events();
  assert.deepEqual(got.map((e) => e.event), ['pick', 'first_paint', 'now_tap']);
  const pick = got[0].properties;
  assert.equal(pick.from, 0);
  assert.equal(pick.to, 9, 'a whole number is a number; bounded, not judged');
  assert.ok(!('via' in pick) && !('artist' in pick) && !('surface' in pick), JSON.stringify(pick));
  const paint = got[1].properties;
  assert.ok(!('ms_to_wall' in paint), 'a string is not a number');
  assert.equal(paint.nav_ms, 1250, 'durations round to 50 ms');
  const now = got[2].properties;
  assert.ok(!('stops' in now) && !('highlight' in now));
  assert.equal(now.landed, 'card');
  const counts = m.usageCounts();
  assert.ok(counts.dropped >= 7, `each refusal is counted: ${JSON.stringify(counts)}`);
});

test('no free text can ride: every own value of every event is a boolean, a bounded number, or a listed word', async () => {
  const { m, events } = await fresh();
  for (const [name, spec] of Object.entries(m.USAGE)) {
    const props = {};
    for (const k of Object.keys(spec)) props[k] = Array.isArray(spec[k]) ? spec[k][0] : spec[k] === 'b' ? true : 5;
    m.track(name, props);
  }
  await m.flushReports();
  const got = events();
  assert.equal(got.length, Object.keys(m.USAGE).length, 'one of each');
  for (const ev of got) {
    const spec = m.USAGE[ev.event];
    for (const k of Object.keys(spec)) {
      const v = ev.properties[k];
      if (Array.isArray(spec[k])) assert.ok(spec[k].includes(v), `${ev.event}.${k}=${v}`);
      else if (spec[k] === 'b') assert.equal(typeof v, 'boolean');
      else assert.ok(typeof v === 'number' && v >= 0 && v <= 600000, `${ev.event}.${k}=${v}`);
    }
    // and no list holds a word that could be a name, a link or a token
    for (const k of Object.keys(spec)) {
      if (Array.isArray(spec[k])) for (const w of spec[k]) assert.match(w, /^[a-z_]{2,20}$/, `${ev.event}.${k}: ${w}`);
    }
  }
});

test('the switch: with reports off (or no key) nothing is queued and nothing leaves', async () => {
  for (const opts of [{ settings: { crashReports: false } }, { key: '' }]) {
    const { m, sent, queue, dom } = await fresh(opts);
    m.track('pick', { from: 0, to: 1, via: 'click' });
    m.track('app_open', { path: 'warm', page_load: true });
    hide(dom);
    await m.flushReports();
    assert.deepEqual(queue(), []);
    assert.equal(sent.length, 0);
  }
});

test('Stay offline holds usage on the phone, as it holds errors', async () => {
  const { m, sent, queue } = await fresh({ settings: { stayOffline: true } });
  m.track('pick', { from: 0, to: 1, via: 'click' });
  assert.equal(await m.flushReports(), false);
  assert.equal(sent.length, 0);
  // written when the flush looked (the queue is the phone's)
  assert.equal(queue().filter((x) => x.k === 'usage').length, 0, 'the gathered taps wait in memory until a send is possible');
});

test('taps gather in memory and reach storage in one write, two seconds later', async () => {
  const { m, queue } = await fresh({ timers: ['setTimeout'] });
  for (let i = 0; i < 5; i++) m.track('zoom_open', { route: 'mouse' });
  assert.equal(queue().length, 0, 'nothing written per tap');
  mock.timers.tick(2000);
  const q = queue();
  assert.equal(q.length, 5);
  assert.ok(q.every((x) => x.k === 'usage' && x.e.event === 'zoom_open'));
});

test('one event can fill at most its share of a page load, and the overflow is counted', async () => {
  const { m, events, queue } = await fresh();
  for (let i = 0; i < 75; i++) m.track('zoom_open', { route: 'mouse' });
  await m.flushReports(); // one request carries 50; the rest wait in the queue
  const sentNow = events().filter((e) => e.event === 'zoom_open').length;
  const waiting = queue().filter((x) => x.e.event === 'zoom_open').length;
  assert.equal(sentNow + waiting, 60);
  assert.equal(m.usageCounts().dropped, 15);
});

test('a queue holding only usage leaves at most every two minutes; an error takes it along at once', async () => {
  const { m, events } = await fresh();
  m.track('pick', { from: 0, to: 1, via: 'click' });
  assert.equal(await m.flushReports(), true, 'the first send goes');
  m.track('pick', { from: 1, to: 2, via: 'click' });
  assert.equal(await m.flushReports(), false, 'usage alone waits its turn');
  m.record('boot', new TypeError('broke'));
  assert.equal(await m.flushReports(), true, 'an error goes at once');
  const names = events().map((e) => e.event);
  assert.deepEqual(names.filter((n) => n === 'pick').length, 2, 'and the waiting pick went with it');
  assert.ok(names.includes('$exception'));
});

test('a fresh page holds usage alone for its first two minutes: the first sync of an open carries no tap counts', async () => {
  const { m, sent } = await fresh({ at: T0 + 1000 });
  m.track('app_open', { path: 'warm', page_load: true });
  assert.equal(await m.flushReports(), false, 'the first sync after an open sends nothing');
  assert.equal(sent.length, 0);
  mock.timers.setTime(LATER);
  assert.equal(await m.flushReports(), true, 'two minutes in, it goes');
});

// A beacon the test can read: the bytes errlog hands the browser.
function beaconInto(dom, landed = true) {
  const got = [];
  dom.window.Blob = class { constructor(parts) { this.parts = parts; } };
  dom.window.navigator.sendBeacon = function sendBeacon(url, data) {
    if (this !== dom.window.navigator) throw new TypeError('Illegal invocation');
    got.push(...JSON.parse(data.parts.join('')).batch);
    return landed;
  };
  return got;
}
const show = (dom) => {
  Object.defineProperty(dom.window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange', { bubbles: true }));
};

test('the page hiding sends the stretch as counts (session_end); a stretch with nothing in it sends none', async () => {
  const { m, dom, events } = await fresh();
  m.hookGlobalErrors();
  const beaconed = beaconInto(dom);
  m.track('pick', { from: 0, to: 1, via: 'click' });
  m.track('pick', { from: 1, to: 2, via: 'step' });
  m.track('now_tap', { stops: 3, highlight: false, landed: 'card' });
  m.track('bogus_event');
  hide(dom);
  const ends = beaconed.filter((e) => e.event === 'session_end');
  assert.equal(ends.length, 1);
  const p = ends[0].properties;
  assert.equal(p.picks, 2);
  assert.equal(p.now_taps, 1);
  assert.equal(p.zooms, 0);
  assert.equal(p.dropped, 1, 'the refusal this stretch');
  // The Claude review of v108: usage a beacon carried is not fetched again.
  await m.flushReports();
  assert.equal(events().filter((e) => e.event === 'session_end' || e.event === 'pick').length, 0, 'nothing sent twice');
  // visible again, then hidden at once with nothing done
  show(dom);
  hide(dom);
  assert.equal(m.usageCounts().byEvent.session_end, 1, 'an empty stretch sends nothing');
});

// The Claude review of v108 (M1): errors go first in every send. A phone
// that was offline for a day holds a queue of tap counts; the crash that
// comes after them must not wait behind them for the beacon or the fetch.
test('an error goes ahead of a long queue of usage, in the beacon and in the fetch', async () => {
  for (const by of ['beacon', 'fetch']) {
    const { m, dom, events, queue } = await fresh();
    m.hookGlobalErrors();
    for (const name of ['zoom_open', 'pick']) for (let i = 0; i < 40; i++) m.track(name, name === 'pick' ? { from: 0, to: 1, via: 'click' } : { route: 'mouse' });
    hide(dom); // no beacon on this phone yet: the taps settle into the queue, ahead of what comes next
    show(dom);
    assert.ok(queue().length >= 80, 'a queue of usage');
    const beaconed = by === 'beacon' ? beaconInto(dom) : null;
    m.record('boot', new TypeError('broke after a day of taps'));
    if (by === 'beacon') hide(dom); else await m.flushReports();
    const sent = by === 'beacon' ? beaconed : events();
    assert.equal(sent[0].event, '$exception', `${by}: the error leads (${sent.length} sent)`);
  }
});

// The Claude review of v108 (L9): the hide beacon keeps usage's pace too —
// once per two minutes, however often the phone goes in and out of a pocket —
// and Low power sends usage only after a sync.
test('the hide beacon sends usage at most every two minutes, and never under Low power', async () => {
  const { m, dom } = await fresh();
  m.hookGlobalErrors();
  const beaconed = beaconInto(dom);
  m.track('pick', { from: 0, to: 1, via: 'click' });
  hide(dom);
  assert.equal(beaconed.filter((e) => e.event === 'pick').length, 1, 'the first hide carries it');
  show(dom);
  m.track('pick', { from: 1, to: 2, via: 'click' });
  hide(dom);
  assert.equal(beaconed.filter((e) => e.event === 'pick').length, 1, 'a hide a minute later waits');
  mock.timers.setTime(LATER + 2 * 60 * 1000 + 1);
  show(dom);
  dom.window.document.body.classList.add('low-power');
  hide(dom);
  assert.equal(beaconed.filter((e) => e.event === 'pick').length, 1, 'Low power: usage waits for a sync');
  dom.window.document.body.classList.remove('low-power');
  show(dom);
  hide(dom);
  assert.equal(beaconed.filter((e) => e.event === 'pick').length, 2, 'two minutes on, the waiting pick goes');
});

// The Claude review of v108 (L8): the stretch summaries are what survives a
// page left open all day, so no cap holds them, and a long stretch says how
// long it really was.
test('session_end is never capped, and its duration is whole seconds past a quarter hour', async () => {
  const { m, dom, queue } = await fresh();
  m.hookGlobalErrors();
  for (let i = 0; i < 65; i++) {
    m.track('pick', { from: 0, to: 1, via: 'click' });
    hide(dom);
    show(dom);
  }
  assert.equal(m.usageCounts().byEvent.session_end, 65, 'one per stretch, past the per-event cap of 60');
  mock.timers.setTime(LATER + 20 * 60 * 1000);
  hide(dom);
  const ends = queue().filter((x) => x.e.event === 'session_end');
  assert.equal(ends[ends.length - 1].e.properties.duration_s, 1200, 'twenty minutes, not 999 seconds');
});

// The final-gate review of v108: the summaries never use up the detail's room
// (a page alive for 400 stretches still counts a pick), and a page that loads
// hidden counts only the time it is seen.
test('400 stretches later a pick still counts; a page that loads hidden counts only its seen time', async () => {
  const a = await fresh();
  a.m.hookGlobalErrors();
  for (let i = 0; i < 401; i++) { a.m.track('now_tap', { stops: 1, highlight: false, landed: 'card' }); hide(a.dom); show(a.dom); }
  const before = a.m.usageCounts().byEvent.pick || 0;
  a.m.track('pick', { from: 0, to: 1, via: 'click' });
  assert.equal(a.m.usageCounts().byEvent.pick, before + 1, 'not dropped behind 401 summaries');

  const b = await fresh();
  Object.defineProperty(b.dom.window.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  b.m.hookGlobalErrors();
  mock.timers.setTime(LATER + 60 * 60 * 1000); // an hour in a background tab
  show(b.dom);
  mock.timers.setTime(LATER + 60 * 60 * 1000 + 10 * 1000);
  b.m.track('pick', { from: 0, to: 1, via: 'click' });
  hide(b.dom);
  const ends = b.queue().filter((x) => x.e.event === 'session_end');
  assert.equal(ends.length, 1);
  assert.equal(ends[0].e.properties.duration_s, 10, 'ten seconds seen, not an hour and ten seconds');
});

// The Claude review of v108 (L10): Diagnostics' "did Kevin already get
// this?" counts reports, not taps.
test('reports waiting counts errors only', async () => {
  const { m, dom } = await fresh();
  m.hookGlobalErrors();
  m.track('pick', { from: 0, to: 1, via: 'click' });
  hide(dom); // the taps reach the queue
  m.record('boot', new TypeError('one'));
  assert.equal(m.pendingReports(), 1);
});

// Copilot's review of v108: a stretch's counts are taken only while reports
// are on, and a stretch that saw Off sends no summary at all — not the taps
// from before Off, nor the ones made while it was off.
test('a stretch that saw reports switched off sends no session_end, even once they are back on', async () => {
  const { m, dom, store, queue } = await fresh();
  m.hookGlobalErrors();
  m.track('pick', { from: 0, to: 1, via: 'click' });
  store.set('fn_settings_v1', JSON.stringify({ crashReports: false }));
  m.clearReports();
  m.track('pick', { from: 1, to: 2, via: 'click' }); // made while Off
  store.set('fn_settings_v1', JSON.stringify({ crashReports: true }));
  m.track('now_tap', { stops: 1, highlight: false, landed: 'card' });
  hide(dom);
  assert.equal(queue().filter((x) => x.e.event === 'session_end').length, 0, 'no summary for a stretch that saw Off');
  assert.equal(queue().filter((x) => x.e.event === 'now_tap').length, 1, 'what came after On still goes');
  // the next stretch is whole again
  Object.defineProperty(dom.window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange', { bubbles: true }));
  m.track('pick', { from: 2, to: 3, via: 'click' });
  hide(dom);
  const ends = queue().filter((x) => x.e.event === 'session_end');
  assert.equal(ends.length, 1);
  assert.equal(ends[0].e.properties.picks, 1, 'only this stretch\'s pick');
});

test('a page that only fires pagehide (iOS Safari) still ends its stretch, and a page that fires both ends it once', async () => {
  for (const both of [false, true]) {
    const { m, dom, queue } = await fresh();
    m.hookGlobalErrors();
    dom.window.dispatchEvent(new dom.window.Event('load'));
    m.track('pick', { from: 0, to: 1, via: 'click' });
    if (both) hide(dom);
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    assert.equal(queue().filter((x) => x.e.event === 'session_end').length, 1, both ? 'hidden then pagehide: one' : 'pagehide alone: one');
  }
});

test('switching reports off throws away usage still gathering in memory', async () => {
  const { m, queue, store } = await fresh({ timers: ['setTimeout'] });
  m.track('pick', { from: 0, to: 1, via: 'click' });
  m.clearReports();
  store.set('fn_settings_v1', JSON.stringify({ crashReports: false }));
  mock.timers.tick(2000);
  assert.deepEqual(queue(), []);
});

// The allowlist and the code agree: every track('…') in js/ names an event
// on the list, and every event on the list is sent from somewhere
// (session_end from errlog itself). A rename on one side is a red build, not
// a silent hole in the dashboard.
function jsFiles(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...jsFiles(p));
    else if (/\.(m?js)$/.test(f)) out.push(p);
  }
  return out;
}
test('every track() call names an allowlisted event, and every allowlisted event is tracked somewhere', async () => {
  const { m } = await fresh();
  const calls = new Set();
  for (const f of jsFiles(join(ROOT, 'js'))) {
    const raw = readFileSync(f, 'utf8');
    const isErrlog = f.endsWith(join('js', 'errlog.js'));
    const imports = /import\s*\{[^}]*\btrack\b[^}]*\}\s*from\s*'[./]*errlog\.js'/.test(raw);
    // code only: comments and the definition say track( too
    const src = raw.replace(/^\s*\/\/.*$/gm, '').replace(/function track\(/g, '');
    // A call with no import is a ReferenceError at the tap it rides on —
    // track()'s own try never gets the chance to swallow it.
    if (!isErrlog && !imports) {
      assert.doesNotMatch(src, /(?<![\w.(])track\(\s*'/, `${f} calls track() without importing it`);
      continue;
    }
    // a call, not a word inside a string (Spotify's `fields=items(track(uri))`)
    for (const hit of src.matchAll(/(?<![\w.(])track\(\s*'([a-z_]+)'/g)) calls.add(hit[1]);
    assert.doesNotMatch(src, /(?<![\w.(])track\(\s*[^'\s)]/, `${f}: track() takes a literal event name`);
  }
  for (const name of calls) assert.ok(name in m.USAGE, `track('${name}') is not on the allowlist`);
  for (const name of Object.keys(m.USAGE)) assert.ok(calls.has(name), `'${name}' is on the allowlist but never tracked`);
});
