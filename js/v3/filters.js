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

export function armedName(now = Date.now()) {
  if (armed && armed.until > now) return armed.name;
  armed = null;
  return null;
}
export function disarm() { armed = null; }

// Wire one chip. `canSwitch` is false for your own chip and for spectators.
// Handlers: onFilter(name) · onArmed(name) (repaint the label) · onSwitch(name).
// Returns the listeners so a test can drive them without a DOM.
export function chipGesture(name, { canSwitch, onFilter, onArmed, onSwitch, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let holdTimer = null;
  let held = false;
  const g = {
    pointerdown() {
      if (!canSwitch) return;
      held = false;
      clearTimer(holdTimer);
      holdTimer = setTimer(() => {
        held = true;
        armed = { name, until: now() + ARM_MS };
        onArmed(name);
      }, HOLD_MS);
    },
    pointerend() { clearTimer(holdTimer); },
    click() {
      if (held) { held = false; return; }          // the click that ends a hold is not a tap
      if (canSwitch && armedName(now()) === name) { armed = null; onSwitch(name); return; }
      onFilter(name);
    },
  };
  return g;
}
