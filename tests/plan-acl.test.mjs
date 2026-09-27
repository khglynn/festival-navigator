// ACL ready (the plan-days build's P5, 2026-09-27): the open plan across
// ACL's two Zilker weekends and the dated Late nights between, in the real
// shell (index.html and app.js in jsdom), with the made-up ACL crew of eight
// (tests/fixtures/plan-crew-acl.json — the design round's crew-acl.mjs,
// placeholder names Ada..Hux). Goldens for the days list the open plan draws
// — every head, every row, Earlier's words — at the moments a friend would
// open it: the first Late night; between the weekends, where Mon and Tue have
// no peek (a peek for a later night is tomorrow's only — Kevin, 2026-09-26)
// and Wed opens on Thu with Earlier a date span; the second Saturday, Earlier
// shut and open; and the last night, open at its last stop and still open
// after it. PLAN_ACL_PRINT=1 prints the lists instead of comparing. The Share
// per night needs a list that scrolls, so it is the browser's
// (tests/browser/plan-acl.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- a clock this file can move (before anything reads Date) -----------------------
const RealDate = globalThis.Date;
let offset = 0;
const setClock = (iso) => { offset = RealDate.parse(iso) - RealDate.now(); };
function ShiftedDate(...args) {
  if (!new.target) return new RealDate(RealDate.now() + offset).toString();
  const nt = new.target === ShiftedDate ? RealDate : new.target;
  return Reflect.construct(RealDate, args.length === 0 ? [RealDate.now() + offset] : args, nt);
}
Object.setPrototypeOf(ShiftedDate, RealDate);
Object.defineProperty(ShiftedDate, 'prototype', { value: RealDate.prototype, writable: false });
Object.defineProperty(ShiftedDate, 'now', { value: () => RealDate.now() + offset, writable: true, configurable: true });
globalThis.Date = ShiftedDate;
const TUE_SEP29_6PM = '2026-09-29T18:00:00-05:00';
setClock(TUE_SEP29_6PM);

const { bootShell, settle } = await import('./helpers/shell-rig.mjs');
const { paintFree } = await import('./helpers/paint-free.mjs');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'acl-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const CREW = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/plan-crew-acl.json'), 'utf8'));
const TOKEN = ['plan', 'acl', 'test', 'token', '0123'].join('_'); // made up, never a real link
const DOC = {
  v: 4, meta: { name: 'Eight', inviteFestId: FID }, spotify: {}, affinity: {},
  people: Object.fromEntries(CREW.members.map((n, i) => [n, { colorIndex: i }])),
  festivals: { [FID]: { selections: structuredClone(CREW.picks) } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?') && (opts.method || 'GET') === 'GET') return json(DOC);
  return json({ error: 'not in this test' }, 503); // every write refused: nothing leaves
}
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'Eight' }]),
    [`fn_me_v3_${TOKEN}`]: CREW.me,
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
    fn_coach_v1: '1',
  },
  fetch: network,
});
test.after(() => shell.close());
const { $, dom } = shell;
paintFree(dom.window); // the goldens read words, never paint
await settle(200);
// "On screen" for jsdom: not inside anything hidden (plan-shelf.test.mjs's).
dom.window.Element.prototype.getClientRects = function () {
  for (let e = this; e; e = e.parentElement) {
    if (e.hidden || e.style.display === 'none' || e.classList.contains('hidden') || e.classList.contains('searching')) return [];
  }
  return [{ top: 0, left: 0, width: 1, height: 1 }];
};

const plan = () => $('plan');
const shown = () => !!plan() && !plan().hidden;
const search = $('search-input');
// Repaint on the current clock, the plan closed: the search field's round
// trip (a query takes the peek away; clearing it brings the peek back).
async function repaint() {
  search.value = 'zz';
  search.dispatchEvent(new dom.window.Event('input'));
  search.value = '';
  search.dispatchEvent(new dom.window.Event('input'));
  await settle(40);
}
// The minute's tick on a shown page, the plan open or not (app.js: the
// visibilitychange handler judges the past again and ticks the clock).
Object.defineProperty(dom.window.document, 'visibilityState', { value: 'visible', configurable: true });
async function tick(iso) {
  setClock(iso);
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
  await settle(40);
}
// A node's words as a person reads them: every text in it, in order, spaced.
const words = (el) => {
  const out = [];
  const walk = dom.window.document.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) out.push(n.nodeValue);
  return out.join(' ').replace(/\s+/g, ' ').replace(/ ([,·])/g, (m, c) => (c === ',' ? ',' : m)).trim();
};
// The open plan, top to bottom: the head, then each line of the list — a
// day's head "# ", Earlier's line "» ", a night's why "( )", a drop-in line
// "~ ", an or-line indented, a stop its words with its tier first (MOST, or
// SOME for the rest); the NOW row's grown card is the zoom's, left out.
function days() {
  const head = plan().querySelector('.plan-head .room-head');
  const out = [`HEAD ${words(head)}`];
  for (const r of plan().querySelector('.plan-list').children) {
    if (r.classList.contains('plan-tail') || r.classList.contains('plan-grow')) continue;
    const past = r.classList.contains('past') ? ' (past)' : '';
    if (r.classList.contains('plan-day')) out.push(`# ${words(r)}${past}`);
    else if (r.classList.contains('earlier')) out.push(`» ${words(r)}`);
    else if (r.classList.contains('empty')) out.push(`(${words(r)})${past}`);
    else if (r.classList.contains('dropin')) out.push(`~ ${words(r)}${past}`);
    else if (r.classList.contains('or')) out.push(`    ${words(r)}${past}`);
    else if (r.classList.contains('scattered')) out.push(`  … ${words(r)}${past}`);
    else out.push(`${r.classList.contains('most') ? 'MOST' : 'SOME'} ${words(r)}${past}`);
  }
  return out;
}
const toggle = () => plan().querySelector('.plan-grab').click();
async function openAt(iso) {
  setClock(iso);
  await repaint();
  assert.ok(shown(), `${iso}: the peek is up`);
  toggle();
  assert.equal(plan().dataset.state, 'open');
}
function close() {
  toggle();
  assert.equal(plan().dataset.state, 'peek');
}
// The goldens: the open plan as each moment draws it (a PLAN_ACL_PRINT run,
// read line by line against the data and the model before freezing).
const GOLDEN = {
  tue: [
    "HEAD TUE OUR PICKS Sep 29 · 8 picking",
    "SOME Mohawk Austin Fcukers also Oct 4, Oct 10, Oct 11 NEXT ~8:45 PM 4 picked",
    "# THU Oct 1",
    "SOME Stubb's Jess Williamson → Brandon Flowers also Oct 2, Oct 4, Oct 8 8:30 PM 3 picked",
    "# FRI Oct 2",
    "SOME Faouzia Miller Lite also Oct 9 1:45 PM 3 picked",
    "  … Scattered till 3:15 PM 2:30 PM",
    "SOME Paris Paloma Miller Lite 3:15 PM 3 picked",
    "  … Scattered till 5:15 PM 4:15 PM",
    "SOME Brandon Flowers Miller Lite also Oct 1 5:15 PM 3 picked",
    "SOME Turnstile T-Mobile 6:15 PM 4 picked",
    "  … Scattered till 8:15 PM 7:15 PM",
    "MOST Skrillex T-Mobile C D E F G 8:15 PM 5 picked",
    "    or Charli xcx · American Express 3 picked",
    "SOME Charli xcx American Express 9:30 PM 3 picked",
    "# SAT Oct 3",
    "SOME Arcy Drive Miller Lite also Oct 8, Oct 10 3:15 PM 3 picked",
    "    or Ryan Beatty · Beatbox 3 picked",
    "SOME Ryan Beatty Beatbox also Oct 4 4:15 PM 3 picked",
    "  … Scattered till 8:15 PM 4:30 PM",
    "MOST Lorde T-Mobile A B C D E F 8:15 PM 6 picked",
    "# SUN Oct 4",
    "SOME Fcukers Tito's also Sep 29, Oct 10 6:30 PM 3 picked",
    "  … Scattered till 8:30 PM 7:30 PM",
    "SOME The xx T-Mobile 8:30 PM 4 picked",
    "# MON · TUE Oct 5 – 6",
    "(Nothing picked yet)",
    "# THU Oct 8",
    "SOME Brushy Street Commons Arcy Drive also Oct 3, Oct 10 ~8:45 PM 3 picked",
    "# FRI Oct 9",
    "SOME Faouzia American Express also Oct 2 2:45 PM 3 picked",
    "  … Scattered till 5:15 PM 3:30 PM",
    "SOME Paris Paloma Miller Lite 5:15 PM 3 picked",
    "SOME Turnstile T-Mobile 6:15 PM 4 picked",
    "  … Scattered till 8:15 PM 7:15 PM",
    "SOME Kings of Leon T-Mobile 8:15 PM 4 picked",
    "SOME Charli xcx American Express 8:40 PM 3 picked",
    "# SAT Oct 10",
    "SOME Arcy Drive Beatbox also Oct 3, Oct 8 3:30 PM 3 picked",
    "  … Scattered till 5:30 PM 4:30 PM",
    "SOME Ryan Beatty Beatbox also Oct 4 5:30 PM 3 picked",
    "  … Scattered till 8:15 PM 6:30 PM",
    "MOST Lorde T-Mobile A B C D E F 8:15 PM 6 picked",
    "  … Scattered till 11:45 PM 9:30 PM",
    "SOME Devil May Care Fcukers also Sep 29, Oct 4, Oct 11 11:45 PM 4 picked",
    "# SUN Oct 11",
    "SOME Fcukers Tito's also Sep 29, Oct 10 6:30 PM 4 picked",
    "  … Scattered till 8:30 PM 7:30 PM",
    "SOME The xx T-Mobile 8:30 PM 4 picked",
    "    or Twenty One Pilots · American Express 3 picked",
  ],
  wed: [
    "HEAD THU OUR PICKS Oct 8 · 8 picking",
    "» Earlier · Sep 29 – Oct 6",
    "SOME Brushy Street Commons Arcy Drive also Oct 3, Oct 10 NEXT Thu ~8:45 PM 3 picked",
    "# FRI Oct 9",
    "SOME Faouzia American Express also Oct 2 2:45 PM 3 picked",
    "  … Scattered till 5:15 PM 3:30 PM",
    "SOME Paris Paloma Miller Lite 5:15 PM 3 picked",
    "SOME Turnstile T-Mobile 6:15 PM 4 picked",
    "  … Scattered till 8:15 PM 7:15 PM",
    "SOME Kings of Leon T-Mobile 8:15 PM 4 picked",
    "SOME Charli xcx American Express 8:40 PM 3 picked",
    "# SAT Oct 10",
    "SOME Arcy Drive Beatbox also Oct 3, Oct 8 3:30 PM 3 picked",
    "  … Scattered till 5:30 PM 4:30 PM",
    "SOME Ryan Beatty Beatbox also Oct 4 5:30 PM 3 picked",
    "  … Scattered till 8:15 PM 6:30 PM",
    "MOST Lorde T-Mobile A B C D E F 8:15 PM 6 picked",
    "  … Scattered till 11:45 PM 9:30 PM",
    "SOME Devil May Care Fcukers also Sep 29, Oct 4, Oct 11 11:45 PM 4 picked",
    "# SUN Oct 11",
    "SOME Fcukers Tito's also Sep 29, Oct 10 6:30 PM 4 picked",
    "  … Scattered till 8:30 PM 7:30 PM",
    "SOME The xx T-Mobile 8:30 PM 4 picked",
    "    or Twenty One Pilots · American Express 3 picked",
  ],
  sat: [
    "HEAD SAT OUR PICKS Oct 10 · 8 picking",
    "» Earlier · Sep 29 – Oct 9",
    "SOME Arcy Drive Beatbox also Oct 3, Oct 8 NOW till 4:30 PM 3 picked",
    "  … Scattered till 5:30 PM 4:30 PM",
    "SOME Ryan Beatty Beatbox also Oct 4 5:30 PM 3 picked",
    "  … Scattered till 8:15 PM 6:30 PM",
    "MOST Lorde T-Mobile A B C D E F 8:15 PM 6 picked",
    "  … Scattered till 11:45 PM 9:30 PM",
    "SOME Devil May Care Fcukers also Sep 29, Oct 4, Oct 11 11:45 PM 4 picked",
    "# SUN Oct 11",
    "SOME Fcukers Tito's also Sep 29, Oct 10 6:30 PM 4 picked",
    "  … Scattered till 8:30 PM 7:30 PM",
    "SOME The xx T-Mobile 8:30 PM 4 picked",
    "    or Twenty One Pilots · American Express 3 picked",
  ],
  satEarlier: [
    "HEAD SAT OUR PICKS Oct 10 · 8 picking",
    "» Hide earlier",
    "# TUE Sep 29 (past)",
    "SOME Mohawk Austin Fcukers also Oct 4, Oct 10, Oct 11 ~8:45 PM 4 picked (past)",
    "# THU Oct 1 (past)",
    "SOME Stubb's Jess Williamson → Brandon Flowers also Oct 2, Oct 4, Oct 8 8:30 PM 3 picked (past)",
    "# FRI Oct 2 (past)",
    "SOME Faouzia Miller Lite also Oct 9 1:45 PM 3 picked (past)",
    "  … Scattered till 3:15 PM 2:30 PM (past)",
    "SOME Paris Paloma Miller Lite 3:15 PM 3 picked (past)",
    "  … Scattered till 5:15 PM 4:15 PM (past)",
    "SOME Brandon Flowers Miller Lite also Oct 1 5:15 PM 3 picked (past)",
    "SOME Turnstile T-Mobile 6:15 PM 4 picked (past)",
    "  … Scattered till 8:15 PM 7:15 PM (past)",
    "MOST Skrillex T-Mobile C D E F G 8:15 PM 5 picked (past)",
    "    or Charli xcx · American Express 3 picked (past)",
    "SOME Charli xcx American Express 9:30 PM 3 picked (past)",
    "# SAT Oct 3 (past)",
    "SOME Arcy Drive Miller Lite also Oct 8, Oct 10 3:15 PM 3 picked (past)",
    "    or Ryan Beatty · Beatbox 3 picked (past)",
    "SOME Ryan Beatty Beatbox also Oct 4 4:15 PM 3 picked (past)",
    "  … Scattered till 8:15 PM 4:30 PM (past)",
    "MOST Lorde T-Mobile A B C D E F 8:15 PM 6 picked (past)",
    "# SUN Oct 4 (past)",
    "SOME Fcukers Tito's also Sep 29, Oct 10 6:30 PM 3 picked (past)",
    "  … Scattered till 8:30 PM 7:30 PM (past)",
    "SOME The xx T-Mobile 8:30 PM 4 picked (past)",
    "# MON · TUE Oct 5 – 6 (past)",
    "(Nothing picked yet) (past)",
    "# THU Oct 8 (past)",
    "SOME Brushy Street Commons Arcy Drive also Oct 3, Oct 10 ~8:45 PM 3 picked (past)",
    "# FRI Oct 9 (past)",
    "SOME Faouzia American Express also Oct 2 2:45 PM 3 picked (past)",
    "  … Scattered till 5:15 PM 3:30 PM (past)",
    "SOME Paris Paloma Miller Lite 5:15 PM 3 picked (past)",
    "SOME Turnstile T-Mobile 6:15 PM 4 picked (past)",
    "  … Scattered till 8:15 PM 7:15 PM (past)",
    "SOME Kings of Leon T-Mobile 8:15 PM 4 picked (past)",
    "SOME Charli xcx American Express 8:40 PM 3 picked (past)",
    "# SAT Oct 10",
    "SOME Arcy Drive Beatbox also Oct 3, Oct 8 NOW till 4:30 PM 3 picked",
    "  … Scattered till 5:30 PM 4:30 PM",
    "SOME Ryan Beatty Beatbox also Oct 4 5:30 PM 3 picked",
    "  … Scattered till 8:15 PM 6:30 PM",
    "MOST Lorde T-Mobile A B C D E F 8:15 PM 6 picked",
    "  … Scattered till 11:45 PM 9:30 PM",
    "SOME Devil May Care Fcukers also Sep 29, Oct 4, Oct 11 11:45 PM 4 picked",
    "# SUN Oct 11",
    "SOME Fcukers Tito's also Sep 29, Oct 10 6:30 PM 4 picked",
    "  … Scattered till 8:30 PM 7:30 PM",
    "SOME The xx T-Mobile 8:30 PM 4 picked",
    "    or Twenty One Pilots · American Express 3 picked",
  ],
  sun: [
    "HEAD SUN OUR PICKS Oct 11 · 8 picking",
    "» Earlier · Sep 29 – Oct 10 · 1 stop",
    "SOME The xx T-Mobile NOW till 9:45 PM 4 picked",
    "    or Twenty One Pilots · American Express 3 picked",
  ],
  sunLate: [
    "HEAD SUN OUR PICKS Oct 11 · 8 picking",
    "» Earlier · Sep 29 – Oct 10 · 2 stops",
    "(Nothing left today)",
  ],
  monAfter: [
    "HEAD SUN OUR PICKS Oct 11 · 8 picking",
    "» Earlier · Sep 29 – Oct 10",
    "# SUN Oct 11 (past)",
    "SOME Fcukers Tito's also Sep 29, Oct 10 6:30 PM 4 picked (past)",
    "  … Scattered till 8:30 PM 7:30 PM (past)",
    "SOME The xx T-Mobile 8:30 PM 4 picked (past)",
    "    or Twenty One Pilots · American Express 3 picked (past)",
  ],
};
const PRINT = !!process.env.PLAN_ACL_PRINT;
const same = (got, want, what) => { if (PRINT) console.log(`--- ${what}\n${got.join('\n')}`); else assert.deepEqual(got, want, what); };

test('Tue Sep 29, 6 PM, the first Late night: every night ahead under its head, the bare Mon · Tue one head', async () => {
  await openAt(TUE_SEP29_6PM);
  same(days(), GOLDEN.tue, 'Tue Sep 29 6 PM');
  close();
});

test('Mon Oct 5 and Tue Oct 6 have nothing on, and Thu is not tomorrow: no peek (tomorrow only); Wed Oct 7 opens on Thu with Earlier a span', async () => {
  for (const iso of ['2026-10-05T12:00:00-05:00', '2026-10-06T21:00:00-05:00']) {
    setClock(iso);
    await repaint();
    assert.equal(shown(), false, `${iso}: no peek`);
  }
  await openAt('2026-10-07T12:00:00-05:00');
  same(days(), GOLDEN.wed, 'Wed Oct 7 noon');
  close();
});

test('Sat Oct 10, 4 PM, the second Saturday: Earlier spans the nights behind, Sunday Oct 11 is the last; open, the past under dimmed heads', async () => {
  await openAt('2026-10-10T16:00:00-05:00');
  same(days(), GOLDEN.sat, 'Sat Oct 10 4 PM');
  plan().querySelector('.plan-row.earlier').click();
  same(days(), GOLDEN.satEarlier, 'Sat Oct 10 4 PM, Earlier open');
  plan().querySelector('.plan-row.earlier').click();
  close();
});

test('Sun Oct 11, the last night: open at 9 PM, and still open after its last stop — nothing left today', async () => {
  await openAt('2026-10-11T21:00:00-05:00');
  same(days(), GOLDEN.sun, 'Sun Oct 11 9 PM');
  await tick('2026-10-11T23:30:00-05:00');
  assert.ok(shown() && plan().dataset.state === 'open', 'the open plan stays open past the last stop');
  same(days(), GOLDEN.sunLate, 'Sun Oct 11 11:30 PM');
  toggle(); // nothing to close down to: the shelf goes (plan-shelf settleTo → leave)
  await settle(400);
  assert.equal(shown(), false, 'closed after the last stop, the shelf goes');
});

// Past 5 AM the festival's last night is behind the phone (Sol's important on
// 0f076a6: the plan left open came back as a whole, undimmed Sunday with its
// Share on, as if it were still to come). It stays open on that night, drawn
// as a night before today — dimmed under its head, the way an opened Earlier
// draws one — and its Share names it by its date and sends it whole, as any
// past night's does. Closing lets the shelf go: there is no peek to close to.
test('Mon Oct 12, 5:01 AM, the morning after: a plan left open since the last night draws that night as past, and closing lets it go', async () => {
  await openAt('2026-10-11T21:00:00-05:00');
  await tick('2026-10-11T23:30:00-05:00');
  same(days(), GOLDEN.sunLate, 'Sun Oct 11 11:30 PM');
  const btn = () => plan().querySelector('.plan-share');
  assert.equal(btn().disabled, true, 'at 11:30 PM nothing is left to send today');
  await tick('2026-10-12T05:01:00-05:00');
  assert.ok(shown() && plan().dataset.state === 'open', 'the open plan stays open across the rollover');
  same(days(), GOLDEN.monAfter, 'Mon Oct 12 5:01 AM');
  assert.equal(btn().disabled, false, 'a past night has picks to send');
  assert.match(btn().textContent, /^(Share|Copy) Sun Oct 11’s picks$/, 'the Share names the night by its date, not "today"');
  toggle();
  await settle(400);
  assert.equal(shown(), false, 'closed the morning after, the shelf goes');
});
