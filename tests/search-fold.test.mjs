// Search ignores accents, both ways (v91, 2026-09-25). Friends at Portola
// typed "mull" for MÜLL and "chloe" for Chloé Caillet and got "No artists
// match": the lineup-fest search folded diacritics, but a scheduled fest's
// search (Portola's, every fest with set times) matched raw lowercase. Both
// now go through one match (wall.js searchMatches), which folds BOTH sides
// and never the stored name — a name is a pick key, so the card an answer
// draws must still carry the exact bytes from the festival file.
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
const { renderWall, dayNavOf, applyFilter, searchFold, searchMatches } = await import('../js/v3/wall.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (id) => JSON.parse(readFileSync(join(ROOT, `data/festivals/${id}.json`), 'utf8'));
const portola = read('portola-2026');
const pristine = JSON.stringify(portola);
FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' });
FESTIVALS['portola-2026'] = portola;
state.activateCrew('searchfoldtoken_0123456789', {
  v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 0 } },
  festivals: { 'portola-2026': { selections: {} } }, affinity: {},
}, 'portola-2026');

const render = (query) => {
  state.setActiveFestivalId('portola-2026');
  const root = document.getElementById('wall-root');
  const ctx = {
    fid: 'portola-2026', meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query, weekend: 'all',
    filterPeople: [], folded: [], now: new Date('2026-01-01T12:00:00'),
    picks: model.picksFor(state.crewDoc, 'portola-2026'),
    onOpenNotes: () => {}, onNotesChange: null, onOpenDayNotes: () => {}, onTap: () => {},
  };
  renderWall(root, ctx);
  return { root, ctx };
};
// Each answer as "<day block> <exact stored name>" — the name read off the
// card's data-artist, the pick key a tap writes.
const answersOf = (root) => [...root.querySelectorAll('.card')]
  .map((c) => `${c.closest('.day-block')?.dataset.day || '-'} ${c.dataset.artist}`);

test('the fold: accents off both sides, and the letters NFD leaves whole', () => {
  assert.equal(searchFold('MÜLL'), 'mull');
  assert.equal(searchFold('Chloé Caillet'), 'chloe caillet');
  assert.equal(searchFold('Tiësto'), 'tiesto');
  assert.equal(searchFold('Adéla'), 'adela');
  // Other shipped fests' names NFD alone would miss: a stroke is not a mark.
  assert.equal(searchFold('CØNTRA'), 'contra');
  assert.equal(searchFold('Łaszewo'), 'laszewo');
  assert.equal(searchFold('Høldën'), 'holden');
  // iOS Smart Punctuation types a curly apostrophe into the field.
  assert.equal(searchFold('It’s Murph'), "it's murph");
  assert.equal(searchFold(null), '');
});

test('the match: plain finds accented, accented finds plain, case never matters', () => {
  assert.ok(searchMatches('MÜLL', 'mull'));
  assert.ok(searchMatches('MÜLL', 'Müll'));
  assert.ok(searchMatches('Chloé Caillet', 'chloe'));
  assert.ok(searchMatches('Chloé Caillet', 'CHLOÉ CAI'));
  assert.ok(searchMatches('Overmono', 'Ovérmono'), 'the reverse: an accent typed into the query still finds the plain name');
  assert.ok(searchMatches("It's Murph", 'it’s'), 'a curly apostrophe finds a straight one');
  assert.ok(searchMatches('Tiësto', '  '), 'an all-space query answers everything');
  assert.ok(!searchMatches('MÜLL', 'mulk'), 'a miss is still a miss');
});

test('a lineup fest\'s search (applyFilter) keeps the stored names byte for byte', () => {
  const artists = portola.artists.filter((a) => ['Saturday', 'Sunday'].includes(a.day));
  assert.deepEqual(applyFilter(artists, 'chloe').map((a) => a.name), ['Chloé Caillet']);
  assert.deepEqual(applyFilter(artists, 'TIESTO').map((a) => a.name), ['Tiësto']);
  assert.deepEqual(applyFilter(artists, 'adéla').map((a) => a.name), ['Adéla']);
  assert.equal(applyFilter(artists, '').length, artists.length);
});

test('Portola (a scheduled fest): "mull" finds MÜLL on Friday\'s Folsom night', () => {
  const { root, ctx } = render('mull');
  assert.deepEqual(answersOf(root), ['Friday MÜLL']);
  assert.deepEqual(dayNavOf(portola, ctx, root).map((t) => t.key), ['Friday'], 'the tabs are the days that answered');
  assert.deepEqual(answersOf(render('MÜLL').root), ['Friday MÜLL'], 'typed with its accent, the same answer');
});

test('Portola: "chloe" finds Chloé Caillet on the grid AND at her Saturday afters', () => {
  const { root } = render('chloe');
  assert.deepEqual(answersOf(root), ['Saturday Chloé Caillet', 'Saturday Chloé Caillet']);
  const occs = [...root.querySelectorAll('.card')].map((c) => JSON.parse(c.dataset.occ));
  assert.equal(occs.filter((o) => o.venue === 'Public Works').length, 1, 'one of the two is the Public Works afters');
  assert.deepEqual(answersOf(render('Chloé').root), answersOf(root), 'and the reverse: the accented query, the same answers');
});

test('Portola: Tiësto and Adéla answer plain, and Overmono answers an accented query', () => {
  assert.deepEqual(answersOf(render('tiesto').root), ['Sunday Tiësto']);
  assert.deepEqual(answersOf(render('adela').root), ['Sunday Adéla']);
  assert.deepEqual(answersOf(render('ovérmono').root), ['Sunday Overmono', 'Sunday Overmono'], 'grid set and the Sunday afters');
  const miss = render('mullk').root;
  assert.equal(miss.querySelectorAll('.card').length, 0);
  assert.match(miss.textContent, /No artists match/);
});

test('searching never changes the festival file', () => {
  for (const q of ['mull', 'chloe', 'tiesto', 'ovérmono']) render(q);
  assert.equal(JSON.stringify(portola), pristine);
});
