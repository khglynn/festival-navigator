// A thrown error in a real page becomes exactly one scrubbed report on the
// rewrite path (v88, 2026-09-24). jsdom proves the pieces (errlog-*.test.mjs);
// this proves the page: the real index.html, whose own module script hooks
// the journal before app.js (the same module instance app.js then imports, so
// one error is one report, never two), a real engine's error event and stack,
// and the real bytes a POST carries.
//
// No request can reach PostHog: the static server has no rewrite, and
// /fn-i/batch is answered by a route here before it would get that far. The
// shipped project key is swapped for a test key in the served page. The crew
// and person tokens are made the server's way at run time, never committed.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(ROOT);
const browser = await launchBrowser();
test.after(async () => { if (browser) await browser.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;

const KEY = 'phc_testkeyForFestivalNavigatorCI01';
const FID = 'portola-2026';

test('a thrown error in the real page sends exactly one scrubbed request to /fn-i/batch', { skip }, async () => {
  const CREW = randomBytes(20).toString('base64url');
  const PERSON = randomBytes(20).toString('base64url');
  const PID = randomBytes(9).toString('base64url');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  try {
    await ctx.addInitScript(([t, p, pid, f]) => {
      navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Report' }]));
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
      localStorage.setItem('fn_coach_v1', '1');
      localStorage.setItem('fn_person_v1', JSON.stringify({ token: p, id: pid, name: 'Kevin', crews: { [t]: { name: 'Kevin', crewName: 'Report' } } }));
      window.__synced = 0;
      window.addEventListener('fn:synced', () => { window.__synced += 1; });
    }, [CREW, PERSON, PID, FID]);
    const doc = {
      v: 4, meta: { name: 'Report', inviteFestId: FID }, spotify: {}, affinity: {},
      people: { Kevin: { colorIndex: 0, pid: PID }, Ross: { colorIndex: 5 } }, festivals: { [FID]: { selections: {} } },
    };
    // Playwright tries the LAST-registered matching route first: the catch-all goes first.
    await ctx.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await ctx.route('**/api/crew**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
    await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
    const reports = [];
    await ctx.route('**/fn-i/**', (route) => {
      const req = route.request();
      reports.push({ url: new URL(req.url()).pathname, method: req.method(), body: req.postData() || '' });
      return route.fulfill({ contentType: 'application/json', body: '{"status":"Ok"}' });
    });
    // The real index.html, with a test key in place of the shipped one.
    await ctx.route(`${server.origin}/`, async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace(/(<meta name="fn-report-key" content=")[^"]*/, `$1${KEY}`);
      await route.fulfill({ response: res, body: html });
    });

    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date('2026-09-10T10:00:00-07:00')); // nothing live: NOW never renders
    await page.goto(`${server.origin}/#g=${CREW}`, { waitUntil: 'load' });
    await page.waitForSelector('#screen-app', { state: 'visible', timeout: 15000 });
    await sleep(500);
    assert.equal(reports.length, 0, 'a healthy open sends nothing');

    // An uncaught error whose words carry a crew link, a sync URL and the
    // person token — thrown by a script OF THE PAGE, as a real bug would be.
    // Two harness traps, both measured here: a throw inside page.evaluate
    // never reaches window's error event (DevTools-injected code is not the
    // page's), and under the pinned clock a throw inside setTimeout never
    // escapes at all (Playwright's clock runs timer callbacks itself and
    // logs what they throw). So the page's own script throws, synchronously.
    // Whatever the engine names its frame (Chromium: `<anonymous>` for a
    // script added through the DOM; an engine that names the page URL, which
    // still carries #g=<crew token>, is cut to its path — errlog-scrub
    // pins that case), no token may survive.
    await page.evaluate(([t, p]) => {
      const s = document.createElement('script');
      const words = `thrown in a real page https://fest.kevinhg.com/f/portola-2026#g=${t}&f=portola-2026 /api/crew?t=${t} ${p}`;
      s.textContent = `function bug() { throw new TypeError(${JSON.stringify(words)}); }\nbug();`;
      document.body.appendChild(s);
    }, [CREW, PERSON]);
    assert.ok((await page.evaluate(() => location.hash)).includes('#g='), 'the page URL the frame points at still carries the crew token');
    await sleep(200);
    assert.equal(reports.length, 0, 'queued, not sent on its own timer');
    // Signal comes back: the reporter sends, and the app's own push succeeds
    // right after (fn:synced) — which must not send the same report twice.
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await sleep(1500);

    assert.ok(await page.evaluate(() => window.__synced) > 0, 'a sync succeeded after the send, so the same report had a second chance to go');
    assert.equal(reports.length, 1, `exactly one request (got ${reports.length})`);
    const [r] = reports;
    assert.equal(r.url, '/fn-i/batch');
    assert.equal(r.method, 'POST');
    for (const secret of [CREW, PERSON, '#g=', '?t=', '&f=']) assert.ok(!r.body.includes(secret), `the bytes never carry ${secret.length > 4 ? 'a token' : secret}`);
    const body = JSON.parse(r.body);
    assert.equal(body.api_key, KEY);
    assert.equal(body.batch.length, 1, 'one error, one event — the early hook and app.js share one reporter');
    const ev = body.batch[0];
    assert.equal(ev.event, '$exception');
    const p = ev.properties;
    assert.equal(p.kind, 'error');
    assert.equal(p.member_name, 'Kevin');
    assert.equal(p.pid, PID);
    assert.equal(p.fest, FID);
    assert.equal(p.screen, 'wall');
    assert.equal(p.$exception_list[0].type, 'TypeError');
    assert.equal(p.$exception_list[0].mechanism.handled, false);
    assert.match(p.$exception_list[0].value, /^thrown in a real page https:\/\/fest\.kevinhg\.com\/f\/portola-2026 \/api\/crew‹param› ‹token›$/);
    const site = p.$exception_list[0].stacktrace.frames.at(-1);
    assert.equal(site.function, 'bug', 'the crash site is the last frame');
    assert.equal(site.platform, 'custom');
    assert.ok(site.filename === '/' || site.filename === '<anonymous>', `a path or the engine's own label, never a URL (${site.filename})`);
    assert.ok(site.lineno > 0);
    assert.equal(await page.evaluate(() => import('/js/errlog.js').then((m) => m.pendingReports())), 0, 'sent, so off the phone');
  } finally {
    await ctx.close();
  }
});
