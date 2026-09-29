// What grows above the Late nights block after the open lands (WebKit 1280).
//   node claude-plans/2026-09-29-tuesday/acl-latenights-dig2.mjs [--webkit] [--width=N]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../../tests/helpers/static-server.mjs';
import { openAcl, CLOCKS } from './acl-latenights-probe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const engineName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const width = Number((process.argv.find((a) => a.startsWith('--width=')) || '--width=1280').slice(8));
const pw = await import('playwright');
const browser = await pw[engineName].launch({ headless: true });
const server = await serveStatic(ROOT);
try {
  const ctxHook = browser.newContext.bind(browser);
  browser.newContext = async (o) => {
    const c = await ctxHook(o);
    await c.addInitScript(() => {
      window.__lands = [];
      const snap = (why) => {
        const blocks = [...document.querySelectorAll('#wall-root > .day-block')].map((b) => `${b.dataset.day}:${Math.round(b.getBoundingClientRect().height)}`);
        const root = document.getElementById('wall-root');
        const late = document.querySelector('#wall-root > .day-block[data-day="Late nights"]');
        window.__lands.push({ why, t: Math.round(performance.now()), y: Math.round(scrollY), rootTop: root ? Math.round(root.getBoundingClientRect().top + scrollY) : null, lateTop: late ? Math.round(late.getBoundingClientRect().top) : null, blocks: blocks.join(' '), fonts: document.fonts.status });
      };
      window.__snap = snap;
      const st = window.scrollTo.bind(window);
      window.scrollTo = (...a) => { st(...a); snap(`scrollTo ${JSON.stringify(a)}`); };
    });
    return c;
  };
  const { ctx, page } = await openAcl(browser, server.origin, { at: CLOCKS['sep29-4pm'], width });
  await page.evaluate(() => window.__snap('end'));
  const lands = await page.evaluate(() => window.__lands);
  for (const l of lands) console.log(JSON.stringify(l));
  await ctx.close();
} finally { await browser.close(); await server.close(); }
