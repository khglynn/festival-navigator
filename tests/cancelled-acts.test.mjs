// A cancelled act (2026-09-23). Skepta was called off Portola's Saturday
// Crane Stage on 2026-09-21, three people in the crew had picked him, and his
// name is a frozen pick key. The act keeps its card: it reads as off, keeps
// its picks, sorts last in its room, is never "now", says why in the zoom,
// answers a search as cancelled, is marked in the day image, and never goes
// into a playlist. The grid matches the re-posted flyer.
//
// The shape is `artists[].cancelled: { on, source, note? }` —
// docs/add-a-festival.md, "Cancelled acts".
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
const { renderWall, renderCard, refreshCard, positionNowMarks } = await import('../js/v3/wall.js');
const { factsFor, sheetCard } = await import('../js/v3/card-facts.js');
const events = await import('../js/v3/events.js');
const { dayArtistsFor } = await import('../js/v3/tools.js');
const { validateFestivalDoc } = await import('../api/_lib/festival-rules.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const frozen = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/live-pick-keys.json'), 'utf8'));

const CHRONICLE = 'https://www.sfchronicle.com/entertainment/festivals/article/portola-festival-skepta-22442803.php';
const FID = 'portola-2026';
const TOKEN = 'cancelledactstoken_0123456';
FESTIVAL_INDEX.push({ id: FID, status: 'scheduled' }, { id: 'tiny-fest', status: 'scheduled' });
FESTIVALS[FID] = portola;
// The crew as it stands on Portola: three people picked Skepta, two of them
// as a must. Their picks must survive the cancellation, visibly.
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 }, Drew: { colorIndex: 1 }, Pegah: { colorIndex: 2 }, Nhu: { colorIndex: 3 } },
  festivals: { [FID]: { selections: { Skepta: { Drew: 4, Pegah: 4, Nhu: 2 }, 'DJ Shadow': { Kevin: 3 } } } },
  affinity: {},
}, FID);

const ctxFor = (fid, over = {}) => ({
  fid, meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
  filterPeople: [], folded: [], now: new Date('2026-01-01T12:00:00'),
  picks: model.picksFor(state.crewDoc, fid), onOpenNotes: () => {}, onNotesChange: null, onOpenDayNotes: () => {}, onTap: () => {},
  ...over,
});
const render = (fid, over = {}) => {
  state.setActiveFestivalId(fid);
  const root = document.getElementById('wall-root');
  renderWall(root, ctxFor(fid, over));
  return root;
};
const skeptaCards = (root) => [...root.querySelectorAll('.card')].filter((c) => c.dataset.artist === 'Skepta');

// ---- the rules ---------------------------------------------------------------------
// A small fest to hold each rule to: one grid day, one billed name called off.
const tiny = (over = {}) => ({
  id: 'tiny-fest', name: 'Tiny Fest', status: 'scheduled', timezone: 'America/Chicago',
  dayMeta: { Saturday: { wd: 'Sat', date: 'Oct 3', iso: '2026-10-03' } },
  venues: { 'The Room': 'https://maps.google.com/?q=The+Room' },
  artists: [
    { name: 'Opener', day: 'Saturday' },
    { name: 'Gone', day: 'Saturday', venue: 'Main', cancelled: { on: '2026-09-21', source: CHRONICLE, note: 'No replacement.' } },
  ],
  days: { Saturday: { stages: ['Main'], artists: [{ name: 'Opener', stage: 'Main', time: '8:00 PM - 9:00 PM' }] } },
  ...over,
});

test('rules: a cancelled billed name is clean — no "billed but no set" warning, no "venue has no map" warning', () => {
  const r = validateFestivalDoc(tiny());
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, [], 'a called-off act is SUPPOSED to be off the grid, and needs no map');
  // The control: the same name un-cancelled warns exactly as it always did.
  const live = tiny();
  delete live.artists[1].cancelled;
  assert.ok(validateFestivalDoc(live).warnings.some((w) => /Gone is billed on Saturday but has no set/.test(w)));
});

test('rules: a cancelled name that still has a set on its day\'s grid is an ERROR', () => {
  const f = tiny();
  f.days.Saturday.artists.push({ name: 'Gone', stage: 'Main', time: '9:00 PM - 10:00 PM' });
  const r = validateFestivalDoc(f);
  assert.ok(r.errors.some((e) => /Gone/.test(e) && /cancelled/.test(e) && /grid/.test(e)), r.errors.join('\n'));
});

test('rules: the name may still play ANOTHER day — the check is the entry\'s own day', () => {
  const f = tiny();
  f.dayMeta.Sunday = { wd: 'Sun', date: 'Oct 4', iso: '2026-10-04' };
  f.days.Sunday = { stages: ['Main'], artists: [{ name: 'Gone', stage: 'Main', time: '8:00 PM - 9:00 PM' }] };
  f.artists.push({ name: 'Gone', day: 'Sunday' });
  assert.deepEqual(validateFestivalDoc(f).errors, []);
});

test('rules: the shape — an object of on (a real date), source (https) and an optional one-line note, nothing else', () => {
  const bad = (cancelled, re) => {
    const f = tiny();
    f.artists[1].cancelled = cancelled;
    const { errors } = validateFestivalDoc(f);
    assert.ok(errors.some((e) => re.test(e)), `${JSON.stringify(cancelled)} → ${errors.join(' | ') || 'no error'}`);
  };
  bad(true, /cancelled must be an object/);
  bad('2026-09-21', /cancelled must be an object/);
  bad({ source: CHRONICLE }, /cancelled\.on/);
  bad({ on: '2026-09-31', source: CHRONICLE }, /cancelled\.on/);
  bad({ on: '2026-09-21' }, /cancelled\.source/);
  bad({ on: '2026-09-21', source: 'http://example.com/x' }, /cancelled\.source/);
  bad({ on: '2026-09-21', source: CHRONICLE, note: 'x'.repeat(141) }, /cancelled\.note/);
  bad({ on: '2026-09-21', source: CHRONICLE, note: 'two\nlines' }, /cancelled\.note/);
  bad({ on: '2026-09-21', source: CHRONICLE, date: '2026-09-21' }, /cancelled\.date is not a field/);
  // The note is optional.
  const f = tiny();
  delete f.artists[1].cancelled.note;
  assert.deepEqual(validateFestivalDoc(f).errors, []);
});

test('rules: two weekends — an act lost on Weekend 1 keeps its Weekend 2 set, and only a set on the SAME weekend is an error', () => {
  const f = tiny({ id: 'tiny-fest' });
  f.dayMeta.Saturday = { wd: 'Sat', dates: { W1: 'Oct 3', W2: 'Oct 10' }, isos: { W1: '2026-10-03', W2: '2026-10-10' } };
  f.artists[1] = { ...f.artists[1], weekends: 'W1' };
  f.days.Saturday.artists.push({ name: 'Gone', stage: 'Main', time: '9:00 PM - 10:00 PM', weekend: 'W2' });
  assert.deepEqual(validateFestivalDoc(f).errors, [], 'W1 cancelled, W2 still on: clean');
  f.days.Saturday.artists[1].weekend = 'W1';
  assert.ok(validateFestivalDoc(f).errors.some((e) => /Gone is cancelled but still has a set/.test(e)), 'the same weekend is the error');
  f.days.Saturday.artists[1].weekend = 'both';
  assert.ok(validateFestivalDoc(f).errors.some((e) => /Gone is cancelled but still has a set/.test(e)), 'a set on both weekends overlaps');
});

test('rules: a cancelled show in a numbered run is out of the run — the live sets renumbered are clean, the guesser gives it no slot', async () => {
  const src = 'https://example.test/bill';
  const show = (name, seq, of, extra = {}) => ({ name, day: 'Afters', night: 'Sat', venue: 'The Room', stage: 'Sat · The Room', doors: '10 PM', close: '2 AM', ...(seq ? { order: { seq, of, source: src, confirmed: false } } : {}), ...extra });
  const f = tiny({
    venues: { 'The Room': 'https://maps.google.com/?q=The+Room' },
    artists: [
      { name: 'Opener', day: 'Saturday' },
      show('First', 1, 2, { time: '10 PM', approx: true }),
      show('Called Off', null, null, { time: '11 PM', approx: true, cancelled: { on: '2026-09-21', source: CHRONICLE } }),
      show('Last', 2, 2, { time: '12 AM', approx: true }),
    ],
  });
  const r = validateFestivalDoc(f);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, [], 'no "timed sets and no running order" warning for the cancelled one');
  const { runsOf } = await import('../scripts/guess-run-times.mjs');
  // Even one that kept its old number takes no slot.
  f.artists[2].order = { seq: 2, of: 3, source: src, confirmed: false };
  assert.deepEqual(runsOf(f).flatMap((g) => g.members.map((m) => m.name)), ['First', 'Last']);
});

test('rules: a GRID set is never cancelled in place — it comes off the grid', () => {
  const f = tiny();
  f.days.Saturday.artists[0].cancelled = { on: '2026-09-21', source: CHRONICLE };
  assert.ok(validateFestivalDoc(f).errors.some((e) => /Opener/.test(e) && /grid set/.test(e)));
});

// ---- the data ----------------------------------------------------------------------
test('portola-2026: Skepta is off the Saturday grid and the Crane Stage reads as the v2 flyer (re-posted 2026-09-21)', () => {
  const sat = portola.days.Saturday.artists;
  assert.equal(sat.find((a) => a.name === 'Skepta'), undefined, 'no set for a cancelled act');
  const crane = sat.filter((a) => a.stage === 'Crane Stage').map((a) => [a.name, a.time]);
  assert.deepEqual(crane, [
    ['Soulwax', '9:55 PM - 10:55 PM'],
    ['Fatboy Slim', '7:55 PM - 9:25 PM'],
    ['DJ Shadow', '6:10 PM - 7:10 PM'],
    ['Nimino', '4:50 PM - 5:50 PM'],
    ['Tricky', '3:30 PM - 4:30 PM'],
    ['erika b2b sfcowboy', '1:30 PM - 3:10 PM'],
  ]);
  assert.ok(!portola.days.Sunday.artists.some((a) => a.name === 'Skepta'), 'he was never on Sunday');
});

test('portola-2026: Skepta keeps his artists[] entry — day, place, and the cancellation with its source', () => {
  const entries = portola.artists.filter((a) => a.name === 'Skepta');
  assert.equal(entries.length, 1);
  const [e] = entries;
  assert.equal(e.day, 'Saturday', 'still Saturday — the day key is pick data too');
  assert.equal(e.venue, 'Crane Stage', 'where he would have played, so the card lands under the Crane Stage');
  assert.equal(e.cancelled.on, '2026-09-21');
  assert.equal(e.cancelled.source, CHRONICLE);
  assert.match(e.cancelled.note, /No replacement/);
  assert.ok(frozen.festivals[FID].names.includes('Skepta'), 'the pick key stays frozen');
  assert.match(portola.meta.note, /2026-09-23[^]*Skepta/, 'the meta note says what changed and when');
  assert.ok(portola.meta.sources.includes(CHRONICLE));
});

// ---- the model -----------------------------------------------------------------------
test('venue groups: a cancelled show sorts last in its room, is never "now", and never cuts the show before it short', () => {
  const src = 'https://example.test/bill';
  const room = (name, time, seq, extra = {}) => ({ name, day: 'Afters', night: 'Sat', venue: 'The Room', stage: 'Sat · The Room', time, approx: true, doors: '10 PM', close: '2 AM', order: { seq, of: 3, source: src, confirmed: false }, ...extra });
  const [g] = events.venueGroupsOf([
    room('Opener', '10 PM', 1),
    room('Middle', '11 PM', 2, { cancelled: { on: '2026-09-21', source: src } }),
    room('Closer', '12:30 AM', 3),
  ]);
  assert.deepEqual(g.members.map((m) => m.e.name), ['Opener', 'Closer', 'Middle'], 'the called-off show goes to the bottom');
  const [opener, closer, middle] = g.members;
  assert.equal(middle.cancelled, true);
  assert.equal(middle.nowFrom, null);
  assert.equal(middle.nowTo, null);
  assert.equal(opener.nowTo, closer.nowFrom, 'the opener runs until the next show that is actually happening');
  assert.equal(g.sub, 'Doors 10 PM · ~2 AM');
});

test('venue groups: a room whose only show is cancelled sorts after every room with something on, and invents no window', () => {
  const groups = events.venueGroupsOf([
    { name: 'Called Off', day: 'Afters', night: 'Sat', venue: 'Dark Room', time: '9 PM', doors: '9 PM', close: '2 AM', cancelled: { on: '2026-09-21', source: CHRONICLE } },
    { name: 'Late One', day: 'Afters', night: 'Sat', venue: 'Lit Room', time: '11 PM' },
  ]);
  assert.deepEqual(groups.map((g) => g.venue), ['Lit Room', 'Dark Room']);
  assert.equal(groups[1].sub, '', 'no doors line over a room with nothing on');
  assert.equal(groups[1].members[0].nowFrom, null);
});

test('cancelledNames: the names with nothing left to see — wholly cancelled, on no grid', () => {
  const gone = events.cancelledNames(portola);
  assert.deepEqual([...gone], ['Skepta']);
  // Cancelled on one night but playing another: still worth a playlist.
  const f = tiny();
  f.artists.push({ name: 'Gone', day: 'Afters', night: 'Fri', venue: 'The Room', stage: 'Fri · The Room' });
  assert.deepEqual([...events.cancelledNames(f)], []);
  assert.deepEqual([...events.cancelledNames(tiny())], ['Gone']);
});

// ---- the wall ------------------------------------------------------------------------
test('the wall: Skepta is one card, in Saturday\'s festival room, under the Crane Stage — struck, "Cancelled" where the time goes', () => {
  const root = render(FID);
  const cards = skeptaCards(root);
  assert.equal(cards.length, 1, 'one card, never a grid cell');
  const [card] = cards;
  assert.ok(!card.classList.contains('cell'));
  assert.ok(card.classList.contains('cancelled'));
  assert.equal(card.closest('.room').dataset.room, ':fest', 'in the festival\'s own room');
  const group = card.closest('.venue-group');
  assert.equal(group.querySelector('.stage-head .label').textContent, 'Crane Stage');
  assert.equal(card.querySelector('.time').textContent, 'Cancelled');
  assert.match(card.getAttribute('aria-label'), /^Skepta \(cancelled\)/, 'a screen reader hears it first');
  assert.deepEqual(JSON.parse(card.dataset.occ), { day: 'Saturday', stage: null, time: null, weekend: null, date: null, venue: 'Crane Stage' });
  // The room's day is Saturday — the rule above the room is Saturday's.
  const cells = [...root.querySelectorAll('.card.cell')].filter((c) => c.dataset.artist === 'DJ Shadow');
  assert.equal(cells.length, 1);
  assert.equal(cells[0].dataset.time, '6:10 PM', 'DJ Shadow moved to 6:10');
});

test('the wall: the crew\'s picks on a cancelled act stay readable — the marks render, the tap still picks', () => {
  const taps = [];
  const root = render(FID, { onTap: (name) => taps.push(name) });
  const [card] = skeptaCards(root);
  const marks = card.querySelectorAll('.corner-who .mark');
  assert.equal(marks.length, 3, 'two musts and a pick, the same marks any card wears');
  assert.match(card.getAttribute('aria-label'), /picked by 3 others/);
  card.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(taps, ['Skepta'], 'a tap on a cancelled card picks like any other');
});

test('the wall: a single-card refresh (after a pick) keeps the cancelled face', () => {
  const root = render(FID);
  const [card] = skeptaCards(root);
  const fresh = refreshCard(card, 'Skepta', ctxFor(FID));
  assert.ok(fresh.classList.contains('cancelled'));
  assert.equal(fresh.querySelector('.time').textContent, 'Cancelled');
});

test('the wall: never "now" — not during the slot he had, not ever', () => {
  const root = render(FID);
  const [card] = skeptaCards(root);
  assert.equal(card.dataset.nowFrom, undefined, 'no now window to light');
  // Saturday 6:50 PM at Pier 80, the middle of the old 6:45 slot.
  positionNowMarks(root, new Date('2026-09-27T01:50:00Z'));
  assert.ok(!card.classList.contains('now'));
  assert.equal(card.querySelector('.now-label'), null);
});

test('search: finds him and answers as cancelled, with the place', () => {
  const root = render(FID, { query: 'skep' });
  const cards = skeptaCards(root);
  assert.equal(cards.length, 1);
  assert.ok(cards[0].classList.contains('cancelled'));
  assert.equal(cards[0].querySelector('.time').textContent, 'Crane Stage · Cancelled');
});

// ---- the zoom ------------------------------------------------------------------------
test('the zoom says it plainly: cancelled, when it was announced (a door to the report), and what happened around it', () => {
  state.setActiveFestivalId(FID);
  const occ = { day: 'Saturday', stage: null, time: null, weekend: null, date: null, venue: 'Crane Stage' };
  const f = factsFor('Skepta', ctxFor(FID), occ);
  assert.equal(f.when, 'Cancelled · Sat');
  assert.equal(f.where, 'Crane Stage');
  assert.deepEqual(f.cancelled, { text: 'Announced Sep 21', url: CHRONICLE, note: portola.artists.find((a) => a.name === 'Skepta').cancelled.note });
  assert.equal(f.order, null);
  assert.equal(f.people.length, 3, 'the crew still on him');
  const card = sheetCard(f, { onClose: () => {} });
  assert.ok(card.classList.contains('cancelled'));
  assert.ok(card.querySelector('.f-name').classList.contains('struck'));
  const door = card.querySelector('a.f-cancel');
  assert.equal(door.getAttribute('href'), CHRONICLE);
  assert.equal(door.textContent, 'Announced Sep 21');
  assert.equal(door.getAttribute('target'), '_blank');
  assert.equal(card.querySelector('.f-sub .f-when').textContent, 'Cancelled · Sat');
  assert.match(card.querySelector('.f-sub .f-note').textContent, /No replacement/);
  // Every other card's zoom is untouched.
  const shadow = factsFor('DJ Shadow', ctxFor(FID), { day: 'Saturday', stage: 'Crane Stage', time: '6:10 PM - 7:10 PM', weekend: null });
  assert.equal(shadow.cancelled, null);
  assert.equal(shadow.when, '6:10 – 7:10 PM · Sat');
});

test('the zoom with no occurrence (the day image\'s cards) still finds the cancellation', () => {
  state.setActiveFestivalId(FID);
  assert.ok(factsFor('Skepta', ctxFor(FID)).cancelled);
  assert.equal(factsFor('Soulwax', ctxFor(FID)).cancelled, null);
});

test('with no occurrence, a name cancelled on one night but playing another is described by the night it plays', () => {
  const fid = 'split-fest';
  FESTIVAL_INDEX.push({ id: fid, status: 'scheduled' });
  FESTIVALS[fid] = {
    id: fid, name: 'Split Fest', status: 'scheduled', timezone: 'America/Los_Angeles',
    dayMeta: { Saturday: { wd: 'Sat', date: 'Sep 26', iso: '2026-09-26' } },
    artists: [
      { name: 'Both Ways', day: 'Saturday', venue: 'Crane Stage', cancelled: { on: '2026-09-21', source: CHRONICLE } },
      { name: 'Both Ways', day: 'Afters', night: 'Sun', venue: 'The Room', stage: 'Sun · The Room', time: '11 PM' },
      { name: 'Opener', day: 'Saturday' },
    ],
    days: { Saturday: { stages: ['Crane Stage'], artists: [{ name: 'Opener', stage: 'Crane Stage', time: '8:00 PM - 9:00 PM' }] } },
  };
  state.setActiveFestivalId(fid);
  const f = factsFor('Both Ways', ctxFor(fid));
  assert.equal(f.cancelled, null);
  assert.equal(f.when, 'Sun · 11 PM');
  assert.equal(f.where, 'The Room');
  // …while the Saturday card, which knows its occurrence, is the cancelled one.
  const sat = factsFor('Both Ways', ctxFor(fid), events.occOf(FESTIVALS[fid].artists[0]));
  assert.ok(sat.cancelled);
  state.setActiveFestivalId(FID);
});

// ---- the day image -----------------------------------------------------------------
test('the day image marks him (it is the wall you see): after the grid, before the night\'s afters, carrying his occurrence', () => {
  state.setActiveFestivalId(FID);
  const sat = dayArtistsFor('Saturday');
  const i = sat.findIndex((r) => r.name === 'Skepta');
  assert.ok(i > 0);
  assert.equal(sat[i].time, 'Crane Stage · Cancelled');
  assert.deepEqual(sat[i].occ, { day: 'Saturday', stage: null, time: null, weekend: null, date: null, venue: 'Crane Stage' });
  const gridRows = portola.days.Saturday.artists.length;
  assert.equal(i, gridRows, 'right after the festival\'s grid — the festival room\'s last card, as on the wall');
  assert.ok(/^Afters · /.test(sat[i + 1].time), 'then the night\'s sections');
  const card = renderCard(sat[i].name, { ...ctxFor(FID), onOpenNotes: null }, { time: sat[i].time, occ: sat[i].occ });
  assert.ok(card.classList.contains('cancelled'));
  // Every other row is exactly what it was: a name and a time, no occurrence.
  assert.deepEqual(Object.keys(sat[0]), ['name', 'time']);
});

// ---- the playlist --------------------------------------------------------------------
test('a playlist made from picks skips a cancelled act — the Make button and the crew top-up read one list', async () => {
  globalThis.sessionStorage = globalThis.sessionStorage || { ...globalThis.localStorage };
  const spotify = await import('../js/spotify.js');
  const picks = model.picksFor(state.crewDoc, FID);
  const skip = events.cancelledNames(portola);
  assert.deepEqual(spotify.playlistArtistsFromPicks(picks, { skip }), ['DJ Shadow'], 'Skepta\'s two musts do not put his tracks first — or in at all');
  assert.deepEqual(spotify.playlistArtistsFromPicks(picks, { me: 'Drew', skip }), [], '"Just mine" for someone whose only pick is off');
  // Without the skip, the order is the one it always was: musts lead.
  assert.deepEqual(spotify.playlistArtistsFromPicks(picks), ['Skepta', 'DJ Shadow']);
  assert.deepEqual(spotify.playlistArtistsFromPicks(picks, { me: 'Kevin' }), ['DJ Shadow']);
});
