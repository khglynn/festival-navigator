// OURS — "where will most of us be, and when" (design reference, round two,
// 2026-09-25). Copied from ../ours/ours-model.mjs and changed for Kevin's two
// rule answers on round one; every other rule is round one's.
//
// A pure model, runnable in Node and in the page (it imports only the app's
// own pure events.js), so the design frames show numbers this code computed
// from the real Portola file — nothing on a frame is drawn by hand. It is a
// reference for the builder, not production code: the build would read the
// wall's own plan (wallPlanFor) for its days instead of the small day mapping
// here, and the fold from ctx.folded.
//
// The rules (BRIEF.md "The logic" says why):
//   1. US = the crew members with at least one pick in this festival. A member
//      with none is not counted in anything (they may not be going). US is the
//      whole festival's, never the folded view's: hiding a room must not move
//      the bar or turn "most" into "some" at a stage you can still see.
//   2. THE BAR = max(3, ceil(US / 4)) people at one place at one time. Kevin:
//      "never show ones where it's just one or two people".
//   3. ONE BODY, ONE PLACE. Every 5 minutes each person is put at one place:
//      their highest-level live pick; a tie goes where more of the crew is,
//      then where they already were, then to the set that just began.
//   4. A PLACE is a grid set (one stage, one set) or a ROOM (a venue on a
//      night: afters, Folsom, Late nights). In a room you arrive for your
//      first pick there and stay through your last.
//   5. AN ARTIST WHO PLAYS TWICE counts at BOTH places (Kevin, round one:
//      "They might be at either. They're different locations right?"). Picks
//      are per artist, so a Groove Armada pick puts you at the Warehouse at
//      4:45 PM AND at the Great Northern at 1:30 AM. Rule 3 still holds at
//      every moment: two plays of one artist never overlap, and where they
//      did, the body would be at one. A stop whose crowd leans on such picks
//      says so (`alsoAt`), so the plan never hides that it is a maybe.
//   6. THE ROUTE is, at each moment, the place with the most of us, if it
//      clears the bar. A second place that also clears it is a FORK. Moments
//      where nothing clears it are SCATTERED.
//   7. MOST vs SOME: a stop where more than half of US are together is MOST;
//      one that only clears the bar is SOME (drawn quieter).
//   8. HIDDEN ROOMS ARE HIDDEN (Kevin, round one: respect the show menu). A
//      room folded in the show menu never appears in OURS: not as a stop, a
//      fork, a count or a line of the text a friend is sent. But bodies are
//      placed BEFORE the fold is applied (rule 3 runs on the whole festival):
//      Cy at the Folsom Street Fair is not re-seated at Mochakk because you
//      hid Folsom. Hiding changes what OURS shows, never what it counts.

import { parseEventTime, venueGroupsOf, nightOf, venueOf, isCancelled, WEEKDAYS } from '../../../../js/v3/events.js';

export const STEP = 5;          // minutes per slice
export const FLOOR_MIN = 3;     // Kevin: never one or two people
export const FLOOR_SHARE = 1 / 4;
export const MIN_STOP = 15;     // a blip shorter than this folds into its neighbour or drops
export const CHANGEOVER = 20;   // a gap shorter than this is walking between sets, not "scattered"
// The show menu's key for the festival's own room (js/v3/filters.js FEST_ROOM).
// A two-weekend fest (ACL) offers weekend rows instead; the build reads the
// wall's plan, which already knows that, rather than this constant.
export const FEST_ROOM = ':fest';

export function barFor(usCount) {
  return Math.max(FLOOR_MIN, Math.ceil(usCount * FLOOR_SHARE));
}

// Who is "us": members with a live pick (level > 0) on anything here.
export function usOf(picks, members) {
  const has = new Set();
  for (const by of Object.values(picks || {})) {
    for (const [p, lv] of Object.entries(by || {})) if (lv > 0) has.add(p);
  }
  return members.filter((m) => has.has(m));
}

// ---- places ---------------------------------------------------------------------
// Every place the festival holds, per night, on the festival-day clock
// (events.js: 9 AM starts the day, anything earlier is after midnight).
export function placesOf(fest) {
  const places = [];
  const gridDays = Object.keys(fest.days || {});
  const wdOf = (dayKey) => ((fest.dayMeta || {})[dayKey] || {}).wd || dayKey.slice(0, 3);
  // The grid: one place per set. A set with no printed end runs to the next
  // set on its stage, else an hour (the NOW build's window, 2026-09-24).
  for (const dayKey of gridDays) {
    const sets = ((fest.days[dayKey] || {}).artists || []).map((a) => ({ a, t: parseEventTime(a.time) })).filter((x) => x.t);
    for (const { a, t } of sets) {
      const next = sets.filter((y) => y.a.stage === a.stage && y.t.startMin > t.startMin).sort((x, y) => x.t.startMin - y.t.startMin)[0];
      const end = t.endMin ?? (next ? next.t.startMin : t.startMin + 60);
      places.push({
        id: `${wdOf(dayKey)}|${a.stage}|${a.name}`, night: wdOf(dayKey), kind: 'set', room: fest.name, roomKeys: [FEST_ROOM],
        place: a.stage, start: t.startMin, end, approx: false,
        acts: [{ name: a.name, from: t.startMin, to: end, time: a.time, approx: false, occ: { day: dayKey, stage: a.stage, time: a.time } }],
      });
    }
  }
  // The sections: one place per venue per night (a venue-night is one room,
  // MODEL-V4 §5). A show billed to two sections ("Afters & Folsom") is one room.
  const sectionEntries = (fest.artists || []).filter((e) => e && !gridDays.includes(e.day) && nightOf(e) && !isCancelled(e));
  const byNight = new Map();
  for (const e of sectionEntries) {
    const n = nightOf(e);
    if (!byNight.has(n)) byNight.set(n, []);
    byNight.get(n).push(e);
  }
  for (const [night, entries] of byNight) {
    for (const g of venueGroupsOf(entries)) {
      if (g.cancelled) continue;
      const doorsMin = g.doors ? (parseEventTime(g.doors) || {}).startMin ?? null : null;
      const closeMin = g.close ? (parseEventTime(g.close) || {}).startMin ?? null : null;
      const timed = g.members.filter((m) => m.nowFrom != null);
      const start = doorsMin ?? (timed.length ? Math.min(...timed.map((m) => m.nowFrom)) : null);
      let end = closeMin ?? (timed.length ? Math.max(...timed.map((m) => m.nowTo)) : null);
      if (start == null || end == null) continue; // nothing known about when: not a place on a clock
      if (end <= start) end += 24 * 60;
      const sections = [...new Set(entries.filter((e) => venueOf(e) === g.venue).map((e) => e.day))].join(' & ');
      places.push({
        id: `${night}|${g.venue}`, night, kind: 'room', room: sections, roomKeys: sections.split(' & '), place: g.venue,
        start, end, approx: !!g.closeApprox, doors: g.doors, close: g.close,
        acts: g.members.map((m) => ({
          name: m.e.name, from: m.nowFrom, to: m.nowTo, time: m.e.time || null, approx: m.approx,
          occ: { day: m.e.day, stage: m.e.stage || `${night} · ${g.venue}`, time: m.e.time || null, venue: g.venue },
        })),
      });
    }
  }
  return places;
}

// ---- who is where ------------------------------------------------------------------
// For one person, the stretch of a place they would be at, and how much they
// want it (their highest level there). Null when the place has nothing of theirs.
// Rule 5 (round two): an act that plays twice counts here like any other.
// `sure` is false when every act of theirs here also plays somewhere else.
function stretchFor(place, person, picks, doubled) {
  const lv = (name) => ((picks[name] || {})[person]) || 0;
  const mine = place.acts.filter((a) => lv(a.name) > 0);
  if (!mine.length) return null;
  const sure = mine.some((a) => !doubled.has(a.name));
  const from = Math.min(...mine.map((a) => (a.from ?? place.start)));
  const to = Math.max(...mine.map((a) => (a.to ?? place.end)));
  return { from, to, level: Math.max(...mine.map((a) => lv(a.name))), sure };
}

// Rule 8: a place is shown unless every room it belongs to is folded (a show
// billed to "Afters & Folsom" renders in both rooms, so it stays while either
// room does — the wall's own rule).
export const visibleIn = (folded) => {
  const hidden = new Set(folded || []);
  return (place) => place.roomKeys.some((k) => !hidden.has(k));
};

export function oursModel(fest, picks, members, { folded = [] } = {}) {
  const us = usOf(picks, members);
  const bar = barFor(us.length);
  const out = { us, bar, available: us.length >= FLOOR_MIN, folded: [...folded], nights: [] };
  if (!out.available) return out;
  const places = placesOf(fest);
  const seen = new Map();
  for (const p of places) for (const a of p.acts) seen.set(a.name, (seen.get(a.name) || 0) + 1);
  const doubled = new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  // Where else each doubled act plays: "also Sat, Crane Stage".
  const playsAt = new Map();
  for (const p of places) for (const a of p.acts) {
    if (!doubled.has(a.name)) continue;
    if (!playsAt.has(a.name)) playsAt.set(a.name, []);
    playsAt.get(a.name).push({ night: p.night, place: p.place, from: a.from ?? p.start, kind: p.kind });
  }
  out.playsAt = playsAt;
  const shown = visibleIn(folded);
  // A night with nothing shown on it is not a night in OURS (the wall has no
  // tab for it either).
  const nights = [...new Set(places.filter(shown).map((p) => p.night))];

  for (const night of nights) {
    const here = places.filter((p) => p.night === night);
    // Each person's stretches tonight.
    const stretches = new Map(); // place.id -> [{person, from, to, level}]
    for (const p of here) {
      const list = [];
      for (const person of us) {
        const s = stretchFor(p, person, picks, doubled);
        if (s) list.push({ person, ...s });
      }
      stretches.set(p.id, list);
    }
    const t0 = Math.min(...here.map((p) => p.start));
    const t1 = Math.max(...here.map((p) => p.end));
    const slices = [];
    const was = new Map();
    for (let t = t0; t < t1; t += STEP) {
      const live = (p) => stretches.get(p.id).filter((s) => s.from <= t && t < s.to);
      const crowd = new Map(here.map((p) => [p.id, live(p).length]));
      const at = new Map(); // person -> place
      for (const person of us) {
        let best = null;
        for (const p of here) {
          const s = live(p).find((x) => x.person === person);
          if (!s) continue;
          const key = [s.level, crowd.get(p.id), was.get(person) === p.id ? 1 : 0, p.start];
          if (!best || cmp(key, best.key) > 0) best = { p, key, level: s.level, sure: s.sure };
        }
        if (best) at.set(person, best);
      }
      for (const [person, b] of at) was.set(person, b.p.id);
      const count = new Map();
      for (const [person, b] of at) {
        if (!count.has(b.p.id)) count.set(b.p.id, { place: b.p, people: [], musts: 0, maybe: [] });
        const c = count.get(b.p.id);
        c.people.push(person);
        if (b.level === 4) c.musts += 1;
        if (!b.sure) c.maybe.push(person);
      }
      const ranked = [...count.values()].sort((a, b) => b.people.length - a.people.length || b.musts - a.musts || a.place.start - b.place.start);
      // Rule 8: everyone was placed on the whole festival above; only now is
      // the fold applied, so a hidden room's crowd is never shown and never
      // re-seated somewhere you can see.
      slices.push({ t, ranked: ranked.filter((c) => c.people.length >= bar && shown(c.place)) });
    }
    const route = routeOf(night, slices, us, bar, playsAt);
    // "Also": the other plays of the doubled acts THIS crowd picked here.
    for (const it of route.items) {
      if (it.kind !== 'stop' || !it.leansOnDoubles) continue;
      const crowd = new Set(it.maybe);
      for (const a of it.place.acts) {
        if (!playsAt.has(a.name) || !Object.entries(picks[a.name] || {}).some(([p, lv]) => lv > 0 && crowd.has(p))) continue;
        for (const o of playsAt.get(a.name)) if (!(o.night === night && o.place === it.place.place)) it.alsoAt.push({ act: a.name, ...o });
      }
    }
    out.nights.push(route);
  }
  const order = (n) => WEEKDAYS.indexOf(n);
  out.nights.sort((a, b) => order(a.night) - order(b.night));
  return out;
}

const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

// Slices -> stops, forks and scattered stretches.
function routeOf(night, slices, us, bar, playsAt = new Map()) {
  const runs = [];
  for (const s of slices) {
    const top = s.ranked[0] || null;
    const id = top ? top.place.id : null;
    const last = runs[runs.length - 1];
    if (last && last.id === id) { last.to = s.t + STEP; last.slices.push(s); } else runs.push({ id, from: s.t, to: s.t + STEP, slices: [s] });
  }
  // Fold blips: a stop shorter than MIN_STOP between two others is noise
  // (a set's last five minutes while the next one starts).
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i];
    if (r.id && r.to - r.from < MIN_STOP) {
      const prev = runs[i - 1];
      if (prev && prev.id) { prev.to = r.to; prev.slices.push(...r.slices); runs.splice(i, 1); } else r.id = null;
    }
  }
  // Merge neighbours that ended up the same place.
  for (let i = runs.length - 1; i > 0; i--) {
    if (runs[i].id === runs[i - 1].id) { runs[i - 1].to = runs[i].to; runs[i - 1].slices.push(...runs[i].slices); runs.splice(i, 1); }
  }
  const items = [];
  for (const r of runs) {
    if (!r.id) { items.push({ kind: 'scattered', from: r.from, to: r.to }); continue; }
    let peak = null;
    const forks = new Map();
    const timeline = [];
    for (const s of r.slices) {
      const top = s.ranked.find((c) => c.place.id === r.id);
      if (top) timeline.push({ t: s.t, people: top.people });
      if (top && (!peak || top.people.length > peak.people.length)) peak = { ...top, t: s.t };
      for (const c of s.ranked) {
        if (c.place.id === r.id) continue;
        const f = forks.get(c.place.id) || { place: c.place, from: s.t, to: s.t + STEP, peak: c };
        f.to = s.t + STEP;
        if (c.people.length > f.peak.people.length) f.peak = c;
        forks.set(c.place.id, f);
      }
    }
    const place = peak.place;
    const most = peak.people.length * 2 > us.length;
    // The acts the group is there for: in a room, the acts most of the people
    // at the peak picked (a room's headline for us), in play order.
    // Rule 5's honesty: when half or more of the peak crowd is here only on an
    // act that also plays elsewhere, the stop says where else (filled in by
    // oursModel, which has the picks), so the row can read "also Thu" and
    // never pass a maybe off as a plan.
    const leansOnDoubles = peak.maybe.length * 2 >= peak.people.length;
    const alsoAt = [];
    items.push({
      kind: 'stop', tier: most ? 'most' : 'some', place, from: r.from, to: r.to,
      count: peak.people.length, people: peak.people, musts: peak.musts, maybe: peak.maybe, leansOnDoubles, alsoAt, timeline,
      forks: [...forks.values()].filter((f) => f.to - f.from >= MIN_STOP).map((f) => ({ place: f.place, from: f.from, to: f.to, count: f.peak.people.length, people: f.peak.people })),
    });
  }
  // A short gap is a changeover (walking to the next stage), not scattered.
  for (let i = items.length - 1; i >= 0; i--) if (items[i].kind === 'scattered' && items[i].to - items[i].from < CHANGEOVER) items.splice(i, 1);
  // Scattered stretches only BETWEEN stops (not before the first or after the last).
  while (items.length && items[0].kind === 'scattered') items.shift();
  while (items.length && items[items.length - 1].kind === 'scattered') items.pop();
  return { night, us: us.length, bar, items, stops: items.filter((i) => i.kind === 'stop').length };
}

// The acts a room stop is "for": ordered by how many of the stop's people
// picked them, then play order; up to three.
export function headlinersOf(stop, picks) {
  const people = new Set(stop.people);
  const n = (a) => Object.entries(picks[a.name] || {}).filter(([p, lv]) => lv > 0 && people.has(p)).length;
  return stop.place.acts.map((a) => ({ ...a, n: n(a) })).filter((a) => a.n > 0)
    .sort((a, b) => b.n - a.n || (a.from ?? 0) - (b.from ?? 0)).slice(0, 3)
    .sort((a, b) => (a.from ?? 0) - (b.from ?? 0));
}

// NOW: the stop the clock is in (or the next one), for the live answer.
export function oursAt(model, night, minutes) {
  const n = model.nights.find((x) => x.night === night);
  if (!n) return { night: null, current: null, next: null, later: [] };
  const stops = n.items.filter((i) => i.kind === 'stop');
  const current = stops.find((s) => s.from <= minutes && minutes < s.to) || null;
  const scattered = n.items.find((i) => i.kind === 'scattered' && i.from <= minutes && minutes < i.to) || null;
  const after = stops.filter((s) => s.from > minutes);
  // The count NOW is the count at this minute, never the stop's peak.
  const here = current ? [...current.timeline].reverse().find((x) => x.t <= minutes) : null;
  return { night: n, current, here: here ? here.people : null, scattered, next: after[0] || null, later: after.slice(1) };
}

export const clock = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};

// What "Tell a friend where we'll be" sends (navigator.share text; the
// clipboard where there is no share sheet). Places and times only: never a
// name, never a count of who, never a link — a crew link is a credential and
// the friend is outside the circle (law 1). From now on: the stop we are in,
// then every MOST stop left tonight; a night with no MOST stop left sends its
// SOME stops instead so the message is never empty.
const DAY_WORD = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
export function shareTextOf(model, fest, picks, night, minutes = -1) {
  const n = model.nights.find((x) => x.night === night);
  if (!n) return '';
  const stops = n.items.filter((i) => i.kind === 'stop' && i.to > minutes);
  const now = stops.find((s) => s.from <= minutes) || null;
  let rest = stops.filter((s) => s !== now && s.tier === 'most');
  if (!now && !rest.length) rest = stops;
  if (!now && !rest.length) return '';
  const what = (s) => (s.place.kind === 'set'
    ? `${s.place.acts[0].name}, ${s.place.place}`
    : `${s.place.place} (${headlinersOf(s, picks).map((h) => h.name).join(', then ')})`);
  // A fork as big as the stop is a real second door: a friend needs both.
  const evenFork = (s) => s.forks.find((f) => f.count >= model.bar && f.count >= Math.ceil(s.count * 0.75) && f.to > minutes) || null;
  const forkWhat = (f) => what({ place: f.place, people: f.people });
  const lines = [`${fest.name} ${DAY_WORD[night] || night}, where most of us will be:`];
  const add = (s, head) => {
    lines.push(head);
    const f = evenFork(s);
    if (f) lines.push(`  or ${forkWhat(f)}${f.from > s.from ? ` from ${clock(f.from)}` : ''}`);
  };
  if (now) add(now, `Now: ${what(now)}, till ${clock(now.to)}`);
  for (const s of rest) add(s, `${clock(s.from)}${s.place.kind === 'room' ? ' on' : ''}: ${what(s)}`);
  return lines.join('\n');
}
