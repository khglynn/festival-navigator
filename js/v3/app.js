// v3 app shell: boot flow, screen switching (landing / create / join / wall /
// settings / lost states — all six render HERE), wall wiring, sync cadence,
// sheets (share moment, add member), and the server-side v4 migration call.
// wall.js renders the wall's CONTENT; settings.js and notes.js own their
// surfaces and mount into hosts this shell controls.
import * as state from '../state.js';
import * as crew from '../crew.js';
import * as sync from '../sync.js';
import * as spotify from '../spotify.js';
import * as model from './model.js';
import { loadFestivalIndex, loadFestival, fetchCustomFestivals, mergeCustoms, FESTIVAL_INDEX, defaultFestivalId } from '../festivals.js';
import { renderWall, refreshCard, showToast, wireScrollspy, colorIndexOf, positionNowLines, positionNowMarks, scrollToNowLine, dayNavOf, roomsOf, cardFor, roomOf, isStripScroller, DAY_ANCHOR, festLinkLabel, nowLanding, nowStops, nowStep, nowPulseable, nowLabelOf, nowSaid, stackRowKey } from './wall.js';
import { loadPeopleFilter, savePeopleFilter, togglePerson, pruneToActive, loadFolded, saveFolded, applyFoldToggle, showOf, foldFromShow, showLabel, foldIsSet, showSeeded, rememberShowSeeded } from './filters.js';
import { GROW_MS, OUT_MS, CASCADE_MS, STAGGER_MS, EASE_ARRIVE, EASE_LEAVE, EASE_SURFACE, canAnimate } from './motion.js';
import { scrolledBefore, rememberScrolled, dayOfScrollKey, festivalClock } from './now.js';
import { dayLabelParts } from '../time.js';
import { disclosureFold, eqLoader, festRow } from './tools.js';
import { openArtistSheet, openDayNotes, openAllNotes, openFestNotes, closeSheet, refreshOpenSheet, sheetChrome, dialogize, rememberOpener, shortDayLabel } from './notes.js';
import { renderSettings, appSettings, openSubviewByKey } from './settings.js';
import { onStorageWriteFail, saveLS, errorText } from '../util.js';
import { router, encodeNotesKey, decodeNotesKey } from './router.js';
import { wireCardZoom, wireCardFocusZoom, zoomCard, unzoom, dismissZoom, zoomedCard, zoomContains, zoomSnapshot, refreshZoom, festPlaceLine } from './card-facts.js';
import { hookGlobalErrors, configureReports, record } from '../errlog.js';
// The crash journal listens from the first module tick — an error during
// boot is exactly the kind nobody can describe later (2026-08-31). index.html
// hooks it earlier still, from a module script of its own; this second call
// is a no-op there and the hook everywhere else (the jsdom rigs).
hookGlobalErrors();
// What a crash report may say about who and where (v88, Kevin 2026-09-24:
// the public pid and the person's name in the crew ride along), and every
// secret this device holds, so the reporter can cut each one out of an
// error's words by exact match. Read at the moment of each report.
configureReports({
  context: () => {
    const fid = state.activeFestivalId;
    const listed = fid ? FESTIVAL_INDEX.find((f) => f.id === fid) : null;
    const token = state.getCrewToken();
    const person = crew.myPerson();
    return {
      // A catalogue id is public; a crew's own festival is only 'custom'.
      fest: !fid ? null : (listed ? (listed.custom ? 'custom' : fid) : 'unlisted'),
      pid: (person && person.id) || null,
      name: (token && crew.me(token)) || null,
    };
  },
  secrets: () => {
    const out = [];
    // Each source on its own: one that throws (a blocked store, a mangled
    // list) never costs the others.
    const add = (read) => { try { out.push(...[].concat(read())); } catch { /* the rest still count */ } };
    add(() => crew.knownCrews().map((c) => c && c.token));
    add(() => { const p = crew.myPerson(); return p ? [p.token, ...Object.keys(p.crews || {})] : []; });
    add(() => state.getCrewToken());
    add(() => crew.activeCrewToken());
    add(() => window.sessionStorage.getItem('fn_pending_absorb'));
    return out;
  },
});
import { createSortControl } from './sort-control.js';
import { nameProblem } from '../name-rules.mjs';
import { startFavicon, stopFavicon } from './favicon.js';
import { hslOf, strokeOf, nextColorIndex } from './palette.js';
// Entering a crew you already have a life in (2026-09-23): recognized on
// open, and the one-time offer to bring your picks from another crew.
import { planBringPicks, bringFromSource, bringOfferCopy, bringDoneLine, bringAnswered, rememberBringAnswer, showBringOffer, settleBringOffer, dismissBringOffer, bringOfferCard } from './crew-entry.js';
import { showActionToast } from './wall.js';
// First open, wall first (v92, 2026-09-25): a guest's welcome, once per phone.
import { welcomeCopy, welcomeSeen, rememberWelcomeSeen, showWelcome, dismissWelcome, welcomeCard } from './welcome.js';
// The warm open (2026-09-23): paint from what this phone holds, freshen after.
import { festivalIndexFromCache, festivalFromCache, fetchFestivalFile, cachedCustomFestivals } from '../festivals.js';
import { getLS } from '../util.js';

const $ = (id) => document.getElementById(id);

// ---- view context ---------------------------------------------------------------
const ctx = {
  fid: null,
  meName: null,
  picks: {},
  affinity: null,
  query: '',
  sort: 'billing',
  lowPower: false,
  migrationPending: false,
  // The wall filter (design option A, 2026-08-27): whose picks the wall
  // highlights. Per-fest, per-tab (filters.js).
  filterPeople: [],
  // The fold (MODEL-V4 §3, 2026-09-16): which of the fest's rooms (the
  // festival itself, Afters, Folsom …) are hidden on every day. Device-local,
  // persisted per fest (filters.js) — never in the crew doc. One door writes
  // it: the show menu on the fest name (§3a.2, Kevin 2026-09-17).
  folded: [],
  now: null, // tests pin the clock; null = new Date() at render
  onTap: handleTap,
  onOpenNotes: (artist, occ = null) => {
    unzoom({ why: 'notes sheet opened' });
    openArtistSheet(artist, ctx, onNotesChange, occ);
    // The occurrence rides in the route key (router.encodeNotesKey — a tagged
    // payload no name can imitate), so back, forward and a refresh reopen
    // THIS set for an artist who plays twice.
    router.push(encodeNotesKey(artist, occ));
  },
  // `target` is a date or a section-on-a-date key (`2026-09-25|Folsom`). The
  // route carries the key itself, so back, forward and a refresh reopen the
  // same thread — the label is only what the door was wearing, and the sheet
  // finds it again off the axis.
  onOpenDayNotes: (target, label = null) => {
    openDayNotes(target, label, ctx, onNotesChange);
    router.push(`sheet:day:${target}`);
  },
  onOpenFestNotes: () => {
    openFestNotes(ctx, onNotesChange);
    router.push('sheet:fest');
  },
  onNotesChange: () => onNotesChange(),
  // ---- the zoom (2026-08-29): hover with intent on a mouse, hold on touch ----
  // wall.js hands every card here; card-facts.js owns the timing and the grow.
  wireZoom: (el, artist, occ) => {
    const opts = { onOpenNotes: (a) => ctx.onOpenNotes(a, occ), occ };
    wireCardZoom(el, artist, ctx, opts);
    wireCardFocusZoom(el, artist, ctx, opts);
  },
  // A hold on touch grows the card the same way a hover does; a tap on the
  // grown card then PICKS, like a tap on the resting one (Kevin, 2026-08-30 —
  // one grammar on both surfaces). Tap outside, Escape or a scroll put it away.
  onPeek: (artist, el, occ) => zoomCard(el, artist, ctx, { onOpenNotes: (a) => ctx.onOpenNotes(a, occ), source: 'touch', occ }),
};

// One zoom at a time, dismissed the way previews are everywhere: a tap or
// press anywhere outside it (the resting card AND its overlay), or Escape.
// Capture-phase so it runs before the tap it is judging. A press OUTSIDE is
// a plain close, never a "stay away" — the pointer is by definition not on
// the card, so nothing would re-grow it, and marking the card dismissed
// poisoned its next hover: leave the overlay, click elsewhere before the
// grace close fires, and the first re-entry did nothing (Codex gate,
// 2026-08-31). Escape keeps the mark — the hand is still on the card there.
document.addEventListener('pointerdown', (e) => {
  if (zoomedCard() && !zoomContains(e.target)) unzoom({ why: 'press outside the zoom' });
}, true);
// Escape closes ONE layer: a live zoom eats the press before any sheet or
// router handler sees it (capture phase) — never both in one keypress.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && zoomedCard()) { dismissZoom(); e.stopImmediatePropagation(); e.preventDefault(); }
}, true);

function onNotesChange() {
  sync.scheduleSync();
  repaintWall();
}

function refreshCtx() {
  ctx.fid = state.activeFestivalId;
  ctx.meName = crew.me(state.getCrewToken());
  ctx.picks = model.picksFor(state.crewDoc, ctx.fid);
  ctx.affinity = state.affinityLookup(ctx.meName);
  // A remembered filter for someone no longer in the crew would blank the
  // wall with no chip to explain it — prune to the people who are here.
  const stored = loadPeopleFilter(ctx.fid);
  ctx.filterPeople = pruneToActive(stored, state.activePeople().map(([n]) => n));
  // Write the pruned list back, or a departed member's filter would sit in
  // storage and silently reactivate the day they rejoin.
  if (ctx.filterPeople.length !== stored.length) savePeopleFilter(ctx.fid, ctx.filterPeople);
  ctx.folded = loadFolded(ctx.fid);
  ctx.festDates = festDatesOf();
}

// Every date on the day axis, in the wall's order — the grid days (both
// weekends), the nights of a weekday-keyed section, and each date of a dated
// section. This is the list the all-notes sheet opens a door on (MODEL-V4
// §4), so it reads the axis the tabs read rather than dayMeta directly: a
// Portola afters night has a date the wall derives and dayMeta never names.
// The query is stripped deliberately — searching narrows the wall, never the
// dates a crew has notes on.
// A date is CALLED what its door on the wall calls it — "Friday" — because that
// is the door you wrote through, and the sheet has to agree with the door
// (MODEL-V4 §3a.3). The exception is the one that made §4 date-key day notes in
// the first place: a two-weekend fest has two Fridays, and two rows both saying
// "Friday" in a list with no wall under them is the ambiguity the dates were
// meant to end — so where a name would answer for more than one date, EVERY
// date takes the dated form ("Fri · Oct 2"). Decided once, here, where the whole
// axis is visible; notes.js reads the answer and never re-derives it.
function festDatesOf() {
  const fest = state.fest();
  if (!fest) return [];
  const out = [];
  const seen = new Set();
  // The fold is stripped too: a hidden day renders nothing on the wall, but a
  // note already written on it is still a conversation the sheet lists, and
  // it is called what its door would call it.
  for (const day of dayNavOf(fest, { ...ctx, query: '', folded: [] })) {
    for (const iso of day.dates || []) {
      if (!model.ISO_DATE_RE.test(String(iso)) || seen.has(iso)) continue;
      seen.add(iso);
      // A dated section's tab covers many dates, so its own name cannot stand
      // for any one of them; each date says itself.
      out.push({ iso, label: day.dated ? shortDayLabel(iso) : dayLabelParts(day.dayKey || day.key).head });
    }
  }
  return nameDates(out);
}

// The collision pass, on its own so it can be held to account: a name that
// answers for more than one date is no name at all, so every date takes the
// dated form instead. Pure, order-preserving, and it never half-renames — one
// Friday saying "Friday" beside another saying "Fri · Oct 9" would be worse
// than either.
export function nameDates(entries) {
  const taken = new Map();
  for (const d of entries) taken.set(d.label, (taken.get(d.label) || 0) + 1);
  return entries.map((d) => (taken.get(d.label) > 1 ? { ...d, label: shortDayLabel(d.iso) } : d));
}

// ---- the fold (MODEL-V4 §3, §3a.2) -----------------------------------------------
// The show menu on the fest name is the ONE door: unchecking a room hides it on
// every day, and a hidden room renders nothing (2026-09-17) — so the room
// blocks the wall stamps with the key (`.room[data-room]`) are what leaves,
// and what arrives when it comes back — with any day that goes with them
// (foldBlocksOf).
function roomBlocksOf(key) {
  return [...document.querySelectorAll(`#wall-root .room[data-room="${CSS.escape(key)}"]`)];
}
// The tabs the plan gives the wall right now, by key — read before and after
// a fold, so the days a fold takes or gives back are the difference of two
// plans and never a guess read off the DOM. A dated section (Late nights) is
// a tab too, so hiding it takes its block whole.
function planDayKeys() {
  return new Set(dayNavOf(state.fest(), ctx).map((t) => t.key));
}
// The named days as they stand on the wall: one `.day-block` each, holding
// everything the day shows — its rooms, their heads and whispers (one-line
// heads, 2026-09-23). A block is a day, so a day that goes is one element.
function dayBlocksOf(keys) {
  return [...$('wall-root').children].filter((el) => el.classList.contains('day-block') && keys.has(el.dataset.day));
}
// What a fold moves, in the wall's order: every day that goes with it, whole,
// and the room blocks stamped with the key on the days that stay — a room
// inside a day that is leaving already leaves with its day, and moving it
// twice would double its motion. A weekend has no room of its own — it leaves
// and returns as its three days; a Portola Thursday whose only room was
// hidden leaves as its day instead of vanishing on the repaint (Kevin,
// 2026-08-30: nothing vanishes in place, nothing pops).
function foldBlocksOf(key, dayKeys) {
  const days = new Set(dayBlocksOf(dayKeys));
  const rooms = new Set(roomBlocksOf(key).filter((room) => !days.has(room.closest('.day-block'))));
  return [...$('wall-root').querySelectorAll('.day-block, .room')].filter((el) => days.has(el) || rooms.has(el));
}
// The rooms of the festival week the menu offers, hidden or not, in the
// wall's order (wall.js roomsOf reads the fest through the wall's own plan).
export function roomsOnWall() {
  return roomsOf(state.fest(), ctx);
}

// Hiding a room is a small event (Kevin, 2026-08-30: nothing vanishes in place,
// nothing pops): the room leaves quick and plain before the repaint; on the
// way back it arrives with the usual beat. Transforms and opacity only;
// instant under Low Power and reduced motion. The repaint is the wall's own
// path — the days and their tabs are re-read from the plan, so a day with
// nothing visible left goes with its rooms.
function toggleFoldFlow(key) {
  // The setting lands NOW — memory, storage and ctx; only the room's leaving
  // is deferred. A second tap during the fade reads this one, never the
  // state before it.
  const { next, folding } = applyFoldToggle(ctx.fid, ctx.folded || [], key);
  // The days before and after, from the plan: what the fold takes with it
  // (a day whose last visible room went; a weekend's three days) and what it
  // gives back.
  const daysBefore = planDayKeys();
  ctx.folded = next;
  const daysAfter = planDayKeys();
  const diff = (a, b) => new Set([...a].filter((k) => !b.has(k)));
  // Where the person is standing, read before the wall is rebuilt.
  const standing = (document.querySelector('.day-tab.active') || {}).dataset?.day || null;
  // The everything-hidden notice (wall.js) is the wall's one line when the
  // last room goes: it arrives with the beat once the week has left, and it
  // is the first thing to leave when a room comes back.
  const notice = () => $('wall-root').querySelector(':scope > .wall-empty');
  const arrive = arriveBlocks;
  const finish = () => {
    repaintWall();
    landAfterFold(standing);
    if (!folding) arrive(foldBlocksOf(key, diff(daysAfter, daysBefore)));
    else if (notice()) arrive([notice()]);
  };
  const leaving = (folding ? foldBlocksOf(key, diff(daysBefore, daysAfter)) : [notice()].filter(Boolean))
    .filter((block) => canAnimate(block, ctx));
  if (!leaving.length) { finish(); return; }
  let pending = leaving.length;
  let done = false;
  const settle = () => { if (done) return; pending -= 1; if (pending <= 0) { done = true; finish(); } };
  for (const room of leaving) {
    const a = room.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-4px)' }],
      { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' });
    a.onfinish = settle;
    a.oncancel = settle;
  }
  setTimeout(() => { if (!done) { done = true; finish(); } }, OUT_MS * 3 + 50); // a backgrounded tab must not hang the fold
}

// A room coming back arrives with the usual beat (the fold flow's way in).
function arriveBlocks(blocks) {
  blocks.forEach((block, i) => {
    if (!canAnimate(block, ctx)) return;
    block.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: CASCADE_MS, delay: i * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' });
  });
}

// "Show all" (v92): the toast a share link's starting view leaves behind
// brings every room back at once — the fold flow's way back, for all of them.
// Nothing leaves, so there is nothing to wait for: the wall repaints, the
// page stays on the day it was on, and what came back arrives with the beat.
function unfoldAll() {
  const keys = [...(ctx.folded || [])];
  if (!keys.length) return;
  const daysBefore = planDayKeys();
  const standing = (document.querySelector('.day-tab.active') || {}).dataset?.day || null;
  saveFolded(ctx.fid, []);
  ctx.folded = [];
  const daysAfter = planDayKeys();
  const fresh = new Set([...daysAfter].filter((k) => !daysBefore.has(k)));
  repaintWall();
  landAfterFold(standing);
  arriveBlocks([...new Set(keys.flatMap((key) => foldBlocksOf(key, fresh)))]);
}

// Where the page stands after the wall changed shape under it. The day you
// were in is still there: land on its block again (the days above it may have
// gone, and an untouched scroll offset would be looking at somewhere else) —
// unless you were at the top of the page, where there is nothing to keep and
// nothing moves. The day you were in is gone: land on the first visible day,
// which is what the open would choose, wherever you were standing (at the
// top that is a short hop from the fest header to the first day, and it is
// the day the dock now lights).
function landAfterFold(standing) {
  const tabs = dayNavOf(state.fest(), ctx, $('wall-root'));
  const still = standing ? tabs.find((t) => (t.anchor || t.key) === standing) : null;
  if (still && !(window.scrollY > 0)) return;
  const day = still || defaultDayOf(tabs);
  // Nothing left to land on — everything is hidden: the top of the page,
  // where the wall's notice says so.
  if (!day) { if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'auto' }); return; }
  const block = document.querySelector(anchorFor(day.anchor || day.key));
  if (block) landOnDay(block);
}

// ---- tap cycle -------------------------------------------------------------------
// A multi-day artist has one card under EACH day — a pick must repaint every
// sibling, or the others go stale and invite double-cycling (CORE-15).
function refreshArtistCards(artistName) {
  const els = [...document.querySelectorAll(`#wall-root .card[data-artist="${CSS.escape(artistName)}"]`)];
  if (!els.length) { repaintWall(); return; }
  // The people filter dims and never hides (2026-09-17), so a pick under it
  // is still a single-card refresh: renderCard recomputes the dim from ctx,
  // and no card anywhere has to appear or vanish.
  // A pick while zoomed keeps the zoom: the person is still resting on the
  // card, cycling to MUST while watching the pills. The refreshed node of THE
  // zoomed occurrence (an artist can play twice) slides under the overlay
  // and the overlay's lines are rebuilt in place — no intent delay, no morph.
  const zi = els.indexOf(zoomedCard());
  els.forEach((el, i) => refreshCard(el, artistName, ctx, {
    // The zoom takes the fresh node while the old one is still in the DOM —
    // see refreshCard: the old node's removal blur must find a zoom that has
    // already moved on.
    onSwap: i === zi ? (fresh) => refreshZoom(fresh, ctx) : null,
  }));
  // A refreshed card can be a NEW node, and the now mark rides the node: pick
  // the artist who is playing and the ring would go out until the next tick.
  positionNowMarks($('wall-root'), ctx.now || new Date());
}

function handleTap(artistName) {
  // A guest's tap is the moment to ask who they are (v92): it used to do
  // nothing at all, silently — the one hole a nameless viewer had.
  if (!ctx.meName) { askToJoin(artistName); return; }
  if (ctx.migrationPending) {
    showToast($('toast-root'), 'Updating this crew — picks unlock in a moment');
    return;
  }
  const current = (ctx.picks[artistName] || {})[ctx.meName] || 0;
  const next = model.nextTapLevel(current);
  state.recordSelection(artistName, ctx.meName, next);
  applyLocalPick(artistName, ctx.meName, next);
  refreshCtx();
  refreshArtistCards(artistName);
  sync.scheduleSync();
  // No undo toast when a must clears (Kevin, 2026-09-25: "unnecessary for
  // removing a must. it's not that destructive"): tapping again starts the
  // cycle over from the first bar.
}

// ---- a guest joins (v92, first open, wall first) ------------------------------------
// A crew link on a phone the crew does not know opens the wall as a guest,
// and the name is asked only when it is needed: a tap on an artist (that
// artist becomes their pick), the dashed + in the dock, "Add yourself" in
// Settings. Tonight the question is today's join screen — the sheet over the
// wall (F2c) is after Portola — so the wall is left and come back to, and
// where the person was standing comes back with it: the page, and each
// timetable's sideways scroll (a hidden wall can forget both).
let pendingJoin = null; // { token, fid, artist, place } while the join screen asks for a guest

function wallPlace() {
  const lefts = new Map();
  for (const s of document.querySelectorAll('#wall-root .times-scroll')) {
    if (isStripScroller(s)) continue; // the strip follows its grid; it is never scrolled itself
    const key = s.dataset.sync || '*';
    if (!lefts.has(key)) lefts.set(key, s.scrollLeft);
  }
  return { y: window.scrollY || window.pageYOffset || 0, lefts };
}

function restorePlace(place) {
  if (!place) return;
  for (const s of document.querySelectorAll('#wall-root .times-scroll')) {
    if (isStripScroller(s)) continue;
    const left = place.lefts.get(s.dataset.sync || '*');
    if (left != null && s.scrollLeft !== left) s.scrollLeft = left;
  }
  window.scrollTo({ top: place.y, behavior: 'auto' });
}

function askToJoin(artist = null) {
  const token = state.getCrewToken();
  if (!token || ctx.meName) return;
  // The wall is about to be left: nothing grown or open may ride along.
  unzoom({ instant: true, why: 'asked who you are' });
  closeShowMenu({ instant: true });
  // Asking is engaging: the welcome's words have done their job.
  rememberWelcomeSeen();
  dismissWelcome({ instant: true });
  pendingJoin = { token, fid: ctx.fid, artist, place: wallPlace() };
  renderJoin(token, state.crewDoc, { artist });
}

// After a join from the wall: back where they were standing, and the artist
// they tapped becomes their pick through the ordinary pick path — only where
// that is still true (same crew and festival, picks writable, the card still
// on the wall) and only from nothing: someone who tapped their own name in
// already has a level there, and a tap would move it.
function finishJoin(token) {
  const p = pendingJoin;
  pendingJoin = null;
  if (!p || p.token !== token || state.getCrewToken() !== token || !ctx.meName) return;
  if (p.fid !== ctx.fid) return;
  restorePlace(p.place);
  if (!p.artist || ctx.migrationPending) return;
  if (!document.querySelector(`#wall-root .card[data-artist="${CSS.escape(p.artist)}"]`)) return;
  if (((ctx.picks[p.artist] || {})[ctx.meName] || 0) > 0) return;
  handleTap(p.artist);
}

// "Just looking": back onto the wall as a guest. From the wall (a tap, the +,
// Settings) the wall is still behind the join screen — show it again where it
// was. From anywhere else (a personal link, "Not me") enter the crew fresh.
function lookAround(token, doc) {
  const p = pendingJoin;
  pendingJoin = null;
  if (p && p.token === token && state.getCrewToken() === token && !crew.me(token)) {
    show('screen-app');
    refreshCtx();
    renderPersonChips();
    renderYou();
    repaintWall();
    restorePlace(p.place);
    return;
  }
  enterApp(token, doc).catch((e) => { record('join:look', e); renderFatal(); });
}

// The dashed + where a guest's avatar will be: one soft pulse after "Got it",
// so the eye learns where the door is. Instant-off under Low Power and
// reduced motion, like every motion here.
function pulseJoinRing() {
  for (const id of ['dock-you', 'rail-you']) {
    const ring = $(id);
    if (!ring || !ring.classList.contains('guest') || !canAnimate(ring, ctx)) continue;
    ring.animate([{ transform: 'none' }, { transform: 'scale(1.22)' }, { transform: 'none' }],
      { duration: 520, delay: OUT_MS, easing: EASE_ARRIVE });
  }
}

// recordSelection writes pending; mirror into the local doc for instant render.
function applyLocalPick(artist, person, level) {
  state.ensureFestivalState(ctx.fid);
  const sels = state.crewDoc.festivals[ctx.fid].selections;
  (sels[artist] = sels[artist] || {})[person] = level;
  state.persist();
}

// ---- header / toolbar / dock ------------------------------------------------------
function applyFestTheme() {
  const fest = state.fest();
  document.body.style.setProperty('--fest', fest.accent || '192, 132, 252');
  $('fest-name').textContent = fest.name.toUpperCase();
  $('fest-year').textContent = fest.year || '';
  $('fest-sub').replaceChildren(festPlaceLine(fest)); // the venue is a door to the map when the fest file knows where it is
  // Dock (mobile bottom) and day rail (desktop top) carry the same fest
  // name + sync dot — one component vocabulary, two positions (note 1.1).
  $('dock-fest-name').textContent = festLinkLabel(fest);
  $('rail-fest-name').textContent = festLinkLabel(fest);
  document.title = `${fest.name} — Festival Navigator`;
  startFavicon(fest.accent, { lowPower: ctx.lowPower });
}

// A member chip has ONE job (2026-08-29): TAP = the people filter (design
// option A, 2026-08-27) — the wall shows only what that person picked; tap
// more chips to combine; your own chip is "my picks". A view, so it is cheap
// to try and cheap to undo (the "everyone ✕" chip at the end of the row).
// Picking AS someone else lives in Settings → You: people rarely switch, and
// a hold-arm-confirm dance on the wall was machinery for a rare act (Kevin).
function renderPersonChips() {
  const row = $('person-chips');
  row.textContent = '';
  const filter = ctx.filterPeople || [];
  for (const [name, p] of state.activePeople()) {
    const isMe = name === ctx.meName;
    const chip = document.createElement('button');
    chip.className = 'person-chip' + (isMe ? ' you' : '');
    const ci = colorIndexOf(name, p);
    chip.style.background = hslOf(ci, 0.5);
    chip.style.border = '1px solid ' + strokeOf(ci, isMe);
    chip.textContent = name;
    const selected = filter.includes(name);
    if (selected) chip.classList.add('selected');
    else if (filter.length) chip.classList.add('faded');
    chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
    const whose = isMe ? 'your' : `${name}'s`;
    chip.setAttribute('aria-label', selected
      ? (filter.length > 1 ? `Remove ${name} from the filter` : `Showing only ${whose} picks; tap to show everyone`)
      : `Show only ${whose} picks`);
    chip.addEventListener('click', () => togglePeopleFilter(name));
    row.appendChild(chip);
  }
  if (filter.length) {
    const all = document.createElement('button');
    all.className = 'person-chip everyone';
    all.setAttribute('aria-label', 'Show everyone’s picks');
    all.append('everyone');
    const x = document.createElement('span');
    x.className = 'x';
    x.textContent = '✕';
    all.appendChild(x);
    all.addEventListener('click', () => setPeopleFilter([]));
    row.appendChild(all);
  }
  // Add-on-their-behalf lives right where the crew is visible (note 5) —
  // only for claimed devices; a spectator can't grow the crew.
  if (ctx.meName) {
    const add = document.createElement('button');
    add.className = 'person-chip add';
    add.textContent = '+ Add';
    add.setAttribute('aria-label', 'Add someone to the crew');
    add.style.cursor = 'pointer';
    add.addEventListener('click', () => { openAddMember(); router.push('sheet:add-member'); });
    row.appendChild(add);
  }
}

function setPeopleFilter(names) {
  savePeopleFilter(ctx.fid, names);
  refreshCtx();
  renderPersonChips();
  repaintWall();
}
function togglePeopleFilter(name) { setPeopleFilter(togglePerson(ctx.filterPeople || [], name)); }

// ---- the now line's clock and the day-of open ------------------------------------
// One ticker for the app: every minute (and the moment the tab comes back
// from the background) the now line moves and the now mark hops to whoever is
// playing — both without a repaint. Cheap when nothing is today's:
// positionNowLines and positionNowMarks find nothing to do. Both are the
// wall's: it drew the line and stamped the windows, and the shell's job here
// is the clock, not a second opinion about what is playing.
let clockTimer = null;
function startClock() {
  if (clockTimer) return;
  clockTimer = setInterval(tickClock, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tickClock(); });
}
function tickClock(date = new Date()) {
  positionNowLines($('wall-root'), date);
  positionNowMarks($('wall-root'), date);
  paintNowTabs(date); // the same minute decides whether NOW is there at all
}

// ---- NOW: the jump to what is playing (Kevin, 2026-09-24) -------------------------
// "an option to the left of the days … if you tap it goes to now. A use case
// I'm thinking about is like 'where is ross likely right now' — tapping ross
// on the top to highlight him and then clicking something in the scroll to
// time bar." NOW sits before the day tabs in the dock and the rail, in the
// now line's violet with a live dot, and only while something is live on the
// wall you are looking at: a now line on today's grid or a NOW mark on a
// stack (wall.js nowLanding decides what, and whether). It is not a day, so
// the scrollspy never lights it; it arrives with the beat and leaves quick
// and plain, and the days beside it slide to make room.
const NOW_TABS = ['dock-now', 'rail-now'];
function paintNowTabs(date = ctx.now || new Date()) {
  const live = !!nowLanding($('wall-root'), ctx, date);
  for (const id of NOW_TABS) { showNowTab($(id), live); fitNowTab($(id)); }
}
// The days keep room for the day you are in AND a glimpse of the days either
// side — the glimpse is what says the row scrolls. On a phone the dock's days
// row already scrolls (Portola's four overflow a 390 dock by a few px), and
// NOW narrows it further. With the day you are in centred, a neighbour shows
// only once the room beside it clears the gap between tabs AND the edge fade
// (the first cut counted neither and kept NOW's word with one lone day
// showing: Portola at 320, ACL at 375 — review, 2026-09-24). Where the row is
// shorter than that, NOW keeps only its live dot — still a button, still named
// "Jump to what is playing now". Gap and fade are read from the row's own CSS
// (`--row-fade` is the number the fade itself uses). Measured in the full form
// every time, so the answer never feeds on itself.
//
// And the last resort: where even beside the dot the row is narrower than one
// day (ACL's long name at 320 wherever Inter draws wide — Linux CI measured a
// 36px row for a ~40px tab, 2026-09-24; Android draws like Linux), the row
// claims its widest tab and the fest name gives way with an ellipsis. The
// day you are in is never what NOW squeezes out.
function fitNowTab(tab) {
  if (!tab) return;
  const bar = tab.parentElement;
  const row = tab.nextElementSibling;
  tab.classList.remove('compact');
  if (bar) bar.classList.remove('squeezed');
  if (row) row.style.minWidth = '';
  if (tab.hidden || !row || !row.children.length) return;
  const css = window.getComputedStyle(row);
  const gap = parseFloat(css.columnGap) || 0;
  const fade = parseFloat(css.getPropertyValue('--row-fade')) || 0;
  const widest = Math.max(...[...row.children].map((t) => t.offsetWidth));
  if (row.clientWidth >= Math.min(row.scrollWidth, widest + 2 * (gap + fade))) return;
  tab.classList.add('compact');
  if (row.clientWidth < Math.min(row.scrollWidth, widest) && bar) {
    row.style.minWidth = `${widest}px`;
    bar.classList.add('squeezed');
  }
}
// The day tabs beside a NOW that came or went slide from where they were (a
// FLIP: transform only, the layout is already done). Tab by tab, not the
// row: the dock centres a row that fits, so its tabs move by HALF the space
// NOW took, and a row-wide slide would jump before it glided.
const tabLefts = (row) => new Map(row ? [...row.children].map((t) => [t, t.getBoundingClientRect().left]) : []);
function slideTabs(before) {
  for (const [t, left] of before) {
    if (!t.isConnected || !canAnimate(t, ctx)) continue;
    const dx = left - t.getBoundingClientRect().left;
    if (Math.abs(dx) >= 1) t.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: CASCADE_MS, easing: EASE_ARRIVE });
  }
}
function showNowTab(tab, on) {
  if (!tab) return;
  const shown = !tab.hidden && !tab.dataset.leaving;
  if (on === shown) return;
  const row = tab.nextElementSibling;
  if (on) {
    delete tab.dataset.leaving;
    if (tab.getAnimations) tab.getAnimations().forEach((a) => a.cancel()); // a leave cut short
    const before = tabLefts(row);
    tab.hidden = false;
    fitNowTab(tab);
    slideTabs(before);
    if (canAnimate(tab, ctx)) {
      tab.animate([{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }],
        { duration: CASCADE_MS, delay: STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' });
    }
    return;
  }
  tab.dataset.leaving = '1';
  const gone = () => {
    if (!tab.dataset.leaving) return; // it came back while leaving
    delete tab.dataset.leaving;
    const before = tabLefts(row);
    tab.hidden = true;
    fitNowTab(tab); // gone: whatever room it took is given back
    if (tab.getAnimations) tab.getAnimations().forEach((a) => a.cancel());
    slideTabs(before);
  };
  if (!canAnimate(tab, ctx)) { gone(); return; }
  const a = tab.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-6px)' }],
    { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' });
  a.onfinish = gone;
  a.oncancel = gone;
}

// Where a person can see: under the sticky chrome — inside a grid, under its
// pinned stage strip too — and above the dock on a phone.
function seenBand(inGrid) {
  const vars = window.getComputedStyle(document.documentElement);
  let top = parseFloat(vars.getPropertyValue('--jump-offset')) || 8;
  if (inGrid) {
    const block = inGrid.closest('.tt-block');
    const strip = block ? block.querySelector('.stage-strip') : null;
    top = (parseFloat(vars.getPropertyValue('--rail-h')) || 0) + (strip ? strip.offsetHeight : 0);
  }
  const dock = $('dock');
  const docked = dock && window.getComputedStyle(dock).display !== 'none' && !dock.classList.contains('hidden');
  return { top, bottom: docked ? dock.getBoundingClientRect().top : window.innerHeight };
}

// Tap NOW: land on what is playing (wall.js nowLanding says what, nowStops
// says where each tap after it goes).
//   · the now line — a third of the way down what you can see, the day-of
//     open's own landing, so the sets crossing it (playing) and the next hour
//     are both on screen;
//   · a highlighted person's pick on the grid — the LINE AND THE CARD
//     together (Kevin: "the line and highlight combo"); the grid slid
//     sideways to frame the stop's cells when they are off screen;
//   · a card in a stack — its NOW mark is its line: the card a quarter of the
//     way down under the chrome, its venue's head above it.
// TAP AGAIN (Kevin, 2026-09-24: "multiple taps … should move the user to the
// next now item … by height"): while the page still sits where the last NOW
// left it — down and across, within 4px, or still gliding there — and that
// stop is still live, the next tap goes to the next stop (down the page;
// across a grid where a highlighted person's picks sit in columns that do not
// fit the screen together), and after the last back to the top. Scroll away
// by hand, either way, and the next tap is a fresh "take me to now" — the
// best answer again. One stop only: a repeat tap pulses in place — while the
// page still shows it; once the clock has walked it off screen, the tap
// brings it back (wall.js nowStep).
// What it lands on pulses (transform only; none under Reduce Motion or Low
// Power): the highlighted person's picks in that stop, or the stop's NOW
// cards; a line landing does not — the glide there is its answer. A tap that
// moves nothing at all still answers: where no card pulses, the stop's line
// and its time label on the rail do (the phone walk, 2026-09-24: Sat 7 PM,
// nobody highlighted, the line the only stop — tap 2 neither moved nor
// pulsed, a dead button). A highlight with nothing on gets the quiet
// line once, on the first tap, and no card pulse on any tap — a stranger's
// card pulsing reads as "Kat is here" (review, 2026-09-24); the line is not
// anyone's, so it may.
// Where the last NOW left the page, for the next tap (wall.js stillThere
// says what it holds and why the grid is named by its day).
let nowCycle = null;
// Every tap is numbered; a tap's pulse waits for its glide, and a later tap
// cancels it (two quick taps pulsed the first stop's cards on the second's).
let nowSeq = 0;
const pageGeo = (root) => ({
  scrollY: window.scrollY,
  maxY: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  now: performance.now(),
  box: (el) => el.getBoundingClientRect(),
  band: (grid) => seenBand(grid),
  scroller: (cell) => {
    const el = cell.closest('.times-scroll');
    if (!el) return null;
    return { el, x: el.getBoundingClientRect().left, left: el.scrollLeft, width: el.clientWidth, max: Math.max(0, el.scrollWidth - el.clientWidth) };
  },
  gridLeft: (iso) => {
    const grid = root.querySelector(`.times-grid[data-iso="${CSS.escape(iso)}"]`);
    const el = grid && grid.closest('.times-scroll');
    return el ? el.scrollLeft : null;
  },
  // A stack card's sideways row (a clocked stack on a phone, v91), named by
  // where it stands so the name survives a repaint, as a grid's day does.
  row: (card) => {
    const el = card.closest('.stack-scroll');
    if (!el) return null;
    return { el, key: stackRowKey(el), x: el.getBoundingClientRect().left + el.clientLeft, left: el.scrollLeft, width: el.clientWidth, max: Math.max(0, el.scrollWidth - el.clientWidth) };
  },
  rowLeft: (key) => {
    const el = [...root.querySelectorAll('.stack-scroll')].find((r) => stackRowKey(r) === key);
    return el ? el.scrollLeft : null;
  },
});
function jumpToNow() {
  const seq = ++nowSeq;
  const root = $('wall-root');
  const geo = pageGeo(root);
  const plan = nowStops(root, ctx, ctx.now || new Date(), geo);
  if (!plan || !plan.stops.length) { nowCycle = null; paintNowTabs(); return; }
  const { best } = plan;
  // Which stop, led by what, landing where: wall.js nowStep. A stop lands the
  // same way every time it is reached — first tap, next tap or wrap — at its
  // own landing (its top member's). Landing on the answer's own spot instead
  // put the first tap and the wrap a few hundred px apart when the answer was
  // not the stop's top card (Fri 11:30 PM at 1280: 618 vs 418).
  const { fresh, stop, lead, target } = nowStep(plan, nowCycle, geo);
  const quiet = fresh && best.match === false ? nothingOnFor(ctx.filterPeople || []) : null;
  if (quiet) showToast($('toast-root'), quiet);
  // Said as well as shown (Codex, 2026-09-24: NOW announced nothing — the
  // page moved under a screen reader in silence). The quiet line leads when
  // there is one; the toast is unchanged, and it is not a live region, so it
  // is heard once, from here.
  sayNow(quiet ? `${quiet} ${nowSaid(plan, stop)}` : nowSaid(plan, stop));
  const smooth = canAnimate(root, ctx);
  const behavior = smooth ? 'smooth' : 'auto';
  // Across: a stop of grid cells slides its grid to frame them (wall.js
  // frameSlide) — only when some of them are out of view, so a grid you are
  // already looking at stays put.
  let slid = false;
  let sc = null;
  let sl = 0;
  if (stop.frame && stop.frame.sc.el.isConnected) {
    sc = stop.frame.sc.el;
    sl = sc.scrollLeft;
    const inView = stop.frame.lo >= sl + 8 && stop.frame.hi <= sl + sc.clientWidth - 8;
    if (!inView) {
      sl = stop.slide;
      if (Math.abs(sl - sc.scrollLeft) >= 1) { sc.scrollTo({ left: sl, behavior }); slid = true; }
    }
  }
  // Across, for the stop's stack cards (v91): a phone's clocked stack row
  // scrolls sideways by its lead space, and its right-hand card runs off the
  // screen at rest. Each row holding one of them slides just enough to show
  // them whole (wall.js rowSlide) — and not at all when they already are.
  const rowsSlid = [];
  for (const r of stop.rows || []) {
    if (!r.el.isConnected || Math.abs(r.slide - r.el.scrollLeft) < 1) continue;
    r.el.scrollTo({ left: r.slide, behavior });
    rowsSlid.push(r.el);
  }
  const moves = Math.abs(target - window.scrollY) >= 1;
  if (moves) window.scrollTo({ top: target, behavior });
  // Anything this tap moved: the page, a grid, a stack row.
  const moved = moves || slid || rowsSlid.length > 0;
  nowCycle = {
    lead: lead.key, y: target, grid: sc ? stop.frame.iso : null, sl,
    rows: (stop.rows || []).map((r) => [r.key, r.slide]),
    until: moved && smooth ? performance.now() + 1500 : 0,
  };
  // The "still gliding there" grace lasts only as long as the glide: when it
  // ends (both glides, if the grid slid too), where the page stands is the
  // whole answer again — so a hand scroll right after a landing makes the
  // next tap fresh, however quick (CI, 2026-09-24: a hand scroll inside the
  // old fixed 1.5 s was taken for "still there" and the tap went on to the
  // next stop). Engines without scrollend (WebKit before 26) keep the 1.5 s cap.
  if (nowCycle.until) {
    const mine = nowCycle;
    let glides = (moves ? 1 : 0) + (slid ? 1 : 0) + rowsSlid.length;
    const ended = () => { glides -= 1; if (glides <= 0 && nowCycle === mine) mine.until = 0; };
    const onPage = () => { window.removeEventListener('scrollend', onPage); ended(); };
    const onGrid = () => { sc.removeEventListener('scrollend', onGrid); ended(); };
    const onRow = (el) => { const once = () => { el.removeEventListener('scrollend', once); ended(); }; el.addEventListener('scrollend', once); return () => el.removeEventListener('scrollend', once); };
    if (moves) window.addEventListener('scrollend', onPage);
    if (slid) sc.addEventListener('scrollend', onGrid);
    const offRows = rowsSlid.map(onRow);
    // No listener outlives the cap (an engine with no scrollend never calls them).
    setTimeout(() => { window.removeEventListener('scrollend', onPage); if (sc) sc.removeEventListener('scrollend', onGrid); offRows.forEach((off) => off()); }, 1600);
  }
  // What pulses: the stop's cards — the highlighted person's picks, or, for
  // nobody, the NOW cards of a stop a card leads. Never a line's stop, and
  // never with no match — except that a tap that moved nothing pulses the
  // stop's line, so no tap is dead.
  const pulses = best.match === true || (best.match === null && lead.card);
  const cards = pulses ? stop.members.filter((m) => m.card).map((m) => m.card) : [];
  const bumps = cards.filter((c) => canAnimate(c, ctx));
  if (!bumps.length) {
    if (!moved) pulseLine((stop.members.find((m) => m.line) || {}).line || null);
    return;
  }
  // Who to pulse, by identity rather than by node: the wall can replace a
  // card during the glide (a poll repaint, a pick), and the pulse belongs on
  // whatever node stands there when it lands.
  const who = bumps.map((c) => ({ card: c, artist: c.dataset.artist, occ: c.dataset.occ || '', room: roomOf(c) }));
  let pulsed = false;
  const pulse = () => {
    if (pulsed) return;
    // Clean up first, whatever happens next: a return before this line left a
    // scrollend listener (and the detached card it closed over) on the window
    // for the life of the page (review, 2026-09-24).
    pulsed = true;
    window.removeEventListener('scrollend', pulse);
    // A later NOW tap owns the page: this tap's pulse would land on its stop.
    if (seq !== nowSeq) return;
    // Only what still answers when the glide lands, by the rule that chose it
    // (wall.js nowPulseable): the wall can change under a glide, and a pick
    // dropped mid-glide must not pulse as though it were still theirs.
    const answers = new Set(nowPulseable(root, ctx, ctx.now || new Date(), best.match));
    for (const w of who) {
      let target = w.card;
      if (!target.isConnected) {
        let occ = null;
        try { occ = w.occ ? JSON.parse(w.occ) : null; } catch { occ = null; }
        target = cardFor(root, w.artist, occ, { room: w.room });
      }
      if (!target || !answers.has(target) || !canAnimate(target, ctx)) continue;
      // 6% of an ordinary card is a few pixels; 6% of a six-hour slab is forty.
      // The pulse grows a card by at most ~12px on its longer side.
      const size = target.getBoundingClientRect();
      const grow = Math.min(0.06, 12 / Math.max(1, size.width, size.height));
      target.animate([{ transform: 'scale(1)' }, { transform: `scale(${(1 + grow).toFixed(4)})`, offset: 0.4 }, { transform: 'scale(1)' }],
        { duration: 460, iterations: 2, easing: EASE_SURFACE });
    }
  };
  // Already there (a repeat tap on the one stop): the pulse is the whole answer, at once.
  if (!moved) { pulse(); return; }
  window.addEventListener('scrollend', pulse);
  setTimeout(pulse, 750); // a sideways-only glide, or an engine without scrollend (WebKit)
}
// The polite status region (index.html #now-status). A live region speaks
// when its text CHANGES, so a repeat tap that lands on the same words would
// be silent: the region is emptied, then filled a beat later — and only by
// the latest tap, when taps come quicker than the beat.
let sayTimer = null;
function sayNow(text) {
  const region = $('now-status');
  if (!region) return;
  region.textContent = '';
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => { region.textContent = text; }, 100);
}
// The line's pulse, for a tap that moved nothing and pulses no card: the line
// thickens and its time label on the rail swells, twice, on the card pulse's
// beat and curve — transform only (the label keeps its own centring
// translate), and nothing at all under Reduce Motion or Low Power.
function pulseLine(line) {
  if (!line || !line.isConnected || !canAnimate(line, ctx)) return;
  const beat = { duration: 460, iterations: 2, easing: EASE_SURFACE };
  line.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(2)', offset: 0.4 }, { transform: 'scaleY(1)' }], beat);
  const label = nowLabelOf(line);
  if (label) label.animate([{ transform: 'translateY(-50%) scale(1)' }, { transform: 'translateY(-50%) scale(1.15)', offset: 0.4 }, { transform: 'translateY(-50%) scale(1)' }], beat);
}

// The quiet line when the highlighted people have nothing on: "Nothing of
// Kat’s is on right now — here’s what is." Yours, one name, two names, or
// "theirs" past that; the landing below it is what is on.
function nothingOnFor(people, meName = ctx.meName) {
  let whose;
  if (people.length === 1 && people[0] === meName) whose = 'yours';
  else if (people.length === 1) whose = `${people[0]}’s`;
  else if (people.length === 2) whose = `${people[0]}’s or ${people[1]}’s`;
  else whose = 'theirs';
  return `Nothing of ${whose} is on right now — here’s what is.`;
}

// Where a day tab lands on the wall, in the wall's own words (DAY_ANCHOR):
// its day's block, whose first head names the day.
const anchorFor = (key) => `#wall-root ${DAY_ANCHOR.replace('[data-day]', `[data-day="${CSS.escape(key)}"]`)}`;

// Which day the wall opens on (MODEL-V4 §2): the festival's first VISIBLE grid
// day. The day axis leads with whatever plays first — Portola's Thursday
// afters — and opening a festival on somebody else's warehouse party is the
// wrong answer. The axis is the visible week (a hidden day is not on it) and
// each tab says whether it carries a grid, so the fest is never asked. During
// the festival the day-of rule below wins instead.
export function defaultDayOf(days) {
  if (!days || !days.length) return null;
  return days.find((d) => d.grid) || days[0];
}

// During the festival, with today's part hidden (the day-of scroll found no
// block for today): the next visible day. Before the festival nothing has
// begun and there is no "next" — the first grid day is the open; after it,
// likewise. A dated section is a tab, not a day.
export function nextVisibleDay(days, todayIso) {
  const dated = (days || []).filter((d) => !d.dated && d.iso);
  if (!dated.some((d) => d.iso <= todayIso)) return null;
  return dated.find((d) => d.iso >= todayIso) || null;
}

// Land a day's block where a day-tab jump lands it: below the sticky chrome
// (--jump-offset, measured into every block's scroll-margin-top).
function landOnDay(block) {
  const pageY = block.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
  const offset = (typeof window.getComputedStyle === 'function')
    ? parseFloat(window.getComputedStyle(block).scrollMarginTop) || 0 : 0;
  window.scrollTo({ top: Math.max(0, pageY - offset), behavior: 'auto' });
}

// The open: land on the festival, ONCE per festival-day per tab — a re-render
// after a pick must never yank the scroll, and a phone resumed from the
// background keeps its place. A fresh open (new tab, a PWA cold start) lands
// again, which is the point. Never while searching.
function maybeOpenOnDay() {
  if (ctx.query) return;
  // One claim per festival per festival-day: the morning landing on today's
  // header, the afternoon landing on the now line and the week-before landing
  // on the first grid day are all the same open. Marked only after a real
  // scroll, so an open with nothing to land on doesn't spend the claim.
  const tz = state.fest().timezone || null; // the festival's clock, not the phone's
  const key = dayOfScrollKey(ctx.fid, new Date(), tz);
  if (scrolledBefore(key)) return;
  // During the festival: the now line, or today's first head before doors —
  // a Late nights date counts as today when no grid day is (wall.js
  // scrollToNowLine).
  if (scrollToNowLine($('wall-root'), { timeZone: tz })) { rememberScrolled(key); return; }
  // During it with today hidden: the next visible day. Before it and after
  // it: the first visible grid day.
  const tabs = dayNavOf(state.fest(), ctx);
  const day = nextVisibleDay(tabs, festivalClock(new Date(), tz).iso) || defaultDayOf(tabs);
  if (!day) return;
  const block = document.querySelector(anchorFor(day.anchor || day.key));
  if (!block) return;
  landOnDay(block);
  rememberScrolled(key);
}

// The explicit identity switch (FLOW-8), called from Settings.
function switchIdentity(name) {
  crew.setMe(state.getCrewToken(), name);
  withdrawBringOffer(); // an offer of one person's picks is never another's
  // The wall is painted per identity (your level in every label, the white
  // stroke on your marks) — Settings → You is the ONLY switch now, so the
  // repaint lives here, not in a caller (Codex gate, 2026-08-29).
  repaintWall();
  renderYou();
  showToast($('toast-root'), `You’re ${name} on this device now.`);
}

// Paints BOTH "you" avatars — mobile dock and desktop day rail — from the
// same identity fact (unified chrome, note 1.1).
// A guest's slot is a dashed + (v92): the standing door to join — the
// avatar's place, empty and asking. On join the + gives way to the letter.
function renderYou() {
  const guest = !ctx.meName && !!state.getCrewToken();
  for (const id of ['dock-you', 'rail-you']) {
    const you = $(id);
    const wasGuest = you.classList.contains('guest');
    you.textContent = '';
    you.classList.toggle('guest', guest);
    if (!ctx.meName) {
      // No name: nothing of the last person's colour stays behind.
      you.style.background = '';
      you.removeAttribute('title');
      if (guest) you.textContent = '+';
      you.setAttribute('aria-label', guest ? 'Add yourself to the crew' : 'Jump to top');
      continue;
    }
    const p = state.people()[ctx.meName];
    const ci = colorIndexOf(ctx.meName, p);
    you.style.background = hslOf(ci, 0.5);
    you.textContent = ctx.meName.charAt(0).toUpperCase();
    you.title = ctx.meName;
    you.setAttribute('aria-label', `${ctx.meName} — jump to top`);
    // The + becoming you is a small event: the letter grows in where the
    // ring was, rather than swapping under the eye.
    if (wasGuest && canAnimate(you, ctx)) {
      you.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }],
        { duration: GROW_MS, easing: EASE_ARRIVE });
    }
  }
}

// Sticky-chrome geometry, measured not hardcoded: the stage strip pins below
// the day rail (--rail-h; 0 on mobile where the rail is display:none), and
// day jumps land headers below rail + strip (--jump-offset via
// scroll-margin-top). Re-measured every repaint and on resize — fluid type
// makes both heights breakpoint-dependent.
function measureStickyChrome() {
  const rail = $('day-rail');
  const railH = rail && rail.offsetHeight ? rail.offsetHeight : 0;
  const strip = document.querySelector('.stage-strip');
  // On a day-first wall every strip is scoped to its own timetable block
  // (`.tt-block`), so no strip ever sits above a day's first head — a jump
  // lands against the rail alone.
  const scoped = !!document.querySelector('#wall-root .tt-block');
  const stripH = strip && !scoped ? strip.offsetHeight : 0;
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--rail-h', `${railH}px`);
  rootStyle.setProperty('--jump-offset', `${railH + stripH + 6}px`);
}

let unspy = () => {};
// One day list feeds BOTH navigations: the mobile dock and the desktop day
// rail (DT-1). The axis is the wall's own (wall.js dayNavOf) so the tabs and
// the wall can never disagree: the days something plays on, then a tab per
// dated section (LATE) after them (MODEL-V4 §2).
//
// Two fields are optional and mean nothing to a single-weekend fest:
// `anchor` is the day block this tab jumps to when it is not the day's key —
// a two-weekend fest renders Friday twice and one key cannot address both —
// and `num` is the date the dock tab wears to tell those two apart
// (FRI 2 · SAT 3 · SUN 4 · FRI 9 · SAT 10 · SUN 11). The rail's long label
// carries its own date, so it never needs the num.
export function dayTab({ key, num = null, anchor = null }, label, { withNum = false } = {}) {
  const tab = document.createElement('button');
  tab.className = 'day-tab';
  tab.dataset.day = anchor || key;
  tab.textContent = label;
  if (withNum && num) {
    const n = document.createElement('span');
    n.className = 'num';
    n.textContent = String(num);
    tab.appendChild(n);
    tab.setAttribute('aria-label', `${label} ${num}`); // read as "FRI 2", not "FRI2"
  }
  return tab;
}

function renderDayNav() {
  const dock = $('dock-days');
  const rail = $('rail-days');
  dock.textContent = '';
  rail.textContent = '';
  // The wall is painted first on every path that gets here, so it can be the
  // answer to "which days are there": while a search is on, the tabs are the
  // days it answered and nothing else.
  for (const day of dayNavOf(state.fest(), ctx, $('wall-root'))) {
    const at = day.anchor || day.key;
    const jump = () => {
      const target = document.querySelector(anchorFor(at));
      if (target) target.scrollIntoView({ behavior: ctx.lowPower ? 'auto' : 'smooth', block: 'start' });
    };
    for (const [host, tab] of [[dock, dayTab(day, day.short, { withNum: true })], [rail, dayTab(day, day.long)]]) {
      tab.addEventListener('click', jump);
      host.appendChild(tab);
    }
  }
  unspy();
  unspy = wireScrollspy([dock, rail], $('wall-root'));
  // NOW rides with the tabs: it is there exactly while this wall has
  // something live (a repaint, a search, a hidden room can all change that).
  paintNowTabs();
}

// ---- the show menu (MODEL-V4 §3.1) ------------------------------------------------
// The fest name at the end of the dock (phone) and of the day rail (desktop)
// is the door to what the wall shows: `Show`, a row per room of the festival
// week with a check, then Settings — because that tap opened Settings before
// V4 and nothing may be lost. Unchecking a room folds it on every day, which
// is the SAME state a tap on that room's header writes. A fest with one room
// has no menu: the tap goes straight to Settings, as it always did.
//
// The sort chip's popover component, reused (`.sort-wrap` + `.sort-pop`) —
// one control vocabulary. On the phone it opens upward above the dock; on
// desktop it hangs under the rail (both from the CSS).
const SHOW_MENUS = [['dock-fest-wrap', 'dock-fest-link'], ['rail-fest-wrap', 'rail-fest-link']];
let openMenu = null;

function closeShowMenu({ instant = false } = {}) {
  if (!openMenu) return;
  const { pop, link } = openMenu;
  openMenu = null;
  link.setAttribute('aria-expanded', 'false');
  const hide = () => { pop.style.display = 'none'; };
  // The way out is quick and plain.
  if (instant || !canAnimate(pop, ctx)) { hide(); return; }
  const a = pop.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(4px)' }],
    { duration: OUT_MS, easing: EASE_LEAVE });
  a.onfinish = hide;
  a.oncancel = hide;
}

function openShowMenu(wrap, link, pop) {
  closeShowMenu({ instant: true });
  openMenu = { wrap, link, pop };
  pop.style.display = '';
  link.setAttribute('aria-expanded', 'true');
  // The way in has the beat.
  if (canAnimate(pop, ctx)) {
    pop.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: CASCADE_MS, easing: EASE_ARRIVE, fill: 'backwards' });
  }
}

// A row is a native <button>, which is where its keyboard and its 44px floor
// come from — not from a second roving-focus controller lifted out of
// sort-control.js, and not from a list of selectors in the stylesheet. The
// popover keeps its listbox presentation; the <li> around each button is
// packaging, so the button carries the option role.
function showMenuRow(label, { key = null, on = null, settings = false } = {}) {
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  const row = document.createElement('button');
  row.type = 'button';
  row.setAttribute('role', 'option');
  if (key != null) row.dataset.room = key;
  if (on != null) row.setAttribute('aria-selected', on ? 'true' : 'false');
  if (settings) row.className = 'settings';
  const check = document.createElement('span');
  check.className = 'check';
  check.textContent = on ? '✓' : '';
  check.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.textContent = label;
  row.append(check, text);
  if (settings) {
    const chev = document.createElement('span');
    chev.className = 'chev';
    chev.textContent = '›';
    chev.setAttribute('aria-hidden', 'true');
    row.appendChild(chev);
  }
  li.appendChild(row);
  return row;
}

function buildShowMenu(rooms, folded) {
  const pop = document.createElement('ul');
  pop.className = 'sort-pop';
  pop.setAttribute('role', 'listbox');
  pop.setAttribute('aria-label', 'Show on the wall');
  pop.dataset.rooms = rooms.map((r) => r.key).join('|');
  pop.style.display = 'none';
  const head = document.createElement('li');
  head.className = 'pop-head';
  head.setAttribute('role', 'presentation');
  head.textContent = 'Show';
  pop.appendChild(head);
  for (const room of rooms) {
    const row = showMenuRow(room.label, { key: room.key, on: !folded.has(room.key) });
    // A row tap closes the menu and moves the room — the fold flow owns the
    // motion from there, on every day at once.
    row.addEventListener('click', () => { closeShowMenu(); toggleFoldFlow(room.key); });
    pop.appendChild(row.parentElement);
  }
  const divider = document.createElement('li');
  divider.className = 'pop-div';
  divider.setAttribute('role', 'presentation');
  divider.setAttribute('aria-hidden', 'true');
  pop.appendChild(divider);
  const settings = showMenuRow('Settings', { settings: true });
  settings.addEventListener('click', () => {
    closeShowMenu({ instant: true });
    openSettings();
    router.push('settings');
  });
  pop.appendChild(settings.parentElement);
  return pop;
}

function paintShowMenus() {
  // A search wall has no rooms, and the fest name must not change what it
  // does while someone is typing — the festival's rooms are the same rooms.
  if (ctx.query) return;
  const rooms = roomsOnWall();
  const folded = new Set(ctx.folded || []);
  const signature = rooms.map((r) => r.key).join('|');
  for (const [wrapId, linkId] of SHOW_MENUS) {
    const wrap = $(wrapId);
    const link = $(linkId);
    if (!wrap || !link) continue;
    const existing = wrap.querySelector('.sort-pop');
    if (rooms.length < 2) {
      if (existing) { if (openMenu && openMenu.pop === existing) closeShowMenu({ instant: true }); existing.remove(); }
      link.removeAttribute('aria-haspopup');
      link.removeAttribute('aria-expanded');
      link.setAttribute('aria-label', 'Open settings');
      continue;
    }
    link.setAttribute('aria-haspopup', 'listbox');
    link.setAttribute('aria-label', 'Show on the wall');
    // A repaint on the 25 s poll must not snatch an open menu away: while the
    // rooms are the same list, the checks are repainted in place.
    if (existing && existing.dataset.rooms === signature) {
      for (const row of existing.querySelectorAll('[data-room]')) {
        const on = !folded.has(row.dataset.room);
        row.setAttribute('aria-selected', on ? 'true' : 'false');
        row.querySelector('.check').textContent = on ? '✓' : '';
      }
      continue;
    }
    if (existing) { if (openMenu && openMenu.pop === existing) closeShowMenu({ instant: true }); existing.remove(); }
    link.setAttribute('aria-expanded', 'false');
    wrap.appendChild(buildShowMenu(rooms, folded));
  }
}

function repaintWall() {
  // A full repaint replaces every card. A zoom that was standing comes back
  // on the fresh card at once (a crew-mate's pick arriving on the 25 s poll
  // must not eat the card you are resting on); a card that is gone — a
  // filter hid it, a fest switch — takes its zoom with it.
  const keep = zoomSnapshot();
  // Which room the zoom was standing in, read BEFORE the wall is torn down —
  // a combined-day show is one occurrence rendered in two rooms, so the room
  // is what tells its two identical cards apart (wall.js cardFor).
  const keepRoom = keep ? roomOf(zoomedCard()) : null;
  unzoom({ instant: !!keep, why: 'wall repaint' });
  refreshCtx();
  renderWall($('wall-root'), ctx);
  if (keep) {
    const again = cardFor($('wall-root'), keep.artist, keep.occ, { room: keepRoom });
    if (again) zoomCard(again, keep.artist, ctx, { ...keep, instant: true });
  }
  renderDayNav();
  paintShowMenus();
  positionNowMarks($('wall-root'), ctx.now || new Date());
  $('notes-count').textContent = String(model.totalNoteCount(state.crewDoc, ctx.fid));
  // A timetable has one true order — a sort control there would be a lie
  // (CORE-5). Searching a scheduled fest sorts chronologically by design.
  const scheduled = !!(state.fest().days && Object.keys(state.fest().days).length);
  $('sort-control').style.display = scheduled ? 'none' : '';
  updateMigrationBanner();
  updateArchiveNote();
  measureStickyChrome();
}

// The first-wall coach mark (CT-1) lived here until v92: one strip in the
// toolbar, which the day-of open scrolled out of sight before anyone read it
// (design brief §1.6, measured). The welcome card above the dock
// (welcome.js, maybeWelcome) says it instead, where the thumb is.

// An archived fest reads as a memory, not a live plan (ST-5).
//
// The banner is keyed to the fest it was written for. It used to bail out with
// `if (existing) return`, so switching from one archived festival straight to
// another left the PREVIOUS festival's name sitting above the new one's wall —
// the screen calmly saying you were looking at Electric Forest while showing
// you Lollapalooza (finish pass, 2026-07-12).
function updateArchiveNote() {
  const existing = document.getElementById('archive-note');
  const fest = state.fest();
  if (fest.status !== 'archived') { if (existing) existing.remove(); return; }

  const text = `${fest.name} ${fest.year || ''} already happened — this wall is the memory. Picks still work for the record.`.replace('  ', ' ');
  if (existing) {
    if (existing.dataset.fid !== fest.id) {
      existing.dataset.fid = fest.id;
      existing.textContent = text;
    }
    return;
  }
  const bar = document.createElement('div');
  bar.id = 'archive-note';
  bar.dataset.fid = fest.id;
  bar.style.cssText = 'margin-top: 11px; padding: 9px 13px; border: 1px solid var(--border-card); border-radius: var(--r-row); color: var(--text-secondary); font-size: 12px; font-weight: 600; line-height: 1.45; background: var(--card);';
  bar.textContent = text;
  insertStrip(bar);
}


// Toolbar strips insert in call order (audit 1.4): each lands after the last
// existing strip, so priority order in code IS priority order on screen.
function insertStrip(bar) {
  bar.classList.add('toolbar-strip');
  const strips = document.querySelectorAll('#screen-app .toolbar-strip');
  const anchor = strips.length ? strips[strips.length - 1] : document.querySelector('#screen-app .toolbar');
  anchor.after(bar);
}

// While a legacy crew's server-side migration is pending, picking is gated —
// a persistent banner says so instead of leaving taps mysteriously dead
// (CORE-18). Notes and reading work throughout.
function updateMigrationBanner() {
  const existing = document.getElementById('migration-banner');
  if (!ctx.migrationPending) { if (existing) existing.remove(); return; }
  let bar = existing;
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'migration-banner';
    bar.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-top: 11px; padding: 10px 13px; border: 1px solid rgba(245, 158, 11, .35); border-radius: var(--r-row); background: rgba(245, 158, 11, .08);';
    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.style.cssText = 'flex: 1; color: var(--text-body); font-size: 12px; font-weight: 600; line-height: 1.45;';
    const retry = document.createElement('button');
    retry.className = 'btn-tonal';
    retry.style.cssText = 'font-size: 11.5px; padding: 7px 13px; flex: none;';
    retry.textContent = 'Try now';
    retry.addEventListener('click', async () => {
      retry.disabled = true;
      await sync.requestMigration();
      ctx.migrationPending = model.needsMigration(state.crewDoc);
      retry.disabled = false;
      if (!ctx.migrationPending) repaintWall();
      else updateMigrationBanner();
    });
    bar.append(msg, retry);
    insertStrip(bar);
  }
  bar.querySelector('.msg').textContent = navigator.onLine
    ? 'Updating this crew to the new pick format — picks unlock in a moment.'
    : 'You’re offline — picks unlock after one online update. Notes and reading work now.';
}

// A new build took over this tab while something was in progress (a note
// half-typed, a sheet open, a card grown). index.html's worker glue reloads by
// itself the moment the page is quiet; until then this strip says so, and it
// stays until the reload — a strip, not a toast, because the next toast of any
// kind cleared the shared slot and left the tab on the old build for good.
function showNewBuildStrip() {
  if (document.getElementById('new-build-strip')) return;
  const bar = document.createElement('div');
  bar.id = 'new-build-strip';
  bar.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-top: 11px; padding: 10px 13px; border: 1px solid var(--border-emphasis); border-radius: var(--r-row); background: var(--card);';
  const msg = document.createElement('span');
  msg.style.cssText = 'flex: 1; color: var(--text-body); font-size: 12px; font-weight: 600; line-height: 1.45;';
  msg.textContent = 'Updated behind the scenes — refresh to run the latest.';
  const refresh = document.createElement('button');
  refresh.className = 'btn-tonal';
  refresh.style.cssText = 'font-size: 11.5px; padding: 7px 13px; flex: none;';
  refresh.textContent = 'Refresh';
  refresh.addEventListener('click', () => location.reload());
  bar.append(msg, refresh);
  insertStrip(bar);
}

// ---- screens ----------------------------------------------------------------------
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
function show(screen) {
  $('screen-boot')?.remove(); // the cold-open loader's job ends with the first screen
  for (const id of SCREENS) {
    $(id).style.display = id === screen ? '' : 'none';
  }
}
const anyScreenVisible = () => SCREENS.some((id) => $(id).style.display !== 'none');

// A cold open waits on the network before it knows which screen is right —
// on one bar that is seconds, and every screen starts display:none. The page
// shows the app's loader meanwhile, never black. It arrives after a beat, so a
// quick boot goes straight to its screen without a flash. Built here rather
// than in index.html: a new page over an old worker's cached app.js would
// otherwise carry a loader no show() of that build knows to remove.
function showBootLoader() {
  const screen = document.createElement('div');
  screen.id = 'screen-boot';
  screen.className = 'entry-screen';
  const col = document.createElement('div');
  col.className = 'center-col';
  col.style.alignItems = 'center';
  col.appendChild(eqLoader('Loading your festivals…'));
  screen.appendChild(col);
  document.body.prepend(screen);
  if (canAnimate(screen, ctx)) {
    screen.animate([{ opacity: 0 }, { opacity: 1 }], { duration: CASCADE_MS, delay: 400, easing: EASE_SURFACE, fill: 'backwards' });
  }
}

// ---- create (spec F2, reshaped 2026-07-14): multi-pick fests, name once ------------

// The shared row (tools.js). This used to be a second hand-built copy, and the
// copy is how Settings ended up showing past festivals at full weight while
// this screen muted them.
function festPickRow(f, { muted = false, onPick }) {
  return festRow(f, { muted, onPick });
}

// Multi-pick (fests × circles × you, decision 2): tap toggles a fest into the
// selection, one button creates a board per fest. "Add all the fests I'm
// going to, then quickly add people to them" — the people step is gone from
// here entirely; people questions live on each fest's + Add.
const createSel = new Set();
function renderCreate() {
  show('screen-create');
  createSel.clear();
  $('create-step-1').style.display = 'flex';
  $('create-step-2').style.display = 'none';
  $('create-status').textContent = '';
  const list = $('create-fests');
  list.textContent = '';
  const goBtn = document.createElement('button');
  goBtn.id = 'create-go-multi';
  goBtn.className = 'btn-tonal';
  goBtn.style.cssText = 'font-size: 15px; padding: 13px 24px; width: 100%;';
  const paintGo = () => {
    const n = createSel.size;
    // The server rate-limits crew creation at 10/hour per IP — a batch it
    // cannot finish must not start (Codex reshape gate, P2). 8 leaves
    // headroom for singles in the same hour.
    goBtn.disabled = !n || n > 8;
    goBtn.textContent = !n ? 'Pick your fests'
      : n > 8 ? '8 at a time is the max'
        : `ADD ${n} FESTIVAL${n === 1 ? '' : 'S'} →`;
  };
  const pick = (f, rowEl) => {
    if (createSel.has(f.id)) createSel.delete(f.id);
    else createSel.add(f.id);
    rowEl.classList.toggle('sel-fest', createSel.has(f.id));
    paintGo();
  };
  for (const f of FESTIVAL_INDEX.filter((x) => x.status !== 'archived')) {
    const rowEl = festPickRow(f, { onPick: () => pick(f, rowEl) });
    list.appendChild(rowEl);
  }
  // Past festivals stay reachable (spec F2/F12) but folded: full-size rows
  // gave history the same weight as the fests you'd actually plan — the
  // wrong emphasis on the doorway screen (Kevin note 8).
  const past = FESTIVAL_INDEX.filter((x) => x.status === 'archived');
  if (past.length) {
    list.appendChild(disclosureFold(`Past festivals · ${past.length}`, (rows) => {
      for (const f of past) {
        const rowEl = festPickRow(f, { muted: true, onPick: () => pick(f, rowEl) });
        rows.appendChild(rowEl);
      }
    }));
  }
  list.appendChild(goBtn);
  paintGo();
  goBtn.addEventListener('click', () => {
    if (!createSel.size || createInFlight) return;
    // A device that already knows who it is skips the name step forever.
    const p = crew.myPerson();
    if (p && p.name) { batchCreateFlow(p.name); return; }
    createStepName();
  });
}

function chosenFestChip(f) {
  const chip = document.createElement('span');
  chip.style.cssText = `display: inline-flex; align-items: baseline; gap: 6px; border: 1.5px solid rgba(${f.accent || '192, 132, 252'}, .55); border-radius: var(--r-pill); padding: 8px 16px; font-family: var(--font-display); letter-spacing: .04em; font-size: 15px; color: rgb(${f.accent || '237, 234, 244'});`;
  chip.textContent = `${f.name.toUpperCase()} ${f.year || ''}`.trim();
  return chip;
}

// Name step — only ever seen ONCE per device (no person record yet). After
// that, the me link knows who you are and multi-pick goes straight to boards.
function createStepName() {
  $('create-step-1').style.display = 'none';
  $('create-step-2').style.display = 'flex';
  $('create-status').textContent = '';
  const chosen = $('create-chosen');
  chosen.textContent = '';
  for (const fid of createSel) {
    const meta = FESTIVAL_INDEX.find((f) => f.id === fid);
    if (meta) chosen.appendChild(chosenFestChip(meta));
  }
  $('create-name-input').focus();
}

// One board per picked fest, each its own circle of one (decision 2 — a fest
// never lands in an existing circle from here; deliberate multi-fest circles
// use Settings → Your festivals → + Add a festival). Sequential creates so
// a mid-batch failure reports exactly what made it and what didn't.
// Re-entrancy: guarded module-wide — a double-tap must never mint duplicate
// circles (Codex reshape gate, P1). Cross-tab double-creates remain possible
// (no server idempotency key yet) — accepted at this app's scale, the rate
// limiter caps the damage.
let createInFlight = false;
async function batchCreateFlow(myName) {
  if (createInFlight) return;
  const status = $('create-status');
  const problem = nameProblem(myName);
  if (problem) { createStepName(); status.textContent = problem; return; }
  createInFlight = true;
  // Busy (index.html's quiet()): a new build's reload waits for the batch —
  // a reload mid-loop strands boards that exist but never reached this device.
  document.body.dataset.busy = 'create';
  const goBtns = ['create-go-multi', 'create-go-btn'].map((id) => $(id)).filter(Boolean);
  goBtns.forEach((b) => { b.disabled = true; });
  try {
    const fids = [...createSel];
    const made = [];
    let failed = null;
    status.textContent = '';
    status.appendChild(eqLoader('Setting the stage…'));
    // AWAITED, not fire-and-forget: every board must land on the person
    // record before we leave this screen, or a My-link restore can't recover
    // unopened boards (Codex reshape gate, P1). Born linked when possible —
    // the create body carries the pid.
    const person = await crew.ensurePerson(myName);
    for (const fid of fids) {
      const meta = FESTIVAL_INDEX.find((f) => f.id === fid);
      if (!meta) continue;
      try {
        // SAFE_NAME_RE bans apostrophes — "'26" becomes "26" in the crew name.
        const crewName = `${meta.name} ${(meta.year || '').replace(/'/g, '')}`.trim().slice(0, 40);
        const { token, doc } = await crew.createCrew(crewName, myName,
          { colorIndex: 0, ...(person ? { pid: person.id } : {}) }, fid);
        crew.setMe(token, myName);
        crew.rememberCrew(token, crewName);
        saveLS(state.LS.fest(token), fid);
        // Cache the doc so the landing can render this fest's row immediately
        // (the fest-first landing reads cached docs for its pairs).
        saveLS(state.LS.doc(token), JSON.stringify(doc));
        // The stamp returns false on failure rather than throwing — check it,
        // retry once, and never report a board as recovery-linked when it
        // isn't (Codex verify round, high). An unstamped board still lives on
        // this device; the enterApp backfill stamps it on first open — the
        // only true loss window is device-wipe-before-open, and the toast
        // below says so instead of pretending.
        let stamped = false;
        if (person) {
          stamped = await crew.stampPersonCrew(token, myName, crewName)
            || await crew.stampPersonCrew(token, myName, crewName);
        }
        made.push({ token, doc, fid, name: meta.name, stamped });
      } catch (e) {
        failed = { name: meta.name, err: String(e.message || e) };
        break; // stop the batch — the same failure would repeat (rate limit, offline)
      }
    }
    if (!made.length) {
      const raw = failed ? failed.err : 'Nothing was created.';
      status.textContent = /fetch|network|load/i.test(raw) && !/crew|name|festival/i.test(raw)
        ? 'Couldn’t reach the crew service — check your connection and try again.'
        : raw;
      return;
    }
    if (made.length === 1 && !failed) {
      // Single fest keeps today's arc: straight onto the board, share moment
      // up. The board EXISTS by now — an activation failure (fest asset
      // uncached + offline) must not strand the create screen inviting a
      // duplicate retry (Codex reshape gate, P2): fall back to the landing,
      // where the new row already is.
      const { token, doc, fid } = made[0];
      try {
        await enterApp(token, doc, undefined, undefined, { holdOffer: true });
        state.recordInviteFest(fid); // invites resolve on fresh devices (FLOW-1)
        sync.scheduleSync();
        openShareMoment();
        router.push('sheet:share');
        maybeWelcome(); // waits for the share moment to close — one thing at a time
        maybeOfferBringPicks(); // and this waits for the welcome, when there is one
      } catch {
        history.replaceState(null, '', '/');
        renderLanding();
        showToast($('toast-root'), 'Board created — it couldn’t open just now, but it’s on your list.', 6000);
      }
      return;
    }
    // Several boards born: land on the festival list where they all are —
    // "add all the fests I'm going to, then quickly add people to them."
    history.replaceState(null, '', '/');
    renderLanding();
    const unstamped = made.filter((m) => !m.stamped).length;
    let note = failed
      ? `${made.length} ready — ${failed.name} didn’t make it (${failed.err}). It’s still in the picker.`
      : `${made.length} festivals ready — tap one and add your people.`;
    if (unstamped) note += ` (${unstamped} not on your My link yet — opening each fixes that.)`;
    showToast($('toast-root'), note, 8000);
  } finally {
    createInFlight = false;
    delete document.body.dataset.busy;
    goBtns.forEach((b) => { b.disabled = false; });
  }
}


// ---- what a link sent from here opens on (v92, SD1) ---------------------------------
// A share link carries the sharer's current view: the rooms this phone is
// showing, as `&show=` beside `g=` (filters.js showOf, crew.js crewLink).
// Everything showing sends no view at all. Whoever receives it gets it once,
// on a phone that has never shown this festival (seedShowOnce) — and every
// place that hands out a link says so in one line, because someone who hid
// Folsom for themselves would otherwise send it hidden without knowing.
function shareView() {
  const rooms = roomsOnWall();
  const folded = ctx.folded || [];
  const show = showOf(rooms, folded);
  return show ? { show, label: showLabel(rooms, folded) } : null;
}
function inviteLink(meName = null) {
  const view = shareView();
  return crew.crewLink(state.getCrewToken(), state.activeFestivalId, meName, view ? view.show : null);
}
function inviteViewLine() {
  const view = shareView();
  return view ? `Opens on ${view.label} — what you’re showing now.` : '';
}

// The other end of a link's view: has this phone shown this festival before —
// any crew it knew, pointed at it? Then its own view of the festival is its
// choice (even "everything", which stores nothing), and a link never moves it.
function festShownBefore(fid) {
  return crew.knownCrews().some((c) => c && c.token && getLS(state.LS.fest(c.token)) === fid);
}

// Seed THIS phone's fold from a link's view, once per festival: viewer-side
// by law (filters.js — never the crew doc), never over a fold of its own,
// never a view that would hide every room, and only rooms this festival file
// knows. Returns the words for what it opened on, or null when it did nothing.
function seedShowOnce(fid, slugs) {
  if (foldIsSet(fid) || showSeeded(fid)) return null;
  const rooms = roomsOf(state.fest(), ctx);
  const folded = foldFromShow(rooms, slugs);
  if (!folded) return null;
  saveFolded(fid, folded);
  rememberShowSeeded(fid);
  return showLabel(rooms, folded);
}

// ---- the share moment (FLOW-7/FLOW-12) ----------------------------------------------
// One centered dialog right after create (and re-openable from Settings):
// the link is VISIBLE — share sheets fail silently, a printed URL never does.
function openShareMoment() {
  rememberOpener();
  closeSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.id = 'sheet-backdrop';
  backdrop.addEventListener('click', () => { if (!router.requestClose()) closeSheet(); });
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'artist-sheet'; // closeSheet + the router's sheet kind own this id
  // The shared chrome from notes.js — grabber that really swipes, title, and a
  // real ✕. This sheet used to hand-copy the markup, which is exactly how it
  // drifted into having no close button and no dialog semantics while looking
  // pixel-identical to the ones that do.
  sheetChrome(sheet, 'ONE LINK MAKES IT A CREW');
  const sub = document.createElement('div');
  sub.style.cssText = 'color: var(--text-secondary); font-size: 12.5px; line-height: 1.55;';
  sub.textContent = `Opens straight into ${state.crewName()}. No accounts needed.`;
  const viewLine = inviteViewLine();
  if (viewLine) sub.append(document.createElement('br'), viewLine);
  const link = inviteLink();
  // Only a member stamps the crew's invite festival: a guest writes nothing
  // into the crew until they join (v92).
  if (ctx.meName && (state.crewDoc.meta || {}).inviteFestId !== state.activeFestivalId) {
    state.recordInviteFest(state.activeFestivalId);
    sync.scheduleSync();
  }
  const linkRowEl = document.createElement('div');
  linkRowEl.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  const linkBox = document.createElement('input');
  linkBox.readOnly = true;
  linkBox.value = link;
  linkBox.setAttribute('aria-label', 'Crew invite link');
  linkBox.style.cssText = 'flex: 1; min-width: 0; background: var(--card); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 10px 12px; color: var(--text-body); font-size: 12px; font-family: var(--font-ui);';
  linkBox.addEventListener('focus', () => linkBox.select());
  const copy = document.createElement('button');
  copy.className = 'btn-tonal';
  copy.style.cssText = 'font-size: 12px; padding: 9px 15px; flex: none;';
  copy.textContent = 'Copy';
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); copy.textContent = 'Copied ✓'; setTimeout(() => { copy.textContent = 'Copy'; }, 1800); }
    catch { linkBox.select(); }
  });
  linkRowEl.append(linkBox, copy);
  const actionsRow = document.createElement('div');
  actionsRow.style.cssText = 'display: flex; gap: 8px;';
  if (navigator.share) {
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn-tonal';
    shareBtn.style.cssText = 'flex: 1; font-size: 13px; padding: 11px;';
    shareBtn.textContent = 'Share the link';
    shareBtn.addEventListener('click', async () => {
      try { await navigator.share({ title: 'Festival Navigator', text: crew.inviteText((state.fest() || {}).name), url: link }); }
      catch { /* dismissed — the visible link is the fallback */ }
    });
    actionsRow.appendChild(shareBtn);
  }
  const later = document.createElement('button');
  later.className = 'btn-ghost';
  later.style.cssText = 'font-size: 12px; padding: 11px 16px;' + (navigator.share ? '' : ' flex: 1;');
  later.textContent = 'Later';
  later.addEventListener('click', () => { if (!router.requestClose()) closeSheet(); });
  actionsRow.appendChild(later);
  sheet.append(sub, linkRowEl, actionsRow); // chrome (grabber + title + ✕) is already on
  dialogize(sheet, 'Share your crew link');
  document.body.append(backdrop, sheet);
}

// ---- add a member on their behalf (Kevin note 5, 2026-07-12) -----------------------
// Shared-phone crews: one person tracks for everyone; not everyone joins via
// a link. Server-first like the join screen (FLOW-5) so the people-cap
// answers here; offline falls back to the local doc + sync. Success mints the
// per-person claim link (&me=) — opening it lands them on THEIR circle with
// every pick already theirs.
function openAddMember() {
  rememberOpener();
  closeSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.id = 'sheet-backdrop';
  backdrop.addEventListener('click', () => { if (!router.requestClose()) closeSheet(); });
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'artist-sheet'; // closeSheet + the router's sheet kind own this id
  sheetChrome(sheet, 'ADD SOMEONE'); // one sheet anatomy, everywhere (see openShareMoment)
  const sub = document.createElement('div');
  sub.style.cssText = 'color: var(--text-secondary); font-size: 12.5px; line-height: 1.55;';
  sub.textContent = 'Pick for them until they open their link.';
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  const input = document.createElement('input');
  input.maxLength = 24;
  input.placeholder = 'Their name';
  input.setAttribute('aria-label', 'Their name');
  input.style.cssText = 'flex: 1; min-width: 0; background: var(--page); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 11px 12px; color: #fff; font-size: 14px; font-family: var(--font-ui);';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-tonal';
  addBtn.style.cssText = 'font-size: 13px; padding: 11px 20px; flex: none;';
  addBtn.textContent = 'Add';
  row.append(input, addBtn);
  const status = document.createElement('div');
  status.style.cssText = 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600;';
  sheet.append(sub, row, status); // chrome (grabber + title + ✕) is already on
  // Recurring humans, one tap (fests × circles × you, decision 4): the people
  // from your OTHER fests — Drew doesn't get retyped a third time.
  const others = model.otherFestPeople(
    state.getCrewToken(), crew.knownCrews(), state.cachedDoc, state.people(), ctx.meName,
  );
  if (others.length) {
    const pickWrap = document.createElement('div');
    const pickLabel = document.createElement('div');
    pickLabel.className = 'micro-label';
    pickLabel.style.cssText = 'margin-bottom: 7px;';
    pickLabel.textContent = 'From your other fests';
    const chips = document.createElement('div');
    chips.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;';
    for (const { name } of others.slice(0, 12)) {
      const chip = document.createElement('button');
      chip.className = 'btn-tonal';
      chip.style.cssText = 'font-size: 12.5px; padding: 7px 13px;';
      chip.textContent = `+ ${name}`;
      chip.addEventListener('click', () => { input.value = name; doAdd(); });
      chips.appendChild(chip);
    }
    pickWrap.append(pickLabel, chips);
    sheet.appendChild(pickWrap);
  }
  dialogize(sheet, 'Add someone to the crew');
  document.body.append(backdrop, sheet);
  input.focus();

  const succeed = (canonical) => {
    refreshCtx();
    renderPersonChips();
    repaintWall();
    sheet.textContent = '';
    // Re-chrome the success state too, or it loses the ✕ and the swipe-to-close
    // the moment it becomes the thing you are actually looking at.
    sheetChrome(sheet, `${canonical.toUpperCase()} IS IN`);
    const explain = document.createElement('div');
    explain.style.cssText = 'color: var(--text-secondary); font-size: 12.5px; line-height: 1.55;';
    explain.textContent = `Send ${canonical} this link. Opening it makes the picks theirs.`;
    const link = inviteLink(canonical); // a personal link carries the sharer's view too (v92)
    const linkRowEl = document.createElement('div');
    linkRowEl.style.cssText = 'display: flex; gap: 8px; align-items: center;';
    const linkBox = document.createElement('input');
    linkBox.readOnly = true;
    linkBox.value = link;
    linkBox.setAttribute('aria-label', `${canonical}'s personal invite link`);
    linkBox.style.cssText = 'flex: 1; min-width: 0; background: var(--card); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 10px 12px; color: var(--text-body); font-size: 12px; font-family: var(--font-ui);';
    linkBox.addEventListener('focus', () => linkBox.select());
    const copy = document.createElement('button');
    copy.className = 'btn-tonal';
    copy.style.cssText = 'font-size: 12px; padding: 9px 15px; flex: none;';
    copy.textContent = 'Copy';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); copy.textContent = 'Copied ✓'; setTimeout(() => { copy.textContent = 'Copy'; }, 1800); }
      catch { linkBox.select(); }
    });
    linkRowEl.append(linkBox, copy);
    const actionsRow = document.createElement('div');
    actionsRow.style.cssText = 'display: flex; gap: 8px;';
    if (navigator.share) {
      const shareBtn = document.createElement('button');
      shareBtn.className = 'btn-tonal';
      shareBtn.style.cssText = 'flex: 1; font-size: 13px; padding: 11px;';
      shareBtn.textContent = `Share ${canonical}’s link`;
      shareBtn.addEventListener('click', async () => {
        try { await navigator.share({ title: 'Festival Navigator', url: link }); }
        catch { /* dismissed — the visible link is the fallback */ }
      });
      actionsRow.appendChild(shareBtn);
    }
    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn-ghost';
    doneBtn.style.cssText = 'font-size: 12px; padding: 11px 16px;' + (navigator.share ? '' : ' flex: 1;');
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => { if (!router.requestClose()) closeSheet(); });
    actionsRow.appendChild(doneBtn);
    sheet.append(explain, linkRowEl, actionsRow);
  };

  const doAdd = async () => {
    const name = input.value.trim();
    const problem = nameProblem(name);
    if (problem) { status.textContent = problem; return; }
    // Never apply one crew's add to another crew's state (sync.js's own
    // convention): switching crews while the request is in flight must
    // abandon the result, or the person lands in the WRONG crew — and the
    // offline branch would even persist + push it there (Codex arc gate P1).
    const tokenAtStart = state.getCrewToken();
    const people = state.people();
    const activeMatch = Object.entries(people)
      .find(([n, p]) => n.toLowerCase() === name.toLowerCase() && state.isActivePerson(p));
    if (activeMatch) { status.textContent = `${activeMatch[0]} is already in this crew.`; return; }
    // A removed member returning keeps their old key — resurrecting brings
    // their history back, same as the join screen's reclaim path.
    const removedMatch = Object.entries(people)
      .find(([n]) => n.toLowerCase() === name.toLowerCase());
    const canonical = removedMatch ? removedMatch[0] : name;
    const taken = Object.values(people).map((p) => p.colorIndex).filter(Number.isInteger);
    const person = { colorIndex: nextColorIndex(taken), removed: false };
    addBtn.disabled = true;
    status.textContent = '';
    status.appendChild(eqLoader(`Adding ${canonical}…`));
    try {
      const res = await fetch(`/api/crew?t=${encodeURIComponent(tokenAtStart)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { people: { [canonical]: person } }, sv: 4 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (state.getCrewToken() !== tokenAtStart) return; // crew switched mid-flight
        status.textContent = errorText(body, 'The crew service hiccuped — give it a second and try again.');
        return;
      }
      const merged = await res.json();
      // The switch check comes AFTER the last await, or a crew change during
      // the json() parse still slips the old crew's doc into the new crew's
      // state (TOCTOU — commit security review, 2026-07-12).
      if (state.getCrewToken() !== tokenAtStart) return;
      state.applyRemoteDoc(merged);
      succeed(canonical);
    } catch {
      if (state.getCrewToken() !== tokenAtStart) return; // crew switched mid-flight
      // Offline: local-first add, sync catches up — same as every pick.
      state.recordPerson(canonical, person);
      state.crewDoc.people[canonical] = person;
      state.persist();
      sync.scheduleSync();
      succeed(canonical);
    } finally {
      addBtn.disabled = false;
    }
  };
  addBtn.addEventListener('click', doAdd);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
}

// The heading's ‹ returns to the fest list (Kevin note 5, "like we had
// before") as a REAL history entry — browser back from the landing returns
// to the wall you left.
function goToFestList() {
  closeSheet();
  router.reset();
  history.pushState(null, '', '/');
  renderLanding();
}

// ---- settings (one page, two doors) -----------------------------------------------
function applyLowPower(on) {
  ctx.lowPower = !!on;
  document.body.classList.toggle('low-power', ctx.lowPower);
  if (ctx.lowPower) stopFavicon();
  else if (state.getCrewToken()) startFavicon(state.fest()?.accent, { lowPower: false });
}

// The most recent settings actions object — the router's forward re-open of
// a settings drill needs it (openSettings rebuilds it on every render).
let settingsActions = null;
// Coming back from Settings may mean a festival switch — land on the new
// fest's own day (its now line if it is on today), once per fest-day, like a
// fresh open.
function closeSettings() { show('screen-app'); repaintWall(); maybeOpenOnDay(); }

function openSettings() {
  closeSheet();
  refreshCtx();
  show('screen-settings');
  settingsActions = {
    close: () => { if (!router.requestClose()) closeSettings(); },
    rerender: openSettings,
    switchFestival: async (fid) => {
      // Load BEFORE persisting the switch: an offline device must never be
      // left pointing at a festival it cannot render (CORE-12).
      try { await loadFestival(fid); }
      catch {
        showToast($('toast-root'), 'Can’t open that festival offline yet — it loads once you’re back online.');
        return;
      }
      state.setActiveFestivalId(fid);
      state.ensureFestivalState(fid);
      state.setCurrentDay(null);
      // Drop the search query with the festival it belonged to. It used to
      // survive the switch, so arriving at a festival you had never searched
      // showed you "No artists match" over a full lineup — the app reporting an
      // empty festival because of something you typed on a different one.
      ctx.query = '';
      const searchBox = $('search-input');
      if (searchBox) searchBox.value = '';
      // The scanned library is a device asset — switching fests badges the
      // new lineup from the cache, no rescan (SPOT-5).
      // A festival you just added (or switched to) badges itself from the
      // library already on this device — no reconnect, no rescan, no trip to
      // Settings. "If I add fests later Spotify should just pull" (Kevin,
      // 2026-07-12); this is the "just pull".
      if (ctx.meName && spotify.isConnected() && spotify.libraryMap()) {
        try {
          const names = spotify.artistNamesOf(state.fest());
          if (spotify.applyAffinityToCrew(ctx.meName, [...names]) > 0) sync.scheduleSync();
        } catch { /* stale map — "Read it again" in the drill is the recovery */ }
      }
      applyFestTheme();
      if (!router.requestClose()) closeSettings();
      sync.pollSync();
      maybeOfferBringPicks(); // a festival switch is entering that festival here
    },
    onLowPower: (on) => { applyLowPower(on); },
    onStayOffline: (on) => {
      sync.setStayOffline(on);
      if (on) return;
      sync.pushSync();
      // Back online by choice: the refresh an offline open skipped runs now —
      // the live catalog, the crew's own festivals, the festival file on
      // screen (Codex review, 2026-09-23).
      const token = state.getCrewToken();
      const gen = bootGeneration;
      if (token) freshenFromNetwork(token, () => loadFestivalIndex().catch(() => { /* the cached list stays */ }), () => gen === bootGeneration);
    },
    recordPick: (artist, person, level) => {
      if (ctx.migrationPending) return false; // same gate as handleTap (bulk paste path)
      state.recordSelection(artist, person, level);
      applyLocalPick(artist, person, level);
      return true;
    },
    afterBulk: () => { sync.scheduleSync(); refreshCtx(); },
    // Every link Settings hands out carries this phone's view (v92, SD1), and
    // says so in one line.
    inviteLink: (meName = null) => inviteLink(meName),
    inviteViewLine: () => inviteViewLine(),
    // A guest's "Add yourself" (v92): the join screen, from Settings. The
    // settings layer is dropped from the model first — "Just looking" comes
    // back to the wall, never to a Settings the history no longer holds.
    join: () => {
      router.reset();
      history.replaceState(null, '', `/#g=${state.getCrewToken()}`);
      show('screen-app');
      askToJoin(null);
    },
    // FLOW-8: identity change is an explicit, named action — never a chip tap.
    switchIdentity: (name) => switchIdentity(name),
    // Add-on-their-behalf (note 5): the sheet opens OVER settings.
    addMember: () => { openAddMember(); router.push('sheet:add-member'); },
    // FLOW-6: the landing is the crew switcher; the current crew stays remembered.
    switchCrew: () => {
      router.reset();
      history.replaceState(null, '', '/');
      renderLanding();
    },
    // Fest-first: settings lists YOUR boards; adding goes to the shared
    // multi-pick page, and a board in another circle opens like a landing row.
    addFestival: () => {
      router.reset();
      location.hash = '#new';
      boot();
    },
    openBoard: (token, fid) => {
      saveLS(state.LS.fest(token), fid);
      let stored = null;
      try { stored = localStorage.getItem(state.LS.fest(token)); } catch { /* read denied */ }
      if (stored !== fid) {
        showToast($('toast-root'), 'This device’s storage is blocked — couldn’t point the board at that festival.', 6000);
        return;
      }
      router.reset();
      location.hash = `#g=${token}`;
      boot();
    },
    leaveCrew: () => {
      const t = state.getCrewToken();
      crew.forgetCrew(t);
      router.reset();
      history.replaceState(null, '', '/');
      renderLanding();
      showToast($('toast-root'), 'Crew forgotten on this device — the invite link gets you back in.', 6000);
    },
    // Self-rename (FLOW-11): a person IS their key in the doc, so renaming is
    // new person + tombstone old + picks (and Spotify badges) migrated through
    // the normal additive merge. Old notes keep the old byline — honest history.
    renameSelf: (newName) => {
      const old = ctx.meName;
      const person = state.people()[old];
      state.recordPerson(newName, { colorIndex: colorIndexOf(old, person) });
      // recordPerson writes pending only — mirror into the local doc so the
      // rename is visible before the sync round-trip (recorder convention).
      state.crewDoc.people[newName] = { colorIndex: colorIndexOf(old, person) };
      for (const [fid, entry] of Object.entries(state.crewDoc.festivals || {})) {
        for (const [artist, byPerson] of Object.entries(entry.selections || {})) {
          const level = model.readLevel(state.crewDoc, byPerson[old]);
          if (level > 0) {
            state.recordSelectionFor(fid, artist, newName, level);
            // Tombstone the OLD name's pick too (level 0) — "your picks move
            // with you" means MOVE: without this, Export Likes ghosts the old
            // name forever and a reused name would double-render picks
            // (Codex ship gate, P2).
            state.recordSelectionFor(fid, artist, old, 0);
            state.ensureFestivalState(fid);
            const sels = state.crewDoc.festivals[fid].selections;
            (sels[artist] = sels[artist] || {})[newName] = level;
            sels[artist][old] = 0;
          }
        }
      }
      const aff = state.affinityFor(old);
      if (aff) state.recordAffinity(newName, aff);
      state.recordPerson(old, { removed: true });
      if (state.crewDoc.people[old]) state.crewDoc.people[old].removed = true;
      state.persist();
      crew.setMe(state.getCrewToken(), newName);
      withdrawBringOffer(); // it was made for the old name
      sync.scheduleSync();
      refreshCtx();
      renderPersonChips();
      renderYou();
      stampIdentity(state.getCrewToken(), () => true, { renameFrom: old }); // the record follows a self-rename
      showToast($('toast-root'), `You’re ${newName} now — picks came with you.`);
    },
    changeColor: (idx) => {
      // Spread the queued entry: recordPerson REPLACES pending.people[name],
      // and a color change must not eat a not-yet-pushed pid stamp (or vice
      // versa — stampIdentity spreads for the same reason).
      const queuedColor = (state.pendingChanges.people || {})[ctx.meName] || {};
      state.recordPerson(ctx.meName, { ...queuedColor, colorIndex: idx });
      const mine = state.people()[ctx.meName];
      if (mine) mine.colorIndex = idx; // local doc mirror for instant render
      state.persist();
      sync.scheduleSync();
      refreshCtx();
      renderPersonChips();
      renderYou();
    },
  };
  renderSettings($('settings-root'), ctx, settingsActions);
}

// Union a fetched person doc into this device: remember every crew, claim
// unclaimed names, store the person. Never removes anything. Shared by the
// me-link restore (renders landing after) and the canonical-host hop absorb
// (falls through into the crew flow instead).
function absorbPersonDoc(token, fetched, { replaceIdentity = true } = {}) {
  const doc = fetched.doc || {};
  if (replaceIdentity || !crew.myPerson()) {
    crew.setMyPerson({ token, id: fetched.id, name: doc.name || '', crews: doc.crews || {} });
  }
  for (const [ct, entry] of Object.entries(doc.crews || {})) {
    const known = crew.knownCrews().find((c) => c.token === ct);
    crew.rememberCrew(ct, (entry && entry.crewName) || (known && known.name) || '');
    if (entry && entry.name && !crew.me(ct)) crew.setMe(ct, entry.name);
  }
  return Object.keys(doc.crews || {}).length;
}

// Opening a me link on any device: pull the person record, register every
// crew it lists (union — never removes anything this device already knows),
// claim the names, land on the landing with the lot. boot() strips the hash
// before calling this — the master key never survives past the first frame.
// `current` is boot's generation guard: a stale restore racing a newer boot
// must not write a word (the sync.js tokenAtStart convention).
async function restoreFromMeLink(token, current = () => true) {
  let fetched = null, failed = false;
  // Busy: the link is already out of the address bar, so a new build's
  // reload mid-fetch would lose it with nothing on screen to say so.
  document.body.dataset.busy = 'me-link';
  try { fetched = await crew.fetchPerson(token); } catch { failed = true; } finally { delete document.body.dataset.busy; }
  if (!current()) return;
  if (!fetched) {
    renderLanding();
    showToast($('toast-root'), failed
      ? 'Couldn’t reach the server — open your link again once you’re online.'
      : 'That link doesn’t work anymore.', 6000);
    return;
  }
  const total = absorbPersonDoc(token, fetched);
  const doc = fetched.doc || {};
  renderLanding();
  showToast($('toast-root'), total
    ? `Welcome back${doc.name ? ', ' + doc.name : ''} — ${total} crew${total === 1 ? '' : 's'} on this device now.`
    : 'Link saved — crews you join will follow you from here.', 6000);
}

function renderLanding() {
  show('screen-landing');
  document.title = 'Festival Navigator';

  // YOU card (21a + me link): who this device is, and the one link that
  // rebuilds everything on a new one. Only renders once a person exists —
  // a fresh visitor sees the pitch, not plumbing.
  const youBox = $('landing-you');
  youBox.textContent = '';
  const person = crew.myPerson();
  if (person) {
    const card = document.createElement('div');
    card.className = 'landing-you-card';
    const av = document.createElement('span');
    av.className = 'avatar lg';
    av.style.background = 'rgba(192, 132, 252, .28)';
    av.style.border = '1px solid rgba(192, 132, 252, .6)';
    av.textContent = (person.name || 'Y').charAt(0).toUpperCase();
    const mid = document.createElement('div');
    mid.style.cssText = 'flex: 1; min-width: 0;';
    const nm = document.createElement('div');
    nm.style.cssText = 'color: #fff; font-weight: 700; font-size: 14px;';
    nm.textContent = person.name || 'You';
    const hint = document.createElement('div');
    hint.className = 'mini-copy';
    // The me link is a master key: the warning stays, in fewer words.
    hint.textContent = 'Open this on a new phone to get everything back. Keep it to yourself — it makes whoever opens it you.';
    mid.append(nm, hint);
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-tonal';
    copyBtn.style.cssText = 'font-size: 12px; padding: 9px 14px; flex: none;';
    copyBtn.textContent = 'My link';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(crew.meLink());
        copyBtn.textContent = 'Copied ✓';
      } catch {
        copyBtn.textContent = crew.meLink() ? 'See below' : 'No link yet';
        if (crew.meLink()) hint.textContent = crew.meLink();
      }
      setTimeout(() => { copyBtn.textContent = 'My link'; }, 1800);
    });
    card.append(av, mid, copyBtn);
    youBox.appendChild(card);
  }

  // FESTIVAL rows, not crew rows (fests × circles × you, 2026-07-14): every
  // (crew, fest) pair is one row in festival-index order — tapping Seismic
  // opens Seismic, whatever circle it lives in. Two circles at one fest =
  // two rows, told apart by their people (unfused until the merged-board arc).
  const list = $('landing-fests');
  list.textContent = '';
  const crews = crew.knownCrews();
  for (const pair of model.landingPairs(crews, state.cachedDoc, FESTIVAL_INDEX)) {
    const row = document.createElement('button');
    row.className = 'fest-row';
    row.style.width = '100%';
    if (pair.past) row.style.opacity = '.55'; // past fests stay, quietly (Kevin, 2026-07-14)
    const left = document.createElement('div');
    left.style.cssText = 'flex: 1; min-width: 0; text-align: left;';
    const nm = document.createElement('span');
    nm.className = 'fest-name';
    const label = pair.fid ? model.festLabelFor(pair.fid, FESTIVAL_INDEX) : null;
    const festColor = label && label.accent ? `rgb(${label.accent})` : 'var(--text-header)';
    nm.style.cssText = `font-family: var(--font-display); letter-spacing: .04em; font-size: var(--fs-day); color: ${festColor};`;
    if (label) {
      nm.textContent = label.name;
      if (label.year) {
        const yr = document.createElement('span');
        yr.className = 'yr';
        yr.textContent = ` ${label.year}`;
        nm.appendChild(yr);
      }
    } else {
      nm.textContent = pair.crewName || 'Your crew';
    }
    left.appendChild(nm);
    const sub = document.createElement('div');
    sub.className = 'fest-dates';
    const names = pair.people.map((x) => x.name);
    sub.textContent = pair.fid
      ? (names.length > 1
        ? names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '')
        : 'just you — add your people inside')
      : 'tap to open';
    left.appendChild(sub);
    const cluster = document.createElement('span');
    cluster.className = 'avatar-cluster';
    for (const { name, p } of pair.people.slice(0, 5)) {
      const a = document.createElement('span');
      a.className = 'avatar';
      const ci = colorIndexOf(name, p);
      a.style.background = hslOf(ci, 0.5);
      a.style.border = '1px solid ' + strokeOf(ci, false);
      a.textContent = name.charAt(0).toUpperCase();
      cluster.appendChild(a);
    }
    if (pair.people.length > 5) {
      const more = document.createElement('span');
      more.className = 'avatar';
      more.style.background = 'rgba(255,255,255,.08)';
      more.textContent = `+${pair.people.length - 5}`;
      cluster.appendChild(more);
    }
    const chev = document.createElement('span');
    chev.className = 'chev';
    chev.textContent = '›';
    row.append(left, cluster, chev);
    row.addEventListener('click', () => {
      // Land on THIS fest, not the crew's last-open one — the row's whole
      // promise is "tap Seismic, get Seismic" (Kevin, 2026-07-14). The write
      // is VERIFIED before navigating: with storage full/blocked, booting
      // anyway would open whatever fest the crew last had — the row lying.
      // Stop and say so instead (Codex reshape gate, P2).
      if (pair.fid) {
        saveLS(state.LS.fest(pair.token), pair.fid);
        // The read-back is guarded too: storage-denied browsers throw on
        // READS as well as writes, and an uncaught throw here would kill
        // every row (Codex verify round). Write-fail, read-fail, and
        // mismatch all take the same honest exit.
        let stored = null;
        try { stored = localStorage.getItem(state.LS.fest(pair.token)); } catch { /* read denied */ }
        if (stored !== pair.fid) {
          showToast($('toast-root'), 'This device’s storage is blocked — couldn’t point the board at that festival.', 6000);
          return;
        }
      }
      location.hash = `#g=${pair.token}`;
      boot();
    });
    list.appendChild(row);
  }
  $('landing-empty').style.display = crews.length ? 'none' : '';
}

// Recognize you (2026-09-23). A crew link this device had no claim in used to
// ask "who are you?" even when the crew doc already carried this device's
// person id — someone who forgot the crew here, or joined on another phone
// holding the same me link, re-introducing themselves to their own crew. An
// unambiguous match (crew.recognizedMember) now walks straight in. A personal
// link naming someone ELSE (&me=Drew, opened on Kevin's phone) is its own
// answer to the question, so that one still asks.
function recognizeOnOpen(token, doc) {
  const known = crew.recognizedMember(crew.myPerson(), token, doc);
  if (!known) return null;
  if (pendingMeHint && pendingMeHint.toLowerCase() !== known.toLowerCase()) return null;
  return known;
}

// Nothing needs doing after a recognized entry, so the acknowledgement is a
// toast (it may fade) — carrying the one door a borrowed phone needs for as
// long as it shows.
function welcomeRecognized(token, name) {
  showActionToast($('toast-root'), `Welcome back, ${name}.`, 'Not me', () => notMe(token), 6000);
}

// "Not me": forget the claim on this device and ask, exactly as the join
// screen always has. The crew stays remembered; nothing in the shared doc
// changes (the recognition only ever READ the pid).
function notMe(token) {
  if (state.getCrewToken() !== token) return; // the toast outlived its crew
  crew.clearMe(token);
  withdrawBringOffer();
  refreshCtx();
  renderPersonChips();
  renderYou();
  renderJoin(token, state.crewDoc);
}

// Bring your picks (2026-09-23). Entering a crew at a festival where this
// device knows ANOTHER crew holding your picks offers — once per crew ×
// festival — to bring them over. The rules live in crew-entry.js; this is
// the glue: the plan reads only this device's cache, and the write is the
// ordinary pick path, so sync and the merge see nothing but taps.
function bringContext() {
  return {
    token: state.getCrewToken(), fid: state.activeFestivalId, doc: state.crewDoc,
    meName: ctx.meName, person: crew.myPerson(), crews: crew.knownCrews(),
    docFor: state.cachedDoc, meFor: crew.me,
  };
}

// The offer on screen, and the plan it was made from: the tap is held to the
// crew, festival, names and picks the card was showing (crew-entry.js
// bringFromSource) — never re-planned into a different crew.
let standingOffer = null; // { key, plan }
const offerKey = () => `${state.getCrewToken()}|${state.activeFestivalId}|${ctx.meName || ''}`;

function maybeOfferBringPicks() {
  const token = state.getCrewToken();
  const fid = state.activeFestivalId;
  const key = offerKey();
  const standing = bringOfferCard();
  if (standing && standing.dataset.key !== key) dismissBringOffer({ instant: true });
  if (!token || !fid || !ctx.meName || ctx.migrationPending || bringAnswered(token, fid)) return;
  if (bringOfferCard()) return; // already asking, here
  // The welcome goes first, once per phone (v92): until it has been read,
  // the offer does not ask — the welcome's "Got it" asks it.
  if (!welcomeSeen()) return;
  if (document.getElementById('artist-sheet')) { offerWhenSheetCloses(); return; }
  const plan = planBringPicks(bringContext());
  if (!plan) return;
  standingOffer = { key, plan };
  showBringOffer($('screen-app'), {
    copy: bringOfferCopy(plan, (state.fest() || {}).name),
    key,
    ctx,
    onBring: () => bringPicksHere(key),
    onDecline: () => rememberBringAnswer(token, fid, 'declined'),
  });
}

// One thing at a time at the bottom of the screen: an offer that would come
// up while a sheet is open waits for the sheet to close, then arrives with
// its usual beat. The post-create share moment opened at the same instant
// and covered the card — a real tap on "Bring it" hit the sheet (WebKit
// walk, iPhone 15, 2026-09-23). Sheets live on <body>, so its child list
// says when the last one has gone.
let offerWaiter = null;
function offerWhenSheetCloses() {
  const Observer = typeof window !== 'undefined' ? window.MutationObserver : undefined;
  if (offerWaiter || typeof Observer !== 'function') return;
  offerWaiter = new Observer(() => {
    if (document.getElementById('artist-sheet')) return;
    offerWaiter.disconnect();
    offerWaiter = null;
    maybeOfferBringPicks();
  });
  offerWaiter.observe(document.body, { childList: true });
}

// ---- the welcome (v92) ------------------------------------------------------------
// Once per phone, on the first crew wall this phone opens — guest or member.
// Like the offer it waits for an open sheet (the create flow's share moment),
// then arrives with its beat; "Got it" is when the offer may ask.
let welcomeWaiter = null;
function maybeWelcome() {
  if (welcomeSeen() || welcomeCard() || !state.getCrewToken()) return;
  if ($('screen-app').style.display === 'none') return;
  if (document.getElementById('artist-sheet')) { welcomeWhenSheetCloses(); return; }
  const people = state.activePeople();
  const picked = Object.keys(model.picksFor(state.crewDoc, ctx.fid)).length > 0;
  const copy = welcomeCopy({
    crewName: state.crewName(), festName: (state.fest() || {}).name,
    people: people.map(([n]) => n), picked, guest: !ctx.meName,
  });
  const faces = people.map(([name, p]) => {
    const ci = colorIndexOf(name, p);
    return { name, bg: hslOf(ci, 0.5), stroke: strokeOf(ci, name === ctx.meName) };
  });
  showWelcome($('screen-app'), {
    copy, faces, ctx,
    onGotIt: () => { pulseJoinRing(); maybeOfferBringPicks(); },
    onHow: () => {
      openSettings();
      router.push('settings');
      openSubviewByKey('sub:how', ctx, settingsActions);
      router.push('sub:how');
    },
  });
}
function welcomeWhenSheetCloses() {
  const Observer = typeof window !== 'undefined' ? window.MutationObserver : undefined;
  if (welcomeWaiter || typeof Observer !== 'function') return;
  welcomeWaiter = new Observer(() => {
    if (document.getElementById('artist-sheet')) return;
    welcomeWaiter.disconnect();
    welcomeWaiter = null;
    maybeWelcome();
  });
  welcomeWaiter.observe(document.body, { childList: true });
}

// Someone else is picking on this phone now (Settings → You, a rename): the
// offer was made for the name before, so it goes. Unanswered — the next entry
// asks the right person.
function withdrawBringOffer() {
  standingOffer = null;
  dismissBringOffer({ instant: true });
}

function bringPicksHere(key) {
  const token = state.getCrewToken();
  const fid = state.activeFestivalId;
  const card = bringOfferCard();
  const offer = standingOffer;
  // The card must still be about the crew, festival and picker on screen, and
  // picks must be writable — anything else and it quietly goes, unanswered.
  if (!card || card.dataset.key !== key || !offer || offer.key !== key || key !== offerKey() || ctx.migrationPending) {
    withdrawBringOffer();
    return;
  }
  const tap = bringFromSource(offer.plan, bringContext());
  if (!tap) { withdrawBringOffer(); return; }
  rememberBringAnswer(token, fid, 'brought');
  standingOffer = null;
  // applyLocalPick's two steps, with the doc written to disk ONCE at the end:
  // persisting the whole crew doc per pick is fine for a tap and a stall for
  // fifty of them at once.
  if (tap.count) {
    state.ensureFestivalState(fid);
    const sels = state.crewDoc.festivals[fid].selections;
    for (const [artist, level] of Object.entries(tap.picks)) {
      state.recordSelection(artist, ctx.meName, level);
      (sels[artist] = sels[artist] || {})[ctx.meName] = level;
    }
    state.persist();
    sync.scheduleSync();
    repaintWall();
  }
  // Nothing left from the crew the card named (all decided here meanwhile):
  // the card says so rather than reaching into another crew.
  settleBringOffer(bringDoneLine(tap.count), { ctx });
}

// `artist` (v92): a guest tapped this artist on the wall — the screen says
// the pick is waiting behind the answer, and finishJoin makes it. Every way
// in ends in finishJoin, which does nothing when no guest was asking.
function renderJoin(token, doc, { artist = null } = {}) {
  show('screen-join');
  const forLine = $('join-for');
  if (forLine) {
    forLine.textContent = artist ? `Pick ${artist} as…` : '';
    forLine.style.display = artist ? '' : 'none';
  }
  // "Just looking" (v92): the way onto the wall without a name, from every
  // join screen — the old one (a personal link, "Not me") included.
  const look = $('join-look');
  if (look) look.onclick = () => lookAround(token, doc);
  // Never throws into the join's own error path: a failed pick after a good
  // join must not be mistaken for a failed join (the offline branch below
  // would record the person a second time).
  const entered = (entering) => Promise.resolve(entering).then(() => {
    try { finishJoin(token); } catch (e) { record('join:finish', e); }
  });
  // The invite names the FESTIVAL (FLOW-10) — the fest is why you came; the
  // crew is who with. Fest context comes from the link's &f= or the doc stamp.
  const hintId = pendingFestHint || (doc.meta && doc.meta.inviteFestId) || null;
  const festMeta = hintId ? FESTIVAL_INDEX.find((f) => f.id === hintId) : null;
  const crewLabel = (doc.meta && doc.meta.name) || 'your crew';
  const headline = $('join-fest-name');
  if (festMeta) {
    headline.textContent = `${festMeta.name.toUpperCase()} ${festMeta.year || ''}`.trim();
    headline.style.color = `rgb(${festMeta.accent || '192, 132, 252'})`;
    $('join-crew-sub').textContent = `with ${crewLabel}`;
  } else {
    headline.textContent = crewLabel;
    headline.style.color = '';
    $('join-crew-sub').textContent = '';
  }
  $('join-status').textContent = '';
  const list = $('join-people');
  list.textContent = '';
  // A personal link (&me=Drew) floats Drew's circle to the top and marks it —
  // their picks are already waiting behind that tap (Kevin note 5).
  const meHint = pendingMeHint ? pendingMeHint.toLowerCase() : null;
  const entries = Object.entries(doc.people || {}).filter(([, p]) => !(p && p.removed));
  entries.sort(([a], [b]) => (b.toLowerCase() === meHint) - (a.toLowerCase() === meHint));
  for (const [name, p] of entries) {
    const row = document.createElement('button');
    row.className = 'fest-row';
    row.style.width = '100%';
    const av = document.createElement('span');
    av.className = 'avatar lg';
    const ci = colorIndexOf(name, p);
    av.style.background = hslOf(ci, 0.5);
    av.style.border = '1px solid ' + strokeOf(ci, false);
    av.textContent = name.charAt(0).toUpperCase();
    const nm = document.createElement('span');
    nm.style.cssText = 'color: #fff; font-weight: 700; font-size: 15px;';
    nm.textContent = name;
    row.append(av, nm);
    if (meHint && name.toLowerCase() === meHint) {
      // --brand: "this link is yours" is about a PERSON, on the join screen,
      // before any festival is even on screen. Not one of the accent's four.
      row.style.border = '1.5px solid rgba(var(--brand), .7)';
      const hint = document.createElement('span');
      hint.style.cssText = 'margin-left: auto; color: rgb(var(--brand)); font-size: 11px; font-weight: 800; flex: none;';
      hint.textContent = 'this link is yours';
      row.appendChild(hint);
    }
    row.addEventListener('click', () => { crew.setMe(token, name); entered(enterApp(token, doc)); });
    list.appendChild(row);
  }
  $('join-add-btn').onclick = async () => {
    const name = $('join-name-input').value.trim();
    const status = $('join-status');
    // Same rule the server enforces (FLOW-5): the form answers, never a 400.
    const problem = nameProblem(name);
    if (problem) { status.textContent = problem; return; }
    // Typing an existing member's name is a returning member recognizing
    // themselves — claim it, same as tapping the row. Case-insensitive:
    // "drew" typing in must claim Drew, never fork a second member.
    const existingEntry = Object.entries(doc.people || {})
      .find(([n, p]) => n.toLowerCase() === name.toLowerCase() && p && !p.removed);
    if (existingEntry) { crew.setMe(token, existingEntry[0]); entered(enterApp(token, doc)); return; }
    const btn = $('join-add-btn');
    btn.disabled = true;
    status.textContent = '';
    status.appendChild(eqLoader('Finding your people…'));
    const taken = Object.values(doc.people || {})
      .map((p) => p.colorIndex).filter(Number.isInteger);
    // removed:false explicitly: deep-merge can't delete a tombstone, so a
    // joiner reclaiming a previously-removed name would otherwise merge onto
    // removed:true and enter the crew invisible. Holding the link IS the
    // capability — rejoining resurrects.
    const person = { colorIndex: nextColorIndex(taken), removed: false };
    const festHint = pendingFestHint || (doc.meta && doc.meta.inviteFestId) || null;
    document.body.dataset.busy = 'join'; // a new build's reload waits for the answer
    try {
      // The first write happens BEFORE entry (FLOW-5): if the server says no
      // (people cap, doc size), the joiner hears it here — not as a forever-
      // gray sync dot after picking twenty artists that never left the phone.
      const res = await fetch(`/api/crew?t=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { people: { [name]: person } }, sv: 4 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        status.textContent = errorText(body, 'The crew service hiccuped — give it a second and tap Join again.');
        btn.disabled = false;
        return;
      }
      const merged = await res.json();
      crew.setMe(token, name);
      await entered(enterApp(token, merged));
    } catch {
      // Network failure: offline-first join, sync catches up (old behavior).
      state.activateCrew(token, doc, festHint);
      state.recordPerson(name, person);
      crew.setMe(token, name);
      entered(enterApp(token, state.crewDoc));
      sync.scheduleSync();
    } finally {
      delete document.body.dataset.busy;
      btn.disabled = false;
    }
  };
}

// `current` threads boot's generation guard through the awaits: if a newer
// boot started (rapid crew-link switch), this activation aborts instead of
// swapping page-level state under a wall the user can still see and tap —
// which could attribute a tap on the OLD crew's card to the NEW crew's
// pendingChanges (Codex P6 gate, finding P1-2).
// Me link: every crew this device enters stamps itself onto the person
// record — create, join, and every pre-existing crew alike, so the registry
// backfills one open at a time with no migration event. Silent and
// non-blocking: identity plumbing never stands between a person and their
// wall; a failure here just retries on the next open.
async function stampIdentity(token, current = () => true, { renameFrom = null } = {}) {
  const name = ctx.meName;
  if (!name) return;
  try {
    const p = await crew.ensurePerson(name);
    // Re-check EVERYTHING after the await: crew switched, boot superseded,
    // or the picker changed mid-flight — any of those and this stamp would
    // write the wrong identity into the wrong place (Codex gate, P1).
    if (!p || !current() || state.getCrewToken() !== token || ctx.meName !== name) return;
    // Shared-phone guard: the record belongs to one human; switchIdentity
    // must never rewrite the owner's claim or take their pid. A rename is
    // honored only FROM the currently-claimed name (renameSelf passes it).
    if (!crew.mayStampPerson(p, token, name, { renameFrom })) return;
    crew.stampPersonCrew(token, name, state.crewName());
    // The crew doc points back with the PUBLIC id only — never the person
    // token (crew docs are readable by everyone holding that crew's link).
    // And only into an EMPTY slot: a differing pid belongs to someone else's
    // person record, and overwriting it would merge two humans.
    const me = state.people()[name];
    if (me && !me.removed && !me.pid) {
      const queued = (state.pendingChanges.people || {})[name] || {};
      state.recordPerson(name, { ...queued, pid: p.id });
      me.pid = p.id; // local doc mirror, recorder convention
      sync.scheduleSync();
    }
  } catch { /* next open retries */ }
}

// `customs` is the crew's custom-festival fetch — boot starts it beside the
// catalog; any other entry starts it here. Merged only now, catalog in hand.
// `recognized` (boot only): the name recognizeOnOpen claimed for this device.
// `warm` (boot only): the festival canOpenWarm admitted, `{ fid, fest }` —
// painting from this phone's own copy, so nothing below may wait on the
// network, and nothing re-decides the festival (see boot's warm open).
async function enterApp(token, doc, current = () => true, customs = fetchCustomFestivals(token), { recognized = null, warm = null, holdOffer = false } = {}) {
  dismissBringOffer({ instant: true }); // an offer is about the crew it was made in — never the next one
  dismissWelcome({ instant: true });    // nor does a card from one crew sit over the next
  // A share link's starting view (v92): consumed once, like the fest hint,
  // and only ever for a phone that has never shown the link's festival — read
  // before this entry remembers anything about it.
  const showHint = pendingShowHint;
  pendingShowHint = null;
  const showFor = showHint && pendingFestHint && !festShownBefore(pendingFestHint) ? pendingFestHint : null;
  crew.setActiveCrew(token);
  crew.rememberCrew(token, (doc.meta && doc.meta.name) || '');
  mergeCustoms(await customs); // crew-private fests join the catalog first
  if (!current()) return;
  // Invite festival context (FLOW-1): the link's &f= wins (freshest), then the
  // doc's stamp. Consumed once — only fills the void on a fest-less device.
  // A guest (v92) with neither — an old link, an old doc — lands where the
  // crew's picks are rather than on the catalog's default, which is also a
  // festival the crew may not have (and opening one records it in the doc).
  const festHint = pendingFestHint || (doc.meta && doc.meta.inviteFestId)
    || (crew.me(token) ? null : model.busiestFestival(doc, FESTIVAL_INDEX.map((f) => f.id)))
    || null;
  pendingFestHint = null;
  state.activateCrew(token, doc, festHint, { festival: warm ? warm.fid : null });
  // Backfill (audit re-run finding): crews older than the fix never got the
  // stamp, so THEIR links — the ones already in group chats — still showed
  // joiners no festival. Any claimed member's boot heals the doc once, from
  // the crew's busiest fest (where the picks live), through the sanctioned
  // carve-out field. Share invite keeps refreshing it afterwards.
  if (crew.me(token) && !(state.crewDoc.meta && state.crewDoc.meta.inviteFestId)) {
    const stamp = model.busiestFestival(state.crewDoc, FESTIVAL_INDEX.map((f) => f.id))
      || state.activeFestivalId;
    if (FESTIVAL_INDEX.some((f) => f.id === stamp)) {
      state.recordInviteFest(stamp);
      sync.scheduleSync();
    }
  }
  // Migrate BEFORE the wall becomes interactive: a raw 3 written onto a
  // still-v3 doc would later be rewritten to 4 by the migrate op — silently
  // corrupting a genuine "picked x3" into "must" (Codex P6 gate, finding 1).
  // Offline/failed migration -> writes stay gated (ctx.migrationPending) and
  // the poll loop retries; reads are safe throughout (readLevel maps by v).
  if (model.needsMigration(state.crewDoc) && warm) {
    // A warm open never waits on the network: picks stay gated (the banner
    // says so) until the one-shot op lands — here, or on the 25 s loop. Under
    // Stay offline it is not asked for here at all.
    ctx.migrationPending = true;
    if (!appSettings().stayOffline) {
      sync.requestMigration().then(() => {
        if (!current() || state.getCrewToken() !== token) return;
        ctx.migrationPending = model.needsMigration(state.crewDoc);
        if (!ctx.migrationPending) repaintWall();
      });
    }
  } else if (model.needsMigration(state.crewDoc)) {
    await sync.requestMigration();
    if (!current()) return;
    ctx.migrationPending = model.needsMigration(state.crewDoc);
  } else {
    ctx.migrationPending = false;
  }
  try {
    // A warm open arrives with its festival's file in hand (canOpenWarm), so
    // this answers from memory.
    if (warm && !state.FESTIVALS[warm.fid]) state.FESTIVALS[warm.fid] = warm.fest;
    await loadFestival(state.activeFestivalId);
  } catch {
    // Offline with this fest uncached: fall back to a loadable fest rather
    // than stranding a blank wall (CORE-12). If the default also fails,
    // boot's error boundary takes over.
    const fallback = defaultFestivalId();
    if (state.activeFestivalId === fallback) throw new Error(`festival ${fallback} failed to load`);
    const wantedName = FESTIVAL_INDEX.find((f) => f.id === state.activeFestivalId)?.name || 'that festival';
    state.setActiveFestivalId(fallback);
    state.ensureFestivalState(fallback);
    await loadFestival(fallback);
    showToast($('toast-root'), `Couldn’t load ${wantedName} offline — it opens once you’re back online.`, 6000);
  }
  // A festival this device was pointed at and the catalog has since dropped.
  // We opened a real one instead; say which, and say the picks survived —
  // otherwise the board just changes underneath the person and the landing
  // row that promised "tap this fest, get this fest" has quietly lied.
  // (Never on a warm open: it only runs when the saved festival IS listed.)
  if (state.missingFestivalId) {
    const gone = model.festLabelFor(state.missingFestivalId, FESTIVAL_INDEX).name;
    const here = model.festLabelFor(state.activeFestivalId, FESTIVAL_INDEX).name;
    showToast($('toast-root'), `${gone} isn’t in the lineup any more — opened ${here} instead. Its picks are still saved.`, 6000);
  }
  if (!current()) return;
  // Captured before replaceState rewrites the entry: which layers were open
  // when the page was refreshed (spec F10 — refresh restores the same
  // surface). The entry must KEEP representing those layers — writing null
  // here made one Back collapse the whole restored stack and killed Forward
  // (Codex trailing review, P1, reproduced).
  const savedLayers = (history.state && history.state.layers) || null;
  // Seeded BEFORE the first paint, so the wall opens already on the view the
  // link carried — nothing folds away under the person's eyes.
  const opened = showFor && state.activeFestivalId === showFor ? seedShowOnce(showFor, showHint) : null;
  show('screen-app');
  applyFestTheme();
  refreshCtx();
  renderPersonChips();
  renderYou();
  repaintWall();
  maybeOpenOnDay();
  startClock();
  history.replaceState(savedLayers ? { layers: savedLayers } : null, '', `/#g=${token}`);
  sync.pollSync();
  router.reset();
  if (savedLayers) router.restore(savedLayers);
  // Badges are per-crew, the scanned library is per-device: opening a crew
  // this library has never badged fills it in right here — connect on one
  // crew and every crew you open follows (Kevin's report, 2026-07-13: The
  // Crew showed no likes after he connected on another crew). No-op when
  // nothing changed; badgeAllCrewFests skips the write itself.
  if (ctx.meName && spotify.isConnected() && spotify.libraryMap()) {
    spotify.badgeAllCrewFests(ctx.meName).then(({ changed }) => {
      if (changed && current()) { sync.scheduleSync(); refreshCtx(); repaintWall(); }
    }).catch((e) => console.warn('crew badge sweep:', e));
  }
  // Me link — fire-and-forget by design. A first join only becomes provably
  // "mine" once the stamp writes this device's pid onto the name, so the
  // picks offer asks again when it lands (a no-op if it is already up).
  stampIdentity(token, current).then(() => {
    if (!holdOffer && current() && state.getCrewToken() === token) maybeOfferBringPicks();
  });
  // Said once, on arrival, with the one door back to everything (v92). A
  // recognized phone's "Not me" outranks it — the next line replaces it.
  if (opened) showActionToast($('toast-root'), `Opened on ${opened}.`, 'Show all', unfoldAll, 6000);
  if (recognized) welcomeRecognized(token, recognized);
  // After the toasts: the cards step up over them. `holdOffer`: the caller is
  // about to open a sheet (the create flow's share moment), and asks for the
  // welcome and the offer itself once that sheet is up, so they wait for it.
  // The welcome first — the offer never asks before it has been read.
  if (!holdOffer) { maybeWelcome(); maybeOfferBringPicks(); }
  // A hop from an alias domain mid-Spotify-setup (SPOT-1): reopen the drill
  // so the member lands exactly where they left off.
  if (pendingSpotifyOpen) {
    const auto = pendingSpotifyOpen === 'connect';
    pendingSpotifyOpen = false;
    openSettings();
    router.push('settings');
    openSubviewByKey('sub:spotify', ctx, settingsActions);
    router.push('sub:spotify');
    // They already pressed Connect on the other host. Do not make them press it
    // again — the hop is our plumbing, not their errand.
    if (auto && !spotify.isConnected()) {
      spotify.connect().catch((e) => {
        showToast($('toast-root'), String(e.message || e), 6000);
      });
    }
  }
}

// ---- the warm open (2026-09-23) --------------------------------------------------
// STRICT by design (round 4 — the coordinator's call the day before the
// festival: fewer moving parts beats clever reconciliation). A warm open
// paints only EXACTLY the wall the person left: a name this device claimed
// in the crew, the crew's cached doc, the saved festival listed in the
// CACHED catalog (a crew's own festival: in its locally stored list), and
// that festival's file in hand. Anything missing and boot takes the ordinary
// path and waits for the network, as it always did. So a warm open never
// switches festivals, never writes the saved choice and never loads a
// different festival — the round-3 reconciliation that did those things is
// gone, with the bugs it grew (a note re-aimed into another festival, a
// fallback confirmed before the facts arrived, a request under Stay offline).
//
// The ADMITTED festival — `{ fid, fest }`, its id and its file — when this
// device can paint that wall now; null when it cannot. The admission travels
// into activation as it is (enterApp → activateCrew's `festival`): the live
// catalog can land while this is still reading the cache, and nothing after
// this point may re-decide the festival on it (Codex round 4, 2026-09-23).
async function canOpenWarm(token) {
  if (!crew.me(token) || !state.cachedDoc(token)) return null;
  const saved = getLS(state.LS.fest(token));
  if (!saved) return null; // no saved choice: which wall was "left" is not known
  if (!(await festivalIndexFromCache())) return null;
  const listed = FESTIVAL_INDEX.some((f) => f.id === saved && !f.custom);
  // A crew's own festival: the locally stored list IS its file.
  const fest = listed
    ? await festivalFromCache(saved)
    : cachedCustomFestivals(token).find((f) => f && f.id === saved);
  return fest ? { fid: saved, fest } : null;
}

// After a warm paint (and whenever "Stay offline" is switched back off) the
// network may only REFRESH what is on screen — never change which festival
// is showing. Stay offline is read at the moment each request would fire:
// while it is on, nothing is asked; switching it off runs this again.
//   - The festival file on screen (network-first through the worker, as
//     ever — a data push still reaches an online phone on this very open).
//   - The catalog, for later switches. If the live catalog no longer lists
//     the festival on screen, it STAYS on screen: the next cold open resolves
//     it, with its usual toast. Moving someone's wall under them — with a note
//     half-typed — is the worse failure.
//   - The crew's own festivals: rejoin the replaced catalog, then fresh.
//   The crew doc needs nothing here: enterApp's poll is its path.
function freshenFromNetwork(token, catalog, current) {
  const live = () => current() && state.getCrewToken() === token;
  const online = () => !appSettings().stayOffline;
  if (!online()) return;
  refreshFestivalFile(state.activeFestivalId);
  (async () => {
    await catalog();
    if (!live()) return;
    mergeCustoms(cachedCustomFestivals(token)); // the live list replaced the cached one wholesale
    if (!online()) return;
    const fresh = await fetchCustomFestivals(token);
    if (live()) applyFreshCustoms(fresh);
  })().catch((e) => { console.warn('warm open: catalog', e); record('warm-open:catalog', e); });
}

// A festival file, fresh from the network. The file is shared by every crew
// at that festival, so a changed one is kept, its computed days forgotten,
// and whichever wall is SHOWING that festival now repaints — whatever crew's
// open happened to ask (Codex round 3, new B: A's answer landed while B was
// on screen, and B's identical answer then changed nothing).
function refreshFestivalFile(fid) {
  fetchFestivalFile(fid).then((fest) => {
    if (!fest || JSON.stringify(fest) === JSON.stringify(state.FESTIVALS[fid])) return;
    state.FESTIVALS[fid] = fest;
    state.forgetComputedDays(fid);
    if (state.activeFestivalId === fid) { applyFestTheme(); repaintFromRemote(); }
  }).catch((e) => { console.warn('warm open: festival file', e); record('warm-open:fest-file', e); });
}

// The crew's own festivals, fresh from the server. One that changed is a data
// push like any other: its computed days go, and if it is on screen the wall
// repaints (Codex review, 2026-09-23 — 8:00 PM live, 9:00 PM on screen).
function applyFreshCustoms(list) {
  const ids = list.filter((f) => f && f.id).map((f) => f.id);
  const before = new Map(ids.map((id) => [id, JSON.stringify(state.FESTIVALS[id] || null)]));
  mergeCustoms(list);
  let onScreen = false;
  for (const [id, was] of before) {
    if (JSON.stringify(state.FESTIVALS[id] || null) === was) continue;
    state.forgetComputedDays(id);
    if (id === state.activeFestivalId) onScreen = true;
  }
  if (onScreen) { applyFestTheme(); repaintFromRemote(); }
}

// ---- lost states (spec F16) --------------------------------------------------------
// A link that doesn't resolve gets a real screen with a way forward — never a
// silent fall to landing (FLOW-3). `gone` = the server said 404 (deleted or
// retyped). Otherwise: offline OR a server error — and the copy must not
// blame the user's connection for the server's problem (audit re-run finding:
// a 500 used to read as "you're offline" while navigator.onLine was true).
function renderBadLink(token, { gone, malformed }) {
  show('screen-badlink');
  document.title = 'Festival Navigator';
  $('badlink-msg').textContent = malformed
    // The commonest cause by far: a chat app clipped the link, or only half of
    // it got pasted. Name that, and give them the one thing that fixes it.
    ? 'That crew link looks cut off — messaging apps sometimes clip long links. Paste the whole thing here, ending in a long jumble of letters.'
    : gone
      ? 'It may have been retyped, or the crew was deleted. Ask your crew for a fresh link and paste it here.'
      : (navigator.onLine
        ? 'The crew service hit an error — it’s not you, and your link is probably fine. Try again in a minute.'
        : 'You’re offline and this crew isn’t saved on this device yet. Reconnect, then open the link again.');
  if (gone) crew.forgetCrew(token); // dead crews don't haunt the landing list
  else if (!malformed) $('badlink-input').value = crew.crewLink(token);
  else $('badlink-input').value = ''; // nothing worth pre-filling from a broken link
  $('badlink-status').textContent = '';
  $('badlink-open').onclick = () => {
    const m = ($('badlink-input').value || '').match(/g=([A-Za-z0-9_-]{20,40})/);
    if (!m) { $('badlink-status').textContent = 'That doesn’t look like a crew link — it has a #g= part.'; return; }
    const target = `#g=${m[1]}`;
    if (location.hash === target) boot();
    else location.hash = target; // hashchange boots
  };
  $('badlink-home').onclick = () => { history.replaceState(null, '', '/'); renderLanding(); };
}

// The last-resort screen (FLOW-4): an exception escaping boot/enterApp used
// to leave every screen display:none — a permanently blank page.
function renderFatal() {
  try {
    show('screen-error');
    document.title = 'Festival Navigator';
    $('error-retry').onclick = () => location.reload();
    $('error-home').onclick = () => { history.replaceState(null, '', '/'); renderLanding(); };
  } catch { /* even the error screen failed — nothing safe left to render */ }
}

// ---- boot -----------------------------------------------------------------------
let bootGeneration = 0;
let firstBoot = true; // cold start resumes the active crew; later boots don't (note 2)
let pendingFestHint = null; // &f= from the opened invite link, consumed by enterApp
let pendingMeHint = null; // &me= from a personal invite link, consumed by renderJoin
let pendingShowHint = null; // &show= — the view a share link carries (v92), consumed by enterApp
let pendingSpotifyOpen = false; // &sp=1 from the canonical-domain hop (SPOT-1)
export async function boot() {
  const gen = ++bootGeneration;
  const current = () => gen === bootGeneration;
  const isFirst = firstBoot;
  firstBoot = false;
  router.reset();
  // Capture before any await: enterApp's replaceState strips the hash to #g=.
  pendingFestHint = crew.festFromHash();
  pendingMeHint = crew.meFromHash();
  pendingShowHint = crew.showFromHash();
  pendingJoin = null; // a guest's question belongs to the wall it was asked on
  // sp=1 -> reopen the drill. sp=connect -> reopen it AND continue the connect
  // the person already asked for on the other host.
  const spMatch = /[#&]sp=(connect|1)(?:&|$)/.exec(location.hash || '');
  pendingSpotifyOpen = spMatch ? spMatch[1] : false;
  // The me link is a MASTER KEY: capture and strip it synchronously, before
  // the first await can leave it sitting in the address bar and history while
  // the network dawdles (Codex gate, P1). Routed before crew links; a broken
  // one says so — same contract as broken crew links. A URL carrying BOTH a
  // person and a crew token is a canonical-host hop (Spotify OAuth): the
  // strip keeps the crew part so the connect flow continues after the absorb.
  const personToken = crew.personFromHash();
  const personLinkBroken = crew.hashHasBrokenPersonLink();
  const hopCrewToken = personToken ? crew.tokenFromHash() : null;
  if (personToken || personLinkBroken) {
    history.replaceState(null, '', hopCrewToken ? `/#g=${hopCrewToken}` : '/');
  }
  try {
    // The catalog leaves now and nothing waits on it alone: a crew boot sends
    // its own two requests beside it (below). Each branch that renders from
    // the catalog awaits it first. Under "Stay offline" it leaves only when a
    // branch actually needs the network (2026-09-23): a warm open asks the
    // network for nothing.
    const fetchCatalog = () => loadFestivalIndex().catch(() => { /* offline with cache: proceed */ });
    let catalogRequest = appSettings().stayOffline ? null : fetchCatalog();
    const catalog = () => catalogRequest || (catalogRequest = fetchCatalog());

    if (personLinkBroken) {
      await catalog();
      if (!current()) return;
      renderLanding();
      showToast($('toast-root'), 'That link looks cut off — copy it again from your other device.', 6000);
      return;
    }
    if (personToken && !hopCrewToken) { await catalog(); await restoreFromMeLink(personToken, current); return; }
    // Quiet absorb — from the hop URL, or from a previous boot's absorb that
    // failed offline (the token waits in sessionStorage: session-scoped
    // master-key hygiene, dies with the tab, never re-enters a URL). Landing
    // on the canonical host with one crew and none of the rest is how a
    // whole map "disappeared" (2026-07-14); a swallowed absorb failure would
    // re-open that trap wearing an offline costume (Codex round 4, P2).
    const pendingAbsorb = personToken && hopCrewToken
      ? personToken
      : (() => { try { return sessionStorage.getItem('fn_pending_absorb'); } catch { return null; } })();
    if (pendingAbsorb) {
      // Park FIRST, synchronously: the URL is already stripped, so if a newer
      // boot supersedes this one mid-fetch, the parked copy is the only one
      // left anywhere (Codex round 5, P2). Success — by whichever generation
      // survives — clears it.
      try { sessionStorage.setItem('fn_pending_absorb', pendingAbsorb); } catch { /* private mode — me link reopens */ }
      let fetched = null;
      let failed = false;
      try { fetched = await crew.fetchPerson(pendingAbsorb); } catch { failed = true; }
      // The generation guard comes BEFORE any mutation: a stale response
      // must not replace the device's identity after a newer boot started
      // (Codex round 4, P1 — same law as restoreFromMeLink).
      if (!current()) return;
      if (fetched) {
        // Quiet absorb unions the boards but never DETHRONES an identity the
        // destination already holds — replacing is the explicit me-link
        // restore's job, not a side effect of connecting Spotify.
        absorbPersonDoc(pendingAbsorb, fetched, { replaceIdentity: false });
        try { sessionStorage.removeItem('fn_pending_absorb'); } catch { /* fine */ }
      } else if (failed) {
        showToast($('toast-root'), 'Couldn’t bring your other boards over yet — they’ll follow once you’re online.', 6000);
      } else {
        // The server SAID the person doesn't exist — retrying a dead link
        // every boot would just re-toast forever.
        try { sessionStorage.removeItem('fn_pending_absorb'); } catch { /* fine */ }
      }
    }

    // Every branch re-checks it is still the current boot after its await: a
    // boot superseded meanwhile (the person opened a crew) renders nothing
    // over the newer wall (Codex round 4, 2026-09-23 — inherited from main).
    if (location.hash === '#new') { await catalog(); if (current()) renderCreate(); return; }
    // A crew link that is present but malformed (truncated by a chat app, half
    // pasted) must say so. Falling through to the landing page told the person
    // nothing at all — the app quietly acting as if they had never clicked.
    if (crew.hashHasBrokenToken()) { renderBadLink('', { gone: false, malformed: true }); return; }
    const token = crew.bootTokenFor(crew.tokenFromHash(), crew.activeCrewToken(), isFirst);
    if (!token) { await catalog(); if (current()) renderLanding(); return; }

    // The warm open (2026-09-23). When this phone can paint EXACTLY the wall
    // the person left (canOpenWarm), it paints it NOW and the network lands
    // the ordinary way whenever it answers: enterApp's poll is the
    // remote-change path (repaint, chips, an open sheet), and our API's JSON
    // 404 is still the crew-gone path — one poll after the first paint rather
    // than before it, which is the trade. At Pier 80 the network hangs rather
    // than fails, and the path below spent up to ~16 s of loader on files that
    // were already here. Anything short of that exact wall takes the path
    // below and waits, as it always did.
    const admitted = await canOpenWarm(token);
    if (admitted) {
      if (!current()) return;
      await enterApp(token, state.cachedDoc(token), current, Promise.resolve(cachedCustomFestivals(token)), { warm: admitted });
      if (current()) freshenFromNetwork(token, catalog, current);
      return;
    }

    // The crew doc and the crew's own festivals leave beside the catalog, so
    // a network that hangs costs the slowest wait (8 s), never the sum of
    // three. The customs merge later, in enterApp, once the catalog is in.
    const customs = fetchCustomFestivals(token);
    let doc = null;
    let gone = false;
    const fetched = crew.fetchCrew(token).then((d) => { doc = d; gone = d === null; }, () => { /* network failure — try the cache below */ });
    await Promise.all([catalog(), fetched]);
    if (!current()) return;
    // A deleted crew is deleted NOW — don't re-enter the app on a stale
    // cached doc just to bounce out one sync later (Codex trailing review).
    if (gone) { renderBadLink(token, { gone: true }); return; }
    if (!doc) doc = state.cachedDoc(token);
    if (!doc) { renderBadLink(token, { gone }); return; }
    let recognized = null;
    if (!crew.me(token)) {
      recognized = recognizeOnOpen(token, doc);
      if (recognized) crew.setMe(token, recognized);
      // Wall first (v92): a phone the crew does not know opens onto the wall
      // as a guest, and is asked its name when it taps an artist. Two still
      // ask first, as they always did: a personal link (it names who it is
      // for — "this link is yours"), and a phone that IS in the crew but
      // cannot be told which member (walking it in as a guest would read as
      // the app forgetting it).
      else if (pendingMeHint || crew.personInCrew(crew.myPerson(), token, doc)) { renderJoin(token, doc); return; }
    }
    await enterApp(token, doc, current, customs, { recognized });
  } catch (e) {
    console.error('boot failed', e);
    // The worst failure the app can have, and a CAUGHT one never reaches the
    // global hooks — so it names itself (DESIGN §1: before v88 the crash
    // that locks a friend out was the one Diagnostics could not see).
    // A boot a newer one already replaced (a hashchange mid-boot) was never
    // on screen: still worth knowing, but not "the app won't open".
    record(current() ? 'boot' : 'boot:superseded', e);
    if (current()) renderFatal();
  }
}

// Everything that renders identity/state repaints together — the dock avatar
// was the one holdout showing a stale color (audit 1.5). The remote-change
// path, and the warm open's fresh festival file takes it too.
function repaintFromRemote() { repaintWall(); renderPersonChips(); renderYou(); refreshOpenSheet(); }

// ---- wiring ----------------------------------------------------------------------
export function init() {
  sync.initSync({
    onRemoteChange: repaintFromRemote,
    onCrewGone: (token) => {
      // The server said this crew no longer exists — a dead row on the
      // landing list would just 404 again (FLOW-3).
      crew.forgetCrew(token);
      // A late answer about a crew you have since left (a warm open's first
      // poll, answering after you opened another crew): forget it, but the
      // crew on screen stays on screen (Codex review, 2026-09-23).
      if (state.getCrewToken() !== token) return;
      renderLanding();
      showToast($('toast-root'), 'That crew link no longer works — removed from your festivals.', 6000);
    },
    // A limit/validation rejection stops the retry loop (sync.js) — the
    // human hears the server's own reason instead of a forever-gray dot.
    // The server's reason is a sentence fragment as often as not, so punctuate
    // it here rather than running two sentences together ("...hit a limit Your
    // changes are safe").
    onSyncBlocked: (reason) => {
      const said = /[.!?]$/.test(reason.trim()) ? reason.trim() : `${reason.trim()}.`;
      showToast($('toast-root'), `${said} Your picks are safe on this phone — they'll sync as soon as the crew has room.`, 8000);
    },
  });

  window.addEventListener('fn:new-build', showNewBuildStrip);
  // A localStorage write that fails is the one way a pick can vanish without a
  // trace: the edit is in memory, the push is 1.2s away, and the on-disk copy
  // that would survive a reload never happened. It used to console.warn. Now
  // the person holding the phone finds out.
  onStorageWriteFail(() => {
    showToast($('toast-root'), 'This phone’s storage is full, so picks can’t be saved offline. They still sync while you have signal.', 9000);
  });

  // Browser navigation models the layer stack (FLOW-2): back closes the top
  // layer, forward re-opens it, refresh restores it (spec F10).
  router.registerKind('settings', () => openSettings(), () => closeSettings());
  router.registerKind('sub:', (key) => { openSettings(); openSubviewByKey(key, ctx, settingsActions); }, () => openSettings());
  router.registerKind('sheet:', (key) => {
    refreshCtx();
    if (key === 'sheet:all') openAllNotes(ctx);
    else if (key === 'sheet:share') openShareMoment();
    else if (key === 'sheet:add-member') openAddMember();
    else if (key === 'sheet:fest') openFestNotes(ctx, onNotesChange);
    else if (key.startsWith('sheet:day:')) openDayNotes(key.slice('sheet:day:'.length), null, ctx, onNotesChange);
    else if (key.startsWith('sheet:notes:')) {
      const d = decodeNotesKey(key);
      if (d) openArtistSheet(d.artist, ctx, onNotesChange, d.occ);
    }
  }, () => closeSheet());
  window.addEventListener('popstate', (e) => router.onPopState(e.state));
  $('search-input').addEventListener('input', (e) => {
    ctx.query = e.target.value;
    unzoom({ instant: true, why: 'wall switched' });
    renderWall($('wall-root'), ctx);
    renderDayNav(); // scrollspy re-wires against the filtered day blocks (gate F8)
    measureStickyChrome(); // search mode drops the stage strip — jump offset shrinks
  });
  // A late font changes how wide the fest name and the days draw, so NOW
  // re-reads the room it has (the corners' refit does the same, wall.js).
  if (document.fonts && typeof document.fonts.addEventListener === 'function') {
    document.fonts.addEventListener('loadingdone', () => NOW_TABS.forEach((id) => fitNowTab($(id))));
  }
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      measureStickyChrome();
      NOW_TABS.forEach((id) => fitNowTab($(id))); // a rotation changes the room the days have
      // Each scroller clamps its own scrollLeft during a resize, which can
      // desync the mirrored columns from the strip (Kevin's wide-screen
      // wonk screenshot, 2026-07-12) — re-mirror each group to its first.
      // Groups are wall.js's (`data-sync`, no key = one group): a rotation
      // must not drag Friday's venue-night room to Thursday's position.
      // Day scrollers only: the stage strip follows its grid by transform
      // (wall.js followStrip) and is never scrolled itself.
      const leads = new Map();
      for (const sc of document.querySelectorAll('#wall-root .times-scroll')) {
        if (isStripScroller(sc)) continue;
        const key = sc.dataset.sync || '*';
        if (!leads.has(key)) leads.set(key, sc.scrollLeft);
        else if (sc.scrollLeft !== leads.get(key)) sc.scrollLeft = leads.get(key);
      }
    }, 150);
  });
  const sortCtl = createSortControl({ initial: ctx.sort, onChange: (v) => { ctx.sort = v; repaintWall(); } });
  $('sort-control').appendChild(sortCtl.el);
  const dock = $('dock');
  $('search-input').addEventListener('focus', () => dock.classList.add('hidden'));
  $('search-input').addEventListener('blur', () => dock.classList.remove('hidden'));
  const jumpTop = () => window.scrollTo({ top: 0, behavior: ctx.lowPower ? 'auto' : 'smooth' });
  // The "you" slot jumps to the top — or, for a guest, is the door to join (v92).
  const youTap = () => (!ctx.meName && state.getCrewToken() ? askToJoin(null) : jumpTop());
  $('dock-you').addEventListener('click', youTap);
  $('rail-you').addEventListener('click', youTap);
  for (const id of NOW_TABS) $(id).addEventListener('click', jumpToNow);
  const openSettingsLayer = () => { openSettings(); router.push('settings'); };
  $('gear-btn').addEventListener('click', openSettingsLayer);
  // The fest name opens the show menu when the fest has rooms to choose
  // between, and Settings when it does not (MODEL-V4 §3.1).
  for (const [wrapId, linkId] of SHOW_MENUS) {
    $(linkId).addEventListener('click', () => {
      const wrap = $(wrapId);
      const pop = wrap && wrap.querySelector('.sort-pop');
      if (!pop) { openSettingsLayer(); return; }
      if (openMenu && openMenu.pop === pop) closeShowMenu();
      else openShowMenu(wrap, $(linkId), pop);
    });
  }
  // A tap outside closes it, like every other popover in the app.
  document.addEventListener('click', (e) => {
    if (openMenu && !openMenu.wrap.contains(e.target)) closeShowMenu();
  });
  $('fest-list-btn').addEventListener('click', goToFestList);
  $('notes-chip').addEventListener('click', () => { refreshCtx(); openAllNotes(ctx); router.push('sheet:all'); });
  $('create-go-btn').addEventListener('click', () => batchCreateFlow($('create-name-input').value.trim()));
  $('create-back').addEventListener('click', () => { history.replaceState(null, '', '/'); renderLanding(); });
  $('create-back-2').addEventListener('click', () => renderCreate());
  // Enter submits every entry form (FLOW-13) — the keyboard's Go button on
  // mobile is the same event.
  const enterClicks = (inputId, btnId) => {
    $(inputId).addEventListener('keydown', (e) => { if (e.key === 'Enter') $(btnId).click(); });
  };
  enterClicks('create-name-input', 'create-go-btn');
  enterClicks('join-name-input', 'join-add-btn');
  enterClicks('badlink-input', 'badlink-open');
  const saved = appSettings();
  // prefers-reduced-motion rides the same path as Low power (quality floor):
  // the aura/favicon animations stop without the user hunting for a setting.
  applyLowPower(saved.lowPower || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  sync.setStayOffline(saved.stayOffline);
  // Poll every 25s normally; low power stretches to every 5 min (design 21h).
  let lowTick = 0;
  setInterval(async () => {
    if (ctx.lowPower && (lowTick = (lowTick + 1) % 12) !== 0) return;
    // Retry the one-shot migration until it lands (offline first-open case),
    // then unlock writes.
    if (ctx.migrationPending && navigator.onLine) {
      if (await sync.requestMigration()) {
        ctx.migrationPending = model.needsMigration(state.crewDoc);
        if (!ctx.migrationPending) repaintWall();
      }
    }
    sync.pollSync();
  }, 25000);
  document.addEventListener('visibilitychange', () => {
    // Respect low power: returning to the tab does not bypass the 5-min throttle.
    if (!document.hidden && !ctx.lowPower) sync.pollSync();
    // Going away is the dangerous direction: a pick made inside the 1.2s
    // debounce dies with a backgrounded tab. Beacon it out before we lose the
    // chance — this is the last code that is guaranteed to run.
    if (document.hidden) sync.flushOnHide();
  });
  // pagehide covers the cases visibilitychange does not: bfcache, tab close,
  // and iOS Safari, where it is often the only one that fires at all.
  window.addEventListener('pagehide', () => sync.flushOnHide());
  window.addEventListener('hashchange', () => { closeSheet(); boot(); });
  window.addEventListener('online', () => { sync.pushSync(); updateMigrationBanner(); });
  // The dot goes gray the moment the radio does — not five minutes later at
  // the next poll (PS-3).
  window.addEventListener('offline', () => { sync.setSyncStatus('offline'); updateMigrationBanner(); });
  // Escape is universal back: pops the top layer through history so the
  // browser's back button and the keyboard always agree (FLOW-2). The show
  // menu is not a history layer — it is a popover, so Escape takes it first
  // and nothing below it moves.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (openMenu) { closeShowMenu(); return; }
    if (!router.requestClose()) closeSheet();
  });
  // Last-resort net (FLOW-4): an early crash used to leave every screen
  // display:none. Only fires when nothing is rendered — a background sync
  // hiccup must never nuke a working wall.
  window.addEventListener('error', () => { if (!anyScreenVisible()) renderFatal(); });
  window.addEventListener('unhandledrejection', () => { if (!anyScreenVisible()) renderFatal(); });
  showBootLoader();
  boot();
}

init();
