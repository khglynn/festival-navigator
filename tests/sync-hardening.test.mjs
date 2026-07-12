// Sync-layer hardening (sweep P1s, 2026-07-12): a limit rejection must stop
// the retry loop and tell the human; a slow poll must never roll back a push
// that completed while its GET was in flight; two tabs must not clobber each
// other's un-pushed edits on disk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="sync-label"></div></body></html>');
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
// Node 22+ ships a getter-only global navigator — replace it wholesale.
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

const state = await import('../js/state.js');
const sync = await import('../js/sync.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
FESTIVAL_INDEX.push({ id: 'hard-fest', status: 'scheduled' });

const mkRes = (status, body, type = 'application/json') => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: () => type },
  json: async () => body,
});

const freshCrew = (token) => {
  state.activateCrew(token, {
    v: 4, meta: {}, spotify: {}, people: { K: { colorIndex: 0 } },
    festivals: { 'hard-fest': { selections: {} } }, affinity: {},
  });
  state.setActiveFestivalId('hard-fest');
  state.ensureFestivalState('hard-fest');
};

test('413 rejection: retry loop stops, human hears the reason, pending survives', async () => {
  freshCrew('hardtoken_413_0123456789');
  state.recordSelection('GRiZ', 'K', 2);
  let blockedReason = null;
  sync.initSync({ onSyncBlocked: (r) => { blockedReason = r; } });
  globalThis.fetch = async () => mkRes(413, { error: 'Crew document would exceed limits (…)' });
  await sync.pushSync();
  assert.match(blockedReason, /exceed limits/, 'the server’s own reason reaches the callback');
  assert.equal(state.hasPending(), true, 'nothing local is thrown away');
  assert.equal(sync.syncState(), 'error');
});

test('a push completing mid-poll wins: the stale poll doc is discarded', async () => {
  freshCrew('hardtoken_race_012345678');
  state.recordSelection('GRiZ', 'K', 2);
  sync.initSync({});
  const staleDoc = {
    v: 4, meta: {}, spotify: {}, people: { K: { colorIndex: 0 } },
    festivals: { 'hard-fest': { selections: {} } }, affinity: {},
  };
  const mergedDoc = {
    v: 4, meta: {}, spotify: {}, people: { K: { colorIndex: 0 } },
    festivals: { 'hard-fest': { selections: { GRiZ: { K: 2 } } } }, affinity: {},
  };
  let resolvePoll;
  globalThis.fetch = (url, opts) => {
    if (opts && opts.method === 'POST') return Promise.resolve(mkRes(200, mergedDoc));
    return new Promise((resolve) => { resolvePoll = () => resolve(mkRes(200, staleDoc)); });
  };
  const pollPromise = sync.pollSync();      // GET leaves, carrying the pre-push doc
  await new Promise((r) => setTimeout(r, 10)); // let the poll actually reach its await
  await sync.pushSync();                    // push lands the pick and clears pending
  resolvePoll();                            // the stale snapshot arrives late
  await pollPromise;
  assert.equal(
    state.crewDoc.festivals['hard-fest'].selections?.GRiZ?.K, 2,
    'the freshly-synced pick must not be rolled back by the stale poll',
  );
});

test('two tabs: persistPending merges with disk; clearPending writes true empty', () => {
  const TOKEN = 'hardtoken_tabs_012345678';
  freshCrew(TOKEN);
  const key = `fn_crew_pending_v3_${TOKEN}`;
  // "The other tab" persisted its own un-pushed edit.
  localStorage.setItem(key, JSON.stringify({
    festivals: { 'hard-fest': { selections: { OtherArtist: { B: 3 } } } },
  }));
  // This tab records its own edit — the disk copy must now hold BOTH.
  state.recordSelection('MineArtist', 'K', 1);
  const disk = JSON.parse(localStorage.getItem(key));
  assert.equal(disk.festivals['hard-fest'].selections.OtherArtist.B, 3, 'other tab’s edit survives');
  assert.equal(disk.festivals['hard-fest'].selections.MineArtist.K, 1, 'this tab’s edit lands');
  // clearPending can't go through the merge (merge can't express "empty").
  state.clearPending();
  assert.equal(localStorage.getItem(key), '{}');
});
