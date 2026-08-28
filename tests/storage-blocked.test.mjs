// A storage-blocked browser (Safari private mode, "block all cookies") THROWS
// on localStorage.getItem — not just setItem. Every read on the crew
// activation path must be guarded, or a device holding the whole doc in
// memory dies on boot (Codex gate, 2026-08-27: activateCrew's raw
// localStorage.getItem for the saved festival, refreshCtx's weekend read, and
// clearCachedPending's raw removeItem).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

// Every method throws — the shape Safari presents when storage is denied.
const denied = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
globalThis.localStorage = { getItem: denied, setItem: denied, removeItem: denied, clear: denied, key: denied, length: 0 };

const util = await import('../js/util.js');
const state = await import('../js/state.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');

FESTIVAL_INDEX.push({ id: 'blocked-fest', status: 'lineup' });
state.FESTIVALS['blocked-fest'] = { id: 'blocked-fest', name: 'Blocked Fest', status: 'lineup', artists: [{ name: 'A' }] };

test('util: guarded reads answer null/fallback instead of throwing', () => {
  assert.equal(util.getLS('anything'), null);
  assert.deepEqual(util.loadJSON('anything', { fallback: true }), { fallback: true });
  assert.doesNotThrow(() => util.removeLS('anything'));
  assert.equal(util.saveLS('k', 'v'), false, 'a write that did not land says so');
});

test('activateCrew on a storage-blocked device boots from the in-memory doc — no throw, festival resolved', () => {
  const doc = { v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 1 } }, festivals: {}, affinity: {} };
  assert.doesNotThrow(() => state.activateCrew('blockedtesttoken_01234567', doc, 'blocked-fest'));
  assert.equal(state.activeFestivalId, 'blocked-fest');
  assert.doesNotThrow(() => state.clearCachedPending('blockedtesttoken_01234567'));
  assert.equal(state.cachedDoc('blockedtesttoken_01234567'), null);
});

test('now.js: a sessionStorage GETTER that throws (Chrome with site data blocked) never reaches the day-of open', async () => {
  // Chrome raises SecurityError from window.sessionStorage itself, not from
  // its methods, so a `typeof sessionStorage` guard is no guard at all.
  const now = await import('../js/v3/now.js');
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() { throw new Error('SecurityError: Failed to read the sessionStorage property from Window'); },
  });
  try {
    const key = now.dayOfScrollKey('zz-fest', new Date(2026, 8, 26, 17, 0));
    assert.equal(now.scrolledBefore(key), false, 'nothing remembered, and no throw');
    assert.doesNotThrow(() => now.rememberScrolled(key));
    assert.equal(now.scrolledBefore(key), true, 'memory carries the claim when storage cannot');
    assert.equal(now.claimScrollOnce(now.dayOfScrollKey('zz-other', new Date(2026, 8, 26, 17, 0))), true);
  } finally {
    if (prev) Object.defineProperty(globalThis, 'sessionStorage', prev);
    else delete globalThis.sessionStorage;
  }
});
