// Which INPUT grew the card decides how it closes: a keyboard zoom stands
// until focus leaves, a mouse zoom leaves on hover-out. So the keyboard route
// must open ONLY on keyboard focus — and the browser's own idea of that
// (`:focus-visible`) is not one rule but two. Measured in Chrome 152 with real
// input (2026-09-02): a click focuses a card WITHOUT :focus-visible, but any
// later keypress — Escape to dismiss a zoom counts — flips the still-focused
// card to :focus-visible, and a script `focus()` afterwards INHERITS it. Every
// pick hands focus to the fresh card with exactly such a `focus()` (refreshCard),
// so click-Escape-click on one card opened a keyboard zoom that no hover-out
// could close ("it won't close until I click out"). WebKit reads script focus
// more liberally still, and jsdom cannot evaluate the selector at all.
//
// The module keeps its own answer instead: the last input the DOCUMENT saw —
// a keydown (not a lone modifier) or a pointerdown. One rule, every engine, and
// the suite can drive it with plain events.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig } from './helpers/zoom-rig.mjs';

const rig = await makeRig();
const { document, window, zoom, makeCtx, mountCard, pointerEvent, keydown, wait } = rig;
const OCC = { day: 'Saturday', stage: null, time: null };
const slot = () => document.querySelector('#zoom-layer .zoom-slot');
const wire = (card, ctx) => zoom.wireCardFocusZoom(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
const press = (target = document.body, pointerType = 'mouse') => target.dispatchEvent(pointerEvent('pointerdown', { pointerType, bubbles: true }));

test.afterEach(() => { zoom.unzoom({ instant: true }); press(); });

test('focus that follows a keypress grows the card, and that zoom ignores hover-out', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  keydown(document.body, 'Tab');
  card.focus();
  assert.ok(slot(), 'Tab, then focus: the keyboard route grew it');
  document.querySelector('#zoom-layer .zoom-card').dispatchEvent(pointerEvent('pointerleave', { relatedTarget: document.body }));
  await wait(zoom.ZOOM_OUT_MS + 80);
  assert.ok(slot(), 'a keyboard zoom does not close on hover-out — focus is its signal');
});

test('focus that follows a pointer press never grows the card, however it was handed over', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  press(card);
  card.focus(); // what a click does
  assert.equal(slot(), null, 'a click-focus is not keyboard intent');
  card.blur();
  card.focus(); // what a script does after a click (refreshCard)
  assert.equal(slot(), null, 'nor is a script focus that follows a click');
});

test("Kevin's sequence: click the card, Escape, click it again — the pick must not become a keyboard zoom", () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  press(card);
  card.focus();                 // the first click focused it
  keydown(card, 'Escape');      // a zoom put away — in Chrome this alone flips :focus-visible on
  press(card);                  // the second click…
  const fresh = ctx.onTap('GRiZ', card); // …picks: refreshCard swaps the node and hands focus to the fresh one
  assert.equal(document.activeElement, fresh, 'focus followed the pick to the fresh node');
  assert.equal(slot(), null, 'and no zoom was born from that hand-off — the last input was a press');
});

test('a lone modifier is not keyboard intent (Cmd-Tab back into the window)', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  press();
  keydown(document.body, 'Meta');
  card.focus();
  assert.equal(slot(), null, 'a modifier on its own says nothing about how the person is navigating');
  keydown(document.body, 'Shift');
  card.blur(); card.focus();
  assert.equal(slot(), null);
});

test('a touch press counts as a pointer, so a tap-focus after keyboard use does not grow', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  keydown(document.body, 'Tab');
  press(card, 'touch');
  card.focus();
  assert.equal(slot(), null, 'the finger came after the key — the finger is the last word');
});

test('the Tab hand-off inside a standing zoom keeps working: the next card grows when Tab moves on', () => {
  // wireSlot moves focus by script after a Tab keydown; the tracker must read
  // that keydown as keyboard intent, or the hand-off would land on a card that
  // never grew (the walk rig's expectation: "focus lands on the NEXT card,
  // which grows").
  const ctx = makeCtx();
  const wall = document.getElementById('wall-root');
  wall.replaceChildren();
  const a = rig.renderCard('GRiZ', ctx, { occ: OCC });
  const b = rig.renderCard('Rezz', ctx, { occ: OCC });
  wall.append(a, b);
  zoom.wireCardFocusZoom(a, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
  zoom.wireCardFocusZoom(b, 'Rezz', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
  keydown(document.body, 'Tab');
  a.focus();
  assert.equal(zoom.zoomedCard(), a);
  keydown(a, 'Tab'); // into the chip
  const chip = document.querySelector('#zoom-layer button.f-chip.notes');
  assert.equal(document.activeElement, chip);
  // jsdom has no layout, so nextFocusableAfter (offsetParent-gated) finds nothing;
  // the hand-off closes the zoom and the focus move is the app's. Simulate it.
  keydown(chip, 'Tab');
  assert.equal(zoom.zoomedCard(), null, 'Tab from the chip moved on');
  b.focus();
  assert.equal(zoom.zoomedCard(), b, 'the card focus landed on grew — the Tab was the last input');
});

test('the tracker sees presses and keys in capture, before anything can stop them', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  // A handler that stops propagation on the card must not blind the tracker.
  card.addEventListener('keydown', (e) => e.stopPropagation());
  card.addEventListener('pointerdown', (e) => e.stopPropagation());
  keydown(card, 'ArrowDown');
  card.focus();
  assert.ok(slot(), 'the key was seen at the document in capture');
  zoom.unzoom({ instant: true });
  card.blur();
  press(card);
  card.focus();
  assert.equal(slot(), null, 'and so was the press');
});

test('the modality tracker is not fooled by a synthetic keydown with no key', () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  press();
  document.body.dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true }));
  card.focus();
  assert.equal(slot(), null, 'an empty key is not a person typing');
});

test('Escape on a KEYBOARD zoom leaves no stay-away mark: the next hover grows the card at once', async () => {
  const ctx = makeCtx();
  const card = mountCard(ctx);
  wire(card, ctx);
  zoom.wireCardZoom(card, 'GRiZ', ctx, { onOpenNotes: ctx.onOpenNotes, occ: OCC });
  keydown(document.body, 'Tab');
  card.focus();
  assert.ok(slot(), 'the keyboard route grew it');
  zoom.dismissZoom(); // Escape
  assert.equal(slot(), null);
  card.dispatchEvent(pointerEvent('pointerenter'));
  await wait(zoom.ZOOM_IN_MS + 120);
  assert.ok(slot(), 'no pointer was on the card when it was put away, so nothing waits for a leave');
});
