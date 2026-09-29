// ACL Late nights probe (2026-09-29): the real app, as it ships, in a real
// Chromium or WebKit, on an invented ACL crew, at the clocks tonight and the
// Zilker weekend care about. NEVER production: the repo over a local static
// server, /api answered in the page from memory (every write refused), the
// service worker blocked, every other request aborted.
//
//   node claude-plans/2026-09-29-tuesday/acl-latenights-probe.mjs [--webkit] [--list] [--tz=America/Chicago] [clock-id …]
//
// Prints one JSON block per (clock × width): the day row, NOW, the lit cards,
// the Late nights rooms as drawn, the fold lines, Our picks' state, and where
// a real tap / click on NOW lands.
import path from 'node:path';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../../tests/helpers/static-server.mjs';
import { fontsIn, motionDone } from '../../tests/helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = path.join(ROOT, 'v103-shots', 'acl-latenights'); // git-ignored folder
const FID = 'acl-2026';
const CDT = (s) => new Date(`${s}-05:00`);
export const CLOCKS = {
  'sep29-4pm': CDT('2026-09-29T16:00:00'),
  'sep29-820pm': CDT('2026-09-29T20:20:00'),
  'sep29-1159pm': CDT('2026-09-29T23:59:00'),
  'sep30-1230am': CDT('2026-09-30T00:30:00'),
  'sep30-6am': CDT('2026-09-30T06:00:00'),
  'oct3-9pm': CDT('2026-10-03T21:00:00'),
};
// Invented crew; placeholder names, made-up picks on the real lineup.
export const CREW = {
  me: 'Ada',
  members: ['Ada', 'Bo', 'Cal', 'Dee', 'Eve'],
  picks: {
    'Total Wife': { Ada: 3, Bo: 2 },
    Fcukers: { Bo: 3, Dee: 2, Ada: 2 },
    'Brandon Flowers': { Bo: 3, Cal: 3 },
    Parcels: { Ada: 4, Eve: 2 },
    CMAT: { Dee: 3 },
    'Dazzle Camouflage': { Cal: 2 },
    Lorde: { Ada: 4, Bo: 3 },
    Turnstile: { Ada: 3, Cal: 2 },
    'The xx': { Ada: 3, Eve: 4 },
  },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openAcl(browser, origin, { at, width = 390, view = null, tz = 'America/Chicago' }) {
  const desk = width >= 720;
  const token = randomBytes(20).toString('base64url'); // made up, never a real link
  const ctx = await browser.newContext({ viewport: { width, height: desk ? 900 : 844 }, hasTouch: !desk, deviceScaleFactor: 2, timezoneId: tz, serviceWorkers: 'block' });
  await ctx.route('**/*', (r) => (r.request().url().startsWith(origin) ? r.fallback() : r.abort()));
  const doc = {
    v: 4, meta: { name: 'Crew', inviteFestId: FID }, spotify: {}, affinity: {},
    people: Object.fromEntries(CREW.members.map((n, i) => [n, { colorIndex: i }])),
    festivals: { [FID]: { selections: CREW.picks } },
  };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) })
    : r.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (r) => r.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route('**/fn-i/**', (r) => r.fulfill({ status: 200, body: '{}' }));
  await ctx.addInitScript(([t, f, me, v]) => {
    if (v) localStorage.setItem(`fn_view_v1_${f}`, v);
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Crew' }]));
    localStorage.setItem(`fn_me_v3_${t}`, me);
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
    localStorage.setItem('fn_welcome_v1', '1');
    localStorage.setItem('fn_welcome_joined_v1', '1');
    localStorage.setItem('fn_errlog_off_v1', '1');
    window.__shared = [];
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async (d) => { window.__shared.push(d); } });
  }, [token, FID, CREW.me, view]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(at);
  await page.goto(`${origin}/#g=${token}&f=${FID}`);
  await page.waitForSelector('#wall-root .day-block', { timeout: 15000 });
  await fontsIn(page);
  await motionDone(page);
  await sleep(300);
  return { ctx, page, token, desk, errors: () => errors.filter((e) => !/reg\.update|reading 'update'/.test(e)) };
}

export const read = (page, desk) => page.evaluate((d) => {
  const door = d ? 'rail' : 'dock';
  const row = document.getElementById(`${door}-days`);
  const tabs = row ? [...row.children].filter((t) => !t.hidden).map((t) => `${t.classList.contains('now-tab') ? 'NOW' : t.textContent.trim()}${t.classList.contains('active') ? '*' : ''}`) : [];
  const now = document.getElementById(`${door}-now`);
  const cardName = (c) => {
    const room = c.closest('.room');
    const block = c.closest('.day-block');
    return `${c.dataset.artist} @ ${block ? block.dataset.day : '?'}|${room ? room.dataset.room : '?'}|${(c.closest('[data-iso]') || {}).dataset?.iso || ''}`;
  };
  const blocks = [...document.querySelectorAll('#wall-root > .day-block')].map((b) => {
    const rooms = [...b.querySelectorAll(':scope > .room')].map((r) => ({
      room: r.dataset.room, iso: r.dataset.iso || r.dataset.isos || '', quiet: r.classList.contains('quiet'),
      head: (r.querySelector(':scope > .room-head') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
      cards: [...r.querySelectorAll('.card[data-artist]')].map((c) => `${c.dataset.artist}${c.classList.contains('now') ? '[NOW]' : ''}${c.classList.contains('past') ? '[past]' : ''}${c.dataset.nowFrom ? `(${c.dataset.nowFrom}-${c.dataset.nowTo})` : ''}`).slice(0, 12),
    }));
    return { day: b.dataset.day, rooms: rooms.filter((r) => r.iso <= '2026-10-04' || /Late/i.test(r.room)).slice(0, 8) };
  });
  const plan = document.getElementById('plan');
  return {
    tabs,
    nowShown: !!(now && !now.hidden && now.offsetParent !== null),
    lit: [...document.querySelectorAll('#wall-root .card.now')].map(cardName),
    nowLine: [...document.querySelectorAll('#wall-root .now-line')].filter((l) => l.offsetParent !== null).map((l) => (l.closest('.day-block') || {}).dataset?.day),
    pastLines: [...document.querySelectorAll('#wall-root .past-line')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()),
    blocks: blocks.map((b) => ({ day: b.day, rooms: b.rooms.length ? b.rooms : undefined })),
    plan: plan && !plan.hidden ? { state: plan.dataset.state, text: plan.textContent.replace(/\s+/g, ' ').trim().slice(0, 240) } : null,
    scrollY: Math.round(window.scrollY),
  };
}, desk);

// What sits in the viewport under the chrome: the first few cards whose box
// is on screen.
export const inView = (page) => page.evaluate(() => {
  const vh = window.innerHeight;
  return [...document.querySelectorAll('#wall-root .card[data-artist]')].filter((c) => {
    const b = c.getBoundingClientRect();
    return b.bottom > 80 && b.top < vh - 120 && b.width > 0;
  }).slice(0, 6).map((c) => `${c.dataset.artist}${c.classList.contains('now') ? '[NOW]' : ''}`);
});

export async function pressNow(page, desk) {
  const sel = desk ? '#rail-now' : '#dock-now';
  const loc = page.locator(sel);
  if (!(await loc.isVisible())) return 'no NOW';
  const b = await loc.boundingBox();
  if (desk) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  else await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(1400);
  await motionDone(page).catch(() => {});
  return inView(page);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const engineName = args.includes('--webkit') ? 'webkit' : 'chromium';
  const view = args.includes('--list') ? 'list' : null;
  const tz = (args.find((a) => a.startsWith('--tz=')) || '--tz=America/Chicago').slice(5);
  const only = args.filter((a) => !a.startsWith('--'));
  const widths = args.includes('--desk') ? [1280] : args.includes('--phone') ? [390] : [390, 1280];
  const pw = await import('playwright');
  const browser = await pw[engineName].launch({ headless: true });
  const server = await serveStatic(ROOT);
  fs.mkdirSync(SHOTS, { recursive: true });
  try {
    for (const [id, at] of Object.entries(CLOCKS)) {
      if (only.length && !only.some((o) => id.startsWith(o))) continue;
      for (const width of widths) {
        const { ctx, page, desk, errors } = await openAcl(browser, server.origin, { at, width, view, tz });
        try {
          const before = await read(page, desk);
          await page.screenshot({ path: path.join(SHOTS, `${engineName}-${view || 'board'}-${id}-${width}.png`) });
          const landed = await pressNow(page, desk);
          await page.screenshot({ path: path.join(SHOTS, `${engineName}-${view || 'board'}-${id}-${width}-now.png`) });
          const landed2 = landed === 'no NOW' ? null : await pressNow(page, desk);
          console.log(`\n==== ${engineName} ${view || 'board'} ${id} ${width} (${tz})`);
          console.log(JSON.stringify({ ...before, landed, landed2, errors: errors() }, null, 1));
        } finally { await ctx.close(); }
      }
    }
  } finally { await browser.close(); await server.close(); }
}
