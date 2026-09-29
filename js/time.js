// Time math for festival schedules. Pure functions — covered by tests/time.test.mjs.

// Minutes from midnight; any AM time is treated as "after midnight"
// (festivals here start in the afternoon) so it sorts after PM sets.
export function timeToMinutes(timeStr) {
  const parts = timeStr.trim().split(' ');
  // The validator's TIME_RE is case-insensitive; "9 pm" must not quietly
  // become 9 AM here (Codex gate, 2026-08-27).
  const period = (parts[1] || '').toUpperCase();
  let [hours, minutes] = parts[0].split(':').map(Number);
  minutes = minutes || 0;
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  let total = hours * 60 + minutes;
  if (period === 'AM') total += 24 * 60; // after-midnight
  return total;
}

export function absMinToLabel(absMin) {
  const m = absMin % (24 * 60);
  let h = Math.floor(m / 60);
  const period = h >= 12 ? 'PM' : 'AM';
  let hr = h % 12; if (hr === 0) hr = 12;
  return `${hr}:00 ${period}`;
}

// The festival "day" runs ~9 AM -> 5 AM next morning, so a pre-9 AM time
// reads as after-midnight (sorts to the end), unlike a morning workshop.
export function activityMinutes(timeStr) {
  const parts = timeStr.trim().split(' ');
  let [h, m] = parts[0].split(':').map(Number); m = m || 0;
  const period = (parts[1] || '').toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  let total = h * 60 + m;
  if (total < 9 * 60) total += 24 * 60;
  return total;
}

// A clock time on the grid's axis ("10 PM", "2 AM"), or null when it is not
// one — a day's close is a single time, never a range.
const CLOSE_RE = /^\d{1,2}(:\d{2})? ?(AM|PM)$/i;
const closeMinutes = (s) => (typeof s === 'string' && CLOSE_RE.test(s.trim()) ? timeToMinutes(s.trim().replace(/(\d)(AM|PM)$/i, '$1 $2')) : null);

// Resolve a day's raw {name, stage, time} sets into {name, stage, startStr,
// startMin, endMin, endApprox}. A printed end is the end. A missing end is
// ours, and says so (`endApprox`):
//   - a set with a later set on its stage runs until that one starts
//     (clamped 30..120 min);
//   - a stage's LAST set runs to the day's close when it is in the closing
//     slot — it starts no earlier than every set with a printed end has
//     started, so it is on as the day ends (ACL's headliners print a start
//     only; LEDGER follow-up 20, 2026-09-29). The close is the festival's
//     published one for that day (`close`, dayMeta.<day>.close), which also
//     bounds it; with none, the latest printed end on any stage that day,
//     which is only a floor of the day — it may lengthen the set past the
//     default, never shorten it (ACL's latest printed end is 8:30 PM, at or
//     before every headliner's start);
//   - otherwise 75 min.
export function computeDayArtists(dayData, { close = null } = {}) {
  const raw = dayData.artists.map((a) => {
    let startStr = a.time, endStr = null;
    if (a.time.includes(' - ')) { [startStr, endStr] = a.time.split(' - '); }
    if (endStr && endStr.toLowerCase().trim() === 'close') endStr = null;
    const startMin = timeToMinutes(startStr);
    let endMin = endStr ? timeToMinutes(endStr) : null;
    // The raw `time` and `weekend` ride along: the card's occurrence (the zoom,
    // the sheet header, the route key) is built from them (2026-08-29).
    return { name: a.name, stage: a.stage, startStr: startStr.trim(), endStr: endStr ? endStr.trim() : null, startMin, endMin, endApprox: endMin == null, time: a.time, weekend: a.weekend || null };
  });
  const printed = raw.filter((a) => a.endMin != null);
  const published = closeMinutes(close);
  const latestEnd = printed.length ? Math.max(...printed.map((a) => a.endMin)) : null;
  const lastPrintedStart = printed.length ? Math.max(...printed.map((a) => a.startMin)) : -Infinity;
  const byStage = {};
  raw.forEach((a) => { (byStage[a.stage] = byStage[a.stage] || []).push(a); });
  Object.values(byStage).forEach((list) => {
    list.sort((x, y) => x.startMin - y.startMin);
    list.forEach((a, i) => {
      if (a.endMin != null) return;
      const next = list[i + 1];
      if (next) {
        const gap = next.startMin - a.startMin;
        a.endMin = a.startMin + Math.min(Math.max(gap, 30), 120);
        return;
      }
      const fallback = a.startMin + 75;
      const closing = a.startMin >= lastPrintedStart;
      if (closing && published != null && published > a.startMin) a.endMin = published;
      else if (closing && published == null && latestEnd != null && latestEnd > fallback) a.endMin = latestEnd;
      else a.endMin = fallback;
    });
  });
  return raw;
}

// Whether a set plays the weekend being drawn: untagged (or 'both') sets play
// every weekend; no weekend means no filter (a one-weekend festival).
export const playsWeekend = (a, weekend) => !weekend || !a.weekend || a.weekend === 'both' || a.weekend === weekend;

// One grid day's sets, resolved: the weekend's sets through computeDayArtists
// with the day's published close. The ONE call behind every window a grid
// set has — the wall's cell and its now window (state.getDayArtists), the
// List's rows, Our picks' stops and the Share (plan.js) — so a rule about
// where a set ends moves all of them together.
export function daySetsOf(fest, dayKey, weekend = null) {
  const dayData = ((fest && fest.days) || {})[dayKey] || {};
  const meta = ((fest && fest.dayMeta) || {})[dayKey] || {};
  const sets = (dayData.artists || []).filter((a) => playsWeekend(a, weekend));
  return computeDayArtists({ ...dayData, artists: sets }, { close: meta.close });
}

// A day KEY is frozen pick data (artists[].day) and can be verbose —
// "Wednesday, Sept 16 (Early Arrival Pre-Party)". Every place that shows a
// day (the wall's day rule, the day tab, the day sheet) derives its label
// here, once: the weekday leads, the aside in parentheses becomes a sub
// line, and a comma-clause (a date spelled into the key) yields to dayMeta's
// date. Keys are never rewritten — a rename orphans picks.
export function dayLabelParts(day) {
  const s = String(day || '').trim();
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(s);
  const base = (m ? m[1] : s).trim();
  const aside = m ? m[2].trim() : '';
  const head = (base.split(',')[0] || base).trim() || base;
  return { head, aside };
}
