// The people-menu frames (2026-09-25, on v92): 390 and 320, 2x PNG, the real
// app with the made-up crew of nine; one headless Chromium, one page per
// frame, API stubbed, no network, no database.
//   node frames.mjs [id-prefix ...]
import { openRig, openApp, REL, sleep } from './rig.mjs';

const PT = (iso) => new Date(`${iso}-07:00`);
const SAT_11AM = PT('2026-09-26T11:00:00');
const proto = `/${REL}/proto.mjs`;
const calls = (page, list) => page.evaluate(async ([url, l]) => {
  const P = await import(url);
  await P.ensureCss();
  let out = null;
  for (const [f, a] of l) out = await P[f](a);
  return out;
}, [proto, list]);
const headTop = (page, text, y) => page.evaluate(([t, yy]) => {
  const h = [...document.querySelectorAll('#wall-root .room-head')].find((e) => e.textContent.replace(/\s+/g, ' ').trim().startsWith(t));
  if (!h) throw new Error(`no head ${t}`);
  window.scrollTo(0, h.getBoundingClientRect().top + scrollY - yy);
}, [text, y]);
const HL = ['Ben', 'Cy'];

const FRAMES = [];
for (const width of [390, 320]) {
  FRAMES.push(
    // The top of the wall, before (v92) and after (mobile: no people row).
    { id: `top-before-${width}`, width, async run(p) { await p.evaluate(() => window.scrollTo(0, 0)); } },
    { id: `top-after-${width}`, width, async run(p) { await calls(p, [['after', null]]); await p.evaluate(() => window.scrollTo(0, 0)); } },
    // The two menus, one each side of the dock.
    { id: `L-${width}`, width, async run(p) { await calls(p, [['after', null]]); await headTop(p, 'SAT PORTOLA', 14); await calls(p, [['highlightMenu', {}]]); } },
    { id: `R-${width}`, width, async run(p) { await calls(p, [['after', null]]); await headTop(p, 'SAT PORTOLA', 14); await calls(p, [['showMenu', null]]); } },
    // Highlight on: the menu shows the checks, the wall dims live behind it.
    { id: `LH-${width}`, width, highlight: HL, async run(p) { await calls(p, [['after', null]]); await headTop(p, 'SAT PORTOLA', 14); await calls(p, [['highlightMenu', {}]]); } },
    // Menu closed, deep in the wall: the avatar slot is the faces and a ✕.
    { id: `pill-${width}`, width, highlight: HL, async run(p) { await calls(p, [['after', null]]); await headTop(p, 'SAT AFTERS', 14); await calls(p, [['pill', null]]); } },
    // Pick as someone else → the join shelf's claim step (the real component).
    { id: `pickas-${width}`, width, async run(p) { await calls(p, [['after', null]]); await headTop(p, 'SAT PORTOLA', 14); await calls(p, [['pickAs', { tap: 'Ben' }]]); } },
    // A guest: the dashed +, and the same menu with Join where Pick-as was.
    { id: `guest-${width}`, width, guest: true, async run(p) { await calls(p, [['after', null]]); await headTop(p, 'SAT PORTOLA', 14); await calls(p, [['highlightMenu', { guest: true }]]); } },
  );
}

const only = process.argv.slice(2);
const todo = FRAMES.filter((f) => !only.length || only.some((o) => f.id.startsWith(o)));
const rig = await openRig();
try {
  for (const f of todo) {
    const { ctx, page } = await openApp(rig, { now: f.now || SAT_11AM, width: f.width, crew: 9, guest: !!f.guest, highlight: f.highlight || null });
    try {
      await f.run(page);
      await sleep(700);
      await page.screenshot({ path: new URL(`./frames/${f.id}.png`, import.meta.url).pathname });
      console.log(f.id, 'ok');
    } catch (e) { console.log(f.id, 'FAILED', e.message); } finally { await ctx.close(); }
  }
} finally { await rig.close(); }
