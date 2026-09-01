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

// ---------------------------------------------------------------------------
// Structured event fields (MODEL-V3 §1 and §5, added 2026-09-01).
//
// An artists[] EVENT entry (an afters or Folsom show) has always carried its
// room as a single string: `stage: "Sun · The Midway"`, which js/v3/wall.js
// splits on ' · ' to draw the card's sub-label. Phase 1 of the events build
// adds the split out as data — `night` + `venue` — so the day-first renderer
// can group by night and column by venue without re-parsing prose.
//
// That makes the pair a DENORMALIZATION, and the rule with teeth is therefore
// not "are they well-formed" but "do they still agree with `stage`". While
// both exist, drift is the whole risk: `stage` is what ships today, the pair
// is what phase 2 reads, and a file where they disagree renders one thing and
// plans another. Disagreement is an ERROR.
//
// `night` is checked against the weekday vocabulary, not against the fest's
// own days: a fest's event nights routinely fall OUTSIDE its grid (Portola
// plays Sat–Sun and its afters run Thu–Sun), and the only machine-readable
// day set — dayMeta — covers grid days only. A section's dates live in free
// text ("Sep 24-27"), which is not something to parse into a rule. The
// vocabulary check still catches what matters: phase 2 derives the day tabs
// from the union of grid days and event nights, so "Sunday" or "sun" where
// "Sun" belongs would mint a phantom tab.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// doors/close are a single point on the clock, never a range.
const CLOCK_RE = new RegExp(`^${CLOCK}$`, 'i');
const startOf = (t) => String(t).split(' - ')[0];

function checkEventFields(fest, err, warn) {
  const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const artists = Array.isArray(fest.artists) ? fest.artists : [];
  const venueMap = plain(fest.venues) ? fest.venues : null;
  // Runs are grouped by the room they happen in: one day, one night, one
  // venue. Nothing in the file declares a run — the grouping IS the run.
  const runs = new Map();

  artists.forEach((a, i) => {
    if (!plain(a)) return;
    const at = `artists[${i}] (${safeKey(a.name)})`;
    const bits = typeof a.stage === 'string' && a.stage.includes(' · ') ? a.stage.split(' · ') : null;

    if (a.night !== undefined) {
      if (!WEEKDAYS.includes(a.night)) err(`${at}: night must be one of ${WEEKDAYS.join('|')} (got ${JSON.stringify(safeKey(a.night))})`);
      else if (bits && bits[0].trim() !== a.night) err(`${at}: night ${JSON.stringify(a.night)} disagrees with stage ${JSON.stringify(safeKey(a.stage))} — the renderer still reads stage, so the two must say the same thing`);
    }
    if (a.venue !== undefined) {
      if (typeof a.venue !== 'string' || !a.venue.trim()) err(`${at}: venue must be a non-empty string`);
      else if (a.venue.length > 80) err(`${at}: venue over 80 chars`);
      else {
        if (bits && bits.slice(1).join(' · ').trim() !== a.venue) err(`${at}: venue ${JSON.stringify(safeKey(a.venue))} disagrees with stage ${JSON.stringify(safeKey(a.stage))} — the renderer still reads stage, so the two must say the same thing`);
        // A venue in venues{} is a door to its map (the zoom's place line).
        // Missing means no door, not a broken card — so this is a warning,
        // the same weight as a lineup artist with no set yet.
        if (venueMap && !Object.prototype.hasOwnProperty.call(venueMap, a.venue)) warn(`${at}: venue ${JSON.stringify(safeKey(a.venue))} has no entry in venues{} — the card loses its map door`);
      }
    }

    for (const k of ['approx', 'closeApprox']) {
      if (a[k] !== undefined && typeof a[k] !== 'boolean') err(`${at}: ${k} must be true or false`);
    }
    // `approx` says THIS SET'S TIME is our guess, so it needs a time to
    // qualify; `closeApprox` says the CLOSE is (they are separate because
    // Portola's doors are sourced and its close is not).
    if (a.approx === true && !a.time) err(`${at}: approx marks a guessed set time but the entry has no time`);
    if (a.closeApprox !== undefined && a.close === undefined) err(`${at}: closeApprox qualifies close, which is missing`);

    let doorsMin = null;
    let closeMin = null;
    for (const [k, set] of [['doors', (v) => { doorsMin = v; }], ['close', (v) => { closeMin = v; }]]) {
      if (a[k] === undefined) continue;
      if (typeof a[k] !== 'string' || !CLOCK_RE.test(a[k])) { err(`${at}: ${k} must be a single clock time like "10 PM" (got ${JSON.stringify(safeKey(a[k]))})`); continue; }
      try { set(timeToMinutes(a[k])); } catch { err(`${at}: ${k} did not parse`); }
    }
    if (doorsMin !== null && closeMin !== null && closeMin <= doorsMin) err(`${at}: close ${JSON.stringify(a.close)} is not after doors ${JSON.stringify(a.doors)}`);
    // A set outside the room's own window is a data-entry slip, and a guessed
    // time landing there is the slip this shape exists to prevent.
    if (doorsMin !== null && closeMin !== null && typeof a.time === 'string' && TIME_RE.test(a.time)) {
      let t = null;
      try { t = timeToMinutes(startOf(a.time)); } catch { /* reported above */ }
      if (t !== null && (t < doorsMin || t > closeMin)) err(`${at}: set time ${JSON.stringify(safeKey(a.time))} falls outside doors ${JSON.stringify(a.doors)} – close ${JSON.stringify(a.close)}`);
    }

    if (a.order !== undefined) {
      const o = a.order;
      if (!plain(o)) { err(`${at}: order must be an object { seq, of, source, confirmed }`); return; }
      const int = (v) => Number.isInteger(v);
      if (!int(o.of) || o.of < 2) err(`${at}: order.of must be a whole number of 2 or more (a run of one is not a run)`);
      if (!int(o.seq) || o.seq < 1 || (int(o.of) && o.seq > o.of)) err(`${at}: order.seq must be a whole number from 1 to ${int(o.of) ? o.of : 'of'} (got ${JSON.stringify(safeKey(o.seq))})`);
      // The order is a DOOR the zoom opens — it has to go somewhere real, and
      // over https, since the app is served over it.
      if (typeof o.source !== 'string' || !/^https:\/\/[^\s]+$/.test(o.source)) err(`${at}: order.source must be an https URL — the order line is a door to where the order came from`);
      if (typeof o.confirmed !== 'boolean') err(`${at}: order.confirmed must be true or false — whether the venue has posted this order, or it is still our read`);
      if (int(o.seq) && int(o.of) && a.night !== undefined && a.venue !== undefined) {
        const key = `${a.day || ''}|${a.night}|${a.venue}`;
        if (!runs.has(key)) runs.set(key, []);
        runs.get(key).push({ a, o, at });
      }
    }
  });

  // One room, one night: the sets that share it must tell one story.
  for (const [key, members] of runs) {
    const where = safeKey(key.replace(/\|/g, ' · '));
    const ofs = new Set(members.map((m) => m.o.of));
    if (ofs.size > 1) err(`${where}: the sets disagree on how many are in the run (${[...ofs].sort().join(', ')})`);
    const seqs = members.map((m) => m.o.seq);
    const dupes = seqs.filter((s, i) => seqs.indexOf(s) !== i);
    if (dupes.length) err(`${where}: two sets both claim position ${[...new Set(dupes)].join(', ')} in the run`);
    for (const k of ['doors', 'close']) {
      const vals = new Set(members.map((m) => m.a[k]));
      if (vals.size > 1) err(`${where}: the sets disagree on ${k} (${[...vals].map((v) => (v === undefined ? '(none)' : JSON.stringify(safeKey(v)))).join(', ')}) — one room, one window`);
    }
    const of = members[0].o.of;
    if (ofs.size === 1 && members.length !== of) {
      warn(`${where}: ${members.length} of ${of} sets in the run carry an order — the rest of the run is missing or unnumbered`);
    }
    // A run is a sequence in TIME. If the clock disagrees with the numbering,
    // one of the two is wrong and no renderer can tell which.
    const timed = members
      .filter((m) => typeof m.a.time === 'string' && TIME_RE.test(m.a.time))
      .map((m) => { try { return { seq: m.o.seq, t: timeToMinutes(startOf(m.a.time)), at: m.at }; } catch { return null; } })
      .filter(Boolean)
      .sort((x, y) => x.seq - y.seq);
    for (let i = 1; i < timed.length; i++) {
      if (timed[i].t <= timed[i - 1].t) err(`${where}: ${timed[i].at} is ${timed[i].seq} of ${of} but starts no later than the set before it — the running order and the clock disagree`);
    }
  }
}

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
    // A name is a pick key, a note key and a route key — control characters
    // (a newline, a tab, NUL) have no place in one (Codex gate, 2026-08-29).
    else if (/[\x00-\x1f\x7f]/.test(a.name)) err(`artists[${i}]: name holds a control character`);
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

  // The structured event fields (night/venue/approx/doors/close/order) —
  // artists[] only, since a grid set's room is its `stage` column.
  checkEventFields(fest, err, warn);

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

  // The festival's clock. A file whose dayMeta carries dates draws a "now"
  // line and lands the day-of open on it — read in THIS zone, so a phone in
  // another one (a friend in Austin, a Portola crew before the flight) is not
  // hours off. IANA name, checked against the runtime's own zone table.
  const validZone = (z) => { try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch { return false; } };
  const datesPresent = isPlain(fest.dayMeta) && Object.values(fest.dayMeta).some((m) => isPlain(m) && (m.iso !== undefined || m.isos !== undefined));
  if (fest.timezone !== undefined) {
    if (typeof fest.timezone !== 'string' || !validZone(fest.timezone)) err('timezone must be an IANA zone name like America/Los_Angeles');
  } else if (datesPresent) err('timezone is required once dayMeta carries dates — the now line needs the festival\'s clock');

  // dayMeta dates: `iso` (single weekend) or `isos: {W1, W2}` (two weekends)
  // give a grid day its calendar date — what the "now" line and the day-of
  // auto-scroll key on. Optional, but when present it must be a real date:
  // a typo here would put the now line on the wrong day, silently.
  if (fest.dayMeta !== undefined && !isPlain(fest.dayMeta)) err('dayMeta must be an object keyed by day label');
  else if (fest.dayMeta) {
    const realDate = (s) => typeof s === 'string' && /^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(s)
      && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
    // Two grid days on one date would draw two now lines — each date is one
    // day's, per weekend.
    // A plain `iso` is that day's date on EVERY weekend, so it collides with
    // the same date under either weekend of an `isos` day, and vice versa.
    const seen = { W1: new Set(), W2: new Set() };
    const claim = (wk, date, label) => {
      const buckets = wk ? [wk] : ['W1', 'W2'];
      if (buckets.some((b) => seen[b].has(date))) err(`dayMeta.${safeKey(label)}: date ${date} is already another day's${wk ? ` (${wk})` : ''}`);
      for (const b of buckets) seen[b].add(date);
    };
    for (const [label, meta] of Object.entries(fest.dayMeta)) {
      if (!isPlain(meta)) { err(`dayMeta.${safeKey(label)}: must be an object`); continue; }
      if (meta.iso !== undefined && meta.isos !== undefined) err(`dayMeta.${safeKey(label)}: iso OR isos, not both`);
      if (meta.iso !== undefined) {
        if (!realDate(meta.iso)) err(`dayMeta.${safeKey(label)}.iso must be a real YYYY-MM-DD date`);
        else claim('', meta.iso, label);
      }
      if (meta.isos !== undefined) {
        if (!isPlain(meta.isos)) err(`dayMeta.${safeKey(label)}.isos must be {W1, W2}`);
        else {
          for (const wk of ['W1', 'W2']) if (meta.isos[wk] === undefined) err(`dayMeta.${safeKey(label)}.isos needs both W1 and W2`);
          for (const [wk, v] of Object.entries(meta.isos)) {
            if (!['W1', 'W2'].includes(wk)) err(`dayMeta.${safeKey(label)}.isos: unknown weekend ${safeKey(wk)}`);
            else if (!realDate(v)) err(`dayMeta.${safeKey(label)}.isos.${wk} must be a real YYYY-MM-DD date`);
            else claim(wk, v, label);
          }
        }
      }
    }
  }
  // Morning sets: time.js reads EVERY AM time as after-midnight (a 9 AM set
  // lands at 33:00, the next morning), while the now line's clock rolls the
  // day at 5 AM. No live grid has a set between 5:00 and 11:59 AM; if one
  // ever does, the two need one axis — say so rather than let the line lie.
  for (const [label, day] of Object.entries(isPlain(fest.days) ? fest.days : {})) {
    if (!isPlain(day) || !Array.isArray(day.artists)) continue;
    for (const a of day.artists) {
      if (!isPlain(a) || typeof a.time !== 'string' || !TIME_RE.test(a.time)) continue;
      const start = a.time.split(' - ')[0];
      const m = start.match(/^(\d{1,2})(?::(\d{2}))? (AM)$/i);
      if (m && Number(m[1]) >= 5 && Number(m[1]) !== 12) warn(`${safeKey(label)}: ${safeKey(a.name)} starts at ${safeKey(start)} — the schedule axis reads AM as after-midnight, the now line reads 5 AM+ as morning; give them one axis before shipping a morning grid`);
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
