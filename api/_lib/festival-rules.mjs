// The festival-document rules, as a pure module — the SINGLE source of truth
// consumed by BOTH scripts/validate-festivals.mjs (CI) and api/festival-add.js
// (LLM-researched candidates). If a rule changes, it changes here once.
import { timeToMinutes } from '../../js/time.js';
import { safeKey, FORBIDDEN_KEYS } from './crew-shared.mjs';

export const SLUG_RE = /^[a-z0-9-]{1,64}$/;
export const ACCENT_RE = /^\d{1,3}, \d{1,3}, \d{1,3}$/;
export const STATUSES = ['lineup', 'scheduled', 'archived'];
export const TIME_RE = /^\d{1,2}(:\d{2})? (AM|PM)( - (\d{1,2}(:\d{2})? (AM|PM)|Close))?$/i;

// Validate one festival document. `filename` is optional (CI passes it to
// enforce filename-matches-id; API candidates have no file).
export function validateFestivalDoc(fest, { filename } = {}) {
  const errors = [];
  const warnings = [];
  const err = (msg) => errors.push(msg);
  const warn = (msg) => warnings.push(msg);

  if (!fest || typeof fest !== 'object' || Array.isArray(fest)) {
    return { errors: ['festival must be an object'], warnings };
  }
  // FORBIDDEN_KEYS too: 'constructor' is all-lowercase and passes the slug
  // regex, but a festival id becomes an object key in every crew doc that
  // picks in it — the one namespace that must never carry a prototype key.
  if (!fest.id || !SLUG_RE.test(fest.id) || FORBIDDEN_KEYS.has(fest.id)) err(`bad id ${JSON.stringify(fest.id)}`);
  if (filename && filename !== `${fest.id}.json`) err(`filename must match id (${fest.id}.json)`);
  if (!fest.name) err('missing name');
  // Length caps on free-text fields — LLM-researched candidates flow through
  // here too, and unbounded strings are a doc-bloat / UI-overflow vector.
  for (const [k, cap] of [['name', 80], ['year', 8], ['subtitle', 120], ['location', 80], ['dates', 200], ['accent', 20]]) {
    if (fest[k] !== undefined && (typeof fest[k] !== 'string' || fest[k].length > cap)) err(`${k} must be a string of at most ${cap} chars`);
  }
  if (!STATUSES.includes(fest.status)) err(`status must be one of ${STATUSES.join('|')}`);
  if (fest.accent && !ACCENT_RE.test(fest.accent)) err(`accent must be "R, G, B" (got ${safeKey(fest.accent)})`);
  if (!Array.isArray(fest.artists)) err('artists[] must be an array');
  else if (fest.artists.length === 0) {
    if (fest.status === 'lineup') warn('empty lineup (festival announced but no artists yet)');
    else err(`artists[] must be non-empty for status=${fest.status}`);
  }

  // Archived fests are the crew's memories — a memory without a date rots
  // into "which year was that?" (ST-6).
  if (fest.status === 'archived') {
    for (const k of ['year', 'dates']) {
      if (!fest[k]) warn(`archived festival missing ${k} — memories need dates`);
    }
  }

  // No comma in the separator set — commas live inside single-day labels
  // ("Wednesday, Sept 16 (pre-party)"); combinations use & / + / "and".
  const knownDays = new Set(
    (Array.isArray(fest.artists) ? fest.artists : [])
      .map((a) => a && a.day)
      .filter((d) => typeof d === 'string' && !/[&+/]|\s+and\s+/i.test(d)),
  );
  // name -> Set of day strings seen. A same-name entry on a DIFFERENT day is
  // a real reappearance (a lineup artist playing an afters/Folsom show) —
  // picks/auras/notes unify by exact name on purpose. The warning stays for
  // true dupes: same day, or no day to tell the two apart.
  const artistNames = new Map();
  (Array.isArray(fest.artists) ? fest.artists : []).forEach((a, i) => {
    if (!a || !a.name || typeof a.name !== 'string') err(`artists[${i}]: missing name`);
    else if (a.name.length > 100) err(`artists[${i}]: name over 100 chars`);
    else {
      const key = a.name.toUpperCase();
      const dayStr = typeof a.day === 'string' ? a.day : '';
      const seen = artistNames.get(key);
      if (seen && (!dayStr || seen.has(dayStr) || seen.has(''))) {
        warn(`duplicate artist in artists[]: ${a.name}${dayStr ? ` (day ${JSON.stringify(dayStr)})` : ''}`);
      }
      if (seen) seen.add(dayStr);
      else artistNames.set(key, new Set([dayStr]));
    }
    if (a && a.time && !TIME_RE.test(a.time)) err(`artists[${i}] (${safeKey(a.name)}): unparseable time ${JSON.stringify(safeKey(a.time))}`);
    if (a && a.weekends && !['W1', 'W2', 'both'].includes(a.weekends)) err(`artists[${i}] (${safeKey(a.name)}): weekends must be W1|W2|both`);
    // Combined day strings ("Saturday & Sunday") render split (ST-1) — but
    // only when every part matches a real day; flag the ones that won't.
    if (a && typeof a.day === 'string' && /[&+/]|\s+and\s+/i.test(a.day)) {
      const parts = a.day.split(/\s*[&+/]\s*|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
      if (!parts.every((p) => [...knownDays].some((d) => d.toLowerCase() === p.toLowerCase()))) {
        warn(`artists[${i}] (${safeKey(a.name)}): combined day ${JSON.stringify(safeKey(a.day))} has parts that match no known day — it will render as a literal section`);
      }
    }
  });

  if (fest.status === 'scheduled' && (!fest.days || Object.keys(fest.days).length === 0)) {
    err('scheduled festival needs days{}');
    return { errors, warnings };
  }
  // The renderer keys on days{} PRESENCE, not on status — so the grid rules
  // run for any live fest that carries a grid. Archived fests are memories;
  // their grids are not re-litigated.
  if (fest.days && fest.status !== 'archived') {
    // Exact bytes, on purpose: picks, auras and notes are keyed by the
    // artists[] name and lookups do no case folding (docs/add-a-festival.md).
    // A grid entry that matches the lineup only case-insensitively is the
    // worst kind of typo — the card renders, the tap "works", and the pick
    // lands on a key nobody else's device shares.
    const lineupExact = new Set((Array.isArray(fest.artists) ? fest.artists : []).map((a) => a && a.name).filter(Boolean));
    const gridNamesByDay = {};
    for (const [label, day] of Object.entries(fest.days)) {
      gridNamesByDay[label] = new Set();
      if (!Array.isArray(day.stages) || !day.stages.length) err(`${label}: missing stages[]`);
      if (!Array.isArray(day.artists) || !day.artists.length) { err(`${label}: missing artists[]`); continue; }
      day.artists.forEach((a, i) => {
        if (!a.name) err(`${label}.artists[${i}]: missing name`);
        // Two-weekend fests tag sets with the weekend they play; untagged or
        // 'both' plays every weekend. Day KEYS stay the plain weekdays — day
        // notes are keyed by day label, and renamed keys strand them.
        if (a.weekend && !['W1', 'W2', 'both'].includes(a.weekend)) err(`${safeKey(label)}.artists[${i}] (${safeKey(a.name)}): weekend must be W1|W2|both`);
        if (!a.stage) err(`${safeKey(label)}.artists[${i}] (${safeKey(a.name)}): missing stage`);
        else if (!day.stages.includes(a.stage)) err(`${safeKey(label)}.artists[${i}] (${safeKey(a.name)}): stage ${JSON.stringify(safeKey(a.stage))} not in day stages`);
        if (!a.time || !TIME_RE.test(a.time)) err(`${safeKey(label)}.artists[${i}] (${safeKey(a.name)}): bad time ${JSON.stringify(safeKey(a.time))}`);
        else { try { timeToMinutes(a.time.split(' - ')[0]); } catch { err(`${label}.artists[${i}]: time did not parse`); } }
        if (a.name) {
          gridNamesByDay[label].add(a.name);
          if (!lineupExact.has(a.name)) {
            if (artistNames.has(a.name.toUpperCase())) err(`${safeKey(label)}: ${safeKey(a.name)} differs from its artists[] spelling by case — picks key on exact bytes, so this would split the crew's picks`);
            else err(`${safeKey(label)}: ${safeKey(a.name)} plays but is missing from artists[]`);
          }
        }
      });
      // One stage, one act at a time. Two sets with explicit ends that overlap
      // on the same stage (and a compatible weekend) are a transcription error
      // — the poster can't print that, so the file mustn't either. Untimed
      // ends are filled by the renderer and are not judged here.
      const timed = day.artists
        .filter((a) => a.name && a.stage && typeof a.time === 'string' && TIME_RE.test(a.time) && a.time.includes(' - ') && !/close$/i.test(a.time))
        .map((a) => {
          const [s, e] = a.time.split(' - ');
          return { name: a.name, stage: a.stage, time: a.time, weekend: a.weekend || 'both', start: timeToMinutes(s), end: timeToMinutes(e) };
        });
      const sameWeekend = (x, y) => x.weekend === 'both' || y.weekend === 'both' || x.weekend === y.weekend;
      for (let x = 0; x < timed.length; x++) {
        const a = timed[x];
        if (a.end <= a.start) err(`${safeKey(label)}: ${safeKey(a.name)} ends before it starts (${safeKey(a.time)})`);
        for (let y = x + 1; y < timed.length; y++) {
          const b = timed[y];
          if (a.stage !== b.stage || !sameWeekend(a, b)) continue;
          if (a.start < b.end && b.start < a.end) err(`${safeKey(label)}: ${safeKey(a.name)} and ${safeKey(b.name)} overlap on ${safeKey(a.stage)}`);
        }
      }
      if (fest.dayMeta && !fest.dayMeta[label]) warn(`dayMeta missing entry for ${label}`);
    }
    // The other direction: a lineup artist billed on a grid day with no set
    // on that grid is invisible on the timetable. Usually a missed box —
    // warn, don't block (partial drops are real).
    (Array.isArray(fest.artists) ? fest.artists : []).forEach((a) => {
      if (!a || !a.name || typeof a.day !== 'string') return;
      const parts = a.day.split(/\s*[&+/]\s*|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        const dayKey = Object.keys(fest.days).find((d) => d.toLowerCase() === part.toLowerCase());
        if (dayKey && !gridNamesByDay[dayKey].has(a.name)) warn(`${safeKey(a.name)} is billed on ${safeKey(dayKey)} but has no set on that day's grid`);
      }
    });
  }

  if (fest.activities) {
    for (const [label, list] of Object.entries(fest.activities)) {
      if (!Array.isArray(list)) { err(`activities.${label} must be an array`); continue; }
      list.forEach((a, i) => {
        if (!a.name || !a.time || !a.venue) err(`activities.${label}[${i}]: needs name, time, venue`);
        // The everything-else column sorts by parsed time — a free-text time
        // would scramble it silently (audit 12.4).
        else if (!TIME_RE.test(a.time)) err(`activities.${safeKey(label)}[${i}] (${safeKey(a.name)}): unparseable time ${JSON.stringify(safeKey(a.time))}`);
      });
    }
  }

  // Day labels render in the day-rule strip designed for weekday-length text;
  // sentence-length labels wrap it to three lines (audit 12.5).
  (Array.isArray(fest.artists) ? fest.artists : []).forEach((a, i) => {
    if (a && typeof a.day === 'string' && a.day.length > 48) {
      warn(`artists[${i}] (${safeKey(a.name)}): day label is ${a.day.length} chars — day-rule strips are designed for short labels`);
    }
  });

  return { errors, warnings };
}
