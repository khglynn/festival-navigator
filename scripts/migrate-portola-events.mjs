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
import { planRun, loadRegistry } from './guess-run-times.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PORTOLA = join(ROOT, 'data', 'festivals', 'portola-2026.json');

// Goldenvoice's own Portola Week programme page. It stays in meta.sources as
// the programme of record, but it is NOT a citable door: the page renders its
// show list client-side, so its static HTML is just an image (checked
// 2026-09-01). The per-show pages below are what the zoom's order line opens.
export const PORTOLA_WEEK = 'https://portolamusicfestival.com/portola-week/';
// DoTheBay carries Goldenvoice's official Portola Week listing — one page per
// show, with the billing and the doors time, server-rendered and citable.
export const DOTHEBAY_INDEX = 'https://dothebay.com/portolaweek';
// The Midway's ticket page, where its doors time is printed.
export const MIDWAY_TICKETS = 'https://www.axs.com/events/1575408/horsegiirl-tickets';

// ---------------------------------------------------------------------------
// GUESSED SET TIMES (MODEL-V3 §5) — since 2026-09-02, the venue registry's.
//
// A room prints doors, sometimes a close, and a bill. It does not print set
// times. The clocks come from scripts/guess-run-times.mjs: doors from the
// row below, a PRINTED close kept as printed, an EVIDENCED guess (a close
// with a tilde and a source URL) kept next, otherwise the room's routine
// close from data/venues/index.json (by weekday, then default, then a
// per-kind fallback) — every non-printed close marked `closeApprox` with its
// `closeSource`. First act at doors + the venue's gap, the closer ending at
// the close, the rest spread evenly on the quarter hour. One rule, one
// place; this file only decides the ORDER and the doors.
export function clockLabel(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}${min ? `:${String(min).padStart(2, '0')}` : ''} ${h24 < 12 ? 'AM' : 'PM'}`;
}
let registry = null;
export function runPlan(run) {
  registry = registry || loadRegistry();
  const plan = planRun({
    night: run.night, doors: run.doors,
    close: run.close || null, closeApprox: !!run.closeApprox, closeSource: run.closeSource || null,
    members: run.order.map((name, i) => ({ name, seq: i + 1 })),
    profile: registry.venues[run.venue] || null,
  });
  if (!plan) throw new Error(`run ${run.night} · ${run.venue}: no doors — nothing to plan`);
  return plan;
}
export function runTimes(run) {
  return runPlan(run).times.map((t) => t.time);
}

// ---------------------------------------------------------------------------
// THE RUNS — one row per multi-artist venue-night that has a time.
//
// `order` is the running order, OPENER FIRST, closer last. The billing decides
// it: the billed headliner closes, and the rest of the bill runs in descending
// print — so a bill read top to bottom is the run read bottom to top
// (MODEL-V3 §5). That is how the Midway was settled with Kevin on 2026-09-01,
// and every other room was then read off its own show page (DoTheBay's
// Goldenvoice-fed Portola Week listing, 2026-09-01). A title of "X with A, B"
// makes X the closer and B the opener; "X + Y" is a co-bill where the
// first-named closes.
//
// `adds` names the artists this migration is allowed to CREATE — a name on the
// bill that our file was missing. Everything else in `order` must already
// exist, or the transform refuses to run rather than inventing a card.
//
// `doors` are printed on the show pages. `close` is SOURCED outright in one
// room (Fri Great Northern prints 2 AM); the 3 AM and 2 AM closes on the two
// Monarchs and Sunday's Public Works come from our own 2026-08-23 research
// pass, which DoTheBay does not repeat — they are sourced, just not here.
// Where no page prints an end at all the room simply has no `close`, and the
// zoom says "Doors 10 PM" instead of inventing a window, which is §5's own
// promise. We do not manufacture closing times to make columns tidy.
//
// `wasTime` is what EVERY set in the room said before this migration — the
// doors time, the room's whole window copied onto each act, or `null` for the
// two rooms our file had no time for at all. It is not decoration: the
// transform refuses to run on an un-migrated entry whose time is not that
// value, so a hand edit to the JSON trips here instead of quietly re-guessing
// from data that moved.
//
// `confirmed` is false on every row: none of this is a venue-issued set time.
// `confidence` is ours, for the log and the PR body — it never ships.
export const RUNS = [
  {
    day: 'Afters', night: 'Fri', venue: 'Regency Ballroom',
    doors: '8 PM', close: null, wasTime: '8 PM',
    order: ['Gelli Haha', 'Jyoty', 'Channel Tres'],
    source: 'https://dothebay.com/events/2026/9/25/channel-tres-jyoty-gelli-haha-tickets',
    confidence: 'medium',
    note: 'Billed "Channel Tres, JYOTY, Gelli Haha" — a flat comma list, so the order is the read of a bill rather than a stated one. No page prints an end time.',
  },
  {
    day: 'Afters', night: 'Fri', venue: 'Monarch',
    doors: '10 PM', close: null, wasTime: '10 PM',
    order: ['Skiis', 'Sam Alfred'],
    source: 'https://dothebay.com/events/2026/9/25/sam-alfred-tickets',
    confidence: 'medium',
    note: 'Titled "Sam Alfred"; Skiis is support per our own file, not the DoTheBay title. No page prints an end time.',
  },
  {
    day: 'Afters', night: 'Fri', venue: 'The Great Northern',
    doors: '10 PM', close: '2 AM', wasTime: '10 PM - 2 AM',
    order: ['Loods', 'Ranger Trucco'],
    source: 'https://dothebay.com/events/2026/9/25/ranger-trucco-tickets',
    confidence: 'medium',
    note: 'Titled "Ranger Trucco"; Loods is support per our own file. The 2 AM close is PRINTED on the show page — the one room whose end time is sourced outright.',
  },
  {
    day: 'Afters', night: 'Sat', venue: 'Audio',
    doors: '10 PM', close: null, wasTime: null,
    order: ['Airwolf Paradise', 'Max Styler'],
    source: 'https://dothebay.com/events/2026/9/26/max-styler-tickets',
    confidence: 'high',
    note: 'Billed "Max Styler with Airwolf Paradise". Our file had NO time for this room at all and rendered it as TIME TBA; the show page prints doors 10 PM, so it is a run now.',
  },
  {
    day: 'Afters', night: 'Sat', venue: 'Monarch',
    doors: '10 PM', close: '3 AM', wasTime: '10 PM - 3 AM',
    order: ['Clearcast', 'Jigitz'],
    source: 'https://dothebay.com/events/2026/9/26/jigitz-tickets',
    confidence: 'high',
    note: 'Billed "jigitz with Clearcast". The 3 AM close comes from our own 2026-08-23 research pass, not from this page.',
  },
  {
    day: 'Afters', night: 'Sat', venue: 'Public Works',
    doors: '10 PM', close: null, wasTime: null,
    order: ['Chloé Caillet', 'Fcukers'],
    source: 'https://dothebay.com/events/2026/9/26/fcukers-dj-set-chloe-caillet-presented-by-goldenvoice-tickets',
    confidence: 'medium',
    note: 'Billed "Fcukers (DJ Set) + Chloé Caillet" — a co-bill, so the first-named closes. Our file had NO time for this room and rendered it as TIME TBA; the show page prints doors 10 PM.',
  },
  {
    day: 'Afters', night: 'Sat', venue: 'Regency Ballroom',
    doors: '9 PM', close: null, wasTime: '10 PM',
    order: ['Velvet Trip', 'Parcels'],
    source: 'https://www.axs.com/events/1573671',
    confidence: 'high',
    note: 'Billed "Parcels with Velvet Trip". No page prints an end time. Doors 9 PM is AXS\'s dedicated "Doors Open" field (its banner and DoTheBay say 10 — Kevin, 2026-09-02: take the field, link the source), so the door points at AXS.',
  },
  {
    day: 'Afters', night: 'Sun', venue: 'Public Works',
    doors: '10 PM', close: '2 AM', wasTime: '10 PM - 2 AM',
    order: ['erika b2b sfcowboy', 'Kaytree', 'Ben UFO', 'Overmono'],
    adds: ['Kaytree'],
    source: 'https://dothebay.com/events/2026/9/27/overmono-dj-set-ben-ufo-tickets',
    confidence: 'medium',
    note: 'Billed "Overmono (DJ Set) + Ben UFO, with Kaytree, Erika b2b SFCowboy". KAYTREE was on the bill and missing from this section — added. She already has a Sunday grid billing (Ship Tent), and picks unify by exact name across both, which is the same shape VTSS and Overmono already had. Our lowercase "erika b2b sfcowboy" is KEPT: it is a pick key. The 2 AM close comes from our own 2026-08-23 pass, not from this page.',
  },
  {
    day: 'Afters', night: 'Sun', venue: 'The Midway',
    doors: '10 PM', close: '3 AM', closeApprox: true, closeSource: 'https://19hz.info/eventlisting_BayArea.php', wasTime: '10 PM',
    // Kevin settled this room's ORDER on 2026-09-01; the clocks are the
    // guesser's like every other room. The close is an EVIDENCED guess:
    // 19hz prints the night as 10pm–3am, the venue's own Tixr page prints
    // no end (2026-09-02).
    order: ['MGNA Crrrta', 'VTSS', 'Two Shell', 'horsegiirL'],
    source: MIDWAY_TICKETS, confidence: 'medium',
    note: 'Doors 10 PM is SOURCED (AXS event 1575408: "Doors Open — Sun Sep 27, 2026, 10:00 PM"). The 2 AM close is OURS (closeApprox) — no page prints an end for this one. Order settled with Kevin: AXS and Tixr both bill "horsegiirL with VTSS, MGNA Crrrta, Two Shell", so horsegiirL closes; MGNA Crrrta opens on small print. A "Kavari" name in a stale Tixr URL slug is NOT on the live bill — four sets stays four sets.',
  },
  {
    day: 'Afters', night: 'Sun', venue: 'The Great Northern',
    doors: '10 PM', close: null, wasTime: '10 PM',
    order: ['Puffie', 'SG Lewis'],
    source: 'https://dothebay.com/events/2026/9/27/sg-lewis-dj-set-tickets',
    confidence: 'high',
    note: 'Billed "SG Lewis (DJ Set) with Puffie". No page prints an end time.',
  },
  {
    day: 'Afters', night: 'Sun', venue: 'Monarch',
    doors: '10 PM', close: '3 AM', wasTime: '10 PM - 3 AM',
    order: ['Buck Wilson', 'Dean Turnley', 'Silva Bumpa'],
    adds: ['Buck Wilson'],
    source: 'https://dothebay.com/events/2026/9/27/silva-bumpa-tickets',
    confidence: 'high',
    note: 'Billed "Silva Bumpa with Dean Turnley, Buck Wilson". BUCK WILSON was on the bill and missing from the file entirely (he was noted in meta as supporting roster) — added, and he opens on last-named support. The 3 AM close comes from our own 2026-08-23 pass, not from this page.',
  },
  {
    day: 'Afters', night: 'Sun', venue: 'Rickshaw Stop',
    doors: '10 PM', close: null, wasTime: '10 PM',
    order: ['Naisha', 'JT'],
    source: 'https://dothebay.com/events/2026/9/27/jt-tickets',
    confidence: 'medium',
    note: 'Titled "JT"; Naisha appears in the show description. No page prints an end time.',
  },
];

// Venue-nights that are NOT runs: rooms nobody has printed a time for at all.
// They stay timeless and the wall tiles them under TIME TBA, because a run
// with no clock would be pure invention. Portola has NONE left — Sat Audio and
// Sat Public Works were the last two, and the DoTheBay show pages print doors
// 10 PM for both (read 2026-09-01), so they became runs. The list stays because
// the next festival's data drop will have some.
export const TIMELESS_ROOMS = [];

// Provenance goes in the FILE, not only in a plan doc — a session reading
// portola-2026.json must be able to tell the sourced facts from our guesses
// without leaving the data.
export const META_NOTE = 'BACK-TO-BACK RUNS (2026-09-01, MODEL-V3 §5): a venue-night is ONE ROOM and its artists play IN SEQUENCE. Every multi-artist venue-night in this file had all of its artists stamped with the SAME time - that is the DOORS time off the show page, not a set time - and two rooms had no time at all. So each of those twelve rooms now carries `doors` (and `close` where a page prints one), and every set in it carries a GUESSED start (`approx: true`) plus `order: {seq, of, source, confirmed:false}` recording the running order and the show page it came from. SOURCES (read 2026-09-01): DoTheBay carries Goldenvoice\'s official Portola Week listing, one server-rendered page per show with the billing and the doors time, and each room\'s `order.source` is its own page there; portolamusicfestival.com/portola-week renders its list client-side (static HTML is just an image) so it is the programme of record, not a citable door; The Midway keeps AXS event 1575408. SET TIMES are laid across the window: evenly from doors to close where the close is known, an hour apart from doors where it is not, rounded to the half hour. RUNNING ORDER follows the billing - the billed headliner closes and the rest run in descending print, so "X with A, B" puts B first and X last, and "X + Y" is a co-bill where X closes. TWO NAMES WERE ON THE BILL AND MISSING FROM THIS SECTION and were added: Buck Wilson (Sun Monarch, opens - he was only mentioned in this note\'s supporting-roster list before) and Kaytree (Sun Public Works, second - she already had a Sunday grid billing, and picks unify by exact name across both, the same shape VTSS and Overmono already had). The lowercase spelling "erika b2b sfcowboy" is KEPT against DoTheBay\'s "Erika b2b SFCowboy": it is a pick key. CLOSES: Fri The Great Northern\'s 2 AM is printed on its show page; the 3 AM and 2 AM on Sat Monarch, Sun Monarch and Sun Public Works come from our own 2026-08-23 research pass, which DoTheBay does not repeat; The Midway\'s 2 AM is OURS (`closeApprox: true`); the remaining rooms print no end at all and carry no `close`, so the zoom says "Doors 10 PM" rather than inventing a window. `order.confirmed` is false everywhere - a bill is not a set-time sheet. Every other event entry gained only `night` + `venue`, parsed out of `stage` (which stays, and stays authoritative - the validator errors if the two disagree).';

// Earlier provenance paragraphs this script wrote, stripped before the current
// one is appended so a re-run never stacks two versions of the same story.
export const LEGACY_META_NOTES = [
  'BACK-TO-BACK RUN (2026-09-01, MODEL-V3 §5): the four Sunday Midway sets were transcribed as four 10 PM shows; they are ONE night played in sequence. 10 PM is DOORS - AXS event 1575408 prints "Doors Open - Sun Sep 27, 2026, 10:00 PM" - so it moved to `doors`, and each set carries a GUESSED start (`approx: true`) spaced roughly an hour, with `order: {seq, of, source, confirmed:false}` recording the running order and where it came from. ORDER RESOLVED (Kevin, 2026-09-01): both ticket vendors, AXS and Tixr, bill this show as horsegiirL "with VTSS, MGNA Crrrta, Two Shell" - by Kevin\'s own rule the billed headliner closes, so horsegiirL now closes (seq 4, 1 AM); MGNA Crrrta still opens on small print (seq 1, 10 PM), and VTSS/Two Shell hold the poster\'s middle order (seq 2, 3). `order.confirmed` stays false - a data-entry read of two ticket pages, not a venue-issued time. A "Kavari" name turned up in a stale Tixr URL slug for this show but is NOT on the live bill (verified 2026-09-01) and was not added - four sets stays four sets. `close: "2 AM"` is OURS: no source prints an end time, which is what `closeApprox: true` records. Every other event entry gained only `night` + `venue`, parsed out of `stage` (which stays, and stays authoritative - the validator errors if the two disagree).',,
  'BACK-TO-BACK RUNS (2026-09-01, MODEL-V3 §5): a venue-night is ONE ROOM and its artists play IN SEQUENCE. Every multi-artist venue-night in this file had all of its artists stamped with the SAME time - that is the DOORS time off the programme/ticket page, not a set time. So each of those rooms now carries `doors` (and `close` where a page prints one), and every set in it carries a GUESSED start (`approx: true`) plus `order: {seq, of, source, confirmed:false}` recording the running order and where it came from. Set times are laid across the window: evenly from doors to close where the close is known, an hour apart from doors where it is not, rounded to the half hour. Running order follows the billing - the billed headliner closes and the rest run in descending print - which for rooms we could not re-read means the first-listed name in artists[] closes and the rest reverse ahead of it (LOW confidence, pointed at the Portola Week programme page). THE MIDWAY (Sun) is the one room settled with Kevin directly: doors 10 PM is sourced from AXS event 1575408, the 2 AM close is OURS (`closeApprox: true`), and horsegiirL closes because both ticket vendors bill the show "horsegiirL with VTSS, MGNA Crrrta, Two Shell". Sat Public Works and Sat Audio print NO time at all and are deliberately left timeless (TIME TBA) rather than given an invented clock. `order.confirmed` is false everywhere - none of this is a venue-issued set time. Every other event entry gained only `night` + `venue`, parsed out of `stage` (which stays, and stays authoritative - the validator errors if the two disagree).',
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
  for (const k of ['time', 'approx', 'doors', 'close', 'closeApprox', 'closeSource', 'order']) {
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
const keyOf = (a) => `${a && a.name}|${a && a.day}|${(a && a.stage) || ''}`;

// The migration may ADD an artists[] row — a name that was on the bill and
// missing from the file — but it may never move, rename or drop one that was
// already there. So the check is not positional equality: it walks the new
// list and consumes the old one IN ORDER. Every pre-existing row must be met,
// in sequence, byte-identical; whatever is left over is the additions, which
// the caller then matches against what the RUNS table declared it would add.
// Returns { additions } or throws with the row that moved.
export function additionsOnly(before, after) {
  const old = (before.artists || []).map(keyOf);
  const additions = [];
  let i = 0;
  for (const a of after.artists || []) {
    const k = keyOf(a);
    if (i < old.length && old[i] === k) { i += 1; continue; }
    additions.push(a);
  }
  if (i !== old.length) {
    throw new Error(`a pre-existing artists[] row moved or changed: expected ${JSON.stringify(old[i])} and did not find it — names, day labels and stages are pick/notes keys with no rename path`);
  }
  return { additions };
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
    if (!('wasTime' in run)) throw new Error(`run ${run.night} · ${run.venue}: no wasTime — every row must record what the file said before, so a hand edit trips`);
    const plan = runPlan(run);
    if (plan.times.length !== run.order.length) throw new Error(`run ${run.night} · ${run.venue}: ${plan.times.length} times for ${run.order.length} sets`);
    run.order.forEach((name, k) => {
      inRun.set(`${run.day}|${run.night}|${run.venue}|${name}`, { run, plan, seq: k + 1, time: plan.times[k].time });
    });
  }
  const seen = new Set();
  // The run fields one set carries, in one place: the mapped entries and the
  // created ones must be identical in shape or a new name would render as a
  // different kind of card from its neighbours.
  const runFieldsFor = (run, plan, seq, time) => ({
    time,
    approx: true,
    doors: run.doors,
    ...(plan.close ? { close: plan.close } : {}),
    ...(plan.close && plan.closeApprox ? { closeApprox: true, closeSource: plan.closeSource } : {}),
    order: { seq, of: run.order.length, source: run.source, confirmed: false },
  });

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
    const { run, plan, seq, time } = hit;
    // Not yet migrated? Then the file must still say what the run row says it
    // said — otherwise somebody edited the time by hand and the guess below
    // would be built on sand. `null` is a room the file had no time for.
    if (a.order === undefined && (a.time ?? null) !== (run.wasTime ?? null)) {
      throw new Error(`${a.name} (${a.stage}): the file says time ${JSON.stringify(a.time ?? null)} but the run row expects ${JSON.stringify(run.wasTime ?? null)} — re-read the room before re-running`);
    }
    const next = rebuild(a, runFieldsFor(run, plan, seq, time));
    if (JSON.stringify(next) !== JSON.stringify(a)) {
      changes.push(`${a.name} (${a.stage}): + night/venue, time ${JSON.stringify(a.time)} -> ${JSON.stringify(time)} (approx), doors${run.close ? '/close' : ''}, order ${seq} of ${run.order.length}`);
    }
    return next;
  });

  // A name the RUNS table DECLARED it would add gets created, in the file's own
  // entry shape, directly after the last existing set of its room — so the
  // diff stays local and artists[] keeps reading room by room.
  for (const run of runs) {
    for (const name of run.adds || []) {
      const key = `${run.day}|${run.night}|${run.venue}|${name}`;
      if (seen.has(key)) continue; // already added by an earlier run of this script
      const hit = inRun.get(key);
      if (!hit) throw new Error(`${name}: declared in adds for ${run.night} · ${run.venue} but not in that run's order`);
      const stage = `${run.night} · ${run.venue}`;
      const born = rebuild({ name, day: run.day, stage }, runFieldsFor(run, hit.plan, hit.seq, hit.time));
      const roomIdx = artists.map((a, i) => [a, i]).filter(([a]) => a && a.day === run.day && a.stage === stage).map(([, i]) => i);
      const at = roomIdx.length ? roomIdx[roomIdx.length - 1] + 1 : artists.length;
      artists.splice(at, 0, born);
      seen.add(key);
      changes.push(`${name} (${stage}): NEW entry — on the bill, missing from the file; ${hit.time} (approx), order ${hit.seq} of ${run.order.length}`);
    }
  }

  // Every name in every run must now exist — a typo would silently ship a room
  // half on the old doors time, and an undeclared missing name must never be
  // conjured into a card.
  const missing = [...inRun.keys()].filter((k) => !seen.has(k));
  if (missing.length) throw new Error(`run incomplete: no artists[] entry for ${missing.join(', ')} — check the names, nights and venues against the file, or declare the name in that run's \`adds\``);

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
    const want = [MIDWAY_TICKETS, DOTHEBAY_INDEX];
    const add = want.filter((u) => !sources.includes(u));
    const nextSources = add.length ? [...sources, ...add] : sources;
    if (nextNote !== note || add.length) {
      if (nextNote !== note) changes.push('meta.note: the back-to-back-run provenance (what is sourced, what is ours)');
      for (const u of add) changes.push(`meta.sources: + ${u}`);
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

  // The frozen-key law, proved before anything is written (MODEL-V3 §1): every
  // pre-existing name, day label and stage byte-identical and in the same
  // order. Additions are allowed — and must be exactly the ones the RUNS table
  // declared, so a stray new card can never appear by accident.
  const { additions } = additionsOnly(fest, next);
  // Declared, minus the ones a previous run already landed — so a re-run's
  // "no additions" is correct rather than a refusal.
  const declared = RUNS.flatMap((r) => (r.adds || [])
    .map((n) => `${n}|${r.day}|${r.night} · ${r.venue}`)
    .filter((k) => !(fest.artists || []).some((a) => a && `${a.name}|${a.day}|${a.stage || ''}` === k)));
  const got = additions.map((a) => `${a.name}|${a.day}|${a.stage}`);
  if (JSON.stringify([...got].sort()) !== JSON.stringify([...declared].sort())) {
    throw new Error(`REFUSING TO WRITE: the additions are not the declared ones.\n  got:      ${got.join(', ') || '(none)'}\n  declared: ${declared.join(', ') || '(none)'}`);
  }

  const after = JSON.stringify(next, null, 2);
  changes.forEach((c) => console.log(`  ${c}`));
  console.log(`\n${changes.length} entr(ies) changed; ${keysBefore.names.length} pre-existing names, ${new Set(keysBefore.days).size} day labels and ${new Set(keysBefore.stages.filter(Boolean)).size} stages untouched; ${additions.length} added.`);
  console.log(`${RUNS.length} runs: ${RUNS.map((r) => `${r.night} ${r.venue} (${r.order.length}, ${r.confidence})`).join(', ')}`);
  if (after === before) { console.log('Already migrated — nothing to write.'); process.exit(0); }
  if (check) { console.log('--check: not writing.'); process.exit(0); }
  writeFileSync(PORTOLA, after);
  console.log(`Wrote ${PORTOLA}`);
}
