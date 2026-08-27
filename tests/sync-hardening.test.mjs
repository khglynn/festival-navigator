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

test('413 rejection: the SAME payload is never re-sent, and a new edit un-sticks it', async () => {
  freshCrew('hardtoken_413_0123456789');
  state.recordSelection('GRiZ', 'K', 2);
  let blockedReason = null;
  sync.initSync({ onSyncBlocked: (r) => { blockedReason = r; } });

  let posts = 0;
  globalThis.fetch = async (_url, opts) => {
    if (opts && opts.method === 'POST') posts++;
    return mkRes(413, { error: 'Crew document would exceed limits (…)' });
  };

  await sync.pushSync();
  assert.match(blockedReason, /exceed limits/, 'the server’s own reason reaches the human');
  assert.equal(state.hasPending(), true, 'nothing local is thrown away');
  assert.equal(sync.syncState(), 'blocked', 'blocked is its own state — the server answered, and said no');
  assert.equal(posts, 1);

  // The old code re-POSTed this doomed payload every 25s forever, blocking
  // every other edit on the device behind it. Pushing again must be a no-op.
  await sync.pushSync();
  await sync.pushSync();
  assert.equal(posts, 1, 'a payload the server already refused is never sent again');

  // ...but the moment anything changes, we try again on our own. No dead end.
  state.recordSelection('Lane 8', 'K', 4);
  await sync.pushSync();
  assert.equal(posts, 2, 'a NEW edit produces a new payload, which earns a fresh attempt');
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

// Gate 2026-08-23: while blocked with unchanged refused bytes, the 25s poll
// used to flip the dot to 'syncing' and re-arm a doomed push — the UI
// claiming progress nothing was making, every 25 seconds, forever.
//
// The contract has ONE bounded retry in it: the first poll after a refusal
// sees changed=true (an un-pushed local edit re-serializes through deepMerge,
// so visible() differs once) and clears the refusal — that is the documented
// "one attempt per real change" door. From then on, unchanged polls must
// report blocked and never re-POST.
test('a poll that changes nothing keeps a blocked device honestly blocked', async () => {
  freshCrew('hardtoken_blockpoll_0123');
  const baseDoc = JSON.parse(JSON.stringify(state.crewDoc));
  state.recordSelection('GRiZ', 'K', 2);
  sync.initSync({ onSyncBlocked: () => {} });

  let posts = 0;
  globalThis.fetch = async (_url, opts) => {
    if (opts && opts.method === 'POST') { posts++; return mkRes(413, { error: 'full' }); }
    return mkRes(200, baseDoc); // remote unchanged — nobody freed up room
  };
  await sync.pushSync();
  assert.equal(sync.syncState(), 'blocked');
  assert.equal(posts, 1);

  await sync.pollSync();  // the bounded retry door: serialization-diff reads as changed
  await sync.pushSync();  // ...and its one retry re-earns the refusal
  assert.equal(posts, 2);
  assert.equal(sync.syncState(), 'blocked');

  // Now the steady state the dot lives in at a festival: nothing changed.
  await sync.pollSync();
  assert.equal(sync.syncState(), 'blocked', 'an unchanged remote must not repaint blocked as syncing');
  await sync.pollSync();
  assert.equal(sync.syncState(), 'blocked');
  assert.equal(posts, 2, 'and must never re-arm the doomed push');
});

// Gate 2026-08-23: AbortSignal.timeout shipped in Safari 16 — on 15.x the old
// helper returned undefined and a hung fetch had NO timeout at all (PS-4
// reopened on exactly the phones most likely to hang). The fallback builds
// the same signal from AbortController + a timer.
test('timeoutSignal falls back to AbortController when AbortSignal.timeout is absent', async () => {
  const { timeoutSignal } = await import('../js/util.js');
  const real = AbortSignal.timeout;
  try {
    delete AbortSignal.timeout;
    const sig = timeoutSignal(20);
    assert.ok(sig, 'a signal is still produced without the modern API');
    assert.equal(sig.aborted, false);
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(sig.aborted, true, 'and it aborts after the deadline');
  } finally {
    AbortSignal.timeout = real;
  }
});
