// The events model (js/v3/events.js — MODEL-V3, 2026-09-01), pure: how an
// entry says its night and venue, the clock events run on, the layout rule
// and the consistency law against the REAL festival files, the day axis
// (grid days ∪ nights), a night's timetable (one vertical run per room —
// MODEL-V3 §5's one rule, no lanes and no deck anywhere), the run's locked
// copy, and the bucket filter's persistence.
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

test('the rule on Portola: every afters night but Thursday EARNS columns; Folsom never does', () => {
  const m = modelOf(portola);
  assert.ok(m.dayFirst);
  const afters = m.sections.find((s) => s.key === 'Afters');
  const folsom = m.sections.find((s) => s.key === 'Folsom');
  const earns = (s, n) => ev.earnsColumns(s.byNight.get(n) || []).earns;
  // Saturday joined Friday and Sunday on 2026-09-01: the DoTheBay show pages
  // print doors 10 PM for Audio and Public Works, so its two timeless rooms
  // became timed and the night now clears the rule on its own. Nothing moved
  // on screen — the consistency law already gave Saturday columns.
  assert.deepEqual(['Thu', 'Fri', 'Sat', 'Sun'].map((n) => earns(afters, n)), [false, true, true, true]);
  assert.equal(earns(afters, 'Thu'), false, 'two shows is not a clock');
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
  assert.deepEqual([...afters.byDay.values()].map((l) => l.length), [2, 12, 9, 17],
    'Friday: eleven Afters entries plus Horse Meat Disco (Afters & Folsom); Sunday gained Kaytree and Buck Wilson off the bill');
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

// THE ONE RULE (Kevin, 2026-09-01): a venue-night is one room and its artists
// play in sequence. Every cell is a plain card in a vertical run; the words
// "lane" and "deck" no longer exist in the model, and these tests say so by
// looking for them by shape, not by name.
const noLanesNoDecks = (tt) => {
  assert.ok(tt.cells.every((c) => c.kind === undefined && c.lane === undefined && c.items === undefined),
    'a cell is { venue, col, row, span, entry } — nothing else lays out an events night');
  // Two cards in one column may never share a row band: that IS the stack.
  for (const col of new Set(tt.cells.map((c) => c.col))) {
    const mine = tt.cells.filter((c) => c.col === col).sort((a, b) => a.row - b.row);
    for (let i = 1; i < mine.length; i++) {
      assert.ok(mine[i].row >= mine[i - 1].row + mine[i - 1].span,
        `${mine[i].venue}: "${mine[i].entry.e.name}" overlaps the card above it`);
    }
    assert.ok(mine.every((c) => c.span >= 2), 'every card clears the 30-minute display floor');
  }
};

test('timetableOf, Portola Friday: venues left to right by first set, and every room is a vertical run', () => {
  const tt = ev.timetableOf(aftersOn('Fri'));
  assert.equal(tt.venues[0], 'Pier 80 (loyalty invite)', 'Despacio at 5 PM opens the night');
  assert.equal(tt.venues[1], 'Regency Ballroom');
  assert.deepEqual(tt.tba, []);
  noLanesNoDecks(tt);
  // The Regency's three: one after another, in the run's order, not a pile.
  const regency = tt.cells.filter((c) => c.venue === 'Regency Ballroom').sort((a, b) => a.row - b.row);
  assert.deepEqual(regency.map((c) => c.entry.e.name), ['Gelli Haha', 'Jyoty', 'Channel Tres'], 'small print opens, the billed headliner closes');
  assert.deepEqual(regency.map((c) => c.entry.e.order.seq), [1, 2, 3]);
  assert.ok(regency.every((c) => c.span === 4), 'an hour apart, an hour each — this room prints no close');
  const despacio = tt.cells.find((c) => c.entry.e.name === 'Despacio');
  assert.equal(despacio.span, 24, '5–11 PM, the one set with a printed end');
});

test('timetableOf, Portola Sunday: every room stacks — the Midway four, Public Works four, and the closer runs to the close', () => {
  const tt = ev.timetableOf(aftersOn('Sun'));
  noLanesNoDecks(tt);
  const roomOf = (v) => tt.cells.filter((c) => c.venue === v).sort((a, b) => a.row - b.row);
  const midway = roomOf('The Midway');
  assert.equal(midway.length, portola.artists.filter((a) => a.night === 'Sun' && a.venue === 'The Midway').length,
    'every set is its own tappable card — a combined card would eat the crew\'s picks');
  assert.deepEqual(midway.map((c) => c.entry.e.name), ['MGNA Crrrta', 'VTSS', 'Two Shell', 'horsegiirL']);
  for (let i = 1; i < midway.length; i++) {
    assert.equal(midway[i - 1].entry.endMin, midway[i].entry.startMin, 'a set ends when the next in the room begins');
  }
  const last = midway[midway.length - 1].entry;
  assert.equal(last.endMin, ev.parseEventTime(last.e.close).startMin, 'the closer ends at the room\'s close');
  assert.equal(last.endStr, `~${last.e.close}`, 'a GUESSED close keeps its tilde wherever it prints');
  // Public Works was the deck in the rejected build; it is a run like every
  // other room now, and its three sets are spread across the same window.
  const pw = roomOf('Public Works');
  assert.deepEqual(pw.map((c) => [c.entry.e.name, c.entry.startStr]),
    [['erika b2b sfcowboy', '10 PM'], ['Kaytree', '11 PM'], ['Ben UFO', '12 AM'], ['Overmono', '1 AM']],
    'Kaytree was on the bill and missing from the file — four sets share the room\'s four hours');
  assert.deepEqual(tt.tba.map((a) => a.name), ['Azzecca']);
});

test('the fallback: a room nobody has re-read — every set stamped with the doors time — still stacks, never piles', () => {
  // This is what a fresh data drop looks like before anyone reads the bill:
  // three shows, one venue, one time, no order. The old model called this a
  // deck; the rule says it is a room, so it stacks by the display floor.
  const V = (name, time) => ({ name, night: 'Fri', venue: 'V', time });
  const raw = ev.timetableOf([V('A', '10 PM'), V('B', '10 PM'), V('C', '10 PM')]);
  noLanesNoDecks(raw);
  assert.deepEqual(raw.cells.map((c) => c.entry.e.name), ['A', 'B', 'C'], 'file order, because nothing else says otherwise');
  assert.deepEqual(raw.cells.map((c) => c.row), [1, 3, 5], 'each starts where the one above it ended');
  // Two full-window sets ("10 PM - 2 AM" twice — the room's hours copied onto
  // both) are the same story: one WINDOW, not two four-hour sets, so they
  // halve it. And neither may claim the window's end as its own.
  const win = ev.timetableOf([V('A', '10 PM - 2 AM'), V('B', '10 PM - 2 AM')]);
  noLanesNoDecks(win);
  assert.deepEqual(win.cells.map((c) => c.row), [1, 9]);
  assert.deepEqual(win.cells.map((c) => c.span), [8, 8], 'two even halves of the room\'s four hours');
  assert.ok(win.cells.every((c) => c.entry.endStr === null), 'no card prints "until 2 AM" — none of them can prove it');
  // A HALF-numbered room has no run to read, so the clock leads.
  const src = 'https://example.test/poster';
  const half = ev.timetableOf([
    { ...V('Late', '11 PM'), order: { seq: 1, of: 2, source: src, confirmed: false } },
    V('Early', '10 PM'),
  ]);
  noLanesNoDecks(half);
  assert.deepEqual(half.cells.map((c) => c.entry.e.name), ['Early', 'Late']);
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

test('printed set times that genuinely overlap still stack — the rule has no concurrency branch left', () => {
  const V = (name, time) => ({ name, night: 'Fri', venue: 'V', time });
  // The shapes that used to pick a treatment: a bridge chain (was lanes) and
  // a four-deep pile (was a deck). One room, one answer.
  const bridge = ev.timetableOf([V('Long', '8 PM - 11 PM'), V('Early', '8 PM - 9 PM'), V('Late', '10 PM - 11 PM')]);
  noLanesNoDecks(bridge);
  assert.deepEqual(bridge.cells.map((c) => c.entry.e.name), ['Long', 'Early', 'Late'], 'the clock leads, file order breaks the tie');
  const pile = ev.timetableOf([V('A', '8 PM - 10 PM'), V('B', '8 PM - 9 PM'), V('C', '8 PM - 9 PM'), V('D', '9:30 PM - 10:30 PM')]);
  noLanesNoDecks(pile);
  assert.equal(pile.cells.length, 4, 'four sets, four cards — nothing is folded into a pile');
});

test('a partly-entered run: the column stays continuous, but only a genuine closer runs to the room\'s close', () => {
  const src = 'https://example.test/poster';
  const M = (name, time, seq, of) => ({ name, night: 'Sun', venue: 'V', time, approx: true, doors: '10 PM', close: '2 AM', order: { seq, of, source: src, confirmed: false } });
  const three = ev.timetableOf([M('One', '10 PM', 1, 4), M('Three', '12 AM', 3, 4), M('Four', '1 AM', 4, 4)]);
  const at = (name) => three.cells.find((c) => c.entry && c.entry.e.name === name).entry;
  // The room runs continuously: a hole where the missing 2-of-4 would sit
  // reads as broken, so the set before it holds the floor until the next
  // known one starts. What it must NOT do is claim the end of the night.
  assert.equal(at('One').endMin, at('Three').startMin, 'ends where the next set in the room begins, gap or no gap');
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
