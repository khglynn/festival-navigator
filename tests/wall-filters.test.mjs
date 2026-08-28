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

test('chip gesture: tap filters, hold arms pick-as, a tap while armed switches, the arm survives a chip rebuild, spectators never arm', () => {
  let clock = 1000;
  const timers = [];
  const setTimer = (fn, ms) => { timers.push({ fn, at: clock + ms }); return timers.length; };
  const clearTimer = (id) => { if (id) timers[id - 1] = null; };
  const fire = (advance) => { clock += advance; for (const t of timers) if (t && t.at <= clock) { t.at = Infinity; t.fn(); } };
  const log = [];
  const wire = (name, canSwitch) => filters.chipGesture(name, {
    canSwitch, onFilter: (n) => log.push(`filter:${n}`), onArmed: (n) => log.push(`armed:${n}`), onSwitch: (n) => log.push(`switch:${n}`),
    now: () => clock, setTimer, clearTimer,
  });
  filters.disarm();
  // a plain tap
  let g = wire('Drew', true);
  g.pointerdown(); fire(100); g.pointerend(); g.click();
  assert.deepEqual(log, ['filter:Drew']);
  // a hold: arms, and the click that ends the hold is swallowed
  g.pointerdown(); fire(600); g.pointerend(); g.click();
  assert.deepEqual(log, ['filter:Drew', 'armed:Drew']);
  assert.equal(filters.armedName(clock), 'Drew');
  // the chip is rebuilt by a remote repaint mid-confirm — the arm is not in the node
  g = wire('Drew', true);
  g.click();
  assert.deepEqual(log, ['filter:Drew', 'armed:Drew', 'switch:Drew']);
  assert.equal(filters.armedName(clock), null, 'switching disarms');
  // an arm that expires falls back to filtering
  g.pointerdown(); fire(600); g.pointerend(); g.click();
  fire(3500);
  g.click();
  assert.equal(log[log.length - 1], 'filter:Drew');
  // arming Ross disarms Drew
  const ross = wire('Ross', true);
  g.pointerdown(); fire(600); g.pointerend(); g.click();
  ross.pointerdown(); fire(600); ross.pointerend(); ross.click();
  assert.equal(filters.armedName(clock), 'Ross');
  g.click();
  assert.equal(log[log.length - 1], 'filter:Drew', "Drew's tap filters — his arm was replaced");
  // a spectator, or your own chip: hold does nothing, tap still filters
  filters.disarm();
  const me = wire('HG', false);
  me.pointerdown(); fire(600); me.pointerend(); me.click();
  assert.equal(log[log.length - 1], 'filter:HG');
  assert.equal(filters.armedName(clock), null);
  // A repaint mid-hold (the row is rebuilt) cancels the hold: the old timer
  // never arms a chip nobody can see, and the release that lands on the
  // new chip is swallowed instead of becoming a filter toggle.
  const before = log.length;
  const old = wire('Drew', true);
  old.pointerdown(); fire(200);
  filters.cancelHold(clock);              // what renderPersonChips does on rebuild
  fire(600);                              // the old timer would have fired here
  assert.equal(filters.armedName(clock), null, 'nothing armed after a cancelled hold');
  const fresh = wire('Drew', true);
  fresh.click();                          // the release of the cancelled hold
  assert.equal(log.length, before, 'the orphaned release is swallowed');
  fire(1000);
  fresh.click();
  assert.equal(log[log.length - 1], 'filter:Drew', 'a real tap a moment later filters as usual');
  // A new press cancels another chip's pending hold and never suppresses its own click.
  old.pointerdown(); fire(100);
  ross.pointerdown(); fire(100); ross.pointerend(); ross.click();
  assert.equal(log[log.length - 1], 'filter:Ross');
  fire(600);
  assert.equal(filters.armedName(clock), null, "Drew's abandoned hold did not arm");
  // Codex round 3, race 1: a deliberate press inside the 800 ms suppression
  // window left by a cancelled hold must still count — the press ends it.
  const n1 = log.length;
  old.pointerdown(); fire(100);
  filters.cancelHold(clock);              // a repaint cancels it → suppression armed
  fire(100);
  const p = wire('Pegah', true);
  p.pointerdown(); fire(50); p.pointerend(); p.click();
  assert.equal(log.length, n1 + 1, 'the fresh press was not swallowed');
  assert.equal(log[log.length - 1], 'filter:Pegah');
  // Codex round 3, race 2: an older pointer's release on the same chip must
  // not clear a newer press's timer — two fingers, or a repaint between
  // press and release, each get their own token.
  const first = wire('Drew', true);
  const second = wire('Drew', true);
  first.pointerdown(); fire(100);
  second.pointerdown(); fire(100);        // supersedes first's hold
  first.pointerend();                     // the OLD release — must not kill the new timer
  fire(500);
  assert.equal(filters.armedName(clock), 'Drew', "the newer press's hold still armed");
  filters.disarm();
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
