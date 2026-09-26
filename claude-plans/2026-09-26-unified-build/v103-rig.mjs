// v103's frames rig (2026-09-26): THIS worktree's app, as it ships — no
// patches, no overlay — in a real Chromium or WebKit, at a pinned clock.
//
// NEVER production: a local static server over the worktree; /api answered
// from memory with made-up crews (every write refused 503 and counted); /fn-i
// swallowed; every request that is not this server aborted; the service
// worker blocked. Frames land in v103-shots/ (git-ignored).
//
//   node claude-plans/2026-09-26-unified-build/v103-rig.mjs [frame-id-prefix …]
//
// Two crews, both invented:
//   · `design` — the people-shelf crew (nine people, picks all weekend), where
//     Our picks' peek usually carries NOW, so the dock's NOW steps aside;
//   · `sparse` — the NOW contract's five (tests/browser/now-jump.test.mjs),
//     whose picks never make a stop at 10:30 PM, so the day row's NOW shows.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crewDoc } from '../2026-09-25-portola-live/design/people-shelf/crew.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const SHOTS = path.join(ROOT, 'v103-shots');
const FID = 'portola-2026';
const ACL = 'acl-2026';
const TOKENS = { design: 'v103DesignDEMOcrew_012345', sparse: 'v103SparseDEMOcrew_012345' }; // made up; never a real crew link
const ME = { design: 'Ana', sparse: 'Kevin' };
const DOCS = {
  design: (() => {
    const d = crewDoc(FID, 9);
    d.festivals[ACL] = { selections: { Turnstile: { Ana: 3, Ben: 2 }, 'Jesse Welles': { Cy: 2 }, Fcukers: { Ana: 2, Dot: 3 }, 'Sabrina Carpenter': { Ben: 3, Cy: 4 } } };
    return d;
  })(),
  sparse: {
    v: 4, meta: { name: 'Now', inviteFestId: FID }, spotify: {}, affinity: {},
    people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 }, Nhu: { colorIndex: 3 }, Kat: { colorIndex: 6 }, Dee: { colorIndex: 2 } },
    festivals: {
      [FID]: { selections: { 'Milli Meng': { Ross: 3 }, Galen: { Ross: 1, Nhu: 2 }, Soulwax: { Nhu: 4 }, Prospa: { Nhu: 2, Kat: 3 }, Despacio: { Ross: 3, Dee: 4 }, 'DJ Shadow': { Dee: 2 } } },
      [ACL]: { selections: { Turnstile: { Ross: 3 }, 'Jesse Welles': { Kat: 2 } } },
    },
  },
};
export const writes = [];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

export async function openRig({ engine = 'chromium' } = {}) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p0 = decodeURIComponent(u.pathname);
    const json = (s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
    if (p0.startsWith('/api/') || p0.startsWith('/fn-i/')) {
      if (req.method !== 'GET') writes.push(`${req.method} ${p0}`);
      if (p0.startsWith('/fn-i/')) { res.writeHead(204); res.end(); return; }
      if (p0 === '/api/crew' && req.method === 'GET') {
        const which = Object.keys(TOKENS).find((k) => TOKENS[k] === u.searchParams.get('t'));
        return which ? json(200, DOCS[which]) : json(404, { error: 'Crew not found' });
      }
      if (p0.startsWith('/api/festival-add')) return json(200, { festivals: [] });
      return json(503, {});
    }
    const p = p0 === '/' || p0.startsWith('/f/') ? '/index.html' : p0;
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const pw = await import('playwright');
  const browser = await pw[engine].launch({ headless: true });
  return { origin, browser, engine, close: async () => { await browser.close(); server.close(); } };
}

// One page at a pinned time. `view`: 'list' | 'board'. `crew`: 'design' | 'sparse'.
// `highlight`: names to highlight before the page opens (the device-local filter).
// `routes(ctx, origin)`: more routes before the page loads (the Spotify walk
// answers api.spotify.com from memory); `hash`: more of the address (`&sp=1`
// opens the Spotify drill); `store`: more localStorage.
export async function openApp(rig, { now, width = 390, height = 844, desktop = width >= 720, view = 'board', fid = FID, crew = 'design', highlight = null, reduce = false, routes = null, hash = '', store = {} }) {
  const ctx = await rig.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: !desktop, isMobile: !desktop && rig.engine === 'chromium', serviceWorkers: 'block', timezoneId: 'America/Los_Angeles', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.route('**/*', (route) => (route.request().url().startsWith(rig.origin) ? route.fallback() : route.abort()));
  if (routes) await routes(ctx, rig.origin);
  await ctx.addInitScript(([t, me, f, v, hl, st]) => {
    try {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Demo crew' }]));
      localStorage.setItem(`fn_me_v3_${t}`, me);
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
      localStorage.setItem('fn_welcome_v1', '1');
      localStorage.setItem('fn_welcome_joined_v1', '1');
      localStorage.setItem('fn_coach_v1', '1');
      localStorage.setItem('fn_errlog_off_v1', '1');
      if (!sessionStorage.getItem('rig_seeded')) {
        localStorage.setItem(`fn_view_v1_${f}`, v);
        if (hl) localStorage.setItem(`fn_filter_people_v1_${f}`, JSON.stringify(hl));
      }
      sessionStorage.setItem('rig_seeded', '1');
      for (const [k, val] of Object.entries(st)) localStorage.setItem(k, val);
    } catch { /* storage blocked */ }
  }, [TOKENS[crew], ME[crew], fid, view, highlight, store]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(now);
  await page.goto(`${rig.origin}/f/${fid}#g=${TOKENS[crew]}&f=${fid}${hash}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 3, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page, errors };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const PT = (s) => new Date(`${s}-07:00`);
export const CDT = (s) => new Date(`${s}-05:00`);

// Scroll so an element sits just under the sticky chrome.
export async function scrollTo(page, sel, pad = 8) {
  await page.evaluate(([s, p]) => {
    const el = document.querySelector(s);
    if (!el) throw new Error(`no ${s}`);
    const off = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jump-offset')) || 0;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off - p);
  }, [sel, pad]);
  await sleep(900); // the day row glides to the day you are in (restDayRow)
}
// Real input: a finger's tap on a phone, a mouse's click on a laptop.
export async function tap(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(450);
}
export async function click(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(450);
}
// The day row as the eye sees it: each visible item, how much of it shows.
export const dayRow = (page, door = 'dock') => page.evaluate((d) => {
  const row = document.getElementById(`${d}-days`);
  const r = row.getBoundingClientRect();
  return [...row.children].filter((t) => !t.hidden).map((t) => {
    const b = t.getBoundingClientRect();
    const seen = Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left));
    return `${t.classList.contains('now-tab') ? 'NOW' : t.textContent}${t.classList.contains('active') ? '*' : ''}:${Math.round(seen)}/${Math.round(b.width)}`;
  }).join(' ');
}, door);

async function shot(page, id, opts = {}) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${id}.png`), ...opts });
  return id;
}

const SAT_1030 = PT('2026-09-26T22:30:00');
const SAT_4PM = PT('2026-09-26T16:15:00');
const FRI_8PM = PT('2026-09-25T20:00:00');
const SUN_5PM = PT('2026-09-27T17:00:00');
const ACL_SAT = CDT('2026-10-03T20:00:00');
const room = (day, r) => `.day-block[data-day="${day}"] .room[data-room="${r}"]`;

// ---- the frames ----------------------------------------------------------------
// `clip: 'dock'` frames the dock (and what stands on it); `clip: 'rail'` the
// laptop's rail. Everything else is the viewport.
export const FRAMES = [
  // 1. NOW at the start of the day row
  ...[390, 320].flatMap((w) => [
    { id: `now-sparse-sat-${w}`, width: w, crew: 'sparse', now: SAT_1030, clip: 'dock' },
    { id: `now-sparse-sat-top-${w}`, width: w, crew: 'sparse', now: SAT_1030, at: 'top', clip: 'dock' },
    { id: `now-sparse-fri-${w}`, width: w, crew: 'sparse', now: FRI_8PM, clip: 'dock' },
    { id: `now-sparse-sun-${w}`, width: w, crew: 'sparse', now: SUN_5PM, clip: 'dock' },
    { id: `now-design-sat-${w}`, width: w, crew: 'design', now: SAT_1030, clip: 'dock' },
    { id: `now-sparse-hl-${w}`, width: w, crew: 'sparse', now: SAT_1030, highlight: ['Kat'], clip: 'dock' },
    { id: `now-acl-sat-${w}`, width: w, crew: 'sparse', fid: ACL, now: ACL_SAT, clip: 'dock' },
  ]),
  { id: 'now-sparse-sat-1280', width: 1280, height: 900, crew: 'sparse', now: SAT_1030, clip: 'rail' },
  { id: 'now-sparse-sun-1280', width: 1280, height: 900, crew: 'sparse', now: SUN_5PM, clip: 'rail' },
  { id: 'now-design-sat-1280', width: 1280, height: 900, crew: 'design', now: SAT_1030, clip: 'rail' },
  { id: 'now-acl-sat-1280', width: 1280, height: 900, crew: 'sparse', fid: ACL, now: ACL_SAT, clip: 'rail' },
  { id: 'now-sparse-sat-full-390', width: 390, crew: 'sparse', now: SAT_1030 },

  // 2. The List filters by highlight (Saturday 4:15 PM, the nine-person crew;
  // Ben highlighted through the people menu with real taps / clicks).
  ...[390, 320, 1280].flatMap((w) => [
    { id: `list-all-${w}`, width: w, view: 'list', now: SAT_4PM, at: room('Saturday', ':fest') },
    { id: `list-ben-menu-${w}`, width: w, view: 'list', now: SAT_4PM, at: room('Saturday', ':fest'), act: (p) => highlight(p, w, ['Ben'], { keepOpen: true }) },
    { id: `list-ben-${w}`, width: w, view: 'list', now: SAT_4PM, at: room('Saturday', ':fest'), act: (p) => highlight(p, w, ['Ben']) },
    { id: `list-ben-afters-${w}`, width: w, view: 'list', now: SAT_4PM, at: room('Saturday', 'Afters'), act: (p) => highlight(p, w, ['Ben']).then(() => scrollTo(p, room('Saturday', 'Afters'))) },
    { id: `list-ben-sunday-${w}`, width: w, view: 'list', now: SAT_4PM, at: room('Sunday', ':fest'), act: (p) => highlight(p, w, ['Ben']).then(() => scrollTo(p, room('Sunday', ':fest'))) },
  ]),
  { id: 'list-ben-cy-390', width: 390, view: 'list', now: SAT_4PM, at: room('Saturday', 'Afters'), act: (p) => highlight(p, 390, ['Ben', 'Cy']).then(() => scrollTo(p, room('Saturday', 'Afters'))) },
  { id: 'list-me-390', width: 390, view: 'list', now: SAT_4PM, at: room('Saturday', 'Afters'), act: (p) => highlight(p, 390, ['Ana']).then(() => scrollTo(p, room('Saturday', 'Afters'))) },
  { id: 'list-ben-past-open-390', width: 390, view: 'list', now: SAT_4PM, at: room('Saturday', ':fest'), act: (p) => highlight(p, 390, ['Ben']).then(() => tap(p, `${room('Saturday', ':fest')} .past-line`)) },
  { id: 'board-ben-390', width: 390, view: 'board', now: SAT_4PM, at: room('Saturday', ':fest'), act: (p) => highlight(p, 390, ['Ben']) },
  // Our picks open (Kevin: "does filters work with our picks open"). Both
  // orders: Ben highlighted, then Our picks opened from the same menu (the
  // open plan over the filtered wall); and Our picks open, then the avatar —
  // which puts the plan down to its peek as it always has — and Ben.
  { id: 'list-ben-then-plan-390', width: 390, view: 'list', now: SAT_4PM, at: room('Saturday', ':fest'), act: (p) => highlight(p, 390, ['Ben'], { keepOpen: true }).then(() => tap(p, '#dock-you-wrap .hl-pop [data-act="plan"]')).then(() => sleep(900)) },
  { id: 'list-ben-then-plan-1280', width: 1280, height: 900, view: 'list', now: SAT_4PM, at: room('Saturday', ':fest'), act: (p) => highlight(p, 1280, ['Ben'], { keepOpen: true }).then(() => click(p, '#rail-you-wrap .hl-pop [data-act="plan"]')).then(() => sleep(900)) },
  { id: 'list-plan-then-ben-390', width: 390, view: 'list', now: SAT_4PM, at: room('Saturday', ':fest'), act: (p) => openPlan(p, 390).then(() => highlight(p, 390, ['Ben'])) },
  { id: 'list-acl-ben-390', width: 390, view: 'list', fid: ACL, now: ACL_SAT, at: '.day-block[data-day="Saturday|W1"] .room[data-room=":fest"]', act: (p) => highlight(p, 390, ['Ben']) },
];

// The people menu, with real input: the avatar opens Highlight, each name is
// tapped (a finger) or clicked (a mouse), and the avatar again puts it away.
export async function highlight(page, width, people, { keepOpen = false } = {}) {
  const bar = width >= 720 ? 'rail' : 'dock';
  const press = width >= 720 ? click : tap;
  await press(page, `#${bar}-you`);
  for (const n of people) await press(page, `#${bar}-you-wrap .hl-pop [data-person="${n}"]`);
  await sleep(500); // the rows leave, the rest close up
  if (!keepOpen) { await press(page, `#${bar}-you`); await sleep(400); }
}
// Our picks, opened from the people menu's row.
export async function openPlan(page, width) {
  const bar = width >= 720 ? 'rail' : 'dock';
  const press = width >= 720 ? click : tap;
  await press(page, `#${bar}-you`);
  await press(page, `#${bar}-you-wrap .hl-pop [data-act="plan"]`);
  await sleep(900);
}

export async function renderFrames(prefixes = [], { engine = 'chromium' } = {}) {
  const want = (id) => !prefixes.length || prefixes.some((p) => id.startsWith(p));
  const report = [];
  const rig = await openRig({ engine });
  try {
    for (const f of FRAMES.filter((x) => want(x.id))) {
      const height = f.height || (f.width >= 720 ? 900 : 844);
      const { ctx, page, errors } = await openApp(rig, { ...f, height });
      try {
        if (f.at === 'top') { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(900); }
        else if (f.at) await scrollTo(page, f.at);
        if (f.act) await f.act(page);
        let opts = {};
        if (f.clip === 'dock') {
          const b = await page.locator('#dock').boundingBox();
          opts = { clip: { x: 0, y: Math.max(0, b.y - 150), width: b.width, height: b.height + 150 } };
        } else if (f.clip === 'rail') {
          const b = await page.locator('#day-rail').boundingBox();
          opts = { clip: { x: 0, y: 0, width: f.width, height: b.y + b.height + 80 } };
        }
        await shot(page, `${engine === 'chromium' ? '' : `${engine}-`}${f.id}`, opts);
        const door = f.width >= 720 ? 'rail' : 'dock';
        report.push(`${f.id}: ${await dayRow(page, door)}${errors.length ? ` — page errors: ${errors.join(' | ')}` : ''}`);
      } finally { await ctx.close(); }
    }
  } finally { await rig.close(); }
  report.push(`writes refused: ${writes.length} (${[...new Set(writes)].join(', ')})`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const engine = args.includes('--webkit') ? 'webkit' : 'chromium';
  const lines = await renderFrames(args.filter((a) => !a.startsWith('--')), { engine });
  console.log(lines.join('\n'));
}
