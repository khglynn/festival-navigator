// Our plan in motion (2026-09-26): two short clips of the PRODUCTION peek and
// panel, driven with real pointer input on round two's rig (the made-up nine,
// /api answered in the page, every write refused, no network, no database).
//   node motion.mjs            both clips
// Each clip lands in ./shots/ as <id>.mp4 (git-ignored), trimmed to start
// when the wall has settled; the frames in frames.mjs are the stills.
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openRig, openApp, sleep } from '../../2026-09-25-portola-live/design/ours-r2/rig.mjs';

const OUT = new URL('./shots/', import.meta.url).pathname;
const RAW = `${OUT}raw/`;
mkdirSync(RAW, { recursive: true });
const SAT_940 = new Date('2026-09-26T21:40:00-07:00');

// A slow hand: n small moves with a pause between, so the drag reads.
async function glide(page, from, to, steps, pause) {
  for (let k = 1; k <= steps; k++) {
    await page.mouse.move(from.x + (to.x - from.x) * (k / steps), from.y + (to.y - from.y) * (k / steps));
    await sleep(pause);
  }
}
const centre = (page, sel) => page.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, sel);

const CLIPS = [
  {
    id: 'M-phone-390', width: 390, height: 844, desktop: false, scale: 2,
    async run(page) {
      await sleep(900);
      const g = await centre(page, '#plan .plan-grab');
      const range = await page.evaluate(() => { const el = document.getElementById('plan'); return el.offsetHeight - Number(el.dataset.peekH); });
      // 1. A slow pull to a quarter, held, let go: under a third it settles back.
      await page.mouse.move(g.x, g.y); await page.mouse.down();
      await glide(page, g, { x: g.x, y: g.y - range * 0.25 }, 14, 40);
      await sleep(500); await page.mouse.up(); await sleep(900);
      // 2. A quick flick up: it opens.
      await page.mouse.move(g.x, g.y); await page.mouse.down();
      await glide(page, g, { x: g.x, y: g.y - 90 }, 4, 12);
      await page.mouse.up(); await sleep(1300);
      // 3. A row tap grows its card under it; the same tap folds it.
      const row = await page.evaluate(() => {
        const r = [...document.querySelectorAll('#plan .plan-row:not(.tagged):not(.earlier):not(.scattered):not(.or)')][1].getBoundingClientRect();
        return { x: r.left + r.width * 0.4, y: r.top + 14 };
      });
      await page.mouse.click(row.x, row.y); await sleep(1400);
      await page.mouse.click(row.x, row.y); await sleep(1000);
      // 4. The grabber closes it.
      const g2 = await centre(page, '#plan .plan-grab');
      await page.mouse.click(g2.x, g2.y); await sleep(1300);
    },
  },
  {
    id: 'M-laptop-1280', width: 1280, height: 800, desktop: true, scale: 1,
    async run(page) {
      await page.mouse.move(640, 400); await sleep(700);
      const c = await centre(page, '#plan .plan-row.tagged');
      await glide(page, { x: 640, y: 400 }, c, 12, 30); await sleep(700);
      await page.mouse.click(c.x, c.y); await sleep(1300);
      // A card beside the panel: its zoom keeps left of it.
      const card = await page.evaluate(() => {
        const side = document.getElementById('plan').getBoundingClientRect().left;
        const hit = [...document.querySelectorAll('#wall-root .card')].map((n) => n.getBoundingClientRect())
          .find((r) => r.right > side - 120 && r.right < side && r.top > 120 && r.bottom < innerHeight - 40);
        return hit ? { x: hit.left + hit.width / 2, y: hit.top + hit.height / 2 } : null;
      });
      // Out to the day rail (no card under the hand), then Escape: a zoom
      // left open would take the first Escape for itself.
      if (card) { await glide(page, c, card, 10, 30); await sleep(1400); await glide(page, card, { x: card.x, y: 30 }, 8, 25); await sleep(700); }
      await page.keyboard.press('Escape'); await sleep(1300);
    },
  },
];

const rig = await openRig();
const newContext = rig.browser.newContext.bind(rig.browser);
try {
  for (const clip of CLIPS) {
    const t0 = Date.now();
    let settledAt = 0;
    rig.browser.newContext = (o) => newContext({ ...o, recordVideo: { dir: RAW, size: { width: clip.width * clip.scale, height: clip.height * clip.scale } } });
    const { ctx, page } = await openApp(rig, { now: SAT_940, width: clip.width, height: clip.height, desktop: clip.desktop });
    settledAt = (Date.now() - t0) / 1000;
    await clip.run(page);
    const video = page.video();
    await ctx.close();
    const raw = await video.path();
    const out = `${OUT}${clip.id}.mp4`;
    rmSync(out, { force: true });
    execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', String(Math.max(0, settledAt - 0.2)), '-i', raw,
      '-vf', `scale=${clip.width * clip.scale}:-2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', '-an', out]);
    renameSync(raw, `${RAW}${clip.id}.webm`);
    console.log(clip.id, 'from', settledAt.toFixed(1), 's →', out);
  }
} finally {
  rig.browser.newContext = newContext;
  await rig.close();
}
