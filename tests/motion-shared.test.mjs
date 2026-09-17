// js/v3/motion.js is the ONE home for how this app moves: the zoom
// (card-facts.js) and the bucket toggle (app.js) import its constants, so the
// grammar cannot drift by construction. What is left to pin is the gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const motion = await import('../js/v3/motion.js');

// CONTENT_FADE_MS is the one constant in this file that a STYLESHEET also
// holds: the resting card's content steps back through a CSS transition, and
// the zoom's cascade waits that fade out so one fact is never printed twice.
// Two copies of one number in two languages is exactly the drift this file
// exists to prevent, so the number is checked against the rule it names.
// (It used to be MATERIALIZE_MS and meant two things at once — the overlay's
// own fade-in and the CSS content fade. MODEL-V4 §5 deleted the first.)
test('CONTENT_FADE_MS is the `.card > *` transition in v3.css, said in milliseconds', () => {
  const css = readFileSync(path.join(ROOT, 'assets/v3.css'), 'utf8');
  const rule = css.match(/\.card\s*>\s*\*\s*\{([^}]*)\}/);
  assert.ok(rule, 'v3.css still steps the resting card\'s content back with a `.card > *` rule');
  const t = rule[1].match(/transition:\s*opacity\s+([\d.]+)(ms|s)/);
  assert.ok(t, `that rule still carries an opacity transition: ${rule[1].trim()}`);
  const ms = Number(t[1]) * (t[2] === 's' ? 1000 : 1);
  assert.equal(motion.CONTENT_FADE_MS, ms, 'the cascade waits exactly as long as the CSS fade takes');
});

test('the overlay has no fade of its own — MATERIALIZE_MS is gone', () => {
  assert.equal(motion.MATERIALIZE_MS, undefined,
    'MODEL-V4 §5: the slot is opaque at frame 0, so there is no materialise to time');
});

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
