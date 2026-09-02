// The day-first wall (MODEL-V3, 2026-09-01), rendered by the real modules in
// jsdom: the composition on Portola, the strips scoped per timetable, the
// bucket filter's chips and whisper, EVERY venue-night as one vertical run
// (§5's one rule — no lanes, no deck), the run's two-line WHEN in the grown
// card, and the untouched paths — a grid-only fest and Lost Lands render
// exactly as before. jsdom has no animate(), so every motion path here is
// the instant one; the motion is the walker's job.
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
const { renderWall, refreshCard, dayNavOf, cardFor, roomOf } = await import('../js/v3/wall.js');
const facts = await import('../js/v3/card-facts.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const lostlands = JSON.parse(readFileSync(join(ROOT, 'data/festivals/lost-lands-2026.json'), 'utf8'));

const TOKEN = 'eventswalltoken_0123456789';
FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' }, { id: 'lost-lands-2026', status: 'lineup' }, { id: 'grid-only', status: 'scheduled' }, { id: 'tiles-run', status: 'lineup' }, { id: 'approx-run', status: 'lineup' }, { id: 'model-edges', status: 'lineup' }, { id: 'verbose-day', status: 'lineup' });
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 }, Nhu: { colorIndex: 1 } },
  festivals: { 'portola-2026': { selections: { VTSS: { Kevin: 4 }, 'Channel Tres': { Nhu: 3 } } } },
  affinity: {},
}, 'portola-2026');
FESTIVALS['portola-2026'] = portola;
FESTIVALS['lost-lands-2026'] = lostlands;
FESTIVALS['grid-only'] = {
  id: 'grid-only', name: 'Grid Only', status: 'scheduled',
  dayMeta: { Friday: { wd: 'Fri', date: 'Oct 2', iso: '2026-10-02' } }, timezone: 'America/Chicago',
  artists: [{ name: 'One', day: 'Friday' }, { name: 'Two', day: 'Friday' }],
  days: { Friday: { stages: ['A', 'B'], artists: [{ name: 'One', stage: 'A', time: '8:00 PM - 9:00 PM' }, { name: 'Two', stage: 'B', time: '9:00 PM - 10:00 PM' }] } },
};
// A lineup fest whose only section is small enough to be TILES, holding a run.
const SRC = 'https://example.test/poster';
FESTIVALS['tiles-run'] = {
  id: 'tiles-run', name: 'Tiles Run', status: 'lineup',
  dayMeta: { Saturday: { wd: 'Sat', date: 'Oct 3' }, Afters: { date: 'Oct 3' } },
  artists: [
    { name: 'Headliner', day: 'Saturday' },
    { name: 'Opener', day: 'Afters', stage: 'Sat · The Room', night: 'Sat', venue: 'The Room', time: '10 PM', approx: true, doors: '10 PM', close: '1 AM', order: { seq: 1, of: 2, source: SRC, confirmed: true } },
    { name: 'Closer', day: 'Afters', stage: 'Sat · The Room', night: 'Sat', venue: 'The Room', time: '11 PM', approx: true, doors: '10 PM', close: '1 AM', order: { seq: 2, of: 2, source: SRC, confirmed: true } },
    { name: 'Nowhere Yet', day: 'Afters', stage: 'Sat · Elsewhere', night: 'Sat', venue: 'Elsewhere' },
  ],
};

// A lineup fest whose Afters EARN columns (6 timed over 3 venues) and whose
// three sets at V1 are GUESSED and all stamped 10 PM, with no order — the
// room nobody has re-read yet, which is what every Portola room looked like
// before the migration.
FESTIVALS['approx-run'] = {
  id: 'approx-run', name: 'Approx Run', status: 'lineup',
  dayMeta: { Saturday: { wd: 'Sat', date: 'Oct 3' }, Afters: { date: 'Oct 3' } },
  artists: [
    { name: 'Headliner', day: 'Saturday' },
    { name: 'P1', day: 'Afters', night: 'Sat', venue: 'V1', time: '10 PM', approx: true },
    { name: 'P2', day: 'Afters', night: 'Sat', venue: 'V1', time: '10 PM', approx: true },
    { name: 'P3', day: 'Afters', night: 'Sat', venue: 'V1', time: '10 PM', approx: true },
    { name: 'L1', day: 'Afters', night: 'Sat', venue: 'V2', time: '11 PM' },
    { name: 'L2', day: 'Afters', night: 'Sat', venue: 'V2', time: '11 PM' },
    { name: 'S1', day: 'Afters', night: 'Sat', venue: 'V3', time: '9 PM' },
  ],
};

// Afters earns columns on Friday; Saturday's afters are all timeless, and one
// Friday show has a time but no room yet.
FESTIVALS['model-edges'] = {
  id: 'model-edges', name: 'Model Edges', status: 'lineup',
  dayMeta: { Friday: { wd: 'Fri', date: 'Oct 2' }, Afters: { date: 'Oct 2-3' } },
  artists: [
    { name: 'Headliner', day: 'Friday' },
    { name: 'A1', day: 'Afters', night: 'Fri', venue: 'V1', time: '9 PM' },
    { name: 'A2', day: 'Afters', night: 'Fri', venue: 'V1', time: '11 PM' },
    { name: 'B1', day: 'Afters', night: 'Fri', venue: 'V2', time: '10 PM' },
    { name: 'B2', day: 'Afters', night: 'Fri', venue: 'V2', time: '11 PM' },
    { name: 'C1', day: 'Afters', night: 'Fri', venue: 'V3', time: '10 PM' },
    { name: 'C2', day: 'Afters', night: 'Fri', venue: 'V3', time: '12 AM' },
    { name: 'Roomless', day: 'Afters', night: 'Fri', time: '8 PM' },
    { name: 'S1', day: 'Afters', night: 'Sat', venue: 'V1' },
    { name: 'S2', day: 'Afters', night: 'Sat', venue: 'V2' },
  ],
};

// A verbose day key (Lost Lands' shape) on a fest that is day-first.
const WED_KEY = 'Wednesday, Sept 16 (Early Arrival Pre-Party)';
FESTIVALS['verbose-day'] = {
  id: 'verbose-day', name: 'Verbose Day', status: 'lineup',
  artists: [
    { name: 'Chassi', day: WED_KEY },
    { name: 'Late Night', day: 'Afters', night: 'Wed', venue: 'The Barn', time: '11 PM' },
  ],
};

const ctxFor = (fid, over = {}) => {
  const ctx = {
    fid, meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
    filterPeople: [], soloStage: null, bucketsOff: [], now: new Date('2026-01-01T12:00:00'),
    taps: [], toggled: [], opened: [],
    picks: model.picksFor(state.crewDoc, fid),
    onOpenNotes: (a) => ctx.opened.push(a), onNotesChange: null, onOpenDayNotes: () => {}, onSoloStage: () => {},
    onToggleBucket: (k) => ctx.toggled.push(k),
    ...over,
  };
  ctx.onTap = over.onTap || ((artist, el) => { ctx.taps.push(artist); return refreshCard(el, artist, ctx); });
  return ctx;
};
const render = (fid, over = {}) => {
  state.setActiveFestivalId(fid);
  const root = document.getElementById('wall-root');
  const ctx = ctxFor(fid, over);
  renderWall(root, ctx);
  return { root, ctx };
};
const rulesOf = (root) => [...root.querySelectorAll('.day-rule')].map((r) => r.querySelector('.day').textContent);
const roomsUnder = (root, dayKey) => {
  const rule = [...root.querySelectorAll('.day-rule')].find((r) => r.dataset.day === dayKey);
  assert.ok(rule, `no day rule ${dayKey}`);
  const out = [];
  for (let n = rule.nextElementSibling; n && !n.classList.contains('day-rule'); n = n.nextElementSibling) if (n.classList.contains('room')) out.push(n);
  return out;
};
const click = (node) => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const pressAt = (node) => node.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
const key = (k) => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

// ---- the composition ---------------------------------------------------------------

test('Portola is day-first: THU FRI SAT SUN, each day its rooms in order, the tabs the same list', () => {
  const { root, ctx } = render('portola-2026');
  assert.deepEqual(rulesOf(root), ['THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
  assert.deepEqual([...root.querySelectorAll('.day-rule')].map((r) => [r.dataset.day, r.querySelector('.date').textContent, r.dataset.iso]),
    [['Thursday', 'Thu · Sep 24', '2026-09-24'], ['Friday', 'Fri · Sep 25', '2026-09-25'], ['Saturday', 'Sat · Sep 26', '2026-09-26'], ['Sunday', 'Sun · Sep 27', '2026-09-27']]);
  assert.deepEqual(roomsUnder(root, 'Thursday').map((r) => r.dataset.bucket), ['Afters']);
  assert.deepEqual(roomsUnder(root, 'Friday').map((r) => r.dataset.bucket), ['Afters', 'Folsom']);
  assert.deepEqual(roomsUnder(root, 'Saturday').map((r) => r.dataset.bucket), [':fest', 'Afters', 'Folsom']);
  assert.deepEqual(roomsUnder(root, 'Sunday').map((r) => r.dataset.bucket), [':fest', 'Afters', 'Folsom']);
  assert.deepEqual([...root.querySelectorAll('.sec-label')].map((l) => l.textContent),
    ['AFTERS', 'AFTERS', 'FOLSOM', 'PORTOLA', 'AFTERS', 'FOLSOM', 'PORTOLA', 'AFTERS', 'FOLSOM']);
  assert.equal(roomsUnder(root, 'Saturday')[0].querySelector('.sec-sub').textContent, 'Pier 80', 'the festival\'s room says where it is');
  assert.deepEqual(dayNavOf(portola, ctx), [
    { key: 'Thursday', short: 'THU', long: 'THU' }, { key: 'Friday', short: 'FRI', long: 'FRI' },
    { key: 'Saturday', short: 'SAT', long: 'SAT' }, { key: 'Sunday', short: 'SUN', long: 'SUN' }]);
  assert.deepEqual(dayNavOf(portola, { ...ctx, query: 'x' }).map((d) => d.key), ['Saturday', 'Sunday', 'Afters', 'Folsom'], 'searching keeps the search view\'s own headers');
});

test('every timetable carries its OWN sticky strip and scroll group — a grid day\'s stage heads never sit over an afters clock', () => {
  const { root } = render('portola-2026');
  const blocks = [...root.querySelectorAll('.tt-block')];
  assert.equal(blocks.length, 6, 'Thu/Fri/Sat/Sun afters + Sat/Sun grid');
  for (const b of blocks) {
    assert.equal(b.querySelectorAll('.stage-strip').length, 1, 'one strip inside its block');
    const [strip, grid] = [...b.querySelectorAll('.times-scroll')];
    assert.equal(strip.dataset.sync, grid.dataset.sync, 'the strip and its grid share one sync group');
    assert.equal(b.querySelector('.stage-strip .times-grid').style.gridTemplateColumns, b.querySelector('.times-scroll[data-day] .times-grid').style.gridTemplateColumns, 'same column template — heads over their columns');
  }
  const groups = new Set([...root.querySelectorAll('.times-scroll')].map((s) => s.dataset.sync));
  assert.deepEqual([...groups].sort(), ['Afters|Friday', 'Afters|Saturday', 'Afters|Sunday', 'Afters|Thursday', 'grid']);
  // Mirroring stays inside a group: the two grid days follow each other; an afters scroller does not drag the grid.
  const gridScrollers = [...root.querySelectorAll('.times-scroll[data-sync="grid"]')];
  assert.equal(gridScrollers.length, 4, 'two strips + two days');
  const gridDays = gridScrollers.filter((s) => s.hasAttribute('data-day'));
  const gridStrips = gridScrollers.filter((s) => !s.hasAttribute('data-day'));
  assert.equal(gridDays.length, 2);
  gridDays[0].scrollLeft = 120;
  gridDays[0].dispatchEvent(new dom.window.Event('scroll'));
  assert.ok(gridDays.every((s) => s.scrollLeft === 120), 'the two grid days mirror each other');
  // Strips are followers, not scrollers: each day's strip row rides the
  // group's lead day by transform (a CSS scroll timeline in browsers).
  assert.ok(gridStrips.every((s) => s.classList.contains('follows') && s.scrollLeft === 0));
  assert.ok(gridStrips.every((s) => s.querySelector('.times-grid').style.transform === 'translateX(-120px)'), 'both strip rows followed');
  const fri = root.querySelector('.times-scroll[data-sync="Afters|Friday"][data-day]');
  fri.scrollLeft = 300;
  fri.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(gridDays[0].scrollLeft, 120, 'the grid did not move');
  assert.equal(root.querySelector('.times-scroll[data-sync="Afters|Friday"]:not([data-day]) .times-grid').style.transform, 'translateX(-300px)', 'its own strip row did');
  // Event columns are capped; the grid's are not.
  assert.equal(root.querySelector('.times-scroll[data-sync="Afters|Thursday"][data-day] .times-grid').style.gridTemplateColumns, 'repeat(2, minmax(150px, 240px))');
  assert.ok(root.querySelector('.times-scroll[data-sync="grid"][data-day] .times-grid').style.gridTemplateColumns.includes('1fr'));
  // The venue heads wear the stage-header look but are not solo buttons.
  const heads = [...root.querySelectorAll('.tt-block .stage-head.venue')];
  assert.ok(heads.length >= 18);
  assert.ok(heads.every((h) => h.tagName === 'DIV'));
  assert.deepEqual([...root.querySelectorAll('.times-scroll[data-sync="Afters|Thursday"] .stage-head')].map((h) => h.textContent), ['Regency Ballroom', 'Club Six']);
});

test('a night\'s timetable: hour rail from the first set to the last close, tonight\'s iso on the grid so the now line can find it, TIME TBA under it', () => {
  const { root } = render('portola-2026');
  const sun = roomsUnder(root, 'Sunday')[1];
  const grid = sun.querySelector('.times-scroll[data-day] .times-grid');
  assert.equal(grid.dataset.iso, '2026-09-27');
  assert.equal(grid.dataset.tz, 'America/Los_Angeles');
  assert.equal(grid.dataset.startRow, '88', '10 PM');
  assert.equal(grid.dataset.rows, '20', 'to 3 AM (Monarch closes)');
  assert.deepEqual([...sun.querySelectorAll('.hour-label')].map((h) => h.textContent), ['10 PM', '11 PM', '12 AM', '1 AM', '2 AM']);
  const tba = sun.querySelector('.tba');
  assert.ok(tba);
  assert.equal(tba.querySelector('.tba-label').textContent, 'TIME TBA');
  assert.deepEqual([...tba.querySelectorAll('.card')].map((c) => [c.dataset.artist, c.dataset.time]), [['Azzecca', undefined]]);
  // Saturday's afters: four venue columns (Audio and Public Works joined the
  // clock on 2026-09-01 — their show pages print doors 10 PM), and the one
  // room nobody has timed at all is the only TBA tile left.
  const sat = roomsUnder(root, 'Saturday')[1];
  assert.deepEqual([...sat.querySelectorAll('.stage-strip .stage-head')].map((h) => h.textContent),
    ['Public Works', 'Regency Ballroom', 'Audio', 'Monarch'], 'left to right by first set, ties in file order');
  assert.deepEqual([...sat.querySelectorAll('.tba .card')].map((c) => c.dataset.artist), ['Groove Armada']);
});

test('the untouched paths: a grid-only fest renders one page-wide strip and no rooms; Lost Lands stays a lineup wall (WED is a wall-grid — tiles)', () => {
  const grid = render('grid-only').root;
  assert.equal(grid.querySelectorAll('.stage-strip').length, 1);
  assert.equal(grid.querySelector('.stage-strip').parentElement, grid, 'the strip sits at the root, above every day');
  assert.equal(grid.querySelectorAll('.room, .bucket-row, .tt-block, .sec-head').length, 0);
  assert.ok([...grid.querySelectorAll('.times-scroll')].every((s) => !s.dataset.sync));
  const ll = render('lost-lands-2026').root;
  assert.equal(ll.querySelectorAll('.room, .bucket-row').length, 0);
  const rules = rulesOf(ll);
  assert.ok(rules.includes('WEDNESDAY'));
  const wedRule = [...ll.querySelectorAll('.day-rule')].find((r) => r.querySelector('.day').textContent === 'WEDNESDAY');
  assert.ok(wedRule.nextElementSibling.classList.contains('wall-grid'), 'a day rule then a card grid — tiles');
});

// ---- the bucket filter ----------------------------------------------------------------

test('bucket chips: one per room, pressed when on; a tap asks app.js to toggle that key', () => {
  const { root, ctx } = render('portola-2026');
  const chips = [...root.querySelectorAll('.bucket-row .bucket-chip')];
  assert.deepEqual(chips.map((c) => [c.dataset.bucket, c.querySelector('.bc-label').textContent, c.getAttribute('aria-pressed')]),
    [[':fest', 'PORTOLA', 'true'], ['Afters', 'AFTERS', 'true'], ['Folsom', 'FOLSOM', 'true']]);
  assert.equal(root.firstElementChild.className, 'bucket-row', 'the chips lead the wall');
  assert.equal(root.querySelector('.wall-whisper'), null, 'nothing hidden, no whisper');
  click(chips[2]);
  assert.deepEqual(ctx.toggled, ['Folsom']);
});

test('a hidden bucket is gone from EVERY day, its chip reads off, and the foot-whisper is the way back', () => {
  const { root } = render('portola-2026', { bucketsOff: ['Folsom'] });
  assert.equal(root.querySelectorAll('.room[data-bucket="Folsom"]').length, 0);
  assert.equal(root.querySelectorAll('.room[data-bucket="Afters"]').length, 4);
  assert.equal(root.querySelector('.bucket-chip[data-bucket="Folsom"]').getAttribute('aria-pressed'), 'false');
  assert.equal(root.querySelector('.bucket-chip[data-bucket="Folsom"] .bc-check').textContent, '');
  assert.equal(root.querySelector('.wall-whisper').textContent, 'Folsom is hidden — tap its chip to bring it back.');
  const two = render('portola-2026', { bucketsOff: ['Afters', 'Folsom'] }).root;
  assert.equal(two.querySelector('.wall-whisper').textContent, 'Afters and Folsom are hidden — tap their chips to bring them back.');
  assert.deepEqual(rulesOf(two), ['THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'], 'the days stay: a filter is a view of the week, not a new week');
  const thu = [...two.querySelectorAll('.day-rule')][0].nextElementSibling;
  assert.equal(thu.className, 'section-empty');
  assert.equal(thu.textContent, 'Everything on Thursday is hidden — tap a chip at the top to bring it back.');
  const noGrid = render('portola-2026', { bucketsOff: [':fest'] }).root;
  assert.equal(noGrid.querySelectorAll('.room[data-bucket=":fest"]').length, 0);
  assert.equal(noGrid.querySelectorAll('.room[data-bucket="Afters"]').length, 4, 'the people and stage filters are untouched by it — the sections still render');
  assert.equal(noGrid.querySelector('.wall-whisper').textContent, 'Portola is hidden — tap its chip to bring it back.');
});

// ---- every room is a vertical run (MODEL-V3 §5, the one rule) ---------------------------

// The shape the whole round is about, asserted on the DOM the way a person
// reads it: in one venue column, cards stack and never share a band. This is
// deliberately a geometry check and not a "no .deck exists" check — a class
// name can be renamed back in, a column of overlapping cards cannot hide.
const columnsOf = (block) => {
  const grid = block.querySelector('.times-scroll[data-day] .times-grid');
  const cols = new Map();
  for (const cell of grid.querySelectorAll('.card')) {
    const col = Number(cell.style.gridColumn);
    const [row, span] = cell.style.gridRow.split(' / span ').map(Number);
    if (!cols.has(col)) cols.set(col, []);
    cols.get(col).push({ name: cell.dataset.artist, time: cell.dataset.time, row, span, el: cell });
  }
  for (const list of cols.values()) list.sort((a, b) => a.row - b.row);
  return cols;
};
const assertRuns = (block, where) => {
  for (const [col, list] of columnsOf(block)) {
    for (const c of list) {
      assert.equal(c.el.style.width, '', `${where} col ${col}: "${c.name}" is lane-split — an events room never lanes`);
      assert.equal(c.el.style.marginLeft, '', `${where} col ${col}: "${c.name}" is lane-offset`);
      assert.ok(c.span >= 2, `${where} col ${col}: "${c.name}" is under the 30-minute floor`);
    }
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i].row >= list[i - 1].row + list[i - 1].span,
        `${where} col ${col}: "${list[i].name}" sits on top of "${list[i - 1].name}"`);
    }
  }
  assert.equal(block.querySelectorAll('.deck, .deck-ghost, .deck-pill, .deck-panel, .deck-layer').length, 0,
    `${where}: no deck survives anywhere in the DOM`);
};

test('every venue-night on the Portola wall is a vertical run: nothing lanes, nothing decks, nothing overlaps', () => {
  const { root } = render('portola-2026');
  const blocks = [...root.querySelectorAll('.room[data-bucket="Afters"] .tt-block')];
  assert.equal(blocks.length, 4, 'Thu/Fri/Sat/Sun afters');
  blocks.forEach((b, i) => assertRuns(b, `afters ${i}`));
  assert.equal(root.querySelectorAll('.deck, .deck-layer').length, 0, 'the deck is gone from the app');
  // Friday's Regency — the pile that used to be a deck — reads top to bottom
  // in the run's order, each set its own tappable card.
  const fri = columnsOf(blocks[1]);
  const regency = [...fri.values()].find((l) => l.length === 3 && l[0].name === 'Gelli Haha');
  assert.ok(regency, 'the Regency three are one column');
  assert.deepEqual(regency.map((c) => [c.name, c.time]), [['Gelli Haha', '~8 PM'], ['Jyoty', '~9 PM'], ['Channel Tres', '~10 PM']]);
  assert.ok(regency.every((c) => c.el.getAttribute('role') === 'button'), 'every set stays its own tappable card');
  // Sunday's Public Works — the other deck — and the Midway four.
  const sun = columnsOf(blocks[3]);
  const columnLed = (map, first) => [...map.values()].find((l) => l[0].name === first);
  const pw = columnLed(sun, 'erika b2b sfcowboy');
  assert.deepEqual(pw.map((c) => [c.name, c.time]),
    [['erika b2b sfcowboy', '~10 PM'], ['Kaytree', '~11 PM'], ['Ben UFO', '~12 AM'], ['Overmono', '~1 AM']],
    'Kaytree came off the bill and is a card like any other in the room');
  const midway = columnLed(sun, 'MGNA Crrrta');
  assert.deepEqual(midway.map((c) => c.name), ['MGNA Crrrta', 'VTSS', 'Two Shell', 'horsegiirL']);
  // Buck Wilson likewise opens Sunday's Monarch.
  assert.deepEqual(columnLed(sun, 'Buck Wilson').map((c) => c.name), ['Buck Wilson', 'Dean Turnley', 'Silva Bumpa']);
  // Saturday's two formerly timeless rooms are runs on the clock now.
  const sat = columnsOf(blocks[2]);
  assert.deepEqual(columnLed(sat, 'Airwolf Paradise').map((c) => [c.name, c.time]), [['Airwolf Paradise', '~10 PM'], ['Max Styler', '~11 PM']]);
  assert.deepEqual(columnLed(sat, 'Chloé Caillet').map((c) => [c.name, c.time]), [['Chloé Caillet', '~10 PM'], ['Fcukers', '~11 PM']]);
});

test('a room nobody has re-read — three sets, one venue, one time, no order — stacks on the wall instead of piling', () => {
  const { root } = render('approx-run');
  const block = root.querySelector('.room[data-bucket="Afters"] .tt-block');
  assertRuns(block, 'approx-run');
  const cols = columnsOf(block);
  const v1 = [...cols.values()].find((l) => l.length === 3);
  assert.deepEqual(v1.map((c) => [c.name, c.time, c.row, c.span]),
    [['P1', '~10 PM', 5, 2], ['P2', '~10 PM', 7, 2], ['P3', '~10 PM', 9, 2]], // the night opens at 9 PM (S1), so 10 PM is row 5
    'one shared time is the room\'s window, shared out — never one card behind another');
  // The tilde travels, and the whisper follows it exactly once.
  assert.equal(root.querySelectorAll('.room[data-bucket="Afters"] .sec-whisper').length, 1);
  const v2 = [...cols.values()].find((l) => l.length === 2);
  assert.deepEqual(v2.map((c) => [c.name, c.time]), [['L1', '11 PM'], ['L2', '11 PM']], 'no tilde where nothing is guessed');
});

// ---- the run in the zoom (the LOCKED copy) ---------------------------------------------------

test('factsFor a run member: WHEN is the room\'s window, the order is a door; the grid billing of the same name has neither', () => {
  const { ctx } = render('portola-2026');
  const member = portola.artists.find((a) => a.night === 'Sun' && a.venue === 'The Midway' && a.order.seq === 3);
  const f = facts.factsFor(member.name, ctx, { day: member.day, stage: member.stage, time: member.time, weekend: null });
  assert.equal(f.when, 'Sun · Runs 10 PM – ~3 AM', 'the window, with the tilde on the guessed close (19hz printed 3 AM; the ticket page did not — an evidenced guess, 2026-09-02)');
  assert.equal(f.where, 'The Midway');
  assert.equal(f.approx, true);
  assert.deepEqual(f.order, { text: 'Guessing they’re 3rd of 4', url: member.order.source, confirmed: false });
  const billing = facts.factsFor(member.name, ctx, { day: 'Sunday', stage: null, time: null, weekend: null });
  assert.equal(billing.order, null, 'the grid billing is not the run');
  assert.equal(billing.approx, false);
  const plain = facts.factsFor('Fatboy Slim', ctx, { day: 'Afters', stage: 'Sun · 888 Garage', time: '10 PM', weekend: null });
  assert.equal(plain.when, 'Sun · 10 PM');
  assert.equal(plain.order, null);
});

test('the grown card: two lines in one WHEN piece — the window, then the door to the poster; the door never picks; the word goes once confirmed', () => {
  const { ctx } = render('portola-2026');
  const member = portola.artists.find((a) => a.night === 'Sun' && a.venue === 'The Midway' && a.order.seq === 3);
  const f = facts.factsFor(member.name, ctx, { day: member.day, stage: member.stage, time: member.time, weekend: null });
  const card = facts.sheetCard(f, {});
  const sub = card.querySelector('.f-sub');
  assert.ok(sub.classList.contains('f-stack'));
  assert.equal(card.querySelectorAll('.f-sub').length, 1, 'ONE .f-sub — the zoom\'s cascade and refresh key on it');
  assert.equal(sub.querySelector('.f-when').textContent, 'Sun · Runs 10 PM – ~3 AM');
  const door = sub.querySelector('a.f-order');
  assert.equal(door.textContent, 'Guessing they’re 3rd of 4');
  assert.equal(door.getAttribute('href'), member.order.source);
  assert.equal(door.getAttribute('target'), '_blank');
  assert.equal(door.getAttribute('rel'), 'noopener');
  let picked = 0;
  card.addEventListener('click', () => { picked += 1; });
  click(door);
  assert.equal(picked, 0, 'the door stops the click — a door, never a pick');
  assert.equal(card.querySelector('a.f-where').textContent, 'The Midway', 'the venue door is still there under it');
  // Confirmed: the word goes, the door stays.
  const sure = { ...f, order: { text: '3rd of 4', url: f.order.url, confirmed: true } };
  assert.equal(facts.sheetCard(sure, {}).querySelector('a.f-order').textContent, '3rd of 4');
  // A card that is not a run renders WHEN as plain text, as before.
  const plain = facts.sheetCard(facts.factsFor('Fatboy Slim', ctx, { day: 'Afters', stage: 'Sun · 888 Garage', time: '10 PM', weekend: null }), {});
  assert.equal(plain.querySelector('.f-sub').textContent, 'Sun · 10 PM');
  assert.equal(plain.querySelector('.f-order'), null);
});

test('a run inside a TILES section: the tile wears the tilde and the range, one whisper, and a timeless card lands in TIME TBA', () => {
  const { root } = render('tiles-run');
  assert.deepEqual(rulesOf(root), ['SATURDAY']);
  const rooms = roomsUnder(root, 'Saturday');
  assert.deepEqual(rooms.map((r) => r.dataset.bucket), [':fest', 'Afters']);
  assert.deepEqual([...rooms[0].querySelectorAll('.card')].map((c) => c.dataset.artist), ['Headliner']);
  const afters = rooms[1];
  assert.equal(afters.querySelector('.tt-block'), null, 'two shows never earn columns');
  assert.deepEqual([...afters.querySelectorAll('.wall-grid .card')].map((c) => [c.dataset.artist, c.dataset.time]),
    [['Opener', '~10 PM'], ['Closer', '~11 PM'], ['Nowhere Yet', undefined]]);
  assert.ok(afters.querySelector('.tba .card[data-artist="Nowhere Yet"]'), 'the timeless one sits under TIME TBA');
  assert.equal(afters.querySelectorAll('.sec-whisper').length, 1);
});

test('the tilde whisper appears once per NIGHT that carries a guess — three nights on Portola, never on Thursday and never on Folsom', () => {
  const { root } = render('portola-2026');
  const per = {};
  for (const rule of root.querySelectorAll('.day-rule')) {
    let n = 0;
    for (let el = rule.nextElementSibling; el && !el.classList.contains('day-rule'); el = el.nextElementSibling) {
      if (el.classList && el.classList.contains('room')) n += el.querySelectorAll('.sec-whisper').length;
    }
    per[rule.dataset.day] = n;
  }
  assert.deepEqual(per, { Thursday: 0, Friday: 1, Saturday: 1, Sunday: 1 },
    'Thursday has no guessed set; Fri/Sat/Sun each say it once, not once per card and not once per section');
  assert.equal(root.querySelectorAll('.room[data-bucket="Folsom"] .sec-whisper').length, 0, 'nothing in Folsom is a guess');
});

// ---- the zoom's restore target (2026-09-01) ---------------------------------------------

test('a combined-day show is ONE occurrence in TWO rooms — the zoom comes back in the room it was in, not whichever card is first', () => {
  // Horse Meat Disco is day "Afters & Folsom": one show, one pick key, drawn
  // on Friday's afters clock AND as a Folsom tile. Both cards carry the same
  // artist and the same occ by design, so identity alone cannot separate them
  // and cardFor without a room returns document order — which put a zoom
  // standing on the Folsom tile back on the Afters cell, in another room, on
  // another part of the page.
  const { root } = render('portola-2026');
  const both = [...root.querySelectorAll('.card[data-artist="Horse Meat Disco"]')];
  assert.equal(both.length, 2, 'one show, two rooms');
  assert.equal(both[0].dataset.occ, both[1].dataset.occ, 'and one occurrence — the identity really is shared');
  assert.deepEqual(both.map(roomOf), ['Afters', 'Folsom']);
  const occ = JSON.parse(both[0].dataset.occ);
  assert.equal(cardFor(root, 'Horse Meat Disco', occ), both[0], 'no room: document order, as before');
  assert.equal(cardFor(root, 'Horse Meat Disco', occ, { room: 'Folsom' }), both[1], 'the Folsom tile comes back as the Folsom tile');
  assert.equal(cardFor(root, 'Horse Meat Disco', occ, { room: 'Afters' }), both[0]);
  // A room that is no longer on the wall (a bucket just went off) degrades to
  // the plain lookup rather than losing the zoom.
  assert.equal(cardFor(root, 'Horse Meat Disco', occ, { room: 'Nowhere' }), both[0]);
  // And the ordinary case is untouched: one match, room or no room.
  const midway = portola.artists.find((a) => a.venue === 'The Midway' && a.order && a.order.seq === 1);
  const mOcc = { day: midway.day, stage: midway.stage, time: midway.time, weekend: null };
  const only = cardFor(root, midway.name, mOcc);
  assert.ok(only);
  assert.equal(cardFor(root, midway.name, mOcc, { room: 'Folsom' }), only, 'a wrong room never loses the only match');
  // The grid billing of the same name is a DIFFERENT occurrence and stays so.
  assert.notEqual(cardFor(root, midway.name, { day: 'Sunday', stage: null, time: null, weekend: null }), only);
});

// ---- the review round (2026-09-01): the buckets ----------------------------------------

test('a stored bucket key the fest no longer offers is ignored — no ghost whisper, no empty day', () => {
  const stale = render('portola-2026', { bucketsOff: ['Gone Section'] }).root;
  assert.equal(stale.querySelector('.wall-whisper'), null, 'nothing real is hidden, so nothing is said');
  assert.equal(stale.querySelectorAll('.section-empty').length, 0);
  assert.equal(stale.querySelectorAll('.room[data-bucket="Afters"]').length, 4);
  const mixed = render('portola-2026', { bucketsOff: ['Gone Section', 'Folsom'] }).root;
  assert.equal(mixed.querySelector('.wall-whisper').textContent, 'Folsom is hidden — tap its chip to bring it back.', 'only the real room is named');
  assert.equal(mixed.querySelectorAll('.room[data-bucket="Folsom"]').length, 0);
});

// ---- the review round (2026-09-01): the model's wall shapes --------------------------------

test('a night with nothing for the clock renders as tiles, and a timed show with no room keeps its time under VENUE TBA', () => {
  const { root } = render('model-edges');
  assert.deepEqual(rulesOf(root), ['FRIDAY', 'SATURDAY']);
  const fri = roomsUnder(root, 'Friday').find((r) => r.dataset.bucket === 'Afters');
  assert.ok(fri.querySelector('.tt-block'), 'Friday earns its clock');
  const venueTba = [...fri.querySelectorAll('.tba')].find((b) => b.querySelector('.tba-label').textContent === 'VENUE TBA');
  assert.ok(venueTba, 'the roomless show has its own quiet row');
  assert.deepEqual([...venueTba.querySelectorAll('.card')].map((c) => [c.dataset.artist, c.dataset.time]), [['Roomless', '8 PM']], 'its time is kept');
  assert.equal([...fri.querySelectorAll('.tba-label')].filter((l) => l.textContent === 'TIME TBA').length, 0);
  const sat = roomsUnder(root, 'Saturday').find((r) => r.dataset.bucket === 'Afters');
  assert.equal(sat.querySelector('.tt-block'), null, 'no clock for a night of timeless shows');
  assert.equal(sat.querySelector('.tba-label'), null, 'and no bare TIME TBA heading over nothing');
  assert.deepEqual([...sat.querySelectorAll('.wall-grid .card')].map((c) => c.dataset.artist), ['S1', 'S2'], 'plain tiles');
});

// ---- the review round (2026-09-01): copy and labels -----------------------------------------

test('a guessed time keeps its tilde outside the day-first wall — a search result, a flat sort — and the whisper follows it', () => {
  const member = portola.artists.find((a) => a.night === 'Sun' && a.venue === 'The Midway' && a.order.seq === 2);
  const { root } = render('portola-2026', { query: member.name.toLowerCase() });
  // The search shows the grid set too (a name can be two entries) — the afters card is the one under AFTERS.
  const card = [...root.querySelectorAll('.card')].find((c) => c.dataset.artist === member.name && JSON.parse(c.dataset.occ).stage === member.stage);
  assert.equal(card.querySelector('.time').textContent, `Sun · ~${member.time}\nThe Midway`, 'the list form wears the tilde');
  assert.equal(root.querySelectorAll('.sec-whisper').length, 1, 'and says once what it means');
  const flat = render('tiles-run', { sort: 'az' }).root;
  const opener = [...flat.querySelectorAll('.card')].find((c) => c.dataset.artist === 'Opener');
  assert.equal(opener.querySelector('.time').textContent, 'Sat · ~10 PM\nThe Room');
  assert.equal(flat.querySelectorAll('.sec-whisper').length, 1);
  const plain = render('portola-2026', { query: 'fatboy' }).root;
  assert.equal(plain.querySelectorAll('.sec-whisper').length, 0, 'no guess, no whisper');
});

test('the whisper is the LOCKED copy, no terminal period', () => {
  const { root } = render('tiles-run');
  assert.equal(root.querySelector('.sec-whisper').textContent, '~ marks a guessed set time — the order is the plan');
});

test('a verbose day key shows its weekday head in the day-first rule, the aside in the sub, and keeps the key for the tabs', () => {
  const { root, ctx } = render('verbose-day');
  const rule = root.querySelector('.day-rule');
  assert.equal(rule.querySelector('.day').textContent, 'WEDNESDAY');
  assert.equal(rule.querySelector('.date').textContent, 'Early Arrival Pre-Party');
  assert.equal(rule.dataset.day, WED_KEY, 'the jump / scrollspy key is the key');
  assert.equal(rule.querySelector('.chip-notes').getAttribute('aria-label'), 'Notes for Wednesday');
  assert.deepEqual(dayNavOf(FESTIVALS['verbose-day'], ctx), [{ key: WED_KEY, short: 'WED', long: 'WEDNESDAY' }]);
  assert.deepEqual(roomsUnder(root, WED_KEY).map((r) => r.dataset.bucket), [':fest', 'Afters']);
});

// ---- the round-2 walk (2026-09-01): picks on a grown card, across the sync echo -----------
// The real sequence, with app.js's handleTap / applyLocalPick / refreshCtx /
// refreshArtistCards / repaintWall mirrored: renderWall → the hover grows a
// card (wireCardZoom's own intent timer) → a click on the OVERLAY picks →
// the sync echo repaints (snapshot / restore) → clicks on the overlay keep
// cycling 2 → 3 → 4 → 0.
//
// What the walk hit was geometry, never the deck (which is gone now): its one
// fixed click point was the overlay's centre, which sat in a gap before the
// first pick and on the venue's map DOOR after it (the who-row's arrival
// re-centres the rows — the designed event: a pill arriving slides in and its
// neighbours make room). The rig aims at the name now, as a person does. So
// this also pins the shape: the who-row appears only when there are people,
// and the door is a door. The card it runs on is a run member in a venue
// column — the exact card the walk was on.
function appMirror(fid) {
  const root = document.getElementById('wall-root');
  const ctx = ctxFor(fid);
  ctx.taps = [];
  const refreshCtxLike = () => { ctx.picks = model.picksFor(state.crewDoc, fid); };
  const applyLocalPick = (artist, person, level) => {
    state.ensureFestivalState(fid);
    const sels = state.crewDoc.festivals[fid].selections;
    (sels[artist] = sels[artist] || {})[person] = level;
  };
  const refreshArtistCards = (artistName) => {
    const els = [...document.querySelectorAll('#wall-root .card')].filter((c) => c.dataset.artist === artistName);
    const zi = els.indexOf(facts.zoomedCard());
    const fresh = els.map((el) => refreshCard(el, artistName, ctx));
    if (zi >= 0 && fresh[zi] && fresh[zi].isConnected) facts.refreshZoom(fresh[zi], ctx);
  };
  ctx.onTap = (artistName) => {
    ctx.taps.push(artistName);
    const current = (ctx.picks[artistName] || {})[ctx.meName] || 0;
    const next = model.nextTapLevel(current);
    state.recordSelection(artistName, ctx.meName, next);
    applyLocalPick(artistName, ctx.meName, next);
    refreshCtxLike();
    refreshArtistCards(artistName);
  };
  ctx.wireZoom = (el, artist, occ) => {
    const opts = { onOpenNotes: (a) => ctx.onOpenNotes(a, occ), occ };
    facts.wireCardZoom(el, artist, ctx, opts);
    facts.wireCardFocusZoom(el, artist, ctx, opts);
  };
  const repaintWall = () => {
    const keep = facts.zoomSnapshot();
    facts.unzoom({ instant: !!keep, why: 'wall repaint' });
    refreshCtxLike();
    state.setActiveFestivalId(fid);
    renderWall(root, ctx);
    if (keep) {
      const again = cardFor(root, keep.artist, keep.occ);
      if (again) facts.zoomCard(again, keep.artist, ctx, { ...keep, instant: true });
    }
  };
  refreshCtxLike();
  state.setActiveFestivalId(fid);
  renderWall(root, ctx);
  return { root, ctx, repaintWall, level: (name) => ((ctx.picks[name] || {})[ctx.meName] || 0) };
}
const hoverEnter = (node) => node.dispatchEvent(new dom.window.PointerEvent('pointerenter', { bubbles: false, pointerType: 'mouse' }));
const overlay = () => document.querySelector('#zoom-layer .zoom-card');
const rowsOf = (card) => [...card.querySelector('.f-grown').children].map((c) => c.className.split(' ')[0]);

test('picks on a run card keep cycling across the sync-echo repaint; the who-row appears only when there are people; the venue door never picks', async () => {
  delete state.crewDoc.festivals['portola-2026'].selections['Gelli Haha'];
  const { root, ctx, repaintWall, level } = appMirror('portola-2026');
  // Gelli Haha opens the Regency's Friday run — a card in a venue column,
  // which is what every events card is now.
  const runCard = root.querySelector('.room[data-bucket="Afters"] .card.cell[data-artist="Gelli Haha"]');
  assert.ok(runCard, 'the run member is a plain wall card');
  hoverEnter(runCard); // the hover's own intent timer (wireCardZoom)
  await new Promise((r) => setTimeout(r, facts.ZOOM_IN_MS + 40));
  assert.equal(facts.zoomedCard(), runCard, 'the hover grew the run card');
  assert.deepEqual(rowsOf(overlay()), ['f-sub', 'f-where', 'f-chips'], 'unpicked: no who-row, no hole');
  assert.equal(overlay().querySelector('a.f-where').textContent, 'Regency Ballroom', 'the venue is a map door');
  click(overlay().querySelector('.f-name'));
  assert.equal(level('Gelli Haha'), 1, 'click 1 picks');
  assert.deepEqual(rowsOf(overlay()), ['f-sub', 'f-where', 'f-who', 'f-chips'], 'the pill arrived and its neighbours made room');
  assert.equal(overlay().querySelector('.f-who .f-pill.you').textContent, 'You');
  repaintWall(); // the sync echo
  const back = facts.zoomedCard();
  assert.ok(back && back.isConnected && back.dataset.artist === 'Gelli Haha' && back.classList.contains('cell'),
    'restored onto the fresh run card, not the Saturday grid billing of the same name');
  assert.deepEqual(rowsOf(overlay()), ['f-sub', 'f-where', 'f-who', 'f-chips'], 'the restore rebuilt the same rows');
  for (const want of [2, 3, 4, 0]) {
    click(overlay().querySelector('.f-name'));
    assert.equal(level('Gelli Haha'), want, `the next click on the overlay took the pick to ${want}`);
    assert.ok(facts.zoomedCard() && facts.zoomedCard().isConnected, 'the zoom rode the refreshed run card');
  }
  assert.deepEqual(rowsOf(overlay()), ['f-sub', 'f-where', 'f-chips'], 'cleared: the who-row is gone again and the rows close up');
  assert.deepEqual(ctx.taps, ['Gelli Haha', 'Gelli Haha', 'Gelli Haha', 'Gelli Haha', 'Gelli Haha']);
  // Both occurrences follow the pick (the Saturday grid cell too).
  const gridCell = root.querySelector('.room[data-bucket=":fest"] .card.cell[data-artist="Gelli Haha"]');
  assert.ok(gridCell.getAttribute('aria-label').startsWith('Gelli Haha — not picked'));
  // The door is a door: a click on the venue line opens the map and never picks (by design, 2026-08-31).
  click(overlay().querySelector('a.f-where'));
  assert.equal(level('Gelli Haha'), 0, 'the map door does not pick');
  assert.equal(ctx.taps.length, 5);
  facts.unzoom({ instant: true });
});
