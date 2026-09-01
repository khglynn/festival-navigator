// The events model — day-first composition and the layout rule
// (claude-plans/2026-08-31-events-canvas/MODEL-V3.md, built 2026-09-01).
//
// Pure: takes a festival document and the day groups the wall is about to
// render, returns what the wall lays out — the days (the union of grid days
// and event nights, in festival order), the sections active on each, the
// mode each section wears ALL WEEK (the consistency law), and, for a
// columns section, where every card, lane, deck and run sits on the clock.
// No DOM, no state: the wall, the day tabs, the zoom's facts and the tests
// all read the same answers from here.
import { activityMinutes, dayLabelParts } from '../time.js';
import { computeLanes } from '../overlap.js';
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

// ---- a night's timetable (MODEL-V3 §4 + §5) -----------------------------------------
// Rows are 15 minutes. Every timed entry gets a display extent of at least
// 30 minutes (the name + time floor the main grid uses). Per venue, sets
// that overlap on display form a cluster:
//   · a cluster holding a RUN member renders as a plain vertical run —
//     never lanes, never a deck (§5; artist separation is law),
//   · a cluster whose PEAK concurrency is three or more becomes ONE deck
//     (§4) — a long set bridging two shorter ones that never overlap each
//     other is two lanes, not a pile (review round, 2026-09-01),
//   · two split into lanes, exactly as the main grid does.
// Venues read left to right by their earliest set; ties keep file order.
// An entry with a time but no venue is never filed as timeless: it comes
// back in `loose`, time intact, for the wall to tile beside the clock.
function peakConcurrency(cluster) {
  const marks = [];
  for (const t of cluster) marks.push([t.startMin, 1], [t.dispEnd, -1]);
  marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]); // an end before a start at the same minute
  let now = 0;
  let peak = 0;
  for (const [, d] of marks) { now += d; if (now > peak) peak = now; }
  return peak;
}
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

  // A run member ends when its SUCCESSOR begins — the member numbered next,
  // when it is entered; only the closer (seq === of) runs to the room's
  // close. A member whose successor is not in the file yet draws the hour
  // like any open-ended set, so a half-entered run never claims the night.
  const runs = new Map();
  for (const t of timed) if (t.run) { if (!runs.has(t.venue)) runs.set(t.venue, []); runs.get(t.venue).push(t); }
  for (const members of runs.values()) {
    members.sort((a, b) => a.e.order.seq - b.e.order.seq || a.startMin - b.startMin);
    members.forEach((m, k) => {
      if (m.endMin != null) return;
      const next = members[k + 1];
      if (next && next.e.order.seq === m.e.order.seq + 1 && next.startMin > m.startMin) { m.endMin = next.startMin; return; }
      if (m.e.order.seq !== m.e.order.of) return;
      const close = typeof m.e.close === 'string' ? parseEventTime(m.e.close) : null;
      if (close && close.startMin > m.startMin) { m.endMin = close.startMin; m.endStr = m.e.close; }
    });
  }
  for (const t of timed) {
    if (t.endMin == null) t.endMin = t.startMin + 60;
    t.dispEnd = Math.max(t.endMin, t.startMin + 30);
  }
  const firstAt = new Map();
  for (const t of timed) {
    const f = firstAt.get(t.venue);
    if (!f || t.startMin < f.startMin || (t.startMin === f.startMin && t.i < f.i)) firstAt.set(t.venue, t);
  }
  const venues = [...firstAt.entries()].sort((a, b) => a[1].startMin - b[1].startMin || a[1].i - b[1].i).map(([v]) => v);
  const startRow = Math.floor(Math.min(...timed.map((t) => t.startMin)) / 15);
  const rows = Math.ceil(Math.max(...timed.map((t) => t.dispEnd)) / 15) - startRow;
  const rowOf = (min) => Math.floor(min / 15) - startRow + 1;

  const cells = [];
  venues.forEach((v, vi) => {
    const col = vi + 1;
    const mine = timed.filter((t) => t.venue === v)
      .sort((a, b) => a.startMin - b.startMin || ((a.run && b.run) ? a.e.order.seq - b.e.order.seq : 0) || a.i - b.i);
    const clusters = [];
    let cur = [];
    let curEnd = -Infinity;
    for (const t of mine) {
      if (cur.length && t.startMin >= curEnd) { clusters.push(cur); cur = []; curEnd = -Infinity; }
      cur.push(t);
      curEnd = Math.max(curEnd, t.dispEnd);
    }
    if (cur.length) clusters.push(cur);
    for (const c of clusters) {
      const hasRun = c.some((t) => t.run);
      if (!hasRun && peakConcurrency(c) >= 3) {
        const s = Math.min(...c.map((t) => t.startMin));
        const en = Math.max(...c.map((t) => t.dispEnd));
        cells.push({ kind: 'deck', venue: v, col, row: rowOf(s), span: Math.max(2, Math.ceil(en / 15) - Math.floor(s / 15)), startMin: s, items: c });
        continue;
      }
      let lanes = null;
      if (!hasRun && c.length > 1) {
        const wrapped = c.map((t) => ({ t, stage: v, startMin: t.startMin, endMin: t.dispEnd }));
        const laneMap = computeLanes(wrapped);
        lanes = new Map(wrapped.map((w) => [w.t, laneMap.get(w)]));
      }
      for (const t of c) {
        const lane = lanes ? lanes.get(t) : null;
        cells.push({
          kind: 'card', venue: v, col, row: rowOf(t.startMin),
          span: Math.max(1, Math.ceil((t.dispEnd - t.startMin) / 15)),
          lane: lane && lane.lanes > 1 ? lane : null, entry: t,
        });
      }
    }
  });
  return { venues, cells, tba, loose, startRow, rows };
}

// Tiles: time-sorted, ties in file order, the timeless at the end.
export function sortForTiles(entries) {
  const at = (e) => { const t = parseEventTime(e.time); return t ? t.startMin : Infinity; };
  return entries.map((e, i) => ({ e, i, at: at(e) }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map((x) => x.e);
}
