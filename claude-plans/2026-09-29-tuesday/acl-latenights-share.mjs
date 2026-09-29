// Our picks tonight: open the peek with a real tap, read the open plan, and
// send the Share (navigator.share stubbed in the page) at 8:20 PM, 11:59 PM.
//   node claude-plans/2026-09-29-tuesday/acl-latenights-share.mjs [--webkit] [--width=N]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../../tests/helpers/static-server.mjs';
import { motionDone } from '../../tests/helpers/browser.mjs';
import { openAcl, CLOCKS } from './acl-latenights-probe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const engineName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const width = Number((process.argv.find((a) => a.startsWith('--width=')) || '--width=390').slice(8));
const pw = await import('playwright');
const browser = await pw[engineName].launch({ headless: true });
const server = await serveStatic(ROOT);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (const id of ['sep29-820pm', 'sep29-1159pm']) {
    const { ctx, page, desk, token, errors } = await openAcl(browser, server.origin, { at: CLOCKS[id], width });
    const press = async (sel) => {
      const b = await page.locator(sel).first().boundingBox();
      if (desk) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      else await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await sleep(600);
      await motionDone(page, { within: '#plan' }).catch(() => {});
      await sleep(450);
    };
    await press('#plan .plan-grab');
    const open = await page.evaluate(() => {
      const el = document.getElementById('plan');
      return { state: el.dataset.state, rows: [...el.querySelectorAll('.plan-list > *')].slice(0, 6).map((r) => r.textContent.replace(/\s+/g, ' ').trim().slice(0, 120)), share: el.querySelector('.plan-share').textContent.trim() };
    });
    await page.mouse.click(0, 0).catch(() => {});
    const b = await page.locator('#plan .plan-share').boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await sleep(800);
    const shared = await page.evaluate(() => (window.__shared || []).map((d) => d.text));
    console.log(`\n== ${engineName} ${width} ${id}`, JSON.stringify(open, null, 1));
    console.log((shared[shared.length - 1] || '(nothing shared)').split(token).join('TOKEN').split(server.origin).join('ORIGIN'));
    console.log('errors', JSON.stringify(errors()));
    await ctx.close();
  }
} finally { await browser.close(); await server.close(); }
