// The run guesser (scripts/guess-run-times.mjs): venue norms in, set-time
// guesses out — deterministic, reviewable, never at render time (MODEL-V3
// §5: the guess is data-entry judgment recorded per event).
import test from 'node:test';
import assert from 'node:assert/strict';
import { planRun, planFestival, applyPlans, clockOf, KIND_DEFAULTS } from '../scripts/guess-run-times.mjs';

const members = (...names) => names.map((name, i) => ({ name, seq: i + 1 }));

test('clockOf writes the file\'s own clock strings', () => {
  assert.equal(clockOf(22 * 60), '10 PM');
  assert.equal(clockOf(24 * 60), '12 AM');
  assert.equal(clockOf(24 * 60 + 30), '12:30 AM');
  assert.equal(clockOf(9 * 60), '9 AM');
  assert.equal(clockOf(26 * 60 + 30), '2:30 AM');
});

test('a hall with three acts and no known close: first act an hour after doors, the headliner ends at the kind default, tilde on the close', () => {
  const plan = planRun({ night: 'Fri', doors: '8 PM', close: null, closeApprox: false, members: members('Gelli Haha', 'Jyoty', 'Channel Tres'), profile: { kind: 'hall', close: { default: null }, doorsToFirstActMin: 60, headlinerSetMin: null, supportSetMin: null } });
  assert.equal(plan.close, KIND_DEFAULTS.hall.close);
  assert.equal(plan.closeApprox, true, 'a kind default is a guess');
  assert.deepEqual(plan.times.map((t) => t.time), ['9 PM', '9:45 PM', '10:30 PM']);
  assert.match(plan.closeSource, /kind default/);
});

test('a printed close is kept as printed; the venue\'s headliner length sets the closer', () => {
  const plan = planRun({ night: 'Sun', doors: '10 PM', close: '2 AM', closeApprox: false, members: members('erika b2b sfcowboy', 'Kaytree', 'Ben UFO', 'Overmono'), profile: { kind: 'club', close: { default: '2 AM' }, doorsToFirstActMin: null, headlinerSetMin: 120, supportSetMin: null } });
  assert.equal(plan.close, '2 AM');
  assert.equal(plan.closeApprox, false, 'printed stays printed');
  // Fair share: the two-hour closer shrinks so no support gets under 45 min.
  assert.deepEqual(plan.times.map((t) => t.time), ['10:30 PM', '11:15 PM', '12 AM', '12:45 AM']);
});

test('a weekday-specific close beats the default, and the close names the rule, not one of the registry\'s URLs', () => {
  const profile = { kind: 'club', close: { default: '2 AM', byWeekday: { Fri: '2:30 AM', Sat: '2:30 AM' }, sources: [{ url: 'https://m.yelp.com/biz/monarch-san-francisco', quote: 'Fri-Sat 9:00 PM - 2:30 AM' }] }, doorsToFirstActMin: null, headlinerSetMin: null, supportSetMin: null };
  const sat = planRun({ night: 'Sat', doors: '10 PM', close: null, closeApprox: false, members: members('Clearcast', 'Jigitz'), profile });
  assert.equal(sat.close, '2:30 AM');
  assert.equal(sat.closeApprox, true);
  assert.equal(sat.closeSource, "venue's Sat close", 'the registry keeps the sources; a URL here would read as a page that printed this night\'s end');
  const sun = planRun({ night: 'Sun', doors: '10 PM', close: null, closeApprox: false, members: members('a', 'b'), profile });
  assert.equal(sun.close, '2 AM');
});

test('too many acts for the window: the night is split evenly and nobody gets less than 30 minutes', () => {
  const plan = planRun({ night: 'Sat', doors: '10 PM', close: '1 AM', closeApprox: false, members: members('a', 'b', 'c', 'd', 'e', 'f'), profile: { kind: 'club', close: { default: '2 AM' }, doorsToFirstActMin: 30, headlinerSetMin: 120, supportSetMin: 60 } });
  const mins = plan.times.map((t) => t.min);
  for (let i = 1; i < mins.length; i++) assert.ok(mins[i] - mins[i - 1] >= 30, 'thirty minutes at least');
  assert.ok(mins[mins.length - 1] < 25 * 60, 'the closer starts before the close (1 AM is 25 h on the axis)');
});

test('no close anywhere: acts are spaced by the support length and the close stays unknown', () => {
  const plan = planRun({ night: 'Thu', doors: '8 PM', close: null, closeApprox: false, members: members('a', 'b'), profile: { kind: 'outdoor', close: { default: null }, doorsToFirstActMin: null, headlinerSetMin: null, supportSetMin: 45 } });
  assert.equal(plan.close, null);
  assert.deepEqual(plan.times.map((t) => t.time), ['8:30 PM', '9:15 PM']);
});

test('no doors: nothing can be planned', () => {
  assert.equal(planRun({ night: 'Fri', doors: null, close: null, closeApprox: false, members: members('a', 'b'), profile: null }), null);
});

test('a single act still gets the venue\'s first-act offset and the close', () => {
  const plan = planRun({ night: 'Fri', doors: '10 PM', close: null, closeApprox: false, members: members('Neil Frances'), profile: { kind: 'club', close: { default: '2 AM' }, doorsToFirstActMin: 15, headlinerSetMin: null, supportSetMin: null } });
  assert.deepEqual(plan.times.map((t) => t.time), ['10:15 PM']);
  assert.equal(plan.close, '2 AM');
});

test('a guess already in the file that matches is reported as unchanged, not rewritten', () => {
  const plan = planRun({ night: 'Sun', doors: '10 PM', close: '2 AM', closeApprox: false, members: [{ name: 'a', seq: 1, time: '10:30 PM' }, { name: 'b', seq: 2, time: '12 AM' }], profile: { kind: 'club', close: { default: '2 AM' }, doorsToFirstActMin: 30, headlinerSetMin: 120, supportSetMin: null } });
  assert.deepEqual(plan.times.map((t) => [t.time, t.changed]), [['10:30 PM', false], ['12 AM', false]]);
});

test('an evidenced guess — a listing printed an end the ticket page did not — keeps its tilde and beats the venue default', () => {
  const plan = planRun({ night: 'Sun', doors: '10 PM', close: '3 AM', closeApprox: true, closeSource: 'https://19hz.info/eventlisting_BayArea.php', members: members('a', 'b', 'c', 'd'), profile: { kind: 'club', close: { default: '2 AM' }, doorsToFirstActMin: 30, headlinerSetMin: 90, supportSetMin: null } });
  assert.equal(plan.close, '3 AM');
  assert.equal(plan.closeApprox, true, 'still a guess');
  assert.equal(plan.closeSource, 'https://19hz.info/eventlisting_BayArea.php');
  assert.equal(plan.times.at(-1).time, '1:30 AM', 'the closer ends at the evidenced close');
  // Without a URL the same fields are just a stale guess and the registry wins.
  const stale = planRun({ night: 'Sun', doors: '10 PM', close: '3 AM', closeApprox: true, closeSource: 'kind default (club)', members: members('a', 'b'), profile: { kind: 'club', close: { default: '2 AM' }, doorsToFirstActMin: 30, headlinerSetMin: 90, supportSetMin: null } });
  assert.equal(stale.close, '2 AM');
});

// ---- the file: re-runnable, and a posted time is never touched ----------------------------
// planFestival + applyPlans are what `--write` runs. The two defects they
// guard (2026-09-16 review): a written routine close came back on the next run
// as if a page had printed it for that night, so the registry was never read
// again; and a venue-posted set time was re-guessed and given back its tilde.

const SRC = 'https://example.test/bill';
const set = (name, seq, of, extra = {}) => ({
  name, day: 'Afters', stage: 'Sun · Room', night: 'Sun', venue: 'Room', doors: '10 PM',
  order: { seq, of, source: SRC, confirmed: false }, ...extra,
});
const fest = (...artists) => ({ id: 'x', artists });
const club = (close) => ({ venues: { Room: { kind: 'club', close, doorsToFirstActMin: 30, headlinerSetMin: 120, supportSetMin: null } } });
const clone = (x) => JSON.parse(JSON.stringify(x));

test('a posted set time (no approx) is kept as posted — never re-guessed, never given a tilde', () => {
  const f = fest(
    set('erika b2b sfcowboy', 1, 4, { time: '10:30 PM', approx: true }),
    set('Kaytree', 2, 4, { time: '11:15 PM', approx: true }),
    set('Ben UFO', 3, 4, { time: '12 AM', approx: true }),
    set('Overmono', 4, 4, { time: '12:30 AM' }),
  );
  const reg = club({ default: '2 AM', sources: [{ url: 'https://example.test/hours', quote: 'closes 2 AM' }] });
  const [room] = planFestival(f, reg);
  const overmono = room.plan.times.find((t) => t.name === 'Overmono');
  assert.equal(overmono.time, '12:30 AM', 'the plan reports the posted time, not a guess over it');
  assert.equal(overmono.changed, false);
  applyPlans(planFestival(f, reg));
  const after = f.artists.find((a) => a.name === 'Overmono');
  assert.equal(after.time, '12:30 AM');
  assert.equal(after.approx, undefined, 'no tilde put back');
  assert.deepEqual(f.artists.slice(0, 3).map((a) => [a.time, a.approx]), [['10:30 PM', true], ['11:15 PM', true], ['12 AM', true]], 'the guesses around it are still the guesser\'s');
  assert.ok(f.artists.every((a) => a.close === '2 AM'), 'the room keeps one close on every set');
});

test('a room where every set is posted is left alone entirely — times, close and all', () => {
  const f = fest(
    set('a', 1, 2, { time: '11 PM', close: '3 AM' }),
    set('b', 2, 2, { time: '1 AM', close: '3 AM' }),
  );
  const before = clone(f);
  const [room] = planFestival(f, club({ default: '2 AM' }));
  assert.equal(room.plan, null, 'nothing to guess');
  assert.equal(applyPlans([room]), 0);
  assert.deepEqual(f, before);
});

test('a set with no time yet is guessed — a freshly entered room still gets its clocks', () => {
  const f = fest(set('a', 1, 2), set('b', 2, 2));
  applyPlans(planFestival(f, club({ default: '2 AM' })));
  assert.deepEqual(f.artists.map((a) => [a.time, a.approx]), [['10:30 PM', true], ['12 AM', true]]);
});

test('re-runnable: a routine close the guesser wrote is re-read from the registry next time; a close a page printed for that night is kept', () => {
  const hours = 'https://example.test/venue-hours';
  const listing = 'https://example.test/night-listing';
  // First run: the registry says Sunday closes 2:30 AM.
  const f = fest(set('a', 1, 2), set('b', 2, 2));
  applyPlans(planFestival(f, club({ default: '2 AM', byWeekday: { Sun: '2:30 AM' }, sources: [{ url: hours, quote: 'Sun 9 PM - 2:30 AM' }] })));
  assert.ok(f.artists.every((a) => a.close === '2:30 AM' && a.closeApprox === true));
  // The registry learns more: Sundays close at 2 AM. The next run follows it.
  const [again] = planFestival(f, club({ default: '2 AM', sources: [{ url: hours, quote: 'daily until 2 AM' }] }));
  assert.equal(again.plan.close, '2 AM', 'the routine close was the registry\'s, so the registry decides again');
  // A listing that printed THIS night's end (the Midway's 19hz 10pm-3am) is
  // evidence, even when the same URL is also one of the registry's sources.
  const g = fest(
    set('a', 1, 2, { time: '10:30 PM', approx: true, close: '3 AM', closeApprox: true, closeSource: listing }),
    set('b', 2, 2, { time: '1 AM', approx: true, close: '3 AM', closeApprox: true, closeSource: listing }),
  );
  const reg = club({ default: '2 AM', sources: [{ url: listing, quote: 'Fri: Sep 4 (10pm-2am)' }] });
  applyPlans(planFestival(g, reg));
  const [kept] = planFestival(g, reg);
  assert.equal(kept.plan.close, '3 AM');
  assert.equal(kept.plan.closeSource, listing);
  assert.ok(g.artists.every((a) => a.close === '3 AM' && a.closeSource === listing), 'written back unchanged');
});
