// The events model (js/v3/events.js — MODEL-V4, 2026-09-16), pure: how an
// entry says its night, its date and its venue, the clock events run on, the
// venue groups a night divides into (the ONE list renderer's model — order
// inside a group, order of groups, the doors line, the now window), the day
// axis (grid days ∪ nights, and six dated tabs for a two-weekend fest), the
// tabs that hang off the end, and the run's locked copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const ev = await import('../js/v3/events.js');
const { groupByDay, knownDaysOf } = await import('../js/v3/wall.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (id) => JSON.parse(readFileSync(join(ROOT, `data/festivals/${id}.json`), 'utf8'));
const portola = load('portola-2026');
const groupsOf = (fest) => groupByDay(fest.artists || [], knownDaysOf(fest));
const modelOf = (fest, over = {}) => ev.eventModelOf(fest, groupsOf(fest), { gridDays: Object.keys(fest.days || {}), ...over });

// ---- reading an entry -----------------------------------------------------------

test('nightOf / dateOf / venueOf: the structured pair wins, the stage string is the fallback, and the vocabulary is strict', () => {
  assert.equal(ev.nightOf({ night: 'Sun', stage: 'Sat · X' }), 'Sun', 'data beats the string');
  assert.equal(ev.nightOf({ stage: 'Thu · Regency Ballroom' }), 'Thu');
  assert.equal(ev.nightOf({ stage: 'Thursday · Regency Ballroom' }), null, 'the validator vocabulary is Mon…Sun');
  assert.equal(ev.nightOf({ stage: 'Pier Stage' }), null);
  assert.equal(ev.nightOf({ night: 'sun' }), null);
  assert.equal(ev.dateOf({ date: '2026-09-29' }), '2026-09-29');
  assert.equal(ev.dateOf({ date: 'Sep 29' }), null, 'a dated section entry carries an ISO date, not a label');
  assert.equal(ev.dateOf({}), null);
  assert.equal(ev.venueOf({ venue: 'The Midway', stage: 'Sun · Elsewhere' }), 'The Midway');
  assert.equal(ev.venueOf({ stage: 'Sun · The Midway · Room 2' }), 'The Midway · Room 2');
  assert.equal(ev.venueOf({}), null);
  assert.deepEqual(ev.occOf({ name: 'A', day: 'Afters', night: 'Sun', venue: 'V', time: '10 PM' }),
    { day: 'Afters', stage: 'Sun · V', time: '10 PM', weekend: null, date: null, venue: 'V' },
    'a file with only the pair still yields the stage shape the zoom reads, and the pair rides along');
  assert.deepEqual(ev.occOf({ name: 'A', day: 'Late nights', date: '2026-10-01', venue: 'Stubb’s' }),
    { day: 'Late nights', stage: null, time: null, weekend: null, date: '2026-10-01', venue: 'Stubb’s' },
    'a dated show has no stage string at all — the date and the room ARE its identity');
});

test('parseEventTime runs on the festival-day axis: AM after midnight, but a late morning is a morning', () => {
  assert.deepEqual(ev.parseEventTime('10 PM'), { startMin: 22 * 60, endMin: null, startStr: '10 PM', endStr: null });
  assert.deepEqual(ev.parseEventTime('10 PM - 2 AM'), { startMin: 22 * 60, endMin: 26 * 60, startStr: '10 PM', endStr: '2 AM' });
  assert.equal(ev.parseEventTime('11 AM - 6 PM').startMin, 11 * 60, 'the Folsom Street Fair is a daytime event');
  assert.equal(ev.parseEventTime('12 AM').startMin, 24 * 60, 'midnight is the end of the night, not its start');
  assert.deepEqual(ev.parseEventTime('11 PM - Close').endMin, null, '"Close" is open-ended');
  assert.equal(ev.parseEventTime('soon'), null);
  assert.equal(ev.parseEventTime(undefined), null);
  assert.equal(ev.hourLabelOf(26 * 60), '2 AM');
  assert.equal(ev.hourLabelOf(12 * 60), '12 PM');
  assert.equal(ev.dateRuleLabel('2026-09-29'), 'TUE · SEP 29');
  assert.equal(ev.dateRuleLabel('nope'), 'NOPE');
});

// ---- the list: venue groups (MODEL-V4 §1.2) ---------------------------------------

const V = (name, over = {}) => ({ name, night: 'Fri', venue: 'V', ...over });

test('venueGroupsOf, order INSIDE a group: the numbering leads when every member carries one, else the clock, else file order', () => {
  const src = 'https://example.test/poster';
  const run = ev.venueGroupsOf([
    V('Closer', { time: '12 AM', order: { seq: 3, of: 3, source: src, confirmed: false } }),
    V('Opener', { time: '10 PM', order: { seq: 1, of: 3, source: src, confirmed: false } }),
    V('Middle', { time: '11 PM', order: { seq: 2, of: 3, source: src, confirmed: false } }),
  ]);
  assert.deepEqual(run[0].members.map((m) => m.e.name), ['Opener', 'Middle', 'Closer'], 'a run reads top to bottom as the night plays');
  // A HALF-numbered room has no run to read, so the clock leads.
  const half = ev.venueGroupsOf([
    V('Late', { time: '11 PM', order: { seq: 1, of: 2, source: src, confirmed: false } }),
    V('Early', { time: '10 PM' }),
  ]);
  assert.deepEqual(half[0].members.map((m) => m.e.name), ['Early', 'Late']);
  // No clock anywhere: file order, because nothing else says otherwise.
  const bare = ev.venueGroupsOf([V('B'), V('A')]);
  assert.deepEqual(bare[0].members.map((m) => m.e.name), ['B', 'A']);
  // A timeless member in a timed room goes last.
  const mixed = ev.venueGroupsOf([V('None'), V('Late', { time: '11 PM' }), V('Early', { time: '9 PM' })]);
  assert.deepEqual(mixed[0].members.map((m) => m.e.name), ['Early', 'Late', 'None']);
});

test('venueGroupsOf, order OF groups: doors first, the bigger stack leads a tie, the timeless last', () => {
  const g = ev.venueGroupsOf([
    { name: 'Nowhere', night: 'Fri', venue: 'No clock' },
    { name: 'Late1', night: 'Fri', venue: 'Ten', doors: '10 PM' },
    { name: 'Late2', night: 'Fri', venue: 'Ten', doors: '10 PM' },
    { name: 'AlsoTen', night: 'Fri', venue: 'Ten too', doors: '10 PM' },
    { name: 'Early', night: 'Fri', venue: 'Nine', time: '9 PM' },
  ]);
  assert.deepEqual(g.map((x) => x.venue), ['Nine', 'Ten', 'Ten too', 'No clock']);
  assert.equal(g[3].at, null, 'a group nothing knows a time for sorts last and says so');
  // A show with a time and no room yet keeps its time, under Venue TBA — and
  // takes its place on the clock like every other group. There is no quiet row
  // under the night any more, so there is no special case either.
  const tba = ev.venueGroupsOf([{ name: 'Roomless', night: 'Fri', time: '8 PM' }, V('Roomed', { time: '10 PM' })]);
  assert.deepEqual(tba.map((x) => [x.venue, x.tba]), [[ev.VENUE_TBA, true], ['V', false]]);
  // With no time either, it is a group nothing is known about: last.
  const both = ev.venueGroupsOf([{ name: 'Nothing', night: 'Fri' }, V('Roomed', { time: '10 PM' })]);
  assert.deepEqual(both.map((x) => x.venue), ['V', ev.VENUE_TBA]);
});

test('venueGroupsOf, the sub line: doors and close from any member, the tilde on a guess, nothing invented', () => {
  const doorsAndClose = ev.venueGroupsOf([V('A', { doors: '10 PM' }), V('B', { close: '3 AM', closeApprox: true })]);
  assert.equal(doorsAndClose[0].sub, 'Doors 10 PM · ~3 AM');
  assert.equal(ev.venueGroupsOf([V('A', { doors: '10 PM', close: '2 AM' })])[0].sub, 'Doors 10 PM · 2 AM', 'a posted close wears no tilde');
  assert.equal(ev.venueGroupsOf([V('A', { doors: '9 PM' })])[0].sub, 'Doors 9 PM');
  assert.equal(ev.venueGroupsOf([V('A', { time: '10 PM' })])[0].sub, '', 'neither doors nor close, no sub line');
});

test('venueGroupsOf, the now window: a member runs until the next starts, else to its own end, else the room\'s close', () => {
  const src = 'https://example.test/poster';
  const run = ev.venueGroupsOf([
    V('One', { time: '10 PM', close: '2 AM', order: { seq: 1, of: 2, source: src, confirmed: false } }),
    V('Two', { time: '12 AM', close: '2 AM', order: { seq: 2, of: 2, source: src, confirmed: false } }),
  ])[0];
  assert.deepEqual(run.members.map((m) => [m.nowFrom, m.nowTo]), [[22 * 60, 24 * 60], [24 * 60, 26 * 60]],
    'the opener runs until the closer starts; the closer runs to the room\'s close');
  const ranged = ev.venueGroupsOf([V('Solo', { time: '9 PM - 3 AM' })])[0];
  assert.deepEqual(ranged.members.map((m) => [m.nowFrom, m.nowTo]), [[21 * 60, 27 * 60]]);
  const open = ev.venueGroupsOf([V('Solo', { time: '9 PM' })])[0];
  assert.deepEqual(open.members[0].nowTo, 22 * 60, 'an open-ended set is an hour');
  const doorsOnly = ev.venueGroupsOf([V('Solo', { doors: '10 PM', close: '4 AM' })])[0];
  assert.deepEqual([doorsOnly.members[0].nowFrom, doorsOnly.members[0].nowTo], [22 * 60, 28 * 60],
    'nothing is timed, so the room itself is what is on');
  assert.equal(ev.venueGroupsOf([V('Solo')])[0].members[0].nowFrom, null, 'nothing known, nothing marked');
});

// Sun's Midway, the way the data agent found it (2026-09-24): Tixr bills seven
// in the room with no order or times for three of them. The timed four keep
// their windows; the three untimed are on the bill, time unknown — no window
// (they glowed beside Two Shell all night before), sorted after the timed,
// and their card carries no time. A room where NOTHING is timed still glows
// from doors to close, the lone headliner included.
test('venueGroupsOf, the now window: an untimed act in a timed room is on the bill, time unknown — no window, last in the stack', () => {
  const room = { doors: '10 PM', close: '4 AM' };
  const g = ev.venueGroupsOf([
    V('Untimed A', room),
    V('Opener', { ...room, time: '10 PM' }),
    V('Untimed B', room),
    V('Closer', { ...room, time: '12 AM' }),
  ])[0];
  assert.deepEqual(g.members.map((m) => m.e.name), ['Opener', 'Closer', 'Untimed A', 'Untimed B'], 'timed in play order, then the untimed, in bill order');
  assert.deepEqual(g.members.map((m) => [m.nowFrom, m.nowTo]), [[22 * 60, 24 * 60], [24 * 60, 28 * 60], [null, null], [null, null]],
    'the timed run as ever; the untimed never glow');
  assert.deepEqual(g.members.map((m) => m.startStr), ['10 PM', '12 AM', null, null], 'and their cards show no time');
  const nothingTimed = ev.venueGroupsOf([V('Headliner', room), V('Support', room)])[0];
  assert.deepEqual(nothingTimed.members.map((m) => [m.nowFrom, m.nowTo]), [[22 * 60, 28 * 60], [22 * 60, 28 * 60]],
    'nothing in the room is timed: the room is what is on');
});

test('venueGroupsOf on Portola Friday: the real bill, read off the file so a re-read of any venue moves this', () => {
  const fri = portola.artists.filter((a) => /Afters/.test(a.day) && a.night === 'Fri');
  const groups = ev.venueGroupsOf(fri);
  assert.deepEqual([...groups].map((g) => g.members.length).reduce((a, b) => a + b, 0), fri.length, 'every show is in exactly one group');
  // The first column is whichever room opens earliest — Despacio's printed
  // 5 PM set on Friday, unless a re-read moves it.
  const opensAt = (g) => g.at;
  assert.deepEqual(groups.map(opensAt), [...groups.map(opensAt)].sort((a, b) => (a == null ? 1 : b == null ? -1 : a - b)),
    'groups are in opening order');
  const regency = groups.find((g) => g.venue === 'Regency Ballroom');
  const file = fri.filter((a) => a.venue === 'Regency Ballroom').sort((a, b) => a.order.seq - b.order.seq);
  assert.deepEqual(regency.members.map((m) => m.e.name), file.map((a) => a.name), 'the Regency run, in its numbered order');
  assert.equal(regency.sub, `Doors ${file[0].doors} · ~${file[0].close}`, 'its window, the tilde on the guessed close');
  assert.ok(regency.members.every((m) => m.approx), 'every Regency clock is a guess, so every card wears the tilde');
});

// ---- the day axis ------------------------------------------------------------------

test('day order: up to three days before the anchor read as before, the rest follow', () => {
  const order = (wds, anchor) => [...wds].sort((a, b) => ev.dayOrderKey(a, anchor) - ev.dayOrderKey(b, anchor));
  assert.deepEqual(order(['Sun', 'Sat', 'Thu', 'Fri'], 'Sat'), ['Thu', 'Fri', 'Sat', 'Sun'], 'Portola');
  assert.deepEqual(order(['Wed', 'Fri', 'Sat', 'Sun'], 'Fri'), ['Wed', 'Fri', 'Sat', 'Sun'], 'a pre-party');
  assert.deepEqual(order(['Mon', 'Fri', 'Sat', 'Sun'], 'Fri'), ['Fri', 'Sat', 'Sun', 'Mon'], 'a Monday afterparty lands after Sunday');
  assert.deepEqual(order(['Tue', 'Fri'], 'Fri'), ['Tue', 'Fri']);
});

test('eventModelOf on Portola: THU FRI SAT SUN, the grid days keep their keys, the nights mint new ones with borrowed dates', () => {
  const m = modelOf(portola);
  assert.deepEqual(m.days.map((d) => d.key), ['Thursday', 'Friday', 'Saturday', 'Sunday']);
  assert.deepEqual(m.days.map((d) => d.dayKey), ['Thursday', 'Friday', 'Saturday', 'Sunday'], 'the tab id IS the frozen day key on a one-weekend fest');
  assert.deepEqual(m.days.map((d) => d.wd), ['Thu', 'Fri', 'Sat', 'Sun']);
  assert.deepEqual(m.days.map((d) => d.grid), [false, false, true, true]);
  assert.deepEqual(m.days.map((d) => d.synthetic), [true, true, false, false]);
  assert.deepEqual(m.days.map((d) => d.iso), ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'], 'Thursday borrows its date from Saturday\'s iso');
  assert.deepEqual(m.days.map((d) => d.sub), ['Thu · Sep 24', 'Fri · Sep 25', 'Sat · Sep 26', 'Sun · Sep 27']);
  // `when` is the same line without its weekday: what a day's first room head
  // says after the weekday its own label already shows ("SAT PORTOLA  Sep 26").
  assert.deepEqual(m.days.map((d) => d.when), ['Sep 24', 'Sep 25', 'Sep 26', 'Sep 27']);
  assert.deepEqual(m.days.map((d) => [d.short, d.long, d.num]), [['THU', 'THU', null], ['FRI', 'FRI', null], ['SAT', 'SAT', null], ['SUN', 'SUN', null]]);
  assert.deepEqual(m.sections.map((s) => [s.key, s.label]), [['Afters', 'Afters'], ['Folsom', 'Folsom']], 'known-day order');
  assert.deepEqual(m.extras, [], 'every Portola event says its night, so nothing hangs off the end');
  const afters = m.sections[0];
  assert.deepEqual([...afters.byDay.keys()], ['Thursday', 'Friday', 'Saturday', 'Sunday']);
  assert.deepEqual([...afters.byDay.values()].map((l) => l.length), [7, 21, 15, 25],
    'Friday: twenty Afters entries plus Horse Meat Disco (Afters & Folsom); the 2026-09-23 pass added The Hellp & Bassvictim (Fri), Boys Noize (Sat) and the billed support acts; 2026-09-24 added Club Six\'s three (Thu), 2026-09-25 the Midway\'s three (Sun)');
  assert.deepEqual([...m.sections[1].byDay].map(([k, l]) => [k, l.length]), [['Friday', 20], ['Saturday', 24], ['Sunday', 21]],
    'Folsom: 2026-09-25 added MÜLL (Fri), Big Muscle and Aftershock (Sat — its 3 AM is the small hours of Sunday, filed under Saturday night), then every verified Folsom-weekend party whose room it has to itself: 13 Fri, 11 Sat, 12 Sun (NOCTURNAL EXTREME, Mon 3 AM, is Sunday night); then, once Folsom read by time (v94) and each party became its own show, the 18 that share a venue on a night: 4 Fri, 9 Sat, 5 Sun');
  assert.deepEqual(afters.loose, [], 'every Portola event says its night');
});

test('a dated section is its own tab, never a day: one entry per date, in date order', () => {
  const fest = {
    name: 'Dated', dayMeta: { Friday: { wd: 'Fri', date: 'Oct 2', iso: '2026-10-02' }, 'Late nights': { date: 'Sep 29 – Oct 10', sub: 'around Austin' } },
    days: { Friday: { stages: ['A'], artists: [] } },
    artists: [
      { name: 'Billed', day: 'Friday' },
      { name: 'Later', day: 'Late nights', date: '2026-10-01', venue: 'Stubb\'s', doors: '7 PM' },
      { name: 'First', day: 'Late nights', date: '2026-09-29', venue: 'Mohawk Austin', doors: '7 PM' },
    ],
  };
  const m = ev.eventModelOf(fest, groupByDay(fest.artists, ['Friday', 'Late nights']), { gridDays: ['Friday'] });
  assert.deepEqual(m.days.map((d) => d.key), ['Friday'], 'the dated section never joins the day axis');
  assert.deepEqual(m.sections, []);
  assert.deepEqual(m.extras.map((e) => [e.key, e.short, e.long, e.sub]),
    [['Late nights', 'LATE', 'LATE NIGHTS', 'Sep 29 – Oct 10 · around Austin']]);
  assert.deepEqual([...m.extras[0].byDate.keys()], ['2026-09-29', '2026-10-01'], 'in date order, never split');
  assert.deepEqual([...m.extras[0].byDate.values()].map((l) => l.map((a) => a.name)), [['First'], ['Later']]);
});

test('a two-weekend scheduled fest is six dated tabs: each renders its own weekend, and the rule says which', () => {
  const fest = load('acl-2026');
  const m = modelOf(fest, { weekends: ['W1', 'W2'] });
  assert.deepEqual(m.days.map((d) => d.key),
    ['Friday|W1', 'Saturday|W1', 'Sunday|W1', 'Friday|W2', 'Saturday|W2', 'Sunday|W2']);
  assert.deepEqual(m.days.map((d) => d.dayKey), ['Friday', 'Saturday', 'Sunday', 'Friday', 'Saturday', 'Sunday'],
    'the frozen day key is untouched — pick data and the freeze never move');
  assert.deepEqual(m.days.map((d) => [d.short, d.num]),
    [['FRI', '2'], ['SAT', '3'], ['SUN', '4'], ['FRI', '9'], ['SAT', '10'], ['SUN', '11']]);
  assert.deepEqual(m.days.map((d) => d.iso),
    ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-09', '2026-10-10', '2026-10-11']);
  assert.deepEqual(m.days.map((d) => d.weekend), ['W1', 'W1', 'W1', 'W2', 'W2', 'W2']);
  assert.equal(m.days[0].sub, 'Fri · Oct 2 · Weekend 1');
  assert.equal(m.days[3].sub, 'Fri · Oct 9 · Weekend 2');
  assert.deepEqual([m.days[0].when, m.days[3].when], ['Oct 2 · Weekend 1', 'Oct 9 · Weekend 2'],
    'the first head of each Friday says which one, while scrolling');
});

test('a fest whose days name no weekday keeps its own day order, and its sections become tabs off the end', () => {
  // Electric Forest's "Day 1" is not a weekday, so a night has nothing to land
  // on. The days stay in the file's order; a section, if there ever were one,
  // hangs off the end rather than guessing a night onto a day.
  const ef = load('electric-forest-2026');
  const m = modelOf(ef);
  assert.deepEqual(m.days.map((d) => d.key), ['Day 1', 'Day 2', 'Day 3', 'Day 4']);
  assert.deepEqual(m.days.map((d) => d.grid), [true, true, true, true]);
  assert.deepEqual(m.extras, []);
  const fest = {
    name: 'No axis',
    artists: [{ name: 'A', day: 'Day 1' }, { name: 'X', day: 'Afters', stage: 'Fri · V', time: '10 PM' }],
  };
  const m2 = ev.eventModelOf(fest, groupByDay(fest.artists, ['Day 1', 'Afters']), { gridDays: [] });
  assert.deepEqual(m2.days.map((d) => d.key), ['Day 1']);
  assert.deepEqual(m2.sections, []);
  assert.deepEqual(m2.extras.map((e) => [e.key, e.entries.map((a) => a.name)]), [['Afters', ['X']]]);
});

test('a section entry that never says when is loose — the section still renders, that show waits below', () => {
  const fest = {
    name: 'Loose',
    dayMeta: { Friday: { wd: 'Fri', iso: '2026-10-02' } },
    days: { Friday: { stages: ['A'], artists: [] } },
    artists: [
      { name: 'A', day: 'Friday' },
      { name: 'After1', day: 'Afters', stage: 'Thu · V', time: '10 PM' },
      { name: 'Lost', day: 'Afters', stage: 'V', time: '10 PM' },
    ],
  };
  const m = ev.eventModelOf(fest, groupByDay(fest.artists, ['Friday', 'Afters']), { gridDays: ['Friday'] });
  assert.deepEqual(m.days.map((d) => [d.key, d.iso]), [['Thursday', '2026-10-01'], ['Friday', '2026-10-02']]);
  assert.deepEqual(m.sections[0].loose.map((a) => a.name), ['Lost']);
});

// ---- the run's copy (LOCKED, Kevin 2026-09-01) ----------------------------------------------

test('ordinal', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112].map(ev.ordinal),
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th', '112th']);
});

test('runFactsOf: the window with a tilde on a guessed close, "Guessing they’re 3rd of 4" as a door, the word gone once confirmed', () => {
  const base = { time: '12 AM', approx: true, doors: '10 PM', close: '2 AM', closeApprox: true, order: { seq: 3, of: 4, source: 'https://example.test/poster', confirmed: false } };
  const f = ev.runFactsOf(base);
  assert.equal(f.window, 'Runs 10 PM – ~2 AM');
  assert.equal(f.orderText, 'Guessing they’re 3rd of 4');
  assert.equal(f.orderUrl, 'https://example.test/poster');
  assert.equal(f.approx, true);
  assert.equal(f.confirmed, false);
  const sure = ev.runFactsOf({ ...base, closeApprox: false, order: { ...base.order, confirmed: true } });
  assert.equal(sure.window, 'Runs 10 PM – 2 AM');
  assert.equal(sure.orderText, '3rd of 4', 'the word goes, the door stays');
  assert.equal(ev.runFactsOf({ ...base, close: undefined, closeApprox: undefined }).window, 'Doors 10 PM');
  assert.equal(ev.runFactsOf({ time: '11 PM', approx: true }).window, null, 'a guess with no window keeps the card\'s tilde and nothing else');
  assert.equal(ev.runFactsOf({ ...base, order: { ...base.order, source: 'http://not-https' } }).orderUrl, null, 'no https, no door');
  assert.equal(ev.runFactsOf({ time: '10 PM' }), null);
  assert.equal(ev.runFactsOf(null), null);
});

test('findEventEntry: by day + stage + time, never by name alone — VTSS is a grid billing AND an afters set', () => {
  const afters = portola.artists.find((a) => a.name === 'VTSS' && a.venue === 'The Midway');
  const billing = portola.artists.find((a) => a.name === 'VTSS' && !a.venue);
  assert.ok(afters && billing && afters !== billing, 'precondition: two entries');
  assert.notEqual(portola.artists.find((a) => a.name === 'VTSS'), afters, 'the trap: a name-only lookup returns the wrong row');
  assert.equal(ev.findEventEntry(portola, 'VTSS', ev.occOf(afters)), afters);
  assert.equal(ev.findEventEntry(portola, 'VTSS', { day: 'Sunday', stage: null, time: null }), billing);
  assert.equal(ev.findEventEntry(portola, 'VTSS', null), null);
  assert.equal(ev.findEventEntry(portola, 'Nobody', ev.occOf(afters)), null);
});
