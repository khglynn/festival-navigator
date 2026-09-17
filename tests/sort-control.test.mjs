// The sort chip's popover, in isolation. A row used to be a click-only
// <li role="option"> at 32px — the same touch-floor miss the show menu just
// fixed (app.js showMenuRow) — so a phone tap could land on a neighbour.
// Rows are now native <button role="option"> (CLAUDE.md: the 44px floor is
// applied to `button`, not to a list of selectors); this file pins that the
// listbox presentation and the chip's own roving keyboard (arrows, Enter,
// Escape, typeahead) survive the swap. The real-device touch-floor
// measurement lives in tests/browser/shell-contract.test.mjs — jsdom has no
// layout to measure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { createSortControl } = await import('../js/v3/sort-control.js');

const keydown = (el, key) => el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const click = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

function mount(opts = {}) {
  const changes = [];
  const ctl = createSortControl({ initial: 'billing', onChange: (v) => changes.push(v), ...opts });
  // Each test mounts its own instance — clear the last one so the option ids
  // (`sort-opt-billing`, ...) never collide across tests.
  document.body.replaceChildren();
  document.body.appendChild(ctl.el);
  const chip = ctl.el.querySelector('.sort-chip');
  const pop = ctl.el.querySelector('.sort-pop');
  const rows = [...pop.querySelectorAll('[role="option"]')];
  return { ctl, chip, pop, rows, changes };
}

test('a row is a native button — still an option in the listbox, out of the tab order', () => {
  const { pop, rows } = mount();
  assert.equal(pop.tagName, 'UL');
  assert.equal(pop.getAttribute('role'), 'listbox');
  assert.equal(rows.length, 4, 'billing / A-Z / mine / crew');
  for (const row of rows) {
    assert.equal(row.tagName, 'BUTTON', 'the touch floor and Enter/Space come from being a button');
    assert.equal(row.type, 'button', 'never a submit');
    assert.equal(row.getAttribute('role'), 'option', 'listbox presentation unchanged');
    assert.equal(row.parentElement.tagName, 'LI', 'the <li> is packaging');
    assert.equal(row.parentElement.getAttribute('role'), 'presentation');
    // The chip owns real focus (roving highlight + aria-activedescendant) —
    // a row is a tap target, not a second stop for Tab.
    assert.equal(row.tabIndex, -1);
  }
  assert.deepEqual(rows.map((r) => r.textContent), ['✓Billing', 'A → Z', 'My picks', 'Most picked'],
    '✓ marks the initial value (billing)');
});

test('ArrowDown opens on the current choice, arrows move the highlight, and Enter selects it', () => {
  const { chip, pop, rows, changes } = mount();
  keydown(chip, 'ArrowDown'); // first press only opens and highlights the current value (Codex ship gate, P2)
  assert.equal(pop.style.display, '', 'open');
  assert.equal(chip.getAttribute('aria-expanded'), 'true');
  assert.equal(pop.getAttribute('aria-activedescendant'), 'sort-opt-billing');
  assert.equal(rows[0].classList.contains('kb-active'), true);
  assert.equal(rows[1].classList.contains('kb-active'), false);

  keydown(chip, 'ArrowDown');
  assert.equal(pop.getAttribute('aria-activedescendant'), 'sort-opt-az', 'moved to the next row');
  assert.equal(rows[0].classList.contains('kb-active'), false);
  assert.equal(rows[1].classList.contains('kb-active'), true);

  keydown(chip, 'Enter');
  assert.deepEqual(changes, ['az']);
  assert.equal(pop.style.display, 'none', 'closed');
  assert.equal(chip.getAttribute('aria-expanded'), 'false');
  assert.equal(dom.window.document.activeElement, chip, 'focus lands back on the chip, not a row');
});

test('ArrowUp wraps to the last row', () => {
  const { chip, pop } = mount();
  keydown(chip, 'ArrowDown'); // open on billing (index 0)
  keydown(chip, 'ArrowUp');
  assert.equal(pop.getAttribute('aria-activedescendant'), 'sort-opt-crew', 'wrapped past the start to the end');
});

test('Escape closes it without selecting', () => {
  const { chip, pop, changes } = mount();
  keydown(chip, 'ArrowDown');
  keydown(chip, 'ArrowDown'); // highlight moved off the initial value
  keydown(chip, 'Escape');
  assert.equal(pop.style.display, 'none');
  assert.equal(chip.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(changes, [], 'nothing was chosen');
});

test('first-letter typeahead jumps the highlight to the first matching label', () => {
  const { chip, pop } = mount();
  keydown(chip, 'ArrowDown'); // open
  keydown(chip, 'm'); // "My picks" and "Most picked" both start with M — first one wins
  assert.equal(pop.getAttribute('aria-activedescendant'), 'sort-opt-mine');
});

test('a tap on a row selects it, closes the popover, and returns focus to the chip', () => {
  const { chip, pop, rows, changes } = mount();
  click(chip);
  assert.equal(pop.style.display, '', 'open');
  click(rows[2]); // "My picks"
  assert.deepEqual(changes, ['mine']);
  assert.equal(pop.style.display, 'none');
  assert.equal(dom.window.document.activeElement, chip);
});

test('picking the value already showing does not fire onChange again', () => {
  const { chip, rows, changes } = mount();
  click(chip);
  click(rows[0]); // billing, already the initial value
  assert.deepEqual(changes, [], 'no-op pick is not a change');
});
