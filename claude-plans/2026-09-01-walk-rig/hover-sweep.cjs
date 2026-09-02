// Hover EVERY card on a day and grade the zoom: appeared? names match? WHEN
// plausible? closes on leave? Usage: TOKEN=… node hover-sweep.cjs <label> <entryUrl> <Day>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const [label, entry, day] = process.argv.slice(2);
const TOKEN = process.env.TOKEN;
const out = path.join(__dirname, `hover-sweep-${label}-${day}.md`);
const lines = [`# Hover sweep — ${label} — ${day} — ${new Date().toISOString()}`, ''];
const bank = (s) => { lines.push(s); fs.writeFileSync(out, lines.join('\n') + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(entry, { waitUntil: 'load' }); await sleep(1500);
  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/#g=${TOKEN}&f=portola-2026&me=Ava`, { waitUntil: 'load' }); await sleep(3000);
  const row = await page.evaluate(() => { const e = [...document.querySelectorAll('#screen-join button.fest-row')].find((b) => b.textContent.includes('Ava')); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (row) { await page.mouse.click(row.x, row.y); }
  await page.waitForSelector('.card', { timeout: 25000 }); await sleep(2500);
  bank(`build: ${await page.evaluate(() => fetch('/service-worker.js').then((r) => r.text()).then((t) => (t.match(/festival-nav-v\d+/) || [''])[0]))}`);
  const t = await page.evaluate((day) => { const t = [...document.querySelectorAll(`button.day-tab[data-day="${day}"]`)].find((t) => t.getBoundingClientRect().width > 0); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, day);
  if (t) { await page.mouse.click(t.x, t.y); await sleep(1200); }
  // the day's cards: from its .day-rule to the next
  const ids = await page.evaluate((day) => {
    const rules = [...document.querySelectorAll('#wall-root .day-rule')];
    const rule = rules.find((r) => ((r.querySelector('.day') || r).textContent || '').trim().toUpperCase().startsWith(day.toUpperCase()));
    if (!rule) return [];
    const nodes = []; let e = rule.nextElementSibling; while (e && !e.classList.contains('day-rule')) { nodes.push(e); e = e.nextElementSibling; }
    const cards = nodes.flatMap((n) => [...n.querySelectorAll('.card')]);
    return cards.map((c, i) => { c.setAttribute('data-sweep', String(i)); return { i, name: (c.querySelector('.name') || {}).textContent || '', time: ((c.querySelector('.time') || {}).textContent || '').trim(), where: c.closest('.deck') ? 'deck-face' : c.closest('.tt-block') ? 'column' : 'tile' }; });
  }, day);
  bank(`cards on ${day}: ${ids.length}`);
  const zoomState = () => page.evaluate(() => { const s = document.querySelector('#zoom-layer .zoom-slot.shown'); if (!s) return { shown: 0 }; return { shown: document.querySelectorAll('#zoom-layer .zoom-slot.shown').length, name: (s.querySelector('.f-name') || {}).textContent || '', when: [...s.querySelectorAll('.f-sub')].map((e) => e.textContent.trim()).join(' | ') }; });
  let bad = 0;
  for (const c of ids) {
    const box = await page.evaluate((i) => { const el = document.querySelector(`.card[data-sweep="${i}"]`); el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); const under = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { x: r.left + r.width / 2, y: r.top + r.height / 2, covered: !(under === el || (under && el.contains(under))) ? (under ? under.tagName + '.' + [...under.classList].join('.') : 'none') : null }; }, c.i);
    await sleep(250);
    await page.mouse.move(box.x - 6, box.y - 6); await sleep(80); await page.mouse.move(box.x, box.y); await sleep(600);
    const z = await zoomState();
    await page.mouse.move(1420, 40); await page.mouse.move(1430, 30); await sleep(600);
    const after = await zoomState();
    const nameOk = z.shown === 1 && z.name.trim() === c.name.trim();
    const closed = after.shown === 0;
    const verdict = c.where === 'deck-face' ? (z.shown === 0 ? 'no-hover (deck face, by design)' : 'deck face grew?') : (!z.shown ? 'NO HOVER' : !nameOk ? `WRONG CARD (overlay says "${z.name}")` : !closed ? 'STUCK after leave' : 'ok');
    if (verdict !== 'ok' && !verdict.startsWith('no-hover')) bad++;
    bank(`- [${verdict}] ${c.where} "${c.name}" ${c.time}${box.covered ? ` · covered by ${box.covered}` : ''} · WHEN="${z.when || ''}"`);
  }
  // after opening + closing a deck, re-check three cards
  const deck = await page.evaluate(() => { const d = document.querySelector('.deck'); if (!d) return null; d.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (deck) {
    await sleep(300); await page.mouse.click(deck.x, deck.y); await sleep(800); await page.keyboard.press('Escape'); await sleep(700);
    const layer = await page.evaluate(() => { const l = document.querySelector('.deck-layer'); if (!l) return 'no layer'; const r = l.getBoundingClientRect(); return `deck-layer ${Math.round(r.width)}x${Math.round(r.height)} pe=${getComputedStyle(l).pointerEvents} children=${l.children.length} open=${!!document.querySelector('.deck.open')}`; });
    bank(`after deck open+close: ${layer}`);
    let recheck = 0;
    for (const c of ids.filter((c) => c.where !== 'deck-face').slice(0, 4)) {
      const box = await page.evaluate((i) => { const el = document.querySelector(`.card[data-sweep="${i}"]`); el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, c.i);
      await sleep(250); await page.mouse.move(box.x - 6, box.y - 6); await sleep(80); await page.mouse.move(box.x, box.y); await sleep(600);
      const z = await zoomState(); await page.mouse.move(1420, 40); await page.mouse.move(1430, 30); await sleep(600); const a = await zoomState();
      bank(`- recheck "${c.name}": hover=${z.shown === 1 && z.name.trim() === c.name.trim()} closed=${a.shown === 0}`); if (!(z.shown === 1 && a.shown === 0)) recheck++;
    }
    bank(`rechecks failing: ${recheck}`);
  }
  bank(`page errors: ${errs.join(' || ') || 'none'}`);
  bank(`SUMMARY ${day}: ${bad} of ${ids.length} hoverable cards misbehave`);
  bank('FINISHED');
  await browser.close();
})().catch((e) => { bank(`FATAL ${e.stack || e}`); process.exit(1); });
