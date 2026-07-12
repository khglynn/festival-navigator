// The only bug in this app that really matters: a pick that disappears.
//
// Everything here is a path the finish-pass audit (2026-07-12) found where an
// edit could be lost, or a person could be silently split in two, with NOTHING
// on screen ever saying so. Each test fails against the code as it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

// A localStorage we can make fail on demand — which is the whole point: a full
// or private-mode store is the ordinary case this app has to survive.
let failWrites = false;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    if (failWrites) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
    store.set(k, String(v));
  },
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

let beacons = [];
Object.defineProperty(globalThis, 'navigator', {
  value: {
    onLine: true,
    sendBeacon: (url, body) => { beacons.push({ url, body }); return true; },
  },
  configurable: true,
});

const state = await import('../js/state.js');
const sync = await import('../js/sync.js');
const util = await import('../js/util.js');
const { subtractLeaves } = await import('../js/merge.js');
const { validateMergedDoc } = await import('../api/_lib/crew-shared.mjs');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
FESTIVAL_INDEX.push({ id: 'loss-fest', status: 'scheduled' });

const freshCrew = (token) => {
  failWrites = false;
  beacons = [];
  state.activateCrew(token, {
    v: 4, meta: {}, spotify: {}, people: { K: { colorIndex: 0 } },
    festivals: { 'loss-fest': { selections: {} } }, affinity: {},
  });
  state.setActiveFestivalId('loss-fest');
  state.ensureFestivalState('loss-fest');
};

const mkRes = (status, body) => ({
  status, ok: status >= 200 && status < 300,
  headers: { get: () => 'application/json' },
  json: async () => body,
});

// ---- saveLS must report, not whisper -----------------------------------------

test('a failed localStorage write is REPORTED, not swallowed', () => {
  let told = null;
  util.onStorageWriteFail((e) => { told = e; });
  failWrites = true;
  const ok = util.saveLS('anything', 'value');
  failWrites = false;
  util.onStorageWriteFail(() => {});

  assert.equal(ok, false, 'saveLS tells its caller the write did not land');
  assert.ok(told, 'and the app hears about it — this used to be a console.warn nobody reads in a field');
});

// ---- the pending queue must not be poisonable --------------------------------

test('a refused payload is not re-sent, but a new edit is', async () => {
  freshCrew('losstoken_refuse_01234567');
  state.recordSelection('GRiZ', 'K', 2);
  sync.initSync({ onSyncBlocked: () => {} });

  let posts = 0;
  globalThis.fetch = async (_u, opts) => {
    if (opts && opts.method === 'POST') posts++;
    return mkRes(400, { error: 'bad leaf' });
  };
  await sync.pushSync();
  await sync.pushSync();
  assert.equal(posts, 1, 'the identical refused payload is never sent twice');
  assert.equal(state.hasPending(), true, 'and the edit is still held, not discarded');
});

// ---- clearPending must not eat a concurrent tab's edit ------------------------

test('clearPending drops only what the server acked — another tab’s edit survives', () => {
  const TOKEN = 'losstoken_cleartabs_0123';
  freshCrew(TOKEN);
  const key = `fn_crew_pending_v3_${TOKEN}`;

  // This tab records a pick and "pushes" it.
  state.recordSelection('GRiZ', 'K', 2);
  const pushed = JSON.parse(JSON.stringify(state.pendingChanges));

  // While that push was in flight, the OTHER tab wrote its own pick to disk.
  const onDisk = JSON.parse(localStorage.getItem(key));
  onDisk.festivals['loss-fest'].selections['Lane 8'] = { B: 4 };
  localStorage.setItem(key, JSON.stringify(onDisk));

  // The push succeeds. The old code wrote '{}' here and ate the other tab's pick.
  state.clearPending(pushed);

  const after = JSON.parse(localStorage.getItem(key));
  assert.equal(
    after.festivals?.['loss-fest']?.selections?.['Lane 8']?.B, 4,
    'the other tab’s un-pushed pick must still be on disk',
  );
  assert.equal(
    after.festivals?.['loss-fest']?.selections?.GRiZ, undefined,
    'and the pick the server acked is gone',
  );
});

test('clearPending keeps an edit made DURING the push, in memory as well as on disk', () => {
  freshCrew('losstoken_midflight_0123');
  state.recordSelection('GRiZ', 'K', 2);
  const pushed = JSON.parse(JSON.stringify(state.pendingChanges));

  // The user taps again while the request is in the air.
  state.recordSelection('Lane 8', 'K', 4);

  state.clearPending(pushed);

  assert.equal(
    state.pendingChanges.festivals?.['loss-fest']?.selections?.['Lane 8']?.K, 4,
    'the mid-flight pick is still pending in memory, so the next push carries it',
  );
  assert.equal(state.hasPending(), true);
});

test('subtractLeaves keeps a leaf whose value changed under us', () => {
  const disk = { festivals: { f: { selections: { A: { K: 1 }, B: { K: 2 } } } } };
  const pushed = { festivals: { f: { selections: { A: { K: 1 }, B: { K: 9 } } } } };
  const left = subtractLeaves(disk, pushed);
  // A was acked exactly as sent -> gone. B changed after we serialized -> keep.
  assert.equal(left.festivals?.f?.selections?.A, undefined);
  assert.equal(left.festivals?.f?.selections?.B?.K, 2);
});

test('subtractLeaves prunes emptied branches so hasPending() cannot see a husk', () => {
  const disk = { festivals: { f: { selections: { A: { K: 1 } } } } };
  const left = subtractLeaves(disk, disk);
  assert.deepEqual(left, {}, 'a fully-acked payload leaves nothing behind, not {festivals:{f:{...{}}}}');
});

test('a note edited mid-push goes back WHOLE — never as a fragment the server would reject', async () => {
  // The trap: two correct-looking fixes combining into a worse bug than either
  // solved. subtractLeaves recurses into objects; a note IS an object; and the
  // server requires author+ts on every note (validateNote). Edit a note while a
  // push is in flight and naive subtraction drops the unchanged author and ts,
  // leaving {text}. The server 400s that fragment — and the refused-payload guard
  // then wedges the device's sync completely. So: notes travel whole.
  const TOKEN = 'losstoken_noteatomic_012';
  freshCrew(TOKEN);

  const NOTE = { author: 'Kev', ts: '2026-07-12T00:00:00.000Z', text: 'meet at the rail' };
  state.recordNote('loss-fest', 'artist', 'GRiZ', 'Kev.note-0001', NOTE);
  const pushed = JSON.parse(JSON.stringify(state.pendingChanges));

  // ...the push is in the air, and they fix a typo.
  state.recordNote('loss-fest', 'artist', 'GRiZ', 'Kev.note-0001',
    { ...NOTE, text: 'meet at the rail, stage left' });

  state.clearPending(pushed);

  const left = state.pendingChanges.festivals?.['loss-fest']?.notes?.artist?.GRiZ?.['Kev.note-0001'];
  assert.ok(left, 'the edit is still pending');
  assert.equal(left.text, 'meet at the rail, stage left');
  assert.equal(left.author, 'Kev', 'author survives — without it the server rejects the note outright');
  assert.ok(left.ts, 'and so does ts');

  // Prove it against the real validator, not just against my expectations.
  const { validateIncoming } = await import('../api/_lib/crew-shared.mjs');
  const check = validateIncoming(state.pendingChanges);
  assert.equal(check.ok, true, `the next push must be a payload the server accepts (got: ${check.error})`);
});

// ---- the flush that beats the lock screen ------------------------------------

test('hiding the page beacons pending picks out — the 1.2s debounce is not a grave', () => {
  freshCrew('losstoken_beacon_0123456');
  state.recordSelection('GRiZ', 'K', 4);

  const sent = sync.flushOnHide();

  assert.equal(sent, true);
  assert.equal(beacons.length, 1, 'a pick made just before the phone locks still leaves the device');
  assert.match(beacons[0].url, /\/api\/crew\?t=losstoken_beacon_0123456/);
  assert.equal(state.hasPending(), true, 'pending is KEPT — we cannot read a beacon’s reply, so we re-send next boot (the merge is idempotent)');
});

test('nothing pending means nothing beaconed', () => {
  freshCrew('losstoken_nobeacon_01234');
  assert.equal(sync.flushOnHide(), false);
  assert.equal(beacons.length, 0);
});

// ---- one person cannot become two --------------------------------------------

test('two active members whose names differ only by case are refused', () => {
  const doc = {
    people: { Drew: { colorIndex: 1 }, drew: { colorIndex: 2 } },
    festivals: {},
  };
  const r = validateMergedDoc(doc);
  assert.equal(r.ok, false, '"Drew" and "drew" are one person to every human who looks at the crew');
  assert.match(r.error, /capitalization/);
});

test('a REMOVED member does not block re-using their name in another case', () => {
  // Tombstones are forever; they must not haunt the namespace.
  const doc = {
    people: { Drew: { removed: true }, drew: { colorIndex: 2 } },
    festivals: {},
  };
  assert.equal(validateMergedDoc(doc).ok, true);
});

test('ordinary distinct names still pass', () => {
  const doc = {
    people: { Kev: { colorIndex: 0 }, Drew: { colorIndex: 1 }, Sam: { colorIndex: 2 } },
    festivals: {},
  };
  assert.equal(validateMergedDoc(doc).ok, true);
});
