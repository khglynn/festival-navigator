// The events model — the day axis and the list (MODEL-V4, 2026-09-16).
//
// Pure: takes a festival document and the day groups the wall is about to
// render, returns what the wall lays out — the days (the union of grid days
// and event nights, in festival order), the sections active on each, the
// tabs that hang off the end (a dated section like ACL's Late nights), and,
// for a list, the venue groups a night divides into.
//
// THE ONE RULE (MODEL-V4 §1): stage columns on a clock only where the
// festival publishes a stage grid. Everything else is a stack of artist
// cards under the place it happens, in play order. The shape of the data
// decides — a grid is a grid — never a threshold nobody can see.
//
// No DOM, no state: the wall, the day tabs, the zoom's facts, the day-image
// export and the tests all read the same answers from here.
import { activityMinutes, dayLabelParts } from '../time.js';
import { dayIsoOf } from './now.js';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LONG = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---- reading an entry ---------------------------------------------------------
// A section entry says when and where as data (`night` or `date`, plus
// `venue`) or, in a file that predates that, as the "<Night> · <Venue>" stage
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
// A dated section entry carries the calendar date instead of a weekday
// (MODEL-V4 §2): it is its own tab, never a day on the week's axis.
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
export function dateOf(entry) {
  if (!entry || typeof entry.date !== 'string') return null;
  return ISO_RE.test(entry.date.trim()) ? entry.date.trim() : null;
}
export function venueOf(entry) {
  if (!entry) return null;
  if (typeof entry.venue === 'string' && entry.venue.trim()) return entry.venue.trim();
  if (typeof entry.stage === 'string' && entry.stage.includes(' · ')) {
    return entry.stage.split(' · ').slice(1).join(' · ').trim() || null;
  }
  return null;
}
// The part of town a show is in ("SoMa", "Castro"), when the file says. A
// by-time card has no room head above it, so it says its own place: the
// venue, and this after it (v94).
export function areaOf(entry) {
  return entry && typeof entry.area === 'string' && entry.area.trim() ? entry.area.trim() : null;
}
// The occurrence a card for this entry represents — what the zoom, the
// notes sheet and the route key carry, and what tells one card from another
// (wall.js writes it into `data-occ`).
//
// THE WHOLE IDENTITY, not a summary of it. A dated show has no night and no
// stage string, so day + stage + time was the SAME object for both of an
// artist's late nights — Jess Williamson plays Oct 1 at Stubb's and Oct 8 at
// The Continental Club, and the zoom on either card could only tell the
// first one's story. The date and the venue ride along, so two nights are
// two occurrences.
//
// `stage` keeps the "Night · Venue" shape the legacy files carry,
// synthesized when a file gives only the structured pair — a dated entry has
// neither and leaves it null.
export function occOf(entry) {
  const night = nightOf(entry);
  const venue = venueOf(entry);
  return {
    day: entry.day || null,
    stage: entry.stage || (night && venue ? `${night} · ${venue}` : null),
    time: entry.time || null,
    weekend: entry.weekends || null,
    date: dateOf(entry),
    venue,
  };
}
// A day KEY maps to a weekday through dayMeta.wd, else through the label's
// head ("Wednesday, Sept 16 (…)" → Wed). Null for keys that are not days
// ("Afters", "Day 1").
export function weekdayOfDay(dayKey, meta) {
  if (meta && typeof meta.wd === 'string') return asWeekday(meta.wd);
  return asWeekday(dayLabelParts(dayKey).head);
}

// A run member carries an order (MODEL-V4 §1.2 — the numbering leads the stack).
export const isRunMember = (e) => !!(e && e.order && Number.isInteger(e.order.seq) && Number.isInteger(e.order.of));

// ---- a cancelled act (2026-09-23) --------------------------------------------------
// `cancelled: { on, source, note? }` on an artists[] entry (festival-rules.mjs
// checkCancelled; docs/add-a-festival.md, "Cancelled acts"). The entry stays —
// its name is a pick key — and its card says it is off: last in its room,
// never "now", never in a playlist.
export const isCancelled = (e) => !!(e && e.cancelled && typeof e.cancelled === 'object');
// The names with nothing left to see: every entry under the name is cancelled
// and no grid day has a set for it. One called-off night of an artist who
// still plays another is not in here — that artist is still worth a playlist.
const goneCache = new WeakMap();
export function cancelledNames(fest) {
  if (!fest || typeof fest !== 'object') return new Set();
  if (goneCache.has(fest)) return goneCache.get(fest);
  const live = new Set();
  const off = new Set();
  for (const a of fest.artists || []) {
    if (!a || typeof a.name !== 'string') continue;
    (isCancelled(a) ? off : live).add(a.name);
  }
  for (const d of Object.values(fest.days || {})) for (const s of (d && d.artists) || []) if (s) live.add(s.name);
  const gone = new Set([...off].filter((n) => !live.has(n)));
  goneCache.set(fest, gone);
  return gone;
}

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
// "Thu · Oct 1" — a date that speaks for itself, because a dated show has no
// weekday label to borrow one from. One builder: a search's list head over a
// dated section's date shouts it (dateRuleLabel), the zoom says it.
export function shortDateLabel(iso) {
  const wd = weekdayOfIso(iso);
  return wd ? `${wd} · ${shortDate(iso)}` : String(iso);
}
// "Tue" for 2026-09-29 — the weekday a date's room head leads with
// (`TUE LATE NIGHTS`); null for a string that is not a date.
export function weekdayOfIso(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : WEEKDAYS[(d.getUTCDay() + 6) % 7];
}
// "TUE · SEP 29" — a search's list head over one date's answers in a dated
// section. (On the wall that date is a room head, `TUE LATE NIGHTS  Sep 29`.)
export function dateRuleLabel(iso) {
  return shortDateLabel(iso).toUpperCase();
}
const dayOfMonth = (iso) => String(Number(String(iso).slice(8, 10)) || '');

// ---- the list: venue groups (MODEL-V4 §1.2) ---------------------------------------
// A night is a stack of artist cards under the place it happens, in play
// order. One group per venue; a show with a time and no room yet lands in a
// group headed "Venue TBA" (a real time is never hidden).
//
//   Order inside a group: `order.seq` when EVERY member carries one — a
//   half-numbered room has no run to read — else the clock, else file order.
//   A run reads top to bottom as the night plays.
//   Order of groups: by doors (else the first member's time), then larger
//   groups first at the same doors time so a row of stacks holds less air.
//   Groups with no known time last.
//
// `fallbackVenue` is what a venue-less entry groups under; without one it is
// Venue TBA, and a group nothing is known about sorts last either way.
//
// The sub line invents nothing: "Doors 10 PM · ~3 AM" from any member's
// `doors` and `close`, the tilde when the close is a guess; a group with
// neither shows no sub line at all.
//
// `nowFrom`/`nowTo` is the window that makes a card the one playing right
// now (the stack's answer to the timetable's now line): a member runs until
// the next member starts, else to its own printed end, else to the room's
// close, else an hour. A room that only knows its doors and close lights the
// whole room for that window — the only honest answer when NOTHING in it is
// timed (a lone headliner with doors glows all night). Where some members
// are timed, an untimed one gets no window: it is on the bill, time unknown
// — it sorts after the timed ones and its card shows no time. Before this,
// three untimed names added to Sun's Midway (S.I.M, Espurr, New Nostalgia;
// Tixr prints no order or times) all glowed beside Two Shell at 12:45 AM and
// NOW's first tap pulsed four Midway cards (data agent, 2026-09-24).
//
// A CANCELLED member (isCancelled) is in the room and plays no part in it: it
// sorts last, has no now window, is not "the next member" that ends the set
// before it, and lends the room no doors, close or start. A room of nothing
// but cancelled shows has no sub line and sorts after every room with
// something on.
export const VENUE_TBA = 'Venue TBA';

export function venueGroupsOf(entries, { fallbackVenue = null } = {}) {
  const rooms = new Map();
  (entries || []).forEach((e, i) => {
    // In the festival's own room the place IS the festival's site: a name
    // billed for the day with no set time yet is at Zilker Park, we just do
    // not know when. Only a SECTION show with nowhere to be is Venue TBA.
    const venue = venueOf(e) || fallbackVenue || VENUE_TBA;
    if (!rooms.has(venue)) rooms.set(venue, []);
    rooms.get(venue).push({ e, i, t: parseEventTime(e.time) });
  });
  const groups = [...rooms].map(([venue, all], gi) => {
    const on = all.filter((m) => !isCancelled(m.e));
    const off = all.filter((m) => isCancelled(m.e));
    const numbered = on.length > 1 && on.every((m) => isRunMember(m.e));
    const at = (m) => (m.t ? m.t.startMin : Infinity);
    on.sort(numbered
      ? (a, b) => a.e.order.seq - b.e.order.seq || at(a) - at(b) || a.i - b.i
      : (a, b) => at(a) - at(b) || a.i - b.i);
    off.sort((a, b) => at(a) - at(b) || a.i - b.i);
    const list = on;
    const firstOf = (pick) => { for (const m of list) { const v = pick(m.e); if (typeof v === 'string' && v) return v; } return null; };
    const doors = firstOf((e) => e.doors);
    const close = firstOf((e) => e.close);
    const closeApprox = list.some((m) => m.e.closeApprox === true || m.e.approx === true);
    const doorsMin = doors ? (parseEventTime(doors) || {}).startMin ?? null : null;
    const closeMin = close ? (parseEventTime(close) || {}).startMin ?? null : null;
    const anyTimed = list.some((m) => m.t);
    const members = list.map((m, k) => {
      const next = list[k + 1];
      let nowFrom = null;
      let nowTo = null;
      if (m.t) {
        nowFrom = m.t.startMin;
        const nextStart = next && next.t && next.t.startMin > m.t.startMin ? next.t.startMin : null;
        nowTo = nextStart ?? m.t.endMin ?? (closeMin != null && closeMin > m.t.startMin ? closeMin : null) ?? m.t.startMin + 60;
      } else if (!anyTimed && doorsMin != null && closeMin != null) {
        nowFrom = doorsMin;
        nowTo = closeMin;
      }
      return {
        e: m.e,
        startStr: m.t ? m.t.startStr : null,
        endStr: m.t ? m.t.endStr : null,
        approx: m.e.approx === true,
        cancelled: false,
        nowFrom,
        nowTo,
      };
    });
    for (const m of off) {
      members.push({ e: m.e, startStr: null, endStr: null, approx: false, cancelled: true, nowFrom: null, nowTo: null });
    }
    const firstStart = Math.min(...list.map(at));
    const at0 = doorsMin ?? (Number.isFinite(firstStart) ? firstStart : null);
    return {
      venue,
      tba: venue === VENUE_TBA,
      doors,
      close,
      closeApprox,
      sub: [doors ? `Doors ${doors}` : null, close ? `${closeApprox ? '~' : ''}${close}` : null].filter(Boolean).join(' · '),
      at: at0,
      cancelled: !on.length,
      gi,
      members,
    };
  });
  // A room with nothing on goes after every room that has something; then
  // groups with no known time last; the biggest stack leads a tie so a row
  // of stacks holds less air; file order settles the rest.
  groups.sort((a, b) => {
    if (a.cancelled !== b.cancelled) return a.cancelled ? 1 : -1;
    if ((a.at == null) !== (b.at == null)) return a.at == null ? 1 : -1;
    if (a.at != null && a.at !== b.at) return a.at - b.at;
    return b.members.length - a.members.length || a.gi - b.gi;
  });
  return groups;
}

// ---- the list BY TIME (v94, 2026-09-25) --------------------------------------------
// A third presentation, and the data declares it — never a threshold. A
// section says how it wants to be read in ONE place, its own dayMeta entry:
//
//   "dayMeta": { "Folsom": { "date": "Sep 25-27", "layout": "by-time" } }
//
// `by-venue` (the default, and what a section without the field gets) is the
// stack of cards under each room (MODEL-V4 §1.2): right where a night is a
// handful of rooms, each with a run of acts. `by-time` is for a night that is
// many one-party rooms — Folsom weekend is 68 parties in 39 venues, and on a
// night only two or three rooms host more than one — where stacks would be
// twenty one-card columns and a clock would pile ten 9 PM starts on a phone.
// There the question is "what's on around ten?", so the cards run in start
// order under quiet time bands and wrap, each card saying where it is.
//
// One declaration per section, so a section cannot disagree with itself about
// how it reads (a field on every entry could); the validator rejects a
// declaration that names no section (festival-rules.mjs checkLayouts).
export const BY_VENUE = 'by-venue';
export const BY_TIME = 'by-time';
export const LAYOUTS = [BY_VENUE, BY_TIME];
export function sectionLayoutOf(fest, key) {
  const meta = fest && fest.dayMeta && typeof key === 'string' ? fest.dayMeta[key] : null;
  return meta && meta.layout === BY_TIME ? BY_TIME : BY_VENUE;
}

// Where every room an entry sits in reads by time, each party there is ITS
// OWN SHOW (v94): its own start, its own page and ticket link, never a run.
// So the rules that make a ROOM one show — a timed room needs a running order,
// one venue-night is one bill with one page and one ticket link — do not reach
// it. The validator (festival-rules.mjs) and the file's own tests ask this one
// question, so they cannot drift apart. A combined label ("Afters & Folsom")
// still has a room in Afters, and the room's rules still hold it there.
const DAY_PARTS = /\s*[&+/]\s*|\s+and\s+/i;
export function showsOnItsOwn(fest, entry) {
  const parts = String((entry && entry.day) || '').split(DAY_PARTS).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => sectionLayoutOf(fest, p) === BY_TIME);
}

// The bands, on the festival-day clock (9 AM starts the day; activityMinutes).
// Fixed boundaries, never fitted to the data, so a night with two parties
// reads the same way as a night with twenty-six: a band with nothing in it is
// simply not drawn. The words are the ones a night out uses — the happy hours
// and the fair are DAYTIME and EVENING, the doors most parties open are 9 PM
// and 10 PM, LATE runs to bar close (2 AM in San Francisco), and anything
// that starts after it is AFTER-HOURS. A party with no clock at all is TIME
// TBA, last: nothing is hidden, and nothing pretends to know when.
const H = 60;
export const TIME_BANDS = [
  { key: 'day', label: 'Daytime', from: 9 * H, to: 17 * H },
  { key: 'evening', label: 'Evening', from: 17 * H, to: 21 * H },
  { key: '9pm', label: '9 PM', from: 21 * H, to: 22 * H },
  { key: '10pm', label: '10 PM', from: 22 * H, to: 23 * H },
  { key: 'late', label: 'Late', from: 23 * H, to: 26 * H },
  { key: 'after', label: 'After-hours', from: 26 * H, to: 33 * H },
];
export const TIME_TBA = { key: 'tba', label: 'Time TBA', from: null, to: null };
export const bandOf = (startMin) => (startMin == null ? TIME_TBA
  : TIME_BANDS.find((b) => startMin >= b.from && startMin < b.to) || TIME_TBA);

// The night in start order, cut into bands. Built ON the stacks' own model
// (venueGroupsOf), so everything a stack card knows — its now window, a
// cancelled party's place, the tilde on a guessed time — a by-time card knows
// the same way. Only the arrangement differs: every member leaves its room
// and lines up by when it starts (a set's time, else the room's doors), a
// cancelled party last in its band, file order settling a tie.
//
// One difference in the now window, and it is the point of the layout: a
// stack is a RUN, where an act plays until the next act starts; a by-time
// room holds separate parties, so a party's PRINTED end wins — the 3–8 PM tea
// dance at The Stud is over at 8, not when Friday's 9 PM party opens the same
// door. Without a printed end the stack's rule stands (the next party in the
// room, else the room's close, else an hour); a longer guess is data's to
// make (`close`, closeApprox), never the renderer's.
export function timeBandsOf(entries, opts = {}) {
  const list = entries || [];
  const at = new Map(list.map((e, i) => [e, i]));
  const members = [];
  for (const g of venueGroupsOf(list, opts)) {
    for (const m of g.members) {
      const t = parseEventTime(m.e.time) || parseEventTime(m.e.doors);
      const set = parseEventTime(m.e.time);
      const nowTo = m.nowFrom != null && set && set.endMin != null ? set.endMin : m.nowTo;
      members.push({ ...m, nowTo, venue: g.venue, tba: g.tba, startMin: t ? t.startMin : null, i: at.get(m.e) ?? 0 });
    }
  }
  const byBand = new Map();
  for (const m of members) {
    const b = bandOf(m.startMin);
    if (!byBand.has(b.key)) byBand.set(b.key, { ...b, members: [] });
    byBand.get(b.key).members.push(m);
  }
  const order = [...TIME_BANDS, TIME_TBA].map((b) => b.key);
  return [...byBand.values()]
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((b) => ({
      ...b,
      members: b.members.sort((x, y) => (x.cancelled - y.cancelled)
        || ((x.startMin ?? Infinity) - (y.startMin ?? Infinity))
        || x.i - y.i),
    }));
}

// ---- the model ----------------------------------------------------------------------
// `groups` is the wall's own grouping (wall.js groupByDay: combined days
// already split, known-day order): Map(dayKey → entries). `gridDays` are the
// timetable's days for a scheduled fest, [] for a lineup fest. `weekends` is
// the list of weekends a two-weekend scheduled fest renders as its own tabs
// ([null] for everything else).
//
// Returns:
//   days     [{ key, dayKey, wd, short, num, long, sub, when, iso, weekend,
//               grid, billing, synthetic }] in festival order — `key` is the
//               tab and jump id, `dayKey` the frozen day label pick data uses;
//               `sub` is the day's line ("Sat · Sep 26") and `when` the same
//               line without its weekday ("Sep 26", "Oct 2 · Weekend 1") —
//               what a day's first room head says after the weekday its own
//               label already carries (wall.js roomHead)
//   sections [{ key, label, byNight, byDay }] in known order; byDay is keyed
//               by the day's tab id
//   extras   [{ key, label, short, long, sub, byDate, entries }] — the tabs
//               that hang off the end: a dated section (byDate), or a section
//               whose entries never said which night (entries)
//   looseNoDay  the entries with no day at all (a lineup's THE LINEUP)
export function eventModelOf(fest, groups, { gridDays = [], weekends = [null] } = {}) {
  const dayMeta = (fest && fest.dayMeta) || {};
  const sections = [];
  const extras = [];
  const billingByDay = new Map();
  let looseNoDay = [];
  for (const [key, list] of groups) {
    if (!key) { looseNoDay = list; continue; }
    if (gridDays.includes(key)) { billingByDay.set(key, list); continue; }
    const byNight = new Map();
    const byDate = new Map();
    const loose = [];
    for (const e of list) {
      const n = nightOf(e);
      const iso = dateOf(e);
      if (n) {
        if (!byNight.has(n)) byNight.set(n, []);
        byNight.get(n).push(e);
      } else if (iso) {
        if (!byDate.has(iso)) byDate.set(iso, []);
        byDate.get(iso).push(e);
      } else loose.push(e);
    }
    const label = dayLabelParts(key).head;
    if (byDate.size) {
      extras.push({
        key,
        label,
        ...extraLabels(key, label),
        sub: [(dayMeta[key] || {}).date, (dayMeta[key] || {}).sub].filter(Boolean).join(' · '),
        byDate: new Map([...byDate].sort((a, b) => (a[0] < b[0] ? -1 : 1))),
        entries: null,
      });
    }
    if (byNight.size) sections.push({ key, label, byNight, loose });
    else if (loose.length && !byDate.size) billingByDay.set(key, loose);
    else if (loose.length) extras.push({ key, label, ...extraLabels(key, label), sub: '', byDate: null, entries: loose });
  }

  const dayKeys = [...new Set([...gridDays, ...billingByDay.keys()])];
  const wdOf = new Map();
  let axis = sections.length > 0;
  for (const k of dayKeys) {
    const wd = weekdayOfDay(k, dayMeta[k]);
    // A day key that names no weekday (Electric Forest's "Day 1"), or two
    // that name the same one, has no axis the nights can land on. The days
    // stay; the sections become their own tabs at the end rather than
    // guessing a night onto a day.
    if (!wd || [...wdOf.values()].includes(wd)) { axis = false; break; }
    wdOf.set(k, wd);
  }
  if (!axis) {
    for (const s of sections.splice(0)) {
      extras.push({ key: s.key, label: s.label, ...extraLabels(s.key, s.label), sub: '', byDate: null, entries: [...s.byNight.values()].flat().concat(s.loose) });
    }
    wdOf.clear();
    for (const k of dayKeys) { const wd = weekdayOfDay(k, dayMeta[k]); if (wd) wdOf.set(k, wd); }
  }

  const keyOfWd = new Map(axis ? [...wdOf].map(([k, wd]) => [wd, k]) : []);
  for (const s of sections) for (const n of s.byNight.keys()) if (!keyOfWd.has(n)) keyOfWd.set(n, LONG[n]);
  const anchor = gridDays.length ? wdOf.get(gridDays[0])
    : dayKeys.length ? wdOf.get(dayKeys[0])
      : [...keyOfWd.keys()].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))[0];
  // Tab labels follow the fest's own style: "SAT" where dayMeta carries a
  // weekday, the day key's head otherwise — the same split app.js made.
  const wdStyle = dayKeys.some((k) => dayMeta[k] && dayMeta[k].wd);
  // The weekday axis orders the week only when every day owns one (that is
  // what lets a Thursday night sit before Saturday's grid). Otherwise the
  // festival's own day order stands, exactly as the file wrote it.
  const ordered = axis
    ? [...keyOfWd].map(([wd, key]) => ({ key, wd }))
      .sort((a, b) => dayOrderKey(a.wd, anchor) - dayOrderKey(b.wd, anchor))
    : dayKeys.map((key) => ({ key, wd: wdOf.get(key) || null }));
  const days = ordered.map(({ key, wd }) => {
    const meta = dayMeta[key] || null;
    const synthetic = !dayKeys.includes(key);
    const long = meta && meta.wd ? `${meta.wd} ${meta.num || ''}`.trim()
      : synthetic ? (wdStyle ? wd : LONG[wd]) : dayLabelParts(key).head;
    return {
      key, dayKey: key, wd, synthetic, weekend: null,
      grid: gridDays.includes(key), billing: billingByDay.get(key) || null,
      short: (meta && meta.wd ? meta.wd : synthetic ? wd : key).slice(0, 3).toUpperCase(),
      num: null,
      long: long.toUpperCase(),
      iso: synthetic ? null : dayIsoOf(meta, weekends[0]),
      sub: '',
      when: '',
    };
  });

  // Dates: a synthetic day borrows its date from any real day that has one
  // (Saturday is the 26th, so Thursday is the 24th) — the day-of open and
  // the now line need the iso; the day's first head wants "Sep 24".
  const ref = days.find((d) => d.iso);
  for (const d of days) {
    if (!d.iso && ref && d.wd) d.iso = isoPlusDays(ref.iso, dayOrderKey(d.wd, anchor) - dayOrderKey(ref.wd, anchor));
    const meta = dayMeta[d.key];
    if (meta) {
      const date = (weekends[0] && meta.dates && meta.dates[weekends[0]]) || meta.date;
      d.when = [date || (meta.num ? `Day ${meta.num}` : ''), dayLabelParts(d.key).aside].filter(Boolean).join(' · ');
      d.sub = [meta.wd, d.when].filter(Boolean).join(' · ');
    } else if (d.synthetic && d.iso) {
      d.when = shortDate(d.iso);
      d.sub = [wdStyle ? d.wd : null, d.when].filter(Boolean).join(' · ');
    } else {
      d.when = dayLabelParts(d.key).aside;
      d.sub = d.when;
    }
  }

  // Two weekends, six tabs (MODEL-V4 §2): a weekend is not a filter any more,
  // it is which day you are looking at. Only grid days split — a night that
  // is not on the grid belongs to the week it was entered for.
  const axisDays = weekends.length > 1
    ? weekends.flatMap((w, wi) => days.filter((d) => d.grid).map((d) => {
      const meta = dayMeta[d.key] || {};
      const iso = dayIsoOf(meta, w);
      const when = [(meta.dates && meta.dates[w]) || meta.date, `Weekend ${wi + 1}`].filter(Boolean).join(' · ');
      return {
        ...d,
        key: `${d.key}|${w}`,
        weekend: w,
        iso,
        num: iso ? dayOfMonth(iso) : null,
        long: [d.long, iso ? dayOfMonth(iso) : null].filter(Boolean).join(' '),
        sub: [meta.wd, when].filter(Boolean).join(' · '),
        when,
      };
    }))
    : days;

  for (const s of sections) {
    s.byDay = new Map();
    for (const d of axisDays) { const list = s.byNight.get(d.wd); if (list) s.byDay.set(d.key, list); }
  }
  return { days: axisDays, sections, extras, looseNoDay, anchor };
}

// A tab that hangs off the end of the days: "LATE" in the dock, "LATE
// NIGHTS" on the rail. The first word is what fits, and it is what a person
// would say out loud.
function extraLabels(key, label) {
  const head = String(label || key).trim();
  const first = head.split(/\s+/)[0] || head;
  return { short: first.slice(0, 5).toUpperCase(), long: head.toUpperCase() };
}

// ---- the run's facts (MODEL-V4 §1.2, the LOCKED copy) -------------------------------
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
// first match is the wrong story for every card but the first. Two dated
// shows are the same all the way down to the date and the room, so those are
// asked about too.
//
// A field the occurrence does not carry AT ALL is not asked about — an
// occurrence from an old route key, or one a caller wrote by hand, still
// matches the way it always did. `null` is an answer ("this show has no
// date"), `undefined` is silence.
const sameField = (a, b) => (a || null) === (b || null);
export function findEventEntry(fest, name, occ) {
  if (!occ || !fest) return null;
  const want = occ.stage || '';
  return (fest.artists || []).find((a) => a && a.name === name
    && sameField(a.day, occ.day)
    && sameField(a.time, occ.time)
    && (occ.date === undefined || sameField(dateOf(a), occ.date))
    && (occ.venue === undefined || sameField(venueOf(a), occ.venue))
    && (occOf(a).stage || '') === want) || null;
}


// ---- A show's doors out: its page and its tickets (Kevin, 2026-09-24;
// prices 2026-09-26) ------------
// "when it's afters or shows like this I naturally want to click through to
// the event page. we have tix but do those always have details… and what
// about before tix are available." So a show that is not the festival's own
// set can carry two links, each at least `{ url, at }`, and the zoom says
// each as a plain word — "Tix $69 · Info" — never the seller's name (Kevin,
// 2026-09-26, from Portola: "I actually think we never need to see the name
// of the site where the tix are sold. No necessary info. Just tix if we
// don't know price or Tix $69 for example… some of these events are
// expensive"):
//
//   `page`    the show's own page for people — details, the whole bill, and
//             the one place to look before tickets exist: "Info".
//   `tickets` the buy link exactly as the listing printed it (a referral tag
//             stays: it pays the small company that listed the show):
//             "Tix" with no price on file, "Tix $69" with one, "Tix free"
//             for a $0 ticket/RSVP.
//
// `at` (the seller the link lands on, e.g. "AXS") stays in the data and
// stays REQUIRED — it is provenance, since a referral wrapper hides the
// seller's domain and a venue's domain is not its name — it is just no
// longer shown; sourceDoor (card-facts.js) folds it into the accessible
// label instead ("Tix $69 — buy tickets at AXS"), which nobody sees. Both
// URLs must be https (the validator refuses anything else). A cancelled show
// keeps its page (what happened, refunds) and loses its tickets. When the
// page IS the ticket page, one door says it. An entry without links has no
// doors, which is every festival grid set.
const httpsUrl = (u) => (typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u) ? u : null);
// The cheapest ticket on file, in Kevin's words: no price → "Tix", $0 → "Tix
// free", a whole dollar amount → "Tix $69" (no decimals, no thousands
// separator). A price shows only with its `checked` date and inside the
// validator's range — the same shape the validator enforces, held here too
// because a phone can render a festival file its cache kept (Sol's review,
// 2026-09-26: a price without its date, or $2001, rendered). Anything else
// falls back to the bare word rather than a number nobody vouched for.
// A real calendar date, the validator's rule: 2026-13-40 is shaped like one
// and is not.
const realDate = (d) => {
  const m = typeof d === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3];
};
const tixWord = ({ price, checked }) => {
  if (!Number.isInteger(price) || price < 0 || price > 2000) return 'Tix';
  if (!realDate(checked)) return 'Tix';
  return price === 0 ? 'Tix free' : `Tix $${price}`;
};
const linkOf = (l, kind, word) => {
  if (!l || typeof l !== 'object' || !httpsUrl(l.url)) return null;
  const at = typeof l.at === 'string' ? l.at.trim() : '';
  if (!at) return null;
  const text = kind === 'tix' ? tixWord(l) : word;
  return { kind, text, url: l.url, at };
};
const sameTarget = (a, b) => {
  try {
    const x = new URL(a), y = new URL(b);
    return x.hostname.replace(/^www\./, '') === y.hostname.replace(/^www\./, '') && x.pathname.replace(/\/$/, '') === y.pathname.replace(/\/$/, '');
  } catch { return false; }
};
export function linksOf(entry, { cancelled = false } = {}) {
  if (!entry) return null;
  const tix = cancelled ? null : linkOf(entry.tickets, 'tix', 'Tix');
  const info = linkOf(entry.page, 'info', 'Info');
  const doors = tix && info && sameTarget(tix.url, info.url) ? [tix] : [tix, info].filter(Boolean);
  return doors.length ? doors : null;
}
