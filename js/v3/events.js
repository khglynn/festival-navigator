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
import { dayIsoOf, wallClock } from './now.js';

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
// A file's entries by name, in file order, built once per file (the file
// object is replaced whole when it changes). Every card asks for its own
// entry, and a scan of every entry per card is a city season's hundreds
// squared — ~560k name compares a repaint (review, 2026-09-25).
const byNameCache = new WeakMap();
export function entriesNamed(fest, name) {
  if (!fest || typeof fest !== 'object') return [];
  let m = byNameCache.get(fest);
  if (!m) {
    m = new Map();
    for (const a of fest.artists || []) {
      if (!a || typeof a.name !== 'string') continue;
      if (!m.has(a.name)) m.set(a.name, []);
      m.get(a.name).push(a);
    }
    byNameCache.set(fest, m);
  }
  return m.get(name) || [];
}
export function findEventEntry(fest, name, occ) {
  if (!occ || !fest) return null;
  const want = occ.stage || '';
  return entriesNamed(fest, name).find((a) => a && a.name === name
    && sameField(a.day, occ.day)
    && sameField(a.time, occ.time)
    && (occ.date === undefined || sameField(dateOf(a), occ.date))
    && (occ.venue === undefined || sameField(venueOf(a), occ.venue))
    && (occOf(a).stage || '') === want) || null;
}


// ---- a city season (2026-09-25) -----------------------------------------------------
// claude-plans/2026-09-25-season-v0/. A season is a festival-shaped file with
// no grid: every show is an artists[] entry whose `day` is its month
// ("December"), with a `date` and a `venue` (festival-rules.mjs insists on
// both). Kevin, 2026-09-24: "a simple set of cards, sorted by date and time
// but just a responsive set of cards with details like location on hover. …
// I don't think splitting by name and location in the grid is necessary. if
// anything just do by weekend." So a month is the lineup view — one set of
// cards in date and time order — cut into weeks, and nothing is split by
// location.
//
// WHAT SHOWS: from today on. A month is a tab while it has a show dated today
// or later, and the days before today go the way a finished month does. The
// file keeps every show (a name is a pick key and never disappears); only the
// view lets go of what is over. Past days kept in would have landed the
// month's tab on its first, finished week all month long.
export const isSeason = (fest) => !!fest && fest.kind === 'season';
// A season's description line (Kevin, 2026-09-25: "In that top description
// line, we have when it was last updated"): its window, then when the feed
// last read it — "Dec 2026 – Feb 2027 · updated Sep 25", "… · updated today",
// "… · updated yesterday". ONE builder for every place a season describes
// itself (the wall header, the Settings card, the Settings and add-a-fest
// rows, the landing row), from a file or an index row alike. Today is read in
// the season's own zone where the file says it (an index row does not; the
// phone's day is right but for the hours around midnight). A season that is
// over says its window alone: nobody reads it any more.
export function seasonUpdated(meta, now = new Date()) {
  if (!meta || typeof meta.updated !== 'string' || !ISO_RE.test(meta.updated) || meta.status === 'archived') return '';
  const today = festivalClockDay(now, meta.timezone || null);
  if (meta.updated === today) return 'updated today';
  if (meta.updated === isoPlusDays(today, -1)) return 'updated yesterday';
  const year = meta.updated.slice(0, 4);
  return `updated ${shortDate(meta.updated)}${year !== today.slice(0, 4) ? `, ${year}` : ''}`;
}
export function seasonLine(meta, now = new Date()) {
  if (!meta) return '';
  return [meta.dates, seasonUpdated(meta, now)].filter(Boolean).join(' · ');
}
// ---- which seasons a list shows (Kevin, 2026-09-25) ----------------------------------
// "we can show in the app just the next two seasons - we can have the others
// tucked away." A city is a run of seasons (austin-fall-2026, -winter-2027 …),
// each a festival entry with a window. A season whose window is over is past,
// like a festival that happened — archived by the feed, or over by the
// calendar before the feed has run. Of the rest, the two soonest (the one in
// progress and the one after it: Fall and Winter on Sep 25, Winter and Spring
// from Dec 1) lead; the others are tucked behind one quiet row — except one a
// crew already has something in, which a renderer keeps out (it is theirs).
// Read off each row's window against the city's today, never off its id.
export const seasonIsOver = (row, today) => !!row && row.kind === 'season'
  && (row.status === 'archived' || (typeof row.endsOn === 'string' && ISO_RE.test(row.endsOn) && row.endsOn < today));
export function cityToday(rows, now = new Date()) {
  const tz = ((rows || []).find((r) => r && r.kind === 'season' && r.timezone) || {}).timezone || null;
  return festivalClockDay(now, tz);
}
export function seasonLead(rows, now = new Date()) {
  const today = cityToday(rows, now);
  const live = (rows || []).filter((r) => r && r.kind === 'season' && !seasonIsOver(r, today))
    .sort((a, b) => String(a.startsOn || '').localeCompare(String(b.startsOn || '')) || String(a.id).localeCompare(String(b.id)));
  return { today, lead: new Set(live.slice(0, 2).map((r) => r.id)) };
}
// A list split for its shelf: the items a person sees (every non-season item,
// the lead seasons, and any season `kept` says is theirs), and the seasons
// tucked behind "Later seasons". Order is kept; `idOf` reads an item's id and
// `isSeasonItem` says whether it is a live season at all.
export function shelfSeasons(items, { lead, idOf = (x) => x.id, isSeasonItem, kept = () => false }) {
  const shown = [];
  const later = [];
  for (const it of items || []) {
    if (!isSeasonItem(it) || lead.has(idOf(it)) || kept(it)) shown.push(it);
    else later.push(it);
  }
  return { shown, later };
}
// The calendar day it is in a zone — midnight to midnight, not the wall's
// 5 AM festival day: "updated today" is about the calendar.
function festivalClockDay(now, timeZone) {
  const p = wallClock(now, timeZone);
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}
// A show no source lists any more (the feed marks it `unlisted: <date>` and
// keeps the entry, because its name is a pick key). It is not on the wall,
// not in YOURS, not in a count and not "also" anywhere: a moved show would
// otherwise stand twice, at its old date and its new one.
export const isUnlisted = (e) => !!(e && e.unlisted);

const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// The Monday on or before a date: a week on the season wall runs Monday to
// Sunday, so its weekend closes it.
export function mondayOf(iso) {
  const wd = weekdayOfIso(iso);
  return wd ? isoPlusDays(iso, -WEEKDAYS.indexOf(wd)) : null;
}
const monthStart = (iso) => `${String(iso).slice(0, 7)}-01`;
function monthEnd(iso) {
  const [y, m] = String(iso).split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(iso).slice(0, 7)}-${String(last).padStart(2, '0')}`;
}
// When a show starts on its date, for the order: its posted start, else its
// doors, else it goes after the timed ones. The festival-day axis (9 AM
// starts the day) is the right one here too: a 1 AM set is the night before's.
const clockOf = (e) => {
  const t = parseEventTime(e.time) || parseEventTime(e.doors);
  return t ? t.startMin : Infinity;
};

// What the resting card says under the name: the date, and the start when the
// show has posted one — "Fri · Oct 9 · 8 PM". Doors, the location and the
// links are the zoom's (card-facts.js factsFor reads the same entry). A
// cancelled show says so first, the way the zoom's WHEN does.
export function seasonWhen(e) {
  const iso = dateOf(e);
  const date = iso ? shortDateLabel(iso) : '';
  if (isCancelled(e)) return ['Cancelled', date].filter(Boolean).join(' · ');
  const t = parseEventTime(e.time);
  return [date, t ? tilde(e, t.startStr) : null].filter(Boolean).join(' · ');
}

// The season's wall, as data. `today` is the festival's own calendar day
// (now.js festivalClock in the file's timezone). `isYours` (name → bool) is
// null for someone who has not connected Spotify: then there is no YOURS at
// all (Kevin, 2026-09-25: "yours tab is good but just plan to not show if
// they don't have spotify"). `only` narrows the shows (a search).
//
// Returns:
//   months  [{ key, short, long, num, count, weeks }] in calendar order — `key`
//           is the month label the file wrote (the tab and jump id; never
//           parsed), `short`/`long` what the tabs say, read off the dates,
//           `num` the year a dock tab wears when two months share three
//           letters, `count` the shows still on (a cancelled one is on the
//           wall, not on; an unlisted one is not on the wall at all);
//   weeks   [{ key, monday, from, to, when, entries }] — Monday to Sunday,
//           clamped to the month so a week never names another tab's dates,
//           and to today so this week never names days the wall has let go;
//           `when` is 'this' / 'next' for the week today is in and the one
//           after; entries by date, then start, then file order, a cancelled
//           show last in its week (as it is last in any list);
//   yours   the shows by an artist that is yours, soonest first — never a
//           cancelled one (YOURS is what you can go to) — or null.
export function seasonModelOf(fest, { today, isYours = null, only = null, hidden = null } = {}) {
  const on = [];
  ((fest && fest.artists) || []).forEach((e, i) => {
    const iso = dateOf(e);
    if (!e || typeof e.name !== 'string' || !iso || iso < today || isUnlisted(e)) return;
    // A location the show menu has unticked takes its shows off the wall —
    // the months, YOURS and a search alike (viewer-side, like every fold).
    if (hidden && hidden.size && hidden.has(venueOf(e))) return;
    if (only && !only(e)) return;
    on.push({ e, i, iso, at: clockOf(e) });
  });
  const byTime = (a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0) || a.at - b.at || a.i - b.i;
  on.sort(byTime);
  const thisMonday = mondayOf(today);
  const nextMonday = thisMonday ? isoPlusDays(thisMonday, 7) : null;
  const todayYear = String(today).slice(0, 4);
  const months = new Map();
  for (const s of on) {
    // The month label the file wrote is the tab (and the section key a note
    // or a pick could ever hang off); one it forgot is read off the date.
    // The label is only ever a KEY: a month a year or more out carries its
    // year ("September 2027", the feed's monthOf), and what a tab says comes
    // from the dates below, never from parsing the label.
    const key = typeof s.e.day === 'string' && s.e.day.trim() ? s.e.day.trim() : `${MONTH_LONG[Number(s.iso.slice(5, 7)) - 1]} ${s.iso.slice(0, 4)}`;
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(s);
  }
  const out = [...months].map(([key, shows]) => {
    const weeks = new Map();
    for (const s of shows) {
      const monday = mondayOf(s.iso);
      if (!weeks.has(monday)) weeks.set(monday, []);
      weeks.get(monday).push(s);
    }
    const year = shows[0].iso.slice(0, 4);
    const m = Number(shows[0].iso.slice(5, 7)) - 1;
    return {
      key,
      // What the tabs say, from the month's own dates: "OCT" in the dock, and
      // on the rail "JANUARY ’27" for a month in another year than today's.
      short: MONTHS[m].toUpperCase(),
      long: `${MONTH_LONG[m].toUpperCase()}${year !== todayYear ? ` \u2019${year.slice(2)}` : ''}`,
      year,
      count: shows.filter((s) => !isCancelled(s.e)).length,
      first: shows[0].iso,
      weeks: [...weeks].map(([monday, list]) => {
        const first = list[0].iso;
        // The week as the wall shows it: from its Monday, or the month's
        // first, or today — whichever is latest, since nothing before today
        // is on the wall (`SEP 25 – 27  THIS WEEK` on a Friday).
        const from = [monday, monthStart(first), today].reduce((a, b) => (b > a ? b : a));
        const sunday = isoPlusDays(monday, 6);
        const to = sunday > monthEnd(first) ? monthEnd(first) : sunday;
        return {
          key: monday,
          monday,
          from,
          to,
          when: monday === thisMonday ? 'this' : monday === nextMonday ? 'next' : null,
          entries: [...list.filter((s) => !isCancelled(s.e)), ...list.filter((s) => isCancelled(s.e))].map((s) => s.e),
        };
      }),
    };
  }).sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : 0));
  // Two tabs the dock would call "SEP" (this September and next) wear their
  // year's two digits as the dock tab's small number: SEP · SEP 27.
  for (const mo of out) {
    if (out.some((o) => o !== mo && o.short === mo.short) && mo.year !== todayYear) mo.num = `\u2019${mo.year.slice(2)}`;
  }
  const yours = isYours ? on.filter((s) => !isCancelled(s.e) && isYours(s.e.name)).map((s) => s.e) : null;
  return { months: out, yours, today };
}
// The season's locations and how many shows each has from today on, busiest
// first (people have home rooms, and the big rooms are the ones most people
// mean), then by name — the show menu's list ("64 of 69 locations"; Kevin,
// 2026-09-24: "Let's call this location … in pretty much every context").
export function seasonLocationsOf(fest, { today } = {}) {
  const counts = new Map();
  for (const e of (fest && fest.artists) || []) {
    const iso = dateOf(e);
    const venue = venueOf(e);
    if (!e || !iso || iso < today || !venue || isUnlisted(e)) continue;
    // A room whose only show was called off is still on the wall (struck
    // through), so it is still a row to untick; it counts nothing that is on.
    counts.set(venue, (counts.get(venue) || 0) + (isCancelled(e) ? 0 : 1));
  }
  return [...counts].map(([venue, count]) => ({ venue, count }))
    .sort((a, b) => b.count - a.count || a.venue.localeCompare(b.venue));
}

// A week's head, said the way the room heads say a day: the month in the
// quiet weight, then the dates — `OCT 5 – 11`, `NOV 1` for a week the month
// cuts to one day.
export function weekHeadOf(week) {
  const month = MONTHS[Number(String(week.from).slice(5, 7)) - 1] || '';
  const a = dayOfMonth(week.from);
  const b = dayOfMonth(week.to);
  return { wd: month.toUpperCase(), label: a === b ? a : `${a} – ${b}` };
}

// ---- A show's doors out: its page and its tickets (Kevin, 2026-09-24) ------------
// "when it's afters or shows like this I naturally want to click through to
// the event page. we have tix but do those always have details… and what
// about before tix are available." So a show that is not the festival's own
// set can carry two links, each `{ url, at }`, and the zoom says each in
// Kevin's words ("For all of these lets do 'Tixs @ [location]' - tigher and
// clearer"):
//
//   `page`    the show's own page for people — details, the whole bill, and
//             the one place to look before tickets exist: "Info @ DoTheBay".
//   `tickets` the buy link exactly as the listing printed it (a referral tag
//             stays: it pays the small company that listed the show) and the
//             seller it lands on: "Tix @ AXS".
//
// `at` is data, never parsed from the URL at render: a referral wrapper hides
// the seller's domain, and a venue's domain is not its name. Both URLs must
// be https (the validator refuses anything else). A cancelled show keeps its
// page (what happened, refunds) and loses its tickets. When the page IS the
// ticket page, one door says it. An entry without links has no doors, which
// is every festival grid set.
const httpsUrl = (u) => (typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u) ? u : null);
const linkOf = (l, kind, word) => {
  if (!l || typeof l !== 'object' || !httpsUrl(l.url)) return null;
  const at = typeof l.at === 'string' ? l.at.trim() : '';
  return at ? { kind, text: `${word} @ ${at}`, url: l.url } : null;
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
