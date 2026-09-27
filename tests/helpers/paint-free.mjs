// jsdom parses every inline style it is handed, and the plan's rows paint
// each node and face with a pick's aura (plan-rows.js nodeEl, whoEl): long
// gradients its CSS grammar walks value by value. In the sweeps that draw
// the open plan thousands of times, that parse was nearly all of the run —
// tests/plan-text.test.mjs took 288 s on the plan-days branch, and 50 s once
// the rows stopped painting (2026-09-27, a CPU profile: cssstyle's
// background parser under stopRow). Those sweeps read words, classes and
// data attributes, never paint, so this makes the two paint properties the
// rows set write nothing. Never use it in a test that reads a colour.
export function paintFree(window) {
  const Style = window.CSSStyleProperties || window.CSSStyleDeclaration;
  for (const k of ['background', 'border']) {
    Object.defineProperty(Style.prototype, k, { configurable: true, get() { return ''; }, set() {} });
  }
}
