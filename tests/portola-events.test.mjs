// The events data (claude-plans/2026-08-31-events-canvas/MODEL-V3.md):
// Portola's Afters/Folsom entries carry STRUCTURED fields — `night` + `venue`
// parsed out of the `stage` string — and every multi-artist VENUE-NIGHT that
// has a time carries the back-to-back-run shape of §5 (`doors`/`close`, an
// `order` that says how sure we are and links the source, and a start per set
// that is either the venue's or our guess marked `approx`). The one rule,
// Kevin 2026-09-01: a venue-night is one room and its artists play in
// sequence, so there is no such thing as a "pile" left in this file.
//
// A sibling of portola-2026.test.mjs rather than an extension of it: that file
// is the POSTER's invariants (five columns, doors-to-close, spot-checked set
// times), this one is the events layer's laws, read off the SHIPPED file as
// behaviour. The JSON is the source of truth: the one-shot migration that
// first wrote this shape (scripts/migrate-portola-events.mjs, retired
// 2026-09-16 — git history keeps it) used to be pinned here byte for byte,
// which turned a venue's real posted set time into six red tests.
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
const { planFestival, loadRegistry } = await import('../scripts/guess-run-times.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const frozen = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/live-pick-keys.json'), 'utf8'));

// An event entry says its room in the stage string: "Sun · The Midway".
const splitStage = (stage) => {
  const bits = stage.split(' · ');
  return { night: bits[0].trim(), venue: bits.slice(1).join(' · ').trim() };
};
const events = portola.artists.filter((a) => typeof a.stage === 'string' && a.stage.includes(' · '));
const midway = portola.artists.filter((a) => a.night === 'Sun' && a.venue === 'The Midway');
const clone = (x) => JSON.parse(JSON.stringify(x));
// Every venue-night in the file, however many acts are in it.
const roomsOf = (fest) => {
  const rooms = new Map();
  for (const a of fest.artists) {
    if (typeof a.stage !== 'string' || !a.stage.includes(' · ')) continue;
    const { night, venue } = splitStage(a.stage);
    const k = `${a.day}|${night}|${venue}`;
    if (!rooms.has(k)) rooms.set(k, []);
    rooms.get(k).push(a);
  }
  return rooms;
};

// ---- the frozen-key law (MODEL-V3 §1) ---------------------------------------

const freezeOf = (fest) => frozenKeyProblems(fest, frozen.festivals['portola-2026'], { indexIds: new Set(['portola-2026']) });

test('a renamed artist IS caught, by the same guard CI runs', () => {
  // Rename a Midway act the way a "tidy-up" would — case only, the worst
  // kind, because every card still renders and every tap still "works" while
  // the picks split in two. VTSS has TWO artists[] entries (the Sunday grid
  // billing and the afters show), and picks unify by exact name across both —
  // so a rename has to hit every occurrence before the name is actually gone.
  // Renaming one is correctly NOT a rename.
  const half = clone(portola);
  half.artists.find((a) => a.name === 'VTSS').name = 'Vtss';
  assert.deepEqual(freezeOf(half), [], 'the other VTSS entry still carries the key');

  const doctored = clone(portola);
  for (const a of doctored.artists) if (a.name === 'VTSS') a.name = 'Vtss';
  const problems = freezeOf(doctored);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^artist "VTSS" is now spelled "Vtss"/);
  // And the shipped file is clean against the same freeze.
  assert.deepEqual(freezeOf(portola), []);
});

test('a day label cannot move either — the notes chip on a section points at it', () => {
  // "Afters" is kept alive by TWO shapes: the plain entries and Horse Meat
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
  assert.ok(events.length > 0);
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
    if (events.includes(a)) continue;
    assert.equal(a.night, undefined, `${a.name} is a grid billing, not an event`);
    assert.equal(a.venue, undefined, `${a.name} is a grid billing, not an event`);
  }
  for (const day of Object.values(portola.days)) {
    for (const a of day.artists) assert.equal(a.venue, undefined, `${a.name}: a grid set's room is its stage column`);
  }
});

// ---- §5, the back-to-back run ----------------------------------------------

test('EVERY multi-artist venue-night with a time is a complete run — no pile is left in the file', () => {
  const timedMulti = [...roomsOf(portola)].filter(([, l]) => l.length > 1 && l.some((a) => a.time));
  assert.ok(timedMulti.length > 0);
  for (const [key, list] of timedMulti) {
    assert.ok(list.every((a) => a.order), `${key}: every set carries its position in the room's run`);
    assert.equal(new Set(list.map((a) => a.order.seq)).size, list.length, `${key}: no two sets claim one position`);
    assert.equal(new Set(list.map((a) => a.order.of)).size, 1, `${key}: one room, one run length`);
    assert.equal(list[0].order.of, list.length, `${key}: the whole bill is in the file`);
    assert.ok(list.every((a) => a.time), `${key}: every set has a start — the venue's, or our guess marked approx`);
    assert.equal(new Set(list.map((a) => a.time)).size, list.length, `${key}: the doors time is not stamped on every act`);
    assert.ok(list.every((a) => a.doors), `${key}: a run needs the room's doors`);
  }
});

test('a single-act venue-night carries no order — one act has nothing to sequence (doors, a close and a guessed time are fine)', () => {
  for (const [key, list] of roomsOf(portola)) {
    if (list.length > 1) continue;
    assert.equal(list[0].order, undefined, `${key}: one act, no order`);
  }
});

test('the guessed times are DERIVED, not typed: every approx set is exactly what the guesser plans; a posted set is exempt', () => {
  const plans = planFestival(portola, loadRegistry());
  assert.ok(plans.length > 0);
  for (const { night, venue, doors, members, plan } of plans) {
    const where = `${night} · ${venue}`;
    if (!plan) {
      assert.ok(members.every((a) => a.time && a.approx !== true), `${where}: only a room with nothing to guess goes unplanned`);
      continue;
    }
    for (const a of members) {
      const t = plan.times.find((x) => x.name === a.name);
      if (a.approx === true) assert.equal(a.time, t.time, `${where}: ${a.name} is the guesser's ${t.time}`);
      else assert.equal(t.time, a.time, `${where}: ${a.name}'s posted ${a.time} is never re-guessed`);
      // The close on every member is the plan's — printed, evidenced, or the
      // registry's routine close marked as a guess with the rule that gave it.
      assert.equal(a.close, plan.close || undefined, `${a.name}: the room's close`);
      assert.equal(a.closeApprox, plan.closeApprox ? true : undefined, `${a.name}: a guessed close says so`);
      assert.equal(a.closeSource, plan.closeApprox ? plan.closeSource : undefined, `${a.name}: and says where the guess came from`);
    }
    const starts = plan.times.map((t) => timeToMinutes(t.time));
    assert.ok(starts[0] >= timeToMinutes(doors), `${where}: the opener never goes on before doors`);
    if (plan.close) assert.ok(starts[starts.length - 1] < timeToMinutes(plan.close), `${where}: the closer starts before the close`);
  }
});

test('The Midway keeps Kevin\'s running order — the ticket billing decides the closer', () => {
  assert.equal(midway.length, 4);
  const bySeq = [...midway].sort((x, y) => x.order.seq - y.order.seq);
  assert.deepEqual(bySeq.map((a) => [a.order.seq, a.name]), [
    [1, 'MGNA Crrrta'],
    [2, 'VTSS'],
    [3, 'Two Shell'],
    [4, 'horsegiirL'],
  ], 'horsegiirL closes (AXS/Tixr headliner); the other three keep the poster read');
  for (const a of midway) {
    assert.equal(a.day, 'Afters', 'the section key is untouched — notes written on "Afters" stay there');
    assert.equal(a.order.of, 4);
    assert.match(a.order.source, /^https:\/\//, 'the order line is a door, so it needs somewhere to go');
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
  const audio = { stage: 'Sun · Audio', night: 'Sun', venue: 'Audio' };
  const r = validateFestivalDoc(runFest(audio, audio));
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => /venue "Audio" has no entry in venues\{\}/.test(w)));
});

test('validator accepts a single-act room that carries doors, a close and a guessed time — a show page prints doors, not a set', () => {
  const one = { id: 'x', name: 'X', status: 'lineup', venues: { 'GAMH': 'https://maps.google.com/?q=GAMH' }, artists: [
    { name: 'Six Sex', day: 'Afters', stage: 'Fri · GAMH', night: 'Fri', venue: 'GAMH', time: '9 PM', approx: true, doors: '8 PM', close: '2 AM', closeApprox: true, closeSource: 'https://example.test/listing' },
    { name: 'Neil Frances', day: 'Afters', stage: 'Sat · GAMH', night: 'Sat', venue: 'GAMH', doors: '10 PM' },
  ] };
  assert.deepEqual(validateFestivalDoc(one), { errors: [], warnings: [] });
});

test('validator rejects an order on a single-act room — one act has nothing to sequence', () => {
  const fest = runFest();
  fest.artists.pop();
  const r = validateFestivalDoc(fest);
  assert.ok(r.errors.some((e) => /Afters · Sun · The Midway: one act in the room carries an order/.test(e)), r.errors.join('\n'));
});

test('validator reads a run on the festival-day clock the wall draws — a daytime room (doors 11 AM, close 6 PM) is not after midnight', () => {
  const day = runFest(
    { time: '2 PM', doors: '11 AM', close: '6 PM' },
    { time: '11:30 AM', doors: '11 AM', close: '6 PM' },
  );
  assert.deepEqual(validateFestivalDoc(day).errors, []);
  // The same clock still catches a set that is really outside the window.
  assert.ok(errsOf(runFest({ time: '7 PM', doors: '11 AM', close: '6 PM' }, { time: '11:30 AM', doors: '11 AM', close: '6 PM' }))
    .some((e) => /set time "7 PM" falls outside doors "11 AM" – close "6 PM"/.test(e)));
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

test('the wall renders every Midway set in its run, the tilde exactly where the time is a guess', () => {
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
  // The days are THU FRI SAT SUN, and the run renders as one stack under its
  // venue on Sunday. Data-driven on purpose — the order, the times and which
  // of them are guesses are the file's, never this test's.
  const rules = [...root.querySelectorAll('.day-rule')].map((r) => r.querySelector('.day').textContent);
  assert.deepEqual(rules, ['THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
  const sunday = [...root.querySelectorAll('.day-rule')].find((r) => r.dataset.day === 'Sunday');
  let afters = sunday.nextElementSibling;
  while (afters && !(afters.classList.contains('room') && afters.dataset.room === 'Afters')) afters = afters.nextElementSibling;
  assert.ok(afters, 'Sunday has an AFTERS room');
  const stackOf = (venue) => [...afters.querySelectorAll('.venue-group')]
    .find((g) => g.querySelector('.stage-head .label').textContent === venue);
  const midwayGroup = stackOf('The Midway');
  assert.ok(midwayGroup, 'the Midway is one venue group');
  const bySeq = [...midway].sort((x, y) => x.order.seq - y.order.seq);
  const cards = [...midwayGroup.querySelectorAll('.stack > .card')];
  assert.deepEqual(cards.map((c) => c.dataset.artist), bySeq.map((a) => a.name),
    'every set is its own card, in the run\'s order, top to bottom');
  assert.deepEqual(cards.map((c) => c.dataset.time), bySeq.map((a) => (a.approx === true ? `~${a.time}` : a.time)),
    'a guessed time wears the tilde; a posted one never does');
  assert.ok(cards.every((c) => !c.style.width && !c.style.gridColumn), 'a stack never lane-splits');
  assert.equal(afters.querySelectorAll('.sec-whisper').length, 0,
    'the inline tilde whisper is gone — How it works explains it once (Kevin, 2026-09-17)');
  const hmd = [...root.querySelectorAll('.card')].filter((c) => c.dataset.artist === 'Horse Meat Disco');
  assert.deepEqual(hmd.map((c) => [c.closest('.room').dataset.room, c.querySelector('.time')?.textContent]),
    [['Afters', '9 PM – 3 AM'], ['Folsom', '9 PM – 3 AM']],
    'Friday: one show, two rooms, the same printed window on both cards');
  root.remove();
});
