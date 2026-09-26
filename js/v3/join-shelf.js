// The join shelf (v92, the guest shelf round — Kevin's review, 2026-09-25:
// "footer shelves?", "being slid into picking feels meh").
//
// A guest who wants to pick is asked who they are on a shelf that rises over
// the wall, never a screen that replaces it: the wall stays exactly where it
// was (dimmed, behind), so "Look around" is just the shelf going back down,
// and a join lands the pick on a card you can still see. It is the production
// bottom sheet — grabber, 20px top corners, dock ground, .45 backdrop, and the
// sheet ids every closing path, the router and the new-build reload's quiet()
// already know — sized to its content.
//
// This module draws the shelf and keeps its state (nobody chosen, a name
// tapped, a name typed, busy while an answer settles). The answers themselves
// — claim a name, join as someone new, the deadline, the offline join, the
// waiting pick — are app.js's joinAnswers, the same code the full-screen join
// screen runs. Claiming takes two taps on purpose (the name, then "I'm Maya"):
// one tap to claim is how friends ended up picking as somebody else.
import { GROW_MS, OUT_MS, CASCADE_MS, STAGGER_MS, EASE_ARRIVE, EASE_LEAVE, EASE_SURFACE, canAnimate } from './motion.js';
import { focusQuietly } from './card-facts.js';
import { rideKeys } from './notes.js';

// `line` names the artist the guest touched and what the tap meant: + (or a
// card) is a pick, and the pick lands after the join; − and the notes door
// only join, so their line promises nothing more (Kevin, 2026-09-25).
export const SHELF_WORDS = {
  line: (artist, intent = 'pick') => (!artist ? ['Pick shows as…']
    : intent === 'pick' ? ['Pick ', artist, ' as…']
      : ['Join the plan for ', artist, ' as…']),
  label: (artist, intent = 'pick') => SHELF_WORDS.line(artist, intent).join('').replace(/…$/, ''),
  sub: 'Tap your name, or add yourself.',
  subOffline: 'You’re offline — join anyway, it sends when you’re back.',
  field: 'Add your name',
  look: 'Look around',
  join: 'Join',
  joinAs: (name) => `Join as ${name}`,
  claim: (name) => `I’m ${name}`,
};

const SHEET_ID = 'artist-sheet';   // the production sheet's id: closeSheet, quiet() and the waiters know it
const BACK_ID = 'sheet-backdrop';
const DRAG_CLOSE_PX = 70;          // the grabber's swipe, as the notes sheets have it
const SETTLE_MS = 700;             // the dimmed wall under a just-risen shelf is not a door yet (card-facts.js DOOR_SETTLE_MS)

function node(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export function joinShelf() {
  const sheet = document.getElementById(SHEET_ID);
  return sheet && sheet.classList.contains('join-shelf') ? sheet : null;
}

// people: [{ name, bg, stroke }] in the crew's order. Returns the shelf's
// handle: setBusy(on) holds every door while an answer settles, say(text or
// node) writes the status line, close({ instant }) takes it down.
// `opener`: where keyboard focus goes back to when the shelf closes (the
// review of 963e599: closing it dropped focus to <body>).
export function showJoinShelf({ artist = null, intent = 'pick', people = [], offline = false, ctx = null, opener = null, onLook, onClaim, onAnswer } = {}) {
  document.getElementById(SHEET_ID)?.remove();
  document.getElementById(BACK_ID)?.remove();
  const back = node('div', 'sheet-backdrop join-backdrop');
  back.id = BACK_ID;
  const sheet = node('div', 'sheet join-shelf');
  sheet.id = SHEET_ID;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', SHELF_WORDS.label(artist, intent));
  sheet.tabIndex = -1;
  const grab = node('div', 'grabber');

  const head = node('div', 'js-head');
  const line = node('div', 'js-line');
  const parts = SHELF_WORDS.line(artist, intent);
  if (artist) line.append(parts[0], node('b', null, parts[1]), parts[2]);
  else line.textContent = parts[0];
  const sub = node('div', 'js-sub' + (offline ? ' offline' : ''), offline ? SHELF_WORDS.subOffline : SHELF_WORDS.sub);
  head.append(line, sub);

  const names = node('div', 'js-names');
  names.setAttribute('role', 'group');
  names.setAttribute('aria-label', 'The crew');
  const chips = people.map((p) => {
    const b = node('button', 'person-chip js-name');
    b.style.background = p.bg;
    b.style.border = `1px solid ${p.stroke}`;
    b.dataset.name = p.name;
    b.setAttribute('aria-pressed', 'false');
    b.append(node('span', 'js-initial', p.name.charAt(0).toUpperCase()), node('span', 'js-nm', p.name));
    names.appendChild(b);
    return b;
  });
  const namesWrap = node('div', 'js-names-wrap');
  namesWrap.appendChild(names);
  if (!people.length) namesWrap.hidden = true; // nobody in the crew yet: just the field

  const field = node('input', 'js-field');
  field.maxLength = 24;
  field.placeholder = SHELF_WORDS.field;
  field.setAttribute('aria-label', 'Your name');
  field.autocomplete = 'off';
  field.setAttribute('autocapitalize', 'words');
  field.setAttribute('enterkeyhint', 'go');

  const status = node('div', 'js-status');
  status.setAttribute('aria-live', 'polite');

  // The answer first, on the left — "Join as Sam" — and the quiet way out on
  // the right: the welcome card's order (Kevin, 2026-09-25).
  const actions = node('div', 'js-actions');
  const look = node('button', 'btn-ghost js-look', SHELF_WORDS.look);
  const go = node('button', 'btn-tonal js-go', SHELF_WORDS.join);
  actions.append(go, look);

  sheet.append(grab, head, namesWrap, field, status, actions);
  document.body.append(back, sheet);

  // ---- state: nobody, a name tapped, a name typed; busy while an answer settles ----
  let chosen = null; // a crew name, tapped
  let busy = false;
  let closed = false;
  const typedMatch = () => {
    const typed = field.value.trim();
    return typed ? people.find((p) => p.name.toLowerCase() === typed.toLowerCase()) || null : null;
  };
  const paint = () => {
    const typed = field.value.trim();
    const match = typedMatch();
    const who = chosen || (match && match.name) || null;
    for (const c of chips) {
      c.classList.toggle('on', c.dataset.name === who);
      c.classList.toggle('off', !!who && c.dataset.name !== who);
      c.setAttribute('aria-pressed', c.dataset.name === who ? 'true' : 'false');
      c.disabled = busy;
    }
    field.disabled = busy;
    look.disabled = busy;
    if (who) go.textContent = SHELF_WORDS.claim(who);
    else if (typed) go.textContent = SHELF_WORDS.joinAs(typed);
    else go.textContent = SHELF_WORDS.join;
    go.disabled = busy || (!who && !typed);
  };
  chips.forEach((c) => c.addEventListener('click', () => {
    if (busy) return;
    chosen = chosen === c.dataset.name ? null : c.dataset.name;
    if (chosen) field.value = '';
    status.textContent = '';
    paint();
  }));
  field.addEventListener('input', () => { chosen = null; status.textContent = ''; paint(); });
  field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
  go.addEventListener('click', () => {
    if (busy) return;
    const match = typedMatch();
    const who = chosen || (match && match.name);
    if (who) { if (onClaim) onClaim(who); return; }
    const typed = field.value.trim();
    if (typed && onAnswer) onAnswer(typed);
  });
  paint();

  // ---- the keyboard ------------------------------------------------------------------
  // The names give way to the field — one sideways line instead of rows, the
  // same height for 6 people or 12 — and the shelf rides on top of the keys
  // (notes.js rideKeys: one ride for every sheet, the notes shelf's too).
  field.addEventListener('focus', () => sheet.classList.add('typing'));
  field.addEventListener('blur', () => sheet.classList.remove('typing'));
  const unfit = rideKeys(sheet);

  // More names than three rows hold: a soft fade says the list goes on.
  const edge = () => namesWrap.classList.toggle('more', !sheet.classList.contains('typing')
    && names.scrollHeight - names.clientHeight - names.scrollTop > 2);
  names.addEventListener('scroll', edge, { passive: true });
  field.addEventListener('focus', edge);
  field.addEventListener('blur', edge);
  requestAnimationFrame(edge);
  setTimeout(edge, GROW_MS + CASCADE_MS + STAGGER_MS * (people.length + 3)); // after the names have landed

  // ---- the ways out ------------------------------------------------------------------
  const close = ({ instant = false } = {}) => {
    if (closed) return;
    closed = true;
    unfit();
    sheet.removeAttribute('id');
    back.removeAttribute('id');
    // Focus goes back where it came from — only if it is still inside the
    // shelf (a close that the person started elsewhere keeps their focus).
    if (sheet.contains(document.activeElement) || document.activeElement === document.body) {
      // Quietly: handed back, never read as keyboard navigation (card-facts.js).
      if (opener && opener.isConnected) focusQuietly(opener);
    }
    const gone = () => { sheet.remove(); back.remove(); };
    if (instant || !canAnimate(sheet, ctx)) { gone(); return; }
    sheet.style.pointerEvents = 'none';
    back.style.pointerEvents = 'none';
    back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' });
    const out = sheet.animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' });
    out.onfinish = gone;
    out.oncancel = gone;
    setTimeout(gone, OUT_MS * 3 + 50); // a backgrounded tab must not leave the shelf behind
  };
  // Look around, a tap on the dimmed wall, or the handle dragged down: the
  // question is dropped and the shelf goes back down. Never while an answer
  // is settling — the answer decides where this goes.
  const leave = () => {
    if (busy || closed) return;
    close();
    if (onLook) onLook();
  };
  look.addEventListener('click', leave);
  // The dimmed wall is where the finger WAS a beat ago: the shelf this
  // question replaced (a notes shelf's +, a zoom's door) stood there, and a
  // quick second press meant for it must not drop the question it just
  // raised (the review of the tap change: + + as a guest put the question
  // away). The zoom's DOOR_SETTLE beat, the same still-hand law. Look around,
  // the handle and Escape are always the way out.
  const bornAt = typeof performance !== 'undefined' ? performance.now() : 0;
  back.addEventListener('click', () => {
    if (typeof performance !== 'undefined' && performance.now() - bornAt < SETTLE_MS) return;
    leave();
  });
  let startY = null;
  grab.addEventListener('pointerdown', (e) => { startY = e.clientY; try { grab.setPointerCapture(e.pointerId); } catch { /* synthetic */ } });
  grab.addEventListener('pointermove', (e) => {
    if (startY === null || busy) return;
    sheet.style.transform = `translateY(${Math.max(0, e.clientY - startY)}px)`;
  });
  const release = (e) => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    startY = null;
    sheet.style.transform = '';
    if (dy > DRAG_CLOSE_PX) leave();
  };
  grab.addEventListener('pointerup', release);
  grab.addEventListener('pointercancel', () => { startY = null; sheet.style.transform = ''; });

  // Tab stays inside the shelf while it is up (the sheets' dialog rule) —
  // from the shelf itself, where focus starts, too: Shift+Tab from there used
  // to walk out onto the wall behind (the review of 963e599). While an answer
  // settles every door is disabled, and Tab stays put.
  sheet.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...sheet.querySelectorAll('button, input')].filter((n) => !n.disabled);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0];
    const last = f[f.length - 1];
    const at = f.indexOf(document.activeElement);
    if (at < 0) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
    if (e.shiftKey && at === 0) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === f.length - 1) { e.preventDefault(); first.focus(); }
  });
  requestAnimationFrame(() => { if (!closed) sheet.focus({ preventScroll: true }); });

  // ---- the way in --------------------------------------------------------------------
  // The wall dims as the shelf rises from the bottom edge on the arrival
  // curve; its lines land a beat apart and the names arrive one after another.
  // Reduce Motion / Low Power: already there.
  if (canAnimate(sheet, ctx)) {
    back.animate([{ opacity: 0 }, { opacity: 1 }], { duration: GROW_MS, easing: 'ease-out', fill: 'backwards' });
    // The box on the surface curve, never past its rest (an overshoot lifts
    // its bottom edge off the screen's for a few frames); the lines keep the
    // arrival's life — the notes shelf rises the same way (notes.js arrive).
    sheet.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: GROW_MS, easing: EASE_SURFACE, fill: 'backwards' });
    [head, ...chips, field, actions].forEach((n, i) => n.animate(
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: CASCADE_MS, delay: GROW_MS / 2 + i * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' },
    ));
  }

  return {
    sheet,
    setBusy(on) { busy = !!on; paint(); },
    isBusy: () => busy,
    // The one close decision every way out shares (app.js leaveShelf):
    // refused while an answer is in flight — that answer decides where this
    // goes. True when the shelf went down.
    leave() { if (busy || closed) return false; close(); return true; },
    say(x) {
      if (x == null || typeof x === 'string') status.textContent = x || '';
      else status.replaceChildren(x);
    },
    close,
    isClosed: () => closed,
  };
}
