#!/usr/bin/env node
// One-time, ADDITIVE restructure of Portola 2026's event entries (Afters,
// Folsom) — phase 1 of the events build (claude-plans/2026-08-31-events-canvas/
// MODEL-V3.md). Two changes, both purely additive:
//
//   1. `night` + `venue`, parsed out of the `stage` string the file already
//      carries ("Sun · The Midway" -> night "Sun", venue "The Midway").
//      Nothing is renamed and `stage` STAYS: it is what the shipped renderer
//      reads (js/v3/wall.js renderLineupGroup splits it on ' · '), so the
//      running app is untouched. Phase 2 (the UI) reads the structured pair
//      and the duplication goes away then, not now.
//
//   2. The Midway's Sunday four become a BACK-TO-BACK RUN (MODEL-V3 §5):
//      guessed times, `approx`, `doors`/`close`, and an `order` object that
//      records how sure we are and links the source.
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
// the property that matters is "no name and no day label moved" — a
// different job with a different test.
//
//   node scripts/migrate-portola-events.mjs            # write
//   node scripts/migrate-portola-events.mjs --check    # report, write nothing
//
// Idempotent: a second run is a no-op (the test pins that).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PORTOLA = join(ROOT, 'data', 'festivals', 'portola-2026.json');

// The poster page — the door the zoom's order line opens (MODEL-V3 §5).
export const PORTOLA_WEEK = 'https://portolamusicfestival.com/portola-week/';
// The ticket page the doors time is sourced from.
export const MIDWAY_TICKETS = 'https://www.axs.com/events/1575408/horsegiirl-tickets';

// Provenance goes in the FILE, not only in a plan doc — a phase-2 session
// reading portola-2026.json must be able to tell the sourced facts from our
// guesses without leaving the data.
export const META_NOTE = 'BACK-TO-BACK RUN (2026-09-01, MODEL-V3 §5): the four Sunday Midway sets were transcribed as four 10 PM shows; they are ONE night played in sequence. 10 PM is DOORS - AXS event 1575408 prints "Doors Open - Sun Sep 27, 2026, 10:00 PM" - so it moved to `doors`, and each set carries a GUESSED start (`approx: true`) spaced roughly an hour, with `order: {seq, of, source, confirmed:false}` recording the running order and where it came from. ORDER RESOLVED (Kevin, 2026-09-01): both ticket vendors, AXS and Tixr, bill this show as horsegiirL "with VTSS, MGNA Crrrta, Two Shell" - by Kevin\'s own rule the billed headliner closes, so horsegiirL now closes (seq 4, 1 AM); MGNA Crrrta still opens on small print (seq 1, 10 PM), and VTSS/Two Shell hold the poster\'s middle order (seq 2, 3). `order.confirmed` stays false - a data-entry read of two ticket pages, not a venue-issued time. A "Kavari" name turned up in a stale Tixr URL slug for this show but is NOT on the live bill (verified 2026-09-01) and was not added - four sets stays four sets. `close: "2 AM"` is OURS: no source prints an end time, which is what `closeApprox: true` records. Every other event entry gained only `night` + `venue`, parsed out of `stage` (which stays, and stays authoritative - the validator errors if the two disagree).';

// ---------------------------------------------------------------------------
// The Midway, Sunday Sept 27 — the pile, re-read.
//
// Kevin's re-read of the source (2026-08-31): the four "10 PM shows" are ONE
// night played in sequence — the poster prints DOORS, not set times. The
// times below are spaced from doors at roughly an hour a set. This is
// data-entry judgment, recorded per event and marked unconfirmed — never
// inferred at render time.
//
// SOURCED (AXS event 1575408, re-checked 2026-09-01): "Doors Open — Sun Sep
// 27, 2026, 10:00 PM". That is where `doors` comes from, and it is why all
// four entries said "10 PM" before this migration.
//
// GUESSED: the `close`. No source states an end time for this show — not the
// AXS page, not the portola-week page. "2 AM" is our read of a four-DJ club
// night on 10 PM doors in a California last-call city, and it is marked
// `closeApprox: true` so the data never claims otherwise.
//
// ORDER, RESOLVED (Kevin, 2026-09-01): first entered from the poster's own
// hierarchy (small print opens, the buy-tickets name closes) — which put
// horsegiirL second and Two Shell last. AXS bills this show as **horsegiirL**
// "with VTSS, MGNA Crrrta, Two Shell", Tixr agrees, and by Kevin's own rule
// the billed headliner closes. So horsegiirL moved to close (seq 4, 1 AM);
// the other three keep the poster's read (MGNA Crrrta opens on small print,
// VTSS and Two Shell hold the middle). `confirmed: false` stays — this is
// still a data-entry read of two ticket pages, not a venue-issued time. A
// "Kavari" name turned up in a stale Tixr URL slug for this show but is NOT
// on the live bill (checked 2026-09-01) — four sets stays four sets.
export const MIDWAY_RUN = {
  night: 'Sun',
  venue: 'The Midway',
  doors: '10 PM',
  close: '2 AM',
  closeApprox: true,          // no source prints an end time; the doors are sourced
  source: PORTOLA_WEEK,
  confirmed: false,
  sets: [
    { name: 'MGNA Crrrta', time: '10 PM' },  // small print — opens (poster read, unmoved by the flip)
    { name: 'VTSS', time: '11 PM' },         // poster read — position unmoved by the flip
    { name: 'Two Shell', time: '12 AM' },    // poster read — position unmoved by the flip
    { name: 'horsegiirL', time: '1 AM' },    // AXS/Tixr billed headliner — closes (Kevin, 2026-09-01)
  ],
};

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

// The frozen keys, in order: every artists[] name and every day label. This is
// what the migration is forbidden to move (MODEL-V3 §1) — exported so the CLI
// guard below and tests/portola-events.test.mjs assert the SAME comparison
// rather than two hand-typed versions of it.
export function namesAndDays(fest) {
  return {
    names: (fest.artists || []).map((a) => a && a.name),
    days: (fest.artists || []).map((a) => a && a.day),
  };
}

// The transform. Pure: takes a document, returns a NEW one plus the list of
// what it changed. Never mutates its input, never touches `name` or `day`.
export function migrateEvents(fest, { run = MIDWAY_RUN } = {}) {
  const changes = [];
  const seqOf = new Map(run.sets.map((s, i) => [s.name, { seq: i + 1, time: s.time }]));

  const artists = (fest.artists || []).map((a) => {
    if (!isEventEntry(fest, a)) return a;
    const { night, venue } = splitStage(a.stage);
    const inRun = night === run.night && venue === run.venue && seqOf.has(a.name);
    if (!inRun) {
      const next = rebuild(a);
      if (a.night !== night || a.venue !== venue) changes.push(`${a.name} (${a.stage}): + night/venue`);
      return next;
    }
    const { seq, time } = seqOf.get(a.name);
    const next = rebuild(a, {
      time,
      approx: true,
      doors: run.doors,
      close: run.close,
      ...(run.closeApprox ? { closeApprox: true } : {}),
      order: { seq, of: run.sets.length, source: run.source, confirmed: run.confirmed },
    });
    if (JSON.stringify(next) !== JSON.stringify(a)) {
      changes.push(`${a.name} (${a.stage}): + night/venue, time ${JSON.stringify(a.time)} -> ${JSON.stringify(time)} (approx), doors/close, order ${seq} of ${run.sets.length}`);
    }
    return next;
  });

  // Every name in the run must have been found — a typo here would silently
  // ship three of four sets on the old doors time.
  const placed = artists.filter((a) => a.order && a.venue === run.venue && a.night === run.night).length;
  if (placed !== run.sets.length) {
    throw new Error(`run incomplete: placed ${placed} of ${run.sets.length} sets at ${run.night} · ${run.venue} — check the names against artists[]`);
  }

  // Provenance, appended once. Idempotent: a second run finds it already there.
  let meta = fest.meta;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const note = typeof meta.note === 'string' ? meta.note : '';
    const sources = Array.isArray(meta.sources) ? meta.sources : [];
    const nextNote = note.includes(META_NOTE) ? note : `${note}${note ? ' ' : ''}${META_NOTE}`;
    const nextSources = sources.includes(MIDWAY_TICKETS) ? sources : [...sources, MIDWAY_TICKETS];
    if (nextNote !== note || nextSources !== sources) {
      if (nextNote !== note) changes.push('meta.note: + the back-to-back-run provenance (what is sourced, what is ours)');
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
  const keysBefore = namesAndDays(fest);

  const { fest: next, changes } = migrateEvents(fest);

  // The frozen-key law, proved before anything is written: every name and
  // every day label byte-identical, in the same order (MODEL-V3 §1).
  const keysAfter = namesAndDays(next);
  if (JSON.stringify(keysAfter.names) !== JSON.stringify(keysBefore.names)) throw new Error('REFUSING TO WRITE: an artist name moved — names are pick keys with no rename path');
  if (JSON.stringify(keysAfter.days) !== JSON.stringify(keysBefore.days)) throw new Error('REFUSING TO WRITE: a day label moved — day labels are note keys with no rename path');

  const after = JSON.stringify(next, null, 2);
  changes.forEach((c) => console.log(`  ${c}`));
  console.log(`\n${changes.length} entr(ies) changed; ${keysBefore.names.length} names and ${new Set(keysBefore.days).size} day labels untouched.`);
  if (after === before) { console.log('Already migrated — nothing to write.'); process.exit(0); }
  if (check) { console.log('--check: not writing.'); process.exit(0); }
  writeFileSync(PORTOLA, after);
  console.log(`Wrote ${PORTOLA}`);
}
