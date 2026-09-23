// YOUR meter on the card (2026-09-23). A friend asked to "scroll through my
// picks and see what I rated them, to decide if I want to go up or down" —
// and until now your level lived only in the aura's brightness and in the
// crew corner, where a busy card folded you into "+n". So the card carries a
// chip at the about corner's edge: three bars lit one per tap, the word MUST
// at four; and the crew corner counts everyone else.
//
// This drives REAL cards through REAL dispatched clicks (the pick-cycle
// harness), then the fit (aura.js GIVE_WAY) and the motion. jsdom has no
// layout, so the fit is driven with explicit widths here; the real widths
// are the browser contract's job (tests/browser/meter-contract.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="wall-root"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
let reduce = false;
dom.window.matchMedia = (q) => ({ matches: reduce && /reduce/.test(q), addEventListener() {}, removeEventListener() {} });

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderCard, refreshCard, fitCard, meterChip } = await import('../js/v3/wall.js');
const { hslOf } = await import('../js/v3/palette.js');
const { meterOf, needAt } = await import('../js/v3/aura.js');

const FID = 'meter-fest';
FESTIVAL_INDEX.push({ id: FID, status: 'lineup' });
FESTIVALS[FID] = {
  id: FID, name: 'Meter Fest',
  artists: [
    ...['Robyn', 'Soulwax', 'Crowded', 'Nobody Yet'].map((name) => ({ name, day: 'Saturday' })),
    // A cancelled act (Skepta's shape): off the grid, the entry kept and marked.
    { name: 'Called Off', day: 'Saturday', venue: 'Crane Stage', cancelled: { on: '2026-09-21' } },
  ],
};
// A made-up crew of seven; Kevin is you, colour slot 5 on purpose (not the
// board's first colour, so a hard-coded hue cannot pass by accident).
const PEOPLE = { Kevin: 5, Drew: 1, Kat: 2, Nhu: 3, Pegah: 4, Ross: 0, Sam: 6 };
state.activateCrew('metertesttoken_0123456789', {
  v: 4, meta: {}, spotify: {},
  people: Object.fromEntries(Object.entries(PEOPLE).map(([n, c]) => [n, { colorIndex: c }])),
  festivals: { [FID]: { selections: {
    Soulwax: { Drew: 4, Kat: 4, Nhu: 1, Pegah: 2, Ross: 3, Sam: 1 },
    Crowded: { Kevin: 4, Drew: 4, Kat: 4, Nhu: 1, Pegah: 2, Ross: 3, Sam: 1 },
    'Called Off': { Kevin: 4, Drew: 4, Nhu: 2 },
  } } },
  affinity: {},
}, FID);
state.recordAffinity('Kevin', { Crowded: { songs: 41, followed: true } });
state.recordNote(FID, 'artist', 'Crowded', model.makeNoteId('Drew', '2026-09-26T20:00:00.000Z', 'm1'), {
  author: 'Drew', ts: '2026-09-26T20:00:00.000Z', text: 'front left',
});

const ctx = {
  fid: FID, meName: 'Kevin', affinity: state.affinityLookup('Kevin'), lowPower: false,
  picks: model.picksFor(state.crewDoc, FID),
  onOpenNotes: () => {},
};
const setLevel = (artist, who, level) => {
  state.recordSelection(artist, who, level);
  const sels = state.crewDoc.festivals[FID].selections;
  (sels[artist] = sels[artist] || {})[who] = level;
  ctx.picks = model.picksFor(state.crewDoc, FID);
};
ctx.onTap = (artist) => {
  setLevel(artist, 'Kevin', model.nextTapLevel((ctx.picks[artist] || {}).Kevin || 0));
  for (const node of [...document.querySelectorAll(`#wall-root .card[data-artist="${artist}"]`)]) refreshCard(node, artist, ctx);
};
const wall = document.getElementById('wall-root');
const mount = (artist) => { wall.replaceChildren(renderCard(artist, ctx, { occ: { day: 'Saturday', stage: null, time: null } })); return wall.firstChild; };
const cardOf = (artist) => wall.querySelector(`.card[data-artist="${artist}"]`);
const click = (node) => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const meter = (card) => card.querySelector('.corner-about > .chip-meter');
const lit = (card) => [...meter(card).querySelectorAll('.bar')].map((b) => (b.classList.contains('on') ? 1 : 0)).join('');

test('the meter follows a real tap cycle: none, one bar, two, three, MUST, none', () => {
  const card = mount('Robyn');
  assert.equal(meter(card), null, 'not picked = no chip');
  const seen = [];
  for (let i = 0; i < 5; i++) {
    click(cardOf('Robyn'));
    const c = cardOf('Robyn');
    const m = meter(c);
    seen.push(!m ? 'none' : m.classList.contains('is-must') ? m.textContent : lit(c));
  }
  assert.deepEqual(seen, ['100', '110', '111', 'MUST', 'none']);
});

test('the meter sits at the about corner’s edge, in your colour with the white edge — never brand, never fest', () => {
  setLevel('Robyn', 'Kevin', 2);
  const card = mount('Crowded');
  const kinds = [...card.querySelector('.corner-about').children].map((c) => c.dataset.kind);
  assert.deepEqual(kinds, ['meter', 'notes', 'spotify'], 'first, so a scroll through your picks reads down one line');
  const m = meter(card);
  assert.equal(m.tagName, 'SPAN', 'a span, not a button: the card is the target');
  const fill = dom.window.document.createElement('i');
  fill.style.background = hslOf(PEOPLE.Kevin, 0.5);
  assert.equal(m.style.background, fill.style.background, 'your colour at .5 — the crew marks’ own fill');
  assert.match(m.style.borderColor, /^(#fff|white|rgb\(255, 255, 255\))$/, 'the white edge that means you');
  assert.equal(/brand|fest/.test(m.getAttribute('style')), false);
  // The builder How it works draws is this one.
  const alone = meterChip(meterOf({ level: 4, colorIndex: PEOPLE.Kevin }));
  assert.equal(alone.outerHTML, m.outerHTML);
});

test('a screen reader hears your level once: in the card’s label, and the chip is hidden from it', () => {
  const card = mount('Crowded');
  assert.equal(meter(card).getAttribute('aria-hidden'), 'true');
  const label = card.getAttribute('aria-label');
  assert.equal(label, 'Crowded — must, picked by 6 others, 1 note, in your Spotify');
  assert.equal(label.match(/must/g).length, 1, 'said once');
});

// A cancelled card keeps every pick on it — the crew's marks AND your meter —
// above its gray scrim (v3.css: both corners are z-index 1), because who was
// going is still worth reading, yours included (review round, 2026-09-23).
test('a cancelled card still carries your meter, above its scrim, beside the crew’s marks', () => {
  wall.replaceChildren(renderCard('Called Off', ctx, { time: 'Cancelled', occ: { day: 'Saturday', stage: null, time: null, venue: 'Crane Stage' } }));
  const card = cardOf('Called Off');
  assert.ok(card.classList.contains('cancelled'), 'it reads cancelled');
  const m = meter(card);
  assert.ok(m, 'your meter is on it');
  assert.equal(m.textContent, 'MUST');
  assert.equal(m.parentNode.className, 'corner-about', 'in the corner that sits above the scrim');
  assert.deepEqual([...card.querySelectorAll('.corner-who .mark')].map((x) => x.textContent), ['D', ''], 'and the crew’s marks, you not among them');
  assert.equal(card.getAttribute('aria-label'), 'Called Off (cancelled) — must, picked by 2 others');
});

test('the crew corner counts everyone else: you are never folded into "+n"', () => {
  const card = mount('Crowded');
  const marks = [...card.querySelectorAll('.corner-who .mark')];
  // Drew and Kat's musts, then the two first ticks (ordered keeps input
  // order within a group), then +2 for the rest — six others in all.
  assert.deepEqual(marks.map((m) => m.textContent), ['D', 'K', '', '', '+2']);
  assert.ok(marks.every((m) => !/255, 255, 255\)$|#fff$/.test(m.style.border)), 'no white edge in the corner: that is you, and you are on the left');
  // Soulwax: the same crew without you. The corner is identical — you were
  // never in it.
  const other = mount('Soulwax');
  assert.equal(meter(other), null);
  assert.deepEqual([...other.querySelectorAll('.corner-who .mark')].map((m) => m.textContent), ['D', 'K', '', '', '+2']);
});

test('a narrow card gives way in order, the "+n" stays true, and a wider one takes it all back', () => {
  const card = mount('Crowded');
  const parts = card._corners;
  const at = (step) => { fitCard(card, Math.ceil(needAt(parts, step))); return card; };
  const who = () => [...card.querySelectorAll('.corner-who .mark')].map((m) => m.textContent).join(' ');
  const shown = () => [...card.querySelector('.corner-about').children].filter((c) => !c.hidden).map((c) => c.dataset.kind).join(' ');
  const spotCount = () => { const n = card.querySelector('.chip-spotify .n'); return n && !n.hidden ? n.textContent : ''; };
  at(0);
  assert.equal(card.dataset.fit, '0');
  assert.equal(spotCount(), '41');
  at(1);
  assert.equal(spotCount(), '', '1: the Spotify count goes first');
  assert.equal(shown(), 'meter notes spotify', 'and the pill stays');
  at(2); assert.equal(who(), 'D K  +3', '2: a tick folds into +n');
  at(3); assert.equal(who(), 'D K +4');
  at(4); assert.equal(shown(), 'meter notes', '3: the Spotify pill');
  assert.equal(card.querySelector('.spot-glow').hidden, true, 'and its glow with it');
  at(5); assert.equal(who(), 'D +5', '4: a must folds');
  at(6); assert.equal(who(), '+6');
  at(7); assert.equal(who(), '', '5: the +n itself');
  at(8); assert.equal(shown(), 'meter', '6: the notes count — and never your meter');
  fitCard(card, 400);
  assert.equal(card.dataset.fit, '0');
  assert.equal(shown(), 'meter notes spotify');
  assert.equal(spotCount(), '41');
  assert.equal(who(), 'D K   +2', 'everything back');
  fitCard(card, 0);
  assert.equal(card.dataset.fit, '0', 'no width (a hidden screen) keeps everything');
});

// ---- the motion ---------------------------------------------------------------
// jsdom has no Element.animate, so every path is instant unless a test lends
// one. This one records what refreshCard asks for; the real motion is the
// real-browser walk's to judge.
const calls = [];
function lendAnimate() {
  dom.window.Element.prototype.animate = function animate(frames, opts) {
    const anim = { onfinish: null, oncancel: null, cancel() { if (this.oncancel) this.oncancel(); }, finish() { if (this.onfinish) this.onfinish(); }, finished: Promise.resolve() };
    calls.push({ el: this, frames, opts, anim });
    return anim;
  };
}
function takeAnimate() { delete dom.window.Element.prototype.animate; }
const tapAndWatch = (artist) => { calls.length = 0; click(cardOf(artist)); return calls.slice(); };
const describe = (c) => (c.el.classList.contains('leaving') ? 'leaving'
  : c.el.classList.contains('chip-meter') ? 'meter'
  : c.el.classList.contains('bar') ? `bar${[...c.el.parentNode.children].indexOf(c.el) + 1}`
    : c.el.classList.contains('must') ? 'word' : c.el.dataset.kind || c.el.className);

test('a level change is a small event: the chip grows in, each tap lights one bar, MUST arrives as a word, clearing recedes into the corner', () => {
  lendAnimate();
  try {
    setLevel('Robyn', 'Kevin', 0);
    mount('Robyn');
    const arrive = tapAndWatch('Robyn');
    assert.deepEqual(arrive.map(describe), ['meter'], '0 → 1: the chip grows out of the corner');
    assert.match(JSON.stringify(arrive[0].frames[0]), /scale\(\.4\)/);
    assert.equal(arrive[0].opts.easing, 'cubic-bezier(.2, 1.15, .35, 1)', 'the app’s arrive easing');
    const two = tapAndWatch('Robyn');
    assert.deepEqual(two.map(describe), ['bar2'], '1 → 2: only the new bar lights');
    assert.deepEqual(Object.keys(two[0].frames[0]).sort(), ['opacity', 'transform'], 'transform and opacity only');
    assert.deepEqual(tapAndWatch('Robyn').map(describe), ['bar3']);
    const must = tapAndWatch('Robyn');
    assert.ok(must.map(describe).includes('word'), '3 → 4: the word arrives');
    const word = must.find((c) => describe(c) === 'word');
    assert.equal(word.opts.easing, 'cubic-bezier(.2, 1.15, .35, 1)');
    // The bars are gone the instant the fresh chip lands, so a word that
    // waited showed an EMPTY pill for four or five frames (the review
    // round's slowed filmstrip, 2026-09-23). It rises with the widening.
    assert.ok(!word.opts.delay, `the word starts with the widening, never after an empty pill (delay ${word.opts.delay})`);
    // 4 → 0: nothing vanishes in place. The chip that was there recedes into
    // the corner's edge it grew from — quick and plain — while the
    // neighbours close the gap, and it is gone once it has.
    const clear = tapAndWatch('Robyn');
    assert.equal(clear.filter((c) => ['meter', 'word', 'bar1', 'bar2', 'bar3'].includes(describe(c))).length, 0, '4 → 0: no meter is left on the card');
    const leaving = clear.filter((c) => describe(c) === 'leaving');
    assert.equal(leaving.length, 1, 'the chip that was there leaves');
    const ghost = leaving[0];
    assert.equal(ghost.el.textContent, 'MUST', 'it is the chip you just saw — MUST');
    assert.equal(ghost.el.parentNode, cardOf('Robyn'), 'drawn on the fresh card while it leaves');
    assert.equal(ghost.el.dataset.kind, undefined, 'and invisible to the corner’s own bookkeeping');
    assert.equal(ghost.el.getAttribute('aria-hidden'), 'true');
    assert.deepEqual(Object.keys(ghost.frames.at(-1)).sort(), ['opacity', 'transform'], 'transform and opacity only');
    assert.equal(ghost.frames.at(-1).opacity, 0);
    assert.equal(ghost.frames.at(-1).transform, 'scale(0)', 'all the way into the edge');
    // In step with the neighbours closing the gap (OUT_MS on EASE_SURFACE —
    // jsdom has no layout, so no neighbour moves here; the browser contract
    // compares the two live): the pill sliding in chases the chip's right
    // edge and never covers it. On an ease-in the chip was still near full
    // size at 40ms with the pill already over it (the fix round's filmstrip).
    assert.equal(ghost.opts.duration, 130, 'OUT_MS: the way out is quick');
    assert.equal(ghost.opts.easing, 'cubic-bezier(.4, 0, .2, 1)', 'and plain, on the neighbours’ own curve');
    ghost.anim.finish();
    assert.equal(ghost.el.isConnected, false, 'gone when it has receded');
    assert.equal(meter(cardOf('Robyn')), null);
    // A crew-mate's pick repaints the card; nothing of yours moved.
    setLevel('Robyn', 'Kevin', 2);
    mount('Robyn');
    setLevel('Robyn', 'Drew', 4);
    calls.length = 0;
    refreshCard(cardOf('Robyn'), 'Robyn', ctx);
    assert.deepEqual(calls, [], 'your level did not change: no meter motion');
  } finally {
    takeAnimate();
  }
});

test('Low Power and reduced motion get the finished chip at once', () => {
  lendAnimate();
  try {
    setLevel('Robyn', 'Kevin', 0);
    ctx.lowPower = true;
    mount('Robyn');
    for (let i = 0; i < 5; i++) assert.deepEqual(tapAndWatch('Robyn'), [], `Low Power, tap ${i + 1}`);
    ctx.lowPower = false;
    reduce = true;
    mount('Robyn');
    for (let i = 0; i < 5; i++) assert.deepEqual(tapAndWatch('Robyn'), [], `reduced motion, tap ${i + 1}`);
  } finally {
    reduce = false;
    ctx.lowPower = false;
    takeAnimate();
  }
  assert.equal(meter(cardOf('Robyn')), null, 'and the cycle still ends where it began');
});

// ---- How it works -------------------------------------------------------------
// Row 1 draws a chip named Kat; row 4 draws Kat's must mark, a "K". One
// person on one screen wears one colour — the review round (2026-09-23) found
// row 4's K in magenta one row under a teal Kat.
test('How it works: the K in row 4 is the same Kat, in the same colour, as row 1’s chip', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../js/v3/settings.js', import.meta.url), 'utf8');
  const chipFill = /background: \$\{dashed \? 'transparent' : '(hsla\([^']+\))'\}/.exec(src);
  assert.ok(chipFill, 'row 1’s chip fill is where it was');
  const kat = /\{ name: 'Kat', colorIndex: (\d+), level: 4 \}/.exec(src);
  assert.ok(kat, 'row 4 draws Kat’s must');
  const norm = (c) => c.replace(/\s+/g, '').replace(/,\.5\)$/, ',0.5)');
  assert.equal(norm(hslOf(Number(kat[1]), 0.5)), norm(chipFill[1]), 'Kat’s must mark is filled with row 1’s Kat');
});
