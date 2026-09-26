// A click as an engine really sends it after a press (the tap change,
// 2026-09-26). Since Chrome 92 and Safari 18.2 a click is a PointerEvent that
// carries a pointerType, and card-facts.js clickHand reads it:
//   Chromium types the click as the pointer that made it ('touch', 'pen',
//   'mouse', with that pointer's id);
//   WebKit — every iPhone — types the click after a finger's tap as 'mouse',
//   on the mouse's pointer id (Playwright's WebKit, measured 2026-09-26; a
//   real iPad in WebKit bug 324397), so there the press decides.
// `el.click()` is neither: jsdom, like every browser, sends it with
// pointerType '' — no pointer at all, an assistive activation. A test that
// means a finger or a mouse presses, lifts and clicks through this.
export const POINTER_IDS = { mouse: 1, touch: 2, pen: 3 };

// Press and lift `pointerType` on `el` (lifted on `upOn`, default the same
// element), then click `clickOn` (default: what holds both) as `engine` types
// that click. Returns the click event.
export function pointerClick(window, el, pointerType = 'mouse', { engine = 'webkit', upOn = el, clickOn = null, pointerId = POINTER_IDS[pointerType] } = {}) {
  el.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType, pointerId }));
  upOn.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType, pointerId }));
  let target = clickOn;
  if (!target) { target = upOn; while (target && !target.contains(el)) target = target.parentElement; }
  return typedClick(window, target || el, engine === 'chromium' ? pointerType : 'mouse', engine === 'chromium' ? pointerId : POINTER_IDS.mouse);
}

// Just the click, typed: `pointerType` '' is a pointerless activation (a key's
// click, VoiceOver's double-tap); undefined is an engine older than
// click-as-PointerEvent (a MouseEvent, no pointerType at all).
export function typedClick(window, el, pointerType, pointerId = pointerType ? POINTER_IDS[pointerType] : -1) {
  const e = pointerType === undefined
    ? new window.MouseEvent('click', { bubbles: true, cancelable: true })
    : new window.PointerEvent('click', { bubbles: true, cancelable: true, pointerType, pointerId });
  el.dispatchEvent(e);
  return e;
}
