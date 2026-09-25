// The crash-report queue and its sender (js/errlog.js, v88, 2026-09-24).
//
// Reports wait on the phone and leave when there is signal: after a sync
// succeeds (`fn:synced`), when the browser says `online`, and as a beacon when
// the page goes hidden. The queue is bounded, folds a repeating error into one
// report, survives a reload, and never throws into the app — not with storage
// blocked (Chrome throws from the storage GETTER itself), not with no key, not
// with a dead network. Off (the Settings toggle) and Stay offline mean nothing
// leaves. And the hide beacon goes AFTER the crew's own last-second beacon:
// both share the browser's 64 KB keepalive budget, and a pick outranks a
// crash report.
//
// Each case gets a fresh page (a new JSDOM) and a fresh copy of the module (a
// query string makes a new module instance), so no listener or counter
// carries over.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { JSDOM } from 'jsdom';

const KEY = 'phc_testkeyForFestivalNavigatorCI01';
const V8 = (msg) => [
  `TypeError: ${msg}`,
  '    at activateCrew (https://fest.kevinhg.com/js/state.js:87:41)',
  '    at enterApp (https://fest.kevinhg.com/js/v3/app.js:2366:11)',
].join('\n');
const typeError = (msg, stack = V8(msg)) => { const e = new TypeError(msg); e.stack = stack; return e; };
const settle = (ms = 5) => new Promise((r) => setTimeout(r, ms));

let instance = 0;
async function fresh({ key = KEY, settings = null, online = true, ua = null, touch = 0, url = 'https://fest.kevinhg.com/', hosts = 'kevinhg.com' } = {}) {
  const hostsAttr = hosts === null ? '' : ` data-hosts="${hosts}"`;
  const dom = new JSDOM(`<!doctype html><html><head><meta name="fn-report-key" content="${key}"${hostsAttr}></head>`
    + '<body><div id="screen-app"></div><span id="sync-label">online</span></body></html>', { url });
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
  let isOnline = online;
  Object.defineProperty(dom.window.navigator, 'onLine', { configurable: true, get: () => isOnline });
  if (ua) {
    Object.defineProperty(dom.window.navigator, 'userAgent', { configurable: true, get: () => ua });
    Object.defineProperty(dom.window.navigator, 'maxTouchPoints', { configurable: true, get: () => touch });
  }
  const sent = [];
  let respond = async () => ({ ok: true, status: 200 });
  dom.window.fetch = async (url, opts) => {
    sent.push({ url, method: opts.method, body: JSON.parse(opts.body) });
    return respond();
  };
  const m = await import(`../js/errlog.js?case=${++instance}`);
  const loaded = () => new Promise((r) => (dom.window.document.readyState === 'complete' ? r() : dom.window.addEventListener('load', () => r(), { once: true })));
  const queue = () => JSON.parse(store.get('fn_telemetry_q_v1') || '[]');
  return { dom, store, sent, m, queue, loaded, setOnline: (v) => { isOnline = v; }, respondWith: (fn) => { respond = fn; } };
}

// The browser fires visibilitychange at the document with bubbles: true
// (HTML, "update the visibility state"), so it reaches window listeners too.
const hide = (dom) => {
  Object.defineProperty(dom.window.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange', { bubbles: true }));
};

// A receiver-strict sendBeacon: called anywhere but ON navigator it throws
// "Illegal invocation", as every browser does (CLAUDE.md, WebIDL receivers).
function strictBeacon(dom, answer = () => true) {
  const calls = [];
  const nav = dom.window.navigator;
  nav.sendBeacon = function sendBeacon(url, data) {
    if (this !== nav) throw new TypeError('Illegal invocation');
    calls.push({ url, data });
    return answer();
  };
  return calls;
}

test('with no key, an error is journaled on the phone and nothing is queued or sent', async () => {
  const { m, sent, queue, dom } = await fresh({ key: '' });
  const beacons = strictBeacon(dom);
  m.record('boot', typeError('no key here'));
  assert.equal(m.recent().at(-1).kind, 'boot', 'the journal still works');
  assert.equal(m.reporting(), false);
  assert.deepEqual(queue(), []);
  assert.equal(await m.flushReports(), false);
  assert.equal(m.beaconReports(), false);
  assert.equal(sent.length, 0);
  assert.equal(beacons.length, 0);
});

test('a personal API key (phx_…, a real secret) pasted as the key is never used', async () => {
  const { m, queue } = await fresh({ key: 'phx_aPersonalKeyThatMustNeverBeUsed0000' });
  m.record('boot', typeError('wrong key'));
  assert.equal(m.reportKey(), null);
  assert.deepEqual(queue(), []);
});

test('one error becomes one $exception, scrubbed, with who and where — and leaves after a sync', async () => {
  const { m, sent, queue, dom } = await fresh();
  const crew = randomBytes(20).toString('base64url');
  const person = randomBytes(20).toString('base64url');
  const pid = randomBytes(9).toString('base64url');
  m.configureReports({
    context: () => ({ fest: 'portola-2026', pid, name: 'Ross' }),
    secrets: () => [crew, person],
  });
  m.hookGlobalErrors();
  m.record('boot', typeError(`crew https://fest.kevinhg.com/#g=${crew} with ${person}`));
  const q = queue();
  assert.equal(q.length, 1);
  const onDisk = JSON.stringify(q);
  assert.ok(!onDisk.includes(crew) && !onDisk.includes(person), 'the queue on the phone is already scrubbed');

  dom.window.dispatchEvent(new dom.window.Event('fn:synced'));
  await settle(20);
  assert.equal(sent.length, 1, 'a successful sync sends what is waiting');
  const req = sent[0];
  assert.equal(req.url, m.REPORT_PATH);
  assert.equal(req.url, '/fn-i/batch');
  assert.equal(req.method, 'POST');
  assert.equal(req.body.api_key, KEY);
  const wire = JSON.stringify(req.body);
  assert.ok(!wire.includes(crew) && !wire.includes(person) && !wire.includes('#g='), 'nothing secret on the wire');
  assert.equal(req.body.batch.length, 1);
  const ev = req.body.batch[0];
  assert.equal(ev.event, '$exception');
  assert.match(ev.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.ok(!Number.isNaN(Date.parse(ev.timestamp)));
  const p = ev.properties;
  assert.equal(p.$process_person_profile, false);
  assert.match(p.distinct_id, /^[0-9a-f-]{36}$/, 'a random device id, not the person');
  assert.equal(p.pid, pid);
  assert.equal(p.member_name, 'Ross', 'the name in the crew, under Eachie\'s key for it');
  assert.equal(p.fest, 'portola-2026');
  assert.equal(p.kind, 'boot');
  assert.equal(p.$exception_level, 'fatal');
  assert.equal(p.count, 1);
  assert.equal(p.screen, 'wall');
  assert.equal(p.sync_state, 'online');
  assert.equal(p.host, 'fest');
  const [ex] = p.$exception_list;
  assert.equal(ex.type, 'TypeError');
  assert.equal(ex.value, 'crew https://fest.kevinhg.com/ with ‹token›');
  assert.deepEqual(ex.mechanism, { handled: true, synthetic: false, type: 'generic' });
  assert.deepEqual(ex.stacktrace.frames.map((f) => f.function), ['enterApp', 'activateCrew']);
  assert.equal(p.$issue_name, undefined, 'a boot crash is named by its own message');
  for (const k of ['ua', 'url', '$current_url', '$referrer', 'href', '$user_agent', '$raw_user_agent']) assert.ok(!(k in p), `never ${k}`);
  assert.deepEqual(queue(), [], 'a 2xx takes it off the phone');
});

test('a context that hands over a token where the pid goes is refused — PID_RE is disjoint from every token', async () => {
  const { m, queue } = await fresh();
  const token = randomBytes(20).toString('base64url');
  m.configureReports({ context: () => ({ pid: token, name: 'x'.repeat(41), fest: 'Not A Fest!' }) });
  m.record('boot', typeError('shape check'));
  const p = queue()[0].e.properties;
  assert.equal(p.pid, null);
  assert.equal(p.member_name, null, 'a name longer than any the app allows is not a name');
  assert.equal(p.fest, null);
});

test('a repeating error folds into one report and counts; one page load queues it at most five times', async () => {
  const { m, sent, queue } = await fresh();
  for (let i = 0; i < 10; i++) m.record('error', typeError('loops'));
  assert.equal(queue().length, 1);
  await m.flushReports(); // the repeats are written on their way out (or within a second)
  assert.equal(sent[0].body.batch[0].properties.count, 10);
  for (let round = 0; round < 6; round++) { m.record('error', typeError('loops')); await m.flushReports(); }
  assert.equal(sent.length, 5, 'the first report and four more, then this page load stops queuing it');
  m.record('error', typeError('a different one'));
  assert.equal(queue().length, 1, 'other errors still get through');
});

test('the queue on the phone is bounded — 96 KB, which is about 80 reports — oldest out first', async () => {
  const { m, queue, store } = await fresh();
  // Reports from earlier opens (a week offline, say), each ~1.2 KB like a real one.
  const now = Date.now();
  const earlier = Array.from({ length: 400 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, k: 'error', t: new Date(now - (400 - i) * 1000).toISOString(), n: 1, s: 'earlier',
    e: { event: '$exception', properties: { i, pad: 'e'.repeat(1100) } },
  }));
  store.set('fn_telemetry_q_v1', JSON.stringify(earlier));
  m.record('error', typeError('the newest'));
  const q = queue();
  assert.ok(store.get('fn_telemetry_q_v1').length <= 96 * 1024, `${store.get('fn_telemetry_q_v1').length} bytes`);
  assert.ok(q.length < 100 && q.length > 60, `${q.length} reports fit`);
  assert.match(q.at(-1).e.properties.$exception_list[0].value, /the newest/, 'the newest is kept');
  assert.equal(q[0].e.properties.i, 400 - (q.length - 1), 'the oldest went first');
  assert.equal(m.pendingReports(), q.length);
});

test('a flood cannot bury the first error or slow the page: 25 reports a page load, repeats folded in memory', async () => {
  const { m, sent, queue, store } = await fresh();
  let queueWrites = 0;
  const ls = globalThis.localStorage;
  const set = ls.setItem;
  ls.setItem = (k, v) => { if (k === 'fn_telemetry_q_v1') queueWrites++; return set(k, v); };
  m.record('boot', typeError('the one that explains the rest'));
  // A loop whose message carries a changing number folds into ONE report …
  for (let i = 0; i < 2000; i++) m.record('error', typeError(`Cannot read properties of undefined (reading '${i}')`));
  assert.equal(queue().length, 2);
  assert.ok(queueWrites <= 3, `a loop rewrote the queue ${queueWrites} times`);
  // … and a loop whose WORDS change stops at the page load's cap.
  for (let i = 0; i < 2000; i++) m.record('error', typeError(`unexpected state ${['red', 'blue', 'grey'][i % 3]}${'x'.repeat(i % 40)}`));
  const q = queue();
  assert.equal(q.length, 25, 'the page load\'s cap');
  assert.equal(q[0].e.properties.kind, 'boot', 'the first error is never pushed out by the flood it caused');
  await m.flushReports();
  const looped = sent[0].body.batch.find((ev) => /reading/.test(ev.properties.$exception_list[0].value));
  assert.equal(looped.properties.count, 2000, 'every repeat counted');
  assert.ok(store.get('fn_telemetry_q_v1') === undefined || queue().length === 0);
  assert.equal((await m.diagnostics()).reportsHeldBack > 0, true, 'Diagnostics says how many were held back');
  ls.setItem = set;
});

test('the journal on the phone keeps the first three of an error, not twenty copies of one', async () => {
  const { m } = await fresh();
  for (let i = 0; i < 10; i++) m.record('error', typeError('same again'));
  m.record('error', typeError('something else'));
  assert.deepEqual(m.recent().map((e) => e.msg), ['same again', 'same again', 'same again', 'something else']);
});

test('the journal is scrubbed on the way out too — a v87 entry holds raw words', async () => {
  const { m, store } = await fresh();
  const t = randomBytes(20).toString('base64url');
  store.set('fn_errlog_v1', JSON.stringify([{ t: '2026-09-20T02:00:00.000Z', kind: 'error', msg: `failed at https://fest.kevinhg.com/#g=${t}`, stack: `at x (https://fest.kevinhg.com/js/a.js?t=${t}:1:2)` }]));
  const out = JSON.stringify(m.recent());
  assert.ok(!out.includes(t) && !out.includes('#g='), out);
});

test('when full, usage events go before any error, and errors only push out errors', async () => {
  const { m, queue, store } = await fresh();
  const now = new Date().toISOString();
  const usage = Array.from({ length: 280 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, k: 'usage', t: now, n: 1, fp: `u${i}`, s: 'earlier',
    e: { event: 'app_open', properties: { pad: 'u'.repeat(300) } },
  }));
  store.set('fn_telemetry_q_v1', JSON.stringify(usage));
  for (let i = 0; i < 20; i++) m.record('error', typeError(`kept ${'k'.repeat(i + 1)}`));
  const q = queue();
  assert.equal(q.filter((x) => x.k === 'error').length, 20, 'every error kept');
  assert.ok(q.filter((x) => x.k === 'usage').length < 280, 'usage made the room');
});

test('reports expire: an error after a week, so a stale one is not worth radio time', async () => {
  const { m, store } = await fresh();
  const at = (days) => new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const entry = (id, days) => ({ id, k: 'error', t: at(days), n: 1, fp: id, s: 'earlier', e: { event: '$exception', properties: {} } });
  store.set('fn_telemetry_q_v1', JSON.stringify([entry('old-8d', 8), entry('ok-6d', 6)]));
  assert.equal(m.pendingReports(), 1);
});

test('a report survives a reload, and the next page sends it with the same uuid', async () => {
  const first = await fresh();
  first.m.record('boot', typeError('before the reload'));
  const [waiting] = first.queue();
  // The reload: a new page over the same storage, and a new copy of the module.
  const second = await import(`../js/errlog.js?case=${++instance}`);
  assert.equal(second.pendingReports(), 1);
  assert.equal(await second.flushReports(), true);
  assert.equal(first.sent.at(-1).body.batch[0].uuid, waiting.id);
});

test('offline, nothing is sent; the browser\'s online sends it', async () => {
  const { m, sent, dom, setOnline, loaded } = await fresh({ online: false });
  m.hookGlobalErrors();
  await loaded();
  m.record('error', typeError('in a field'));
  assert.equal(await m.flushReports(), false);
  dom.window.dispatchEvent(new dom.window.Event('fn:synced'));
  await settle(20);
  assert.equal(sent.length, 0, 'no radio, no send');
  setOnline(true);
  dom.window.dispatchEvent(new dom.window.Event('online'));
  await settle(20);
  assert.equal(sent.length, 1);
  assert.equal(m.pendingReports(), 0);
});

test('a send that may pass later is kept and the next try waits; one refused for good is dropped', async (t) => {
  mock.timers.enable({ apis: ['Date'], now: Date.now() });
  t.after(() => mock.timers.reset());
  const { m, sent, respondWith } = await fresh();
  m.record('error', typeError('flaky'));
  respondWith(async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(await m.flushReports(), false);
  respondWith(async () => ({ ok: false, status: 503 }));
  assert.equal(await m.flushReports(), false);
  assert.equal(sent.length, 1, 'no second try inside the first minute — every sync would re-send 60 KB');
  mock.timers.tick(61 * 1000);
  assert.equal(await m.flushReports(), false);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].body.batch[0].uuid, sent[1].body.batch[0].uuid, 'the retry is the same report');
  mock.timers.tick(61 * 1000);
  assert.equal(await m.flushReports(), false);
  assert.equal(sent.length, 2, 'the wait doubles');
  mock.timers.tick(60 * 1000);
  respondWith(async () => ({ ok: false, status: 429 }));
  assert.equal(await m.flushReports(), false);
  assert.equal(m.pendingReports(), 1, 'rate-limited: kept');
  mock.timers.tick(5 * 60 * 1000);
  respondWith(async () => ({ ok: true, status: 200 }));
  assert.equal(await m.flushReports(), true);
  m.record('error', typeError('a second one'));
  assert.equal(await m.flushReports(), true, 'a success clears the wait');
});

for (const status of [400, 401, 403, 404, 413]) {
  test(`a ${status} is refused for good: dropped, not re-sent on every sync`, async () => {
    const { m, sent, respondWith } = await fresh();
    m.record('error', typeError(`refused ${status}`));
    respondWith(async () => ({ ok: false, status }));
    assert.equal(await m.flushReports(), false);
    assert.equal(m.pendingReports(), 0);
    assert.equal(sent.length, 1);
  });
}

test('a repeat that happens while its report is on the way starts a new one — it is not lost with the sent one', async () => {
  const { m, sent, dom } = await fresh();
  let answer;
  dom.window.fetch = async (url, opts) => {
    sent.push({ body: JSON.parse(opts.body) });
    return new Promise((r) => { answer = r; });
  };
  m.record('error', typeError('mid-flight'));
  const flying = m.flushReports();
  await settle(5);
  assert.equal(sent.length, 1, 'on its way');
  for (let i = 0; i < 9; i++) m.record('error', typeError('mid-flight'));
  answer({ ok: true, status: 200 });
  assert.equal(await flying, true);
  assert.equal(m.pendingReports(), 1, 'the nine that came later are waiting');
  dom.window.fetch = async (url, opts) => { sent.push({ body: JSON.parse(opts.body) }); return { ok: true, status: 200 }; };
  await m.flushReports();
  assert.equal(sent[0].body.batch[0].properties.count, 1);
  assert.equal(sent[1].body.batch[0].properties.count, 9);
});

test('storage refusing the settings write: Off and Stay offline still hold for this page', async () => {
  const off = await fresh();
  const blocked = () => { throw new off.dom.window.DOMException('blocked', 'SecurityError'); };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: blocked });
  Object.defineProperty(off.dom.window, 'localStorage', { configurable: true, get: blocked });
  off.m.noteSettings({ crashReports: false }, false); // what settings.js does when saveLS says it didn't land
  off.m.record('error', typeError('while off, storage blocked'));
  assert.equal(off.m.pendingReports(), 0);
  assert.equal(await off.m.flushReports(), false);

  const stay = await fresh();
  const beacons = strictBeacon(stay.dom);
  stay.m.record('error', typeError('queued before'));
  stay.m.noteSettings({ stayOffline: true }, false);
  assert.equal(await stay.m.flushReports(), false);
  assert.equal(stay.m.beaconReports(), false);
  assert.equal(stay.sent.length + beacons.length, 0);
  stay.m.noteSettings({ stayOffline: true }, true); // a write that landed: storage is the truth again
  assert.equal(await stay.m.flushReports(), true);
});

test('the key works only on the hosts it was issued for — a fork\'s domain sends nothing', async () => {
  const cases = [
    ['https://fest.kevinhg.com/', 'kevinhg.com', true],
    ['https://stage.fest.kevinhg.com/', 'kevinhg.com', true],
    ['https://kevinhg.com/', 'kevinhg.com', true],
    ['http://127.0.0.1:5173/', 'kevinhg.com', true],
    ['https://fest.example.org/', 'kevinhg.com', false],
    ['https://notkevinhg.com/', 'kevinhg.com', false],
    ['https://festival-navigator-git-main-someone.vercel.app/', 'kevinhg.com', false],
    ['https://fest.kevinhg.com/', null, false],
  ];
  for (const [url, hosts, allowed] of cases) {
    const { m, queue } = await fresh({ url, hosts });
    m.record('error', typeError('where am I'));
    assert.equal(m.reportKey() !== null, allowed, `${url} (${hosts})`);
    assert.equal(queue().length, allowed ? 1 : 0, url);
  }
});

test('Stay offline: nothing leaves, not over fetch and not as a beacon', async () => {
  const { m, sent, dom } = await fresh({ settings: { stayOffline: true } });
  const beacons = strictBeacon(dom);
  m.record('error', typeError('asked for offline'));
  assert.equal(m.pendingReports(), 1, 'kept for when the person switches it back off');
  assert.equal(await m.flushReports(), false);
  assert.equal(m.beaconReports(), false);
  assert.equal(sent.length + beacons.length, 0);
});

test('switched off: nothing is queued, and what was waiting is thrown away', async () => {
  const { m, sent, store } = await fresh();
  m.record('error', typeError('queued while on'));
  assert.equal(m.pendingReports(), 1);
  store.set('fn_settings_v1', JSON.stringify({ crashReports: false }));
  m.clearReports(); // what the Settings toggle does when it goes off
  m.record('error', typeError('while off'));
  assert.equal(m.pendingReports(), 0);
  assert.equal(await m.flushReports(), false);
  assert.equal(sent.length, 0);
  assert.equal(m.recent().at(-1).msg, 'while off', 'the journal on the phone still keeps it');
});

test('storage whose GETTER throws: no throw into the app, the report lives in memory and still goes', async () => {
  const { m, sent, dom } = await fresh();
  const blocked = () => { throw new dom.window.DOMException('Failed to read the \'localStorage\' property from \'Window\'', 'SecurityError'); };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: blocked });
  Object.defineProperty(dom.window, 'localStorage', { configurable: true, get: blocked });
  assert.doesNotThrow(() => m.record('boot', typeError('storage refused')));
  assert.equal(m.recent().at(-1).msg, 'storage refused', 'the journal keeps this session\'s entry');
  assert.equal(m.pendingReports(), 1);
  assert.equal(await m.flushReports(), true);
  assert.equal(sent.length, 1);
  assert.equal(m.pendingReports(), 0);
});

test('a store that reads fine and refuses every write (full) loses nothing that memory holds', async () => {
  const { m, sent, store } = await fresh();
  const ls = globalThis.localStorage;
  ls.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
  m.record('error', typeError('one'));
  m.record('error', typeError('two'));
  assert.equal(store.has('fn_telemetry_q_v1'), false);
  assert.equal(m.pendingReports(), 2);
  await m.flushReports();
  assert.equal(sent[0].body.batch.length, 2);
});

test('a sender that throws synchronously never throws into the app, and never rejects', async () => {
  const { m, dom } = await fresh();
  dom.window.fetch = () => { throw new TypeError('fetch exploded'); };
  m.record('error', typeError('x'));
  const r = m.flushReports();
  assert.ok(r instanceof Promise);
  assert.equal(await r, false);
  assert.equal(m.pendingReports(), 1);
});

test('the page going hidden sends a beacon ON navigator, marks what it sent, and the next send repeats it with the same uuid', async () => {
  const { m, sent, dom, loaded } = await fresh();
  const beacons = strictBeacon(dom);
  m.hookGlobalErrors();
  await loaded();
  m.record('error', typeError('before the pocket'));
  hide(dom);
  assert.equal(beacons.length, 1, 'one beacon');
  assert.equal(beacons[0].url, '/fn-i/batch');
  assert.match(beacons[0].data.type, /^text\/plain/);
  assert.ok(beacons[0].data.size <= 16 * 1024, 'small: the crew\'s own beacon shares the 64 KB budget');
  const body = JSON.parse(await beacons[0].data.text());
  const uuid = body.batch[0].uuid;
  dom.window.dispatchEvent(new dom.window.Event('pagehide'));
  assert.equal(beacons.length, 1, 'pagehide right after does not send it twice');
  assert.equal(m.pendingReports(), 1, 'a beacon\'s answer cannot be read — kept until a send that can');
  await m.flushReports();
  assert.equal(sent[0].body.batch[0].uuid, uuid, 'the same report, so PostHog counts it once');
  assert.equal(m.pendingReports(), 0);
});

test('a beacon the browser refuses marks nothing; Low power still lets a waiting report out', async () => {
  const a = await fresh();
  let accept = false;
  const calls = strictBeacon(a.dom, () => accept);
  a.m.record('error', typeError('refused beacon'));
  assert.equal(a.m.beaconReports(), false);
  accept = true;
  assert.equal(a.m.beaconReports(), true, 'tried again, since nothing was marked');
  assert.equal(calls.length, 2);

  // A boot crash never reaches a successful sync; with Low power on (likely at
  // a fest) the hide beacon and `online` are its only ways out. A report only
  // exists after an error, so this costs no radio on a healthy phone.
  const b = await fresh({ settings: { lowPower: true } });
  const lowCalls = strictBeacon(b.dom);
  b.m.record('boot', typeError('low power'));
  assert.equal(b.m.beaconReports(), true);
  assert.equal(lowCalls.length, 1);
});

test('pagehide: the crew\'s beacon goes first here too (the reporter wires its listener at load)', async () => {
  const { m, dom, loaded } = await fresh();
  const order = [];
  const nav = dom.window.navigator;
  nav.sendBeacon = function sendBeacon(url) {
    if (this !== nav) throw new TypeError('Illegal invocation');
    order.push(url);
    return true;
  };
  // In a browser the inline module runs while the page is still loading;
  // model that exactly, whatever jsdom's own timing did.
  await loaded();
  Object.defineProperty(dom.window.document, 'readyState', { configurable: true, get: () => 'interactive' });
  m.hookGlobalErrors(); // index.html
  dom.window.addEventListener('pagehide', () => nav.sendBeacon('/api/crew?t=stand-in')); // app.js init(), during load
  delete dom.window.document.readyState;
  dom.window.dispatchEvent(new dom.window.Event('load'));
  m.record('error', typeError('closing the tab'));
  dom.window.dispatchEvent(new dom.window.Event('pagehide'));
  assert.deepEqual(order, ['/api/crew?t=stand-in', '/fn-i/batch']);
});

test('the crew\'s last-second beacon goes before the report beacon', async () => {
  const { m, dom, loaded } = await fresh();
  const order = [];
  const nav = dom.window.navigator;
  nav.sendBeacon = function sendBeacon(url) {
    if (this !== nav) throw new TypeError('Illegal invocation');
    order.push(url);
    return true;
  };
  m.hookGlobalErrors(); // index.html: before app.js runs
  await loaded();
  // The crew's beacon wired AFTER the reporter's, even after load — the
  // worst order for a timing-based rule. The window sees the event last.
  dom.window.document.addEventListener('visibilitychange', () => nav.sendBeacon('/api/crew?t=stand-in'));
  m.record('error', typeError('in the pocket'));
  hide(dom);
  assert.deepEqual(order, ['/api/crew?t=stand-in', '/fn-i/batch']);
});

test('a report made before the worker answers gets this page\'s build once it does', async () => {
  const { m, dom, queue } = await fresh();
  const posted = [];
  const container = new dom.window.EventTarget();
  container.controller = { postMessage: (msg) => posted.push(msg) };
  Object.defineProperty(dom.window.navigator, 'serviceWorker', { configurable: true, value: container });
  m.record('boot', typeError('early'));
  assert.deepEqual(posted, [{ fn: 'build?' }]);
  assert.equal(queue()[0].e.properties.build, null);
  const answer = new dom.window.Event('message');
  answer.data = { fnBuild: 'festival-nav-v88', fnStamp: 'f07f92b7' };
  container.dispatchEvent(answer);
  const p = queue()[0].e.properties;
  assert.equal(p.build, 'v88');
  assert.equal(p.stamp, 'f07f92b7');
  assert.equal(p.sw, 'controlled');
  m.record('error', typeError('later'));
  assert.equal(queue()[1].e.properties.build, 'v88', 'known from then on');
});

test('the hooks: an uncaught error, a rejection, a module that failed to load; a parse error keeps its file', async () => {
  const { m, dom, queue } = await fresh();
  m.hookGlobalErrors();
  m.hookGlobalErrors(); // index.html, then app.js: one set of listeners
  const w = dom.window;
  w.dispatchEvent(new w.ErrorEvent('error', { error: typeError('uncaught'), message: 'uncaught' }));
  const rejection = new w.Event('unhandledrejection');
  rejection.reason = 'a bare string';
  w.dispatchEvent(rejection);
  const script = w.document.createElement('script');
  script.type = 'module';
  script.src = 'https://fest.kevinhg.com/js/v3/app.js';
  w.document.body.appendChild(script);
  script.dispatchEvent(new w.Event('error')); // a load failure does not bubble; the hook catches it on the way down
  const syntax = new SyntaxError('Unexpected token \'?\'');
  syntax.stack = 'SyntaxError: Unexpected token \'?\'';
  w.dispatchEvent(new w.ErrorEvent('error', { error: syntax, message: syntax.message, filename: 'https://fest.kevinhg.com/js/v3/wall.js', lineno: 12, colno: 5 }));
  w.dispatchEvent(new w.ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }));

  const q = queue().map((x) => x.e.properties);
  assert.deepEqual(q.map((p) => p.kind), ['error', 'promise', 'module-load', 'error'], 'one each, the browser notice ignored');
  assert.equal(q[0].$exception_list[0].mechanism.handled, false);
  assert.equal(q[1].$exception_list[0].type, 'Error');
  assert.equal(q[1].$exception_list[0].value, 'a bare string');
  assert.ok(q[1].$exception_fingerprint, 'no stack: grouped on its words');
  assert.equal(q[2].$exception_level, 'fatal');
  assert.match(q[2].$exception_list[0].value, /\/js\/v3\/app\.js/);
  const parse = q[3].$exception_list[0];
  assert.equal(parse.type, 'SyntaxError');
  assert.deepEqual(parse.stacktrace.frames.map((f) => [f.filename, f.lineno, f.colno]), [['/js/v3/wall.js', 12, 5]]);
  assert.equal(parse.mechanism.synthetic, true);
  assert.equal(m.recent().filter((e) => e.kind === 'error').length, 2);
});

test('the device in PostHog\'s own keys, major versions only — and never the user agent itself', async () => {
  const cases = [
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', 5,
      { $device: 'iPhone', $device_type: 'Mobile', $os: 'iOS', $os_version: '18', $browser: 'Mobile Safari', $browser_version: 18, engine: 'webkit' }],
    // A home-screen app: no Version/ in the user agent, and Safari's major is iOS's.
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', 5,
      { $device: 'iPhone', $device_type: 'Mobile', $os: 'iOS', $os_version: '26', $browser: 'Mobile Safari', $browser_version: 26, engine: 'webkit' }],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1', 5,
      { $device: 'iPhone', $device_type: 'Mobile', $os: 'iOS', $os_version: '18', $browser: 'Chrome iOS', $browser_version: 141, engine: 'webkit' }],
    // iPadOS asks for the desktop site: a Mac user agent with a touch screen.
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15', 5,
      { $device: 'iPad', $device_type: 'Tablet', $os: 'iOS', $os_version: '18', $browser: 'Mobile Safari', $browser_version: 18, engine: 'webkit' }],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', 0,
      { $device: null, $device_type: 'Desktop', $os: 'Mac OS X', $os_version: null, $browser: 'Safari', $browser_version: 26, engine: 'webkit' }],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36', 5,
      { $device: 'Android', $device_type: 'Mobile', $os: 'Android', $os_version: '15', $browser: 'Chrome', $browser_version: 141, engine: 'blink' }],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', 0,
      { $device: null, $device_type: 'Desktop', $os: 'Windows', $os_version: null, $browser: 'Microsoft Edge', $browser_version: 141, engine: 'blink' }],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 15.6; rv:143.0) Gecko/20100101 Firefox/143.0', 0,
      { $device: null, $device_type: 'Desktop', $os: 'Mac OS X', $os_version: null, $browser: 'Firefox', $browser_version: 143, engine: 'gecko' }],
  ];
  for (const [ua, touch, want] of cases) {
    const { m, queue } = await fresh({ ua, touch });
    m.record('error', typeError('which phone'));
    const p = queue()[0].e.properties;
    const got = {};
    for (const k of Object.keys(want)) got[k] = p[k];
    assert.deepEqual(got, want, ua);
    assert.ok(!JSON.stringify(p).includes('Mozilla'), 'the user agent never rides along');
  }
});

test('vague errors get a readable issue name; a boot crash keeps its own words', async () => {
  const { m, queue } = await fresh();
  m.record('zoom-close-after-click', 'dismissed (Escape)');
  m.record('sync:blocked', new Error('413: This crew is full (60 people max)'));
  m.record('warm-open:catalog', new TypeError('Load failed'));
  m.record('module-load', 'the app\'s code did not load: /js/v3/app.js');
  m.record('boot', new TypeError('Failed to fetch'));
  m.record('error', typeError('Cannot read properties of null (reading \'dataset\')'));
  assert.deepEqual(queue().map((x) => x.e.properties.$issue_name), [
    'Zoom closed right after a click', 'Server refused a sync', 'Network request failed', 'App code didn’t load', undefined, undefined,
  ]);
});
