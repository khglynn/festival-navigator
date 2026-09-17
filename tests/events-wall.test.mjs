// The composed wall (MODEL-V4, 2026-09-16), rendered by the real modules in
// jsdom: a day holds its rooms, a grid day keeps its timetable and every
// other night is a stack of cards under the place it happens, a dated section
// is its own tab, and the run's two-line WHEN
// still reads the same in the grown card. jsdom has no animate(), so every
// motion path here is the instant one; the motion is the walker's job.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

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

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderWall, refreshCard, dayNavOf, cardFor, roomOf, positionNowMarks } = await import('../js/v3/wall.js');
const facts = await import('../js/v3/card-facts.js');
const { parseEventTime, venueGroupsOf, occOf } = await import('../js/v3/events.js');
const { validateFestivalDoc } = await import('../api/_lib/festival-rules.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
// Portola's afters as the file has them TODAY — venues, times, guesses and
// timeless shows move as venues post, so the wall tests read them from here
// rather than pinning a night that the next data drop rewrites.
const afters = (wd) => portola.artists.filter((a) => a.night === wd && /Afters/.test(a.day));
const groupsOn = (wd) => venueGroupsOf(afters(wd));

const TOKEN = 'eventswalltoken_0123456789';
FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' }, { id: 'lineup-only', status: 'lineup' }, { id: 'grid-only', status: 'scheduled' }, { id: 'tiles-run', status: 'lineup' }, { id: 'dated', status: 'scheduled' }, { id: 'two-dated', status: 'scheduled' }, { id: 'verbose-day', status: 'lineup' }, { id: 'two-rooms', status: 'scheduled' });
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 }, Nhu: { colorIndex: 1 } },
  festivals: { 'portola-2026': { selections: { VTSS: { Kevin: 4 }, 'Channel Tres': { Nhu: 3 } } } },
  affinity: {},
}, 'portola-2026');
FESTIVALS['portola-2026'] = portola;
FESTIVALS['grid-only'] = {
  id: 'grid-only', name: 'Grid Only', status: 'scheduled',
  dayMeta: { Friday: { wd: 'Fri', date: 'Oct 2', iso: '2026-10-02' } }, timezone: 'America/Chicago',
  artists: [{ name: 'One', day: 'Friday' }, { name: 'Two', day: 'Friday' }],
  days: { Friday: { stages: ['A', 'B'], artists: [{ name: 'One', stage: 'A', time: '8:00 PM - 9:00 PM' }, { name: 'Two', stage: 'B', time: '9:00 PM - 10:00 PM' }] } },
};
// A lineup fest whose one section holds a numbered run, a doors-only show and
// a show with neither.
const SRC = 'https://example.test/poster';
FESTIVALS['tiles-run'] = {
  id: 'tiles-run', name: 'Tiles Run', status: 'lineup',
  dayMeta: { Saturday: { wd: 'Sat', date: 'Oct 3' }, Afters: { date: 'Oct 3' } },
  artists: [
    { name: 'Headliner', day: 'Saturday' },
    { name: 'Opener', day: 'Afters', stage: 'Sat · The Room', night: 'Sat', venue: 'The Room', time: '10 PM', approx: true, doors: '10 PM', close: '1 AM', order: { seq: 1, of: 2, source: SRC, confirmed: true } },
    { name: 'Closer', day: 'Afters', stage: 'Sat · The Room', night: 'Sat', venue: 'The Room', time: '11 PM', approx: true, doors: '10 PM', close: '1 AM', order: { seq: 2, of: 2, source: SRC, confirmed: true } },
    { name: 'Nowhere Yet', day: 'Afters', stage: 'Sat · Elsewhere', night: 'Sat', venue: 'Elsewhere' },
  ],
};
// A scheduled fest with a DATED section — ACL's Late nights shape.
FESTIVALS.dated = {
  id: 'dated', name: 'Dated', status: 'scheduled', timezone: 'America/Chicago',
  dayMeta: {
    Friday: { wd: 'Fri', date: 'Oct 2', iso: '2026-10-02' },
    'Late nights': { date: 'Sep 29 – Oct 10', sub: 'around Austin' },
  },
  artists: [
    { name: 'Billed', day: 'Friday' },
    { name: 'Later', day: 'Late nights', date: '2026-10-01', venue: 'Stubb’s', doors: '8 PM' },
    { name: 'First', day: 'Late nights', date: '2026-09-29', venue: 'Mohawk Austin', doors: '7 PM' },
    { name: 'Also First', day: 'Late nights', date: '2026-09-29', venue: 'Mohawk Austin', doors: '7 PM', time: '10 PM', approx: true },
  ],
  days: { Friday: { stages: ['A'], artists: [{ name: 'Billed', stage: 'A', time: '8:00 PM - 9:00 PM' }] } },
};

// A two-weekend scheduled fest that carries both of its dates (ACL's shape).
FESTIVALS['two-dated'] = {
  id: 'two-dated', name: 'Two Dated', status: 'scheduled', timezone: 'America/Chicago',
  dayMeta: { Friday: { wd: 'Fri', dates: { W1: 'Oct 2', W2: 'Oct 9' }, isos: { W1: '2026-10-02', W2: '2026-10-09' } } },
  artists: [{ name: 'Both Weekends', day: 'Friday' }, { name: 'One Only', day: 'Friday', weekends: 'W1' }],
  days: {
    Friday: {
      stages: ['A'],
      artists: [
        { name: 'Both Weekends', stage: 'A', time: '8:00 PM - 9:00 PM' },
        { name: 'One Only', stage: 'A', time: '9:00 PM - 10:00 PM', weekend: 'W1' },
      ],
    },
  },
};

// One artist, one night, two rooms — a set at Room A and a later one at Room
// B, each in its own section, which is the same structural place Portola's
// Horse Meat Disco sits in (one entry, two rooms). Two entries, so two shows.
FESTIVALS['two-rooms'] = {
  id: 'two-rooms', name: 'Two Rooms', status: 'scheduled', timezone: 'America/Los_Angeles',
  dayMeta: {
    Sunday: { wd: 'Sun', date: 'Sep 27', iso: '2026-09-27' },
    Afters: { sub: 'around town' },
    Folsom: { sub: 'the street' },
  },
  artists: [
    { name: 'Billed', day: 'Sunday' },
    { name: 'Two Times', day: 'Afters', stage: 'Fri · Room A', night: 'Fri', venue: 'Room A', time: '9 PM' },
    { name: 'Two Times', day: 'Folsom', stage: 'Fri · Room B', night: 'Fri', venue: 'Room B', time: '1 AM' },
  ],
  days: { Sunday: { stages: ['A'], artists: [{ name: 'Billed', stage: 'A', time: '2:00 PM - 3:00 PM' }] } },
};

// A verbose day key (an early-arrival pre-party's shape) on a fest with a section.
const WED_KEY = 'Wednesday, Sept 16 (Early Arrival Pre-Party)';
FESTIVALS['verbose-day'] = {
  id: 'verbose-day', name: 'Verbose Day', status: 'lineup',
  artists: [
    { name: 'Chassi', day: WED_KEY },
    { name: 'Late Night', day: 'Afters', night: 'Wed', venue: 'The Barn', time: '11 PM' },
  ],
};
// The same verbose key on a lineup fest with no events at all.
FESTIVALS['lineup-only'] = {
  id: 'lineup-only', name: 'Lineup Only', status: 'lineup',
  artists: [{ name: 'Chassi', day: WED_KEY }, { name: 'Headliner', day: 'Friday' }],
};

const ctxFor = (fid, over = {}) => {
  const ctx = {
    fid, meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
    filterPeople: [], folded: [], now: new Date('2026-01-01T12:00:00'),
    taps: [], opened: [],
    picks: model.picksFor(state.crewDoc, fid),
    onOpenNotes: (a) => ctx.opened.push(a), onNotesChange: null, onOpenDayNotes: () => {},
    ...over,
  };
  ctx.onTap = over.onTap || ((artist, el) => { ctx.taps.push(artist); return refreshCard(el, artist, ctx); });
  return ctx;
};
const render = (fid, over = {}) => {
  state.setActiveFestivalId(fid);
  const root = document.getElementById('wall-root');
  const ctx = ctxFor(fid, over);
  renderWall(root, ctx);
  return { root, ctx };
};
const rulesOf = (root) => [...root.querySelectorAll('.day-rule')].map((r) => r.querySelector('.day').textContent);
const roomsUnder = (root, dayKey) => {
  const rule = [...root.querySelectorAll('.day-rule')].find((r) => r.dataset.day === dayKey);
  assert.ok(rule, `no day rule ${dayKey}`);
  const out = [];
  for (let n = rule.nextElementSibling; n && !n.classList.contains('day-rule'); n = n.nextElementSibling) if (n.classList.contains('room')) out.push(n);
  return out;
};
// What a room's list reads as, top to bottom: [venue, sub, [[name, time], …]].
const listOf = (room) => [...room.querySelectorAll('.venue-group')].map((g) => [
  g.querySelector('.stage-head.venue .label').textContent,
  (g.querySelector('.venue-sub') || { textContent: '' }).textContent,
  [...g.querySelectorAll('.stack > .card')].map((c) => [c.dataset.artist, (c.querySelector('.time') || {}).textContent]),
]);
const click = (node) => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

// ---- the composition ---------------------------------------------------------------

test('Portola is composed: THU FRI SAT SUN, each day its rooms in order, the tabs the same list', () => {
  const { root, ctx } = render('portola-2026');
  assert.deepEqual(rulesOf(root), ['THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
  assert.deepEqual([...root.querySelectorAll('.day-rule')].map((r) => [r.dataset.day, r.querySelector('.date').textContent, r.dataset.iso]),
    [['Thursday', 'Thu · Sep 24', '2026-09-24'], ['Friday', 'Fri · Sep 25', '2026-09-25'], ['Saturday', 'Sat · Sep 26', '2026-09-26'], ['Sunday', 'Sun · Sep 27', '2026-09-27']]);
  assert.deepEqual(roomsUnder(root, 'Thursday').map((r) => r.dataset.room), ['Afters']);
  assert.deepEqual(roomsUnder(root, 'Friday').map((r) => r.dataset.room), ['Afters', 'Folsom']);
  assert.deepEqual(roomsUnder(root, 'Saturday').map((r) => r.dataset.room), [':fest', 'Afters', 'Folsom']);
  assert.deepEqual(roomsUnder(root, 'Sunday').map((r) => r.dataset.room), [':fest', 'Afters', 'Folsom']);
  assert.deepEqual([...root.querySelectorAll('.sec-label')].map((l) => l.textContent),
    ['AFTERS', 'AFTERS', 'FOLSOM', 'PORTOLA', 'AFTERS', 'FOLSOM', 'PORTOLA', 'AFTERS', 'FOLSOM']);
  assert.equal(roomsUnder(root, 'Saturday')[0].querySelector('.sec-sub').textContent, 'Pier 80', 'the festival\'s room says where it is');
  assert.deepEqual(dayNavOf(portola, ctx).map((d) => [d.key, d.short, d.long, d.dated]), [
    ['Thursday', 'THU', 'THU', false], ['Friday', 'FRI', 'FRI', false],
    ['Saturday', 'SAT', 'SAT', false], ['Sunday', 'SUN', 'SUN', false]]);
  assert.deepEqual(dayNavOf(portola, { ...ctx, query: 'x' }).map((d) => d.key), ['Thursday', 'Friday', 'Saturday', 'Sunday'],
    'a search is the same week with the misses taken out — the same tabs, never a section\'s name as a place');
  // Nothing of the old view controls survives.
  assert.equal(root.querySelectorAll('.bucket-row, .bucket-chip, .tba, .tba-label, .wall-whisper, .sec-whisper').length, 0);
  // What the show menu offers is asked of the WALL, by the shell that opens it
  // (app.js roomsOnWall, covered in tests/shell-v4.test.mjs) — there is no
  // second inventory here to drift from it.
});

test('a night is venue groups: the venue\'s own stage header, its doors line, its cards stacked in play order', () => {
  const { root } = render('portola-2026');
  const sat = roomsUnder(root, 'Saturday').find((r) => r.dataset.room === 'Afters');
  const want = groupsOn('Sat').map((g) => [
    g.venue, g.sub,
    g.members.map((m) => [m.e.name, m.endStr ? undefined : (m.startStr ? `${m.approx ? '~' : ''}${m.startStr}` : undefined)]),
  ]);
  assert.deepEqual(listOf(sat).map(([v, sub, cards]) => [v, sub, cards.map(([n, t]) => [n, t])]), want,
    'the DOM is the model, venue for venue and card for card');
  assert.ok(want.length > 1 && want.some(([, sub]) => sub), 'Saturday really has several rooms and a doors line — this is not vacuous');
  // The venue head IS a stage header (the festival accent's third home) — a
  // header, never a control.
  const heads = [...sat.querySelectorAll('.venue-group .stage-head')];
  assert.ok(heads.length && heads.every((h) => h.tagName === 'DIV' && h.classList.contains('venue')));
  // A ranged show prints its range; a show with no clock prints none.
  const fri = roomsUnder(root, 'Friday').find((r) => r.dataset.room === 'Afters');
  const despacio = fri.querySelector('.card[data-artist="Despacio"]');
  assert.equal(despacio.querySelector('.time').textContent, '5 – 11 PM', 'the one printed window of the night');
  const noClock = [...sat.querySelectorAll('.card')].find((c) => c.dataset.artist === 'Groove Armada');
  assert.equal(noClock.querySelector('.time'), null, 'doors and no start: a card without a clock, never an invented one');
  assert.equal(root.querySelectorAll('.deck, .deck-layer, .ee-col, .ee-item').length, 0);
});

test('one room, one stack: every venue-night reads top to bottom and nothing overlaps or lanes', () => {
  const { root } = render('portola-2026');
  for (const room of root.querySelectorAll('.room[data-room="Afters"], .room[data-room="Folsom"]')) {
    for (const stack of room.querySelectorAll('.stack')) {
      const cards = [...stack.children];
      assert.ok(cards.every((c) => c.classList.contains('card')), 'a stack holds cards and nothing else');
      assert.ok(cards.every((c) => !c.style.gridColumn && !c.style.width && !c.style.marginLeft), 'no lane math survives in a stack');
    }
  }
  // Friday's Regency — the pile that used to be a deck — is one stack in the
  // run's order, each set its own tappable card.
  const fri = roomsUnder(root, 'Friday').find((r) => r.dataset.room === 'Afters');
  const regency = listOf(fri).find(([v]) => v === 'Regency Ballroom');
  const file = afters('Fri').filter((a) => a.venue === 'Regency Ballroom').sort((a, b) => a.order.seq - b.order.seq);
  assert.deepEqual(regency[2].map(([n]) => n), file.map((a) => a.name));
  assert.deepEqual(regency[2].map(([, t]) => t), file.map((a) => `${a.approx ? '~' : ''}${a.time}`));
  assert.equal(regency[1], `Doors ${file[0].doors} · ~${file[0].close}`);
  assert.ok([...fri.querySelectorAll('.card')].every((c) => c.getAttribute('role') === 'button'));
});

test('a grid day keeps its timetable, its own sticky strip and its own scroll group', () => {
  const { root } = render('portola-2026');
  const blocks = [...root.querySelectorAll('.tt-block')];
  assert.equal(blocks.length, 2, 'Saturday and Sunday — the only two grids Portola publishes');
  for (const b of blocks) {
    assert.equal(b.querySelectorAll('.stage-strip').length, 1, 'one strip inside its block');
    const [strip, grid] = [...b.querySelectorAll('.times-scroll')];
    assert.equal(strip.dataset.sync, grid.dataset.sync, 'the strip and its grid share one sync group');
    assert.equal(b.querySelector('.stage-strip .times-grid').style.gridTemplateColumns, b.querySelector('.times-scroll[data-day] .times-grid').style.gridTemplateColumns, 'same column template — heads over their columns');
  }
  const gridScrollers = [...root.querySelectorAll('.times-scroll[data-sync="grid"]')];
  assert.equal(gridScrollers.length, 4, 'two strips + two days');
  const gridDays = gridScrollers.filter((s) => s.hasAttribute('data-day'));
  gridDays[0].scrollLeft = 120;
  gridDays[0].dispatchEvent(new dom.window.Event('scroll'));
  assert.ok(gridDays.every((s) => s.scrollLeft === 120), 'the two grid days mirror each other');
  const strips = gridScrollers.filter((s) => !s.hasAttribute('data-day'));
  assert.ok(strips.every((s) => s.classList.contains('follows') && s.scrollLeft === 0));
  // A strip follows the grid it SITS ABOVE, never the group's first: bound to
  // the wrong day, both strips freeze in a real browser. jsdom does not fire
  // `scroll` when the mirror writes scrollLeft, which is what makes the two
  // bindings visible here.
  const stripRow = (dayKey) => [...root.querySelectorAll('.tt-block')]
    .find((b) => b.querySelector(`.times-scroll[data-day="${dayKey}"]`))
    .querySelector('.stage-strip .times-grid');
  assert.equal(stripRow('Saturday').style.transform, 'translateX(-120px)', 'Saturday\'s names moved with Saturday\'s columns');
  assert.equal(stripRow('Sunday').style.transform, 'translateX(0px)', 'Sunday\'s strip is on Sunday\'s grid, which has not spoken yet');
  gridDays[1].dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(stripRow('Sunday').style.transform, 'translateX(-120px)', 'and when it does, its own names follow');
  // The grid spans whole hours of the festival day, so the now line always has
  // a home (MODEL-V4 §1.1).
  const grid = root.querySelector('.times-scroll[data-day="Sunday"] .times-grid');
  assert.equal(grid.dataset.iso, '2026-09-27');
  assert.equal(grid.dataset.tz, 'America/Los_Angeles');
  assert.equal(Number(grid.dataset.startRow) % 4, 0, 'the grid opens on an hour');
  assert.equal((Number(grid.dataset.startRow) + Number(grid.dataset.rows)) % 4, 0, 'and closes on one');
  const sets = state.getDayArtists('Sunday', null);
  assert.ok(Number(grid.dataset.startRow) <= Math.floor(Math.min(...sets.map((a) => a.startMin)) / 15), 'nothing is cut off the top');
});

// ---- hiding a room (MODEL-V4 §3, §3a.2) ------------------------------------------------

test('a room header does not fold: no chevron, no aria-expanded, no "<n> shows" — the menu is the one door', () => {
  const { root } = render('portola-2026');
  for (const head of root.querySelectorAll('.sec-head')) {
    assert.equal(head.hasAttribute('aria-expanded'), false, 'a header does not fold, so it never claims to');
    assert.equal(head.querySelector('svg.chev'), null, 'no chevron to promise a fold');
    assert.equal(head.querySelector('.sec-sub').textContent.includes('show'), false, 'and it does not count a room it is showing');
  }
  assert.equal(root.querySelector('.room[data-room=":fest"] .sec-head').tagName, 'DIV',
    'the festival\'s own room on a day IS that day — the rule above it is the door, so its header takes no tap');
  // What the show menu leaves: the body gone, the header still naming the room
  // with its label gone quiet, and the week unchanged.
  const folded = render('portola-2026', { folded: ['Folsom'] }).root;
  for (const room of folded.querySelectorAll('.room[data-room="Folsom"]')) {
    const h = room.querySelector('.sec-head');
    assert.ok(h.classList.contains('folded'), 'the menu\'s state is visible on the header');
    assert.equal(h.querySelector('.sec-sub').textContent, '', 'and it does not count what it is not showing');
    assert.equal(room.querySelectorAll('.venue-grid, .tt-block').length, 0, 'the body is gone, the header stays');
  }
  assert.deepEqual(rulesOf(folded), ['THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'], 'the days stay: hiding a room is a view of a room, not a new week');
  // The festival's own room hides too, and takes its timetable with it.
  const noFest = render('portola-2026', { folded: [':fest'] }).root;
  assert.equal(noFest.querySelectorAll('.tt-block').length, 0);
  assert.equal(noFest.querySelectorAll('.room[data-room="Afters"] .venue-grid').length, 4, 'the sections are untouched');
  assert.ok(noFest.querySelector('.room[data-room=":fest"] .sec-head').classList.contains('folded'));
});

// ---- the now mark (MODEL-V4 §1.2) ------------------------------------------------------

test('the now mark: the card of whoever is playing carries the ring and the label; the ticker moves it without a repaint', () => {
  // Sunday the 27th, 11:30 PM in San Francisco — the middle of the Midway run.
  const now = new Date('2026-09-28T06:30:00Z');
  const { root } = render('portola-2026', { now });
  const marked = [...root.querySelectorAll('.card.now')];
  assert.ok(marked.length, 'something is on');
  for (const card of marked) {
    assert.equal(card.querySelector('.now-label').textContent, 'NOW');
    const from = Number(card.dataset.nowFrom);
    const to = Number(card.dataset.nowTo);
    assert.ok(from <= 23.5 * 60 && 23.5 * 60 < to, `${card.dataset.artist} is really on at 11:30 PM`);
  }
  assert.ok(marked.some((c) => c.dataset.artist === 'VTSS'), 'the Midway\'s second set is the one playing');
  assert.ok([...root.querySelectorAll('.room[data-room="Afters"] .card')].filter((c) => !c.classList.contains('now')).length, 'and the rest are not');
  // An hour later the ticker moves it — no repaint, same nodes.
  positionNowMarks(root, new Date('2026-09-28T07:30:00Z'));
  const later = [...root.querySelectorAll('.card.now')].map((c) => c.dataset.artist);
  assert.notDeepEqual(later, marked.map((c) => c.dataset.artist));
  assert.ok(!root.querySelector('.card[data-artist="VTSS"].now'), 'VTSS handed the room over');
  assert.equal(root.querySelectorAll('.now-label.in-card').length, later.length, 'a label lives and dies with its mark');
  // Another day entirely: nothing is on.
  positionNowMarks(root, new Date('2026-06-01T06:30:00Z'));
  assert.equal(root.querySelectorAll('.card.now, .now-label.in-card').length, 0);
});

// ---- the tabs off the end (MODEL-V4 §2) ------------------------------------------------

// A dated section is a tab AND a room: one header, which is the room header
// every other room uses — so it folds on a tap, the show menu can name it, and
// the tab lands on it. It used to be drawn by hand, outside the room component,
// which cost it both controls.
test('a dated section is its own tab after the days, and a room: one header, a date rule per date', () => {
  const { root, ctx } = render('dated');
  assert.deepEqual(rulesOf(root), ['FRIDAY'], 'the days are the days; a dated section is a room of its own');
  assert.deepEqual(dayNavOf(FESTIVALS.dated, ctx).map((d) => [d.key, d.short, d.long, d.dated]),
    [['Friday', 'FRI', 'FRI', false], ['Late nights', 'LATE', 'LATE NIGHTS', true]]);
  const room = root.querySelector('.room[data-room="Late nights"]');
  assert.ok(room, 'the same room component as Afters and Folsom');
  const head = room.querySelector('.sec-head');
  assert.equal(head.dataset.day, 'Late nights', 'and it is what the tab lands on');
  assert.equal(head.querySelector('.sec-label').textContent, 'LATE NIGHTS');
  assert.equal(head.querySelector('.sec-sub').textContent, 'Sep 29 – Oct 10 · around Austin');
  const dateRules = [...room.querySelectorAll('.date-rule')];
  assert.deepEqual(dateRules.map((r) => [r.dataset.iso, r.querySelector('.d').textContent]),
    [['2026-09-29', 'TUE · SEP 29'], ['2026-10-01', 'THU · OCT 1']]);
  const firstGrid = dateRules[0].nextElementSibling;
  assert.ok(firstGrid.classList.contains('venue-grid'));
  assert.deepEqual([...firstGrid.querySelectorAll('.stack > .card')].map((c) => c.dataset.artist), ['Also First', 'First'],
    'the timed show leads its room; the doors-only one follows');
  assert.equal(firstGrid.dataset.iso, '2026-09-29', 'the date carries the now mark too');
  // Its cards pick like any other.
  assert.ok([...firstGrid.querySelectorAll('.card')].every((c) => c.getAttribute('role') === 'button'));
});

test('the menu hides a dated section whole — the header, and nothing under it', () => {
  const folded = render('dated', { folded: ['Late nights'] }).root;
  const room = folded.querySelector('.room[data-room="Late nights"]');
  assert.ok(room.querySelector('.sec-head').classList.contains('folded'));
  assert.equal(room.querySelectorAll('.date-rule, .venue-grid, .day-whisper').length, 0, 'the header only');
  assert.deepEqual(rulesOf(folded), ['FRIDAY'], 'and the week above it is untouched');
});

// ---- the note door is where you are standing (MODEL-V4 §4, §3a.3) ----------------------
// The wall chooses the key a day note is written to and read from, so the
// choice is pinned here: the DATE under a day's rule, `<iso>|<section>` under a
// section's header on that day. A weekday label was the key before V4 and those
// notes are still the same conversation — mapping them onto the date is the
// notes layer's (js/v3/model.js legacyDayKeysFor). What this file owns is that
// the wall never opens a day note on anything but one of those two.
const whisperAfter = (rule) => {
  const n = rule && rule.nextElementSibling;
  return n && n.classList.contains('day-whisper') ? n : null;
};
const noteOn = (fid, target, text, ts, salt) =>
  state.recordNote(fid, 'day', target, model.makeNoteId('Kevin', ts, salt), { author: 'Kevin', ts, text });

test('a day’s note door opens on the day’s date, not on its label', () => {
  noteOn('portola-2026', '2026-09-26', 'gate B at 4', '2026-09-20T18:00:00.000Z', 'aaaaaa');
  const asked = [];
  const { root } = render('portola-2026', { onOpenDayNotes: (k) => asked.push(k) });
  const rule = [...root.querySelectorAll('.day-rule')].find((r) => r.dataset.day === 'Saturday');
  assert.equal(rule.dataset.iso, '2026-09-26');
  const w = whisperAfter(rule);
  assert.ok(w, 'the whisper sits under the rule that named the date');
  assert.equal(w.querySelector('.text').textContent, 'gate B at 4');
  click(w);
  assert.deepEqual(asked, ['2026-09-26'], 'and the door opens that date’s conversation');
  assert.equal(whisperAfter([...root.querySelectorAll('.day-rule')].find((r) => r.dataset.day === 'Sunday')), null,
    'Sunday is a different date and has nothing to say');
});

test('two weekends, two Fridays, two conversations', () => {
  noteOn('two-dated', '2026-10-09', 'second Friday only', '2026-09-20T18:10:00.000Z', 'bbbbbb');
  const asked = [];
  const { root } = render('two-dated', { onOpenDayNotes: (k) => asked.push(k) });
  const ruleFor = (tab) => [...root.querySelectorAll('.day-rule')].find((r) => r.dataset.day === tab);
  assert.equal(whisperAfter(ruleFor('Friday|W1')), null, 'the first Friday never held this note');
  const w = whisperAfter(ruleFor('Friday|W2'));
  assert.ok(w, 'the second one does');
  click(w);
  assert.deepEqual(asked, ['2026-10-09']);
});

test('a dated section: the section rule has no note door, each of its dates has one', () => {
  noteOn('dated', '2026-09-29', 'meet at the Mohawk', '2026-09-20T18:20:00.000Z', 'cccccc');
  const asked = [];
  const { root } = render('dated', { onOpenDayNotes: (k) => asked.push(k) });
  const tab = root.querySelector('.sec-head[data-day="Late nights"]');
  assert.equal(whisperAfter(tab), null, 'a section label is not a note target any more');
  const dateRule = [...root.querySelectorAll('.date-rule')].find((r) => r.dataset.iso === '2026-09-29');
  const w = whisperAfter(dateRule);
  assert.ok(w, 'the date under it is');
  click(w);
  assert.deepEqual(asked, ['2026-09-29']);
});

test('a day\u2019s rule IS the door: a real button, wearing the day it opens', () => {
  const asked = [];
  const { root } = render('portola-2026', { onOpenDayNotes: (k, label) => asked.push([k, label]) });
  const rule = [...root.querySelectorAll('.day-rule')].find((r) => r.dataset.day === 'Sunday');
  assert.equal(rule.tagName, 'BUTTON', 'the tap the fold used to take');
  assert.equal(rule.getAttribute('aria-label'), 'Notes for Sunday');
  assert.equal(rule.querySelectorAll('.day, .date, .line').length, 3, 'and nothing was added to it');
  click(rule);
  assert.deepEqual(asked, [['2026-09-27', 'Sunday']]);
});

test('a section header on a day opens THAT night\u2019s section notes — and nothing rolls up', () => {
  // Written standing on Friday's Folsom.
  noteOn('portola-2026', '2026-09-25|Folsom', 'Folsom line is round the corner', '2026-09-20T18:40:00.000Z', 'eeeeee');
  noteOn('portola-2026', '2026-09-25', 'Friday is a late one', '2026-09-20T18:41:00.000Z', 'ffffff');
  const asked = [];
  const { root } = render('portola-2026', { onOpenDayNotes: (k, label) => asked.push([k, label]) });
  const friday = roomsUnder(root, 'Friday');
  const folsom = friday.find((r) => r.dataset.room === 'Folsom');
  const head = folsom.querySelector('.sec-head');
  assert.equal(head.tagName, 'BUTTON');
  assert.equal(head.getAttribute('aria-label'), 'Notes for Folsom · Friday');
  click(head);
  assert.deepEqual(asked, [['2026-09-25|Folsom', 'Folsom · Friday']], 'the date AND the section, together');

  // The whisper sits under that header, on that day, and nowhere else.
  const w = whisperAfter(head);
  assert.ok(w, 'the newest note on Folsom-on-Friday rides under Folsom\u2019s header');
  assert.equal(w.querySelector('.text').textContent, 'Folsom line is round the corner');
  const saturdayFolsom = roomsUnder(root, 'Saturday').find((r) => r.dataset.room === 'Folsom');
  assert.equal(whisperAfter(saturdayFolsom.querySelector('.sec-head')), null, 'Saturday\u2019s Folsom is another night');
  assert.equal(whisperAfter(friday.find((r) => r.dataset.room === 'Afters').querySelector('.sec-head')), null,
    'and Friday\u2019s afters are another room');

  // Nothing rolls up: the day rule shows the DAY's note, not the section's.
  const rule = [...root.querySelectorAll('.day-rule')].find((r) => r.dataset.day === 'Friday');
  const dayW = whisperAfter(rule);
  assert.equal(dayW.querySelector('.text').textContent, 'Friday is a late one');
  assert.equal(dayW.querySelector('.more').textContent, '1 note \u203a', 'the section note is not counted under the day');
});

test('a hidden room is not a door either — and the festival\u2019s own room never was', () => {
  const { root } = render('portola-2026', { folded: ['Folsom'] });
  const head = roomsUnder(root, 'Friday').find((r) => r.dataset.room === 'Folsom').querySelector('.sec-head');
  assert.equal(head.tagName, 'DIV', 'nothing under it, so nothing to write on');
  assert.equal(root.querySelector('.room[data-room=":fest"] .sec-head').tagName, 'DIV',
    'the festival\u2019s room on a day IS that day; its rule is the door');
});

test('two Fridays, two doors that say which: the axis names the date when the day\u2019s own name would answer twice', () => {
  const asked = [];
  const { root } = render('two-dated', {
    onOpenDayNotes: (k, label) => asked.push([k, label]),
    // What the shell hands down (app.js festDatesOf / nameDates).
    festDates: [
      { iso: '2026-10-02', label: 'Fri \u00b7 Oct 2' },
      { iso: '2026-10-09', label: 'Fri \u00b7 Oct 9' },
    ],
  });
  const arias = [...root.querySelectorAll('.day-rule')].map((r) => r.getAttribute('aria-label'));
  assert.deepEqual(arias, ['Notes for Fri \u00b7 Oct 2', 'Notes for Fri \u00b7 Oct 9'],
    'two buttons that open different threads never say the same words');
  assert.deepEqual([...root.querySelectorAll('.day-rule .day')].map((d) => d.textContent), ['FRIDAY', 'FRIDAY'],
    'and the rule on screen still reads FRIDAY — the sub says which weekend');
  root.querySelectorAll('.day-rule')[1].dispatchEvent(new dom.window.Event('click'));
  assert.deepEqual(asked, [['2026-10-09', 'Fri \u00b7 Oct 9']], 'the sheet is told the same name the door wore');
});

test('a day the file gives no date has no note door', () => {
  // Not a loss of anything written: the note is still in the crew doc and
  // still listed in the all-notes sheet under the key it was stored on.
  noteOn('tiles-run', 'Saturday', 'old key, no date', '2026-09-20T18:30:00.000Z', 'dddddd');
  const { root } = render('tiles-run');
  const rule = [...root.querySelectorAll('.day-rule')].find((r) => r.dataset.day === 'Saturday');
  assert.equal(rule.dataset.iso, undefined, 'the fest never said which Saturday');
  assert.equal(whisperAfter(rule), null);
});

// ---- the paths that did not change -----------------------------------------------------

test('a grid-only fest is one room a day; a lineup fest with no events keeps its card grid', () => {
  const grid = render('grid-only').root;
  assert.deepEqual(rulesOf(grid), ['FRIDAY']);
  assert.deepEqual([...grid.querySelectorAll('.room')].map((r) => r.dataset.room), [':fest']);
  assert.equal(grid.querySelectorAll('.tt-block').length, 1);
  assert.equal(grid.querySelectorAll('.venue-grid').length, 0, 'everything it has is on the grid');
  const ll = render('lineup-only').root;
  assert.ok(rulesOf(ll).includes('WEDNESDAY'));
  const wedRoom = roomsUnder(ll, WED_KEY)[0];
  assert.equal(wedRoom.dataset.room, ':fest');
  assert.ok(wedRoom.querySelector('.wall-grid .card[data-artist="Chassi"]'), 'a billing with no venue and no clock is a card grid, as it always was');
});

test('a verbose day key shows its weekday head in the rule, the aside in the sub, and keeps the key for the tabs', () => {
  const { root, ctx } = render('verbose-day');
  const rule = root.querySelector('.day-rule');
  assert.equal(rule.querySelector('.day').textContent, 'WEDNESDAY');
  assert.equal(rule.querySelector('.date').textContent, 'Early Arrival Pre-Party');
  assert.equal(rule.dataset.day, WED_KEY, 'the jump / scrollspy key is the key');
  assert.equal(rule.querySelector('.chip-notes'), null, 'the day rule has no note door any more (MODEL-V4 §4)');
  assert.deepEqual(dayNavOf(FESTIVALS['verbose-day'], ctx).map((d) => [d.key, d.short, d.long]), [[WED_KEY, 'WED', 'WEDNESDAY']]);
  assert.deepEqual(roomsUnder(root, WED_KEY).map((r) => r.dataset.room), [':fest', 'Afters']);
});

test('the people filter hides in a stack, and says so when it leaves a room empty', () => {
  const { root } = render('portola-2026', { filterPeople: ['Nhu'] });
  const fri = roomsUnder(root, 'Friday').find((r) => r.dataset.room === 'Afters');
  assert.deepEqual([...fri.querySelectorAll('.stack > .card')].map((c) => c.dataset.artist), ['Channel Tres'],
    'only what Nhu picked, and the rooms nobody picked in went with their cards');
  const folsom = roomsUnder(root, 'Friday').find((r) => r.dataset.room === 'Folsom');
  assert.equal(folsom.querySelector('.venue-grid'), null);
  assert.equal(folsom.querySelector('.section-empty').textContent, 'No picks here from Nhu.');
});

// ---- the run in the zoom (the LOCKED copy) ---------------------------------------------------

test('factsFor a run member: WHEN is the room\'s window, the order is a door; the grid billing of the same name has neither', () => {
  const { ctx } = render('portola-2026');
  const member = portola.artists.find((a) => a.night === 'Sun' && a.venue === 'The Midway' && a.order.seq === 3);
  const f = facts.factsFor(member.name, ctx, { day: member.day, stage: member.stage, time: member.time, weekend: null });
  assert.equal(f.when, 'Sun · Runs 10 PM – ~3 AM', 'the window, with the tilde on the guessed close');
  assert.equal(f.where, 'The Midway');
  assert.equal(f.approx, true);
  assert.deepEqual(f.order, { text: 'Guessing they’re 3rd of 4', url: member.order.source, confirmed: false });
  const billing = facts.factsFor(member.name, ctx, { day: 'Sunday', stage: null, time: null, weekend: null });
  assert.equal(billing.order, null, 'the grid billing is not the run');
  assert.equal(billing.approx, false);
  const plain = facts.factsFor('Fatboy Slim', ctx, { day: 'Afters', stage: 'Sun · 888 Garage', time: '10 PM', weekend: null });
  assert.equal(plain.when, 'Sun · 10 PM');
  assert.equal(plain.order, null);
});

test('the grown card: two lines in one WHEN piece — the window, then the door to the poster; the door never picks; the word goes once confirmed', () => {
  const { ctx } = render('portola-2026');
  const member = portola.artists.find((a) => a.night === 'Sun' && a.venue === 'The Midway' && a.order.seq === 3);
  const f = facts.factsFor(member.name, ctx, { day: member.day, stage: member.stage, time: member.time, weekend: null });
  const card = facts.sheetCard(f, {});
  const sub = card.querySelector('.f-sub');
  assert.ok(sub.classList.contains('f-stack'));
  assert.equal(card.querySelectorAll('.f-sub').length, 1, 'ONE .f-sub — the zoom\'s cascade and refresh key on it');
  assert.equal(sub.querySelector('.f-when').textContent, 'Sun · Runs 10 PM – ~3 AM');
  const door = sub.querySelector('a.f-order');
  assert.equal(door.textContent, 'Guessing they’re 3rd of 4');
  assert.equal(door.getAttribute('href'), member.order.source);
  assert.equal(door.getAttribute('target'), '_blank');
  assert.equal(door.getAttribute('rel'), 'noopener');
  let picked = 0;
  card.addEventListener('click', () => { picked += 1; });
  click(door);
  assert.equal(picked, 0, 'the door stops the click — a door, never a pick');
  assert.equal(card.querySelector('a.f-where').textContent, 'The Midway', 'the venue door is still there under it');
  const sure = { ...f, order: { text: '3rd of 4', url: f.order.url, confirmed: true } };
  assert.equal(facts.sheetCard(sure, {}).querySelector('a.f-order').textContent, '3rd of 4');
  const plain = facts.sheetCard(facts.factsFor('Fatboy Slim', ctx, { day: 'Afters', stage: 'Sun · 888 Garage', time: '10 PM', weekend: null }), {});
  assert.equal(plain.querySelector('.f-sub').textContent, 'Sun · 10 PM');
  assert.equal(plain.querySelector('.f-order'), null);
});

// ---- the zoom's restore target -----------------------------------------------------------

test('a combined-day show is ONE occurrence in TWO rooms — the zoom comes back in the room it was in, not whichever card is first', () => {
  const { root } = render('portola-2026');
  const both = [...root.querySelectorAll('.card[data-artist="Horse Meat Disco"]')];
  assert.equal(both.length, 2, 'one show, two rooms');
  assert.equal(both[0].dataset.occ, both[1].dataset.occ, 'and one occurrence — the identity really is shared');
  assert.deepEqual(both.map(roomOf), ['Afters', 'Folsom']);
  const occ = JSON.parse(both[0].dataset.occ);
  assert.equal(cardFor(root, 'Horse Meat Disco', occ), both[0], 'no room: document order, as before');
  assert.equal(cardFor(root, 'Horse Meat Disco', occ, { room: 'Folsom' }), both[1], 'the Folsom card comes back as the Folsom card');
  assert.equal(cardFor(root, 'Horse Meat Disco', occ, { room: 'Afters' }), both[0]);
  assert.equal(cardFor(root, 'Horse Meat Disco', occ, { room: 'Nowhere' }), both[0], 'a room no longer on the wall degrades to the plain lookup');
  const midway = portola.artists.find((a) => a.venue === 'The Midway' && a.order && a.order.seq === 1);
  // Built by the model, not by hand: the occurrence IS occOf's answer, and a
  // test that retypes its shape stops testing the thing it restores by.
  const mOcc = occOf(midway);
  const only = cardFor(root, midway.name, mOcc);
  assert.ok(only);
  assert.equal(cardFor(root, midway.name, mOcc, { room: 'Folsom' }), only, 'a wrong room never loses the only match');
  assert.notEqual(cardFor(root, midway.name, { day: 'Sunday', stage: null, time: null, weekend: null }), only);
});

// ---- a search answer is an occurrence, not a name -----------------------------------------
// A search used to fold a night's rooms by NAME, so an artist with a set at
// Room A and a later one at Room B answered once and the second show was
// unreachable from search (Codex re-check finding 1, 2026-09-17). The rule is
// the one the rest of the app already runs on: two cards are the same answer
// only when they are the same occurrence.

test('a search answers per SHOW: two rooms on one night are two answers, and a combined-day show stays one', () => {
  const { errors } = validateFestivalDoc(FESTIVALS['two-rooms'], { filename: 'two-rooms.json' });
  assert.deepEqual(errors, [], 'the fixture is data the validator accepts, not a shape we invented');

  const { root } = render('two-rooms', { query: 'two times' });
  const cards = [...root.querySelectorAll('.card[data-artist="Two Times"]')];
  assert.equal(cards.length, 2, 'Room A at 9 and Room B at 1 AM are two shows — both findable');
  assert.deepEqual(cards.map((c) => JSON.parse(c.dataset.occ).venue), ['Room A', 'Room B']);
  assert.notEqual(cards[0].dataset.occ, cards[1].dataset.occ, 'two occurrences, so the zoom tells each its own story');
  assert.deepEqual([...root.querySelectorAll('.day-rule')].map((r) => r.dataset.day), ['Friday'],
    'both answers under the one night they play');

  // …and the one shape that really is a single show reached twice: Portola's
  // Horse Meat Disco, day "Afters & Folsom" — one entry, one occurrence.
  const { root: p } = render('portola-2026', { query: 'horse meat' });
  const hmd = [...p.querySelectorAll('.card[data-artist="Horse Meat Disco"]')];
  assert.equal(hmd.length, 1, 'one show in two rooms is one answer');
  assert.equal(JSON.parse(hmd[0].dataset.occ).day, 'Afters & Folsom');
});

// ---- the round-2 walk: picks on a grown card, across the sync echo ------------------------
// The real sequence, with app.js's handleTap / applyLocalPick / refreshCtx /
// refreshArtistCards / repaintWall mirrored: renderWall → the hover grows a
// card → a click on the OVERLAY picks → the sync echo repaints → clicks on the
// overlay keep cycling 2 → 3 → 4 → 0. The card it runs on is a run member in a
// venue stack — the exact card the walk was on.
function appMirror(fid) {
  const root = document.getElementById('wall-root');
  const ctx = ctxFor(fid);
  ctx.taps = [];
  const refreshCtxLike = () => { ctx.picks = model.picksFor(state.crewDoc, fid); };
  const applyLocalPick = (artist, person, level) => {
    state.ensureFestivalState(fid);
    const sels = state.crewDoc.festivals[fid].selections;
    (sels[artist] = sels[artist] || {})[person] = level;
  };
  const refreshArtistCards = (artistName) => {
    const els = [...document.querySelectorAll('#wall-root .card')].filter((c) => c.dataset.artist === artistName);
    const zi = els.indexOf(facts.zoomedCard());
    const fresh = els.map((el) => refreshCard(el, artistName, ctx));
    if (zi >= 0 && fresh[zi] && fresh[zi].isConnected) facts.refreshZoom(fresh[zi], ctx);
  };
  ctx.onTap = (artistName) => {
    ctx.taps.push(artistName);
    const current = (ctx.picks[artistName] || {})[ctx.meName] || 0;
    const next = model.nextTapLevel(current);
    state.recordSelection(artistName, ctx.meName, next);
    applyLocalPick(artistName, ctx.meName, next);
    refreshCtxLike();
    refreshArtistCards(artistName);
  };
  ctx.wireZoom = (el, artist, occ) => {
    const opts = { onOpenNotes: (a) => ctx.onOpenNotes(a, occ), occ };
    facts.wireCardZoom(el, artist, ctx, opts);
    facts.wireCardFocusZoom(el, artist, ctx, opts);
  };
  const repaintWall = () => {
    const keep = facts.zoomSnapshot();
    facts.unzoom({ instant: !!keep, why: 'wall repaint' });
    refreshCtxLike();
    state.setActiveFestivalId(fid);
    renderWall(root, ctx);
    if (keep) {
      const again = cardFor(root, keep.artist, keep.occ);
      if (again) facts.zoomCard(again, keep.artist, ctx, { ...keep, instant: true });
    }
  };
  refreshCtxLike();
  state.setActiveFestivalId(fid);
  renderWall(root, ctx);
  return { root, ctx, repaintWall, level: (name) => ((ctx.picks[name] || {})[ctx.meName] || 0) };
}
const hoverEnter = (node) => node.dispatchEvent(new dom.window.PointerEvent('pointerenter', { bubbles: false, pointerType: 'mouse' }));
const overlay = () => document.querySelector('#zoom-layer .zoom-card');
const rowsOf = (card) => [...card.querySelector('.f-grown').children].map((c) => c.className.split(' ')[0]);

test('picks on a stack card keep cycling across the sync-echo repaint; the who-row appears only when there are people; the venue door never picks', async () => {
  delete state.crewDoc.festivals['portola-2026'].selections['Gelli Haha'];
  const { root, ctx, repaintWall, level } = appMirror('portola-2026');
  // Gelli Haha opens the Regency's Friday run — a card in a venue stack,
  // which is what every events card is now.
  const runCard = root.querySelector('.room[data-room="Afters"] .stack .card[data-artist="Gelli Haha"]');
  assert.ok(runCard, 'the run member is a plain wall card');
  hoverEnter(runCard);
  await new Promise((r) => setTimeout(r, facts.ZOOM_IN_MS + 40));
  assert.equal(facts.zoomedCard(), runCard, 'the hover grew the run card');
  assert.deepEqual(rowsOf(overlay()), ['f-sub', 'f-where', 'f-chips'], 'unpicked: no who-row, no hole');
  assert.equal(overlay().querySelector('a.f-where').textContent, 'Regency Ballroom', 'the venue is a map door');
  click(overlay().querySelector('.f-name'));
  assert.equal(level('Gelli Haha'), 1, 'click 1 picks');
  assert.deepEqual(rowsOf(overlay()), ['f-sub', 'f-where', 'f-who', 'f-chips'], 'the pill arrived and its neighbours made room');
  assert.equal(overlay().querySelector('.f-who .f-pill.you').textContent, 'You');
  repaintWall();
  const back = facts.zoomedCard();
  assert.ok(back && back.isConnected && back.dataset.artist === 'Gelli Haha' && back.closest('.stack'),
    'restored onto the fresh run card, not the Saturday grid billing of the same name');
  assert.deepEqual(rowsOf(overlay()), ['f-sub', 'f-where', 'f-who', 'f-chips'], 'the restore rebuilt the same rows');
  for (const want of [2, 3, 4, 0]) {
    click(overlay().querySelector('.f-name'));
    assert.equal(level('Gelli Haha'), want, `the next click on the overlay took the pick to ${want}`);
    assert.ok(facts.zoomedCard() && facts.zoomedCard().isConnected, 'the zoom rode the refreshed run card');
  }
  assert.deepEqual(rowsOf(overlay()), ['f-sub', 'f-where', 'f-chips'], 'cleared: the who-row is gone again and the rows close up');
  assert.deepEqual(ctx.taps, ['Gelli Haha', 'Gelli Haha', 'Gelli Haha', 'Gelli Haha', 'Gelli Haha']);
  const gridCell = root.querySelector('.room[data-room=":fest"] .card.cell[data-artist="Gelli Haha"]');
  assert.ok(gridCell.getAttribute('aria-label').startsWith('Gelli Haha — not picked'));
  click(overlay().querySelector('a.f-where'));
  assert.equal(level('Gelli Haha'), 0, 'the map door does not pick');
  assert.equal(ctx.taps.length, 5);
  facts.unzoom({ instant: true });
});
