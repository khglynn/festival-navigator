// The zoom suite's rig, in ONE place (2026-09-01). Six test files drive the
// same modules — the wall, a crew doc with two people, a ctx whose onTap is
// app.js's handleTap minus sync — and a copy per file would drift the day
// somebody fixed a stub in one of them.
//
// Why a function and not top-level statements: card-facts.js registers its
// lifetime pointermove listener on `document` at MODULE EVALUATION, so the
// globals have to exist before the import. `makeRig()` sets them, then
// dynamic-imports, and hands back everything a test needs.
//
// Each `node --test` file is its own process, so a rig built here is private
// to the file that built it — module state (`zoomed`, `lastMouse`,
// `dismissedEl`) never crosses files. INSIDE a file it is sticky: `lastMouse`
// is never reset once a mouse pointermove has been seen, and a stubbed
// `document.elementFromPoint` outlives the test that installed it unless a
// try/finally puts it back. Both are load-bearing — see `feedMouse` below.
import { JSDOM } from 'jsdom';

export async function makeRig({ fid = 'zoom-fest' } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="wall-root"></div></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.CSS = dom.window.CSS;
  // Synchronous by default, like the original rig: a test that needs real
  // frame timing swaps it for `setTimeout` itself and restores it after.
  globalThis.requestAnimationFrame = (fn) => { fn(); return 1; };
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

  const state = await import('../../js/state.js');
  const model = await import('../../js/v3/model.js');
  const errlog = await import('../../js/errlog.js');
  const { FESTIVALS, FESTIVAL_INDEX } = await import('../../js/festivals.js');
  const { renderCard, refreshCard } = await import('../../js/v3/wall.js');
  const zoom = await import('../../js/v3/card-facts.js');

  FESTIVAL_INDEX.push({ id: fid, status: 'lineup' });
  FESTIVALS[fid] = { id: fid, name: 'Zoom', artists: [{ name: 'GRiZ', day: 'Saturday' }, { name: 'Rezz', day: 'Saturday' }] };
  const TOKEN = 'zoomtesttoken_0123456789';
  state.activateCrew(TOKEN, {
    v: 4, meta: {}, spotify: {},
    people: { Kevin: { colorIndex: 0 }, Drew: { colorIndex: 1 } },
    festivals: { [fid]: { selections: { GRiZ: { Kevin: 1, Drew: 4 } } } },
    affinity: {},
  }, fid);

  // What app.js's handleTap does, minus sync: advance my level, mirror it into
  // the doc, refresh the card, and keep the zoom on the fresh node.
  function makeCtx() {
    const ctx = {
      fid, meName: 'Kevin', affinity: null, lowPower: false,
      picks: model.picksFor(state.crewDoc, fid),
      taps: [], opened: [],
      onOpenNotes: (a) => ctx.opened.push(a),
    };
    ctx.onTap = (artist, el) => {
      ctx.taps.push(artist);
      const cur = (ctx.picks[artist] || {})[ctx.meName] || 0;
      const next = model.nextTapLevel(cur);
      const sels = state.crewDoc.festivals[fid].selections;
      (sels[artist] = sels[artist] || {})[ctx.meName] = next;
      ctx.picks = model.picksFor(state.crewDoc, fid);
      // Mirrors app.js refreshArtistCards: the zoom takes the fresh node
      // BEFORE the old one is removed (its removal blur must find a zoom that
      // has already moved on — see refreshCard).
      return refreshCard(el, artist, ctx, {
        onSwap: zoom.zoomedCard() === el ? (fresh) => zoom.refreshZoom(fresh, ctx) : null,
      });
    };
    return ctx;
  }

  function mountCard(ctx, name = 'GRiZ', opts = { occ: { day: 'Saturday', stage: null, time: null } }) {
    const wall = document.getElementById('wall-root');
    wall.replaceChildren();
    const card = renderCard(name, ctx, opts);
    wall.appendChild(card);
    return card;
  }

  const click = (node) => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

  // jsdom 29 ships a real PointerEvent constructor (verified 2026-09-01), so
  // these are the genuine article rather than a MouseEvent wearing a
  // hand-defined `pointerType` — which matters, because every hover guard in
  // card-facts.js reads `e.pointerType` and a wrong fake would test nothing.
  function pointerEvent(type, { pointerType = 'mouse', relatedTarget = null, bubbles = false, clientX = 0, clientY = 0 } = {}) {
    return new dom.window.PointerEvent(type, { pointerType, relatedTarget, bubbles, cancelable: true, clientX, clientY });
  }

  // Teach the module where the mouse is. Once fed, `lastMouse` stays set for
  // the rest of the FILE — the module never clears it — so anything that then
  // stubs `document.elementFromPoint` must restore it in a finally, or a later
  // test starts closing its own zoom. (That coupling is the isolation quirk
  // the 2026-09-01 review flagged in tests/zoom-overlay.test.mjs.)
  function feedMouse(x = 40, y = 40, target = document) {
    const move = pointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y });
    target.dispatchEvent(move);
    return move;
  }

  const keydown = (node, key, { shiftKey = false } = {}) =>
    node.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  return {
    dom, window: dom.window, document: dom.window.document,
    state, model, errlog, FESTIVALS, FESTIVAL_INDEX, renderCard, refreshCard, zoom,
    FID: fid, makeCtx, mountCard, click, feedMouse, pointerEvent, keydown, wait,
  };
}

// A recorder for Element.animate: jsdom has none, so every animated path in
// card-facts.js is dead until one is installed. Returns the call log and an
// `off()` that removes the stub — ALWAYS call it in a finally, or the next
// test in the file silently takes the animated path too.
export function recordAnimations(window) {
  const calls = [];
  const proto = window.Element.prototype;
  proto.animate = function animate(keyframes, options) {
    const anim = {
      target: this, keyframes, options,
      cancelled: false,
      cancel() { this.cancelled = true; if (this.oncancel) this.oncancel(); },
      play() {}, pause() {}, finish() { if (this.onfinish) this.onfinish(); },
      onfinish: null, oncancel: null,
    };
    calls.push(anim);
    return anim;
  };
  return { calls, off: () => { delete proto.animate; } };
}

// Give a node a fixed box. jsdom's layout is all zeros, which is why every
// geometry branch in card-facts.js is inert in Node until a rect is faked.
export function stubRect(node, { left = 0, top = 0, width = 0, height = 0 }) {
  node.getBoundingClientRect = () => ({
    left, top, width, height, right: left + width, bottom: top + height, x: left, y: top,
  });
}
