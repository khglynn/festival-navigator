// Our plan on the phone: the peek on the dock's top edge that drags up into
// the whole day (2026-09-26 — Kevin's call #5; the spec is
// claude-plans/2026-09-26-unified-build/our-plan/SPEC-ui.md). People read it
// as "Our picks" (plan-rows.js PLAN_NAME); "plan" is the code's name for it.
//
// ONE element, `#plan`: [grabber] [head + the day's rows]. It is always laid
// out at its open height; the peek is a WINDOW onto it — the element pushed
// down so only the grabber and the tagged row (NOW, else NEXT) show above the
// dock, and the rows shifted up so that row sits under the grabber. Dragging
// moves one number, p (0 the peek, 1 open), through two transforms and the
// head's and the other rows' opacity. So the peek's row IS the plan's row —
// never a second rendering of the same facts (the zoom's law, 2026-08-30) —
// and nothing on the wall re-lays out while the plan moves.
//
// On a laptop (>=720) the same element is the corner card and the side panel:
// laid out at the panel's size (under the day rail, 400px, to the bottom) and
// shown through a clip — the card's box in the bottom-right corner, the rows
// shifted so the tagged row sits under the card's head line — and opening
// grows the clip out to the panel (SPEC-ui §6). The grabber is that head line
// there: `OUR PICKS · SAT · 9 PICKING` and an Open pill, which cross-fade into
// the panel's head in the wall's grammar and a Close pill. No drag on a
// laptop; a click anywhere on the card opens it. No backdrop: the wall stays
// usable beside the panel, and a zoom keeps left of it (foot.js sideLeft).
//
// The open plan ends on one action, its Share (2026-09-26): the day in words
// (plan-rows.js planText) with the link that opens on it, handed to the
// phone's share sheet, or copied where there is none. It sits under the rows,
// not in the head: the laptop's head is a button of its own (the grabber), and
// a button cannot hold one. So it is the same on both, in reach of a thumb,
// and out of the peek's window like the head.
//
// No history entry (the v93 Show menu's lesson). It closes by a drag down, a
// tap on the grabber, its ✕ and Escape (app.js); the open state is dropped on
// pagehide, boot, a crew switch and any other screen. Back does what it does
// from the wall: it leaves it.
import { GROW_MS, OUT_MS, REFRESH_MS, CASCADE_MS, STAGGER_MS, EASE_ARRIVE, EASE_LEAVE, EASE_SURFACE, canAnimate } from './motion.js';
import { planDays, planHead, planText, rowsKey, stopKey, PLAN_NAME } from './plan-rows.js';
import { measureFoot } from './foot.js';

const ID = 'plan';
const OPEN_AT = 1 / 3;       // released past a third of the way, it opens (and short of two thirds, an open plan closes)
const TAP_SLOP = 6;          // px a finger may wander and still be a tap
const FLING = 0.45;          // px/ms: a flick decides by its direction, whatever the distance
const BUSY = 'plan-drag';
const GAP = 20;              // the laptop card's distance from the window's right and bottom edges
const RADIUS = 16;           // its corners (the panel's are square)
// The card is 20px narrower than the panel, and its rows must not reflow as it
// grows: so the card's box is the panel's, centred — 10px off each side — and
// the panel is drawn 10px left of the edge, which puts the card 20px in from
// it. The padding (v3.css, 24px) leaves the card its 14px inside that box.
const SIDE = GAP / 2;
const isDesk = () => !!(window.matchMedia && window.matchMedia('(min-width: 720px)').matches);
const OPEN_WORDS = `Open ${PLAN_NAME.toLowerCase()}`;   // "Open our picks"
const CLOSE_WORDS = `Close ${PLAN_NAME.toLowerCase()}`;

let frame = null;    // the laptop's shadow and edge follow the clip from here (v3.css .plan-frame)
let el = null;       // #plan
let grab = null;     // the grabber (a button: the keyboard's way in and out)
let body = null;     // head + list, the part the window shifts
let headEl = null;
let listEl = null;
let footEl = null;   // the open plan's last line: its Share
let footOpens = null; // what the Share's link opens on, beside it
let shareBtn = null;  // the Share itself (it rests on a day with nothing to send)
let shareWords = null;
let shareSaid = null; // the live region: a copy's result, said once (sayOnShare)
let shareTimer = 0;
let corner = null;   // the laptop head line's parts: { line, k, c, head, open, close }
let ctxRef = null;
let data = null;     // the last paint's answer (see paintPlanShelf)
let sig = '';        // what that answer drew, to skip repaints that change nothing
let drawn = null;    // the answer the rows on screen were drawn from (draw): the Share's words
let forced = false;  // the Share's repaint: drawn whatever the signature says
let mode = 'gone';   // 'gone' | 'peek' | 'open'
let p = 0;           // 0 peek … 1 open, while a drag or a settle is in flight
let geo = null;      // { H, peekH, shift } measured after every draw
// Whose cards are grown under their rows: null = the default (the NOW row's
// alone), else the set of stop keys a person left grown (NOW's included until
// they fold it). A set, so a tap never folds a card above the row it grew: a
// row stays under the finger, and only the rows below make room
// (storyboard 8). It survives closing — the cards wait below the peek's
// window — and resets on another night or when the shelf leaves.
let grown = null;
const grownNow = () => {
  if (grown) return grown;
  const nowKey = data && data.peek.tag === 'now' && data.peek.stop ? stopKey(data.peek.stop) : null;
  return new Set(nowKey ? [nowKey] : []);
};
let earlierOpen = false;
let nightId = '';    // `${fid}|${route id}` of the day the rows are drawn for
let drag = null;
let leaving = null;  // { timer } while the shelf drops out of sight
let arrival = null;  // the arrival's animation, while it plays
let stint = 0;       // counts arrivals, leaves and drops: an afterArrival from an older one runs nothing
let quietUntil = 0;  // the click that follows a drag or a peek tap is not a second tap
let held = false;    // an answer that came in under a hand: drawn when it lets go
let watch = null;    // the boxes the window's numbers come from (watchBoxes)

export const planShelf = () => el;
// Open, and not on its way out. A plan with no row to close to (a highlight
// emptied it, or the morning after) leaves from open, and `mode` stays open
// until the leave ends; the app reads this to keep an open plan a highlight
// emptied (planAnswer's fallback), so it read "open" all through the leave
// and a tick or a friend's update brought the shelf back as a peek with no
// row (Sol's recheck on daf9c3b). Every caller agrees: a closing plan is not
// kept (planAnswer), offered or opened from a link (both ask planHere first),
// and Escape passes it by — the close it would ask for is under way.
export const planIsOpen = () => mode === 'open' && !leaving;
// Whether there is a plan on screen to open: the peek or the open plan, not
// one on its way out (the people menu's "Our picks" row asks, app.js).
export const planHere = () => !!el && (mode === 'peek' || mode === 'open') && !leaving;
// The night the plan on screen is drawn for (its route's date), or null.
export const planNight = () => (planHere() && data && data.route ? data.route.iso : null);
// Whether the plan is showing a NOW row where a person can see it — the
// dock's NOW tab steps aside for it (the one-NOW rule, app.js paintNowTabs).
export function planShowsNow() {
  return (mode === 'peek' || mode === 'open') && !leaving && !!data && !!data.peek
    && data.peek.tag === 'now' && !!el && el.getClientRects().length > 0;
}

function mk(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function spanOf(cls, text) {
  const e = mk('span', cls);
  if (text != null) e.textContent = text;
  return e;
}
export function glyph(path) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('width', '11'); s.setAttribute('height', '11'); s.setAttribute('viewBox', '0 0 12 12');
  s.setAttribute('aria-hidden', 'true');
  const d = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  d.setAttribute('d', path);
  d.setAttribute('fill', 'none'); d.setAttribute('stroke', 'currentColor'); d.setAttribute('stroke-width', '1.7');
  d.setAttribute('stroke-linecap', 'round'); d.setAttribute('stroke-linejoin', 'round');
  s.appendChild(d);
  return s;
}
const chevron = (up) => glyph(up ? 'M2.5 7.5 6 4l3.5 3.5' : 'M2.5 4.5 6 8l3.5-3.5');
// The system's share mark (an arrow out of a tray), and two sheets for a copy.
// The Show menu's crew-link row draws the same marks (app.js).
export const SHARE_MARK = 'M6 7.2V1.6M3.9 3.7 6 1.6l2.1 2.1M4.2 5.4H3.1v5.1h5.8V5.4H7.8';
export const COPY_MARK = 'M4.3 4.3h5.2v6.2H4.3zM7.7 4.3V2.5H2.5v6.2h1.8';
export const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';
// A share in progress — its sheet up, or its copy on the way — holds a new
// build's reload with a mark of its own on the body, data-sharing (index.html
// quiet() reads it; so does app.js pastMayMove, which keeps the wall and the
// plan still under the sheet). Its own because the page's busy mark has one
// owner, and whoever held that when the tap came can let go mid-sheet. One
// hold per share, so two at once keep the mark until both have answered; the
// mark names what is sharing ("plan", "crew", "plan crew"). The page going
// away lets go of every hold (app.js pagehide): a page kept in the
// back/forward cache with a share that never answered must not come back
// with every reload held. (Sol, on the Share's release head, 2026-09-26.)
const shares = new Map();
const markShares = () => {
  if (shares.size) document.body.dataset.sharing = [...shares.values()].join(' ');
  else delete document.body.dataset.sharing;
};
export function holdForShare(what) {
  const hold = {};
  shares.set(hold, what);
  markShares();
  return () => { if (shares.delete(hold)) markShares(); };
}
export function dropShares() { shares.clear(); markShares(); }

function build(host) {
  frame = mk('div', 'plan-frame');
  el = mk('section', 'plan-shelf');
  el.id = ID;
  el.hidden = true;
  el.setAttribute('aria-label', PLAN_NAME);
  grab = mk('button', 'plan-grab');
  grab.type = 'button';
  // The phone's grabber bar, and the laptop's head line (v3.css shows one).
  // The laptop's line is spans only — it lives in a button.
  const line = spanOf('pc-line');
  const k = spanOf('k', PLAN_NAME.toUpperCase());
  const c = spanOf('c');
  line.append(k, ' ', c);
  const head = spanOf('pc-head room-head');
  const pill = spanOf('pc-pill');
  const open = spanOf('pc-open');
  open.append('Open', chevron(true));
  const close = spanOf('pc-close');
  close.append('Close', chevron(false));
  pill.append(open, close);
  corner = { line, c, head, open, close };
  grab.append(spanOf('grabber'), line, head, pill);
  body = mk('div', 'plan-body');
  headEl = mk('div', 'plan-head');
  listEl = mk('div', 'plan-list');
  footEl = mk('div', 'plan-foot');
  footOpens = spanOf('opens');
  const share = mk('button', 'plan-share btn-tonal');
  shareBtn = share;
  share.type = 'button';
  // The words are the button's name (the day it sends, read when a person
  // reaches it), not a live region: paintHead writes them as the list scrolls
  // through the days, and a live region there was said again at every draw
  // (the P1–P3 review, 2026-09-27). A copy's result is said once, beside it.
  shareWords = spanOf('w', shareLabel());
  share.append(glyph(canShare() ? SHARE_MARK : COPY_MARK), shareWords);
  share.addEventListener('click', sharePlan);
  shareSaid = spanOf('sr-only');
  shareSaid.setAttribute('aria-live', 'polite');
  footEl.append(footOpens, share, shareSaid);
  body.append(headEl, listEl, footEl);
  el.append(grab, body);
  frame.appendChild(el);
  // Right after the day rail in the page's order, so a keyboard meets the
  // plan just after NOW and before the wall's hundred cards (at the end, the
  // laptop's corner card was 40+ Tabs away, 2026-09-26). Where it is drawn is
  // the z-index's business: fixed at z29, under the dock's z30, whatever the
  // order. (The frame is display:contents on a phone: #plan is the box there.)
  const rail = document.getElementById('day-rail');
  const dock = document.getElementById('dock');
  if (rail && host.contains(rail)) rail.after(frame);
  else if (dock && dock.parentElement === host) host.insertBefore(frame, dock);
  else host.appendChild(frame);
  // The grabber's click is the keyboard's (Enter, Space) and a script's. A
  // pointer's tap on it is handled where the pointer lifts (onUp): the drag
  // captures the pointer, and a captured mouse's click lands on the shelf
  // itself, never on the grabber (Chromium, 2026-09-26: a mouse could not
  // open or close the plan from its handle).
  grab.addEventListener('click', (e) => {
    e.preventDefault();
    if (quiet()) return; // the tap that onUp already took, or the end of a drag
    toggle();
  });
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('click', onClickPeek, true);
  if (typeof window.ResizeObserver === 'function') watch = new window.ResizeObserver(() => refitPlanShelf());
  // The panel's top follows the day rail's bottom, which moves while the rail
  // is still under the header (it pins at the top after that).
  window.addEventListener('scroll', onScroll, { passive: true });
}
let scrollQueued = false;
function onScroll() {
  if (scrollQueued || !geo || !geo.desk || mode === 'gone' || leaving) return;
  scrollQueued = true;
  window.requestAnimationFrame(() => {
    scrollQueued = false;
    if (!geo || !geo.desk || mode === 'gone' || leaving || Math.abs(railBottom() - geo.T) < 0.5) return;
    measure();
    apply(p);
  });
}
function railBottom() {
  const rail = document.getElementById('day-rail');
  if (!rail || !rail.getClientRects().length) return 0;
  return Math.max(0, Math.min(rail.getBoundingClientRect().bottom, window.innerHeight - 160));
}

// ---- drawing ------------------------------------------------------------------
// `answer` from app.js paintPlan, or null when there is no plan to show:
//   { plan, route, peek, nowMin, weekday, sub, dayWord, nightLabelOf, gen, who,
//     dayOf, emptyWords,          (each night's head and words, planDays)
//     fest, day, linkOf, opens,   (the Share's: planText, and what its link opens on)
//     repaint }                   (app.js paintPlan at this minute: the Share's first step)
export function paintPlanShelf(host, ctx, answer) {
  ctxRef = ctx;
  if (!answer || !answer.peek) { leave(); return; }
  if (!el) build(host);
  // A different night (tonight became tomorrow) or another festival: a card a
  // person grew, and the earlier fold, belonged to the day they were on.
  const night = `${ctx.fid}|${answer.route ? answer.route.id : ''}`;
  if (night !== nightId) { grown = null; earlierOpen = false; nightId = night; }
  const next = signature(answer);
  const arriving = mode === 'gone' || !!leaving;
  data = answer;
  // The link carries the rooms and the view this phone shows, and the foot
  // says so beside the button (the v92 rule: every place that hands out a
  // link says what it opens on). Not part of the rows' signature: a List
  // switch changes the words and nothing else.
  if (footOpens.textContent !== (answer.opens || '')) footOpens.textContent = answer.opens || '';
  if (!arriving && next === sig && !forced) return;
  // A hand on the window: a repaint would put the window back where the
  // last settle left it, out from under the finger, and the release would
  // then decide from there. The rows wait for the hand (flushHeld).
  if (drag && !arriving) { held = true; return; }
  sig = next;
  if (arriving) {
    cancelLeave();
    draw();
    arrive();
    return;
  }
  redraw();
}

// Everything the rows show, as one string: a minute that changes nothing
// (the usual tick) draws nothing. The route's part is plan-rows.js's own
// (rowsKey), from the rules planDays draws by.
function signature(a) {
  // Every night the open plan holds (the plan-days round): a friend's pick on
  // Sunday redraws the rows even while the peek is Saturday's. Each night's
  // part is plan-rows.js's own (rowsKey, the drop-in lines that lead it
  // included), read at this minute on the peek's night and whole on the others.
  const nightRows = (r, nowMin) => (r ? rowsKey(r, { plan: a.plan, peek: a.peek, nowMin }) : '');
  const rows = a.plan && a.plan.nights
    ? a.plan.nights.map((n) => `${n.id}=${nightRows(a.plan.night(n.id), a.route && n.id === a.route.id ? a.nowMin : null)}`).join(';')
    : nightRows(a.route, a.nowMin);
  return [a.gen, a.route && a.route.id, !!a.past, a.peek.tag, a.peek.stop ? stopKey(a.peek.stop) : '', a.peek.count, a.dayWord, rows, grown ? [...grown].sort().join(',') : '*', earlierOpen, (a.plan && a.plan.group || []).join(',')].join('|');
}

// The night the view is reading: the day of the first row whose bottom is
// below the list's top edge (the head and the Share both follow it). Before
// any scroll, and in the peek, it is the night the list lands on. Read in the
// list's own scroll space (offsets: the list is the rows' offsetParent), not
// from rects: a repaint's rows travel to their new places (play), and a rect
// read mid-motion names the night the motion shows, which stays in the head
// once the scroll has stopped (a tick landing mid-glide, 2026-09-26).
let topNight = '';
function nightAtTop() {
  if (!listEl || !data) return data && data.route ? data.route.id : '';
  const top = listEl.scrollTop + 2;
  for (const r of listEl.children) {
    if (!r.dataset.night) continue;
    if (r.offsetTop + r.offsetHeight > top) return r.classList.contains('earlier') && earlierOpen ? r.dataset.night : (r.classList.contains('earlier') ? data.route.id : r.dataset.night);
  }
  return data.route ? data.route.id : '';
}
// The head (and the laptop's panel head) and the Share's words for a night.
function paintHead(id) {
  const a = data;
  if (!a) return;
  // Scrolling into another day turns the head over like a page number: the
  // new day rises in from the side the list is moving toward (a scroll down
  // brings the later day up from below). Instant under Reduce Motion / Low
  // power (canAnimate), and never on the first paint.
  const turn = topNight && topNight !== id && mode === 'open' && canAnimate(el, ctxRef)
    ? (a.plan.nights.findIndex((n) => n.id === id) > a.plan.nights.findIndex((n) => n.id === topNight) ? 1 : -1) : 0;
  topNight = id;
  const d = (a.dayOf && a.dayOf(id)) || { weekday: a.weekday, sub: a.sub };
  headEl.textContent = '';
  const head = planHead({ weekday: d.weekday, sub: d.sub });
  const x = mk('button', 'sheet-close');
  x.type = 'button';
  x.textContent = '✕';
  x.setAttribute('aria-label', CLOSE_WORDS);
  x.addEventListener('click', () => closePlan());
  headEl.append(head, x);
  corner.head.textContent = '';
  for (const n of head.childNodes) corner.head.appendChild(n.cloneNode(true));
  // The turn plays on the head a person sees: the panel's head line on a
  // laptop (the phone's head is display:none there, and the corner's was
  // swapped in place — the P1–P3 review, 2026-09-27), the head on a phone.
  if (turn) {
    const rise = [{ transform: `translateY(${turn * 10}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }];
    const shown = isDesk() ? corner.head : head; // the media query v3.css shows one by
    for (const part of shown.querySelectorAll('.wd, .sub')) part.animate(rise, { duration: 200, easing: 'cubic-bezier(.2, .9, .3, 1.1)' });
  }
  const words = shareLabel(d);
  if (!shareTimer && shareWords.textContent !== words) shareWords.textContent = words;
  shareBtn.disabled = !!(d && d.bare);
  shareWords.dataset.night = id;
}
// The last day can scroll to the top like every other (the plan-days round):
// a short Sunday under a tall panel otherwise bottoms out with Saturday still
// at the top, and the head and the Share would never name it. The room it
// takes is the list's last box (`.plan-tail`, draw), sized on every draw,
// settle and refit (a font, a rotation) from where the rows end — the box's
// own top, so it is never in its own measure — and never by clearing and
// measuring again: a cleared room shrinks the scroll range under a reader
// parked on the last day, both engines clamp the scroll, and the head and
// the Share turned back to Saturday (the P1–P3 review's first finding,
// 2026-09-27). Offsets, not rects: the list is the rows' offsetParent (as
// nightAtTop reads it), and a row in motion keeps its offset.
//
// While the plan has a later day (`data-later`, draw), or while the rows
// alone overflow the list's box. A later day is the short-plan default
// (Kevin's to overrule; the plan-days build log, 2026-09-27): the phone's
// shelf is laid out at its cap and the list fills the window (v3.css) — the
// laptop's panel is full height anyway — so a plan that fits can still bring
// its later day to the top, where the head and the Share name it. Before it,
// a plan that fitted had nowhere to scroll, and its later day could never be
// shared from the plan. A plan whose last day is today stays content-sized
// and has no room: there it would only be a gap under its last row, growing
// the shelf, and a jump in the window's motion.
function fitTail() {
  const tail = listEl ? listEl.querySelector(':scope > .plan-tail') : null;
  if (!tail) return;
  const heads = listEl.querySelectorAll(':scope > .plan-day');
  const last = heads[heads.length - 1];
  const base = parseFloat(window.getComputedStyle(listEl).paddingBottom) || 0;
  const box = listEl.clientHeight;
  const end = tail.offsetTop;
  const reach = el.hasAttribute('data-later') || end + base > box + 0.5;
  const room = last && reach ? Math.max(0, Math.ceil(last.offsetTop + box - end - base)) : 0;
  if (tail.style.height !== `${room}px`) tail.style.height = `${room}px`;
}
// Whether the plan holds a day after the one it lands on (planDays draws
// every night from the landing night on).
function laterDay(a) {
  const ids = a && a.plan && a.plan.nights ? a.plan.nights.map((n) => n.id) : [];
  return Math.max(0, ids.indexOf(a && a.route ? a.route.id : null)) < ids.length - 1;
}
function onListScroll() {
  if (mode !== 'open' || !data) return;
  if (gliding) {
    const row = rowOfNight(gliding);
    if (!row || Math.abs(row.offsetTop - listEl.scrollTop) <= 1) gliding = null;
  }
  // A scroll the layout made (a width change reflowed the rows under the same
  // number, and the engine clamped or anchored it) is not the reader's: the
  // refit that follows puts the place back from the anchor taken before it.
  if (listEl.offsetWidth === placeW) takePlace();
  const id = nightAtTop();
  if (id && id !== topNight) paintHead(id);
}

// Where the reader is (Sol's first review of the plan-days build, 0f076a6,
// 2026-09-27): the row at the list's top — the one nightAtTop names — and how
// far into it the top edge sits, with the rows after it on the same night.
// A redraw used to keep the list's scrollTop, a number: a friend's pick that
// added a Saturday stop slid Sunday down under it, Saturday's rows came to
// the top, and the head and the Share turned to Saturday; a 720px crossing
// reflowed the rows under the same number in WebKit (Chromium's own scroll
// anchoring hid it there). Taken on every scroll the reader (or a glide)
// makes, and put back after every draw, settle and refit (keepPlace), before
// the head is painted. Null is the list's top: a new list starts there.
let place = null;
// The list's own box width the place was read at: a different one is a
// reflow. Its box, not its content (clientWidth): a scrollbar that takes room
// (Windows, a Mac with a mouse) arrives with the open list's scrolling and
// narrows the content 15px, and a place measured before it then read every
// later scroll as a reflow and never took one — the next repaint put the list
// back where it had last been read (the plan-days build log, 2026-09-27).
let placeW = -1;
const placeKey = (r) => (r.dataset.stop ? `${r.dataset.night || ''}#${r.dataset.stop}` : '');
function takePlace() {
  placeW = listEl ? listEl.offsetWidth : -1;
  place = null;
  if (!listEl || mode !== 'open' || listEl.scrollTop < 1) return;
  const top = listEl.scrollTop;
  const kids = [...listEl.children];
  const i = kids.findIndex((r) => r.dataset.night && r.offsetTop + r.offsetHeight > top + 2);
  if (i < 0) return;
  const night = kids[i].dataset.night;
  // The row's successors on its night, in order: a row that has gone (a stop
  // the minute folded into Earlier, a pick taken back) hands its place to the
  // next one still there, so what was under it stays where it was.
  const keys = [];
  for (let j = i; j < kids.length && kids[j].dataset.night === night; j++) keys.push(placeKey(kids[j]));
  place = { keys, night, delta: top - kids[i].offsetTop };
}
// Back to the place: the same row (its night and stop), else the next of its
// night's rows still there, else the night's head (a run of empty nights
// counts for each of them), else the nearest later night, else the end. A
// glide in progress keeps aiming at its night: on the list it is scrolling,
// only the aim is checked (glideOn); a new list (`fresh`, draw) starts from
// where the old one had got to and carries on from there.
function keepPlace({ fresh = false } = {}) {
  if (!listEl || mode !== 'open') return;
  if (gliding && !fresh) { glideOn(); return; }
  placeW = listEl.offsetWidth;
  restorePlace();
  if (gliding) glideOn();
}
function restorePlace() {
  if (!place) return;
  const kids = [...listEl.children];
  const byKey = new Map(kids.map((r) => [placeKey(r), r]));
  let row = null;
  let delta = 0;
  for (const [k, key] of place.keys.entries()) {
    const r = byKey.get(key);
    if (r) { row = r; delta = k === 0 ? place.delta : 0; break; }
  }
  const n = place.night;
  if (!row) row = kids.find((r) => r.classList.contains('plan-day') && (r.dataset.night === n || (r.dataset.nights || '').split(' ').includes(n)));
  if (!row && data && data.plan) {
    const ids = data.plan.nights.map((x) => x.id);
    const at = ids.indexOf(n);
    row = kids.find((r) => r.dataset.night && !r.classList.contains('earlier') && ids.indexOf(r.dataset.night) >= at)
      || kids.filter((r) => r.dataset.night).pop() || null;
  }
  if (!row) return;
  const want = row.offsetTop + delta;
  listEl.classList.add('scrolls');
  // Only a real move: rewriting the same number stops a momentum scroll (iOS).
  if (Math.abs(listEl.scrollTop - want) > 0.5) listEl.scrollTop = want;
}

function draw() {
  const a = data;
  drawn = a;
  const ctx = ctxRef;
  // The laptop's head line: the corner's words — the peek's night, always.
  corner.c.textContent = `· ${a.weekday} · ${a.who || `${a.plan.us.length} picking`}`.toUpperCase();
  // The NOW row's card is grown in the day plan until a person folds it (the
  // approved frame); a tapped row's too. Each sits under its row, so the
  // peek's window (the row alone) never includes one.
  const list = planDays(a.plan, {
    ctx, peek: a.peek, from: a.route ? a.route.id : null, nowMin: a.nowMin, landedPast: !!a.past, grown: grownNow(),
    earlierOpen, onEarlier: toggleEarlier, nightLabelOf: a.nightLabelOf, dayWord: a.dayWord,
    dayOf: (id) => (a.dayOf ? a.dayOf(id) : {}), emptyWords: a.emptyWords || (() => ''),
  });
  // A later day: the phone's shelf takes its full height (fitTail).
  el.toggleAttribute('data-later', laterDay(a));
  // The room under the last day (fitTail): the list's last box, empty.
  const tail = mk('div', 'plan-tail');
  tail.setAttribute('aria-hidden', 'true');
  list.append(tail);
  list.addEventListener('click', onRowTap);
  list.addEventListener('scroll', onListScroll, { passive: true });
  for (const t of ['wheel', 'touchstart', 'pointerdown', 'keydown']) list.addEventListener(t, () => { gliding = null; }, { passive: true });
  // A new list element starts at the top: an open list someone had scrolled
  // keeps its place across a tick, a pick or a tap. A row with the focus
  // hands it to the same stop's new row — a keyboard growing a card, or
  // resting on a row through the minute's repaint, keeps its place. A stop
  // the minute has folded into Earlier hands it to that line (else the NOW
  // row, else the grabber): a focus is never dropped on the page.
  // The place is read from the rows on screen unless a reflow has moved them
  // under the scroll since it was last read (a width change the refit has
  // not answered yet): then the place from before it stands.
  if (mode === 'open' && listEl.offsetWidth === placeW) takePlace();
  const f = document.activeElement;
  const focused = f && f !== listEl && listEl.contains(f) && f.dataset.stop ? f.dataset.stop : null;
  listEl.replaceWith(list);
  listEl = list;
  fitTail();
  keepPlace({ fresh: true });
  listEl.querySelectorAll('.plan-row[data-tag]').forEach((r) => r.classList.add('tagged'));
  if (focused) {
    const again = [...list.children].find((r) => r.dataset.stop === focused)
      || list.querySelector('.plan-row.earlier') || list.querySelector('.plan-row[data-tag]') || grab;
    again.focus({ preventScroll: true });
  }
  watchBoxes();
  paintHead(mode === 'open' ? nightAtTop() : (a.route ? a.route.id : ''));
  el.dataset.tag = a.peek.tag || 'none';
  grab.setAttribute('aria-label', mode === 'open' ? CLOSE_WORDS : OPEN_WORDS);
  grab.setAttribute('aria-expanded', mode === 'open' ? 'true' : 'false');
}

function taggedRow() {
  return listEl ? listEl.querySelector('.plan-row.tagged') : null;
}

// The window's numbers: the plan's open height, the peek's height (grabber +
// the tagged row), and how far the rows shift up so that row sits under the
// grabber. A NEXT row's faces sit just under the window, behind the dock —
// the peek is the name, the place and the time (the approved peek, which
// drew no faces) — and slide into view as it opens.
function measure() {
  const desk = isDesk();
  const T = desk ? railBottom() : 0;
  el.style.top = desk ? `${T}px` : '';
  // Boxes, not offsets: offsetHeight rounds, and a row 61.1px tall measured as
  // 61 left a sliver of it behind the dock. A translate moves a box and
  // never resizes it, and the body's shift moves the row and the body alike,
  // so these differences hold whatever the window's state.
  const row = taggedRow();
  const box = (n) => n.getBoundingClientRect();
  const eb = box(el);
  const H = eb.height;
  // To the grabber's bottom from the window's top edge: the shelf's hairline
  // border included, or the row's last pixel sat under the dock (2026-09-26).
  const grabH = box(grab).bottom - eb.top;
  const rb = row ? box(row) : null;
  const rowTop = rb ? rb.top - box(body).top : 0;
  const who = row ? row.querySelector('.plan-who') : null;
  const pad = row ? parseFloat(window.getComputedStyle(row).paddingBottom) || 0 : 0;
  const whoAt = who ? box(who).top - rb.top : 0;
  const rowH = !row ? 0 : who ? Math.min(whoAt - 1, whoAt - (parseFloat(window.getComputedStyle(who).marginTop) || 0) + pad) : rb.height;
  geo = { desk, T, H, peekH: Math.min(H, grabH + rowH), cardH: Math.min(H, grabH + rowH + 2), shift: rowTop };
  // The phone's floor reads the peek's height (foot.js); the laptop's card
  // is not a floor, and what it moves is the Spotify pill (v3.css).
  el.dataset.peekH = desk ? '0' : String(geo.peekH);
  const root = document.documentElement.style;
  if (desk) root.setProperty('--plan-corner-h', `${geo.cardH + GAP}px`); else root.removeProperty('--plan-corner-h');
}

// p → the window. Opacity rides the same number: the head and every row but
// the tagged one fade in as the window opens (they slide in from the edges).
function apply(q) {
  if (!geo) measure();
  p = Math.max(0, Math.min(1, q));
  const k = 1 - p;
  if (geo.desk) {
    el.style.transform = `translate(${-SIDE * k}px, ${(geo.H - geo.cardH - GAP) * k}px)`;
    el.style.clipPath = clipAt(p);
  } else {
    el.style.transform = `translateY(${(geo.H - geo.peekH) * k}px)`;
    el.style.clipPath = '';
  }
  body.style.transform = p === 1 ? 'none' : `translateY(${-geo.shift * k}px)`;
  const o = p === 1 ? '' : String(p);
  const back = p === 0 ? '' : String(k);
  headEl.style.opacity = o;
  footEl.style.opacity = o;
  for (const r of listEl.children) if (!r.classList.contains('tagged')) r.style.opacity = o;
  corner.line.style.opacity = back;
  corner.open.style.opacity = back;
  corner.head.style.opacity = p === 1 ? '1' : String(p);
  corner.close.style.opacity = p === 1 ? '1' : String(p);
  el.classList.toggle('opening', p > 0 && p < 1);
}
// Out of sight below the window's bottom edge, where it arrives from and leaves to.
const below = () => (geo && geo.desk ? `translate(${-SIDE}px, ${geo.H}px)` : `translateY(${geo.H}px)`);
// The laptop's window: the card's box in the corner at 0, the whole panel at 1.
const clipAt = (q) => `inset(0px ${SIDE * (1 - q)}px ${(geo.H - geo.cardH) * (1 - q)}px ${SIDE * (1 - q)}px round ${RADIUS * (1 - q)}px)`;

// `headLater`: a close that animates keeps the head (and the Share's words)
// on the day it is closing until its fade is done (settleTo).
function settleState({ headLater = false } = {}) {
  el.dataset.state = mode;
  frame.dataset.state = mode;
  if (geo && geo.desk && mode === 'open') el.dataset.side = 'open'; else delete el.dataset.side;
  el.classList.remove('opening');
  // Read before anything turns inert: Chromium moves a focus off an element
  // the moment it becomes inert, and the hand-off below would find the body.
  const f = document.activeElement;
  // What the peek hides is not there for a keyboard or a screen reader either.
  const peek = mode !== 'open';
  headEl.inert = peek;
  footEl.inert = peek;
  for (const r of listEl.children) {
    r.inert = peek && !r.classList.contains('tagged');
    // A row is a control in the open plan (Enter grows its card), and the
    // peek's row is not one: the grabber is the keyboard's way in. Open, it
    // is a plain button again — Safari Tabs to buttons only with Full
    // Keyboard Access on, like every other button in the app.
    if (r.tagName !== 'BUTTON') continue;
    if (peek) r.tabIndex = -1; else r.removeAttribute('tabindex');
    // Whether its card is out is the open plan's fact: the peek shows no
    // card, and its row opens the plan (a screen reader heard "expanded").
    if (r.classList.contains('earlier')) continue;
    const next = r.nextElementSibling;
    if (peek) r.removeAttribute('aria-expanded');
    else r.setAttribute('aria-expanded', next && next.classList.contains('plan-grow') ? 'true' : 'false');
  }
  listEl.classList.toggle('scrolls', !peek);
  fitTail();
  if (peek) { listEl.scrollTop = 0; place = null; } else keepPlace();
  // The head names the day at the top: today's in the peek (its row is
  // today's), else the day the list is reading.
  if (!headLater && data) {
    const id = peek ? (data.route ? data.route.id : '') : nightAtTop();
    if (id && id !== topNight) paintHead(id);
  }
  // A focused ✕ or row that the peek just hid hands its focus to the grabber.
  if (peek && f && f !== grab && el.contains(f)) grab.focus({ preventScroll: true });
  grab.setAttribute('aria-label', peek ? OPEN_WORDS : CLOSE_WORDS);
  grab.setAttribute('aria-expanded', peek ? 'false' : 'true');
  measureFoot();
}

// ---- arriving, leaving, repainting -----------------------------------------------
// Storyboard 1: the peek grows out of the dock's top edge.
function arrive() {
  stint += 1;
  el.hidden = false;
  mode = 'peek';
  unpin();
  measure();
  apply(0);
  settleState();
  if (canAnimate(el, ctxRef)) {
    const a = el.animate([{ transform: below() }, { transform: el.style.transform }],
      { duration: GROW_MS, easing: EASE_ARRIVE });
    arrival = a;
    a.onfinish = () => { if (arrival === a) arrival = null; };
  }
}

// Storyboard 10: it drops back behind the dock, quick and plain. A safety
// timer finishes the job if the animation never ends (a backgrounded tab).
function leave({ instant = false } = {}) {
  if (!el || mode === 'gone') return;
  stint += 1;
  endDrag();
  const done = () => {
    cancelLeave();
    const f = document.activeElement;
    if (f && el.contains(f)) f.blur();
    el.hidden = true; mode = 'gone'; sig = ''; data = null; drawn = null; grown = null; earlierOpen = false; nightId = ''; held = false;
    frame.dataset.state = 'gone'; delete el.dataset.side;
    document.documentElement.style.removeProperty('--plan-corner-h');
    measureFoot();
  };
  if (instant || !geo || !canAnimate(el, ctxRef)) { done(); return; }
  if (leaving) return;
  // Leaving while it is still arriving (the welcome card mounts in the same
  // task as the first paint): it goes back the way it came, from wherever it
  // has got to — and if no frame has shown it yet, that is nowhere, at once.
  const back = arrival && arrival.playState === 'running' ? arrival : null;
  if (back) {
    arrival = null;
    leaving = { timer: setTimeout(done, GROW_MS + 50) };
    back.onfinish = done;
    back.reverse();
    return;
  }
  const from = el.style.transform;
  el.style.transform = below();
  const a = el.animate([{ transform: from }, { transform: el.style.transform }], { duration: OUT_MS, easing: EASE_LEAVE });
  leaving = { timer: setTimeout(done, OUT_MS * 3 + 50) };
  a.onfinish = done;
}
function cancelLeave() {
  if (!leaving) return;
  clearTimeout(leaving.timer);
  leaving = null;
  arrival = null;
  if (el) el.getAnimations().forEach((x) => { x.onfinish = null; x.cancel(); });
}

// A new answer on a plan that is showing (a tick, a pick, a friend's pick):
// the rows are drawn again and every row that was on screen travels from
// where it was to where it is now — in the peek that reads as the day
// scrolling by in the window (storyboard 2); a row that is new fades in.
function redraw() {
  const before = snapshot();
  draw();
  measure();
  apply(mode === 'open' ? 1 : 0);
  settleState();
  play(before, { duration: REFRESH_MS, easing: EASE_SURFACE });
}

function snapshot() {
  const rows = new Map();
  if (listEl) {
    for (const r of listEl.children) {
      if (r.dataset.stop) rows.set(r.dataset.stop, r.getBoundingClientRect().top);
    }
  }
  return { rows, top: el ? el.getBoundingClientRect().top : 0, tagged: taggedRow() ? taggedRow().dataset.stop : null };
}

function play(before, { duration, easing }) {
  if (!canAnimate(el, ctxRef)) return;
  const top = el.getBoundingClientRect().top;
  if (Math.abs(before.top - top) > 0.5) {
    el.animate([{ transform: `translateY(${before.top - top}px) ${el.style.transform}` }, { transform: el.style.transform }], { duration, easing });
  }
  let arrivals = 0;
  for (const r of listEl.children) {
    if (r.classList.contains('plan-tail')) continue;
    const was = before.rows.get(r.dataset.stop);
    const now = r.getBoundingClientRect().top;
    const shown = r.style.opacity === '' ? 1 : Number(r.style.opacity);
    if (was == null) {
      if (shown > 0) r.animate([{ opacity: 0 }, { opacity: shown }], { duration: CASCADE_MS, delay: arrivals++ * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' });
      continue;
    }
    const dy = was - now - (before.top - top);
    // The row that WAS the peek's leaves the window as it scrolls by: seen
    // at the start, faded by the end.
    const from = mode !== 'open' && before.tagged === r.dataset.stop && !r.classList.contains('tagged') ? 1 : shown;
    if (Math.abs(dy) > 0.5 || from !== shown) {
      r.animate([{ transform: `translateY(${dy}px)`, opacity: from }, { transform: 'none', opacity: shown }], { duration, easing });
    }
  }
}

// ---- opening and closing --------------------------------------------------------
function toggle() { if (mode === 'open') closePlan(); else openPlan(); }
// `focus`: a keyboard opened it from somewhere else (the people menu's row),
// so its focus comes along to the grabber, as if Enter had been pressed there.
// `night`: a later night the plan opens on (a Share's link for it, app.js
// openPlanForLink — the plan-days build: a link opens on the day its words
// were about). See glideTo.
export function openPlan({ instant = false, focus = false, night = null } = {}) {
  if (!el || mode === 'gone' || leaving) return;
  settleTo(1, { instant });
  if (night) glideTo(night);
  if (focus) grab.focus({ preventScroll: true });
}
// The plan opens on today, as it always does — the peek's row is where the
// window grows from — and once it has landed, the list glides down to the
// night the link was about, the head turning over as that night reaches the
// top: every piece travels to where it is going, nothing jumps. Scrolled
// before the open, the peek's own row would have left the window in place.
// Instant under Reduce Motion or Low power. A hand on the window, a scroll of
// the person's own, or a plan closed meanwhile keeps things where they are;
// a repaint on the way (the minute's tick, a friend's pick) carries on to the
// night from wherever the list had got to (`gliding`, draw).
let glide = 0;
let gliding = null;
let aim = null; // the glide's last ask: { list, top } — asked again only when the night has moved
function glideTo(id) {
  const mine = ++glide;
  gliding = null;
  const from = listEl ? listEl.scrollTop : 0;
  const go = () => {
    if (mine !== glide || mode !== 'open' || drag || leaving || !listEl || Math.abs(listEl.scrollTop - from) > 1) return;
    gliding = id;
    aim = null;
    glideOn();
  };
  const moving = motions().filter((a) => a.playState === 'running'
    && !(a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().endTime === Infinity));
  if (!moving.length) { go(); return; }
  Promise.all(moving.map((a) => a.finished.catch(() => {}))).then(go);
}
const rowOfNight = (id) => [...listEl.children].find((r) => r.dataset.night === id || (r.dataset.nights || '').split(' ').includes(id));
function glideOn() {
  const row = gliding && mode === 'open' && !drag && !leaving && listEl ? rowOfNight(gliding) : null;
  if (!row) { gliding = null; aim = null; return; }
  fitTail();
  const top = row.offsetTop; // where the night's head sits in the list's scroll space (nightAtTop)
  // A settle or a refit on the way asks again only if the night has moved: a
  // smooth scroll asked twice starts its curve again, a hitch mid-glide.
  if (aim && aim.list === listEl && Math.abs(aim.top - top) < 1) return;
  aim = { list: listEl, top };
  if (canAnimate(el, ctxRef) && typeof listEl.scrollTo === 'function') { listEl.scrollTo({ top, behavior: 'smooth' }); return; }
  gliding = null;
  aim = null;
  listEl.scrollTop = top;
  onListScroll();
}
// `fn` once the peek has landed: now when nothing is arriving, else when the
// arrival ends. An open during the arrival cancels it, and the peek appears
// in its place for a frame before it grows, so the Share's link opens after
// the rise (two beats). An arrival that never lands (a hand caught it, the
// plan left) runs nothing: the person took over, or there is nothing to open.
// Nor does one the page moved on from while it rose — the wall left for
// another screen (dropPlan), the plan gone, or a new arrival since (`stint`):
// the rise that ends is not the one `fn` was waiting for (Sol, on the
// Share's release head, 2026-09-26). The caller checks its own identity too.
export function afterArrival(fn) {
  const a = arrival;
  if (!a) { fn(); return; }
  const mine = stint;
  a.finished.then(() => { if (el && stint === mine && mode === 'peek' && !leaving) fn(); }, () => {});
}
export function closePlan({ instant = false } = {}) {
  if (!el || mode !== 'open') return;
  settleTo(0, { instant });
}
// Gone with the page: pagehide, boot, a crew switch, another screen.
export function dropPlan() {
  if (!el) return;
  stint += 1;
  endDrag();
  flushHeld();
  if (mode === 'open') settleTo(0, { instant: true });
}
export function hidePlanShelf({ instant = false } = {}) { leave({ instant }); }

// Storyboards 5, 6 and 9: from wherever the window is (a drag lets go
// anywhere) to open or to the peek. The inline styles are set to the end
// state at once and the animation plays from where it was — so an animation
// that never finishes still leaves the right state behind.
function settleTo(target, { instant = false } = {}) {
  // An open plan a highlight emptied has no row to close to (the plan-days
  // round): closing it takes the shelf away, as a paint with no peek would.
  if (target === 0 && data && !data.peek.stop) { leave({ instant }); return; }
  const seen = seenTop();
  if (target === 1 && mode !== 'open') unpin();
  // Closing from further down the list (a later day at the top): the peek's
  // row is today's, at the list's top, so the list goes back there before
  // the window is measured — measured scrolled, the rows' shift came out
  // short by the scroll and the peek showed the wrong rows. What was on
  // screen stays where it was while it fades (`lift`, below), and the peek's
  // row comes down to its place from where it was, or fades in there if it
  // was out of sight.
  const lift = target === 0 && listEl ? listEl.scrollTop : 0;
  const peekRow = lift ? taggedRow() : null;
  const seenRow = !!peekRow && (() => {
    const lb = listEl.getBoundingClientRect();
    const rb = peekRow.getBoundingClientRect();
    return rb.bottom > lb.top && rb.top < lb.bottom;
  })();
  if (lift) listEl.scrollTop = 0;
  measure(); // the laptop's panel top follows the rail; the phone's numbers may have moved with a font
  apply(caughtAt(seen, p));
  const from = { el: el.style.transform, clip: el.style.clipPath, body: body.style.transform, p };
  mode = target === 1 ? 'open' : 'peek';
  apply(target);
  const moves = !instant && canAnimate(el, ctxRef) && from.p !== target;
  // The close's fade shows the day being closed — its head and its Share's
  // words included — and today's head is painted once they are out of sight
  // (the P1–P3 review, 2026-09-27: the first frame of the close swapped to
  // today).
  settleState({ headLater: moves && target === 0 });
  if (!moves) return;
  const timing = target === 1 ? { duration: GROW_MS, easing: EASE_ARRIVE } : { duration: OUT_MS, easing: EASE_LEAVE };
  el.animate(geo.desk
    ? [{ transform: from.el, clipPath: from.clip }, { transform: el.style.transform, clipPath: el.style.clipPath }]
    : [{ transform: from.el }, { transform: el.style.transform }], timing);
  body.animate([{ transform: from.body }, { transform: body.style.transform || 'none' }], timing);
  const fade = [{ opacity: from.p }, { opacity: target }];
  const unfade = [{ opacity: 1 - from.p }, { opacity: 1 - target }];
  const headFade = headEl.animate(fade, timing);
  footEl.animate(fade, timing);
  const held = lift ? `translateY(${-lift}px)` : null;
  for (const r of listEl.children) {
    if (r.classList.contains('plan-tail')) continue;
    if (!r.classList.contains('tagged')) r.animate(held ? [{ opacity: from.p, transform: held }, { opacity: target, transform: held }] : fade, timing);
    else if (held) r.animate(seenRow ? [{ transform: held }, { transform: 'none' }] : [{ opacity: 0 }, { opacity: 1 }], timing);
  }
  if (geo.desk) {
    corner.head.animate(fade, timing);
    corner.close.animate(fade, timing);
    corner.line.animate(unfade, timing);
    corner.open.animate(unfade, timing);
  }
  if (target === 0) {
    // Ended or caught by a hand: the peek's head is today's either way (a
    // plan opened again meanwhile names the day at its top itself).
    const today = () => { if (mode === 'peek' && data && data.route && topNight !== data.route.id) paintHead(data.route.id); };
    headFade.finished.then(today, today);
  }
}

// ---- the drag (storyboard 4) --------------------------------------------------------
// A finger (or a mouse) on the peek anywhere, or on the open plan's grabber
// and head — one handle, for a tap as for a drag: the grabber bar alone is
// 13px tall, and the head opens nothing of its own — and the window follows it with inline transforms — direct
// manipulation, which Reduce Motion and Low Power keep (only the settle after
// it is instant there). The page is marked busy while a finger is down, so a
// new build never reloads under the hand (the Show menu's rule: take the slot
// only if it is free, give it back only if it is ours).
function onDown(e) {
  if (mode === 'gone' || leaving || e.button > 0 || drag) return;
  gliding = null;
  if (geo && geo.desk) return; // a laptop's card is a button: its click opens it (onClickPeek)
  const inList = listEl.contains(e.target);
  if (mode === 'open' && inList) return; // the open list scrolls; the grabber and the head drag
  if (e.target.closest('.sheet-close') || footEl.contains(e.target)) return; // controls, not handles
  const seen = seenTop();
  if (mode !== 'open') unpin();
  measure();
  apply(caughtAt(seen, mode === 'open' ? 1 : 0));
  const onGrab = grab.contains(e.target) || (mode === 'open' && headEl.contains(e.target));
  drag = { id: e.pointerId, y0: e.clientY, p0: p, wasOpen: mode === 'open', moved: false, onGrab, last: [{ y: e.clientY, t: e.timeStamp }] };
  try { el.setPointerCapture(e.pointerId); } catch { /* an old engine: the move still arrives while the finger is on the shelf */ }
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  el.addEventListener('lostpointercapture', onCancel);
  if (!document.body.dataset.busy) document.body.dataset.busy = BUSY;
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const dy = drag.y0 - e.clientY;
  if (!drag.moved && Math.abs(dy) < TAP_SLOP) return;
  if (!drag.moved) {
    drag.moved = true;
    motions().forEach((a) => a.cancel());
  }
  const range = Math.max(1, geo.H - geo.peekH);
  apply(drag.p0 + dy / range);
  drag.last.push({ y: e.clientY, t: e.timeStamp });
  if (drag.last.length > 5) drag.last.shift();
  e.preventDefault();
}
function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  endDrag();
  flushHeld();
  if (!d.moved) {
    // A tap: on the handle it opens or closes; anywhere else on the peek it
    // opens. Either way the click that follows, wherever it lands, is
    // swallowed.
    if (d.onGrab) { quietUntil = performance.now() + 400; toggle(); } else if (mode !== 'open') { quietUntil = performance.now() + 400; openPlan(); }
    return;
  }
  quietUntil = performance.now() + 400;
  const a = d.last[0];
  const b = d.last[d.last.length - 1];
  // A hand that stopped before it let go is not flicking, however fast it
  // got there: the flick is the speed at the moment of release.
  const still = e.timeStamp - b.t > 80;
  const v = !still && b.t > a.t ? (a.y - b.y) / (b.t - a.t) : 0; // up is positive
  const open = Math.abs(v) > FLING ? v > 0 : (d.wasOpen ? p > 1 - OPEN_AT : p > OPEN_AT);
  settleTo(open ? 1 : 0);
}
function onCancel(e) {
  if (!drag || (e && e.pointerId != null && e.pointerId !== drag.id)) return;
  const back = drag.wasOpen ? 1 : 0; // p0 may be a window caught mid-settle: back to where it was going
  endDrag();
  flushHeld();
  settleTo(back); // a drag the browser took away goes back where it started
}
function endDrag() {
  if (!el) return;
  el.removeEventListener('pointermove', onMove);
  el.removeEventListener('pointerup', onUp);
  el.removeEventListener('pointercancel', onCancel);
  el.removeEventListener('lostpointercapture', onCancel);
  if (document.body.dataset.busy === BUSY) delete document.body.dataset.busy;
  drag = null;
}
// The minute tick sweeps a busy flag with no finger behind it (app.js).
export const planDragging = () => !!drag;
const quiet = () => performance.now() < quietUntil;
// The answer that waited for the hand: drawn now, with no motion of its own
// — the settle that follows moves the window, and its rows with it.
function flushHeld() {
  if (!held) return;
  held = false;
  if (!data || mode === 'gone') return;
  sig = signature(data);
  draw();
  measure();
}
// A settle still playing when a hand or a key takes the window: the window is
// caught where it stands on screen, its motion stopped, and whatever comes
// next starts from there — a drag under the finger, or the next settle.
// Nothing jumps. The inline styles hold the settle's END, so reading them
// (the old way) put a regrabbed window at its target and then under the
// finger, a pop. A loaded phone starts a settle late, and CI's Linux WebKit
// held a 130ms settle-back on its first frame for over half a second (runs
// 36266741642 and 36266745098, 2026-09-26).
// seenTop: where the window's top edge is on screen while a motion of its
// own is showing (a paused one too), or null when none is — read before
// anything resizes the window: a tap's pinned height let go moves a
// bottom-anchored window's top by the difference.
function seenTop() {
  if (!el || typeof el.getAnimations !== 'function') return null;
  const showing = (a) => !cssDriven(a) && (a.pending || a.playState === 'running' || a.playState === 'paused');
  return el.getAnimations().some(showing) ? el.getBoundingClientRect().top : null;
}
// caughtAt: the p that puts the top edge back at `top` on the window's
// numbers as they are now (after measure). The motion is stopped, the window
// placed at `rest` and read, and p moves by the difference over its reach —
// the phone's H − peekH, the laptop's drop from the panel to the corner card.
// `rest`: where the window is when nothing was playing.
function caughtAt(top, rest) {
  if (top == null) return rest;
  motions().forEach((a) => a.cancel());
  apply(rest);
  const reach = geo.desk ? geo.H - geo.cardH - GAP : geo.H - geo.peekH;
  if (!(reach > 0)) return rest;
  return Math.max(0, Math.min(1, rest - (top - el.getBoundingClientRect().top) / reach));
}

// The window's own motion (Web Animations) — not what CSS drives: the nodes'
// endless aura drift, and the laptop card's 2px hover lift (a transition,
// v3.css). Cancelling that lift snapped it to its end mid-catch, and the
// panel grew from 2px off where it was.
const cssDriven = (a) => (typeof window.CSSAnimation === 'function' && a instanceof window.CSSAnimation)
  || (typeof window.CSSTransition === 'function' && a instanceof window.CSSTransition);
function motions() {
  if (!el || typeof el.getAnimations !== 'function') return [];
  return el.getAnimations({ subtree: true }).filter((a) => !cssDriven(a));
}

// ---- the Share ---------------------------------------------------------------------
// The day the rows show, as words, to the share sheet — and only there:
// nothing else leaves the phone. A dismissed sheet is a choice; a sheet that
// fails, or a browser with none, copies instead and says so on the button.
// One source (Sol, round three on the Share's release head, 2026-09-26): the
// tap first paints the plan at this minute through the app's own paint (the
// peek, its rows and the dock's NOW tab, on one date), drawn even when the
// signature says nothing changed, and the words come from the answer those
// rows were drawn from. Three rounds had found the words and the rows
// disagreeing — the words worked out at the tap's minute, the rows at the
// last paint's — and rules shared between two workings never hold across a
// clock both read.
async function sharePlan() {
  if (mode !== 'open' || !data) return;
  if (data.repaint) {
    forced = true;
    try { data.repaint(); } finally { forced = false; }
  }
  // Only rows this tap drew. A paint that came in under a hand on the window
  // waits for the hand (paintPlanShelf), so a Share tapped by a second finger
  // while the first holds the grabber would read rows on an older minute:
  // nothing is sent, and the tap after the hand lets go shares (Sol, round
  // four, 2026-09-26). Nor when this minute took the plan away.
  const a = drawn;
  if (mode !== 'open' || leaving || held || !a || a !== data) return;
  // The day at the top of the view, and the button said so (the plan-days
  // round): the peek's night reads from now; any other night reads whole.
  const id = topNight || (a.route && a.route.id);
  const landed = !!a.route && id === a.route.id;
  const route = landed ? a.route : a.plan.night(id);
  const text = planText(route, {
    ctx: ctxRef, plan: a.plan, peek: landed ? a.peek : null, nowMin: landed ? a.nowMin : null,
    fest: a.fest || '', day: a.nightLabelOf ? a.nightLabelOf(id) : (a.day || ''), today: landed && !!a.peek.today, link: a.linkOf ? a.linkOf(id) : '',
  });
  // A new build waits while the sheet is up or the copy is on its way: a
  // reload would take the plan, and the words, from under either.
  const letGo = holdForShare('plan');
  try {
    if (canShare()) {
      try { await navigator.share({ title: PLAN_NAME, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); sayOnShare('Copied ✓'); } catch { sayOnShare('Couldn’t copy'); }
  } finally {
    letGo();
  }
}
// "Share today's picks" · "Share Sunday's picks" · "Share Sat Oct 10's picks"
// (the plan-days round: the button names the day it sends, the day at the top
// of the view). `d.share` is the day's word from app.js dayOf.
const shareLabel = (d = null) => (d && d.bare ? `Nothing to share ${d.name}`
  : `${canShare() ? 'Share' : 'Copy'} ${d && d.share ? `${d.share} picks` : PLAN_NAME.toLowerCase()}`);
function sayOnShare(words) {
  clearTimeout(shareTimer);
  shareWords.textContent = words;
  shareSaid.textContent = words;
  shareTimer = setTimeout(() => {
    shareTimer = 0;
    shareWords.textContent = shareLabel(data && data.dayOf ? data.dayOf(topNight) : null);
    shareSaid.textContent = ''; // so the next copy is said again
  }, 1800);
}

// Nothing under the peek's window is a control of its own: a tap there opens
// the plan (onUp), and its click — and any click just after a drag — never
// reaches a row or a grown card's links.
function onClickPeek(e) {
  if (grab.contains(e.target) && !quiet()) return;
  if (mode !== 'open' || quiet()) {
    e.stopPropagation(); e.preventDefault();
    // A click with no hand of ours behind it opens it: the laptop's card is
    // one button, and a screen reader's activation arrives as a bare click.
    // (A finger's tap was taken where it lifted; its click is quiet.)
    if (mode === 'peek' && !leaving && !quiet()) openPlan();
  }
}

// ---- inside the open plan ----------------------------------------------------------
// A row tap grows that stop's card under it, and the rows below make room;
// the same tap folds it again. Another row's grown card stays as it is. (The
// NOW row's card is grown by itself.)
function onRowTap(e) {
  if (mode !== 'open') return;
  const row = e.target.closest('.plan-row');
  if (!row || row.tagName !== 'BUTTON' || row.classList.contains('earlier')) return;
  if (e.target.closest('.plan-grow')) return;
  const key = row.dataset.stop;
  const next = new Set(grownNow());
  if (next.has(key)) next.delete(key); else next.add(key);
  grown = next;
  relayout(key, next.has(key));
}
function toggleEarlier() {
  if (mode !== 'open') return;
  earlierOpen = !earlierOpen;
  relayout(null, false);
}
// A tap inside the open plan changes what is under one row (its card, or
// the earlier stops under the Earlier line). That row stays where the finger
// is: the window keeps its height and the rows below make room, scrolling
// out of sight at the bottom (storyboard 8). Only a grown card that would be
// cut off by the bottom edge moves things — the window grows toward its cap,
// then the list scrolls, by just enough to show the whole card. (Growing the
// window with its content, as it did first, slid the tapped row up by a
// card's height under the finger.)
function relayout(key, reveal) {
  const before = snapshot();
  if (!geo.desk) pin(el.getBoundingClientRect().height); // the laptop's panel is full height already
  sig = signature(data);
  draw();
  measure();
  apply(1);
  settleState();
  if (reveal) showGrown(key);
  play(before, { duration: GROW_MS, easing: EASE_ARRIVE });
}
function showGrown(key) {
  const card = [...listEl.children].find((n) => n.dataset.stop === `grow|${key}`);
  const row = card && card.previousElementSibling;
  if (!row) return;
  const floor = () => listEl.getBoundingClientRect().bottom - (parseFloat(window.getComputedStyle(listEl).paddingBottom) || 0);
  let over = card.getBoundingClientRect().bottom - floor();
  if (over <= 0.5) return;
  if (!geo.desk) {
    const cap = parseFloat(window.getComputedStyle(el).maxHeight) || Infinity;
    const grow = Math.max(0, Math.min(over, cap - geo.H));
    if (grow > 0.5) {
      pin(geo.H + grow);
      measure();
      apply(1);
      over = card.getBoundingClientRect().bottom - floor();
    }
  }
  if (over > 0.5) {
    // Never past the row itself: a card taller than the window starts under its row.
    const room = row.getBoundingClientRect().top - listEl.getBoundingClientRect().top;
    listEl.scrollTop += Math.max(0, Math.min(over, room));
  }
}
// The height a tap pinned lasts while the plan is open; a plan that opens
// again (from the peek, where no one can see the window's height) opens to
// its rows.
// A box's height, border included (the shelf's top hairline would otherwise
// add a pixel at every pin).
function pin(h) {
  el.style.boxSizing = 'border-box';
  el.style.height = `${h}px`;
}
function unpin() {
  if (el && el.style.height) { el.style.height = ''; el.style.boxSizing = ''; }
}

// A rotation, a resize or a late font changes the window's numbers: measure
// again and put the window back where it was (no motion — nothing moved but
// the ruler). Rows in motion move without resizing, and a ruler read
// mid-motion reads the motion: a refit waits for the window to be still. A
// tap's pinned height is the phone's: a window that has become the laptop's
// panel reaches the bottom again, and its state follows the layout (the
// panel bounds the zoom only while it is one).
let refitQueued = false;
export function refitPlanShelf() {
  if (!el || mode === 'gone' || leaving || drag || refitQueued) return;
  const moving = motions().filter((a) => a.playState === 'running'
    && !(a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().endTime === Infinity));
  if (moving.length) {
    refitQueued = true;
    Promise.all(moving.map((a) => a.finished.catch(() => {}))).then(() => { refitQueued = false; refitPlanShelf(); });
    return;
  }
  if (mode !== 'open' || isDesk()) unpin();
  measure();
  apply(mode === 'open' ? 1 : 0);
  settleState();
}

// The window's numbers come from its boxes, so whatever resizes one refits
// it: a late font (WebKit's `loadingdone` came before the font's layout did,
// and the peek sat 27px above the dock, 2026-09-26), a name that wraps, the
// laptop's layout. Everything above the tagged row counts — its place in the
// body is the rows' shift.
function watchBoxes() {
  if (!watch) return;
  watch.disconnect();
  for (const n of [el, grab, headEl]) watch.observe(n);
  for (const r of listEl.children) {
    watch.observe(r);
    if (r.classList.contains('tagged')) break;
  }
}

