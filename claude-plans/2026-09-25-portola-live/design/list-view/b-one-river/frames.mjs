// One river — the frames (list-view round, 2026-09-26, on v95). One headless
// Chromium, one page per frame, the real app + proto.mjs, the made-up crew.
//   node frames.mjs [id-prefix ...]
// Frames land in ./frames (git-ignored PNGs). Whole-day frames are STITCHED
// from viewport slices, never a fullPage capture: Chromium's full-page capture
// drops touch emulation and every 44px floor collapses (folsom-by-time rig).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openRig, openApp, HERE, writes, sleep } from './rig.mjs';

const OUT = path.join(HERE, 'frames');
const SLICES = path.join(HERE, '.slices');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SLICES, { recursive: true });
const PT = (s) => new Date(`${s}-07:00`);
const SAT_NIGHT = PT('2026-09-26T23:30:00'); // tonight, planning Sunday
const SUN_210 = PT('2026-09-27T14:10:00');   // Sunday at 2, live
const H = (h) => h * 60;
const P = (page, fn, arg = null) => page.evaluate(async ([src, a]) => {
  const Pm = await import('/__proto/proto.mjs');
  // eslint-disable-next-line no-new-func
  return new Function('P', 'a', `return (async () => { ${src} })()`)(Pm, a);
}, [fn, arg]);

async function stitch(page, sel, name, { pad = 14 } = {}) {
  await page.addStyleTag({ content: '#dock, .toast, #update-row { visibility: hidden !important; } .rv-divider { position: static !important; }' });
  const box = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { top: Math.round(r.top + scrollY), height: Math.round(r.height) }; }, sel);
  const { height: vh } = page.viewportSize();
  const top = Math.max(0, box.top - pad);
  const total = box.height + 2 * pad;
  const parts = [];
  for (let y = top; y < top + total; y += vh) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await sleep(220);
    const got = await page.evaluate(() => window.scrollY);
    const file = path.join(SLICES, `${name}.${parts.length}.png`);
    await page.screenshot({ path: file });
    parts.push({ file, off: y - got, h: Math.min(vh - (y - got), top + total - y) });
  }
  execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
spec = json.loads(sys.argv[1]); out = sys.argv[2]; dpr = 2
ims = [Image.open(p['file']).crop((0, p['off'] * dpr, Image.open(p['file']).width, (p['off'] + p['h']) * dpr)) for p in spec]
W = ims[0].width; Hh = sum(i.height for i in ims)
s = Image.new('RGB', (W, Hh)); y = 0
for i in ims: s.paste(i, (0, y)); y += i.height
s.save(out, optimize=True)
`, JSON.stringify(parts), path.join(OUT, name)]);
}

const FRAMES = [];
for (const width of [390, 320]) {
  const w = width;
  FRAMES.push(
    // The whole of Sunday, one river (tonight, planning tomorrow).
    { id: `sun-whole-${w}`, width, now: SAT_NIGHT, async run(p) { await P(p, 'return P.river("Sunday")'); await stitch(p, '.day-block[data-day="Sunday"] .rv', `sun-whole-${w}.png`); return 'stitched'; } },
    // Sunday at 2 — the moment, from tonight.
    { id: `sun-2pm-${w}`, width, now: SAT_NIGHT, async run(p) { await P(p, 'await P.river("Sunday"); P.toHour("Sunday", a, 0);', H(14)); } },
    // … and the ALL HOUR line opened into the real cards.
    { id: `sun-2pm-open-${w}`, width, now: SAT_NIGHT, async run(p) { await P(p, 'await P.river("Sunday", { open: [a] }); P.toHour("Sunday", a, 0);', H(14)); } },
    // The top of Sunday: one head, three doors, the whispers.
    { id: `sun-head-${w}`, width, now: SAT_NIGHT, async run(p) { await P(p, 'await P.river("Sunday"); P.toSel(".day-block[data-day=\\"Sunday\\"] .rv", 14);'); } },
  );
}
FRAMES.push(
  // Sunday at 2:10 PM, live: the past folded, the now line, the carried sets.
  { id: 'sun-live-390', width: 390, now: SUN_210, async run(p) { await P(p, 'await P.river("Sunday"); P.toSel(".day-block[data-day=\\"Sunday\\"] .rv", 14);'); } },
  { id: 'sun-live-fold-390', width: 390, now: SUN_210, async run(p) { await P(p, 'await P.river("Sunday"); P.toSel(".day-block[data-day=\\"Sunday\\"] .rv-fold", 70);'); } },
  // Tonight (Sat 11:30 PM), live: the past folded — what the phone shows now.
  { id: 'sat-live-390', width: 390, now: SAT_NIGHT, async run(p) { await P(p, 'await P.river("Saturday"); P.toSel(".day-block[data-day=\\"Saturday\\"] .rv-fold", 60);'); } },
  // The Show menu: rooms are filters; the view and what's over, two new rows.
  { id: 'menu-390', width: 390, now: SAT_NIGHT, async run(p) { await P(p, 'await P.river("Sunday"); P.toHour("Sunday", a, 0); await P.showMenu({ list: true, past: false });', H(14)); } },
  // Folsom switched off: mid-motion (t = .3) and settled.
  { id: 'filter-mid-390', width: 390, now: SAT_NIGHT, async run(p) { await P(p, 'await P.river("Sunday"); P.toHour("Sunday", a, 0); await new Promise((r) => setTimeout(r, 300)); await P.leaveMid("Sunday", "Folsom", .3, {});', H(14)); } },
  { id: 'filter-after-390', width: 390, now: SAT_NIGHT, async run(p) { await P(p, 'await P.river("Sunday", { rooms: [":fest", "Afters"] }); P.toHour("Sunday", a, 0);', H(14)); } },
  // Late: afters + Folsom + the last Portola sets in one hour.
  { id: 'sun-11pm-390', width: 390, now: SAT_NIGHT, async run(p) { await P(p, 'await P.river("Sunday"); P.toHour("Sunday", a, 0);', H(22)); } },
  // Today's board at the same moment, for comparison (production, untouched).
  { id: 'board-sun-2pm-390', width: 390, now: SAT_NIGHT, async run(p) { await p.evaluate(() => { const g = document.querySelector('.day-block[data-day="Sunday"] .room'); window.scrollTo(0, g.getBoundingClientRect().top + scrollY + 150); }); } },
  // A computer: the river wraps as many columns as fit.
  { id: 'sun-2pm-1280', width: 1280, height: 900, desktop: true, now: SAT_NIGHT, async run(p) { await P(p, 'await P.river("Sunday"); P.toHour("Sunday", a, 60);', H(14)); } },
);

const only = process.argv.slice(2);
const todo = FRAMES.filter((f) => !only.length || only.some((o) => f.id.startsWith(o)));
const rig = await openRig();
const report = [];
try {
  for (const f of todo) {
    const { ctx, page, errors } = await openApp(rig, { now: f.now, width: f.width, height: f.height || (f.width === 320 ? 568 : 844), desktop: !!f.desktop });
    try {
      const r = await f.run(page);
      if (r !== 'stitched') { await sleep(600); await page.screenshot({ path: path.join(OUT, `${f.id}.png`) }); }
      const line = `${f.id} ok${errors.length ? ` errors=${JSON.stringify(errors)}` : ''}`;
      report.push(line); console.log(line);
    } catch (e) { report.push(`${f.id} FAILED ${e.message}`); console.log(f.id, 'FAILED', e.message); } finally { await ctx.close(); }
  }
} finally { await rig.close(); }
report.push(`writes refused: ${JSON.stringify(writes)}`);
fs.writeFileSync(path.join(HERE, 'rig-report.txt'), report.join('\n') + '\n');
