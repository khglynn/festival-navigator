// The welcome card (v92, 2026-09-25 — "first open, wall first", Kevin's F2).
//
// A crew link on a phone the crew does not know opens straight onto the wall,
// nobody selected, and this card says what the wall is: whose plan it is, and
// that more colour on a card means more of the crew wants to go. The wall is
// the best explanation of itself; the card only names what it is showing.
// It replaces the How it works strip, which sat in the toolbar and was
// scrolled out of sight by the day-of open (design brief §1.6, measured).
//
// Once per PHONE (not per crew): the words explain the app, and a second crew
// does not need them again. Everyone sees it once, members included — friends
// who dismissed the old strip never got these words (Kevin's default, 10.5).
//
// The card is the bring-your-picks offer's anatomy (crew-entry.js): above the
// dock where the thumb is, an outer box that steps up when a toast arrives,
// and an inner card that carries its own arrival and exit. It never shares
// the bottom of the screen with the offer — the offer waits for "Got it".
import { GROW_MS, OUT_MS, CASCADE_MS, STAGGER_MS, EASE_ARRIVE, EASE_LEAVE, canAnimate } from './motion.js';
import { getLS } from '../util.js';

// ---- once per phone -------------------------------------------------------------
// A raw guarded write, not saveLS: a refused marker is not a lost pick, and
// must not raise the "storage is full" toast that exists for those. Memory
// carries the answer for this page's life when storage cannot, so a blocked
// browser is never welcomed twice in one visit.
const LS_WELCOME = 'fn_welcome_v1';
let seenHere = false;

export function welcomeSeen() {
  return seenHere || getLS(LS_WELCOME) != null;
}

export function rememberWelcomeSeen() {
  seenHere = true;
  try { localStorage.setItem(LS_WELCOME, '1'); } catch { /* memory holds it for this visit */ }
}

// ---- the words -------------------------------------------------------------------
// C1 as the frames drew it (F2a, F2d). The crew's name rides the label beside
// its faces, so the line can say "the crew's plan" and stay one line. A
// guest adds themselves; a member already has a colour, so they add theirs.
// "Want to go", never "going": a pick is interest, not a ticket.
//
// A guest also gets Kevin's right-hand door (2026-09-25, 7:55 PM: "a right
// justified button in there to pick with the crew") — for friends who already
// know they want to pick. A member is already picking, so theirs has none.
export function welcomeCopy({ crewName = '', festName = '', people = [], picked = false, guest = true, meName = null } = {}) {
  const fest = festName || 'this festival';
  const label = crewName || 'Your crew';
  const buttons = { yes: 'Got it', more: 'How it works', join: guest ? 'Pick with the crew' : null };
  if (!people.length) {
    return { label, line: 'Nobody’s in this crew yet.', sub: 'Tap any artist to be first — you’ll pick a name as you do.', ...buttons };
  }
  if (!picked) {
    // The only person here is the one reading it (a creator, just after the
    // share moment): their plan, in the second person.
    const mine = people.length === 1 && !guest && meName && people[0] === meName;
    const line = mine
      ? `Your plan for ${fest} is ready. Nobody’s picked yet.`
      : people.length === 1
        ? `${people[0]} started this plan for ${fest}. Nobody’s picked yet.`
        : `This is the crew’s plan for ${fest}. Nobody’s picked yet.`;
    return { label, line, sub: 'Every friend gets a color, and a card lights up with everyone who picks it. Tap any artist to be first.', ...buttons };
  }
  return {
    label,
    line: `This is the crew’s plan for ${fest}.`,
    sub: `Every friend has a color — the more color on a card, the more of us want to go. Tap any artist to add ${guest ? 'yourself' : 'yours'}.`,
    ...buttons,
  };
}

// ---- the card --------------------------------------------------------------------
const CARD_ID = 'welcome-card';
const ARRIVE_DELAY_MS = 360; // a beat after the wall lands: the wall first, then the words
const MAX_FACES = 6;

let toastWatch = null;

export function welcomeCard() { return document.getElementById(CARD_ID); }

function node(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// Faces: who is in the crew, in their colours. Six at most — a crew of nine
// shows five and "+4", so the row never outgrows the card on a 320 phone.
function facesRow(faces) {
  const cluster = node('span', 'avatar-cluster');
  cluster.setAttribute('aria-hidden', 'true');
  const shown = faces.length > MAX_FACES ? faces.slice(0, MAX_FACES - 1) : faces;
  for (const f of shown) {
    const a = node('span', 'avatar', String(f.name || '?').charAt(0).toUpperCase());
    a.style.background = f.bg;
    a.style.border = `1px solid ${f.stroke}`;
    cluster.appendChild(a);
  }
  if (faces.length > shown.length) cluster.appendChild(node('span', 'avatar more', `+${faces.length - shown.length}`));
  return cluster;
}

// A toast shares the strip above the dock. When one arrives the card steps up
// by the toast's height; when it leaves, the card settles back (the offer's
// rule, crew-entry.js — the two are never up at once, so each keeps its own).
function watchToasts(box) {
  const root = document.getElementById('toast-root');
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

export function showWelcome(host, { copy, faces = [], ctx = null, onGotIt, onHow, onJoin }) {
  dismissWelcome({ instant: true });
  const box = node('div', 'bring-offer welcome-offer');
  box.id = CARD_ID;
  const card = node('div', 'bring-card welcome-card');
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', 'What this is');
  const head = node('div', 'welcome-head');
  const cluster = faces.length ? facesRow(faces) : null;
  if (cluster) head.appendChild(cluster);
  head.appendChild(node('span', 'micro-label', copy.label));
  const text = node('div', 'bring-text');
  text.append(node('div', 'bring-line', copy.line), node('div', 'bring-sub', copy.sub));
  const actions = node('div', 'bring-actions');
  const yes = node('button', 'btn-tonal', copy.yes);
  const more = node('button', 'btn-ghost', copy.more);
  actions.append(yes, more);
  // The quiet ways to look stay on the left, as the frame drew them; the way
  // to pick sits on the right (it wraps under them on a 320 phone, still to
  // the right).
  const join = copy.join && onJoin ? node('button', 'btn-tonal welcome-join', copy.join) : null;
  if (join) actions.append(join);
  card.append(head, text, actions);
  box.appendChild(card);
  host.appendChild(box);
  watchToasts(box);

  // The way in has a little life: the card rises on the arrival curve a beat
  // after the wall settles, the faces arrive one by one, then its two answers.
  // Low Power and reduced motion: already there.
  if (canAnimate(card, ctx)) {
    card.animate(
      [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
      { duration: GROW_MS, delay: ARRIVE_DELAY_MS, easing: EASE_ARRIVE, fill: 'backwards' },
    );
    const people = cluster ? [...cluster.children] : [];
    people.forEach((a, i) => a.animate(
      [{ opacity: 0, transform: 'translateX(-4px) scale(.7)' }, { opacity: 1, transform: 'none' }],
      { duration: CASCADE_MS, delay: ARRIVE_DELAY_MS + GROW_MS / 2 + i * STAGGER_MS * 2, easing: EASE_ARRIVE, fill: 'backwards' },
    ));
    const after = ARRIVE_DELAY_MS + GROW_MS / 2 + people.length * STAGGER_MS * 2;
    [yes, more, join].filter(Boolean).forEach((b, i) => b.animate(
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: CASCADE_MS, delay: after + i * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' },
    ));
  }

  yes.addEventListener('click', () => {
    rememberWelcomeSeen();
    dismissWelcome({ ctx });
    if (onGotIt) onGotIt();
  });
  // How it works leaves the card where it is: Settings hides it with the wall,
  // and coming back finds it still there for "Got it" — which is also the
  // moment anything waiting behind it (the bring-your-picks offer) may ask.
  more.addEventListener('click', () => { if (onHow) onHow(); });
  // "Pick with the crew": the ordinary join, with nothing waiting — the app
  // marks the welcome read and takes the card down on the way (askToJoin).
  if (join) join.addEventListener('click', () => onJoin());
  return box;
}

// The way out is quick and plain. `instant` for crew switches and screen
// changes — a card must never linger over the next crew's wall.
export function dismissWelcome({ instant = false, ctx = null } = {}) {
  const box = welcomeCard();
  unwatchToasts();
  if (!box) return;
  box.removeAttribute('id'); // a new card can mount while this one leaves
  const card = box.querySelector('.bring-card');
  if (instant || !canAnimate(card, ctx)) { box.remove(); return; }
  card.style.pointerEvents = 'none'; // a leaving card takes no second tap
  const out = card.animate(
    [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }],
    { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' },
  );
  out.onfinish = () => box.remove();
}
