// Look at the canvas in ONE headless Chromium, then close it (this Mac is
// short on memory: never leave a browser up).
//   PW=/path/to/node_modules/playwright OUT=/some/scratch/dir node checks/shot.mjs <width> [selector ...]
// Screenshots go to OUT (never into the repo: .gitignore denies images, and a
// stray PNG in a public repo is how a token leaks). Prints console errors.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || 'playwright');
const HERE = new URL('..', import.meta.url).pathname;
const OUT = process.env.OUT || '/tmp';
const width = Number(process.argv[2] || 1280);
const sels = process.argv.slice(3);
const phone = width < 500;

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`file://${HERE}canvas.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(`width ${width}: page overflow ${overflow}px`);
  for (const [i, sel] of (sels.length ? sels : ['body']).entries()) {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const file = `${OUT}/w${width}-${i}-${sel.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.png`;
    await el.screenshot({ path: file });
    console.log('shot', file);
  }
  if (errors.length) console.log(errors.join('\n')); else console.log('no console errors');
} finally {
  await browser.close();
}
