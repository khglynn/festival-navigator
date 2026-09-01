// js/v3/motion.js is the ONE home for how this app moves; the zoom in
// card-facts.js still declares its own copies below the "the bloom" banner
// (that half of the file was under parallel rework on PR #14 when the deck
// and the bucket toggle were built, 2026-09-01). Until card-facts imports
// them, this pins that the two never drift: a deck that grows on a different
// curve from the zoom would read as a different app.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const motion = await import('../js/v3/motion.js');

test('card-facts.js\'s zoom constants equal motion.js\'s — the deck and the zoom move on one grammar', () => {
  const src = readFileSync(join(ROOT, 'js/v3/card-facts.js'), 'utf8');
  const num = (name) => {
    const m = src.match(new RegExp(`(?:export )?const ${name} = (\\d+);`));
    assert.ok(m, `card-facts.js declares ${name}`);
    return Number(m[1]);
  };
  const str = (name) => {
    const m = src.match(new RegExp(`(?:export )?const ${name} = '([^']+)';`));
    assert.ok(m, `card-facts.js declares ${name}`);
    return m[1];
  };
  for (const k of ['GROW_MS', 'MATERIALIZE_MS', 'OUT_MS', 'CASCADE_MS', 'STAGGER_MS', 'REFRESH_MS']) assert.equal(num(k), motion[k], k);
  for (const k of ['EASE_ARRIVE', 'EASE_LEAVE', 'EASE_SURFACE']) assert.equal(str(k), motion[k], k);
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
