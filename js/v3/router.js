// Minimal history-backed layer router (FLOW-2). The app's overlays — settings,
// settings drills, note sheets — form a stack; browser back closes the top
// layer, forward re-opens it, and the #g= crew link never leaves the URL
// (spec F10). The rules that keep history and UI from drifting:
//   - UI open paths call push(key) AFTER opening.
//   - UI close affordances call requestClose(), which drives history.back();
//     the actual closing always happens in the popstate reconcile.
//   - Openers/closers registered per key prefix must be idempotent.
// Pure stack math is exported for node tests; createRouter takes any
// history-like object so tests can drive it without a browser.

// Deepest-shared-prefix diff: which layers close (top first) and open
// (bottom first) to get from one stack to another.
// The artist-notes sheet key carries the OCCURRENCE (which set an artist
// who plays twice you opened). The payload is tagged with \u0001 — a control
// character no artist name can hold (the festival validator rejects them) —
// so a name that happens to look like JSON can never be mistaken for one.
// Untagged keys are legacy plain names and still restore (2026-08-29).
const NOTES_KEY = 'sheet:notes:';
const TAG = '\u0001';
export function encodeNotesKey(artist, occ = null) {
  return `${NOTES_KEY}${TAG}${JSON.stringify({ v: 1, artist, occ: occ || null })}`;
}
export function decodeNotesKey(key) {
  if (!key.startsWith(NOTES_KEY)) return null;
  const rest = key.slice(NOTES_KEY.length);
  if (!rest.startsWith(TAG)) return { artist: rest, occ: null };
  try {
    const p = JSON.parse(rest.slice(TAG.length));
    if (p && p.v === 1 && typeof p.artist === 'string') return { artist: p.artist, occ: p.occ || null };
  } catch { /* fall through */ }
  return null;
}

export function diffStacks(from, to) {
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i++;
  return { toClose: from.slice(i).reverse(), toOpen: to.slice(i) };
}

export function createRouter(hist) {
  const kinds = []; // { prefix, open(key), close(key) }
  let stack = [];
  let navigating = false;

  const kindOf = (key) => kinds.find((k) => key.startsWith(k.prefix));

  function reconcile(target) {
    navigating = true;
    try {
      const { toClose, toOpen } = diffStacks(stack, target);
      // Openers/closers are guarded individually: a stale layer key from an
      // old history entry (e.g. forward-nav into an abandoned crew's layers)
      // must never take the whole app down — worst case that one layer
      // silently doesn't open and the safety nets (hashchange -> boot) land.
      for (const key of toClose) {
        stack.pop();
        try { kindOf(key)?.close(key); } catch (e) { console.warn('layer close failed:', key, e); }
      }
      for (const key of toOpen) {
        stack.push(key);
        try { kindOf(key)?.open(key); } catch (e) { console.warn('layer open failed:', key, e); }
      }
    } finally { navigating = false; }
  }

  return {
    registerKind(prefix, open, close) { kinds.push({ prefix, open, close }); },

    // Record a layer the UI just opened. Sheets and menus never sit under
    // anything — opening while one is on top swaps it instead of stacking.
    // The UI open path already closed an old sheet; a menu (the show menu,
    // v93: a popover with a history entry of its own, so Back closes it) is
    // closed here, by whatever replaced it — Settings from its last row, a
    // sheet from a card's zoom — so its entry becomes that layer's, and Back
    // from there lands on the wall, never on a menu that is no longer open.
    //   `extra` rides on the new entry beside its layers — the show menu's id
    // (v93), so a later arrival there can tell that menu from one that has
    // since gone. An entry a layer takes over is that layer's, and carries
    // only what that layer gave it.
    push(key, extra = null) {
      if (navigating) return;
      const top = stack[stack.length - 1];
      if (top === key) return;
      if (top && (top.startsWith('sheet:') || top.startsWith('menu:'))) {
        stack[stack.length - 1] = key;
        hist.replaceState({ ...(extra || {}), layers: [...stack] }, '');
        if (top.startsWith('menu:')) {
          try { kindOf(top)?.close(top); } catch (e) { console.warn('layer close failed:', top, e); }
        }
      } else {
        stack.push(key);
        hist.pushState({ ...(extra || {}), layers: [...stack] }, '');
      }
    },

    // Returns false when there is nothing to close (caller falls back to a
    // direct close so a desynced stack can never trap the user).
    requestClose() {
      if (navigating || !stack.length) return false;
      hist.back();
      return true;
    },

    onPopState(state) { reconcile((state && state.layers) || []); },

    // A fresh boot resets the model; the caller resets the DOM.
    reset() { stack = []; },

    // A layer that went away with its screen and could not take its entry
    // back first (the show menu, v93, when the URL has already moved or the
    // screen changed in place): out of the model, and out of the layers of
    // the entry the page stands on when that entry names it — never by a
    // traversal, which could move the app off the screen it is going to. The
    // entry's other fields stay (the menu's id): that is how an arrival there
    // later knows the menu it named is gone (app.js arrivedAt). Returns
    // whether the model held it.
    forget(key) {
      const i = stack.lastIndexOf(key);
      if (i === -1) return false;
      stack.splice(i, 1);
      try {
        const cur = hist.state;
        if (cur && Array.isArray(cur.layers) && cur.layers.includes(key)) {
          const rest = { ...cur, layers: cur.layers.filter((k) => k !== key) };
          hist.replaceState(rest.layers.length || Object.keys(rest).length > 1 ? rest : null, '');
        }
      } catch { /* an entry this history cannot read: the model is right */ }
      return true;
    },

    // Re-open layers captured before a refresh (spec F10: refresh restores
    // the same surface or its nearest parent).
    restore(layers) { if (Array.isArray(layers) && layers.length) reconcile(layers); },

    depth() { return stack.length; },
    top() { return stack[stack.length - 1] || null; },
    current() { return [...stack]; },
  };
}

// The app's singleton, bound to real browser history. Guarded so node tests
// can import the module's pure parts.
export const router = typeof window !== 'undefined' ? createRouter(window.history) : null;
