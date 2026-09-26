// The moment-lens frames (list-view round, direction c, 2026-09-26, on v95):
// 390 (touch) and 1280 (mouse), 2x PNG, the real app with the made-up crew of
// nine; one headless Chromium, one page per frame, API stubbed, no network.
//   APP=<design-app worktree> node frames.mjs [id-prefix ...]
import { openRig, openApp, sleep } from './rig.mjs';

const PT = (iso) => new Date(`${iso}-07:00`);
const SUN_150PM = PT('2026-09-27T13:50:00'); // the clock: Sunday 1:50 PM at Portola
const proto = '/__c/proto.mjs';
const calls = (page, list) => page.evaluate(async ([url, l]) => {
  const P = await import(url);
  await P.ensureCss();
  let out = null;
  for (const [f, a] of l) out = await P[f](...(Array.isArray(a) ? a : [a]));
  return out;
}, [proto, list]);
const NOW = 13 * 60 + 50;
const LIST = ['list', ['Sunday', { nowMin: NOW }]];

const FRAMES = [];
for (const [w, desktop] of [[390, false], [1280, true]]) {
  const h = desktop ? 860 : 844;
  FRAMES.push(
    // The list it sits on: SUN PORTOLA as a time list; the NOW band's label says NOW.
    { id: `1-list-sun-${w}`, w, h, desktop, async run(p) { await calls(p, [LIST, ['headTop', ['Sunday', ':fest', desktop ? 74 : 20]]]); } },
    // Further down the same day: Folsom's daytime — the other side of the fork.
    { id: `2-list-folsom-${w}`, w, h, desktop, async run(p) { await calls(p, [LIST, ['headTop', ['Sunday', 'Folsom', desktop ? 74 : 20]]]); } },
    // Tap "2 PM": the moment rises — two mid-motion frames, ~60ms (the
    // shelf travelling up, the label lit) and ~300ms (the fork drawing, the
    // branches arriving one beat apart).
    ...[60, 300].map((ms, i) => ({ id: `3${'ab'[i]}-moment-2pm-mid${ms}-${w}`, w, h, desktop, async run(p) {
      await calls(p, [LIST, ['bandTop', ['Sunday', ':fest', 840, desktop ? 180 : 150]]]);
      await p.evaluate(async (t) => { const P = await import('/__c/proto.mjs'); await P.open({ dayKey: 'Sunday', min: 840, from: ':fest' }); P.freeze(t); }, ms);
    } })),
    // Settled: Sunday at 2 — Portola (you're here) or Folsom (most of us).
    { id: `4-moment-2pm-${w}`, w, h, desktop, async run(p) {
      await calls(p, [LIST, ['bandTop', ['Sunday', ':fest', 840, desktop ? 180 : 150]]]);
      console.log('   ', await calls(p, [['open', { dayKey: 'Sunday', min: 840, from: ':fest', instant: true }]]));
    } },
    // Scrubbed with + to 3:45: the Portola side fills in (Channel Tres).
    { id: `5-moment-345-${w}`, w, h, desktop, async run(p) {
      await calls(p, [LIST, ['bandTop', ['Sunday', ':fest', 840, desktop ? 180 : 150]]]);
      await calls(p, [['open', { dayKey: 'Sunday', min: 840, from: ':fest', instant: true }]]);
      console.log('   ', await calls(p, [['step', 105]]));
      await p.evaluate(async () => { const P = await import('/__c/proto.mjs'); P.freeze(10000); });
    } },
    // Sunday 10:30 PM, three ways: Portola's closers, the afters, Folsom.
    { id: `6-moment-1030pm-${w}`, w, h, desktop, async run(p) {
      await calls(p, [LIST, ['bandTop', ['Sunday', ':fest', 22 * 60, desktop ? 180 : 150]]]);
      console.log('   ', await calls(p, [['open', { dayKey: 'Sunday', min: 22 * 60 + 30, from: ':fest', instant: true }]]));
    } },
    // The same, swiped one branch over (a phone shows two; the third peeks).
    ...(desktop ? [] : [{ id: `6b-moment-1030pm-swiped-${w}`, w, h, desktop, async run(p) {
      await calls(p, [LIST, ['bandTop', ['Sunday', ':fest', 22 * 60, 150]]]);
      await calls(p, [['open', { dayKey: 'Sunday', min: 22 * 60 + 30, from: ':fest', instant: true }]]);
      await p.evaluate(() => { const s = document.querySelector('.mo-scroll'); s.scrollLeft = s.scrollWidth; });
    } }]),
  );
}

const only = process.argv.slice(2);
const todo = FRAMES.filter((f) => !only.length || only.some((o) => f.id.startsWith(o)));
const rig = await openRig();
try {
  for (const f of todo) {
    const { ctx, page } = await openApp(rig, { now: SUN_150PM, width: f.w, height: f.h, desktop: f.desktop });
    try {
      await f.run(page);
      await sleep(f.id.includes('-mid-') ? 0 : 700);
      await page.screenshot({ path: new URL(`./frames/${f.id}.png`, import.meta.url).pathname });
      console.log(f.id, 'ok');
    } catch (e) { console.log(f.id, 'FAILED', e.message); } finally { await ctx.close(); }
  }
} finally { await rig.close(); }
