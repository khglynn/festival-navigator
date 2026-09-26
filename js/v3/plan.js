// OUR PLAN — where most of us will be, and when (2026-09-26).
//
// From everyone's picks, a route of stops through each night: at every five
// minutes, the place with the most of us, if it clears the bar. The rules are
// the design rounds' (claude-plans/2026-09-25-portola-live/design/ours-r2/
// ours-model.mjs, approved by Kevin in three rounds); this module is that
// model ported onto the wall's own week, so it is right on every festival we
// run — ACL's two weekends and dated Late nights included — and so the times
// it says are the times the wall's cards glow. The build log with every
// decision and every number that moved is
// claude-plans/2026-09-26-unified-build/our-plan/plan-model-log.md.
//
// Pure: no DOM, no state, no storage, no network. The caller hands in the
// festival, the picks (model.picksFor), the active member names and the show
// menu's fold; the minute ticker only calls planAt / peekOf.
//
// The rules:
//   1. US = the members with at least one pick in this festival, counted on
//      the whole festival, never the folded view (hiding a room must not move
//      the bar or turn "most" into "some" somewhere you can still see).
//   2. THE BAR = max(3, ceil(US / 4)) people at one place at one time.
//   3. ONE BODY, ONE PLACE. Every 5 minutes each person is at one place: their
//      highest-level live pick; a tie goes where more of the crew is, then
//      where they already were, then to the set that just began.
//   4. A PLACE is a grid set (one stage, one set), a ROOM (a venue on a night,
//      where you arrive for your first pick and stay through your last), or a
//      PARTY (one show in a section that reads by time — Folsom — which is its
//      own show, never a run). Windows are the wall's, by construction: a grid
//      set's comes from computeDayArtists on its weekend's sets (the grid
//      cell's), a room's members' from venueGroupsOf, a party's from
//      timeBandsOf — the same calls, on the same lists, the wall makes.
//   5. AN ARTIST WHO PLAYS TWICE counts at both places. "Twice" is two PLAYS:
//      a grid play is a stage on a weekday (ACL's W1 and W2 sets at one stage
//      on one weekday are one play), a room or party play is a venue on a
//      date. A stop whose crowd leans on such picks says where else (alsoAt).
//   6. THE ROUTE is, at each moment, the place with the most of us if it
//      clears the bar; a second place that also clears it is a FORK; moments
//      where nothing clears it are SCATTERED.
//   7. MOST (more than half of US) vs SOME (only clears the bar).
//   8. HIDDEN ROOMS ARE HIDDEN, but bodies are placed first: everyone is
//      seated on the whole festival, and only then does the show menu's fold
//      decide what is shown (the wall's own rule, read from wallPlanFor).
import { wallPlanFor, weekendRoom, computeTimesLayout, applyWeekend, nightMinutes } from './wall.js';
import { venueGroupsOf, timeBandsOf, sectionLayoutOf, BY_TIME, occOf, weekdayOfIso, parseEventTime } from './events.js';
import { festivalClock, clockLabel } from './now.js';
import { computeDayArtists } from '../time.js';
import { FEST_ROOM } from './filters.js';

export const STEP = 5;          // minutes per slice
export const FLOOR_MIN = 3;     // Kevin: never one or two people
export const FLOOR_SHARE = 1 / 4;
export const MIN_STOP = 15;     // a blip shorter than this folds into its neighbour or drops
export const CHANGEOVER = 20;   // a gap shorter than this is walking between sets, not "scattered"
export const barFor = (n) => Math.max(FLOOR_MIN, Math.ceil(n * FLOOR_SHARE));

// Who is "us": members with a live pick (level > 0) on anything here.
export function usOf(picks, members) {
  const has = new Set();
  for (const by of Object.values(picks || {})) {
    for (const [p, lv] of Object.entries(by || {})) if (lv > 0) has.add(p);
  }
  return (members || []).filter((m) => has.has(m));
}

// ---- the week ----------------------------------------------------------------------
// The week the wall draws. `sort: 'billing'` is the app's default sort: on a
// scheduled festival it changes nothing, and on a lineup it is what makes the
// wall draw a week at all (a lineup's plan has no grid and, so far, no dated
// rooms — so no nights).
const weekOf = (fest, folded) => wallPlanFor(fest, { sort: 'billing', query: '', weekend: null, folded });

// The same card identity the wall's billing list dedupes by.
const cardKey = (e) => JSON.stringify([e.name, occOf(e)]);
const dedupeByCard = (list) => {
  const seen = new Set();
  return list.filter((a) => { const k = cardKey(a); return seen.has(k) ? false : (seen.add(k), true); });
};
// The festival room's own place name (wall.js festRoomSub): what a name with
// nowhere to be groups under in the festival's room.
const festRoomSub = (fest) => (fest.subtitle || '').split(' · ')[0].trim() || fest.location || '';

const isoRe = /^\d{4}-\d{2}-\d{2}$/;
const isoPlusDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// A doors or close string on the festival-day axis, the way the prototype
// (and venueGroupsOf itself) reads them.
const atMin = (t) => (t ? (parseEventTime(t) || {}).startMin ?? null : null);

// Every place of the week, per night. A night is a DATE: every grid day on it,
// every section entry on those days, every dated extra's entries for it (ACL's
// Late nights share five dates with grid days and have five of their own). A
// day with no date keys by its tab id.
function weekPlaces(fest, whole, shown) {
  const nights = new Map();
  const nightFor = (id, iso) => {
    if (!nights.has(id)) nights.set(id, { id, iso: iso || null, wd: iso ? weekdayOfIso(iso) : null, days: [], extraKeys: [], places: [], sources: [] });
    return nights.get(id);
  };
  const shownDays = new Set(shown.model.days.map((d) => d.key));
  const shownKeys = new Set([...shown.model.sections.map((s) => s.key), ...shown.model.extras.map((e) => e.key)]);
  const twoWeekends = whole.weekends.length > 1;
  const stages = whole.scheduled ? computeTimesLayout(fest).stages : [];
  const dayByKey = new Map(whole.model.days.map((d) => [d.key, d]));

  for (const d of whole.model.days) {
    const night = nightFor(d.iso || d.key, d.iso);
    night.days.push(d);
    if (!night.wd && d.wd) night.wd = d.wd;
    if (!d.grid) continue;
    // The grid cell's window: computeDayArtists on the weekend's sets, the
    // way state.getDayArtists filters (untagged and 'both' play every
    // weekend), then wall.js renderScheduledDayBody's liveTo.
    const dayData = fest.days[d.dayKey] || {};
    const sets = (dayData.artists || []).filter((a) => !d.weekend || !a.weekend || a.weekend === 'both' || a.weekend === d.weekend);
    const computed = computeDayArtists({ ...dayData, artists: sets });
    const roomKey = twoWeekends ? weekendRoom(d.weekend) : FEST_ROOM;
    const isShown = shown.festRoom && shownDays.has(d.key);
    const playOf = (stage) => `${stage}|${d.wd || d.dayKey}`;
    for (const a of computed) {
      if (stages.indexOf(a.stage) === -1) continue; // a stray: below, as the wall draws it
      const to = a.endMin ?? a.startMin + 60;
      night.places.push({
        id: `${night.id}|set|${a.stage}|${a.name}|${a.time}`, nightId: night.id, kind: 'set', place: a.stage, room: fest.name,
        start: a.startMin, end: to, approx: false, roomKeys: [roomKey], shown: isShown, dayKey: d.dayKey,
        acts: [{ name: a.name, from: a.startMin, to, time: a.time || null, approx: false, occ: { day: d.dayKey, stage: a.stage || null, time: a.time || null, weekend: a.weekend || null }, play: playOf(a.stage), section: null }],
      });
    }
    // A set whose stage is not a column is still the festival's: the wall
    // draws it as a stack card under its own place, with the STACK's window
    // (wall.js festRoomExtras → venueGroups), so its window is read the same
    // way, from the same list. Billed names and activities are in that list
    // (they can end a stray's run) but are not places.
    const strays = computed.filter((a) => stages.indexOf(a.stage) === -1).map((a) => ({ ...a, day: d.dayKey, venue: a.stage || null }));
    if (strays.length) {
      const onGrid = new Set(computed.map((a) => a.name));
      const billed = dedupeByCard(applyWeekend(d.billing || [], d.weekend)).filter((a) => !onGrid.has(a.name));
      const activities = ((fest.activities || {})[d.dayKey] || []).map((a) => ({ name: a.name, day: d.dayKey, venue: a.venue || null, time: a.time || null }));
      const isStray = new Set(strays);
      for (const g of venueGroupsOf([...strays, ...billed, ...activities], { fallbackVenue: festRoomSub(fest) })) {
        for (const m of g.members) {
          if (!isStray.has(m.e) || m.cancelled || m.nowFrom == null || m.nowTo == null) continue;
          night.places.push({
            id: `${night.id}|set|${m.e.stage}|${m.e.name}|${m.e.time}`, nightId: night.id, kind: 'set', place: g.venue, room: fest.name,
            start: m.nowFrom, end: m.nowTo, approx: false, roomKeys: [roomKey], shown: isShown, dayKey: d.dayKey,
            acts: [{ name: m.e.name, from: m.nowFrom, to: m.nowTo, time: m.e.time || null, approx: m.approx, occ: occOf(m.e), play: playOf(m.e.stage || g.venue), section: null }],
          });
        }
      }
    }
  }
  // Sections on their days, dated extras on their dates: collected per night
  // first, because one show can be billed to two sections ("Afters & Folsom"
  // renders in both rooms) and is still one place.
  for (const s of whole.model.sections) {
    for (const [dayKey, list] of s.byDay) {
      const d = dayByKey.get(dayKey);
      if (!d) continue;
      nightFor(d.iso || d.key, d.iso).sources.push({ key: s.key, label: s.label, list, layout: sectionLayoutOf(fest, s.key) });
    }
  }
  for (const e of whole.model.extras) {
    if (!e.byDate) continue; // a section that never said when has no night to be on
    for (const [iso, list] of e.byDate) {
      const night = nightFor(iso, isoRe.test(iso) ? iso : null);
      night.extraKeys.push(e.key);
      night.sources.push({ key: e.key, label: e.label, list, layout: sectionLayoutOf(fest, e.key) });
    }
  }
  for (const night of nights.values()) roomsAndParties(night, shownKeys);
  return nights;
}

// A night's rooms (by-venue sections and extras: one place per venue) and
// parties (by-time: one place per show).
function roomsAndParties(night, shownKeys) {
  const { sources } = night;
  if (!sources.length) return;
  // Every section/extra an entry appears in on this night, and whether any of
  // them reads by venue (then the show joins that venue's room).
  const keysOf = new Map();
  const byVenueOf = new Map();
  for (const src of sources) {
    for (const e of src.list) {
      const k = cardKey(e);
      if (!keysOf.has(k)) keysOf.set(k, new Set());
      keysOf.get(k).add(src.key);
      if (src.layout !== BY_TIME && !byVenueOf.has(k)) byVenueOf.set(k, src);
    }
  }
  const labelOf = new Map(sources.map((s) => [s.key, s.label]));
  const roomOf = (keys) => [...keys].map((k) => labelOf.get(k) || k).join(' & ');
  const isShown = (keys) => [...keys].some((k) => shownKeys.has(k));

  // Rooms: venueGroupsOf on each by-venue list, exactly as the wall's stack
  // for that room calls it. A venue on one night is one room even when two
  // lists bring acts to it; an act already seated there keeps its first window.
  const rooms = new Map();
  for (const src of sources) {
    if (src.layout === BY_TIME) continue;
    for (const g of venueGroupsOf(src.list)) {
      if (g.cancelled) continue;
      const doorsMin = atMin(g.doors);
      const closeMin = atMin(g.close);
      const on = g.members.filter((m) => !m.cancelled);
      const timed = on.filter((m) => m.nowFrom != null);
      const start = doorsMin ?? (timed.length ? Math.min(...timed.map((m) => m.nowFrom)) : null);
      let end = closeMin ?? (timed.length ? Math.max(...timed.map((m) => m.nowTo)) : null);
      if (start == null || end == null) continue; // nothing known about when: not a place on a clock
      if (end <= start) end += 24 * 60;
      let r = rooms.get(g.venue);
      if (!r) {
        r = { venue: g.venue, start, end, approx: !!g.closeApprox, doors: g.doors, close: g.close, acts: [], seen: new Set(), keys: new Set() };
        rooms.set(g.venue, r);
      } else {
        r.start = Math.min(r.start, start);
        r.end = Math.max(r.end, end);
        r.approx = r.approx || !!g.closeApprox;
      }
      for (const m of on) {
        const k = cardKey(m.e);
        if (byVenueOf.get(k) !== src || r.seen.has(k)) continue;
        r.seen.add(k);
        for (const key of keysOf.get(k)) r.keys.add(key);
        r.acts.push({
          name: m.e.name, from: m.nowFrom, to: m.nowTo, time: m.e.time || null, approx: m.approx,
          occ: occOf(m.e), play: `${g.venue}|${night.id}`, section: src.key,
        });
      }
    }
  }
  for (const r of rooms.values()) {
    if (!r.acts.length) continue;
    night.places.push({
      id: `${night.id}|room|${r.venue}`, nightId: night.id, kind: 'room', place: r.venue, room: roomOf(r.keys),
      start: r.start, end: r.end, approx: r.approx, roomKeys: [...r.keys], shown: isShown(r.keys), dayKey: null,
      doors: r.doors, close: r.close, acts: r.acts,
    });
  }
  // Parties: timeBandsOf on each by-time list, as the wall's time list calls
  // it — a party's printed end wins. One place per show.
  const parties = new Set();
  const ids = new Set(night.places.map((p) => p.id));
  for (const src of sources) {
    if (src.layout !== BY_TIME) continue;
    for (const band of timeBandsOf(src.list)) {
      for (const m of band.members) {
        const k = cardKey(m.e);
        if (m.cancelled || byVenueOf.has(k) || parties.has(k)) continue;
        if (m.nowFrom == null || m.nowTo == null) continue; // no clock: not a place
        parties.add(k);
        let id = `${night.id}|party|${m.venue}|${m.e.name}|${m.e.time || ''}`;
        for (let n = 2; ids.has(id); n++) id = `${night.id}|party|${m.venue}|${m.e.name}|${m.e.time || ''}|${n}`;
        ids.add(id);
        const keys = keysOf.get(k);
        night.places.push({
          id, nightId: night.id, kind: 'party', place: m.venue, room: roomOf(keys),
          start: m.nowFrom, end: m.nowTo, approx: m.approx, roomKeys: [...keys], shown: isShown(keys), dayKey: null,
          acts: [{ name: m.e.name, from: m.nowFrom, to: m.nowTo, time: m.e.time || null, approx: m.approx, occ: occOf(m.e), play: `${m.venue}|${night.id}`, section: src.key }],
        });
      }
    }
  }
}

// ---- who is where ------------------------------------------------------------------
// For one person, the stretch of a place they would be at, and how much they
// want it (their highest level there). Null when the place has nothing of
// theirs. `sure` is false when every act of theirs here also plays elsewhere.
function stretchFor(place, person, picks, doubled) {
  const lv = (name) => ((picks[name] || {})[person]) || 0;
  const mine = place.acts.filter((a) => lv(a.name) > 0);
  if (!mine.length) return null;
  const sure = mine.some((a) => !doubled.has(a.name));
  const from = Math.min(...mine.map((a) => (a.from ?? place.start)));
  const to = Math.max(...mine.map((a) => (a.to ?? place.end)));
  return { from, to, level: Math.max(...mine.map((a) => lv(a.name))), sure };
}

const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

// One night's slices: everyone seated on every place of the night (hidden
// ones too), then the fold decides what is ranked (rule 8).
function slicesOf(here, us, picks, doubled, bar) {
  const stretches = here.map((p) => {
    const list = [];
    for (const person of us) {
      const s = stretchFor(p, person, picks, doubled);
      if (s) list.push({ person, ...s });
    }
    return list;
  });
  const t0 = Math.min(...here.map((p) => p.start));
  const t1 = Math.max(...here.map((p) => p.end));
  const slices = [];
  const was = new Map();
  for (let t = t0; t < t1; t += STEP) {
    const live = stretches.map((list) => list.filter((s) => s.from <= t && t < s.to));
    const at = new Map(); // person -> best
    for (const person of us) {
      let best = null;
      here.forEach((p, i) => {
        const s = live[i].find((x) => x.person === person);
        if (!s) return;
        const key = [s.level, live[i].length, was.get(person) === p.id ? 1 : 0, p.start];
        if (!best || cmp(key, best.key) > 0) best = { p, key, level: s.level, sure: s.sure };
      });
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
    slices.push({ t, ranked: ranked.filter((c) => c.people.length >= bar && c.place.shown) });
  }
  return slices;
}

// Slices -> stops, forks and scattered stretches (the prototype's routeOf).
function routeOf(nightId, slices, us) {
  const runs = [];
  for (const s of slices) {
    const top = s.ranked[0] || null;
    const id = top ? top.place.id : null;
    const last = runs[runs.length - 1];
    if (last && last.id === id) { last.to = s.t + STEP; last.slices.push(s); } else runs.push({ id, from: s.t, to: s.t + STEP, slices: [s] });
  }
  // Fold blips: a stop shorter than MIN_STOP joins the stop before it, else
  // is nothing (a set's last five minutes while the next one starts).
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i];
    if (r.id && r.to - r.from < MIN_STOP) {
      const prev = runs[i - 1];
      if (prev && prev.id) { prev.to = r.to; prev.slices.push(...r.slices); runs.splice(i, 1); } else r.id = null;
    }
  }
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
    items.push({
      kind: 'stop', tier: peak.people.length * 2 > us.length ? 'most' : 'some', nightId, place, placeKind: place.kind, acts: place.acts,
      from: r.from, to: r.to, count: peak.people.length, people: peak.people, musts: peak.musts, maybe: peak.maybe,
      leansOnDoubles: peak.maybe.length * 2 >= peak.people.length, alsoAt: [], timeline,
      forks: [...forks.values()].filter((f) => f.to - f.from >= MIN_STOP)
        .map((f) => ({ place: f.place, placeKind: f.place.kind, from: f.from, to: f.to, count: f.peak.people.length, people: f.peak.people })),
    });
  }
  // A short gap is a changeover (walking to the next stage), not scattered;
  // and scattered only BETWEEN stops.
  for (let i = items.length - 1; i >= 0; i--) if (items[i].kind === 'scattered' && items[i].to - items[i].from < CHANGEOVER) items.splice(i, 1);
  while (items.length && items[0].kind === 'scattered') items.shift();
  while (items.length && items[items.length - 1].kind === 'scattered') items.pop();
  return items;
}

// ---- the plan ------------------------------------------------------------------------
export function planOf(fest, { picks = {}, members = [], folded = [] } = {}) {
  picks = picks || {};
  folded = Array.isArray(folded) ? folded : [];
  const us = usOf(picks, members);
  const bar = barFor(us.length);
  const available = us.length >= FLOOR_MIN;
  const empty = { us, bar, available, folded: [...folded], nights: [], night: () => null, playsAt: new Map(), places: [] };
  const whole = available && fest ? weekOf(fest, []) : null;
  if (!whole) return empty;
  const shown = weekOf(fest, folded) || whole;
  const byId = weekPlaces(fest, whole, shown);
  // Nights in date order; a night with no date (a festival whose file gives
  // none) after them, in the week's order.
  const all = [...byId.values()];
  const ordered = [...all.filter((n) => n.iso).sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0)), ...all.filter((n) => !n.iso)];
  const places = ordered.flatMap((n) => n.places);

  // Rule 5: an act with two or more PLAYS anywhere in the festival (hidden
  // rooms included) counts at every one; where else it plays, per act.
  const plays = new Map();
  for (const p of places) for (const a of p.acts) {
    if (!plays.has(a.name)) plays.set(a.name, []);
    plays.get(a.name).push({ nightId: p.nightId, place: p.place, from: a.from ?? p.start, kind: p.kind, play: a.play, shown: p.shown });
  }
  const doubled = new Set([...plays].filter(([, list]) => new Set(list.map((o) => o.play)).size > 1).map(([name]) => name));
  const playsAt = new Map([...plays].filter(([name]) => doubled.has(name)));

  // A night with nothing shown on it is not a night in the plan (the wall has
  // no tab for it either).
  const nights = ordered.filter((n) => n.places.some((p) => p.shown))
    .map((n) => ({ id: n.id, iso: n.iso, wd: n.wd, days: n.days, extraKeys: [...new Set(n.extraKeys)] }));
  const listed = new Set(nights.map((n) => n.id));
  const memo = new Map();
  const night = (id) => {
    if (!listed.has(id)) return null;
    if (memo.has(id)) return memo.get(id);
    const n = byId.get(id);
    const items = n.places.length ? routeOf(id, slicesOf(n.places, us, picks, doubled, bar), us) : [];
    // "Also": the other plays of the doubled acts THIS crowd picked here — a
    // play the show menu hides is not mentioned (rule 8).
    for (const it of items) {
      if (it.kind !== 'stop' || !it.leansOnDoubles) continue;
      const crowd = new Set(it.maybe);
      for (const a of it.place.acts) {
        if (!playsAt.has(a.name) || !Object.entries(picks[a.name] || {}).some(([p, lv]) => lv > 0 && crowd.has(p))) continue;
        for (const o of playsAt.get(a.name)) if (o.play !== a.play && o.shown) it.alsoAt.push({ act: a.name, ...o });
      }
    }
    const out = { id, iso: n.iso, wd: n.wd, items, stops: items.filter((i) => i.kind === 'stop').length };
    memo.set(id, out);
    return out;
  };
  return { us, bar, available, folded: [...folded], nights, night, playsAt, places };
}

// ---- readers ---------------------------------------------------------------------------
function atOn(plan, id, minutes) {
  const n = plan.night(id);
  if (!n) return null;
  const stops = n.items.filter((i) => i.kind === 'stop');
  const current = stops.find((s) => s.from <= minutes && minutes < s.to) || null;
  const scattered = n.items.find((i) => i.kind === 'scattered' && i.from <= minutes && minutes < i.to) || null;
  const after = stops.filter((s) => s.from > minutes);
  // The count NOW is the count at this minute, never the stop's peak.
  const here = current ? [...current.timeline].reverse().find((x) => x.t <= minutes) : null;
  return { night: n, minutes, current, here: here ? here.people : null, scattered, next: after[0] || null, later: after.slice(1) };
}

// Where the plan stands at `date`: tonight's night on the festival clock —
// or LAST night, while it is still going. The clock rolls to the next day at
// 5 AM, but a night does not end on the clock's say-so (Aftershock prints 3
// to 10 AM "Saturday"; wall.js nightMinutes): until the previous night's
// last stop is over, that night is the one being lived.
export function planAt(plan, fest, date) {
  if (!plan || !plan.nights || !plan.nights.length) return null;
  const clock = festivalClock(date, (fest && fest.timezone) || null);
  const has = (id) => plan.nights.some((n) => n.id === id);
  const prevIso = isoPlusDays(clock.iso, -1);
  if (prevIso && has(prevIso)) {
    const m = nightMinutes(prevIso, clock);
    const at = m == null ? null : atOn(plan, prevIso, m);
    if (at && at.night.items.some((i) => i.kind === 'stop' && i.to > m)) return at;
  }
  return has(clock.iso) ? atOn(plan, clock.iso, clock.minutes) : null;
}

// What the peek shows: the stop the clock is in (NOW, with the count at this
// minute), else the next time MOST of us meet, else the next stop (NEXT, with
// its peak). When tonight has nothing left, the next night that has a stop,
// `today: false` — whether to show it is the UI's call.
const nextOf = (stops) => stops.find((x) => x.tier === 'most') || stops[0] || null;
export function peekOf(plan, fest, date) {
  if (!plan || !plan.nights || !plan.nights.length) return null;
  const at = planAt(plan, fest, date);
  if (at) {
    if (at.current) return { night: at.night, stop: at.current, tag: 'now', count: (at.here || at.current.people).length, today: true };
    const s = nextOf([at.next, ...at.later].filter(Boolean));
    if (s) return { night: at.night, stop: s, tag: 'next', count: s.count, today: true };
  }
  const after = at ? at.night.iso : festivalClock(date, (fest && fest.timezone) || null).iso;
  for (const n of plan.nights) {
    if (!n.iso || !(n.iso > after)) continue;
    const route = plan.night(n.id);
    const s = nextOf(route.items.filter((i) => i.kind === 'stop'));
    if (s) return { night: route, stop: s, tag: 'next', count: s.count, today: false };
  }
  return null;
}

// The one fork row a stop shows: a fork as big as the stop that overlaps most
// of it (a real second door), else the biggest. Only forks still to run when
// `nowMin` is given (the NOW row).
export function forkFor(stop, bar, nowMin = null) {
  const fs = stop.forks.filter((f) => f.count >= bar && (nowMin == null || f.to > nowMin));
  const even = fs.find((f) => f.count >= stop.count && (Math.min(f.to, stop.to) - Math.max(f.from, stop.from)) >= 0.6 * (stop.to - stop.from));
  return even || fs.sort((a, b) => b.count - a.count || a.from - b.from)[0] || null;
}

// The acts a room stop is "for": ordered by how many of the stop's people
// picked them, then play order; up to three, in play order.
export function headlinersOf(stop, picks) {
  const people = new Set(stop.people);
  const n = (a) => Object.entries(picks[a.name] || {}).filter(([p, lv]) => lv > 0 && people.has(p)).length;
  return stop.place.acts.map((a) => ({ ...a, n: n(a) })).filter((a) => a.n > 0)
    .sort((a, b) => b.n - a.n || (a.from ?? 0) - (b.from ?? 0)).slice(0, 3)
    .sort((a, b) => (a.from ?? 0) - (b.from ?? 0));
}

// The NOW row's "till": a set's (or a party's) own end — the route may move
// on before the set is over — and a room's stop end.
export function tillOf(stop) {
  if (!stop) return null;
  if (stop.place.kind === 'room') return stop.to;
  const a = stop.place.acts[0];
  return (a && a.to != null) ? a.to : stop.place.end;
}

// The row's "also …": each other play once — on the same night by its time,
// on another night by the night — same night first, then the nights in date
// order.
export function alsoOf(stop, plan) {
  if (!stop || !stop.alsoAt || !stop.alsoAt.length) return [];
  const order = new Map();
  for (const p of (plan && plan.places) || []) if (!order.has(p.nightId)) order.set(p.nightId, order.size);
  const seen = new Set();
  const out = [];
  for (const o of stop.alsoAt) {
    const sameNight = o.nightId === stop.nightId;
    const key = sameNight ? `t${o.from}` : `n${o.nightId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ nightId: o.nightId, from: o.from, sameNight });
  }
  const rank = (o) => (o.sameNight ? -1 : order.has(o.nightId) ? order.get(o.nightId) : Infinity);
  return out.sort((a, b) => rank(a) - rank(b) || (a.sameNight ? a.from - b.from : 0));
}

// "9 PM", "9:40 PM", "12 AM": the clock with ":00" dropped.
export const quietClock = (min) => clockLabel(min).replace(':00 ', ' ');
