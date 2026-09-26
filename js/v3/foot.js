// The bottom of the phone screen, as everything that has to clear it reads it
// (Our plan, 2026-09-26).
//
// The dock used to be the only thing down there, and four literals guessed its
// height (84px of shell padding, 64 for the companions and the toast, 70 for
// the Spotify pill) while two readers measured it (seenBand, the zoom's
// floor). Our plan's peek now sits on the dock's top edge, so "the dock's top"
// is no longer the floor. Two answers, one home:
//
//   footTop()     a real box: the top of whatever is at the bottom right now —
//                 the dock, or the plan above it (peek or open, mid-drag
//                 included). The zoom's floor and NOW's seen band read this.
//                 Real boxes, never tokens (card-facts.js chromeCeiling).
//   measureFoot() the RESTING height of that chrome — the dock plus the peek,
//                 never the open plan (which covers the wall; it is not a floor
//                 for the page's padding) — written to :root as --foot-h, and
//                 the dock's own height as --dock-h (the plan stands on it).
//                 CSS reads these: the shell's bottom padding, the toast, the
//                 Spotify pill.
//   measureOffer() the card that waits down there instead of the plan — the
//                 welcome, the bring-your-picks offer — as --offer-top, its
//                 top edge's distance from the window's bottom. The Spotify
//                 pill stands above it (v3.css), phone and laptop alike.
//
// Above 720px the dock is display:none and the laptop's plan lives in the
// corner: footTop() is null there and the two variables go back to the
// tokens' values (v3-tokens.css). What the laptop's open panel bounds is a
// SIDE: sideLeft() is its left edge while it is open, else null — the zoom's
// right bound (card-facts.js place).
const ids = ['dock', 'plan'];

const shown = (el) => !!el && el.getClientRects().length > 0;

export function footTop() {
  const vh = window.innerHeight;
  // The laptop's plan is a corner card, and then a side panel: neither is a
  // floor across the wall, and there is no dock to stand on (>=720).
  if (!shown(document.getElementById('dock'))) return null;
  let top = null;
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!shown(el)) continue;
    const t = el.getBoundingClientRect().top;
    if (t > 0 && t < vh && (top === null || t < top)) top = t;
  }
  return top;
}

export function measureFoot() {
  const root = document.documentElement.style;
  const dock = document.getElementById('dock');
  const plan = document.getElementById('plan');
  // The search field hides the dock while it has focus; the page keeps the
  // padding it had, or its end would jump under the keyboard at every focus.
  if (dock && dock.classList.contains('hidden')) return;
  // No dock (a laptop, or a screen without one): the tokens' own values stand,
  // which is where every reader was before this file existed — so a toast on a
  // laptop still sits where it always sat.
  if (!shown(dock)) { root.removeProperty('--dock-h'); root.removeProperty('--foot-h'); return; }
  // Exact, not rounded: the plan stands on this, and a rounded 44 under a
  // 44.6px dock hid part of the peek's row behind the dock (or a rounded-up
  // one left a sliver of the wall between them).
  const dockH = Math.round(dock.getBoundingClientRect().height * 100) / 100;
  // The plan says how tall its peek is (plan-shelf.js writes data-peek-h on
  // every paint); an open plan still counts as its peek here.
  const peekH = shown(plan) ? Number(plan.dataset.peekH) || 0 : 0;
  root.setProperty('--dock-h', `${dockH}px`);
  root.setProperty('--foot-h', `${dockH + peekH}px`);
}

// Its resting place, not its motion: the card's own rise and a toast's
// step-up are transforms, and offsetHeight + the computed bottom leave both
// out. Unset when no card is up, so the pill's other floors stand.
export function measureOffer() {
  const root = document.documentElement.style;
  const box = document.querySelector('#screen-app > .bring-offer');
  if (!box) { root.removeProperty('--offer-top'); return; }
  const bottom = parseFloat(window.getComputedStyle(box).bottom) || 0;
  root.setProperty('--offer-top', `${box.offsetHeight + bottom}px`);
}

export function sideLeft() {
  const plan = document.getElementById('plan');
  if (!plan || plan.dataset.side !== 'open' || !shown(plan)) return null;
  const l = plan.getBoundingClientRect().left;
  return l > 0 && l < window.innerWidth ? l : null;
}
