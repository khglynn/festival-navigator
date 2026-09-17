// A hidden part renders nothing, and a day with nothing visible has no tab
// (ship round, 2026-09-17). Kevin's screenshot: THURSDAY and FRIDAY on
// Portola stood as empty shells with quiet AFTERS / FOLSOM labels under them.
// "If all events for a day are hidden, don't show that day at all — not
// empty shells." The plan applies the fold: a hidden room contributes
// nothing, a hidden section is absent from its day, a hidden extra is absent,
// and a day whose visible rooms are all empty is not a day — no rule, no tab,
// never the default open. The show menu still names every room, hidden or
// not, because that is where the state lives (wall.js roomsOf reads the fest,
// never the wall).
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
const { renderWall, dayNavOf, wallPlanFor, roomsOf, weekendRoom } = await import('../js/v3/wall.js');
const filters = await import('../js/v3/filters.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const acl = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' }, { id: 'acl-2026', status: 'scheduled' });
FESTIVALS['portola-2026'] = portola;
FESTIVALS['acl-2026'] = acl;
const TOKEN = 'hiddenpartstoken_0123456789';
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 0 } },
  festivals: { 'portola-2026': { selections: {}, notes: { day: { '2026-09-24': { n1: { author: 'Kevin', ts: '2026-09-20T18:00:00.000Z', text: 'Thursday warehouse' } } } } } },
  affinity: {},
}, 'portola-2026');

const ctxFor = (fid, over = {}) => ({
  fid, meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
  filterPeople: [], folded: [], now: new Date('2026-01-01T12:00:00'),
  picks: model.picksFor(state.crewDoc, fid), onOpenNotes: () => {}, onNotesChange: null, onOpenDayNotes: () => {}, onTap: () => {},
  ...over,
});
const render = (fid, over = {}) => {
  state.setActiveFestivalId(fid);
  const root = document.getElementById('wall-root');
  const ctx = ctxFor(fid, over);
  renderWall(root, ctx);
  return { root, ctx };
};
const rulesOf = (root) => [...root.querySelectorAll('.day-rule')].map((r) => r.dataset.day);
const roomsOnWall = (root) => [...new Set([...root.querySelectorAll('.room')].map((r) => r.dataset.room))];
const tabsOf = (fest, ctx) => dayNavOf(fest, ctx).map((d) => d.key);

test('Portola with Afters and Folsom hidden: the days are Saturday and Sunday, and Thursday and Friday are nowhere', () => {
  const { root, ctx } = render('portola-2026', { folded: ['Afters', 'Folsom'] });
  assert.deepEqual(rulesOf(root), ['Saturday', 'Sunday'], 'no empty shells');
  assert.deepEqual(tabsOf(portola, ctx), ['Saturday', 'Sunday'], 'no tab for a day with nothing visible');
  assert.deepEqual(roomsOnWall(root), [':fest'], 'the hidden rooms render nothing — no header, no quiet label');
  assert.equal(root.querySelectorAll('.sec-head.folded, .folded').length, 0, 'there is no folded look left to wear');
  assert.equal(root.querySelector('.day-whisper'), null, 'the Thursday note has no rule to hang under — the sheet still lists it');
  assert.equal(wallPlanFor(portola, ctx).model.days[0].key, 'Saturday', 'the first visible grid day is the open');
  // Un-hide, and Thursday comes back exactly where it was.
  const back = render('portola-2026', { folded: [] });
  assert.deepEqual(rulesOf(back.root), ['Thursday', 'Friday', 'Saturday', 'Sunday']);
  assert.ok(back.root.querySelector('.day-whisper'), 'and the Thursday note is under its rule again');
});

test('one hidden section is absent from every day it played; the other rooms are untouched', () => {
  const { root } = render('portola-2026', { folded: ['Folsom'] });
  assert.deepEqual(rulesOf(root), ['Thursday', 'Friday', 'Saturday', 'Sunday'], 'the days stay: Afters plays them all');
  assert.equal(root.querySelector('.room[data-room="Folsom"]'), null, 'no Folsom room anywhere');
  assert.equal([...root.querySelectorAll('.sec-label')].some((l) => l.textContent === 'FOLSOM'), false, 'not even its name');
  assert.equal(root.querySelectorAll('.room[data-room="Afters"] .venue-grid').length, 4);
  assert.equal(root.querySelectorAll('.room[data-room=":fest"] .tt-block').length, 2);
});

test('the festival\'s own room hidden: no timetable, no billed names, and the nights it did not own are still the week', () => {
  const { root, ctx } = render('portola-2026', { folded: [':fest'] });
  assert.equal(root.querySelector('.room[data-room=":fest"], .tt-block, .stage-strip'), null);
  assert.deepEqual(rulesOf(root), ['Thursday', 'Friday', 'Saturday', 'Sunday'], 'the afters play Saturday and Sunday too');
  assert.deepEqual(tabsOf(portola, ctx), ['Thursday', 'Friday', 'Saturday', 'Sunday']);
  // A week with nothing visible at all is a wall with no days — and still a
  // plan, so the flat lineup never leaks through in its place.
  const none = render('portola-2026', { folded: [':fest', 'Afters', 'Folsom'] });
  assert.deepEqual(rulesOf(none.root), []);
  assert.equal(none.root.querySelectorAll('.card').length, 0, 'nothing renders — not the flat lineup, not a shell');
  assert.deepEqual(tabsOf(portola, none.ctx), []);
});

test('ACL with Late nights hidden: six dated tabs and no Late nights tab; the extra room is gone whole', () => {
  const { root, ctx } = render('acl-2026', { folded: ['Late nights'] });
  const tabs = dayNavOf(acl, ctx);
  assert.equal(tabs.length, 6);
  assert.ok(tabs.every((t) => !t.dated));
  assert.deepEqual(tabs.map((t) => t.long), ['FRI 2', 'SAT 3', 'SUN 4', 'FRI 9', 'SAT 10', 'SUN 11']);
  assert.equal(root.querySelector('.room[data-room="Late nights"], .date-rule'), null);
  assert.equal(root.querySelector('.sec-head[data-day="Late nights"]'), null, 'no anchor for a tab that is not there');
});

test('a search does not resurface a hidden part', () => {
  const { root } = render('portola-2026', { folded: ['Afters'], query: 'vtss' });
  const cards = [...root.querySelectorAll('.card')];
  assert.equal(cards.length, 1, 'the Sunday set answers; the afters card is hidden with its room');
  const occ = JSON.parse(cards[0].dataset.occ);
  assert.equal(occ.day, 'Sunday');
  assert.equal(occ.venue, undefined, 'the grid set (its occurrence has no venue at all), not the afters show');
});

test('the show menu names every room of the week, hidden or not, in the wall\'s order — read off the fest', () => {
  const rooms = (fid, folded) => roomsOf(FESTIVALS[fid], ctxFor(fid, { folded })).map((r) => [r.key, r.label]);
  const portolaRooms = [[':fest', 'Portola'], ['Afters', 'Afters'], ['Folsom', 'Folsom']];
  assert.deepEqual(rooms('portola-2026', []), portolaRooms);
  assert.deepEqual(rooms('portola-2026', ['Afters', 'Folsom']), portolaRooms, 'hidden rooms are still offered — that is where the state is visible');
  assert.deepEqual(rooms('portola-2026', [':fest', 'Afters', 'Folsom']), portolaRooms, 'even with nothing on the wall at all');
  // A room key is frozen pick data and can be verbose; the menu bills it the
  // way the wall does — the head of the label, never the raw key.
  const WED = 'Wednesday, Sept 16 (Early Arrival Pre-Party)';
  FESTIVALS['verbose-day'] = {
    id: 'verbose-day', name: 'Verbose Day', status: 'lineup',
    artists: [{ name: 'Chassi', day: WED }, { name: 'Late Night', day: 'Afters', night: 'Wed', venue: 'The Barn', time: '11 PM' }],
  };
  assert.deepEqual(roomsOf(FESTIVALS['verbose-day'], ctxFor('verbose-day')).map((r) => [r.key, r.label]),
    [[':fest', 'Verbose Day'], ['Afters', 'Afters']]);
  assert.deepEqual(roomsOf({ id: 'empty', name: 'Empty', artists: [] }, ctxFor('empty')), [], 'a fest with nothing has no rooms');
});

test('the folded list still round-trips through storage untouched by any of this', () => {
  filters.saveFolded('hp', ['Afters', 'Late nights']);
  assert.deepEqual(filters.loadFolded('hp'), ['Afters', 'Late nights']);
  filters.saveFolded('hp', []);
});

// ---- ACL: Weekend 1 / Weekend 2 in the show menu (Kevin, 2026-09-17) -----------
// "ACL needs options in the show/hide menu to hide weekend 1 or weekend 2."
// A two-weekend fest's festival-room row becomes two rows, one per weekend,
// keyed `weekend:W1` / `weekend:W2` in the same folded list. Hiding one drops
// its three dated tabs; a set tagged for both weekends keeps playing on the
// other. A one-weekend fest is untouched.

test('ACL with Weekend 1 hidden: FRI 9 · SAT 10 · SUN 11 · Late nights — and a both-weekend set still plays Weekend 2', () => {
  const { root, ctx } = render('acl-2026', { folded: [weekendRoom('W1')] });
  assert.equal(weekendRoom('W1'), 'weekend:W1', 'the persisted key');
  assert.deepEqual(dayNavOf(acl, ctx).map((t) => t.long), ['FRI 9', 'SAT 10', 'SUN 11', 'LATE NIGHTS']);
  assert.deepEqual(rulesOf(root), ['Friday|W2', 'Saturday|W2', 'Sunday|W2']);
  const both = acl.days.Friday.artists.find((a) => !a.weekend || a.weekend === 'both');
  assert.ok(both, 'ACL has a Friday set that plays both weekends');
  assert.ok(root.querySelector(`.card.cell[data-artist="${both.name}"]`), 'and it is on the Weekend 2 grid');
  // Both hidden: no dated tabs, Late nights alone.
  const none = render('acl-2026', { folded: [weekendRoom('W1'), weekendRoom('W2')] });
  assert.deepEqual(dayNavOf(acl, none.ctx).map((t) => t.long), ['LATE NIGHTS']);
  assert.deepEqual(rulesOf(none.root), []);
  assert.ok(none.root.querySelector('.room[data-room="Late nights"] .date-rule'), 'the late nights are still there');
  // Weekend 2 hidden alone is the mirror.
  const w2 = render('acl-2026', { folded: [weekendRoom('W2')] });
  assert.deepEqual(dayNavOf(acl, w2.ctx).map((t) => t.long), ['FRI 2', 'SAT 3', 'SUN 4', 'LATE NIGHTS']);
});

test('the show menu on a two-weekend fest: Weekend 1, Weekend 2, Late nights — the festival-room row is replaced, not joined', () => {
  assert.deepEqual(roomsOf(acl, ctxFor('acl-2026')).map((r) => [r.key, r.label]),
    [['weekend:W1', 'Weekend 1'], ['weekend:W2', 'Weekend 2'], ['Late nights', 'Late nights']]);
  assert.deepEqual(roomsOf(acl, ctxFor('acl-2026', { folded: ['weekend:W1', 'weekend:W2', 'Late nights'] })).map((r) => r.key),
    ['weekend:W1', 'weekend:W2', 'Late nights'], 'hidden or not, every row is offered');
  assert.deepEqual(roomsOf(portola, ctxFor('portola-2026')).map((r) => r.key), [':fest', 'Afters', 'Folsom'], 'a one-weekend fest is untouched');
  // The key round-trips through the same folded list as every other room.
  filters.saveFolded('acl-hp', ['weekend:W1', 'Late nights']);
  assert.deepEqual(filters.loadFolded('acl-hp'), ['weekend:W1', 'Late nights']);
  assert.deepEqual(filters.toggleFold(filters.loadFolded('acl-hp'), 'weekend:W2'), ['weekend:W1', 'Late nights', 'weekend:W2']);
  filters.saveFolded('acl-hp', []);
});
