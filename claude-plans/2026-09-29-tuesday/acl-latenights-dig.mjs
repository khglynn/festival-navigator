// Dig into two probe oddities (2026-09-29): the rail's active tab on a
// laptop at the Late nights open, and the phone's second NOW tap on Oct 3.
//   node claude-plans/2026-09-29-tuesday/acl-latenights-dig.mjs <spy|now2> [--webkit] [--width=N]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../../tests/helpers/static-server.mjs';
import { nowInView } from '../../tests/helpers/browser.mjs';
import { openAcl, CLOCKS, inView } from './acl-latenights-probe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const what = args[0];
const engineName = args.includes('--webkit') ? 'webkit' : 'chromium';
const width = Number((args.find((a) => a.startsWith('--width=')) || '--width=1280').slice(8));
const pw = await import('playwright');
const browser = await pw[engineName].launch({ headless: true });
const server = await serveStatic(ROOT);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  if (what === 'spy') {
    const { ctx, page, desk } = await openAcl(browser, server.origin, { at: CLOCKS['sep29-4pm'], width });
    const geo = () => page.evaluate((d) => {
      const late = document.querySelector('#wall-root > .day-block[data-day="Late nights"]');
      const sun = document.querySelector('#wall-root > .day-block[data-day="Sunday|W2"]');
      const off = getComputedStyle(document.documentElement).getPropertyValue('--jump-offset');
      const row = document.getElementById(`${d ? 'rail' : 'dock'}-days`);
      return {
        scrollY: window.scrollY, maxY: document.documentElement.scrollHeight - innerHeight, innerHeight,
        jumpOffset: off, lateTop: late.getBoundingClientRect().top, lateH: late.getBoundingClientRect().height,
        lateMargin: getComputedStyle(late).scrollMarginTop, sunTop: sun.getBoundingClientRect().top, sunBottom: sun.getBoundingClientRect().bottom,
        active: [...row.children].filter((t) => t.classList.contains('active')).map((t) => t.textContent),
      };
    }, desk);
    console.log('at open', JSON.stringify(await geo()));
    await sleep(1500);
    console.log('1.5s later', JSON.stringify(await geo()));
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, 40);
    await sleep(800);
    console.log('after a small wheel', JSON.stringify(await geo()));
    await ctx.close();
  } else if (what === 'now2') {
    const { ctx, page, desk } = await openAcl(browser, server.origin, { at: CLOCKS['oct3-9pm'], width });
    const door = desk ? 'rail' : 'dock';
    for (let i = 1; i <= 3; i++) {
      await nowInView(page, door);
      const b = await page.locator(`#${door}-now`).boundingBox();
      const hit = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el && (el.id || el.className || el.tagName); }, [b.x + b.width / 2, b.y + b.height / 2]);
      if (desk) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      else await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await sleep(1500);
      console.log(`tap ${i} (hit ${hit}) scrollY ${await page.evaluate(() => Math.round(scrollY))}`, JSON.stringify(await inView(page)));
    }
    await ctx.close();
  }
} finally { await browser.close(); await server.close(); }
