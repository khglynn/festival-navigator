// The Share design round's text candidates (2026-09-26), written by the
// production model and the draft's planText styles (js/v3/plan-rows.js on
// live/plan-share) for round two's made-up nine on the real Portola lineup.
//   node texts.mjs            → prints every style at Saturday 11 AM and 9:40 PM
//   node texts.mjs --json     → the same as JSON (frames.mjs reads it)
// Nothing here reads a crew, the network or a database.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const { readFileSync } = await import('node:fs');
const P = await import('../../../js/v3/plan.js');
const R = await import('../../../js/v3/plan-rows.js');
const { SELECTIONS, MEMBERS } = await import('../../2026-09-25-portola-live/design/ours-r2/crew.mjs');
const fest = JSON.parse(readFileSync(new URL('../../../data/festivals/portola-2026.json', import.meta.url), 'utf8'));

const plan = P.planOf(fest, { picks: SELECTIONS, members: MEMBERS });
const ctx = { picks: SELECTIONS };
export function textsAt(date) {
  const at = P.planAt(plan, fest, date);
  const route = at.night;
  const nowMin = at.minutes;
  const opts = { ctx, plan, nowMin, fest: fest.name || 'Portola', day: 'Sat Sep 26' };
  return Object.fromEntries(Object.keys(R.PLAN_TEXT_STYLES).map((style) => [style, R.planText(route, { ...opts, style })]));
}
if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === '--json') {
  console.log(JSON.stringify({ morning: textsAt(new Date('2026-09-26T11:00:00-07:00')), night: textsAt(new Date('2026-09-26T21:40:00-07:00')) }));
} else if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [label, date] of [['Sat 11 AM', new Date('2026-09-26T11:00:00-07:00')], ['Sat 9:40 PM', new Date('2026-09-26T21:40:00-07:00')]]) {
    const t = textsAt(date);
    for (const [style, text] of Object.entries(t)) console.log(`\n=== ${label} · ${style} (${text.length} chars)\n${text}`);
  }
}
