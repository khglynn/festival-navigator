// Entering a crew you already have a life in (2026-09-23).
//
// Kevin's call of the day: one person with two crew links for the same
// festival stays two crews — "keep crews isolated but support multiple for
// one fest". A merged wall is its own later arc. Until then, the second crew
// should not feel like starting over, and this module is the piece that makes
// it not: when you enter a crew at a festival and this device knows ANOTHER
// crew at that festival holding your picks, it offers — once — to bring them.
//
// The rules, each one load-bearing:
//   - only YOUR picks (the name this device claims in each crew, checked
//     against the person record so a borrowed phone never moves one human's
//     picks onto another), only levels above zero;
//   - only onto artists you have not touched here — never overwrite, never
//     lower, and a pick you CLEARED here (a tombstone) is a decision, not a
//     gap;
//   - never notes, never anyone else's picks;
//   - read from what this device already cached (state.cachedDoc) — no new
//     API, nothing read from a circle this device is not in (the circles
//     law: suggestions rank what you can already see, never expand it);
//   - written through the normal pick path by the caller, so sync and the
//     merge treat them like any tap;
//   - remembered per crew × festival on THIS device (viewer-side, never in
//     the shared doc).
//
// Pure planning + words + the one-time memory are exported for the tests;
// the card at the bottom is the app's surface for the offer.
import { picksFor, needsMigration } from './model.js';
import { getLS, saveLS } from '../util.js';
import { GROW_MS, OUT_MS, CASCADE_MS, STAGGER_MS, EASE_ARRIVE, EASE_LEAVE, canAnimate } from './motion.js';

// ---- who is me, crew by crew ---------------------------------------------------------
// The device's claim in a crew (crew.me) is the starting point; the person
// record may veto it. A member whose pid belongs to another record is someone
// else's name now, and a record whose own mirror says "in this crew I am
// <other name>" means the picker on this phone was switched (Settings → You on
// a borrowed phone) — in both cases these are not my picks to move.
export function isMeIn(person, crewToken, doc, name) {
  if (!name) return false;
  const entry = ((doc && doc.people) || {})[name];
  if (!entry || entry.removed) return false;
  if (person && person.id && entry.pid && entry.pid !== person.id) return false;
  const claim = person && (person.crews || {})[crewToken];
  if (claim && claim.name && claim.name !== name) return false;
  return true;
}

// ---- the plan -------------------------------------------------------------------------
// What would arrive here, from which crew. Null when there is nothing to
// offer. `docFor` and `meFor` are the device's cache and claims
// (state.cachedDoc, crew.me) — injected so the rules are testable alone.
//
// Several other crews at this fest: the one holding the most of your picks
// (Kevin: "pick the one where you have the most picks and say so"), among
// those with anything left to bring; `others` counts the rest so the words
// can say it chose.
export function planBringPicks({ token, fid, doc, meName, person = null, crews = [], docFor, meFor }) {
  if (!token || !fid || !doc || !meName) return null;
  // A legacy crew takes no v4 writes until its one-shot migration lands
  // (app.js gates taps the same way).
  if (needsMigration(doc)) return null;
  if (!isMeIn(person, token, doc, meName)) return null;
  const here = ((doc.festivals || {})[fid] || {}).selections || {};
  const touchedHere = (artist) => Object.prototype.hasOwnProperty.call(here[artist] || {}, meName);
  const found = [];
  for (const c of crews) {
    if (!c || !c.token || c.token === token) continue;
    const other = docFor(c.token);
    if (!other || !other.festivals || !other.festivals[fid]) continue;
    const otherMe = meFor(c.token);
    if (!isMeIn(person, c.token, other, otherMe)) continue;
    // picksFor reads by the doc's own version: a legacy "Must See" (3) is
    // must (4) — labels carry the meaning, not the alphas.
    const theirs = picksFor(other, fid);
    const picks = {};
    let total = 0;
    for (const [artist, byPerson] of Object.entries(theirs)) {
      const level = byPerson[otherMe] || 0;
      if (level < 1) continue;
      total++;
      if (!touchedHere(artist)) picks[artist] = level;
    }
    const count = Object.keys(picks).length;
    if (!count) continue;
    const people = Object.entries(other.people || {})
      .filter(([n, p]) => p && !p.removed && n !== otherMe)
      .map(([n]) => n);
    found.push({ token: c.token, name: otherMe, people, picks, count, total });
  }
  if (!found.length) return null;
  // Array.prototype.sort is stable: equal crews keep the device's order.
  found.sort((a, b) => (b.total - a.total) || (b.count - a.count));
  const [best, ...rest] = found;
  return {
    fid,
    from: { token: best.token, name: best.name, people: best.people },
    picks: best.picks,
    count: best.count,
    total: best.total,
    others: rest.length,
  };
}

// ---- the words ---------------------------------------------------------------------------
// Crews rarely have useful names ("Portola 26" names a festival, not people),
// so the other crew is named by who is in it.
function peopleLine(names) {
  if (!names.length) return 'your solo board';
  if (names.length === 1) return `your crew with ${names[0]}`;
  if (names.length === 2) return `your crew with ${names[0]} and ${names[1]}`;
  if (names.length === 3) return `your crew with ${names[0]}, ${names[1]} and ${names[2]}`;
  return `your crew with ${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

export function bringOfferCopy(plan, festName) {
  const from = peopleLine(plan.from.people || []);
  const fest = festName || 'festival';
  // The number is what ARRIVES. When some of your picks there are already
  // decided here, "your 12 picks" would promise twelve and deliver three.
  const line = plan.count === plan.total
    ? (plan.count === 1
      ? `Bring your ${fest} pick from ${from}?`
      : `Bring your ${plan.count} ${fest} picks from ${from}?`)
    : `Bring ${plan.count} more of your ${fest} picks from ${from}?`;
  const safe = 'Just your picks — nothing you’ve picked here changes.';
  const sub = plan.others
    ? `That’s the fullest of your ${plan.others + 1} other ${fest} crews. ${safe}`
    : safe;
  return { line, sub, yes: plan.count === 1 ? 'Bring it' : 'Bring them', no: 'No thanks' };
}

export function bringDoneLine(n) {
  return `Brought ${n} pick${n === 1 ? '' : 's'} over ✓`;
}

// ---- once per crew × festival, on this device ---------------------------------------------
// Viewer-side by law: an answer about MY picks never enters the shared doc.
// getLS/saveLS carry the storage guard (a blocked browser throws on the
// getter itself); the Map carries the answer for this page's life when
// storage cannot, so a blocked browser is never asked twice in one visit.
const BRING_KEY = (token, fid) => `fn_bring_picks_v1_${token}_${fid}`;
const answeredHere = new Map();

export function bringAnswered(token, fid) {
  const key = BRING_KEY(token, fid);
  return answeredHere.has(key) || !!getLS(key);
}

export function rememberBringAnswer(token, fid, answer) {
  const key = BRING_KEY(token, fid);
  answeredHere.set(key, answer);
  saveLS(key, answer);
}

// ---- the card ------------------------------------------------------------------------------
// One decision, so it sits above the dock where the thumb already is — never
// in the toolbar strips, which the day-of open scrolls out of sight the moment
// the wall lands. Two layers on purpose: the outer box steps up when a toast
// arrives (a neighbour making room), the inner card carries its own arrival
// and exit, so the two motions never fight over one transform. It lives
// inside #screen-app, so Settings or the landing hides it with the wall.
const CARD_ID = 'bring-offer';
const ARRIVE_DELAY_MS = 360; // a beat after the wall lands: the wall first, then the question
const DONE_HOLD_MS = 1500;   // long enough to read the confirmation, short enough to be gone

let toastWatch = null;

export function bringOfferCard() { return document.getElementById(CARD_ID); }

function node(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// A toast shares the strip above the dock. When one arrives the offer steps
// up by the toast's height; when it leaves, the offer settles back.
function watchToasts(box) {
  const root = document.getElementById('toast-root');
  if (!root || typeof MutationObserver !== 'function') return;
  const place = () => {
    const t = root.firstElementChild;
    const h = t ? t.offsetHeight : 0;
    box.style.transform = h ? `translateY(-${h + 8}px)` : '';
  };
  toastWatch = new MutationObserver(place);
  toastWatch.observe(root, { childList: true });
  place();
}

function unwatchToasts() {
  if (toastWatch) { toastWatch.disconnect(); toastWatch = null; }
}

// `key` names the crew × fest the card is FOR; the app compares it before
// acting, so a card left over from another crew can never write here.
export function showBringOffer(host, { copy, key, ctx = null, onBring, onDecline }) {
  dismissBringOffer({ instant: true });
  const box = node('div', 'bring-offer');
  box.id = CARD_ID;
  box.dataset.key = key;
  const card = node('div', 'bring-card');
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', 'Bring your picks');
  const text = node('div', 'bring-text');
  text.setAttribute('aria-live', 'polite');
  text.append(node('div', 'bring-line', copy.line), node('div', 'bring-sub', copy.sub));
  const actions = node('div', 'bring-actions');
  const yes = node('button', 'btn-tonal', copy.yes);
  const no = node('button', 'btn-ghost', copy.no);
  actions.append(yes, no);
  card.append(text, actions);
  box.appendChild(card);
  host.appendChild(box);
  watchToasts(box);

  // The way in has a little life: the card rises a few pixels on a curve
  // with a touch of overshoot, a beat after the wall, and its two answers
  // follow a stagger behind. Low Power and reduced motion: already there.
  if (canAnimate(card, ctx)) {
    card.animate(
      [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
      { duration: GROW_MS, delay: ARRIVE_DELAY_MS, easing: EASE_ARRIVE, fill: 'backwards' },
    );
    [yes, no].forEach((b, i) => b.animate(
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: CASCADE_MS, delay: ARRIVE_DELAY_MS + GROW_MS / 2 + i * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' },
    ));
  }

  yes.addEventListener('click', () => {
    yes.disabled = true;
    no.disabled = true;
    onBring();
  });
  no.addEventListener('click', () => {
    onDecline();
    dismissBringOffer({ ctx });
  });
  return box;
}

// "Bring them" landed: the question becomes its answer in place, the buttons
// step back, and the card leaves on its own a moment later.
export function settleBringOffer(doneLine, { ctx = null } = {}) {
  const box = bringOfferCard();
  if (!box) return;
  const card = box.querySelector('.bring-card');
  const text = box.querySelector('.bring-text');
  const actions = box.querySelector('.bring-actions');
  text.replaceChildren(node('div', 'bring-line', doneLine));
  if (actions) actions.remove();
  if (canAnimate(card, ctx)) {
    text.animate(
      [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
      { duration: CASCADE_MS, easing: EASE_ARRIVE },
    );
  }
  setTimeout(() => { if (bringOfferCard() === box) dismissBringOffer({ ctx }); }, DONE_HOLD_MS);
}

// The way out is quick and plain. `instant` for crew switches and screen
// changes — a card must never linger over the next crew's wall.
export function dismissBringOffer({ instant = false, ctx = null } = {}) {
  const box = bringOfferCard();
  unwatchToasts();
  if (!box) return;
  box.removeAttribute('id'); // a new offer can mount while this one leaves
  const card = box.querySelector('.bring-card');
  if (instant || !canAnimate(card, ctx)) { box.remove(); return; }
  card.style.pointerEvents = 'none'; // a leaving card takes no second tap
  const out = card.animate(
    [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }],
    { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' },
  );
  out.onfinish = () => box.remove();
}
