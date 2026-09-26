// Our plan's build frames (2026-09-26): the PRODUCTION peek and day plan —
// no prototype in the page — booted by round two's rig (design/ours-r2/rig.mjs:
// one headless Chromium, the made-up nine, /api answered in the page, every
// write refused, no network, no database).
//   node frames.mjs              every frame
//   node frames.mjs P-open D-    only frames whose id starts with one of these
// PNGs land in ./shots/ (images are git-ignored); a line per frame says what
// the shelf reported, so a frame that silently showed nothing is caught here.
import { mkdirSync } from 'node:fs';
import { openRig, openApp, sleep } from '../../2026-09-25-portola-live/design/ours-r2/rig.mjs';

const PT = (iso) => new Date(`${iso}-07:00`);
const SAT_11AM = PT('2026-09-26T11:00:00');
const SAT_940 = PT('2026-09-26T21:40:00');
const SAT_2AM = PT('2026-09-27T02:00:00');   // Saturday's afters still running
const SUN_7AM = PT('2026-09-27T07:00:00');   // after Saturday's last stop: Sunday's first
const SUN_1130 = PT('2026-09-27T23:30:00');  // the last night, late
const WED_NOON = PT('2026-09-23T12:00:00');  // the day before the first night: tomorrow's first
const TUE_NOON = PT('2026-09-22T12:00:00');  // two days before: no peek
const FRI_7PM = PT('2026-09-25T19:00:00');

const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const report = (page) => page.evaluate(() => {
  const el = document.getElementById('plan');
  const tab = document.getElementById('dock-now');
  const row = el && el.querySelector('.plan-row.tagged');
  return {
    shelf: el ? (el.hidden ? 'hidden' : el.dataset.state) : 'none',
    peekH: el ? el.dataset.peekH : null,
    box: el && !el.hidden ? (() => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })() : null,
    side: el ? el.dataset.side || null : null,
    zoom: (() => { const z = document.querySelector('#zoom-layer .zoom-card, #zoom-layer > *'); if (!z) return null; const r = z.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; })(),
    railNow: (() => { const t = document.getElementById('rail-now'); return t ? (t.getClientRects().length && !t.hidden ? 'shown' : 'hidden') : 'none'; })(),
    row: row ? row.getAttribute('aria-label') : null,
    footH: getComputedStyle(document.documentElement).getPropertyValue('--foot-h').trim(),
    dockNow: tab ? (tab.getClientRects().length ? tab.textContent.trim() : 'hidden') : 'none',
    welcome: !!document.getElementById('welcome-offer') || !!document.querySelector('#screen-app > .welcome-offer'),
  };
});
const openByTap = async (page) => {
  const b = await page.evaluate(() => { const r = document.querySelector('#plan .plan-row.tagged').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(b.x, b.y);
  await sleep(700);
};
// A real drag with the mouse (the page is a touch context; the shelf takes any
// pointer), stopped part-way and held there for the picture.
const dragTo = async (page, frac) => {
  const g = await page.evaluate(() => {
    const el = document.getElementById('plan');
    const r = el.querySelector('.plan-grab').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, range: el.offsetHeight - Number(el.dataset.peekH) };
  });
  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  const to = g.y - g.range * frac;
  for (let k = 1; k <= 8; k++) { await page.mouse.move(g.x, g.y + (to - g.y) * (k / 8)); await sleep(30); }
  await sleep(200);
};
const tapRow = async (page, nth) => {
  const b = await page.evaluate((n) => {
    const rows = [...document.querySelectorAll('#plan .plan-row:not(.tagged):not(.earlier):not(.scattered):not(.or)')];
    const r = rows[n].getBoundingClientRect();
    return { x: r.left + r.width * 0.4, y: r.top + 14 };
  }, nth);
  await page.touchscreen.tap(b.x, b.y);
  await sleep(800);
};

const phone = (id, width, now, run = async () => {}, extra = {}) => ({ id, width, now, run, ...extra });
const desk = (id, width, height, now, run = async () => {}, extra = {}) => ({ id, width, height, now, run, desktop: true, ...extra });
const clickCorner = async (page) => {
  const b = await page.locator('#plan .plan-row.tagged').boundingBox();
  await page.mouse.click(b.x + b.width * 0.4, b.y + b.height / 2);
  await sleep(800);
};
const FRAMES = [
  phone('P-peek-now-390', 390, SAT_940),
  phone('P-peek-next-390', 390, SAT_11AM),
  phone('P-peek-now-320', 320, SAT_940),
  phone('P-open-now-390', 390, SAT_940, openByTap),
  phone('P-open-next-390', 390, SAT_11AM, openByTap),
  phone('P-open-now-320', 320, SAT_940, openByTap),
  phone('P-drag-40-390', 390, SAT_940, (p) => dragTo(p, 0.4)),
  phone('P-grow-tap-390', 390, SAT_11AM, async (p) => { await openByTap(p); await tapRow(p, 1); }),
  phone('P-afters-2am-390', 390, SAT_2AM),
  phone('P-tomorrow-390', 390, SUN_7AM),
  phone('P-last-night-late-390', 390, SUN_1130),
  phone('P-day-before-390', 390, WED_NOON),
  phone('P-two-days-before-390', 390, TUE_NOON),
  phone('P-fri-fork-390', 390, FRI_7PM, openByTap),
  phone('P-welcome-390', 390, SAT_940, async () => {}, { welcome: true }),

  // ---- the laptop: the corner card, its hover, the panel, a zoom beside it ----------
  desk('D-corner-now-1280', 1280, 800, SAT_940),
  desk('D-corner-next-1440', 1440, 900, SAT_11AM),
  desk('D-hover-1280', 1280, 800, SAT_940, async (p) => {
    const b = await p.locator('#plan .plan-row.tagged').boundingBox();
    await p.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5, { steps: 4 });
    await sleep(400);
  }),
  desk('D-open-1280', 1280, 800, SAT_940, clickCorner),
  desk('D-open-1440', 1440, 900, SAT_11AM, clickCorner),
  desk('D-open-scrolled-1280', 1280, 800, SAT_940, async (p) => { await p.mouse.wheel(0, 900); await sleep(400); await clickCorner(p); }),
  desk('D-open-zoom-1280', 1280, 800, SAT_940, async (p) => {
    await clickCorner(p);
    // A card the panel sits beside: hover it; its zoom keeps left of the panel.
    const box = await p.evaluate(() => {
      const side = document.getElementById('plan').getBoundingClientRect().left;
      const cards = [...document.querySelectorAll('#wall-root .card')].map((c) => ({ c, r: c.getBoundingClientRect() }))
        .filter(({ r }) => r.right > side - 120 && r.right < side && r.top > 120 && r.bottom < innerHeight - 40);
      const hit = cards[0];
      return hit ? { x: hit.r.left + hit.r.width / 2, y: hit.r.top + hit.r.height / 2 } : null;
    });
    if (box) { await p.mouse.move(box.x, box.y, { steps: 5 }); await sleep(1000); }
  }),
  desk('D-welcome-1280', 1280, 800, SAT_940, async () => {}, { welcome: true }),
];

const only = process.argv.slice(2);
const todo = FRAMES.filter((f) => !only.length || only.some((o) => f.id.startsWith(o)));
const rig = await openRig();
try {
  for (const f of todo) {
    const { ctx, page } = await openApp(rig, { now: f.now, width: f.width, height: f.height || 844, crew: f.crew || 9, desktop: !!f.desktop });
    try {
      if (f.welcome) {
        // The welcome card greets a guest (a phone with no name in this
        // crew): forget the rig's name on every load, then load again.
        await ctx.addInitScript(() => {
          for (const k of Object.keys(localStorage)) if (k.startsWith('fn_me_v3_') || k === 'fn_welcome_v1') localStorage.removeItem(k);
        });
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 20000 });
        await sleep(1200);
      }
      await f.run(page);
      await sleep(600);
      await page.screenshot({ path: `${OUT}${f.id}.png` });
      console.log(f.id, JSON.stringify(await report(page)));
    } catch (e) {
      console.log(f.id, 'FAILED', e.message);
    } finally { await ctx.close(); }
  }
} finally { await rig.close(); }
