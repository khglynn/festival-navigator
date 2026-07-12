// FLOW-2 regression: the history layer router. Browser back must close the
// top layer (never eject to a blank page), forward must re-open it, and the
// stack math must reconcile any jump (multi-entry back, restore-on-refresh).
import test from 'node:test';
import assert from 'node:assert/strict';
import { diffStacks, createRouter } from '../js/v3/router.js';

test('diffStacks: shared prefix stays, top closes first, opens bottom-up', () => {
  assert.deepEqual(diffStacks([], []), { toClose: [], toOpen: [] });
  assert.deepEqual(diffStacks(['a'], []), { toClose: ['a'], toOpen: [] });
  assert.deepEqual(diffStacks([], ['a', 'b']), { toClose: [], toOpen: ['a', 'b'] });
  assert.deepEqual(diffStacks(['a', 'b', 'c'], ['a']), { toClose: ['c', 'b'], toOpen: [] });
  assert.deepEqual(diffStacks(['a', 'x'], ['a', 'y', 'z']), { toClose: ['x'], toOpen: ['y', 'z'] });
});

// A minimal session-history simulation: entries + cursor, dispatching
// popstate back into the router exactly like a browser would.
function harness() {
  const log = [];
  const entries = [{ state: null }];
  let idx = 0;
  let routerRef = null;
  const hist = {
    pushState: (s) => { entries.splice(idx + 1); entries.push({ state: s }); idx++; },
    replaceState: (s) => { entries[idx].state = s; },
    back: () => { if (idx > 0) { idx--; routerRef.onPopState(entries[idx].state); } },
    forward: () => { if (idx < entries.length - 1) { idx++; routerRef.onPopState(entries[idx].state); } },
  };
  const router = createRouter(hist);
  routerRef = router;
  router.registerKind('settings', () => log.push('open settings'), () => log.push('close settings'));
  router.registerKind('sub:', (k) => log.push(`open ${k}`), (k) => log.push(`close ${k}`));
  router.registerKind('sheet:', (k) => log.push(`open ${k}`), (k) => log.push(`close ${k}`));
  return { router, hist, log, entries: () => entries.length, idx: () => idx };
}

test('back closes the top layer; forward re-opens it', () => {
  const h = harness();
  h.router.push('settings');
  h.router.push('sub:bulk');
  assert.deepEqual(h.router.current(), ['settings', 'sub:bulk']);

  h.hist.back();
  assert.deepEqual(h.router.current(), ['settings']);
  h.hist.back();
  assert.deepEqual(h.router.current(), []);
  assert.deepEqual(h.log, ['close sub:bulk', 'close settings']);

  h.hist.forward();
  h.hist.forward();
  assert.deepEqual(h.router.current(), ['settings', 'sub:bulk']);
  assert.deepEqual(h.log.slice(-2), ['open settings', 'open sub:bulk']);
});

test('a multi-entry jump reconciles in one pop', () => {
  const h = harness();
  h.router.push('settings');
  h.router.push('sub:spotify');
  // Simulate the browser jumping straight to the base entry (long-press back).
  h.router.onPopState(null);
  assert.deepEqual(h.router.current(), []);
  assert.deepEqual(h.log, ['close sub:spotify', 'close settings']);
});

test('sheets swap instead of stacking — one back exits the sheet', () => {
  const h = harness();
  h.router.push('sheet:notes:GRiZ');
  h.router.push('sheet:notes:Zeds Dead');
  assert.deepEqual(h.router.current(), ['sheet:notes:Zeds Dead']);
  assert.equal(h.entries(), 2); // base + one sheet entry, not three
  h.hist.back();
  assert.deepEqual(h.router.current(), []);
});

test('requestClose drives history; nothing to close returns false', () => {
  const h = harness();
  assert.equal(h.router.requestClose(), false);
  h.router.push('settings');
  assert.equal(h.router.requestClose(), true);
  assert.deepEqual(h.router.current(), []);
  assert.deepEqual(h.log, ['close settings']);
});

test('restore re-opens layers captured before a refresh', () => {
  const h = harness();
  h.router.restore(['settings', 'sub:how']);
  assert.deepEqual(h.router.current(), ['settings', 'sub:how']);
  assert.deepEqual(h.log, ['open settings', 'open sub:how']);
});

test('refresh-restore: the current entry keeps its layers — one back closes ONE layer', () => {
  // Replays enterApp's real post-refresh sequence (Codex trailing review P1:
  // replaceState(null) before restore() made one Back collapse the whole
  // stack and killed Forward). Session history before the refresh: base,
  // settings, drill — the reload lands on the drill entry.
  const h = harness();
  h.router.push('settings');
  h.router.push('sub:spotify');
  // --- reload: fresh page = empty router stack over the SAME session history ---
  h.router.reset();
  const savedLayers = ['settings', 'sub:spotify']; // history.state at load
  h.hist.replaceState(savedLayers ? { layers: savedLayers } : null, '');
  h.router.restore(savedLayers);
  assert.deepEqual(h.router.current(), ['settings', 'sub:spotify']);

  h.hist.back(); // must close ONLY the drill
  assert.deepEqual(h.router.current(), ['settings'], 'one back closes one layer');
  h.hist.forward(); // and forward must bring it back
  assert.deepEqual(h.router.current(), ['settings', 'sub:spotify'], 'forward re-opens after refresh');
});

test('push during reconcile is ignored (openers may call UI paths that push)', () => {
  const log = [];
  const hist = { pushState: () => log.push('PUSH'), replaceState: () => {}, back: () => {} };
  const router = createRouter(hist);
  router.registerKind('settings', () => router.push('settings'), () => {});
  router.restore(['settings']);
  assert.deepEqual(log, []); // the opener's push must not mint a new entry
  assert.deepEqual(router.current(), ['settings']);
});
