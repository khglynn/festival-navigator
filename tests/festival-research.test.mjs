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

test('an archived festival keeps its status when its grid stands', () => {
  const c = { ...withGrid(), status: 'archived' };
  settleGrid(c);
  assert.equal(c.status, 'archived');
  assert.ok(c.days);
});
