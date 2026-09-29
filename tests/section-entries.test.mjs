// Where a section's cards sit on the day axis (MODEL-V4 §6).
//
// A SECTION is an artists[].day label that is not one of the grid's days —
// Portola's AFTERS and FOLSOM, ACL's LATE NIGHTS. Under V4 a section either
// plays on a weekday and joins the day tabs (`night`), or carries real dates
// and becomes its own tab (`date`). Those are two different places on the
// screen, so an entry that claims both has given two answers, and an entry
// that claims neither has given none — the wall drops it with nothing said.
// Plus `venue`: a section renders as a stack under the room it happens in.
//
// The pre-V4 `stage: "Thu · Regency Ballroom"` string answers both questions
// and keeps working — files written before the pair existed are still files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFestivalDoc } from '../api/_lib/festival-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// A minimal scheduled fest: one grid day, plus whatever section entries a
// case wants to add.
const withSections = (...sections) => ({
  id: 'x', name: 'X', status: 'scheduled',
  artists: [{ name: 'Headliner', day: 'Friday' }, ...sections],
  days: { Friday: { stages: ['Main'], artists: [{ name: 'Headliner', stage: 'Main', time: '9:00 PM - 10:00 PM' }] } },
});
const NIGHT = { name: 'Soulwax', day: 'Afters', night: 'Thu', venue: 'Regency Ballroom', doors: '7 PM' };
const DATED = { name: 'Fcukers', day: 'Late nights', date: '2026-09-29', venue: 'Mohawk Austin', doors: '7 PM' };

test('a section entry says night (it joins that day) or date (it gets its own tab)', () => {
  assert.deepEqual(validateFestivalDoc(withSections(NIGHT)), { errors: [], warnings: [] });
  assert.deepEqual(validateFestivalDoc(withSections(DATED)), { errors: [], warnings: [] });
});

test('both night and date is two answers to one question', () => {
  const { errors } = validateFestivalDoc(withSections({ ...DATED, night: 'Tue' }));
  assert.ok(errors.some((e) => /\(Fcukers\): night and date/.test(e)), errors.join('\n'));
});

test('neither leaves the card with no day to be on', () => {
  const { errors } = validateFestivalDoc(withSections({ name: 'Nowhere', day: 'Afters', venue: 'Regency Ballroom' }));
  assert.ok(errors.some((e) => /\(Nowhere\): a section entry needs night .* or date/.test(e)), errors.join('\n'));
});

test('a section entry needs its room — the stack is drawn under the venue', () => {
  const { errors } = validateFestivalDoc(withSections({ name: 'Roomless', day: 'Late nights', date: '2026-09-29' }));
  assert.ok(errors.some((e) => /\(Roomless\): a section entry needs venue/.test(e)), errors.join('\n'));
});

test('date is a real calendar date, not a shape', () => {
  for (const bad of ['2026-13-01', '2026-09-31', '2026-9-29', 'Sep 29', '2026-09-29T00:00:00Z']) {
    const { errors } = validateFestivalDoc(withSections({ ...DATED, date: bad }));
    assert.ok(errors.some((e) => /date must be a real YYYY-MM-DD date/.test(e)), `${bad}: ${errors.join('\n')}`);
  }
});

test('one section sits in one place — night entries and date entries never share a label', () => {
  const mixed = withSections(DATED, { ...NIGHT, day: 'Late nights', name: 'Total Wife' });
  const { errors } = validateFestivalDoc(mixed);
  assert.ok(errors.some((e) => /Late nights: some entries say night and some say date/.test(e)), errors.join('\n'));
  // Two sections, one of each, is exactly the Portola-plus-ACL shape.
  assert.deepEqual(validateFestivalDoc(withSections(DATED, NIGHT)).errors, []);
});

test('the legacy "Thu · Venue" stage string still answers both', () => {
  const legacy = { name: 'Soulwax', day: 'Afters', stage: 'Thu · Regency Ballroom', time: '8 PM' };
  assert.deepEqual(validateFestivalDoc(withSections(legacy)), { errors: [], warnings: [] });
  // …and it is still the same answer as the pair, when the pair is there too.
  assert.deepEqual(validateFestivalDoc(withSections({ ...legacy, night: 'Thu', venue: 'Regency Ballroom' })).errors, []);
});

test('two nights of one artist in a dated section are two shows, not a duplicate', () => {
  // Jess Williamson plays ACL Fest Nights twice: Stubb's on Oct 1, the
  // Continental Club on Oct 8. Same name, same section label, two cards under
  // two date rules — the same reappearance an afters set is, and the crew's
  // pick covers both. Only the same name on the same DATE is a dupe.
  const twice = withSections(
    { name: 'Jess Williamson', day: 'Late nights', date: '2026-10-01', venue: "Stubb's", doors: '7 PM' },
    { name: 'Jess Williamson', day: 'Late nights', date: '2026-10-08', venue: 'The Continental Club', doors: '9:30 PM' },
  );
  assert.deepEqual(validateFestivalDoc(twice), { errors: [], warnings: [] });

  const sameNight = validateFestivalDoc(withSections(
    { name: 'Jess Williamson', day: 'Late nights', date: '2026-10-01', venue: "Stubb's", doors: '7 PM' },
    { name: 'Jess Williamson', day: 'Late nights', date: '2026-10-01', venue: "Emo's", doors: '9 PM' },
  ));
  assert.ok(sameNight.warnings.some((w) => /duplicate artist/.test(w)), sameNight.warnings.join('\n'));
});

test('two nights of one artist in a night section are two shows, not a duplicate', () => {
  // Portola Week 2026 bills Strawbry at Monarch on Friday and at The Great
  // Northern on Saturday. A night entry renders inside that night's day, so
  // these are two cards on two days — only the same name on the same NIGHT is
  // a dupe.
  const twice = withSections(
    { name: 'Strawbry', day: 'Afters', night: 'Fri', venue: 'Monarch', doors: '10 PM' },
    { name: 'Strawbry', day: 'Afters', night: 'Sat', venue: 'The Great Northern', doors: '10 PM' },
  );
  assert.deepEqual(validateFestivalDoc(twice), { errors: [], warnings: [] });

  const sameNight = validateFestivalDoc(withSections(
    { name: 'Strawbry', day: 'Afters', night: 'Fri', venue: 'Monarch', doors: '10 PM' },
    { name: 'Strawbry', day: 'Afters', night: 'Fri', venue: 'The Great Northern', doors: '10 PM' },
  ));
  assert.ok(sameNight.warnings.some((w) => /duplicate artist/.test(w)), sameNight.warnings.join('\n'));
});

// LEDGER follow-up 21 (2026-09-29): the run checks keyed a room by its
// weekday `night`, so a dated room (ACL's Late nights: a venue on a DATE)
// had no key and every run check skipped it — two sets claiming one slot,
// a run whose numbering fought its clock, a room with two windows, all
// passed in silence. The ACL prep round ran the same invariants by hand.
// A dated room is keyed by its date: the same checks, the same words.
const RUN = { source: 'https://do512.com/events/2026/9/29/fcukers-w-total-wife-tickets', confirmed: false };
const LATE = (name, extra) => ({ name, day: 'Late nights', date: '2026-09-29', venue: 'Mohawk Austin', doors: '7 PM', close: '12 AM', ...extra });
test('a dated room is a room: its run is checked the way a night room is', () => {
  const good = withSections(
    LATE('Total Wife', { time: '8 PM', order: { seq: 1, of: 2, ...RUN } }),
    LATE('Fcukers', { time: '8:45 PM', approx: true, order: { seq: 2, of: 2, ...RUN } }),
  );
  assert.deepEqual(validateFestivalDoc(good), { errors: [], warnings: [] });
  const say = (...entries) => validateFestivalDoc(withSections(...entries));
  // Two sets in one slot.
  let r = say(LATE('Total Wife', { time: '8 PM', order: { seq: 1, of: 2, ...RUN } }), LATE('Fcukers', { time: '8:45 PM', approx: true, order: { seq: 1, of: 2, ...RUN } }));
  assert.ok(r.errors.some((e) => /Late nights · 2026-09-29 · Mohawk Austin: two sets both claim position 1/.test(e)), r.errors.join('\n'));
  // The numbering and the clock disagree.
  r = say(LATE('Total Wife', { time: '9 PM', order: { seq: 1, of: 2, ...RUN } }), LATE('Fcukers', { time: '8:45 PM', approx: true, order: { seq: 2, of: 2, ...RUN } }));
  assert.ok(r.errors.some((e) => /running order and the clock disagree/.test(e)), r.errors.join('\n'));
  // One room, two windows.
  r = say(LATE('Total Wife', { time: '8 PM', order: { seq: 1, of: 2, ...RUN } }), LATE('Fcukers', { time: '8:45 PM', approx: true, close: '1 AM', order: { seq: 2, of: 2, ...RUN } }));
  assert.ok(r.errors.some((e) => /disagree on close/.test(e)), r.errors.join('\n'));
  // A run of one act.
  r = say(LATE('Total Wife', { time: '8 PM', order: { seq: 1, of: 2, ...RUN } }));
  assert.ok(r.errors.some((e) => /one act in the room carries an order/.test(e)), r.errors.join('\n'));
  // Two timed sets and no order: the doors-time smell.
  r = say(LATE('Total Wife', { time: '8 PM' }), LATE('Fcukers', { time: '8 PM' }));
  assert.ok(r.warnings.some((w) => /Mohawk Austin: all 2 sets say "8 PM"/.test(w)), r.warnings.join('\n'));
  // The same venue on another date is another room.
  r = say(LATE('Total Wife', { time: '8 PM', order: { seq: 1, of: 2, ...RUN } }), LATE('Fcukers', { date: '2026-10-10', time: '8:45 PM', approx: true, order: { seq: 1, of: 2, ...RUN } }));
  assert.ok(!r.errors.some((e) => /both claim/.test(e)), r.errors.join('\n'));
});

test('a fest with no grid has no sections — its whole wall is the lineup', () => {
  // Every archived and lineup-only file in data/festivals is this shape: days
  // like "Friday" on entries that carry nothing else. They are not rooms.
  const lineup = { id: 'x', name: 'X', status: 'lineup', artists: [{ name: 'Kx5', day: 'Friday' }, { name: 'Alesso' }] };
  assert.deepEqual(validateFestivalDoc(lineup), { errors: [], warnings: [] });
});

test('every shipped festival file validates with zero errors', () => {
  const dir = join(ROOT, 'data', 'festivals');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json');
  assert.ok(files.length >= 10, `expected the whole catalog, got ${files.length}`);
  for (const file of files) {
    const fest = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    assert.deepEqual(validateFestivalDoc(fest, { filename: file }).errors, [], file);
  }
});
