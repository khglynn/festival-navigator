// The run guesser (scripts/guess-run-times.mjs): venue norms in, set-time
// guesses out — deterministic, reviewable, never at render time (MODEL-V3
// §5: the guess is data-entry judgment recorded per event).
import test from 'node:test';
import assert from 'node:assert/strict';
import { planRun, clockOf, KIND_DEFAULTS } from '../scripts/guess-run-times.mjs';

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

test('a weekday-specific close beats the default, and a registry source is cited', () => {
  const profile = { kind: 'club', close: { default: '2 AM', byWeekday: { Fri: '2:30 AM', Sat: '2:30 AM' }, sources: [{ url: 'https://m.yelp.com/biz/monarch-san-francisco', quote: 'Fri-Sat 9:00 PM - 2:30 AM' }] }, doorsToFirstActMin: null, headlinerSetMin: null, supportSetMin: null };
  const sat = planRun({ night: 'Sat', doors: '10 PM', close: null, closeApprox: false, members: members('Clearcast', 'Jigitz'), profile });
  assert.equal(sat.close, '2:30 AM');
  assert.equal(sat.closeApprox, true);
  assert.equal(sat.closeSource, 'https://m.yelp.com/biz/monarch-san-francisco');
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
