// The Day Image exporter offers the days the WALL shows — grid days, then the
// sections rendered under the grid (afters, Folsom). Flipping Portola to
// scheduled used to shrink its choices to Saturday/Sunday while the wall kept
// rendering 46 afters/Folsom cards (Codex gate, 2026-08-27).
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

test('day image choices mirror the wall: grid days, then AFTERS and FOLSOM', () => {
  assert.deepEqual(dayImageChoices(portola), ['Saturday', 'Sunday', 'Afters', 'Folsom']);
});

test('a grid day exports its sets in clock order with stage · start; a section exports its cards with venue · hours', () => {
  const sat = dayArtistsFor('Saturday');
  assert.equal(sat.length, 32);
  assert.deepEqual(sat[0], { name: 'Airwolf Paradise', time: 'Pier Stage · 1:30 PM' });
  const afters = dayArtistsFor('Afters');
  assert.equal(afters.length, 38, '37 Afters entries + Horse Meat Disco (Afters & Folsom)');
  const hmd = afters.find((a) => a.name === 'Horse Meat Disco');
  assert.equal(hmd.time, 'Fri · Public Works · 9 PM - 3 AM');
  assert.equal(dayArtistsFor('Folsom').length, 8);
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
