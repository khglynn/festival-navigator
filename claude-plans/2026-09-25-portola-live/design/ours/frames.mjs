// Renders the OURS phone frames (390 x 844 CSS px, 2x PNG) from the real app.
//   node frames.mjs            every frame
//   node frames.mjs O1 O3-now  only frames whose id starts with one of these
// One headless Chromium, one page per frame, closed after its screenshot.
import { openRig, openApp, REL, sleep } from './rig.mjs';

const PT = (iso) => new Date(`${iso}-07:00`);
const SAT_11AM = PT('2026-09-26T11:00:00');
const SAT_940 = PT('2026-09-26T21:40:00');
const FRI_530 = PT('2026-09-25T17:30:00');
const THU_11PM = PT('2026-09-24T23:00:00');
const SUN_2PM = PT('2026-09-27T14:00:00');

const proto = `/${REL}/ours-proto.mjs`;
const call = (page, fn, arg) => page.evaluate(async ([url, f, a]) => (await import(url))[f](a), [proto, fn, arg]);
// Put an element's top at `y` CSS px from the top of the window.
const scrollTo = (page, sel, y) => page.evaluate(([s, yy]) => {
  const el = document.querySelector(s);
  if (!el) throw new Error(`no ${s}`);
  window.scrollTo(0, el.getBoundingClientRect().top + scrollY - yy);
}, [sel, y]);

const FRAMES = [
  { id: 'O1-key', now: SAT_11AM, async run(page) {
    await call(page, 'buildO1', { nights: ['Sat', 'Sun'] });
    await scrollTo(page, '[data-room="ours-Sat"]', 14);
    await sleep(500); await call(page, 'quietDays');
  } },
  { id: 'O1-now', now: SAT_940, async run(page) {
    await call(page, 'buildO1', { nights: ['Sat', 'Sun'], nowNight: 'Sat', nowMin: 21 * 60 + 40 });
    await scrollTo(page, '.o-row.now', 250);
    await sleep(500); await call(page, 'quietDays');
  } },
  { id: 'O1-empty', now: FRI_530, async run(page) {
    await call(page, 'buildO1', { nights: ['Thu', 'Fri', 'Sat'], nowNight: 'Fri', nowMin: 17 * 60 + 30 });
    await scrollTo(page, '[data-room="ours-Thu"]', 14);
    await sleep(500); await call(page, 'quietDays');
  } },
  { id: 'O2-key', now: SAT_11AM, async run(page) {
    await call(page, 'buildO2', {});
    await scrollTo(page, '#wall-root .card.cell[data-artist="Tove Lo"]', 170);
    await sleep(250);
    await call(page, 'edgePills');
  } },
  { id: 'O2-now', now: SAT_940, async run(page) {
    await call(page, 'buildO2', {});
    await sleep(250);
    await call(page, 'edgePills');
  } },
  { id: 'O2-empty', now: THU_11PM, async run(page) {
    await call(page, 'buildO2', { toast: 'Nothing has 3 of us on Thursday. Friday does, from 9 PM.' });
    await scrollTo(page, '.room-head', 150);
  } },
  { id: 'O3-now', now: SAT_940, async run(page) {
    await call(page, 'buildO3', { night: 'Sat', nowMin: 21 * 60 + 40, dayLabel: 'Sat' });
  } },
  { id: 'O3-split', now: SUN_2PM, async run(page) {
    await scrollTo(page, '.day-block[data-day="Sunday"]', 0);
    await sleep(600);
    await call(page, 'buildO3', { night: 'Sun', nowMin: 14 * 60, dayLabel: 'Sun' });
  } },
  { id: 'O3-empty', now: THU_11PM, async run(page) {
    await call(page, 'buildO3', { night: 'Thu', nowMin: 23 * 60, dayLabel: 'Thu' });
  } },
];

const only = process.argv.slice(2);
const todo = FRAMES.filter((f) => !only.length || only.some((o) => f.id.startsWith(o)));
const rig = await openRig();
try {
  for (const f of todo) {
    const { ctx, page } = await openApp(rig, { now: f.now });
    try {
      await f.run(page);
      await sleep(700);
      const out = new URL(`./frames/${f.id}.png`, import.meta.url).pathname;
      await page.screenshot({ path: out });
      const dock = await page.evaluate(() => {
        const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return Math.round(b.width); };
        return { days: r('#dock-days'), ours: r('.ours-tab'), now: r('#dock-now'), fest: r('#dock-fest-wrap') };
      });
      console.log(f.id, 'ok', JSON.stringify(dock));
    } catch (e) {
      console.log(f.id, 'FAILED', e.message);
    } finally { await ctx.close(); }
  }
} finally { await rig.close(); }
