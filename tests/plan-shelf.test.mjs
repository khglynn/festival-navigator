// Our plan on the phone, in the real shell (2026-09-26 — Kevin's call #5): the
// peek on the dock that is the day plan's own NOW/NEXT row seen through a
// window, and the laws around it — one NOW (the dock's steps aside while the
// peek says NOW), a pick counts at once, no history entry, a search and the
// welcome card each put it away, and nothing before a festival but tomorrow.
// The motion and the drag are the real browser's (tests/browser/plan-drag);
// jsdom has no layout, so this file stands in a visibility answer of its own
// where the app asks "is it on screen?" (getClientRects) and no more.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- a clock this file can move (before anything reads Date) -----------------------
// tests/day-row.test.mjs's, and it wins over the night-clock helper.
const RealDate = globalThis.Date;
let offset = 0;
const setClock = (iso) => { offset = RealDate.parse(iso) - RealDate.now(); };
function ShiftedDate(...args) {
  if (!new.target) return new RealDate(RealDate.now() + offset).toString();
  const nt = new.target === ShiftedDate ? RealDate : new.target;
  return Reflect.construct(RealDate, args.length === 0 ? [RealDate.now() + offset] : args, nt);
}
Object.setPrototypeOf(ShiftedDate, RealDate);
Object.defineProperty(ShiftedDate, 'prototype', { value: RealDate.prototype, writable: false });
Object.defineProperty(ShiftedDate, 'now', { value: () => RealDate.now() + offset, writable: true, configurable: true });
globalThis.Date = ShiftedDate;
const SAT_940 = '2026-09-27T04:40:00Z';  // Portola Saturday 9:40 PM PDT: Dog Blood on the Pier Stage
const SAT_11AM = '2026-09-26T18:00:00Z'; // Saturday before the gates: NEXT is Tove Lo
const WED_NOON = '2026-09-23T19:00:00Z'; // the day before the first night
const TUE_NOON = '2026-09-22T19:00:00Z'; // two days before
setClock(SAT_940);

const { bootShell, settle } = await import('./helpers/shell-rig.mjs');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
// The made-up nine (the model's own fixture): placeholder names, never real.
const NINE = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/plan-crew-nine.json'), 'utf8'));
const TOKEN = 'planshelftesttoken_012345'; // made-up crews, never a real link
const GUEST = 'planshelfguesttoken_01234';
const doc = () => ({
  v: 4, meta: { name: 'Nine', inviteFestId: FID }, spotify: {}, affinity: {},
  people: Object.fromEntries(NINE.members.map((n, i) => [n, { colorIndex: i }])),
  festivals: { [FID]: { selections: structuredClone(NINE.picks) } },
});
const DOCS = { [TOKEN]: doc(), [GUEST]: doc() };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?') && (opts.method || 'GET') === 'GET') {
    const t = new URL(u, 'https://x').searchParams.get('t');
    return DOCS[t] ? json(DOCS[t]) : json({ error: 'Crew not found' }, 404);
  }
  return json({ error: 'not in this test' }, 503); // every write refused: nothing leaves
}

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'Nine' }]),
    [`fn_me_v3_${TOKEN}`]: 'Gus', // the one of the nine who has not picked Dog Blood
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
    fn_coach_v1: '1',
  },
  fetch: network,
});
test.after(() => shell.close());
const { $, dom } = shell;
await settle(200);

// "On screen" for jsdom: not inside anything hidden. The app asks this of the
// plan (planShowsNow) and of the dock (measureFoot); without an answer every
// element reads as off screen, which would make the one-NOW rule untestable.
dom.window.Element.prototype.getClientRects = function () {
  for (let e = this; e; e = e.parentElement) {
    if (e.hidden || e.style.display === 'none' || e.classList.contains('hidden') || e.classList.contains('searching')) return [];
  }
  return [{ top: 0, left: 0, width: 1, height: 1 }];
};

const plan = () => $('plan');
const tagged = () => plan().querySelector('.plan-row.tagged');
const showing = () => !!plan() && !plan().hidden;
const search = $('search-input');
// Repaint on the current clock: the search field's own round trip (a query
// repaints, clearing it repaints again) — the path a person takes.
async function repaint() {
  search.value = 'zz';
  search.dispatchEvent(new dom.window.Event('input'));
  search.value = '';
  search.dispatchEvent(new dom.window.Event('input'));
  await settle(40);
}
await repaint();

test('the peek: one #plan before the dock, the NOW row in its window, the day behind it', () => {
  assert.ok(showing(), 'a festival night with stops has a peek');
  assert.equal(plan().dataset.state, 'peek');
  assert.equal(plan().compareDocumentPosition($('dock')) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, dom.window.Node.DOCUMENT_POSITION_FOLLOWING,
    'the dock comes after it');
  assert.equal(plan().parentElement.previousElementSibling, $('day-rail'), 'right after the day rail: a keyboard meets it before the wall');
  assert.equal(tagged().getAttribute('aria-label'), 'Now: Dog Blood, Pier Stage, till 10:15 PM, 8 of us');
  assert.equal(tagged().querySelector('.plan-what .nm').textContent, 'Dog Blood', 'the artist leads');
  assert.equal(tagged().querySelector('.plan-what .pl').textContent, 'Pier Stage', 'the place under it');
  assert.equal(tagged().querySelector('.plan-tag').textContent, 'NOW');
  assert.ok(plan().querySelector('.plan-head').inert, 'what the peek hides is not there for a keyboard either');
  const others = [...plan().querySelector('.plan-list').children].filter((r) => r !== tagged());
  assert.ok(others.length > 3, 'the rest of the day is laid out behind the window');
  assert.ok(others.every((r) => r.inert));
  const head = plan().querySelector('.plan-head .room-head');
  assert.equal(head.querySelector('.name').textContent, 'SAT OUR PLAN', 'the wall’s head grammar');
  assert.equal(head.querySelector('.sub').textContent, 'Sep 26 · 9 of us picking');
});

test('one NOW: the dock’s NOW steps aside while the peek says NOW, and comes back for a NEXT', async () => {
  await repaint();
  assert.equal($('dock-now').hidden, true, 'the peek’s NOW is the one NOW');
  setClock(SAT_11AM);
  await repaint();
  assert.equal(tagged().querySelector('.plan-tag').textContent, 'NEXT');
  assert.match(tagged().getAttribute('aria-label'), /^Next: Tove Lo, Pier Stage, 5:40 PM, 6 of us$/);
  assert.equal($('dock-now').hidden, false, 'a NEXT is not a NOW: the dock keeps its way to the now line');
  setClock(SAT_940);
  await repaint();
  assert.equal($('dock-now').hidden, true);
});

test('a pick counts at once: tapping Dog Blood makes it nine of us on the peek', async () => {
  const card = $('wall-root').querySelector('.card[data-artist="Dog Blood"]');
  assert.ok(card);
  card.click();
  await settle(40);
  assert.equal(tagged().getAttribute('aria-label'), 'Now: Dog Blood, Pier Stage, till 10:15 PM, 9 of us');
  card.click(); card.click(); card.click(); card.click(); // round the levels back to none
  await settle(40);
  assert.equal(tagged().getAttribute('aria-label'), 'Now: Dog Blood, Pier Stage, till 10:15 PM, 8 of us');
});

test('the grabber opens and closes it, Escape closes it, and neither writes history', async () => {
  const len = history.length;
  const hash = location.hash;
  const grab = plan().querySelector('.plan-grab');
  grab.click();
  assert.equal(plan().dataset.state, 'open');
  assert.equal(grab.getAttribute('aria-expanded'), 'true');
  assert.equal(plan().querySelector('.plan-head').inert, false);
  assert.ok(tagged().nextElementSibling.classList.contains('plan-grow'), 'the NOW row’s card is grown under it in the day plan');
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(plan().dataset.state, 'peek');
  grab.click();
  assert.equal(plan().dataset.state, 'open');
  grab.click();
  assert.equal(plan().dataset.state, 'peek');
  assert.equal(history.length, len, 'no history entry: Back does what it does from the wall');
  assert.equal(location.hash, hash);
});

test('a row tap grows that stop’s card under it, leaves the NOW card grown, and the same tap folds it', async () => {
  plan().querySelector('.plan-grab').click();
  const row = [...plan().querySelectorAll('.plan-row')].find((r) => r.dataset.stop && !r.classList.contains('tagged')
    && !r.classList.contains('earlier') && !r.classList.contains('or') && !r.classList.contains('scattered'));
  const key = row.dataset.stop;
  row.querySelector('.plan-what').click();
  const again = plan().querySelector(`.plan-row[data-stop="${CSS.escape(key)}"]`);
  assert.ok(again.nextElementSibling && again.nextElementSibling.classList.contains('plan-grow'), 'its card, as the next sibling');
  assert.ok(tagged().nextElementSibling.classList.contains('plan-grow'), 'the NOW card stays grown: a tap never folds a card elsewhere (storyboard 8)');
  assert.equal(plan().querySelectorAll('.plan-grow').length, 2);
  again.querySelector('.plan-what').click();
  const folded = plan().querySelector(`.plan-row[data-stop="${CSS.escape(key)}"]`);
  assert.ok(!folded.nextElementSibling || !folded.nextElementSibling.classList.contains('plan-grow'));
  tagged().querySelector('.plan-what').click();
  assert.equal(plan().querySelectorAll('.plan-grow').length, 0, 'the NOW card folds by its own row');
  plan().querySelector('.plan-grab').click();
  assert.equal(plan().dataset.state, 'peek');
  plan().querySelector('.plan-grab').click();
  assert.equal(plan().querySelectorAll('.plan-grow').length, 0, 'and stays folded when the plan opens again');
  plan().querySelector('.plan-grab').click();
});

test('a search puts the peek away (the search wall has no clock); clearing it brings it back', async () => {
  search.value = 'dog';
  search.dispatchEvent(new dom.window.Event('input'));
  await settle(20);
  assert.equal(showing(), false);
  search.value = '';
  search.dispatchEvent(new dom.window.Event('input'));
  await settle(20);
  assert.equal(showing(), true);
  assert.equal(plan().dataset.state, 'peek', 'it comes back as the peek, never open');
});

test('one NOW through a search: a query cleared in the field, then the blur — the dock’s NOW steps aside again', async () => {
  await repaint();
  assert.equal($('dock-now').hidden, true, 'the peek’s NOW is the one NOW');
  search.focus();
  search.value = 'dog';
  search.dispatchEvent(new dom.window.Event('input'));
  await settle(20);
  search.value = '';
  search.dispatchEvent(new dom.window.Event('input'));
  await settle(20);
  search.blur();
  await settle(20);
  assert.equal(showing(), true);
  assert.equal($('dock-now').hidden, true, 'the peek is back with its NOW: the dock does not say it too');
});

// A pointer, as jsdom can make one: no layout (the window's numbers are all
// 0, so any travel past the slop reads as all the way), no capture.
const pointer = (type, target, y) => target.dispatchEvent(new dom.window.PointerEvent(type, { pointerId: 7, clientY: y, button: 0, bubbles: true }));

test('a new answer under a hand waits for it: the drag keeps its place, and the release decides from where the finger is', async () => {
  await repaint();
  assert.equal(plan().dataset.state, 'peek');
  pointer('pointerdown', tagged(), 700);
  pointer('pointermove', plan(), 600); // up past the slop: open, under the finger
  assert.equal(document.body.dataset.busy, 'plan-drag');
  const card = $('wall-root').querySelector('.card[data-artist="Dog Blood"]');
  card.click(); // a pick lands mid-drag: the plan's answer changes (nine of us)
  await settle(20);
  assert.equal(tagged().getAttribute('aria-label'), 'Now: Dog Blood, Pier Stage, till 10:15 PM, 8 of us', 'the rows wait for the hand');
  await new Promise((r) => setTimeout(r, 120)); // the hand stops, then lets go: no flick, the place decides
  pointer('pointerup', plan(), 600);
  assert.equal(plan().dataset.state, 'open', 'released open, where the finger had taken it');
  assert.equal(tagged().getAttribute('aria-label'), 'Now: Dog Blood, Pier Stage, till 10:15 PM, 9 of us', 'and the answer that waited is drawn');
  assert.equal(document.body.dataset.busy, undefined);
  await new Promise((r) => setTimeout(r, 450)); // the click that follows a drag is swallowed for a moment
  plan().querySelector('.plan-grab').click();
  card.click(); card.click(); card.click(); card.click(); // round the levels back to none
  await settle(40);
  assert.equal(plan().dataset.state, 'peek');
});

test('a keyboard: stop rows are buttons in the open plan and not in the peek; Enter grows a card and the focus stays on its row', async () => {
  await repaint();
  const stops = () => [...plan().querySelectorAll('.plan-list > button.plan-row:not(.earlier)')];
  assert.ok(stops().length > 3);
  assert.ok(stops().every((r) => r.tabIndex === -1), 'the peek is a window, not a set of controls');
  plan().querySelector('.plan-grab').click();
  assert.ok(stops().every((r) => r.tabIndex === 0 && !r.hasAttribute('tabindex')), 'open: every stop is a plain button, a tab stop');
  const row = stops().find((r) => !r.classList.contains('tagged'));
  const key = row.dataset.stop;
  assert.equal(row.getAttribute('aria-expanded'), 'false');
  row.focus();
  row.click(); // Enter and Space on a button are its click
  const again = plan().querySelector(`.plan-row[data-stop="${CSS.escape(key)}"]`);
  assert.equal(again.getAttribute('aria-expanded'), 'true');
  assert.equal(document.activeElement, again, 'the new row for the same stop has the focus');
  again.click();
  assert.equal(plan().querySelector(`.plan-row[data-stop="${CSS.escape(key)}"]`).getAttribute('aria-expanded'), 'false');
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(plan().dataset.state, 'peek');
  assert.equal(document.activeElement, plan().querySelector('.plan-grab'), 'a focus the peek hides goes to the grabber');
});

test('a click with no hand behind it opens the peek (a screen reader’s activation), and the plan’s own taps are not doubled', async () => {
  await repaint();
  tagged().click();
  assert.equal(plan().dataset.state, 'open');
  plan().querySelector('.plan-grab').click();
  assert.equal(plan().dataset.state, 'peek');
});

test('nothing two days before the festival; the day before, tomorrow’s first stop with its weekday', async () => {
  setClock(TUE_NOON);
  await repaint();
  assert.equal(showing(), false, 'no peek on the days before a festival');
  setClock(WED_NOON);
  await repaint();
  assert.ok(showing());
  assert.equal(tagged().querySelector('.plan-tag').textContent, 'NEXT');
  assert.match(tagged().querySelector('.plan-when .t').textContent, /^Thu /, 'a stop that is not tonight says its night');
  setClock(SAT_940);
  await repaint();
});

test('the welcome card first: a guest’s peek waits under it and rises when it goes', async () => {
  location.hash = `#g=${GUEST}`;
  await settle(200);
  const card = document.getElementById('welcome-card');
  assert.ok(card, 'a phone with no name here is welcomed');
  assert.equal(showing(), false, 'one thing at a time above the dock');
  const look = [...card.querySelectorAll('button')].find((b) => b.textContent === 'Look around');
  look.click();
  await settle(60);
  assert.equal(document.getElementById('welcome-card'), null);
  assert.ok(showing(), 'the card gone, the peek rises');
  assert.equal(tagged().getAttribute('aria-label'), 'Now: Dog Blood, Pier Stage, till 10:15 PM, 8 of us', 'a guest sees the crew’s plan');
});
