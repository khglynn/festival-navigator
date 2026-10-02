// The welcome card leaves however its animation ends (LEDGER 40, 2026-10-01).
// Our plan rises only when the card has left the screen (app.js watches
// #screen-app for its removal), and the card was removed only by its leave
// animation's `finish` — so an animation that never ticked (a backgrounded or
// throttled page; WebKit on loaded CI) left the card standing and the plan
// held under it for good. jsdom has no animate(): this hands the card one
// that never finishes, the case a real engine's timeline can produce.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="screen-app"><div id="welcome-card" class="bring-offer"><div class="bring-card"></div></div></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
test.after(() => { delete globalThis.window; delete globalThis.document; });
const { dismissWelcome } = await import('../js/v3/welcome.js');
const { OUT_MS } = await import('../js/v3/motion.js');

test('a leave animation that never finishes still takes the card off the screen', async () => {
  const card = document.querySelector('.bring-card');
  const animations = [];
  card.animate = () => { const a = { onfinish: null, oncancel: null }; animations.push(a); return a; };
  dismissWelcome({ ctx: { lowPower: false } });
  assert.equal(animations.length, 1, 'the card animates its way out');
  assert.ok(document.querySelector('.bring-offer'), 'still leaving');
  await new Promise((r) => setTimeout(r, OUT_MS * 3 + 120));
  assert.equal(document.querySelector('.bring-offer'), null, 'gone without a finish');
});

test('a cancelled leave takes it off too, and a finish after that changes nothing', () => {
  document.getElementById('screen-app').innerHTML = '<div id="welcome-card" class="bring-offer"><div class="bring-card"></div></div>';
  const card = document.querySelector('.bring-card');
  let a = null;
  card.animate = () => { a = { onfinish: null, oncancel: null }; return a; };
  dismissWelcome({ ctx: { lowPower: false } });
  a.oncancel();
  assert.equal(document.querySelector('.bring-offer'), null);
  a.onfinish();
  assert.equal(document.querySelector('.bring-offer'), null);
});
