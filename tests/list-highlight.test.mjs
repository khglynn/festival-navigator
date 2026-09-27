// In the List a highlight FILTERS (v103 — Kevin, 2026-09-26: "when in list
// view — let's have highlight actually filter — only show that person(s)
// picks. our grid can highlight. our list can filter."). The Board still
// dims. In the List every row none of the highlighted people picked leaves
// the DOM, a band it empties goes, and a room it empties is ONE quiet line —
// its own head, saying "nothing Ross picked", still the door to the night's
// notes. The past is judged on the whole wall first (the days line never
// flips with a highlight), and each room's own fold counts only what is left.
// Viewer-side only: nothing is written to the crew doc or sent anywhere.
// Part one renders the real modules on the real Portola file; part two boots
// the real shell in the List and highlights through the people menu.
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
const { renderWall, refreshCard, thinnedWords, listFilters } = await import('../js/v3/wall.js');
const { passesPeople } = await import('../js/v3/filters.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
FESTIVALS[FID] = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
if (!FESTIVAL_INDEX.some((f) => f.id === FID)) FESTIVAL_INDEX.push({ id: FID, status: 'scheduled' });
// A made-up crew, never a real link. Ross: Despacio (three nights), Milli Meng
// and Galen at the Saturday afters. Nhu: Soulwax and Galen. Kevin: Robyn.
const SELECTIONS = { 'Milli Meng': { Ross: 3 }, Galen: { Ross: 1, Nhu: 2 }, Soulwax: { Nhu: 4 }, Despacio: { Ross: 3 }, Robyn: { Kevin: 2 } };
state.activateCrew('listhighlighttesttoken_01', {
  v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 }, Nhu: { colorIndex: 3 } },
  festivals: { [FID]: { selections: SELECTIONS } }, affinity: {},
}, FID);
state.setActiveFestivalId(FID);

const PT = (s) => new Date(`${s}-07:00`);
const FRI_9AM = PT('2026-09-25T09:00:00');
const SAT_1130 = PT('2026-09-26T23:30:00');
const render = (over = {}) => {
  const root = document.getElementById('wall-root');
  const ctx = {
    fid: FID, meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
    filterPeople: [], folded: [], now: FRI_9AM, view: 'list', pastOpen: new Set(),
    picks: model.picksFor(state.crewDoc, FID), onOpenNotes: () => {}, onNotesChange: null, onOpenDayNotes: () => {},
    onPast: () => {}, ...over,
  };
  ctx.onTap = (artist, el) => refreshCard(el, artist, ctx);
  renderWall(root, ctx);
  return root;
};
const room = (root, day, key) => root.querySelector(`.day-block[data-day="${day}"] .room[data-room="${key}"]`);
const names = (el) => [...el.querySelectorAll('.card[data-artist]')].map((c) => c.dataset.artist);
// What a head says after its name, as one line reads it: the sub, then (in a
// quiet room) the words in their own span.
const sub = (r) => {
  const h = r.querySelector(':scope > .room-head');
  const words = h.querySelector('.quiet-words');
  const s2 = h.querySelector('.sub').textContent;
  return words ? [s2, words.textContent].filter(Boolean).join(' · ') : s2;
};

test('the one predicate: a row passes when any highlighted person picked it (filters.js passesPeople)', () => {
  const picks = model.picksFor(state.crewDoc, FID);
  assert.equal(passesPeople(picks, 'Galen', ['Ross']), true);
  assert.equal(passesPeople(picks, 'Soulwax', ['Ross']), false);
  assert.equal(passesPeople(picks, 'Soulwax', ['Ross', 'Nhu']), true, 'more people, more rows');
  assert.equal(passesPeople(picks, 'Soulwax', []), true, 'no highlight, no filter');
  assert.equal(listFilters({ view: 'list', query: '', filterPeople: ['Ross'] }), true);
  assert.equal(listFilters({ view: 'board', query: '', filterPeople: ['Ross'] }), false, 'the Board dims');
  assert.equal(listFilters({ view: 'list', query: 'sou', filterPeople: ['Ross'] }), false, 'a search is its own list, and dims');
  assert.equal(listFilters({ view: 'list', query: '', filterPeople: [] }), false);
});

test('the List, Ross highlighted: only his rows, everywhere; nothing is dimmed, because nothing that is not his is there', () => {
  const root = render({ filterPeople: ['Ross'] });
  const all = names(root);
  assert.ok(all.length > 0 && all.every((n) => ['Milli Meng', 'Galen', 'Despacio'].includes(n)), `only Ross's: ${all}`);
  assert.deepEqual(names(room(root, 'Saturday', 'Afters')), ['Milli Meng', 'Galen'], 'in play order');
  assert.deepEqual(names(room(root, 'Saturday', ':fest')), ['Despacio']);
  assert.deepEqual(names(room(root, 'Sunday', ':fest')), ['Despacio'], 'a set he picked on three nights, on each');
  assert.equal(root.querySelectorAll('.card.dim').length, 0);
  for (const band of root.querySelectorAll('.time-band')) assert.ok(band.querySelector('.card'), `no empty hour: ${band.dataset.band}`);
});

test('a room he picked nothing in is ONE quiet line: its own head, saying so, still a door — no whisper, no rows, no hours', () => {
  const root = render({ filterPeople: ['Ross'] });
  const folsom = room(root, 'Saturday', 'Folsom');
  assert.ok(folsom.classList.contains('quiet'));
  assert.deepEqual([...folsom.children].map((c) => c.className), ['room-head'], 'the head and nothing else');
  assert.equal(sub(folsom), 'nothing Ross picked');
  assert.equal(folsom.querySelector('.room-head .sub').textContent, '', 'the room’s own place goes: there is nothing there to find');
  assert.equal(folsom.querySelector('.room-head').tagName, 'BUTTON', 'still the door to that night’s notes');
  // The day's first head keeps its date in front.
  const sunAfters = room(root, 'Sunday', 'Afters');
  assert.ok(sunAfters.classList.contains('quiet'));
  const sunFest = room(root, 'Sunday', ':fest');
  assert.equal(sunFest.classList.contains('quiet'), false);
  assert.match(sub(sunFest), /^Sep 27/, 'a room with rows keeps its own sub');
  const friFolsom = room(root, 'Friday', 'Folsom');
  assert.equal(sub(friFolsom), 'nothing Ross picked');
});

test('a quiet first head keeps the date it leads with', () => {
  // Nhu has nothing on Friday: its first head (AFTERS, Sep 25) goes quiet and keeps the date.
  const root = render({ filterPeople: ['Nhu'] });
  const fri = room(root, 'Friday', 'Afters');
  assert.ok(fri.classList.contains('quiet'));
  assert.equal(sub(fri), 'Sep 25 · nothing Nhu picked');
  assert.equal(fri.querySelector('.room-head .sub').textContent, 'Sep 25', 'the date in the sub, which gives way first');
  assert.equal(fri.querySelector('.room-head .quiet-words').textContent, 'nothing Nhu picked', 'the words in their own span, which never does');
});

test('the words: you, one name, two, then "they"', () => {
  assert.equal(thinnedWords(['Ross'], 'Kevin'), 'nothing Ross picked');
  assert.equal(thinnedWords(['Kevin'], 'Kevin'), 'nothing you picked');
  assert.equal(thinnedWords(['Ross', 'Kevin'], 'Kevin'), 'nothing Ross or you picked');
  assert.equal(thinnedWords(['Ross', 'Nhu', 'Kevin'], 'Kevin'), 'nothing they picked');
  const root = render({ filterPeople: ['Kevin'] });
  assert.equal(sub(room(root, 'Saturday', 'Folsom')), 'nothing you picked');
});

test('two people: the rows either of them picked', () => {
  const root = render({ filterPeople: ['Ross', 'Nhu'] });
  assert.deepEqual(names(room(root, 'Saturday', 'Afters')), ['Milli Meng', 'Galen']);
  assert.ok(names(room(root, 'Saturday', ':fest')).includes('Soulwax'), 'Nhu’s Soulwax');
  assert.equal(sub(room(root, 'Saturday', 'Folsom')), 'nothing Ross or Nhu picked');
});

test('the fold counts follow: at 11:30 PM Saturday Ross’s one set over at Pier 80 is "Earlier · 1 set" — and the days line is the same with or without him', () => {
  const plain = render({ now: SAT_1130, pastAt: SAT_1130 });
  const plainDays = plain.querySelector(':scope > .past-line').textContent;
  const plainCount = room(plain, 'Saturday', ':fest').querySelector('.past-line').textContent;
  assert.match(plainCount, /^Earlier · \d\d sets$/, `everyone's: ${plainCount}`);
  const his = render({ now: SAT_1130, pastAt: SAT_1130, filterPeople: ['Ross'] });
  assert.equal(his.querySelector(':scope > .past-line').textContent, plainDays, 'whole days are judged on the whole wall');
  const pier = room(his, 'Saturday', ':fest');
  assert.equal(pier.querySelector('.past-line').textContent, 'Earlier · 1 set', 'Despacio, and only Despacio');
  assert.equal(names(pier).length, 0, 'folded: nothing of his left to show there');
  assert.equal(pier.classList.contains('quiet'), false, 'a room with his past is not quiet — it has a fold to open');
  // Opened, the fold shows his one row.
  const open = render({ now: SAT_1130, pastAt: SAT_1130, filterPeople: ['Ross'], pastOpen: new Set(['2026-09-26|:fest']) });
  assert.deepEqual(names(room(open, 'Saturday', ':fest')), ['Despacio']);
});

test('the Board still dims: nothing leaves, and the rows he did not pick step back', () => {
  const root = render({ view: 'board', filterPeople: ['Ross'] });
  assert.ok(root.querySelector('.card[data-artist="Soulwax"]'), 'Soulwax is still on the Board');
  assert.ok(root.querySelector('.card[data-artist="Soulwax"]').classList.contains('dim'));
  assert.equal(root.querySelectorAll('.room.quiet').length, 0);
});

test('a search in the List is a list of answers, and dims', () => {
  const root = render({ filterPeople: ['Ross'], query: 'soulwax' });
  const c = root.querySelector('.card[data-artist="Soulwax"]');
  assert.ok(c && c.classList.contains('dim'), 'the answer is there, dimmed');
});

test('the filter writes nothing: the crew doc and the pending push are untouched', () => {
  const doc = JSON.stringify(state.crewDoc);
  const pending = state.hasPending();
  render({ filterPeople: ['Ross'] });
  render({ filterPeople: ['Ross', 'Nhu'] });
  render({ filterPeople: [] });
  assert.equal(JSON.stringify(state.crewDoc), doc);
  assert.equal(state.hasPending(), pending);
});

// Sol's review of v103: a scheduled festival's DAYLESS names (EVERYTHING ELSE —
// billed with no day and on no grid) were drawn after the filter ran, so the
// ones nobody highlighted picked stayed in a filtered List. Portola and ACL
// have none today; the next scheduled festival with one would break the
// promise. A fixture: Portola plus two names with no day.
test('EVERYTHING ELSE (a scheduled festival\'s dayless names) filters too — and goes when none of theirs is in it', () => {
  const base = FESTIVALS[FID];
  const FX = 'portola-dayless-fixture';
  FESTIVALS[FX] = { ...base, id: FX, artists: [...base.artists, { name: 'Loose Ross' }, { name: 'Loose Nobody' }] };
  if (!FESTIVAL_INDEX.some((f) => f.id === FX)) FESTIVAL_INDEX.push({ id: FX, status: 'scheduled' });
  state.crewDoc.festivals[FX] = { selections: { ...SELECTIONS, 'Loose Ross': { Ross: 2 } } };
  state.setActiveFestivalId(FX);
  try {
    const at = (over) => {
      const root = render({ fid: FX, picks: model.picksFor(state.crewDoc, FX), ...over });
      const head = [...root.querySelectorAll('.list-head')].find((h) => /EVERYTHING ELSE/.test(h.textContent));
      const grid = head ? head.nextElementSibling : null;
      return { head, names: grid ? names(grid) : [] };
    };
    assert.deepEqual(at({}).names.sort(), ['Loose Nobody', 'Loose Ross'], 'unfiltered: both');
    assert.deepEqual(at({ filterPeople: ['Ross'] }).names, ['Loose Ross'], 'Ross highlighted: only his');
    const nhu = at({ filterPeople: ['Nhu'] });
    assert.equal(nhu.head, undefined, 'Nhu has none there: the list goes, head and all');
    const board = at({ view: 'board', filterPeople: ['Ross'] });
    assert.deepEqual(board.names.sort(), ['Loose Nobody', 'Loose Ross'], 'the Board keeps both (it dims)');
  } finally {
    state.setActiveFestivalId(FID);
    delete state.crewDoc.festivals[FX];
  }
});

// A run of empty dates is ONE quiet line (the coordinator's call on 2f, after
// the v104 walk counted ten "nothing Ross picked" lines in a row on ACL's Late
// nights). A dated section is a room per date; consecutive dates the
// highlighted people picked nothing on become one line that names the span —
// "LATE NIGHTS  SEP 29 – OCT 8 · NOTHING ROSS PICKED" — while a single empty
// date keeps its own quiet line. Same quiet style, no new controls.
test('ACL Late nights, a highlighted person with no late-night picks: one quiet line for the whole run, naming its span', () => {
  const ACL = 'acl-2026';
  FESTIVALS[ACL] = JSON.parse(readFileSync(join(ROOT, `data/festivals/${ACL}.json`), 'utf8'));
  if (!FESTIVAL_INDEX.some((f) => f.id === ACL)) FESTIVAL_INDEX.push({ id: ACL, status: 'scheduled' });
  const lateRooms = (root) => [...root.querySelectorAll('.day-block[data-day="Late nights"] > .room')];
  const say = (r) => {
    const h = r.querySelector(':scope > .room-head');
    return [h.querySelector('.wd')?.textContent || '', h.querySelector('.label').textContent, h.querySelector('.sub').textContent, h.querySelector('.quiet-words')?.textContent || ''].filter(Boolean).join(' | ');
  };
  const at = (selections, people) => {
    state.crewDoc.festivals[ACL] = { selections };
    state.setActiveFestivalId(ACL);
    return render({ fid: ACL, picks: model.picksFor(state.crewDoc, ACL), filterPeople: people, now: new Date('2026-09-20T12:00:00-05:00') });
  };
  try {
    // Ross picked nothing late: the whole section is one line.
    let root = at({ Turnstile: { Ross: 3 } }, ['Ross']);
    let rooms = lateRooms(root);
    assert.equal(rooms.length, 1, `one line for the run: ${rooms.map(say)}`);
    assert.equal(say(rooms[0]), 'LATE NIGHTS | Sep 29 – Oct 10 | nothing Ross picked');
    assert.ok(rooms[0].classList.contains('quiet'));
    assert.equal(rooms[0].querySelector(':scope > .room-head').tagName, 'DIV', 'no new control: a span is not one date’s door');
    assert.equal(rooms[0].dataset.isos.split(' ').length, 10, 'it stands for its ten dates (the day-of open still lands on it)');
    // One pick on Oct 9: the run before it, the night itself, and Oct 10 alone.
    root = at({ Turnstile: { Ross: 3 }, 'Noga Erez': { Ross: 2 } }, ['Ross']);
    rooms = lateRooms(root);
    assert.deepEqual(rooms.map(say), [
      'LATE NIGHTS | Sep 29 – Oct 8 | nothing Ross picked',
      'FRI | LATE NIGHTS | Oct 9 · around Austin',
      'SAT | LATE NIGHTS | Oct 10 | nothing Ross picked',
    ]);
    assert.deepEqual(names(rooms[1]), ['Noga Erez']);
    assert.equal(rooms[2].querySelector(':scope > .room-head').tagName, 'BUTTON', 'a single empty date keeps its own door');
    // Unfiltered: every date its own room, as ever.
    root = at({ Turnstile: { Ross: 3 } }, []);
    assert.equal(lateRooms(root).length, 10);
  } finally {
    state.setActiveFestivalId(FID);
    delete state.crewDoc.festivals[ACL];
  }
});
