// THE PAST (Phase 1, 2026-09-26): folded by default behind one line that
// flips. "Over" is the NOW ring's own window — a card is over exactly when
// its ring can never light again — judged at a clock the shell holds still
// (ctx.pastAt) between its own moments. Whole days over sit behind one line
// at the top of the wall, in both views; in the List each room folds its own
// past. Rendered by the real modules in jsdom on the real Portola and ACL files.
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
const { renderWall, refreshCard, pastOf } = await import('../js/v3/wall.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (id) => JSON.parse(readFileSync(join(ROOT, `data/festivals/${id}.json`), 'utf8'));
const PORTOLA = 'portola-2026';
const ACL = 'acl-2026';
FESTIVALS[PORTOLA] = load(PORTOLA);
FESTIVALS[ACL] = load(ACL);
for (const id of [PORTOLA, ACL]) if (!FESTIVAL_INDEX.some((f) => f.id === id)) FESTIVAL_INDEX.push({ id, status: 'scheduled' });
state.activateCrew('listpasttesttoken_0123456', {
  v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 0 } },
  festivals: { [PORTOLA]: { selections: {} } }, affinity: {},
}, PORTOLA);

const PT = (s) => new Date(`${s}-07:00`);
const render = (fid, now, over = {}) => {
  state.setActiveFestivalId(fid);
  const root = document.getElementById('wall-root');
  const ctx = {
    fid, meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
    filterPeople: [], folded: [], now, view: 'list', pastOpen: new Set(),
    picks: model.picksFor(state.crewDoc, fid), onOpenNotes: () => {}, onNotesChange: null, onOpenDayNotes: () => {},
    onPast: () => {}, ...over,
  };
  ctx.onTap = (artist, el) => refreshCard(el, artist, ctx);
  renderWall(root, ctx);
  return root;
};
const days = (root) => [...root.querySelectorAll(':scope > .day-block')].map((b) => b.dataset.day);
const room = (root, day, key) => root.querySelector(`.day-block[data-day="${day}"] .room[data-room="${key}"]`);
const names = (el) => [...el.querySelectorAll('.card[data-artist]')].map((c) => c.dataset.artist);
const lineOf = (el) => el.querySelector('.past-line');
const W = (from, to) => ({ from, to });

test('over is the ring\'s own window: ended on its night, the whole night once a day on, and nothing before it', () => {
  const clock = (iso, minutes) => ({ iso, minutes });
  // Saturday 4:15 PM: a 1:30–2:30 set is over, a 3:30–4:30 set is not, an untimed card is not.
  assert.deepEqual(pastOf('2026-09-26', [W(810, 870), W(930, 990), null], clock('2026-09-26', 975)),
    { nightOver: false, over: [true, false, false] });
  // 6 AM Sunday reads Saturday at 30:00 — Aftershock (3–10 AM, 27:00–34:00) is still on, so
  // Saturday's night is not over; its 10 PM set is.
  assert.deepEqual(pastOf('2026-09-26', [W(1260, 1320), W(1620, 2040), null], clock('2026-09-27', 360)),
    { nightOver: false, over: [true, false, false] }, 'the 5 AM rollover never ends a night early');
  // Once every timed card on the night is over, so is the night — and its untimed cards with it.
  assert.deepEqual(pastOf('2026-09-26', [W(1260, 1320), null], clock('2026-09-27', 360)),
    { nightOver: true, over: [true, true] });
  // Two days on: everything, whatever its window says.
  assert.equal(pastOf('2026-09-24', [W(1620, 2400)], clock('2026-09-26', 600)).nightOver, true);
  // Before the night: nothing.
  assert.deepEqual(pastOf('2026-09-27', [W(0, 1)], clock('2026-09-26', 1400)).over, [false]);
  assert.deepEqual(pastOf(null, [W(0, 1)], clock('2026-09-26', 1400)).over, [false], 'no date, no judgement');
});

test('the List at 4:15 PM Saturday: the room folds its seven, the empty hour goes, the days line holds Thursday and Friday', () => {
  const root = render(PORTOLA, PT('2026-09-26T16:15:00'));
  assert.deepEqual(days(root), ['Saturday', 'Sunday'], 'the days that are over wait behind the line');
  const top = root.querySelector(':scope > .past-line');
  assert.ok(top && top === root.firstElementChild, 'one line at the very top of the wall');
  assert.equal(top.textContent, 'Earlier · THU · FRI');
  assert.equal(top.getAttribute('aria-expanded'), 'false');
  assert.equal(top.dataset.past, 'days');
  const sat = room(root, 'Saturday', ':fest');
  const line = lineOf(sat);
  assert.equal(line.textContent, 'Earlier · 7 sets');
  assert.equal(line.tagName, 'BUTTON', 'a bare button — the 44px floor comes with it');
  assert.equal(line.dataset.past, '2026-09-26|:fest', 'keyed by the room on its date');
  assert.equal(line.nextElementSibling.classList.contains('time-band'), true, 'above the bands');
  for (const gone of ['Airwolf Paradise', 'erika b2b sfcowboy', 'Sam Alfred', 'Felly Fell', 'Gelli Haha', 'Ranger Trucco b2b Alisha', 'MGNA Crrrta']) {
    assert.ok(!names(sat).includes(gone), `${gone} is over and folded`);
  }
  assert.equal(sat.querySelector('.time-band[data-band="h13"]'), null, 'the 1 PM band, emptied, goes too');
  assert.deepEqual(names(sat.querySelector('.time-band[data-band="h14"]')), ['Despacio'], 'Despacio is still playing');
  assert.ok(names(sat).includes('Tricky'));
  assert.equal(lineOf(room(root, 'Saturday', 'Afters')), null, 'nothing over tonight in the afters: no line');
  assert.equal(lineOf(room(root, 'Saturday', 'Folsom')).textContent.endsWith('parties'), true, 'Folsom counts parties');
  assert.equal(lineOf(room(root, 'Sunday', ':fest')), null, 'tomorrow: nothing folds');
});

test('opened, the same line says Hide earlier and the past is back in its bands', () => {
  const root = render(PORTOLA, PT('2026-09-26T16:15:00'), { pastOpen: new Set(['2026-09-26|:fest', 'days']) });
  assert.deepEqual(days(root), ['Thursday', 'Friday', 'Saturday', 'Sunday']);
  const top = root.querySelector(':scope > .past-line');
  assert.equal(top.textContent, 'Hide earlier');
  assert.equal(top.getAttribute('aria-expanded'), 'true');
  assert.deepEqual([...root.querySelectorAll(':scope > .day-block.past-day')].map((b) => b.dataset.day), ['Thursday', 'Friday'], 'marked for the motion');
  assert.equal(lineOf(room(root, 'Thursday', 'Afters')), null, 'an opened day that is over is shown whole');
  const sat = room(root, 'Saturday', ':fest');
  assert.equal(lineOf(sat).textContent, 'Hide earlier');
  assert.ok(names(sat).includes('Airwolf Paradise'));
  assert.equal(sat.querySelectorAll('.card.past').length, 7, 'the seven, marked for the motion');
  assert.ok(sat.querySelector('.time-band[data-band="h13"]'), 'the 1 PM band is back');
});

test('the Board keeps its rooms whole — only the days line folds there', () => {
  const root = render(PORTOLA, PT('2026-09-26T16:15:00'), { view: 'board' });
  assert.deepEqual(days(root), ['Saturday', 'Sunday']);
  assert.equal(root.querySelector(':scope > .past-line').textContent, 'Earlier · THU · FRI');
  assert.equal(root.querySelectorAll('.room .past-line').length, 0, 'no room line on the board');
  assert.equal(room(root, 'Saturday', ':fest').querySelectorAll('.times-grid .card').length, 31, 'the grid is whole');
});

test('the fold is judged at the held clock, not the ticking one: a set that ends while you read stays', () => {
  const root = render(PORTOLA, PT('2026-09-26T16:40:00'), { pastAt: PT('2026-09-26T16:15:00') });
  const sat = room(root, 'Saturday', ':fest');
  assert.ok(names(sat).includes('Six Sex'), 'Six Sex ended at 4:20; the fold was judged at 4:15');
  assert.equal(lineOf(sat).textContent, 'Earlier · 7 sets');
  const later = render(PORTOLA, PT('2026-09-26T16:40:00'), { pastAt: PT('2026-09-26T16:40:00') });
  assert.ok(!names(room(later, 'Saturday', ':fest')).includes('Six Sex'), 'judged again, it folds');
});

test('6 AM Sunday: Saturday stays for Aftershock; its finished rooms fold whole behind their lines', () => {
  const root = render(PORTOLA, PT('2026-09-27T06:00:00'));
  assert.deepEqual(days(root), ['Saturday', 'Sunday']);
  assert.equal(root.querySelector(':scope > .past-line').textContent, 'Earlier · THU · FRI');
  const portola = room(root, 'Saturday', ':fest');
  assert.equal(portola.querySelectorAll('.card').length, 0, 'every Saturday set is over');
  assert.match(lineOf(portola).textContent, /^Earlier · \d+ sets$/);
  assert.ok(portola.querySelector(':scope > .room-head'), 'the head stays: it is the note door');
  assert.deepEqual(names(room(root, 'Saturday', 'Folsom')), ['Aftershock'], 'only what is still on');
});

test('before the festival nothing folds, and after it nothing does either — a record is read whole', () => {
  for (const when of ['2026-09-19T12:00:00', '2026-10-01T12:00:00']) {
    const root = render(PORTOLA, PT(when));
    assert.deepEqual(days(root), ['Thursday', 'Friday', 'Saturday', 'Sunday'], when);
    assert.equal(root.querySelectorAll('.past-line').length, 0, `${when}: no line anywhere`);
  }
});

test('ACL on the second Friday: the first weekend waits behind one line, named by its dated tabs', () => {
  const root = render(ACL, new Date('2026-10-09T15:00:00-05:00'));
  const top = root.querySelector(':scope > .past-line');
  assert.ok(top, 'a days line');
  assert.match(top.textContent, /^Earlier · FRI 2 · SAT 3 · SUN 4$/);
  assert.ok(root.querySelector('.room[data-room="Late nights"]'), 'Late nights still runs to Oct 10: its block stays');
  const over = [...root.querySelectorAll('.room[data-room="Late nights"]')].filter((r) => lineOf(r));
  assert.ok(over.length > 3, 'its dates that are over fold room by room in the List');
});
