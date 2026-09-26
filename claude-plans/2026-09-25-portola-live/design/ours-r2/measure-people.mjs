// The honest people-row test (round two): where the people row sits, how it
// wraps and whether it is on screen when the app opens, at 320 and 390 with
// crews of 6, 9 and 12. node measure-people.mjs
import { openRig, openApp } from './rig.mjs';
const PT = (iso) => new Date(`${iso}-07:00`);
const TIMES = { 'Wed 6 PM (before the week)': PT('2026-09-23T18:00:00'), 'Sat 11 AM (day-of open)': PT('2026-09-26T11:00:00'), 'Sat 9:40 PM (live)': PT('2026-09-26T21:40:00') };
const rig = await openRig();
try {
  for (const width of [320, 390]) for (const crew of [6, 12]) for (const [label, now] of Object.entries(TIMES)) {
    if (crew === 6 && label.startsWith('Wed')) continue;
    const { ctx, page } = await openApp(rig, { now, width, crew });
    const m = await page.evaluate(() => {
      const box = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width) }; };
      const chips = [...document.querySelectorAll('#person-chips .person-chip')];
      const lines = new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top))).size;
      const days = [...document.querySelectorAll('#dock-days .day-tab')].map((t) => ({ t: t.textContent, x: Math.round(t.getBoundingClientRect().left), w: Math.round(t.getBoundingClientRect().width) }));
      const row = document.querySelector('#dock-days').getBoundingClientRect();
      const seen = days.filter((d) => d.x >= row.left - 1 && d.x + d.w <= row.right + 1).map((d) => d.t);
      return { scrollY: Math.round(scrollY), toolbar: box('.toolbar'), chips: box('#person-chips'), lines, n: chips.length,
        dock: { you: box('#dock-you'), now: box('#dock-now'), days: box('#dock-days'), fest: box('#dock-fest-wrap'), nowCompact: document.querySelector('#dock-now').classList.contains('compact'), fullyShown: seen } };
    });
    const onScreen = m.toolbar.top + m.toolbar.h > 0 && m.toolbar.top < 844;
    console.log(`${width} crew ${crew} · ${label}: scrollY ${m.scrollY}, people row top ${m.chips.top} (${m.lines} line(s), ${m.chips.h}px, ${m.n} chips incl. + Add), ${onScreen ? 'ON screen' : 'OFF screen by ' + (-(m.toolbar.top + m.toolbar.h)) + 'px'} · dock days ${m.dock.days.w}px shows [${m.dock.fullyShown.join(' ')}]${m.dock.now && m.dock.now.w ? `, NOW ${m.dock.now.w}px${m.dock.nowCompact ? ' (dot)' : ''}` : ''}`);
    await ctx.close();
  }
} finally { await rig.close(); }
