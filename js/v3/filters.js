// Wall filters — pure state + helpers. Two filters, both "tap the thing that
// is already on screen" (design canvas 2026-08-27, options A + D):
//   people  — tap a member chip: the wall shows only what they picked (tap
//             more chips to combine). On the timetable, non-matching cards
//             DIM rather than hide, so the clock keeps its shape; on the
//             lineup lists (afters, Folsom, a lineup-only fest) they hide.
//   solo    — tap a stage name in the sticky strip: that column goes wide and
//             the others fold to slim rails (the phone case, where five
//             columns never fit). Tap the head again to restore.
// Both are per-festival, per-tab, and die with the tab (sessionStorage):
// a filter that survived a reload would read as "where did everyone's picks
// go?" — and the chips make the state visible anyway.

const LS_PEOPLE = (fid) => `fn_filter_people_v1_${fid}`;
const LS_SOLO = (fid) => `fn_solo_stage_v1_${fid}`;

// sessionStorage throws on storage-blocked browsers exactly like localStorage
// does (Safari private mode). A filter is a view, so a blocked store must
// not make it unusable: every value is ALSO kept in this module's memory,
// which is the source of truth for the life of the page, and storage is the
// copy that survives a reload when the browser allows one. (Codex gate,
// 2026-08-27: the first cut swallowed the failed write and then re-read
// storage, so a tap on a chip did nothing at all in private mode.)
const memory = new Map();
function read(key) {
  if (memory.has(key)) return memory.get(key);
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  memory.set(key, value);
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch { /* memory-only session */ }
}

export function loadPeopleFilter(fid) {
  try {
    const v = JSON.parse(read(LS_PEOPLE(fid)) || '[]');
    return Array.isArray(v) ? v.filter((n) => typeof n === 'string') : [];
  } catch { return []; }
}
export function savePeopleFilter(fid, names) {
  write(LS_PEOPLE(fid), names && names.length ? JSON.stringify(names) : null);
}
export function togglePerson(names, name) {
  return names.includes(name) ? names.filter((n) => n !== name) : [...names, name];
}

export function loadSolo(fid) { return read(LS_SOLO(fid)) || null; }
export function saveSolo(fid, stage) { write(LS_SOLO(fid), stage || null); }

// A card passes the people filter when ANY selected person has a live pick
// on it (level > 0 — a tombstoned 0 is "unpicked", not "picked at 0").
// No selected people = no filter = everything passes.
export function passesPeople(picks, artist, people) {
  if (!people || !people.length) return true;
  const by = (picks || {})[artist] || {};
  return people.some((p) => (by[p] || 0) > 0);
}

// Only members who are still in the crew count; a filter remembered for
// someone who has since been removed would silently blank the wall.
export function pruneToActive(names, activeNames) {
  const live = new Set(activeNames);
  return (names || []).filter((n) => live.has(n));
}

// What a folded stage's rail says. A rail is 34px wide and one strip row
// tall with a scroller that clips both axes, so the label is bounded to
// four characters of the first word — "Pier", "Cran", "Ware". When two
// stages share those four ("Bud Light" / "Bud Light Backyard"), initials
// tell them apart instead ("BL" / "BLB"); if even those clash ("Bud Light"
// / "Bud Lite"), a digit does ("BL" / "BL2") — two rails never read the
// same. The full name stays in the head's title and aria-label, and shows
// whole the moment the rail is tapped.
export function railLabels(stages) {
  const words = (s) => String(s).trim().split(/\s+/).filter(Boolean);
  const first = (s) => (words(s)[0] || '').slice(0, 4);
  const initials = (s) => words(s).map((w) => Array.from(w)[0]).join('').slice(0, 4).toUpperCase();
  const counts = {};
  for (const s of stages) counts[first(s)] = (counts[first(s)] || 0) + 1;
  const out = {};
  const used = {};
  for (const s of stages) {
    let label = counts[first(s)] > 1 ? initials(s) : first(s);
    if (used[label]) label = `${label.slice(0, 3)}${used[label] + 1}`;
    used[label] = (used[label] || 0) + 1;
    out[s] = label;
  }
  return out;
}

// The rail width for a folded stage column. Wide enough for a vertical
// stage name at 9px and a tap; narrow enough that four rails plus the wide
// column fit a 390px phone with the hour rail.
export const SOLO_RAIL = '34px';

// The timetable's column template, with a soloed stage wide and every other
// column (stages AND the everything-else column) folded to a rail. No solo =
// the everyday template. Unknown solo (a stage that no longer exists) = no
// solo, so a remembered stage name from a renamed grid can't blank the wall.
export function columnsTemplate(stages, hasEE, solo) {
  const active = solo && stages.includes(solo) ? solo : null;
  const cols = stages.map((s) => (active && s !== active ? SOLO_RAIL : 'minmax(150px, 1fr)'));
  if (hasEE) cols.push(active ? SOLO_RAIL : 'minmax(150px, 1fr)');
  return { template: cols.join(' '), solo: active };
}

// ---- the chip gesture -------------------------------------------------------------
// A member chip has two jobs, told apart by the app's own tap/hold grammar
// (cards: tap picks, hold opens notes):
//   TAP  = the people filter — a view, cheap to try and cheap to undo.
//   HOLD = the identity switch, behind its two-step confirm: the hold ARMS
//          the chip ("Pick as Drew?"), a tap within ARM_MS switches.
// The arm lives HERE, keyed by name, not in the chip's DOM closure — a remote
// change repaints every chip, and an arm held in a closure died with the old
// node (a repaint mid-confirm turned the confirming tap into a filter toggle;
// Codex gate, 2026-08-27). One arm at a time: arming Drew disarms Ross.
export const HOLD_MS = 500;
export const ARM_MS = 3000;
let armed = null; // { name, until }
// ONE pending hold for the whole chip row, held here rather than in a chip's
// closure: a remote change repaints every chip mid-hold, and a timer left
// alive in the old node's closure would arm a chip nobody can see (Codex
// gate round 2, 2026-08-27). The row cancels it on every rebuild.
let hold = null; // { name, token, timer, clearTimer }
let holdSeq = 0;  // every press gets its own token, so a release clears only ITS hold
// The finger that is down RIGHT NOW — kept even after its hold fires. A hold
// that has already armed clears `hold`, so a repaint between arm and release
// used to sail past cancelHold, and the release landed as a CLICK on the
// fresh armed chip — an identity switch nobody asked for (Codex gate,
// 2026-08-29). Any rebuild while a press is live suppresses that release.
let pressed = null; // { token }
// After a cancelled hold, the release still lands as a click on whichever
// chip is under the finger now — swallow it for a beat rather than let a
// half-hold become a filter toggle.
let suppressClicksUntil = 0;

export function armedName(now = Date.now()) {
  if (armed && armed.until > now) return armed.name;
  armed = null;
  return null;
}
export function disarm() { armed = null; }
// The chip door (desktop hover) arms the same two-step confirm the hold does:
// arming is never the switch — the next tap is.
export function armFor(name, now = Date.now()) { armed = { name, until: now + ARM_MS }; }
export function cancelHold(now = Date.now()) {
  if (hold) {
    hold.clearTimer(hold.timer);
    hold = null;
    suppressClicksUntil = now + 800;
  }
  if (pressed) {
    // A press outlives its hold: the rebuild happened under a finger that is
    // still down, so its release must not be read as a tap on whatever chip
    // stands there now. The arm (if any) survives — the person confirms with
    // a fresh, deliberate tap.
    pressed = null;
    suppressClicksUntil = now + 800;
  }
}

// Wire one chip. `canSwitch` is false for your own chip and for spectators.
// Handlers: onFilter(name) · onArmed(name) (show the armed look on the SAME
// node — the finger is still down; a rebuild would hand its release to a
// new chip as a click) · onSwitch(name). Returns the listeners so a test
// can drive them without a DOM.
// The timer defaults are ARROWS, not the bare globals: the clear function is
// stored on the `hold` record and called as `hold.clearTimer(...)`, and a
// browser's clearTimeout invoked with any receiver but the window throws
// "Illegal invocation". Node never cared, so the tests passed while every
// real tap on another member's chip threw and did nothing (UI walk,
// 2026-08-27 — the one finding that only a real browser could see).
export function chipGesture(name, { canSwitch, onFilter, onArmed, onSwitch, now = Date.now, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id) }) {
  let held = false;
  let mine = null; // the token of this gesture's live press
  const g = {
    pointerdown() {
      // A new press is deliberate: it ends any suppression left by a
      // cancelled hold (even when no hold is pending any more) and never
      // inherits another chip's pending hold.
      suppressClicksUntil = 0;
      if (!canSwitch) return;
      held = false;
      if (hold) { hold.clearTimer(hold.timer); hold = null; }
      const token = ++holdSeq;
      mine = token;
      pressed = { token };
      const timer = setTimer(() => {
        if (!hold || hold.token !== token) return; // superseded before it fired
        hold = null;
        held = true;
        armed = { name, until: now() + ARM_MS };
        onArmed(name);
      }, HOLD_MS);
      hold = { name, token, timer, clearTimer };
    },
    // A release clears only the hold ITS press started — an older pointer on
    // the same chip must not kill a newer press's timer.
    pointerend() {
      if (hold && hold.token === mine) { hold.clearTimer(hold.timer); hold = null; }
      if (pressed && pressed.token === mine) pressed = null;
    },
    click() {
      if (held) { held = false; return; }          // the click that ends a hold is not a tap
      if (now() < suppressClicksUntil) return;     // the release of a hold that a repaint cancelled
      if (canSwitch && armedName(now()) === name) { armed = null; onSwitch(name); return; }
      onFilter(name);
    },
  };
  return g;
}
