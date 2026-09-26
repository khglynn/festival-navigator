// History with a direction (v93 — Sol 6's re-review of c8230b1).
//
// Every entry this app writes carries { idx, id, kind } beside whatever else
// it holds (a router's layers, the join shelf's flag):
//   idx  — a number that only grows in this tab, so of two entries the later
//          one always has the larger idx. A push after going Back throws the
//          forward entries away, so the order along the list stays true.
//   id   — this entry's own name (the Show menu is only alive on the entry it
//          opened on).
//   kind — what the entry is: wall · list · create · menu · sheet · settings
//          · shelf. For reading history, and for a person reading a report.
// So a Back or Forward that arrives knows for certain which way it went: the
// arrived idx against the one the page stood on. The app uses that to never
// spend a press on an entry that changes nothing (app.js onPopState): such an
// arrival is passed in the direction the person was already going, and only
// while arrivals change nothing — the first one that shows something stops it.
//
// A traversal the app asks for itself (taking a menu's or the shelf's entry
// back) is `own`: its arrival is applied as it is, never passed.
//
// Entries this app did not write (an older build's, a link opened into the
// tab before its boot stamped it) have no idx: arriving on one, or leaving
// one, has no direction, and is applied as it always was.

const STORE = 'fn_nav_idx_v1';

export function kindOf(state, url = '') {
  if (state && state.joinShelf) return 'shelf';
  const layers = (state && Array.isArray(state.layers)) ? state.layers : [];
  const top = String(layers[layers.length - 1] || '');
  if (top.startsWith('menu:')) return 'menu';
  if (top.startsWith('sheet:')) return 'sheet';
  if (top === 'settings' || top.startsWith('sub:')) return 'settings';
  const hash = String(url).split('#')[1] || '';
  if (hash.startsWith('g=')) return 'wall';
  if (hash === 'new') return 'create';
  return 'list';
}

const stamped = (state) => !!state && Number.isFinite(state.idx);

// `history`, `location` and `storage()` are injected so node tests can drive
// it with a fake session history; storage() may throw (site data blocked).
export function createNav({ history: hist, location: loc, storage = () => null }) {
  const here = () => `${loc.pathname}${loc.search}${loc.hash}`;
  let issued = 0; // the last idx handed out in this tab (sessionStorage keeps it across a refresh)
  let at = stamped(hist.state) ? hist.state.idx : null; // the entry the page stands on
  let shown = here(); // the address the screen shows — what an arrival is measured against
  let own = 0; // traversals the app asked for that have not arrived yet
  let ownTimer = null;
  let afterOwn = []; // what runs once the app's own traversal has arrived
  let fresh = false; // the app is about to make an entry by setting location.hash
  let length = hist.length;

  const stored = () => { try { const s = storage(); return s ? Number(s.getItem(STORE)) || 0 : 0; } catch { return 0; } };
  const store = (n) => { try { const s = storage(); if (s) s.setItem(STORE, String(n)); } catch { /* blocked: this page load still counts up */ } };
  const next = () => {
    issued = Math.max(issued, stored(), at == null ? 0 : at) + 1;
    store(issued);
    return issued;
  };
  const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  function write(method, state, url) {
    const u = url === undefined ? here() : url;
    const base = state && typeof state === 'object' ? state : {};
    let idx;
    let id;
    if (method === 'replaceState' && stamped(hist.state)) ({ idx, id } = hist.state);
    else { idx = next(); id = newId(); }
    const s = { ...base, idx, id, kind: kindOf(base, u) };
    if (url === undefined) hist[method](s, '');
    else hist[method](s, '', url);
    at = idx;
    shown = here();
    length = hist.length;
    return s;
  }

  function settleOwn() {
    clearTimeout(ownTimer);
    ownTimer = null;
    const run = afterOwn;
    afterOwn = [];
    for (const fn of run) { try { fn(); } catch (e) { console.warn('after a step back:', e); } }
  }

  return {
    // A new entry after this one (the forward ones go, as with any push).
    push(state, url) { return write('pushState', state, url); },
    // This entry, rewritten: it keeps its idx and id.
    replace(state, url) { return write('replaceState', state, url); },
    // Back by `n`, asked for by the app: its arrival is applied as it is.
    // `then` runs once it has arrived — or after a second, if it never does
    // (a first entry has nothing behind it).
    back(n = 1, then = null) {
      own += 1;
      if (then) afterOwn.push(then);
      clearTimeout(ownTimer);
      ownTimer = setTimeout(() => { own = 0; settleOwn(); }, 1000);
      hist.go(-n);
    },
    // Passing an arrival that changed nothing: one more the same way.
    step(dir) { hist.go(dir); },
    // A popstate: which way it went (-1, +1, or 0 when either end is not
    // ours), and whether the app asked for it.
    arrive(state) {
      const idx = stamped(state) ? state.idx : null;
      const dir = idx != null && at != null ? Math.sign(idx - at) : 0;
      at = idx;
      if (idx != null && idx > issued) issued = idx;
      const mine = own > 0;
      if (mine) own -= 1;
      return { dir, own: mine };
    },
    // The arrival was applied: the screen shows this address now. Anything
    // waiting on the app's own step runs after it.
    applied(wasOwn = false) {
      shown = here();
      if (wasOwn && own === 0) settleOwn();
    },
    // The address changed (hashchange). An entry made by a new navigation —
    // one the app announced (expectFresh), or one that grew the history —
    // is stamped as the newest; one arrived at by Back or Forward keeps
    // what it has.
    seen() {
      const grew = hist.length > length;
      if (!stamped(hist.state) && (fresh || grew)) write('replaceState', hist.state, undefined);
      fresh = false;
      length = hist.length;
      shown = here();
    },
    expectFresh() { fresh = true; },
    // The entry the page opened on, numbered if it is not yet.
    stampHere() { if (!stamped(hist.state)) write('replaceState', hist.state, undefined); },
    here,
    shownUrl: () => shown,
    at: () => at,
  };
}

// The app's singleton, on the real history. Guarded so node tests can import
// the pure parts.
export const nav = typeof window !== 'undefined'
  ? createNav({ history: window.history, location: window.location, storage: () => window.sessionStorage })
  : null;

// The router writes through this, so its entries are stamped too.
export const navHistory = nav && {
  get state() { return window.history.state; },
  pushState: (s) => nav.push(s),
  replaceState: (s) => nav.replace(s),
  back: () => nav.back(),
};
