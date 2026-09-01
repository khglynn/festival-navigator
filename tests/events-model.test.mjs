// The events model (js/v3/events.js — MODEL-V3, 2026-09-01), pure: how an
// entry says its night and venue, the clock events run on, the layout rule
// and the consistency law against the REAL festival files, the day axis
// (grid days ∪ nights), a night's timetable (lanes, the deck, the run), the
// run's locked copy, and the bucket filter's persistence.
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
const filters = await import('../js/v3/filters.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (id) => JSON.parse(readFileSync(join(ROOT, `data/festivals/${id}.json`), 'utf8'));
const portola = load('portola-2026');
const lostlands = load('lost-lands-2026');
const groupsOf = (fest) => groupByDay(fest.artists || [], knownDaysOf(fest));
const modelOf = (fest) => ev.eventModelOf(fest, groupsOf(fest), { gridDays: Object.keys(fest.days || {}) });

// ---- reading an entry -----------------------------------------------------------

test('nightOf / venueOf: the structured pair wins, the stage string is the fallback, and the vocabulary is strict', () => {
  assert.equal(ev.nightOf({ night: 'Sun', stage: 'Sat · X' }), 'Sun', 'data beats the string');
  assert.equal(ev.nightOf({ stage: 'Thu · Regency Ballroom' }), 'Thu');
  assert.equal(ev.nightOf({ stage: 'Thursday · Regency Ballroom' }), null, 'the validator vocabulary is Mon…Sun');
  assert.equal(ev.nightOf({ stage: 'Pier Stage' }), null);
  assert.equal(ev.nightOf({ night: 'sun' }), null);
  assert.equal(ev.venueOf({ venue: 'The Midway', stage: 'Sun · Elsewhere' }), 'The Midway');
  assert.equal(ev.venueOf({ stage: 'Sun · The Midway · Room 2' }), 'The Midway · Room 2');
  assert.equal(ev.venueOf({}), null);
  assert.deepEqual(ev.occOf({ name: 'A', day: 'Afters', night: 'Sun', venue: 'V', time: '10 PM' }),
    { day: 'Afters', stage: 'Sun · V', time: '10 PM', weekend: null }, 'a file with only the pair still yields the stage shape the zoom reads');
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
});

// ---- the layout rule against the real files ----------------------------------------

test('the rule on Portola: Friday and Sunday afters EARN columns, Thursday and Saturday do not; Folsom never does', () => {
  const m = modelOf(portola);
  assert.ok(m.dayFirst);
  const afters = m.sections.find((s) => s.key === 'Afters');
  const folsom = m.sections.find((s) => s.key === 'Folsom');
  const earns = (s, n) => ev.earnsColumns(s.byNight.get(n) || []).earns;
  assert.deepEqual(['Thu', 'Fri', 'Sat', 'Sun'].map((n) => earns(afters, n)), [false, true, false, true]);
  const fri = ev.earnsColumns(afters.byNight.get('Fri'));
  assert.ok(fri.E >= 5 && fri.R >= 1.5 && fri.T >= 0.6, `Friday: ${fri.E} timed shows over ${fri.V} venues, ${Math.round(fri.T * 100)}% timed`);
  assert.deepEqual(['Fri', 'Sat', 'Sun'].map((n) => earns(folsom, n)), [false, false, false], 'Folsom: roughly one show per venue');
});

test('the consistency law: AFTERS is columns ALL WEEK (Thursday and Saturday included), FOLSOM is tiles all week', () => {
  const m = modelOf(portola);
  assert.equal(m.sections.find((s) => s.key === 'Afters').mode, 'columns');
  assert.equal(m.sections.find((s) => s.key === 'Folsom').mode, 'tiles');
  assert.equal(ev.sectionModeOf(new Map([['Thu', portola.artists.filter((a) => a.night === 'Thu')]])), 'tiles', 'Thursday alone would be tiles — the law is what makes it columns');
});

test('Lost Lands WED: one venue, no times — the rule\'s floor is tiles, and the fest is not day-first at all (no section carries a night)', () => {
  const wed = lostlands.artists.filter((a) => a.day === 'Wednesday, Sept 16 (Early Arrival Pre-Party)');
  assert.ok(wed.length > 0);
  assert.deepEqual(ev.earnsColumns(wed), { earns: false, E: 0, V: 0, R: 0, T: 0 });
  const m = modelOf(lostlands);
  assert.equal(m.dayFirst, false);
  assert.match(m.why, /no section entry carries a night/);
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
  assert.deepEqual(m.days.map((d) => d.wd), ['Thu', 'Fri', 'Sat', 'Sun']);
  assert.deepEqual(m.days.map((d) => d.grid), [false, false, true, true]);
  assert.deepEqual(m.days.map((d) => d.synthetic), [true, true, false, false]);
  assert.deepEqual(m.days.map((d) => d.iso), ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'], 'Thursday borrows its date from Saturday\'s iso');
  assert.deepEqual(m.days.map((d) => d.sub), ['Thu · Sep 24', 'Fri · Sep 25', 'Sat · Sep 26', 'Sun · Sep 27']);
  assert.deepEqual(m.days.map((d) => [d.short, d.long]), [['THU', 'THU'], ['FRI', 'FRI'], ['SAT', 'SAT'], ['SUN', 'SUN']]);
  assert.deepEqual(m.sections.map((s) => [s.key, s.label, s.mode]), [['Afters', 'Afters', 'columns'], ['Folsom', 'Folsom', 'tiles']], 'known-day order');
  const afters = m.sections[0];
  assert.deepEqual([...afters.byDay.keys()], ['Thursday', 'Friday', 'Saturday', 'Sunday']);
  assert.deepEqual([...afters.byDay.values()].map((l) => l.length), [2, 12, 9, 15], 'Friday: eleven Afters entries plus Horse Meat Disco (Afters & Folsom)');
  assert.deepEqual([...m.sections[1].byDay].map(([k, l]) => [k, l.length]), [['Friday', 2], ['Saturday', 2], ['Sunday', 4]]);
  assert.deepEqual(afters.loose, [], 'every Portola event says its night');
  assert.deepEqual(ev.bucketsOf(portola, m).map((b) => [b.key, b.label]), [[':fest', 'Portola'], ['Afters', 'Afters'], ['Folsom', 'Folsom']]);
});

test('eventModelOf refuses politely when the days have no common axis, and says why', () => {
  const sec = { name: 'X', day: 'Afters', stage: 'Fri · V', time: '10 PM' };
  const noAxis = ev.eventModelOf({ artists: [{ name: 'A', day: 'Day 1' }, sec] }, groupByDay([{ name: 'A', day: 'Day 1' }, sec], ['Day 1', 'Afters']), { gridDays: [] });
  assert.equal(noAxis.dayFirst, false);
  assert.match(noAxis.why, /"Day 1" does not name a weekday/);
  const twoFridays = [{ name: 'A', day: 'Friday' }, { name: 'B', day: 'Friday, Oct 3 (pre-party)' }, sec];
  const clash = ev.eventModelOf({ artists: twoFridays }, groupByDay(twoFridays, ['Friday', 'Friday, Oct 3 (pre-party)', 'Afters']), { gridDays: [] });
  assert.equal(clash.dayFirst, false);
  assert.match(clash.why, /share Fri/);
  // A section whose entries never say a night is not a section at all — a
  // plain day group — so a lineup fest with only those stays as it is.
  const plain = [{ name: 'A', day: 'Friday' }, { name: 'B', day: 'Afters', stage: 'The Club', time: '10 PM' }];
  assert.equal(ev.eventModelOf({ artists: plain }, groupByDay(plain, ['Friday', 'Afters']), { gridDays: [] }).dayFirst, false);
});

test('eventModelOf: a two-weekend fest borrows the CHOSEN weekend\'s date, and a night-less section entry falls to the section\'s loose list', () => {
  const fest = {
    dayMeta: { Friday: { wd: 'Fri', isos: { W1: '2026-10-02', W2: '2026-10-09' } } },
    days: { Friday: { stages: ['A'], artists: [] } },
    artists: [
      { name: 'A', day: 'Friday' },
      { name: 'After1', day: 'Afters', stage: 'Thu · V', time: '10 PM' },
      { name: 'Lost', day: 'Afters', stage: 'V', time: '10 PM' },
    ],
  };
  const groups = groupByDay(fest.artists, ['Friday', 'Afters']);
  const w2 = ev.eventModelOf(fest, groups, { gridDays: ['Friday'], weekend: 'W2' });
  assert.deepEqual(w2.days.map((d) => [d.key, d.iso]), [['Thursday', '2026-10-08'], ['Friday', '2026-10-09']]);
  assert.deepEqual(w2.sections[0].loose.map((a) => a.name), ['Lost']);
  const w1 = ev.eventModelOf(fest, groups, { gridDays: ['Friday'], weekend: 'W1' });
  assert.equal(w1.days[0].iso, '2026-10-01');
});

// ---- a night's timetable ----------------------------------------------------------------

const aftersOn = (night) => portola.artists.filter((a) => a.day === 'Afters' || a.day === 'Afters & Folsom').filter((a) => a.night === night);

test('timetableOf, Portola Friday: venues left to right by first set, a DECK for the Regency three, lanes for Monarch\'s two', () => {
  const tt = ev.timetableOf(aftersOn('Fri'));
  assert.equal(tt.venues[0], 'Pier 80 (loyalty invite)', 'Despacio at 5 PM opens the night');
  assert.equal(tt.venues[1], 'Regency Ballroom');
  assert.deepEqual(tt.tba, []);
  const decks = tt.cells.filter((c) => c.kind === 'deck');
  assert.equal(decks.length, 1);
  assert.equal(decks[0].venue, 'Regency Ballroom');
  assert.deepEqual(decks[0].items.map((i) => i.e.name), ['Channel Tres', 'Jyoty', 'Gelli Haha'], 'earliest first, ties in file order');
  assert.equal(decks[0].span, 4, 'three open-ended 8 PM shows: one hour, four rows');
  const monarch = tt.cells.filter((c) => c.kind === 'card' && c.venue === 'Monarch');
  assert.equal(monarch.length, 2);
  assert.ok(monarch.every((c) => c.lane && c.lane.lanes === 2), 'two simultaneous sets still lane-split');
  const despacio = tt.cells.find((c) => c.kind === 'card' && c.entry.e.name === 'Despacio');
  assert.equal(despacio.span, 24, '5–11 PM');
  assert.equal(despacio.lane, null);
});

test('timetableOf, Portola Sunday: the Midway run is a plain vertical column — no lanes, no deck, the last set ends at the close; Public Works is a deck', () => {
  const tt = ev.timetableOf(aftersOn('Sun'));
  const run = tt.cells.filter((c) => c.kind === 'card' && c.venue === 'The Midway');
  const members = portola.artists.filter((a) => a.night === 'Sun' && a.venue === 'The Midway');
  assert.equal(run.length, members.length, 'every run member is its own cell');
  assert.ok(run.every((c) => c.lane === null), 'never lanes');
  assert.ok(!tt.cells.some((c) => c.kind === 'deck' && c.venue === 'The Midway'), 'never a deck');
  const bySeq = [...run].sort((a, b) => a.entry.e.order.seq - b.entry.e.order.seq);
  for (let i = 1; i < bySeq.length; i++) {
    assert.equal(bySeq[i - 1].entry.endMin, bySeq[i].entry.startMin, 'a member ends when the next begins');
    assert.ok(bySeq[i].row > bySeq[i - 1].row);
  }
  const last = bySeq[bySeq.length - 1].entry;
  assert.equal(last.endMin, ev.parseEventTime(last.e.close).startMin, 'the closer ends at the room\'s close');
  assert.equal(last.endStr, last.e.close);
  const pw = tt.cells.find((c) => c.kind === 'deck' && c.venue === 'Public Works');
  assert.ok(pw, 'three 10 PM – 2 AM sets at Public Works are a deck');
  assert.equal(pw.span, 16);
  assert.deepEqual(tt.tba.map((a) => a.name), ['Azzecca']);
});

test('timetableOf: a pile that holds a run member never decks or lanes — even three deep', () => {
  const src = 'https://example.test/poster';
  const list = [
    { name: 'A', night: 'Sun', venue: 'V', time: '10 PM', order: { seq: 1, of: 2, source: src, confirmed: false } },
    { name: 'B', night: 'Sun', venue: 'V', time: '10:10 PM', order: { seq: 2, of: 2, source: src, confirmed: false } },
    { name: 'C', night: 'Sun', venue: 'V', time: '10 PM' },
  ];
  const tt = ev.timetableOf(list);
  assert.equal(tt.cells.filter((c) => c.kind === 'deck').length, 0);
  assert.ok(tt.cells.every((c) => c.lane === null));
  // …and a plain pile of three still decks, a pile of two still lanes.
  const three = ev.timetableOf(list.map(({ order, ...rest }) => rest));
  assert.equal(three.cells.filter((c) => c.kind === 'deck').length, 1);
  const two = ev.timetableOf(list.slice(1).map(({ order, ...rest }) => rest));
  assert.ok(two.cells.every((c) => c.lane && c.lane.lanes === 2));
});

test('sortForTiles: time first, the timeless at the end, ties in file order — the Street Fair opens Sunday', () => {
  const sun = portola.artists.filter((a) => a.day === 'Folsom' && a.night === 'Sun');
  assert.equal(ev.sortForTiles(sun)[0].name, 'Folsom Street Fair');
  const mixed = [{ name: 'Late', time: '11 PM' }, { name: 'None' }, { name: 'Early', time: '8 PM' }, { name: 'None2' }];
  assert.deepEqual(ev.sortForTiles(mixed).map((e) => e.name), ['Early', 'Late', 'None', 'None2']);
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

// ---- the bucket filter's persistence --------------------------------------------------------

test('hidden buckets persist per fest in localStorage, toggle cleanly, and survive a blocked store in memory', () => {
  store.clear();
  assert.deepEqual(filters.loadHiddenBuckets('f1'), []);
  filters.saveHiddenBuckets('f1', ['Folsom']);
  assert.equal(store.get('fn_buckets_v1_f1'), '["Folsom"]', 'device-local, keyed per fest — never the crew doc');
  assert.deepEqual(filters.loadHiddenBuckets('f1'), ['Folsom']);
  assert.deepEqual(filters.loadHiddenBuckets('f2'), [], 'another fest is untouched');
  assert.deepEqual(filters.toggleBucket(['Folsom'], ':fest'), ['Folsom', ':fest']);
  assert.deepEqual(filters.toggleBucket(['Folsom', ':fest'], 'Folsom'), [':fest']);
  filters.saveHiddenBuckets('f1', []);
  assert.equal(store.has('fn_buckets_v1_f1'), false, 'nothing hidden = nothing stored');
  store.set('fn_buckets_v1_f3', '{"not":"a list"}');
  assert.deepEqual(filters.loadHiddenBuckets('f3'), [], 'garbage reads as nothing hidden');
  // A write that fails against a store that still READS (storage full):
  // memory wins until a write lands — the old stored value must not come
  // back on the next read (Codex, review round 2026-09-01).
  store.set('fn_buckets_v1_f5', '["Folsom"]');
  assert.deepEqual(filters.loadHiddenBuckets('f5'), ['Folsom']);
  const fullSet = globalThis.localStorage.setItem;
  const quiet = console.warn;
  console.warn = () => {};
  globalThis.localStorage.setItem = () => { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); };
  try {
    filters.saveHiddenBuckets('f5', ['Folsom', 'Afters']);
    assert.deepEqual(filters.loadHiddenBuckets('f5'), ['Folsom', 'Afters'], 'the write failed — memory is newer than storage and wins');
  } finally { globalThis.localStorage.setItem = fullSet; console.warn = quiet; }
  filters.saveHiddenBuckets('f5', ['Afters']);
  assert.equal(store.get('fn_buckets_v1_f5'), '["Afters"]', 'a write that lands re-arms storage');
  store.set('fn_buckets_v1_f5', '["Folsom"]');
  assert.deepEqual(filters.loadHiddenBuckets('f5'), ['Folsom'], 'and storage is read again');
  // Two taps in a row apply at once — the second reads the first.
  store.clear();
  const t1 = filters.applyBucketToggle('f6', filters.loadHiddenBuckets('f6'), 'Folsom');
  assert.deepEqual(t1, { next: ['Folsom'], hiding: true });
  const t2 = filters.applyBucketToggle('f6', filters.loadHiddenBuckets('f6'), 'Afters');
  assert.deepEqual(t2, { next: ['Folsom', 'Afters'], hiding: true });
  assert.equal(store.get('fn_buckets_v1_f6'), '["Folsom","Afters"]', 'nothing was lost between the taps');
  assert.deepEqual(filters.applyBucketToggle('f6', filters.loadHiddenBuckets('f6'), 'Folsom'), { next: ['Afters'], hiding: false });
  // Blocked store: memory is the truth for the life of the page. (util.saveLS
  // warns on a failed write — expected here, kept out of the test output.)
  const real = globalThis.localStorage;
  const warn = console.warn;
  const denied = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
  globalThis.localStorage = { getItem: denied, setItem: denied, removeItem: denied };
  console.warn = () => {};
  try {
    assert.doesNotThrow(() => filters.saveHiddenBuckets('f4', ['Afters']));
    assert.deepEqual(filters.loadHiddenBuckets('f4'), ['Afters'], 'a blocked store cannot make a chip tap do nothing');
  } finally { globalThis.localStorage = real; console.warn = warn; }
});

// ---- the review round (2026-09-01): the model -------------------------------------------

test('a transitive overlap chain is lanes, not a deck — the deck needs PEAK concurrency of three', () => {
  const V = (name, time) => ({ name, night: 'Fri', venue: 'V', time });
  // One long set bridging two shorter ones that never overlap each other.
  const bridge = ev.timetableOf([V('Long', '8 PM - 11 PM'), V('Early', '8 PM - 9 PM'), V('Late', '10 PM - 11 PM')]);
  assert.equal(bridge.cells.filter((c) => c.kind === 'deck').length, 0, 'never simultaneous three-deep');
  assert.ok(bridge.cells.every((c) => c.lane && c.lane.lanes === 2), 'two lanes, the long set in one');
  // Three at once, with a fourth chained onto the pile: a deck of four.
  const pile = ev.timetableOf([V('A', '8 PM - 10 PM'), V('B', '8 PM - 9 PM'), V('C', '8 PM - 9 PM'), V('D', '9:30 PM - 10:30 PM')]);
  const decks = pile.cells.filter((c) => c.kind === 'deck');
  assert.equal(decks.length, 1);
  assert.deepEqual(decks[0].items.map((i) => i.e.name), ['A', 'B', 'C', 'D']);
  // Three open-ended at one hour still deck (the shipping case).
  assert.equal(ev.timetableOf([V('A', '8 PM'), V('B', '8 PM'), V('C', '8 PM')]).cells.filter((c) => c.kind === 'deck').length, 1);
});

test('a partly-entered run: only the closer runs to the close; a member whose successor is missing draws the hour', () => {
  const src = 'https://example.test/poster';
  const M = (name, time, seq, of) => ({ name, night: 'Sun', venue: 'V', time, approx: true, doors: '10 PM', close: '2 AM', order: { seq, of, source: src, confirmed: false } });
  const three = ev.timetableOf([M('One', '10 PM', 1, 4), M('Three', '12 AM', 3, 4), M('Four', '1 AM', 4, 4)]);
  const at = (name) => three.cells.find((c) => c.entry && c.entry.e.name === name).entry;
  assert.equal(at('One').endMin, at('One').startMin + 60, 'its successor (2 of 4) is not entered — one hour, not the night');
  assert.equal(at('Three').endMin, at('Four').startMin, 'its successor is present — ends when it begins');
  assert.equal(at('Four').endMin, ev.parseEventTime('2 AM').startMin, 'the closer runs to the close');
  assert.equal(at('Four').endStr, '2 AM');
  const noCloser = ev.timetableOf([M('One', '10 PM', 1, 3), M('Two', '11 PM', 2, 3)]);
  const two = noCloser.cells.find((c) => c.entry && c.entry.e.name === 'Two').entry;
  assert.equal(two.endMin, two.startMin + 60, 'the last KNOWN member is not the closer — it does not claim the room to 2 AM');
  assert.equal(two.endStr, null);
});

test('an event with a time but no venue keeps its time: it is loose, never timeless', () => {
  const tt = ev.timetableOf([
    { name: 'Roomed', night: 'Fri', venue: 'V', time: '10 PM' },
    { name: 'Roomless', night: 'Fri', time: '9 PM' },
    { name: 'Timeless', night: 'Fri', venue: 'V' },
  ]);
  assert.deepEqual(tt.loose.map((e) => e.name), ['Roomless']);
  assert.deepEqual(tt.tba.map((e) => e.name), ['Timeless']);
  assert.deepEqual(tt.cells.map((c) => c.entry.e.name), ['Roomed']);
  const none = ev.timetableOf([{ name: 'Roomless', night: 'Fri', time: '9 PM' }]);
  assert.deepEqual([none.venues, none.loose.map((e) => e.name), none.tba], [[], ['Roomless'], []]);
});
