// The sync dot tells the truth (CLAUDE.md: online / syncing / offline / error
// / blocked). Two inherited gaps (Codex round 4, 2026-09-23):
//   (a) a push the server refuses (400/413) AFTER "Stay offline" was switched
//       on showed blocked. The refusal is still remembered — the same bytes
//       are never re-sent — but while the person asked for offline, offline
//       is what the dot says; switching it off shows blocked again.
//   (b) a wall with unsynced picks showed online while its first poll hung.
//       Pending work is syncing, from the moment the poll leaves — unless it
//       is already refused, which stays blocked (no blocked → syncing flicker).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><span class="sync-dot"></span><div id="sync-label"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

const state = await import('../js/state.js');
const sync = await import('../js/sync.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
FESTIVAL_INDEX.push({ id: 'honest-fest', status: 'scheduled' });

const mkRes = (status, body) => ({
  status, ok: status >= 200 && status < 300,
  headers: { get: () => 'application/json' },
  json: async () => body,
});
const doc = () => ({
  v: 4, meta: {}, spotify: {}, people: { K: { colorIndex: 0 } },
  festivals: { 'honest-fest': { selections: {} } }, affinity: {},
});
const freshCrew = (token) => {
  store.clear();
  state.activateCrew(token, doc());
  state.setActiveFestivalId('honest-fest');
  state.ensureFestivalState('honest-fest');
};
let answer = null;
const held = () => new Promise((resolve) => { answer = resolve; });
const tick = () => new Promise((r) => setTimeout(r, 5));

test('(a) a refusal that lands after Stay offline was switched on: offline on the dot, the refusal kept', async () => {
  freshCrew('honesttoken_a_0123456789');
  state.recordSelection('GRiZ', 'K', 2);
  sync.initSync({ onSyncBlocked: () => {} });
  let posts = 0;
  globalThis.fetch = (_url, opts) => { if (opts && opts.method === 'POST') posts++; return held(); };
  const push = sync.pushSync();
  await tick();
  sync.setStayOffline(true);
  answer(mkRes(413, { error: 'Crew document would exceed limits' }));
  await push;
  assert.equal(sync.syncState(), 'offline', 'the person asked for offline');
  sync.setStayOffline(false);
  globalThis.fetch = async (_url, opts) => { if (opts && opts.method === 'POST') posts++; return mkRes(413, {}); };
  await sync.pushSync();
  assert.equal(sync.syncState(), 'blocked', 'back online: the remembered refusal shows');
  assert.equal(posts, 1, 'and the same bytes were never sent again');
});

test('(b) unsynced picks while the first poll hangs: syncing, not online', async () => {
  freshCrew('honesttoken_b_0123456789');
  sync.setStayOffline(false);
  sync.setSyncStatus('online'); // a fresh page's dot
  state.recordSelection('GRiZ', 'K', 1);
  globalThis.fetch = () => held();
  const poll = sync.pollSync();
  await tick();
  assert.equal(sync.syncState(), 'syncing', 'there is work not yet on the server');
  answer(mkRes(200, doc()));
  await poll;
});

test('(b) pending work the server already refused stays blocked while a poll is out — no flicker', async () => {
  freshCrew('honesttoken_d_0123456789');
  sync.setStayOffline(false);
  state.recordSelection('GRiZ', 'K', 3);
  globalThis.fetch = async () => mkRes(400, { error: 'bad pick' });
  await sync.pushSync();
  assert.equal(sync.syncState(), 'blocked');
  globalThis.fetch = () => held();
  const poll = sync.pollSync();
  await tick();
  assert.equal(sync.syncState(), 'blocked', 'refused bytes are not "syncing"');
  answer(mkRes(200, doc()));
  await poll;
});

test('(b) no pending work: the poll leaves the dot alone', async () => {
  freshCrew('honesttoken_c_0123456789');
  sync.setSyncStatus('online');
  globalThis.fetch = () => held();
  const poll = sync.pollSync();
  await tick();
  assert.equal(sync.syncState(), 'online');
  answer(mkRes(200, doc()));
  await poll;
});
