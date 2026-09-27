// Sharing our picks (the Share build, 2026-09-26), with real input: the open
// plan's "Share our picks" hands the share sheet the day in words and the
// link that opens on the plan; with no share sheet it copies them. A link
// with &plan=<its night> lands a member on the plan open, and a newcomer on the
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
const SAT = '2026-09-26';
const QUIET_MS = 450; // the shelf swallows the click just after a tap or a drag (plan-shelf.js quietUntil, 400)

// `share`: a share sheet (a stub keeping its payload), 'refuses' (a sheet
// the browser will not raise: it rejects NotAllowedError), or none. `guest`:
// no name on this phone, so the welcome card comes first. `plan`: the link
// says &plan=<night> (true: Saturday's, the night the clock is on).
// `linkFest`: the festival the link names (this phone keeps the crew on
// Portola). `mobile`: a phone's coarse pointer (Chromium). `at`: the clock.
// `before(ctx)`: a test's own init scripts, ahead of the app's.
async function open(engine, { share = true, guest = false, plan = false, desk = false, linkFest = FID, mobile = false, at = SAT_940, before = null } = {}) {
  const crewToken = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await engine.newContext({
    viewport: desk ? { width: 1280, height: 800 } : { width: 390, height: 844 },
    hasTouch: !desk, isMobile: mobile, deviceScaleFactor: 2, timezoneId: 'America/Los_Angeles', serviceWorkers: 'block',
    permissions: engine === chromium ? ['clipboard-read', 'clipboard-write'] : [],
  });
  await lateStarts(ctx);
  if (before) await before(ctx);
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
    // person sent it — or no share sheet at all. 'waits' stays up until the
    // test calls window.__closeSheet() (one call per sheet, oldest first).
    if (withShare) {
      window.__shared = [];
      window.__closeSheet = () => window.__sheets.shift()();
      const refuses = withShare === 'refuses';
      const waits = withShare === 'waits';
      Object.defineProperty(Navigator.prototype, 'share', {
        configurable: true,
        value: async (d) => {
          window.__shared.push(d);
          if (waits) await new Promise((done) => { (window.__sheets = window.__sheets || []).push(done); });
          if (refuses) throw new DOMException('Not allowed', 'NotAllowedError');
        },
      });
    } else {
      delete Navigator.prototype.share;
    }
  }, [crewToken, guest, share]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(at);
  await page.goto(`${server.origin}/#g=${crewToken}&f=${linkFest}${plan ? `&plan=${plan === true ? SAT : plan}` : ''}`);
  await fontsIn(page);
  return { ctx, page, errors, crewToken };
}
const settled = async (page) => { await motionDone(page, { within: '#plan' }); await sleep(QUIET_MS); };
// Poll from Node, in real time, until `ok` (a timer inside the page runs on
// the fake clock: the harness traps).
async function until(ok, what, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await ok()) return; await sleep(50); }
  assert.fail(`timed out waiting: ${what}`);
}
// The or-line under the NOW row (planList draws it after the row and its
// grown card, keyed to the row's stop).
const orLine = (page) => page.evaluate(() => {
  const now = document.querySelector('#plan .plan-row.tagged');
  const or = now && document.querySelector(`#plan .plan-row.or[data-stop="or|${CSS.escape(now.dataset.stop)}"]`);
  return or ? or.textContent : '';
});
// Every picks line of a shared text is a row the open plan is showing (a
// set by its place and act; a room by its place and first act named).
async function linesInRows(page, text) {
  const rows = await page.evaluate(() => [...document.querySelectorAll('#plan .plan-row:not(.past):not(.earlier)')].map((r) => r.textContent));
  const lines = text.split('\n');
  const picks = lines.slice(2, lines.indexOf('', 2));
  for (const line of picks) {
    const [where, act] = line.split(' @ ')[0].split(' for ');
    assert.ok(rows.some((r) => r.includes(where) && (!act || r.includes(act.split(/, | and /)[0]))), `"${line}" is a row in the open plan:\n${rows.join('\n')}`);
  }
  return picks;
}
// 5:59 to 6:00 changes nothing the rows showed before but the or-line: the same
// NOW, the same count, nothing newly over (checked minute by minute).
const SAT_559 = new Date('2026-09-26T17:59:30-07:00'); // Tove Lo on the Pier Stage; or Groove Armada, till 6
const SAT_6 = new Date('2026-09-26T18:00:30-07:00'); // Groove Armada's set is over: the or-line is DJ Shadow's
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
      assert.equal(lines.at(-1), `Full rundown: ${server.origin}/f/${FID}#g=${crewToken}&f=${FID}&plan=${SAT}`);
      for (const who of NINE.members) assert.doesNotMatch(text, new RegExp(`\\b${who}\\b`), `${who} is not named`);
      assert.equal(await planState(page), 'open', 'the plan stays open behind the sheet');
      assert.equal(await page.evaluate(() => document.body.dataset.busy || null), null, 'and the busy mark is given back');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: a link with &plan=<tonight> lands a member on the plan open, and the address keeps no flag`, { skip }, async () => {
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

  test(`${name}: a newcomer's plan link waits for the welcome card; its ✕, upper right, lets the plan rise open`, { skip }, async () => {
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

  // The wish is for the link's festival. This phone keeps the crew on
  // Portola, so an ACL plan link lands on Portola — and Portola's plan,
  // which is not what the link was about, stays a peek.
  test(`${name}: a plan link for another festival lands on this phone's festival, and opens nothing`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { plan: true, linkFest: 'acl-2026' });
    try {
      await page.waitForSelector('#plan[data-state="peek"]:not([hidden])', { timeout: 15000 });
      await settled(page);
      await sleep(600);
      assert.equal(await planState(page), 'peek', 'Portola\'s plan is not the ACL plan the link named');
      assert.doesNotMatch(await page.evaluate(() => location.hash), /plan=/);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The wish is for the link's night too (Sol, on the release head): the
  // words were about Friday, so on Saturday the link lands on the wall and
  // Saturday's plan, which is not what it was about, stays a peek.
  test(`${name}: a plan link for another night lands on the wall, and opens nothing`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { plan: '2026-09-25' });
    try {
      await page.waitForSelector('#plan[data-state="peek"]:not([hidden])', { timeout: 15000 });
      await settled(page);
      await page.waitForFunction(() => !/plan=/.test(location.hash), null, { timeout: 5000 });
      assert.equal(await planState(page), 'peek', 'Saturday\'s plan is not the Friday plan the link was about');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // Sunday 8:10 PM (Sol, on the release head): Zara Larsson ended at 8:05,
  // and the route's stop for her runs on to 8:15 (a ten-minute blip at the
  // Warehouse folds into it) — the Share said "now till 8:05pm". It now
  // starts with what is still on, and every line it sends is a row the open
  // plan is showing (round two: the Share had named an or-line the rows never
  // draw). The peek's own "NOW · till 8:05 PM" for those ten minutes is v101's
  // and stays for now; the model's fix is the plan-days design round's.
  test(`${name}: Sunday 8:10 PM, the Share leads with what is still on, and every line it sends is a row in the open plan`, { skip }, async () => {
    const { ctx, page, errors, crewToken } = await open(get(), { at: new Date('2026-09-27T20:10:00-07:00') });
    try {
      await openPlanByGrabber(page);
      await page.locator('#plan .plan-share').click();
      await sleep(100);
      const [{ text }] = await page.evaluate(() => window.__shared);
      const lines = text.split('\n');
      assert.equal(lines[0], 'Our crew\'s main picks for Sun Portola, now till end of day');
      assert.equal(lines[2], 'Warehouse for Tiësto @ now till 8:15pm');
      assert.doesNotMatch(text, /Zara Larsson|till 8:05/);
      assert.equal(lines.at(-1), `Full rundown: ${server.origin}/f/${FID}#g=${crewToken}&f=${FID}&plan=2026-09-27`, 'the link names the night the words are about');
      assert.equal((await linesInRows(page, text)).length, 5);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // Sol, round three on the release head (2026-09-26): at Saturday 6:00 PM
  // the NOW row's or-line moves on (Groove Armada's set under Tove Lo ends;
  // DJ Shadow's is still to come), but the open plan's repaint signature had
  // no or-line in it: a plan left open kept Groove Armada, and the Share, on
  // the fresh minute, could name the other. The rows now repaint when their
  // or-line changes, and the Share draws the plan at the current minute and
  // reads the very answer that drawing used.
  test(`${name}: a plan left open across Saturday 6:00 PM — the NOW row's or-line moves on from Groove Armada to DJ Shadow`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { at: SAT_559 });
    try {
      await openPlanByGrabber(page);
      assert.match(await orLine(page), /Groove Armada/, 'at 5:59 the or-line is Groove Armada');
      await page.clock.setFixedTime(SAT_6);
      // The minute's tick as its interval runs it (app.js tickClock). A shown
      // page also judges the past again (recomputePast), which repaints the
      // wall and with it everything; a busy page skips that part (pastMayMove),
      // so this is the tick alone.
      await page.evaluate(() => {
        document.body.dataset.busy = 'test-tick';
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.body.dataset.busy;
      });
      await until(async () => /DJ Shadow/.test(await orLine(page)), 'the or-line moves on to DJ Shadow');
      assert.equal(await planState(page), 'open');
      // The dispatched visibilitychange also reaches index.html's ask for a
      // new worker, which under serviceWorkers: 'block' has no registration
      // (the rig's, as in plan-drag).
      assert.deepEqual(errors.filter((e) => !/reg\.update|reading 'update'/.test(e)), []);
    } finally { await ctx.close(); }
  });

  test(`${name}: Share at Saturday 6:00 PM, before the minute's tick — the plan is drawn at this minute, and every line shared is one of its rows`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { at: SAT_559 });
    try {
      await openPlanByGrabber(page);
      assert.match(await orLine(page), /Groove Armada/);
      await page.clock.setFixedTime(SAT_6);
      await page.locator('#plan .plan-share').click();
      await until(() => page.evaluate(() => window.__shared.length === 1), 'one share');
      assert.match(await orLine(page), /DJ Shadow/, 'the tap drew the plan at this minute');
      const [{ text }] = await page.evaluate(() => window.__shared);
      assert.equal(text.split('\n')[0], 'Our crew\'s main picks for Sat Portola, now till end of day');
      assert.doesNotMatch(text, /Groove Armada/, 'a set over at 6:00 is not shared');
      assert.ok((await linesInRows(page, text)).length > 0);
      assert.equal(await planState(page), 'open');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // "Pick shows" on the welcome card reads the card and raises the join
  // shelf: the plan waits behind the question, and opens when it is left.
  // Sol, round four (2026-09-26): a paint that comes in under a hand on the
  // window waits for the hand (the rows would jump from under it), so a
  // Share tapped by a second finger — or a key — while the first holds the
  // grabber found the rows still on the last minute, and read its words
  // from them. It sends nothing now; the tap after the hand lets go shares
  // the rows the release drew.
  test(`${name}: a hand holding the grabber across Saturday 6:00 PM — a Share tapped meanwhile sends nothing; after the hand lets go it shares the plan the release drew`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { at: SAT_559 });
    try {
      await openPlanByGrabber(page);
      assert.match(await orLine(page), /Groove Armada/);
      const g = await page.locator('#plan .plan-grab').boundingBox();
      const x = g.x + g.width / 2;
      const y = g.y + g.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let k = 1; k <= 4; k++) { await page.mouse.move(x, y + k * 6); await sleep(16); }
      await page.clock.setFixedTime(SAT_6);
      await page.locator('#plan .plan-share').focus();
      await page.keyboard.press('Enter');
      await sleep(300);
      assert.equal(await page.evaluate(() => window.__shared.length), 0, 'no words from rows a held paint left on 5:59');
      assert.match(await orLine(page), /Groove Armada/, 'the rows wait for the hand');
      for (let k = 3; k >= 0; k--) { await page.mouse.move(x, y + k * 6); await sleep(16); }
      await sleep(120);
      await page.mouse.up();
      await settled(page);
      assert.equal(await planState(page), 'open');
      assert.match(await orLine(page), /DJ Shadow/, 'the release drew this minute');
      await page.locator('#plan .plan-share').click();
      await until(() => page.evaluate(() => window.__shared.length === 1), 'one share');
      const [{ text }] = await page.evaluate(() => window.__shared);
      assert.doesNotMatch(text, /Groove Armada/);
      assert.ok((await linesInRows(page, text)).length > 0);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // Sol, round four: the page's busy mark has one owner, and a Share that
  // found it taken (a laptop's Earlier fold, a hand on the window) held
  // nothing of its own — when that owner let go, a new build could reload
  // the page under the share sheet. A share keeps its own mark,
  // data-sharing, which index.html's quiet() reads beside the busy one.
  test(`${name}: Share our picks holds a new build's reload for as long as the sheet is up, whoever held the page's busy mark before it`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { share: 'waits' });
    try {
      await openPlanByGrabber(page);
      await page.evaluate(() => { document.body.dataset.busy = 'past'; }); // a wall's Earlier fold in flight
      await page.locator('#plan .plan-share').click();
      await until(() => page.evaluate(() => window.__shared.length === 1), 'the sheet is up');
      await page.evaluate(() => { delete document.body.dataset.busy; }); // the fold lands
      assert.equal(await page.evaluate(() => document.body.dataset.sharing), 'plan', 'the sheet still holds the reload');
      await page.evaluate(() => window.__closeSheet());
      await until(() => page.evaluate(() => document.body.dataset.sharing === undefined), 'the sheet lets go');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // Sol's check on the release head (2026-09-26): three holes in that mark.
  // Two shares at once — the first to settle took the mark away from the
  // second; each share holds it now, and it stays until the last settles.
  test(`${name}: two shares at once — the reload stays held until both sheets have answered`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { share: 'waits' });
    try {
      await openPlanByGrabber(page);
      const share = page.locator('#plan .plan-share');
      await share.click();
      await until(() => page.evaluate(() => window.__shared.length === 1), 'the first sheet is up');
      await share.click();
      await until(() => page.evaluate(() => window.__shared.length === 2), 'the second sheet is up');
      await page.evaluate(() => window.__closeSheet());
      await sleep(100);
      assert.equal(await page.evaluate(() => document.body.dataset.sharing), 'plan', 'one sheet still up: still held');
      await page.evaluate(() => window.__closeSheet());
      await until(() => page.evaluate(() => document.body.dataset.sharing === undefined), 'both answered');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // The page put away with a sheet still up (the back/forward cache keeps
  // it, promise and all): the mark goes with the page, so the page that
  // comes back can take a new build.
  test(`${name}: the page put away mid-share lets go of the reload, and a sheet that answers later changes nothing`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { share: 'waits' });
    try {
      await openPlanByGrabber(page);
      await page.locator('#plan .plan-share').click();
      await until(() => page.evaluate(() => document.body.dataset.sharing === 'plan'), 'the sheet holds the reload');
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      assert.equal(await page.evaluate(() => document.body.dataset.sharing), undefined, 'put away: let go');
      await page.evaluate(() => window.__closeSheet());
      await sleep(100);
      assert.equal(await page.evaluate(() => document.body.dataset.sharing), undefined, 'the late answer holds nothing');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  // Back to the tab with a sheet still up: the past is not judged again under
  // it (app.js pastMayMove), so the wall and the plan behind the sheet stay
  // as they are. Held here by element identity: that judging repaints the
  // wall, which builds the plan again with it.
  test(`${name}: back to the tab with a sheet still up — the wall and the plan behind it are not repainted`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { share: 'waits' });
    try {
      await openPlanByGrabber(page);
      await page.locator('#plan .plan-share').click();
      await until(() => page.evaluate(() => window.__shared.length === 1), 'the sheet is up');
      await page.evaluate(() => {
        document.querySelector('#plan .plan-list').dataset.seen = '1';
        document.querySelector('#wall-root .card').dataset.seen = '1';
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await sleep(300);
      const still = await page.evaluate(() => ({
        plan: document.querySelector('#plan .plan-list').dataset.seen === '1',
        wall: document.querySelector('#wall-root .card').dataset.seen === '1',
      }));
      assert.deepEqual(still, { plan: true, wall: true });
      await page.evaluate(() => window.__closeSheet());
      // The dispatched visibilitychange also reaches index.html's ask for a
      // new worker (the rig blocks workers: plan-drag's filter).
      assert.deepEqual(errors.filter((e) => !/reg\.update|reading 'update'/.test(e)), []);
    } finally { await ctx.close(); }
  });

  test(`${name}: Share the crew link holds a new build's reload for as long as the sheet is up, whoever held the page's busy mark before it`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { share: 'waits' });
    try {
      await page.waitForSelector('#plan[data-state="peek"]:not([hidden])', { timeout: 15000 });
      await settled(page);
      await page.evaluate(() => { document.body.dataset.busy = 'past'; }); // held before the menu opened
      await page.locator('#dock-fest-link').click();
      const row = page.locator('#dock-fest-wrap .sort-pop .share-link');
      await row.waitFor({ state: 'visible' });
      await row.click();
      await until(() => page.evaluate(() => window.__shared.length === 1), 'the sheet is up');
      await page.evaluate(() => { delete document.body.dataset.busy; });
      assert.equal(await page.evaluate(() => document.body.dataset.sharing), 'crew', 'the sheet still holds the reload');
      await page.evaluate(() => window.__closeSheet());
      await until(() => page.evaluate(() => document.body.dataset.sharing === undefined), 'the sheet lets go');
      assert.equal(await page.locator('#dock-fest-link').getAttribute('aria-expanded'), 'false', 'the menu goes once the sheet has its answer');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });

  test(`${name}: a newcomer's plan link waits behind the join shelf, and opens when Look around leaves it`, { skip }, async () => {
    const { ctx, page, errors } = await open(get(), { guest: true, plan: true });
    try {
      await page.waitForSelector('#welcome-card', { timeout: 15000 });
      await motionDone(page, { within: '#welcome-card' });
      await page.locator('#welcome-card .welcome-join').click();
      await page.waitForSelector('.join-shelf', { timeout: 5000 });
      await page.waitForSelector('#welcome-card', { state: 'detached', timeout: 5000 });
      // The card's leaving repaints the plan (app.js's card observer): the
      // peek rises behind the question — and does not open under it.
      await page.waitForSelector('#plan[data-state="peek"]:not([hidden])', { timeout: 5000 });
      await settled(page);
      assert.equal(await planState(page), 'peek', 'nothing opens under the question');
      await motionDone(page, { within: '.join-shelf' });
      await page.locator('.join-shelf .js-look').click();
      await page.waitForSelector('#plan[data-state="open"]:not([hidden])', { timeout: 5000 });
      await settled(page);
      assert.equal(await planState(page), 'open', 'the plan the link was for');
      assert.equal(await page.locator('.join-shelf').count(), 0);
      assert.deepEqual(errors.filter((e) => !/^ResizeObserver loop/.test(e)), []);
    } finally { await ctx.close(); }
  });

  test(`${name}: Share the crew link, in the Show menu — the crew link with the invite words, and the menu goes when the sheet is done`, { skip }, async () => {
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
      assert.equal(await page.locator('#dock-fest-link').getAttribute('aria-expanded'), 'false', 'the menu goes once the sheet has its answer');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// A member's landing opens the plan after the peek has risen (plan-shelf.js
// afterArrival), never during the rise: an open then cancelled the arrival,
// and the peek appeared in its place for a frame before it grew. The peek's
// arrival is held to a minute here (its animation, the first one #plan
// plays), so the order is read from states, not from sampled frames, which
// a starved boot makes worthless. Held, the plan is still the peek; ended,
// it opens; cut short (a hand caught it), nothing opens.
async function landHeld(page) {
  await page.waitForSelector('#plan[data-state="peek"]:not([hidden])', { timeout: 15000 });
  await page.waitForFunction(() => !!window.__arrival, null, { timeout: 5000 });
  await sleep(800);
  return page.evaluate(() => ({ state: document.getElementById('plan').dataset.state, arriving: window.__arrival.playState }));
}
const holdArrival = (ctx) => ctx.addInitScript(() => {
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (keys, opts) {
    const first = this.id === 'plan' && !window.__arrival;
    const a = animate.call(this, keys, first ? { ...opts, duration: 60000 } : opts);
    if (first) window.__arrival = a;
    return a;
  };
});
test('Chromium: a member\'s plan link lets the peek rise first, then opens the plan', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors } = await open(chromium, { plan: true, before: holdArrival });
  try {
    const held = await landHeld(page);
    assert.deepEqual(held, { state: 'peek', arriving: 'running' }, 'mid-rise, the plan waits: the arrival plays on');
    await page.evaluate(() => window.__arrival.finish());
    await page.waitForSelector('#plan[data-state="open"]:not([hidden])', { timeout: 5000 });
    await settled(page);
    const g = await page.evaluate(() => ({ top: document.getElementById('plan').getBoundingClientRect().top, dock: document.getElementById('dock').getBoundingClientRect().top }));
    assert.ok(g.top < g.dock - 200, `and once it has landed, the plan grows open: ${JSON.stringify(g)}`);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
test('Chromium: a plan link whose peek was caught mid-rise opens nothing', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors } = await open(chromium, { plan: true, before: holdArrival });
  try {
    assert.equal((await landHeld(page)).state, 'peek');
    await page.evaluate(() => window.__arrival.cancel()); // what a hand on the rising peek does (caughtAt)
    await sleep(800);
    assert.equal(await planState(page), 'peek', 'the person took over: the link opens nothing');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
// The rise ends on another screen: Settings opened while the peek rose. The
// link's open was for the wall it landed on, so nothing opens behind
// Settings, and the wall comes back with its peek (Sol, 2026-09-26).
test('Chromium: a plan link whose peek is still rising when Settings opens opens nothing, there or back on the wall', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors } = await open(chromium, { plan: true, before: holdArrival });
  try {
    assert.equal((await landHeld(page)).state, 'peek');
    await page.click('#gear-btn');
    await page.waitForSelector('#screen-settings', { state: 'visible', timeout: 5000 });
    await page.evaluate(() => window.__arrival.finish());
    await sleep(600);
    assert.equal(await planState(page), 'peek', 'nothing opens behind Settings');
    await page.goBack();
    await page.waitForSelector('#screen-app', { state: 'visible', timeout: 5000 });
    await settled(page);
    assert.equal(await planState(page), 'peek', 'back on the wall, the plan is its peek');
    assert.deepEqual(errors.filter((e) => !/reg\.update|reading 'update'/.test(e)), []);
  } finally { await ctx.close(); }
});

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
    assert.ok(copied.endsWith(`Full rundown: ${server.origin}/f/${FID}#g=${crewToken}&f=${FID}&plan=${SAT}`));
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

// A sheet the browser will not raise (NotAllowedError, not a dismissal):
// both shares copy instead and say so — the plan's on its button, the menu's
// in the menu, which stays up to say it.
test('Chromium, a refused share sheet: both shares copy instead, and say so where the finger is', { skip: chromium ? false : NO_BROWSER }, async () => {
  const { ctx, page, errors, crewToken } = await open(chromium, { share: 'refuses' });
  try {
    await openPlanByGrabber(page);
    const button = page.locator('#plan .plan-share');
    assert.equal((await button.textContent()).trim(), 'Share our picks');
    await button.click();
    await sleep(150);
    assert.equal((await page.evaluate(() => window.__shared)).length, 1, 'the sheet was asked');
    assert.ok((await page.evaluate(() => navigator.clipboard.readText())).endsWith(`Full rundown: ${server.origin}/f/${FID}#g=${crewToken}&f=${FID}&plan=${SAT}`));
    assert.equal((await button.textContent()).trim(), 'Copied ✓');
    assert.equal(await page.evaluate(() => document.body.dataset.busy || null), null);
    await page.keyboard.press('Escape');
    await settled(page);
    await page.locator('#dock-fest-link').click();
    const row = page.locator('#dock-fest-wrap .sort-pop .share-link');
    await row.waitFor({ state: 'visible' });
    await row.click();
    await sleep(150);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${server.origin}/f/${FID}#g=${crewToken}&f=${FID}`);
    assert.equal((await row.locator('.w').textContent()).trim(), 'Copied ✓');
    assert.equal(await page.locator('#dock-fest-link').getAttribute('aria-expanded'), 'true', 'the menu stays up to say it');
    assert.equal(await page.evaluate(() => document.body.dataset.busy || null), 'show-menu', 'the share gave the menu its mark back');
    await page.keyboard.press('Escape');
    await sleep(400);
    assert.equal(await page.evaluate(() => document.body.dataset.busy || null), null, 'and the menu took it away with it');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// The 44px floor is applied to `button` on a coarse pointer (CLAUDE.md), and
// a class rule out-ranks it: the pill's own height is kept to a mouse.
test('Chromium: Share our picks keeps the 44px floor under a finger, and its own 36px pill under a mouse', { skip: chromium ? false : NO_BROWSER }, async () => {
  for (const [how, opts, min, max] of [['a phone', { mobile: true }, 44, 60], ['a laptop', { desk: true }, 34, 40]]) {
    const { ctx, page, errors } = await open(chromium, opts);
    try {
      await page.waitForSelector('#plan:not([hidden])', { timeout: 15000 });
      await settled(page);
      if (opts.desk) await page.locator('#plan .plan-row.tagged').click();
      else await openPlanByGrabber(page);
      await settled(page);
      const h = await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, h: document.querySelector('#plan .plan-share').getBoundingClientRect().height }));
      assert.equal(h.coarse, !opts.desk, `${how}: the pointer under test`);
      assert.ok(h.h >= min && h.h <= max, `${how}: ${JSON.stringify(h)}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  }
});
