// The festival clock — where "now" sits on a timetable, and whether a grid
// day is today. Pure; the DOM work (drawing the line, scrolling to it) lives
// in wall.js and app.js and takes a Date so tests can pin the clock.
//
// Two facts shape this:
//   - A festival day runs past midnight. js/time.js already reads any AM time
//     as "after midnight" (a 1 AM set sorts after 11 PM), so a phone opened
//     at 12:40 AM on Sunday is still living Saturday's grid. The clock's
//     rollover is 5 AM — the same instinct as time.js's activityMinutes.
//     Between 5 AM and noon the two disagree on purpose: the clock says
//     "Sunday morning, 9:00" (so the day-of open lands on Sunday's header)
//     while time.js would place a 9:00 AM SET at Saturday 33:00. No grid
//     carries a morning set today; the validator warns if one ever does, and
//     that is the moment to give both one axis.
//   - The festival's own clock is the clock: a file that carries grid dates
//     also carries an IANA `timezone` (the validator insists), and "now" is
//     read in that zone. A phone at the festival agrees with it anyway; a
//     friend checking from Austin sees the line where the crew actually is,
//     not two hours off where their own clock says (Codex round 4,
//     2026-08-27 — the first cut used the device clock). A file with no
//     zone falls back to the device clock, as does an unknown zone.
export const DAY_ROLLOVER_HOUR = 5;

const pad = (n) => String(n).padStart(2, '0');

// The wall-clock parts of `date` in `timeZone`, via Intl — the one way a
// browser exposes another zone's clock without a library. Any failure
// (no Intl, an unknown zone) reads the device clock instead.
export function wallClock(date, timeZone) {
  const device = () => ({ y: date.getFullYear(), mo: date.getMonth() + 1, d: date.getDate(), h: date.getHours(), mi: date.getMinutes() });
  if (!timeZone) return device();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(date);
    const num = (type) => Number((parts.find((p) => p.type === type) || {}).value);
    const out = { y: num('year'), mo: num('month'), d: num('day'), h: num('hour') % 24, mi: num('minute') };
    return Object.values(out).some(Number.isNaN) ? device() : out;
  } catch { return device(); }
}

// {iso, minutes}: the festival calendar day this moment belongs to, and the
// minutes-since-that-day's-midnight on the timetable's own axis (AM hours
// after the rollover land at 24h+, matching timeToMinutes).
export function festivalClock(date = new Date(), timeZone = null) {
  const p = wallClock(date, timeZone);
  let minutes = p.h * 60 + p.mi;
  let { y, mo, d } = p;
  if (p.h < DAY_ROLLOVER_HOUR) {
    minutes += 24 * 60;
    // The previous calendar day in that zone — a UTC round-trip is
    // zone-agnostic date arithmetic on the parts we already have.
    const prev = new Date(Date.UTC(y, mo - 1, d) - 24 * 60 * 60 * 1000);
    y = prev.getUTCFullYear(); mo = prev.getUTCMonth() + 1; d = prev.getUTCDate();
  }
  return { iso: `${y}-${pad(mo)}-${pad(d)}`, minutes };
}

// A grid day's calendar date, from dayMeta: `iso` for a single-weekend fest,
// `isos: {W1, W2}` for a two-weekend one. Null when the file doesn't say —
// no line, no scroll, no guess.
export function dayIsoOf(meta, weekend) {
  if (!meta) return null;
  if (weekend && meta.isos && typeof meta.isos[weekend] === 'string') return meta.isos[weekend];
  return typeof meta.iso === 'string' ? meta.iso : null;
}

// Minutes-on-the-axis if `date` falls on this grid day, else null.
export function nowOnDay(fest, day, weekend, date = new Date()) {
  const iso = dayIsoOf((fest.dayMeta || {})[day], weekend);
  if (!iso) return null;
  const clock = festivalClock(date, fest.timezone || null);
  return clock.iso === iso ? clock.minutes : null;
}

// "5:42 PM" for the label on the rail.
export function clockLabel(minutes) {
  const m = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(m / 60);
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${pad(m % 60)} ${h24 < 12 ? 'AM' : 'PM'}`;
}

// Once per festival-day per tab: the day-of open scrolls to now exactly once,
// so a repaint after a pick never yanks the scroll and a resumed PWA keeps
// its place. Memory is the truth for the life of the page; sessionStorage
// is the copy that survives a reload when the browser allows one.
const scrolled = new Set();
// Reaching for `sessionStorage` at all can throw — Chrome with site data
// blocked raises a SecurityError from the GETTER, which `typeof` does not
// guard (it only guards names that don't resolve). Node has no such global,
// so only a browser could show this; the try is the whole fix.
const defaultStore = () => { try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; } };
export function scrolledBefore(key, store = defaultStore()) {
  if (scrolled.has(key)) return true;
  let stored = null;
  try { stored = store && store.getItem(key); } catch { stored = null; }
  if (stored) scrolled.add(key);
  return !!stored;
}
// Mark AFTER a real scroll happened — claiming first would spend the one
// scroll on an open with nothing to land on (before the festival week) and
// then refuse the real one on the day.
export function rememberScrolled(key, store = defaultStore()) {
  scrolled.add(key);
  try { if (store) store.setItem(key, '1'); } catch { /* memory-only session */ }
}
// The key: one per festival per festival-day, so the morning header landing
// and the afternoon now-line landing are the same claim.
export function dayOfScrollKey(fid, date = new Date(), timeZone = null) {
  return `fn_scrolled_v2_${fid}_${festivalClock(date, timeZone).iso}`;
}
export function claimScrollOnce(key, store = defaultStore()) {
  if (scrolledBefore(key, store)) return false;
  rememberScrolled(key, store);
  return true;
}

// Where the line sits on a grid whose rows are 15 minutes, `pitch` px each
// (row height + gap). Null when now is off the grid — a little before the
// first set is still useful ("doors in 20 minutes"), well after the last set
// is not (the line would float below an empty grid).
export function nowOffsetPx(nowMin, { startRow, rows, pitch }) {
  const top = (nowMin / 15 - startRow) * pitch;
  const gridHeight = rows * pitch;
  if (top < -pitch * 2 || top > gridHeight + pitch * 2) return null;
  return Math.max(0, Math.min(gridHeight, top));
}
