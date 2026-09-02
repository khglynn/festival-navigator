// Detached real-input walk of the card zoom (PR #14 checklist). Headless system
// Chrome, real mouse/keyboard events through Playwright's input layer — never
// element.click(). Usage: TOKEN=<crew token> node walk-zoom.cjs <label> <entryUrl>
// The entry URL may be a Vercel share link (sets the auth cookie) or a plain origin.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [label, entry] = process.argv.slice(2);
const TOKEN = process.env.TOKEN;
if (!label || !entry || !TOKEN) { console.error('usage: TOKEN=… node walk-zoom.cjs <label> <entryUrl>'); process.exit(2); }
const out = path.join(__dirname, `report-zoom-${label}.md`);
const lines = [`# Zoom walk — ${label} — ${new Date().toISOString()}`, ''];
const bank = (s) => { lines.push(s); fs.writeFileSync(out, lines.join('\n') + '\n'); console.log(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A fresh profile lands on the JOIN screen ("Tap your name, or add yourself"):
// the names are button.fest-row (text "AAvathis link is yours"); tapping one
// enters the app. Fallback: type the name and press Join.
async function joinIfNeeded(pg, who = 'Ava') {
  const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleepMs(3000);
  const onJoin = () => pg.evaluate(() => { const s = document.getElementById('screen-join'); return !!(s && s.getBoundingClientRect().height > 0); });
  if (await onJoin()) {
    const row = await pg.evaluate((who) => { const e = [...document.querySelectorAll('#screen-join button.fest-row')].find((b) => (b.textContent || '').includes(who)); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, who);
    if (row) { if (pg.touchscreen && (await pg.evaluate(() => matchMedia('(pointer: coarse)').matches))) await pg.touchscreen.tap(row.x, row.y); else await pg.mouse.click(row.x, row.y); await sleepMs(3000); }
  }
  if (await onJoin()) {
    const input = await pg.evaluate(() => { const e = document.getElementById('join-name-input'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (input) { await pg.mouse.click(input.x, input.y); await pg.keyboard.type(who); await sleepMs(300); const btn = await pg.evaluate(() => { const e = document.getElementById('join-add-btn'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await pg.mouse.click(btn.x, btn.y); await sleepMs(2500); }
  }
  await pg.waitForSelector('.card', { timeout: 25000 });
}


(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));

  await page.goto(entry, { waitUntil: 'load' });
  await sleep(1500);
  const origin = new URL(page.url()).origin;
  bank(`origin: ${origin}`);
  await page.goto(`${origin}/#g=${TOKEN}&f=portola-2026&me=Ava`, { waitUntil: 'load' });
  await joinIfNeeded(page);
  await sleep(2500); // let sync settle
  const sw = await page.evaluate(() => fetch('/service-worker.js').then((r) => r.text()).then((t) => (t.match(/festival-nav-v\d+/) || [''])[0]));
  bank(`build: ${sw}`);

  const slots = () => page.evaluate(() => document.querySelectorAll('#zoom-layer .zoom-slot').length);
  const shown = () => page.evaluate(() => document.querySelectorAll('#zoom-layer .zoom-slot.shown').length);
  const youPill = () => page.evaluate(() => !!document.querySelector('#zoom-layer .zoom-card .f-who .f-pill.you'));
  const center = async (sel, i = 0) => {
    const box = await page.evaluate(({ sel, i }) => { const el = document.querySelectorAll(sel)[i]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top }; }, { sel, i });
    return box;
  };
  // A visible resting card in the middle of the viewport (avoid edges).
  const pickCard = async () => page.evaluate(() => {
    const cards = [...document.querySelectorAll('.card')].filter((c) => { const r = c.getBoundingClientRect(); return r.top > 120 && r.bottom < window.innerHeight - 120 && r.width > 80; });
    const c = cards[Math.min(3, cards.length - 1)];
    if (!c) return null;
    c.setAttribute('data-walk', '1');
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, name: (c.querySelector('.name') || {}).textContent };
  });
  const away = async () => { await page.mouse.move(1400, 60); await page.mouse.move(1420, 40); };
  const cycleClear = async (x, y) => { for (let k = 0; k < 6; k++) { if (!(await youPill())) return k; await page.mouse.click(x, y); await sleep(450); } return -1; };

  // 1 — hover grows, leave closes clean
  try {
    const c = await pickCard(); bank(`card under test: ${c.name}`);
    await page.mouse.move(c.x, c.y); await sleep(450);
    const t0 = Date.now(); const open = await shown(); const src = await page.evaluate(() => !!document.querySelector('.card[data-walk].zoom-source'));
    await away(); let closedAt = null; for (let k = 0; k < 20; k++) { await sleep(50); if ((await slots()) === 0) { closedAt = Date.now() - t0; break; } }
    bank(`1. hover→grow: shown=${open} zoom-source=${src}; leave→closed in ${closedAt}ms, slots left=${await slots()} → ${open === 1 && src && closedAt !== null ? 'PASS' : 'FAIL'}`);
  } catch (e) { bank(`1. ERROR ${e.message}`); }

  // 2 — click on the grown overlay picks and the zoom stays
  try {
    const c = await pickCard();
    await page.mouse.move(c.x, c.y); await sleep(450);
    const before = await youPill();
    const z = await center('#zoom-layer .zoom-slot.shown .zoom-card');
    await page.mouse.click(z.x, z.y); await sleep(500);
    const stillOpen = await shown(); const picked = await youPill();
    await page.mouse.click(z.x, z.y); await sleep(450); const open2 = await shown();
    const cleared = await cycleClear(z.x, z.y);
    await away(); await sleep(600);
    bank(`2. click-on-overlay: youPill before=${before} after=${picked}; zoom open after click=${stillOpen} after 2nd=${open2}; cycled back in ${cleared} clicks; closed after leave: slots=${await slots()} → ${stillOpen === 1 && picked && open2 === 1 && cleared >= 0 ? 'PASS' : 'FAIL'}`);
  } catch (e) { bank(`2. ERROR ${e.message}`); }

  // 3 — wheel scroll follows
  try {
    const c = await pickCard();
    await page.mouse.move(c.x, c.y); await sleep(450);
    const b0 = await center('#zoom-layer .zoom-slot.shown');
    await page.mouse.wheel(0, 120); await sleep(400);
    const b1 = await center('#zoom-layer .zoom-slot.shown');
    const open = await shown();
    bank(`3. wheel 120px: open=${open} overlay top ${b0 && b0.top.toFixed(0)}→${b1 && b1.top.toFixed(0)} (Δ${b0 && b1 ? (b1.top - b0.top).toFixed(0) : 'n/a'}) → ${open === 1 && b0 && b1 && Math.abs((b1.top - b0.top) + 120) < 40 ? 'PASS' : 'FAIL'}`);
    await away(); await sleep(600); await page.mouse.wheel(0, -120); await sleep(300);
  } catch (e) { bank(`3. ERROR ${e.message}`); }

  // 4 — keyboard route
  try {
    await away(); await page.mouse.click(1420, 40); await sleep(300);
    let presses = 0, onCard = false;
    for (; presses < 80; presses++) { await page.keyboard.press('Tab'); await sleep(60); onCard = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('card')); if (onCard) break; }
    await sleep(500);
    const grew = await shown();
    await page.keyboard.press('Tab'); await sleep(250);
    const onChip = await page.evaluate(() => { const a = document.activeElement; return !!(a && a.matches('#zoom-layer button.f-chip.notes')); });
    const openAfterTab = await shown();
    await page.keyboard.press('Shift+Tab'); await sleep(250);
    const backOnCard = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('card'));
    const openAfterBack = await shown();
    await page.keyboard.press('Tab'); await sleep(150); await page.keyboard.press('Tab'); await sleep(400);
    const closed = await shown();
    const landed = await page.evaluate(() => { const a = document.activeElement; if (!a) return 'none'; const r = a.getBoundingClientRect(); const cs = getComputedStyle(a); return `${a.tagName.toLowerCase()}.${[...a.classList].join('.')} "${(a.textContent || '').trim().slice(0, 30)}" opacity=${cs.opacity} visible=${r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'} inCard=${!!a.closest('.card')}`; });
    bank(`4. keyboard: ${presses + 1} Tabs to a card; grew=${grew}; Tab→chip=${onChip} (open=${openAfterTab}); Shift+Tab→card=${backOnCard} (open=${openAfterBack}); Tab,Tab→closed=${closed === 0}; focus landed on ${landed} → ${onCard && grew === 1 && onChip && backOnCard && closed === 0 ? 'PASS' : 'FAIL'}`);
    await page.mouse.click(1420, 40); await sleep(300);
  } catch (e) { bank(`4. ERROR ${e.message}`); }

  // 5 — Escape, then re-arm on re-enter
  try {
    const c = await pickCard();
    await page.mouse.move(c.x, c.y); await sleep(450);
    await page.keyboard.press('Escape'); await sleep(350);
    const closed = await shown();
    await page.mouse.move(c.x + 3, c.y + 2); await sleep(500); const stillClosed = await shown();
    await away(); await sleep(400); await page.mouse.move(c.x, c.y); await sleep(500); const reopened = await shown();
    bank(`5. escape: closed=${closed === 0}; jiggle inside stays closed=${stillClosed === 0}; leave+re-enter reopens=${reopened === 1} → ${closed === 0 && stillClosed === 0 && reopened === 1 ? 'PASS' : 'FAIL'}`);
    await away(); await sleep(600);
  } catch (e) { bank(`5. ERROR ${e.message}`); }

  // 6 — the map door inside an afters overlay
  try {
    const tab = await page.evaluate(() => { const els = [...document.querySelectorAll('button, [role=tab], a')].filter((e) => /^afters$/i.test((e.textContent || '').trim())); const e = els[0]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (tab) { await page.mouse.click(tab.x, tab.y); await sleep(1200); }
    const found = await page.evaluate(() => { const cards = [...document.querySelectorAll('.card')].filter((c) => { const r = c.getBoundingClientRect(); return r.top > 120 && r.bottom < innerHeight - 120; }); const c = cards[0]; if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, name: (c.querySelector('.name') || {}).textContent }; });
    if (!found) { bank('6. map door: SKIP (no afters card reachable — tab not found)'); }
    else {
      await page.mouse.move(found.x, found.y); await sleep(500);
      const door = await center('#zoom-layer .zoom-card a.f-where');
      if (!door) bank(`6. map door: SKIP (overlay for ${found.name} has no venue link)`);
      else {
        const pillBefore = await youPill();
        const popup = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
        await page.mouse.click(door.x, door.y); await sleep(600);
        const p = await popup; const pillAfter = await youPill();
        if (p) await p.close();
        bank(`6. map door (${found.name}): new tab opened=${!!p}; picked by the click=${!pillBefore && pillAfter} → ${p && !(!pillBefore && pillAfter) ? 'PASS' : 'FAIL'}`);
      }
      await away(); await sleep(600);
    }
  } catch (e) { bank(`6. ERROR ${e.message}`); }

  // 7 — notes chip opens the sheet and the zoom closes
  try {
    const c = await pickCard();
    await page.mouse.move(c.x, c.y); await sleep(450);
    const chip = await center('#zoom-layer .zoom-card button.f-chip.notes');
    await page.mouse.click(chip.x, chip.y); await sleep(700);
    const sheet = await page.evaluate(() => !!document.querySelector('.sheet-card'));
    const open = await shown();
    bank(`7. notes chip: sheet open=${sheet}; zoom closed=${open === 0} → ${sheet && open === 0 ? 'PASS' : 'FAIL'}`);
    const close = await center('.sheet-close'); if (close) { await page.mouse.click(close.x, close.y); } else { await page.keyboard.press('Escape'); }
    await sleep(600);
  } catch (e) { bank(`7. ERROR ${e.message}`); }

  // 8 — skim across cards
  try {
    const pts = await page.evaluate(() => [...document.querySelectorAll('.card')].filter((c) => { const r = c.getBoundingClientRect(); return r.top > 120 && r.bottom < innerHeight - 120; }).slice(0, 8).map((c) => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
    let maxOpen = 0;
    for (const p of pts) { await page.mouse.move(p.x, p.y); await sleep(30); maxOpen = Math.max(maxOpen, await shown()); }
    await away(); await sleep(700);
    bank(`8. skim ${pts.length} cards: max simultaneous shown=${maxOpen}; slots after pause=${await slots()} → ${maxOpen <= 1 && (await slots()) === 0 ? 'PASS' : 'FAIL'}`);
  } catch (e) { bank(`8. ERROR ${e.message}`); }

  // 9 — console
  bank(`9. console errors/warnings (${consoleErrors.length}): ${consoleErrors.slice(0, 8).join(' | ') || 'none'}`);

  // 10 — phone: long press grows, the lift does not pick, the next tap does
  try {
    const { devices } = require('playwright'); const mctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
    const mp = await mctx.newPage();
    await mp.goto(`${origin}/#g=${TOKEN}&f=portola-2026&me=Ava`, { waitUntil: 'load' });
    await joinIfNeeded(mp); await sleep(2000);
    const c = await mp.evaluate(() => { const cards = [...document.querySelectorAll('.card')].filter((c) => { const r = c.getBoundingClientRect(); return r.top > 140 && r.bottom < innerHeight - 140; }); const el = cards[1] || cards[0]; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, name: (el.querySelector('.name') || {}).textContent }; });
    const cdp = await mctx.newCDPSession(mp);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
    await sleep(650);
    const grewDuringHold = await mp.evaluate(() => document.querySelectorAll('#zoom-layer .zoom-slot.shown').length);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(500);
    const pillAfterLift = await mp.evaluate(() => !!document.querySelector('#zoom-layer .zoom-card .f-who .f-pill.you'));
    const openAfterLift = await mp.evaluate(() => document.querySelectorAll('#zoom-layer .zoom-slot.shown').length);
    const z = await mp.evaluate(() => { const el = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    let pickedByTap = null;
    if (z) { await mp.touchscreen.tap(z.x, z.y); await sleep(500); pickedByTap = await mp.evaluate(() => !!document.querySelector('#zoom-layer .zoom-card .f-who .f-pill.you')); for (let k = 0; k < 6 && (await mp.evaluate(() => !!document.querySelector('#zoom-layer .zoom-card .f-who .f-pill.you'))); k++) { await mp.touchscreen.tap(z.x, z.y); await sleep(450); } }
    bank(`10. phone (${c.name}): grew during hold=${grewDuringHold === 1}; lift picked=${pillAfterLift} (open after lift=${openAfterLift}); next tap picked=${pickedByTap} → ${grewDuringHold === 1 && !pillAfterLift && pickedByTap ? 'PASS' : 'FAIL'}`);
    await mctx.close();
  } catch (e) { bank(`10. ERROR ${e.message}`); }

  bank(''); bank('FINISHED');
  await browser.close();
})().catch((e) => { bank(`FATAL ${e.stack || e}`); process.exit(1); });
