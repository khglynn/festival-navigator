// app.js's shell glue, run rather than re-implemented: the new-build notice,
// and the resize re-mirror of the day scrollers (2026-09-16).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const shell = await bootShell(); // no crew, no network: boot lands on the landing
await settle(60);
const { $, dom } = shell;
const { showToast, showActionToast } = await import('../js/v3/wall.js'); // the SAME instance app.js holds
test.after(() => shell.close());

test('the new-build notice stays until it is tapped — another toast cannot erase it', () => {
  dom.window.dispatchEvent(new dom.window.CustomEvent('fn:new-build'));
  const notice = () => $('new-build-strip');
  assert.ok(notice(), 'the notice is up');
  assert.match(notice().textContent, /refresh/i);
  assert.ok(notice().querySelector('button'), 'with the one thing to do about it');

  // Every toast shares one slot and clears it first; the notice used to be one
  // of them, and the next undo or offline line left the tab on the old build.
  showToast($('toast-root'), 'You’re offline');
  showActionToast($('toast-root'), 'Welcome back, GRiZ.', 'Not me', () => {});
  assert.ok(notice(), 'still up after two more toasts');

  dom.window.dispatchEvent(new dom.window.CustomEvent('fn:new-build'));
  assert.equal(document.querySelectorAll('#new-build-strip').length, 1, 'announced once, however many takeovers');
});

// ---- resize: scrollers re-mirror within their own sync group ----------------
function scroller(group, left, { strip = false } = {}) {
  const sc = document.createElement('div');
  sc.className = 'times-scroll';
  if (group) sc.dataset.sync = group;
  sc.scrollLeft = left;
  if (!strip) return sc;
  const wrap = document.createElement('div');
  wrap.className = 'stage-strip';
  wrap.appendChild(sc);
  return wrap;
}

test('a resize re-mirrors each sync group to its own lead, and leaves every other group where it was', async () => {
  // A day-first wall: the grid (strip + two days, one clamped out of step by
  // the resize) and two venue-night rooms scrolled to their own positions.
  const wall = $('wall-root');
  wall.replaceChildren(
    scroller('grid', 0, { strip: true }),
    scroller('grid', 120),
    scroller('grid', 95),
    scroller('ev-thu', 450),
    scroller('ev-fri', 200),
  );
  const [strip, gridLead, gridOther, thu, fri] = wall.querySelectorAll('.times-scroll');
  dom.window.dispatchEvent(new dom.window.Event('resize'));
  await settle(220); // the handler is debounced 150 ms

  assert.equal(gridOther.scrollLeft, 120, 'the grid days agree again, on the grid lead');
  assert.equal(gridLead.scrollLeft, 120);
  assert.equal(thu.scrollLeft, 450, 'Thursday\'s room keeps its own position through a rotation');
  assert.equal(fri.scrollLeft, 200, 'and so does Friday\'s');
  assert.equal(strip.scrollLeft, 0, 'the strip is a follower — never scrolled');
});

test('a wall with no sync groups is one group, as before', async () => {
  const wall = $('wall-root');
  wall.replaceChildren(scroller(null, 80), scroller(null, 10), scroller(null, 0));
  const [, b, c] = wall.querySelectorAll('.times-scroll');
  dom.window.dispatchEvent(new dom.window.Event('resize'));
  await settle(220);
  assert.equal(b.scrollLeft, 80);
  assert.equal(c.scrollLeft, 80);
});
