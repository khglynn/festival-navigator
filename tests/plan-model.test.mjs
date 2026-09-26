// OUR PLAN — the model (js/v3/plan.js, 2026-09-26). The design rounds'
// rules, ported onto the wall's own week: the golden numbers of the approved
// prototype on Portola, the wall's own now windows, ACL's two weekends and
// dated Late nights, every rule on a tiny festival made for it, and no plan
// where there is no clock. Every clock here is passed in: nothing reads the
// machine's time, so the suite says the same thing at noon, at 4:30 AM UTC
// and in Tokyo. The build log is
// claude-plans/2026-09-26-unified-build/our-plan/plan-model-log.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// The wall renders in jsdom for the windows test; plan.js itself is pure.
const dom = new JSDOM('<!doctype html><html><body><div id="wall-root"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.cancelAnimationFrame = () => {};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const P = await import('../js/v3/plan.js');
const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderWall, refreshCard } = await import('../js/v3/wall.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (id) => JSON.parse(readFileSync(join(ROOT, `data/festivals/${id}.json`), 'utf8'));
const PORTOLA = load('portola-2026');
const ACL = load('acl-2026');
const SEISMIC = load('seismic-9');
const NINE = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/plan-crew-nine.json'), 'utf8'));

const q = P.quietClock;
const M = (h, m = 0) => h * 60 + m; // festival-day minutes (a 1 AM is M(25))
// A route as lines a person can read: tier, when, how many, where (and who,
// for a set or a party — a room's big name is its venue).
const row = (it) => (it.kind === 'scattered'
  ? `··· ${q(it.from)}–${q(it.to)}`
  : `${it.tier} ${q(it.from)}–${q(it.to)} ${it.count} ${it.place.place}${it.place.kind !== 'room' ? ` (${it.acts[0].name})` : ''}`);
const rows = (plan, id) => plan.night(id).items.map(row);
const stops = (plan, id) => plan.night(id).items.filter((i) => i.kind === 'stop');
const stopOf = (plan, id, name) => stops(plan, id).find((s) => s.acts.some((a) => a.name === name));

// ---- 1. golden: the approved prototype's numbers ----------------------------------
// `node claude-plans/2026-09-25-portola-live/design/ours-r2/print-route.mjs`
// on the prototype's head (portola-2026.json md5 e5fb4ad3…), the made-up
// nine. The port moves NONE of them — the log says which rule could have moved
// each and why it did not on this crew. Three lines moved since, with the DATA,
// not the model: main's data release #56 (2026-09-26, md5 af994fcc…) laid the
// Regency rooms out as concerts, so each Regency act starts earlier (AXS: doors
// 9, event 10 PM on Saturday). Thursday's Soulwax 10:30 → 9:30 PM starts that
// stop an hour sooner; Friday's Jyoty 9:15 → 8:45 PM ends the Regency stop
// there; Saturday's Parcels 10:45 → 10 PM pulls Cy off Soulwax at 10:15, so
// that stop is some-4, not most-5. One line moved with the MODEL since: rule
// 3's trip (Kevin, 2026-09-26, "move only for something better, never back")
// keeps Cy at Parcels to its end, 10:55, where she used to leave at 10:30 for
// Public Works, which she wants no more (Horse Meat Disco and Fcukers at 3,
// Parcels at 3) — so Soulwax holds the route until 10:55 and Public Works
// starts there; and on Sunday Eli stays at Public Works through Overmono
// (both 3) instead of leaving at 1:30 AM for SG Lewis (3), so the Great
// Northern stop is three of us, not four.
const THU = ['most 9:30 PM–12 AM 5 Regency Ballroom'];
const FRI = ['some 8 PM–8:45 PM 4 Regency Ballroom', 'some 9 PM–3 AM 4 Public Works'];
const SAT = [
  'some 2:40 PM–3:30 PM 4 Pier Stage (Gelli Haha)',
  'some 3:30 PM–4:30 PM 3 Crane Stage (Tricky)',
  'some 4:45 PM–5:40 PM 4 Warehouse (Groove Armada)',
  'most 5:40 PM–6:30 PM 6 Pier Stage (Tove Lo)',
  'some 6:30 PM–7:10 PM 3 Crane Stage (DJ Shadow)',
  'most 7:10 PM–8:10 PM 7 Pier Stage (Robyn)',
  'some 8:10 PM–8:30 PM 3 Warehouse (Kettama)',
  'some 8:30 PM–9 PM 3 Crane Stage (Fatboy Slim)',
  'most 9 PM–10:15 PM 8 Pier Stage (Dog Blood)',
  'some 10:15 PM–10:55 PM 4 Crane Stage (Soulwax)', // Cy is at Parcels (Regency, 10 PM since #56), and stays to its end (the trip)
  'most 10:55 PM–1:30 AM 6 Public Works',
  'some 1:30 AM–3 AM 4 The Great Northern',
];
const SUN_TAIL = [
  'most 5:35 PM–6:35 PM 5 Pier Stage (Mochakk)', // folded: starts 5:35 (bodies placed before hiding)
  'some 6:45 PM–7:05 PM 4 Warehouse (Tiësto)',
  'some 7:05 PM–8:15 PM 4 Pier Stage (Zara Larsson)',
  'some 8:20 PM–8:45 PM 3 Warehouse (Overmono)',
  'most 8:45 PM–10 PM 8 Pier Stage (Swedish House Mafia)',
  'some 10 PM–10:45 PM 4 Crane Stage (Parcels)',
  'some 10:45 PM–11 PM 3 Warehouse (Four Tet)',
  'some 11:15 PM–12 AM 3 Public Works',
  '··· 12 AM–12:30 AM',
  'some 12:30 AM–1:30 AM 4 The Midway',
  'some 1:30 AM–2 AM 3 The Great Northern', // Eli stays for Overmono (the trip)
];
const SUN = ['some 11 AM–6 PM 4 Folsom St, 8th-13th (Folsom Street Fair)', 'most 6 PM–6:35 PM 5 Pier Stage (Mochakk)', ...SUN_TAIL.slice(1)];
const SUN_FOLDED = [
  'some 1:40 PM–2:55 PM 3 Ship Tent (Kaytree)',
  '··· 2:55 PM–3:30 PM',
  'some 3:30 PM–4:20 PM 3 Pier Stage (Channel Tres)',
  'some 4:30 PM–5:25 PM 4 Pier Stage (SG Lewis)',
  ...SUN_TAIL,
];

test('golden: Portola + the made-up nine reproduce the approved prototype, stop for stop', () => {
  const plan = P.planOf(PORTOLA, { picks: NINE.picks, members: NINE.members });
  assert.deepEqual(plan.us, NINE.members);
  assert.equal(plan.bar, 3);
  assert.equal(plan.available, true);
  assert.deepEqual(plan.nights.map((n) => n.id), ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'], 'nights by date, Thursday first');
  assert.deepEqual(plan.nights.map((n) => n.wd), ['Thu', 'Fri', 'Sat', 'Sun']);
  assert.deepEqual(rows(plan, '2026-09-24'), THU, 'Thu: one stop');
  assert.deepEqual(rows(plan, '2026-09-25'), FRI);
  assert.deepEqual(rows(plan, '2026-09-26'), SAT, 'Sat: twelve stops');
  assert.deepEqual(rows(plan, '2026-09-27'), SUN);
  assert.deepEqual(plan.nights.map((n) => plan.night(n.id).stops), [1, 2, 12, 11]);
});

test('golden, Folsom hidden: only Sunday changes, and Mochakk\'s stop starts 5:35 PM (bodies placed before hiding)', () => {
  const plan = P.planOf(PORTOLA, { picks: NINE.picks, members: NINE.members, folded: ['Folsom'] });
  assert.equal(plan.bar, 3, 'the bar is the whole festival\'s');
  assert.deepEqual(rows(plan, '2026-09-24'), THU);
  assert.deepEqual(rows(plan, '2026-09-25'), FRI, 'Horse Meat Disco is billed to Afters too, so it stays');
  assert.deepEqual(rows(plan, '2026-09-26'), SAT);
  assert.deepEqual(rows(plan, '2026-09-27'), SUN_FOLDED);
  assert.equal(plan.night('2026-09-27').stops, 13);
  // Cy, Dot, Fay and Hal are still at the fair (hidden), so Mochakk's crowd
  // before 6 PM is Ana, Ben and Ivy — never the fair's crowd re-seated.
  const mochakk = stopOf(plan, '2026-09-27', 'Mochakk');
  assert.equal(mochakk.from, M(17, 35));
  assert.deepEqual(mochakk.timeline[0].people, ['Ana', 'Ben', 'Ivy']);
  // Nothing of the hidden section appears anywhere: no stop, no fork.
  for (const n of plan.nights) {
    for (const s of stops(plan, n.id)) {
      assert.ok(s.place.shown, `${s.place.id} is shown`);
      for (const f of s.forks) assert.ok(f.place.shown, `${f.place.id} fork is shown`);
    }
  }
});

test('golden: the Saturday headline stops, the stop shape, and each act\'s occurrence', () => {
  const plan = P.planOf(PORTOLA, { picks: NINE.picks, members: NINE.members });
  const sat = '2026-09-26';
  for (const [name, from, count] of [['Tove Lo', M(17, 40), 6], ['Robyn', M(19, 10), 7], ['Dog Blood', M(21), 8]]) {
    const s = stopOf(plan, sat, name);
    assert.equal(s.tier, 'most', name);
    assert.equal(s.from, from, name);
    assert.equal(s.count, count, name);
  }
  const dog = stopOf(plan, sat, 'Dog Blood');
  assert.equal(dog.nightId, sat);
  assert.equal(dog.placeKind, 'set');
  assert.equal(dog.place.kind, 'set', 'stop.place is the Place object');
  assert.equal(dog.acts, dog.place.acts);
  assert.deepEqual(dog.acts[0].occ, { day: 'Saturday', stage: 'Pier Stage', time: '9:00 PM - 10:15 PM', weekend: null }, 'the grid cell\'s own occurrence (wall.js)');
  assert.equal(dog.musts, 2);
  assert.deepEqual(dog.maybe, []);
  // A room: its acts carry occOf(entry) — the stack card's occurrence.
  const pw = stops(plan, sat).find((s) => s.place.place === 'Public Works');
  assert.equal(pw.placeKind, 'room');
  const milli = pw.acts.find((a) => a.name === 'Milli Meng');
  assert.deepEqual(milli.occ, { day: 'Afters', stage: 'Sat · Public Works', time: '10:30 PM', weekend: null, date: null, venue: 'Public Works' });
  assert.equal(milli.section, 'Afters');
  assert.deepEqual(P.headlinersOf(pw, NINE.picks).map((a) => a.name), ['Milli Meng', 'Chloé Caillet', 'Fcukers']);
  // Rule 5's honesty on Portola: Soulwax (Sat Crane, Thu Regency) is two plays.
  const soulwax = stopOf(plan, sat, 'Soulwax');
  assert.equal(soulwax.leansOnDoubles, true);
  assert.deepEqual(soulwax.alsoAt.map((o) => [o.act, o.nightId, o.place]), [['Soulwax', '2026-09-24', 'Regency Ballroom']]);
  assert.deepEqual(P.alsoOf(soulwax, plan), [{ nightId: '2026-09-24', from: M(21, 30), sameNight: false }], 'Thursday\'s Regency Soulwax, 9:30 PM since #56');
  const ga = stopOf(plan, sat, 'Groove Armada');
  assert.deepEqual(P.alsoOf(ga, plan), [{ nightId: sat, from: M(25, 30), sameNight: true }], 'the same night says its time');
});

test('the port\'s fixes on Portola: Folsom is parties, a two-section show is one place', () => {
  const plan = P.planOf(PORTOLA, { picks: NINE.picks, members: NINE.members });
  const fri = plan.places.filter((p) => p.nightId === '2026-09-25');
  // Friday at The Stud is two parties (5–9 PM, then 10 PM–2 AM), not one room
  // spanning both — and each party ends at its printed end.
  const stud = fri.filter((p) => p.place === 'The Stud');
  assert.equal(stud.length, 2);
  assert.ok(stud.every((p) => p.kind === 'party' && p.roomKeys.join() === 'Folsom'));
  assert.deepEqual(stud.map((p) => [q(p.start), q(p.end)]), [['5 PM', '9 PM'], ['10 PM', '2 AM']]);
  // Horse Meat Disco is billed "Afters & Folsom": one act in one place — the
  // Afters room at Public Works — shown while either section is.
  const hmd = fri.filter((p) => p.acts.some((a) => a.name === 'Horse Meat Disco'));
  assert.equal(hmd.length, 1);
  assert.equal(hmd[0].kind, 'room');
  assert.deepEqual([...hmd[0].roomKeys].sort(), ['Afters', 'Folsom']);
  assert.equal(hmd[0].acts.filter((a) => a.name === 'Horse Meat Disco').length, 1);
  // Sunday's fair is a party of its own with its printed window.
  const fair = stopOf(plan, '2026-09-27', 'Folsom Street Fair');
  assert.equal(fair.placeKind, 'party');
  assert.deepEqual([q(fair.place.start), q(fair.place.end)], ['11 AM', '6 PM']);
  // Every place of the week is on a night the week has.
  const ids = new Set(plan.nights.map((n) => n.id));
  assert.ok(plan.places.every((p) => ids.has(p.nightId)));
});

test('rule 8 reaches "also": a play in a hidden room is never mentioned, though the stop still leans on it', () => {
  const all = P.planOf(PORTOLA, { picks: NINE.picks, members: NINE.members });
  const fatboy = stopOf(all, '2026-09-26', 'Fatboy Slim');
  assert.deepEqual(fatboy.alsoAt.map((o) => [o.nightId, o.place]), [['2026-09-27', '888 Garage']]);
  const noAfters = P.planOf(PORTOLA, { picks: NINE.picks, members: NINE.members, folded: ['Afters'] });
  const hidden = stopOf(noAfters, '2026-09-26', 'Fatboy Slim');
  assert.deepEqual([hidden.from, hidden.count, hidden.leansOnDoubles, hidden.alsoAt], [fatboy.from, fatboy.count, true, []]);
  assert.deepEqual(P.alsoOf(hidden, noAfters), []);
  assert.ok(noAfters.playsAt.get('Fatboy Slim').some((o) => !o.shown), 'playsAt still knows the hidden play (and says so)');
});

test('lazy nights: a route is computed once, on first ask', () => {
  const plan = P.planOf(PORTOLA, { picks: NINE.picks, members: NINE.members });
  const a = plan.night('2026-09-26');
  assert.equal(plan.night('2026-09-26'), a, 'memoized');
  assert.equal(plan.night('2026-09-30'), null, 'not a night');
});

// ---- 2. windows are the wall's ------------------------------------------------------
const TOKEN = 'planmodeltesttoken_0123456';
const DESIGN_PEOPLE = Object.fromEntries(NINE.members.map((n, i) => [n, { colorIndex: i }]));
FESTIVALS['portola-2026'] = PORTOLA;
FESTIVALS['acl-2026'] = ACL;
for (const id of ['portola-2026', 'acl-2026']) if (!FESTIVAL_INDEX.some((f) => f.id === id)) FESTIVAL_INDEX.push({ id, status: 'scheduled' });
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {}, people: DESIGN_PEOPLE,
  festivals: { 'portola-2026': { selections: NINE.picks } }, affinity: {},
}, 'portola-2026');

const renderBoard = (fid) => {
  state.setActiveFestivalId(fid);
  const root = document.getElementById('wall-root');
  root.replaceChildren();
  const ctx = {
    fid, meName: 'Ana', affinity: null, lowPower: true, sort: 'billing', query: '', weekend: 'all',
    filterPeople: [], folded: [], now: new Date('2026-09-20T12:00:00-07:00'), view: 'board',
    picks: model.picksFor(state.crewDoc, fid), onOpenNotes: () => {}, onNotesChange: null, onOpenDayNotes: () => {},
  };
  ctx.onTap = (artist, el) => refreshCard(el, artist, ctx);
  renderWall(root, ctx);
  return root;
};
// Every act the plan holds with a window, keyed the way its card is found on
// the wall: the artist, the occurrence, the room block it renders in (a grid
// set in the festival's room, a room's or party's act in the section whose
// list gave its window) — and, for a grid set, which day's block (an
// untagged ACL set is the same occurrence on both weekends).
function planWindows(plan, nightIds) {
  const out = new Map();
  for (const p of plan.places) {
    if (!nightIds.includes(p.nightId)) continue;
    const night = plan.nights.find((n) => n.id === p.nightId);
    const gridDay = (night.days.find((d) => d.grid) || {}).key || '';
    for (const a of p.acts) {
      if (a.from == null) continue;
      const room = p.kind === 'set' ? ':fest' : a.section;
      out.set(`${a.name}|${JSON.stringify(a.occ)}|${room}|${p.kind === 'set' ? gridDay : ''}`, [a.from, a.to]);
    }
  }
  return out;
}
function checkWindows(root, plan, nightIds, blocks) {
  const want = planWindows(plan, nightIds);
  const seen = new Set();
  for (const block of blocks) {
    for (const card of root.querySelectorAll(`.day-block[data-day="${block}"] .card[data-now-from]`)) {
      const room = card.closest('.room').dataset.room;
      const key = `${card.dataset.artist}|${card.dataset.occ}|${room}|${room === ':fest' ? block : ''}`;
      if (!want.has(key)) continue;
      assert.deepEqual([Number(card.dataset.nowFrom), Number(card.dataset.nowTo)], want.get(key), key);
      seen.add(key);
    }
  }
  const missing = [...want.keys()].filter((k) => !seen.has(k));
  assert.deepEqual(missing, [], 'every timed act the plan holds has its card on the wall');
  return seen.size;
}

test('windows: every Portola Friday and Saturday act has the same now window as its card on the Board', () => {
  const root = renderBoard('portola-2026');
  const plan = P.planOf(PORTOLA, { picks: NINE.picks, members: NINE.members });
  const n = checkWindows(root, plan, ['2026-09-25', '2026-09-26'], ['Friday', 'Saturday']);
  assert.ok(n > 60, `compared ${n} cards`);
});

test('windows: every ACL night — both weekends (an unprinted closer glows +75, the wall\'s rule) and every Late night', () => {
  const root = renderBoard('acl-2026');
  const plan = P.planOf(ACL, { picks: { Skrillex: { A: 1, B: 1, C: 1 } }, members: ['A', 'B', 'C'] });
  const blocks = ['Friday', 'Saturday', 'Sunday'].flatMap((d) => [`${d}|W1`, `${d}|W2`]);
  const n = checkWindows(root, plan, plan.nights.map((n) => n.id), [...blocks, 'Late nights']);
  const skrillex = plan.places.find((p) => p.acts[0].name === 'Skrillex');
  assert.deepEqual([q(skrillex.start), q(skrillex.end)], ['8:15 PM', '9:30 PM'], 'start + 75, as the grid cell glows (the prototype said +60)');
  // Since main's data release #56 (2026-09-26) every Late nights show has a
  // time (posted, or tool-written and marked approx), so all 66 are windows
  // the plan holds — and checkWindows found each one's card, window for window.
  const late = plan.places.filter((p) => p.roomKeys.includes('Late nights')).flatMap((p) => p.acts);
  assert.equal(late.length, 66);
  assert.equal(n, 49 * 2 + 42 * 2 + 66, 'every grid set on both weekends and every Late night, compared');
  // Fcukers on Oct 10: Devil May Care posts 11:45 PM (doors 10), close 2 AM.
  const card = root.querySelector('.day-block[data-day="Late nights"] .room[data-iso="2026-10-10"] .card[data-artist="Fcukers"]');
  assert.deepEqual([Number(card.dataset.nowFrom), Number(card.dataset.nowTo)], [M(23, 45), M(26)]);
});

test('windows: a set whose stage is not a column takes the stack\'s window, as the wall draws it', () => {
  const fest = {
    id: 'plan-stray', name: 'Stray Fest', status: 'scheduled', timezone: 'America/Chicago', artists: [],
    dayMeta: { Saturday: { wd: 'Sat', date: 'Oct 10', iso: '2026-10-10' } },
    days: {
      Saturday: {
        stages: ['Main'],
        artists: [
          { name: 'Main One', stage: 'Main', time: '6:00 PM - 7:00 PM' },
          { name: 'Side One', stage: 'Side', time: '6:00 PM' },
          { name: 'Side Two', stage: 'Side', time: '9:00 PM' },
        ],
      },
    },
  };
  FESTIVALS['plan-stray'] = fest;
  FESTIVAL_INDEX.push({ id: 'plan-stray', status: 'scheduled' });
  const root = renderBoard('plan-stray');
  const plan = P.planOf(fest, { picks: { 'Side One': { A: 2, B: 2, C: 2 } }, members: ['A', 'B', 'C'] });
  assert.equal(checkWindows(root, plan, ['2026-10-10'], ['Saturday']), 3);
  const side = plan.places.find((p) => p.acts[0].name === 'Side One');
  assert.equal(side.kind, 'set');
  assert.deepEqual([q(side.start), q(side.end)], ['6 PM', '9 PM'], 'the next act on its stack, not the grid\'s 120-minute cap');
  assert.deepEqual(rows(plan, '2026-10-10'), ['most 6 PM–9 PM 3 Side (Side One)']);
});

// ---- 3. ACL, a made-up crew -------------------------------------------------------------
const ACL_MEMBERS = ['Ada', 'Bo', 'Cal', 'Dee', 'Eve', 'Flo', 'Gil', 'Hux'];
const ACL_PICKS = {
  'Faouzia': { Ada: 2, Bo: 2, Cal: 1 },              // W1 Miller Lite, W2 American Express: two plays
  'Paris Paloma': { Ada: 3, Dee: 2, Eve: 2 },        // W1 3:15, W2 5:15, both Miller Lite: ONE play
  'Brandon Flowers': { Bo: 3, Cal: 3, Flo: 2 },      // W1 grid + an Oct 1 Late night at Stubb's: two plays
  'Turnstile': { Ada: 3, Bo: 2, Gil: 3, Hux: 2 },    // untagged: both weekends
  'Skrillex': { Cal: 4, Dee: 3, Eve: 3, Flo: 2, Gil: 2 },
  'Charli xcx': { Ada: 4, Bo: 3, Hux: 3 },
  'Kings of Leon': { Ada: 2, Dee: 3, Eve: 3, Hux: 2 },
  'Arcy Drive': { Flo: 3, Gil: 3, Hux: 2 },          // W1 Miller Lite, W2 Beatbox, Oct 8 Brushy Street: three plays
  'Ryan Beatty': { Ada: 2, Bo: 3, Cal: 2 },          // Beatbox both weekends (one play) + an Oct 4 Late night: two
  'Lorde': { Ada: 4, Bo: 3, Cal: 3, Dee: 4, Eve: 2, Flo: 3 },
  'Fcukers': { Bo: 3, Dee: 2, Gil: 3, Hux: 3 },      // Sun Tito's both weekends + Sep 29 Mohawk + Oct 10 Devil May Care
  'The xx': { Ada: 3, Cal: 3, Eve: 4, Flo: 2 },
  'Twenty One Pilots': { Bo: 2, Dee: 3, Gil: 3 },
  'Jess Williamson': { Cal: 2, Eve: 2 },             // W1 Miller Lite + Late nights Oct 1 and Oct 8
};
const ACL_NIGHTS = ['2026-09-29', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];

test('ACL: nights by date from Tue Sep 29 — the six weekend days and every Late nights date, merged where they share one', () => {
  const plan = P.planOf(ACL, { picks: ACL_PICKS, members: ACL_MEMBERS });
  assert.deepEqual(plan.nights.map((n) => n.id), ACL_NIGHTS);
  const byId = Object.fromEntries(plan.nights.map((n) => [n.id, n]));
  assert.equal(byId['2026-09-29'].wd, 'Tue');
  assert.deepEqual(byId['2026-09-29'].days, [], 'a Late-nights-only date has no week day');
  assert.deepEqual(byId['2026-09-29'].extraKeys, ['Late nights']);
  assert.deepEqual(byId['2026-10-02'].days.map((d) => d.key), ['Friday|W1']);
  assert.deepEqual(byId['2026-10-02'].extraKeys, ['Late nights'], 'Friday W1 and that date\'s Late nights are one night');
  assert.deepEqual(byId['2026-10-11'].extraKeys, []);
  // Stops per night. Since #56 the Late nights have times, so a picked show is
  // a stop on its date: Sep 29 Mohawk (Fcukers), Oct 1 Stubb's (Brandon
  // Flowers), Oct 8 Brushy Street (Arcy Drive). Sun Oct 4 read Scoot Inn,
  // Tito's, Scoot Inn, T-Mobile, Scoot Inn — across town and back twice —
  // until rule 3's trip (2026-09-26): Ada goes to Ryan Beatty's Scoot Inn show
  // at 6 PM and leaves it for The xx, which she wants more, never to return;
  // Bo stays at the Scoot Inn through Fcukers (both 3); Cal waits at Zilker for
  // The xx and goes after it. Two of them at the Scoot Inn at any moment is
  // under the bar, so the night is Tito's and T-Mobile.
  assert.deepEqual(plan.nights.map((n) => plan.night(n.id).stops), [1, 1, 6, 3, 2, 0, 0, 1, 5, 4, 2]);
  assert.deepEqual(rows(plan, '2026-10-04'), ['some 6:30 PM–7:30 PM 3 Tito\'s (Fcukers)', '··· 7:30 PM–8:30 PM', 'some 8:30 PM–9:45 PM 4 T-Mobile (The xx)']);
});

test('ACL: no two grid places of one weekend overlap on one stage (the prototype had 41)', () => {
  const plan = P.planOf(ACL, { picks: ACL_PICKS, members: ACL_MEMBERS });
  const sets = plan.places.filter((p) => p.kind === 'set');
  assert.equal(sets.length, 49 * 2 + 42 * 2, 'untagged sets on both weekends, tagged ones on theirs');
  let overlaps = 0;
  for (const n of plan.nights) {
    const here = sets.filter((p) => p.nightId === n.id);
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) {
        if (here[i].place === here[j].place && here[i].start < here[j].end && here[j].start < here[i].end) overlaps += 1;
      }
    }
  }
  assert.equal(overlaps, 0);
  assert.ok(sets.every((p) => /^weekend:W[12]$/.test(p.roomKeys[0])), 'grid places answer to the weekend rows');
});

test('ACL: a Late nights show with a clock is a place on its date — one room per date and venue, a two-act bill included', () => {
  const plan = P.planOf(ACL, { picks: ACL_PICKS, members: ACL_MEMBERS });
  // Before main's data release #56 (2026-09-26) one show here had a clock;
  // since, all 66 do (posted, or tool-written and marked approx). The
  // doors-only rule still holds, on a festival made for it (section 4).
  const shows = ACL.artists.filter((e) => e.day === 'Late nights');
  assert.equal(shows.length, 66);
  assert.ok(shows.every((e) => e.time));
  const late = plan.places.filter((p) => p.roomKeys.includes('Late nights'));
  assert.equal(late.length, 40);
  assert.deepEqual(late.map((p) => p.id).sort(), [...new Set(shows.map((e) => `${e.date}|room|${e.venue}`))].sort());
  assert.ok(late.every((p) => p.kind === 'room'));
  const fcukers = stopOf(plan, '2026-10-10', 'Fcukers');
  assert.equal(fcukers.placeKind, 'room');
  assert.deepEqual([q(fcukers.from), q(fcukers.to), fcukers.count], ['11:45 PM', '2 AM', 4], 'Devil May Care posts 11:45 PM; doors are 10');
  assert.equal(P.tillOf(fcukers), M(26), 'a room\'s NOW row runs to its stop\'s end');
  // A Late-nights-only date with a picked show is a night with a stop: Mohawk
  // on Tue Sep 29 opens with Total Wife at 8, and we arrive for Fcukers.
  assert.deepEqual(rows(plan, '2026-09-29'), ['some 8:45 PM–12 AM 4 Mohawk Austin']);
});

test('ACL: hiding weekend:W1 takes W1\'s stops, keeps its bodies and its Late nights dates; a stale :fest hides nothing', () => {
  const all = P.planOf(ACL, { picks: ACL_PICKS, members: ACL_MEMBERS });
  const w1 = P.planOf(ACL, { picks: ACL_PICKS, members: ACL_MEMBERS, folded: ['weekend:W1'] });
  assert.deepEqual(w1.nights.map((n) => n.id), ACL_NIGHTS, 'every W1 date also has Late nights, so none is dropped');
  for (const id of ['2026-10-02', '2026-10-03', '2026-10-04']) {
    assert.ok(stops(w1, id).every((s) => s.placeKind === 'room'), `${id}: W1's grid stops are gone`);
    assert.deepEqual(w1.nights.find((n) => n.id === id).days, [], `${id}: the hidden weekend day is not listed`);
  }
  // Sun Oct 4 keeps its Late-nights date (Ryan Beatty at the Scoot Inn, 6 PM
  // since #56), and has no stop: Ada, Bo and Cal are seated on W1's hidden
  // sets first (rule 8), and the trip (rule 3) never puts all three at the
  // Scoot Inn at once — hiding the weekend never re-seats its crowd there.
  assert.deepEqual(w1.nights.find((n) => n.id === '2026-10-04').extraKeys, ['Late nights']);
  assert.deepEqual(rows(w1, '2026-10-04'), []);
  for (const id of ['2026-10-09', '2026-10-10', '2026-10-11']) assert.deepEqual(rows(w1, id), rows(all, id), `${id}: W2 untouched`);
  assert.equal(w1.bar, all.bar);
  const hidden = w1.places.filter((p) => p.nightId === '2026-10-02' && p.kind === 'set');
  assert.ok(hidden.length > 20 && hidden.every((p) => !p.shown), 'the W1 sets are still places, hidden');
  // Both weekends and Late nights hidden: nothing is a night.
  const none = P.planOf(ACL, { picks: ACL_PICKS, members: ACL_MEMBERS, folded: ['weekend:W1', 'weekend:W2', 'Late nights'] });
  assert.deepEqual(none.nights, []);
  // A `:fest` key from before the file had weekends is inert on ACL (wall.js).
  const stale = P.planOf(ACL, { picks: ACL_PICKS, members: ACL_MEMBERS, folded: [':fest'] });
  assert.deepEqual(stale.nights.map((n) => [n.id, rows(stale, n.id)]), all.nights.map((n) => [n.id, rows(all, n.id)]));
});

test('ACL: rule 5 — the same stage on the same weekday on the other weekend is one play; another place is another', () => {
  const plan = P.planOf(ACL, { picks: ACL_PICKS, members: ACL_MEMBERS });
  // playsAt is the whole festival's, picked or not: 45 artists since #56 gave
  // the Late nights times (three before). The Chainsmokers, whom nobody here
  // picked, play the Snapchat stage on Friday and an Oct 1 Late night.
  const plays = (name) => [...new Set(plan.playsAt.get(name).map((o) => o.play))];
  assert.equal(plan.playsAt.size, 45);
  assert.deepEqual(plays('The Chainsmokers'), ['The Concourse Project|2026-10-01', 'Snapchat|Fri']);
  // Of this crew's picks:
  assert.deepEqual([...plan.playsAt.keys()].filter((k) => ACL_PICKS[k]).sort(), ['Arcy Drive', 'Brandon Flowers', 'Faouzia', 'Fcukers', 'Jess Williamson', 'Ryan Beatty']);
  assert.ok(!plan.playsAt.has('Paris Paloma'), 'W1 3:15 and W2 5:15 at Miller Lite: one play, the time moved');
  assert.ok(!plan.playsAt.has('Turnstile'));
  assert.deepEqual(plays('Ryan Beatty'), ['Beatbox|Sat', 'Historic Scoot Inn|2026-10-04'], 'Beatbox on both Saturdays is ONE play; the Scoot Inn is another');
  const paloma = stopOf(plan, '2026-10-02', 'Paris Paloma');
  assert.deepEqual([paloma.maybe, paloma.alsoAt, paloma.leansOnDoubles], [[], [], false]);
  const faouzia = stopOf(plan, '2026-10-02', 'Faouzia');
  assert.equal(faouzia.leansOnDoubles, true);
  assert.deepEqual(P.alsoOf(faouzia, plan), [{ nightId: '2026-10-09', from: M(14, 45), sameNight: false }]);
  // Fcukers on Oct 10: the Sunday Tito's set is ONE play but two nights.
  const late = stopOf(plan, '2026-10-10', 'Fcukers');
  assert.deepEqual(late.alsoAt.map((o) => [o.nightId, o.place, o.play]), [['2026-09-29', 'Mohawk Austin', 'Mohawk Austin|2026-09-29'], ['2026-10-04', "Tito's", "Tito's|Sun"], ['2026-10-11', "Tito's", "Tito's|Sun"]]);
  assert.deepEqual(P.alsoOf(late, plan).map((o) => o.nightId), ['2026-09-29', '2026-10-04', '2026-10-11']);
  const sun = stopOf(plan, '2026-10-04', 'Fcukers');
  assert.deepEqual(sun.alsoAt.map((o) => [o.nightId, o.place]), [['2026-09-29', 'Mohawk Austin'], ['2026-10-10', 'Devil May Care']], 'never the same set on the other weekend');
  // How many stops carry an "also" on this crew (the log records it).
  const all = plan.nights.flatMap((n) => stops(plan, n.id));
  assert.deepEqual([all.length, all.filter((s) => s.alsoAt.length).length], [25, 13], 'was [22, 7] before #56, [28, 16] before the trip took Sun Oct 4\'s three Scoot Inn stops');
});

test('ACL: an unprinted closer\'s NOW row runs to the wall\'s end for it', () => {
  const plan = P.planOf(ACL, { picks: ACL_PICKS, members: ACL_MEMBERS });
  const skrillex = stopOf(plan, '2026-10-02', 'Skrillex');
  assert.equal(P.tillOf(skrillex), M(21, 30));
  const kol = stopOf(plan, '2026-10-09', 'Kings of Leon');
  assert.equal(kol.to, M(20, 40), 'the route moves to Charli xcx at 8:40 …');
  assert.equal(P.tillOf(kol), M(21, 30), '… but the NOW row says the set\'s own end');
});

// ---- 4. the rules, on tiny festivals ----------------------------------------------------
const SATD = '2026-10-10';
const SUND = '2026-10-11';
const synth = ({ sat = [], sun = null, artists = [], stages = ['X', 'Y', 'Z', 'W'] } = {}) => ({
  id: 'plan-synth', name: 'Synth Fest', status: 'scheduled', timezone: 'America/Chicago', artists,
  dayMeta: {
    Saturday: { wd: 'Sat', date: 'Oct 10', iso: SATD },
    ...(sun ? { Sunday: { wd: 'Sun', date: 'Oct 11', iso: SUND } } : {}),
    ...(artists.length ? { Afters: { date: 'Oct 10-11' } } : {}),
  },
  days: { Saturday: { stages, artists: sat }, ...(sun ? { Sunday: { stages, artists: sun } } : {}) },
});
const set = (name, stage, time) => ({ name, stage, time });
const lv = (level, ...names) => Object.fromEntries(names.map((n) => [n, level]));
const TWELVE = ['Ana', 'Ben', 'Cy', 'Dot', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kit', 'Lu'];
const planFor = (fest, picks, folded = []) => P.planOf(fest, { picks, members: TWELVE, folded });
const CT = (s) => new Date(`${s}-05:00`); // America/Chicago in October (CDT)

test('the bar: max(3, ceil(US / 4))', () => {
  assert.deepEqual([9, 12, 13, 16, 17, 0, 2].map(P.barFor), [3, 3, 4, 4, 5, 3, 3]);
  assert.deepEqual([P.STEP, P.FLOOR_MIN, P.FLOOR_SHARE, P.MIN_STOP, P.CHANGEOVER], [5, 3, 0.25, 15, 20]);
});

test('US: members with a live pick — never a non-member, never a member with no pick', () => {
  const picks = { A1: { Ana: 2, Stranger: 4, Ben: 0 }, A2: { Cy: 1 } };
  assert.deepEqual(P.usOf(picks, ['Ana', 'Ben', 'Cy', 'Dot']), ['Ana', 'Cy']);
  assert.deepEqual(P.usOf({}, ['Ana']), []);
  const two = P.planOf(synth({ sat: [set('Xa', 'X', '8:00 PM - 9:00 PM')] }), { picks: { Xa: lv(3, 'Ana', 'Ben', 'Stranger') }, members: ['Ana', 'Ben', 'Cy'] });
  assert.deepEqual([two.us, two.available, two.nights, two.night(SATD), two.playsAt.size], [['Ana', 'Ben'], false, [], null, 0], 'under three of us: no plan');
});

test('placement: a higher level beats a bigger crowd', () => {
  const fest = synth({ sat: [set('Xa', 'X', '8:00 PM - 9:00 PM'), set('Ya', 'Y', '8:00 PM - 9:00 PM')] });
  const plan = planFor(fest, { Xa: lv(3, 'Ana', 'Ben', 'Cy'), Ya: { ...lv(2, 'Ana', 'Ben', 'Cy'), Dot: 3 } });
  assert.deepEqual(rows(plan, SATD), ['most 8 PM–9 PM 3 X (Xa)']);
});

test('placement: at the same level, where more of the crew is', () => {
  const fest = synth({ sat: [set('Xa', 'X', '8:00 PM - 9:00 PM'), set('Ya', 'Y', '8:00 PM - 9:00 PM')] });
  const plan = planFor(fest, { Xa: lv(2, 'Ana', 'Ben', 'Cy'), Ya: lv(2, 'Ana', 'Ben', 'Cy', 'Dot', 'Eli') });
  assert.deepEqual(rows(plan, SATD), ['most 8 PM–9 PM 5 Y (Ya)']);
  assert.deepEqual(stops(plan, SATD)[0].forks, []);
});

test('placement: at the same level and crowd, staying put beats the set that just began', () => {
  const fest = synth({ sat: [set('Xa', 'X', '8:00 PM - 10:00 PM'), set('Ya', 'Y', '9:00 PM - 10:00 PM')] });
  const plan = planFor(fest, { Xa: lv(2, 'Ana', 'Ben', 'Cy', 'Dot'), Ya: lv(2, 'Ana', 'Ben', 'Cy', 'Eli') });
  assert.deepEqual(rows(plan, SATD), ['most 8 PM–10 PM 4 X (Xa)']);
});

test('placement: with nowhere to stay, the later start (the set that just began)', () => {
  const fest = synth({ sat: [set('Zed', 'Z', '7:00 PM - 9:00 PM'), set('Xa', 'X', '7:00 PM - 10:00 PM'), set('Ya', 'Y', '9:00 PM - 10:00 PM')] });
  const plan = planFor(fest, { Zed: lv(3, 'Ana', 'Ben', 'Cy'), Xa: lv(2, 'Ana', 'Ben', 'Cy'), Ya: lv(2, 'Ana', 'Ben', 'Cy') });
  assert.deepEqual(rows(plan, SATD), ['most 7 PM–9 PM 3 Z (Zed)', 'most 9 PM–10 PM 3 Y (Ya)']);
});

// Rule 3's trip (Kevin, 2026-09-26): a body changes site — the grounds, or one
// venue — only for a pick it wants more than anything still to come where it
// is, or once nothing of its own is left there; and never goes back.
test('the trip: nobody leaves the grounds for a room they want no more than a set still to come', () => {
  const room = (name, time) => ({ name, day: 'Afters', night: 'Sat', venue: 'Club', time, doors: '8 PM', close: '1 AM' });
  const fest = synth({ sat: [set('Early', 'X', '6:00 PM - 7:00 PM'), set('Late', 'X', '10:00 PM - 11:00 PM')], artists: [room('Clubber', '8:00 PM')] });
  // Level 2 at the Club, level 2 still to come at the grounds: they wait for Late.
  const stay = planFor(fest, { Early: lv(2, 'Ana', 'Ben', 'Cy'), Clubber: lv(2, 'Ana', 'Ben', 'Cy'), Late: lv(2, 'Ana', 'Ben', 'Cy') });
  // Once Late is over nothing of theirs is left at the grounds, and they go.
  assert.deepEqual(rows(stay, SATD), ['most 6 PM–7 PM 3 X (Early)', '··· 7 PM–10 PM', 'most 10 PM–11 PM 3 X (Late)', 'most 11 PM–1 AM 3 Club']);
  // The Club wanted more (3 over 2): they go at 8 and never come back for Late.
  const go = planFor(fest, { Early: lv(2, 'Ana', 'Ben', 'Cy'), Clubber: lv(3, 'Ana', 'Ben', 'Cy'), Late: lv(2, 'Ana', 'Ben', 'Cy') });
  assert.deepEqual(rows(go, SATD), ['most 6 PM–7 PM 3 X (Early)', '··· 7 PM–8 PM', 'most 8 PM–1 AM 3 Club']);
  // Nothing of theirs left at the grounds: a tie is enough to go.
  const done = planFor(fest, { Early: lv(2, 'Ana', 'Ben', 'Cy'), Clubber: lv(2, 'Ana', 'Ben', 'Cy') });
  assert.deepEqual(rows(done, SATD), ['most 6 PM–7 PM 3 X (Early)', '··· 7 PM–8 PM', 'most 8 PM–1 AM 3 Club']);
});

test('the trip: a site left tonight is never gone back to, even for a must', () => {
  const room = (name, time) => ({ name, day: 'Afters', night: 'Sat', venue: 'Club', time, doors: '6 PM', close: '8 PM' });
  const fest = synth({ sat: [set('Main', 'X', '7:00 PM - 8:00 PM'), set('Closer', 'X', '9:00 PM - 10:00 PM')], artists: [room('Opener', '6:00 PM')] });
  // Opener pulls them off the grounds at 6 (nothing of theirs is live there);
  // Main at 7 is wanted more (4), so they leave the Club; the Club is gone.
  const plan = planFor(fest, { Opener: lv(2, 'Ana', 'Ben', 'Cy'), Main: lv(4, 'Ana', 'Ben', 'Cy'), Closer: lv(3, 'Ana', 'Ben', 'Cy') });
  assert.deepEqual(rows(plan, SATD), ['most 6 PM–7 PM 3 Club', 'most 7 PM–8 PM 3 X (Main)', '··· 8 PM–9 PM', 'most 9 PM–10 PM 3 X (Closer)']);
});

test('route: a stop under 15 minutes folds into the stop before it; a blip with nothing before it is nothing', () => {
  const fest = synth({
    sat: [set('Pre', 'Z', '7:50 PM - 8:00 PM'), set('Xa', 'X', '8:00 PM - 9:00 PM'), set('Ya', 'Y', '9:00 PM - 9:10 PM'), set('Wa', 'W', '9:10 PM - 10:00 PM')],
  });
  const three = lv(2, 'Ana', 'Ben', 'Cy');
  const plan = planFor(fest, { Pre: three, Xa: three, Ya: { ...lv(3, 'Ana', 'Ben', 'Cy'), Dot: 3 }, Wa: three });
  assert.deepEqual(rows(plan, SATD), ['most 8 PM–9:10 PM 3 X (Xa)', 'most 9:10 PM–10 PM 3 W (Wa)']);
  assert.deepEqual(stops(plan, SATD)[0].forks, [], 'the ten-minute set is too short to be a fork too');
});

test('route: a gap under 20 minutes is a changeover, not scattered; a longer one is scattered', () => {
  const fest = synth({ sat: [set('Xa', 'X', '8:00 PM - 9:00 PM'), set('Ya', 'Y', '9:15 PM - 10:00 PM'), set('Wa', 'W', '10:30 PM - 11:00 PM')] });
  const three = lv(2, 'Ana', 'Ben', 'Cy');
  const plan = planFor(fest, { Xa: three, Ya: three, Wa: three });
  assert.deepEqual(rows(plan, SATD), ['most 8 PM–9 PM 3 X (Xa)', 'most 9:15 PM–10 PM 3 Y (Ya)', '··· 10 PM–10:30 PM', 'most 10:30 PM–11 PM 3 W (Wa)']);
});

test('route: a fork under 15 minutes is dropped, a longer one kept', () => {
  const fest = synth({ sat: [set('Xa', 'X', '8:00 PM - 10:00 PM'), set('Ya', 'Y', '8:00 PM - 8:10 PM'), set('Wa', 'W', '8:00 PM - 8:30 PM')] });
  const plan = planFor(fest, { Xa: lv(3, 'Ana', 'Ben', 'Cy', 'Dot', 'Eli'), Ya: lv(3, 'Fay', 'Gus', 'Hal'), Wa: lv(3, 'Ivy', 'Jo', 'Kit') });
  assert.equal(plan.us.length, 11);
  const [x] = stops(plan, SATD);
  assert.equal(x.tier, 'some', '5 of 11 is not more than half');
  assert.deepEqual(x.forks.map((f) => `${f.place.place} ${q(f.from)}–${q(f.to)} ${f.count}`), ['W 8 PM–8:30 PM 3']);
});

test('most is strictly more than half of US', () => {
  const fest = synth({ sat: [set('S1', 'Z', '5:00 PM - 5:30 PM'), set('S2', 'W', '5:00 PM - 5:30 PM'), set('S3', 'Z', '5:30 PM - 6:00 PM'), set('Xa', 'X', '8:00 PM - 9:00 PM'), set('Ya', 'Y', '9:00 PM - 10:00 PM')] });
  const plan = planFor(fest, { S1: { Fay: 1 }, S2: { Gus: 1 }, S3: { Hal: 1 }, Xa: lv(2, 'Ana', 'Ben', 'Cy', 'Dot'), Ya: lv(2, 'Ana', 'Ben', 'Cy', 'Dot', 'Eli') });
  assert.equal(plan.us.length, 8);
  assert.deepEqual(rows(plan, SATD), ['some 8 PM–9 PM 4 X (Xa)', 'most 9 PM–10 PM 5 Y (Ya)']);
});

test('leansOnDoubles: half or more of the peak here only for an act that plays twice — and "also" says where', () => {
  const entry = (name, time) => ({ name, day: 'Afters', night: 'Sat', venue: 'Club', time, doors: '10 PM', close: '2 AM' });
  const artists = [entry('Once', '10 PM'), entry('Twice', '11 PM'), entry('Last', '1 AM')];
  const fest = synth({ sat: [set('Twice', 'X', '6:00 PM - 7:00 PM')], artists });
  const leaning = planFor(fest, { Twice: lv(2, 'Ana', 'Ben'), Once: lv(2, 'Cy', 'Dot'), Last: lv(2, 'Cy', 'Dot') });
  const [room] = stops(leaning, SATD);
  assert.equal(room.placeKind, 'room');
  assert.deepEqual([room.count, room.maybe, room.leansOnDoubles], [4, ['Ana', 'Ben'], true]);
  assert.deepEqual(room.alsoAt.map((o) => [o.act, o.place, o.from]), [['Twice', 'X', M(18)]]);
  assert.deepEqual(P.alsoOf(room, leaning), [{ nightId: SATD, from: M(18), sameNight: true }]);
  assert.deepEqual(P.headlinersOf(room, { Twice: lv(2, 'Ana', 'Ben'), Once: lv(2, 'Cy', 'Dot'), Last: lv(2, 'Cy', 'Dot') }).map((a) => a.name), ['Once', 'Twice', 'Last']);
  const sure = planFor(fest, { Twice: { Ana: 2 }, Once: lv(2, 'Ben', 'Cy', 'Dot'), Last: lv(2, 'Ben', 'Cy', 'Dot') });
  const [r2] = stops(sure, SATD);
  assert.deepEqual([r2.count, r2.maybe, r2.leansOnDoubles, r2.alsoAt], [4, ['Ana'], false, []]);
});

test('headlinersOf: by how many of the stop\'s people picked each, then play order; three, in play order', () => {
  const act = (name, from) => ({ name, from });
  const stop = { people: ['Ana', 'Ben', 'Cy'], place: { acts: [act('a1', 10), act('a2', 20), act('a3', 30), act('a4', 40)] } };
  const picks = { a1: { Ana: 1, Dot: 4, Eli: 4 }, a2: lv(2, 'Ana', 'Ben', 'Cy'), a3: lv(1, 'Ben', 'Cy'), a4: { Ana: 3, Ben: 3, Cy: 0 } };
  assert.deepEqual(P.headlinersOf(stop, picks).map((a) => [a.name, a.n]), [['a2', 3], ['a3', 2], ['a4', 2]]);
});

test('forkFor: an even fork (as big as the stop, over most of it) beats a bigger one; else the biggest, then the earliest', () => {
  const stop = (forks) => ({ from: 0, to: 100, count: 5, forks });
  const even = { count: 5, from: 0, to: 70 };
  const bigger = { count: 6, from: 50, to: 100 };
  assert.equal(P.forkFor(stop([bigger, even]), 3), even);
  const a = { count: 4, from: 30, to: 50 };
  const b = { count: 4, from: 0, to: 20 };
  const c = { count: 3, from: 0, to: 100 };
  assert.equal(P.forkFor(stop([a, c, b]), 3), b, 'biggest, then earliest');
  assert.equal(P.forkFor(stop([a, b]), 5), null, 'under the bar');
  assert.equal(P.forkFor(stop([a, b]), 3, 25), a, 'the NOW row only offers a fork still to run');
});

test('planAt: an after-hours stop keeps LAST night the one being lived past the 5 AM rollover', () => {
  const artists = [{ name: 'Dawn', day: 'Afters', night: 'Sat', venue: 'Aftershock', time: '3 AM - 10 AM' }];
  const fest = synth({ sat: [set('Early', 'X', '8:00 PM - 9:00 PM')], sun: [set('Noon', 'Y', '2:00 PM - 3:00 PM')], artists });
  const plan = planFor(fest, { Dawn: lv(3, 'Ana', 'Ben', 'Cy'), Noon: lv(2, 'Ana', 'Ben', 'Cy') });
  assert.deepEqual(rows(plan, SATD), ['most 3 AM–10 AM 3 Aftershock']);
  const six = P.planAt(plan, fest, CT('2026-10-11T06:00:00'));
  assert.equal(six.night.id, SATD, 'Sunday 6 AM on the clock, Saturday night in the plan');
  assert.equal(six.minutes, M(30));
  assert.equal(six.current.place.place, 'Aftershock');
  assert.deepEqual(six.here, ['Ana', 'Ben', 'Cy']);
  assert.deepEqual(P.peekOf(plan, fest, CT('2026-10-11T06:00:00')), { night: plan.night(SATD), stop: six.current, tag: 'now', count: 3, today: true });
  const four = P.planAt(plan, fest, CT('2026-10-11T04:00:00'));
  assert.deepEqual([four.night.id, four.minutes, four.current && four.current.place.place], [SATD, M(28), 'Aftershock'], 'before 5 AM the clock itself says Saturday');
  const late = P.planAt(plan, fest, CT('2026-10-11T10:30:00'));
  assert.deepEqual([late.night.id, late.current, late.next.place.place], [SUND, null, 'Y'], 'once last night is over, today');
});

test('peekOf: NOW with the count at this minute; else the next MOST stop before a nearer SOME one; else the next night; else nothing', () => {
  const fest = synth({
    sat: [set('Xa', 'X', '6:00 PM - 7:00 PM'), set('Ya', 'Y', '8:00 PM - 9:00 PM')],
    sun: [set('Za', 'Z', '2:00 PM - 3:00 PM'), set('Wa', 'W', '2:30 PM - 3:00 PM')],
  });
  const plan = planFor(fest, { Xa: lv(2, 'Ana', 'Ben', 'Cy'), Ya: lv(2, 'Ana', 'Ben', 'Cy', 'Dot', 'Eli', 'Fay', 'Gus'), Za: lv(2, 'Ana', 'Ben', 'Cy', 'Dot', 'Eli'), Wa: lv(3, 'Ana', 'Ben') });
  assert.equal(plan.us.length, 7);
  const five = P.peekOf(plan, fest, CT('2026-10-10T17:00:00'));
  assert.deepEqual([five.tag, five.stop.acts[0].name, five.count, five.today], ['next', 'Ya', 7, true], 'Xa (3 of 7) is nearer, but MOST of us meet at Ya');
  const sixThirty = P.peekOf(plan, fest, CT('2026-10-10T18:30:00'));
  assert.deepEqual([sixThirty.tag, sixThirty.stop.acts[0].name, sixThirty.count], ['now', 'Xa', 3]);
  const tenPm = P.peekOf(plan, fest, CT('2026-10-10T22:00:00'));
  assert.deepEqual([tenPm.tag, tenPm.stop.acts[0].name, tenPm.today, tenPm.night.id], ['next', 'Za', false, SUND], 'tonight is done: tomorrow\'s first stop');
  // The count at this minute, never the peak: Ana and Ben leave Za at 2:30.
  const za = P.peekOf(plan, fest, CT('2026-10-11T14:40:00'));
  assert.deepEqual([za.tag, za.stop.acts[0].name, za.count, za.stop.count], ['now', 'Za', 3, 5]);
  assert.equal(P.peekOf(plan, fest, CT('2026-10-12T12:00:00')), null, 'after the festival');
  const before = P.peekOf(plan, fest, CT('2026-10-01T12:00:00'));
  assert.deepEqual([before.today, before.night.id, before.stop.acts[0].name], [false, SATD, 'Ya'], 'before it: the first night\'s MOST stop, today false');
  assert.equal(P.planAt(plan, fest, CT('2026-10-01T12:00:00')), null);
});

test('tillOf: a set\'s own end even when the route moves on; quietClock drops ":00"', () => {
  assert.deepEqual([M(21), M(21, 40), M(24), M(24, 30), M(12), M(25, 5)].map(P.quietClock), ['9 PM', '9:40 PM', '12 AM', '12:30 AM', '12 PM', '1:05 AM']);
  assert.equal(P.tillOf({ to: 10, place: { kind: 'set', end: 50, acts: [{ to: 50 }] } }), 50);
  assert.equal(P.tillOf({ to: 10, place: { kind: 'party', end: 40, acts: [{ to: 40 }] } }), 40);
  assert.equal(P.tillOf({ to: 10, place: { kind: 'room', end: 90, acts: [{ to: 30 }] } }), 10);
  assert.equal(P.tillOf(null), null);
});

test('the fold: hidden rooms never show, bodies are placed first, and a one-room festival ignores every key', () => {
  const artists = [{ name: 'Club Act', day: 'Afters', night: 'Sat', venue: 'Club', time: '8:30 PM - 10:00 PM' }];
  const fest = synth({ sat: [set('Xa', 'X', '8:00 PM - 9:00 PM')], artists });
  const picks = { Xa: lv(3, 'Ana', 'Ben', 'Cy', 'Dot'), 'Club Act': { ...lv(2, 'Ana', 'Ben', 'Cy'), Eli: 3, Fay: 3 } };
  assert.deepEqual(rows(planFor(fest, picks), SATD), ['most 8 PM–9 PM 4 X (Xa)', 'most 9 PM–10 PM 5 Club']);
  // Hide the festival's own room: the club stop still starts at 9, because
  // Ana, Ben and Cy are at Xa (hidden) until it ends — never re-seated.
  assert.deepEqual(rows(planFor(fest, picks, [':fest']), SATD), ['most 9 PM–10 PM 5 Club']);
  const hidden = planFor(fest, picks, ['Afters']);
  assert.deepEqual(rows(hidden, SATD), ['most 8 PM–9 PM 4 X (Xa)']);
  // One room only: no show menu, so no key means anything (wall.js).
  const solo = synth({ sat: [set('Xa', 'X', '8:00 PM - 9:00 PM')] });
  assert.deepEqual(rows(planFor(solo, { Xa: lv(2, 'Ana', 'Ben', 'Cy') }, [':fest']), SATD), ['most 8 PM–9 PM 3 X (Xa)']);
});

test('a Late-nights-only date with times gets a plan like any night', () => {
  const late = (name, time) => ({ name, day: 'Late nights', date: '2026-10-06', venue: 'Cellar', time, doors: '9 PM', close: '1 AM' });
  const fest = synth({ sat: [set('Xa', 'X', '8:00 PM - 9:00 PM')], artists: [late('Tue One', '9:30 PM'), late('Tue Two', '11 PM')] });
  const plan = planFor(fest, { 'Tue One': lv(2, 'Ana', 'Ben', 'Cy'), 'Tue Two': lv(2, 'Ana', 'Ben', 'Cy') });
  assert.deepEqual(plan.nights.map((n) => [n.id, n.wd, n.extraKeys]), [[SATD, 'Sat', []], ['2026-10-06', 'Tue', ['Late nights']]].sort());
  assert.deepEqual(rows(plan, '2026-10-06'), ['most 9:30 PM–1 AM 3 Cellar']);
  const tue = P.peekOf(plan, fest, CT('2026-10-06T22:00:00'));
  assert.deepEqual([tue.tag, tue.night.id, tue.count, tue.today], ['now', '2026-10-06', 3, true]);
});

test('a Late night with doors and no set time is no place, and a date of such shows is a night with no stops (no window on the wall either)', () => {
  // ACL's Late nights were like this until main's data release #56 gave every
  // show a time (2026-09-26); the next festival's may be again.
  const doorsOnly = { name: 'Doors Only', day: 'Late nights', date: '2026-10-06', venue: 'Cellar', doors: '9 PM' };
  const fest = { ...synth({ sat: [set('Xa', 'X', '8:00 PM - 9:00 PM')], artists: [doorsOnly] }), id: 'plan-doors' };
  const plan = planFor(fest, { 'Doors Only': lv(3, 'Ana', 'Ben', 'Cy', 'Dot') });
  assert.deepEqual(plan.nights.map((n) => n.id), [SATD, '2026-10-06'].sort());
  assert.equal(plan.night('2026-10-06').stops, 0);
  assert.deepEqual(plan.night('2026-10-06').items, []);
  assert.ok(!plan.places.some((p) => p.acts.some((a) => a.name === 'Doors Only')));
  FESTIVALS['plan-doors'] = fest;
  FESTIVAL_INDEX.push({ id: 'plan-doors', status: 'scheduled' });
  const card = renderBoard('plan-doors').querySelector('.day-block[data-day="Late nights"] .card[data-artist="Doors Only"]');
  assert.ok(card, 'the show has its card');
  assert.equal(card.dataset.nowFrom, undefined, 'and no window');
});

test('the people filter is not an input: the plan is the whole crew', () => {
  const a = P.planOf(PORTOLA, { picks: NINE.picks, members: NINE.members });
  const b = P.planOf(PORTOLA, { picks: NINE.picks, members: NINE.members, filterPeople: ['Ana'] });
  assert.deepEqual(rows(b, '2026-09-26'), rows(a, '2026-09-26'));
});

// Kevin, 2026-09-26: "the filters should filter the now too". The highlight
// never moves the route; it decides which stops the peek may name.
test('a highlight filters the peek: NOW only for a stop they are in, else their next stop, else nothing', () => {
  const plan = P.planOf(PORTOLA, { picks: NINE.picks, members: NINE.members });
  const sat940 = new Date('2026-09-27T04:40:00Z'); // Saturday 9:40 PM PDT, Dog Blood on the Pier Stage
  const peek = (people) => {
    const k = P.peekOf(plan, PORTOLA, sat940, { people });
    return k && [k.tag, k.stop.place.place, q(k.stop.from), k.count];
  };
  assert.deepEqual(peek([]), ['now', 'Pier Stage', '9 PM', 8]);
  assert.deepEqual(peek(['Ana']), ['now', 'Pier Stage', '9 PM', 8], 'the count stays the crew\'s');
  assert.deepEqual(peek(['Gus', 'Hal']), ['now', 'Pier Stage', '9 PM', 8], 'any one of them is enough');
  // Gus is at none of the stops from 9 PM until the Great Northern at 1:30 AM
  // (his Warehouse and Audio crowds are forks, which the peek never names).
  assert.deepEqual(peek(['Gus']), ['next', 'The Great Northern', '1:30 AM', 4]);
  assert.equal(P.peekOf(plan, PORTOLA, sat940, { people: ['Nobody'] }), null);
  // hasAny reads a stop's whole timeline, a fork's peak crowd.
  const sat = stops(plan, '2026-09-26');
  assert.deepEqual(sat.map((s) => P.hasAny(s, ['Gus'])), [false, true, true, false, true, false, true, true, false, false, false, true]);
  const soulwax = sat.find((s) => s.acts[0].name === 'Soulwax');
  assert.deepEqual(soulwax.forks.map((f) => [f.place.place, P.hasAny(f, ['Gus'])]), [['Warehouse', true]]);
  assert.ok(sat.every((s) => P.hasAny(s, [])), 'no highlight: every stop');
});

// ---- 5. no clock, no plan ----------------------------------------------------------------
test('no plan where there is no clock: Seismic 9 and a lineup with days have no nights and no peek', () => {
  const crew = { picks: { [SEISMIC.artists[0].name]: lv(3, 'Ana', 'Ben', 'Cy') }, members: ['Ana', 'Ben', 'Cy'] };
  const seismic = P.planOf(SEISMIC, crew);
  assert.equal(seismic.available, true);
  assert.deepEqual(seismic.nights, []);
  assert.equal(P.planAt(seismic, SEISMIC, CT('2026-10-10T20:00:00')), null);
  assert.equal(P.peekOf(seismic, SEISMIC, CT('2026-10-10T20:00:00')), null);
  const lineup = { id: 'plan-lineup', name: 'Lineup Fest', status: 'lineup', artists: [{ name: 'A1', day: 'Friday' }, { name: 'A2', day: 'Saturday' }] };
  const plan = P.planOf(lineup, { picks: { A1: lv(3, 'Ana', 'Ben', 'Cy') }, members: ['Ana', 'Ben', 'Cy'] });
  assert.deepEqual([plan.nights, plan.places], [[], []]);
  assert.equal(P.peekOf(plan, lineup, CT('2026-10-10T20:00:00')), null);
  assert.equal(P.peekOf(P.planOf(null, crew), null, CT('2026-10-10T20:00:00')), null);
});
