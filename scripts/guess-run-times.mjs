#!/usr/bin/env node
// Guess the set times of a back-to-back run from what the VENUE usually does.
//
//   node scripts/guess-run-times.mjs <festival-id>            # show the plan
//   node scripts/guess-run-times.mjs <festival-id> --write    # write it
//
// A club night prints doors and a bill, rarely set times. MODEL-V3 §5 says
// the guess is data-entry judgment recorded per event — never inferred at
// render time — and this is the data-entry tool: deterministic, reviewable
// as a diff, re-runnable when the registry learns more. Inputs, in order:
//   · the event's own doors (required) and a close — kept when a page
//     printed it (no `closeApprox`) or printed it for THIS night (a
//     `closeApprox` whose `closeSource` is an https link: 19hz's "10pm-3am"),
//   · data/venues/index.json — the venue's routine close (by weekday, then
//     default), its doors-to-first-act gap, its headliner/support set lengths,
//   · a per-kind fallback (KIND_DEFAULTS) when the registry has nothing.
// A close from the registry or the fallback is written with `closeApprox:
// true` and a `closeSource` that names the rule, never a URL — so the next
// run re-reads the registry instead of mistaking its own guess for a page.
//
// A ROOM is one venue on one night of one section: a weekday section groups
// by night + venue, a dated one (ACL's Late nights, Sep 29 – Oct 10) by date +
// venue — the same identity the wall and the zoom read (events.js nightOf /
// dateOf / venueOf). A room whose sets carry an `order` is a run. A room of
// ONE act whose set already has a time is a run of one (the validator forbids
// an order on it — nothing to sequence — but its guess is re-laid here like
// any other, so a re-run reproduces it); a room with no clock at all stays
// timeless (MODEL-V3 §5 — TIME TBA; give it a time marked approx to opt in).
// A room of two or more with no order is not guessed: the validator already
// says it cannot tell who is on when. A by-time section (dayMeta layout) has
// no rooms at all — each party is its own show.
//
// The SHAPE of a night — the registry's `shape`, else what its `kind` says
// (club / bar → "club", hall / outdoor → "concert"):
//   · club — a night that runs to the close (a DJ bill): the first act at
//     doors + gap, the closer ends at the close, the acts between spread
//     evenly, and nobody gets under thirty minutes;
//   · concert — a bill that ends when its headliner does: the first act at
//     its posted time (a posted opener IS the first act) or doors + gap, each
//     act after it by the support slot, and the close is a CAP (a curfew),
//     never a target — when it binds, the headliner still plays a full set
//     and the openers move earlier to fit, never before doors. Only the
//     venue's word caps (printed, evidenced, its routine hours): the kind's
//     fallback close is a guess that draws the window and schedules nobody.
//     A 7 PM-doors
//     show does not run to midnight: laid back from a 2 AM close, Palace got
//     12:30 AM behind 7 PM doors (ACL, 2026-09-26).
// A guess that is early costs a friend some waiting; one that is late makes
// them miss the act — the concert shape is the one that errs early.
// A set with a time and no `approx` is POSTED: its time is never touched,
// it is a fixed point the guesses around it respect (a guess never lands on
// or past a posted set that follows it), and a room where every set is posted
// is skipped. Everything is on the quarter hour. Written back as each guessed
// set's `time` (with `approx: true`), and the close on every member of the
// room. (`closeSource` is provenance for whoever reads the file; nothing in
// js/ renders it.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activityMinutes } from '../js/time.js';
import { nightOf, dateOf, venueOf, showsOnItsOwn } from '../js/v3/events.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A concert bill ends when its headliner does; a club night runs to the close.
// The registry may say which outright (`shape`); otherwise the kind decides.
const CONCERT_KINDS = new Set(['hall', 'outdoor']);
export const shapeOf = (profile, kind) => (profile && (profile.shape === 'concert' || profile.shape === 'club')
  ? profile.shape
  : CONCERT_KINDS.has(kind) ? 'concert' : 'club');

// What a room of this kind usually does when the registry cannot say.
export const KIND_DEFAULTS = {
  club: { close: '2 AM', doorsToFirstActMin: 30, headlinerSetMin: 90, supportSetMin: 60 },
  hall: { close: '12 AM', doorsToFirstActMin: 60, headlinerSetMin: 90, supportSetMin: 45 },
  bar: { close: '2 AM', doorsToFirstActMin: 30, headlinerSetMin: 90, supportSetMin: 60 },
  outdoor: { close: null, doorsToFirstActMin: 30, headlinerSetMin: 90, supportSetMin: 60 },
};
const MIN_SET = 30;

// Minutes on the festival-day axis (time.js activityMinutes: minutes since
// midnight, with anything before 9 AM pushed a day later — 2 AM is 26 h) back
// to the file's own clock strings: "10 PM", "12:30 AM".
export function clockOf(mins) {
  const total = ((Math.round(mins) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h24 < 12 ? 'AM' : 'PM'}`;
}
const q = (m) => Math.round(m / 15) * 15;
const qDown = (m) => Math.floor(m / 15) * 15;

// The registry's close for a night, and the rule that gave it. The registry
// keeps its own sources (data/venues/index.json); copying one of its URLs
// onto the event is what made a routine close read as per-night proof.
function closeFor(night, profile, kind) {
  const c = profile && profile.close ? profile.close : null;
  if (c && c.byWeekday && c.byWeekday[night]) return { close: c.byWeekday[night], why: `venue's ${night} close`, known: true };
  if (c && c.default) return { close: c.default, why: "venue's routine close", known: true };
  const d = KIND_DEFAULTS[kind] || KIND_DEFAULTS.club;
  return { close: d.close, why: `kind default (${kind})`, known: false };
}
const pick = (v, fallback) => (Number.isFinite(v) ? v : fallback);

// One run. `members` sorted by seq; a member with `posted: true` keeps its
// own time. Returns null when nothing can be planned.
export function planRun({ night, doors, close, closeApprox = false, closeSource = null, members, profile }) {
  if (!doors || !members || !members.length) return null;
  const D = activityMinutes(doors);
  if (!Number.isFinite(D)) return null;
  const kind = (profile && profile.kind) || 'club';
  const kd = KIND_DEFAULTS[kind] || KIND_DEFAULTS.club;
  const gap = pick(profile && profile.doorsToFirstActMin, kd.doorsToFirstActMin);
  const H = pick(profile && profile.headlinerSetMin, kd.headlinerSetMin);
  const S = pick(profile && profile.supportSetMin, kd.supportSetMin);

  // `known`: the close is the venue's word (printed, evidenced for the night,
  // or its routine hours) rather than the kind's fallback — only a known close
  // may pull a concert's starts earlier; a fallback only draws the window.
  let outClose = null, outApprox = false, outSource = null, known = true;
  if (close && !closeApprox) { outClose = close; outApprox = false; outSource = 'printed'; }
  else if (close && closeApprox && /^https:\/\//.test(closeSource || '')) {
    // An EVIDENCED guess — a listing printed an end for this very night
    // (19hz's "10pm-3am") though the ticket page did not — keeps its tilde
    // and beats the venue's routine close. Kevin (2026-09-02): link the
    // source, keep the guess note.
    outClose = close; outApprox = true; outSource = closeSource;
  } else {
    const c = closeFor(night, profile, kind);
    outClose = c.close; outApprox = !!c.close; outSource = c.close ? c.why : null; known = c.known;
  }
  let C = outClose ? activityMinutes(outClose) : null;
  if (Number.isFinite(C) && C <= D) C += 24 * 60; // a close "past midnight" on the same axis

  const n = members.length;
  // A posted set is a fixed point on the clock: its own time, never a guess.
  const fixed = members.map((m) => {
    if (!m.posted || !m.time) return null;
    const t = activityMinutes(m.time);
    return Number.isFinite(t) ? t : null;
  });
  const shape = shapeOf(profile, kind);
  let starts;
  if (shape === 'concert') {
    // A concert bill: the first act at its posted time (a posted opener IS the
    // first act's start) or doors + gap; each act after it by the support
    // slot; the close caps the headliner — who still plays a full set, the
    // openers moving earlier to fit, never before doors.
    // A known close is a curfew the headliner's full set ends by; the kind's
    // fallback is itself a guess, so it only keeps the closer inside the
    // window it draws (a 9:30 PM-doors DJ night is not three half-hour sets
    // because a hall "usually" shuts at midnight).
    const first = fixed[0] !== null ? fixed[0] : D + gap;
    let last = first + S * (n - 1);
    if (Number.isFinite(C)) last = Math.min(last, known ? C - H : C - MIN_SET);
    const open = fixed[0] !== null ? fixed[0] : Math.max(D, Math.min(first, last - S * (n - 1)));
    last = Math.max(last, open + (n - 1) * MIN_SET);
    starts = n === 1 ? [open] : members.map((_, i) => open + ((last - open) * i) / (n - 1));
  } else if (Number.isFinite(C)) {
    const first = D + gap;
    // A fair share: the closer's set shrinks (never below an hour) before
    // any support is squeezed under 45 minutes — a two-hour closing set on
    // a four-act bill was leaving three half-hour openers.
    const fairH = Math.max(60, Math.min(H, (C - first) - (n - 1) * 45));
    const last = C - fairH;
    if (n === 1) starts = [first];
    else if (last - first >= (n - 1) * MIN_SET) starts = members.map((_, i) => first + ((last - first) * i) / (n - 1));
    else {
      // A crowded bill: equal slots inside the window; if even thirty-minute
      // slots do not fit after the gap, the first act goes on nearer doors.
      let f = first;
      let slot = (C - f) / n;
      if (slot < MIN_SET) { f = Math.max(D, C - n * MIN_SET); slot = Math.max(MIN_SET, (C - f) / n); }
      starts = members.map((_, i) => f + slot * i);
    }
  } else {
    starts = members.map((_, i) => D + gap + S * i);
  }
  // On the quarter hour, strictly increasing, thirty minutes apart at least —
  // and a guess never lands on or past a posted set that follows it: with k
  // guesses still to place before that set, the guess starts k half-hours
  // ahead of it at the latest. (Devil May Care, 2026-09-26: a registry gap
  // put Bambi's guess ON Rebecca Black's posted 11:45 PM.) When the posted
  // sets leave no room for thirty-minute slots, the plan says so.
  const rounded = [];
  const warnings = [];
  for (let i = 0; i < n; i++) {
    if (fixed[i] !== null) {
      if (rounded.length && fixed[i] <= rounded[rounded.length - 1]) warnings.push(`${members[i].name}'s posted ${members[i].time} is not after the set before it`);
      rounded.push(fixed[i]);
      continue;
    }
    let m = q(starts[i]);
    if (rounded.length && m - rounded[rounded.length - 1] < MIN_SET) m = rounded[rounded.length - 1] + MIN_SET;
    const j = fixed.findIndex((v, k) => k > i && v !== null);
    if (j > -1) {
      const ceiling = qDown(fixed[j] - (j - i) * MIN_SET);
      if (m > ceiling) {
        m = Math.max(ceiling, D);
        if (rounded.length && m - rounded[rounded.length - 1] < MIN_SET) warnings.push(`no thirty-minute slot for ${members[i].name} between the posted sets`);
      }
    }
    rounded.push(m);
  }
  const times = members.map((mem, i) => {
    const time = mem.posted ? mem.time : clockOf(rounded[i]);
    return { name: mem.name, seq: mem.seq, min: rounded[i], time, was: mem.time || null, changed: (mem.time || null) !== time, posted: !!mem.posted };
  });
  return { close: outClose, closeApprox: outApprox, closeSource: outSource, kind, shape, gap, H, S, times, warnings };
}

// ---- the file ------------------------------------------------------------------
export function loadRegistry() {
  const p = path.join(ROOT, 'data/venues/index.json');
  if (!fs.existsSync(p)) return { venues: {} };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
// The weekday of an ISO date, in the file's own labels — a dated room reads
// the registry's by-weekday close the way a weekday room does.
const WEEKDAY_OF = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const weekdayOfIso = (iso) => WEEKDAY_OF[new Date(`${iso}T12:00:00Z`).getUTCDay()];

// The room a set plays in (see the header): one section, one night or date,
// one venue. The file's own readers decide, so the tool and the wall can
// never disagree about which sets share a room.
export function roomOf(a) {
  const date = dateOf(a);
  const night = nightOf(a) || (date ? weekdayOfIso(date) : null);
  const venue = venueOf(a);
  if (!night || !venue) return null;
  return { key: `${a.day || ''}|${date || night}|${venue}`, night, date, venue };
}
const seqOf = (a) => (a.order && Number.isInteger(a.order.seq) ? a.order.seq : 1);
export function runsOf(fest) {
  const rooms = new Map();
  for (const a of fest.artists || []) {
    if (!a || a.cancelled) continue; // a cancelled show takes no slot in the run (docs/add-a-festival.md, "Cancelled acts")
    if (showsOnItsOwn(fest, a)) continue; // a by-time section has no rooms
    const room = roomOf(a);
    if (!room) continue;
    if (!rooms.has(room.key)) rooms.set(room.key, { night: room.night, date: room.date, venue: room.venue, members: [] });
    rooms.get(room.key).members.push(a);
  }
  const runs = [];
  for (const r of rooms.values()) {
    const numbered = r.members.filter((a) => a.order && Number.isInteger(a.order.seq));
    if (numbered.length) runs.push({ ...r, members: numbered.sort((x, y) => x.order.seq - y.order.seq) });
    else if (r.members.length === 1 && r.members[0].time) runs.push(r); // a run of one; a timeless room stays timeless
  }
  return runs;
}
// A set with a time the venue gave us, not one we guessed.
const isPosted = (m) => !!m.time && m.approx !== true;
export function planFestival(fest, registry) {
  const out = [];
  for (const run of runsOf(fest)) {
    const profile = registry.venues[run.venue] || null;
    const doors = run.members.find((m) => m.doors)?.doors || null;
    if (run.members.every(isPosted)) { out.push({ ...run, doors, profile: !!profile, plan: null, allPosted: true }); continue; }
    const printed = run.members.find((m) => m.close && m.closeApprox !== true);
    const evidenced = !printed && run.members.find((m) => m.close && m.closeApprox === true && /^https:\/\//.test(m.closeSource || ''));
    const known = printed || evidenced || null;
    const plan = planRun({
      night: run.night, doors,
      close: known ? known.close : null, closeApprox: !printed, closeSource: evidenced ? evidenced.closeSource : null,
      members: run.members.map((m) => ({ name: m.name, seq: seqOf(m), time: m.time || null, posted: isPosted(m) })), profile,
    });
    out.push({ ...run, doors, profile: !!profile, plan });
  }
  return out;
}
export function applyPlans(plans) {
  let changed = 0;
  for (const { members, plan } of plans) {
    if (!plan) continue;
    for (const t of plan.times) {
      const m = members.find((x) => x.name === t.name);
      if (!t.posted) {
        if (m.time !== t.time) { m.time = t.time; changed += 1; }
        m.approx = true;
      }
      if (plan.close) {
        if (m.close !== plan.close || (m.closeApprox === true) !== plan.closeApprox) changed += 1;
        m.close = plan.close;
        if (plan.closeApprox) { m.closeApprox = true; m.closeSource = plan.closeSource; } else { delete m.closeApprox; delete m.closeSource; }
      }
    }
  }
  return changed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [id, flag] = process.argv.slice(2);
  if (!id) { console.error('usage: node scripts/guess-run-times.mjs <festival-id> [--write]'); process.exit(2); }
  const file = path.join(ROOT, 'data/festivals', `${id}.json`);
  const fest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const plans = planFestival(fest, loadRegistry());
  for (const p of plans) {
    const where = `${p.date ? `${p.night} ${p.date}` : p.night} · ${p.venue}`;
    if (!p.plan) { console.log(`\n${where}: ${p.allPosted ? 'every set is posted — left alone' : 'no doors — nothing to plan'}`); continue; }
    const { plan } = p;
    console.log(`\n${where}  doors ${p.doors} → close ${plan.close || '?'}${!plan.close ? ' (none known)' : plan.closeApprox ? ' (guess: ' + plan.closeSource + ')' : ' (printed)'}  [${plan.kind}, ${plan.shape}${p.profile ? '' : ', no registry entry'}; gap ${plan.gap}m, headliner ${plan.H}m, support ${plan.S}m]`);
    for (const t of plan.times) console.log(`   ${String(t.seq).padStart(2)}. ${t.name.padEnd(24)} ${t.was ? t.was.padEnd(9) : '—'.padEnd(9)} → ${t.time}${t.posted ? '  (posted)' : t.changed ? '' : '  (same)'}`);
    for (const w of plan.warnings || []) console.log(`   ! ${w}`);
  }
  if (flag === '--write') {
    const n = applyPlans(plans);
    fs.writeFileSync(file, `${JSON.stringify(fest, null, 2)}\n`);
    console.log(`\nwrote ${n} change(s) to ${path.relative(ROOT, file)}`);
  } else {
    console.log('\n(dry run — add --write to save)');
  }
}
