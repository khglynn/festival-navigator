// The view — Board or List (Phase 1, 2026-09-26) — is a viewer's setting
// with the fold's law: per phone, per festival, memory the truth for the
// life of the page and localStorage its copy, Board the default that stores
// nothing, never the crew doc. And it rides a share link as `&view=list`,
// last, so every parser before it reads the link as it always did.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
const working = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
Object.defineProperty(globalThis, 'localStorage', { value: working, configurable: true, writable: true });
globalThis.location = { hash: '', origin: 'https://fest.kevinhg.com' };

const { loadView, saveView, viewIsSet, LIST, BOARD } = await import('../js/v3/filters.js');
const crew = await import('../js/crew.js');

test('Board is the default and stores nothing; List is stored per festival', () => {
  assert.equal(loadView('portola-2026'), BOARD);
  assert.equal(viewIsSet('portola-2026'), false);
  saveView('portola-2026', LIST);
  assert.equal(store.get('fn_view_v1_portola-2026'), 'list');
  assert.equal(loadView('portola-2026'), LIST);
  assert.equal(loadView('acl-2026'), BOARD, 'a view is a view OF one festival');
  assert.equal(viewIsSet('portola-2026'), true);
  saveView('portola-2026', BOARD);
  assert.equal(store.has('fn_view_v1_portola-2026'), false, 'choosing the default removes the key');
  assert.equal(loadView('portola-2026'), BOARD);
  saveView('portola-2026', 'sideways');
  assert.equal(loadView('portola-2026'), BOARD, 'anything that is not List is Board');
});

test('a reload reads the stored List back', () => {
  store.set('fn_view_v1_acl-2026', 'list');
  assert.equal(loadView('acl-2026'), LIST);
  store.set('fn_view_v1_acl-2026', 'garbage');
  assert.equal(loadView('acl-2026'), BOARD, 'a mangled value is the default, never a throw');
  store.delete('fn_view_v1_acl-2026');
});

test('a storage-blocked browser keeps the view in memory — even the storage GETTER throwing', () => {
  const denied = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
  Object.defineProperty(globalThis, 'localStorage', { get: denied, configurable: true });
  try {
    assert.doesNotThrow(() => saveView('seismic-9', LIST));
    assert.equal(loadView('seismic-9'), LIST, 'the tap took: memory holds it');
    assert.equal(viewIsSet('seismic-9'), true, 'and it counts as this phone\'s choice');
    assert.doesNotThrow(() => saveView('seismic-9', BOARD));
    assert.equal(loadView('seismic-9'), BOARD);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: working, configurable: true, writable: true });
  }
});

test('a refused write never lets a stale stored value win back', () => {
  store.set('fn_view_v1_edc-orlando-2026', 'list');
  const refusing = { ...working, removeItem: () => { throw new DOMException('quota', 'QuotaExceededError'); } };
  Object.defineProperty(globalThis, 'localStorage', { value: refusing, configurable: true, writable: true });
  try {
    saveView('edc-orlando-2026', BOARD);
    assert.equal(loadView('edc-orlando-2026'), BOARD, 'memory wins while storage still holds the old List');
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: working, configurable: true, writable: true });
  }
  saveView('edc-orlando-2026', BOARD); // the next write lands and storage is the copy again
  assert.equal(store.has('fn_view_v1_edc-orlando-2026'), false);
});

test('crewLink puts &view=list last — only for List, only beside a festival', () => {
  const T = 'viewpersist_aaaa_0123456';
  assert.equal(crew.crewLink(T, 'portola-2026', null, null, 'list'), `https://fest.kevinhg.com/f/portola-2026#g=${T}&f=portola-2026&view=list`);
  assert.match(crew.crewLink(T, 'portola-2026', 'Drew', ['folsom'], 'list'), /&me=Drew&show=folsom&view=list$/, 'after the rooms');
  assert.doesNotMatch(crew.crewLink(T, 'portola-2026', null, null, 'board'), /view=/, 'Board is the default and says nothing');
  assert.doesNotMatch(crew.crewLink(T, 'portola-2026', null, null), /view=/, 'an old caller is unchanged');
  assert.doesNotMatch(crew.crewLink(T, null, null, null, 'list'), /view=/, 'no festival, no view');
});

test('viewFromHash reads list or board and nothing else, whatever surrounds it', () => {
  const at = (hash) => { globalThis.location.hash = hash; return crew.viewFromHash(); };
  assert.equal(at('#g=abc&f=portola-2026&show=fest&view=list'), 'list');
  assert.equal(at('#g=abc&view=board&f=x'), 'board');
  assert.equal(at('#g=abc&view=lists'), null, 'not a word it knows');
  assert.equal(at('#g=abc&view=LIST'), null);
  assert.equal(at('#g=abc'), null);
  assert.equal(at('#g=abc&preview=list'), null, 'another key that ends in view is not the view');
  globalThis.location.hash = `#g=${'viewpersist_aaaa_0123456'}&f=portola-2026&show=folsom&view=list`;
  assert.deepEqual(crew.showFromHash(), ['folsom'], 'the rooms before it read as they always did');
  assert.equal(crew.festFromHash(), 'portola-2026');
  globalThis.location.hash = '';
});
