// Wall filters (design options A + D, 2026-08-27): the people filter dims
// non-matching cards on the timetable and hides them on lists; the stage
// solo folds every other column to a rail. Both are views — a dimmed card
// still takes a tap, and a stale solo (a stage that no longer exists) is
// ignored rather than blanking the wall.
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
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
// sessionStorage that THROWS — the storage-blocked shape; the filter must
// survive as a memory-only view.
const denied = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
globalThis.sessionStorage = { getItem: denied, setItem: denied, removeItem: denied };
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const state = await import('../js/state.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderWall, computeTimesLayout } = await import('../js/v3/wall.js');
const filters = await import('../js/v3/filters.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));

FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' });
const picks = {
  VTSS: { Kat: 1, Drew: 1 }, 'Marlon Hoffstadt': { Kat: 1 }, Mochakk: { Kat: 1, Drew: 1 },
  Overmono: { Kat: 1, Drew: 4 }, Despacio: { Kat: 1 }, underscores: { HG: 4, Drew: 1 },
  'Horse Meat Disco': { HG: 4 },
};
state.activateCrew('filterstesttoken_01234567', {
  v: 4, meta: {}, spotify: {}, people: { HG: { colorIndex: 0 }, Kat: { colorIndex: 6 }, Drew: { colorIndex: 3 } },
  festivals: { 'portola-2026': { selections: picks } }, affinity: {},
});
state.FESTIVALS['portola-2026'] = portola;
state.setActiveFestivalId('portola-2026');

const mkCtx = (over = {}) => ({
  fid: 'portola-2026', meName: 'HG', picks, affinity: null, lowPower: true,
  sort: 'day', query: '', weekend: 'all', filterPeople: [], soloStage: null, now: new Date('2026-01-01T12:00:00'),
  onTap: () => {}, onOpenNotes: null, onNotesChange: null, onOpenDayNotes: null, onSoloStage: () => {}, ...over,
});
const render = (ctx) => { const root = document.createElement('div'); document.body.appendChild(root); renderWall(root, ctx); return root; };

test('filters.js: pure helpers — toggle, pass, prune, storage that throws', () => {
  assert.deepEqual(filters.togglePerson([], 'Kat'), ['Kat']);
  assert.deepEqual(filters.togglePerson(['Kat', 'Nhu'], 'Kat'), ['Nhu']);
  assert.equal(filters.passesPeople(picks, 'VTSS', ['Kat']), true);
  assert.equal(filters.passesPeople(picks, 'underscores', ['Kat']), false);
  assert.equal(filters.passesPeople({ X: { Kat: 0 } }, 'X', ['Kat']), false, 'a tombstoned 0 is not a pick');
  assert.equal(filters.passesPeople(picks, 'underscores', []), true, 'no people = no filter');
  assert.deepEqual(filters.pruneToActive(['Kat', 'Gone'], ['Kat', 'HG']), ['Kat']);
  assert.doesNotThrow(() => filters.savePeopleFilter('portola-2026', ['Kat']));
  assert.deepEqual(filters.loadPeopleFilter('portola-2026'), [], 'storage-blocked reads answer empty, never throw');
  assert.doesNotThrow(() => filters.saveSolo('portola-2026', 'Warehouse'));
  assert.equal(filters.loadSolo('portola-2026'), null);
});

test('columnsTemplate: a soloed stage is wide, everything else (the EE column too) folds to a rail; unknown solo = no solo', () => {
  const stages = ['Pier Stage', 'Crane Stage', 'Warehouse'];
  assert.deepEqual(filters.columnsTemplate(stages, false, null), { template: 'minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr)', solo: null });
  assert.deepEqual(filters.columnsTemplate(stages, true, 'Warehouse'), { template: '34px 34px minmax(150px, 1fr) 34px', solo: 'Warehouse' });
  assert.equal(filters.columnsTemplate(stages, false, 'Renamed Stage').solo, null, 'a remembered stage that no longer exists cannot blank the wall');
});

test('people filter on the timetable: non-matching cards DIM but stay in place; sections HIDE non-matches and say so when empty', () => {
  const root = render(mkCtx({ filterPeople: ['Kat'] }));
  const cell = (name) => root.querySelector(`.card.cell[data-artist="${name}"]`);
  assert.ok(!cell('VTSS').classList.contains('dim'), "Kat's pick is lit");
  assert.ok(cell('underscores').classList.contains('dim'), 'a card Kat did not pick is dimmed');
  assert.equal(root.querySelectorAll('.card.cell').length, 64, 'the clock keeps its shape: every set still renders');
  assert.equal(cell('underscores').getAttribute('role'), 'button', 'a dimmed card is still a tap target');
  // Afters: of Kat's picks, Overmono, Despacio and VTSS have afters entries — only those cards render there.
  const aftersRule = [...root.querySelectorAll('.day-rule')].find((r) => r.querySelector('.day').textContent === 'AFTERS');
  const aftersCards = [...aftersRule.nextElementSibling.querySelectorAll('.card')].map((c) => c.dataset.artist);
  assert.deepEqual(aftersCards.sort(), ['Despacio', 'Overmono', 'VTSS']);
  // Folsom: Kat picked nothing there — the section says so instead of vanishing.
  const folsomRule = [...root.querySelectorAll('.day-rule')].find((r) => r.querySelector('.day').textContent === 'FOLSOM');
  assert.equal(folsomRule.nextElementSibling.className, 'section-empty');
  assert.match(folsomRule.nextElementSibling.textContent, /No picks here from Kat/);
  root.remove();
});

test('people filter combines: Kat OR Drew lights either’s picks', () => {
  const root = render(mkCtx({ filterPeople: ['Kat', 'Drew'] }));
  const cell = (name) => root.querySelector(`.card.cell[data-artist="${name}"]`);
  assert.ok(!cell('underscores').classList.contains('dim'), "Drew's pick is lit");
  assert.ok(!cell('VTSS').classList.contains('dim'));
  assert.ok(cell('Robyn').classList.contains('dim'), 'a card neither picked stays dim');
  root.remove();
});

test('stage solo: the strip and every grid share the folded template, folded columns render no cards, the head says how to get back', () => {
  const root = render(mkCtx({ soloStage: 'Warehouse' }));
  const strip = root.querySelector('.stage-strip .times-grid');
  assert.equal(strip.style.gridTemplateColumns, '34px 34px minmax(150px, 1fr) 34px 34px');
  const heads = [...strip.querySelectorAll('.stage-head')];
  assert.equal(heads.length, 5);
  assert.equal(heads.filter((h) => h.classList.contains('rail')).length, 4, 'four stages fold to rails');
  const solo = heads.find((h) => h.getAttribute('aria-pressed') === 'true');
  assert.ok(solo && solo.textContent.startsWith('Warehouse'), 'the soloed head is pressed');
  assert.match(solo.textContent, /all stages/, 'and says how to restore');
  assert.equal(heads.every((h) => h.tagName === 'BUTTON'), true, 'stage heads are real buttons');
  for (const grid of root.querySelectorAll('.times-scroll[data-day] .times-grid')) {
    assert.equal(grid.style.gridTemplateColumns, strip.style.gridTemplateColumns, 'day grids mirror the strip');
  }
  const names = [...root.querySelectorAll('.card.cell')].map((c) => c.dataset.artist);
  assert.equal(names.length, 16, 'only the Warehouse sets render (8 + 8)');
  assert.ok(names.includes('Four Tet') && !names.includes('Robyn'));
  // Tapping the pressed head asks for null (restore all); tapping a rail asks for that stage.
  const asked = [];
  const root2 = render(mkCtx({ soloStage: 'Warehouse', onSoloStage: (s) => asked.push(s) }));
  const heads2 = [...root2.querySelectorAll('.stage-strip .stage-head')];
  heads2.find((h) => h.getAttribute('aria-pressed') === 'true').click();
  heads2.find((h) => h.classList.contains('rail')).click();
  assert.deepEqual(asked, [null, 'Pier Stage']);
  root.remove(); root2.remove();
});

test('no solo: the everyday template, and computeTimesLayout reports solo null', () => {
  const layout = computeTimesLayout(portola, (d) => state.getDayArtists(d, null), null);
  assert.equal(layout.solo, null);
  assert.equal(layout.colsTemplate, 'minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr)');
  const stale = computeTimesLayout(portola, (d) => state.getDayArtists(d, null), 'Gone Stage');
  assert.equal(stale.solo, null, 'a stale solo is ignored');
});
