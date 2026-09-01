// Round-2 checks for PR #16 after the review fixes. Usage: TOKEN=… node walk-events-round2.cjs <label> <entryUrl>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const [label, entry] = process.argv.slice(2);
const TOKEN = process.env.TOKEN;
const out = path.join(__dirname, `report-events2-${label}.md`);
const lines = [`# Events walk round 2 — ${label} — ${new Date().toISOString()}`, ''];
const bank = (s) => { lines.push(s); fs.writeFileSync(out, lines.join('\n') + '\n'); console.log(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const P = (ok) => (ok ? 'PASS' : 'FAIL');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200))); page.on('console', (m) => { if (m.type() === 'error' && !/insights|404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await page.goto(entry, { waitUntil: 'load' }); await sleep(1500);
  const origin = new URL(page.url()).origin; bank(`origin: ${origin}`);
  const boardUrl = `${origin}/#g=${TOKEN}&f=portola-2026&me=Ava`;
  await page.goto(boardUrl, { waitUntil: 'load' }); await sleep(1500);
  const row = await page.evaluate(() => { const e = [...document.querySelectorAll('#screen-join button.fest-row')].find((b) => b.textContent.includes('Ava')); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (row) { await page.mouse.click(row.x, row.y); }
  await page.waitForSelector('.card', { timeout: 25000 }); await sleep(2500);
  bank(`build: ${await page.evaluate(() => fetch('/service-worker.js').then((r) => r.text()).then((t) => (t.match(/festival-nav-v\d+/) || [''])[0]))}`);
  const ev = (fn, a) => page.evaluate(fn, a);
  const tab = async (day) => { const t = await ev((day) => { const t = [...document.querySelectorAll('button.day-tab[data-day=' + day + ']')].find((t) => t.getBoundingClientRect().width > 0); const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, day); await page.mouse.click(t.x, t.y); await sleep(1200); };
  const deckBox = async () => { await ev(() => document.querySelector('.deck').scrollIntoView({ block: 'center', behavior: 'instant' })); await sleep(500); return ev(() => { const r = document.querySelector('.deck').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); };
  const panelCard = (name) => ev((name) => { const c = [...document.querySelectorAll('.deck-layer .card')].find((c) => (c.querySelector('.name') || {}).textContent === name); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, name);
  const marksOf = (name) => ev((name) => { const c = [...document.querySelectorAll('.deck-layer .card')].find((c) => (c.querySelector('.name') || {}).textContent === name); return c ? c.querySelectorAll('.corner-who .mark').length : null; }, name);
  const overlay = () => ev(() => { const el = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const deckState = () => ev(() => ({ open: !!document.querySelector('.deck.open'), panel: document.querySelectorAll('.deck-layer .card').length, sheet: !!document.querySelector('.sheet-card') }));
  const away = async () => { await page.mouse.move(1420, 40); await page.mouse.move(1430, 30); };

  // A — picks inside the panel cycle, across the sync echo
  try {
    await tab('Friday'); const d = await deckBox(); await page.mouse.click(d.x, d.y); await sleep(800);
    const name = 'Gelli Haha'; const pc = await panelCard(name); await page.mouse.move(pc.x, pc.y); await sleep(600);
    const seq = [await marksOf(name)];
    for (let k = 0; k < 5; k++) { const z = await overlay(); if (!z) { seq.push('no-overlay'); break; } await page.mouse.click(z.x, z.y); await sleep(k === 0 ? 3500 : 600); seq.push(await marksOf(name)); }
    const changes = seq.slice(1).filter((v, i) => v !== seq[i]).length;
    bank(`A. panel pick cycle (${name}) marks per click: ${seq.join(' → ')}; changed on ${changes}/${seq.length - 1} clicks; reached 0=${seq.includes(0)} → ${P(changes >= 4 && seq.slice(1).includes(0))}`);
    // put it back to 0 if needed
    for (let k = 0; k < 4 && (await marksOf(name)) > 0; k++) { const z = await overlay(); if (!z) break; await page.mouse.click(z.x, z.y); await sleep(600); }
    await page.keyboard.press('Escape'); await sleep(500); await away();
  } catch (e) { bank(`A. ERROR ${e.message}`); }

  // B — the deck answers the people filter as one object
  try {
    const chipBox = (who) => ev((who) => { const c = [...document.querySelectorAll('.person-chip, button.person-chip')].find((c) => (c.textContent || '').trim() === who); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, who);
    const deckDim = () => ev(() => { const d = document.querySelector('.deck'); const face = d && d.querySelector('.card'); return { deckDim: !!(d && d.classList.contains('dim')), faceDim: !!(face && face.classList.contains('dim')), deckOpacity: d ? getComputedStyle(d).opacity : null, faceOpacity: face ? getComputedStyle(face).opacity : null, aria: d ? d.getAttribute('aria-label') : null }; });
    // Ava picked Jyoty earlier (a panel member); Cleo has no pick in the deck.
    const before = await deckDim();
    const ava = await chipBox('Ava'); if (!ava) throw new Error('no Ava people chip');
    await ev(() => window.scrollTo(0, 0)); await sleep(300); const ava2 = await chipBox('Ava'); await page.mouse.click(ava2.x, ava2.y); await sleep(1000);
    await ev(() => document.querySelector('.deck').scrollIntoView({ block: 'center', behavior: 'instant' })); await sleep(300);
    const withAva = await deckDim();
    await ev(() => window.scrollTo(0, 0)); await sleep(300); const ava3 = await chipBox('Ava'); await page.mouse.click(ava3.x, ava3.y); await sleep(700);
    const cleo = await chipBox('Cleo'); await page.mouse.click(cleo.x, cleo.y); await sleep(1000);
    await ev(() => document.querySelector('.deck').scrollIntoView({ block: 'center', behavior: 'instant' })); await sleep(300);
    const withCleo = await deckDim();
    await ev(() => window.scrollTo(0, 0)); await sleep(300); const cleo2 = await chipBox('Cleo'); await page.mouse.click(cleo2.x, cleo2.y); await sleep(700);
    bank(`B. deck × people filter: rest ${JSON.stringify(before)}; Ava (has a pick inside) ${JSON.stringify(withAva)}; Cleo (none inside) ${JSON.stringify(withCleo)} → ${P(!withAva.deckDim && !withAva.faceDim && withCleo.deckDim && Number(withCleo.deckOpacity) < 0.5 && /Ava/.test(withAva.aria || ''))}`);
  } catch (e) { bank(`B. ERROR ${e.message}`); }

  // C — Escape with a notes sheet over the panel closes the sheet, not the panel
  try {
    await tab('Friday'); const d = await deckBox(); await page.mouse.click(d.x, d.y); await sleep(800);
    const pc = await panelCard('Jyoty'); await page.mouse.move(pc.x, pc.y); await sleep(600);
    const chip = await ev(() => { const b = document.querySelector('#zoom-layer .zoom-card button.f-chip.notes'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(chip.x, chip.y); await sleep(800);
    const s1 = await deckState(); await page.keyboard.press('Escape'); await sleep(600); const s2 = await deckState(); await page.keyboard.press('Escape'); await sleep(600); const s3 = await deckState();
    bank(`C. sheet over panel: after chip ${JSON.stringify(s1)}; after Esc ${JSON.stringify(s2)}; after 2nd Esc ${JSON.stringify(s3)} → ${P(s1.sheet && s1.open && !s2.sheet && s2.open && !s3.open)}`);
    await away();
  } catch (e) { bank(`C. ERROR ${e.message}`); }

  // D — scroll-away close does not jump the page back
  try {
    await tab('Friday'); const d = await deckBox(); await page.mouse.click(d.x, d.y); await sleep(800);
    const y0 = await ev(() => window.scrollY); await page.mouse.move(700, 450); await page.mouse.wheel(0, 1600); await sleep(900);
    const y1 = await ev(() => window.scrollY); const s = await deckState(); await sleep(700); const y2 = await ev(() => window.scrollY);
    bank(`D. scroll-away: scrollY ${y0.toFixed(0)} → ${y1.toFixed(0)} → ${y2.toFixed(0)} (after 700ms); panel open=${s.open} → ${P(!s.open && Math.abs(y2 - y1) < 40 && y1 - y0 > 400)}`);
  } catch (e) { bank(`D. ERROR ${e.message}`); }

  // E — two bucket chips tapped fast: both land and both persist
  try {
    await ev(() => window.scrollTo(0, 0)); await sleep(400);
    const chip = (name) => ev((name) => { const c = [...document.querySelectorAll('.bucket-row button.bucket-chip')].find((c) => c.textContent.includes(name)); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, name);
    const state = () => ev(() => [...document.querySelectorAll('.bucket-row button.bucket-chip')].map((c) => `${c.textContent.trim().replace(/[^A-Z]/g, '')}:${c.classList.contains('on') || c.getAttribute('aria-pressed') === 'true' ? 'on' : 'off'}`).join(' '));
    const f = await chip('FOLSOM'); const a = await chip('AFTERS');
    await page.mouse.click(f.x, f.y); await sleep(50); await page.mouse.click(a.x, a.y); await sleep(1200);
    const s1 = await state();
    await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.card', { timeout: 25000 }); await sleep(2000);
    const s2 = await state();
    const f2 = await chip('FOLSOM'); await page.mouse.click(f2.x, f2.y); await sleep(700); const a2 = await chip('AFTERS'); await page.mouse.click(a2.x, a2.y); await sleep(900);
    const s3 = await state();
    bank(`E. two chips fast: after taps [${s1}]; after reload [${s2}]; restored [${s3}] → ${P(/FOLSOM:off/.test(s1) && /AFTERS:off/.test(s1) && /FOLSOM:off/.test(s2) && /AFTERS:off/.test(s2) && !/off/.test(s3))}`);
  } catch (e) { bank(`E. ERROR ${e.message}`); }

  // F — a guessed time keeps its tilde in search results
  try {
    const input = await ev(() => { const i = document.querySelector('input[aria-label="Search artists"], #search, input[type=search]'); if (!i) return null; const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
    if (!input) bank('F. search tilde: SKIP (no search input found)');
    else {
      if (input.w < 5) { const btn = await ev(() => { const b = document.querySelector('button[aria-label="Search artists"], button[aria-label*="Search"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); if (btn) { await page.mouse.click(btn.x, btn.y); await sleep(500); } }
      const i2 = await ev(() => { const i = document.querySelector('input[aria-label="Search artists"], #search, input[type=search]'); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await page.mouse.click(i2.x, i2.y); await page.keyboard.type('VTSS'); await sleep(900);
      const times = await ev(() => [...document.querySelectorAll('.card')].filter((c) => (c.querySelector('.name') || {}).textContent === 'VTSS').map((c) => ((c.querySelector('.time') || {}).textContent || '').trim()));
      bank(`F. search "VTSS" card times: [${times.join(' | ')}] → ${P(times.some((t) => /~\d/.test(t)))}`);
      await page.keyboard.press('Escape'); await sleep(400);
    }
  } catch (e) { bank(`F. ERROR ${e.message}`); }

  bank(`G. page errors: ${errs.length ? errs.join(' || ') : 'none'}`);
  bank(''); bank('FINISHED');
  await browser.close();
})().catch((e) => { bank(`FATAL ${e.stack || e}`); process.exit(1); });
