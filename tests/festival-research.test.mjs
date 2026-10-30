// The add-a-festival research brings back set times when a published schedule
// prints them (2026-10-30, Freaky Deaky the night before). A researched grid
// stands whole or falls back to the lineup it always was — never a 502 that
// costs the person the lineup, never a half grid that strands a day's artists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { researchPrompt, settleGrid } from '../api/_lib/festival-research.mjs';
import { validateFestivalDoc } from '../api/_lib/festival-rules.mjs';

const base = () => ({
  id: 'freaky-deaky-2026',
  name: 'Freaky Deaky',
  year: "'26",
  location: 'Austin, TX',
  dates: 'Oct 30-31, 2026',
  status: 'lineup',
  artists: [
    { name: 'Hannah Laing', day: 'Friday' },
    { name: 'Liquid Stranger', day: 'Friday' },
    { name: 'Restricted', day: 'Saturday' },
    { name: 'X CLUB.', day: 'Saturday' },
  ],
});

const withGrid = () => ({
  ...base(),
  timezone: 'America/Chicago',
  dayMeta: {
    Friday: { wd: 'Fri', date: 'Oct 30', iso: '2026-10-30' },
    Saturday: { wd: 'Sat', date: 'Oct 31', iso: '2026-10-31' },
  },
  days: {
    Friday: {
      stages: ['The Lab', 'The Circuit'],
      artists: [
        { name: 'Hannah Laing', stage: 'The Lab', time: '9:30 PM - 10:45 PM' },
        { name: 'Liquid Stranger', stage: 'The Circuit', time: '11 PM - 12 AM' },
      ],
    },
    Saturday: {
      stages: ['The Lab', 'The Circuit'],
      artists: [
        { name: 'Restricted', stage: 'The Circuit', time: '10:45 PM - 12 AM' },
        { name: 'X CLUB.', stage: 'The Lab', time: '9:30 PM - 10:45 PM' },
      ],
    },
  },
});

test('the prompt asks for stages and set times, and only from a published schedule', () => {
  const p = researchPrompt('Freaky Deaky 2026');
  for (const k of ['"days"', '"stages"', '"time"', '"dayMeta"', '"timezone"']) assert.ok(p.includes(k), `prompt names ${k}`);
  assert.match(p, /never estimate/i);
  assert.match(p, /character for character/i);
});

test('a lineup with no grid passes through as a lineup, and a stray "scheduled" or grid date is dropped', () => {
  const c = { ...base(), status: 'scheduled', dayMeta: { Friday: { iso: '2026-10-30' } } };
  const { gridNote } = settleGrid(c);
  assert.equal(gridNote, null);
  assert.equal(c.status, 'lineup');
  assert.equal(c.dayMeta, undefined);
  assert.deepEqual(validateFestivalDoc(c).errors, []);
});

test('a whole, valid grid stands and the festival reads as scheduled', () => {
  const c = withGrid();
  const { gridNote } = settleGrid(c);
  assert.equal(gridNote, null);
  assert.equal(c.status, 'scheduled');
  assert.ok(c.days.Saturday);
  assert.deepEqual(validateFestivalDoc(c).errors, []);
});

test('grid spellings line up with the lineup, and acts only the schedule shows join it on their day', () => {
  const c = withGrid();
  c.days.Saturday.artists[1].name = 'X Club.';
  c.days.Saturday.stages.push('The Chamber');
  c.days.Saturday.artists.push({ name: 'Oldgold', stage: 'The Chamber', time: '11 PM - 12 AM' });
  const { gridNote } = settleGrid(c);
  assert.equal(gridNote, null);
  assert.equal(c.days.Saturday.artists[1].name, 'X CLUB.');
  assert.deepEqual(c.artists.at(-1), { name: 'Oldgold', day: 'Saturday' });
  assert.deepEqual(validateFestivalDoc(c).errors, []);
});

test('a grid that misses a day falls back to the lineup and says which day', () => {
  const c = withGrid();
  delete c.days.Friday;
  delete c.dayMeta.Friday;
  c.days.Saturday.artists.push({ name: 'Newcomer', stage: 'The Lab', time: '8 PM' });
  const { gridNote } = settleGrid(c);
  assert.match(gridNote, /Friday/);
  assert.equal(c.status, 'lineup');
  for (const k of ['days', 'dayMeta', 'timezone']) assert.equal(c[k], undefined, `${k} dropped`);
  assert.ok(!c.artists.some((a) => a.name === 'Newcomer'), 'the lineup is restored as researched');
  assert.deepEqual(validateFestivalDoc(c).errors, []);
});

test('a grid the validator refuses falls back to the lineup, with the reason', () => {
  const c = withGrid();
  c.days.Friday.artists[0].time = 'late';
  const { gridNote } = settleGrid(c);
  assert.match(gridNote, /did not check out/);
  assert.equal(c.status, 'lineup');
  assert.equal(c.days, undefined);
  assert.deepEqual(validateFestivalDoc(c).errors, []);
});

test('a lineup day or dayMeta key that differs from the grid by case or spacing takes the grid spelling (the wall matches labels exactly)', () => {
  const c = withGrid();
  c.artists[0].day = 'friday';
  c.artists[2].day = ' SATURDAY ';
  c.dayMeta = { friday: c.dayMeta.Friday, Sat: c.dayMeta.Saturday, Sunday: { wd: 'Sun' } };
  const { gridNote } = settleGrid(c);
  assert.equal(gridNote, null);
  assert.equal(c.artists[0].day, 'Friday');
  assert.equal(c.artists[2].day, 'Saturday');
  assert.deepEqual(Object.keys(c.dayMeta).sort(), ['Friday', 'Saturday']);
  assert.deepEqual(validateFestivalDoc(c).errors, []);
});

test('accents, spacing and a billing extra never mint a second act; only a truly new name joins, and is listed', () => {
  const c = withGrid();
  c.artists.push({ name: 'Tiësto', day: 'Saturday' });
  c.days.Saturday.artists.push({ name: 'Tiesto (DJ Set)', stage: 'The Lab', time: '8 PM - 9:30 PM' });
  c.days.Saturday.artists.push({ name: 'Lazy K (Live)', stage: 'The Circuit', time: '8 PM - 9 PM' });
  const { gridNote, added } = settleGrid(c);
  assert.equal(gridNote, null);
  assert.equal(c.artists.filter((a) => /ti[eë]sto/i.test(a.name)).length, 1);
  assert.equal(c.days.Saturday.artists.at(-2).name, 'Tiësto');
  assert.deepEqual(added, ['Lazy K']);
  assert.deepEqual(c.artists.at(-1), { name: 'Lazy K', day: 'Saturday' });
  assert.deepEqual(validateFestivalDoc(c).errors, []);
});

test('a B2B is its own act: never folded into a solo set, and its parentheses still find the lineup billing', () => {
  const c = withGrid();
  c.artists.push({ name: 'John Summit', day: 'Saturday' }, { name: 'Odd Mob B2B Omnom', day: 'Saturday' });
  c.days.Saturday.stages.push('The Reactor');
  c.days.Saturday.artists.push(
    { name: 'John Summit', stage: 'The Reactor', time: '6 PM - 7 PM' },
    { name: 'John Summit (b2b Dom Dolla)', stage: 'The Reactor', time: '7 PM - 8 PM' },
    { name: 'Odd Mob (B2B Omnom)', stage: 'The Reactor', time: '8 PM - 9 PM' },
  );
  const { gridNote, added } = settleGrid(c);
  assert.equal(gridNote, null);
  assert.deepEqual(added, ['John Summit (b2b Dom Dolla)']);
  assert.equal(c.days.Saturday.artists.at(-1).name, 'Odd Mob B2B Omnom');
  assert.ok(!c.artists.some((a) => a.name === 'Odd Mob'));
  assert.deepEqual(validateFestivalDoc(c).errors, []);
});

test('the validator refuses a grid or dayMeta field of the wrong type, so a saved file cannot throw in the wall', () => {
  const numericWd = withGrid();
  numericWd.dayMeta.Friday.wd = 5;
  assert.ok(validateFestivalDoc(numericWd).errors.some((e) => /wd must be a short string/.test(e)));
  const numericStage = withGrid();
  numericStage.days.Friday.stages.push(7);
  assert.ok(validateFestivalDoc(numericStage).errors.some((e) => /every stage must be a non-empty string/.test(e)));
  const numericName = withGrid();
  numericName.days.Friday.artists[0].name = 42;
  assert.ok(validateFestivalDoc(numericName).errors.some((e) => /name must be a string/.test(e)));
  const c = withGrid();
  c.dayMeta.Friday.wd = 5;
  assert.match(settleGrid(c).gridNote, /did not check out/);
});

test('the lineup-only fallback prompt is the pre-v118 ask', () => {
  const p = researchPrompt('Big Fest 2026', { grid: false });
  assert.ok(!p.includes('"days"'));
  assert.match(p, /COMPLETE announced lineup/);
});

test('an archived festival keeps its status when its grid stands', () => {
  const c = { ...withGrid(), status: 'archived' };
  settleGrid(c);
  assert.equal(c.status, 'archived');
  assert.ok(c.days);
});
