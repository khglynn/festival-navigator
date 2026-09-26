// The people menu's frames and slow-motion strips (2026-09-26): THIS worktree's
// app in a real Chromium, through the List build's rig (list-rig.mjs — a local
// server, /api from memory with the made-up crew of nine, every write refused
// and counted, the service worker blocked). NEVER production, a preview,
// `vercel dev` or a real crew link. Frames land in people-shots/ (git-ignored).
//
//   node claude-plans/2026-09-26-unified-build/people-rig.mjs [frames|slowmo] [id-prefix …]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { openRig, scrollTo, tap, click, sleep, PT, ROOT, writes } from './list-rig.mjs';
import { crewDoc } from '../2026-09-25-portola-live/design/people-shelf/crew.mjs';

export const SHOTS = path.join(ROOT, 'people-shots');
const SHEET = path.join(ROOT, 'claude-plans/2026-09-26-unified-build/people-strip.py');
const SAT = PT('2026-09-26T16:15:00');
const room = (day, r) => `.day-block[data-day="${day}"] .room[data-room="${r}"]`;
const PORTOLA = room('Saturday', ':fest');
const AFTERS = room('Saturday', 'Afters');
const mobile = (w) => w < 720;
const you = (w) => (mobile(w) ? '#dock-you' : '#rail-you');
const wrapOf = (w) => (mobile(w) ? '#dock-you-wrap' : '#rail-you-wrap');
const press = (w) => (mobile(w) ? tap : click);
const row = (w, name) => `${wrapOf(w)} .hl-pop [data-person="${name}"]`;
const act = (w, a) => `${wrapOf(w)} .hl-pop [data-act="${a}"]`;
// A tap outside the menu, far from it: the right edge near the top (on a card
// it only closes the menu — the rule a close-tap follows). Not the left
// gutter: Chromium's touch adjustment pulls a tap 8px from the menu into it.
async function outside(page, w) {
  if (mobile(w)) await page.touchscreen.tap(w - 6, 110);
  else await page.mouse.click(w - 6, 110);
  await sleep(500);
}
async function highlight(page, w, names) {
  await press(w)(page, you(w));
  for (const n of names) await press(w)(page, row(w, n));
}

async function shot(page, id, opts = {}) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${id}.png`), ...opts });
}
// list-rig.mjs's openApp, plus a crew of our own: `crew` is 9 (the made-up
// nine), 12, 1 (only Ana), 'long' (a 24-character name beside Ana), or
// 'left' (Ben removed after he was highlighted — the menu must not show him,
// and the stored highlight must not blank the wall).
const TOKEN = 'listBuildDEMOcrew_0123456'; // list-rig.mjs's made-up crew; never a real link
const FID = 'portola-2026';
function docFor(crew = 9) {
  if (crew === 12) return crewDoc(FID, 12);
  const d = crewDoc(FID, 9);
  if (crew === 1) { d.people = { Ana: d.people.Ana }; for (const by of Object.values(d.festivals[FID].selections)) for (const k of Object.keys(by)) if (k !== 'Ana') delete by[k]; }
  if (crew === 'long') { d.people['Bartholomew-Maximiliana'] = { colorIndex: 9 }; d.festivals[FID].selections.Robyn['Bartholomew-Maximiliana'] = 3; }
  if (crew === 'left') d.people.Ben = { ...d.people.Ben, removed: true };
  return d;
}
// `adds`: an Invite sheet add is answered IN MEMORY (the person merged into
// this page's copy of the crew, which later GETs return) — so the success
// state can be framed; nothing leaves this machine. `offline`: Settings →
// Stay offline on, so an add takes the local path (the longest success line).
export async function openApp(rig, { now, width = 390, height = 844, desktop = width >= 720, view = 'board', guest = false, crew = 9, store = {}, adds = false, offline = false }) {
  const doc = docFor(crew);
  const ctx = await rig.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: !desktop, isMobile: !desktop && rig.engine === 'chromium', serviceWorkers: 'block', timezoneId: 'America/Los_Angeles' });
  await ctx.route('**/*', (route) => (route.request().url().startsWith(rig.origin) ? route.fallback() : route.abort()));
  await ctx.route((u) => u.pathname === '/api/crew', (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: doc });
    if (!adds) return route.fallback(); // refused and counted by the rig's server
    const people = ((JSON.parse(req.postData() || '{}').data || {}).people) || {};
    for (const [n, p] of Object.entries(people)) doc.people[n] = { ...(doc.people[n] || {}), ...p };
    return route.fulfill({ json: doc });
  });
  await ctx.addInitScript(([t, f, v, g, st, off]) => {
    try {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Design crew' }]));
      if (!g) localStorage.setItem(`fn_me_v3_${t}`, 'Ana');
      localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
      for (const k of ['fn_welcome_v1', 'fn_welcome_joined_v1', 'fn_coach_v1', 'fn_errlog_off_v1']) localStorage.setItem(k, '1');
      if (v === 'list') localStorage.setItem(`fn_view_v1_${f}`, 'list');
      if (off) localStorage.setItem('fn_settings_v1', JSON.stringify({ stayOffline: true }));
      for (const [k, val] of Object.entries(st)) sessionStorage.setItem(k, val);
    } catch { /* storage blocked */ }
  }, [TOKEN, FID, view, guest, store, offline]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(now);
  await page.goto(`${rig.origin}/f/${FID}#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 5, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(700);
  return { ctx, page, errors };
}

const W3 = (id, o) => [390, 320, 1280].map((width) => ({ id: `${id}-${width}`, width, ...o }));
async function invite(p, w) { await press(w)(p, you(w)); await press(w)(p, act(w, 'invite')); }
// Add a friend by name through the sheet with real input (a tap or click on
// the field, typed keys, the Add button), and wait for the success state.
const addFriend = (name) => async (p, w) => {
  await invite(p, w);
  await press(w)(p, '.invite-sheet .inv-name input');
  await p.keyboard.type(name);
  await press(w)(p, '.invite-sheet .inv-add');
  await p.waitForFunction((n) => (document.querySelector('.invite-sheet .sheet-title')?.textContent || '') === `${n.toUpperCase()} IS IN`, name, { timeout: 5000 });
  if (!mobile(w)) await p.mouse.move(2, 2); // no hover left on the button
};
export const FRAMES = [
  ...W3('menu-open', { at: PORTOLA, act: async (p, w) => press(w)(p, you(w)) }),
  ...W3('menu-ben-cy', { at: PORTOLA, act: async (p, w) => highlight(p, w, ['Ben', 'Cy']) }),
  ...W3('pill-deep', { at: AFTERS, act: async (p, w) => { await highlight(p, w, ['Ben', 'Cy']); await outside(p, w); } }),
  ...W3('pill-list', { at: AFTERS, view: 'list', act: async (p, w) => { await highlight(p, w, ['Ben', 'Cy']); await outside(p, w); } }),
  ...W3('pill-four', { at: PORTOLA, act: async (p, w) => { await highlight(p, w, ['Ben', 'Cy', 'Dot', 'Eli']); await outside(p, w); } }),
  ...W3('show-open', { at: PORTOLA, act: async (p, w) => press(w)(p, mobile(w) ? '#dock-fest-link' : '#rail-fest-link') }),
  ...W3('top', { at: 'top' }),
  ...W3('guest-menu', { at: PORTOLA, guest: true, act: async (p, w) => press(w)(p, you(w)) }),
  ...W3('pickas', { at: PORTOLA, act: async (p, w) => { await press(w)(p, you(w)); await press(w)(p, act(w, 'pick-as')); await sleep(300); await press(w)(p, `.join-shelf .js-name[data-name="Ben"]`); } }),
  ...W3('invite', { at: PORTOLA, act: invite }),
  // The Invite sheet's copy pass (2026-09-26): the sheet, and the success
  // state after "Or add a friend", in Chromium and in WebKit (an iPhone's
  // engine) at 320, where the lines wrap the most.
  { id: 'invite-wk-320', width: 320, engine: 'webkit', at: PORTOLA, act: invite },
  ...W3('invite-added', { at: PORTOLA, adds: true, act: addFriend('Mo') }),
  { id: 'invite-added-wk-320', width: 320, engine: 'webkit', at: PORTOLA, adds: true, act: addFriend('Mo') },
  { id: 'invite-added-offline-wk-320', width: 320, engine: 'webkit', at: PORTOLA, offline: true, act: addFriend('Mo') },
  // The header's two lines, removed (Kevin, 2026-09-26: "in the header we
  // don't need these lines"): the divider stub before the search field and
  // the rail's hairline. The top of the wall at 1280, at 900 (the people row
  // wraps there) and 390; and the rail stuck over the wall mid-scroll.
  ...[1280, 900, 390].map((width) => ({ id: `header-top-${width}`, width, at: 'top' })),
  ...[1280, 900].map((width) => ({ id: `header-rail-${width}`, width, at: PORTOLA })),
  { id: 'header-top-twelve-900', width: 900, at: 'top', crew: 12 }, // the row wraps: the stub stood alone on the search line
  { id: 'menu-long-name-320', width: 320, at: PORTOLA, crew: 'long', act: async (p, w) => highlight(p, w, ['Bartholomew-Maximiliana']) },
  { id: 'pill-long-name-320', width: 320, at: PORTOLA, crew: 'long', act: async (p, w) => { await highlight(p, w, ['Bartholomew-Maximiliana']); await outside(p, w); } },
  { id: 'menu-twelve-667', width: 375, height: 667, at: PORTOLA, crew: 12, act: async (p, w) => press(w)(p, you(w)) },
  { id: 'menu-twelve-scrolled-667', width: 375, height: 667, at: PORTOLA, crew: 12, act: async (p, w) => { await press(w)(p, you(w)); await p.evaluate(() => { const m = document.querySelector('#dock-you-wrap .hl-pop'); m.scrollTop = m.scrollHeight; }); } },
  { id: 'crew-of-one-390', width: 390, at: PORTOLA, crew: 1, act: async (p, w) => press(w)(p, you(w)) },
  // Ben was highlighted in this tab, then left the crew: the highlight is pruned, the wall is not blank.
  { id: 'left-crew-390', width: 390, at: PORTOLA, crew: 'left', store: { 'fn_filter_people_v1_portola-2026': '["Ben"]' }, act: async (p, w) => press(w)(p, you(w)) },
  { id: 'left-crew-kept-390', width: 390, at: PORTOLA, crew: 'left', store: { 'fn_filter_people_v1_portola-2026': '["Ben","Cy"]' } },
  { id: 'guest-pill-320', width: 320, at: AFTERS, guest: true, act: async (p, w) => { await highlight(p, w, ['Ben']); await outside(p, w); } },
];

export async function renderFrames(prefixes = []) {
  const want = (id) => !prefixes.length || prefixes.some((p) => id.startsWith(p));
  const report = [];
  const rigs = {};
  const rigFor = async (engine = 'chromium') => (rigs[engine] ||= await openRig({ engine }));
  try {
    for (const f of FRAMES.filter((x) => want(x.id))) {
      try {
      const rig = await rigFor(f.engine);
      const { ctx, page, errors } = await openApp(rig, { now: f.now || SAT, width: f.width, height: f.height || (f.width >= 720 ? 900 : 844), view: f.view || 'board', guest: !!f.guest, crew: f.crew || 9, store: f.store || {}, adds: !!f.adds, offline: !!f.offline });
      try {
        if (f.at === 'top') { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(900); } else if (f.at) await scrollTo(page, f.at);
        if (f.act) await f.act(page, f.width);
        await sleep(500);
        await shot(page, f.id);
        report.push(`${f.id}: ok${errors.length ? ` — page errors: ${errors.join(' | ')}` : ''}`);
      } finally { await ctx.close().catch(() => {}); }
      } catch (e) { report.push(`${f.id}: FAILED — ${String(e.message || e).split('\n')[0]}`); }
    }
  } finally { for (const r of Object.values(rigs)) await r.close(); }
  report.push(`writes refused: ${writes.length} (${[...new Set(writes)].join(', ')})`);
  return report;
}

// Slow motion (the memory "motion is designed, not patched"): every animation
// at a twentieth of its speed, a strip of frames of the dock (or the menu).
async function strip(page, id, go, { frames = 12, every = 260, crop = 'dock', rate = 0.05 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: rate });
  const vp = page.viewportSize();
  const clip = crop === 'dock' ? { x: 0, y: vp.height - 120, width: vp.width, height: 120 } : { x: 0, y: vp.height - 640, width: 270, height: 640 };
  const files = [];
  const pending = go();
  for (let i = 0; i < frames; i++) {
    const f = path.join(SHOTS, `${id}-${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: f, clip });
    files.push(f);
    await sleep(every);
  }
  await pending;
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
  const args = [SHEET, path.join(SHOTS, `${id}.png`), ...(crop === 'dock' ? [] : ['--cols', '6'])];
  files.forEach((f, i) => args.push(`${Math.round(i * every * rate)}ms`, f));
  execFileSync('python3', args);
  for (const f of files) fs.rmSync(f);
  return id;
}
export async function renderSlowmo(width = 390) {
  const rig = await openRig();
  const out = [];
  try {
    const { ctx, page } = await openApp(rig, { now: SAT, width, view: 'board' });
    const w = width;
    try {
      await scrollTo(page, AFTERS);
      out.push(await strip(page, `slow-open-${w}`, () => press(w)(page, you(w)), { crop: 'menu', frames: 8 }));
      out.push(await strip(page, `slow-tick-${w}`, () => press(w)(page, row(w, 'Ben')), { crop: 'menu', frames: 8 }));
      await press(w)(page, row(w, 'Cy'));
      out.push(await strip(page, `slow-close-pill-${w}`, () => outside(page, w), { frames: 14 }));
      out.push(await strip(page, `slow-reopen-${w}`, () => press(w)(page, `${wrapOf(w)} .hl-faces`), { crop: 'menu', frames: 12 }));
      await outside(page, w);
      out.push(await strip(page, `slow-clear-${w}`, () => press(w)(page, `${wrapOf(w)} .hl-x`), { frames: 12 }));
    } finally { await ctx.close(); }
  } finally { await rig.close(); }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode = 'frames', ...rest] = process.argv.slice(2);
  if (mode === 'slowmo') console.log((await renderSlowmo(Number(rest[0]) || 390)).join('\n'));
  else console.log((await renderFrames(rest)).join('\n'));
}
