// v103: film the motion at a tenth of the speed (CDP Animation.setPlaybackRate),
// frame by frame, into v103-shots/:
//   node claude-plans/2026-09-26-unified-build/v103-film.mjs [now] [thin]
//   now  — NOW arriving at and leaving the day row's start (390 dock, 1280 rail)
//   thin — the List's highlight: Ben on (rows leave, the rest close up), then
//          Everyone (they come back), with real taps on the people menu (390)
import path from 'node:path';
import fs from 'node:fs';
import { openRig, openApp, PT, sleep, SHOTS, tap, scrollTo } from './v103-rig.mjs';

const want = process.argv.slice(2);
const on = (k) => !want.length || want.includes(k);
const rig = await openRig();
fs.mkdirSync(SHOTS, { recursive: true });
try {
  if (on('now')) {
    for (const [width, label] of [[390, '390'], [1280, '1280']]) {
      const { ctx, page } = await openApp(rig, { now: PT('2026-09-25T09:00:00'), width, height: width >= 720 ? 900 : 844, crew: 'sparse' });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Animation.enable');
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
      const clip = async () => {
        if (width < 720) { const b = await page.locator('#dock').boundingBox(); return { x: 0, y: b.y - 4, width: b.width, height: b.height + 8 }; }
        const b = await page.locator('#day-rail').boundingBox(); return { x: 0, y: b.y, width: 520, height: b.height };
      };
      for (const [phase, when] of [['in', PT('2026-09-25T20:00:00')], ['out', PT('2026-09-28T05:00:00')]]) {
        await page.clock.setFixedTime(when);
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        for (let i = 0; i < 8; i++) {
          await page.screenshot({ path: path.join(SHOTS, `film-${label}-${phase}-${i}.png`), clip: await clip() });
          await sleep(450);
        }
      }
      await ctx.close();
    }
  }
  if (on('thin')) {
    const { ctx, page } = await openApp(rig, { now: PT('2026-09-26T16:15:00'), width: 390, height: 844, view: 'list' });
    await scrollTo(page, '.day-block[data-day="Saturday"] .room[data-room="Afters"]');
    await tap(page, '#dock-you');
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Animation.enable');
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
    for (const [phase, who] of [['on', 'Ben'], ['off', '']]) {
      const b = await page.locator(`#dock-you-wrap .hl-pop [data-person="${who}"]`).boundingBox();
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      for (let i = 0; i < 10; i++) {
        await page.screenshot({ path: path.join(SHOTS, `film-thin-${phase}-${i}.png`), clip: { x: 150, y: 0, width: 240, height: 700 } });
        await sleep(350);
      }
    }
    await ctx.close();
  }
} finally { await rig.close(); }
