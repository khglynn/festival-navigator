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
const { renderWall, refreshCard, dayNavOf } = await import('../js/v3/wall.js');
const deck = await import('../js/v3/deck.js');
const facts = await import('../js/v3/card-facts.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const lostlands = JSON.parse(readFileSync(join(ROOT, 'data/festivals/lost-lands-2026.json'), 'utf8'));

const TOKEN = 'eventswalltoken_0123456789';
FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' }, { id: 'lost-lands-2026', status: 'lineup' }, { id: 'grid-only', status: 'scheduled' }, { id: 'tiles-run', status: 'lineup' });
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
  assert.equal(d.getAttribute('aria-label'), '3 sets at Regency Ballroom from 8 PM — open to see them all');
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
  assert.deepEqual(snap, { key: 'Afters|Friday|Regency Ballroom|1200', fromKeyboard: false });
  renderWall(root, ctx);
  assert.equal(root.querySelector('.deck-panel'), null, 'a repaint takes the panel');
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
