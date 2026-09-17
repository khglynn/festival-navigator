// js/v3/motion.js is the ONE home for how this app moves: the zoom
// (card-facts.js) and the bucket toggle (app.js) import its constants, so the
// grammar cannot drift by construction. What is left to pin is the gate.
import test from 'node:test';
import assert from 'node:assert/strict';

const motion = await import('../js/v3/motion.js');

test('canAnimate: no animate() (jsdom), reduced motion, or Low Power means instant', () => {
  const node = { animate: () => {} };
  assert.equal(motion.canAnimate({}, {}), false, 'no Element.animate');
  assert.equal(motion.canAnimate(node, { lowPower: true }), false, 'Low Power promises no animation');
  assert.equal(motion.canAnimate(null, {}), false);
  const prev = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  try { assert.equal(motion.canAnimate(node, {}), false, 'prefers-reduced-motion wins'); } finally { globalThis.window = prev; }
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  try { assert.equal(motion.canAnimate(node, {}), true); } finally { globalThis.window = prev; }
});
