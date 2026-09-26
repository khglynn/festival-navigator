// A phone keyboard for jsdom (and a browser page's init script): the page's
// visualViewport swapped for one a test can shrink, so a sheet's OWN listener
// (notes.js rideKeys, the one ride every sheet uses) moves it. The pattern the
// v92 walk rig used for the join shelf (claude-plans/2026-09-25-portola-live/
// v92-walk.mjs), made a test helper. `listening()` counts live listeners, so a
// test can prove a closed sheet stopped riding.
export function fakeKeys(win) {
  const et = new win.EventTarget();
  let kb = 0;
  let live = 0;
  const vv = {
    offsetTop: 0, offsetLeft: 0, pageTop: 0, scale: 1,
    get width() { return win.innerWidth; },
    get height() { return win.innerHeight - kb; },
    addEventListener: (t, f) => { live += 1; et.addEventListener(t, f); },
    removeEventListener: (t, f) => { live -= 1; et.removeEventListener(t, f); },
  };
  Object.defineProperty(win, 'visualViewport', { configurable: true, get: () => vv });
  return {
    keys(n) { kb = n; et.dispatchEvent(new win.Event('resize')); },
    listening: () => live,
  };
}
