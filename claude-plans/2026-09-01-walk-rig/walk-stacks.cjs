// The one-rule walk: every club night stacks. Usage: TOKEN=… node walk-stacks.cjs <label> <entryUrl>
const { chromium, devices } = require('playwright');
const fs = require('fs'); const path = require('path');
const [label, entry] = process.argv.slice(2);
const TOKEN = process.env.TOKEN;
const out = path.join(__dirname, `report-stacks-${label}.md`);
const lines = [`# Stacks walk — ${label} — ${new Date().toISOString()}`, ''];
const bank = (s) => { lines.push(s); fs.writeFileSync(out, lines.join('\n') + '\n'); console.log(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const P = (ok) => (ok ? 'PASS' : 'FAIL');
async function join(pg, touch = false) {
  await sleep(3000);
  const row = await pg.evaluate(() => { const e = [...document.querySelectorAll('#screen-join button.fest-row')].find((b) => (b.textContent || '').includes('Ava')); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (row) { if (touch) await pg.touchscreen.tap(row.x, row.y); else await pg.mouse.click(row.x, row.y); await sleep(3000); }
  await pg.waitForSelector('.card', { timeout: 25000 }); await sleep(2000);
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(entry, { waitUntil: 'load' }); await sleep(1500);
  const origin = new URL(page.url()).origin;
  const boardUrl = `${origin}/#g=${TOKEN}&f=portola-2026&me=Ava`;
  await page.goto(boardUrl, { waitUntil: 'load' }); await join(page);
  bank(`build: ${await page.evaluate(() => fetch('/service-worker.js').then((r) => r.text()).then((t) => (t.match(/festival-nav-v\d+/) || [''])[0]))}`);
  const ev = (f, a) => page.evaluate(f, a);
  const tab = async (day) => { const t = await ev((day) => { const t = [...document.querySelectorAll('button.day-tab[data-day=' + day + ']')].find((t) => t.getBoundingClientRect().width > 0); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, day); if (t) { await page.mouse.click(t.x, t.y); await sleep(1200); } return !!t; };
  // Per day: the afters block's columns — for each venue column, the cards, their tops, their times.
  const dayShape = (day) => ev((day) => {
    const rules = [...document.querySelectorAll('#wall-root .day-rule')];
    const rule = rules.find((r) => ((r.querySelector('.day') || r).textContent || '').trim().toUpperCase().startsWith(day.toUpperCase()));
    if (!rule) return null;
    const nodes = []; let e = rule.nextElementSibling; while (e && !e.classList.contains('day-rule')) { nodes.push(e); e = e.nextElementSibling; }
    const qa = (s) => nodes.flatMap((n) => [...(n.matches(s) ? [n] : []), ...n.querySelectorAll(s)]);
    const blocks = qa('.tt-block');
    const cols = [];
    for (const b of blocks) {
      const heads = [...b.querySelectorAll('.stage-head .label')].map((h) => h.textContent.trim());
      const cells = [...b.querySelectorAll('.card.cell')];
      const byCol = {};
      for (const c of cells) { const col = c.style.gridColumn || c.style.gridColumnStart || '?'; (byCol[col] = byCol[col] || []).push(c); }
      for (const [col, cs] of Object.entries(byCol)) {
        const rects = cs.map((c) => { const r = c.getBoundingClientRect(); return { name: (c.querySelector('.name') || {}).textContent, time: ((c.querySelector('.time') || {}).textContent || '').trim(), top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width) }; });
        rects.sort((a, b) => a.top - b.top);
        const sameLeft = rects.every((r) => Math.abs(r.left - rects[0].left) < 3) && rects.every((r) => Math.abs(r.w - rects[0].w) < 3);
        const overlapping = rects.some((r, i) => i > 0 && r.top < rects[i - 1].top + 20);
        cols.push({ block: heads.length, venue: heads[parseInt(col, 10) - 1] || col, cards: rects.map((r) => `${r.name} ${r.time}`), stacked: sameLeft && !overlapping, sideBySide: !sameLeft });
      }
    }
    return { labels: qa('.sec-label').map((x) => x.textContent.trim()), decks: qa('.deck').length, whisper: (qa('.sec-whisper')[0] || {}).textContent || null, tba: qa('.tba .card').length, cols };
  }, day);
  const report = (day, d, expectRuns) => {
    if (!d) { bank(`${day}: NO DAY BLOCK → FAIL`); return; }
    const multi = d.cols.filter((c) => c.cards.length > 1);
    const bad = multi.filter((c) => !c.stacked || c.sideBySide);
    const runs = multi.filter((c) => c.cards.every((x) => /~/.test(x)));
    bank(`${day}: sections ${d.labels.join('/')} · decks=${d.decks} · multi-artist columns=${multi.length} (all stacked=${bad.length === 0}) · runs with tildes=${runs.length}/${expectRuns} · TBA tiles=${d.tba} · whisper=${d.whisper ? 'yes' : 'no'}`);
    for (const c of multi) bank(`   - ${c.venue}: ${c.cards.join(' → ')}${c.sideBySide ? '  ← SIDE BY SIDE' : ''}`);
    bank(`   → ${P(d.decks === 0 && bad.length === 0 && runs.length >= expectRuns && (runs.length === 0 || !!d.whisper))}`);
  };
  try { await tab('Friday'); report('FRI', await dayShape('FRIDAY'), 3); } catch (e) { bank(`FRI ERROR ${e.message}`); }
  try { await tab('Saturday'); report('SAT', await dayShape('SATURDAY'), 4); } catch (e) { bank(`SAT ERROR ${e.message}`); }
  try { await tab('Sunday'); report('SUN', await dayShape('SUNDAY'), 5); } catch (e) { bank(`SUN ERROR ${e.message}`); }
  // The zoom on a run member: two lines, the order door
  try {
    const target = await ev(() => { const c = [...document.querySelectorAll('.card')].find((c) => (c.querySelector('.name') || {}).textContent === 'Ben UFO' && /~/.test((c.querySelector('.time') || {}).textContent || '')); if (!c) return null; c.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (!target) bank('ZOOM: SKIP (no Ben UFO run card)');
    else {
      await sleep(500); await page.mouse.move(target.x - 5, target.y - 5); await sleep(60); await page.mouse.move(target.x, target.y); await sleep(800);
      const z = await ev(() => { const s = document.querySelector('#zoom-layer .zoom-slot.shown'); if (!s) return null; return { name: (s.querySelector('.f-name') || {}).textContent, when: (s.querySelector('.f-when') || s.querySelector('.f-sub') || {}).textContent, order: (s.querySelector('.f-order') || {}).textContent, href: (s.querySelector('a.f-order') || {}).href || null }; });
      bank(`ZOOM on Ben UFO (Sun · Public Works, 3rd of 4): ${JSON.stringify(z)} → ${P(z && z.name === 'Ben UFO' && /Runs 10 PM – 2 AM/.test(z.when || '') && /Guessing they.re 3rd of 4/.test(z.order || '') && /dothebay\.com/.test(z.href || ''))}`);
      await page.mouse.move(1420, 40); await sleep(600);
    }
  } catch (e) { bank(`ZOOM ERROR ${e.message}`); }
  // Kevin's sequence on a run card: click the resting card, then five picks on the grown card; journal must stay empty
  try {
    await ev(() => { try { localStorage.removeItem('fn_errlog_v1'); } catch {} });
    const c = await ev(() => { const c = [...document.querySelectorAll('.card')].find((c) => (c.querySelector('.name') || {}).textContent === 'Two Shell' && /~/.test((c.querySelector('.time') || {}).textContent || '')); c.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await sleep(500); await page.mouse.move(c.x - 6, c.y - 6); await sleep(60); await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.up(); await sleep(900);
    const alive = [];
    for (let k = 0; k < 5; k++) { const n = await ev(() => { const el = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card .f-name'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); if (!n) { alive.push('none'); break; } await page.mouse.click(n.x, n.y); await sleep(120); alive.push(await ev(() => document.querySelectorAll('#zoom-layer .zoom-slot.shown').length)); await sleep(600); }
    const journal = await ev(() => { try { return JSON.parse(localStorage.getItem('fn_errlog_v1') || '[]').map((e) => e.msg); } catch { return ['(unreadable)']; } });
    for (let k = 0; k < 5; k++) { const lvl = await ev(() => { const c = [...document.querySelectorAll('.card')].find((c) => (c.querySelector('.name') || {}).textContent === 'Two Shell' && /~/.test((c.querySelector('.time') || {}).textContent || '')); return c && c.querySelector('.corner-who .mark') ? 1 : 0; }); if (!lvl) break; const n = await ev(() => { const el = document.querySelector('#zoom-layer .zoom-slot.shown .zoom-card .f-name'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); if (n) await page.mouse.click(n.x, n.y); else await page.mouse.click(c.x, c.y); await sleep(600); }
    await page.mouse.move(1420, 40); await sleep(500);
    bank(`KEVIN'S SEQUENCE on Two Shell: zoom alive after each pick=${alive.join(',')}; journal=${JSON.stringify(journal)} → ${P(alive.length === 5 && alive.every((a) => a === 1) && journal.length === 0)}`);
  } catch (e) { bank(`SEQUENCE ERROR ${e.message}`); }
  // Chips persist
  try {
    await ev(() => window.scrollTo(0, 0)); await sleep(400);
    const chip = (n) => ev((n) => { const c = [...document.querySelectorAll('.bucket-row button.bucket-chip')].find((c) => c.textContent.includes(n)); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, n);
    const rooms = () => ev(() => [...document.querySelectorAll('.sec-label')].filter((l) => /FOLSOM/i.test(l.textContent)).length);
    const r0 = await rooms(); const f = await chip('FOLSOM'); await page.mouse.click(f.x, f.y); await sleep(900); const r1 = await rooms();
    await page.reload({ waitUntil: 'load' }); await join(page); const r2 = await rooms();
    const f2 = await chip('FOLSOM'); await page.mouse.click(f2.x, f2.y); await sleep(900); const r3 = await rooms();
    bank(`CHIPS: folsom rooms ${r0} → off ${r1} → reload ${r2} → on ${r3} → ${P(r0 > 0 && r1 === 0 && r2 === 0 && r3 === r0)}`);
  } catch (e) { bank(`CHIPS ERROR ${e.message}`); }
  bank(`page errors: ${errs.join(' || ') || 'none'}`);
  // Phone: Sunday afters shape at 390
  try {
    const mctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
    const mp = await mctx.newPage(); await mp.goto(boardUrl, { waitUntil: 'load' }); await join(mp, true);
    const sun = await mp.evaluate(() => { const t = [...document.querySelectorAll('#dock-days button.day-tab')].find((t) => t.dataset.day === 'Sunday'); const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await mp.touchscreen.tap(sun.x, sun.y); await sleep(1000);
    const shape = await mp.evaluate(() => { const cards = [...document.querySelectorAll('.card.cell')].filter((c) => /~/.test((c.querySelector('.time') || {}).textContent || '')); const byCol = {}; for (const c of cards) { const k = c.style.gridColumn; (byCol[k] = byCol[k] || []).push(Math.round(c.getBoundingClientRect().top)); } return { runCards: cards.length, decks: document.querySelectorAll('.deck').length, colsStacked: Object.values(byCol).every((tops) => tops.slice().sort((a, b) => a - b).every((t, i, a) => i === 0 || t > a[i - 1] + 10)) }; });
    await mp.screenshot({ path: path.join(__dirname, `stacks-${label}-phone-sun.png`) });
    bank(`PHONE Sunday: ${JSON.stringify(shape)} → ${P(shape.decks === 0 && shape.runCards >= 10 && shape.colsStacked)}`);
    await mctx.close();
  } catch (e) { bank(`PHONE ERROR ${e.message}`); }
  bank(''); bank('FINISHED');
  await browser.close();
})().catch((e) => { bank(`FATAL ${e.stack || e}`); process.exit(1); });
