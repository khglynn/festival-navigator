// Read-only probe: loads plan-base's two stylesheets + fonts into a static
// page (file://, no server, no /api) and measures two claims from the map.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const BASE = process.env.APP || '/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/plan-base'; // APP=<worktree> node probe-shelves-tokens.mjs
const require = createRequire(BASE + '/package.json');
const { chromium, webkit } = require('playwright');

const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="file://${BASE}/assets/fonts/fonts.css">
<link rel="stylesheet" href="file://${BASE}/assets/v3-tokens.css">
<link rel="stylesheet" href="file://${BASE}/assets/v3.css">
<style>body{margin:0;background:var(--page);font-family:var(--font-ui);min-height:100vh}</style>
</head><body>
<button id="tonal" class="btn-tonal">Pick shows</button>
<button id="ghost" class="btn-ghost">Look around</button>
<button id="undo" class="undo-btn">Not me</button>
<button id="chip" class="chip-notes">2</button>
<span id="span">Inter text</span>
<div id="screen-app">
  <div class="bring-offer" id="welcome-card"><div class="bring-card welcome-card" style="height:150px">welcome</div></div>
  <div class="dock" id="dock">
    <button class="avatar you you-avatar">K</button>
    <span class="days"><button class="day-tab active">SAT</button></span>
    <span class="sort-wrap" style="flex:none">
      <button class="fest-link"><span class="fest-name">PORTOLA</span></button>
      <ul class="sort-pop" id="pop" role="listbox"><li><button role="option">Portola</button></li><li><button role="option">Afters</button></li><li><button role="option">Folsom</button></li><li><button role="option">Settings</button></li></ul>
    </span>
  </div>
</div>
</body></html>`;
const file = (process.env.TMPDIR || '/tmp') + '/probe-shelves-tokens.html';
writeFileSync(file, html);

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  let browser;
  try { browser = await engine.launch(); } catch (e) { console.log(name, 'unavailable:', e.message.split('\n')[0]); continue; }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: name === 'chromium' });
  await page.goto('file://' + file);
  await page.evaluate(() => document.fonts.ready);
  const out = await page.evaluate(() => {
    const ff = (id) => getComputedStyle(document.getElementById(id)).fontFamily;
    const pop = document.getElementById('pop').getBoundingClientRect();
    const card = document.querySelector('.bring-card').getBoundingClientRect();
    // a point inside BOTH the popover and the welcome card, if any
    const x = Math.max(pop.left, card.left) + 4;
    const y = Math.max(pop.top, card.top) + 4;
    const overlap = x < Math.min(pop.right, card.right) && y < Math.min(pop.bottom, card.bottom);
    const top = overlap ? document.elementFromPoint(x, y) : null;
    return {
      fonts: { tonal: ff('tonal'), ghost: ff('ghost'), undo: ff('undo'), chipNotes: ff('chip'), span: ff('span') },
      tonalHeight: document.getElementById('tonal').getBoundingClientRect().height,
      pop: [Math.round(pop.top), Math.round(pop.bottom), Math.round(pop.left), Math.round(pop.right)],
      card: [Math.round(card.top), Math.round(card.bottom), Math.round(card.left), Math.round(card.right)],
      overlap, topAtOverlap: top ? (top.closest('.bring-card') ? 'WELCOME CARD (covers the menu)' : top.closest('.sort-pop') ? 'SHOW MENU (on top)' : top.tagName) : null,
    };
  });
  console.log(name, JSON.stringify(out, null, 1));
  await browser.close();
}
