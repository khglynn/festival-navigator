// The welcome card (v92, 2026-09-25 — "first open, wall first", Kevin's F2).
//
// A crew link on a phone the crew does not know opens straight onto the wall,
// nobody selected, and this card says what the wall is: whose plan it is, and
// that more colour on a card means more of the crew wants to go. The wall is
// the best explanation of itself; the card only names what it is showing.
// It replaces the How it works strip, which sat in the toolbar and was
// scrolled out of sight by the day-of open (design brief §1.6, measured).
//
// Once per PHONE (not per crew), and only for someone NEW here: a guest (no
// name in this crew on this phone) or someone who has just joined. A phone
// that knows you or recognizes you lands exactly as it did in v91 — on NOW,
// the top, its own show filter — with no card (Kevin, 2026-09-25: "people
// that have already connected to a person in the fest should just go to now
// / the top / their filter selected"). app.js decides who is new.
//
// The card is the bring-your-picks offer's anatomy (crew-entry.js): above the
// dock where the thumb is, an outer box that steps up when a toast arrives,
// and an inner card that carries its own arrival and exit. It never shares
// the bottom of the screen with the offer — the offer waits for it to go.
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

// The just-joined card has its OWN marker (the independent walk of b29aac0):
// the guest card is marked read the moment a guest touches the wall or asks
// to join — always before the join lands — so sharing one marker meant the
// card a new member most needs ("tap any artist to add yours", now that a tap
// picks) could never show. It shows once per phone, after a fresh join.
const LS_JOINED = 'fn_welcome_joined_v1';
let joinedSeenHere = false;
export function joinedWelcomeSeen() {
  return joinedSeenHere || getLS(LS_JOINED) != null;
}
export function rememberJoinedWelcomeSeen() {
  joinedSeenHere = true;
  try { localStorage.setItem(LS_JOINED, '1'); } catch { /* memory holds it for this visit */ }
}

// ---- the words -------------------------------------------------------------------
// EVERY word the card says lives in WORDS — one edit here and nowhere else;
// the join screen's way back reads WORDS.look too. Kevin's words (review
// page, 2026-09-25): the buttons say the choice — "Pick shows" (left, the
// join, filled) or "Look around" (right, the quiet way, same as dismissing;
// flipped the same day from the round-3 frames) — so a
// guest's body is the one line about colour. The crew's name rides the label
// beside its faces, so the line can say "the crew's picks" and stay one line.
// "Picked", never "plan", "want to go" or "going" (Kevin, 2026-09-26, after a
// friend's "my picks are what I was interested in, not what I'm planning to go
// to"): a pick is interest, not a ticket. A member who has just joined already has a
// colour — their card has no join, "Got it" its one button, and a line on how to pick.
export const WORDS = {
  look: 'Look around',           // a guest's right-hand button, the quiet one (and the join screen's way back)
  gotIt: 'Got it',               // a fresh member's one button
  how: 'More info',              // the explanation's last words, drawn as a link (Kevin, the guest shelf round)
  join: 'Pick shows',            // a guest's left button, filled: the join
  line: (fest) => `These are the crew’s picks for ${fest}.`,
  crewFor: (fest) => `This crew is here for ${fest}.`, // a crew nobody has picked in yet ("picks" would read as a contradiction)
  colors: 'Every friend has a color — the more color on a card, the more of us picked it.',
  memberNext: 'Tap any artist, then + to add yours.',
  empty: 'Nobody’s in this crew yet.',
  emptySub: 'Tap any artist, then + to be first — you’ll pick a name as you do.',
  nobodyPicked: 'Nobody’s picked yet.',
  startedBy: (name, fest) => `${name} started this crew for ${fest}.`,
  yours: (fest) => `Your crew for ${fest} is ready.`,
  firstSub: 'Every friend gets a color, and a card lights up with everyone who picks it. Tap any artist, then + to be first.',
};

export function welcomeCopy({ crewName = '', festName = '', people = [], picked = false, guest = true, meName = null } = {}) {
  const fest = festName || 'this festival';
  const label = crewName || 'Your crew';
  const buttons = guest
    ? { yes: WORDS.look, more: WORDS.how, join: WORDS.join }
    : { yes: WORDS.gotIt, more: WORDS.how, join: null };
  if (!people.length) return { label, line: WORDS.empty, sub: WORDS.emptySub, ...buttons };
  if (!picked) {
    // The only person here is the one reading it: their crew, in the second person.
    const mine = people.length === 1 && !guest && meName && people[0] === meName;
    const who = mine ? WORDS.yours(fest)
      : people.length === 1 ? WORDS.startedBy(people[0], fest)
        : WORDS.crewFor(fest);
    return { label, line: `${who} ${WORDS.nobodyPicked}`, sub: WORDS.firstSub, ...buttons };
  }
  return { label, line: WORDS.line(fest), sub: guest ? WORDS.colors : `${WORDS.colors} ${WORDS.memberNext}`, ...buttons };
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
  // "More info" is the explanation's last words, not a third button: the
  // card's choice is two doors of one width (the guest shelf round,
  // 2026-09-25 — the three-button row was the misalignment Kevin saw).
  const sub = node('div', 'bring-sub', `${copy.sub} `);
  const more = node('button', 'welcome-more', copy.more);
  sub.appendChild(more);
  text.append(node('div', 'bring-line', copy.line), sub);
  const actions = node('div', 'bring-actions');
  // Two halves: the way to pick on the LEFT, filled — the main action, where
  // the eye starts — and the quiet way to look on the right, outlined (Kevin,
  // 2026-09-25, flipping the round-3 frames). A member who has just joined
  // has the one door.
  const join = copy.join && onJoin ? node('button', 'btn-tonal welcome-join', copy.join) : null;
  const yes = node('button', join ? 'btn-ghost' : 'btn-tonal', copy.yes);
  if (join) actions.append(join);
  actions.append(yes);
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
    [join, yes].filter(Boolean).forEach((b, i) => b.animate(
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: CASCADE_MS, delay: after + i * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' },
    ));
  }

  yes.addEventListener('click', () => {
    rememberWelcomeSeen(); // the guest card's marker (a member knows the app now too); the just-joined card was marked when it showed
    dismissWelcome({ ctx });
    if (onGotIt) onGotIt();
  });
  // More info (the How it works page) leaves the card where it is: Settings hides it with the wall,
  // and coming back finds it still there for its quiet button — which is also the
  // moment anything waiting behind it (the bring-your-picks offer) may ask.
  more.addEventListener('click', () => { if (onHow) onHow(); });
  // "Pick shows": the ordinary join, with nothing waiting — the app
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
