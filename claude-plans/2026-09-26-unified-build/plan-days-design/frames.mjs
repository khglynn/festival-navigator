// The plan-days round's frames (2026-09-26): the PRODUCTION peek and open
// plan on this design branch, booted by ./rig.mjs (made-up crews, no
// network, no database, every write refused).
//   node frames.mjs              every frame
//   node frames.mjs A1- C-       only frames whose id starts with one of these
// PNGs land in ./shots/ (git-ignored). One report line per frame says what the
// shelf showed — the head, the Share's words, the tagged row and the rows in
// view — so a frame that silently showed nothing is caught here, and
// `expect` names what the frame is for: a frame whose report misses it says
// MISS on its line.
import { mkdirSync } from 'node:fs';
import { openRig, openApp, sleep } from './rig.mjs';

const PT = (iso) => new Date(`${iso}-07:00`);
const CT = (iso) => new Date(`${iso}-05:00`);
const SAT_315 = PT('2026-09-26T15:15:00');
const SAT_645 = PT('2026-09-26T18:45:00');
const FRI_7PM = PT('2026-09-25T19:00:00');
const ACL_SAT_W2 = CT('2026-10-10T16:00:00'); // ACL's second Saturday, 4 PM Austin
const ACL_SUN_W1 = CT('2026-10-04T19:00:00');

const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// ---- what the shelf shows ------------------------------------------------------
const report = (page) => page.evaluate(() => {
  const el = document.getElementById('plan');
  if (!el) return { shelf: 'none' };
  const list = el.querySelector('.plan-list');
  const lt = list ? list.getBoundingClientRect() : null;
  const inView = (r) => { const b = r.getBoundingClientRect(); return lt && b.bottom > lt.top + 2 && b.top < lt.bottom - 2 && b.height > 0; };
  const rowText = (r) => {
    if (r.classList.contains('plan-day')) return `[${r.textContent.trim().replace(/\s+/g, ' ')}]`;
    if (r.classList.contains('plan-grow')) return '(card)';
    const kind = ['earlier', 'dropin', 'scattered', 'or', 'back', 'empty'].find((k) => r.classList.contains(k));
    const t = (r.getAttribute('aria-label') || r.textContent).trim().replace(/\s+/g, ' ');
    return `${kind ? `${kind}:` : ''}${t}${r.classList.contains('past') ? ' (past)' : ''}`;
  };
  const head = (() => {
    const desk = innerWidth >= 720;
    const h = desk ? el.querySelector('.pc-head') : el.querySelector('.plan-head .room-head');
    return h ? h.textContent.trim().replace(/\s+/g, ' ') : null;
  })();
  const menu = [...document.querySelectorAll('.sort-pop, .hl-pop')].find((p) => p.style.display !== 'none' && p.getClientRects().length);
  return {
    shelf: el.hidden ? 'hidden' : el.dataset.state,
    head,
    corner: (el.querySelector('.pc-line') || {}).textContent || null,
    share: (el.querySelector('.plan-share .w') || {}).textContent || null,
    tagged: (el.querySelector('.plan-row.tagged') || { getAttribute: () => null }).getAttribute('aria-label'),
    rows: list ? [...list.children].filter(inView).map(rowText) : [],
    menu: menu ? (menu.classList.contains('hl-pop') ? 'people' : 'show') : null,
    dockNow: (() => { const t = document.getElementById('dock-now'); return t ? (t.getClientRects().length ? 'shown' : 'hidden') : 'none'; })(),
  };
});

// ---- real input ---------------------------------------------------------------------
const isDesk = (page) => page.evaluate(() => innerWidth >= 720);
const openPlan = async (page) => {
  if (await isDesk(page)) {
    const b = await page.locator('#plan .plan-row.tagged').boundingBox();
    await page.mouse.click(b.x + b.width * 0.4, b.y + b.height / 2);
  } else {
    const b = await page.evaluate(() => { const r = document.querySelector('#plan .plan-row.tagged, #plan .plan-grab').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height / 2 }; });
    await page.touchscreen.tap(b.x, b.y);
  }
  await sleep(800);
};
// Scroll the open list by a real wheel (laptop) or a still-ended finger drag
// (phone: no fling, the flick trap in CLAUDE.md).
const scrollList = async (page, dy) => {
  const box = await page.evaluate(() => { const r = document.querySelector('#plan .plan-list').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.7, h: r.height }; });
  if (await isDesk(page)) { await page.mouse.move(box.x, box.y); await page.mouse.wheel(0, dy); await sleep(500); return; }
  const cdp = await page.context().newCDPSession(page);
  const steps = 14;
  let moved = 0;
  while (moved < dy) {
    const d = Math.min(box.h * 0.5, dy - moved);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
    for (let k = 1; k <= steps; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x, y: box.y - (d * k) / steps }] }); await sleep(16); }
    await sleep(120); // the finger still before it lifts: no fling
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    moved += d;
    await sleep(150);
  }
  await sleep(400);
};
// Scroll so the day head of `night` sits at the list's top (reads the rows'
// data-night; a real scroll gesture moves it there).
const scrollToNight = async (page, night) => {
  const dy = await page.evaluate((n) => {
    const list = document.querySelector('#plan .plan-list');
    const row = [...list.children].find((r) => r.dataset.night === n);
    return row ? row.getBoundingClientRect().top - list.getBoundingClientRect().top - 4 : 0;
  }, night);
  if (dy > 4) await scrollList(page, dy);
};
const tapEl = async (page, sel) => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`nothing at ${sel}`);
  if (await isDesk(page)) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  else await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(450);
};
const doorOf = async (page, what) => {
  const desk = await isDesk(page);
  if (what === 'show') return desk ? '#rail-fest-link' : '#dock-fest-link';
  return desk ? '#rail-you' : '#dock-you';
};
const openMenu = async (page, what) => { await tapEl(page, await doorOf(page, what)); await sleep(300); };
const highlight = (...who) => async (page) => {
  await openMenu(page, 'people');
  const wrap = (await doorOf(page, 'people')) + '-wrap';
  for (const w of who) await tapEl(page, `${wrap} .hl-pop [data-person="${w}"]`);
};
const closeMenus = async (page) => { await page.keyboard.press('Escape'); await sleep(400); };
const tapEarlier = async (page) => { await tapEl(page, '#plan .plan-row.earlier'); await sleep(500); };

// ---- the frames -------------------------------------------------------------------
const phone = (id, now, run, extra = {}) => ({ id, now, width: 390, height: 844, run, ...extra });
const desk = (id, now, run, extra = {}) => ({ id, now, width: 1280, height: 800, desktop: true, run, ...extra });
const opts = (dropIn, more = {}) => ({ design: { dropIn, ...more } });

const FRAMES = [
  // A — Despacio: Kevin's afternoon today vs each option, same crew, same clocks.
  phone('A0-today-peek-315-390', SAT_315, async () => {}, { ...opts('today'), expect: 'Despacio' }),
  phone('A0-today-open-315-390', SAT_315, openPlan, { ...opts('today'), expect: 'Despacio' }),
  phone('A0-today-open-645-390', SAT_645, openPlan, { ...opts('today'), expect: 'Despacio' }),
  desk('A0-today-open-315-1280', SAT_315, openPlan, { ...opts('today'), expect: 'Despacio' }),
  desk('A0-today-corner-315-1280', SAT_315, async () => {}, { ...opts('today'), expect: 'Despacio' }),
  phone('A1-declared-peek-315-390', SAT_315, async () => {}, { ...opts('declared'), expect: 'Tricky' }),
  phone('A1-declared-open-315-390', SAT_315, openPlan, { ...opts('declared'), expect: 'dropin:Despacio' }),
  phone('A1-declared-open-645-390', SAT_645, openPlan, { ...opts('declared'), expect: 'DJ Shadow' }),
  desk('A1-declared-open-315-1280', SAT_315, openPlan, { ...opts('declared'), expect: 'dropin:Despacio' }),
  desk('A1-declared-corner-315-1280', SAT_315, async () => {}, { ...opts('declared'), expect: 'Tricky' }),
  phone('A3-light-open-315-390', SAT_315, openPlan, { ...opts('light'), expect: 'Despacio' }),
  phone('A3-light-open-645-390', SAT_645, openPlan, { ...opts('light'), expect: 'back:' }),
  phone('A0-today-fri-7pm-390', FRI_7PM, openPlan, { ...opts('today'), expect: 'loyalty' }),
  phone('A1-declared-fri-7pm-390', FRI_7PM, openPlan, { ...opts('declared'), expect: 'dropin:' }),
  phone('A2-shape-fri-7pm-390', FRI_7PM, openPlan, { ...opts('shape'), expect: 'loyalty' }),

  // B — every day in the open plan (the recommended Despacio rule on).
  phone('B1-days-sat-645-390', SAT_645, openPlan, { ...opts('declared'), expect: "today’s" }),
  phone('B2-days-into-sun-390', SAT_645, async (p) => { await openPlan(p); await scrollList(p, 460); }, { ...opts('declared'), expect: '[SUN' }),
  phone('B3-days-sun-top-390', SAT_645, async (p) => { await openPlan(p); await scrollToNight(p, '2026-09-27'); }, { ...opts('declared'), expect: 'Sunday’s' }),
  phone('B4-earlier-open-390', SAT_645, async (p) => { await openPlan(p); await tapEarlier(p); }, { ...opts('declared'), expect: '[THU' }),
  desk('B5-days-sun-1280', SAT_645, async (p) => { await openPlan(p); await scrollToNight(p, '2026-09-27'); }, { ...opts('declared'), expect: 'Sunday’s' }),
  desk('B6-days-sat-1280', SAT_645, openPlan, { ...opts('declared'), expect: "today’s" }),
  phone('B7-acl-w2-sat-390', ACL_SAT_W2, async (p) => { await openPlan(p); }, { fest: 'acl-2026', ...opts('declared'), expect: 'Earlier' }),
  phone('B8-acl-w1-sun-390', ACL_SUN_W1, async (p) => { await openPlan(p); await scrollToNight(p, '2026-10-05'); }, { fest: 'acl-2026', ...opts('declared'), expect: 'empty:' }),
  phone('B9-acl-w1-sun-oct9-390', ACL_SUN_W1, async (p) => { await openPlan(p); await scrollToNight(p, '2026-10-10'); }, { fest: 'acl-2026', ...opts('declared'), expect: 'Oct 10' }),

  // C — the menus over the open plan, and the highlight as a filter.
  phone('C1-show-menu-over-open-390', SAT_645, async (p) => { await openPlan(p); await openMenu(p, 'show'); }, { ...opts('declared'), expect: 'show' }),
  phone('C2-afters-hidden-390', SAT_645, async (p) => {
    await openPlan(p); await openMenu(p, 'show');
    await tapEl(p, '#dock-fest-wrap .sort-pop [data-room="Afters"]'); await sleep(700);
  }, { ...opts('declared'), expect: 'show' }),
  phone('C3-afters-hidden-closed-390', SAT_645, async (p) => {
    await openPlan(p); await openMenu(p, 'show');
    await tapEl(p, '#dock-fest-wrap .sort-pop [data-room="Afters"]'); await sleep(500); await closeMenus(p); await scrollList(p, 300);
  }, { ...opts('declared'), expect: 'Soulwax' }),
  phone('C4-people-menu-over-open-390', SAT_645, async (p) => { await openPlan(p); await openMenu(p, 'people'); }, { ...opts('declared'), expect: 'people' }),
  phone('C5-just-gus-menu-390', SAT_645, async (p) => { await openPlan(p); await highlight('Gus')(p); }, { ...opts('declared'), expect: 'just Gus' }),
  phone('C6-just-gus-390', SAT_645, async (p) => { await openPlan(p); await highlight('Gus')(p); await closeMenus(p); }, { ...opts('declared'), expect: 'just Gus' }),
  phone('C7-three-390', SAT_645, async (p) => { await openPlan(p); await highlight('Ana', 'Cy', 'Hal')(p); await closeMenus(p); }, { ...opts('declared'), expect: 'of 3' }),
  phone('C8-today-dim-gus-390', SAT_645, async (p) => { await openPlan(p); await highlight('Gus')(p); await closeMenus(p); }, { ...opts('declared', { filter: false }), expect: 'Dog Blood' }),
  phone('C9-five-390', SAT_645, async (p) => { await openPlan(p); await highlight('Ana', 'Ben', 'Cy', 'Dot', 'Eli')(p); await closeMenus(p); }, { ...opts('declared'), expect: 'of 5' }),
  desk('C10-show-menu-over-open-1280', SAT_645, async (p) => { await openPlan(p); await openMenu(p, 'show'); }, { ...opts('declared'), expect: 'show' }),
  desk('C11-three-1280', SAT_645, async (p) => { await openPlan(p); await highlight('Ana', 'Cy', 'Hal')(p); await closeMenus(p); }, { ...opts('declared'), expect: 'of 3' }),
  desk('C12-just-gus-1280', SAT_645, async (p) => { await openPlan(p); await highlight('Gus')(p); await closeMenus(p); }, { ...opts('declared'), expect: 'JUST GUS' }),
];

const only = process.argv.slice(2);
const todo = FRAMES.filter((f) => !only.length || only.some((o) => f.id.startsWith(o)));
const rig = await openRig();
let misses = 0;
try {
  for (const f of todo) {
    const { ctx, page } = await openApp(rig, { now: f.now, width: f.width, height: f.height, desktop: !!f.desktop, fest: f.fest, design: f.design || {} });
    try {
      await f.run(page);
      await sleep(500);
      await page.screenshot({ path: `${OUT}${f.id}.png` });
      const r = await report(page);
      const said = JSON.stringify(r);
      const ok = !f.expect || said.includes(f.expect);
      if (!ok) misses += 1;
      console.log(`${ok ? 'ok  ' : 'MISS'} ${f.id} ${said}`);
    } catch (e) {
      misses += 1;
      console.log(`FAIL ${f.id} ${e.message.split('\n')[0]}`);
    } finally { await ctx.close(); }
  }
} finally { await rig.close(); }
console.log(`\n${todo.length} frame(s), ${misses} miss(es)`);
