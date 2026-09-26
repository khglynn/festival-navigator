// The list BY TIME (v94, 2026-09-25): a section that declares
// `dayMeta[<section>].layout: "by-time"` shows each night's cards in start
// order under fixed time bands, instead of stacked under their venues. Folsom
// weekend is the first: 68 parties in 39 rooms, where stacks would be twenty
// one-card columns a night. Rendered by the real modules in jsdom; the look
// is the walk's job (claude-plans/2026-09-25-portola-live/v94-BUILD.md).
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
const { renderWall, refreshCard, positionNowMarks, roomsOf, nightMinutes, nowLanding } = await import('../js/v3/wall.js');
const { festivalClock } = await import('../js/v3/now.js');
const { sectionLayoutOf, timeBandsOf, bandOf, TIME_BANDS, venueGroupsOf, occOf, BY_TIME, BY_VENUE, LAYOUTS, showsOnItsOwn, linksOf } = await import('../js/v3/events.js');
const { factsFor, timeRange } = await import('../js/v3/card-facts.js');
const { foldFromShow } = await import('../js/v3/filters.js');
const { dayArtistsFor } = await import('../js/v3/tools.js');
const { validateFestivalDoc } = await import('../api/_lib/festival-rules.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portolaFile = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));

// A small festival with every shape a by-time night can hold: a daytime
// party, a happy hour, three 9 PMs (one of them cancelled), a 9:30, a 10 PM, a
// doors-only room, an 11 PM in an unnamed room, a 2 AM start (the same
// night's after-hours), a party with no clock, and one show billed to both
// sections ("Afters & Parties", Horse Meat Disco's shape). Two parties share
// Venue A on Friday — a tea dance that ends at 8 and a 9 PM — which a stack
// would call a run with no order and a time list calls two parties.
const SRC = 'https://example.test/news';
const FEST = {
  id: 'by-time-fest', name: 'By Time', year: "'26", status: 'scheduled', timezone: 'America/Los_Angeles',
  dayMeta: {
    Saturday: { wd: 'Sat', date: 'Sep 26', iso: '2026-09-26' },
    Afters: { date: 'Sep 24-27' },
    Parties: { date: 'Sep 25-27', layout: 'by-time' },
  },
  artists: [
    { name: 'Headliner', day: 'Saturday' },
    { name: 'Thu Afters', day: 'Afters', stage: 'Thu · Venue X', night: 'Thu', venue: 'Venue X', time: '10 PM' },
    { name: 'Fri Afters', day: 'Afters', stage: 'Fri · Venue X', night: 'Fri', venue: 'Venue X', time: '10 PM' },
    { name: 'Tea Dance', day: 'Parties', stage: 'Fri · Venue A', night: 'Fri', venue: 'Venue A', time: '3 PM - 8 PM', area: 'SoMa' },
    { name: 'Happy Hour', day: 'Parties', stage: 'Fri · Venue B', night: 'Fri', venue: 'Venue B', time: '5 PM - 9 PM' },
    { name: 'Big Night', day: 'Parties', stage: 'Fri · Venue C', night: 'Fri', venue: 'Venue C', time: '9 PM - 3 AM', area: 'Mission' },
    { name: 'Half Past', day: 'Parties', stage: 'Fri · Venue D', night: 'Fri', venue: 'Venue D', time: '9:30 PM' },
    { name: 'Guessed Close', day: 'Parties', stage: 'Fri · Venue J', night: 'Fri', venue: 'Venue J', time: '9:45 PM', close: '2 AM', closeApprox: true },
    { name: 'Early Nine', day: 'Parties', stage: 'Fri · Venue A', night: 'Fri', venue: 'Venue A', time: '9 PM - 2 AM', area: 'SoMa' },
    { name: 'Ten', day: 'Parties', stage: 'Fri · Venue E', night: 'Fri', venue: 'Venue E', time: '10 PM - 4 AM' },
    { name: 'Eleven', day: 'Parties', stage: 'Fri · TBA (SF)', night: 'Fri', venue: 'TBA (SF)', time: '11 PM - 6 AM' },
    { name: 'Two AM', day: 'Parties', stage: 'Fri · Venue F', night: 'Fri', venue: 'Venue F', time: '2 AM' },
    { name: 'Doors Only', day: 'Parties', stage: 'Fri · Venue G', night: 'Fri', venue: 'Venue G', doors: '10 PM' },
    { name: 'No Clock', day: 'Parties', stage: 'Fri · Venue H', night: 'Fri', venue: 'Venue H' },
    { name: 'Called Off', day: 'Parties', stage: 'Fri · Venue I', night: 'Fri', venue: 'Venue I', time: '9 PM - 2 AM', cancelled: { on: '2026-09-24', source: SRC } },
    { name: 'Sat Only', day: 'Parties', stage: 'Sat · Venue A', night: 'Sat', venue: 'Venue A', time: '9 PM - 2 AM' },
    { name: 'Both Rooms', day: 'Afters & Parties', stage: 'Fri · Venue Z', night: 'Fri', venue: 'Venue Z', time: '9 PM - 3 AM' },
  ],
  days: { Saturday: { stages: ['A'], artists: [{ name: 'Headliner', stage: 'A', time: '8:00 PM - 9:00 PM' }] } },
};
const PARTIES_FRI = FEST.artists.filter((a) => a.night === 'Fri' && /Parties/.test(a.day));

const TOKEN = 'bytimetesttoken_0123456789';
FESTIVAL_INDEX.push({ id: 'by-time-fest', status: 'scheduled' }, { id: 'portola-by-time', status: 'scheduled' });
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } },
  festivals: { 'by-time-fest': { selections: { 'Big Night': { Kevin: 4, Maya: 2 } } } },
  affinity: {},
}, 'by-time-fest');
FESTIVALS['by-time-fest'] = FEST;
// Portola as the file has it TODAY, declared by time — the real Folsom
// entries, whatever the next data drop makes of them.
FESTIVALS['portola-by-time'] = {
  ...portolaFile,
  id: 'portola-by-time',
  dayMeta: { ...portolaFile.dayMeta, Folsom: { ...portolaFile.dayMeta.Folsom, layout: 'by-time' } },
};

const ctxFor = (fid, over = {}) => {
  const ctx = {
    fid, meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
    filterPeople: [], folded: [], now: new Date('2026-01-01T12:00:00'),
    taps: [], opened: [], dayDoors: [],
    picks: model.picksFor(state.crewDoc, fid),
    onOpenNotes: (a) => ctx.opened.push(a), onNotesChange: null,
    onOpenDayNotes: (target) => ctx.dayDoors.push(target),
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
const blockOf = (root, day) => root.querySelector(`.day-block[data-day="${day}"]`);
const roomOf = (root, day, key) => blockOf(root, day) && blockOf(root, day).querySelector(`.room[data-room="${key}"]`);
// What a time list reads as: [[band label, [[name, "time\nvenue · area"], …]], …]
// — the time line, then the place's phrases as one line (the card decides at
// layout whether they share a line; jsdom has none).
const placeOf = (c) => [...c.querySelectorAll('.place > .phrase')].map((s) => s.textContent);
const bandsOf = (room) => [...room.querySelectorAll('.time-band')].map((b) => [
  b.querySelector('.band-head .label').textContent,
  [...b.querySelectorAll('.band-grid > .card')].map((c) => [c.dataset.artist,
    [(c.querySelector('.time') || {}).textContent, placeOf(c).join(' · ')].filter(Boolean).join('\n')]),
]);
const click = (node) => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

// ---- the declaration ---------------------------------------------------------------

test('a section reads by time only when its own dayMeta says so; everything else is the stacks', () => {
  assert.deepEqual(LAYOUTS, [BY_VENUE, BY_TIME]);
  assert.equal(sectionLayoutOf(FEST, 'Parties'), BY_TIME);
  assert.equal(sectionLayoutOf(FEST, 'Afters'), BY_VENUE, 'no field is the stacks');
  assert.equal(sectionLayoutOf(FEST, 'Nowhere'), BY_VENUE);
  assert.equal(sectionLayoutOf({ dayMeta: { Parties: { layout: 'sideways' } } }, 'Parties'), BY_VENUE,
    'an unknown value renders the default (and the validator refuses it)');
  assert.equal(sectionLayoutOf(null, 'Parties'), BY_VENUE);
  assert.equal(sectionLayoutOf(portolaFile, 'Afters'), BY_VENUE, "Portola's afters stay stacks");
});

// ---- the bands ------------------------------------------------------------------------

test('the bands are fixed times on the festival-day clock, never fitted to the data', () => {
  const at = (h, m = 0) => h * 60 + m; // festival-day minutes: 9 AM = 540, 2 AM = 26 × 60
  const cases = [
    [at(10), 'day'], [at(16, 59), 'day'], [at(17), 'evening'], [at(20, 59), 'evening'],
    [at(21), '9pm'], [at(21, 59), '9pm'], [at(22), '10pm'], [at(22, 59), '10pm'],
    [at(23), 'late'], [at(24), 'late'], [at(25, 59), 'late'], [at(26), 'after'], [at(27), 'after'], [at(32, 59), 'after'],
    [null, 'tba'],
  ];
  for (const [min, key] of cases) assert.equal(bandOf(min).key, key, `${min} → ${key}`);
  assert.deepEqual(TIME_BANDS.map((b) => b.label), ['Daytime', 'Evening', '9 PM', '10 PM', 'Late', 'After-hours']);
  for (let i = 1; i < TIME_BANDS.length; i++) assert.equal(TIME_BANDS[i].from, TIME_BANDS[i - 1].to, 'no gap and no overlap between bands');
});

test("a night lines up by start: across rooms, a cancelled party last in its band, doors when there is no set time, file order for a tie", () => {
  const bands = timeBandsOf(PARTIES_FRI);
  assert.deepEqual(bands.map((b) => [b.key, b.members.map((m) => m.e.name)]), [
    ['day', ['Tea Dance']],
    ['evening', ['Happy Hour']],
    ['9pm', ['Big Night', 'Early Nine', 'Both Rooms', 'Half Past', 'Guessed Close', 'Called Off']],
    ['10pm', ['Ten', 'Doors Only']],
    ['late', ['Eleven']],
    ['after', ['Two AM']],
    ['tba', ['No Clock']],
  ]);
});

test('each member knows what its stack card would — venue, cancelled, the start of its now window — and a printed end is where a party stops', () => {
  const stack = new Map();
  for (const g of venueGroupsOf(PARTIES_FRI)) for (const m of g.members) stack.set(m.e, { ...m, venue: g.venue });
  const all = timeBandsOf(PARTIES_FRI).flatMap((b) => b.members);
  for (const m of all) {
    const s = stack.get(m.e);
    assert.deepEqual([m.venue, m.nowFrom, m.cancelled], [s.venue, s.nowFrom, s.cancelled], m.e.name);
    if (!m.endStr) assert.equal(m.nowTo, s.nowTo, `${m.e.name}: no printed end, the stack's rule`);
  }
  const one = (name) => all.find((m) => m.e.name === name);
  // Two parties in one room, one night: a stack would run the tea dance until
  // the 9 PM party opened the same door; a party ends when it says it does.
  assert.deepEqual([one('Tea Dance').nowFrom, one('Tea Dance').nowTo], [15 * 60, 20 * 60]);
  assert.equal(stack.get(one('Tea Dance').e).nowTo, 21 * 60, '(the stack\'s answer, for the record)');
  // No printed end: the room's close when the file has one, else an hour.
  assert.deepEqual([one('Guessed Close').nowFrom, one('Guessed Close').nowTo], [21 * 60 + 45, 26 * 60]);
  assert.deepEqual([one('Half Past').nowFrom, one('Half Past').nowTo], [21 * 60 + 30, 22 * 60 + 30]);
});

test('how many parties there are changes nothing about how they are banded', () => {
  const one = timeBandsOf([PARTIES_FRI.find((a) => a.name === 'Big Night')]);
  assert.deepEqual(one.map((b) => [b.key, b.members.length]), [['9pm', 1]]);
  const many = timeBandsOf([...PARTIES_FRI, ...PARTIES_FRI.map((a) => ({ ...a, name: `${a.name} II` }))]);
  assert.deepEqual(many.map((b) => b.key), timeBandsOf(PARTIES_FRI).map((b) => b.key));
  assert.deepEqual(timeBandsOf([]), []);
});

test('a range drops the first AM/PM only inside one half-day: 10 AM to 12 AM is to MIDNIGHT, never a two-hour brunch', () => {
  const cases = [
    ['10 AM - 12 AM', '10 AM – 12 AM'], // the Kink.com Penthouse Preview, Folsom Sunday
    ['12 PM - 6 PM', '12 – 6 PM'], ['9 PM - 11:59 PM', '9 – 11:59 PM'], ['12 AM - 3 AM', '12 – 3 AM'],
    ['9 PM - 3 AM', '9 PM – 3 AM'], ['3 PM - 12 AM', '3 PM – 12 AM'], ['7:30 PM - 12 AM', '7:30 PM – 12 AM'],
  ];
  for (const [t, want] of cases) assert.equal(timeRange(t), want, t);
});

// ---- the wall ---------------------------------------------------------------------------

test('the wall: a by-time section is a time list on each of its nights, the other section is still stacks, a night without it has nothing', () => {
  const { root } = render('by-time-fest');
  assert.deepEqual([...blockOf(root, 'Thursday').querySelectorAll('.room')].map((r) => r.dataset.room), ['Afters'],
    'Thursday has no parties, so no PARTIES room, head or list');
  const fri = roomOf(root, 'Friday', 'Parties');
  assert.ok(fri, 'FRI PARTIES');
  assert.equal(fri.querySelector('.room-head .name').textContent, 'FRI PARTIES');
  assert.equal(fri.querySelectorAll('.venue-grid').length, 0, 'no venue stacks in a by-time room');
  const list = fri.querySelector('.time-list');
  assert.equal(list.dataset.iso, '2026-09-25', 'the list knows its date — the now marks key on it');
  assert.equal(list.dataset.tz, 'America/Los_Angeles');
  assert.equal(list.dataset.clock, undefined, 'Friday has no timetable above it');
  assert.ok(roomOf(root, 'Friday', 'Afters').querySelector('.venue-grid'), 'FRI AFTERS is still venue stacks');
  assert.deepEqual(bandsOf(fri), [
    ['Daytime', [['Tea Dance', '3 – 8 PM\nVenue A · SoMa']]],
    ['Evening', [['Happy Hour', '5 – 9 PM\nVenue B']]],
    ['9 PM', [
      ['Big Night', '9 PM – 3 AM\nVenue C · Mission'],
      ['Early Nine', '9 PM – 2 AM\nVenue A · SoMa'],
      ['Both Rooms', '9 PM – 3 AM\nVenue Z'],
      ['Half Past', '9:30 PM\nVenue D'],
      ['Guessed Close', '9:45 PM – ~2 AM\nVenue J'],
      ['Called Off', 'Cancelled\nVenue I'],
    ]],
    ['10 PM', [['Ten', '10 PM – 4 AM\nVenue E'], ['Doors Only', 'Doors 10 PM\nVenue G']]],
    ['Late', [['Eleven', '11 PM – 6 AM\nTBA (SF)']]],
    ['After-hours', [['Two AM', '2 AM\nVenue F']]],
    ['Time TBA', [['No Clock', 'Venue H']]],
  ]);
  // The place is PHRASES, never one string: a phrase never breaks inside
  // itself (Kevin, 2026-09-25), and the dot between them is drawn, not text.
  const big = fri.querySelector('.card[data-artist="Big Night"]');
  assert.deepEqual(JSON.parse(big.dataset.place), ['Venue C', 'Mission']);
  assert.deepEqual([...big.querySelectorAll('.place > *')].map((n) => [n.className, n.textContent]),
    [['phrase lead', 'Venue C'], ['pdot', '·'], ['phrase', 'Mission']]);
  assert.equal(big.querySelector('.place .pdot').getAttribute('aria-hidden'), 'true');
  assert.equal(fri.querySelector('.card[data-artist="Half Past"] .place .pdot'), null, 'no area, no dot');
  const off = fri.querySelector('.card[data-artist="Called Off"]');
  assert.ok(off.classList.contains('cancelled'), 'a cancelled party wears its struck card');
  for (const card of fri.querySelectorAll('.card')) {
    const entry = FEST.artists.find((a) => a.name === card.dataset.artist);
    assert.deepEqual(JSON.parse(card.dataset.occ), occOf(entry), `${card.dataset.artist}: the card is its occurrence, as a stack card is`);
  }
  assert.ok(roomOf(root, 'Friday', 'Afters').querySelector('.card[data-artist="Both Rooms"]'),
    'a show billed to both sections is in the afters stacks too');
  const sat = roomOf(root, 'Saturday', 'Parties').querySelector('.time-list');
  assert.equal(sat.dataset.clock, 'day', 'under Saturday\'s timetable the list is told so (v3.css steps it in from 720 up)');
  assert.deepEqual(bandsOf(roomOf(root, 'Saturday', 'Parties')), [['9 PM', [['Sat Only', '9 PM – 2 AM\nVenue A']]]]);
});

test('the room head is still the door to that section on that date; a tap still picks and the card keeps its label and its now window', () => {
  const { root, ctx } = render('by-time-fest');
  const fri = roomOf(root, 'Friday', 'Parties');
  const head = fri.querySelector('.room-head');
  assert.equal(head.tagName, 'BUTTON');
  click(head);
  assert.deepEqual(ctx.dayDoors, ['2026-09-25|Parties'], 'the note key is unchanged: <iso>|<section>');
  const card = fri.querySelector('.card[data-artist="Half Past"]');
  const was = [card.dataset.nowFrom, card.dataset.nowTo, card.querySelector('.time').textContent, placeOf(card)];
  click(card);
  assert.deepEqual(ctx.taps, ['Half Past']);
  const fresh = fri.querySelector('.card[data-artist="Half Past"]');
  assert.notEqual(fresh, card, 'the pick repainted the card');
  assert.deepEqual([fresh.dataset.nowFrom, fresh.dataset.nowTo, fresh.querySelector('.time').textContent, placeOf(fresh)], was);
  assert.equal(fresh.parentElement.classList.contains('band-grid'), true, 'in its band, where it was');
});

test('the now mark lights whoever is open right now, in a time list as in a stack', () => {
  const { root } = render('by-time-fest');
  // Friday 11:30 PM in San Francisco.
  positionNowMarks(root, new Date('2026-09-26T06:30:00Z'));
  const lit = [...roomOf(root, 'Friday', 'Parties').querySelectorAll('.card.now')].map((c) => c.dataset.artist);
  // Half Past printed no end and the file gives its room no close, so it had
  // its hour (9:30–10:30); Guessed Close runs to its room's ~2 AM.
  assert.deepEqual(lit.sort(), ['Big Night', 'Both Rooms', 'Early Nine', 'Eleven', 'Guessed Close', 'Ten'].sort());
  const big = roomOf(root, 'Friday', 'Parties').querySelector('.card[data-artist="Big Night"]');
  assert.match(big.getAttribute('aria-label'), /, playing now$/);
  positionNowMarks(root, new Date('2026-09-26T09:30:00Z')); // 2:30 AM: the after-hours party is on
  assert.ok(roomOf(root, 'Friday', 'Parties').querySelector('.card[data-artist="Two AM"]').classList.contains('now'));
});

// ---- a night runs past the 5 AM rollover (Sol's review of v94, 2026-09-26) ----------
// The festival clock rolls to the next calendar day at 5 AM; a night's cards
// stay live until their OWN printed end. Before this, Saturday's after-hours
// lost its ring, the NOW tab and its stop at 5:00 AM on the dot.
test('nightMinutes: the clock on a night\'s own axis — that night, or the next calendar day, never further', () => {
  const tz = 'America/Los_Angeles';
  const at = (iso, when) => nightMinutes(iso, festivalClock(new Date(when), tz));
  assert.equal(at('2026-09-26', '2026-09-26T23:30:00-07:00'), 23 * 60 + 30, 'Saturday night, Saturday\'s clock');
  assert.equal(at('2026-09-26', '2026-09-27T04:59:00-07:00'), 28 * 60 + 59, 'before the rollover: still Saturday\'s day');
  assert.equal(at('2026-09-26', '2026-09-27T05:00:00-07:00'), 29 * 60, 'after it: Saturday\'s night reads Saturday\'s 29:00');
  assert.equal(at('2026-09-27', '2026-09-27T05:00:00-07:00'), 5 * 60, 'and Sunday\'s own day reads 5 AM');
  assert.equal(at('2026-09-25', '2026-09-27T05:00:00-07:00'), null, 'two nights back is over');
  assert.equal(at('2026-09-28', '2026-09-27T05:00:00-07:00'), null, 'a night that has not started');
  assert.equal(at(null, '2026-09-27T05:00:00-07:00'), null);
});

test("Portola's after-hours keep their rings, the NOW tab and its stop across 5 AM, to their own printed end", () => {
  FESTIVALS['portola-2026'] = portolaFile;
  if (!FESTIVAL_INDEX.some((f) => f.id === 'portola-2026')) FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' });
  const { root, ctx } = render('portola-2026');
  const ringed = (when) => {
    positionNowMarks(root, new Date(when));
    return [...root.querySelectorAll('.card.now')].map((c) => c.dataset.artist);
  };
  const lit = (when, name) => ringed(when).includes(name);
  // Aftershock: Saturday night's AFTER-HOURS, 3 to 10 AM Sunday.
  for (const t of ['2026-09-27T04:59:00-07:00', '2026-09-27T05:00:00-07:00', '2026-09-27T09:59:00-07:00']) assert.ok(lit(t, 'Aftershock'), `Aftershock is on at ${t}`);
  assert.ok(!lit('2026-09-27T10:00:00-07:00', 'Aftershock'), 'and out at its printed 10 AM');
  // PERVERT XXL: Saturday 10 PM to 6 AM Sunday.
  assert.ok(lit('2026-09-27T05:59:00-07:00', 'PERVERT XXL'), 'PERVERT XXL at 5:59 AM');
  assert.ok(!lit('2026-09-27T06:00:00-07:00', 'PERVERT XXL'), 'out at its printed 6 AM');
  // MÜLL: Friday 11 PM to 6 AM Saturday — the same rule a night earlier.
  assert.ok(lit('2026-09-26T05:30:00-07:00', 'MÜLL'), 'MÜLL at 5:30 AM Saturday');
  assert.ok(!lit('2026-09-26T06:00:00-07:00', 'MÜLL'), 'out at its printed 6 AM');
  // A party that ends at 5 AM ends at 5 AM.
  assert.ok(lit('2026-09-27T04:59:00-07:00', 'FOLSOM SLUT SATURDAY') && !lit('2026-09-27T05:00:00-07:00', 'FOLSOM SLUT SATURDAY'));
  // The ring is the NOW tab's answer and the tap's stop (nowLanding reads the rings).
  const at = new Date('2026-09-27T09:59:00-07:00');
  positionNowMarks(root, at);
  const land = nowLanding(root, ctx, at);
  assert.ok(land && land.card, 'NOW is there at 9:59 AM Sunday');
  assert.equal(land.card.dataset.artist, 'Aftershock');
  assert.equal(land.card.closest('.day-block').dataset.day, 'Saturday', 'under Saturday, where the night belongs');
});

test('a stack obeys the same rule: an afters set that runs past 5 AM stays on to its own end', () => {
  const SUNRISE = {
    id: 'sunrise-fest', name: 'Sunrise', status: 'scheduled', timezone: 'America/Los_Angeles',
    dayMeta: { Saturday: { wd: 'Sat', date: 'Sep 26', iso: '2026-09-26' }, Afters: { date: 'Sep 26' } },
    artists: [
      { name: 'Headliner', day: 'Saturday' },
      { name: 'Sunrise Set', day: 'Afters', stage: 'Sat · The Warehouse', night: 'Sat', venue: 'The Warehouse', time: '4 AM - 7 AM' },
    ],
    days: { Saturday: { stages: ['A'], artists: [{ name: 'Headliner', stage: 'A', time: '8:00 PM - 9:00 PM' }] } },
  };
  FESTIVALS['sunrise-fest'] = SUNRISE;
  if (!FESTIVAL_INDEX.some((f) => f.id === 'sunrise-fest')) FESTIVAL_INDEX.push({ id: 'sunrise-fest', status: 'scheduled' });
  const { root } = render('sunrise-fest');
  const card = () => root.querySelector('.venue-grid .card[data-artist="Sunrise Set"]');
  assert.ok(card(), 'a stack card, not a time list');
  for (const [t, on] of [['2026-09-27T04:30:00-07:00', true], ['2026-09-27T05:00:00-07:00', true], ['2026-09-27T06:59:00-07:00', true], ['2026-09-27T07:00:00-07:00', false]]) {
    positionNowMarks(root, new Date(t));
    assert.equal(card().classList.contains('now'), on, t);
  }
});

test('the show menu and a share link\'s &show= still hide and show the section by its key', () => {
  state.setActiveFestivalId('by-time-fest');
  const rooms = roomsOf(FEST, ctxFor('by-time-fest'));
  assert.ok(rooms.some((r) => r.key === 'Parties'), 'the menu offers PARTIES');
  const { root: hidden } = render('by-time-fest', { folded: ['Parties'] });
  assert.equal(hidden.querySelectorAll('.room[data-room="Parties"]').length, 0, 'hidden renders nothing');
  assert.equal(hidden.querySelectorAll('.time-list').length, 0);
  const folded = foldFromShow(rooms, ['parties']);
  assert.ok(folded && !folded.includes('Parties'), 'a link that says show=parties keeps it');
  const { root } = render('by-time-fest', { folded });
  assert.deepEqual([...root.querySelectorAll('.room')].map((r) => r.dataset.room), ['Parties', 'Parties'],
    'only the parties, Friday and Saturday');
  assert.equal(root.querySelectorAll('.room .time-list').length, 2);
});

test("the day image lists a by-time section in the wall's order: by start, not by venue", () => {
  state.setActiveFestivalId('by-time-fest');
  const rows = dayArtistsFor('Friday').filter((r) => /^Parties/.test(r.time || ''));
  assert.deepEqual(rows.map((r) => r.name),
    ['Tea Dance', 'Happy Hour', 'Big Night', 'Early Nine', 'Both Rooms', 'Half Past', 'Guessed Close', 'Called Off', 'Ten', 'Doors Only', 'Eleven', 'Two AM', 'No Clock']);
  assert.equal(rows.find((r) => r.name === 'Big Night').time, 'Parties · Venue C · 9 PM - 3 AM');
  assert.equal(rows.find((r) => r.name === 'Called Off').time, 'Parties · Venue I · Cancelled');
});

test("Portola's real Folsom entries, declared by time: every Folsom night is a time list, Afters is untouched, every Folsom card is there once", () => {
  const { root } = render('portola-by-time');
  const folsom = portolaFile.artists.filter((a) => /Folsom/.test(a.day));
  let cards = 0;
  for (const day of ['Friday', 'Saturday', 'Sunday']) {
    const room = roomOf(root, day, 'Folsom');
    assert.ok(room, `${day} FOLSOM`);
    assert.equal(room.querySelectorAll('.venue-grid').length, 0);
    assert.ok(room.querySelector('.time-list'));
    cards += room.querySelectorAll('.card').length;
    assert.ok(roomOf(root, day, 'Afters').querySelector('.venue-grid'), `${day} AFTERS stays stacks`);
  }
  assert.equal(cards, folsom.length, 'one card per Folsom entry (Horse Meat Disco\'s included)');
  assert.deepEqual(validateFestivalDoc(FESTIVALS['portola-by-time']).errors, [], 'the declaration validates on the real file');
});

test('a party in a by-time section is its own show; a combined label still has a room where its other part is stacks', () => {
  assert.equal(showsOnItsOwn(FEST, { day: 'Parties' }), true);
  assert.equal(showsOnItsOwn(FEST, { day: 'Afters' }), false);
  assert.equal(showsOnItsOwn(FEST, { day: 'Afters & Parties' }), false, 'its Afters room still holds it to the room rules');
  assert.equal(showsOnItsOwn(withMeta({ Afters: { date: 'Sep 24-27', layout: 'by-time' } }), { day: 'Afters & Parties' }), true);
  assert.equal(showsOnItsOwn(FEST, { day: 'Saturday' }), false);
  assert.equal(showsOnItsOwn(FEST, {}), false);
});

test("Portola's Folsom: in a venue that hosts several parties a night, each card opens its OWN doors — its page, its tickets", () => {
  const fest = portolaFile;
  assert.equal(sectionLayoutOf(fest, 'Folsom'), BY_TIME, 'the file declares Folsom by time');
  const shared = new Map();
  for (const a of fest.artists) {
    if (a.day !== 'Folsom' || a.cancelled) continue;
    const k = `${a.night}|${a.venue}`;
    if (!shared.has(k)) shared.set(k, []);
    shared.get(k).push(a);
  }
  const rooms = [...shared].filter(([, list]) => list.length > 1);
  assert.ok(rooms.length >= 5, `several venue-nights host more than one party (${rooms.map(([k]) => k).join(', ')})`);
  FESTIVALS['portola-2026'] = fest;
  if (!FESTIVAL_INDEX.some((f) => f.id === 'portola-2026')) FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' });
  const { root, ctx } = render('portola-2026');
  const dayOf = { Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
  let differ = 0;
  for (const [k, list] of rooms) {
    const [night] = k.split('|');
    const room = roomOf(root, dayOf[night], 'Folsom');
    const doors = list.map((a) => {
      const card = [...room.querySelectorAll('.card')].find((c) => c.dataset.artist === a.name);
      assert.ok(card, `${a.name} has its own card`);
      const facts = factsFor(a.name, ctx, JSON.parse(card.dataset.occ));
      assert.deepEqual(facts.links, linksOf(a), `${a.name}: the zoom's doors are its own`);
      return JSON.stringify(facts.links);
    });
    if (new Set(doors).size > 1) differ += 1;
  }
  assert.ok(differ >= 1, 'and where the parties publish different pages, the doors differ (Sat Transform1060: Humanitix, Eventbrite)');
  assert.equal(validateFestivalDoc(fest, { filename: 'portola-2026.json' }).warnings.length, 0, 'no room warnings: each party is its own show');
});

// ---- the validator ------------------------------------------------------------------------

const withMeta = (dayMeta, extra = {}) => ({ ...FEST, dayMeta: { ...FEST.dayMeta, ...dayMeta }, ...extra });
const errorsOf = (fest) => validateFestivalDoc(fest).errors;

test('validator: the fixture is clean, and a by-time section is not asked for a running order', () => {
  const { errors, warnings } = validateFestivalDoc(FEST);
  assert.deepEqual(errors, []);
  assert.equal(warnings.filter((w) => /running order/.test(w)).length, 0, 'two parties in Venue A on Friday are two parties');
  const stacked = validateFestivalDoc(withMeta({ Parties: { date: 'Sep 25-27' } }));
  assert.ok(stacked.warnings.some((w) => /Parties · Fri · Venue A: 2 timed sets in one room and no running order/.test(w)),
    'the same night as stacks still is');
  assert.ok(warnings.some((w) => /No Clock \(Parties\): no time and no doors — a by-time section shows it last, under TIME TBA/.test(w)));
  assert.ok(!warnings.some((w) => /Called Off/.test(w)), 'a cancelled party owes no clock');
});

test('validator: a declaration that lands nowhere is an error, each for its own reason', () => {
  assert.ok(errorsOf(withMeta({ Parties: { layout: 'sideways' } })).some((e) => /dayMeta\.Parties\.layout must be one of by-venue\|by-time/.test(e)));
  assert.ok(errorsOf(withMeta({ Saturday: { ...FEST.dayMeta.Saturday, layout: 'by-time' } })).some((e) => /is a grid day/.test(e)));
  assert.ok(errorsOf(withMeta({ 'Afters & Parties': { layout: 'by-time' } })).some((e) => /is a combined label/.test(e)));
  assert.ok(errorsOf(withMeta({ Partys: { layout: 'by-time' } })).some((e) => /no artists\[\] entry plays under "Partys"/.test(e)));
  const lineup = { id: 'lineup-x', name: 'Lineup', status: 'lineup', dayMeta: { Friday: { layout: 'by-time' } }, artists: [{ name: 'A', day: 'Friday' }] };
  assert.ok(errorsOf(lineup).some((e) => /a festival with no grid has no sections/.test(e)));
  assert.deepEqual(errorsOf(withMeta({ Afters: { date: 'Sep 24-27', layout: 'by-venue' } })), [], 'saying the default out loud is fine');
});

test('validator: area is a short neighbourhood string', () => {
  const withArea = (area) => ({ ...FEST, artists: FEST.artists.map((a) => (a.name === 'Ten' ? { ...a, area } : a)) });
  assert.deepEqual(errorsOf(withArea('Tenderloin')), []);
  for (const bad of ['', '   ', 7, 'x'.repeat(41)]) {
    assert.ok(errorsOf(withArea(bad)).some((e) => /Ten\): area must be a short non-empty string/.test(e)), JSON.stringify(bad));
  }
});
