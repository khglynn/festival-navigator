// A pick that stops belonging, in a List filtered by a highlight (Sol's review
// of v103; the design is call 2d in claude-plans/2026-09-26-unified-build/V103-BUILD.md).
// Filtered to yourself, you un-pick a row: it DIMS where it is — nothing
// jumps under your finger — and it leaves at the next natural moment once you
// have left it (the shelf closed, the pointer gone, focus moved on; the
// minute tick as the backstop), with the room's words and its EARLIER count
// put right. While you are still on it, even a friend's change arriving on
// the poll keeps it. A change made elsewhere (a friend's sync) redraws the
// filtered List at once. The real shell, the real people menu, a finger's
// shelf; the motion is the browser contract's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { pointerClick, typedClick } from './helpers/pointer-click.mjs';
import { deepMerge } from '../js/merge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const TOKEN = 'listhighlightpick_012345'; // a made-up crew, never a real link
// Kevin at 4:15 PM Saturday: Felly Fell is over (1:40–2:40 PM), Robyn and
// Dog Blood are to come at Pier 80, Milli Meng at the afters. Ross: Soulwax.
let SERVER = {
  v: 4, meta: { name: 'The Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 } },
  festivals: { [FID]: { selections: {
    'Felly Fell': { Kevin: 2 }, Robyn: { Kevin: 4 }, 'Dog Blood': { Kevin: 1 }, 'Milli Meng': { Kevin: 2 },
    'Channel Tres': { Kevin: 4 }, // Sunday, for the keyboard
    'SG Lewis': { Kevin: 4 }, Mochakk: { Kevin: 4 }, // Sunday, two rows one after the other
    'Horse Meat Disco': { Kevin: 4 }, // one set, two rooms: Friday's Afters AND Folsom
    Soulwax: { Ross: 3 },
  } } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?')) {
    if ((opts.method || 'GET') !== 'GET') SERVER = deepMerge(SERVER, JSON.parse(opts.body).data || {});
    return json(JSON.parse(JSON.stringify(SERVER)));
  }
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'The Crew' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
    fn_welcome_v1: '1',
    fn_welcome_joined_v1: '1',
    [`fn_view_v1_${FID}`]: 'list',
  },
  fetch: network,
  now: '2026-09-26T23:15:00Z', // Saturday 4:15 PM at Pier 80
});
test.after(() => shell.close());
const { $ } = shell;
const { window } = shell.dom;
for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
await settle(100);
const state = await import('../js/state.js'); // the SAME instances the page booted
const sync = await import('../js/sync.js');

const wall = () => $('wall-root');
const room = (day, key) => wall().querySelector(`.day-block[data-day="${day}"] .room[data-room="${key}"]`);
const cardIn = (r, artist) => r && r.querySelector(`.card[data-artist="${CSS.escape(artist)}"]`);
const names = (el) => [...el.querySelectorAll('.card[data-artist]')].map((c) => c.dataset.artist);
const pop = () => document.querySelector('#dock-you-wrap .hl-pop');
const isOpen = () => !!pop() && pop().style.display !== 'none';
const shelf = () => document.getElementById('artist-sheet');
const minus = () => shelf().querySelector('.sheet-card .f-step.minus');
const level = (artist, who = 'Kevin') => (state.crewDoc.festivals[FID].selections[artist] || {})[who] || 0;
async function until(check, what, ms = 3000) {
  for (let t = 0; !check(); t += 10) {
    if (t > ms) assert.fail(`still waiting for ${what}`);
    await settle(10);
  }
}
async function highlight(person) {
  if (!isOpen()) $('dock-you').click();
  await until(isOpen, 'the people menu');
  [...pop().querySelectorAll('[data-person]')].find((b) => b.dataset.person === person).click();
  await settle(40);
  $('dock-you').click(); // put the menu away
  await settle(40);
}
const typedClickKey = (el) => typedClick(window, el, '');
async function tap(el) { pointerClick(window, el, 'touch', { engine: 'webkit' }); await settle(40); }
// The finger closes the shelf the way a finger does: its ✕ (a key's Escape
// would make it a keyboard's row, which holds while it has the focus).
async function closeShelf() {
  const x = shelf().querySelector('.sheet-close');
  assert.ok(x, 'the shelf has its ✕');
  pointerClick(window, x, 'touch', { engine: 'webkit' });
  await settle(60);
  if (shelf()) { window.history.back(); await settle(60); }
  assert.equal(shelf(), null, 'the shelf is down');
}
async function unpick(artist, r) {
  await tap(cardIn(r, artist));
  assert.ok(shelf(), `${artist}: the shelf is up`);
  while (level(artist) > 0) { minus().click(); await settle(20); }
}

test('filtered to yourself, the List shows only your rows', async () => {
  await highlight('Kevin');
  assert.equal(wall().dataset.view, 'list');
  assert.deepEqual(names(room('Saturday', 'Afters')), ['Milli Meng']);
  assert.deepEqual(names(room('Saturday', ':fest')), ['Robyn', 'Dog Blood']);
  assert.equal(room('Saturday', ':fest').querySelector('.past-line').textContent, 'Earlier · 1 set', 'Felly Fell, folded');
});

test('un-pick the afters row with a finger: it dims in place under the shelf; close the shelf and it leaves, the room going quiet', async () => {
  await unpick('Milli Meng', room('Saturday', 'Afters'));
  const row = cardIn(room('Saturday', 'Afters'), 'Milli Meng');
  assert.ok(row, 'still on the wall while you are on it');
  assert.ok(row.classList.contains('dim'), 'dimmed: not yours any more');
  await settle(1200);
  assert.ok(cardIn(room('Saturday', 'Afters'), 'Milli Meng'), 'the shelf is up: it stays, however long');
  await closeShelf();
  await until(() => !cardIn(room('Saturday', 'Afters'), 'Milli Meng'), 'the row to leave once you have left it', 2000);
  const afters = room('Saturday', 'Afters');
  assert.ok(afters.classList.contains('quiet'), 'the room is its quiet line now');
  assert.equal(afters.querySelector('.quiet-words').textContent, 'nothing you picked');
});

test('while you are still on it, a friend’s change arriving on the poll keeps it; it leaves when you do', async () => {
  await unpick('Dog Blood', room('Saturday', ':fest'));
  assert.ok(cardIn(room('Saturday', ':fest'), 'Dog Blood').classList.contains('dim'));
  // Ross picks something, and the poll brings it: a whole repaint.
  SERVER = deepMerge(SERVER, { festivals: { [FID]: { selections: { Tricky: { Ross: 2 } } } } });
  await sync.pollSync();
  await until(() => level('Tricky', 'Ross') === 2, 'the friend’s change to arrive');
  await settle(60);
  const held = cardIn(room('Saturday', ':fest'), 'Dog Blood');
  assert.ok(held && held.classList.contains('dim'), 'the repaint kept the row you are on, dimmed');
  await closeShelf();
  await until(() => !cardIn(room('Saturday', ':fest'), 'Dog Blood'), 'the row to leave', 2000);
  assert.deepEqual(names(room('Saturday', ':fest')), ['Robyn']);
});

test('the count follows: un-pick your last set to come at Pier 80 and the room keeps only its EARLIER line', async () => {
  await unpick('Robyn', room('Saturday', ':fest'));
  await closeShelf();
  await until(() => !cardIn(room('Saturday', ':fest'), 'Robyn'), 'Robyn to leave', 2000);
  const pier = room('Saturday', ':fest');
  assert.deepEqual(names(pier), [], 'no rows of yours to come');
  assert.equal(pier.querySelector('.past-line').textContent, 'Earlier · 1 set', 'your one set that is over, still counted');
  assert.equal(pier.classList.contains('quiet'), false, 'not quiet: there is a fold to open');
});

test('a change made elsewhere — a friend’s sync — redraws the filtered List at once', async () => {
  await highlight('Kevin'); // off
  await highlight('Ross');
  assert.deepEqual(names(room('Saturday', ':fest')).sort(), ['Soulwax', 'Tricky']);
  SERVER = deepMerge(SERVER, { festivals: { [FID]: { selections: { Soulwax: { Ross: 0 }, 'Fatboy Slim': { Ross: 3 } } } } });
  await sync.pollSync();
  await until(() => level('Soulwax', 'Ross') === 0, 'the friend’s un-pick to arrive');
  await settle(60);
  assert.deepEqual(names(room('Saturday', ':fest')).sort(), ['Fatboy Slim', 'Tricky'], 'his un-pick gone, his new pick there');
});

test('a keyboard is on the row it picked: it stays while it has the focus, and leaves when the focus moves on', async () => {
  // Filtered to you again: Channel Tres on Sunday is a must of yours.
  await highlight('Ross'); // off
  await highlight('Kevin');
  const card = () => cardIn(room('Sunday', ':fest'), 'Channel Tres');
  card().focus();
  card().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await settle(40);
  if (level('Channel Tres') !== 0) { typedClickKey(card()); await settle(40); } // Enter's click, as a browser sends it
  assert.equal(level('Channel Tres'), 0, 'Enter picked: must → nothing');
  assert.ok(card() && card().classList.contains('dim'), 'dimmed where it is');
  await settle(1200);
  assert.ok(card(), 'the keyboard is still on it: it stays');
  $('dock-you').focus(); // the focus moves on
  await until(() => !card(), 'the row to leave once the focus moved on', 2000);
});

// Sol's re-review of v103: each row settles on its own. Un-pick A, move on to
// B and un-pick it too: A leaves while B is still held — B is not a reason to
// keep A. And while the tab is hidden nothing is scanned or reshaped: a row
// let go while hidden leaves when the page is seen again, in front of you.
const keyPick = async (artist) => {
  const card = () => cardIn(room('Sunday', ':fest'), artist);
  card().focus();
  card().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await settle(40);
  if (level(artist) !== 0) { typedClickKey(card()); await settle(40); }
  assert.equal(level(artist), 0, `${artist}: Enter picked must → nothing`);
};
test('un-pick A, then B: A leaves while B is still held', async () => {
  await keyPick('SG Lewis');
  await keyPick('Mochakk'); // the focus is on Mochakk now
  const sun = () => room('Sunday', ':fest');
  await until(() => !cardIn(sun(), 'SG Lewis'), 'SG Lewis to leave while Mochakk is held', 2000);
  assert.ok(cardIn(sun(), 'Mochakk') && cardIn(sun(), 'Mochakk').classList.contains('dim'), 'Mochakk stays, dimmed, while the keyboard is on it');
});

test('hidden, the watch sleeps: it stops asking while the tab is hidden and wakes when the page is seen again', async () => {
  // Mochakk is still held (the keyboard is on it), so the watch is awake.
  // Watch the app's 400 ms timers from here on.
  const live = new Set();
  const setWas = globalThis.setInterval;
  const clearWas = globalThis.clearInterval;
  globalThis.setInterval = (fn, ms, ...a) => { const h = setWas(fn, ms, ...a); if (ms === 400) live.add(h); return h; };
  globalThis.clearInterval = (h) => { live.delete(h); return clearWas(h); };
  try {
    let vis = 'hidden';
    Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => vis });
    window.document.dispatchEvent(new window.Event('visibilitychange'));
    await settle(900); // the old watch's next beat finds the page hidden
    assert.equal(live.size, 0, 'hidden: no watch running');
    vis = 'visible';
    window.document.dispatchEvent(new window.Event('visibilitychange'));
    await settle(60);
    assert.equal(live.size, 1, 'seen again: the watch wakes (Mochakk is still held)');
    // Let Mochakk go: Escape puts its keyboard zoom away, the focus moves on.
    cardIn(room('Sunday', ':fest'), 'Mochakk').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await settle(40);
    $('dock-you').focus();
    await until(() => !cardIn(room('Sunday', ':fest'), 'Mochakk'), 'Mochakk to leave once let go', 3000);
    await settle(500);
    assert.equal(live.size, 0, 'and with nothing left to wait for, the watch stops');
  } finally {
    globalThis.setInterval = setWas;
    globalThis.clearInterval = clearWas;
  }
});

// Sol's round 3: rows are kept by their occurrence and room, never by the
// artist's name. Horse Meat Disco's one Friday set shows in two rooms, Afters
// and Folsom; un-pick it while the keyboard is on its Afters row, and its
// Folsom row — which nobody is on — still leaves.
test('one artist in two rooms: holding its Afters row does not hold its Folsom row', async () => {
  const daysLine = () => $('wall-root').querySelector(':scope > .past-line[data-past="days"]');
  if (daysLine().getAttribute('aria-expanded') !== 'true') { daysLine().click(); await settle(60); }
  const fri = (r) => room('Friday', r);
  assert.ok(!wall().querySelector('.card[data-artist="Soulwax"]'), 'still filtered to Kevin (this file runs in order)');
  assert.ok(cardIn(fri('Afters'), 'Horse Meat Disco') && cardIn(fri('Folsom'), 'Horse Meat Disco'), 'both rows, before');
  const card = () => cardIn(fri('Afters'), 'Horse Meat Disco');
  card().focus();
  card().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await settle(40);
  if (level('Horse Meat Disco') !== 0) { typedClickKey(card()); await settle(40); }
  assert.equal(level('Horse Meat Disco'), 0, 'must → nothing');
  await until(() => !cardIn(fri('Folsom'), 'Horse Meat Disco'), 'the Folsom row to leave while the Afters row is held', 2000);
  assert.ok(card() && card().classList.contains('dim'), 'the Afters row, with the keyboard on it, stays dimmed');
  // The Folsom row leaving repaints the wall, and every card is a new node:
  // the keyboard keeps its place on the held row (a real-browser walk found
  // focus dropped to <body> — the next Tab went to the top of the page, and
  // the row's keyboard zoom stood on with nothing focused in it).
  assert.equal(document.activeElement, card(), 'the keyboard is still on the Afters row after the repaint');
  // The focus moves on (to the days line, the next thing a Tab can reach
  // here — the earlier tests un-picked Kevin's other rows): the Afters row goes too.
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  daysLine().focus();
  await until(() => !card(), 'the Afters row to leave once the keyboard moved on', 2000);
  // …and that repaint keeps the keyboard where it went, too (not <body>).
  assert.equal(document.activeElement, daysLine(), 'the keyboard is still on the days line after the row left');
});

// A repaint while the keyboard is inside a standing zoom (its "+ note", its
// −): the zoom comes back on the fresh card, and the keyboard with it — on
// the card the zoom stands on, as the notes door already hands it back. It
// used to fall to <body>, the next Tab starting at the top of the page.
test('a friend’s repaint while the keyboard is in a zoom keeps the keyboard on that card', async () => {
  await highlight('Kevin'); // off
  await highlight('Ross');
  const tricky = () => cardIn(room('Saturday', ':fest'), 'Tricky');
  assert.ok(tricky(), 'Ross’s Tricky is on the List');
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  tricky().focus();
  await settle(40);
  const control = () => document.querySelector('#zoom-layer .zoom-slot button:not([disabled])');
  await until(() => !!control(), 'the keyboard zoom to stand, with its controls');
  control().focus();
  assert.ok(document.activeElement.closest('#zoom-layer'), 'the keyboard is inside the zoom');
  SERVER = deepMerge(SERVER, { festivals: { [FID]: { selections: { Galen: { Ross: 2 } } } } });
  await sync.pollSync();
  await until(() => level('Galen', 'Ross') === 2, 'the friend’s change to arrive');
  await settle(60);
  assert.ok(document.querySelector('#zoom-layer .zoom-slot'), 'the zoom stands on through the repaint');
  assert.equal(document.activeElement, tricky(), 'the keyboard is on the card the zoom stands on, not <body>');
});
