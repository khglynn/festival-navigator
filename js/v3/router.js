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

    // Record a layer the UI just opened. Sheets never sit under anything —
    // opening while a sheet is on top swaps it instead of stacking (the UI
    // open path already closed the old sheet).
    push(key) {
      if (navigating) return;
      const top = stack[stack.length - 1];
      if (top === key) return;
      if (top && top.startsWith('sheet:')) {
        stack[stack.length - 1] = key;
        hist.replaceState({ layers: [...stack] }, '');
      } else {
        stack.push(key);
        hist.pushState({ layers: [...stack] }, '');
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
