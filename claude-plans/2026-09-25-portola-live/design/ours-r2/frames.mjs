// Renders the OURS round-two phone frames from the real app (390 x 844 CSS px
// or 320 x 844, 2x PNG). One headless Chromium, one page per frame, each
// closed after its screenshot; nothing reaches a database or the network.
//   node frames.mjs            every frame
//   node frames.mjs R1 D2-320  only frames whose id starts with one of these
import { openRig, openApp, REL, sleep } from './rig.mjs';

const PT = (iso) => new Date(`${iso}-07:00`);
const SAT_11AM = PT('2026-09-26T11:00:00');
const SAT_940 = PT('2026-09-26T21:40:00');
const SUN_730 = PT('2026-09-27T19:30:00');
const SUN_2PM = PT('2026-09-27T14:00:00');
const THU_6PM = PT('2026-09-24T18:00:00');
const M = (h, m = 0) => h * 60 + m;

const proto = `/${REL}/r2-proto.mjs`;
// Call an export of the prototype inside the page; `env` first, with the fold.
const call = (page, fn, arg, folded = []) => page.evaluate(async ([url, f, a, fo]) => {
  const P = await import(url);
  P.env({ folded: fo });
  await P.ensureCss();
  return P[f](a);
}, [proto, fn, arg, folded]);
const calls = (page, list, folded = []) => page.evaluate(async ([url, l, fo]) => {
  const P = await import(url);
  P.env({ folded: fo });
  await P.ensureCss();
  for (const [f, a] of l) await P[f](a);
}, [proto, list, folded]);
// Put an element's top at `y` CSS px from the top of the window.
const scrollTo = (page, sel, y) => page.evaluate(([s, yy]) => {
  const el = document.querySelector(s);
  if (!el) throw new Error(`no ${s}`);
  window.scrollTo(0, el.getBoundingClientRect().top + scrollY - yy);
}, [sel, y]);
const headTop = (page, text, y) => page.evaluate(([t, yy]) => {
  const h = [...document.querySelectorAll('#wall-root .room-head')].find((e) => e.textContent.replace(/\s+/g, ' ').trim().startsWith(t));
  if (!h) throw new Error(`no head ${t}`);
  window.scrollTo(0, h.getBoundingClientRect().top + scrollY - yy);
}, [text, y]);

const FRAMES = [
  // ---- R1: the plan shelf, from the people line -------------------------------
  { id: 'R1-door', now: SAT_11AM, async run(page) {
    await headTop(page, 'SAT PORTOLA', 52);
    await calls(page, [['pinPeople', { on: false }], ['activeDay', 'SAT']]);
  } },
  { id: 'R1-plan', now: SAT_11AM, async run(page) {
    await headTop(page, 'SAT PORTOLA', 52);
    await calls(page, [['pinPeople', { on: true }], ['activeDay', 'SAT'], ['buildShelf', { night: 'Sat', nowMin: M(11), grow: null }]]);
  } },
  { id: 'R1-now', now: SAT_940, async run(page) {
    await calls(page, [['pinPeople', { on: true }], ['activeDay', 'SAT'], ['buildShelf', { night: 'Sat', nowMin: M(21, 40) }]]);
  } },
  { id: 'R1-320', now: SAT_11AM, width: 320, async run(page) {
    await headTop(page, 'SAT PORTOLA', 52);
    await calls(page, [['pinPeople', { on: true }], ['activeDay', 'SAT'], ['buildShelf', { night: 'Sat', nowMin: M(11), grow: null }]]);
  } },

  // ---- R1's honest test: the people row at 320 and 390, crews of 6 and 12 -----
  // (a) today's wrapping row, OURS leading, at the top of the page;
  // (b) the same people as one pinned line.
  ...[320, 390].flatMap((width) => [6, 12].flatMap((crew) => [
    { id: `PR-a-${width}-${crew}`, now: SAT_11AM, width, crew, async run(page) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await call(page, 'oursInToolbar', { on: false });
    } },
    { id: `PR-b-${width}-${crew}`, now: SAT_11AM, width, crew, async run(page) {
      await headTop(page, 'SAT PORTOLA', 52);
      await calls(page, [['pinPeople', { on: false }], ['activeDay', 'SAT']]);
    } },
  ])),

  // ---- naming: is "ours" clear? ----------------------------------------------------
  ...[390, 320].map((width) => ({ id: `N-names-${width}`, now: SAT_11AM, width, async run(page) {
    await call(page, 'namingBoard', { labels: [
      { chip: 'Ours', head: 'OURS', note: 'round one: ours what?' },
      { chip: 'Our plan', head: 'OUR PLAN', note: 'the pick: what it is, and whose', pick: true },
      { chip: 'Our day', head: 'OUR DAY', note: 'a day is what the tabs already are' },
      { chip: 'All of us', head: 'ALL OF US', note: 'beside names, reads as the wall you have' },
      { chip: 'Everyone', head: 'EVERYONE', note: 'taken: “everyone ✕” clears a filter', collide: true },
      { chip: 'Where we’ll be', head: 'WHERE WE’LL BE', note: 'clearest, longest; kept for the send button' },
    ] });
  } })),

  // ---- R2: the plan is the day's first room -------------------------------------
  { id: 'R2-open', now: SAT_11AM, async run(page) {
    await call(page, 'planRoom', { night: 'Sat', nowMin: M(11) });
    await headTop(page, 'SAT OUR PLAN', 14);
    await call(page, 'activeDay', 'SAT');
  } },
  { id: 'R2-now', now: SAT_940, async run(page) {
    await call(page, 'planRoom', { night: 'Sat', nowMin: M(21, 40) });
    await headTop(page, 'SAT OUR PLAN', 14);
    await call(page, 'activeDay', 'SAT');
  } },
  { id: 'R2-320', now: SAT_11AM, width: 320, async run(page) {
    await call(page, 'planRoom', { night: 'Sat', nowMin: M(11) });
    await headTop(page, 'SAT OUR PLAN', 14);
    await call(page, 'activeDay', 'SAT');
  } },

  // ---- R3: the plan bar on the dock's top edge -----------------------------------
  { id: 'R3-next', now: SAT_11AM, async run(page) {
    await headTop(page, 'SAT PORTOLA', 14);
    await calls(page, [['activeDay', 'SAT'], ['dockNoNow', null], ['planBar', { night: 'Sat', nowMin: M(11) }]]);
  } },
  { id: 'R3-now', now: SAT_940, async run(page) {
    await calls(page, [['dockNoNow', null], ['planBar', { night: 'Sat', nowMin: M(21, 40) }]]);
  }, async after(page) { await call(page, 'dockNoNow', null); } },
  { id: 'R3-320', now: SAT_940, width: 320, async run(page) {
    await calls(page, [['dockNoNow', null], ['planBar', { night: 'Sat', nowMin: M(21, 40) }]]);
  }, async after(page) { await call(page, 'dockNoNow', null); } },

  // ---- the dock: today (D0), NOW in the day row (D1), NOW floating (D2) ----------
  { id: 'D0-390', now: SAT_940, async run() {} },
  { id: 'D0-320', now: SAT_940, width: 320, async run() {} },
  { id: 'D1-390', now: SAT_940, async run(page) { await call(page, 'dockD1', { day: 'SAT' }); }, async after(page) { await call(page, 'dockD1', { day: 'SAT' }); } },
  { id: 'D1-320', now: SAT_940, width: 320, async run(page) { await call(page, 'dockD1', { day: 'SAT' }); }, async after(page) { await call(page, 'dockD1', { day: 'SAT' }); } },
  { id: 'D2-390', now: SAT_940, async run(page) { await call(page, 'dockD2', {}); }, async after(page) { await call(page, 'dockD2', {}); } },
  { id: 'D2-320', now: SAT_940, width: 320, async run(page) { await call(page, 'dockD2', {}); }, async after(page) { await call(page, 'dockD2', {}); } },

  // ---- the shelf's edge states (shared by every direction) ------------------------
  { id: 'X-sun-split', now: SUN_730, async run(page) {
    await calls(page, [['dockD1', { day: 'SUN' }], ['buildShelf', { night: 'Sun', nowMin: M(19, 30) }]]);
  }, async after(page) { await call(page, 'dockD1', { day: 'SUN' }); } },
  { id: 'X-thu-also', now: THU_6PM, async run(page) {
    await calls(page, [['buildShelf', { night: 'Thu', nowMin: M(18), grow: null }]]);
  } },
  { id: 'X-sun-folsom-hidden', now: SUN_2PM, fold: ['Folsom'], async run(page) {
    await calls(page, [['dockD1', { day: 'SUN' }], ['buildShelf', { night: 'Sun', nowMin: M(14) }]], ['Folsom']);
  }, async after(page) { await call(page, 'dockD1', { day: 'SUN' }, ['Folsom']); } },
];

const only = process.argv.slice(2);
const todo = FRAMES.filter((f) => !only.length || only.some((o) => f.id.startsWith(o)));
const rig = await openRig();
try {
  for (const f of todo) {
    const { ctx, page } = await openApp(rig, { now: f.now, width: f.width || 390, crew: f.crew || 9, fold: f.fold || null });
    try {
      await f.run(page);
      await sleep(700);
      if (f.after) { await f.after(page); await sleep(250); }
      const out = new URL(`./frames/${f.id}.png`, import.meta.url).pathname;
      await page.screenshot({ path: out });
      console.log(f.id, 'ok');
    } catch (e) {
      console.log(f.id, 'FAILED', e.message);
    } finally { await ctx.close(); }
  }
} finally { await rig.close(); }
