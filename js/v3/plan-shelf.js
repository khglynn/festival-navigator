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

let el = null;       // #plan
let grab = null;     // the grabber (a button: the keyboard's way in and out)
let body = null;     // head + list, the part the window shifts
let headEl = null;
let listEl = null;
let ctxRef = null;
let data = null;     // the last paint's answer (see paintPlanShelf)
let sig = '';        // what that answer drew, to skip repaints that change nothing
let mode = 'gone';   // 'gone' | 'peek' | 'open'
let p = 0;           // 0 peek … 1 open, while a drag or a settle is in flight
let geo = null;      // { H, peekH, shift } measured after every draw
// Whose card is grown under its row: null = the default (the NOW row's), ''
// = none (a person folded NOW's), else a stop key (a row a person tapped).
// It survives closing — the card waits below the peek's window — and resets
// when the shelf leaves.
let grown = null;
let earlierOpen = false;
let nightId = '';    // `${fid}|${route id}` of the day the rows are drawn for
let drag = null;
let leaving = null;  // { timer } while the shelf drops out of sight
let quietUntil = 0;  // the click that follows a drag or a peek tap is not a second tap

export const planShelf = () => el;
export const planIsOpen = () => mode === 'open';
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

function build(host) {
  el = mk('section', 'plan-shelf');
  el.id = ID;
  el.hidden = true;
  el.setAttribute('aria-label', PLAN_NAME);
  grab = mk('button', 'plan-grab');
  grab.type = 'button';
  grab.appendChild(mk('span', 'grabber'));
  body = mk('div', 'plan-body');
  headEl = mk('div', 'plan-head');
  listEl = mk('div', 'plan-list');
  body.append(headEl, listEl);
  el.append(grab, body);
  // Before the dock, so the dock (later in the DOM, z30 over this z29) paints
  // over the part of the plan that waits below its top edge.
  const dock = document.getElementById('dock');
  if (dock && dock.parentElement === host) host.insertBefore(el, dock);
  else host.appendChild(el);
  grab.addEventListener('click', (e) => {
    e.preventDefault();
    if (quiet()) return; // the end of a drag is not a tap
    if (mode === 'open') closePlan(); else openPlan();
  });
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('click', onClickPeek, true);
}

// ---- drawing ------------------------------------------------------------------
// `answer` from app.js paintPlan, or null when there is no plan to show:
//   { plan, route, peek, nowMin, weekday, sub, dayWord, nightLabelOf, gen }
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
  return [a.gen, a.route && a.route.id, a.peek.tag, stopKey(a.peek.stop), a.peek.count, a.dayWord, over, rows, grown, earlierOpen].join('|');
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
  // The NOW row's card is always grown in the day plan (the approved frame);
  // a tapped row's too. It sits under its row, so the peek's window (the row
  // alone) never includes it.
  const nowKey = a.peek.tag === 'now' ? stopKey(a.peek.stop) : null;
  const list = planList(a.route, {
    ctx, plan: a.plan, peek: a.peek, nowMin: a.nowMin, grown: grown === null ? nowKey : grown,
    earlierOpen, onEarlier: toggleEarlier, nightLabelOf: a.nightLabelOf, dayWord: a.dayWord,
  });
  list.addEventListener('click', onRowTap);
  listEl.replaceWith(list);
  listEl = list;
  listEl.querySelectorAll('.plan-row[data-tag]').forEach((r) => r.classList.add('tagged'));
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
  const row = taggedRow();
  const H = el.offsetHeight;
  const grabH = grab.offsetHeight;
  const rowTop = row ? row.offsetTop - listEl.scrollTop : 0;
  const who = row ? row.querySelector('.plan-who') : null;
  const pad = row ? parseFloat(getComputedStyle(row).paddingBottom) || 0 : 0;
  const rowH = !row ? 0 : who ? Math.min(who.offsetTop - 1, who.offsetTop - (parseFloat(getComputedStyle(who).marginTop) || 0) + pad) : row.offsetHeight;
  geo = { H, peekH: Math.min(H, grabH + rowH), shift: headEl.offsetHeight + rowTop };
  el.dataset.peekH = String(geo.peekH);
}

// p → the window. Opacity rides the same number: the head and every row but
// the tagged one fade in as the window opens (they slide in from the edges).
function apply(q) {
  p = Math.max(0, Math.min(1, q));
  el.style.transform = `translateY(${(geo.H - geo.peekH) * (1 - p)}px)`;
  body.style.transform = p === 1 ? 'none' : `translateY(${-geo.shift * (1 - p)}px)`;
  const o = p === 1 ? '' : String(p);
  headEl.style.opacity = o;
  for (const r of listEl.children) if (!r.classList.contains('tagged')) r.style.opacity = o;
  el.classList.toggle('opening', p > 0 && p < 1);
}

function settleState() {
  el.dataset.state = mode;
  el.classList.remove('opening');
  // What the peek hides is not there for a keyboard or a screen reader either.
  const peek = mode !== 'open';
  headEl.inert = peek;
  for (const r of listEl.children) r.inert = peek && !r.classList.contains('tagged');
  listEl.classList.toggle('scrolls', !peek);
  if (peek) listEl.scrollTop = 0;
  // A focused ✕ or row that the peek just hid hands its focus to the grabber.
  const f = document.activeElement;
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
  measure();
  apply(0);
  settleState();
  if (canAnimate(el, ctxRef)) {
    el.animate([{ transform: `translateY(${geo.H}px)` }, { transform: el.style.transform }],
      { duration: GROW_MS, easing: EASE_ARRIVE });
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
    el.hidden = true; mode = 'gone'; sig = ''; data = null; grown = null; earlierOpen = false; nightId = ''; measureFoot();
  };
  if (instant || !geo || !canAnimate(el, ctxRef)) { done(); return; }
  if (leaving) return;
  const from = el.style.transform;
  el.style.transform = `translateY(${geo.H}px)`;
  const a = el.animate([{ transform: from }, { transform: el.style.transform }], { duration: OUT_MS, easing: EASE_LEAVE });
  leaving = { timer: setTimeout(done, OUT_MS * 3 + 50) };
  a.onfinish = done;
}
function cancelLeave() {
  if (!leaving) return;
  clearTimeout(leaving.timer);
  leaving = null;
  if (el) el.getAnimations().forEach((x) => x.cancel());
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
  if (listEl) for (const r of listEl.children) if (r.dataset.stop) rows.set(r.dataset.stop, r.getBoundingClientRect().top);
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
export function openPlan({ instant = false } = {}) {
  if (!el || mode === 'gone' || leaving) return;
  settleTo(1, { instant });
}
export function closePlan({ instant = false } = {}) {
  if (!el || mode !== 'open') return;
  settleTo(0, { instant });
}
// Gone with the page: pagehide, boot, a crew switch, another screen.
export function dropPlan() {
  if (!el) return;
  endDrag();
  if (mode === 'open') settleTo(0, { instant: true });
}
export function hidePlanShelf({ instant = false } = {}) { leave({ instant }); }

// Storyboards 5, 6 and 9: from wherever the window is (a drag lets go
// anywhere) to open or to the peek. The inline styles are set to the end
// state at once and the animation plays from where it was — so an animation
// that never finishes still leaves the right state behind.
function settleTo(target, { instant = false } = {}) {
  const from = { el: el.style.transform, body: body.style.transform, p };
  mode = target === 1 ? 'open' : 'peek';
  apply(target);
  settleState();
  if (instant || !canAnimate(el, ctxRef) || from.p === target) return;
  const timing = target === 1 ? { duration: GROW_MS, easing: EASE_ARRIVE } : { duration: OUT_MS, easing: EASE_LEAVE };
  el.animate([{ transform: from.el }, { transform: el.style.transform }], timing);
  body.animate([{ transform: from.body }, { transform: body.style.transform || 'none' }], timing);
  const fade = [{ opacity: from.p }, { opacity: target }];
  headEl.animate(fade, timing);
  for (const r of listEl.children) if (!r.classList.contains('tagged')) r.animate(fade, timing);
}

// ---- the drag (storyboard 4) --------------------------------------------------------
// A finger (or a mouse) on the peek anywhere, or on the open plan's grabber
// and head: the window follows it with inline transforms — direct
// manipulation, which Reduce Motion and Low Power keep (only the settle after
// it is instant there). The page is marked busy while a finger is down, so a
// new build never reloads under the hand (the Show menu's rule: take the slot
// only if it is free, give it back only if it is ours).
function onDown(e) {
  if (mode === 'gone' || leaving || e.button > 0 || drag) return;
  const inList = listEl.contains(e.target);
  if (mode === 'open' && inList) return; // the open list scrolls; the grabber and the head drag
  if (e.target.closest('.sheet-close')) return;
  measure();
  apply(mode === 'open' ? 1 : 0);
  drag = { id: e.pointerId, y0: e.clientY, p0: p, moved: false, onGrab: grab.contains(e.target), last: [{ y: e.clientY, t: e.timeStamp }] };
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
    el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
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
  if (!d.moved) {
    // A tap: the grabber's is its own click (the keyboard's too); anywhere
    // else on the peek opens it, and the click that follows is swallowed.
    if (!d.onGrab && mode !== 'open') { quietUntil = performance.now() + 400; openPlan(); }
    return;
  }
  quietUntil = performance.now() + 400;
  const a = d.last[0];
  const b = d.last[d.last.length - 1];
  const v = b.t > a.t ? (a.y - b.y) / (b.t - a.t) : 0; // up is positive
  const open = Math.abs(v) > FLING ? v > 0 : (d.p0 === 1 ? p > 1 - OPEN_AT : p > OPEN_AT);
  settleTo(open ? 1 : 0);
}
function onCancel(e) {
  if (!drag || (e && e.pointerId != null && e.pointerId !== drag.id)) return;
  const back = drag.p0;
  endDrag();
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

// Nothing under the peek's window is a control of its own: a tap there opens
// the plan (onUp), and its click — and any click just after a drag — never
// reaches a row or a grown card's links.
function onClickPeek(e) {
  if (grab.contains(e.target) && !quiet()) return;
  if (mode !== 'open' || quiet()) { e.stopPropagation(); e.preventDefault(); }
}

// ---- inside the open plan ----------------------------------------------------------
// A row tap grows that stop's card under it, and the rows below make room;
// the same tap folds it again. (The NOW row's card is grown by itself.)
function onRowTap(e) {
  if (mode !== 'open') return;
  const row = e.target.closest('.plan-row');
  if (!row || row.classList.contains('earlier') || row.classList.contains('scattered') || row.classList.contains('or')) return;
  if (e.target.closest('.plan-grow')) return;
  const key = row.dataset.stop;
  const nowKey = data.peek.tag === 'now' ? stopKey(data.peek.stop) : null;
  const current = grown === null ? nowKey : grown;
  grown = current === key ? '' : key;
  relayout();
}
function toggleEarlier() {
  if (mode !== 'open') return;
  earlierOpen = !earlierOpen;
  relayout();
}
function relayout() {
  const before = snapshot();
  sig = signature(data);
  draw();
  measure();
  apply(1);
  settleState();
  play(before, { duration: GROW_MS, easing: EASE_ARRIVE });
}

// A rotation, a resize or a late font changes the window's numbers: measure
// again and put the window back where it was (no motion — nothing moved but
// the ruler).
export function refitPlanShelf() {
  if (!el || mode === 'gone' || leaving || drag) return;
  measure();
  apply(mode === 'open' ? 1 : 0);
  measureFoot();
}
