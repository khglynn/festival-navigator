// The Diagnostics paste (Settings → App → Diagnostics, js/errlog.js) answers
// the next "the stage names stutter" report on its own (2026-09-23): whether
// the phone asks for reduced motion, whether the app's Low power is on, and
// which way the stage strip on the current wall follows its columns —
// 'timeline' (the compositor moves it with the grid), 'transform' (a scroll
// handler, a frame behind on a phone) or 'none' (no grid on screen). The route
// is the one the wall actually took: wall.js followStrip writes it on the
// strip, and this reads it back rather than re-deriving it. Nothing private
// travels: no tokens, no names, no note text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="wall-root"></div></body></html>', { url: 'https://fest.kevinhg.com/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true }); // Node's own is getter-only
let reduce = false;
dom.window.matchMedia = (q) => ({ matches: reduce && /prefers-reduced-motion:\s*reduce/.test(q), addEventListener() {}, removeEventListener() {} });

const { diagnostics } = await import('../js/errlog.js');
const wall = document.getElementById('wall-root');
const strip = (follow) => {
  wall.innerHTML = `<div class="tt-block"><div class="times-wrap stage-strip" data-follow="${follow}"><div class="times-scroll follows"><div class="times-grid"></div></div></div></div>`;
};

test('Diagnostics says which way the strip follows, and whether motion is off — nothing more', async () => {
  strip('timeline');
  let d = await diagnostics();
  assert.equal(d.reducedMotion, false);
  assert.equal(d.lowPower, false);
  assert.equal(d.stripRoute, 'timeline', 'the route the wall took');
  assert.ok(d.stripAnimation === null || typeof d.stripAnimation === 'string', 'the engine\'s own word for the follow, where it has one');

  reduce = true;
  document.body.classList.add('low-power');
  strip('transform');
  d = await diagnostics();
  assert.equal(d.reducedMotion, true, 'the OS setting');
  assert.equal(d.lowPower, true, 'the app\'s Low power');
  assert.equal(d.stripRoute, 'transform');

  wall.innerHTML = '';
  d = await diagnostics();
  assert.equal(d.stripRoute, 'none', 'no grid on the wall, no strip');
  assert.equal(d.stripAnimation, null);
  // The paste's shape is unchanged otherwise.
  for (const k of ['build', 'ua', 'viewport', 'online', 'at', 'errors']) assert.ok(k in d, `still carries ${k}`);
});

test('a Diagnostics read never throws, even with no DOM to read', async () => {
  const had = dom.window.matchMedia;
  dom.window.matchMedia = () => { throw new Error('blocked'); };
  try {
    const d = await diagnostics();
    assert.equal(d.reducedMotion, null, 'unknown, not a guess');
  } finally {
    dom.window.matchMedia = had;
  }
});

// The tap change (2026-09-26): which hand pressed last — a finger opens a
// card's shelf, a mouse or a key picks — as the zoom module says it on the
// page (card-facts.js), so a "my tap picked" report carries its own evidence.
test('Diagnostics says the hand behind the last press: null before any, then what the page says', async () => {
  delete document.documentElement.dataset.hand;
  delete document.documentElement.dataset.handBy;
  let d = await diagnostics();
  assert.equal(d.hand, null, 'no press yet: unknown, not a guess');
  assert.equal(d.handBy, null);
  document.documentElement.dataset.hand = 'finger';
  document.documentElement.dataset.handBy = 'press';
  d = await diagnostics();
  assert.equal(d.hand, 'finger');
  assert.equal(d.handBy, 'press', 'and what decided it (WebKit types a finger\'s click "mouse")');
});
