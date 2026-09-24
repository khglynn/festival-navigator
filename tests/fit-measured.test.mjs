// The corners' fit measures what really drew (2026-09-23). aura.js's width
// table was measured in Chromium on macOS; Linux renders Inter wider, and so
// will real phones, so a fit that trusted the table left Robyn's corners
// 1.4px apart in CI. The table is now the FIRST GUESS: after it is written,
// the ResizeObserver reads back each card's two corners as laid out and
// gives way one more step wherever they crowd — reads all first, then
// writes, a few passes at most — and a late font (document.fonts) refits
// every card, because a font changes widths without resizing a card.
//
// jsdom has no layout, so the engine is played here: the card and its two
// corners answer getBoundingClientRect from a rule about what the "engine"
// draws at each give-way step. The real geometry is the browser contract's
// (tests/browser/meter-contract.test.mjs, including a wider-glyph run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="wall-root"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

// The fit's observer, captured so the test can play the engine's notifications.
let notify = null;
globalThis.ResizeObserver = class { constructor(cb) { if (!notify) notify = cb; } observe() {} unobserve() {} disconnect() {} };
// A font set whose loads the test fires by hand.
const fontHandlers = {};
let fontsReady;
document.fonts = {
  ready: new Promise((r) => { fontsReady = r; }),
  addEventListener: (type, fn) => { (fontHandlers[type] = fontHandlers[type] || []).push(fn); },
};

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderCard } = await import('../js/v3/wall.js');
const { GIVE_WAY, needAt } = await import('../js/v3/aura.js');
const LAST = GIVE_WAY.length - 1;

const FID = 'fit-fest';
FESTIVAL_INDEX.push({ id: FID, status: 'lineup' });
FESTIVALS[FID] = { id: FID, name: 'Fit Fest', artists: [{ name: 'Crowded', day: 'Saturday' }] };
const PEOPLE = { Kevin: 5, Drew: 1, Kat: 2, Nhu: 3, Pegah: 4, Ross: 0, Sam: 6 };
state.activateCrew('fitmeasuredtoken_0123456789', {
  v: 4, meta: {}, spotify: {},
  people: Object.fromEntries(Object.entries(PEOPLE).map(([n, c]) => [n, { colorIndex: c }])),
  festivals: { [FID]: { selections: { Crowded: { Kevin: 4, Drew: 4, Kat: 4, Nhu: 1, Pegah: 2, Ross: 3, Sam: 1 } } } },
  affinity: {},
}, FID);
state.setActiveFestivalId(FID);
const ctx = {
  fid: FID, meName: 'Kevin', picks: model.picksFor(state.crewDoc, FID), affinity: { Crowded: { songs: 41, followed: true } },
  lowPower: true, onTap: () => {}, onOpenNotes: null,
};

// The engine: a card whose padding box is exactly what the table says step
// 2 needs (so the table's own answer is step 2), and whose corners, at
// give-way step s, draw as `engine(s)` says — the about corner from the left
// edge, the crew corner from the right, `gap` px apart (negative: overlapping).
let engine = () => ({ gap: 10 });
const GUESS = 2;
let WIDTH = 0;
function mountWithEngine() {
  const card = renderCard('Crowded', ctx, {});
  document.getElementById('wall-root').appendChild(card);
  WIDTH = WIDTH || Math.ceil(needAt(card._corners, GUESS));
  const width = WIDTH + 2; // the border box: the padding box plus a 1px edge each side
  const rect = (left, right) => ({ left, right, width: right - left, top: 40, bottom: 52, height: 12, x: left, y: 40 });
  card.getBoundingClientRect = () => rect(0, width);
  const about = card.querySelector(':scope > .corner-about');
  const who = card.querySelector(':scope > .corner-who');
  about.getBoundingClientRect = () => rect(7, 90);
  who.getBoundingClientRect = () => { const { gap } = engine(Number(card.dataset.fit)); return rect(90 + gap, width - 6); };
  return card;
}
const layout = (card, width = WIDTH + 2) => notify([{ target: card, borderBoxSize: [{ inlineSize: width }] }]);

test('the table is a first guess: where the corners really crowd, the card gives way further, and no further than it must', () => {
  const card = mountWithEngine();
  // Where the table itself stops (it believes the width is enough there)…
  const guess = GIVE_WAY.findIndex((_, s) => needAt(card._corners, s) <= WIDTH);
  assert.equal(guess, GUESS, `the table gives way to step ${guess} on its own`);
  // …this engine draws wider: the corners crowd until two steps later.
  engine = (s) => ({ gap: s < guess + 2 ? 1 : 8 });
  layout(card);
  assert.equal(Number(card.dataset.fit), guess + 2, 'read back, bumped, read back: clear at the first step that really is');
  // An engine that draws what the table says keeps the table's answer.
  const fair = mountWithEngine();
  engine = () => ({ gap: 8 });
  layout(fair);
  assert.equal(Number(fair.dataset.fit), guess, 'no step taken that the corners did not need');
});

test('an engine where nothing fits stops at the last step — the loop is bounded', () => {
  const card = mountWithEngine();
  engine = () => ({ gap: -30 });
  layout(card);
  assert.equal(Number(card.dataset.fit), LAST);
});

test('a card with no layout (a hidden screen, jsdom) is never bumped on a guess', () => {
  const card = mountWithEngine();
  card.getBoundingClientRect = () => ({ left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0 });
  engine = () => ({ gap: -30 });
  layout(card, 0);
  assert.equal(card.dataset.fit, '0', 'no width, no fit: everything stays');
});

test('a late font refits every card — a font changes widths without resizing a card', async () => {
  const card = mountWithEngine();
  engine = () => ({ gap: 8 });
  layout(card);
  const before = Number(card.dataset.fit);
  // The webfont lands: the same card now draws wider.
  engine = (s) => ({ gap: s < before + 1 ? 0 : 8 });
  for (const fn of fontHandlers.loadingdone || []) fn();
  assert.equal(Number(card.dataset.fit), before + 1, 'loadingdone refit it');
  // document.fonts.ready does the same, once.
  engine = (s) => ({ gap: s < before + 2 ? 0 : 8 });
  fontsReady();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(Number(card.dataset.fit), before + 2, 'fonts.ready refit it');
});
