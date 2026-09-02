// The Day Image exporter offers the days the WALL shows. A day-first fest
// (MODEL-V3, 2026-09-01) shows THU FRI SAT SUN, so a day's image holds that
// day's whole content — the grid, then each section's shows that night. A
// fest that is not day-first keeps the older list: grid days, then the
// sections rendered under the grid (afters, Folsom). Flipping Portola to
// scheduled once shrank the choices to Saturday/Sunday while the wall kept
// rendering 46 afters/Folsom cards (Codex gate, 2026-08-27); the review
// round of 2026-09-01 found the same drift again after day-first.
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
const { dayImageChoices, dayArtistsFor } = await import('../js/v3/tools.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));

FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' });
state.activateCrew('dayimagetesttoken_0123456', {
  v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 3 } },
  festivals: { 'portola-2026': { selections: {} } }, affinity: {},
});
state.FESTIVALS['portola-2026'] = portola;
state.setActiveFestivalId('portola-2026');

test('day image choices mirror the day-first wall: THU FRI SAT SUN', () => {
  assert.deepEqual(dayImageChoices(portola), ['Thursday', 'Friday', 'Saturday', 'Sunday']);
});

test('a day exports its whole content in the wall\'s order: the grid in clock order with stage · start, then each section\'s shows as section · venue · time', () => {
  const sat = dayArtistsFor('Saturday');
  assert.equal(sat.length, 32 + 9 + 2, 'the grid, Saturday\'s afters, Saturday\'s Folsom');
  assert.deepEqual(sat[0], { name: 'Airwolf Paradise', time: 'Pier Stage · 1:30 PM' });
  // Saturday's afters open with the Regency's OPENER — the room is a run, so
  // the first card is whoever plays first, not whoever is billed first.
  const satOpener = portola.artists.find((a) => a.night === 'Sat' && a.venue === 'Regency Ballroom' && a.order.seq === 1);
  assert.deepEqual(sat[32], { name: satOpener.name, time: `Afters · Regency Ballroom · ~${satOpener.time}` }, 'the first afters show after the grid, time-sorted, wearing its tilde');
  assert.deepEqual(sat[sat.length - 1], { name: 'PERVERT XXL', time: 'Folsom · The Midway · 10 PM - 6 AM' });
  const thu = dayArtistsFor('Thursday');
  assert.deepEqual(thu, [{ name: 'Soulwax', time: 'Afters · Regency Ballroom · 8 PM' }, { name: 'Black Rave Culture', time: 'Afters · Club Six · 10 PM' }]);
  const fri = dayArtistsFor('Friday');
  assert.deepEqual(fri.filter((a) => a.name === 'Horse Meat Disco').map((a) => a.time),
    ['Afters · Public Works · 9 PM - 3 AM', 'Folsom · Public Works · 9 PM - 3 AM'], 'a combined-day show appears under each of its sections');
  const opener = portola.artists.find((a) => a.night === 'Sun' && a.venue === 'The Midway' && a.order.seq === 1);
  assert.ok(dayArtistsFor('Sunday').some((a) => a.name === opener.name && a.time === `Afters · The Midway · ~${opener.time}`), 'a guessed time wears its tilde');
  assert.deepEqual(dayArtistsFor('Afters'), [], 'a section is not a day any more');
  assert.deepEqual(dayArtistsFor('Nope'), [], 'an unknown day exports nothing rather than throwing');
});

test('a lineup-only fest still exports by billing group', () => {
  FESTIVAL_INDEX.push({ id: 'lineup-only', status: 'lineup' });
  state.FESTIVALS['lineup-only'] = { id: 'lineup-only', name: 'L', status: 'lineup', artists: [{ name: 'A', day: 'Friday' }, { name: 'B' }] };
  state.setActiveFestivalId('lineup-only');
  assert.deepEqual(dayImageChoices(state.fest()), ['', 'Friday']);
  assert.deepEqual(dayArtistsFor('Friday'), [{ name: 'A' }]);
  state.setActiveFestivalId('portola-2026');
});
