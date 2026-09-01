// The sync echo must not read as a remote change (2026-08-31). Postgres
// returns jsonb keys in its own order (length, then alphabet); a local pick
// appends its key wherever it lands. applyRemoteDoc's "did anything visible
// change" compare must be order-insensitive, or every own-edit echo repaints
// the whole wall 2–6 s after the pick — measured live: 110 cards rebuilt, the
// zoom torn down and restored, focus dumped, hover intents killed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
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

const state = await import('../js/state.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');

const FID = 'order-fest';
FESTIVAL_INDEX.push({ id: FID, status: 'lineup' });
FESTIVALS[FID] = { id: FID, name: 'Order', artists: [{ name: 'Nu' }, { name: 'Tove Lo' }, { name: 'Airwolf Paradise' }] };
const TOKEN = 'ordertesttoken_0123456789';

const doc = (selections, people = { Ava: { colorIndex: 0 }, Ben: { colorIndex: 1 } }) => ({
  v: 4, meta: { name: 'zz-order' }, spotify: {}, people,
  festivals: { [FID]: { selections, notes: {} } }, affinity: {},
});

test('the same picks in a different key order are NOT a visible change', () => {
  // Local order: insertion (the pick on Airwolf landed last).
  state.activateCrew(TOKEN, doc({ 'Tove Lo': { Ava: 2 }, Nu: { Ben: 1 }, 'Airwolf Paradise': { Ava: 1 } }), FID);
  // The echo: jsonb order — shortest key first, then alphabetical.
  const echo = doc({ Nu: { Ben: 1 }, 'Tove Lo': { Ava: 2 }, 'Airwolf Paradise': { Ava: 1 } }, { Ben: { colorIndex: 1 }, Ava: { colorIndex: 0 } });
  assert.equal(state.applyRemoteDoc(echo), false, 'reordered keys, same picks — no repaint');
});

test('a real change still reads as a change', () => {
  const remote = doc({ Nu: { Ben: 1 }, 'Tove Lo': { Ava: 2 }, 'Airwolf Paradise': { Ava: 1, Ben: 4 } });
  assert.equal(state.applyRemoteDoc(remote), true, 'Ben marked Airwolf a must — repaint');
  assert.equal(state.applyRemoteDoc(remote), false, 'and applying it again is quiet');
});
