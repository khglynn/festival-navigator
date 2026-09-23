// Wall filters: the people filter dims what the selected people did not
// pick, everywhere (ship round, 2026-09-17 — it used to hide in a list). It
// is a view — a dimmed card still takes a tap. Stage solo was deleted the
// same day (Kevin: "this is no longer a thing"); the stage heads are plain
// headers and the timetable is every stage at the one column width.
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
  sort: 'day', query: '', weekend: 'all', filterPeople: [], folded: [], now: new Date('2026-01-01T12:00:00'),
  onTap: () => {}, onOpenNotes: null, onNotesChange: null, onOpenDayNotes: null, ...over,
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
});

test('scheduled search under a people filter: every name that matches answers, dimmed where the person did not pick it', () => {
  const root = render(mkCtx({ filterPeople: ['Kat'], query: 'robyn' }));
  const robyn = [...root.querySelectorAll('.card')];
  assert.equal(robyn.length, 1, "Robyn is not Kat's pick — she still answers the search");
  assert.ok(robyn[0].classList.contains('dim'), 'dimmed, because Kat did not pick her');
  assert.doesNotMatch(root.textContent, /No artists match/);
  root.remove();
  const hit = render(mkCtx({ filterPeople: ['Kat'], query: 'vtss' }));
  const cards = [...hit.querySelectorAll('.card')];
  assert.equal(cards.length, 2, 'VTSS: the Sunday set and the afters card');
  assert.ok(cards.every((c) => !c.classList.contains('dim')), "Kat's pick is lit in both");
  hit.remove();
});

test('the timetable template is every stage at the ONE card column — nothing folds, nothing is wide', () => {
  const layout = computeTimesLayout(portola);
  assert.equal(layout.colsTemplate, 'var(--col-w) var(--col-w) var(--col-w) var(--col-w) var(--col-w)');
  assert.deepEqual(Object.keys(layout).sort(), ['colsTemplate', 'stages'], 'no solo, no rails — the layout says only what the columns are');
  // The whole feature is gone, not switched off: nothing remembers a stage.
  for (const name of ['loadSolo', 'saveSolo', 'columnsTemplate', 'railLabels', 'SOLO_RAIL']) {
    assert.equal(filters[name], undefined, `${name} is deleted`);
  }
});

// One column width everywhere (MODEL-V4 §3a.1). The regression this catches is
// the one Kevin saw: a set card wider than an afters card on every screen,
// because the grid stretched (`minmax(150px, 1fr)` in a full-bleed scroller)
// while the stacks laid out their own floor. The width lives in ONE token, so
// a second width can only appear by writing a second number — and if one is
// written here, this fails.
test('the card column is one token, declared once per breakpoint, and both grids ride it', () => {
  const tokens = readFileSync(join(ROOT, 'assets/v3-tokens.css'), 'utf8');
  const css = readFileSync(join(ROOT, 'assets/v3.css'), 'utf8');
  const decls = tokens.match(/--col-w:\s*[^;]+;/g) || [];
  assert.equal(decls.length, 2, 'exactly two declarations: the phone formula and the 720 width');
  assert.match(decls[1], /176px/, 'at 720 the column is the width the stacks already resolved to');
  assert.equal((css.match(/--col-w:/g) || []).length, 0, 'the component sheet reads the token, never re-declares it');
  assert.match(css, /\.venue-grid \{[^}]*repeat\(auto-fill, var\(--col-w\)\)/, 'the stacks ride the token');
  assert.match(css, /\.venue-grid \{[^}]*justify-content: start/, 'and lay out from the left rather than stretching');
  assert.equal(css.includes('minmax(150px'), false, 'the old 150px column floor is gone from both grids');
  assert.equal(filters.COL, 'var(--col-w)', 'and the timetable template is the same token, not a copy of the number');
});

// Highlighting someone's picks DIMS, never filters (Kevin, 2026-09-17:
// "Deciding to highlight user(s) picks shouldn't work as a filter"). One
// behaviour on the clock, in a stack, in a list: every card renders, and the
// ones the selected people did not pick wear `.dim` — one rule, one class.
test('the people filter dims everywhere and hides nothing: the clock keeps every set, a stack keeps every card, no room goes empty', () => {
  const plain = render(mkCtx());
  const count = (root, sel) => root.querySelectorAll(sel).length;
  const root = render(mkCtx({ filterPeople: ['Kat'] }));
  const grid = (name) => root.querySelector(`.room[data-room=":fest"] .card.cell[data-artist="${name}"]`);
  assert.ok(!grid('VTSS').classList.contains('dim'), "Kat's pick is lit");
  assert.ok(grid('underscores').classList.contains('dim'), 'a card Kat did not pick is dimmed');
  assert.equal(count(root, '.room[data-room=":fest"] .card.cell'), 64, 'the clock keeps its shape: every set still renders');
  assert.equal(grid('underscores').getAttribute('role'), 'button', 'a dimmed card is still a tap target');
  // A stack is the same rule: every card, dimmed where Kat did not pick.
  const afters = [...root.querySelectorAll('.room[data-room="Afters"] .stack > .card')];
  assert.equal(afters.length, count(plain, '.room[data-room="Afters"] .stack > .card'), 'the afters keep every card they have without a filter');
  assert.ok(afters.some((c) => c.dataset.artist === 'Despacio' && !c.classList.contains('dim')), "Kat's afters pick is lit");
  assert.ok(afters.some((c) => c.dataset.artist === '2manydjs' && c.classList.contains('dim')), 'a set Kat did not pick is dimmed, not gone');
  // A room nobody picked in keeps every card, all dimmed — and no empty block.
  const folsom = [...root.querySelectorAll('.room[data-room="Folsom"]')];
  assert.ok(folsom.length >= 1);
  for (const room of folsom) {
    const cards = [...room.querySelectorAll('.card')];
    assert.ok(cards.length > 0, 'the room keeps its cards');
    assert.ok(cards.every((c) => c.classList.contains('dim')));
    assert.equal(room.querySelector('.section-empty'), null, 'nothing says "No picks here" — there is nothing empty');
  }
  assert.equal(count(root, '.card'), count(plain, '.card'), 'the filtered wall has exactly the cards the plain wall has');
  assert.equal(count(root, '.venue-group'), count(plain, '.venue-group'), 'and exactly the groups');
  // One rule, one class: the dim on a cell and the dim on a stack card is the
  // same `.card.dim` — nothing in the stylesheet tells them apart.
  const css = readFileSync(join(ROOT, 'assets/v3.css'), 'utf8');
  assert.equal((css.match(/\.dim\b/g) || []).length, 1, 'one .dim rule');
  assert.match(css, /\.card\.dim \{ opacity: \.28; \}/);
  assert.equal(css.includes('section-empty'), false, 'the empty-room copy has no rule left to wear');
  plain.remove(); root.remove();
});

test('people filter combines: Kat OR Drew lights either’s picks', () => {
  const root = render(mkCtx({ filterPeople: ['Kat', 'Drew'] }));
  const cell = (name) => root.querySelector(`.card.cell[data-artist="${name}"]`);
  assert.ok(!cell('underscores').classList.contains('dim'), "Drew's pick is lit");
  assert.ok(!cell('VTSS').classList.contains('dim'));
  assert.ok(cell('Robyn').classList.contains('dim'), 'a card neither picked stays dim');
  root.remove();
});

// Stage solo is deleted (Kevin, 2026-09-17: "Tap a stage to see only that
// stage … this is no longer a thing, remove it"). A feature nobody can find
// from the screen is a feature to cut: the stage heads are plain headers.
test('a stage head is a plain header: not a button, no aria, no rail, and a tap on it does nothing', () => {
  const root = render(mkCtx());
  const strips = [...root.querySelectorAll('.room[data-room=":fest"] .stage-strip .times-grid')];
  assert.equal(strips.length, 2, 'one strip per grid day (Saturday, Sunday)');
  for (const strip of strips) {
    assert.equal(strip.style.gridTemplateColumns, 'var(--col-w) var(--col-w) var(--col-w) var(--col-w) var(--col-w)');
    const heads = [...strip.querySelectorAll('.stage-head')];
    assert.equal(heads.length, 5);
    for (const h of heads) {
      assert.equal(h.tagName, 'DIV', 'a header, not a control');
      assert.equal(h.hasAttribute('aria-pressed'), false);
      assert.equal(h.hasAttribute('aria-label'), false, 'no "Solo X" for a screen reader either');
      assert.equal(h.classList.contains('rail'), false);
      assert.equal(h.querySelector('.solo-off'), null);
      assert.equal(h.querySelector('.label').textContent, h.title, 'the whole name, never a four-letter rail label');
    }
  }
  for (const grid of root.querySelectorAll('.times-scroll[data-sync="grid"][data-day] .times-grid')) {
    assert.equal(grid.style.gridTemplateColumns, strips[0].style.gridTemplateColumns, 'day grids mirror the strip');
  }
  assert.equal(root.querySelectorAll('.room[data-room=":fest"] .card.cell').length, 64, 'every set renders — no column ever folds');
  // A tap on a head changes nothing on the wall.
  const before = root.innerHTML;
  root.querySelector('.stage-strip .stage-head').click();
  assert.equal(root.innerHTML, before);
  // A venue head on a stack is the same component.
  const venueHeads = [...root.querySelectorAll('.room[data-room="Afters"] .venue-group .stage-head')];
  assert.ok(venueHeads.length > 0);
  assert.ok(venueHeads.every((h) => h.tagName === 'DIV' && h.classList.contains('venue') && !h.hasAttribute('aria-pressed')));
  root.remove();
});

// The stylesheet has no solo left either: a rule for a state nothing can
// enter is a rule waiting to be re-wired by accident.
test('no solo in the stylesheet, no solo in the shell', () => {
  const css = readFileSync(join(ROOT, 'assets/v3.css'), 'utf8');
  for (const sel of ['.solo-off', '.stage-head.rail', 'aria-pressed']) assert.equal(css.includes(sel), false, `${sel} is gone from v3.css`);
  for (const file of ['js/v3/app.js', 'js/v3/wall.js', 'js/v3/filters.js', 'js/v3/settings.js']) {
    assert.equal(/solo/i.test(readFileSync(join(ROOT, file), 'utf8')), false, `${file} knows no solo`);
  }
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
  root.innerHTML = '<div class="day-block" data-day="Saturday"></div><div class="day-block" data-day="Sunday"></div>';
  const [sat, sun] = root.querySelectorAll('.day-block');
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

    // WebKit parks the opening jump a couple of dozen pixels short of where it
    // aimed: Saturday's rule sat at top 24px below --jump-offset while
    // Saturday filled the screen, and a geometry rule that wanted the rule
    // at-or-above the offset lit FRIDAY on the iPhone (real-browser walk,
    // 2026-09-17). Chromium lands exactly, which is why nothing on a desktop
    // ever showed it. One tolerance, not a WebKit branch.
    // Three days, so "the first tab" is never the right answer by accident.
    nav.innerHTML = '<button class="day-tab" data-day="Friday"></button><button class="day-tab" data-day="Saturday"></button><button class="day-tab" data-day="Sunday"></button>';
    root.innerHTML = '<div class="day-block" data-day="Friday"></div><div class="day-block" data-day="Saturday"></div><div class="day-block" data-day="Sunday"></div>';
    const [fri3, sat3, sun3] = root.querySelectorAll('.day-block');
    fri3.getBoundingClientRect = () => ({ top: -800 });   // scrolled well past
    sat3.getBoundingClientRect = () => ({ top: 8 + 24 }); // the iPhone's landing (--jump-offset is unset in jsdom, so 8)
    sun3.getBoundingClientRect = () => ({ top: 900 });
    un = wireScrollspy(nav, root);
    assert.deepEqual(active(), ['Saturday'], 'the day you are looking at, even when the jump parked it a hair low');
    un();
    // A rule genuinely still below the fold is not the day you are standing in.
    sat3.getBoundingClientRect = () => ({ top: 8 + 200 });
    un = wireScrollspy(nav, root);
    assert.deepEqual(active(), ['Friday'], 'the next day has to be nearly here before it counts');
    un();
  } finally {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    globalThis.IntersectionObserver = hadIO;
    globalThis.getComputedStyle = hadGCS;
  }
});

// Seven tabs (ACL) do not fit a phone dock: the row already scrolls, but the
// day you are standing in could sit off its edge — the dock showed FRI 2 /
// SAT 3 while the wall was in LATE NIGHTS (real-browser walk, 2026-09-17).
// The one place the active day changes is where it is brought into view.
test('scrollspy: the day you are in is brought into the middle of its row, on open and on every change', async () => {
  const { wireScrollspy } = await import('../js/v3/wall.js');
  const hadIO = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  const hadGCS = globalThis.getComputedStyle;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  const nav = document.createElement('div');
  nav.innerHTML = '<button class="day-tab" data-day="Saturday"></button><button class="day-tab" data-day="Sunday"></button>';
  const root = document.createElement('div');
  root.innerHTML = '<div class="day-block" data-day="Saturday"></div><div class="day-block" data-day="Sunday"></div>';
  const [sat, sun] = root.querySelectorAll('.day-block');
  const shown = [];
  for (const t of nav.querySelectorAll('.day-tab')) t.scrollIntoView = (o) => shown.push([t.dataset.day, o]);
  const hadRAF = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (fn) => { fn(); return 1; }; // the scroll path, synchronously
  try {
    const un = wireScrollspy(nav, root);
    assert.deepEqual(shown.map(([day]) => day), ['Saturday'], 'the opening day is brought into view');
    assert.equal(shown[0][1].inline, 'center', 'to the middle of the row');
    assert.equal(shown[0][1].block, 'nearest', 'and never by moving the page');

    // A scroll into Sunday moves the row; a second read of the same day does not.
    Object.defineProperty(window, 'scrollY', { value: 1505, configurable: true });
    sat.getBoundingClientRect = () => ({ top: -975 });
    sun.getBoundingClientRect = () => ({ top: -162 });
    window.dispatchEvent(new window.Event('scroll'));
    assert.deepEqual(shown.map(([day]) => day), ['Saturday', 'Sunday'], 'the day changed, so the row did');
    window.dispatchEvent(new window.Event('scroll'));
    assert.deepEqual(shown.map(([day]) => day), ['Saturday', 'Sunday'], 'standing still moves nothing');
    un();
  } finally {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    globalThis.IntersectionObserver = hadIO;
    globalThis.getComputedStyle = hadGCS;
    globalThis.requestAnimationFrame = hadRAF;
  }
});

// Geometry is the ONLY authority (2026-09-17). An IntersectionObserver used to
// sit beside it, selecting any header that entered a band at 10–20% of the
// viewport — and it spoke last, so it won. A probe watched geometry choose
// Saturday and the observer then choose Sunday with the page standing still,
// and since the dock now scrolls itself to the active tab, that disagreement
// moves the row as well as the highlight. The band was there first; the
// geometry rule was added under it precisely because a fling clears the band
// in one frame. One of them had to go, and it is not the one that is always
// right.
test('scrollspy: an observer band cannot overrule the geometry — there is no observer left to speak', async () => {
  const { wireScrollspy } = await import('../js/v3/wall.js');
  const hadIO = globalThis.IntersectionObserver;
  let observed = 0;
  let fire = null;
  globalThis.IntersectionObserver = class {
    constructor(cb) { fire = cb; }
    observe() { observed += 1; }
    disconnect() {}
  };
  const hadGCS = globalThis.getComputedStyle;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  const nav = document.createElement('div');
  nav.innerHTML = '<button class="day-tab" data-day="Saturday"></button><button class="day-tab" data-day="Sunday"></button>';
  const root = document.createElement('div');
  root.innerHTML = '<div class="day-block" data-day="Saturday"></div><div class="day-block" data-day="Sunday"></div>';
  const [sat, sun] = root.querySelectorAll('.day-block');
  const active = () => [...nav.querySelectorAll('.day-tab')].filter((t) => t.classList.contains('active')).map((t) => t.dataset.day);
  try {
    sat.getBoundingClientRect = () => ({ top: -900 });
    sun.getBoundingClientRect = () => ({ top: 600 }); // still well below the fold
    Object.defineProperty(window, 'scrollY', { value: 900, configurable: true });
    const un = wireScrollspy(nav, root);
    assert.deepEqual(active(), ['Saturday'], 'the day filling the screen');
    assert.equal(observed, 0, 'nothing is observed — the band is gone, not merely quiet');
    if (fire) fire([{ isIntersecting: true, target: sun }]);
    assert.deepEqual(active(), ['Saturday'], 'and no second rule can move the tab while the page has not moved');
    un();
  } finally {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    globalThis.IntersectionObserver = hadIO;
    globalThis.getComputedStyle = hadGCS;
  }
});

// The fling is why geometry exists: one scroll event that clears several days
// at once. Nothing has to drift back through anything for the tab to catch up.
test('scrollspy: a fling past two days in one step lands on the day you are in, and a resize re-reads it', async () => {
  const { wireScrollspy } = await import('../js/v3/wall.js');
  const hadIO = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  const hadGCS = globalThis.getComputedStyle;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  const hadRAF = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (fn) => { fn(); return 1; };
  const nav = document.createElement('div');
  nav.innerHTML = ['Thursday', 'Friday', 'Saturday', 'Sunday']
    .map((d) => `<button class="day-tab" data-day="${d}"></button>`).join('');
  const root = document.createElement('div');
  root.innerHTML = ['Thursday', 'Friday', 'Saturday', 'Sunday']
    .map((d) => `<div class="day-block" data-day="${d}"></div>`).join('');
  const rules = [...root.querySelectorAll('.day-block')];
  const active = () => [...nav.querySelectorAll('.day-tab')].filter((t) => t.classList.contains('active')).map((t) => t.dataset.day);
  // Where each rule sits on the page. A scroll moves them all together, which
  // is the one thing a fling does that a slow drag does not do in steps.
  const tops = [0, 2000, 4000, 6000];
  let y = 0;
  const place = () => rules.forEach((r, i) => { r.getBoundingClientRect = () => ({ top: tops[i] - y }); });
  const flingTo = (to) => {
    y = to;
    place();
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    window.dispatchEvent(new window.Event('scroll'));
  };
  try {
    place();
    const un = wireScrollspy(nav, root);
    assert.deepEqual(active(), ['Thursday']);
    // One event, from the top of Thursday to deep inside Sunday — the band an
    // observer watches is three days behind by the time this is delivered.
    flingTo(6200);
    assert.deepEqual(active(), ['Sunday'], 'the last rule you have scrolled past, however fast you got there');
    flingTo(0);
    assert.deepEqual(active(), ['Thursday'], 'and back the same way');
    // A resize re-reads the same rule: the URL bar sliding away must not leave
    // the row naming a day three screens back.
    y = 4100;
    place();
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    window.dispatchEvent(new window.Event('resize'));
    assert.deepEqual(active(), ['Saturday']);
    un();
  } finally {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    globalThis.IntersectionObserver = hadIO;
    globalThis.getComputedStyle = hadGCS;
    globalThis.requestAnimationFrame = hadRAF;
  }
});
