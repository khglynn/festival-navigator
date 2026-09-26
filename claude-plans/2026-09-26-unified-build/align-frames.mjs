// The left edge's frames (2026-09-26, ALIGN-BUILD.md): the Phase 1 rig
// (list-rig.mjs — this worktree's app as it ships, a local server, /api from
// memory with a made-up crew, the service worker blocked; never production),
// Board and List, Portola's Saturday and an ACL day, at 1280 / 900 / 390 / 320.
// Frames land in list-shots/align-<tag>/ (git-ignored).
//
//   node claude-plans/2026-09-26-unified-build/align-frames.mjs <tag> [frame-id-prefix …]
import fs from 'node:fs';
import path from 'node:path';
import { openRig, openApp, SHOTS, PT, CDT, sleep, tap, click, writes } from './list-rig.mjs';

const [tag = 'x', ...prefixes] = process.argv.slice(2);
const OUT = path.join(SHOTS, `align-${tag}`);
const SAT = PT('2026-09-26T16:15:00');
const ACL_SAT = CDT('2026-10-03T20:00:00');
const room = (day, r) => `.day-block[data-day="${day}"] .room[data-room="${r}"]`;
const late = (iso) => `.day-block .room[data-room="Late nights"][data-iso="${iso}"]`;
const WIDTHS = [1280, 900, 390, 320];

// Put an element's top `frac` of the way down the screen under the chrome.
async function scrollAt(page, sel, frac) {
  await page.evaluate(([s, f]) => {
    const el = document.querySelector(s);
    if (!el) throw new Error(`no ${s}`);
    const off = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jump-offset')) || 0;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off - (window.innerHeight - off) * f);
  }, [sel, frac]);
  await sleep(900);
}
const press = (w) => (w >= 720 ? click : tap);
const openDays = (w) => async (p) => {
  await p.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  await press(w)(p, '#wall-root > .past-line');
};

const SETS = [
  // Board: the top (EARLIER, SAT PORTOLA, the strip), Earlier open (Friday's
  // Folsom and Afters running into SAT PORTOLA — Kevin's frame 1), the grid's
  // end into SAT AFTERS (frame 2), SAT FOLSOM by time; ACL's Saturday grid and
  // a Late nights day (stacks, no clock).
  { id: 'b-top', view: 'board', at: 'top' },
  { id: 'b-earlier-open', view: 'board', pre: openDays, at: room('Saturday', ':fest'), frac: 0.62 },
  { id: 'b-days-open-top', view: 'board', pre: openDays, at: 'top' },
  { id: 'b-sat-afters', view: 'board', at: room('Saturday', 'Afters'), frac: 0.4 },
  { id: 'b-sat-folsom', view: 'board', at: room('Saturday', 'Folsom'), frac: 0.2 },
  { id: 'b-acl-sat', view: 'board', fid: 'acl-2026', now: ACL_SAT, at: '.day-block[data-day="Saturday|W1"] .room[data-room=":fest"]', frac: 0.1 },
  { id: 'b-acl-late', view: 'board', fid: 'acl-2026', now: ACL_SAT, at: late('2026-10-03'), frac: 0.1 },
  // List: the same places.
  { id: 'l-top', view: 'list', at: 'top' },
  { id: 'l-sat-afters', view: 'list', at: room('Saturday', 'Afters'), frac: 0.1 },
  { id: 'l-sat-folsom', view: 'list', at: room('Saturday', 'Folsom'), frac: 0.1 },
  { id: 'l-acl-sat', view: 'list', fid: 'acl-2026', now: ACL_SAT, at: '.day-block[data-day="Saturday|W1"] .room[data-room=":fest"]', frac: 0.1 },
];

const want = (id) => !prefixes.length || prefixes.some((p) => id.startsWith(p));
fs.mkdirSync(OUT, { recursive: true });
const rig = await openRig();
const report = [];
try {
  for (const s of SETS) {
    for (const width of WIDTHS) {
      const id = `${s.id}-${width}`;
      if (!want(id)) continue;
      const height = width >= 720 ? 900 : 844;
      const { ctx, page, errors } = await openApp(rig, { now: s.now || SAT, width, height, view: s.view, fid: s.fid });
      try {
        if (s.pre) await s.pre(width)(page);
        if (process.env.ALIGN_CSS) await page.addStyleTag({ content: process.env.ALIGN_CSS }); // a variant, framed beside the build (never shipped this way)
        if (s.at === 'top') { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(900); }
        else await scrollAt(page, s.at, s.frac ?? 0.1);
        await page.screenshot({ path: path.join(OUT, `${id}.png`) });
        report.push(`${id}: ok${errors.length ? ` — page errors: ${errors.join(' | ')}` : ''}`);
      } finally { await ctx.close(); }
    }
  }
} finally { await rig.close(); }
report.push(`writes refused: ${writes.length} (${[...new Set(writes)].join(', ')})`);
console.log(report.join('\n'));
