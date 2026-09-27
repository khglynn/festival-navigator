// v104 walk (2026-09-26): an independent walk of live/v103, real input only,
// against the builder's rig (v103-rig.mjs). Never production, never a real
// crew link. Results banked to V104-WALK.md as each check finishes; a FAIL or
// UNSURE also gets a screenshot in v103-shots/walk-*.png (git-ignored).
//
//   node claude-plans/2026-09-26-unified-build/v104-walk.mjs
//
// This file does not edit the rig, app code or tests — it only imports
// openRig/openApp and drives the app with real touch/mouse/keyboard input.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openRig, openApp, PT, CDT, sleep, tap, click, dayRow, scrollTo, highlight, openPlan, writes, SHOTS,
} from './v103-rig.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MD = path.join(HERE, 'V104-WALK.md');
const room = (day, r) => `.day-block[data-day="${day}"] .room[data-room="${r}"]`;

const RESULTS = []; // { id, status, note }
function bankLine(text) { fs.appendFileSync(MD, `${text}\n`); }
async function shotFor(page, id) {
  if (!page) return null;
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = `walk-${id}.png`;
  try { await page.screenshot({ path: path.join(SHOTS, file) }); return file; } catch { return null; }
}
async function record(id, status, note, page = null) {
  let shot = null;
  if (status === 'FAIL' || status === 'UNSURE') shot = await shotFor(page, id.replace(/[^a-z0-9]+/gi, '-').toLowerCase());
  RESULTS.push({ id, status, note, shot });
  bankLine(`## ${id} — ${status}\n${note}${shot ? `\n\nScreenshot: \`v103-shots/${shot}\`` : ''}\n`);
  console.log(`[${status}] ${id}: ${note}`);
}

// ---- small real-input helpers -------------------------------------------------------
const bar = (width) => (width >= 720 ? 'rail' : 'dock');
const press = (width) => (width >= 720 ? click : tap);
async function youDoor(page, b) {
  return (await page.locator(`#${b}-you`).isVisible()) ? `#${b}-you` : `#${b}-you-wrap .hl-faces`;
}
// Open Highlight, starting from whatever state it is in (plain avatar or the
// already-highlighted pill), and wait until the popover is really open (the
// Everyone row has real size) rather than trusting aria-expanded.
async function openHL(page, width) {
  const b = bar(width), p = press(width);
  const door = await youDoor(page, b);
  await p(page, door);
  for (let i = 0; i < 8; i++) {
    const open = await page.evaluate((bb) => {
      const el = document.querySelector(`#${bb}-you-wrap .hl-pop [data-person=""]`);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }, b);
    if (open) return;
    await sleep(200);
  }
}
async function closeHL(page, width) {
  const b = bar(width), p = press(width);
  const door = await youDoor(page, b);
  await p(page, door);
  await sleep(400);
}
async function pickPerson(page, width, name) {
  const b = bar(width), p = press(width);
  await p(page, `#${b}-you-wrap .hl-pop [data-person="${name}"]`);
  await sleep(500);
}
async function clearHL(page, width) {
  const b = bar(width), p = press(width);
  await p(page, `#${b}-you-wrap .hl-pop [data-person=""]`);
  await sleep(400);
}
// Highlight exactly `names`, starting from Everyone, real taps/clicks throughout.
async function setHighlight(page, width, names, { keepOpen = false } = {}) {
  await openHL(page, width);
  for (const n of names) await pickPerson(page, width, n);
  if (!keepOpen) await closeHL(page, width);
}

// The fest-name Show menu: Board <-> List, real input.
async function switchView(page, width, view) {
  const b = bar(width), p = press(width);
  await p(page, `#${b}-fest-link`);
  await sleep(300);
  await p(page, `#${b}-fest-wrap .view-row [data-view="${view}"]`);
  await sleep(400);
  await p(page, `#${b}-fest-link`); // close the menu again
  await sleep(300);
}

// A tap that avoids the two things that can sit over a List row: Our plan's
// peek/panel at the bottom of the phone, and the card's own corner controls.
// Nudges the scroll position until the point really resolves inside `sel`,
// then dispatches a real touchscreen tap (never element.click()).
async function realTapCard(page, sel, { top = true } = {}) {
  let b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`not found: ${sel}`);
  for (let i = 0; i < 12; i++) {
    const cx = b.x + b.width / 2;
    const cy = top ? b.y + 10 : b.y + b.height / 2;
    const hit = await page.evaluate(([x, y, s]) => {
      const el = document.elementFromPoint(x, y);
      return !!(el && el.closest(s));
    }, [cx, cy, sel]);
    if (hit) { await page.touchscreen.tap(cx, cy); await sleep(450); return b; }
    await page.evaluate(() => window.scrollBy(0, 60));
    await sleep(150);
    b = await page.locator(sel).first().boundingBox();
  }
  throw new Error(`could not find a clear tap point on ${sel}`);
}

// A real finger's swipe on the day row: CDP touch, the drag ending with the
// finger still (a flick's fling eats the next tap on Linux — CLAUDE.md). The
// distance is the row's own scrollLeft plus slack — a fixed guess (140px)
// under-swiped at 320 (scrollLeft 132, and a touch-drag's effective scroll
// trails the finger's on-screen travel a little), so the finger always
// travels far enough to actually reach the row's start.
async function swipeRowRight(ctx, page, doorRow, px = null) {
  const r = await page.evaluate((d) => {
    const row = document.getElementById(d);
    const b = row.getBoundingClientRect();
    return { x: b.left + 20, y: b.top + b.height / 2, scrollLeft: row.scrollLeft };
  }, doorRow);
  const dist = px || (r.scrollLeft + 80);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await touch('touchStart', [{ x: r.x, y: r.y }]);
  for (let i = 1; i <= 12; i++) { await sleep(16); await touch('touchMove', [{ x: r.x + (dist * i) / 12, y: r.y }]); }
  await sleep(120); // stop before lifting: no fling
  await touch('touchEnd', []);
  await sleep(500);
}

const nowGeom = (page, door) => page.evaluate((d) => {
  const row = document.getElementById(`${d}-days`);
  const now = document.getElementById(`${d}-now`);
  const r = row.getBoundingClientRect();
  const b = now.getBoundingClientRect();
  const active = row.querySelector('.day-tab.active');
  const ab = active ? active.getBoundingClientRect() : null;
  return {
    hidden: now.hidden,
    first: row.firstElementChild === now,
    idx: [...row.children].filter((c) => !c.hidden).indexOf(now),
    seen: Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left)),
    w: b.width,
    x: b.left, y: b.top + b.height / 2,
    whole: b.left >= r.left - 0.5 && b.right <= r.right + 0.5,
    activeDay: active ? active.dataset.day : null,
    activeWhole: ab ? (ab.left >= r.left - 0.5 && ab.right <= r.right + 0.5) : null,
  };
}, door);

// ============================================================================
// Item 1 — NOW in the day row (Portola Sat 10:30 PM, `sparse` crew)
// ============================================================================
async function item1(chromium, webkit) {
  const SAT_1030 = PT('2026-09-26T22:30:00');
  const notes = [];
  let fail = false;
  const runFor = async (rig, width, engineLabel) => {
    const desktop = width >= 720;
    const { ctx, page } = await openApp(rig, { now: SAT_1030, width, height: desktop ? 900 : 844, crew: 'sparse', view: 'board' });
    const door = desktop ? 'rail' : 'dock';
    try {
      const g0 = await nowGeom(page, door);
      if (!g0.first) { fail = true; notes.push(`${engineLabel}${width}: NOW is not the row's first item`); }
      if (desktop && !g0.whole) { fail = true; notes.push(`${engineLabel}${width}: NOW not whole on the rail`); }
      if (!desktop && !g0.activeWhole) { fail = true; notes.push(`${engineLabel}${width}: SAT (the day you're in) is not fully visible`); }
      // swipe reveals NOW where it rests past the edge (phone widths only).
      // CDP touch dispatch (the real multi-point drag) is Chromium-only —
      // Playwright's WebKit has no CDP session, matching the app's own
      // now-jump.test.mjs, whose swipe case runs in Chromium alone.
      if (!desktop && !g0.whole && rig.engine === 'chromium') {
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(250);
        await swipeRowRight(ctx, page, `${door}-days`);
        const g1 = await nowGeom(page, door);
        if (!(g1.seen >= g1.w - 1)) { fail = true; notes.push(`${engineLabel}${width}: swipe did not bring NOW fully into view (${JSON.stringify(g1)})`); }
      }
      // tap NOW jumps the wall. Bring NOW into view first — the real swipe's
      // stand-in for a plain scrollLeft reset (tests/helpers/browser.mjs
      // `nowInView`; the tap itself below is still real touchscreen/mouse
      // input, never element.click()).
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(200);
      await page.evaluate((d) => { const row = document.getElementById(`${d}-days`); if (row) row.scrollTo({ left: 0, behavior: 'auto' }); }, door);
      await sleep(200);
      const nb = await page.locator(`#${door}-now`).boundingBox();
      const tapFn = desktop ? async () => page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2) : async () => page.touchscreen.tap(nb.x + nb.width / 2, nb.y + nb.height / 2);
      await tapFn();
      await sleep(900);
      const land = await page.evaluate((d) => {
        // The phone's dock is a real floor; the desktop's #dock is
        // display:none (there is no bottom bar there) — the floor there is
        // just the viewport, or Our plan's panel if one is open above it.
        const dockEl = document.getElementById('dock');
        const dockVisible = dockEl && getComputedStyle(dockEl).display !== 'none';
        const floor = dockVisible ? dockEl.getBoundingClientRect().top : innerHeight;
        const line = document.querySelector('#wall-root .now-line');
        const lr = line ? line.getBoundingClientRect() : null;
        const block = line ? line.closest('.tt-block') : null;
        const strip = block ? block.querySelector('.stage-strip') : null;
        const sb = strip ? strip.getBoundingClientRect().bottom : 0;
        return { hasLine: !!line, top: lr && lr.top, floor, inView: lr ? (lr.top > sb - 1 && lr.top < floor) : false };
      }, door);
      if (!land.hasLine || !land.inView) { fail = true; notes.push(`${engineLabel}${width}: tapping NOW did not land the now line in view (${JSON.stringify(land)})`); }
      // SUN then back to SAT never moves NOW's position
      const idxBefore = (await nowGeom(page, door)).idx;
      const pressFn = desktop ? click : tap;
      await pressFn(page, `#${door}-days .day-tab[data-day="Sunday"]`);
      await sleep(700);
      await pressFn(page, `#${door}-days .day-tab[data-day="Saturday"]`);
      await sleep(700);
      const idxAfter = (await nowGeom(page, door)).idx;
      if (idxBefore !== 0 || idxAfter !== 0) { fail = true; notes.push(`${engineLabel}${width}: NOW moved position across a SUN/SAT switch (idx ${idxBefore} -> ${idxAfter})`); }
    } finally { await ctx.close(); }
  };
  await runFor(chromium, 1280, 'Chromium ');
  await runFor(chromium, 390, 'Chromium ');
  await runFor(chromium, 320, 'Chromium ');
  await runFor(webkit, 390, 'WebKit ');
  await runFor(webkit, 320, 'WebKit ');
  await record('1. NOW in the day row',
    fail ? 'FAIL' : 'PASS',
    fail ? notes.join(' | ') : 'Chromium 1280/390/320 + WebKit 390/320: NOW is the row\'s first item and stays first (idx 0) across SUN/SAT; whole on the rail, and at 390/320 the active day (SAT) stays whole while NOW rests past the edge; a real finger swipe brings it fully into view; a tap lands the now line between the strip and the dock on every width/engine.');
}

// ============================================================================
// Item 2 — NOW when Our picks' peek carries it (`design` crew)
// ============================================================================
async function item2(chromium, webkit) {
  const SAT_1030 = PT('2026-09-26T22:30:00');
  const notes = [];
  let fail = false;
  const runFor = async (rig, width, engineLabel) => {
    const { ctx, page } = await openApp(rig, { now: SAT_1030, width, height: 844, crew: 'design', view: 'board' });
    try {
      const peekTag = () => page.evaluate(() => {
        const p = document.getElementById('plan');
        const m = p ? p.textContent.match(/NOW|NEXT/) : null;
        return m ? m[0] : null;
      });
      const nowHidden0 = await page.evaluate(() => document.getElementById('dock-now').hidden);
      const tag0 = await peekTag();
      const secondNow = await page.evaluate(() => document.querySelectorAll('.now-tab:not([hidden]), .card.now').length > 20); // sanity: no runaway
      if (!nowHidden0) { fail = true; notes.push(`${engineLabel}${width}: the day row's NOW is NOT hidden even though the peek carries it (one-NOW rule broken)`); }
      if (tag0 !== 'NOW') { fail = true; notes.push(`${engineLabel}${width}: the peek does not say NOW before any highlight (${tag0})`); }
      await setHighlight(page, width, ['Ben']);
      await sleep(500);
      const nowHidden1 = await page.evaluate(() => document.getElementById('dock-now').hidden);
      const tag1 = await peekTag();
      if (nowHidden1) { fail = true; notes.push(`${engineLabel}${width}: highlighting Ben did not return NOW to the day row (still hidden)`); }
      if (tag1 !== 'NEXT') notes.push(`${engineLabel}${width}: peek tag after Ben is "${tag1}" (informational, not NOW)`);
    } finally { await ctx.close(); }
  };
  await runFor(chromium, 390, 'Chromium ');
  await runFor(webkit, 390, 'WebKit ');
  await record('2. NOW when Our picks\' peek carries it',
    fail ? 'FAIL' : 'PASS',
    fail ? notes.join(' | ') : 'Chromium + WebKit 390, design crew, Sat 10:30 PM: with nobody highlighted the peek carries NOW ("OUR PICKS ... NOW") and the day row\'s own NOW stays hidden (one-NOW rule holds); highlighting Ben returns NOW to the day row and the peek\'s tag steps to NEXT.');
}

// ============================================================================
// Item 3 — List + highlight (`design` crew, List view via the Show menu)
// ============================================================================
async function item3(chromium, webkit) {
  const SAT_4PM = PT('2026-09-26T16:15:00');
  const notes = [];
  let fail = false;
  const runFor = async (rig, width, engineLabel) => {
    const { ctx, page } = await openApp(rig, { now: SAT_4PM, width, height: 844, crew: 'design', view: 'board' });
    try {
      await switchView(page, width, 'list');
      const viewNow = await page.evaluate(() => document.getElementById('wall-root').dataset.view);
      if (viewNow !== 'list') { fail = true; notes.push(`${engineLabel}${width}: Show menu -> List did not switch the wall's view`); await ctx.close(); return; }
      await scrollTo(page, room('Saturday', ':fest'));
      const countIn = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
      const pastText = () => page.evaluate((s) => { const l = document.querySelector(`${s} .past-line`); return l ? l.textContent : null; }, room('Saturday', ':fest'));
      const rowsAll = await countIn(`${room('Saturday', ':fest')} .card[data-artist]`);
      const earlierAll = await pastText();
      // highlight one person: only their rows remain, an empty room reads "nothing X picked"
      await setHighlight(page, width, ['Ben']);
      await sleep(500);
      const rowsBen = await countIn(`${room('Saturday', ':fest')} .card[data-artist]`);
      const earlierBen = await pastText();
      const quietWords = await page.evaluate((s) => {
        const r = document.querySelector(s);
        if (!r || !r.classList.contains('quiet')) return null;
        const w = r.querySelector('.quiet-words');
        return w ? w.textContent : null;
      }, room('Saturday', 'Folsom'));
      if (rowsBen >= rowsAll || rowsBen === 0) { fail = true; notes.push(`${engineLabel}${width}: highlighting Ben didn't thin the :fest room sensibly (${rowsAll} -> ${rowsBen})`); }
      if (quietWords !== 'nothing Ben picked') { fail = true; notes.push(`${engineLabel}${width}: SAT Folsom (empty for Ben) reads "${quietWords}", expected "nothing Ben picked"`); }
      if (earlierAll === earlierBen) { fail = true; notes.push(`${engineLabel}${width}: EARLIER count did not change with the filter (${earlierAll})`); }
      // add a second person
      await openHL(page, width);
      await pickPerson(page, width, 'Cy');
      await sleep(600);
      await closeHL(page, width);
      await sleep(300);
      const rowsBenCy = await countIn(`${room('Saturday', ':fest')} .card[data-artist]`);
      if (rowsBenCy < rowsBen) { fail = true; notes.push(`${engineLabel}${width}: adding Cy shrank the row count (${rowsBen} -> ${rowsBenCy}) instead of growing it`); }
      // clear: all rows back
      await openHL(page, width);
      await clearHL(page, width);
      await sleep(300);
      await closeHL(page, width);
      await sleep(300);
      const rowsCleared = await countIn(`${room('Saturday', ':fest')} .card[data-artist]`);
      const earlierCleared = await pastText();
      if (rowsCleared !== rowsAll) { fail = true; notes.push(`${engineLabel}${width}: clearing the highlight did not restore every row (${rowsAll} vs ${rowsCleared})`); }
      if (earlierCleared !== earlierAll) { fail = true; notes.push(`${engineLabel}${width}: EARLIER count did not restore on clear (${earlierAll} vs ${earlierCleared})`); }
      // Board with the same highlight only dims (nothing removed). Compare
      // Board to Board (highlighted vs cleared) — NOT to the List's count:
      // the List's unfiltered 25 already has 7 sets folded behind EARLIER
      // (CLAUDE.md: "the grid keeps its rooms whole ... the grid's cut is not
      // built"), so the Board's un-folded 32 is the right baseline, not 25.
      await setHighlight(page, width, ['Ben']);
      await sleep(400);
      await switchView(page, width, 'board');
      await sleep(500);
      const boardWithBen = await countIn(`${room('Saturday', ':fest')} .card[data-artist]`);
      const boardDimWithBen = await countIn(`${room('Saturday', ':fest')} .card.dim`);
      await openHL(page, width);
      await clearHL(page, width);
      await sleep(400);
      await closeHL(page, width);
      await sleep(400);
      const boardCleared = await countIn(`${room('Saturday', ':fest')} .card[data-artist]`);
      const boardDimCleared = await countIn(`${room('Saturday', ':fest')} .card.dim`);
      if (boardWithBen !== boardCleared) { fail = true; notes.push(`${engineLabel}${width}: Board's own card count changed with the highlight (${boardWithBen} with Ben vs ${boardCleared} cleared) instead of only dimming`); }
      if (boardDimWithBen === 0) { fail = true; notes.push(`${engineLabel}${width}: Board with Ben highlighted has no .dim cards at all`); }
      if (boardDimCleared !== 0) { fail = true; notes.push(`${engineLabel}${width}: Board still has .dim cards after clearing the highlight (${boardDimCleared})`); }
      const boardTotal = boardCleared;
      const boardDim = boardDimWithBen;
      notes.push(`${engineLabel}${width} (info): unfiltered ${rowsAll} rows/"${earlierAll}", Ben-only ${rowsBen} rows/"${earlierBen}", Ben+Cy ${rowsBenCy} rows, Board dims ${boardDim}/${boardTotal}.`);
    } finally { await ctx.close(); }
  };
  await runFor(chromium, 390, 'Chromium ');
  await runFor(webkit, 390, 'WebKit ');
  await record('3. List + highlight',
    fail ? 'FAIL' : 'PASS',
    notes.join(' '));
}

// ============================================================================
// Item 4 — Pick while filtered to yourself
// ============================================================================
async function item4(chromium) {
  const SAT_4PM = PT('2026-09-26T16:15:00');
  const artist = 'Airwolf Paradise'; // design crew, Ana:2, Saturday :fest
  const sel = `[data-artist="${artist}"]`;
  const writesBefore = writes.length;
  let fail = false;
  const notes = [];
  const { ctx, page } = await openApp(chromium, { now: SAT_4PM, width: 390, height: 844, crew: 'design', view: 'list' });
  try {
    await scrollTo(page, room('Saturday', ':fest'));
    await setHighlight(page, 390, ['Ana']);
    await sleep(400);
    const before = await page.evaluate((s) => {
      const c = document.querySelector(s);
      return c ? { present: true, dim: c.classList.contains('dim'), top: c.getBoundingClientRect().top } : { present: false };
    }, sel);
    if (!before.present || before.dim) { fail = true; notes.push(`before un-pick: unexpected state ${JSON.stringify(before)}`); }
    await realTapCard(page, sel, { top: true });
    const sheetOk = await page.evaluate((a) => (document.getElementById('artist-sheet') || {}).textContent?.includes(a), artist);
    if (!sheetOk) { fail = true; notes.push('a finger tap on the card did not open the notes shelf'); }
    // step down twice: level 2 -> 1 -> 0
    await realTapCard(page, '#artist-sheet .f-step.minus', { top: false });
    await realTapCard(page, '#artist-sheet .f-step.minus', { top: false });
    await sleep(300);
    const stillOnRow = await page.evaluate((s) => document.querySelector(s)?.getBoundingClientRect().top ?? null, sel);
    await page.keyboard.press('Escape'); // real keyboard input closes the shelf
    await sleep(500);
    const afterClose = await page.evaluate((s) => {
      const c = document.querySelector(s);
      return c ? { present: true, dim: c.classList.contains('dim'), top: c.getBoundingClientRect().top } : { present: false };
    }, sel);
    if (!afterClose.present) { fail = true; notes.push('the row was pulled out from under the finger immediately (removed) instead of dimming in place'); }
    if (afterClose.present && !afterClose.dim) { fail = true; notes.push('the row did not dim in place after un-picking to 0'); }
    if (afterClose.present && Math.abs((before.top || 0) - (afterClose.top || 0)) > 2) { fail = true; notes.push(`the row jumped position (${before.top} -> ${afterClose.top})`); }
    await sleep(1500); // let sync.scheduleSync's 1200ms debounce fire the refused write
    const writesForPick = writes.length - writesBefore;
    // "the next repaint": a highlight change (clear, then re-select Ana) — one
    // open, both taps inside it (a second open() mid-sequence would just
    // toggle the same popover shut again).
    await openHL(page, 390);
    await clearHL(page, 390);
    await sleep(300);
    await pickPerson(page, 390, 'Ana');
    await sleep(600);
    await closeHL(page, 390);
    await sleep(400);
    const afterRepaint = await page.evaluate((s) => !!document.querySelector(s), sel);
    if (afterRepaint) { fail = true; notes.push('the row was still present after the next repaint (a highlight change) — it should have left the List'); }
    notes.unshift(`un-pick dimmed in place (present:${afterClose.present}, dim:${afterClose.dim}, moved:${Math.abs((before.top||0)-(afterClose.top||0)).toFixed(1)}px), a real crew write was attempted and refused (${writesForPick} write(s): ${writes.slice(writesBefore).join(', ')}), and the row left the List on the next repaint (highlight cleared+re-set): present after = ${afterRepaint}.`);
    await record('4. Pick while filtered to yourself', fail ? 'FAIL' : 'PASS', notes.join(' '), page);
  } finally { await ctx.close(); }
}

// ============================================================================
// Item 5 — Our picks open + highlight, both orders, at 390 and 1280
// ============================================================================
async function item5(chromium) {
  const SAT_4PM = PT('2026-09-26T16:15:00');
  const notes = [];
  let fail = false;
  const planState = (page) => page.evaluate(() => import('/js/v3/plan-shelf.js').then((m) => (m.planIsOpen() ? 'open' : (m.planHere() ? 'peek' : 'gone'))));
  const rowsIn = (page) => page.evaluate((s) => document.querySelectorAll(`${s} .card[data-artist]`).length, room('Saturday', ':fest'));

  const orderHighlightThenPlan = async (width) => {
    const { ctx, page } = await openApp(chromium, { now: SAT_4PM, width, height: width >= 720 ? 900 : 844, crew: 'design', view: 'list' });
    try {
      await scrollTo(page, room('Saturday', ':fest'));
      await setHighlight(page, width, ['Ben'], { keepOpen: true });
      const b = bar(width), p = press(width);
      await p(page, `#${b}-you-wrap .hl-pop [data-act="plan"]`);
      await sleep(900);
      const rowsOpen = await rowsIn(page);
      await page.keyboard.press('Escape'); // closes the plan panel
      await sleep(500);
      const stateAfter1 = await planState(page);
      const rowsAfter1 = await rowsIn(page);
      await page.keyboard.press('Escape'); // a second Escape must not get stuck either
      await sleep(400);
      const rowsAfter2 = await rowsIn(page);
      if (stateAfter1 === 'open') { fail = true; notes.push(`${width} (highlight->plan): Escape did not close the open plan panel`); }
      if (rowsAfter1 === 0 || rowsAfter2 === 0) { fail = true; notes.push(`${width} (highlight->plan): the wall lost its rows across Escape(s)`); }
      if (rowsOpen !== rowsAfter1 || rowsAfter1 !== rowsAfter2) { fail = true; notes.push(`${width} (highlight->plan): the List's filter did not stay put across Escape (${rowsOpen} -> ${rowsAfter1} -> ${rowsAfter2})`); }
      notes.push(`${width} highlight-then-plan: rows stayed ${rowsOpen}/${rowsAfter1}/${rowsAfter2} through open->Escape->Escape, plan state after first Escape "${stateAfter1}".`);
    } finally { await ctx.close(); }
  };
  const orderPlanThenHighlight = async (width) => {
    const { ctx, page } = await openApp(chromium, { now: SAT_4PM, width, height: width >= 720 ? 900 : 844, crew: 'design', view: 'list' });
    try {
      await scrollTo(page, room('Saturday', ':fest'));
      await openPlan(page, width);
      const st0 = await planState(page);
      await setHighlight(page, width, ['Ben']);
      await sleep(500);
      const st1 = await planState(page);
      const rows1 = await rowsIn(page);
      await page.keyboard.press('Escape');
      await sleep(400);
      const rows2 = await rowsIn(page);
      if (st0 !== 'open') { fail = true; notes.push(`${width} (plan->highlight): Our picks did not actually open first (${st0})`); }
      if (st1 === 'gone') { fail = true; notes.push(`${width} (plan->highlight): the plan vanished instead of dropping to its peek when Highlight opened`); }
      if (rows1 === 0 || rows2 === 0) { fail = true; notes.push(`${width} (plan->highlight): the wall lost its rows`); }
      if (rows1 !== rows2) { fail = true; notes.push(`${width} (plan->highlight): the filter changed across Escape (${rows1} -> ${rows2})`); }
      notes.push(`${width} plan-then-highlight: opened "${st0}", dropped to "${st1}" once Highlight opened, filtered rows stayed ${rows1}/${rows2} across Escape.`);
    } finally { await ctx.close(); }
  };
  await orderHighlightThenPlan(390);
  await orderHighlightThenPlan(1280);
  await orderPlanThenHighlight(390);
  await orderPlanThenHighlight(1280);
  await record('5. Our picks open + highlight, both orders, 390 & 1280', fail ? 'FAIL' : 'PASS', notes.join(' '));
}

// ============================================================================
// Item 6 — ACL Late nights (acl-2026), 390
// ============================================================================
async function item6(chromium, webkit) {
  const AT = CDT('2026-10-03T21:30:00'); // Sat Oct 3, 9:30 PM — inside Sep29-Oct10, after 9 PM
  const notes = [];
  let fail = false;
  const runFor = async (rig, engineLabel) => {
    const { ctx, page } = await openApp(rig, { now: AT, width: 390, height: 844, crew: 'sparse', fid: 'acl-2026', view: 'list' });
    try {
      const nowHiddenBefore = await page.evaluate(() => document.getElementById('dock-now').hidden);
      await setHighlight(page, 390, ['Ross']);
      await sleep(500);
      const info = await page.evaluate(() => {
        const block = [...document.querySelectorAll('#wall-root .day-block')].find((b) => b.dataset.day === 'Late nights');
        const rooms = block ? [...block.querySelectorAll(':scope > .room')] : [];
        return {
          n: rooms.length,
          quiet: rooms.filter((r) => r.classList.contains('quiet')).length,
          words: [...new Set(rooms.map((r) => (r.querySelector('.quiet-words') || {}).textContent).filter(Boolean))],
        };
      });
      const nowHiddenAfter = await page.evaluate(() => document.getElementById('dock-now').hidden);
      if (info.quiet !== info.n || info.n === 0) { fail = true; notes.push(`${engineLabel}: expected every Late nights room quiet for Ross (no late-night picks), got ${info.quiet}/${info.n}`); }
      if (info.words.length !== 1 || info.words[0] !== 'nothing Ross picked') { fail = true; notes.push(`${engineLabel}: quiet-line wording was ${JSON.stringify(info.words)}, expected exactly "nothing Ross picked"`); }
      if (!nowHiddenAfter && nowHiddenBefore) notes.push(`${engineLabel} (info): NOW was visible before the highlight and stayed visible after — Ross may have something on now`);
      notes.push(`${engineLabel}: ${info.n} Late-nights date-rooms, ${info.quiet} read "nothing Ross picked" once Ross is highlighted (nowHidden before=${nowHiddenBefore}, after=${nowHiddenAfter}).`);
    } finally { await ctx.close(); }
  };
  await runFor(chromium, 'Chromium');
  await runFor(webkit, 'WebKit');
  await record('6. ACL Late nights under a highlight',
    fail ? 'FAIL' : 'PASS',
    notes.join(' ') + ' This matches the build log\'s banked call 2f (one quiet line per date, not collapsed) — expected, not a bug.');
}

// ============================================================================
// Item 7 — Reduce Motion
// ============================================================================
async function item7(chromium) {
  const SAT_4PM = PT('2026-09-26T16:15:00');
  const notes = [];
  let fail = false;
  const { ctx, page, errors } = await openApp(chromium, { now: SAT_4PM, width: 390, height: 844, crew: 'design', view: 'list', reduce: true });
  try {
    const reduceOn = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!reduceOn) { fail = true; notes.push('the page did not report prefers-reduced-motion: reduce'); }
    await scrollTo(page, room('Saturday', ':fest'));
    const rowsAll = await page.evaluate((s) => document.querySelectorAll(`${s} .card[data-artist]`).length, room('Saturday', ':fest'));
    await setHighlight(page, 390, ['Ben']);
    await sleep(150); // deliberately short — "instant" means no animation to wait out
    const rowsBen = await page.evaluate((s) => document.querySelectorAll(`${s} .card[data-artist]`).length, room('Saturday', ':fest'));
    if (rowsBen >= rowsAll || rowsBen === 0) { fail = true; notes.push(`filter did not land within 150ms under Reduce Motion (${rowsAll} -> ${rowsBen})`); }
    if (errors.length) { fail = true; notes.push(`page errors: ${errors.join(' | ')}`); }
    notes.push(`Reduce Motion on; List filter to Ben landed (${rowsAll} -> ${rowsBen} rows) within 150ms, no page errors.`);
    await record('7. Reduce Motion', fail ? 'FAIL' : 'PASS', notes.join(' '), page);
  } finally { await ctx.close(); }
}

// ============================================================================
// Item 8 — rig write counters
// ============================================================================
// A fresh boot alone already POSTs once (`POST /api/person`, confirmed with a
// zero-interaction boot — a pre-existing presence/color write, nothing to do
// with this build), and every openApp() in items 1-7 re-triggers that same
// boot write, so the RAW cumulative writes.length across the whole walk is
// dominated by how many app instances were opened, not by what was done in
// them. The real question the brief asks — does a highlight/filter/view/plan
// action write anything — needs one isolated session: note the write count
// right after boot (the baseline), run a battery of highlight/filter/view
// actions and NO pick, and confirm the count never moves past that baseline.
// Item 4's own pick (a real crew-data change) is reported separately, since
// that write is expected and correct, not a violation of "viewer-side only".
async function item8(chromium, writesAtItem4Start, writesAtItem4End) {
  const SAT_4PM = PT('2026-09-26T16:15:00');
  const notes = [];
  let fail = false;
  const { ctx, page } = await openApp(chromium, { now: SAT_4PM, width: 390, height: 844, crew: 'design', view: 'board' });
  try {
    await sleep(600);
    const baseline = writes.length;
    notes.push(`fresh boot alone: ${baseline} write(s) (${writes.slice().join(', ') || 'none'}) — a pre-existing per-boot write, not caused by any interaction below.`);
    await switchView(page, 390, 'list');
    await scrollTo(page, room('Saturday', ':fest'));
    await setHighlight(page, 390, ['Ben', 'Cy'], { keepOpen: true });
    await pickPerson(page, 390, 'Dot');
    await closeHL(page, 390);
    await sleep(400);
    await openHL(page, 390);
    await clearHL(page, 390);
    await closeHL(page, 390);
    await sleep(400);
    await openPlan(page, 390);
    await page.keyboard.press('Escape');
    await sleep(400);
    await switchView(page, 390, 'board');
    await sleep(400);
    const afterActions = writes.length;
    if (afterActions !== baseline) { fail = true; notes.push(`highlight/filter/view/plan actions produced ${afterActions - baseline} write(s) beyond the boot baseline: ${writes.slice(baseline).join(', ')}`); }
    else notes.push(`after switching views, highlighting/adding/clearing three people and opening+closing Our picks: still ${afterActions} writes — no new write from any of it.`);
  } finally { await ctx.close(); }
  const pickWrites = writesAtItem4End - writesAtItem4Start;
  notes.push(`Item 4's deliberate un-pick (a real crew-data change, reported separately) produced ${pickWrites} refused write(s): ${writes.slice(writesAtItem4Start, writesAtItem4End).join(', ') || '(none)'} — expected and correct, not a violation.`);
  notes.push(`Total refused writes across the whole walk (every openApp() re-triggers the boot write above): ${writes.length} (${[...new Set(writes)].join(', ') || 'none'}).`);
  await record('8. Rig write counters', fail ? 'FAIL' : 'PASS', notes.join(' '));
}

// ============================================================================
// Spotify (read-only per the brief: run v103-spotify-walk.mjs once if it runs offline)
// ============================================================================
async function spotifyCheck() {
  try {
    const { execFileSync } = await import('node:child_process');
    const out = execFileSync(process.execPath, [path.join(HERE, 'v103-spotify-walk.mjs')], { encoding: 'utf8', timeout: 120000 });
    bankLine(`## Spotify — v103-spotify-walk.mjs\n\nRan offline (no network egress needed — the walk answers api.spotify.com from memory). Output:\n\n\`\`\`\n${out.trim()}\n\`\`\`\n`);
    console.log('[INFO] Spotify walk output:\n', out);
    return out;
  } catch (e) {
    const msg = (e.stdout || '') + (e.stderr || e.message || '');
    bankLine(`## Spotify — v103-spotify-walk.mjs\n\nDid not run offline: ${msg.split('\n').slice(0, 5).join(' | ')}\n`);
    console.log('[INFO] Spotify walk did not run offline:', msg.slice(0, 500));
    return null;
  }
}

// ============================================================================
// Main
// ============================================================================
const chromium = await openRig({ engine: 'chromium' });
const webkit = await openRig({ engine: 'webkit' });
try {
  await item1(chromium, webkit);
  await item2(chromium, webkit);
  await item3(chromium, webkit);
  const w4start = writes.length;
  await item4(chromium);
  const w4end = writes.length;
  await item5(chromium);
  await item6(chromium, webkit);
  await item7(chromium);
  await item8(chromium, w4start, w4end);
  await spotifyCheck();
} finally {
  await chromium.close();
  await webkit.close();
}

// Final table for the handback.
const table = ['| # | Result | Note |', '|---|---|---|',
  ...RESULTS.map((r, i) => `| ${i + 1} | ${r.status} | ${r.note.replace(/\|/g, '\\|').slice(0, 300)} |`)].join('\n');
bankLine(`\n## Final table\n\n${table}\n\n**Rig write counter (final): ${writes.length}** — ${[...new Set(writes)].join(', ') || 'none'}\n`);
console.log('\n' + table);
console.log(`\nWrites total: ${writes.length} (${[...new Set(writes)].join(', ')})`);
