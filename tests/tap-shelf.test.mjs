// The tap change (Kevin, 2026-09-26): a FINGER's tap on a card opens ONE shelf —
// the card's facts, − · your meter · + along its floor, the thread — and
// picking lives on its − and +. A mouse click or a key still picks. A hold is
// a slow tap (the long-press is gone); an engine that turns a hold into
// `contextmenu` opens the same shelf and its lift's click is eaten. The real
// shell (index.html + app.js), a member of a made-up crew. (This file replaces
// tests/long-press.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const CREW = 'tapshelfunit_crew_0123456'; // made up, never a real link
const DOC = {
  v: 4, meta: { name: 'Tap Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } },
  // Kevin has picked before (Dog Blood): a returning member, who learned "a tap lights it".
  festivals: { [FID]: { selections: { Robyn: { Maya: 2 }, 'Dog Blood': { Kevin: 3 } } } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  if ((opts.method || 'GET') !== 'GET') return json(DOC);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?')) return json(DOC);
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${CREW}&f=${FID}`,
  storage: {
    fn_welcome_v1: '1',
    fn_crews_v3: JSON.stringify([{ token: CREW, name: 'Tap Crew' }]),
    [`fn_me_v3_${CREW}`]: 'Kevin',
    [`fn_crew_fest_v3_${CREW}`]: FID,
  },
  fetch: network,
});
test.after(() => shell.close());
const state = await import('../js/state.js');
const { TAP_NEWS } = await import('../js/v3/notes.js');
await settle(160);
const { window } = shell.dom;

const cardOf = (artist) => document.querySelector(`#wall-root .card[data-artist="${artist}"]`);
const shelf = () => document.getElementById('artist-sheet');
const row = () => shelf().querySelector('.sheet-card .f-step-row');
const minus = () => row().querySelector('.f-step.minus');
const plus = () => row().querySelector('.f-step.plus');
const meter = () => row().querySelector('.f-meter');
const level = (artist) => (state.crewDoc.festivals[FID].selections[artist] || {}).Kevin || 0;
const press = (el, pointerType) => el.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, pointerType }));
const lift = (el, pointerType) => el.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerType }));
// A tap as an engine sends it: the press, the lift, then the click (WebKit's
// click after a finger says "mouse" — the hand is the press, never the click).
async function tap(el, pointerType = 'touch') {
  press(el, pointerType);
  lift(el, pointerType);
  el.click();
  await settle(20);
}
async function closeShelf() {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await settle(60);
  if (shelf()) { history.back(); await settle(60); }
  assert.equal(shelf(), null, 'the shelf is down');
}

test('a finger’s tap opens the card’s shelf — facts, − · meter · +, the thread — and writes nothing', async () => {
  await tap(cardOf('Robyn'));
  assert.ok(shelf(), 'the shelf is up');
  assert.equal(shelf().classList.contains('join-shelf'), false, 'the notes shelf, not a question');
  assert.equal(document.querySelector('#zoom-layer .zoom-card'), null, 'no zoom on a finger');
  assert.equal(shelf().querySelector('.sheet-card .f-name').textContent, 'Robyn');
  assert.deepEqual([...row().children].map((n) => n.className.split(' ')[0]), ['f-step', 'f-meter', 'f-step'],
    '− · your meter · +, and no notes door: the thread is right there');
  assert.equal(shelf().querySelector('.f-chip.notes, .chip-notes'), null, 'no notes button of its own');
  assert.equal(meter().dataset.level, '0');
  assert.equal(minus().disabled, true, 'nothing to lower');
  assert.equal(plus().getAttribute('aria-label'), 'More for Robyn');
  assert.ok(shelf().querySelector('.composer textarea'), 'a member writes here');
  assert.equal(level('Robyn'), 0, 'a look writes nothing');
  assert.ok((history.state && history.state.layers || []).some((k) => k.startsWith('sheet:notes:')), 'Back closes it: it has an entry');
  assert.equal(document.documentElement.dataset.hand, 'finger', 'the page says the hand, for Diagnostics');
});

test('the one-time line, for a friend who picked before: once, never again on this phone', async () => {
  assert.equal(shelf().querySelector('.shelf-news')?.textContent, TAP_NEWS);
  assert.equal(localStorage.getItem('fn_tap_news_v1'), '1', 'remembered on this device, never in the crew doc');
  assert.equal(JSON.stringify(state.pendingChanges || {}).includes('tap_news'), false);
});

test('+ climbs one level a press to must and stops; the shelf stays; the wall behind follows', async () => {
  for (const want of [1, 2, 3, 4]) {
    plus().click();
    assert.equal(level('Robyn'), want);
    assert.ok(shelf(), 'the shelf stays up');
    assert.equal(meter().dataset.level, String(want), 'your meter between − and + says it');
  }
  assert.equal(plus().disabled, true, 'nowhere higher than must');
  assert.equal(meter().textContent, 'MUST');
  plus().click();
  assert.equal(level('Robyn'), 4, 'a spent + changes nothing');
  assert.match(cardOf('Robyn').getAttribute('aria-label'), /^Robyn — must/, 'the resting card behind says must');
  assert.equal(state.pendingChanges.festivals[FID].selections.Robyn.Kevin, 4, 'through the ordinary pick path: queued to send');
});

test('− steps back to not picked and stops — never a wraparound', async () => {
  for (const want of [3, 2, 1, 0]) { minus().click(); assert.equal(level('Robyn'), want); }
  assert.equal(minus().disabled, true);
  minus().click();
  assert.equal(level('Robyn'), 0);
  assert.equal(meter().classList.contains('empty'), true, 'the hollow meter again');
  await closeShelf();
});

test('the line does not come back, and a pen taps like a finger', async () => {
  await tap(cardOf('Dog Blood'), 'pen');
  assert.ok(shelf(), 'a pen opens the shelf');
  assert.equal(shelf().querySelector('.shelf-news'), null, 'once was enough');
  assert.equal(meter().dataset.level, '3', 'your level on this card');
  assert.equal(level('Dog Blood'), 3, 'nothing written');
  await closeShelf();
});

test('a mouse click still picks (the cycle) and opens nothing; Enter picks', async () => {
  await tap(cardOf('Robyn'), 'mouse');
  assert.equal(level('Robyn'), 1, 'click → picked');
  assert.equal(shelf(), null, 'no shelf on a click');
  cardOf('Robyn').focus();
  cardOf('Robyn').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await settle(20);
  assert.equal(level('Robyn'), 2, 'Enter → the next level');
  assert.equal(shelf(), null);
  // Put Robyn back where the next cases expect it: three more clicks to must, one to clear.
  for (let i = 0; i < 3; i++) await tap(cardOf('Robyn'), 'mouse');
  assert.equal(level('Robyn'), 0);
  // The keyboard's focus grew its zoom (the keyboard route, unchanged); put it away.
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await settle(20);
  assert.equal(document.querySelector('#zoom-layer .zoom-card'), null);
});

test('a hold is a slow tap: held past the old long-press, the lift’s click opens the shelf once', async () => {
  const el = cardOf('Robyn');
  Object.defineProperty(el, 'offsetParent', { configurable: true, get: () => document.body });
  press(el, 'touch');
  await settle(620);
  assert.equal(shelf(), null, 'nothing grows while the finger is down');
  assert.equal(document.querySelector('#zoom-layer .zoom-card'), null);
  lift(el, 'touch');
  el.click();
  await settle(20);
  assert.ok(shelf(), 'the release is a tap');
  assert.equal(level('Robyn'), 0, 'and picks nothing');
  await closeShelf();
});

test('a finger’s contextmenu (a hold on Android) opens the shelf, and the lift’s click that may follow is eaten', async () => {
  const el = cardOf('Robyn');
  Object.defineProperty(el, 'offsetParent', { configurable: true, get: () => document.body });
  press(el, 'touch');
  const menu = new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  el.dispatchEvent(menu);
  await settle(20);
  assert.equal(menu.defaultPrevented, true, 'no system menu over the card');
  assert.ok(shelf(), 'the shelf is up while the finger is still down');
  lift(document.getElementById('sheet-backdrop'), 'touch');
  document.getElementById('sheet-backdrop').click(); // where that engine's click would land
  await settle(40);
  assert.ok(shelf(), 'the click that followed did not close what the hold opened');
  assert.equal(level('Robyn'), 0);
  await closeShelf();
});

test('a mouse’s right-click keeps its menu and opens nothing', async () => {
  const el = cardOf('Robyn');
  press(el, 'mouse');
  const menu = new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  el.dispatchEvent(menu);
  await settle(20);
  assert.equal(menu.defaultPrevented, false);
  assert.equal(shelf(), null);
});

test('Escape closes the shelf and hands focus back to the card — growing no zoom there', async () => {
  const el = cardOf('Robyn');
  el.focus();
  await tap(el);
  assert.ok(shelf());
  plus().click(); // a pick replaces the resting card behind: focus must find the fresh one
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await settle(80);
  assert.equal(shelf(), null, 'Escape closed it');
  assert.equal(document.activeElement, cardOf('Robyn'), 'focus is back on the card — the fresh one the pick put in the old one\'s place');
  assert.equal(document.querySelector('#zoom-layer .zoom-card'), null, 'no zoom grew on the handed-back focus');
  assert.equal(level('Robyn'), 1);
});

// The review of the tap change (2026-09-26).
test('a crew-mate\'s repaint redraws the shelf\'s card in place: a key\'s focus on + survives it', async () => {
  const { refreshOpenSheet } = await import('../js/v3/notes.js');
  await tap(cardOf('Robyn'));
  assert.ok(shelf());
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true })); // the keyboard is driving now
  plus().focus();
  const cardBefore = shelf().querySelector('.sheet-card');
  refreshOpenSheet(); // what a remote sync calls
  assert.equal(shelf().querySelector('.sheet-card'), cardBefore, 'the same card node, redrawn in place');
  assert.ok(document.activeElement && document.activeElement.classList.contains('plus'), 'focus is still on +');
  assert.ok(shelf().contains(document.activeElement), 'inside the shelf');
  await closeShelf();
});

test('the shelf\'s composer is its sticky foot; All notes keeps its composer in the flow', async () => {
  const { openAllNotes, closeSheet } = await import('../js/v3/notes.js');
  await tap(cardOf('Robyn'));
  assert.ok(shelf().querySelector('.composer-wrap.composer-foot'), 'the shelf\'s composer sticks to its foot');
  await closeShelf();
  openAllNotes({ fid: FID, meName: 'Kevin', picks: {}, onOpenDayNotes() {}, onOpenFestNotes() {} });
  await settle(10);
  const all = document.getElementById('artist-sheet');
  assert.ok(all && all.querySelector('.composer-wrap'), 'All notes has a composer');
  assert.equal(all.querySelector('.composer-wrap.composer-foot'), null, 'but not the sticky foot');
  closeSheet();
});

test('the hold\'s click-eater stands down at a key: an Enter\'s click is never eaten', async () => {
  const el = cardOf('Robyn');
  Object.defineProperty(el, 'offsetParent', { configurable: true, get: () => document.body });
  press(el, 'touch');
  el.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  await settle(20);
  assert.ok(shelf(), 'the hold opened the shelf');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  let heard = 0;
  const b = document.createElement('button');
  document.body.appendChild(b);
  b.addEventListener('click', () => { heard += 1; });
  b.click();
  b.remove();
  assert.equal(heard, 1, 'the click after a key went through');
  await closeShelf();
});

test('Tab walks the shelf\'s own controls and wraps, moved by the sheet itself (Safari\'s Tab skips buttons)', async () => {
  await tap(cardOf('Robyn'));
  const sheet = shelf();
  // jsdom lays nothing out: give every control a box, as a browser would.
  for (const n of sheet.querySelectorAll('button, input, textarea, a[href]')) n.getClientRects = () => [{}];
  const tabKey = (shiftKey = false) => {
    const e = new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    (document.activeElement || sheet).dispatchEvent(e);
    return e.defaultPrevented;
  };
  sheet.focus();
  const doors = [...sheet.querySelectorAll('button, input, textarea, a[href], [tabindex="0"]')].filter((n) => !n.disabled);
  assert.equal(tabKey(), true, 'the sheet moved focus itself');
  assert.equal(document.activeElement, doors[0], 'from the sheet, the first control');
  for (let i = 1; i < doors.length; i++) tabKey();
  assert.equal(document.activeElement, doors[doors.length - 1], 'every control in order');
  tabKey();
  assert.equal(document.activeElement, doors[0], 'and it wraps, never out onto the wall');
  tabKey(true);
  assert.equal(document.activeElement, doors[doors.length - 1], 'Shift+Tab wraps back');
  await closeShelf();
});

// Sol 6's review (2026-09-26): an activation with no pointer press and no key
// of its own — VoiceOver's double-tap, Switch Control — opens the card's shelf
// on every screen, and never picks unseen. Enter on the card still picks.
test('an assistive activation (a click with no press of its own) opens the shelf and picks nothing; Diagnostics says so', async () => {
  const before = level('Robyn');
  cardOf('Robyn').click(); // no pointerdown, no key: what VoiceOver's double-tap sends
  await settle(20);
  assert.ok(shelf(), 'the card\'s shelf');
  assert.equal(shelf().querySelector('.sheet-card .f-name').textContent, 'Robyn');
  assert.equal(level('Robyn'), before, 'nothing picked unseen');
  assert.equal(document.documentElement.dataset.hand, 'assistive', 'the paste would say which hand');
  // Its − and + are the labelled controls; they step as they do for anyone.
  plus().click();
  assert.equal(level('Robyn'), before + 1, '+ on the shelf picks');
  minus().click();
  assert.equal(level('Robyn'), before);
  await closeShelf();
});

test('Enter on a card still picks, and a key\'s own click on a button is the keyboard\'s, not an assistive one', async () => {
  const before = level('Robyn');
  const el = cardOf('Robyn');
  el.focus();
  el.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await settle(20);
  assert.equal(level('Robyn'), before + 1, 'Enter picks');
  assert.equal(shelf(), null, 'and opens nothing');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); // the key's zoom
  await settle(20);
  const { clickHand } = await import('../js/v3/card-facts.js');
  const b = document.createElement('button');
  document.body.appendChild(b);
  let hand = null;
  b.addEventListener('click', (e) => { hand = clickHand(e); });
  b.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  b.click(); // the browser's own click for that Enter
  assert.equal(hand, 'keyboard');
  b.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  await settle(10);
  b.click(); // later, with no key and no press: assistive
  assert.equal(hand, 'assistive');
  b.remove();
  // Back to where the next cases expect Robyn.
  for (let i = 0; i < 4; i++) await tap(cardOf('Robyn'), 'mouse');
  assert.equal(level('Robyn'), before);
});

test('a press that became a scroll answers no click: the next pointerless click is assistive', async () => {
  const { clickHand } = await import('../js/v3/card-facts.js');
  const b = document.createElement('button');
  document.body.appendChild(b);
  let hand = null;
  b.addEventListener('click', (e) => { hand = clickHand(e); });
  b.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
  b.dispatchEvent(new window.PointerEvent('pointercancel', { bubbles: true, pointerType: 'touch' }));
  b.click();
  assert.equal(hand, 'assistive');
  b.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
  b.click();
  assert.equal(hand, 'mouse', 'a click answers the press before it');
  b.click();
  assert.equal(hand, 'assistive', 'once: a second click has no press of its own');
  b.remove();
});

test('"picked before" is any festival in this crew, then this phone\'s other crews under its name there (Sol 6\'s NIT)', async () => {
  const { pickedBefore } = await import('../js/v3/notes.js');
  assert.equal(pickedBefore('Zed'), false, 'nobody who never picked');
  state.crewDoc.festivals['acl-2026'] = { selections: { 'Kings of Leon': { Zed: 2 } } };
  try {
    assert.equal(pickedBefore('Zed'), true, 'a pick at another festival of this crew counts');
  } finally { delete state.crewDoc.festivals['acl-2026']; }
  assert.equal(pickedBefore('Zed'), false);
  const OTHER = 'tapshelfother_crew_012345'; // made up
  localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: CREW, name: 'Tap Crew' }, { token: OTHER, name: 'Other' }]));
  localStorage.setItem(`fn_me_v3_${OTHER}`, 'Ana');
  localStorage.setItem(state.LS.doc(OTHER), JSON.stringify({ v: 4, people: { Ana: { colorIndex: 1 } }, festivals: { 'acl-2026': { selections: { Doechii: { Ana: 1 } } } } }));
  assert.equal(pickedBefore('Zed'), true, 'a pick in another crew on this phone, under the name this phone is there');
  localStorage.setItem(`fn_me_v3_${OTHER}`, 'Bea');
  assert.equal(pickedBefore('Zed'), false, 'someone else\'s pick there is not yours');
});
