// A dated show carries its DATE and its VENUE through the card's identity
// (MODEL-V4 §2 + §6: a section entry carries `night` xor `date`, plus
// `venue`, and "the structured pair wins when present").
//
// The bug this pins: ACL's 63 Fest Nights entries have a date, a venue and
// doors and no stage string at all, so an occurrence built from `day · stage ·
// time · weekend` was IDENTICAL for both of an artist's two late nights —
// Jess Williamson plays Oct 1 at Stubb's AND Oct 8 at The Continental Club,
// and one card's zoom could only ever tell the other card's story. A wrong
// fact is worse than a missing one, so the occurrence carries the whole
// identity and every derivation reads the structured fields first.
//
// Read from the SHIPPED festival file, never a hand fixture: the point is
// that the app tells the truth about the data we actually deploy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="wall-root"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.cancelAnimationFrame = () => {};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { occOf, findEventEntry } = await import('../js/v3/events.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const acl = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));

const TOKEN = 'datedocctoken_0123456789';
FESTIVAL_INDEX.push({ id: 'acl-2026', status: 'scheduled' }, { id: 'portola-2026', status: 'scheduled' });
FESTIVALS['acl-2026'] = acl;
FESTIVALS['portola-2026'] = portola;
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 } },
  festivals: { 'acl-2026': { selections: {} }, 'portola-2026': { selections: {} } },
  affinity: {},
}, 'acl-2026');

// The two nights this whole file is about, straight out of the shipped file.
const lateNight = (name, date) => acl.artists.find((a) => a.name === name && a.day === 'Late nights' && a.date === date);
const JESS_1 = lateNight('Jess Williamson', '2026-10-01');
const JESS_8 = lateNight('Jess Williamson', '2026-10-08');
const BUNT_2 = lateNight('BUNT.', '2026-10-02');
const BUNT_9 = lateNight('BUNT.', '2026-10-09');

test('the shipped file really does bill one artist on two nights in two rooms', () => {
  for (const e of [JESS_1, JESS_8, BUNT_2, BUNT_9]) assert.ok(e, 'the pinned late-night entries are still in acl-2026.json');
  assert.equal(JESS_1.venue, "Stubb's");
  assert.equal(JESS_8.venue, 'The Continental Club');
  assert.equal(BUNT_2.venue, 'Emo\'s');
  assert.equal(BUNT_9.venue, 'The Concourse Project');
  // The map doors the whole fix exists to reach.
  for (const e of [JESS_1, JESS_8, BUNT_2, BUNT_9]) assert.ok(acl.venues[e.venue], `venues{} knows ${e.venue}`);
});

// ---- the occurrence ----------------------------------------------------------------

test('occOf carries the date and the venue, so two late nights are two occurrences', () => {
  const a = occOf(JESS_1);
  const b = occOf(JESS_8);
  assert.deepEqual(a, { day: 'Late nights', stage: null, time: null, weekend: null, date: '2026-10-01', venue: 'Stubb\'s' });
  assert.deepEqual(b, { day: 'Late nights', stage: null, time: null, weekend: null, date: '2026-10-08', venue: 'The Continental Club' });
  assert.notEqual(JSON.stringify(a), JSON.stringify(b), 'the identity the wall writes into data-occ differs');
  assert.notEqual(JSON.stringify(occOf(BUNT_2)), JSON.stringify(occOf(BUNT_9)));
});

test('a weekday entry keeps the stage string it always had — nothing legacy moves', () => {
  const vtss = portola.artists.find((a) => a.name === 'VTSS' && a.day === 'Afters');
  assert.deepEqual(occOf(vtss), {
    day: 'Afters', stage: 'Sun · The Midway', time: '11:30 PM', weekend: null,
    date: null, venue: 'The Midway',
  });
  // A file that only carries the structured pair still synthesizes the stage.
  assert.equal(occOf({ day: 'Afters', night: 'Sat', venue: 'The Room' }).stage, 'Sat · The Room');
});

test('findEventEntry resolves each night to its OWN entry', () => {
  assert.equal(findEventEntry(acl, 'Jess Williamson', occOf(JESS_1)), JESS_1);
  assert.equal(findEventEntry(acl, 'Jess Williamson', occOf(JESS_8)), JESS_8);
  assert.equal(findEventEntry(acl, 'BUNT.', occOf(BUNT_2)), BUNT_2);
  assert.equal(findEventEntry(acl, 'BUNT.', occOf(BUNT_9)), BUNT_9);
  // Jess also plays Zilker on the Sunday — the grid billing is a third
  // occurrence and none of the three may answer for another.
  const billing = acl.artists.find((a) => a.name === 'Jess Williamson' && a.day === 'Sunday');
  assert.ok(billing);
  assert.notEqual(findEventEntry(acl, 'Jess Williamson', occOf(JESS_1)), billing);
  // A legacy occurrence (an old route key, a caller that never knew about
  // dates) still matches the way it always did: a missing field asks nothing.
  const legacy = { day: 'Afters', stage: 'Sun · The Midway', time: '11:30 PM', weekend: null };
  assert.equal(findEventEntry(portola, 'VTSS', legacy), portola.artists.find((a) => a.name === 'VTSS' && a.day === 'Afters'));
});
