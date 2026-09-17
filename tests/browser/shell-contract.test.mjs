// The app shell's contract in a real browser (2026-09-16), with real input.
//
// index.html's new-build glue decides "in progress" partly from LAYOUT — a
// field counts only while it is on screen (getClientRects), so the bad-link
// input a hidden screen still holds a value in never pins an old build. jsdom
// has no layout, so tests/new-build-reload.test.mjs has to fake that part;
// this file is where it is real. The worker itself is blocked: the takeover is
// the controllerchange event the glue listens for, dispatched on the real
// ServiceWorkerContainer.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REQUIRED = !!process.env.BROWSER_TEST_REQUIRED; // CI: a missing browser is a failure, not a skip
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const { chromium } = await import('playwright');
  try { return await chromium.launch({ headless: true }); } catch (e) {
    try { return await chromium.launch({ channel: 'chrome', headless: true }); } catch {
      if (REQUIRED) throw e;
      return null;
    }
  }
}

const server = await serveStatic(ROOT);
const browser = await launch();
test.after(async () => { if (browser) await browser.close(); await server.close(); });
const skip = browser ? false : 'no browser available (npx playwright install chromium, or install Chrome)';

async function phone() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  // A blocked worker's register() resolves to nothing; the glue's update
  // checks want a registration to call.
  await ctx.addInitScript(() => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  return { ctx, page };
}

test('a new build waits for words on screen, ignores a hidden screen\'s, and reloads the first quiet moment', { skip }, async () => {
  const { ctx, page } = await phone();
  try {
    await page.goto(`${server.origin}/#g=cut`, { waitUntil: 'load' }); // a clipped link: the bad-link screen, with an input
    await page.waitForSelector('#screen-badlink', { state: 'visible' });
    const takeover = () => page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
    const recheck = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const samePage = () => page.evaluate(() => window.__samePage === true);
    await page.evaluate(() => { window.__samePage = true; });

    await takeover(); // the first worker to claim the page serves the build it runs
    assert.ok(await samePage(), 'no reload on the first claim');

    await page.click('#badlink-input');
    await page.keyboard.type('https://fest.kevinhg.com/#g=half');
    await page.mouse.click(8, 8); // focus leaves; the words stay
    await takeover();
    await sleep(150);
    assert.ok(await samePage(), 'typed words on screen hold the reload');
    assert.ok(await page.evaluate(() => !!document.getElementById('new-build-strip')), 'and the notice is up');
    await recheck();
    assert.ok(await samePage(), 'a re-check still sees them');

    // Words parked on a screen that is not showing are not work in progress.
    await page.evaluate(() => { document.getElementById('join-name-input').value = 'left over'; });
    await page.fill('#badlink-input', '');
    await page.mouse.click(8, 8);
    const reloaded = page.waitForEvent('load', { timeout: 5000 });
    await recheck();
    await reloaded;
    assert.equal(await page.evaluate(() => window.__samePage), undefined, 'the first quiet re-check reloaded the page');
  } finally {
    await ctx.close();
  }
});

test('a cold open waiting on the crew shows the loader after a beat, and the wall removes it', { skip }, async () => {
  const { ctx, page } = await phone();
  const TOKEN = 'shellcontract_0123456789'; // a made-up crew
  const FID = 'seismic-9';
  try {
    await ctx.addInitScript(([t, f]) => {
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    }, [TOKEN, FID]);
    const doc = { v: 4, meta: { name: 'Contract', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
    let answer;
    const crewAnswered = new Promise((r) => { answer = r; });
    await ctx.route('**/api/crew**', async (route) => { await crewAnswered; await route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }); });
    await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
    await ctx.route('**/api/person**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));

    await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
    const loaderOpacity = () => page.evaluate(() => {
      const el = document.getElementById('screen-boot');
      return el ? Number(getComputedStyle(el).opacity) : null;
    });
    assert.equal(await loaderOpacity(), 0, 'present, and not yet seen — a quick boot never flashes it');
    await sleep(900);
    assert.equal(await loaderOpacity(), 1, 'a slow boot shows it');
    assert.ok(await page.isVisible('#screen-boot .eq-loader'));

    answer();
    await page.waitForSelector('#screen-app', { state: 'visible', timeout: 10000 });
    assert.equal(await loaderOpacity(), null, 'gone with the first screen');
  } finally {
    await ctx.close();
  }
});
