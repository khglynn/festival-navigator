// CORE-6 regression: applyRemoteDoc must report a visible change when the
// remote diff is notes-only (or meta-only) — the old visible-slice hash
// skipped both, so live crew notes never repainted.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const state = await import('../js/state.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
const { isApiNotFound } = await import('../js/crew.js');

test('crew-gone requires OUR API\'s JSON 404 — platform 404s are transient', () => {
  const res = (status, type) => ({ status, headers: { get: () => type } });
  assert.equal(isApiNotFound(res(404, 'application/json; charset=utf-8')), true);
  assert.equal(isApiNotFound(res(404, 'text/html')), false, 'routing 404 must not forget crews');
  assert.equal(isApiNotFound(res(404, null)), false);
  assert.equal(isApiNotFound(res(200, 'application/json')), false);
});

FESTIVAL_INDEX.push({ id: 'sync-fest', status: 'scheduled' });
const TOKEN = 'synctesttoken_0123456789';

const base = () => ({
  v: 4,
  meta: { name: 'Crew' },
  spotify: {},
  people: { Kevin: { colorIndex: 0 } },
  festivals: { 'sync-fest': { selections: {} } },
  affinity: {},
});

test('a note-only remote change repaints; an identical doc does not', () => {
  store.clear();
  state.activateCrew(TOKEN, base(), 'sync-fest');

  const withNote = base();
  withNote.festivals['sync-fest'].notes = {
    fest: { 'Kevin.1752266000000.abc123': { author: 'Kevin', ts: '2026-07-11T20:00:00.000Z', text: 'car camping list started' } },
  };
  assert.equal(state.applyRemoteDoc(withNote), true, 'note-only diff must repaint');
  assert.equal(state.applyRemoteDoc(withNote), false, 'no diff, no repaint');
});

test('a crew rename repaints', () => {
  store.clear();
  state.activateCrew(TOKEN, base(), 'sync-fest');
  const renamed = base();
  renamed.meta.name = 'The Crew, Renamed';
  assert.equal(state.applyRemoteDoc(renamed), true);
});
