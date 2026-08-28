// The festival-document rules, as a pure module — the SINGLE source of truth
// consumed by BOTH scripts/validate-festivals.mjs (CI) and api/festival-add.js
// (LLM-researched candidates). If a rule changes, it changes here once.
import { timeToMinutes, computeDayArtists } from '../../js/time.js';
import { safeKey, FORBIDDEN_KEYS } from './crew-shared.mjs';

export const SLUG_RE = /^[a-z0-9-]{1,64}$/;
export const ACCENT_RE = /^\d{1,3}, \d{1,3}, \d{1,3}$/;
export const STATUSES = ['lineup', 'scheduled', 'archived'];
// A clock time: 1–12 hours, 00–59 minutes. "13:00 PM" and "99:59 PM" used to
// pass the old \d{1,2} shape and parse into nonsense minutes (Codex gate,
// 2026-08-27).
const CLOCK = '(1[0-2]|0?[1-9])(:[0-5][0-9])? (AM|PM)';
export const TIME_RE = new RegExp(`^${CLOCK}( - (${CLOCK}|Close))?$`, 'i');

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
  const knownLower = new Set([...knownDays].map((d) => d.toLowerCase()));
  const renderedDays = (dayStr) => {
    if (!dayStr) return [''];
    const split = dayStr.split(/\s*[&+/]\s*|\s+and\s+/i).map((s) => s.trim().toLowerCase()).filter(Boolean);
    return split.length > 1 && split.every((p) => knownLower.has(p)) ? split : [dayStr.trim().toLowerCase()];
  };
  const artistNames = new Map();
  (Array.isArray(fest.artists) ? fest.artists : []).forEach((a, i) => {
    if (!a || !a.name || typeof a.name !== 'string') err(`artists[${i}]: missing name`);
    else if (a.name.length > 100) err(`artists[${i}]: name over 100 chars`);
    else {
      const key = a.name.toUpperCase();
      const dayStr = typeof a.day === 'string' ? a.day : '';
      // Compare RENDERED days, not raw labels: "Saturday & Sunday" splits into
      // a card per day, so a second "Saturday" entry for the same name is a
      // dupe on the Saturday wall even though the strings differ. Split
      // exactly as the renderer does (wall.js splitDays): only when EVERY part
      // is a known day — otherwise the label stays one literal section. No
      // day at all collides with everything.
      const parts = renderedDays(dayStr);
      const seen = artistNames.get(key);
      if (seen && seen.some((prev) => prev.includes('') || parts.includes('') || prev.some((p) => parts.includes(p)))) {
        warn(`duplicate artist in artists[]: ${a.name}${dayStr ? ` (day ${JSON.stringify(dayStr)})` : ''}`);
      }
      if (seen) seen.push(parts);
      else artistNames.set(key, [parts]);
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

  const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  // days{} is an object keyed by day label. An array or a scalar here used to
  // sail through (nothing iterated), and a null day entry threw — which
  // api/festival-add.js turned into a 500 instead of a rejection.
  if (fest.days !== undefined && !isPlain(fest.days)) {
    err('days must be an object keyed by day label');
    return { errors, warnings };
  }
  if (fest.status === 'scheduled' && (!fest.days || Object.keys(fest.days).length === 0)) {
    err('scheduled festival needs days{}');
    return { errors, warnings };
  }
  // The renderer keys on days{} PRESENCE, not on status — so the structural
  // rules run for ANY grid. Archived fests are memories: their grid names are
  // the keys the crew's picks already live under, so a spelling mismatch
  // there is reported but never enforced (correcting it would orphan the
  // picks), and schedule-quality checks skip them.
  if (fest.days) {
    const live = fest.status !== 'archived';
    // Exact bytes, on purpose: picks, auras and notes are keyed by the
    // artists[] name and lookups do no case folding (docs/add-a-festival.md).
    // A grid entry that matches the lineup only case-insensitively is the
    // worst kind of typo — the card renders, the tap "works", and the pick
    // lands on a key nobody else's device shares.
    const lineupExact = new Set((Array.isArray(fest.artists) ? fest.artists : []).map((a) => a && a.name).filter(Boolean));
    const gridNamesByDay = {};
    for (const [label, day] of Object.entries(fest.days)) {
      gridNamesByDay[label] = new Set();
      if (!isPlain(day)) { err(`${safeKey(label)}: must be an object with stages[] and artists[]`); continue; }
      // stages must be a real array — `{}` or `7` is diagnosed AND must not
      // reach .includes() below (a throw here is a 500 for an API candidate).
      const stages = Array.isArray(day.stages) ? day.stages : [];
      if (!stages.length) err(`${safeKey(label)}: missing stages[]`);
      if (!Array.isArray(day.artists) || !day.artists.length) { err(`${safeKey(label)}: missing artists[]`); continue; }
      day.artists.forEach((a, i) => {
        if (!isPlain(a)) { err(`${safeKey(label)}.artists[${i}]: must be an object`); return; }
        if (!a.name) err(`${safeKey(label)}.artists[${i}]: missing name`);
        // Two-weekend fests tag sets with the weekend they play; untagged or
        // 'both' plays every weekend. Day KEYS stay the plain weekdays — day
        // notes are keyed by day label, and renamed keys strand them.
        if (a.weekend && !['W1', 'W2', 'both'].includes(a.weekend)) err(`${safeKey(label)}.artists[${i}] (${safeKey(a.name)}): weekend must be W1|W2|both`);
        if (!a.stage) err(`${safeKey(label)}.artists[${i}] (${safeKey(a.name)}): missing stage`);
        else if (!stages.includes(a.stage)) err(`${safeKey(label)}.artists[${i}] (${safeKey(a.name)}): stage ${JSON.stringify(safeKey(a.stage))} not in day stages`);
        if (!a.time || !TIME_RE.test(a.time)) err(`${safeKey(label)}.artists[${i}] (${safeKey(a.name)}): bad time ${JSON.stringify(safeKey(a.time))}`);
        else { try { timeToMinutes(a.time.split(' - ')[0]); } catch { err(`${safeKey(label)}.artists[${i}]: time did not parse`); } }
        if (a.name && typeof a.name === 'string') {
          gridNamesByDay[label].add(a.name);
          if (!lineupExact.has(a.name)) {
            const report = live ? err : warn;
            if (artistNames.has(a.name.toUpperCase())) report(`${safeKey(label)}: ${safeKey(a.name)} differs from its artists[] spelling by case — picks key on exact bytes, so this would split the crew's picks`);
            else report(`${safeKey(label)}: ${safeKey(a.name)} plays but is missing from artists[]`);
          }
        }
      });
      if (live) {
        const wellFormed = day.artists.filter((a) => isPlain(a) && a.name && a.stage && typeof a.time === 'string' && TIME_RE.test(a.time));
        for (const a of wellFormed) {
          if (!a.time.includes(' - ') || /close$/i.test(a.time)) continue;
          const [s, e] = a.time.split(' - ');
          if (timeToMinutes(e) <= timeToMinutes(s)) err(`${safeKey(label)}: ${safeKey(a.name)} ends before it starts (${safeKey(a.time)})`);
        }
        // One stage, one act at a time — judged on the spans the RENDERER
        // resolves (a missing end is filled from the next set on that stage,
        // so two point-times on one stage still collide), per weekend so W1
        // and W2 sets on the same stage are not each other's clash. A warning,
        // not an error: archived Lollapalooza carries two genuine simultaneous
        // listings, so the poster CAN print it — but on a fresh transcription
        // it is nearly always a slipped box, and the Portola test holds that
        // file to zero warnings.
        const tags = new Set(wellFormed.map((a) => a.weekend).filter((w) => w === 'W1' || w === 'W2'));
        const views = tags.size ? [...tags] : [null];
        const flagged = new Set();
        for (const wk of views) {
          const subset = wellFormed.filter((a) => !wk || !a.weekend || a.weekend === 'both' || a.weekend === wk);
          let resolved;
          try { resolved = computeDayArtists({ artists: subset }); } catch { continue; }
          for (let x = 0; x < resolved.length; x++) {
            for (let y = x + 1; y < resolved.length; y++) {
              const a = resolved[x], b = resolved[y];
              if (a.stage !== b.stage || !(a.startMin < b.endMin && b.startMin < a.endMin)) continue;
              const k = `${a.stage}|${[a.name, b.name].sort().join('|')}`;
              if (flagged.has(k)) continue;
              flagged.add(k);
              warn(`${safeKey(label)}: ${safeKey(a.name)} and ${safeKey(b.name)} overlap on ${safeKey(a.stage)} — two acts on one stage at once is usually a slipped box`);
            }
          }
        }
      }
      if (fest.dayMeta && !fest.dayMeta[label]) warn(`dayMeta missing entry for ${label}`);
    }
    // The other direction: a lineup artist billed on a grid day with no set
    // on that grid is invisible on the timetable. Usually a missed box —
    // warn, don't block (partial drops are real). Live fests only.
    if (live) {
      (Array.isArray(fest.artists) ? fest.artists : []).forEach((a) => {
        if (!a || !a.name || typeof a.day !== 'string') return;
        const parts = a.day.split(/\s*[&+/]\s*|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
        for (const part of parts) {
          const dayKey = Object.keys(fest.days).find((d) => d.toLowerCase() === part.toLowerCase());
          if (dayKey && gridNamesByDay[dayKey] && !gridNamesByDay[dayKey].has(a.name)) warn(`${safeKey(a.name)} is billed on ${safeKey(dayKey)} but has no set on that day's grid`);
        }
      });
    }
  }

  // dayMeta dates: `iso` (single weekend) or `isos: {W1, W2}` (two weekends)
  // give a grid day its calendar date — what the "now" line and the day-of
  // auto-scroll key on. Optional, but when present it must be a real date:
  // a typo here would put the now line on the wrong day, silently.
  if (fest.dayMeta !== undefined && !isPlain(fest.dayMeta)) err('dayMeta must be an object keyed by day label');
  else if (fest.dayMeta) {
    const realDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
      && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
    for (const [label, meta] of Object.entries(fest.dayMeta)) {
      if (!isPlain(meta)) { err(`dayMeta.${safeKey(label)}: must be an object`); continue; }
      if (meta.iso !== undefined && !realDate(meta.iso)) err(`dayMeta.${safeKey(label)}.iso must be a real YYYY-MM-DD date`);
      if (meta.isos !== undefined) {
        if (!isPlain(meta.isos)) err(`dayMeta.${safeKey(label)}.isos must be {W1, W2}`);
        else for (const [wk, v] of Object.entries(meta.isos)) {
          if (!['W1', 'W2'].includes(wk)) err(`dayMeta.${safeKey(label)}.isos: unknown weekend ${safeKey(wk)}`);
          else if (!realDate(v)) err(`dayMeta.${safeKey(label)}.isos.${wk} must be a real YYYY-MM-DD date`);
        }
      }
    }
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
