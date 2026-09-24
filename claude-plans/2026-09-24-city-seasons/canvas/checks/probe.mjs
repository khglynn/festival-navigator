// Run one expression in the canvas (one headless Chromium, closed after).
//   PW=… node checks/probe.mjs <width> '<js expression returning JSON-able>'
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || 'playwright');
const HERE = new URL('..', import.meta.url).pathname;
const width = Number(process.argv[2] || 1280);
const expr = process.argv[3] || 'document.title';
const phone = width < 500;
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, hasTouch: phone, isMobile: phone });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`file://${HERE}canvas.html`);
  await page.evaluate(() => document.fonts.ready);
  if (process.env.SCROLL) { await page.locator(process.env.SCROLL).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(600); }
  const out = await page.evaluate(`(async () => (${expr}))()`);
  console.log(JSON.stringify(out, null, 1));
  if (errors.length) console.log(errors.join('\n'));
} finally {
  await browser.close();
}
