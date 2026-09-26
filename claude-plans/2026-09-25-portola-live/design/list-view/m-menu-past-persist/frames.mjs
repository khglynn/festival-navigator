// The frames (list-view round, m-menu-past-persist, 2026-09-26): the real app
// (v95 + v93's shell) with the prototype layered on. 2x PNGs into ./frames.
//   node frames.mjs [id-prefix ...]
import path from 'node:path';
import { openRig, openApp, PT, sleep, writes, HERE } from './rig.mjs';

const SAT_540P = PT('2026-09-26T17:40:00');
const SUN_6A = PT('2026-09-27T06:00:00');
const SUN_150P = PT('2026-09-27T13:50:00');
const FRI_9P = PT('2026-09-25T21:00:00');

const P = (page, fn, arg) => page.evaluate(async ([f, a]) => {
  const M = await import('/__m/proto.mjs');
  if (a && a.date) a.date = new Date(a.date);
  return M[f](a);
}, [fn, arg]);
// Scroll so a room head sits `y` px under the top, then let the scrollspy
// catch up (a scroll event, a beat) so the day row lights the right day.
const toHead = async (page, text, y = 12) => {
  await page.evaluate(([t, yy]) => {
    const h = [...document.querySelectorAll('#wall-root .room-head')].find((e) => e.textContent.replace(/\s+/g, ' ').trim().startsWith(t));
    if (!h) throw new Error(`no head ${t}`);
    window.scrollTo(0, h.getBoundingClientRect().top + scrollY - yy);
  }, [text, y]);
  await settle(page);
  // The prototype's folds hide whole days, which the scrollspy of this build
  // cannot know: light the day the page is on (a build's spy skips folds).
  await P(page, 'lightDay', { wd: text.slice(0, 3) });
};
const toTop = async (page) => { await page.evaluate(() => window.scrollTo(0, 0)); await settle(page); };
const settle = async (page) => {
  await page.evaluate(() => { window.dispatchEvent(new Event('scroll')); });
  await page.clock.runFor(1200).catch(() => {});
  await sleep(500);
  await page.evaluate(() => { window.dispatchEvent(new Event('scroll')); });
  await sleep(300);
};

const FRAMES = [
  // ---- 1. the menu -------------------------------------------------------
  ...[390, 1280].flatMap((w) => {
    const desktop = w > 700;
    const h = desktop ? 860 : 844;
    return [
      { id: `menu-closed-${w}`, w, h, desktop, now: SAT_540P, async run(p) { await P(p, 'foldPast', { date: SAT_540P }); await toHead(p, 'SAT PORTOLA', desktop ? 90 : 12); } },
      { id: `menu-rows-${w}`, w, h, desktop, now: SAT_540P, async run(p) { await P(p, 'foldPast', { date: SAT_540P }); await toHead(p, 'SAT PORTOLA', desktop ? 90 : 12); await P(p, 'openMenu', { variant: 'rows', desktop }); } },
      { id: `menu-room-${w}`, w, h, desktop, now: SAT_540P, async run(p) { await P(p, 'foldPast', { date: SAT_540P }); await toHead(p, 'SAT PORTOLA', desktop ? 90 : 12); await P(p, 'openMenu', { variant: 'room', desktop }); } },
      { id: `menu-list-${w}`, w, h, desktop, now: SAT_540P, async run(p) { await P(p, 'foldPast', { date: SAT_540P }); await toHead(p, 'SAT FOLSOM', desktop ? 90 : 12); await P(p, 'openMenu', { variant: 'room', view: 'list', desktop }); } },
    ];
  }),
  // ---- 2. the past, Saturday 5:40 PM ---------------------------------------
  { id: 'top-before-390', w: 390, now: SAT_540P, async run(p) { await toTop(p); } },
  { id: 'top-after-390', w: 390, now: SAT_540P, async run(p) { const r = await P(p, 'foldPast', { date: SAT_540P }); await toTop(p); await P(p, 'lightDay', { wd: 'SAT' }); return r; } },
  { id: 'cut-grid-before-390', w: 390, now: SAT_540P, async run(p) { await toHead(p, 'SAT PORTOLA'); } },
  { id: 'cut-grid-390', w: 390, now: SAT_540P, async run(p) { await P(p, 'foldPast', { date: SAT_540P }); await toHead(p, 'SAT PORTOLA'); } },
  { id: 'cut-grid-mid-390', w: 390, now: SAT_540P, async run(p) { await P(p, 'foldPast', { date: SAT_540P, mid: 0.4 }); await toHead(p, 'SAT PORTOLA'); } },
  { id: 'cut-grid-open-390', w: 390, now: SAT_540P, async run(p) { await P(p, 'foldPast', { date: SAT_540P, openRoom: '[data-room=":fest"]' }); await toHead(p, 'SAT PORTOLA'); } },
  { id: 'cut-list-390', w: 390, now: SAT_540P, async run(p) { await P(p, 'foldPast', { date: SAT_540P }); await toHead(p, 'SAT FOLSOM'); } },
  { id: 'cut-list-mid-390', w: 390, now: SAT_540P, async run(p) { await P(p, 'foldPast', { date: SAT_540P, mid: 0.5 }); await toHead(p, 'SAT FOLSOM'); } },
  { id: 'cut-list-open-390', w: 390, now: SAT_540P, async run(p) { await P(p, 'foldPast', { date: SAT_540P, openRoom: '[data-room="Folsom"]' }); await toHead(p, 'SAT FOLSOM'); } },
  { id: 'days-open-390', w: 390, now: SAT_540P, async run(p) { await P(p, 'foldPast', { date: SAT_540P, openDays: true }); await toTop(p); } },
  { id: 'cut-grid-1280', w: 1280, h: 860, desktop: true, now: SAT_540P, async run(p) { await P(p, 'foldPast', { date: SAT_540P }); await toHead(p, 'SAT PORTOLA', 90); } },
  // ---- 3. the edges ------------------------------------------------------
  // 6 AM Sunday: Saturday's Portola is over, its afters mostly, Aftershock
  // (Folsom, 3–10 AM) still on — the rollover.
  { id: 'rollover-6am-390', w: 390, now: SUN_6A, async run(p) { const r = await P(p, 'foldPast', { date: SUN_6A }); await toHead(p, 'SAT PORTOLA'); return r; } },
  { id: 'rollover-6am-b-390', w: 390, now: SUN_6A, async run(p) { await P(p, 'foldPast', { date: SUN_6A }); await toHead(p, 'SAT AFTERS'); } },
  // Sunday at 1:50 PM — the question the round is about.
  { id: 'sun-150-390', w: 390, now: SUN_150P, async run(p) { const r = await P(p, 'foldPast', { date: SUN_150P }); await toTop(p); await P(p, 'lightDay', { wd: 'SUN' }); return r; } },
  // A future day: Friday night, Saturday and Sunday untouched.
  { id: 'future-fri-390', w: 390, now: FRI_9P, async run(p) { const r = await P(p, 'foldPast', { date: FRI_9P }); await toHead(p, 'SAT PORTOLA'); return r; } },
];

const only = process.argv.slice(2);
const todo = FRAMES.filter((f) => !only.length || only.some((o) => f.id.startsWith(o)));
const rig = await openRig();
try {
  for (const f of todo) {
    const { ctx, page } = await openApp(rig, { now: f.now, width: f.w, height: f.h || 844, desktop: !!f.desktop });
    try {
      const out = await f.run(page);
      const rep = await page.evaluate(() => window.__mpReport || null);
      await sleep(500);
      await page.screenshot({ path: path.join(HERE, 'frames', `${f.id}.png`) });
      console.log(f.id, 'ok', out ? JSON.stringify(out) : '');
    } catch (e) { console.log(f.id, 'FAILED', e.message); } finally { await ctx.close(); }
  }
} finally { await rig.close(); console.log('writes refused:', writes.length); }
