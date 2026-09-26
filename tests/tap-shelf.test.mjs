// The tap change (Kevin, 2026-09-26): a FINGER's tap on a card opens ONE shelf —
// the card's facts, − and + in its bottom corners, the thread — and
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
import { deepMerge } from '../js/merge.js';
import { pointerClick, typedClick, POINTER_IDS } from './helpers/pointer-click.mjs';

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
// The made-up server keeps what it is sent, merged in as crew.js merges — so a
// push's answer (or a poll) carries this phone's own picks back. It used to
// answer every push with the untouched DOC, and under a loaded full-suite run
// at the night clock the sync timer fired mid-test and that answer wiped
// Kevin's pick (2026-09-26 evening: Robyn 1 → 0; 1 run in 3, never alone).
let served = DOC;
async function network(url, opts = {}) {
  const u = String(url);
  if ((opts.method || 'GET') !== 'GET') {
    if (u.startsWith('/api/crew')) {
      try { served = deepMerge(served, JSON.parse(opts.body || '{}').data || {}); } catch { /* not a crew write */ }
    }
    return json(served);
  }
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?')) return json(served);
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
// Your level on the shelf is your own chip in its who-row (Kevin, 2026-09-26:
// the meter that stood between − and + was a second copy of it); '0' = none.
const mineChip = () => shelf().querySelector('.sheet-card .f-who .f-nm.you')?.closest('.f-pill') || null;
const mine = () => (mineChip() ? mineChip().dataset.level : '0');
const level = (artist) => (state.crewDoc.festivals[FID].selections[artist] || {}).Kevin || 0;
const press = (el, pointerType, pointerId = POINTER_IDS[pointerType]) => el.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, pointerType, pointerId }));
const lift = (el, pointerType, pointerId = POINTER_IDS[pointerType]) => el.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerType, pointerId }));
// A tap as an engine sends it: the press, the lift, then the click typed as
// that engine types it — WebKit (the iPhone, the default here) says "mouse"
// for the click after a finger, so there the press decides; Chromium says
// "touch" (helpers/pointer-click.mjs).
async function tap(el, pointerType = 'touch', engine = 'webkit') {
  pointerClick(window, el, pointerType, { engine });
  await settle(20);
}
const handSaid = () => [document.documentElement.dataset.hand, document.documentElement.dataset.handBy];
async function closeShelf() {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await settle(60);
  if (shelf()) { history.back(); await settle(60); }
  assert.equal(shelf(), null, 'the shelf is down');
}

test('a finger’s tap opens the card’s shelf — facts, − and +, the thread — and writes nothing', async () => {
  await tap(cardOf('Robyn'));
  assert.ok(shelf(), 'the shelf is up');
  assert.equal(shelf().classList.contains('join-shelf'), false, 'the notes shelf, not a question');
  assert.equal(document.querySelector('#zoom-layer .zoom-card'), null, 'no zoom on a finger');
  assert.equal(shelf().querySelector('.sheet-card .f-name').textContent, 'Robyn');
  assert.deepEqual([...row().children].map((n) => n.className.split(' ')[0]), ['f-step', 'f-step'],
    '− and +, nothing between: no second meter, and no notes door — the thread is right there');
  assert.ok(shelf().querySelector('.sheet-card').classList.contains('steps'), 'the card that stands them in its corners');
  assert.equal(shelf().querySelector('.f-chip.notes, .chip-notes'), null, 'no notes button of its own');
  assert.equal(mine(), '0', 'no chip of yours in the who-row yet');
  assert.equal(minus().disabled, true, 'nothing to lower');
  assert.equal(plus().getAttribute('aria-label'), 'More for Robyn');
  assert.ok(shelf().querySelector('.composer textarea'), 'a member writes here');
  assert.equal(level('Robyn'), 0, 'a look writes nothing');
  assert.ok((history.state && history.state.layers || []).some((k) => k.startsWith('sheet:notes:')), 'Back closes it: it has an entry');
  assert.deepEqual(handSaid(), ['finger', 'press'], 'the page says the hand, and that the press decided it (WebKit typed the click "mouse")');
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
    assert.equal(mine(), String(want), 'your own chip in the who-row says it');
  }
  assert.equal(plus().disabled, true, 'nowhere higher than must');
  assert.equal(mineChip().querySelector('.must')?.textContent, 'MUST', 'your chip says MUST');
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
  assert.equal(mine(), '0', 'no chip of yours again');
  await closeShelf();
});

test('the line does not come back, and a pen taps like a finger', async () => {
  await tap(cardOf('Dog Blood'), 'pen');
  assert.ok(shelf(), 'a pen opens the shelf');
  assert.equal(shelf().querySelector('.shelf-news'), null, 'once was enough');
  assert.equal(mine(), '3', 'your level on this card, on your chip');
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
  typedClick(window, el, 'mouse'); // WebKit's click for that lift
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
  typedClick(window, document.getElementById('sheet-backdrop'), 'touch'); // where that engine's click would land
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
  // A "mouse"-typed click (WebKit's after a finger) and an untyped one (an
  // older engine's) are the two a press decides.
  for (const type of ['mouse', undefined]) {
    press(b, 'touch');
    b.dispatchEvent(new window.PointerEvent('pointercancel', { bubbles: true, pointerType: 'touch', pointerId: POINTER_IDS.touch }));
    typedClick(window, b, type);
    assert.equal(hand, 'assistive', `${type}: the cancelled press answers nothing`);
    press(b, 'mouse');
    lift(b, 'mouse');
    typedClick(window, b, type);
    assert.equal(hand, 'mouse', `${type}: a click answers the press (and lift) before it`);
    typedClick(window, b, type);
    assert.equal(hand, 'assistive', `${type}: once — a second click has no press of its own`);
  }
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

// max-height is the sheet's CONTENT box: its padding and border come off what shows.
const edgeOf = (el) => { const cs = window.getComputedStyle(el); return ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((n, k) => n + (Number.parseFloat(cs[k]) || 0), 0); };

// Sol 6's review (2026-09-26): the shelf rides the keys the way the join shelf
// always has — one helper for both (notes.js rideKeys), so its sticky composer
// stays above an iPhone's keyboard.
test('with the keys up the shelf stands on them, its height capped to what shows; keys down, it is back; closed, it stops riding', async () => {
  const { fakeKeys } = await import('./helpers/fake-keys.mjs');
  const kb = fakeKeys(window);
  await tap(cardOf('Robyn'));
  const sheet = shelf();
  assert.equal(kb.listening(), 2, 'the open shelf listens to the viewport (resize and scroll)');
  kb.keys(336);
  assert.equal(sheet.style.bottom, '336px', 'it stands on the keys');
  assert.equal(sheet.style.maxHeight, `${Math.floor(window.innerHeight - 336 - 12 - edgeOf(sheet))}px`, 'no taller than what still shows (its padding counted)');
  assert.ok(sheet.querySelector('.composer-wrap.composer-foot'), 'its foot is the composer, which sticks to that bottom edge');
  assert.equal(sheet.style.overflowY, 'auto', 'capped, it scrolls (the join shelf is overflow: visible at rest)');
  kb.keys(0);
  assert.equal(sheet.style.overflowY, '', 'and not once the keys are down');
  assert.equal(sheet.style.bottom, '', 'keys down: back on the screen\'s edge');
  assert.equal(sheet.style.maxHeight, '');
  await closeShelf();
  assert.equal(kb.listening(), 0, 'a closed shelf stops riding');
});

test('a centred dialog (an iPad, ≥720) centres in what the keys leave, never stretches', async () => {
  const { fakeKeys } = await import('./helpers/fake-keys.mjs');
  const kb = fakeKeys(window);
  const mm = window.matchMedia;
  window.matchMedia = (q) => ({ matches: /min-width:\s*720px/.test(q), addEventListener() {}, removeEventListener() {} });
  try {
    await tap(cardOf('Robyn'));
    const sheet = shelf();
    kb.keys(400);
    assert.equal(sheet.style.bottom, '', 'no bottom: a dialog is centred, and a bottom would stretch it');
    assert.equal(sheet.style.top, `${Math.round((window.innerHeight - 400) / 2)}px`, 'centred in what shows');
    assert.equal(sheet.style.maxHeight, `${Math.floor(window.innerHeight - 400 - 24 - edgeOf(sheet))}px`);
    kb.keys(0);
    assert.equal(sheet.style.top, '');
  } finally {
    window.matchMedia = mm;
  }
  await closeShelf();
});

// Sol 6's re-review (2026-09-26): a click answers only the press the browser
// pairs it with — lifted, just now, where the press and the lift both were.
test('an abandoned press answers no later click: the assistive activation that follows opens the shelf, never picks', async () => {
  const before = level('Robyn');
  const el = cardOf('Robyn');
  // A mouse press on the card that never became a click (dragged off the
  // window, released nowhere the page hears)…
  press(el, 'mouse');
  await settle(10);
  // …then VoiceOver's double-tap on the same card: a click, no press of its
  // own — typed '' by today's engines (no press is asked at all), untyped by
  // an older one (the press is asked, and the held one answers nothing).
  for (const type of ['', undefined, 'mouse']) {
    typedClick(window, el, type);
    await settle(20);
    assert.ok(shelf(), `${JSON.stringify(type)}: the shelf, not a pick — the held press answers nothing`);
    assert.equal(level('Robyn'), before, 'nothing picked unseen');
    await closeShelf();
  }
  lift(el, 'mouse'); // let that mouse go
  // A press that DID lift, but long ago, answers nothing either.
  press(el, 'mouse');
  lift(el, 'mouse');
  const now = performance.now;
  performance.now = () => now.call(performance) + 5000; // the click comes seconds after that lift
  try { typedClick(window, cardOf('Robyn'), 'mouse'); } finally { performance.now = now; }
  await settle(20);
  assert.ok(shelf(), 'a stale lift is not this click\'s press');
  assert.equal(level('Robyn'), before);
  await closeShelf();
});

test('a press on one card released on another: the click goes to what holds both, and neither card opens or picks', async () => {
  const a = cardOf('Robyn');
  const b = cardOf('Dog Blood');
  const ra = level('Robyn');
  const rb = level('Dog Blood');
  const { clickHand } = await import('../js/v3/card-facts.js');
  press(a, 'mouse');
  lift(b, 'mouse');
  // The browser sends that click to the nearest thing holding both cards.
  let common = a.parentElement;
  while (common && !common.contains(b)) common = common.parentElement;
  let hand = null;
  const hear = (e) => { hand = clickHand(e); };
  common.addEventListener('click', hear, { once: true });
  typedClick(window, common, 'mouse');
  await settle(20);
  assert.equal(hand, 'mouse', 'it is the mouse\'s click (it answers that press)');
  assert.equal(shelf(), null, 'no shelf');
  assert.equal(level('Robyn'), ra, 'the first card: nothing');
  assert.equal(level('Dog Blood'), rb, 'the second card: nothing');
});

// Sol 6's third review of the hand (2026-09-26): a finger and a mouse down
// on one card at once are two presses, never one. The finger's lift and click
// are the finger's — the shelf, nothing picked — however the engine types
// that click; the mouse's own lift and click, later, are still the mouse's.
test('a finger and a mouse down together: the finger\'s click opens the shelf, and the mouse\'s click still picks', async () => {
  for (const engine of ['chromium', 'webkit']) {
    const el = cardOf('Robyn');
    const before = level('Robyn');
    press(el, 'touch');  // the finger lands
    press(el, 'mouse');  // a mouse button goes down on the same card
    lift(el, 'touch');   // the finger lifts: its click
    if (engine === 'chromium') typedClick(window, el, 'touch', POINTER_IDS.touch);
    else typedClick(window, el, 'mouse', POINTER_IDS.mouse); // WebKit types the finger's click "mouse"
    await settle(20);
    assert.ok(shelf(), `${engine}: the finger's click opens the shelf`);
    assert.equal(level('Robyn'), before, `${engine}: and picks nothing`);
    assert.deepEqual(handSaid(), ['finger', engine === 'chromium' ? 'type' : 'press'], `${engine}: the finger's, and what said so`);
    await closeShelf();
    // The mouse, still down, lets go on the same card: its click is its own.
    assert.equal(cardOf('Robyn'), el, 'the same card node (nothing was picked)');
    lift(el, 'mouse');
    typedClick(window, el, 'mouse', POINTER_IDS.mouse);
    await settle(20);
    assert.equal(level('Robyn'), before + 1, `${engine}: the mouse's click picks`);
    assert.equal(shelf(), null);
    // Back where the next cases expect Robyn (the cycle: to must, then nothing).
    for (let i = 0; i < 4; i++) await tap(cardOf('Robyn'), 'mouse');
    assert.equal(level('Robyn'), before);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await settle(20);
  }
});

test('a finger\'s tap in Chromium says "touch" on its click, and the click decides', async () => {
  const before = level('Robyn');
  await tap(cardOf('Robyn'), 'touch', 'chromium');
  assert.ok(shelf(), 'the shelf');
  assert.equal(level('Robyn'), before, 'nothing picked');
  assert.deepEqual(handSaid(), ['finger', 'type']);
  await closeShelf();
});

// Each click by what it says, and by the press behind it only where it cannot
// say: 'touch' and 'pen' are a finger, '' is a key (an Enter or Space on this
// element, this turn) or an assistive activation; 'mouse' — which WebKit also
// says after a finger — and no pointerType at all (an engine older than
// click-as-PointerEvent) are judged by the press they answer.
test('the hand of every kind of click: by its type, by a key this turn, or by the press it answers', async () => {
  const { clickHand } = await import('../js/v3/card-facts.js');
  const b = document.createElement('button');
  const other = document.createElement('button');
  document.body.append(b, other);
  let hand = null;
  b.addEventListener('click', (e) => { hand = clickHand(e); });
  const said = (type, id) => { typedClick(window, b, type, id); return [hand, document.documentElement.dataset.handBy]; };
  const key = (el, k, kind = 'keydown') => el.dispatchEvent(new window.KeyboardEvent(kind, { key: k, bubbles: true, cancelable: true }));

  // The click's own word, where every engine tells the truth.
  assert.deepEqual(said('touch'), ['finger', 'type']);
  assert.deepEqual(said('pen'), ['finger', 'type']);
  assert.deepEqual(said(''), ['assistive', 'type'], 'no pointer, no key: VoiceOver, Switch Control');
  key(b, 'Enter');
  assert.deepEqual(said(''), ['keyboard', 'key'], 'Enter\'s own click, in its keydown\'s turn');
  await settle(5);
  assert.deepEqual(said(''), ['assistive', 'type'], 'a turn later the key is spent');
  key(b, ' ');
  await settle(5);
  key(b, ' ', 'keyup');
  assert.deepEqual(said(''), ['keyboard', 'key'], 'Space clicks on its keyup');
  await settle(5);
  key(other, 'Enter');
  assert.deepEqual(said(''), ['assistive', 'type'], 'a key on another element is not this click\'s');
  await settle(5);

  // 'mouse': the press it answers decides.
  press(b, 'mouse'); lift(b, 'mouse');
  assert.deepEqual(said('mouse'), ['mouse', 'press']);
  press(b, 'touch'); lift(b, 'touch');
  assert.deepEqual(said('mouse'), ['finger', 'press'], 'WebKit\'s click after a finger');
  press(b, 'pen'); lift(b, 'pen');
  assert.deepEqual(said('mouse'), ['finger', 'press'], 'and after a pen');
  assert.deepEqual(said('mouse'), ['assistive', 'none'], 'no press left to answer: the shelf, the safe side');
  press(b, 'mouse');
  assert.deepEqual(said('mouse'), ['assistive', 'none'], 'a press still held answers nothing');
  lift(b, 'mouse');
  press(other, 'touch'); lift(other, 'touch');
  assert.deepEqual(said('mouse'), ['mouse', 'press'], 'the lift that answers is this element\'s, the mouse\'s');
  press(b, 'mouse'); lift(b, 'mouse');
  press(b, 'touch'); lift(b, 'touch');
  assert.deepEqual(said('mouse'), ['finger', 'press'], 'two lifts that could answer: the latest is the click\'s');

  // No pointerType at all (Safari before 18.2): a key this turn, else the press.
  press(b, 'touch'); lift(b, 'touch');
  assert.deepEqual(said(undefined), ['finger', 'press']);
  press(b, 'mouse'); lift(b, 'mouse');
  assert.deepEqual(said(undefined), ['mouse', 'press']);
  assert.deepEqual(said(undefined), ['assistive', 'none']);
  key(b, 'Enter');
  assert.deepEqual(said(undefined), ['keyboard', 'key']);
  await settle(5);
  b.remove();
  other.remove();
});

// Sol 6's re-review (2026-09-26): with a tall keyboard on a short screen (an
// SE; any phone on its side) what shows can be less than the old 200px floor,
// and a floor that overran it clipped the sheet's top. Never taller than what
// shows.
test('with keys that leave little room, the shelf is never taller than what shows', async () => {
  const { fakeKeys } = await import('./helpers/fake-keys.mjs');
  const kb = fakeKeys(window);
  await tap(cardOf('Robyn'));
  const sheet = shelf();
  const shows = (keys) => window.innerHeight - keys;
  for (const keys of [window.innerHeight - 180, window.innerHeight - 130, window.innerHeight - 90]) {
    kb.keys(keys);
    const max = Number.parseFloat(sheet.style.maxHeight) + edgeOf(sheet); // the whole box, padding and all
    assert.ok(max <= shows(keys), `keys ${keys}: ${max}px fits in the ${shows(keys)}px that shows`);
    assert.equal(sheet.style.bottom, `${keys}px`, 'standing on the keys');
  }
  kb.keys(window.innerHeight - 180);
  assert.equal(sheet.style.maxHeight, `${Math.floor(168 - edgeOf(sheet))}px`, 'with room, the 12px margin stands');
  kb.keys(0);
  await closeShelf();
});
