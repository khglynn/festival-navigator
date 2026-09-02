#!/usr/bin/env node
// The ADDITIVE restructure of Portola 2026's event entries (Afters, Folsom) —
// the events build (claude-plans/2026-08-31-events-canvas/MODEL-V3.md). Two
// changes, both purely additive to the frozen keys:
//
//   1. `night` + `venue`, parsed out of the `stage` string the file already
//      carries ("Sun · The Midway" -> night "Sun", venue "The Midway").
//      Nothing is renamed and `stage` STAYS: it is what the shipped renderer
//      reads, and the validator errors if the two ever disagree.
//
//   2. Every multi-artist VENUE-NIGHT becomes a BACK-TO-BACK RUN (MODEL-V3
//      §5): guessed set times, `approx`, `doors`/`close`, and an `order`
//      object that records the running order, how sure we are, and the page
//      it came from.
//
// WHY EVERY ROOM AND NOT JUST THE MIDWAY (Kevin, 2026-09-01): a venue-night
// is ONE ROOM and artists at one room play IN SEQUENCE. The Midway was simply
// the first room we re-read; every one of the twelve multi-artist venue-nights
// in this file lists all its artists at the SAME time, and that time is the
// DOORS time off the ticket page, not a set time. Rendering them as lanes or
// as a deck said "these are simultaneous", which is false about all of them.
//
// WHY A SCRIPT AND NOT A HAND EDIT: the transform is the reviewable artifact.
// `migrateEvents` below is exported and tests/portola-events.test.mjs runs
// THESE EXACT BYTES against the shipped file — the same discipline
// api/_lib/crew-sql.mjs uses for the merge SQL. A test against a re-typed
// copy of a transform passes through exactly the regression it exists to
// catch (CLAUDE.md).
//
// WHY NOT scripts/import-festival.mjs: that one ingests a whole researched
// document. This edits a live file in place under the frozen-key law, where
// the property that matters is "no name, no day label and no stage moved" —
// a different job with a different test.
//
//   node scripts/migrate-portola-events.mjs            # write
//   node scripts/migrate-portola-events.mjs --check    # report, write nothing
//
// Idempotent: a second run is a no-op (the test pins that).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { activityMinutes } from '../js/time.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PORTOLA = join(ROOT, 'data', 'festivals', 'portola-2026.json');

// The programme page every Portola Week show is billed on — the door the
// zoom's order line opens when a show has no page of its own (MODEL-V3 §5).
export const PORTOLA_WEEK = 'https://portolamusicfestival.com/portola-week/';
// The Midway's ticket page, where its doors time is printed.
export const MIDWAY_TICKETS = 'https://www.axs.com/events/1575408/horsegiirl-tickets';

// ---------------------------------------------------------------------------
// GUESSED SET TIMES (MODEL-V3 §5).
//
// A room prints doors, sometimes a close, and a bill. It does not print set
// times. So we lay the bill across the window: where the CLOSE is known the
// sets spread evenly across it; where it is not, they go an hour apart from
// doors (§5's original rule, and what an hour-a-set club night looks like).
//
// The even step rounds to the nearest half hour on purpose — a plan reads
// "11:30 PM", never "11:20 PM" — and shrinks rather than pushing the last set
// past the close. All times land on the festival-day axis (time.js), so a
// 2 AM close is after a 10 PM door, not sixteen hours before it.
//
// The rule reproduces the Midway's shipped times exactly (4 sets, 10 PM
// doors, 2 AM close -> 10, 11, 12, 1), which is why that room can be pinned
// AND derived: tests/portola-events.test.mjs asserts the two agree.
const HALF_HOUR = 30;
const HOUR = 60;
export function clockLabel(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}${min ? `:${String(min).padStart(2, '0')}` : ''} ${h24 < 12 ? 'AM' : 'PM'}`;
}
export function runTimes({ doors, close = null, count }) {
  const start = activityMinutes(doors);
  let step = HOUR;
  if (close && count > 1) {
    const win = activityMinutes(close) - start;
    if (win > 0) {
      step = Math.max(HALF_HOUR, Math.round(win / count / HALF_HOUR) * HALF_HOUR);
      // Never so wide that the closer would start at or after the close.
      while (step > HALF_HOUR && (count - 1) * step >= win) step -= HALF_HOUR;
    }
  }
  return Array.from({ length: count }, (_, k) => clockLabel(start + k * step));
}

// ---------------------------------------------------------------------------
// THE RUNS — one row per multi-artist venue-night that has a time.
//
// `order` is the running order, OPENER FIRST, closer last. Where a ticket or
// programme page bills the room, the billing decides it: the billed headliner
// closes, and the rest of the bill runs in descending print — so a bill read
// top to bottom is the run read bottom to top (MODEL-V3 §5). That is exactly
// how the Midway was settled with Kevin on 2026-09-01, and it is the fallback
// for a room whose page we could not re-read: the first-listed name in
// artists[] closes and the rest reverse ahead of it, entered at LOW
// confidence and pointed at the programme page.
//
// `doors`/`close` are SOURCED where the file already carried a range (those
// ranges came off the programme page in the 2026-08-23 research pass) and
// where a ticket page prints them. Where no page prints an end, the room
// simply has no `close` — the zoom then says "Doors 10 PM" instead of
// inventing a window, which is §5's own promise ("the venue's real window, so
// no invented clock in the zoom"). We do not manufacture nine closing times
// to make the columns tidy.
//
// `wasTime` is what EVERY set in the room said before this migration — the
// doors time, or (in five rooms) the room's whole window — copied onto each
// act. It is not decoration: the transform refuses to run on an un-migrated
// entry whose time is not that string, so a hand edit to the JSON trips here
// instead of quietly re-guessing from data that moved.
//
// `confirmed` is false on every row: none of this is a venue-issued set time.
// `confidence` is ours, for the log and the PR body — it never ships.
export const RUNS = [
  {
    day: 'Afters', night: 'Fri', venue: 'Regency Ballroom',
    doors: '8 PM', close: null,
    order: ['Gelli Haha', 'Jyoty', 'Channel Tres'],
    wasTime: '8 PM',
    source: PORTOLA_WEEK, confidence: 'low',
    note: 'Bill reads Channel Tres · Jyoty · Gelli Haha; no page prints an end time.',
  },
  {
    day: 'Afters', night: 'Fri', venue: 'Monarch',
    doors: '10 PM', close: null,
    order: ['Skiis', 'Sam Alfred'],
    wasTime: '10 PM',
    source: PORTOLA_WEEK, confidence: 'low',
    note: 'Bill reads Sam Alfred · Skiis; no page prints an end time.',
  },
  {
    day: 'Afters', night: 'Fri', venue: 'The Great Northern',
    doors: '10 PM', close: '2 AM',
    order: ['Loods', 'Ranger Trucco'],
    wasTime: '10 PM - 2 AM',
    source: PORTOLA_WEEK, confidence: 'low',
    note: 'The file already carried "10 PM - 2 AM" for both sets — that is the ROOM\'s window off the programme page, not a set time. Bill reads Ranger Trucco · Loods.',
  },
  {
    day: 'Afters', night: 'Sat', venue: 'Regency Ballroom',
    doors: '10 PM', close: null,
    order: ['Velvet Trip', 'Parcels'],
    wasTime: '10 PM',
    source: PORTOLA_WEEK, confidence: 'low',
    note: 'Bill reads Parcels · Velvet Trip; no page prints an end time.',
  },
  {
    day: 'Afters', night: 'Sat', venue: 'Monarch',
    doors: '10 PM', close: '3 AM',
    order: ['Clearcast', 'Jigitz'],
    wasTime: '10 PM - 3 AM',
    source: PORTOLA_WEEK, confidence: 'low',
    note: 'The file already carried "10 PM - 3 AM" for both sets — the room\'s window. Bill reads Jigitz · Clearcast.',
  },
  {
    day: 'Afters', night: 'Sun', venue: 'Public Works',
    doors: '10 PM', close: '2 AM',
    order: ['erika b2b sfcowboy', 'Ben UFO', 'Overmono'],
    wasTime: '10 PM - 2 AM',
    source: PORTOLA_WEEK, confidence: 'low',
    note: 'The file already carried "10 PM - 2 AM" for all three — the room\'s window. Bill reads Overmono · Ben UFO · erika b2b sfcowboy.',
  },
  {
    day: 'Afters', night: 'Sun', venue: 'The Midway',
    doors: '10 PM', close: '2 AM', closeApprox: true,
    times: ['10 PM', '11 PM', '12 AM', '1 AM'], // PINNED: Kevin settled this room on 2026-09-01
    order: ['MGNA Crrrta', 'VTSS', 'Two Shell', 'horsegiirL'],
    wasTime: '10 PM',
    source: PORTOLA_WEEK, confidence: 'medium',
    note: 'Doors 10 PM is SOURCED (AXS event 1575408: "Doors Open — Sun Sep 27, 2026, 10:00 PM"). The 2 AM close is OURS (closeApprox). Order settled with Kevin: AXS and Tixr both bill "horsegiirL with VTSS, MGNA Crrrta, Two Shell", so horsegiirL closes; MGNA Crrrta opens on small print. A "Kavari" name in a stale Tixr URL slug is NOT on the live bill — four sets stays four sets.',
  },
  {
    day: 'Afters', night: 'Sun', venue: 'The Great Northern',
    doors: '10 PM', close: null,
    order: ['Puffie', 'SG Lewis'],
    wasTime: '10 PM',
    source: PORTOLA_WEEK, confidence: 'low',
    note: 'Bill reads SG Lewis · Puffie; no page prints an end time.',
  },
  {
    day: 'Afters', night: 'Sun', venue: 'Monarch',
    doors: '10 PM', close: '3 AM',
    order: ['Dean Turnley', 'Silva Bumpa'],
    wasTime: '10 PM - 3 AM',
    source: PORTOLA_WEEK, confidence: 'low',
    note: 'The file already carried "10 PM - 3 AM" for both — the room\'s window. Bill reads Silva Bumpa · Dean Turnley.',
  },
  {
    day: 'Afters', night: 'Sun', venue: 'Rickshaw Stop',
    doors: '10 PM', close: null,
    order: ['Naisha', 'JT'],
    wasTime: '10 PM',
    source: PORTOLA_WEEK, confidence: 'low',
    note: 'Bill reads JT · Naisha; no page prints an end time.',
  },
];

// The two venue-nights that are NOT runs: nobody has printed a time for them
// at all, so they stay timeless and the wall tiles them under TIME TBA. A run
// with no clock would be pure invention.
export const TIMELESS_ROOMS = [
  { day: 'Afters', night: 'Sat', venue: 'Public Works', names: ['Fcukers', 'Chloé Caillet'] },
  { day: 'Afters', night: 'Sat', venue: 'Audio', names: ['Max Styler', 'Airwolf Paradise'] },
];

// Provenance goes in the FILE, not only in a plan doc — a session reading
// portola-2026.json must be able to tell the sourced facts from our guesses
// without leaving the data.
export const META_NOTE = 'BACK-TO-BACK RUNS (2026-09-01, MODEL-V3 §5): a venue-night is ONE ROOM and its artists play IN SEQUENCE. Every multi-artist venue-night in this file had all of its artists stamped with the SAME time - that is the DOORS time off the programme/ticket page, not a set time. So each of those rooms now carries `doors` (and `close` where a page prints one), and every set in it carries a GUESSED start (`approx: true`) plus `order: {seq, of, source, confirmed:false}` recording the running order and where it came from. Set times are laid across the window: evenly from doors to close where the close is known, an hour apart from doors where it is not, rounded to the half hour. Running order follows the billing - the billed headliner closes and the rest run in descending print - which for rooms we could not re-read means the first-listed name in artists[] closes and the rest reverse ahead of it (LOW confidence, pointed at the Portola Week programme page). THE MIDWAY (Sun) is the one room settled with Kevin directly: doors 10 PM is sourced from AXS event 1575408, the 2 AM close is OURS (`closeApprox: true`), and horsegiirL closes because both ticket vendors bill the show "horsegiirL with VTSS, MGNA Crrrta, Two Shell". Sat Public Works and Sat Audio print NO time at all and are deliberately left timeless (TIME TBA) rather than given an invented clock. `order.confirmed` is false everywhere - none of this is a venue-issued set time. Every other event entry gained only `night` + `venue`, parsed out of `stage` (which stays, and stays authoritative - the validator errors if the two disagree).';

// Earlier provenance paragraphs this script wrote, stripped before the current
// one is appended so a re-run never stacks two versions of the same story.
export const LEGACY_META_NOTES = [
  'BACK-TO-BACK RUN (2026-09-01, MODEL-V3 §5): the four Sunday Midway sets were transcribed as four 10 PM shows; they are ONE night played in sequence. 10 PM is DOORS - AXS event 1575408 prints "Doors Open - Sun Sep 27, 2026, 10:00 PM" - so it moved to `doors`, and each set carries a GUESSED start (`approx: true`) spaced roughly an hour, with `order: {seq, of, source, confirmed:false}` recording the running order and where it came from. ORDER RESOLVED (Kevin, 2026-09-01): both ticket vendors, AXS and Tixr, bill this show as horsegiirL "with VTSS, MGNA Crrrta, Two Shell" - by Kevin\'s own rule the billed headliner closes, so horsegiirL now closes (seq 4, 1 AM); MGNA Crrrta still opens on small print (seq 1, 10 PM), and VTSS/Two Shell hold the poster\'s middle order (seq 2, 3). `order.confirmed` stays false - a data-entry read of two ticket pages, not a venue-issued time. A "Kavari" name turned up in a stale Tixr URL slug for this show but is NOT on the live bill (verified 2026-09-01) and was not added - four sets stays four sets. `close: "2 AM"` is OURS: no source prints an end time, which is what `closeApprox: true` records. Every other event entry gained only `night` + `venue`, parsed out of `stage` (which stays, and stays authoritative - the validator errors if the two disagree).',
];

// ---------------------------------------------------------------------------
// An EVENT entry is an artists[] row that carries a "<Night> · <Venue>" stage
// and sits on a day the grid does not own (Afters, Folsom, "Afters & Folsom").
// Grid-day rows in artists[] are bare {name, day} — they must not be touched.
export function isEventEntry(fest, a) {
  if (!a || typeof a.stage !== 'string' || !a.stage.includes(' · ')) return false;
  const gridDays = Object.keys(fest.days || {});
  const parts = String(a.day || '').split(/\s*[&+/]\s*|\s+and\s+/i).map((s) => s.trim());
  return parts.every((p) => p && !gridDays.includes(p));
}

export function splitStage(stage) {
  const bits = stage.split(' · ');
  return { night: bits[0].trim(), venue: bits.slice(1).join(' · ').trim() };
}

// Rebuild one entry with the new keys in a stable place: night/venue right
// after the stage they were parsed from, the run fields after the time they
// qualify. Key order is cosmetic to JSON but not to a reviewer reading a diff.
function rebuild(a, extra = {}) {
  const { night, venue } = splitStage(a.stage);
  const out = {};
  for (const k of ['name', 'day', 'stage']) if (a[k] !== undefined) out[k] = a[k];
  out.night = night;
  out.venue = venue;
  const rest = { ...a, ...extra };
  for (const k of ['time', 'approx', 'doors', 'close', 'closeApprox', 'order']) {
    if (rest[k] !== undefined) out[k] = rest[k];
  }
  // Anything else the entry carried (weekends, …) survives, order-last.
  for (const k of Object.keys(rest)) {
    if (out[k] === undefined && !['name', 'day', 'stage', 'night', 'venue'].includes(k)) out[k] = rest[k];
  }
  return out;
}

// The frozen keys, in order: every artists[] name, every day label, and every
// stage. This is what the migration is forbidden to move (MODEL-V3 §1) —
// exported so the CLI guard below and tests/portola-events.test.mjs assert the
// SAME comparison rather than two hand-typed versions of it.
export function frozenKeys(fest) {
  return {
    names: (fest.artists || []).map((a) => a && a.name),
    days: (fest.artists || []).map((a) => a && a.day),
    stages: (fest.artists || []).map((a) => (a && a.stage) || null),
  };
}

// The transform. Pure: takes a document, returns a NEW one plus the list of
// what it changed. Never mutates its input, never touches `name`, `day` or
// `stage`.
export function migrateEvents(fest, { runs = RUNS } = {}) {
  const changes = [];
  // One lookup keyed by the room a set is in AND its name — in Portola a name
  // can be two artists[] rows (a grid billing and an event), so a name alone
  // is never enough (phase-1 lesson, 2026-09-01).
  const inRun = new Map();
  for (const run of runs) {
    const times = run.times || runTimes({ doors: run.doors, close: run.close, count: run.order.length });
    if (times.length !== run.order.length) throw new Error(`run ${run.night} · ${run.venue}: ${times.length} times for ${run.order.length} sets`);
    run.order.forEach((name, k) => {
      inRun.set(`${run.day}|${run.night}|${run.venue}|${name}`, { run, seq: k + 1, time: times[k] });
    });
  }
  const seen = new Set();

  const artists = (fest.artists || []).map((a) => {
    if (!isEventEntry(fest, a)) return a;
    const { night, venue } = splitStage(a.stage);
    const hit = inRun.get(`${a.day}|${night}|${venue}|${a.name}`);
    if (!hit) {
      const next = rebuild(a);
      if (a.night !== night || a.venue !== venue) changes.push(`${a.name} (${a.stage}): + night/venue`);
      return next;
    }
    seen.add(`${a.day}|${night}|${venue}|${a.name}`);
    const { run, seq, time } = hit;
    // Not yet migrated? Then the file must still say what the run row says it
    // said — otherwise somebody edited the time by hand and the guess below
    // would be built on sand.
    if (a.order === undefined && run.wasTime !== undefined && a.time !== run.wasTime) {
      throw new Error(`${a.name} (${a.stage}): the file says time ${JSON.stringify(a.time)} but the run row expects ${JSON.stringify(run.wasTime)} — re-read the room before re-running`);
    }
    const next = rebuild(a, {
      time,
      approx: true,
      doors: run.doors,
      ...(run.close ? { close: run.close } : {}),
      ...(run.close && run.closeApprox ? { closeApprox: true } : {}),
      order: { seq, of: run.order.length, source: run.source, confirmed: false },
    });
    if (JSON.stringify(next) !== JSON.stringify(a)) {
      changes.push(`${a.name} (${a.stage}): + night/venue, time ${JSON.stringify(a.time)} -> ${JSON.stringify(time)} (approx), doors${run.close ? '/close' : ''}, order ${seq} of ${run.order.length}`);
    }
    return next;
  });

  // Every name in every run must have been found — a typo here would silently
  // ship a room half on the old doors time.
  const missing = [...inRun.keys()].filter((k) => !seen.has(k));
  if (missing.length) throw new Error(`run incomplete: no artists[] entry for ${missing.join(', ')} — check the names, nights and venues against the file`);

  // …and every multi-artist venue-night that HAS a time must be in a run, or
  // the wall would draw a stack the data never explained. The two deliberately
  // timeless rooms are exempt.
  const rooms = new Map();
  for (const a of artists) {
    if (!isEventEntry(fest, a)) continue;
    const key = `${a.day}|${splitStage(a.stage).night}|${splitStage(a.stage).venue}`;
    if (!rooms.has(key)) rooms.set(key, []);
    rooms.get(key).push(a);
  }
  const timelessKeys = new Set(TIMELESS_ROOMS.map((r) => `${r.day}|${r.night}|${r.venue}`));
  for (const [key, list] of rooms) {
    if (list.length < 2 || timelessKeys.has(key)) continue;
    if (list.some((a) => a.time) && !list.every((a) => a.order)) {
      throw new Error(`unrun room: ${key} has ${list.length} timed sets and no run — add it to RUNS or to TIMELESS_ROOMS`);
    }
  }

  // Provenance, appended once. Idempotent: a second run finds it already
  // there, and an earlier version of it is stripped rather than stacked.
  let meta = fest.meta;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const note = typeof meta.note === 'string' ? meta.note : '';
    const sources = Array.isArray(meta.sources) ? meta.sources : [];
    let nextNote = note;
    for (const legacy of LEGACY_META_NOTES) nextNote = nextNote.replace(legacy, '').replace(/ {2,}/g, ' ').trim();
    if (!nextNote.includes(META_NOTE)) nextNote = `${nextNote}${nextNote ? ' ' : ''}${META_NOTE}`;
    const nextSources = sources.includes(MIDWAY_TICKETS) ? sources : [...sources, MIDWAY_TICKETS];
    if (nextNote !== note || nextSources !== sources) {
      if (nextNote !== note) changes.push('meta.note: the back-to-back-run provenance (what is sourced, what is ours)');
      if (!sources.includes(MIDWAY_TICKETS)) changes.push(`meta.sources: + ${MIDWAY_TICKETS}`);
      meta = { ...meta, note: nextNote, sources: nextSources };
    }
  }

  return { fest: { ...fest, artists, ...(meta === fest.meta ? {} : { meta }) }, changes };
}

// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  const before = readFileSync(PORTOLA, 'utf8');
  const fest = JSON.parse(before);
  const keysBefore = frozenKeys(fest);

  const { fest: next, changes } = migrateEvents(fest);

  // The frozen-key law, proved before anything is written: every name, every
  // day label and every stage byte-identical, in the same order (MODEL-V3 §1).
  const keysAfter = frozenKeys(next);
  for (const k of ['names', 'days', 'stages']) {
    if (JSON.stringify(keysAfter[k]) !== JSON.stringify(keysBefore[k])) {
      throw new Error(`REFUSING TO WRITE: an artists[] ${k.slice(0, -1)} moved — these are pick/notes keys with no rename path`);
    }
  }

  const after = JSON.stringify(next, null, 2);
  changes.forEach((c) => console.log(`  ${c}`));
  console.log(`\n${changes.length} entr(ies) changed; ${keysBefore.names.length} names, ${new Set(keysBefore.days).size} day labels and ${new Set(keysBefore.stages.filter(Boolean)).size} stages untouched.`);
  console.log(`${RUNS.length} runs: ${RUNS.map((r) => `${r.night} ${r.venue} (${r.order.length})`).join(', ')}`);
  if (after === before) { console.log('Already migrated — nothing to write.'); process.exit(0); }
  if (check) { console.log('--check: not writing.'); process.exit(0); }
  writeFileSync(PORTOLA, after);
  console.log(`Wrote ${PORTOLA}`);
}
