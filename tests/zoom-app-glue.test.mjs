// app.js's zoom glue, run rather than re-implemented (2026-09-01 review,
// coverage row "app.js glue"). Every other zoom test hand-writes a stand-in for
// this wiring inside makeCtx — which means the real handlers, the ones a person
// actually presses, have never been executed by CI at all.
//
// This file boots the real shell: the real index.html, the real js/v3/app.js,
// its real capture-phase pointerdown and Escape listeners. It cannot use the
// shared rig — app.js needs a genuine Location, history and navigator, and it
// starts three setIntervals that would keep the test process alive forever, so
// they are corralled here and cleared at the end.
//
// One thing here is a partial pin and says so: repaintWall is module-private,
// so the occurrence-matched restore is exercised through the same contract
// repaintWall uses (zoomSnapshot's occ, and renderCard's data-occ stamp)
// rather than through repaintWall's own body. Pinning that body honestly would
// need either a full boot with a crew and a festival on the wire, or exporting
// the handler — a production change outside this pass's approved list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM(readFileSync('index.html', 'utf8'), { url: 'https://fest.kevinhg.com/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// jsdom ships no window.CSS at all (checked 2026-09-01), and app.js's card
// lookups run every artist name through CSS.escape. Supplying it is rig, not
// stubbing-away-the-subject: it is a browser primitive, and the thing under
// test is which card the query MATCHES.
globalThis.CSS = { escape: (s) => String(s).replace(/[^\w-]/g, (c) => `\\${c}`) };
globalThis.history = dom.window.history;
globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
})();
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.defineProperty(globalThis, 'location', { value: dom.window.location, configurable: true });
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = (h) => clearTimeout(h);
globalThis.fetch = async () => { throw new Error('no network in this test'); };
dom.window.fetch = globalThis.fetch;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

// app.js's clock tick, its poll loop and the favicon animator are all
// setInterval. Left running, the process never exits and `node --test` hangs.
const intervals = new Set();
const realSetInterval = globalThis.setInterval;
globalThis.setInterval = (...a) => { const h = realSetInterval(...a); intervals.add(h); return h; };

// The real shell. Its boot() runs async and fails on the first fetch (no
// network), which it handles itself — we only want the module-level wiring.
await import('../js/v3/app.js');
globalThis.setInterval = realSetInterval;
await new Promise((r) => setTimeout(r, 60)); // let boot's failure settle

const state = await import('../js/state.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderCard } = await import('../js/v3/wall.js');
const zoom = await import('../js/v3/card-facts.js'); // the SAME instance app.js holds

const FID = 'glue-fest';
FESTIVAL_INDEX.push({ id: FID, status: 'lineup' });
FESTIVALS[FID] = {
  id: FID,
  name: 'Glue',
  artists: [
    { name: 'GRiZ', day: 'Saturday', stage: 'Pier Stage', time: '9:00 PM - 10:15 PM' },
    { name: 'GRiZ', day: 'Sunday', stage: 'Tunnel', time: '4:00 PM - 5:00 PM' },
  ],
};
state.activateCrew('gluetesttoken_0123456789', {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 } },
  festivals: { [FID]: { selections: { GRiZ: { Kevin: 1 } } } },
  affinity: {},
}, FID);

const ctx = { fid: FID, meName: 'Kevin', affinity: null, lowPower: true, picks: { GRiZ: { Kevin: 1 } }, taps: [], onTap: (a) => ctx.taps.push(a), onOpenNotes: null };
const wall = () => document.getElementById('wall-root');
const slot = () => document.querySelector('.zoom-slot');

function mount(occ) {
  const card = renderCard('GRiZ', ctx, { occ });
  wall().appendChild(card);
  return card;
}
const pointerdown = (node) => node.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
const escape = () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

test.beforeEach(() => { wall().replaceChildren(); ctx.taps.length = 0; });
test.afterEach(() => zoom.unzoom({ instant: true }));
test.after(() => { for (const h of intervals) clearInterval(h); dom.window.close(); });

test('a press outside the zoom closes it; a press on the overlay does not', () => {
  const card = mount({ day: 'Saturday' });
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday' }, instant: true });
  assert.ok(slot(), 'grown');

  // Inside means inside EITHER node — the resting card or its overlay.
  pointerdown(document.querySelector('#zoom-layer .f-name'));
  assert.ok(slot(), 'a press on the overlay is a pick, never a dismiss');
  pointerdown(card);
  assert.ok(slot(), 'and a press on the resting card is still inside the zoom');

  pointerdown(document.body);
  assert.equal(slot(), null, 'a press anywhere else puts it away');
  assert.equal(zoom.zoomedCard(), null);
});

test('the outside-press listener is capture-phase, so it runs before the tap it is judging', () => {
  const card = mount({ day: 'Saturday' });
  // Something between the press and the document that swallows propagation —
  // a sheet backdrop, a control with its own stopPropagation. A bubble-phase
  // listener would never hear the press at all.
  const shield = document.createElement('div');
  shield.appendChild(document.createElement('span'));
  wall().appendChild(shield);
  shield.addEventListener('pointerdown', (e) => e.stopPropagation());

  zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday' }, instant: true });
  pointerdown(shield.firstChild);
  assert.equal(slot(), null, 'the press was judged on the way DOWN, before anything could swallow it');
});

test('a press outside does NOT poison the card — the next hover still grows it', async () => {
  const card = mount({ day: 'Saturday' });
  // The HOVER route is the one that reads the dismissed mark, so the re-entry
  // has to come through wireCardZoom's intent rather than a direct zoomCard,
  // or a poisoned card would look fine.
  zoom.wireCardZoom(card, 'GRiZ', ctx, { occ: { day: 'Saturday' } });
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday' }, instant: true });
  pointerdown(document.body);
  assert.equal(slot(), null);
  // The pointer is by definition not on the card when the press was elsewhere,
  // so nothing would re-grow it and marking it dismissed only poisoned the next
  // hover: leave the overlay, click elsewhere before the grace close fires, and
  // the first re-entry did nothing (Codex gate, 2026-08-31).
  card.dispatchEvent(new dom.window.PointerEvent('pointerenter', { pointerType: 'mouse' }));
  await new Promise((r) => setTimeout(r, zoom.ZOOM_IN_MS + 120));
  assert.ok(slot(), 'the very next hover grows it again');
});

test('Escape closes exactly one layer and lets nothing else see the keypress', () => {
  const card = mount({ day: 'Saturday' });
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday' }, instant: true });

  let sawIt = 0;
  const nosy = () => { sawIt += 1; };
  document.addEventListener('keydown', nosy); // a sheet/router handler, in effect
  try {
    const e = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    assert.equal(slot(), null, 'the zoom went away');
    assert.equal(e.defaultPrevented, true, 'the press was consumed');
    assert.equal(sawIt, 0, 'a live zoom eats the press before any sheet or router handler — never two layers on one keypress');

    // With no zoom standing, Escape belongs to whatever is underneath.
    escape();
    assert.equal(sawIt, 1, 'and the moment the zoom is gone, the press passes through');
  } finally {
    document.removeEventListener('keydown', nosy);
  }
});

test('Escape marks the card dismissed — the hand is still on it, so it stays away', async () => {
  const card = mount({ day: 'Saturday' });
  zoom.wireCardZoom(card, 'GRiZ', ctx, { occ: { day: 'Saturday' } });
  zoom.zoomCard(card, 'GRiZ', ctx, { occ: { day: 'Saturday' }, instant: true });
  escape();
  assert.equal(slot(), null);
  // Unlike a press outside: here the pointer never moved, so re-growing on the
  // spot would fight the person who just put it away. Waiting out the full
  // dwell is what makes this bite — the mark is read when the intent ARMS.
  card.dispatchEvent(new dom.window.PointerEvent('pointerenter', { pointerType: 'mouse' }));
  await new Promise((r) => setTimeout(r, zoom.ZOOM_IN_MS + 120));
  assert.equal(slot(), null, 'the mark holds until the pointer leaves');

  card.dispatchEvent(new dom.window.PointerEvent('pointerleave', { pointerType: 'mouse' }));
  card.dispatchEvent(new dom.window.PointerEvent('pointerenter', { pointerType: 'mouse' }));
  await new Promise((r) => setTimeout(r, zoom.ZOOM_IN_MS + 120));
  assert.ok(slot(), 'and lifts the moment it does');
});

test('a repaint puts the zoom back on the occurrence it was on, not the artist\'s first card', () => {
  // An artist can play twice — a grid set and an afters event, or two days at
  // EF. Restoring by artist name alone lands on the wrong card for every
  // occurrence but the first (CORE-15 / the Codex gate of 2026-08-29).
  const sat = mount({ day: 'Saturday', stage: 'Pier Stage', time: '9:00 PM - 10:15 PM' });
  const sun = mount({ day: 'Sunday', stage: 'Tunnel', time: '4:00 PM - 5:00 PM' });
  assert.notEqual(sat.dataset.occ, sun.dataset.occ, 'the two cards are stamped with different occurrences');

  const facts = zoom.zoomCard(sun, 'GRiZ', ctx, { occ: JSON.parse(sun.dataset.occ), instant: true });
  assert.equal(facts.when, '4:00 – 5:00 PM · Sunday', 'the SECOND occurrence is the one on stage');
  const keep = zoom.zoomSnapshot();
  assert.deepEqual(keep.occ, JSON.parse(sun.dataset.occ), 'the snapshot carries the occurrence, not just the name');

  // What repaintWall does with that snapshot: the wall is rebuilt from nothing
  // and the zoom is put back on the card whose data-occ matches.
  zoom.unzoom({ instant: true, why: 'wall repaint' });
  wall().replaceChildren();
  const freshSat = mount({ day: 'Saturday', stage: 'Pier Stage', time: '9:00 PM - 10:15 PM' });
  const freshSun = mount({ day: 'Sunday', stage: 'Tunnel', time: '4:00 PM - 5:00 PM' });
  const want = keep.occ ? JSON.stringify(keep.occ) : '';
  const again = [...document.querySelectorAll(`#wall-root .card[data-artist="${CSS.escape(keep.artist)}"]`)]
    .find((el) => (el.dataset.occ || '') === want);

  assert.equal(again, freshSun, 'the match is the Sunday card');
  assert.notEqual(again, freshSat, 'and emphatically not the artist\'s first card');
  zoom.zoomCard(again, keep.artist, ctx, { ...keep, instant: true });
  assert.equal(zoom.zoomedCard(), freshSun, 'a crew-mate\'s poll arriving mid-hover cannot move the card you are resting on');
  assert.equal(document.querySelectorAll('.zoom-slot').length, 1);
});
