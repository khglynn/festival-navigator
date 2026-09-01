// Phase 1 of the events build (claude-plans/2026-08-31-events-canvas/MODEL-V3.md):
// Portola's Afters/Folsom entries carry STRUCTURED fields — `night` + `venue`
// parsed out of the `stage` string, and for The Midway's Sunday four the
// back-to-back-run shape of §5 (guessed time + `approx`, `doors`/`close`, and
// an `order` that says how sure we are and links the source).
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
  migrateEvents, namesAndDays, isEventEntry, splitStage,
  MIDWAY_RUN, PORTOLA_WEEK, MIDWAY_TICKETS, META_NOTE,
} = await import('../scripts/migrate-portola-events.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const frozen = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/live-pick-keys.json'), 'utf8'));

const events = portola.artists.filter((a) => isEventEntry(portola, a));
const midway = portola.artists.filter((a) => a.night === 'Sun' && a.venue === 'The Midway');
const clone = (x) => JSON.parse(JSON.stringify(x));

// The document as it stood BEFORE the migration, derived by removing exactly
// what the migration adds. The four Midway sets all read "10 PM" then — the
// poster's DOORS time, transcribed into the set-time field, which is the
// misreading §5 exists to correct.
function unmigrate(fest) {
  const out = clone(fest);
  out.artists = out.artists.map((a) => {
    if (!isEventEntry(fest, a)) return a;
    const bare = { ...a };
    for (const k of ['night', 'venue', 'approx', 'doors', 'close', 'closeApprox', 'order']) delete bare[k];
    if (a.night === MIDWAY_RUN.night && a.venue === MIDWAY_RUN.venue && MIDWAY_RUN.sets.some((s) => s.name === a.name)) {
      bare.time = MIDWAY_RUN.doors;
    }
    return bare;
  });
  out.meta = { ...out.meta };
  out.meta.note = String(out.meta.note || '').replace(` ${META_NOTE}`, '');
  out.meta.sources = (out.meta.sources || []).filter((s) => s !== MIDWAY_TICKETS);
  return out;
}

// ---- the frozen-key law (MODEL-V3 §1) ---------------------------------------

test('the migration moves NO pick key: names and day labels are byte-identical, in order', () => {
  const before = unmigrate(portola);
  const after = migrateEvents(before).fest;
  assert.deepEqual(namesAndDays(after), namesAndDays(before),
    'artists[].name and artists[].day are pick/notes keys — the doc model has no rename path');
  assert.deepEqual(namesAndDays(portola), namesAndDays(before),
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
  assert.notDeepEqual(namesAndDays(doctored), namesAndDays(portola), 'the key comparison notices');
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
  assert.equal(events.length, 45, 'Portola Week + Folsom weekend, as shipped');
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

test('the Midway four are ONE night played in sequence, not four shows at 10 PM', () => {
  assert.equal(midway.length, 4);
  const bySeq = [...midway].sort((x, y) => x.order.seq - y.order.seq);
  assert.deepEqual(bySeq.map((a) => [a.order.seq, a.name, a.time]), [
    [1, 'MGNA Crrrta', '10 PM'],
    [2, 'VTSS', '11 PM'],
    [3, 'Two Shell', '12 AM'],
    [4, 'horsegiirL', '1 AM'],
  ], 'the ticket billing decides the closer (horsegiirL, AXS/Tixr headliner); the other three keep the poster read');
  for (const a of midway) {
    assert.equal(a.day, 'Afters', 'the section key is untouched — notes written on "Afters" stay there');
    assert.equal(a.approx, true, 'the set time is our guess and says so');
    assert.equal(a.doors, '10 PM', 'sourced: AXS event 1575408 prints "Doors Open — Sun Sep 27, 2026, 10:00 PM"');
    assert.equal(a.close, '2 AM');
    assert.equal(a.closeApprox, true, 'NO source states an end time — the close is ours, and the data says so');
    assert.deepEqual(a.order, {
      seq: a.order.seq, of: 4, source: PORTOLA_WEEK, confirmed: false,
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
  // A phase-2 session reading the JSON must not have to find a plan doc to
  // learn that the doors are sourced and the close is a guess.
  assert.ok(portola.meta.note.includes(META_NOTE));
  assert.match(portola.meta.note, /10 PM is DOORS/);
  assert.match(portola.meta.note, /`close: "2 AM"` is OURS/);
  assert.ok(portola.meta.sources.includes(MIDWAY_TICKETS), 'the doors time is one click away');
  assert.ok(portola.meta.sources.includes(PORTOLA_WEEK), 'and so is the poster the order came from');
});

test('the other event entries stayed plain — the run shape is not sprayed across the file', () => {
  for (const a of events) {
    if (midway.includes(a)) continue;
    for (const k of ['approx', 'doors', 'close', 'closeApprox', 'order']) {
      assert.equal(a[k], undefined, `${a.name} (${a.stage}) has no ${k} — nobody has re-read that pile yet`);
    }
  }
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
  assert.match(afters.querySelector('.sec-whisper').textContent, /^~ marks a guessed set time — the order is the plan\.$/);
  const hmd = [...root.querySelectorAll('.card')].filter((c) => c.dataset.artist === 'Horse Meat Disco');
  assert.deepEqual(hmd.map((c) => [c.closest('.room').dataset.bucket, c.classList.contains('cell'), c.querySelector('.time')?.textContent]),
    [['Afters', true, '9 PM'], ['Folsom', false, '9 PM – 3 AM']],
    'Friday: a cell on the afters clock (start time, the end at the cell\'s foot), and a Folsom tile that says the range');
  root.remove();
});
