// Walk the canvas with real input in ONE headless Chromium, then close it.
//   PW=… OUT=… node checks/walk.mjs desk|phone
// desk: 1280, a mouse. phone: 390, touch (CDP touch events, so a hold is a
// real hold). Screenshots go to OUT; prints console errors and measurements.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || 'playwright');
const HERE = new URL('..', import.meta.url).pathname;
const OUT = process.env.OUT || '/tmp';
const mode = process.argv[2] || 'desk';
const phone = mode === 'phone';
const log = (...a) => console.log(...a);

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: phone ? 390 : 1280, height: phone ? 844 : 900 }, hasTouch: phone, isMobile: phone });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`file://${HERE}canvas.html`);
  await page.evaluate(() => document.fonts.ready);
  // A selector shoots that element (scrolled into view); nothing shoots the viewport.
  const shot = async (name, sel) => { const f = `${OUT}/${mode}-${name}.png`; if (sel) await page.locator(sel).first().screenshot({ path: f }); else await page.screenshot({ path: f }); log('shot', f); };
  const boxOf = async (sel) => page.locator(sel).first().boundingBox();
  const cdp = phone ? await ctx.newCDPSession(page) : null;
  // On a phone every press is a tap: a mouse click in a touch context makes
  // Chromium believe a mouse exists, and the zoom then arms on hover.
  const press = (sel) => (phone ? page.tap(sel) : page.click(sel));
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const hold = async (sel) => {
    const b = await boxOf(sel);
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await touch('touchStart', x, y);
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(50); if (await page.evaluate(() => !!document.querySelector('#zoom-layer .zoom-slot'))) break; }
    await touch('touchEnd', x, y);
    return { x, y };
  };

  // 1. The zoom on a direction-A card, then a pick while zoomed.
  const aSel = phone ? '#dir-a .vp.app' : '#desk-a .vp.app';
  await page.locator(aSel).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const card = `${aSel} .card[data-artist="Boys Go To Jupiter"]`;
  if (phone) await hold(card); else { await page.hover(card); await page.waitForTimeout(700); }
  await page.waitForTimeout(500);
  log('zoom open:', await page.evaluate(() => { const z = document.querySelector('#zoom-layer .zoom-card'); return z ? [...z.querySelectorAll('.f-name, .f-bill, .f-sub, .f-where, .f-buy, .f-past, .f-chip')].map((n) => n.textContent.trim()) : null; }));
  await shot('1-zoom');
  const zc = await boxOf('#zoom-layer .zoom-card');
  if (zc) {
    if (phone) await page.touchscreen.tap(zc.x + zc.width / 2, zc.y + 18);
    else await page.mouse.click(zc.x + zc.width / 2, zc.y + 18);
    await page.waitForTimeout(600);
    log('after pick, level:', await page.evaluate(() => window.__canvas.levelOf('Boys Go To Jupiter')));
    await shot('2-picked');
  }
  if (phone) await page.touchscreen.tap(5, 5); else await page.mouse.click(5, 5);
  await page.waitForTimeout(300);
  log('zoom closed by a press outside:', await page.evaluate(() => !window.FN.facts.zoomedCard()));

  // 2. B: a match lands (slow motion, caught mid-flight).
  await page.locator('#dir-b').scrollIntoViewIfNeeded();
  await press('#cv-slow');
  await press('[data-replay="B"]');
  for (const t of [300, 1500, 2600, 3400]) { await page.waitForTimeout(t === 300 ? 300 : t - [300, 1500, 2600, 3400][[300, 1500, 2600, 3400].indexOf(t) - 1]); await shot(`3-replay-${t}`, '#dir-b .cv-board'); }
  await press('#cv-slow');
  await page.waitForTimeout(1500);
  log('B tabs:', await page.evaluate(() => [...document.querySelectorAll('#dir-b [data-id="dock-days"] .day-tab')].map((t) => t.textContent + (t.classList.contains('active') ? '*' : ''))));

  // 3. B drawn as one list.
  await press('[data-yours="list"]');
  await page.waitForTimeout(500);
  await shot('4-yours-list', '#dir-b .cv-board');
  await press('[data-yours="rooms"]');

  // 4. Pretend it is Fri Oct 16.
  await press('[data-clock="2026-10-16"]');
  await page.waitForTimeout(700);
  log('A opens at:', await page.evaluate(() => { const f = window.__canvas.frames.find((x) => x.dir === 'A' && x.scope === 'phone'); const rooms = [...f.root.querySelectorAll('.room')]; const top = rooms.find((r) => r.getBoundingClientRect().top >= f.scroller.getBoundingClientRect().top - 2); return { scrollTop: f.scroller.scrollTop, first: top && top.querySelector('.room-head').textContent }; }));
  await page.locator('#dir-a').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot('5-oct16-a', '#dir-a .cv-board');
  await shot('5-oct16-c', '#dir-c .cv-board');
  log('C tabs Oct 16:', await page.evaluate(() => [...document.querySelectorAll('#dir-c [data-id="dock-days"] .day-tab')].map((t) => t.textContent)));
  await press('[data-clock="2026-09-24"]');
  await page.waitForTimeout(500);

  // 5. The rooms filter: untick Brushy Street (any zoom put away first).
  await page.evaluate(() => { if (window.FN.facts.zoomedCard()) window.FN.facts.unzoom({ instant: true, why: 'walk' }); });
  const fSel = phone ? '#cover .cv-board.is-phone' : '#cover .cv-board.is-desk';
  await page.locator(fSel).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const row = page.locator(`${fSel} .rooms-pop [role="option"]`).filter({ hasText: 'Brushy Street' });
  // A tap is page.touchscreen.tap (a CDP touchStart+touchEnd pair sent back
  // to back did not always become a click); a hold is the CDP pair with time between.
  if (phone) { const b = await row.boundingBox(); await page.touchscreen.tap(b.x + 40, b.y + b.height / 2); } else await row.click();
  await page.waitForTimeout(900);
  log('Brushy stacks left:', await page.evaluate((s) => [...document.querySelectorAll(`${s} .venue-group .stage-head .label`)].filter((l) => l.textContent === 'Brushy Street').length, fSel));
  await shot('6-filter', fSel);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  log('page overflow px:', overflow);
  log(errors.length ? errors.join('\n') : 'no console errors');
} finally {
  await browser.close();
}
