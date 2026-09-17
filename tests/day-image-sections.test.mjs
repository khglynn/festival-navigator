// The Day Image exporter offers the days the WALL shows, with the label the
// rail gives them. Portola shows THU FRI SAT SUN, so a day's image holds that
// day's whole content — the grid, then each section's shows that night, venue
// group by venue group. Flipping Portola to scheduled once shrank the choices
// to Saturday/Sunday while the wall kept rendering 46 afters/Folsom cards
// (Codex gate, 2026-08-27); the review round of 2026-09-01 found the same
// drift again, so the exporter reads the wall's own plan and nothing else.
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
const { timeToMinutes } = await import('../js/time.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));

FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' });
state.activateCrew('dayimagetesttoken_0123456', {
  v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 3 } },
  festivals: { 'portola-2026': { selections: {} } }, affinity: {},
});
state.FESTIVALS['portola-2026'] = portola;
state.setActiveFestivalId('portola-2026');

test('day image choices mirror the wall: THU FRI SAT SUN, each labelled as the rail labels it', () => {
  assert.deepEqual(dayImageChoices(portola), [
    { key: 'Thursday', label: 'Thu · Sep 24' }, { key: 'Friday', label: 'Fri · Sep 25' },
    { key: 'Saturday', label: 'Sat · Sep 26' }, { key: 'Sunday', label: 'Sun · Sep 27' }]);
});

test('a day exports its whole content in the wall\'s order: the grid in clock order with stage · start, then each section\'s shows as section · venue · time', () => {
  const sat = dayArtistsFor('Saturday');
  assert.equal(sat.length, 32 + 9 + 2, 'the grid, Saturday\'s afters, Saturday\'s Folsom');
  assert.deepEqual(sat[0], { name: 'Airwolf Paradise', time: 'Pier Stage · 1:30 PM' });
  // Saturday's afters open with whoever plays FIRST — every room is a run, so
  // the export leads with the earliest set, not the biggest name. Derived from
  // the file so a re-read of the bills moves this test with the data.
  const satFirst = portola.artists
    .filter((a) => a.day === 'Afters' && a.night === 'Sat' && a.time)
    .reduce((best, a) => (best && timeToMinutes(best.time) <= timeToMinutes(a.time) ? best : a), null);
  assert.deepEqual(sat[32], { name: satFirst.name, time: `Afters · ${satFirst.venue} · ~${satFirst.time}` },
    'the first afters show after the grid, time-sorted, wearing its tilde');
  assert.deepEqual(sat[sat.length - 1], { name: 'PERVERT XXL', time: 'Folsom · The Midway · 10 PM - 6 AM' });
  // Thursday is two single-act rooms, and they print different things. The
  // Regency's own feed gives Soulwax doors AND a show time, so the export
  // carries the start wearing its tilde; Club Six prints doors only, so
  // Black Rave Culture carries NO clock rather than an invented one. Read
  // from the file, so a re-read of either bill moves this with the data.
  const thu = dayArtistsFor('Thursday');
  const thuFile = (name) => portola.artists.find((a) => a.night === 'Thu' && a.name === name);
  const soulwax = thuFile('Soulwax');
  const brc = thuFile('Black Rave Culture');
  assert.ok(soulwax.time && soulwax.approx && soulwax.doors, 'Soulwax: doors and a guessed start');
  assert.ok(!brc.time && brc.doors, 'Black Rave Culture: doors and no start anybody published');
  assert.deepEqual(thu, [
    { name: 'Soulwax', time: `Afters · ${soulwax.venue} · ~${soulwax.time}` },
    { name: 'Black Rave Culture', time: `Afters · ${brc.venue}` },
  ]);
  const fri = dayArtistsFor('Friday');
  assert.deepEqual(fri.filter((a) => a.name === 'Horse Meat Disco').map((a) => a.time),
    ['Afters · Public Works · 9 PM - 3 AM', 'Folsom · Public Works · 9 PM - 3 AM'], 'a combined-day show appears under each of its sections');
  const opener = portola.artists.find((a) => a.night === 'Sun' && a.venue === 'The Midway' && a.order.seq === 1);
  assert.ok(dayArtistsFor('Sunday').some((a) => a.name === opener.name && a.time === `Afters · The Midway · ~${opener.time}`), 'a guessed time wears its tilde');
  assert.deepEqual(dayArtistsFor('Afters'), [], 'a section is not a day any more');
  assert.deepEqual(dayArtistsFor('Nope'), [], 'an unknown day exports nothing rather than throwing');
});

test('a share image is the wall you see: a hidden room is not in a day\'s image, and a day the fold emptied is not offered', async () => {
  // The fold is viewer-side and lives in the same store the wall reads
  // (fn_fold_v1_<fid>); the exporter used to read the plan with nothing
  // folded, the one surface where "hidden renders nothing" was not true.
  const filters = await import('../js/v3/filters.js');
  filters.saveFolded('portola-2026', ['Afters', 'Folsom']);
  try {
    assert.deepEqual(dayImageChoices(portola).map((d) => d.key), ['Saturday', 'Sunday'], 'Thursday and Friday have nothing visible, so no image is offered for them');
    assert.equal(dayArtistsFor('Saturday').length, 32, 'the grid alone — no afters, no Folsom');
    assert.deepEqual(dayArtistsFor('Thursday'), [], 'a day that is not on the wall exports nothing');
  } finally {
    filters.saveFolded('portola-2026', []);
  }
  assert.equal(dayImageChoices(portola).length, 4, 'and everything is back once the fold clears');
  assert.equal(dayArtistsFor('Saturday').length, 32 + 9 + 2);
});

test('a lineup-only fest still exports by billing group', () => {
  FESTIVAL_INDEX.push({ id: 'lineup-only', status: 'lineup' });
  state.FESTIVALS['lineup-only'] = { id: 'lineup-only', name: 'L', status: 'lineup', artists: [{ name: 'A', day: 'Friday' }, { name: 'B' }] };
  state.setActiveFestivalId('lineup-only');
  assert.deepEqual(dayImageChoices(state.fest()), [{ key: '', label: 'THE LINEUP' }, { key: 'Friday', label: 'FRIDAY' }]);
  assert.deepEqual(dayArtistsFor('Friday'), [{ name: 'A' }]);
  state.setActiveFestivalId('portola-2026');
});

// A fest whose whole lineup is dayless is still a lineup. The exporter asks the
// wall for its plan, and the plan called itself nothing at all when no day and
// no dated section survived — so EDC Orlando drew 106 cards on the wall while
// Settings said "No lineup yet — nothing to export."
test('a fest with no days at all still exports: the shipped EDC Orlando file', () => {
  const edc = JSON.parse(readFileSync(join(ROOT, 'data/festivals/edc-orlando-2026.json'), 'utf8'));
  assert.ok(edc.artists.length > 0 && edc.artists.every((a) => !a.day), 'the file really is one dayless lineup');
  FESTIVAL_INDEX.push({ id: edc.id, status: 'lineup' });
  state.FESTIVALS[edc.id] = edc;
  state.setActiveFestivalId(edc.id);
  try {
    assert.deepEqual(dayImageChoices(edc), [{ key: '', label: 'THE LINEUP' }], 'one choice, and it is the lineup');
    const rows = dayArtistsFor('');
    assert.equal(rows.length, edc.artists.length, 'every billed name is in the image');
    assert.equal(rows[0].name, edc.artists[0].name, 'in billing order, as the wall shows them');
  } finally {
    state.setActiveFestivalId('portola-2026');
  }
});

// A dated section's image is its whole run, so every row has to say WHICH
// NIGHT. Export used to take byDate's values and drop its keys, which turned
// ACL's 63 late-night shows into one undated list — Jess Williamson's two rows
// read "Stubb's" and "The Continental Club" a week apart with no date on
// either, and a screenshot in the group chat could not say which door to use.
test('a dated section exports with its dates: ACL Late nights, as shipped', () => {
  const acl = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
  FESTIVAL_INDEX.push({ id: acl.id, status: 'scheduled' });
  state.FESTIVALS[acl.id] = acl;
  state.setActiveFestivalId(acl.id);
  try {
    assert.ok(dayImageChoices(acl).some((c) => c.key === 'Late nights'), 'the tab is a choice');
    const rows = dayArtistsFor('Late nights');
    const late = acl.artists.filter((a) => a.day === 'Late nights');
    assert.equal(rows.length, late.length, 'every late-night show is in the image');

    const jess = late.filter((a) => a.name === 'Jess Williamson');
    assert.equal(jess.length, 2, 'she really does play two of them, a week apart');
    // Read from the file: the venues are the file's bytes, apostrophe and all.
    assert.deepEqual(rows.filter((r) => r.name === 'Jess Williamson').map((r) => r.time),
      [`Thu · Oct 1 · ${jess[0].venue}`, `Thu · Oct 8 · ${jess[1].venue}`],
      'each row names its own night, then the room');
    assert.ok(rows.every((r) => /^[A-Z][a-z]{2} · [A-Z][a-z]{2} \d+ · /.test(r.time)), 'every row leads with its date');
  } finally {
    state.setActiveFestivalId('portola-2026');
  }
});
