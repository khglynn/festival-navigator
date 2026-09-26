import { openRig, openApp } from './rig.mjs';
const rig = await openRig();
try {
  const { ctx, page } = await openApp(rig, { now: new Date('2026-09-26T21:40:00-07:00') });
  await page.screenshot({ path: new URL('./scratch/base-sat-940.png', import.meta.url).pathname });
  const info = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
    return {
      dock: r('#dock'), days: r('#dock-days'), now: r('#dock-now'), fest: r('#dock-fest-wrap'), you: r('#dock-you'),
      tabs: [...document.querySelectorAll('#dock-days .day-tab')].map((t) => [t.textContent, Math.round(t.getBoundingClientRect().width)]),
      overflowing: document.querySelector('#dock-days').className,
      scrollY, heads: [...document.querySelectorAll('.room-head')].map((h) => h.textContent.trim().slice(0, 40)),
      chips: [...document.querySelectorAll('#person-chips .person-chip')].map((c) => c.textContent),
      toolbar: r('.toolbar'), header: r('.app-header'),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: new URL('./scratch/base-top.png', import.meta.url).pathname });
  await ctx.close();
} finally { await rig.close(); }
