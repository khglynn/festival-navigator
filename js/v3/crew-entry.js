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
import { GROW_MS, OUT_MS, CASCADE_MS, STAGGER_MS, EASE_ARRIVE, EASE_LEAVE, EASE_SURFACE, canAnimate } from './motion.js';

// ---- who is me, crew by crew ---------------------------------------------------------
// AFFIRMATIVE ownership, never the absence of a veto (Codex review,
// 2026-09-23). The name the device claims in a crew (crew.me) is mine only
// when this device's person record says so: the name carries its pid, or the
// record's own mirror for that crew names exactly it. And if any OTHER active
// member carries the pid, this name is not me, whatever else is true. A
// borrowed phone is the case this exists for: the owner's record, a friend
// picking as a placeholder with no pid — that placeholder is nobody's to move
// picks onto or off. No person record on the device: nothing is provably
// mine, so there is no offer.
export function isMeIn(person, crewToken, doc, name) {
  if (!person || !person.id || !name) return false;
  const people = (doc && doc.people) || {};
  const entry = people[name];
  if (!entry || entry.removed) return false;
  const elsewhere = Object.entries(people)
    .some(([n, p]) => n !== name && p && !p.removed && p.pid === person.id);
  if (elsewhere) return false;
  if (entry.pid) return entry.pid === person.id;
  const claim = (person.crews || {})[crewToken];
  return !!(claim && claim.name === name);
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
    // Who and where the offer was made for: the tap is held to all of it.
    token,
    fid,
    meName,
    from: { token: best.token, name: best.name, people: best.people },
    picks: best.picks,
    count: best.count,
    total: best.total,
    others: rest.length,
  };
}

// ---- the tap -------------------------------------------------------------------------------
// The card names ONE crew, and the tap brings from that crew or from nothing
// (Codex review, 2026-09-23). Planning afresh at the tap could pick a
// different crew — pick Robyn here while the card says "from your crew with
// Ross", and a fresh plan reached for Nhu's crew instead, under words that
// still said Ross. So the tap re-checks the plan it was shown, against now:
// the same crew, festival and names, still provably mine on both sides; then
// the offered picks that are still mine over there and still untouched here.
// Null when the offer no longer holds (someone else is picking on this phone
// now); `count: 0` when it holds but everything was decided here meanwhile.
export function bringFromSource(plan, { token, fid, doc, meName, person = null, docFor, meFor }) {
  if (!plan || token !== plan.token || fid !== plan.fid || meName !== plan.meName) return null;
  if (!doc || needsMigration(doc) || !isMeIn(person, token, doc, meName)) return null;
  const source = docFor(plan.from.token);
  const sourceMe = meFor(plan.from.token);
  if (!source || sourceMe !== plan.from.name || !isMeIn(person, plan.from.token, source, sourceMe)) return null;
  const theirs = picksFor(source, fid);
  const here = ((doc.festivals || {})[fid] || {}).selections || {};
  const picks = {};
  for (const artist of Object.keys(plan.picks)) {
    const level = (theirs[artist] || {})[sourceMe] || 0;
    if (level < 1) continue;
    if (Object.prototype.hasOwnProperty.call(here[artist] || {}, meName)) continue;
    picks[artist] = level;
  }
  return { picks, count: Object.keys(picks).length };
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
  return n
    ? `Brought ${n} pick${n === 1 ? '' : 's'} over ✓`
    : 'Nothing new to bring — you’ve picked those here already.';
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
  // Read off the page's window, not the bare global: the same object in a
  // browser, and the one a jsdom shell actually has.
  const Observer = typeof window !== 'undefined' ? window.MutationObserver : undefined;
  if (!root || typeof Observer !== 'function') return;
  const place = () => {
    const t = root.firstElementChild;
    const h = t ? t.offsetHeight : 0;
    box.style.transform = h ? `translateY(-${h + 8}px)` : '';
  };
  toastWatch = new Observer(place);
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

// "Bring them" landed: the question becomes its answer in place. The words
// and the buttons step back (quick), the card eases down to the one line it
// needs, the answer rises into it — and a moment later the card leaves on
// its own. Motion off: the answer is simply there.
export function settleBringOffer(doneLine, { ctx = null } = {}) {
  const box = bringOfferCard();
  if (!box) return;
  const card = box.querySelector('.bring-card');
  const text = box.querySelector('.bring-text');
  const actions = box.querySelector('.bring-actions');
  const leaveLater = () => setTimeout(() => { if (bringOfferCard() === box) dismissBringOffer({ ctx }); }, DONE_HOLD_MS);
  const swap = (outs = []) => {
    const from = card.offsetHeight;
    outs.forEach((a) => a.cancel()); // a finished fade must not keep holding the new line at zero
    text.replaceChildren(node('div', 'bring-line', doneLine));
    if (actions) actions.remove();
    if (canAnimate(card, ctx)) {
      const to = card.offsetHeight;
      card.style.overflow = 'hidden'; // only while the box shrinks — focus rings need it visible
      const shrink = card.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: GROW_MS, easing: EASE_SURFACE });
      shrink.onfinish = () => { card.style.overflow = ''; };
      text.animate(
        [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: CASCADE_MS, delay: GROW_MS / 2, easing: EASE_ARRIVE, fill: 'backwards' },
      );
    }
    leaveLater();
  };
  if (!canAnimate(card, ctx)) { swap(); return; }
  const fade = [{ opacity: 1 }, { opacity: 0 }];
  const outs = [text, actions].filter(Boolean)
    .map((n) => n.animate(fade, { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' }));
  outs[0].onfinish = () => swap(outs);
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
