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
  // Storage-blocked: the filter still WORKS for the life of the page —
  // memory is the truth, storage is the copy that survives a reload.
  assert.doesNotThrow(() => filters.savePeopleFilter('portola-2026', ['Kat']));
  assert.deepEqual(filters.loadPeopleFilter('portola-2026'), ['Kat'], 'a blocked store cannot make a chip tap do nothing');
  filters.savePeopleFilter('portola-2026', []);
  assert.deepEqual(filters.loadPeopleFilter('portola-2026'), []);
  assert.doesNotThrow(() => filters.saveSolo('portola-2026', 'Warehouse'));
  assert.equal(filters.loadSolo('portola-2026'), 'Warehouse');
  filters.saveSolo('portola-2026', null);
  assert.equal(filters.loadSolo('portola-2026'), null);
});

test('scheduled search respects the people filter (a list hides, never dims)', () => {
  const root = render(mkCtx({ filterPeople: ['Kat'], query: 'robyn' }));
  assert.equal(root.querySelectorAll('.card').length, 0, "Robyn is not Kat's pick — she does not resurface through search");
  assert.match(root.textContent, /No artists match/);
  root.remove();
  const hit = render(mkCtx({ filterPeople: ['Kat'], query: 'vtss' }));
  assert.equal(hit.querySelectorAll('.card').length, 2, 'VTSS: the Sunday set and the afters card');
  hit.remove();
});

test('columnsTemplate: a soloed stage is wide, everything else (the EE column too) folds to a rail; unknown solo = no solo', () => {
  const stages = ['Pier Stage', 'Crane Stage', 'Warehouse'];
  assert.deepEqual(filters.columnsTemplate(stages, false, null), { template: 'minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr)', solo: null });
  assert.deepEqual(filters.columnsTemplate(stages, true, 'Warehouse'), { template: '34px 34px minmax(150px, 1fr) 34px', solo: 'Warehouse' });
  assert.equal(filters.columnsTemplate(stages, false, 'Renamed Stage').solo, null, 'a remembered stage that no longer exists cannot blank the wall');
});

test('people filter on the timetable: non-matching cards DIM but stay in place; tile sections HIDE non-matches and say so when empty', () => {
  const root = render(mkCtx({ filterPeople: ['Kat'] }));
  const grid = (name) => root.querySelector(`.room[data-bucket=":fest"] .card.cell[data-artist="${name}"]`);
  assert.ok(!grid('VTSS').classList.contains('dim'), "Kat's pick is lit");
  assert.ok(grid('underscores').classList.contains('dim'), 'a card Kat did not pick is dimmed');
  assert.equal(root.querySelectorAll('.room[data-bucket=":fest"] .card.cell').length, 64, 'the clock keeps its shape: every set still renders');
  assert.equal(grid('underscores').getAttribute('role'), 'button', 'a dimmed card is still a tap target');
  // Afters is COLUMNS all week (the consistency law) — a clock, so it dims
  // like the grid: Friday's Despacio is lit, 2manydjs beside it is not, and
  // the night keeps its shape.
  const afters = [...root.querySelectorAll('.room[data-bucket="Afters"] .card.cell')];
  const friDespacio = afters.find((c) => c.dataset.artist === 'Despacio');
  const twomany = afters.find((c) => c.dataset.artist === '2manydjs');
  assert.ok(friDespacio && !friDespacio.classList.contains('dim'), "Kat's afters pick is lit");
  assert.ok(twomany && twomany.classList.contains('dim'), 'an afters set Kat did not pick dims, it does not vanish');
  // Folsom is TILES — a list, so it hides non-matches and says so on every
  // day it appears rather than vanishing.
  const folsom = [...root.querySelectorAll('.room[data-bucket="Folsom"]')];
  assert.ok(folsom.length >= 1);
  for (const room of folsom) {
    assert.equal(room.querySelectorAll('.card').length, 0);
    assert.match(room.querySelector('.section-empty').textContent, /No picks here from Kat/);
  }
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

test('stage solo: the grid strips and every grid share the folded template, folded columns render no cards, the head says how to get back — and venue heads never solo', () => {
  const root = render(mkCtx({ soloStage: 'Warehouse' }));
  // Day-first: each grid day carries its own strip; both wear the solo.
  const strips = [...root.querySelectorAll('.room[data-bucket=":fest"] .stage-strip .times-grid')];
  assert.equal(strips.length, 2, 'one strip per grid day (Saturday, Sunday)');
  for (const strip of strips) {
    assert.equal(strip.style.gridTemplateColumns, '34px 34px minmax(150px, 1fr) 34px 34px');
    const heads = [...strip.querySelectorAll('.stage-head')];
    assert.equal(heads.length, 5);
    assert.equal(heads.filter((h) => h.classList.contains('rail')).length, 4, 'four stages fold to rails');
    const solo = heads.find((h) => h.getAttribute('aria-pressed') === 'true');
    assert.ok(solo && solo.textContent.startsWith('Warehouse'), 'the soloed head is pressed');
    assert.match(solo.textContent, /all stages/, 'and says how to restore');
    assert.equal(heads.every((h) => h.tagName === 'BUTTON'), true, 'stage heads are real buttons');
  }
  for (const grid of root.querySelectorAll('.times-scroll[data-sync="grid"][data-day] .times-grid')) {
    assert.equal(grid.style.gridTemplateColumns, strips[0].style.gridTemplateColumns, 'day grids mirror the strip');
  }
  const names = [...root.querySelectorAll('.room[data-bucket=":fest"] .card.cell')].map((c) => c.dataset.artist);
  assert.equal(names.length, 16, 'only the Warehouse sets render (8 + 8)');
  assert.ok(names.includes('Four Tet') && !names.includes('Robyn'));
  // The solo governs the main grid only (MODEL-V3 §3): an events timetable's
  // venue heads are stage headers in look, never solo buttons, and its
  // columns are untouched by the solo.
  const venueHeads = [...root.querySelectorAll('.room[data-bucket="Afters"] .stage-strip .stage-head')];
  assert.ok(venueHeads.length > 0);
  assert.ok(venueHeads.every((h) => h.tagName === 'DIV' && h.classList.contains('venue') && !h.hasAttribute('aria-pressed')));
  assert.ok([...root.querySelectorAll('.room[data-bucket="Afters"] .times-grid')].every((g) => !g.style.gridTemplateColumns.includes('34px')));
  // Tapping the pressed head asks for null (restore all); tapping a rail asks for that stage.
  const asked = [];
  const root2 = render(mkCtx({ soloStage: 'Warehouse', onSoloStage: (s) => asked.push(s) }));
  const heads2 = [...root2.querySelectorAll('.room[data-bucket=":fest"] .stage-strip .stage-head')];
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

test('scrollspy: a re-wire mid-page claims the day you are actually in, not the first tab', async () => {
  // Both filters repaint the wall, which re-wires the scrollspy. Its first
  // claim used to be "tabs[0]" unconditionally — true at load, a lie after
  // any repaint while scrolled into Sunday, and it stayed wrong until the
  // next scroll event (UI walk, 2026-08-27).
  const { wireScrollspy } = await import('../js/v3/wall.js');
  const hadIO = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  const hadGCS = globalThis.getComputedStyle;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  const nav = document.createElement('div');
  nav.innerHTML = '<button class="day-tab" data-day="Saturday"></button><button class="day-tab" data-day="Sunday"></button>';
  const root = document.createElement('div');
  root.innerHTML = '<div class="day-rule" data-day="Saturday"></div><div class="day-rule" data-day="Sunday"></div>';
  const [sat, sun] = root.querySelectorAll('.day-rule');
  const active = () => [...nav.querySelectorAll('.day-tab')].filter((t) => t.classList.contains('active')).map((t) => t.dataset.day);
  try {
    // fresh load: nothing scrolled, the first day is the honest claim
    let un = wireScrollspy(nav, root);
    assert.deepEqual(active(), ['Saturday']);
    assert.equal(nav.querySelector('[aria-current]').dataset.day, 'Saturday');
    un();
    // re-wire while standing in Sunday: both headers are above the jump offset
    Object.defineProperty(window, 'scrollY', { value: 1505, configurable: true });
    sat.getBoundingClientRect = () => ({ top: -975 });
    sun.getBoundingClientRect = () => ({ top: -162 });
    un = wireScrollspy(nav, root);
    assert.deepEqual(active(), ['Sunday'], 'the claim comes from geometry, not tab order');
    assert.equal(nav.querySelector('[aria-current]').dataset.day, 'Sunday', 'assistive tech hears the same answer');
    un();
  } finally {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    globalThis.IntersectionObserver = hadIO;
    globalThis.getComputedStyle = hadGCS;
  }
});

test('railLabels: four letters of the first word, initials when two stages would read the same', () => {
  assert.deepEqual(filters.railLabels(['Pier', 'Crane', 'Ship', 'Warehouse', 'Despacio']), { Pier: 'Pier', Crane: 'Cran', Ship: 'Ship', Warehouse: 'Ware', Despacio: 'Desp' });
  assert.deepEqual(filters.railLabels(['Bud Light', 'Bud Light Backyard', 'T-Mobile']), { 'Bud Light': 'BL', 'Bud Light Backyard': 'BLB', 'T-Mobile': 'T-Mo' });
  assert.deepEqual(filters.railLabels([' Main  Stage', '🎪 Tent']), { ' Main  Stage': 'Main', '🎪 Tent': '🎪' }, 'leading space and an emoji do not break it');
  assert.deepEqual(filters.railLabels(['Bud Light', 'Bud Lite']), { 'Bud Light': 'BL', 'Bud Lite': 'BL2' }, 'initials that still clash get a digit — two rails never read the same');
  assert.deepEqual(filters.railLabels(['Main Stage', 'Mainstage']), { 'Main Stage': 'MS', Mainstage: 'M' });
});
