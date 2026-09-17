// The data guards added before Portola and ACL (2026-09-16) — mistakes a
// data session can make that the app would render silently wrong:
//   · the two weekend spellings: artists[] says `weekends`, a grid set says
//     `weekend`. Crossed, nothing reads the tag, and the timetable shows both
//     weekends at once — every stage double-booked (ST-3);
//   · a display date typed next to its ISO date and disagreeing with it (the
//     day rule shows one date, the now line keys on the other).
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFestivalDoc } from '../api/_lib/festival-rules.mjs';

// ---- weekends ----------------------------------------------------------------------

const twoWeekends = () => ({
  id: 'x', name: 'X', status: 'scheduled', timezone: 'America/Chicago',
  artists: [{ name: 'Both', day: 'Friday', weekends: 'both' }, { name: 'One', day: 'Friday', weekends: 'W1' }],
  dayMeta: { Friday: { wd: 'Fri', dates: { W1: 'Oct 2', W2: 'Oct 9' }, isos: { W1: '2026-10-02', W2: '2026-10-09' } } },
  days: { Friday: { stages: ['A'], artists: [
    { name: 'Both', stage: 'A', time: '8:00 PM - 9:00 PM' },
    { name: 'One', stage: 'A', time: '9:00 PM - 10:00 PM', weekend: 'W1' },
  ] } },
});

test('a well-formed two-weekend schedule is clean', () => {
  assert.deepEqual(validateFestivalDoc(twoWeekends()), { errors: [], warnings: [] });
});

test('`weekends` on a grid set is an error — the timetable reads `weekend`', () => {
  const fest = twoWeekends();
  const one = fest.days.Friday.artists[1];
  delete one.weekend;
  one.weekends = 'W1';
  const { errors } = validateFestivalDoc(fest);
  assert.ok(errors.some((e) => /Friday\.artists\[1\] \(One\): `weekends` is the lineup's tag — a grid set says `weekend`/.test(e)), errors.join('\n'));
});

test('`weekend` on a lineup entry is an error — artists[] reads `weekends`', () => {
  const fest = twoWeekends();
  fest.artists[1] = { name: 'One', day: 'Friday', weekend: 'W1' };
  const { errors } = validateFestivalDoc(fest);
  assert.ok(errors.some((e) => /artists\[1\] \(One\): `weekend` is a grid set's tag — a lineup entry says `weekends`/.test(e)), errors.join('\n'));
});

test('a lineup split by weekend over a grid with no weekend tags is an error — the wall would show both weekends at once', () => {
  const fest = twoWeekends();
  delete fest.days.Friday.artists[1].weekend;
  const { errors } = validateFestivalDoc(fest);
  assert.ok(errors.some((e) => /artists\[\] tag W1\/W2 but no days\{\} set carries a weekend/.test(e)), errors.join('\n'));
  // A single-weekend fest with no tags anywhere is the common case, and fine.
  const single = twoWeekends();
  for (const a of single.artists) delete a.weekends;
  delete single.days.Friday.artists[1].weekend;
  assert.deepEqual(validateFestivalDoc(single).errors, []);
});

test('a display date that disagrees with its ISO date warns — the day rule and the now line would name different days', () => {
  const fest = twoWeekends();
  fest.dayMeta.Friday.dates.W2 = 'Oct 10';
  const { errors, warnings } = validateFestivalDoc(fest);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /dayMeta\.Friday\.dates\.W2 "Oct 10" is not isos\.W2 2026-10-09 \(Oct 9\)/.test(w)), warnings.join('\n'));
  const single = { ...fest, dayMeta: { Friday: { wd: 'Fri', date: 'Oct 3', iso: '2026-10-02' } } };
  assert.ok(validateFestivalDoc(single).warnings.some((w) => /dayMeta\.Friday\.date "Oct 3" is not iso 2026-10-02 \(Oct 2\)/.test(w)));
  // A section's free-text range with no ISO beside it ("Sep 24-27") is not checked.
  const range = { ...fest, dayMeta: { ...twoWeekends().dayMeta, Afters: { date: 'Sep 24-27' } } };
  assert.deepEqual(validateFestivalDoc(range).warnings, []);
});
