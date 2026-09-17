// app.js's shell glue, run rather than re-implemented (2026-09-16).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const shell = await bootShell(); // no crew, no network: boot lands on the landing
await settle(60);
const { $, dom } = shell;
const { showToast, showUndoToast } = await import('../js/v3/wall.js'); // the SAME instance app.js holds
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
  showUndoToast($('toast-root'), 'Cleared your must for GRiZ', () => {});
  assert.ok(notice(), 'still up after two more toasts');

  dom.window.dispatchEvent(new dom.window.CustomEvent('fn:new-build'));
  assert.equal(document.querySelectorAll('#new-build-strip').length, 1, 'announced once, however many takeovers');
});
