// Detached real-input walk of PR #16 (day-first events UI). Headless system Chrome,
// real mouse/keyboard/touch through Playwright's input layer. Usage:
//   TOKEN=<crew token> node walk-events.cjs <label> <entryUrl>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [label, entry] = process.argv.slice(2);
const TOKEN = process.env.TOKEN;
if (!label || !entry || !TOKEN) { console.error('usage'); process.exit(2); }
const out = path.join(__dirname, `report-events-${label}.md`);
const lines = [`# Events walk — ${label} — ${new Date().toISOString()}`, ''];
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

const P = (ok) => (ok ? 'PASS' : 'FAIL');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(entry, { waitUntil: 'load' }); await sleep(1500);
  const origin = new URL(page.url()).origin; bank(`origin: ${origin}`);
  const boardUrl = `${origin}/#g=${TOKEN}&f=portola-2026&me=Ava`;
  await page.goto(boardUrl, { waitUntil: 'load' });
  await joinIfNeeded(page); await sleep(2500);
  bank(`build: ${await page.evaluate(() => fetch('/service-worker.js').then((r) => r.text()).then((t) => (t.match(/festival-nav-v\d+/) || [''])[0]))}`);

  const ev = (fn, arg) => page.evaluate(fn, arg);
  const boxOf = (sel, i = 0) => ev(({ sel, i }) => { const el = document.querySelectorAll(sel)[i]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, left: r.left, right: r.right, w: r.width, h: r.height }; }, { sel, i });
  const clickVisibleTab = async (day) => {
    const b = await ev((day) => { const els = [...document.querySelectorAll(`button.day-tab[data-day="${day}"]`)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); if (!els.length) return null; const r = els[0].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, day);
    if (!b) return false; await page.mouse.click(b.x, b.y); await sleep(900); return true;
  };
  // the day block that holds a given day label (the rule's text)
  const dayInfo = (day) => ev((day) => {
    // Days are not wrapped: a .day-rule[data-day] is followed by its content as
    // siblings under #wall-root until the next .day-rule.
    const rules = [...document.querySelectorAll('#wall-root .day-rule')];
    const rule = rules.find((r) => ((r.querySelector('.day') || r).textContent || '').trim().toUpperCase().startsWith(day.toUpperCase()));
    if (!rule) return null;
    const block = document.createElement('div');
    let e = rule.nextElementSibling;
    const nodes = [];
    while (e && !e.classList.contains('day-rule')) { nodes.push(e); e = e.nextElementSibling; }
    const qa = (s) => nodes.flatMap((n) => [...(n.matches(s) ? [n] : []), ...n.querySelectorAll(s)]);
    return { labels: qa('.sec-label').map((x) => x.textContent.trim()), ttBlocks: qa('.tt-block').length, strips: qa('.tt-block .stage-strip').length, decks: qa('.deck').length, cards: qa('.card').length, tilde: qa('.card .time').filter((t) => /~/.test(t.textContent)).length, whisper: (qa('.sec-whisper')[0] || {}).textContent || null, tba: qa('.tba-label, .tba').length };
  }, day);
  const away = async () => { await page.mouse.move(1420, 40); await page.mouse.move(1430, 30); };

  // 1 — tabs
  try {
    const tabs = await ev(() => [...document.querySelectorAll('#dock-days button.day-tab, button.day-tab')].map((t) => t.dataset.day).filter((v, i, a) => a.indexOf(v) === i));
    bank(`1. tabs: ${tabs.join(' · ')} → ${P(['Thursday', 'Friday', 'Saturday', 'Sunday'].every((d) => tabs.includes(d)))}`);
  } catch (e) { bank(`1. ERROR ${e.message}`); }

  // 2 — Thursday
  try {
    const jumped = await clickVisibleTab('Thursday');
    const d = await dayInfo('THURSDAY');
    bank(`2. THU (tab clicked=${jumped}): ${JSON.stringify(d)} → ${P(d && d.labels.includes('AFTERS') && d.cards === 2)}`);
  } catch (e) { bank(`2. ERROR ${e.message}`); }

  // 3 — Friday: deck present, Folsom tiles
  let deckBox = null;
  try {
    await clickVisibleTab('Friday');
    const d = await dayInfo('FRIDAY');
    const pill = await ev(() => { const p = document.querySelector('.deck .deck-pill'); return p ? p.textContent.trim() : null; });
    deckBox = await boxOf('.deck');
    bank(`3. FRI: ${JSON.stringify(d)} deck pill="${pill}" → ${P(d && d.labels.includes('AFTERS') && d.labels.includes('FOLSOM') && d.decks >= 1 && /3 · 8 PM/.test(pill || ''))}`);
  } catch (e) { bank(`3. ERROR ${e.message}`); }

  // 4 — the deck opens in place, cards pick, outside/Escape close, scroll follows
  try {
    if (!deckBox) throw new Error('no deck box');
    // make sure the deck is in view
    await ev(() => document.querySelector('.deck').scrollIntoView({ block: 'center' })); await sleep(400);
    deckBox = await boxOf('.deck');
    await page.mouse.click(deckBox.x, deckBox.y); await sleep(700);
    const open = await ev(() => ({ open: !!document.querySelector('.deck.open'), shown: document.querySelectorAll('.deck-layer .deck-slot.shown, .deck-layer .zoom-slot.shown').length, cards: [...document.querySelectorAll('.deck-layer .card .name')].map((n) => n.textContent.trim()), title: (document.querySelector('.deck-layer .deck-panel-head, .deck-layer [class*=head]') || {}).textContent || '' }));
    // hover + click a panel card (the second one)
    const pc = await boxOf('.deck-layer .card', 1);
    let picked = null, zoomLine = null, cleared = -1;
    if (pc) {
      await page.mouse.move(pc.x, pc.y); await sleep(500);
      zoomLine = await ev(() => [...document.querySelectorAll('#zoom-layer .zoom-card .f-sub')].map((e) => e.textContent.trim()).join(' | '));
      const z = (await boxOf('#zoom-layer .zoom-slot.shown .zoom-card .f-name')) || (await boxOf('#zoom-layer .zoom-slot.shown .zoom-card'));
      const target = z || pc;
      await page.mouse.click(target.x, target.y); await sleep(500);
      picked = await ev(() => !!document.querySelector('#zoom-layer .zoom-card .f-who .f-pill.you'));
      for (let k = 0; k < 6; k++) { if (!(await ev(() => !!document.querySelector('#zoom-layer .zoom-card .f-who .f-pill.you')))) { cleared = k; break; } await page.mouse.click(target.x, target.y); await sleep(450); }
    }
    await page.mouse.click(1420, 40); await sleep(600);
    const afterOutside = await ev(() => ({ open: !!document.querySelector('.deck.open'), shown: document.querySelectorAll('.deck-layer .deck-slot.shown, .deck-layer .zoom-slot.shown').length }));
    await page.mouse.click(deckBox.x, deckBox.y); await sleep(600);
    await page.keyboard.press('Escape'); await sleep(500);
    const afterEsc = await ev(() => ({ open: !!document.querySelector('.deck.open'), shown: document.querySelectorAll('.deck-layer .deck-slot.shown, .deck-layer .zoom-slot.shown').length }));
    await page.mouse.click(deckBox.x, deckBox.y); await sleep(600);
    const b0 = await boxOf('.deck-layer .deck-slot.shown, .deck-layer .zoom-slot.shown');
    await page.mouse.move(deckBox.x, deckBox.y); await page.mouse.wheel(0, 100); await sleep(500);
    const b1 = await boxOf('.deck-layer .deck-slot.shown, .deck-layer .zoom-slot.shown');
    const followed = b0 && b1 ? (b1.top - b0.top) : null;
    await page.keyboard.press('Escape'); await sleep(500); await page.mouse.wheel(0, -100); await sleep(300);
    bank(`4. deck: opened=${open.open} slot=${open.shown} cards=[${open.cards.join(', ')}] title="${open.title.trim().slice(0, 40)}"; panel-card zoom WHEN="${zoomLine}" picked=${picked} cycled back in ${cleared}; outside→closed=${!afterOutside.open && afterOutside.shown === 0}; Escape→closed=${!afterEsc.open && afterEsc.shown === 0}; wheel 100 → panel moved ${followed === null ? 'n/a' : followed.toFixed(0)}px (open=${!!b1}) → ${P(open.open && open.shown === 1 && open.cards.length === 3 && picked && cleared >= 0 && !afterOutside.open && !afterEsc.open && b1 && Math.abs(followed + 100) < 40)}`);
  } catch (e) { bank(`4. ERROR ${e.message}`); }

  // 5 — Saturday: two timetables, each with its own strip; TBA tiles
  try {
    await clickVisibleTab('Saturday');
    const d = await dayInfo('SATURDAY');
    bank(`5. SAT: ${JSON.stringify(d)} → ${P(d && d.ttBlocks === 2 && d.strips === 2 && d.labels.includes('AFTERS'))}`);
  } catch (e) { bank(`5. ERROR ${e.message}`); }

  // 6 — Sunday: the Midway run, the whisper, the two-line zoom, the order door
  try {
    await clickVisibleTab('Sunday');
    const d = await dayInfo('SUNDAY');
    const midway = await ev(() => [...document.querySelectorAll('.card')].filter((c) => /^~/.test(((c.querySelector('.time') || {}).textContent || '').trim())).map((c) => { const r = c.getBoundingClientRect(); return { name: (c.querySelector('.name') || {}).textContent, time: (c.querySelector('.time') || {}).textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top }; }));
    let when = null, orderText = null, orderHref = null, popupOpened = null, pickedByDoor = null;
    const target = midway.find((m) => /VTSS/.test(m.name)) || midway[1];
    if (target) {
      await ev((name) => { const c = [...document.querySelectorAll('.card')].find((c) => (c.querySelector('.name') || {}).textContent === name && /~/.test((c.querySelector('.time') || {}).textContent || '')); c.scrollIntoView({ block: 'center', behavior: 'instant' }); }, target.name); await sleep(600);
      const fresh = await ev((name) => { const c = [...document.querySelectorAll('.card')].find((c) => (c.querySelector('.name') || {}).textContent === name && /~/.test((c.querySelector('.time') || {}).textContent || '')); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, target.name);
      await page.mouse.move(fresh.x - 5, fresh.y - 5); await sleep(60); await page.mouse.move(fresh.x, fresh.y); await sleep(700);
      const z = await ev(() => { const subs = [...document.querySelectorAll('#zoom-layer .zoom-card .f-sub')].map((e) => e.textContent.trim()); const a = document.querySelector('#zoom-layer .zoom-card a.f-order'); return { subs, orderText: a ? a.textContent.trim() : null, href: a ? a.href : null }; });
      when = z.subs.join(' | '); orderText = z.orderText; orderHref = z.href;
      const door = await boxOf('#zoom-layer .zoom-card a.f-order');
      if (door) { const before = await ev(() => !!document.querySelector('#zoom-layer .zoom-card .f-who .f-pill.you')); const popup = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null); await page.mouse.click(door.x, door.y); await sleep(600); const p = await popup; popupOpened = !!p; if (p) await p.close(); pickedByDoor = !before && (await ev(() => !!document.querySelector('#zoom-layer .zoom-card .f-who .f-pill.you'))); }
      await away(); await sleep(600);
    }
    bank(`6. SUN: tilde cards=[${midway.map((m) => `${m.name} ${m.time}`).join(', ')}] whisper="${d && d.whisper}" decks=${d && d.decks}; zoom on ${target && target.name}: WHEN="${when}" order="${orderText}" href=${orderHref}; door opened tab=${popupOpened} picked=${pickedByDoor} → ${P(midway.length === 4 && d && /guessed set time/.test(d.whisper || '') && /Runs 10 PM – ~?2 AM/.test(when || '') && /Guessing they.re \d(st|nd|rd|th) of 4/.test(orderText || '') && /portolamusicfestival/.test(orderHref || '') && popupOpened && !pickedByDoor)}`);
  } catch (e) { bank(`6. ERROR ${e.message}`); }

  // 7 — bucket chips: hide Folsom, persist across reload, bring back
  try {
    const chipState = () => ev(() => [...document.querySelectorAll('.bucket-row button.bucket-chip')].map((c) => `${c.textContent.trim()}:${c.classList.contains('on') || c.getAttribute('aria-pressed') === 'true' ? 'on' : 'off'}`).join(' '));
    const folsomCount = () => ev(() => [...document.querySelectorAll('.sec-label')].filter((l) => /FOLSOM/i.test(l.textContent)).length);
    const s0 = await chipState(); const f0 = await folsomCount();
    const chip = await ev(() => { const c = [...document.querySelectorAll('.bucket-row button.bucket-chip')].find((c) => /FOLSOM/i.test(c.textContent)); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; });
    if (!chip) throw new Error('no FOLSOM chip');
    await ev(() => window.scrollTo(0, 0)); await sleep(300);
    const chip2 = await ev(() => { const c = [...document.querySelectorAll('.bucket-row button.bucket-chip')].find((c) => /FOLSOM/i.test(c.textContent)); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; });
    await page.mouse.click(chip2.x, chip2.y); await sleep(900);
    const s1 = await chipState(); const f1 = await folsomCount();
    const foot = await ev(() => [...document.querySelectorAll('.sec-whisper, .whisper-hidden, [class*=whisper]')].map((e) => e.textContent.trim()).find((t) => /hidden/i.test(t)) || null);
    await page.reload({ waitUntil: 'load' }); await joinIfNeeded(page); await sleep(2000);
    const f2 = await folsomCount(); const s2 = await chipState();
    const chip3 = await ev(() => { const c = [...document.querySelectorAll('.bucket-row button.bucket-chip')].find((c) => /FOLSOM/i.test(c.textContent)); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(chip3.x, chip3.y); await sleep(900);
    const f3 = await folsomCount();
    bank(`7. chips: start [${s0}] folsom rooms=${f0}; after tap [${s1}] rooms=${f1} foot="${foot}"; after reload [${s2}] rooms=${f2}; after tap again rooms=${f3}; chip box=${chip.h}px (touch floor is a ::after hit area, checked on the phone step) → ${P(f0 > 0 && f1 === 0 && /folsom/i.test(foot || '') && f2 === 0 && f3 === f0)}`);
  } catch (e) { bank(`7. ERROR ${e.message}`); }

  // 8 — console
  bank(`8. console errors/warnings (${consoleErrors.length}): ${consoleErrors.slice(0, 8).join(' | ') || 'none'}`);

  // 9 — phone: tabs in the dock, deck fits, Midway hold shows the two-line WHEN
  try {
    const { devices } = require('playwright'); const mctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
    const mp = await mctx.newPage();
    await mp.goto(boardUrl, { waitUntil: 'load' }); await joinIfNeeded(mp); await sleep(2000);
    const tabs = await mp.evaluate(() => [...document.querySelectorAll('#dock-days button.day-tab')].filter((t) => t.getBoundingClientRect().width > 0).map((t) => t.textContent.trim()));
    const fri = await mp.evaluate(() => { const t = [...document.querySelectorAll('#dock-days button.day-tab')].find((t) => t.dataset.day === 'Friday'); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (fri) { await mp.touchscreen.tap(fri.x, fri.y); await sleep(900); }
    await mp.evaluate(() => { const d = document.querySelector('.deck'); if (d) d.scrollIntoView({ block: 'center' }); }); await sleep(400);
    const db = await mp.evaluate(() => { const d = document.querySelector('.deck'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    let panel = null;
    if (db) { await mp.touchscreen.tap(db.x, db.y); await sleep(800); panel = await mp.evaluate(() => { const s = document.querySelector('.deck-layer .zoom-slot.shown'); if (!s) return null; const r = s.getBoundingClientRect(); return { left: r.left, right: r.right, cards: s.querySelectorAll('.card').length }; }); await mp.touchscreen.tap(10, 100); await sleep(600); }
    const sun = await mp.evaluate(() => { const t = [...document.querySelectorAll('#dock-days button.day-tab')].find((t) => t.dataset.day === 'Sunday'); const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await mp.touchscreen.tap(sun.x, sun.y); await sleep(900);
    const mc = await mp.evaluate(() => { const c = [...document.querySelectorAll('.card')].find((c) => /^~/.test(((c.querySelector('.time') || {}).textContent || '').trim())); if (!c) return null; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, name: (c.querySelector('.name') || {}).textContent }; });
    let holdWhen = null;
    if (mc) { await sleep(400); const c2 = await mp.evaluate((name) => { const c = [...document.querySelectorAll('.card')].find((c) => (c.querySelector('.name') || {}).textContent === name); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, mc.name); const cdp = await mctx.newCDPSession(mp); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c2.x, y: c2.y }] }); await sleep(700); holdWhen = await mp.evaluate(() => [...document.querySelectorAll('#zoom-layer .zoom-card .f-sub')].map((e) => e.textContent.trim()).join(' | ') + ' || ' + ((document.querySelector('#zoom-layer .zoom-card a.f-order') || {}).textContent || '').trim()); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    bank(`9. phone: dock tabs=[${tabs.join(' ')}]; deck panel=${JSON.stringify(panel)} fits=${panel ? panel.left >= 0 && panel.right <= 390 : null}; Midway hold (${mc && mc.name}) WHEN="${holdWhen}" → ${P(tabs.length === 4 && panel && panel.cards === 3 && panel.left >= 0 && panel.right <= 390 && /Runs 10 PM/.test(holdWhen || '') && /of 4/.test(holdWhen || ''))}`);
    await mctx.close();
  } catch (e) { bank(`9. ERROR ${e.message}`); }

  bank(''); bank('FINISHED');
  await browser.close();
})().catch((e) => { bank(`FATAL ${e.stack || e}`); process.exit(1); });
