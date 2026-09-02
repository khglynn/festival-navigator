// The events data (claude-plans/2026-08-31-events-canvas/MODEL-V3.md):
// Portola's Afters/Folsom entries carry STRUCTURED fields — `night` + `venue`
// parsed out of the `stage` string — and every multi-artist VENUE-NIGHT that
// has a time carries the back-to-back-run shape of §5 (guessed time +
// `approx`, `doors`/`close`, and an `order` that says how sure we are and
// links the source). The one rule, Kevin 2026-09-01: a venue-night is one
// room and its artists play in sequence, so there is no such thing as a
// "pile" left in this file.
//
// A sibling of portola-2026.test.mjs rather than an extension of it: that file
// is the POSTER's invariants (five columns, doors-to-close, spot-checked set
// times), this one is the MIGRATION's laws. Different ground truth, different
// reason to go red.
//
// The transform under test is `scripts/migrate-portola-events.mjs` itself —
// these are THOSE EXACT BYTES, not a re-typed twin. A test against a copy of a
// transform passes through exactly the regression it exists to catch (CLAUDE.md,
// the crew-sql rule).
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
globalThis.localStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {},
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const state = await import('../js/state.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderWall } = await import('../js/v3/wall.js');
const { validateFestivalDoc } = await import('../api/_lib/festival-rules.mjs');
const { frozenKeyProblems } = await import('../api/_lib/pick-keys.mjs');
const { timeToMinutes } = await import('../js/time.js');
const {
  migrateEvents, frozenKeys, additionsOnly, isEventEntry, splitStage, runTimes, clockLabel,
  RUNS, TIMELESS_ROOMS, PORTOLA_WEEK, DOTHEBAY_INDEX, MIDWAY_TICKETS, META_NOTE,
} = await import('../scripts/migrate-portola-events.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const frozen = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/live-pick-keys.json'), 'utf8'));

const events = portola.artists.filter((a) => isEventEntry(portola, a));
const midway = portola.artists.filter((a) => a.night === 'Sun' && a.venue === 'The Midway');
const clone = (x) => JSON.parse(JSON.stringify(x));
const runOf = (night, venue) => RUNS.find((r) => r.night === night && r.venue === venue);
const inAnyRun = (a) => RUNS.some((r) => r.day === a.day && r.night === a.night && r.venue === a.venue && r.order.includes(a.name));
// Every venue-night in the file, however many acts are in it.
const roomsOf = (fest) => {
  const rooms = new Map();
  for (const a of fest.artists) {
    if (!isEventEntry(fest, a)) continue;
    const { night, venue } = splitStage(a.stage);
    const k = `${a.day}|${night}|${venue}`;
    if (!rooms.has(k)) rooms.set(k, []);
    rooms.get(k).push(a);
  }
  return rooms;
};

// The document as it stood BEFORE the migration, derived by removing exactly
// what the migration adds. Every set in a run read its room's `wasTime` then —
// the DOORS time (or, in five rooms, the room's whole window) transcribed into
// the set-time field, which is the misreading §5 exists to correct.
function unmigrate(fest) {
  const out = clone(fest);
  out.artists = out.artists.map((a) => {
    if (!isEventEntry(fest, a)) return a;
    const bare = { ...a };
    for (const k of ['night', 'venue', 'approx', 'doors', 'close', 'closeApprox', 'order']) delete bare[k];
    const run = RUNS.find((r) => r.day === a.day && r.night === a.night && r.venue === a.venue && r.order.includes(a.name));
    if (run) bare.time = run.wasTime;
    return bare;
  });
  out.meta = { ...out.meta };
  out.meta.note = String(out.meta.note || '').replace(` ${META_NOTE}`, '');
  out.meta.sources = (out.meta.sources || []).filter((s) => s !== MIDWAY_TICKETS);
  return out;
}

// ---- the frozen-key law (MODEL-V3 §1) ---------------------------------------

test('the migration moves NO pick key: names, day labels and stages are byte-identical, in order', () => {
  const before = unmigrate(portola);
  const after = migrateEvents(before).fest;
  assert.deepEqual(frozenKeys(after), frozenKeys(before),
    'artists[].name, .day and .stage are pick/notes/render keys — the doc model has no rename path');
  assert.deepEqual(frozenKeys(portola), frozenKeys(before),
    'and the SHIPPED file still carries the same keys the pre-migration file did');
});

test('the shipped file is exactly what the reviewable transform produces', () => {
  // End to end: strip the migration off, run it again, get the shipped bytes
  // back. A hand edit to the JSON that the script would not have made shows up
  // here — which is the point of migrating with a script at all.
  const rebuilt = migrateEvents(unmigrate(portola)).fest;
  assert.deepEqual(rebuilt, portola);
  assert.equal(JSON.stringify(rebuilt, null, 2), JSON.stringify(portola, null, 2));
});

test('the migration is idempotent — running it on the shipped file changes nothing', () => {
  const { fest, changes } = migrateEvents(portola);
  assert.deepEqual(fest, portola);
  assert.deepEqual(changes, [], 'a second run is a no-op, so re-running is never a risk');
});

const freezeOf = (fest) => frozenKeyProblems(fest, frozen.festivals['portola-2026'], { indexIds: new Set(['portola-2026']) });

test('this test has teeth: a renamed artist IS caught, by the same guard CI runs', () => {
  // Prove the check above is not vacuous. Rename a Midway act the way a
  // "tidy-up" would — case only, the worst kind, because every card still
  // renders and every tap still "works" while the picks split in two.
  // VTSS has TWO artists[] entries (the Sunday grid billing and the afters
  // show), and picks unify by exact name across both — so a rename has to hit
  // every occurrence before the name is actually gone. Renaming one is
  // correctly NOT a rename.
  const half = clone(portola);
  half.artists.find((a) => a.name === 'VTSS').name = 'Vtss';
  assert.deepEqual(freezeOf(half), [], 'the other VTSS entry still carries the key');

  const doctored = clone(portola);
  for (const a of doctored.artists) if (a.name === 'VTSS') a.name = 'Vtss';
  assert.notDeepEqual(frozenKeys(doctored), frozenKeys(portola), 'the key comparison notices');
  const problems = freezeOf(doctored);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^artist "VTSS" is now spelled "Vtss"/);
  // And the shipped file is clean against the same freeze.
  assert.deepEqual(freezeOf(portola), []);
});

test('a day label cannot move either — the notes chip on a section points at it', () => {
  // "Afters" is kept alive by TWO shapes: the 37 plain entries and Horse Meat
  // Disco's combined "Afters & Folsom", which contributes the part. Renaming
  // one shape leaves the other holding the key — which is why the guard reads
  // the label SET and not any single entry.
  const plainOnly = clone(portola);
  for (const a of plainOnly.artists) if (a.day === 'Afters') a.day = 'After';
  assert.deepEqual(freezeOf(plainOnly), [], 'the combined "Afters & Folsom" still yields the part "Afters"');

  const wholesale = clone(portola);
  for (const a of wholesale.artists) if (typeof a.day === 'string' && a.day.includes('Afters')) a.day = a.day.replace('Afters', 'After');
  const problems = freezeOf(wholesale);
  assert.equal(problems.length, 2, 'both "Afters" and "Afters & Folsom" are frozen labels');
  assert.ok(problems.some((p) => /day label "Afters" no longer exists/.test(p)));
  assert.ok(problems.some((p) => /day label "Afters & Folsom" no longer exists/.test(p)));
});

// ---- night + venue: a denormalization that must not drift -------------------

test('every event entry carries night + venue, and they agree with the stage string', () => {
  assert.equal(events.length, 47, 'Portola Week + Folsom weekend, plus Buck Wilson and Kaytree off the bill (2026-09-01)');
  for (const a of events) {
    const { night, venue } = splitStage(a.stage);
    assert.equal(a.night, night, `${a.name}: night parsed from ${a.stage}`);
    assert.equal(a.venue, venue, `${a.name}: venue parsed from ${a.stage}`);
    assert.ok(['Thu', 'Fri', 'Sat', 'Sun'].includes(a.night), `${a.name}: ${a.night} is a Portola Week night`);
    assert.ok(Object.prototype.hasOwnProperty.call(portola.venues, a.venue), `${a.name}: ${a.venue} is a door to its map`);
  }
});

test('grid entries are left alone — night/venue belong to events, not to the timetable', () => {
  for (const a of portola.artists) {
    if (isEventEntry(portola, a)) continue;
    assert.equal(a.night, undefined, `${a.name} is a grid billing, not an event`);
    assert.equal(a.venue, undefined, `${a.name} is a grid billing, not an event`);
  }
  for (const day of Object.values(portola.days)) {
    for (const a of day.artists) assert.equal(a.venue, undefined, `${a.name}: a grid set's room is its stage column`);
  }
});

// ---- §5, the back-to-back run ----------------------------------------------

test('EVERY multi-artist venue-night with a time is a run — no pile is left in the file', () => {
  const rooms = roomsOf(portola);
  const multi = [...rooms].filter(([, l]) => l.length > 1);
  assert.equal(multi.length, 12, 'twelve venue-nights hold more than one act');
  const timeless = new Set(TIMELESS_ROOMS.map((r) => `${r.day}|${r.night}|${r.venue}`));
  for (const [key, list] of multi) {
    if (timeless.has(key)) {
      assert.ok(list.every((a) => a.time === undefined), `${key}: no page prints a time — it stays timeless, never given an invented clock`);
      assert.ok(list.every((a) => a.order === undefined), `${key}: a timeless room is not a run`);
      continue;
    }
    assert.ok(list.every((a) => a.order), `${key}: every set carries its position in the room's run`);
    assert.equal(new Set(list.map((a) => a.order.seq)).size, list.length, `${key}: no two sets claim one position`);
    assert.equal(new Set(list.map((a) => a.order.of)).size, 1, `${key}: one room, one run length`);
    assert.equal(list[0].order.of, list.length);
    assert.equal(new Set(list.map((a) => a.time)).size, list.length, `${key}: the doors time is no longer stamped on every act`);
    assert.ok(list.every((a) => a.approx === true && a.order.confirmed === false), `${key}: it is our read, and it says so`);
    assert.ok(list.every((a) => a.doors), `${key}: a run needs the room's doors`);
  }
  // …and Portola has NO timeless multi-artist room left: Sat Audio and Sat
  // Public Works were the last two, and their show pages print doors 10 PM.
  assert.deepEqual([...multi].filter(([k]) => timeless.has(k)).map(([k]) => k), []);
  assert.deepEqual(TIMELESS_ROOMS, []);
});

test('the two names that were on the bill and missing from the file are cards now, in shape with their neighbours', () => {
  const at = (name, stage) => portola.artists.find((a) => a.name === name && a.stage === stage);
  const buck = at('Buck Wilson', 'Sun · Monarch');
  const kaytree = at('Kaytree', 'Sun · Public Works');
  for (const [who, seq, of, time] of [[buck, 1, 3, '10 PM'], [kaytree, 2, 4, '11 PM']]) {
    assert.ok(who, 'the entry exists');
    assert.equal(who.day, 'Afters', 'the section key is the one notes are written on');
    assert.equal(who.time, time);
    assert.equal(who.approx, true, 'a created set is a guess like every other set in its room');
    assert.equal(who.doors, '10 PM');
    assert.equal(who.order.seq, seq);
    assert.equal(who.order.of, of);
    assert.equal(who.order.confirmed, false);
    assert.match(who.order.source, /^https:\/\/dothebay\.com\//, 'the door opens the show page the bill was read from');
    // Byte-for-byte the same key set as an entry that was already there.
    const neighbour = portola.artists.find((a) => a.stage === who.stage && a.name !== who.name);
    assert.deepEqual(Object.keys(who), Object.keys(neighbour), 'a created entry is not a different shape from its room-mates');
  }
  // Kaytree already had a Sunday grid billing; picks unify by exact name
  // across both, which is the shape VTSS and Overmono already had.
  assert.equal(portola.artists.filter((a) => a.name === 'Kaytree').length, 2);
  assert.ok(portola.artists.some((a) => a.name === 'Kaytree' && a.day === 'Sunday' && !a.stage));
  assert.equal(portola.artists.filter((a) => a.name === 'Buck Wilson').length, 1, 'Buck Wilson was nowhere in the file before');
  // The lowercase pick key survived DoTheBay's "Erika b2b SFCowboy".
  assert.ok(portola.artists.some((a) => a.name === 'erika b2b sfcowboy'));
  assert.ok(!portola.artists.some((a) => /^Erika b2b/.test(a.name)));
});

test('every run points its order line at the page the bill was read from', () => {
  for (const run of RUNS) {
    for (const name of run.order) {
      const a = portola.artists.find((x) => x.name === name && x.stage === `${run.night} · ${run.venue}`);
      assert.equal(a.order.source, run.source, `${name}: the door opens ${run.venue}'s own show page`);
    }
    assert.match(run.source, /^https:\/\/(dothebay\.com|www\.axs\.com)\//, `${run.venue}: a citable, server-rendered page`);
    assert.ok(['medium', 'high'].includes(run.confidence), `${run.venue}: confidence is recorded`);
  }
  // The programme page is the programme of record, not a door: its list is
  // client-side, so nothing cites it as a source any more.
  assert.ok(!portola.artists.some((a) => a.order && a.order.source === PORTOLA_WEEK));
  assert.ok(portola.meta.sources.includes(PORTOLA_WEEK), 'it stays in meta.sources');
  assert.ok(portola.meta.sources.includes(DOTHEBAY_INDEX), 'and the listing that replaced it is there too');
});

test('a single-act venue-night is never given a run — the shape is not sprayed across the file', () => {
  for (const [key, list] of roomsOf(portola)) {
    if (list.length > 1) continue;
    for (const k of ['approx', 'doors', 'close', 'closeApprox', 'order']) {
      assert.equal(list[0][k], undefined, `${key}: one act, nothing to sequence, no ${k}`);
    }
  }
  for (const a of events) {
    if (inAnyRun(a)) continue;
    assert.equal(a.order, undefined, `${a.name} (${a.stage}) is not in a run and carries no order`);
  }
});

test('the guessed times are DERIVED, not typed: runTimes() reproduces every room from its doors and close', () => {
  for (const run of RUNS) {
    const derived = runTimes({ doors: run.doors, close: run.close, count: run.order.length });
    const shipped = run.order.map((name) => portola.artists.find((a) => a.name === name && a.night === run.night && a.venue === run.venue).time);
    assert.deepEqual(shipped, run.times || derived, `${run.night} · ${run.venue}`);
    if (run.times) assert.deepEqual(run.times, derived, `${run.night} · ${run.venue}: the pinned times and the rule agree`);
    assert.equal(derived[0], run.doors, 'the opener starts at doors');
    if (run.close) {
      const end = timeToMinutes(run.close);
      assert.ok(timeToMinutes(derived[derived.length - 1]) < end, `${run.night} · ${run.venue}: the closer starts before the close`);
    }
  }
  // The rule itself, at its edges.
  assert.deepEqual(runTimes({ doors: '10 PM', close: '2 AM', count: 4 }), ['10 PM', '11 PM', '12 AM', '1 AM'], 'the Midway');
  assert.deepEqual(runTimes({ doors: '10 PM', close: '2 AM', count: 3 }), ['10 PM', '11:30 PM', '1 AM'], 'rounded to the half hour, never 11:20');
  assert.deepEqual(runTimes({ doors: '10 PM', count: 3 }), ['10 PM', '11 PM', '12 AM'], 'no close: an hour apart');
  assert.deepEqual(runTimes({ doors: '10 PM', close: '11 PM', count: 4 }), ['10 PM', '10:30 PM', '11 PM', '11:30 PM'],
    'a window too short for the floor: the step never goes below 30 minutes');
  assert.equal(clockLabel(0), '12 AM');
  assert.equal(clockLabel(12 * 60), '12 PM');
});

test('The Midway is untouched — Kevin settled that room, and re-running the migration may never move it', () => {
  assert.equal(midway.length, 4);
  const bySeq = [...midway].sort((x, y) => x.order.seq - y.order.seq);
  assert.deepEqual(bySeq.map((a) => [a.order.seq, a.name, a.time]), [
    [1, 'MGNA Crrrta', '10 PM'],
    [2, 'VTSS', '11 PM'],
    [3, 'Two Shell', '12 AM'],
    [4, 'horsegiirL', '1 AM'],
  ], 'the ticket billing decides the closer (horsegiirL, AXS/Tixr headliner); the other three keep the poster read');
  assert.deepEqual(runOf('Sun', 'The Midway').order, ['MGNA Crrrta', 'VTSS', 'Two Shell', 'horsegiirL'], 'and the run table says the same');
  for (const a of midway) {
    assert.equal(a.day, 'Afters', 'the section key is untouched — notes written on "Afters" stay there');
    assert.equal(a.approx, true, 'the set time is our guess and says so');
    assert.equal(a.doors, '10 PM', 'sourced: AXS event 1575408 prints "Doors Open — Sun Sep 27, 2026, 10:00 PM"');
    assert.equal(a.close, '2 AM');
    assert.equal(a.closeApprox, true, 'NO source states an end time — the close is ours, and the data says so');
    assert.deepEqual(a.order, {
      seq: a.order.seq, of: 4, source: MIDWAY_TICKETS, confirmed: false,
    });
    assert.match(a.order.source, /^https:\/\//, 'the order line is a door, so it needs somewhere to go');
  }
  // Artist separation is law: four names, four cards, four pick keys.
  assert.equal(new Set(midway.map((a) => a.name)).size, 4);
  assert.equal(new Set(midway.map((a) => a.order.seq)).size, 4, 'no two sets claim the same position');
});

test('the run sits inside its own window and the clock agrees with the numbering', () => {
  const doors = timeToMinutes('10 PM');
  const close = timeToMinutes('2 AM'); // AM reads as after-midnight — 2 AM is later than 10 PM
  assert.ok(close > doors);
  const bySeq = [...midway].sort((x, y) => x.order.seq - y.order.seq);
  let prev = -Infinity;
  for (const a of bySeq) {
    const t = timeToMinutes(a.time);
    assert.ok(t >= doors && t <= close, `${a.name} at ${a.time} is inside doors–close`);
    assert.ok(t > prev, `${a.name} starts after the set before it`);
    prev = t;
  }
});

test('the file itself says which facts are sourced and which are ours', () => {
  // A session reading the JSON must not have to find a plan doc to learn that
  // the doors are sourced, the close is sometimes a guess, and the order is a
  // read of a bill.
  assert.ok(portola.meta.note.includes(META_NOTE));
  assert.match(portola.meta.note, /that is the DOORS time/);
  assert.match(portola.meta.note, /The Midway.s 2 AM is OURS/);
  assert.match(portola.meta.note, /TWO NAMES WERE ON THE BILL AND MISSING/);
  assert.match(portola.meta.note, /is KEPT against DoTheBay/, 'the pick key we did not "fix"');
  assert.equal(portola.meta.note.split('BACK-TO-BACK RUN').length, 2, 'one provenance paragraph, not one per re-run');
  assert.ok(portola.meta.sources.includes(MIDWAY_TICKETS), 'the doors time is one click away');
  assert.ok(portola.meta.sources.includes(PORTOLA_WEEK), 'and so is the programme the orders came from');
});

test('a room that no longer says what the run table remembers it said stops the migration', () => {
  // wasTime is a tripwire, not decoration: a hand edit to a time the transform
  // is about to overwrite must be noticed, not silently re-guessed.
  const before = unmigrate(portola);
  before.artists.find((a) => a.name === 'Naisha' && a.stage === 'Sun · Rickshaw Stop').time = '9 PM';
  assert.throws(() => migrateEvents(before), /the file says time "9 PM" but the run row expects "10 PM"/);
});

test('a multi-artist room that is in neither list stops the migration — a new data drop cannot slip through unread', () => {
  const before = unmigrate(portola);
  // Give Thursday's Club Six a second act at the same time: a new pile.
  before.artists.push({ name: 'Somebody New', day: 'Afters', stage: 'Thu · Club Six', time: '10 PM' });
  assert.throws(() => migrateEvents(before), /unrun room: Afters\|Thu\|Club Six/);
});

// ---- the validator ----------------------------------------------------------

const runFest = (over = {}, secondOver = {}) => ({
  id: 'x', name: 'X', status: 'lineup',
  venues: { 'The Midway': 'https://maps.google.com/?q=The+Midway' },
  artists: [
    { name: 'A', day: 'Afters', stage: 'Sun · The Midway', night: 'Sun', venue: 'The Midway', time: '10 PM', approx: true, doors: '10 PM', close: '2 AM', closeApprox: true, order: { seq: 1, of: 2, source: 'https://example.test/poster', confirmed: false }, ...secondOver },
    { name: 'B', day: 'Afters', stage: 'Sun · The Midway', night: 'Sun', venue: 'The Midway', time: '11 PM', approx: true, doors: '10 PM', close: '2 AM', closeApprox: true, order: { seq: 2, of: 2, source: 'https://example.test/poster', confirmed: false }, ...over },
  ],
});
const errsOf = (fest) => validateFestivalDoc(fest).errors;
const rejects = (label, over, pattern) => test(`validator rejects ${label}`, () => {
  const errors = errsOf(runFest(over));
  assert.ok(errors.some((e) => pattern.test(e)), `expected ${pattern} in:\n${errors.join('\n')}`);
});

test('validator accepts a well-formed run', () => {
  const r = validateFestivalDoc(runFest());
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('the shipped Portola file still validates with zero errors and zero warnings', () => {
  const r = validateFestivalDoc(portola, { filename: 'portola-2026.json' });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

rejects('a non-object order', { order: '3rd of 4' }, /order must be an object/);
rejects('a seq past of', { order: { seq: 5, of: 2, source: 'https://example.test/p', confirmed: false } }, /order\.seq must be a whole number from 1 to 2/);
rejects('a seq of zero', { order: { seq: 0, of: 2, source: 'https://example.test/p', confirmed: false } }, /order\.seq must be/);
rejects('a fractional seq', { order: { seq: 1.5, of: 2, source: 'https://example.test/p', confirmed: false } }, /order\.seq must be/);
rejects('a run of one', { order: { seq: 1, of: 1, source: 'https://example.test/p', confirmed: false } }, /order\.of must be a whole number of 2 or more/);
rejects('a non-https source', { order: { seq: 2, of: 2, source: 'http://example.test/p', confirmed: false } }, /order\.source must be an https URL/);
rejects('a missing source', { order: { seq: 2, of: 2, confirmed: false } }, /order\.source must be an https URL/);
rejects('a stringly confirmed', { order: { seq: 2, of: 2, source: 'https://example.test/p', confirmed: 'no' } }, /order\.confirmed must be true or false/);
rejects('two sets claiming one position', { order: { seq: 1, of: 2, source: 'https://example.test/p', confirmed: false } }, /two sets both claim position 1/);
rejects('sets that disagree on how long the run is', { order: { seq: 2, of: 3, source: 'https://example.test/p', confirmed: false } }, /disagree on how many are in the run/);
rejects('a night outside the weekday vocabulary', { night: 'Sunday' }, /night must be one of Mon\|Tue\|Wed\|Thu\|Fri\|Sat\|Sun/);
rejects('a night that drifted from its stage', { night: 'Sat' }, /night "Sat" disagrees with stage/);
rejects('a venue that drifted from its stage', { venue: 'Monarch' }, /venue "Monarch" disagrees with stage/);
rejects('an empty venue', { venue: '  ' }, /venue must be a non-empty string/);
rejects('a doors that is a range, not a moment', { doors: '10 PM - 2 AM' }, /doors must be a single clock time/);
rejects('a close before its doors', { close: '9 PM' }, /close "9 PM" is not after doors "10 PM"/);
rejects('a set outside the room\'s window', { time: '3 AM' }, /set time "3 AM" falls outside doors "10 PM" – close "2 AM"/);
rejects('a clock that contradicts the running order', { time: '9:30 PM', doors: '9 PM' }, /the running order and the clock disagree/);
rejects('a non-boolean approx', { approx: 'yes' }, /approx must be true or false/);
rejects('approx with nothing to qualify', { approx: true, time: undefined }, /approx marks a guessed set time but the entry has no time/);
rejects('closeApprox with no close', { close: undefined, closeApprox: true }, /closeApprox qualifies close, which is missing/);

test('validator WARNS (never blocks) on a venue with no map entry — it only costs the door', () => {
  const r = validateFestivalDoc(runFest({ stage: 'Sun · Audio', night: 'Sun', venue: 'Audio' }));
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => /venue "Audio" has no entry in venues\{\}/.test(w)));
});

test('validator warns when only part of a run is numbered', () => {
  const fest = runFest();
  delete fest.artists[0].order;
  const r = validateFestivalDoc(fest);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => /1 of 2 sets in the run carry an order/.test(w)));
});

test('a malformed new field fails the CI command, not just the unit test', async () => {
  // scripts/validate-festivals.mjs is what CLAUDE.md tells every data session
  // to run. Prove the new rules reach it rather than living only in here.
  const { execFileSync } = await import('node:child_process');
  const bad = clone(portola);
  // The afters entry, not the Sunday grid billing — VTSS is both.
  bad.artists.find((a) => a.name === 'VTSS' && a.venue === 'The Midway').order.seq = 9;
  const { mkdtempSync, writeFileSync, cpSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'fest-validate-'));
  cpSync(join(ROOT, 'data'), join(dir, 'data'), { recursive: true });
  cpSync(join(ROOT, 'tests', 'fixtures'), join(dir, 'tests', 'fixtures'), { recursive: true });
  cpSync(join(ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true });
  cpSync(join(ROOT, 'api'), join(dir, 'api'), { recursive: true });
  cpSync(join(ROOT, 'js'), join(dir, 'js'), { recursive: true });
  writeFileSync(join(dir, 'data/festivals/portola-2026.json'), JSON.stringify(bad, null, 2));
  let failed = false;
  let out = '';
  try {
    out = execFileSync(process.execPath, [join(dir, 'scripts/validate-festivals.mjs')], { encoding: 'utf8' });
  } catch (e) {
    failed = true;
    out = e.stdout || '';
  }
  assert.ok(failed, `validate-festivals.mjs should exit non-zero; output was:\n${out}`);
  assert.match(out, /order\.seq must be a whole number from 1 to 4/);
});

// ---- the running app is unaffected ------------------------------------------

test('the wall still renders every event card, now saying the guessed time', () => {
  FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' });
  state.activateCrew('eventstesttoken_01234567', {
    v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 3 } },
    festivals: { 'portola-2026': { selections: {} } }, affinity: {},
  });
  state.FESTIVALS['portola-2026'] = portola;
  state.setActiveFestivalId('portola-2026');
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, {
    fid: 'portola-2026', meName: 'Kevin', picks: {}, affinity: null, lowPower: true,
    sort: 'day', query: '', weekend: 'all', onTap: () => {}, onOpenNotes: null, onNotesChange: null, onOpenDayNotes: null,
  });
  // Phase 2 (day-first) is in: the days are THU FRI SAT SUN, and the run
  // renders as a plain vertical column on Sunday's afters clock, every set
  // wearing its guessed time with the tilde. Data-driven on purpose — the
  // order and the times are the file's, never this test's.
  const rules = [...root.querySelectorAll('.day-rule')].map((r) => r.querySelector('.day').textContent);
  assert.deepEqual(rules, ['THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
  const sunday = [...root.querySelectorAll('.day-rule')].find((r) => r.dataset.day === 'Sunday');
  let afters = sunday.nextElementSibling;
  while (afters && !(afters.classList.contains('room') && afters.dataset.bucket === 'Afters')) afters = afters.nextElementSibling;
  assert.ok(afters, 'Sunday has an AFTERS room');
  const cellOf = (name) => [...afters.querySelectorAll('.times-grid .card.cell')].find((c) => c.dataset.artist === name);
  const bySeq = [...midway].sort((x, y) => x.order.seq - y.order.seq);
  let prevRow = -1;
  let column = null;
  for (const a of bySeq) {
    const cell = cellOf(a.name);
    assert.ok(cell, `${a.name} is a cell on Sunday's afters clock`);
    assert.equal(cell.dataset.time, `~${a.time}`, 'the resting card wears the guessed time with a tilde');
    assert.equal(cell.style.width, '', 'a run never lane-splits');
    assert.equal(cell.closest('.deck'), null, 'a run never becomes a deck');
    const row = Number(cell.style.gridRow.split(' / ')[0]);
    assert.ok(row > prevRow, `${a.name} sits below the set before it`);
    prevRow = row;
    if (column === null) column = cell.style.gridColumn;
    assert.equal(cell.style.gridColumn, column, 'one venue, one column');
  }
  assert.equal(afters.querySelectorAll('.sec-whisper').length, 1, 'ONE section-level whisper for the guessed times');
  assert.equal(afters.querySelector('.sec-whisper').textContent, '~ marks a guessed set time — the order is the plan', 'the LOCKED copy, no terminal period');
  const hmd = [...root.querySelectorAll('.card')].filter((c) => c.dataset.artist === 'Horse Meat Disco');
  assert.deepEqual(hmd.map((c) => [c.closest('.room').dataset.bucket, c.classList.contains('cell'), c.querySelector('.time')?.textContent]),
    [['Afters', true, '9 PM'], ['Folsom', false, '9 PM – 3 AM']],
    'Friday: a cell on the afters clock (start time, the end at the cell\'s foot), and a Folsom tile that says the range');
  root.remove();
});
