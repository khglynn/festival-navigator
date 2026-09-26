// Our plan on the phone: the peek on the dock's top edge that drags up into
// the whole day (2026-09-26 — Kevin's call #5; the spec is
// claude-plans/2026-09-26-unified-build/our-plan/SPEC-ui.md).
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
// there: `OUR PLAN · SAT · 9 OF US` and an Open pill, which cross-fade into
// the panel's head in the wall's grammar and a Close pill. No drag on a
// laptop; a click anywhere on the card opens it. No backdrop: the wall stays
// usable beside the panel, and a zoom keeps left of it (foot.js sideLeft).
//
// No history entry (the v93 Show menu's lesson). It closes by a drag down, a
// tap on the grabber, its ✕ and Escape (app.js); the open state is dropped on
// pagehide, boot, a crew switch and any other screen. Back does what it does
// from the wall: it leaves it.
import { GROW_MS, OUT_MS, REFRESH_MS, CASCADE_MS, STAGGER_MS, EASE_ARRIVE, EASE_LEAVE, EASE_SURFACE, canAnimate } from './motion.js';
import { planList, planHead, stopKey, PLAN_NAME } from './plan-rows.js';
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

let frame = null;    // the laptop's shadow and edge follow the clip from here (v3.css .plan-frame)
let el = null;       // #plan
let grab = null;     // the grabber (a button: the keyboard's way in and out)
let body = null;     // head + list, the part the window shifts
let headEl = null;
let listEl = null;
let corner = null;   // the laptop head line's parts: { line, k, c, head, open, close }
let ctxRef = null;
let data = null;     // the last paint's answer (see paintPlanShelf)
let sig = '';        // what that answer drew, to skip repaints that change nothing
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
  const nowKey = data && data.peek.tag === 'now' ? stopKey(data.peek.stop) : null;
  return new Set(nowKey ? [nowKey] : []);
};
let earlierOpen = false;
let nightId = '';    // `${fid}|${route id}` of the day the rows are drawn for
let drag = null;
let leaving = null;  // { timer } while the shelf drops out of sight
let arrival = null;  // the arrival's animation, while it plays
let quietUntil = 0;  // the click that follows a drag or a peek tap is not a second tap
let held = false;    // an answer that came in under a hand: drawn when it lets go
let watch = null;    // the boxes the window's numbers come from (watchBoxes)

export const planShelf = () => el;
export const planIsOpen = () => mode === 'open';
// Whether there is a plan on screen to open: the peek or the open plan, not
// one on its way out (the people menu's "Our plan" row asks, app.js).
export const planHere = () => !!el && (mode === 'peek' || mode === 'open') && !leaving;
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
function chevron(up) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('width', '11'); s.setAttribute('height', '11'); s.setAttribute('viewBox', '0 0 12 12');
  s.setAttribute('aria-hidden', 'true');
  const d = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  d.setAttribute('d', up ? 'M2.5 7.5 6 4l3.5 3.5' : 'M2.5 4.5 6 8l3.5-3.5');
  d.setAttribute('fill', 'none'); d.setAttribute('stroke', 'currentColor'); d.setAttribute('stroke-width', '1.7');
  d.setAttribute('stroke-linecap', 'round'); d.setAttribute('stroke-linejoin', 'round');
  s.appendChild(d);
  return s;
}

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
  body.append(headEl, listEl);
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
//   { plan, route, peek, nowMin, weekday, sub, dayWord, nightLabelOf, gen, highlight }
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
  if (!arriving && next === sig) return;
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
// (the usual tick) draws nothing.
function signature(a) {
  const rows = a.route ? a.route.items.map((i) => `${i.kind}:${i.from}-${i.to}:${i.count || ''}:${i.tier || ''}`).join(',') : '';
  const over = a.nowMin == null || !a.route ? '' : a.route.items.filter((i) => i.to <= a.nowMin).length;
  return [a.gen, a.route && a.route.id, a.peek.tag, stopKey(a.peek.stop), a.peek.count, a.dayWord, over, rows, grown ? [...grown].sort().join(',') : '*', earlierOpen, (a.highlight || []).join(',')].join('|');
}

function draw() {
  const a = data;
  const ctx = ctxRef;
  headEl.textContent = '';
  const head = planHead({ weekday: a.weekday, sub: a.sub });
  const x = mk('button', 'sheet-close');
  x.type = 'button';
  x.textContent = '✕';
  x.setAttribute('aria-label', 'Close the plan');
  x.addEventListener('click', () => closePlan());
  headEl.append(head, x);
  // The laptop's head line: the corner's words, and the panel's head (the
  // same room-head the phone's open plan shows), cross-faded by the window.
  corner.c.textContent = `· ${a.weekday} · ${a.plan.us.length} of us`.toUpperCase();
  corner.head.textContent = '';
  for (const n of head.childNodes) corner.head.appendChild(n.cloneNode(true));
  // The NOW row's card is grown in the day plan until a person folds it (the
  // approved frame); a tapped row's too. Each sits under its row, so the
  // peek's window (the row alone) never includes one.
  const list = planList(a.route, {
    ctx, plan: a.plan, peek: a.peek, nowMin: a.nowMin, grown: grownNow(),
    earlierOpen, onEarlier: toggleEarlier, nightLabelOf: a.nightLabelOf, dayWord: a.dayWord, highlight: a.highlight || [],
  });
  list.addEventListener('click', onRowTap);
  // A new list element starts at the top: an open list someone had scrolled
  // keeps its place across a tick, a pick or a tap. A row with the focus
  // hands it to the same stop's new row — a keyboard growing a card, or
  // resting on a row through the minute's repaint, keeps its place. A stop
  // the minute has folded into Earlier hands it to that line (else the NOW
  // row, else the grabber): a focus is never dropped on the page.
  const keep = mode === 'open' ? listEl.scrollTop : 0;
  const f = document.activeElement;
  const focused = f && f !== listEl && listEl.contains(f) && f.dataset.stop ? f.dataset.stop : null;
  listEl.replaceWith(list);
  listEl = list;
  if (keep) { list.classList.add('scrolls'); list.scrollTop = keep; }
  listEl.querySelectorAll('.plan-row[data-tag]').forEach((r) => r.classList.add('tagged'));
  if (focused) {
    const again = [...list.children].find((r) => r.dataset.stop === focused)
      || list.querySelector('.plan-row.earlier') || list.querySelector('.plan-row[data-tag]') || grab;
    again.focus({ preventScroll: true });
  }
  watchBoxes();
  el.dataset.tag = a.peek.tag;
  grab.setAttribute('aria-label', mode === 'open' ? 'Close the plan' : `Open the day's plan`);
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

function settleState() {
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
  if (peek) listEl.scrollTop = 0;
  // A focused ✕ or row that the peek just hid hands its focus to the grabber.
  if (peek && f && f !== grab && el.contains(f)) grab.focus({ preventScroll: true });
  grab.setAttribute('aria-label', peek ? `Open the day's plan` : 'Close the plan');
  grab.setAttribute('aria-expanded', peek ? 'false' : 'true');
  measureFoot();
}

// ---- arriving, leaving, repainting -----------------------------------------------
// Storyboard 1: the peek grows out of the dock's top edge.
function arrive() {
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
  endDrag();
  const done = () => {
    cancelLeave();
    const f = document.activeElement;
    if (f && el.contains(f)) f.blur();
    el.hidden = true; mode = 'gone'; sig = ''; data = null; grown = null; earlierOpen = false; nightId = ''; held = false;
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
  const dims = new Set();
  if (listEl) {
    for (const r of listEl.children) {
      if (!r.dataset.stop) continue;
      rows.set(r.dataset.stop, r.getBoundingClientRect().top);
      if (r.classList.contains('dim')) dims.add(r.dataset.stop);
    }
  }
  return { rows, dims, top: el ? el.getBoundingClientRect().top : 0, tagged: taggedRow() ? taggedRow().dataset.stop : null };
}
// A row's content — never the row, whose opacity is the window's — steps back
// or forward when a highlight changes (v3.css .dim), the wall's dim in place.
const DIMMED = ':scope > .plan-node, :scope > .plan-what, :scope > .plan-when, :scope > .plan-n, :scope > .sheet-card';

const dimOf = (r) => Number(window.getComputedStyle(r).getPropertyValue('--plan-dim')) || 0.3;
function play(before, { duration, easing }) {
  if (!canAnimate(el, ctxRef)) return;
  const top = el.getBoundingClientRect().top;
  if (Math.abs(before.top - top) > 0.5) {
    el.animate([{ transform: `translateY(${before.top - top}px) ${el.style.transform}` }, { transform: el.style.transform }], { duration, easing });
  }
  let arrivals = 0;
  for (const r of listEl.children) {
    const was = before.rows.get(r.dataset.stop);
    const now = r.getBoundingClientRect().top;
    const shown = r.style.opacity === '' ? 1 : Number(r.style.opacity);
    if (was == null) {
      if (shown > 0) r.animate([{ opacity: 0 }, { opacity: shown }], { duration: CASCADE_MS, delay: arrivals++ * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' });
      continue;
    }
    const dimmed = r.classList.contains('dim');
    if (before.dims.has(r.dataset.stop) !== dimmed) {
      for (const c of r.querySelectorAll(DIMMED)) {
        const to = Number(window.getComputedStyle(c).opacity);
        c.animate([{ opacity: dimmed ? 1 : dimOf(r) }, { opacity: to }], { duration, easing });
      }
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
export function openPlan({ instant = false, focus = false } = {}) {
  if (!el || mode === 'gone' || leaving) return;
  settleTo(1, { instant });
  if (focus) grab.focus({ preventScroll: true });
}
export function closePlan({ instant = false } = {}) {
  if (!el || mode !== 'open') return;
  settleTo(0, { instant });
}
// Gone with the page: pagehide, boot, a crew switch, another screen.
export function dropPlan() {
  if (!el) return;
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
  if (target === 1 && mode !== 'open') unpin();
  measure(); // the laptop's panel top follows the rail; the phone's numbers may have moved with a font
  apply(p);
  const from = { el: el.style.transform, clip: el.style.clipPath, body: body.style.transform, p };
  mode = target === 1 ? 'open' : 'peek';
  apply(target);
  settleState();
  if (instant || !canAnimate(el, ctxRef) || from.p === target) return;
  const timing = target === 1 ? { duration: GROW_MS, easing: EASE_ARRIVE } : { duration: OUT_MS, easing: EASE_LEAVE };
  el.animate(geo.desk
    ? [{ transform: from.el, clipPath: from.clip }, { transform: el.style.transform, clipPath: el.style.clipPath }]
    : [{ transform: from.el }, { transform: el.style.transform }], timing);
  body.animate([{ transform: from.body }, { transform: body.style.transform || 'none' }], timing);
  const fade = [{ opacity: from.p }, { opacity: target }];
  const unfade = [{ opacity: 1 - from.p }, { opacity: 1 - target }];
  headEl.animate(fade, timing);
  for (const r of listEl.children) if (!r.classList.contains('tagged')) r.animate(fade, timing);
  if (geo.desk) {
    corner.head.animate(fade, timing);
    corner.close.animate(fade, timing);
    corner.line.animate(unfade, timing);
    corner.open.animate(unfade, timing);
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
  if (geo && geo.desk) return; // a laptop's card is a button: its click opens it (onClickPeek)
  const inList = listEl.contains(e.target);
  if (mode === 'open' && inList) return; // the open list scrolls; the grabber and the head drag
  if (e.target.closest('.sheet-close')) return;
  if (mode !== 'open') unpin();
  measure();
  apply(mode === 'open' ? 1 : 0);
  const onGrab = grab.contains(e.target) || (mode === 'open' && headEl.contains(e.target));
  drag = { id: e.pointerId, y0: e.clientY, p0: p, moved: false, onGrab, last: [{ y: e.clientY, t: e.timeStamp }] };
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
  const open = Math.abs(v) > FLING ? v > 0 : (d.p0 === 1 ? p > 1 - OPEN_AT : p > OPEN_AT);
  settleTo(open ? 1 : 0);
}
function onCancel(e) {
  if (!drag || (e && e.pointerId != null && e.pointerId !== drag.id)) return;
  const back = drag.p0;
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
// The window's own motion (Web Animations) — not the nodes' endless aura
// drift, which is CSS and never ends.
function motions() {
  if (!el || typeof el.getAnimations !== 'function') return [];
  const css = typeof window.CSSAnimation === 'function' ? window.CSSAnimation : null;
  return el.getAnimations({ subtree: true }).filter((a) => !(css && a instanceof css));
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
  if (!row || row.classList.contains('earlier') || row.classList.contains('scattered') || row.classList.contains('or')) return;
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

