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
// festival, the picks (model.picksFor), the active member names, the show
// menu's fold and the people highlight (rule 10); the minute ticker only calls
// planAt / peekOf.
//
// The rules:
//   1. US = the members with at least one pick in this festival, counted on
//      the whole festival, never the folded view (hiding a room must not move
//      the bar or turn "most" into "some" somewhere you can still see).
//   2. THE BAR = max(3, ceil(US / 4)) people at one place at one time.
//   3. ONE BODY, ONE PLACE. Every 5 minutes each person is at one place: their
//      highest-level live pick; a tie goes where more of the crew is, then
//      where they already were, then to the set that just began. A body
//      crosses town at most once per site (Kevin, 2026-09-26, "move only for
//      something better, never back"): a person changes SITE — the grounds,
//      or one venue — only for a pick they want more than anything of theirs
//      not yet over where they are, and would catch (not the tail of a set
//      long under way), or once nothing of theirs is left there; and never
//      goes back to a site they left that night.
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
//   9. A DROP-IN ROOM (Despacio: one seven-hour set people drift through) is
//      DECLARED by the festival file (`"dropIn": true` on the grid set or the
//      section entry; a venue room is one when every act in it is), never
//      inferred — the validator asks a data author about a stage whose whole
//      day is one set, and the plan never guesses. In seating it yields to
//      any real live pick of that person, whatever the levels (it is there
//      all day, so it only fills a person's real gaps), and it never holds a
//      body against a trip (rule 3). It is never a stop, never a fork and
//      never the peek: it is one quiet line per night (route.dropIns, when
//      its pickers clear the bar), and a scattered stretch it gathers the bar
//      in says so (item.dropIn: "Between sets · Despacio").
//  10. A HIGHLIGHT FILTERS (Kevin, 2026-09-26: "filter to, because of how the
//      picks view works"). Bodies are seated on the whole crew exactly as
//      without it (rule 8's pattern: one body is in one place whoever is
//      looking); then only the highlighted people's seats are counted. THE
//      GROUP = the highlighted people with a pick here; its bar is
//      barForGroup: two to four are "two is together" (a plan is where people
//      meet; one of them alone is not a stop, and the rows name who is
//      where), five and up the crew's own barFor — nine of nine is the crew's
//      own route. A group of one sees their own route (bar 1), with the picks
//      they would give up as "or" lines (`alt`). The frames compared bar 1 for
//      three (the brief's start): every lone choice became a stop and a fork.
//      Whether a place is one of theirs is filters.js passesPeople — the one
//      predicate the List and the Board ask too — so they never disagree.
// Rules 9 and 10 are the plan-days build's (claude-plans/2026-09-26-unified-build/
// plan-days-design/DESIGN.md, Kevin's calls of 2026-09-26).
import { wallPlanFor, weekendRoom, computeTimesLayout, applyWeekend, nightMinutes } from './wall.js';
import { venueGroupsOf, timeBandsOf, sectionLayoutOf, BY_TIME, occOf, weekdayOfIso, parseEventTime } from './events.js';
import { festivalClock, clockLabel } from './now.js';
import { computeDayArtists } from '../time.js';
import { FEST_ROOM, passesPeople } from './filters.js';

export const STEP = 5;          // minutes per slice
export const FLOOR_MIN = 3;     // Kevin: never one or two people
export const FLOOR_SHARE = 1 / 4;
export const MIN_STOP = 15;     // a blip shorter than this folds into the stop before it while that stop's place plays on; after, it stands; first, it drops
export const CHANGEOVER = 20;   // a gap shorter than this is walking between sets, not "scattered"
export const barFor = (n) => Math.max(FLOOR_MIN, Math.ceil(n * FLOOR_SHARE));
// Rule 10: a highlighted group's bar. One person is their own day (1); two to
// four are "two is together" (2: a plan is where people meet, and one of them
// alone is not a stop); from five the crew's own bar (DESIGN.md C6, settled
// 2026-09-26: at a floor of two, eight highlighted friends got a busier plan
// than a crew of eight would, and nine jumped to three).
export const GROUP_FLOOR = 2;
export const barForGroup = (n) => (n <= 1 ? 1 : n <= 4 ? GROUP_FLOOR : barFor(n));

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
    if (!nights.has(id)) nights.set(id, { id, iso: iso || null, wd: iso ? weekdayOfIso(iso) : null, places: [], sources: [] });
    return nights.get(id);
  };
  const shownDays = new Set(shown.model.days.map((d) => d.key));
  const shownKeys = new Set([...shown.model.sections.map((s) => s.key), ...shown.model.extras.map((e) => e.key)]);
  const twoWeekends = whole.weekends.length > 1;
  const stages = whole.scheduled ? computeTimesLayout(fest).stages : [];
  const dayByKey = new Map(whole.model.days.map((d) => [d.key, d]));

  for (const d of whole.model.days) {
    const night = nightFor(d.iso || d.key, d.iso);
    if (!night.wd && d.wd) night.wd = d.wd;
    if (!d.grid) continue;
    // The grid cell's window: computeDayArtists on the weekend's sets, the
    // way state.getDayArtists filters (untagged and 'both' play every
    // weekend), then wall.js renderScheduledDayBody's liveTo.
    const dayData = fest.days[d.dayKey] || {};
    const sets = (dayData.artists || []).filter((a) => !d.weekend || !a.weekend || a.weekend === 'both' || a.weekend === d.weekend);
    const computed = computeDayArtists({ ...dayData, artists: sets });
    // Rule 9: the grid sets the file declares drop-in rooms.
    const declared = new Set(sets.filter((a) => a.dropIn === true).map((a) => `${a.stage}|${a.name}|${a.time}`));
    const dropInSet = (a) => declared.has(`${a.stage}|${a.name}|${a.time}`);
    const roomKey = twoWeekends ? weekendRoom(d.weekend) : FEST_ROOM;
    const isShown = shown.festRoom && shownDays.has(d.key);
    const playOf = (stage) => `${stage}|${d.wd || d.dayKey}`;
    for (const a of computed) {
      if (stages.indexOf(a.stage) === -1) continue; // a stray: below, as the wall draws it
      const to = a.endMin ?? a.startMin + 60;
      night.places.push({
        id: `${night.id}|set|${a.stage}|${a.name}|${a.time}`, nightId: night.id, kind: 'set', place: a.stage, room: fest.name,
        start: a.startMin, end: to, approx: false, roomKeys: [roomKey], shown: isShown, dayKey: d.dayKey, dropIn: dropInSet(a),
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
            start: m.nowFrom, end: m.nowTo, approx: false, roomKeys: [roomKey], shown: isShown, dayKey: d.dayKey, dropIn: dropInSet(m.e),
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
      nightFor(iso, isoRe.test(iso) ? iso : null).sources.push({ key: e.key, label: e.label, list, layout: sectionLayoutOf(fest, e.key) });
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
          occ: occOf(m.e), play: `${g.venue}|${night.id}`, section: src.key, dropIn: m.e.dropIn === true,
        });
      }
    }
  }
  for (const r of rooms.values()) {
    if (!r.acts.length) continue;
    night.places.push({
      id: `${night.id}|room|${r.venue}`, nightId: night.id, kind: 'room', place: r.venue, room: roomOf(r.keys),
      start: r.start, end: r.end, approx: r.approx, roomKeys: [...r.keys], shown: isShown(r.keys), dayKey: null,
      doors: r.doors, close: r.close, acts: r.acts, dropIn: r.acts.every((a) => a.dropIn),
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
          dropIn: m.e.dropIn === true,
          acts: [{ name: m.e.name, from: m.nowFrom, to: m.nowTo, time: m.e.time || null, approx: m.approx, occ: occOf(m.e), play: `${m.venue}|${night.id}`, section: src.key }],
        });
      }
    }
  }
}

// ---- who is where ------------------------------------------------------------------
// For one person, the stretch of a place they would be at, and their picks
// in it (`acts`: each one's window and level). Null when the place has nothing
// of theirs — "theirs" is filters.js passesPeople, the Board's and the List's
// question. `sure` is false when every act of theirs here also plays elsewhere.
function stretchFor(place, person, picks, doubled) {
  const lv = (name) => ((picks[name] || {})[person]) || 0;
  const mine = place.acts.filter((a) => passesPeople(picks, a.name, [person]));
  if (!mine.length) return null;
  const sure = mine.some((a) => !doubled.has(a.name));
  const from = Math.min(...mine.map((a) => (a.from ?? place.start)));
  const to = Math.max(...mine.map((a) => (a.to ?? place.end)));
  return { from, to, acts: mine.map((a) => ({ from: a.from ?? place.start, to: a.to ?? place.end, level: lv(a.name) })), sure };
}

// How much a person wants a stretch at minute t: the most they want anything
// of theirs there that is not over yet. A room holds them from their first
// pick to their last (rule 4), but a must that has finished no longer weighs
// against a move (Codex, 2026-09-26: a 6 PM must kept a crew in a Club past a
// set they wanted more than the Club's late level-2 act).
const levelAt = (s, t) => s.acts.reduce((most, a) => (a.to > t && a.level > most ? a.level : most), 0);

// Whether a pick elsewhere is worth leaving a site for, never to come back:
// one wanted more than anything still to come there, and one they would
// catch — it has not started, or began less than a changeover ago. The tail
// of a set long under way is not worth the trip; once nothing of theirs is
// left where they are, anything live is.
const worthTheTrip = (s, t, ahead) => s.acts.some((a) => a.to > t && a.level > ahead && (ahead === 0 || a.from > t - CHANGEOVER));

// A SITE is where a body is: the festival's grounds (every grid set and every
// stray of the festival's own), or one venue (its room or its parties).
const siteOf = (place) => (place.kind === 'set' ? ':grounds' : `venue:${place.place}`);

const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

// One night's slices: everyone seated on every place of the night (hidden
// ones too), then the fold decides what is ranked (rule 8).
// Rule 9's seating: a drop-in yields to any real live pick, it never holds a
// body against a trip, and it is never ranked — its seats go to `drops`.
// `opts`: { group } rule 10's count (only these people's seats are counted;
// everyone is still seated); { solo } a group of one: the picks that person
// gives up at each moment ride along as `alt` entries (or lines).
function slicesOf(here, us, picks, doubled, bar, { group = null, solo = null } = {}) {
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
  const counts = group ? new Set(group) : null;
  // Rule 3's trip: the site each person is at, and the sites they have left
  // tonight. What a person would give up by leaving is the most they want
  // anything of theirs at their site that is not over yet (levelAt) — never
  // a drop-in's (rule 9: it will still be there).
  const siteNow = new Map();
  const left = new Map(us.map((person) => [person, new Set()]));
  const aheadAt = (person, site, t) => {
    let most = 0;
    here.forEach((p, i) => {
      if (siteOf(p) !== site || p.dropIn) return;
      for (const s of stretches[i]) if (s.person === person) most = Math.max(most, levelAt(s, t));
    });
    return most;
  };
  for (let t = t0; t < t1; t += STEP) {
    const live = stretches.map((list) => list.filter((s) => s.from <= t && t < s.to));
    const at = new Map(); // person -> best
    for (const person of us) {
      const cur = siteNow.get(person) ?? null;
      const gone = left.get(person);
      const ahead = cur == null ? 0 : aheadAt(person, cur, t);
      let best = null;
      here.forEach((p, i) => {
        const s = live[i].find((x) => x.person === person);
        if (!s) return;
        const site = siteOf(p);
        const level = levelAt(s, t);
        if (gone.has(site)) return; // never back to a site left tonight
        if (cur != null && site !== cur && !worthTheTrip(s, t, ahead)) return;
        // Rule 9: a real pick outranks a drop-in whatever the levels.
        const key = [p.dropIn ? 0 : 1, level, live[i].length, was.get(person) === p.id ? 1 : 0, p.start];
        if (!best || cmp(key, best.key) > 0) best = { p, key, level, sure: s.sure };
      });
      if (!best) continue;
      at.set(person, best);
      // A drop-in is dropped in on (rule 9): seated there, a person is still
      // where they were for the trip. Walking to another venue's drop-in once
      // made the grounds a site "left tonight", and a set there later was
      // never gone back to (the P1–P3 review, 2026-09-27).
      if (best.p.dropIn) continue;
      const site = siteOf(best.p);
      if (cur != null && site !== cur) gone.add(cur);
      siteNow.set(person, site);
    }
    for (const [person, b] of at) was.set(person, b.p.id);
    const count = new Map();
    for (const [person, b] of at) {
      if (counts && !counts.has(person)) continue; // rule 10: only the group is counted
      if (!count.has(b.p.id)) count.set(b.p.id, { place: b.p, people: [], musts: 0, maybe: [] });
      const c = count.get(b.p.id);
      c.people.push(person);
      if (b.level === 4) c.musts += 1;
      if (!b.sure) c.maybe.push(person);
    }
    // A group of one: the live picks they are not at, shown places only —
    // the or lines of their own day.
    if (solo && at.has(solo)) {
      const seat = at.get(solo).p.id;
      here.forEach((p, i) => {
        if (p.id === seat || !p.shown || p.dropIn || count.has(p.id)) return;
        if (live[i].some((x) => x.person === solo)) count.set(p.id, { place: p, people: [solo], musts: 0, maybe: [], alt: true });
      });
    }
    const all = [...count.values()].sort((a, b) => b.people.length - a.people.length || (a.alt ? 1 : 0) - (b.alt ? 1 : 0) || b.musts - a.musts || a.place.start - b.place.start);
    const ranked = all.filter((c) => c.people.length >= bar && c.place.shown && !c.place.dropIn);
    // The top of the route is never someone's give-up: a slice whose only
    // candidates are alts has no stop.
    while (ranked.length && ranked[0].alt) ranked.shift();
    const drops = all.filter((c) => c.place.dropIn && c.place.shown);
    slices.push({ t, ranked, drops });
  }
  return slices;
}

// Where what a place is FOR ends: a set's (or a party's) act, a room's
// close. The NOW row's till reads it (tillOf), and a stop never runs past it
// (routeOf's blip fold).
const actEnd = (place) => { const a = place.acts[0]; return a && a.to != null ? a.to : place.end; };
const playsTill = (place) => (place.kind === 'room' ? place.end : actEnd(place));
// Whether a run's place is still on at minute `to` (a run's place is its
// first slice's top: blips folded in later only add slices after it).
const playsThrough = (run, to) => { const end = playsTill(run.slices[0].ranked[0].place); return end == null || end >= to; };

// Slices -> stops, forks and scattered stretches (the prototype's routeOf).
// `size`: how many the tier is judged against (US, or rule 10's group).
function routeOf(nightId, slices, size, bar) {
  const runs = [];
  for (const s of slices) {
    const top = s.ranked[0] || null;
    const id = top ? top.place.id : null;
    const last = runs[runs.length - 1];
    if (last && last.id === id) { last.to = s.t + STEP; last.slices.push(s); } else runs.push({ id, from: s.t, to: s.t + STEP, slices: [s] });
  }
  // Fold blips: a stop shorter than MIN_STOP joins the stop before it while
  // that stop's place still plays through it (a crowd flicker inside one set
  // or room). Once the place before it is over, the blip stands as a short
  // stop of its own — it is a real crowd, at the bar, at a shown place — and
  // never carries the stop before it past its own end (P4, 2026-09-27: the
  // nine's ten-minute Tiësto blip had kept Zara Larsson's stop, and the
  // peek's NOW, running ten minutes after her set). With no stop before it,
  // a blip is nothing (a set's last five minutes while the next one starts).
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i];
    if (r.id && r.to - r.from < MIN_STOP) {
      const prev = runs[i - 1];
      if (!prev || !prev.id) r.id = null;
      else if (playsThrough(prev, r.to)) { prev.to = r.to; prev.slices.push(...r.slices); runs.splice(i, 1); }
    }
  }
  for (let i = runs.length - 1; i > 0; i--) {
    if (runs[i].id === runs[i - 1].id) { runs[i - 1].to = runs[i].to; runs[i - 1].slices.push(...runs[i].slices); runs.splice(i, 1); }
  }
  const items = [];
  for (const r of runs) {
    if (!r.id) {
      // Rule 9: a stretch nobody's set gathers the bar in, but a drop-in room
      // does, says where we drift (the row's caption, never a stop).
      const it = { kind: 'scattered', from: r.from, to: r.to };
      let drop = null;
      for (const s of r.slices) for (const c of s.drops || []) if (c.people.length >= bar && (!drop || c.people.length > drop.count)) drop = { place: c.place, count: c.people.length, people: c.people };
      if (drop) it.dropIn = drop;
      items.push(it);
      continue;
    }
    let peak = null;
    const forks = new Map();
    const timeline = [];
    for (const s of r.slices) {
      const top = s.ranked.find((c) => c.place.id === r.id);
      if (top) timeline.push({ t: s.t, people: top.people });
      if (top && (!peak || top.people.length > peak.people.length)) peak = { ...top, t: s.t };
      for (const c of s.ranked) {
        if (c.place.id === r.id) continue;
        const f = forks.get(c.place.id) || { place: c.place, from: s.t, to: s.t + STEP, peak: c, alt: !!c.alt, crowds: [] };
        f.to = s.t + STEP;
        f.crowds.push({ t: s.t, people: c.people });
        if (c.people.length > f.peak.people.length) f.peak = c;
        forks.set(c.place.id, f);
      }
    }
    const place = peak.place;
    items.push({
      kind: 'stop', tier: peak.people.length * 2 > size ? 'most' : 'some', nightId, place, placeKind: place.kind, acts: place.acts,
      from: r.from, to: r.to, count: peak.people.length, people: peak.people, musts: peak.musts, maybe: peak.maybe,
      leansOnDoubles: peak.maybe.length * 2 >= peak.people.length, alsoAt: [], timeline,
      forks: [...forks.values()].filter((f) => f.to - f.from >= MIN_STOP)
        // `crowds`: who is at the fork each five minutes, for the Share's "now"
        // (plan-rows.js crowdAt). Not `timeline`: the rows read a fork's peak
        // crowd, and this adds nothing they read.
        .map((f) => ({ place: f.place, placeKind: f.place.kind, from: f.from, to: f.to, count: f.peak.people.length, people: f.peak.people, alt: f.alt, crowds: f.crowds })),
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
export function planOf(fest, { picks = {}, members = [], folded = [], people = [] } = {}) {
  picks = picks || {};
  folded = Array.isArray(folded) ? folded : [];
  const us = usOf(picks, members);
  // Rule 10: the highlighted people with a pick here. `highlight` keeps the
  // names as given (the empty line's words name them even with no picks).
  const highlight = (people || []).filter((p) => (members || []).includes(p));
  const group = highlight.length ? usOf(picks, highlight) : null;
  const bar = group ? barForGroup(group.length) : barFor(us.length);
  const size = group ? group.length : us.length;
  const solo = group && group.length === 1 ? group[0] : null;
  const available = us.length >= FLOOR_MIN;
  const empty = { us, bar, available, folded: [...folded], nights: [], night: () => null, playsAt: new Map(), places: [], group, highlight };
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

  // The nights are the dates the SHOWN wall has a timetable or a room on —
  // a grid day, a section's night, a dated extra's date, the fold applied —
  // whether or not anything there is on a clock (ACL's Late nights print
  // doors only: the date is a night with no stops, and says so, rather than
  // vanishing). A lineup's billing day is not a night (no grid, no rooms:
  // nothing to be at), and a date whose every room is hidden is not a night
  // (the wall has no tab for it either).
  const shownDays = new Map();
  const shownExtras = new Map();
  for (const d of shown.model.days) {
    if (!((shown.festRoom && d.grid) || shown.model.sections.some((s) => s.byDay.has(d.key)))) continue;
    const id = d.iso || d.key;
    if (!shownDays.has(id)) shownDays.set(id, []);
    shownDays.get(id).push(d);
  }
  for (const e of shown.model.extras) {
    for (const iso of (e.byDate ? e.byDate.keys() : [])) {
      if (!shownExtras.has(iso)) shownExtras.set(iso, []);
      shownExtras.get(iso).push(e.key);
    }
  }
  const nights = ordered.filter((n) => shownDays.has(n.id) || shownExtras.has(n.id))
    .map((n) => ({ id: n.id, iso: n.iso, wd: n.wd, days: shownDays.get(n.id) || [], extraKeys: shownExtras.get(n.id) || [] }));
  const listed = new Set(nights.map((n) => n.id));
  const memo = new Map();
  // Who a night's people are: the group under a highlight, else us. "Theirs"
  // is v103's predicate (filters.js passesPeople), asked per act.
  const counted = group || us;
  const theirs = (a) => counted.length > 0 && passesPeople(picks, a.name, counted);
  const night = (id) => {
    if (!listed.has(id)) return null;
    if (memo.has(id)) return memo.get(id);
    const n = byId.get(id);
    const items = n.places.length ? routeOf(id, slicesOf(n.places, us, picks, doubled, bar, { group, solo }), size, bar) : [];
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
    // Rule 9's quiet line: each shown drop-in room of the night that enough
    // of us picked — its whole window, and how many picked it (people, not
    // seats: the count a person can check on the card).
    const dropIns = [];
    for (const p of n.places) {
      if (!p.dropIn || !p.shown) continue;
      const who = counted.filter((person) => p.acts.some((a) => passesPeople(picks, a.name, [person])));
      if (who.length >= bar) dropIns.push({ kind: 'dropin', nightId: id, place: p, from: p.start, to: p.end, count: who.length, people: who });
    }
    // A night with no stop says why (plan-rows.js words it): nothing of ours
    // on a clock here ('no-times'), nothing the counted people picked
    // ('unpicked'), or picks that never gather the bar ('scattered') — unless
    // rule 9's line is there ('dropin'): the drop-in room they will all drift
    // through IS the night, and "Scattered all day" under a line that says
    // they are all there was false (the P1–P3 review, 2026-09-27). The open
    // plan draws no empty line beside it.
    const stops = items.filter((i) => i.kind === 'stop').length;
    let why = null;
    if (!stops) {
      const shownPlaces = n.places.filter((p) => p.shown);
      if (!shownPlaces.length) why = 'no-times';
      else if (dropIns.length) why = 'dropin';
      else if (!shownPlaces.some((p) => p.acts.some(theirs))) why = 'unpicked';
      else why = 'scattered';
    }
    const out = { id, iso: n.iso, wd: n.wd, items, stops, dropIns, why };
    memo.set(id, out);
    return out;
  };
  return { us, bar, available, folded: [...folded], nights, night, playsAt, places, group, highlight };
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
// `today: false` — whether to show it is the UI's call. Under a highlight the
// plan is already theirs (rule 10), so the peek is too: it never says NOW for
// a stop none of them picked (Kevin, 2026-09-26: "the filters should filter
// the now too").
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
  return stop.place.kind === 'room' ? stop.to : actEnd(stop.place);
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

// The ISO date after `iso`, or null when it is not a date: whether a peek's
// night is tomorrow's (app.js planAnswer), and whether nights run on
// consecutive dates (plan-rows.js, the Earlier line's range).
export const isoAfter = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
