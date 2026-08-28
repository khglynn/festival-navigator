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
//   - The phone's local clock IS the festival clock. The person this is for
//     is standing at the festival; a friend checking from another timezone
//     sees a line at their own local time, which is an honest "no line at
//     all" the rest of the time (the date won't match a grid day). Festival
//     files carry no timezone on purpose — one less thing to get wrong.
export const DAY_ROLLOVER_HOUR = 5;

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// {iso, minutes}: the festival calendar day this moment belongs to, and the
// minutes-since-that-day's-midnight on the timetable's own axis (AM hours
// after the rollover land at 24h+, matching timeToMinutes).
export function festivalClock(date = new Date()) {
  const h = date.getHours();
  let minutes = h * 60 + date.getMinutes();
  const d = new Date(date.getTime());
  if (h < DAY_ROLLOVER_HOUR) {
    minutes += 24 * 60;
    d.setDate(d.getDate() - 1);
  }
  return { iso: isoOf(d), minutes };
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
  const clock = festivalClock(date);
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
export function claimScrollOnce(key, store = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  if (scrolled.has(key)) return false;
  let stored = null;
  try { stored = store && store.getItem(key); } catch { stored = null; }
  if (stored) { scrolled.add(key); return false; }
  scrolled.add(key);
  try { if (store) store.setItem(key, '1'); } catch { /* memory-only session */ }
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
