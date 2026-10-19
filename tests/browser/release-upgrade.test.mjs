// The release every friend's phone takes after weeks asleep (v116, critic C9).
// A phone holding build N's worker opens the app after build N+1 is live:
// the page comes from the network (navigations are network-first), every
// module from N's worker cache, and meanwhile N+1's worker installs, takes
// over and reloads the page once it is quiet. That is the deploy-skew path:
// all ten errors PostHog ever recorded were a module of one build beside a
// module of another. This walks it end to end, in a real browser with real
// workers, and asks for a clean boot: never the Try again panel, never a
// module that cannot link, and the phone on N+1 at the end, its festival
// data kept.
//
// The two builds here are the working tree (N+1) and the same tree dressed
// as the release before it (N): an older CACHE_VERSION and fn-build, and a
// foot.js export that only N's app.js imports — so any module of N meeting a
// module of N+1 fails to link, loudly, instead of passing by luck.
//
// The real pair: PREV_BUILD=<git ref of the live release> runs the same walk
// with that commit's files as N (git archive into a temp folder) — the real
// deploy skew, this tree's page over the live build's cached modules and
// styles, which the dressed pair (built from this tree) cannot show. CI runs
// it on every push (v116 review): origin/main on a pull request or a branch,
// HEAD^ on main itself (.github/workflows/ci.yml). When PREV_BUILD is the same
// build as this tree — the same CACHE_VERSION and the same ASSET_STAMP (a
// change that ships no app files) — there is no pair to walk, and the dressed
// pair stands alone. The same version over a different stamp FAILS: a
// released version was reused. Locally, before a merge:
//   PREV_BUILD=origin/main node --test tests/browser/release-upgrade.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serveBuild } from '../helpers/build-server.mjs';
import { launchBrowser, launchWebkit, NO_BROWSER, waitForAsync } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (root, p) => fs.readFileSync(path.join(root, p), 'utf8');
const versionOf = (root) => /const CACHE_VERSION = 'festival-nav-(v\d+)'/.exec(read(root, 'service-worker.js'))[1];
const NEXT = versionOf(ROOT);
const stampOf = (root) => /const ASSET_STAMP = '([0-9a-f]{8})'/.exec(read(root, 'service-worker.js'))?.[1] || null;
const server = await serveBuild(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
let prevDir = null;
test.after(async () => {
  if (chromium) await chromium.close();
  if (webkit) await webkit.close();
  await server.close();
  if (prevDir) fs.rmSync(prevDir, { recursive: true, force: true }); // a temp copy of a git commit: reproducible
});

const TOKEN = 'releaseupgradetest_0123'; // made up: never a real crew link
const FID = 'acl-2026';
const DOC = {
  v: 4, meta: { name: 'Upgrade Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } },
};
// The crew service, from the same server, so a worker's own requests reach
// it in every engine. Nothing here writes anywhere.
function crewApi() {
  server.overlay.set('/api/crew', { body: JSON.stringify(DOC), type: 'application/json' });
  server.overlay.set('/api/festival-add', { body: '{"festivals":[]}', type: 'application/json' });
  server.overlay.set('/api/person', { status: 503, body: '{}', type: 'application/json' });
}

// Build N, dressed from the working tree: overlays on the files that differ.
function dressedPrevious() {
  const n = Number(NEXT.slice(1));
  const prev = `v${n - 1}`;
  const html = read(ROOT, 'index.html').replace(/(<meta name="fn-build" content=")v\d+/, `$1${prev}`);
  server.overlay.set('/', { body: html, type: 'text/html; charset=utf-8' });
  server.overlay.set('/index.html', { body: html, type: 'text/html; charset=utf-8' });
  server.overlay.set('/service-worker.js', { body: read(ROOT, 'service-worker.js').replace(`'festival-nav-${NEXT}'`, `'festival-nav-${prev}'`) });
  server.overlay.set('/js/v3/foot.js', { body: `${read(ROOT, 'js/v3/foot.js')}\nexport const buildMark = 'previous';\n` });
  server.overlay.set('/js/v3/app.js', { body: `import { buildMark } from './foot.js';\nwindow.__fnBuildMark = buildMark;\n${read(ROOT, 'js/v3/app.js')}` });
  return prev;
}

const workerBuild = (page) => page.evaluate(() => new Promise((resolve) => {
  const sw = navigator.serviceWorker;
  const c = sw && sw.controller;
  if (!c) { resolve(null); return; }
  const on = (e) => {
    if (!e.data || typeof e.data.fnBuild !== 'string') return;
    sw.removeEventListener('message', on);
    resolve(e.data.fnBuild);
  };
  sw.addEventListener('message', on);
  c.postMessage({ fn: 'build?' });
  setTimeout(() => resolve(null), 3000);
}));

async function walk(engine, { previous, dressed }) {
  const ctx = await engine.newContext({ viewport: { width: 390, height: 844 } });
  const panels = [];
  const errors = [];
  await ctx.exposeBinding('fnSawPanel', (src, words) => { panels.push(words); });
  await ctx.addInitScript(([t, f]) => {
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Upgrade Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_welcome_v1', '1');
    // Which worker served this document's modules: the one in control at
    // its very start (the glue reloads a page a newer worker takes over).
    window.__servedBy = null;
    try {
      const sw = navigator.serviceWorker;
      if (sw && sw.controller) {
        sw.addEventListener('message', (e) => { if (!window.__servedBy && e.data && typeof e.data.fnBuild === 'string') window.__servedBy = e.data.fnBuild; });
        sw.controller.postMessage({ fn: 'build?' });
      }
    } catch (e) { /* no worker */ }
    // Every moment the Try again panel is on screen, said once per document.
    let said = false;
    const watch = () => {
      const el = document.getElementById('screen-error');
      if (said || !el || el.style.display === 'none') return;
      said = true;
      const msg = document.getElementById('error-msg');
      window.fnSawPanel(msg ? msg.textContent : '');
    };
    document.addEventListener('DOMContentLoaded', () => {
      watch();
      new MutationObserver(watch).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
    });
  }, [TOKEN, FID]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e && e.message)));
  const url = `${server.origin}/#g=${TOKEN}&f=${FID}`;
  try {
    // 1. The phone on build N: the wall opens, N's worker takes the page,
    //    and the festival is kept for a field without signal.
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('screen-app').style.display !== 'none', null, { timeout: 20000 });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
    assert.equal(await workerBuild(page), `festival-nav-${previous}`, 'build N’s worker serves the phone');
    if (dressed) assert.equal(await page.evaluate(() => window.__fnBuildMark), 'previous', 'and runs build N’s app');
    await waitForAsync(page, async (f) => !!(await (await caches.open('festival-nav-data-v1')).match(`/data/festivals/${f}.json`)), FID,
      { timeout: 15000, what: 'the festival in the data cache' });

    // 2. Weeks later, build N+1 is live. The phone opens the app again (a
    //    real document load: about:blank first, as a closed tab would be).
    await page.goto('about:blank');
    if (dressed) { server.overlay.clear(); crewApi(); } else server.setRoot(ROOT);
    errors.length = 0;
    panels.length = 0;
    await page.goto(url, { waitUntil: 'commit' });

    // 3. It ends on build N+1: N+1's worker in control, N+1's page, the app
    //    running, the wall on screen.
    await waitForAsync(page, async (v) => {
      const meta = document.querySelector('meta[name="fn-build"]');
      if (!meta || meta.content !== v || !window.__fnAppRan) return false;
      if (document.getElementById('screen-app').style.display === 'none') return false;
      return window.__servedBy === `festival-nav-${v}`;
    }, NEXT, { timeout: 60000, every: 500, what: `the phone on ${NEXT}` });
    if (dressed) assert.equal(await page.evaluate(() => window.__fnBuildMark), undefined, 'build N+1’s app, not N’s');
    await page.waitForTimeout(1500); // nothing more happens after it lands

    assert.deepEqual(panels, [], 'the Try again panel never showed');
    assert.deepEqual(errors.filter((m) => /SyntaxError|binding|export|import|module/i.test(m)), [], 'no module that could not link');
    assert.deepEqual(errors, [], 'no uncaught error at all');
    const keys = await page.evaluate(() => caches.keys());
    assert.ok(keys.includes(`festival-nav-${NEXT}`), `N+1’s shell is cached (${keys})`);
    assert.ok(!keys.includes(`festival-nav-${previous}`), `N’s shell is gone (${keys})`);
    assert.ok(await page.evaluate(async (f) => !!(await (await caches.open('festival-nav-data-v1')).match(`/data/festivals/${f}.json`)), FID),
      'the festival saved on build N is still on the phone');
  } catch (e) {
    const seen = await page.evaluate(async () => ({
      meta: (document.querySelector('meta[name="fn-build"]') || {}).content,
      ran: !!window.__fnAppRan, mark: window.__fnBuildMark || null,
      screens: [...document.querySelectorAll('[id^="screen-"]')].filter((el) => el.style.display !== 'none').map((el) => el.id),
      servedBy: window.__servedBy, busy: document.body.dataset.busy || null, sharing: document.body.dataset.sharing || null,
      backdrop: !!document.getElementById('sheet-backdrop'), zoom: !!document.querySelector('#zoom-layer .zoom-slot'),
      fields: [...document.querySelectorAll('input, textarea')].filter((f) => !f.readOnly && (f.value || f === document.activeElement) && f.getClientRects().length).map((f) => f.id || f.className),
      nav: performance.getEntriesByType('navigation')[0].type,
      controlled: !!navigator.serviceWorker.controller, keys: await caches.keys(), href: location.href.replace(/#.*/, ''),
    })).catch((x) => ({ unreadable: String(x) }));
    seen.worker = await workerBuild(page).catch(() => null);
    e.message += `\n  the page: ${JSON.stringify(seen)}\n  panels: ${JSON.stringify(panels)}\n  errors: ${JSON.stringify(errors)}`;
    throw e;
  } finally { await ctx.close(); }
}

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const skip = engine ? false : NO_BROWSER;

  test(`${name}: a phone on build N opens build N+1 — a clean boot, no Try again, N+1 at the end`, { skip }, async () => {
    server.overlay.clear();
    server.setRoot(ROOT);
    crewApi();
    const previous = dressedPrevious();
    await walk(engine, { previous, dressed: true });
  });

  const ref = process.env.PREV_BUILD;
  test(`${name}: the real pair — PREV_BUILD's worker opens this tree`, { skip: skip || (ref ? false : 'set PREV_BUILD=<git ref of the live release> to walk the real pair') }, async (t) => {
    if (!prevDir) {
      prevDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fn-prev-build-'));
      const tar = path.join(prevDir, '..', `${path.basename(prevDir)}.tar`);
      execFileSync('git', ['archive', '--format=tar', '-o', tar, ref], { cwd: ROOT });
      execFileSync('tar', ['-x', '-f', tar, '-C', prevDir]);
      fs.rmSync(tar, { force: true });
    }
    const previous = versionOf(prevDir);
    // The same build on both sides — the same version AND the same stamp:
    // nothing ships between them, so there is no upgrade to walk. The same
    // version over different app files is a released version reused (a
    // `sw-stamp.mjs --keep` after the release): phones that hold that
    // version would never fetch the new files, and nothing else catches it —
    // tests/app-shell-complete.test.mjs only checks that the stamp matches
    // this tree's files, not that the version is new.
    if (previous === NEXT) {
      assert.equal(stampOf(ROOT), stampOf(prevDir), `a released version was reused: PREV_BUILD (${ref}) is ${previous} with stamp ${stampOf(prevDir)}, and this tree ships other app files (${stampOf(ROOT)}) under the same version — run node scripts/sw-stamp.mjs to bump it`);
      t.skip(`PREV_BUILD (${ref}) is ${previous} with the same stamp, the same build as this tree: no upgrade to walk, the dressed pair covers it`);
      return;
    }
    server.overlay.clear();
    crewApi();
    server.setRoot(prevDir);
    await walk(engine, { previous, dressed: false });
  });
}
