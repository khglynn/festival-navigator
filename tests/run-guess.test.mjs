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

// ---- rooms keyed by DATE, a run of one, and the concert shape (2026-09-26) ------------
// ACL's Late nights is a dated section (MODEL-V4 §6: `date`, never `night`), so
// runsOf() used to find no rooms in it at all and round one laid its times with
// a throwaway script — a guess nobody could reproduce. And a hall laid back from
// a midnight close put a headliner at 12:30 AM behind 7 PM doors.
import { runsOf, weekdayOfIso } from '../scripts/guess-run-times.mjs';

const dated = (name, date, venue, extra = {}) => ({ name, day: 'Late nights', date, venue, doors: '9 PM', ...extra });
const lateFest = (...artists) => ({ id: 'x', days: { Friday: { stages: {} } }, artists });

test('a dated section groups by date + venue: the same room a week apart is two rooms, and each reads its own weekday', () => {
  assert.equal(weekdayOfIso('2026-10-02'), 'Fri');
  assert.equal(weekdayOfIso('2026-09-29'), 'Tue');
  const f = lateFest(
    dated('BUNT.', '2026-10-02', "Emo's", { order: { seq: 2, of: 2, source: SRC, confirmed: false } }),
    dated('Sarah Pederzani', '2026-10-02', "Emo's", { order: { seq: 1, of: 2, source: SRC, confirmed: false } }),
    dated('BUNT.', '2026-10-09', 'The Concourse Project', { order: { seq: 2, of: 2, source: SRC, confirmed: false } }),
    dated('DJ Bad Apple', '2026-10-09', 'The Concourse Project', { order: { seq: 1, of: 2, source: SRC, confirmed: false } }),
  );
  const runs = runsOf(f);
  assert.deepEqual(runs.map((r) => [r.date, r.night, r.venue, r.members.map((m) => m.name)]), [
    ['2026-10-02', 'Fri', "Emo's", ['Sarah Pederzani', 'BUNT.']],
    ['2026-10-09', 'Fri', 'The Concourse Project', ['DJ Bad Apple', 'BUNT.']],
  ]);
  // The weekday reaches the registry's by-weekday close.
  const reg = { venues: { "Emo's": { kind: 'club', close: { default: '2 AM', byWeekday: { Fri: '1 AM' } }, doorsToFirstActMin: 60, headlinerSetMin: null, supportSetMin: null } } };
  const [emos] = planFestival(f, reg);
  assert.equal(emos.plan.close, '1 AM');
  assert.equal(emos.plan.closeSource, "venue's Fri close");
});

test('a room of one act with a clock is a run of one — re-laid, never numbered; a timeless one stays timeless; an unnumbered pair is not guessed', () => {
  const f = lateFest(
    // Claire Rosinkranz's guess, written by hand in round one: the tool re-lays it.
    dated('Claire Rosinkranz', '2026-10-10', '3TEN', { doors: '8 PM', time: '9:30 PM', approx: true }),
    // A room with no clock at all is TIME TBA (MODEL-V3 §5) — Portola's Boys Noize.
    dated('Boys Noize', '2026-10-03', 'Garage', { close: '2 AM' }),
    dated('a', '2026-10-05', 'Room'),
    dated('b', '2026-10-05', 'Room'),
  );
  const runs = runsOf(f);
  assert.deepEqual(runs.map((r) => r.members.map((m) => m.name)), [['Claire Rosinkranz']], 'the unnumbered pair says nothing about who is on when');
  applyPlans(planFestival(f, { venues: { '3TEN': { kind: 'hall', close: { default: null }, doorsToFirstActMin: 60, headlinerSetMin: null, supportSetMin: null } } }));
  const [claire, boys] = f.artists;
  assert.deepEqual([claire.time, claire.approx, claire.order], ['9 PM', true, undefined], 'doors + the venue gap, and still no order');
  assert.equal(boys.time, undefined);
  assert.equal(f.artists[2].time, undefined);
});

test('the registry can pin a room\'s shape: a hall held on the club shape runs back from its close', () => {
  const members = [{ name: 'Rory Phillips', seq: 1 }, { name: 'LAIMA', seq: 2 }, { name: 'Soulwax', seq: 3 }];
  const concert = planRun({ night: 'Thu', doors: '7 PM', members, profile: hall() });
  const pinned = planRun({ night: 'Thu', doors: '7 PM', members, profile: hall({ shape: 'club' }) });
  assert.equal(concert.shape, 'concert');
  assert.deepEqual(concert.times.map((t) => t.time), ['8 PM', '8:45 PM', '9:30 PM']);
  assert.equal(pinned.shape, 'club');
  assert.deepEqual(pinned.times.map((t) => t.time), ['8 PM', '9:15 PM', '10:30 PM'], 'Portola\'s Regency Thursday as it shipped');
});

test('a by-time section has no rooms: its parties are never laid as a run', () => {
  const f = { id: 'x', days: { Friday: { stages: {} } }, dayMeta: { Folsom: { layout: 'by-time' } }, artists: [
    { name: 'Party', day: 'Folsom', night: 'Sat', venue: 'Somewhere', doors: '10 PM' },
  ] };
  assert.deepEqual(runsOf(f), []);
});

const hall = (over = {}) => ({ kind: 'hall', close: { default: null }, doorsToFirstActMin: 60, headlinerSetMin: null, supportSetMin: null, ...over });

test('a concert bill follows its posted opener by the support slot — 7 PM doors does not put the headliner at 12:30 AM', () => {
  // Emo's, Oct 1: Doors 7 / Show 8, The 4411 opening for Palace. Laid back from
  // a 2 AM club close, the old rule put Palace at 12:30 AM.
  const plan = planRun({ night: 'Thu', doors: '7 PM', members: [{ name: 'The 4411', seq: 1, time: '8 PM', posted: true }, { name: 'Palace', seq: 2 }], profile: hall() });
  assert.deepEqual(plan.times.map((t) => t.time), ['8 PM', '8:45 PM']);
  assert.equal(plan.close, '12 AM', 'the window still closes somewhere: the hall default, with its tilde');
  assert.equal(plan.closeApprox, true);
  // The same room laid as a club night runs back from the close — the shape
  // that is right for a DJ night and wrong for a concert.
  const club = planRun({ night: 'Thu', doors: '7 PM', close: '2 AM', members: [{ name: 'The 4411', seq: 1, time: '8 PM', posted: true }, { name: 'Palace', seq: 2 }], profile: { ...hall(), kind: 'club' } });
  assert.equal(club.times[1].time, '12:30 AM');
});

test('a curfew caps a concert: the headliner still plays a full set, and the openers move earlier to fit — never before doors', () => {
  // Stubb's amphitheater, Oct 3: Doors 8, the indoor after-show opens at 11, so
  // the outdoor show is over by 11. Parcels plays 90 minutes and ends there.
  const parcels = planRun({ night: 'Sat', doors: '8 PM', close: '11 PM', closeApprox: true, closeSource: 'https://example.test/after-show', members: [{ name: 'Velvet Trip', seq: 1 }, { name: 'Parcels', seq: 2 }], profile: { ...hall(), kind: 'outdoor', supportSetMin: null } });
  assert.deepEqual(parcels.times.map((t) => t.time), ['8:30 PM', '9:30 PM'], 'Parcels at close − 90; Velvet Trip a support slot ahead, earlier than doors + 60');
  // A curfew so tight the opener would go on before doors: it opens at doors.
  const tight = planRun({ night: 'Tue', doors: '7 PM', close: '9 PM', members: [{ name: 'a', seq: 1 }, { name: 'b', seq: 2 }], profile: { ...hall(), kind: 'outdoor' } });
  assert.equal(tight.times[0].time, '7 PM');
  assert.equal(tight.times[1].time, '7:30 PM', 'thirty minutes at least, even when the curfew wants the headliner sooner');
});

test('a posted set is a fixed point: a guess never lands on or past the posted set that follows it', () => {
  // Devil May Care, Oct 2: Doors 10, Rebecca Black posted at 11:45 PM (her own
  // ticket page), Bambi opening. A 105-minute registry gap — read off the
  // headliner's printed start — put Bambi's guess ON 11:45 PM.
  const members = [{ name: 'Bambi', seq: 1 }, { name: 'Rebecca Black', seq: 2, time: '11:45 PM', posted: true }];
  const bad = planRun({ night: 'Fri', doors: '10 PM', close: '2 AM', members, profile: { kind: 'bar', close: { default: '12 AM' }, doorsToFirstActMin: 105, headlinerSetMin: 135, supportSetMin: null } });
  assert.deepEqual(bad.times.map((t) => t.time), ['11:15 PM', '11:45 PM'], 'held a half hour ahead of the posted set');
  assert.deepEqual(bad.warnings, []);
  // With the gap read as what it is (the headliner's start, not the first
  // act's), the bar default puts Bambi half an hour after doors — the time
  // round one set by hand, now reproduced by the tool.
  const good = planRun({ night: 'Fri', doors: '10 PM', close: '2 AM', members, profile: { kind: 'bar', close: { default: '12 AM' }, doorsToFirstActMin: null, headlinerSetMin: 135, supportSetMin: null } });
  assert.deepEqual(good.times.map((t) => t.time), ['10:30 PM', '11:45 PM']);
});

test('a club night keeps running back from the close: a two-hour headliner at a 2 AM room goes on at midnight', () => {
  // The Concourse Project: 9 PM – 2 AM printed on each night's ticket page;
  // headliners "go on at midnight unless otherwise stated".
  const plan = planRun({ night: 'Fri', doors: '9 PM', close: '2 AM', members: [{ name: 'Riot Ten', seq: 1, time: '9 PM', posted: true }, { name: 'Elephante', seq: 2 }, { name: 'Steve Aoki', seq: 3 }], profile: { kind: 'club', close: { default: '2 AM' }, doorsToFirstActMin: 0, headlinerSetMin: 120, supportSetMin: null } });
  assert.deepEqual(plan.times.map((t) => t.time), ['9 PM', '10:30 PM', '12 AM']);
});

test('dated rooms write back and re-run to the same bytes', () => {
  const f = lateFest(
    dated('Total Wife', '2026-09-29', 'Mohawk Austin', { doors: '7 PM', time: '8 PM', order: { seq: 1, of: 2, source: SRC, confirmed: false } }),
    dated('Fcukers', '2026-09-29', 'Mohawk Austin', { doors: '7 PM', order: { seq: 2, of: 2, source: SRC, confirmed: false } }),
  );
  const reg = { venues: { 'Mohawk Austin': hall({ close: { default: '12 AM' } }) } };
  applyPlans(planFestival(f, reg));
  assert.deepEqual(f.artists.map((a) => [a.name, a.time, a.approx, a.close, a.closeApprox]), [
    ['Total Wife', '8 PM', undefined, '12 AM', true],
    ['Fcukers', '8:45 PM', true, '12 AM', true],
  ]);
  const once = clone(f);
  assert.equal(applyPlans(planFestival(f, reg)), 0, 'nothing left to change');
  assert.deepEqual(f, once);
});

test('a fallback close is a guess: it draws a concert\'s window but pulls no start earlier; the venue\'s own close does', () => {
  // Brushy Street Commons, Oct 3: Doors 9 / Show 9:30, three DJs, no published
  // close. The hall default (12 AM) capping it made three half-hour sets.
  const members = [{ name: '1x333', seq: 1, time: '9:30 PM', posted: true }, { name: 'Directress', seq: 2 }, { name: 'underscores', seq: 3 }];
  const fallback = planRun({ night: 'Sat', doors: '9 PM', members, profile: hall() });
  assert.equal(fallback.closeSource, 'kind default (hall)');
  assert.deepEqual(fallback.times.map((t) => t.time), ['9:30 PM', '10:15 PM', '11 PM']);
  // The same room with the venue's own midnight close: the headliner's full
  // set ends by it, so the bill tightens.
  const known = planRun({ night: 'Sat', doors: '9 PM', members, profile: hall({ close: { default: '12 AM' } }) });
  assert.deepEqual(known.times.map((t) => t.time), ['9:30 PM', '10 PM', '10:30 PM']);
  // A bill that runs past the fallback is laid exactly as if the fallback were
  // not there — first act at doors + gap, a support slot apiece — and the
  // fallback, wrong for this night, is not written: no close at all rather
  // than a window that cuts the closer off. (Review of 09d0bbe: the fallback
  // was still pulling this bill to 10 PM, 10:30, 11 and 11:30.)
  const four = [{ name: 'a', seq: 1 }, { name: 'b', seq: 2 }, { name: 'c', seq: 3 }, { name: 'd', seq: 4 }];
  const late = planRun({ night: 'Sat', doors: '10 PM', members: four, profile: hall() });
  const unbounded = planRun({ night: 'Sat', doors: '10 PM', members: four, profile: { ...hall(), kind: 'outdoor', supportSetMin: 45 } });
  assert.deepEqual(late.times.map((t) => t.time), ['11 PM', '11:45 PM', '12:30 AM', '1:15 AM']);
  assert.deepEqual(late.times.map((t) => t.time), unbounded.times.map((t) => t.time), 'the same bill a room with no close at all gets');
  assert.deepEqual([late.close, late.closeApprox, late.closeSource], [null, false, null]);
});

test('a guessed close the plan no longer has is taken off the room; a printed one is never touched', () => {
  const four = (extra) => ['a', 'b', 'c', 'd'].map((name, i) => dated(name, '2026-10-03', 'Hall', { doors: '10 PM', order: { seq: i + 1, of: 4, source: SRC, confirmed: false }, ...extra }));
  // Written by the old rule: the hall fallback squeezed into the window.
  const f = lateFest(...four({ close: '12 AM', closeApprox: true, closeSource: 'kind default (hall)' }));
  const reg = { venues: { Hall: hall() } };
  applyPlans(planFestival(f, reg));
  assert.ok(f.artists.every((a) => a.close === undefined && a.closeApprox === undefined && a.closeSource === undefined));
  assert.deepEqual(f.artists.map((a) => a.time), ['11 PM', '11:45 PM', '12:30 AM', '1:15 AM']);
  assert.equal(applyPlans(planFestival(f, reg)), 0, 're-runs to the same bytes');
  // A close a page printed is the venue's word: it caps, and it stays.
  const g = lateFest(...four({ close: '2 AM' }));
  applyPlans(planFestival(g, reg));
  assert.ok(g.artists.every((a) => a.close === '2 AM' && a.closeApprox === undefined));
});

test('a close for one date is the registry\'s most specific rule, and the event names the rule — never the URL behind it', () => {
  // Stubb's amphitheater, Oct 1: the indoor after-show opens at 10 PM, so the
  // outdoor show is over by then. That is an inference from another show's
  // page, not a printed end: the registry keeps the page as its source, the
  // event says which rule gave the close (CLAUDE.md, run guesses).
  const afterShow = 'https://stubbsaustin.com/tm-event/official-2026-acl-nights-montclair/';
  const profile = { kind: 'outdoor', close: { default: null, byWeekday: { Thu: '12 AM' }, byDate: { '2026-10-01': '10 PM' }, sources: [{ url: afterShow, quote: 'Doors: 10:00PM. Show: 10:30PM. Free with wristband from Brandon Flowers' }] }, doorsToFirstActMin: 60, headlinerSetMin: null, supportSetMin: null };
  const members = [{ name: 'Jess Williamson', seq: 1, time: '8 PM', posted: true }, { name: 'Brandon Flowers', seq: 2 }];
  const oct1 = planRun({ night: 'Thu', date: '2026-10-01', doors: '7 PM', members, profile });
  assert.deepEqual([oct1.close, oct1.closeApprox, oct1.closeSource], ['10 PM', true, "venue's 2026-10-01 close"]);
  assert.equal(oct1.times[1].time, '8:30 PM', 'a full set before the after-show opens');
  // Another Thursday is just a Thursday.
  const oct8 = planRun({ night: 'Thu', date: '2026-10-08', doors: '7 PM', members, profile });
  assert.equal(oct8.close, '12 AM');
  // Through the file: an old evidenced close carrying the page's URL is not
  // what the tool writes — it names the rule, and re-runs to the same bytes.
  const f = lateFest(
    dated('Jess Williamson', '2026-10-01', "Stubb's", { doors: '7 PM', time: '8 PM', order: { seq: 1, of: 2, source: SRC, confirmed: false } }),
    dated('Brandon Flowers', '2026-10-01', "Stubb's", { doors: '7 PM', order: { seq: 2, of: 2, source: SRC, confirmed: false } }),
  );
  const reg = { venues: { "Stubb's": profile } };
  applyPlans(planFestival(f, reg));
  assert.ok(f.artists.every((a) => a.close === '10 PM' && a.closeApprox === true && a.closeSource === "venue's 2026-10-01 close"));
  assert.ok(f.artists.every((a) => !/^https:/.test(a.closeSource)), 'never the URL');
  assert.equal(applyPlans(planFestival(f, reg)), 0);
});
