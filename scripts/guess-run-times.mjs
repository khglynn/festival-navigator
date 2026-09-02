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
//   · the event's own doors (required) and a PRINTED close (kept as printed),
//   · data/venues/index.json — the venue's routine close (by weekday, then
//     default), its doors-to-first-act gap, its headliner/support set lengths,
//   · a per-kind fallback (KIND_DEFAULTS) when the registry has nothing —
//     and every fallback is marked: closeApprox: true, closeSource says why.
// Shape of a run: first act = doors + gap; the closer ends at the close;
// the acts between are spread evenly; everything on the quarter hour, and
// nobody gets less than thirty minutes. Written back as each member's
// `time` (with `approx: true`), and `close` / `closeApprox` / `closeSource`
// on every member, which is where events.js runFactsOf reads them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activityMinutes } from '../js/time.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

function closeFor(night, profile, kind) {
  const c = profile && profile.close ? profile.close : null;
  if (c && c.byWeekday && c.byWeekday[night]) return { close: c.byWeekday[night], source: sourceOf(c), why: `venue's ${night} close` };
  if (c && c.default) return { close: c.default, source: sourceOf(c), why: "venue's routine close" };
  const d = KIND_DEFAULTS[kind] || KIND_DEFAULTS.club;
  return { close: d.close, source: null, why: `kind default (${kind})` };
}
const sourceOf = (c) => (c && Array.isArray(c.sources) && c.sources[0] && c.sources[0].url) || null;
const pick = (v, fallback) => (Number.isFinite(v) ? v : fallback);

// One run. `members` sorted by seq. Returns null when nothing can be planned.
export function planRun({ night, doors, close, closeApprox = false, closeSource = null, members, profile }) {
  if (!doors || !members || !members.length) return null;
  const D = activityMinutes(doors);
  if (!Number.isFinite(D)) return null;
  const kind = (profile && profile.kind) || 'club';
  const kd = KIND_DEFAULTS[kind] || KIND_DEFAULTS.club;
  const gap = pick(profile && profile.doorsToFirstActMin, kd.doorsToFirstActMin);
  const H = pick(profile && profile.headlinerSetMin, kd.headlinerSetMin);
  const S = pick(profile && profile.supportSetMin, kd.supportSetMin);

  let outClose = null, outApprox = false, outSource = null;
  if (close && !closeApprox) { outClose = close; outApprox = false; outSource = 'printed'; }
  else if (close && closeApprox && /^https:\/\//.test(closeSource || '')) {
    // An EVIDENCED guess — a listing printed an end for this very night
    // (19hz's "10pm-3am") though the ticket page did not — keeps its tilde
    // and beats the venue's routine close. Kevin (2026-09-02): link the
    // source, keep the guess note.
    outClose = close; outApprox = true; outSource = closeSource;
  } else {
    const c = closeFor(night, profile, kind);
    outClose = c.close; outApprox = !!c.close; outSource = c.close ? (c.source ? c.source : c.why) : null;
    if (c.close && c.source) outSource = c.source;
    if (c.close && !c.source) outSource = c.why;
  }
  let C = outClose ? activityMinutes(outClose) : null;
  if (Number.isFinite(C) && C <= D) C += 24 * 60; // a close "past midnight" on the same axis

  const n = members.length;
  const first = D + gap;
  let starts;
  if (Number.isFinite(C)) {
    const last = C - H;
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
    starts = members.map((_, i) => first + S * i);
  }
  // On the quarter hour, strictly increasing, thirty minutes apart at least.
  const rounded = [];
  for (const s of starts) {
    let m = q(s);
    if (rounded.length && m - rounded[rounded.length - 1] < MIN_SET) m = rounded[rounded.length - 1] + MIN_SET;
    rounded.push(m);
  }
  const times = members.map((mem, i) => {
    const time = clockOf(rounded[i]);
    return { name: mem.name, seq: mem.seq, min: rounded[i], time, was: mem.time || null, changed: (mem.time || null) !== time };
  });
  return { close: outClose, closeApprox: outApprox, closeSource: outSource, kind, gap, H, S, times };
}

// ---- the file ------------------------------------------------------------------
function loadRegistry() {
  const p = path.join(ROOT, 'data/venues/index.json');
  if (!fs.existsSync(p)) return { venues: {} };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
export function runsOf(fest) {
  const groups = new Map();
  for (const a of fest.artists || []) {
    if (!a.order || !Number.isInteger(a.order.seq)) continue;
    const night = a.night || (typeof a.stage === 'string' && a.stage.includes(' · ') ? a.stage.split(' · ')[0] : null);
    const venue = a.venue || (typeof a.stage === 'string' && a.stage.includes(' · ') ? a.stage.split(' · ').slice(1).join(' · ') : null);
    if (!night || !venue) continue;
    const key = `${night}|${venue}`;
    if (!groups.has(key)) groups.set(key, { night, venue, members: [] });
    groups.get(key).members.push(a);
  }
  for (const g of groups.values()) g.members.sort((x, y) => x.order.seq - y.order.seq);
  return [...groups.values()];
}
export function planFestival(fest, registry) {
  const out = [];
  for (const run of runsOf(fest)) {
    const profile = registry.venues[run.venue] || null;
    const doors = run.members.find((m) => m.doors)?.doors || null;
    const printed = run.members.find((m) => m.close && m.closeApprox !== true);
    const evidenced = !printed && run.members.find((m) => m.close && m.closeApprox === true && /^https:\/\//.test(m.closeSource || ''));
    const known = printed || evidenced || null;
    const plan = planRun({
      night: run.night, doors,
      close: known ? known.close : null, closeApprox: !printed, closeSource: evidenced ? evidenced.closeSource : null,
      members: run.members.map((m) => ({ name: m.name, seq: m.order.seq, time: m.time || null })), profile,
    });
    out.push({ ...run, doors, profile: !!profile, plan });
  }
  return out;
}
function apply(plans) {
  let changed = 0;
  for (const { members, plan } of plans) {
    if (!plan) continue;
    for (const t of plan.times) {
      const m = members.find((x) => x.name === t.name);
      if (m.time !== t.time) { m.time = t.time; changed += 1; }
      m.approx = true;
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
    if (!p.plan) { console.log(`\n${p.night} · ${p.venue}: no doors — nothing to plan`); continue; }
    const { plan } = p;
    console.log(`\n${p.night} · ${p.venue}  doors ${p.doors} → close ${plan.close || '?'}${plan.closeApprox ? ' (guess: ' + plan.closeSource + ')' : ' (printed)'}  [${plan.kind}${p.profile ? '' : ', no registry entry'}; gap ${plan.gap}m, headliner ${plan.H}m]`);
    for (const t of plan.times) console.log(`   ${String(t.seq).padStart(2)}. ${t.name.padEnd(24)} ${t.was ? t.was.padEnd(9) : '—'.padEnd(9)} → ${t.time}${t.changed ? '' : '  (same)'}`);
  }
  if (flag === '--write') {
    const n = apply(plans);
    fs.writeFileSync(file, `${JSON.stringify(fest, null, 2)}\n`);
    console.log(`\nwrote ${n} change(s) to ${path.relative(ROOT, file)}`);
  } else {
    console.log('\n(dry run — add --write to save)');
  }
}
