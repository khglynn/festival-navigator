// D — Full-width rows — the frames (2026-09-26). Saturday 4:15 PM at Pier 80.
//   APP=<design-app> node frames.mjs [id-prefix ...]
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { openRig, openApp, PT, sleep, writes, HERE } from './rig.mjs';

const SAT_415P = PT('2026-09-26T16:15:00');
const OUT = path.join(HERE, 'frames');
const SLICES = path.join(HERE, '.slices');
fs.mkdirSync(SLICES, { recursive: true });
const P = (page, fn, ...a) => page.evaluate(async ([f, args]) => { const M = await import('/__proto/proto.mjs'); return M[f](...args); }, [fn, a]);
const settle = async (page) => {
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  await page.clock.runFor(1200).catch(() => {});
  await sleep(450);
};
// Scroll so an element's top sits `lead` px under the sticky chrome.
async function toEl(page, sel, lead = 12) {
  await page.evaluate(([s, l]) => {
    const el = typeof s === 'string' && s.startsWith('HEAD:')
      ? [...document.querySelectorAll('#wall-root .room-head')].find((e) => e.textContent.replace(/\s+/g, ' ').trim().startsWith(s.slice(5)))
      : document.querySelector(s);
    if (!el) throw new Error(`no ${s}`);
    const rail = document.querySelector('.day-rail');
    const chrome = rail && rail.offsetParent ? rail.getBoundingClientRect().height : 0;
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - chrome - l));
  }, [sel, lead]);
  await settle(page);
}
// A room top to bottom, stitched from viewport slices (touch emulation
// survives; a full-page capture drops it — the folsom rig's lesson).
async function longShot(page, sel, name) {
  await page.addStyleTag({ content: '#dock, .day-rail, .toast, #update-row { visibility: hidden !important; }' });
  const box = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { top: Math.round(r.top + scrollY), height: Math.round(r.height) }; }, sel);
  const { height: vh } = page.viewportSize();
  const top = Math.max(0, box.top - 14);
  const total = box.height + 28;
  const parts = [];
  for (let y = top; y < top + total; y += vh) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await sleep(200);
    const got = await page.evaluate(() => window.scrollY);
    const file = path.join(SLICES, `${name}.${parts.length}.png`);
    await page.screenshot({ path: file });
    parts.push({ file, off: y - got, h: Math.min(vh, top + total - y) });
  }
  execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
spec = json.loads(sys.argv[1]); out = sys.argv[2]; dpr = 2
ims = [Image.open(p['file']).crop((0, p['off'] * dpr, Image.open(p['file']).width, (p['off'] + p['h']) * dpr)) for p in spec]
W = ims[0].width; H = sum(i.height for i in ims)
s = Image.new('RGB', (W, H)); y = 0
for i in ims: s.paste(i, (0, y)); y += i.height
s.save(out, optimize=True)
`, JSON.stringify(parts), path.join(OUT, `${name}.png`)]);
}
const fest = '.day-block[data-day="Saturday"] .room[data-room=":fest"]';
const tapEarlier = async (page, roomSel) => {
  const b = await page.locator(`${roomSel} .d-earlier`).boundingBox();
  await page.touchscreen.tap(b.x + 40, b.y + b.height / 2);
  await sleep(900);
};
const clickEarlier = async (page, roomSel) => {
  await page.locator(`${roomSel} .d-earlier`).click();
  await sleep(900);
};
// Numbers the eye should not have to trust.
const measure = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const cards = [...document.querySelectorAll('.day-block[data-day="Saturday"] .band-grid > .card')].filter((c) => c.offsetParent);
  const r = (e) => e.getBoundingClientRect();
  const lefts = new Set(cards.map((c) => Math.round(r(c.querySelector('.name')).left - r(c).left)));
  return {
    shown: cards.length,
    widths: [...new Set(cards.map((c) => Math.round(r(c).width)))],
    heights: [...new Set(cards.map((c) => Math.round(r(c).height)))],
    nameInset: [...lefts],
    overflow: cards.filter((c) => r(c).right > vw + 0.5).length,
    clipped: cards.filter((c) => { const m = c.querySelector('.d-meta'); return m && m.scrollWidth > m.clientWidth + 1; }).map((c) => c.dataset.artist),
    lines: [...document.querySelectorAll('.d-earlier')].filter((b) => b.offsetParent).map((b) => (b.closest('.room') ? `${b.closest('.room').dataset.room}@${b.closest('.time-list').dataset.iso}: ${b.textContent}` : `days: ${b.textContent}`)),
    dock: (() => { const l = document.getElementById('dock-fest-link'); const d = document.getElementById('dock-days'); return l && l.offsetParent ? { link: Math.round(l.getBoundingClientRect().width), days: Math.round(d.getBoundingClientRect().width), daysScroll: d.scrollWidth } : null; })(),
  };
});

const FRAMES = [
  // A. the list, full-width rows (the pick, then the alternative)
  { id: 'flow-sat-now-390', w: 390, async run(p) { await toEl(p, `${fest} .time-list`, 60); } },
  { id: 'flow-sat-top-390', w: 390, async run(p) { await toEl(p, fest); } },
  { id: 'edges-sat-now-390', w: 390, store: { d_card: 'edges' }, async run(p) { await toEl(p, `${fest} .time-list`, 60); } },
  { id: 'flow-sat-now-320', w: 320, h: 640, async run(p) { await toEl(p, `${fest} .time-list`, 60); } },
  { id: 'flow-sat-long-390', w: 390, async run(p) { await longShot(p, '.day-block[data-day="Saturday"]', 'flow-sat-long-390'); } },
  { id: 'edges-sat-long-390', w: 390, store: { d_card: 'edges' }, async run(p) { await longShot(p, '.day-block[data-day="Saturday"]', 'edges-sat-long-390'); } },
  { id: 'flow-sat-1280', w: 1280, h: 860, desktop: true, async run(p) { await toEl(p, fest, 20); } },
  // B. the past fold: folded (above) and opened, same spot
  { id: 'earlier-open-390', w: 390, async run(p) { await toEl(p, `${fest} .time-list`, 60); await tapEarlier(p, fest); await settle(p); } },
  { id: 'earlier-open-top-390', w: 390, async run(p) { await toEl(p, `${fest} .time-list`, 60); await tapEarlier(p, fest); await toEl(p, fest); } },
  { id: 'earlier-open-1280', w: 1280, h: 860, desktop: true, async run(p) { await toEl(p, fest, 20); await clickEarlier(p, fest); await toEl(p, fest, 20); } },
  { id: 'earlier-top-390', w: 390, async run(p) { await p.evaluate(() => window.scrollTo(0, 0)); await settle(p); await P(p, 'lightDay', 'SAT'); } },
  // C. the dock / rail, closed (every frame above) and open
  { id: 'menu-open-390', w: 390, async run(p) { await toEl(p, `${fest} .time-list`, 60); await P(p, 'openMenu', { desktop: false }); } },
  { id: 'menu-open-1280', w: 1280, h: 860, desktop: true, async run(p) { await toEl(p, fest, 20); await P(p, 'openMenu', { desktop: true }); } },
];

const only = process.argv.slice(2);
const todo = FRAMES.filter((f) => !only.length || only.some((o) => f.id.startsWith(o)));
const rig = await openRig();
const report = [];
try {
  for (const f of todo) {
    const { ctx, page, errors } = await openApp(rig, { now: SAT_415P, width: f.w, height: f.h || 844, desktop: !!f.desktop, store: f.store || {} });
    try {
      await f.run(page);
      await sleep(400);
      if (!f.id.includes('long')) await page.screenshot({ path: path.join(OUT, `${f.id}.png`) });
      const m = await measure(page);
      const line = `${f.id} ok ${JSON.stringify(m)}${errors.length ? ` ERRORS ${JSON.stringify(errors)}` : ''}`;
      report.push(line); console.log(line);
    } catch (e) { console.log(f.id, 'FAILED', e.message); report.push(`${f.id} FAILED ${e.message}`); } finally { await ctx.close(); }
  }
} finally {
  await rig.close();
  report.push(`writes attempted (all refused 503): ${writes.length} — ${[...new Set(writes)].join(', ')}`);
  console.log(report.at(-1));
  if (!only.length) fs.writeFileSync(path.join(HERE, 'rig-report.txt'), report.join('\n') + '\n');
}
