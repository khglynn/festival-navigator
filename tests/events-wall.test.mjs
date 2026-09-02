// The day-first wall (MODEL-V3, 2026-09-01), rendered by the real modules in
// jsdom: the composition on Portola, the strips scoped per timetable, the
// bucket filter's chips and whisper, the deck at rest and grown, the run's
// two-line WHEN in the grown card, and the untouched paths — a grid-only
// fest and Lost Lands render exactly as before. jsdom has no animate(), so
// every motion path here is the instant one; the motion is the walker's job.
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
const { renderWall, refreshCard, dayNavOf, cardFor } = await import('../js/v3/wall.js');
const deck = await import('../js/v3/deck.js');
const facts = await import('../js/v3/card-facts.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const lostlands = JSON.parse(readFileSync(join(ROOT, 'data/festivals/lost-lands-2026.json'), 'utf8'));

const TOKEN = 'eventswalltoken_0123456789';
FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' }, { id: 'lost-lands-2026', status: 'lineup' }, { id: 'grid-only', status: 'scheduled' }, { id: 'tiles-run', status: 'lineup' }, { id: 'approx-deck', status: 'lineup' }, { id: 'model-edges', status: 'lineup' }, { id: 'verbose-day', status: 'lineup' });
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
// pile of three at V1 is GUESSED (approx, no order — a pile nobody re-read).
FESTIVALS['approx-deck'] = {
  id: 'approx-deck', name: 'Approx Deck', status: 'lineup',
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

test.afterEach(() => deck.closeDeck({ instant: true }));

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
  assert.equal(root.dataset.deckHost, '1');
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
  gridScrollers[1].scrollLeft = 120;
  gridScrollers[1].dispatchEvent(new dom.window.Event('scroll'));
  assert.ok(gridScrollers.every((s) => s.scrollLeft === 120));
  const fri = root.querySelector('.times-scroll[data-sync="Afters|Friday"][data-day]');
  fri.scrollLeft = 300;
  fri.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(gridScrollers[0].scrollLeft, 120, 'the grid did not move');
  assert.equal(root.querySelector('.times-scroll[data-sync="Afters|Friday"]').scrollLeft, 300, 'its own strip did');
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
  // Saturday's afters are columns by the consistency law though thin: two venues, five TBA tiles.
  const sat = roomsUnder(root, 'Saturday')[1];
  assert.deepEqual([...sat.querySelectorAll('.stage-strip .stage-head')].map((h) => h.textContent), ['Regency Ballroom', 'Monarch']);
  assert.equal(sat.querySelectorAll('.tba .card').length, 5);
});

test('the untouched paths: a grid-only fest renders one page-wide strip and no rooms; Lost Lands stays a lineup wall (WED is a wall-grid — tiles)', () => {
  const grid = render('grid-only').root;
  assert.equal(grid.querySelectorAll('.stage-strip').length, 1);
  assert.equal(grid.querySelector('.stage-strip').parentElement, grid, 'the strip sits at the root, above every day');
  assert.equal(grid.querySelectorAll('.room, .bucket-row, .tt-block, .sec-head').length, 0);
  assert.ok([...grid.querySelectorAll('.times-scroll')].every((s) => !s.dataset.sync));
  assert.equal(grid.dataset.deckHost, undefined);
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

// ---- the deck --------------------------------------------------------------------------

const fridayDeck = (root) => {
  const d = root.querySelector('.room[data-bucket="Afters"] .deck');
  assert.ok(d, 'Friday\'s Regency pile is a deck');
  return d;
};

test('the deck at rest: one button, the earliest card as an inert face, two ghosts, a count pill', () => {
  const { root, ctx } = render('portola-2026');
  const d = fridayDeck(root);
  assert.equal(d.getAttribute('role'), 'button');
  assert.equal(d.tabIndex, 0);
  assert.equal(d.getAttribute('aria-expanded'), 'false');
  assert.equal(d.getAttribute('aria-label'), '3 sets at Regency Ballroom from 8 PM — 1 picked — open to see them all', 'Nhu picked Channel Tres: the pile says so');
  assert.equal(d.querySelector('.deck-pill').textContent, '3 · 8 PM');
  assert.equal(d.querySelectorAll('.deck-ghost').length, 2);
  const face = d.querySelector('.card');
  assert.equal(face.dataset.artist, 'Channel Tres');
  assert.equal(face.dataset.deckFace, '1');
  assert.equal(face.tabIndex, -1);
  assert.equal(face.getAttribute('aria-hidden'), 'true');
  assert.equal(face.getAttribute('role'), null, 'the deck is the button, not the face');
  assert.ok(face.classList.contains('cell'));
  assert.equal(face.dataset.time, '8 PM');
  assert.equal(d.style.gridRow, '13 / span 4');
  // The face wears the crew's picks (Nhu's aura) but never takes one.
  assert.ok(face.getAttribute('aria-label').includes('picked by 1 other'));
  const fresh = refreshCard(face, 'Channel Tres', ctx);
  assert.equal(fresh.dataset.deckFace, '1');
  assert.equal(fresh.getAttribute('aria-hidden'), 'true');
  assert.equal(fresh.style.height, '100%');
});

test('a tap grows the deck into a panel of full, pickable cards inside the wall root; Escape, a press outside, or a second tap put it away', () => {
  const { root, ctx } = render('portola-2026');
  const d = fridayDeck(root);
  click(d.querySelector('.card'));
  assert.deepEqual(ctx.taps, [], 'a tap on the face is never a pick');
  assert.equal(deck.openDeckEl(), d);
  assert.equal(d.getAttribute('aria-expanded'), 'true');
  assert.ok(d.classList.contains('open'));
  const layer = root.querySelector('.deck-layer');
  assert.ok(layer && layer.parentElement === root, 'the panel\'s layer hangs off the wall root');
  const panel = layer.querySelector('.deck-panel');
  assert.equal(panel.getAttribute('role'), 'dialog');
  assert.equal(panel.querySelector('.deck-panel-title').textContent, 'Regency Ballroom · 8 PM');
  const cards = [...panel.querySelectorAll('.deck-panel-grid .card')];
  assert.deepEqual(cards.map((c) => [c.dataset.artist, c.dataset.time]), [['Channel Tres', '8 PM'], ['Jyoty', '8 PM'], ['Gelli Haha', '8 PM']]);
  assert.ok(cards.every((c) => c.getAttribute('role') === 'button' && c.tabIndex === 0 && !c.classList.contains('cell')), 'full wall cards');
  assert.deepEqual(JSON.parse(cards[1].dataset.occ), { day: 'Afters', stage: 'Fri · Regency Ballroom', time: '8 PM', weekend: null });
  click(cards[1]);
  assert.deepEqual(ctx.taps, ['Jyoty'], 'a card in the panel is a pick');
  assert.equal(deck.openDeckEl(), d, 'and the panel stays');
  // Jyoty also plays the Saturday grid — app.js refreshes every card under
  // the wall root by name, and the panel's card is one of them.
  const jyotys = [...document.querySelectorAll('#wall-root .card[data-artist="Jyoty"]')];
  assert.equal(jyotys.length, 2, 'the Saturday grid cell and the panel card');
  assert.ok(jyotys.some((c) => c.closest('.deck-panel')), 'the refreshed panel card is still found under the wall root (app.js refreshArtistCards)');
  key('Escape');
  assert.equal(deck.openDeckEl(), null, 'Escape closes');
  assert.equal(root.querySelector('.deck-panel'), null);
  assert.equal(d.getAttribute('aria-expanded'), 'false');
  click(d);
  assert.equal(deck.openDeckEl(), d);
  pressAt(root.querySelector('.day-rule'));
  assert.equal(deck.openDeckEl(), null, 'a press outside closes');
  click(d);
  pressAt(root.querySelector('.deck-panel-grid .card'));
  assert.equal(deck.openDeckEl(), d, 'a press inside does not');
  click(d);
  assert.equal(deck.openDeckEl(), null, 'a second tap on the deck toggles it away');
  click(d);
  click(root.querySelector('.deck-panel .deck-close'));
  assert.equal(deck.openDeckEl(), null, 'the ✕ closes');
});

test('an open deck survives a repaint through its snapshot, and its cards can be zoomed like any card', () => {
  const { root, ctx } = render('portola-2026');
  click(fridayDeck(root));
  const snap = deck.deckSnapshot();
  assert.deepEqual(snap, { key: 'Afters|Friday|Regency Ballroom|1200', fromKeyboard: false, focus: null });
  renderWall(root, ctx);
  assert.equal(root.querySelector('.deck-panel'), null, 'a repaint takes the panel');
  assert.equal(deck.openDeckEl(), null, 'and the deck knows it — a render that does not restore (a search) leaves no stale open deck for a later repaint to resurrect');
  assert.equal(deck.deckSnapshot(), null);
  deck.restoreDeck(root, snap);
  assert.equal(deck.openDeckEl(), fridayDeck(root), 'and the snapshot brings it back on the fresh deck');
  const card = root.querySelector('.deck-panel-grid .card[data-artist="Jyoty"]');
  const f = facts.zoomCard(card, 'Jyoty', ctx, { occ: JSON.parse(card.dataset.occ) });
  assert.equal(f.where, 'Regency Ballroom');
  assert.equal(f.when, 'Fri · 8 PM');
  assert.ok(facts.zoomedCard() === card);
  deck.closeDeck({ instant: true });
  assert.equal(facts.zoomedCard(), null, 'the zoom leaves with the panel');
});

test('keyboard: Enter on the deck opens it and focuses the first card; Escape returns focus to the deck', () => {
  const { root } = render('portola-2026');
  const d = fridayDeck(root);
  d.focus();
  d.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.equal(deck.openDeckEl(), d);
  assert.equal(document.activeElement, root.querySelector('.deck-panel-grid .card'));
  key('Escape');
  assert.equal(deck.openDeckEl(), null);
  assert.equal(document.activeElement, d);
});

// ---- the run in the zoom (the LOCKED copy) ---------------------------------------------------

test('factsFor a run member: WHEN is the room\'s window, the order is a door; the grid billing of the same name has neither', () => {
  const { ctx } = render('portola-2026');
  const member = portola.artists.find((a) => a.night === 'Sun' && a.venue === 'The Midway' && a.order.seq === 3);
  const f = facts.factsFor(member.name, ctx, { day: member.day, stage: member.stage, time: member.time, weekend: null });
  assert.equal(f.when, 'Sun · Runs 10 PM – ~2 AM', 'the window, with the tilde on the guessed close');
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
  assert.equal(sub.querySelector('.f-when').textContent, 'Sun · Runs 10 PM – ~2 AM');
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

// ---- the review round (2026-09-01): the deck's P1s ---------------------------------------

test('the deck answers the people filter as ONE object: lit when the filtered person picked anything in the pile, dimmed whole otherwise, never a lone dimmed face', () => {
  // Nhu's only Friday pick is Jyoty — the deck's SECOND card, behind the face.
  const { root } = render('portola-2026', { picks: { Jyoty: { Nhu: 4 } }, filterPeople: ['Nhu'] });
  const d = fridayDeck(root);
  assert.ok(!d.classList.contains('dim'), 'the pile holds her pick — lit');
  assert.ok(!d.querySelector('.card').classList.contains('dim'), 'the face never dims on its own');
  assert.match(d.getAttribute('aria-label'), /^3 sets at Regency Ballroom from 8 PM — 1 picked by Nhu — open/);
  // Kevin picked nothing in the pile.
  const { root: r2 } = render('portola-2026', { picks: { Jyoty: { Nhu: 4 } }, filterPeople: ['Kevin'] });
  const d2 = fridayDeck(r2);
  assert.ok(d2.classList.contains('dim'), 'nobody selected picked here — the whole deck dims');
  assert.ok(!d2.querySelector('.card').classList.contains('dim'), 'no double dim');
  assert.match(d2.getAttribute('aria-label'), /— none picked by Kevin —/);
  // No filter: anyone's picks ride the name; a refresh of the face re-reads the pile.
  const { root: r3, ctx: c3 } = render('portola-2026', { picks: { Jyoty: { Nhu: 4 }, 'Channel Tres': { Kevin: 1 } } });
  const d3 = fridayDeck(r3);
  assert.match(d3.getAttribute('aria-label'), /— 2 picked —/);
  c3.picks = {};
  refreshCard(d3.querySelector('.card'), 'Channel Tres', c3);
  assert.ok(!d3.getAttribute('aria-label').includes('picked'), 'the picks went — the name follows');
  // …and under a filter the same refresh re-evaluates the dim.
  const { root: r4, ctx: c4 } = render('portola-2026', { picks: { Jyoty: { Nhu: 4 } }, filterPeople: ['Nhu'] });
  const d4 = fridayDeck(r4);
  assert.ok(!d4.classList.contains('dim'));
  c4.picks = {};
  refreshCard(d4.querySelector('.card'), 'Channel Tres', c4);
  assert.ok(d4.classList.contains('dim'), 'her pick left the pile — the deck dims');
  assert.ok(!d4.querySelector('.card').classList.contains('dim'));
});

test('a repaint restores a standing zoom onto the PANEL card, never the deck\'s inert face — and the grown card still picks', () => {
  const { root, ctx } = render('portola-2026');
  click(fridayDeck(root));
  const panelTop = root.querySelector('.deck-panel-grid .card[data-artist="Channel Tres"]');
  const face = fridayDeck(root).querySelector('.card');
  assert.equal(face.dataset.artist, 'Channel Tres');
  assert.equal(face.dataset.occ, panelTop.dataset.occ, 'the face and the panel\'s top card are two renderings of one occurrence');
  facts.zoomCard(panelTop, 'Channel Tres', ctx, { occ: JSON.parse(panelTop.dataset.occ), onOpenNotes: ctx.onOpenNotes });
  const keep = facts.zoomSnapshot();
  const snap = deck.deckSnapshot();
  facts.unzoom({ instant: true });
  renderWall(root, ctx); // the sync echo
  deck.restoreDeck(root, snap);
  const naive = [...root.querySelectorAll('.card[data-artist="Channel Tres"]')].find((el) => (el.dataset.occ || '') === JSON.stringify(keep.occ));
  assert.equal(naive.dataset.deckFace, '1', 'document order puts the face first — the trap cardFor exists for');
  const again = cardFor(root, keep.artist, keep.occ);
  assert.ok(again && again.closest('.deck-panel'), 'cardFor picks the panel card');
  assert.notEqual(again.dataset.deckFace, '1');
  facts.zoomCard(again, keep.artist, ctx, { ...keep, instant: true });
  assert.equal(facts.zoomedCard(), again);
  click(document.querySelector('#zoom-layer .zoom-card'));
  assert.deepEqual(ctx.taps, ['Channel Tres'], 'a tap on the grown card picks — the face\'s no-op onTap is not in the loop');
  facts.unzoom({ instant: true });
});

test('Escape belongs to the topmost layer: a notes sheet above the panel keeps the panel; without one, Escape closes it', () => {
  const { root } = render('portola-2026');
  const d = fridayDeck(root);
  click(d);
  const sheet = document.createElement('div');
  sheet.id = 'artist-sheet';
  document.body.appendChild(sheet);
  try {
    key('Escape');
    assert.equal(deck.openDeckEl(), d, 'the sheet above takes Escape');
  } finally { sheet.remove(); }
  key('Escape');
  assert.equal(deck.openDeckEl(), null);
});

test('focus goes home to the deck only for Escape / the ✕ / a second tap — never for a press outside, a scroll-away or a repaint — and always without scrolling', () => {
  const { root, ctx } = render('portola-2026');
  const d = fridayDeck(root);
  const focusCalls = [];
  const realFocus = d.focus.bind(d);
  d.focus = (opts) => { focusCalls.push(opts); realFocus(opts); };
  const enter = () => d.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  enter();
  assert.equal(deck.openDeckEl(), d);
  key('Escape');
  assert.deepEqual(focusCalls, [{ preventScroll: true }], 'Escape: home, without a scroll');
  assert.equal(document.activeElement, d);
  enter();
  pressAt(root.querySelector('.day-rule'));
  assert.equal(deck.openDeckEl(), null);
  assert.equal(focusCalls.length, 1, 'an outside press does not pull focus to the deck');
  enter();
  const realRect = d.getBoundingClientRect;
  d.getBoundingClientRect = () => ({ top: -500, bottom: -400, left: 0, right: 150, width: 150, height: 100 });
  try {
    window.dispatchEvent(new dom.window.Event('scroll'));
    assert.equal(deck.openDeckEl(), null, 'the deck left the viewport — the panel closed');
    assert.equal(focusCalls.length, 1, 'and nothing pulled the page back to it');
  } finally { d.getBoundingClientRect = realRect; }
  enter();
  click(root.querySelector('.deck-panel .deck-close'));
  assert.equal(focusCalls.length, 2, 'the ✕: home');
  assert.equal(document.activeElement, d);
  enter();
  renderWall(root, ctx);
  assert.equal(focusCalls.length, 2, 'a repaint never refocuses the old deck');
});

test('a repaint keeps a keyboard user\'s place inside the panel — the card they were on, not the first card', () => {
  const { root, ctx } = render('portola-2026');
  const d = fridayDeck(root);
  d.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  const cards = [...root.querySelectorAll('.deck-panel-grid .card')];
  assert.equal(document.activeElement, cards[0], 'a keyboard open lands on the first card');
  cards[1].focus();
  const snap = deck.deckSnapshot();
  assert.deepEqual(snap, { key: 'Afters|Friday|Regency Ballroom|1200', fromKeyboard: true, focus: 'Jyoty' });
  renderWall(root, ctx);
  deck.restoreDeck(root, snap);
  assert.equal(document.activeElement.dataset.artist, 'Jyoty');
  assert.ok(document.activeElement.closest('.deck-panel'));
  renderWall(root, ctx);
  assert.equal(document.activeElement, document.body);
  deck.restoreDeck(root, { ...snap, focus: null });
  assert.equal(deck.openDeckEl(), fridayDeck(root));
  assert.equal(document.activeElement, document.body, 'no focus inside before the repaint: none moved after it');
});

test('place() reads the panel\'s LAYOUT box, not a mid-bloom bounding rect', () => {
  const { root } = render('portola-2026');
  const d = fridayDeck(root);
  click(d);
  const slot = root.querySelector('.deck-slot');
  const iw = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  const ih = Object.getOwnPropertyDescriptor(window, 'innerHeight');
  Object.defineProperty(slot, 'offsetWidth', { value: 200, configurable: true });
  Object.defineProperty(slot, 'offsetHeight', { value: 100, configurable: true });
  slot.getBoundingClientRect = () => ({ left: 0, top: 0, width: 150, height: 75, right: 150, bottom: 75 }); // the box at scale(.75), mid-bloom
  d.getBoundingClientRect = () => ({ left: 450, top: 350, width: 100, height: 100, right: 550, bottom: 450 });
  Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
  try {
    window.dispatchEvent(new dom.window.Event('scroll')); // follow → place
    assert.equal(slot.style.left, '400px', '500 − 200/2: the layout width, not the transformed 150');
    assert.equal(slot.style.top, '350px', '400 − 100/2');
  } finally {
    if (iw) Object.defineProperty(window, 'innerWidth', iw);
    if (ih) Object.defineProperty(window, 'innerHeight', ih);
  }
});

test('the deck\'s pill, accessible name and panel title carry the tilde when the top card\'s time is a guess', () => {
  const { root } = render('approx-deck');
  const d = root.querySelector('.deck');
  assert.ok(d, 'three guessed 10 PM sets at V1 are a deck');
  assert.equal(d.querySelector('.deck-pill').textContent, '3 · ~10 PM');
  assert.match(d.getAttribute('aria-label'), /^3 sets at V1 from ~10 PM/);
  assert.equal(d.querySelector('.card').dataset.time, '~10 PM');
  click(d);
  assert.equal(root.querySelector('.deck-panel-title').textContent, 'V1 · ~10 PM');
  assert.equal(root.querySelector('.deck-panel').getAttribute('aria-label'), 'V1 · ~10 PM');
  assert.deepEqual([...root.querySelectorAll('.deck-panel-grid .card')].map((c) => c.dataset.time), ['~10 PM', '~10 PM', '~10 PM']);
  assert.equal(root.querySelectorAll('.room[data-bucket="Afters"] .sec-whisper').length, 1);
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

// ---- the round-2 walk (2026-09-01): picks inside the open panel, across the sync echo -----------
// The real sequence, with app.js's handleTap / applyLocalPick / refreshCtx /
// refreshArtistCards / repaintWall mirrored: renderWall → open the deck →
// the hover grows a panel card (wireCardZoom's own intent timer) → a click on
// the OVERLAY picks → the sync echo repaints (snapshot / restore) → clicks on
// the overlay keep cycling 2 → 3 → 4 → 0.
//
// What the walk actually hit was geometry, not the deck: its one fixed click
// point was the overlay's centre, which sat in a gap before the first pick
// and on the venue's map DOOR after it (the who-row's arrival re-centred every
// row). So this also pins the shape: the rows exist from the first frame and
// never move, and the door is a door.
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
    const dk = deck.deckSnapshot();
    facts.unzoom({ instant: !!keep, why: 'wall repaint' });
    refreshCtxLike();
    state.setActiveFestivalId(fid);
    renderWall(root, ctx);
    if (dk) deck.restoreDeck(root, dk);
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

test('picks on a panel card keep cycling across the sync-echo repaint, and the grown card\'s rows never move under the hand', async () => {
  delete state.crewDoc.festivals['portola-2026'].selections['Gelli Haha'];
  const { root, ctx, repaintWall, level } = appMirror('portola-2026');
  click(fridayDeck(root));
  const panelCard = root.querySelector('.deck-panel-grid .card[data-artist="Gelli Haha"]');
  hoverEnter(panelCard); // the hover's own intent timer (wireCardZoom)
  await new Promise((r) => setTimeout(r, facts.ZOOM_IN_MS + 40));
  assert.equal(facts.zoomedCard(), panelCard, 'the hover grew the panel card');
  const before = rowsOf(overlay());
  assert.deepEqual(before, ['f-sub', 'f-where', 'f-who', 'f-chips'], 'the who-row is there BEFORE the first pick');
  assert.equal(overlay().querySelector('.f-who').children.length, 0, 'empty, reserved');
  assert.equal(overlay().querySelector('a.f-where').textContent, 'Regency Ballroom', 'and the venue is a map door');
  click(overlay().querySelector('.f-name'));
  assert.equal(level('Gelli Haha'), 1, 'click 1 picks');
  assert.deepEqual(rowsOf(overlay()), before, 'the pick added a pill into the row that already existed — no row moved');
  assert.equal(overlay().querySelector('.f-who .f-pill.you').textContent, 'You');
  repaintWall(); // the sync echo
  assert.ok(facts.zoomedCard() && facts.zoomedCard().closest('.deck-panel') && facts.zoomedCard().dataset.deckFace !== '1', 'restored onto the panel card');
  assert.deepEqual(rowsOf(overlay()), before, 'same rows after the restore');
  for (const want of [2, 3, 4, 0]) {
    click(overlay().querySelector('.f-name'));
    assert.equal(level('Gelli Haha'), want, `the next click on the overlay took the pick to ${want}`);
    assert.ok(facts.zoomedCard() && facts.zoomedCard().isConnected && facts.zoomedCard().closest('.deck-panel'), 'the zoom rode the refreshed panel card');
    assert.deepEqual(rowsOf(overlay()), before, 'rows still where they were');
  }
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

test('the sheet header hides the empty who-row; the zoom keeps it (the CSS the geometry rests on is declared)', () => {
  const css = readFileSync(join(ROOT, 'assets/v3.css'), 'utf8');
  assert.match(css, /\.zoom-card \.f-who:empty \{ min-height: 20px; \}/);
  assert.match(css, /\.sheet-card \.f-who:empty \{ display: none; \}/);
  const { ctx } = render('portola-2026');
  const plain = facts.sheetCard(facts.factsFor('Fatboy Slim', ctx, { day: 'Afters', stage: 'Sun · 888 Garage', time: '10 PM', weekend: null }), {});
  assert.ok(plain.querySelector('.f-who'), 'the row exists in every home');
  assert.equal(plain.querySelector('.f-who').children.length, 0);
});
