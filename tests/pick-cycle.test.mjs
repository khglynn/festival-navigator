// Survey P0 regression baseline (2026-08-30 ledger, "Tests, docs & hygiene"):
// the pick cycle was previously tested only as a pure function
// (tests/v3-model.test.mjs calls model.nextTapLevel() directly) and the DOM
// test that does mount a card (tests/wall-dom.test.mjs) stubs onTap and never
// dispatches a click. That gap is exactly how a P0 shipped past 275 tests —
// once a card had grown, clicking its body no longer picked, because a guard
// meant to protect the notes chip protected the whole grown block instead.
// This test drives a REAL card with a REAL dispatched click through a real
// onTap, on the RESTING (unzoomed) card. The zoomed-card click-picks path is
// covered separately in tests/zoom-overlay.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="wall-root"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderCard, refreshCard } = await import('../js/v3/wall.js');

const FID = 'pickcycle-fest';
FESTIVAL_INDEX.push({ id: FID, status: 'lineup' });
FESTIVALS[FID] = { id: FID, name: 'Pick Cycle', artists: [{ name: 'GRiZ', day: 'Saturday' }] };
const TOKEN = 'pickcycletoken_0123456789';
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 } },
  festivals: { [FID]: { selections: {} } },
  affinity: {},
}, FID);

const ctx = {
  fid: FID, meName: 'Kevin', affinity: null, lowPower: true,
  picks: model.picksFor(state.crewDoc, FID),
  opened: [],
  onOpenNotes: (a) => { ctx.opened.push(a); },
};
// The real handleTap (js/v3/app.js:136-158) + applyLocalPick (:161-166),
// minus the migration guard / undo-toast / sync.scheduleSync (not what this
// test is checking): advance MY level, write it into the pending change AND
// the local doc — the same two-write shape app.js uses — then refresh every
// matching card in the DOM. Deliberately re-queries the wall for the CURRENT
// node each tap: the P0 this guards against is that a click never reaches
// this function at all, not what it does once it runs.
ctx.onTap = (artistName) => {
  const current = (ctx.picks[artistName] || {})[ctx.meName] || 0;
  const next = model.nextTapLevel(current);
  state.recordSelection(artistName, ctx.meName, next);
  state.ensureFestivalState(ctx.fid);
  const sels = state.crewDoc.festivals[ctx.fid].selections;
  (sels[artistName] = sels[artistName] || {})[ctx.meName] = next;
  state.persist();
  ctx.picks = model.picksFor(state.crewDoc, ctx.fid);
  const root = document.getElementById('wall-root');
  for (const node of [...root.querySelectorAll(`.card[data-artist="${artistName}"]`)]) {
    refreshCard(node, artistName, ctx);
  }
};

const click = (node) => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const currentCard = () => document.querySelector('#wall-root .card[data-artist="GRiZ"]');
const myLevel = () => (ctx.picks.GRiZ || {}).Kevin || 0;

test('a real dispatched click on the resting card cycles the pick 0→1→2→3→4→0 and re-renders each time', () => {
  const wall = document.getElementById('wall-root');
  wall.replaceChildren();
  wall.appendChild(renderCard('GRiZ', ctx, { occ: { day: 'Saturday', stage: null, time: null } }));

  assert.equal(myLevel(), 0, 'precondition: unpicked');
  assert.equal(currentCard().getAttribute('aria-label'), 'GRiZ — not picked');

  const levels = [];
  const labels = [];
  // Alternate the click target between the card body and the .name span —
  // both must reach onTap; the P0 guard sat between the card root and
  // ctx.onTap, not on any one child.
  for (let i = 0; i < 5; i++) {
    const before = currentCard();
    const target = i % 2 === 0 ? before : before.querySelector('.name');
    click(target);
    const after = currentCard();
    assert.notEqual(after, before, `tap ${i + 1}: the card re-rendered as a fresh node`);
    levels.push(myLevel());
    labels.push(after.getAttribute('aria-label'));
  }

  assert.deepEqual(levels, [1, 2, 3, 4, 0], 'five real clicks must actually advance the level — the P0 the ledger found');
  assert.deepEqual(labels, [
    'GRiZ — picked',
    'GRiZ — picked ×2',
    'GRiZ — picked ×3',
    'GRiZ — must',
    'GRiZ — not picked',
  ], 'the rendered card carries the new level every tap, not a stale one');
});

test('a click on the resting card\'s notes chip opens notes and never picks', () => {
  const wall = document.getElementById('wall-root');
  wall.replaceChildren();
  // aboutCorner only renders a .chip-notes button when noteCount > 0
  // (js/v3/aura.js:88) — seed a note so the real button exists to click.
  state.recordNote(FID, 'artist', 'Rezz', model.makeNoteId('Kevin', '2026-09-26T20:00:00.000Z', 'note001'), {
    author: 'Kevin', ts: '2026-09-26T20:00:00.000Z', text: 'meet at the rail',
  });
  ctx.picks = model.picksFor(state.crewDoc, FID);
  const card = renderCard('Rezz', ctx, { occ: { day: 'Saturday', stage: null, time: null } });
  wall.appendChild(card);

  const chip = card.querySelector('.chip-notes');
  assert.ok(chip, 'precondition: the notes chip rendered as a real button');
  assert.equal(chip.tagName, 'BUTTON');

  const before = (ctx.picks.Rezz || {}).Kevin || 0;
  click(chip);
  assert.deepEqual(ctx.opened, ['Rezz'], 'the chip is the door to notes');
  assert.equal((ctx.picks.Rezz || {}).Kevin || 0, before, 'and clicking it never advances the pick');
  assert.equal(document.querySelector('#wall-root .card[data-artist="Rezz"]'), card, 'the card was never replaced — no pick happened');
});
