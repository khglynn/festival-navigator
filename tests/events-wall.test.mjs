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
// A day on the wall is a `.day-block` holding its rooms (one-line heads,
// 2026-09-23); every room carries ONE head that names when and what.
const daysOf = (root) => [...root.querySelectorAll('.day-block')].map((b) => b.dataset.day);
const blockOf = (root, dayKey) => [...root.querySelectorAll('.day-block')].find((b) => b.dataset.day === dayKey);
const roomsUnder = (root, dayKey) => {
  const block = blockOf(root, dayKey);
  assert.ok(block, `no day block ${dayKey}`);
  return [...block.children].filter((n) => n.classList.contains('room'));
};
const headOf = (room) => room.querySelector(':scope > .room-head');
const nameOf = (head) => head.querySelector('.name').textContent;
const subOf = (head) => head.querySelector('.sub').textContent;
const headsOf = (root) => [...root.querySelectorAll('.room-head')].map(nameOf);
// What a room's list reads as, top to bottom: [venue, sub, [[name, time], …]].
const listOf = (room) => [...room.querySelectorAll('.venue-group')].map((g) => [
  g.querySelector('.stage-head.venue .label').textContent,
  (g.querySelector('.venue-sub') || { textContent: '' }).textContent,
  [...g.querySelectorAll('.stack > .card')].map((c) => [c.dataset.artist, (c.querySelector('.time') || {}).textContent]),
]);
const click = (node) => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

// ---- the composition ---------------------------------------------------------------

test('Portola is composed: THU FRI SAT SUN, one head per room per day naming when and what, the tabs the same list', () => {
  const { root, ctx } = render('portola-2026');
  assert.deepEqual(daysOf(root), ['Thursday', 'Friday', 'Saturday', 'Sunday']);
  assert.deepEqual([...root.querySelectorAll('.day-block')].map((b) => b.dataset.iso),
    ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'], 'each day block knows its date — the day-of open lands on it');
  assert.deepEqual(roomsUnder(root, 'Thursday').map((r) => r.dataset.room), ['Afters']);
  assert.deepEqual(roomsUnder(root, 'Friday').map((r) => r.dataset.room), ['Afters', 'Folsom']);
  assert.deepEqual(roomsUnder(root, 'Saturday').map((r) => r.dataset.room), [':fest', 'Afters', 'Folsom']);
  assert.deepEqual(roomsUnder(root, 'Sunday').map((r) => r.dataset.room), [':fest', 'Afters', 'Folsom']);
  // Kevin, 2026-09-23: "combine the double lines (for day and then event)
  // into one line each like 'Sat Portola' 'Sat Afters'".
  assert.deepEqual(headsOf(root),
    ['THU AFTERS', 'FRI AFTERS', 'FRI FOLSOM', 'SAT PORTOLA', 'SAT AFTERS', 'SAT FOLSOM', 'SUN PORTOLA', 'SUN AFTERS', 'SUN FOLSOM']);
  // The day's FIRST head carries the date, then its room's own sub; the later
  // heads carry only their own.
  assert.deepEqual([...root.querySelectorAll('.room-head')].map(subOf),
    ['Sep 24', 'Sep 25', '', 'Sep 26 · Pier 80', '', '', 'Sep 27 · Pier 80', '', '']);
  for (const room of root.querySelectorAll('.room')) {
    assert.equal(room.querySelectorAll('.room-head').length, 1, `one head per room (${room.dataset.room})`);
    assert.equal(room.firstElementChild.classList.contains('room-head'), true, 'and it leads the room');
  }
  assert.equal(root.querySelectorAll('.day-block .list-head, .day-rule, .sec-head, .date-rule').length, 0, 'no second line left to say the day');
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
  const noClock = [...sat.querySelectorAll('.card')].find((c) => c.dataset.artist === 'Boys Noize');
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

test('a room head does not fold: no chevron, no aria-expanded, no "<n> shows" — the menu is the one door', () => {
  const { root } = render('portola-2026');
  for (const head of root.querySelectorAll('.room-head')) {
    assert.equal(head.hasAttribute('aria-expanded'), false, 'a header does not fold, so it never claims to');
    assert.equal(head.querySelector('svg.chev'), null, 'no chevron to promise a fold');
    assert.equal(head.querySelector('.sub').textContent.includes('show'), false, 'and it does not count a room it is showing');
  }
  assert.equal(root.querySelector('.room[data-room=":fest"] .room-head').tagName, 'BUTTON',
    'the festival\'s own room on a date IS that date — its head is the day\'s note door now that the day line is gone');
  // What the show menu leaves: nothing — no body, no header, no quiet label
  // (ship round 2026-09-17: "not empty shells"). The days stay while something
  // visible still plays them.
  const folded = render('portola-2026', { folded: ['Folsom'] }).root;
  assert.equal(folded.querySelector('.room[data-room="Folsom"]'), null, 'a hidden room renders nothing');
  assert.deepEqual(daysOf(folded), ['Thursday', 'Friday', 'Saturday', 'Sunday'], 'the days stay: the afters still play every one of them');
  // The festival's own room hides too, and takes its timetable with it.
  const noFest = render('portola-2026', { folded: [':fest'] }).root;
  assert.equal(noFest.querySelectorAll('.tt-block, .room[data-room=":fest"]').length, 0);
  assert.equal(noFest.querySelectorAll('.room[data-room="Afters"] .venue-grid').length, 4, 'the sections are untouched');
  // A day whose first room is hidden: the next room's head is the day's first
  // now, so IT carries the date — decided by the render, never remembered.
  const sat = roomsUnder(noFest, 'Saturday').map(headOf);
  assert.deepEqual(sat.map((h) => [nameOf(h), subOf(h)]), [['SAT AFTERS', 'Sep 26'], ['SAT FOLSOM', '']]);
  assert.equal(blockOf(noFest, 'Saturday').dataset.iso, '2026-09-26', 'and the day still lands where its first head is');
});

// ---- the now mark (MODEL-V4 §1.2) ------------------------------------------------------

test('the now mark: the card of whoever is playing carries the ring, and "playing now" in its name — no tag; the ticker moves it without a repaint', () => {
  // Sunday the 27th, 11:30 PM in San Francisco — the middle of the Midway run.
  const now = new Date('2026-09-28T06:30:00Z');
  const { root } = render('portola-2026', { now });
  const marked = [...root.querySelectorAll('.card.now')];
  assert.ok(marked.length, 'something is on');
  for (const card of marked) {
    assert.equal(card.querySelector('.now-label'), null, 'no NOW tag in the corner (2026-09-24: the NOW button teaches the ring)');
    assert.ok(card.getAttribute('aria-label').endsWith(', playing now'), `a screen reader hears it: ${card.getAttribute('aria-label')}`);
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
  const named = [...root.querySelectorAll('.card')].filter((c) => (c.getAttribute('aria-label') || '').endsWith(', playing now'));
  assert.deepEqual(named.map((c) => c.dataset.artist).sort(), [...later].sort(), '"playing now" lives and dies with its mark');
  assert.ok(!root.querySelector('.card[data-artist="VTSS"]').getAttribute('aria-label').includes('playing now'), 'and leaves VTSS’s name clean');
  // Another day entirely: nothing is on.
  positionNowMarks(root, new Date('2026-06-01T06:30:00Z'));
  assert.equal(root.querySelectorAll('.card.now').length, 0);
  assert.equal([...root.querySelectorAll('.card')].filter((c) => (c.getAttribute('aria-label') || '').includes('playing now')).length, 0);
});

// ---- the tabs off the end (MODEL-V4 §2) ------------------------------------------------

// A dated section is a tab of its own, and each of its dates is a room on that
// date: the same one-line head every other room wears — `TUE LATE NIGHTS` —
// where it used to be a section header with a quieter date rule under it for
// every date (two lines again). The tab lands on its block, whose first head
// is the first date.
test('a dated section is its own tab after the days: one head per date, the same component as every room', () => {
  const { root, ctx } = render('dated');
  assert.deepEqual(daysOf(root), ['Friday', 'Late nights'], 'the days are the days, then the tab that hangs off the end');
  assert.equal(blockOf(root, 'Late nights').dataset.iso, undefined, 'a tab over many dates is none of them');
  assert.deepEqual(dayNavOf(FESTIVALS.dated, ctx).map((d) => [d.key, d.short, d.long, d.dated]),
    [['Friday', 'FRI', 'FRI', false], ['Late nights', 'LATE', 'LATE NIGHTS', true]]);
  const rooms = roomsUnder(root, 'Late nights');
  assert.deepEqual(rooms.map((r) => r.dataset.room), ['Late nights', 'Late nights'], 'a room per date, all one key — the menu hides them together');
  assert.deepEqual(rooms.map(headOf).map((h) => [nameOf(h), subOf(h)]),
    [['TUE LATE NIGHTS', 'Sep 29 · around Austin'], ['THU LATE NIGHTS', 'Oct 1 · around Austin']],
    'each date is the first head of its date: the date, then the room\'s own sub');
  assert.equal(root.querySelectorAll('.date-rule, .sec-head').length, 0, 'no second line under a first');
  const firstGrid = headOf(rooms[0]).nextElementSibling;
  assert.ok(firstGrid.classList.contains('venue-grid'));
  assert.deepEqual([...firstGrid.querySelectorAll('.stack > .card')].map((c) => c.dataset.artist), ['Also First', 'First'],
    'the timed show leads its room; the doors-only one follows');
  assert.equal(firstGrid.dataset.iso, '2026-09-29', 'the date carries the now mark too');
  // Its cards pick like any other.
  assert.ok([...firstGrid.querySelectorAll('.card')].every((c) => c.getAttribute('role') === 'button'));
});

test('the menu hides a dated section whole — no header, no tab, nothing under it', () => {
  const { root, ctx } = render('dated', { folded: ['Late nights'] });
  assert.equal(root.querySelector('.room[data-room="Late nights"], .day-block[data-day="Late nights"]'), null, 'gone whole');
  assert.deepEqual(daysOf(root), ['Friday'], 'and the week above it is untouched');
  assert.deepEqual(dayNavOf(FESTIVALS.dated, ctx).map((d) => d.key), ['Friday'], 'no tab for a room that is not there');
});

// ---- the note door is where you are standing (MODEL-V4 §4, §3a.3) ----------------------
// The wall chooses the key a day note is written to and read from, so the
// choice is pinned here: the DATE under the festival's own head on that date
// (or a dated section's head on its date), `<iso>|<section>` under a section's
// head on that day. A weekday label was the key before V4 and those notes are
// still the same conversation — mapping them onto the date is the notes
// layer's (js/v3/model.js legacyDayKeysFor). What this file owns is that the
// wall never opens a day note on anything but one of those two.
const whisperAfter = (head) => {
  const n = head && head.nextElementSibling;
  return n && n.classList.contains('day-whisper') ? n : null;
};
const festHeadOn = (root, dayKey) => {
  const room = roomsUnder(root, dayKey).find((r) => r.dataset.room === ':fest');
  return room ? headOf(room) : null;
};
const noteOn = (fid, target, text, ts, salt) =>
  state.recordNote(fid, 'day', target, model.makeNoteId('Kevin', ts, salt), { author: 'Kevin', ts, text });

test('a day’s note door opens on the day’s date, not on its label — the festival’s own head on that date', () => {
  noteOn('portola-2026', '2026-09-26', 'gate B at 4', '2026-09-20T18:00:00.000Z', 'aaaaaa');
  const asked = [];
  const { root } = render('portola-2026', { onOpenDayNotes: (k) => asked.push(k) });
  assert.equal(blockOf(root, 'Saturday').dataset.iso, '2026-09-26');
  const head = festHeadOn(root, 'Saturday');
  assert.equal(nameOf(head), 'SAT PORTOLA');
  const w = whisperAfter(head);
  assert.ok(w, 'the whisper sits directly under the head that opens the date');
  assert.equal(w.querySelector('.text').textContent, 'gate B at 4');
  click(w);
  assert.deepEqual(asked, ['2026-09-26'], 'and the door opens that date’s conversation');
  assert.equal(whisperAfter(festHeadOn(root, 'Sunday')), null, 'Sunday is a different date and has nothing to say');
});

test('two weekends, two Fridays, two conversations', () => {
  noteOn('two-dated', '2026-10-09', 'second Friday only', '2026-09-20T18:10:00.000Z', 'bbbbbb');
  const asked = [];
  const { root } = render('two-dated', { onOpenDayNotes: (k) => asked.push(k) });
  assert.equal(whisperAfter(festHeadOn(root, 'Friday|W1')), null, 'the first Friday never held this note');
  const w = whisperAfter(festHeadOn(root, 'Friday|W2'));
  assert.ok(w, 'the second one does');
  click(w);
  assert.deepEqual(asked, ['2026-10-09']);
});

test('a dated section: no head of its own to be a door, and each of its dates is one', () => {
  noteOn('dated', '2026-09-29', 'meet at the Mohawk', '2026-09-20T18:20:00.000Z', 'cccccc');
  const asked = [];
  const { root } = render('dated', { onOpenDayNotes: (k, label) => asked.push([k, label]) });
  const heads = roomsUnder(root, 'Late nights').map(headOf);
  assert.ok(heads.every((h) => h.tagName === 'BUTTON'), 'every date is a door');
  assert.equal(heads.some((h) => nameOf(h) === 'LATE NIGHTS'), false, 'a section label is not a note target, so it has no head of its own');
  const w = whisperAfter(heads[0]);
  assert.ok(w, 'the date’s whisper sits under its own head');
  assert.equal(whisperAfter(heads[1]), null, 'and only there');
  click(w);
  click(heads[1]);
  assert.deepEqual(asked.map(([k]) => k), ['2026-09-29', '2026-10-01'], 'each head opens its own date, the bare ISO as before');
});

test('the festival’s head on a date IS the day’s door: a real button, wearing the day it opens', () => {
  const asked = [];
  const { root } = render('portola-2026', { onOpenDayNotes: (k, label) => asked.push([k, label]) });
  const head = festHeadOn(root, 'Sunday');
  assert.equal(head.tagName, 'BUTTON', 'the thread the day rule used to open, on the head that replaced it');
  assert.equal(head.getAttribute('aria-label'), 'Notes for Sunday');
  assert.deepEqual([...head.children].map((c) => c.className), ['name', 'sub', 'line'], 'and nothing was added to it — no chip, no glyph');
  click(head);
  assert.deepEqual(asked, [['2026-09-27', 'Sunday']]);
});

test('a section head on a day opens THAT night’s section notes — and nothing rolls up', () => {
  // Written standing on Friday's Folsom.
  noteOn('portola-2026', '2026-09-25|Folsom', 'Folsom line is round the corner', '2026-09-20T18:40:00.000Z', 'eeeeee');
  noteOn('portola-2026', '2026-09-25', 'Friday is a late one', '2026-09-20T18:41:00.000Z', 'ffffff');
  noteOn('portola-2026', '2026-09-26|Folsom', 'Folsom Saturday: the block party', '2026-09-20T18:42:00.000Z', 'gggggg');
  const asked = [];
  const { root } = render('portola-2026', { onOpenDayNotes: (k, label) => asked.push([k, label]) });
  const friday = roomsUnder(root, 'Friday');
  const head = headOf(friday.find((r) => r.dataset.room === 'Folsom'));
  assert.equal(nameOf(head), 'FRI FOLSOM');
  assert.equal(head.tagName, 'BUTTON');
  assert.equal(head.getAttribute('aria-label'), 'Notes for Folsom · Friday');
  click(head);
  assert.deepEqual(asked, [['2026-09-25|Folsom', 'Folsom · Friday']], 'the date AND the section, together — the key is unchanged');

  // The whisper sits under that head, on that day, and nowhere else.
  const w = whisperAfter(head);
  assert.ok(w, 'the newest note on Folsom-on-Friday rides under Folsom’s head');
  assert.equal(w.querySelector('.text').textContent, 'Folsom line is round the corner');
  const friAfters = headOf(friday.find((r) => r.dataset.room === 'Afters'));
  assert.equal(nameOf(friAfters), 'FRI AFTERS');
  assert.equal(whisperAfter(friAfters), null, 'Friday’s afters are another room');
  assert.equal(friAfters.getAttribute('aria-label'), 'Notes for Afters · Friday',
    'the day’s first head is still its own room’s door — carrying the date does not make it the date’s');

  // A date with no festival room has no bare-date door (spec 2026-09-23): the
  // note written on Friday itself is not on the wall — and not rolled into a
  // section either. The all-notes sheet still lists it (notes.js).
  assert.equal([...root.querySelectorAll('.day-whisper .text')].some((t) => t.textContent === 'Friday is a late one'), false);

  // Nothing rolls up: on Saturday the festival's head shows the DAY's note,
  // not the section's.
  const satW = whisperAfter(festHeadOn(root, 'Saturday'));
  assert.equal(satW.querySelector('.text').textContent, 'gate B at 4');
  assert.equal(satW.querySelector('.more').textContent, '1 note ›', 'the section note is not counted under the day');
  const satFolsom = headOf(roomsUnder(root, 'Saturday').find((r) => r.dataset.room === 'Folsom'));
  assert.equal(whisperAfter(satFolsom).querySelector('.text').textContent, 'Folsom Saturday: the block party',
    'and Saturday’s Folsom shows its own');
});

test('a hidden room is not a door either — it is not there — and a hidden festival takes the date’s door with it', () => {
  const { root } = render('portola-2026', { folded: ['Folsom'] });
  assert.equal(roomsUnder(root, 'Friday').find((r) => r.dataset.room === 'Folsom'), undefined, 'nothing to write on, because nothing is there');
  // Portola hidden: SAT AFTERS is the day's first head and carries the date,
  // but it is Afters' door, never the date's — a hidden part renders no door.
  const asked = [];
  const noFest = render('portola-2026', { folded: [':fest'], onOpenDayNotes: (k) => asked.push(k) }).root;
  const first = headOf(roomsUnder(noFest, 'Saturday')[0]);
  assert.equal(nameOf(first), 'SAT AFTERS');
  click(first);
  assert.deepEqual(asked, ['2026-09-26|Afters']);
  assert.equal([...noFest.querySelectorAll('.day-whisper .text')].some((t) => t.textContent === 'gate B at 4'), false,
    'the date’s whisper went with the room that opened it');
});

test('two Fridays, two doors that say which: the axis names the date when the day’s own name would answer twice', () => {
  const asked = [];
  const { root } = render('two-dated', {
    onOpenDayNotes: (k, label) => asked.push([k, label]),
    // What the shell hands down (app.js festDatesOf / nameDates).
    festDates: [
      { iso: '2026-10-02', label: 'Fri · Oct 2' },
      { iso: '2026-10-09', label: 'Fri · Oct 9' },
    ],
  });
  const heads = [festHeadOn(root, 'Friday|W1'), festHeadOn(root, 'Friday|W2')];
  assert.deepEqual(heads.map((h) => h.getAttribute('aria-label')), ['Notes for Fri · Oct 2', 'Notes for Fri · Oct 9'],
    'two buttons that open different threads never say the same words');
  assert.deepEqual(heads.map(nameOf), ['FRI TWO DATED', 'FRI TWO DATED'], 'the head on screen reads the same twice…');
  assert.deepEqual(heads.map(subOf), ['Oct 2 · Weekend 1', 'Oct 9 · Weekend 2'], '…and its sub says which Friday, while scrolling');
  heads[1].dispatchEvent(new dom.window.Event('click'));
  assert.deepEqual(asked, [['2026-10-09', 'Fri · Oct 9']], 'the sheet is told the same name the door wore');
});

test('a day the file gives no date has no note door', () => {
  // Not a loss of anything written: the note is still in the crew doc and
  // still listed in the all-notes sheet under the key it was stored on.
  noteOn('tiles-run', 'Saturday', 'old key, no date', '2026-09-20T18:30:00.000Z', 'dddddd');
  const { root } = render('tiles-run');
  assert.equal(blockOf(root, 'Saturday').dataset.iso, undefined, 'the fest never said which Saturday');
  const head = festHeadOn(root, 'Saturday');
  assert.equal(head.tagName, 'DIV', 'a head that opens nothing is not a button');
  assert.deepEqual([nameOf(head), subOf(head)], ['SAT TILES RUN', 'Oct 3']);
  assert.equal(whisperAfter(head), null);
});

// ---- the paths that did not change -----------------------------------------------------

test('a grid-only fest is one room a day; a lineup fest with no events keeps its card grid', () => {
  const grid = render('grid-only').root;
  assert.deepEqual(daysOf(grid), ['Friday']);
  assert.deepEqual(headsOf(grid), ['FRI GRID ONLY']);
  assert.deepEqual([...grid.querySelectorAll('.room')].map((r) => r.dataset.room), [':fest']);
  assert.equal(grid.querySelectorAll('.tt-block').length, 1);
  assert.equal(grid.querySelectorAll('.venue-grid').length, 0, 'everything it has is on the grid');
  const ll = render('lineup-only').root;
  assert.ok(daysOf(ll).includes(WED_KEY));
  const wedRoom = roomsUnder(ll, WED_KEY)[0];
  assert.equal(wedRoom.dataset.room, ':fest');
  assert.equal(nameOf(headOf(wedRoom)), 'WED LINEUP ONLY');
  assert.ok(wedRoom.querySelector('.wall-grid .card[data-artist="Chassi"]'), 'a billing with no venue and no clock is a card grid, as it always was');
});

test('a verbose day key shows its weekday in the head, the aside in the first head’s sub, and keeps the key for the tabs', () => {
  const { root, ctx } = render('verbose-day');
  const block = root.querySelector('.day-block');
  assert.equal(block.dataset.day, WED_KEY, 'the jump / scrollspy key is the key');
  const [fest, afters] = roomsUnder(root, WED_KEY).map(headOf);
  assert.deepEqual([nameOf(fest), subOf(fest)], ['WED VERBOSE DAY', 'Early Arrival Pre-Party']);
  assert.deepEqual([nameOf(afters), subOf(afters)], ['WED AFTERS', '']);
  assert.equal(root.querySelector('.chip-notes'), null, 'no note chip on any head (MODEL-V4 §4)');
  assert.deepEqual(dayNavOf(FESTIVALS['verbose-day'], ctx).map((d) => [d.key, d.short, d.long]), [[WED_KEY, 'WED', 'WEDNESDAY']]);
  assert.deepEqual(roomsUnder(root, WED_KEY).map((r) => r.dataset.room), [':fest', 'Afters']);
});

test('the people filter dims in a stack and in a billed list — every card stays, none is filtered', () => {
  const { root } = render('portola-2026', { filterPeople: ['Nhu'] });
  const fri = roomsUnder(root, 'Friday').find((r) => r.dataset.room === 'Afters');
  const cards = [...fri.querySelectorAll('.stack > .card')];
  assert.equal(cards.length, afters('Fri').length, 'every afters show on Friday is still a card');
  assert.deepEqual(cards.filter((c) => !c.classList.contains('dim')).map((c) => c.dataset.artist), ['Channel Tres'],
    'what Nhu picked is lit; everything else is dimmed, not gone');
  const folsom = roomsUnder(root, 'Friday').find((r) => r.dataset.room === 'Folsom');
  assert.ok(folsom.querySelector('.venue-grid'), 'a room nobody picked in keeps its stacks');
  assert.ok([...folsom.querySelectorAll('.card')].every((c) => c.classList.contains('dim')));
  assert.equal(root.querySelector('.section-empty'), null, 'no "No picks here" block anywhere');
  // A billed list (a lineup day's card grid) is the same rule.
  state.crewDoc.festivals['lineup-only'] = { selections: { Chassi: { Nhu: 2 } } };
  const ll = render('lineup-only', { filterPeople: ['Nhu'], picks: model.picksFor(state.crewDoc, 'lineup-only') }).root;
  const billed = [...ll.querySelectorAll('.wall-grid .card')].map((c) => [c.dataset.artist, c.classList.contains('dim')]);
  assert.deepEqual(billed, [['Chassi', false], ['Headliner', true]], 'both billed names render; the one Nhu did not pick is dimmed');
  assert.equal(ll.querySelector('.section-empty'), null);
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
  assert.deepEqual(daysOf(root), ['Friday'], 'both answers under the one night they play');
  // A search is a LIST: its day keeps the list header (one line already),
  // inside the block the tab lands on — never a room head.
  const block = blockOf(root, 'Friday');
  assert.equal(block.querySelector('.list-head .label').textContent, 'FRIDAY');
  assert.equal(block.querySelector('.list-head').hasAttribute('data-day'), false, 'the block is the anchor, not its header');
  assert.equal(root.querySelectorAll('.room-head, .room').length, 0);

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

test('picks on a stack card keep cycling across the sync-echo repaint; the who-row appears only when there are people; the venue and link doors never pick', async () => {
  delete state.crewDoc.festivals['portola-2026'].selections['Gelli Haha'];
  const { root, ctx, repaintWall, level } = appMirror('portola-2026');
  // Gelli Haha opens the Regency's Friday run — a card in a venue stack,
  // which is what every events card is now.
  const runCard = root.querySelector('.room[data-room="Afters"] .stack .card[data-artist="Gelli Haha"]');
  assert.ok(runCard, 'the run member is a plain wall card');
  hoverEnter(runCard);
  await new Promise((r) => setTimeout(r, facts.ZOOM_IN_MS + 40));
  assert.equal(facts.zoomedCard(), runCard, 'the hover grew the run card');
  assert.deepEqual(rowsOf(overlay()), ['f-sub', 'f-where', 'f-links', 'f-chips'], 'unpicked: no who-row, no hole');
  assert.equal(overlay().querySelector('a.f-where').textContent, 'Regency Ballroom', 'the venue is a map door');
  // The show's doors out (2026-09-24): tickets first, then its page.
  assert.deepEqual([...overlay().querySelectorAll('.f-links a.f-link')].map((a) => a.textContent), ['Tix @ AXS', 'Info @ DoTheBay']);
  assert.ok([...overlay().querySelectorAll('.f-links a.f-link')].every((a) => a.target === '_blank' && a.href.startsWith('https://')), 'each opens its page in a new tab');
  click(overlay().querySelector('.f-name'));
  assert.equal(level('Gelli Haha'), 1, 'click 1 picks');
  assert.deepEqual(rowsOf(overlay()), ['f-sub', 'f-where', 'f-links', 'f-who', 'f-chips'], 'your chip arrived and its neighbours made room');
  assert.equal(overlay().querySelector('.f-who .f-pill.you').textContent, 'You');
  assert.equal(overlay().querySelector('.f-who .f-pill.you').getAttribute('aria-label'), 'Picked: You', 'alone at one bar: your own chip');
  repaintWall();
  const back = facts.zoomedCard();
  assert.ok(back && back.isConnected && back.dataset.artist === 'Gelli Haha' && back.closest('.stack'),
    'restored onto the fresh run card, not the Saturday grid billing of the same name');
  assert.deepEqual(rowsOf(overlay()), ['f-sub', 'f-where', 'f-links', 'f-who', 'f-chips'], 'the restore rebuilt the same rows');
  for (const want of [2, 3, 4, 0]) {
    click(overlay().querySelector('.f-name'));
    assert.equal(level('Gelli Haha'), want, `the next click on the overlay took the pick to ${want}`);
    assert.ok(facts.zoomedCard() && facts.zoomedCard().isConnected, 'the zoom rode the refreshed run card');
  }
  assert.deepEqual(rowsOf(overlay()), ['f-sub', 'f-where', 'f-links', 'f-chips'], 'cleared: the who-row is gone again and the rows close up');
  assert.deepEqual(ctx.taps, ['Gelli Haha', 'Gelli Haha', 'Gelli Haha', 'Gelli Haha', 'Gelli Haha']);
  const gridCell = root.querySelector('.room[data-room=":fest"] .card.cell[data-artist="Gelli Haha"]');
  assert.ok(gridCell.getAttribute('aria-label').startsWith('Gelli Haha — not picked'));
  // A door the last pick has just slid under the hand is not a door yet: the
  // tap that meant "one more bar" picks, and opens nothing (DOOR_SETTLE_MS).
  const early = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  overlay().querySelector('.f-links a.f-link').dispatchEvent(early);
  assert.equal(level('Gelli Haha'), 1, 'a door the pick just slid under the hand picks');
  assert.ok(early.defaultPrevented, 'and does not open its page');
  // Once the zoom has settled, every door is a door again, and none picks.
  await new Promise((r) => setTimeout(r, facts.DOOR_SETTLE_MS + 40));
  click(overlay().querySelector('a.f-where'));
  assert.equal(level('Gelli Haha'), 1, 'the map door does not pick');
  for (const door of overlay().querySelectorAll('.f-links a.f-link')) click(door);
  assert.equal(level('Gelli Haha'), 1, 'neither link door picks');
  assert.equal(ctx.taps.length, 6);
  facts.unzoom({ instant: true });
});
