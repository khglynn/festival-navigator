// Round three's frames (2026-09-25, late): the peek that grows into the plan
// at 390 and 320, desktop at 1280 and 1440, and the crowded zoom with the
// ghost − · note · + at 1280, 390 and 320. Same rig as round two: one
// headless Chromium, one page per frame, API stubbed, no network, no database.
//   node frames3.mjs            every frame
//   node frames3.mjs Q DT-plan  only frames whose id starts with one of these
import { openRig, openApp, REL, sleep } from './rig.mjs';

const PT = (iso) => new Date(`${iso}-07:00`);
const SAT_11AM = PT('2026-09-26T11:00:00');
const SAT_940 = PT('2026-09-26T21:40:00');
const FRI_7PM = PT('2026-09-25T19:00:00');
const M = (h, m = 0) => h * 60 + m;
const ZOOM_ARTIST = 'Femme Jatale b2b erika';
const LONG_ARTIST = 'Big Muscle: Bare Chest Calendar';

const proto = `/${REL}/r3-proto.mjs`;
const calls = (page, list) => page.evaluate(async ([url, l]) => {
  const P = await import(url);
  P.env({});
  await P.ensureCss();
  let out = null;
  for (const [f, a] of l) out = await P[f](a);
  return out;
}, [proto, list]);
const headTop = (page, text, y) => page.evaluate(([t, yy]) => {
  const h = [...document.querySelectorAll('#wall-root .room-head')].find((e) => e.textContent.replace(/\s+/g, ' ').trim().startsWith(t));
  if (!h) throw new Error(`no head ${t}`);
  window.scrollTo(0, h.getBoundingClientRect().top + scrollY - yy);
}, [text, y]);
const activeDay = (page, day) => page.evaluate((d) => {
  for (const t of document.querySelectorAll('#dock-days .day-tab, #rail-days .day-tab')) t.classList.toggle('active', t.textContent.trim().startsWith(d));
}, day);
// Bring the crowded card to the middle of the window (and, on a phone, of its
// stack's scroller if it has one).
const cardToMiddle = (page, artist) => page.evaluate((a) => {
  const el = document.querySelector(`#wall-root .card[data-artist="${CSS.escape(a)}"]`);
  if (!el) throw new Error(`no card ${a}`);
  const sc = el.closest('.times-scroll, .venue-scroll');
  if (sc) sc.scrollLeft += el.getBoundingClientRect().left - sc.getBoundingClientRect().left - 20;
  window.scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.38);
}, artist);

const phone = (id, width, now, run) => ({ id, width, now, run });
const FRAMES = [
  // ---- the phone: the peek, and the plan it grows into -------------------------
  phone('Q-peek-now-390', 390, SAT_940, async (p) => { await calls(p, [['dockWithoutNow', null], ['peekPhone', { night: 'Sat', nowMin: M(21, 40) }]]); }),
  phone('Q-peek-next-390', 390, SAT_11AM, async (p) => { await headTop(p, 'SAT PORTOLA', 14); await activeDay(p, 'SAT'); await calls(p, [['dockWithoutNow', null], ['peekPhone', { night: 'Sat', nowMin: M(11) }]]); }),
  phone('Q-plan-390', 390, SAT_11AM, async (p) => { await headTop(p, 'SAT PORTOLA', 14); await activeDay(p, 'SAT'); await calls(p, [['dockWithoutNow', null], ['shelfPhone', { night: 'Sat', nowMin: M(11) }]]); }),
  phone('Q-plan-now-390', 390, SAT_940, async (p) => { await calls(p, [['dockWithoutNow', null], ['shelfPhone', { night: 'Sat', nowMin: M(21, 40) }]]); }),
  phone('Q-peek-320', 320, SAT_940, async (p) => { await calls(p, [['dockWithoutNow', null], ['peekPhone', { night: 'Sat', nowMin: M(21, 40) }]]); }),
  phone('Q-plan-320', 320, SAT_11AM, async (p) => { await headTop(p, 'SAT PORTOLA', 14); await activeDay(p, 'SAT'); await calls(p, [['dockWithoutNow', null], ['shelfPhone', { night: 'Sat', nowMin: M(11) }]]); }),
  phone('Q-plan-now-320', 320, SAT_940, async (p) => { await calls(p, [['dockWithoutNow', null], ['shelfPhone', { night: 'Sat', nowMin: M(21, 40) }]]); }),

  // ---- desktop: the corner card, its hover, the panel, the stack, the dialog ------
  { id: 'DT-peek-1440', desktop: true, width: 1440, height: 900, now: SAT_11AM, async run(p) {
    await calls(p, [['cornerStack', { night: 'Sat', nowMin: M(11) }]]);
  } },
  { id: 'DT-peek-hover-1280', desktop: true, width: 1280, height: 800, now: SAT_940, async run(p) {
    const r = await p.evaluate(() => null);
    await calls(p, [['cornerStack', { night: 'Sat', nowMin: M(21, 40), hover: true }]]);
    const box = await p.evaluate(() => { const b = document.querySelector('.q-open').getBoundingClientRect(); return { x: b.left + b.width * 0.55, y: b.top + b.height * 0.55 }; });
    await calls(p, [['cursorAt', box]]);
    return r;
  } },
  { id: 'DT-plan-1280', desktop: true, width: 1280, height: 800, now: SAT_940, async run(p) {
    await calls(p, [['panel', { night: 'Sat', nowMin: M(21, 40) }]]);
  } },
  { id: 'DT-plan-1440', desktop: true, width: 1440, height: 900, now: SAT_11AM, async run(p) {
    await calls(p, [['panel', { night: 'Sat', nowMin: M(11) }]]);
  } },
  { id: 'DT-welcome-1280', desktop: true, width: 1280, height: 800, now: SAT_11AM, async run(p) {
    await calls(p, [['cornerStack', { night: 'Sat', nowMin: M(11), welcome: true }]]);
  } },
  { id: 'DT-join-1280', desktop: true, width: 1280, height: 800, now: SAT_11AM, async run(p) {
    await calls(p, [['cornerStack', { night: 'Sat', nowMin: M(11) }], ['joinDialog', { artist: 'Tove Lo' }]]);
  } },

  // ---- the crowded zoom: ghost − · note · + on a real afters card ------------------
  { id: 'Z-1280', desktop: true, width: 1280, height: 800, now: FRI_7PM, crew: 12, async run(p) {
    await cardToMiddle(p, ZOOM_ARTIST);
    await sleep(300);
    // The real hover route grows the zoom; the mouse then rests on + (inside
    // the zoom, so it stays), which is what the hover state shows.
    await p.hover(`#wall-root .card[data-artist="${ZOOM_ARTIST}"]`);
    await sleep(900);
    await calls(p, [['cornerStack', { night: 'Fri', nowMin: M(19) }], ['ghostStepper', { hover: 'plus' }]]);
    const plus = await p.evaluate(() => { const b = document.querySelector('#zoom-layer .q-step.plus .dot').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await p.mouse.move(plus.x, plus.y, { steps: 4 });
    await sleep(300);
    await calls(p, [['cursorAt', { x: plus.x + 7, y: plus.y + 6 }]]);
    await activeDay(p, 'FRI');
  } },
  ...[390, 320].map((width) => ({ id: `Z-${width}`, width, now: FRI_7PM, crew: 12, async run(p) {
    await cardToMiddle(p, ZOOM_ARTIST);
    await sleep(300);
    await calls(p, [['dockWithoutNow', null], ['openZoom', { artist: ZOOM_ARTIST }], ['ghostStepper', {}]]);
    await activeDay(p, 'FRI');
  } })),
  // The two-line name, on the second real card (Info door only).
  { id: 'Z2-1280', desktop: true, width: 1280, height: 800, now: SAT_11AM, crew: 12, async run(p) {
    await cardToMiddle(p, LONG_ARTIST);
    await sleep(300);
    await p.hover(`#wall-root .card[data-artist="${LONG_ARTIST}"]`);
    await sleep(900);
    await calls(p, [['ghostStepper', {}]]);
    await activeDay(p, 'SAT');
  } },
  ...[390, 320].map((width) => ({ id: `Z2-${width}`, width, now: SAT_11AM, crew: 12, async run(p) {
    await cardToMiddle(p, LONG_ARTIST);
    await sleep(300);
    await calls(p, [['dockWithoutNow', null], ['openZoom', { artist: LONG_ARTIST }], ['ghostStepper', {}]]);
    await activeDay(p, 'SAT');
  } })),
];

const only = process.argv.slice(2);
const todo = FRAMES.filter((f) => !only.length || only.some((o) => f.id.startsWith(o)));
const rig = await openRig();
try {
  for (const f of todo) {
    const { ctx, page } = await openApp(rig, { now: f.now, width: f.width, height: f.height || 844, crew: f.crew || 9, desktop: !!f.desktop });
    try {
      await f.run(page);
      await sleep(700);
      await page.screenshot({ path: new URL(`./frames/${f.id}.png`, import.meta.url).pathname });
      console.log(f.id, 'ok');
    } catch (e) {
      console.log(f.id, 'FAILED', e.message);
    } finally { await ctx.close(); }
  }
} finally { await rig.close(); }
