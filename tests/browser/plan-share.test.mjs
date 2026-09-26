// Sharing our picks (the Share build, 2026-09-26), with real input: the open
// plan's "Share our picks" hands the share sheet the day in words and the
// link that opens on the plan; with no share sheet it copies them. A link
// with &plan=open lands a member on the plan open, and a newcomer on the
// welcome card first (its ✕ is Look around by another name), then the plan.
// The Show menu's "Share the crew link" hands over the crew link. The real
// app, the made-up nine (tests/fixtures/plan-crew-nine.json), /api answered
// in the page, every write refused; navigator.share is a stub that keeps what
// it was handed. The words themselves are tests/plan-text.test.mjs's.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { fontsIn, launchBrowser, launchWebkit, lateStarts, motionDone, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NINE = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/plan-crew-nine.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });
const FID = 'portola-2026';
const SAT_940 = new Date('2026-09-26T21:40:00-07:00'); // Dog Blood on the Pier Stage, 8 picked
const QUIET_MS = 450; // the shelf swallows the click just after a tap or a drag (plan-shelf.js quietUntil, 400)

// `share`: a share sheet (a stub keeping its payload) or none. `guest`: no
// name on this phone, so the welcome card comes first. `plan`: the link says
// &plan=open.
async function open(engine, { share = true, guest = false, plan = false, desk = false } = {}) {
  const crewToken = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await engine.newContext({
    viewport: desk ? { width: 1280, height: 800 } : { width: 390, height: 844 },
    hasTouch: !desk, deviceScaleFactor: 2, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block',
    permissions: engine === chromium ? ['clipboard-read', 'clipboard-write'] : [],
  });
  await lateStarts(ctx);
  const doc = {
    v: 4, meta: { name: 'Nine', inviteFestId: FID }, spotify: {}, affinity: {},
    people: Object.fromEntries(NINE.members.map((n, i) => [n, { colorIndex: i }])),
    festivals: { [FID]: { selections: NINE.picks } },
  };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  await ctx.addInitScript(([t, asGuest, withShare]) => {
    if (!asGuest) {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Nine' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Gus');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
    }
    localStorage.setItem('fn_coach_v1', '1');
    localStorage.setItem('fn_errlog_off_v1', '1');
    // The share sheet: a stub that keeps what it was handed and says the
    // person sent it — or no share sheet at all.
    if (withShare) {
      window.__shared = [];
      Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async (d) => { window.__shared.push(d); } });
    } else {
      delete Navigator.prototype.share;
    }
  }, [crewToken, guest, share]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(SAT_940);
  await page.goto(`${server.origin}/#g=${crewToken}&f=${FID}${plan ? '&plan=open' : ''}`);
  await fontsIn(page);
  return { ctx, page, errors, crewToken };
}
const settled = async (page) => { await motionDone(page, { within: '#plan' }); await sleep(QUIET_MS); };
const planState = (page) => page.evaluate(() => {
  const el = document.getElementById('plan');
  return el && !el.hidden ? el.dataset.state : 'none';
});
async function openPlanByGrabber(page) {
  await page.waitForSelector('#plan[data-state="peek"]:not([hidden])', { timeout: 15000 });
  await settled(page);
  const g = await page.locator('#plan .plan-grab').boundingBox();
  await page.mouse.click(g.x + g.width / 2, g.y + g.height / 2);
  await settled(page);
  assert.equal(await planState(page), 'open');
}

for (const [name, get] of [['Chromium', () => chromium], ['WebKit', () => webkit]]) {
  const skip = get() ? false : (name === 'WebKit' ? 'WebKit not installed' : NO_BROWSER);

  test(`${name}: Share our picks hands the share sheet the day in words and the link that opens on the plan — and names no one`, { skip }, async () => {
    const { ctx, page, errors, crewToken } = await open(get());
    try {
      await page.waitForSelector('#plan[data-state="peek"]:not([hidden])', { timeout: 15000 });
      await settled(page);
      const peek = await page.evaluate(() => {
        const f = document.querySelector('#plan .plan-foot');
        return { opacity: getComputedStyle(f).opacity, inert: f.inert };
      });
      assert.deepEqual(peek, { opacity: '0', inert: true }, 'the peek never shows the foot, and a keyboard never reaches it');
      await openPlanByGrabber(page);
      const button = page.locator('#plan .plan-share');
      assert.equal((await button.textContent()).trim(), 'Share our picks');
      await button.click();
      await sleep(100);
      const shared = await page.evaluate(() => window.__shared);
      assert.equal(shared.length, 1, 'one share, one sheet');
      const [{ title, text, url }] = shared;
      assert.equal(title, 'Our picks');
      assert.equal(url, undefined, 'the link rides in the words, where Kevin put it');
      const lines = text.split('\n');
      assert.equal(lines[0], 'Our crew\'s main picks for Sat Portola, now till end of day');
      assert.equal(lines[2], 'Pier Stage for Dog Blood @ now till 10:15pm');
      assert.equal(lines.at(-1), `Full rundown: ${server.origin}/f/${FID}#g=${crewToken}&f=${FID}&plan=open`);
      for (const who of NINE.members) assert.doesNotMatch(text, new RegExp(`\\b${who}\\b`), `${who} is not named`);
      assert.equal(await planState(page), 'open', 'the plan stays open behind the sheet');
      assert.equal(await page.evaluate(() => document.body.dataset.busy || null), null, 'and the busy mark is given back');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: a link with &plan=open lands a member on the plan open, and the address keeps no flag`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { plan: true });
    try {
      await page.waitForSelector('#plan[data-state="open"]:not([hidden])', { timeout: 15000 });
      await settled(page);
      assert.equal(await planState(page), 'open');
      assert.doesNotMatch(await page.evaluate(() => location.hash), /plan=/, 'read once: a reload or a copied address does not open it again');
      const g = await page.evaluate(() => {
        const el = document.getElementById('plan').getBoundingClientRect();
        return { top: el.top, dock: document.getElementById('dock').getBoundingClientRect().top };
      });
      assert.ok(g.top < g.dock - 200, `open, not a peek: ${JSON.stringify(g)}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: a newcomer's &plan=open waits for the welcome card; its ✕, upper right, lets the plan rise open`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { guest: true, plan: true });
    try {
      await page.waitForSelector('#welcome-card', { timeout: 15000 });
      await motionDone(page, { within: '#welcome-card' });
      await sleep(600);
      assert.notEqual(await planState(page), 'open', 'nothing opens over the card');
      const place = await page.evaluate(() => {
        const card = document.querySelector('#welcome-card .bring-card').getBoundingClientRect();
        const x = document.querySelector('#welcome-card .sheet-close');
        const r = x.getBoundingClientRect();
        return { label: x.getAttribute('aria-label'), right: card.right - r.right, top: r.top - card.top, width: r.width };
      });
      assert.equal(place.label, 'Close');
      assert.ok(place.right >= 0 && place.right <= 16 && place.top >= 0 && place.top <= 16, `in the card's upper right: ${JSON.stringify(place)}`);
      await page.locator('#welcome-card .sheet-close').click();
      await page.waitForSelector('#welcome-card', { state: 'detached', timeout: 5000 });
      await page.waitForSelector('#plan[data-state="open"]:not([hidden])', { timeout: 5000 });
      await settled(page);
      assert.equal(await planState(page), 'open', 'the plan the link was for');
      assert.equal(await page.evaluate(() => localStorage.getItem('fn_welcome_v1')), '1', 'the card is read, as Look around marks it');
      assert.deepEqual(errors.filter((e) => !/^ResizeObserver loop/.test(e)), []);
    } finally { await ctx.close(); }
  });

  test(`${name}: Share the crew link, in the Show menu — the crew link with the invite words, and the menu gives way`, { skip }, async () => {
    const { ctx, page, errors, crewToken } = await open(get());
    try {
      await page.waitForSelector('#plan[data-state="peek"]:not([hidden])', { timeout: 15000 });
      await settled(page);
      await page.locator('#dock-fest-link').click();
      const row = page.locator('#dock-fest-wrap .sort-pop .share-link');
      await row.waitFor({ state: 'visible' });
      assert.equal((await row.locator('.w').textContent()).trim(), 'Share the crew link');
      assert.equal(await row.locator('.opens').isHidden(), true, 'everything, as a board: nothing to say');
      await row.click();
      await sleep(300);
      const shared = await page.evaluate(() => window.__shared);
      assert.equal(shared.length, 1);
      assert.equal(shared[0].title, 'Festival Navigator');
      assert.match(shared[0].text, /^Come see what we’ve picked for Portola\./);
      assert.equal(shared[0].url, `${server.origin}/f/${FID}#g=${crewToken}&f=${FID}`, 'the crew link: no name, no plan flag');
      assert.equal(await page.locator('#dock-fest-link').getAttribute('aria-expanded'), 'false', 'the menu gave way to the sheet');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// Copying needs the clipboard, which Playwright grants only in Chromium.
test('Chromium, no share sheet: Copy our picks copies the same words, and the button says so', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors, crewToken } = await open(chromium, { share: false });
  try {
    await openPlanByGrabber(page);
    const button = page.locator('#plan .plan-share');
    assert.equal((await button.textContent()).trim(), 'Copy our picks');
    await button.click();
    await sleep(100);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(copied, /^Our crew's main picks for Sat Portola, now till end of day\n\nPier Stage for Dog Blood @ now till 10:15pm\n/);
    assert.ok(copied.endsWith(`Full rundown: ${server.origin}/f/${FID}#g=${crewToken}&f=${FID}&plan=open`));
    assert.equal((await button.textContent()).trim(), 'Copied ✓');
    await sleep(1900);
    assert.equal((await button.textContent()).trim(), 'Copy our picks', 'and goes back to its words');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('Chromium touch: a finger on Share our picks shares — it is a button, never a handle for the window', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors } = await open(chromium);
  try {
    await openPlanByGrabber(page);
    const b = await page.locator('#plan .plan-share').boundingBox();
    const before = await page.evaluate(() => document.getElementById('plan').getBoundingClientRect().top);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await sleep(200);
    assert.equal((await page.evaluate(() => window.__shared)).length, 1, 'the tap shared');
    assert.equal(await planState(page), 'open', 'and the plan did not move');
    assert.equal(await page.evaluate(() => document.getElementById('plan').getBoundingClientRect().top), before);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
