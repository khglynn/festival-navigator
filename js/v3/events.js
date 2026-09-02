// The events model — day-first composition and the layout rule
// (claude-plans/2026-08-31-events-canvas/MODEL-V3.md, built 2026-09-01).
//
// Pure: takes a festival document and the day groups the wall is about to
// render, returns what the wall lays out — the days (the union of grid days
// and event nights, in festival order), the sections active on each, the
// mode each section wears ALL WEEK (the consistency law), and, for a
// columns section, where every set sits on the clock.
// No DOM, no state: the wall, the day tabs, the zoom's facts and the tests
// all read the same answers from here.
import { activityMinutes, dayLabelParts } from '../time.js';
import { dayIsoOf } from './now.js';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LONG = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The bucket key for the festival's own room (the main grid, or a lineup
// day's billing). Sections are keyed by their own day label ("Afters"). A
// leading colon keeps it out of the space a data file's day labels live in.
export const FEST_BUCKET = ':fest';

// ---- reading an entry ---------------------------------------------------------
// A section entry says when and where as data (`night`, `venue` — phase 1)
// or, in a file that predates phase 1, as the "<Night> · <Venue>" stage
// string. Both are read; the data wins when both exist.
const asWeekday = (s) => {
  const w = String(s || '').trim().slice(0, 3).toLowerCase();
  return WEEKDAYS.find((d) => d.toLowerCase() === w) || null;
};
export function nightOf(entry) {
  if (!entry) return null;
  if (typeof entry.night === 'string' && WEEKDAYS.includes(entry.night)) return entry.night;
  if (typeof entry.stage === 'string' && entry.stage.includes(' · ')) {
    const first = entry.stage.split(' · ')[0].trim();
    return WEEKDAYS.includes(first) ? first : null;
  }
  return null;
}
export function venueOf(entry) {
  if (!entry) return null;
  if (typeof entry.venue === 'string' && entry.venue.trim()) return entry.venue.trim();
  if (typeof entry.stage === 'string' && entry.stage.includes(' · ')) {
    return entry.stage.split(' · ').slice(1).join(' · ').trim() || null;
  }
  return null;
}
// The occurrence a card for this entry represents — what the zoom, the
// notes sheet and the route key carry. `stage` keeps the "Night · Venue"
// shape factsFor already reads, synthesized when a file carries only the
// structured pair.
export function occOf(entry) {
  const night = nightOf(entry);
  const venue = venueOf(entry);
  return {
    day: entry.day || null,
    stage: entry.stage || (night && venue ? `${night} · ${venue}` : null),
    time: entry.time || null,
    weekend: entry.weekends || null,
  };
}
// A day KEY maps to a weekday through dayMeta.wd, else through the label's
// head ("Wednesday, Sept 16 (…)" → Wed). Null for keys that are not days
// ("Afters", "Day 1").
export function weekdayOfDay(dayKey, meta) {
  if (meta && typeof meta.wd === 'string') return asWeekday(meta.wd);
  return asWeekday(dayLabelParts(dayKey).head);
}

// A run member carries an order (MODEL-V3 §5).
export const isRunMember = (e) => !!(e && e.order && Number.isInteger(e.order.seq) && Number.isInteger(e.order.of));

// ---- the clock -------------------------------------------------------------------
// Events run on the festival-day axis (time.js activityMinutes): 9 AM starts
// the day, anything before it is after midnight. timeToMinutes would put the
// Folsom Street Fair's 11 AM at 35:00, the morning after — the one shape a
// night-time axis gets wrong.
const CLOCK_RE = /^(1[0-2]|0?[1-9])(:[0-5][0-9])? (AM|PM)$/i;
export function parseEventTime(time) {
  if (typeof time !== 'string') return null;
  const [s, e] = time.split(' - ').map((x) => x.trim());
  if (!CLOCK_RE.test(s)) return null;
  const startMin = activityMinutes(s);
  let endMin = null;
  let endStr = null;
  if (e && CLOCK_RE.test(e)) {
    endMin = activityMinutes(e);
    if (endMin <= startMin) endMin += 24 * 60;
    endStr = e;
  }
  return { startMin, endMin, startStr: s, endStr };
}
export function hourLabelOf(mins) {
  const hr = Math.floor(mins / 60) % 24;
  return `${hr % 12 === 0 ? 12 : hr % 12} ${hr < 12 ? 'AM' : 'PM'}`;
}
const tilde = (e, s) => (e && e.approx === true ? `~${s}` : s);
export { tilde as approxMark };

// ---- the layout rule (MODEL-V3 §2) ------------------------------------------------
// Per night: venue COLUMNS on a clock only where the clock pays — enough
// timed shows, venues that repeat, most shows timed. The data decides;
// festival files never declare a layout.
export function earnsColumns(list) {
  const timed = list.filter((e) => parseEventTime(e.time) && venueOf(e));
  const E = timed.length;
  const venues = new Set(timed.map(venueOf));
  const R = E / Math.max(1, venues.size);
  const T = list.length ? E / list.length : 0;
  return { earns: E >= 5 && R >= 1.5 && T >= 0.6, E, V: venues.size, R, T };
}
// The consistency law (Kevin, 2026-08-31): the mode is decided per SECTION
// per FEST — if any night earns columns, every night of that section wears
// them. The column SET stays each night's own venues.
export function sectionModeOf(byNight) {
  for (const list of byNight.values()) if (earnsColumns(list).earns) return 'columns';
  return 'tiles';
}

// ---- the day axis ------------------------------------------------------------------
// Where a weekday sits relative to the festival's first grid day: up to
// three days before it read as "before" (a Thursday afters, a Wednesday
// pre-party), everything else follows (a Monday afterparty lands after
// Sunday). The anchor itself scores 3.
export function dayOrderKey(wd, anchorWd) {
  return (WEEKDAYS.indexOf(wd) - WEEKDAYS.indexOf(anchorWd) + 10) % 7;
}
function isoPlusDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function shortDate(iso) {
  const [, m, d] = String(iso).split('-').map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${d}` : '';
}

// ---- the model ----------------------------------------------------------------------
// `groups` is the wall's own grouping (wall.js groupByDay: combined days
// already split, known-day order): Map(dayKey → entries). `gridDays` are the
// timetable's days for a scheduled fest, [] for a lineup fest.
//
// Returns { dayFirst: false, why } when the composition does not apply —
// the caller then renders exactly as today. Otherwise:
//   days      [{ key, wd, short, long, sub, iso, grid, billing }] in order
//   sections  [{ key, label, mode, byNight, byDay, loose }] in known order
//   looseNoDay  the entries with no day at all (a lineup's THE LINEUP)
export function eventModelOf(fest, groups, { gridDays = [], weekend = null } = {}) {
  const dayMeta = (fest && fest.dayMeta) || {};
  const sections = [];
  const billingByDay = new Map();
  let looseNoDay = [];
  for (const [key, list] of groups) {
    if (!key) { looseNoDay = list; continue; }
    if (gridDays.includes(key)) { billingByDay.set(key, list); continue; }
    const byNight = new Map();
    const loose = [];
    for (const e of list) {
      const n = nightOf(e);
      if (!n) { loose.push(e); continue; }
      if (!byNight.has(n)) byNight.set(n, []);
      byNight.get(n).push(e);
    }
    if (byNight.size) sections.push({ key, label: dayLabelParts(key).head, byNight, loose, mode: sectionModeOf(byNight) });
    else billingByDay.set(key, list);
  }
  if (!sections.length) return { dayFirst: false, why: 'no section entry carries a night' };

  // Every real day must own one weekday, or the union with the nights has
  // no axis to happen on.
  const dayKeys = [...new Set([...gridDays, ...billingByDay.keys()])];
  const wdOf = new Map();
  for (const k of dayKeys) {
    const wd = weekdayOfDay(k, dayMeta[k]);
    if (!wd) return { dayFirst: false, why: `day "${k}" does not name a weekday` };
    if ([...wdOf.values()].includes(wd)) return { dayFirst: false, why: `two day keys share ${wd}` };
    wdOf.set(k, wd);
  }
  const keyOfWd = new Map([...wdOf].map(([k, wd]) => [wd, k]));
  for (const s of sections) for (const n of s.byNight.keys()) if (!keyOfWd.has(n)) keyOfWd.set(n, LONG[n]);
  const anchor = gridDays.length ? wdOf.get(gridDays[0])
    : dayKeys.length ? wdOf.get(dayKeys[0])
      : [...keyOfWd.keys()].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))[0];
  // Tab labels follow the fest's own style: "SAT" where dayMeta carries a
  // weekday, the day key's head otherwise — the same split app.js made.
  const wdStyle = dayKeys.some((k) => dayMeta[k] && dayMeta[k].wd);
  const days = [...keyOfWd].map(([wd, key]) => {
    const meta = dayMeta[key] || null;
    const synthetic = !wdOf.has(key);
    const long = meta && meta.wd ? `${meta.wd} ${meta.num || ''}`.trim()
      : synthetic ? (wdStyle ? wd : LONG[wd]) : dayLabelParts(key).head;
    return {
      key, wd, synthetic, grid: gridDays.includes(key), billing: billingByDay.get(key) || null,
      short: (meta && meta.wd ? meta.wd : synthetic ? wd : key).slice(0, 3).toUpperCase(),
      long: long.toUpperCase(),
      iso: synthetic ? null : dayIsoOf(meta, weekend),
      sub: '',
    };
  }).sort((a, b) => dayOrderKey(a.wd, anchor) - dayOrderKey(b.wd, anchor));

  // Dates: a synthetic day borrows its date from any real day that has one
  // (Saturday is the 26th, so Thursday is the 24th) — the day-of open and
  // the now line need the iso; the rule's sub line wants "Sep 24".
  const ref = days.find((d) => d.iso);
  for (const d of days) {
    if (!d.iso && ref) d.iso = isoPlusDays(ref.iso, dayOrderKey(d.wd, anchor) - dayOrderKey(ref.wd, anchor));
    const meta = dayMeta[d.key];
    if (meta) {
      const date = (weekend && meta.dates && meta.dates[weekend]) || meta.date;
      d.sub = [meta.wd, date || (meta.num ? `Day ${meta.num}` : ''), dayLabelParts(d.key).aside].filter(Boolean).join(' · ');
    } else if (d.synthetic && d.iso) {
      d.sub = [wdStyle ? d.wd : null, shortDate(d.iso)].filter(Boolean).join(' · ');
    } else {
      d.sub = dayLabelParts(d.key).aside;
    }
  }
  for (const s of sections) {
    s.byDay = new Map();
    for (const d of days) { const list = s.byNight.get(d.wd); if (list) s.byDay.set(d.key, list); }
  }
  return { dayFirst: true, days, sections, looseNoDay, anchor };
}

// The buckets a fest offers: its own room, then each section.
export function bucketsOf(fest, model) {
  return [{ key: FEST_BUCKET, label: (fest && fest.name) || 'Festival' }, ...model.sections.map((s) => ({ key: s.key, label: s.label }))];
}

// ---- the run's facts (MODEL-V3 §5, the LOCKED copy) ---------------------------------
// The resting card wears the tilde; the zoom tells the whole truth in two
// lines: the venue's real window, then the order and how sure we are, as a
// door to where the order came from. Once the venue posts it, the word
// "Guessing" goes and the door stays.
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
export function runFactsOf(entry) {
  if (!entry) return null;
  const approx = entry.approx === true;
  const order = isRunMember(entry) ? entry.order : null;
  const doors = typeof entry.doors === 'string' ? entry.doors : null;
  const close = typeof entry.close === 'string' ? entry.close : null;
  if (!approx && !order && !doors) return null;
  const closeApprox = entry.closeApprox === true;
  let window = null;
  if (doors && close) window = `Runs ${doors} – ${closeApprox ? '~' : ''}${close}`;
  else if (doors) window = `Doors ${doors}`;
  const orderText = order ? `${order.confirmed ? '' : 'Guessing they’re '}${ordinal(order.seq)} of ${order.of}` : null;
  const orderUrl = order && typeof order.source === 'string' && /^https:\/\//.test(order.source) ? order.source : null;
  return { approx, doors, close, closeApprox, window, orderText, orderUrl, confirmed: !!(order && order.confirmed) };
}
// The artists[] entry a card's occurrence came from. Never by name alone: in
// Portola a name can be TWO entries (a grid billing and an event), and the
// first match is the wrong story for every card but the first.
export function findEventEntry(fest, name, occ) {
  if (!occ || !fest) return null;
  const want = occ.stage || '';
  return (fest.artists || []).find((a) => a && a.name === name
    && (a.day || null) === (occ.day || null)
    && (a.time || null) === (occ.time || null)
    && (occOf(a).stage || '') === want) || null;
}

// ---- a night's timetable (MODEL-V3 §5, the ONE RULE) --------------------------------
// Rows are 15 minutes. THE RULE (Kevin, 2026-09-01): a venue-night is ONE
// ROOM, and artists at one room play IN SEQUENCE. So a room's sets are a
// plain vertical run — stacked top to bottom in play order, each its own
// tappable card. Never side-by-side lanes, never a deck, never a combined
// card. (The main festival grid keeps its lanes: real stages with real set
// times genuinely overlap. An events venue is a club with one booth.)
//
// Play order is the numbering when the room's sets carry one (`order.seq`,
// MODEL-V3 §5), else the clock, else file order. A set ends where the next
// one in the room begins; the CLOSER ends at the room's `close` when the file
// prints one, else an hour after it starts (the open-ended default). A set
// whose file prints its own end keeps it.
//
// The placement then walks DOWN the column: each card starts at its own time
// or where the one above it ended, whichever is later, and is at least 30
// minutes tall (the name + time floor).
//
// ONE NAMED EXCEPTION, for the room nobody has re-read yet: when every set in
// a room carries the SAME time string, that string is not a set time — it is
// the room's WINDOW, a doors time (or the room's hours) copied onto every act
// by whoever transcribed the bill. That is exactly the misreading MODEL-V3 §5
// exists to correct, and it is what all twelve of Portola's multi-artist
// rooms looked like before the migration. In that case the sets divide the
// window equally, so the column reads as N even slots instead of one long
// card and a row of slivers.
//
// Venues read left to right by their earliest set; ties keep file order. An
// entry with a time but no venue is never filed as timeless: it comes back in
// `loose`, time intact, for the wall to tile beside the clock.
export function timetableOf(entries) {
  const timed = [];
  const tba = [];
  const loose = [];
  entries.forEach((e, i) => {
    const t = parseEventTime(e.time);
    const venue = venueOf(e);
    if (t && venue) timed.push({ e, i, venue, ...t, run: isRunMember(e) });
    else if (t) loose.push(e);
    else tba.push(e);
  });
  if (!timed.length) return { venues: [], cells: [], tba, loose, startRow: 0, rows: 0 };

  const rooms = new Map();
  for (const t of timed) {
    if (!rooms.has(t.venue)) rooms.set(t.venue, []);
    rooms.get(t.venue).push(t);
  }
  for (const sets of rooms.values()) {
    // The numbering leads only when EVERY set in the room carries one — a
    // half-numbered room has no run to read, so the clock leads instead.
    const numbered = sets.length > 1 && sets.every((t) => t.run);
    sets.sort(numbered
      ? (a, b) => a.e.order.seq - b.e.order.seq || a.startMin - b.startMin || a.i - b.i
      : (a, b) => a.startMin - b.startMin || a.i - b.i);
    // The room's close: the validator makes every set in a room agree on it,
    // so the first one that states it speaks for the room.
    const closeStr = (sets.find((t) => typeof t.e.close === 'string') || { e: {} }).e.close || null;
    const closeApprox = sets.some((t) => t.e.closeApprox === true);
    const close = closeStr ? parseEventTime(closeStr) : null;
    sets.forEach((m, k) => {
      if (m.endMin != null) return; // the file printed this set's own end
      const next = sets[k + 1];
      if (next && next.startMin > m.startMin) { m.endMin = next.startMin; return; }
      // Only a genuine CLOSER runs to the room's close. A numbered run that
      // is half entered (3 of 4 in the file) must not let its last-known set
      // claim the night — the missing one is still coming (review round P2 12,
      // 2026-09-01).
      if (!next && close && close.startMin > m.startMin && (!m.run || m.e.order.seq === m.e.order.of)) {
        m.endMin = close.startMin;
        m.endStr = closeApprox ? `~${closeStr}` : closeStr; // a guessed close keeps its tilde
        return;
      }
      m.endMin = m.startMin + 60;
    });
  }
  for (const t of timed) t.dispEnd = Math.max(t.endMin, t.startMin + 30);

  // The room whose sets all print one time: that time is the window (above).
  function windowSlice(sets, topRow, endRow) {
    if (sets.length < 2) return null;
    const t0 = sets[0].e.time;
    if (!t0 || !sets.every((t) => t.e.time === t0)) return null;
    const w = parseEventTime(t0);
    const top = topRow(w.startMin);
    // A window with no end of its own reads as one hour of "we do not know",
    // which the 30-minute floor then shares out.
    const bottom = endRow(w.endMin != null ? w.endMin : w.startMin + 60);
    return { top, rows: Math.max(2, Math.floor((bottom - top) / sets.length)) };
  }

  const firstAt = new Map();
  for (const t of timed) {
    const f = firstAt.get(t.venue);
    if (!f || t.startMin < f.startMin || (t.startMin === f.startMin && t.i < f.i)) firstAt.set(t.venue, t);
  }
  const venues = [...firstAt.entries()].sort((a, b) => a[1].startMin - b[1].startMin || a[1].i - b[1].i).map(([v]) => v);
  const startRow = Math.floor(Math.min(...timed.map((t) => t.startMin)) / 15);
  const topRow = (min) => Math.floor(min / 15) - startRow + 1;
  const endRow = (min) => Math.ceil(min / 15) - startRow + 1; // exclusive

  const cells = [];
  venues.forEach((v, vi) => {
    const col = vi + 1;
    const sets = rooms.get(v);
    const slice = windowSlice(sets, topRow, endRow);
    let cursor = 1;
    sets.forEach((t, k) => {
      const row = slice ? slice.top + k * slice.rows : Math.max(topRow(t.startMin), cursor);
      const span = slice ? slice.rows : Math.max(2, endRow(t.dispEnd) - row); // the 30-minute display floor
      // A sliced set does not end where the window does — only the last one
      // might, and none of them can prove it. The "until" line goes.
      if (slice) t.endStr = null;
      cells.push({ venue: v, col, row, span, entry: t });
      cursor = row + span;
    });
  });
  const rows = Math.max(...cells.map((c) => c.row + c.span)) - 1;
  return { venues, cells, tba, loose, startRow, rows };
}

// Tiles: time-sorted, ties in file order, the timeless at the end.
export function sortForTiles(entries) {
  const at = (e) => { const t = parseEventTime(e.time); return t ? t.startMin : Infinity; };
  return entries.map((e, i) => ({ e, i, at: at(e) }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map((x) => x.e);
}
