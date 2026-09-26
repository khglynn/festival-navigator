// The people menu (2026-09-26 — Kevin at Portola: "rather than it scroll you
// to the top, it opens a little menu with the people and you can click to
// filter them … If you're scrolled to a specific part and want to filter,
// you don't want to go all the way to the top. Our lists are long").
// Design: claude-plans/2026-09-25-portola-live/design/people-shelf/BRIEF.md;
// build log: claude-plans/2026-09-26-unified-build/PEOPLE-BUILD.md.
//
// Your avatar, at the left of the dock (and of the laptop's day rail), opens
// HIGHLIGHT — the twin of the fest name's SHOW on the right, built from the
// same component: `.sort-pop`, the `.menu-label`, a real <button> per row
// (where the 44px floor comes from), the `.pop-div` line and the `.chev`.
// app.js opens and closes it through the Show menu's own open/close, so the
// two menus share one outside-tap rule, one Escape, one busy flag and no
// history entry (a popover is not a place — CLAUDE.md, "Browser history is
// shared state").
//
// While a highlight is on and the menu is shut, the avatar's slot is ONE
// pill: the highlighted faces and a ✕. The faces reopen the menu; the ✕
// clears, from anywhere in the wall.
//
// This module only draws: the rows, the pill, and the slot's motion. What a
// highlight IS (viewer-side, sessionStorage per fest per tab — filters.js),
// and what each door does, is app.js's. createElement only (XSS rule).
import { GROW_MS, OUT_MS, CASCADE_MS, STAGGER_MS, EASE_ARRIVE, EASE_LEAVE, EASE_SURFACE } from './motion.js';

const node = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// The words, in one place (Kevin's: "Highlight" is the verb — a highlight
// dims everyone else and never hides, so "filter" would promise the wrong
// thing; "Invite someone", not "Add someone", v93).
export const PEOPLE_WORDS = {
  label: 'Highlight',
  everyone: 'Everyone',
  you: 'you',
  pickAs: 'Pick as someone else',
  invite: 'Invite someone',
  join: 'Join the crew',
  plan: 'Our picks', // plan-rows.js PLAN_NAME: the row names what it opens
  menuName: 'Highlight people’s picks',
  avatar: (me) => (me ? `${me}: highlight people’s picks` : 'Highlight people’s picks, or join the crew'),
  faces: (names) => `Highlighting ${listOf(names)}. Open Highlight`,
  clear: 'Stop highlighting: show everyone’s picks',
};
function listOf(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ---- the menu ------------------------------------------------------------------------
// A row the Show menu's way (app.js showMenuRow): an <li> for packaging, a
// real button carrying the option role, a check column, the words, and a
// chevron where the row goes somewhere.
function row({ cls = '', check = null, mark = null, label, you = false, chev = false, selected = null }) {
  const li = node('li');
  li.setAttribute('role', 'presentation');
  const b = node('button', cls || null);
  b.type = 'button';
  b.setAttribute('role', 'option');
  if (selected != null) b.setAttribute('aria-selected', selected ? 'true' : 'false');
  const c = node('span', 'check');
  c.setAttribute('aria-hidden', 'true');
  if (mark) c.appendChild(mark);
  else if (check) c.textContent = check;
  const nm = node('span', 'nm', label);
  // "you" after your name, inside it: one baseline, and it follows the name
  // onto a second line if a long name wraps.
  if (you) nm.appendChild(node('span', 'you', PEOPLE_WORDS.you));
  b.append(c, nm);
  if (chev) {
    const v = node('span', 'chev', '›');
    v.setAttribute('aria-hidden', 'true');
    b.appendChild(v);
  }
  li.appendChild(b);
  return { li, b };
}

// A person's mark sits in the check column: their colour as a ring, filled,
// with a ✓, while they are highlighted.
function markFor(color, on) {
  const m = node('span', 'mark' + (on ? ' on' : ''));
  m.style.setProperty('--c', color);
  m.appendChild(node('span', 'tick', '✓'));
  return m;
}

export function buildHighlightMenu() {
  const pop = node('ul', 'sort-pop hl-pop');
  pop.setAttribute('role', 'listbox');
  pop.setAttribute('aria-label', PEOPLE_WORDS.menuName);
  pop.setAttribute('aria-multiselectable', 'true');
  pop.style.display = 'none';
  return pop;
}

// What a menu was drawn for: when the next paint asks for the same thing,
// the rows are repainted in place (a poll's repaint must not snatch the row
// under a finger or a keyboard's focus); otherwise they are drawn again.
const signatureOf = ({ people, me, guest, pickAs, invite, plan }) =>
  JSON.stringify([people.map((p) => [p.name, p.color]), me || '', !!guest, !!pickAs, !!invite, !!plan]);

// `people`: [{ name, color }] in the crew's order. `highlighted`: names.
// `plan`: Our plan's row — a function returning a row ({ li, b } from
// `menuActionRow`), or null while there is no plan to open. It slots in ABOVE
// Pick as someone else / Join the crew (the design: "Our picks ›" first —
// "Our plan ›" when it was drawn — in tonal text). The signature reads whether it is there, so a plan arriving
// or leaving draws the menu again.
// `animate`: a mark that turns on or off moves (never under Reduce Motion or
// Low Power — the caller asks canAnimate).
export function paintHighlightMenu(pop, opts) {
  const { people = [], me = null, guest = false, highlighted = [], pickAs = false, invite = false, plan = null,
    animate = false, on = {} } = opts;
  const lit = new Set(highlighted);
  const signature = signatureOf({ people, me, guest, pickAs, invite, plan });
  if (pop.dataset.people === signature) {
    // In place: the checks and the marks only.
    for (const b of pop.querySelectorAll('[data-person]')) {
      const name = b.dataset.person;
      const sel = name ? lit.has(name) : lit.size === 0;
      setSelected(b, sel, animate);
    }
    return pop;
  }
  // A redraw under an open menu (someone joined, the plan came or went)
  // keeps a keyboard where it was: the same row if it is still drawn, else
  // the menu's first row — never the page.
  const f = pop.ownerDocument.activeElement;
  const was = f && f !== pop && pop.contains(f) ? rowKey(f) : null;
  pop.dataset.people = signature;
  pop.textContent = '';
  const head = node('li', 'menu-label', PEOPLE_WORDS.label);
  head.setAttribute('role', 'presentation');
  pop.appendChild(head);
  const every = row({ cls: 'hl-row everyone', check: lit.size ? '' : '✓', label: PEOPLE_WORDS.everyone, selected: lit.size === 0 });
  every.b.dataset.person = '';
  every.b.addEventListener('click', () => on.everyone && on.everyone());
  pop.appendChild(every.li);
  for (const p of people) {
    const sel = lit.has(p.name);
    const r = row({ cls: 'hl-row', mark: markFor(p.color, sel), label: p.name, you: !guest && p.name === me, selected: sel });
    r.b.dataset.person = p.name;
    r.b.addEventListener('click', () => on.toggle && on.toggle(p.name));
    pop.appendChild(r.li);
  }
  const div = node('li', 'pop-div');
  div.setAttribute('role', 'presentation');
  div.setAttribute('aria-hidden', 'true');
  pop.appendChild(div);
  // ---- Our plan's place (the Our plan build fills it; see `plan` above) ----
  const planRow = typeof plan === 'function' ? plan() : null;
  if (planRow && planRow.li) pop.appendChild(planRow.li);
  // ---- the ways on ----
  if (guest) {
    const j = menuActionRow({ label: PEOPLE_WORDS.join, chev: true, act: 'join' });
    j.b.addEventListener('click', () => on.join && on.join());
    pop.appendChild(j.li);
  } else {
    if (pickAs) {
      const s = menuActionRow({ label: PEOPLE_WORDS.pickAs, chev: true, act: 'pick-as' });
      s.b.addEventListener('click', () => on.pickAs && on.pickAs());
      pop.appendChild(s.li);
    }
    if (invite) {
      const i = menuActionRow({ label: PEOPLE_WORDS.invite, check: '+', act: 'invite' });
      i.b.addEventListener('click', () => on.invite && on.invite());
      pop.appendChild(i.li);
    }
  }
  if (was != null) {
    const rows = [...pop.querySelectorAll('button')];
    const again = rows.find((b) => rowKey(b) === was) || rows[0];
    if (again) again.focus({ preventScroll: true });
  }
  return pop;
}
// A row's identity across redraws: a person (Everyone is the empty name) or
// an action.
const rowKey = (b) => (b.dataset.act ? `act:${b.dataset.act}` : b.dataset.person != null ? `person:${b.dataset.person}` : null);

// An action row below the line — exported for Our plan's row, so it is drawn
// the same way as its neighbours.
export function menuActionRow({ label, chev = false, check = null, act = '', cls = '' }) {
  const r = row({ cls: `hl-act${cls ? ` ${cls}` : ''}`, check, label, chev });
  if (check === '+') r.b.querySelector('.check').classList.add('plus');
  if (act) r.b.dataset.act = act;
  return r;
}

function setSelected(b, sel, animate) {
  const was = b.getAttribute('aria-selected') === 'true';
  b.setAttribute('aria-selected', sel ? 'true' : 'false');
  if (was === sel) return;
  const mark = b.querySelector('.mark');
  const check = b.querySelector('.check');
  if (mark) {
    mark.classList.toggle('on', sel);
    const tick = mark.querySelector('.tick');
    // The ✓ grows in on the arrival curve; going out is quick and plain.
    if (animate && tick && typeof tick.animate === 'function') {
      tick.animate(sel
        ? [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }]
        : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)' }],
      { duration: sel ? CASCADE_MS : OUT_MS, easing: sel ? EASE_ARRIVE : EASE_LEAVE });
    }
    return;
  }
  // Everyone's plain ✓, the Show menu's way.
  if (sel) {
    check.textContent = '✓';
    if (animate && typeof check.animate === 'function') {
      check.animate([{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'none' }], { duration: CASCADE_MS, easing: EASE_ARRIVE });
    }
  } else if (animate && typeof check.animate === 'function' && check.textContent) {
    const a = check.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT_MS, easing: EASE_LEAVE });
    const clear = () => { if (b.getAttribute('aria-selected') !== 'true') check.textContent = ''; };
    a.onfinish = clear;
    a.oncancel = clear;
  } else check.textContent = '';
}

// Where each highlighted person's mark is, for the pill's faces to travel
// from (and back to).
export function markRects(pop, names) {
  const out = new Map();
  if (!pop || pop.style.display === 'none') return out;
  for (const n of names) {
    const b = [...pop.querySelectorAll('[data-person]')].find((x) => x.dataset.person === n);
    const m = b && b.querySelector('.mark');
    if (m) out.set(n, m.getBoundingClientRect());
  }
  return out;
}

// ---- the pill ------------------------------------------------------------------------
// Up to three discs, overlapping: past the cap, the faces that fit and a +n
// for the rest (the welcome card's count, solid — dashed means "add"). The
// cap is three where the dock has the room, fewer where a third (or second)
// disc would take the day you are in or NOW out of the day row — at 320 with
// NOW live, three discs push NOW out; ACL's long name leaves room for one
// (app.js pillCap measures it; PEOPLE-BUILD.md). One disc for several
// people is their count, bare.
export const PILL_FACES = 3;
export function pillFaces(people, cap = PILL_FACES) {
  const k = Math.max(1, Math.min(PILL_FACES, cap));
  if (people.length <= k) return { faces: people, more: 0 };
  return { faces: people.slice(0, k - 1), more: people.length - (k - 1) };
}
// The pill's width with `discs` discs, from v3.css: 3.5px padding each side,
// 20px discs overlapping 6px, and the ✕'s 20px. `0` is the pill folded to
// the avatar's own 26px — one disc in the ring, no ✕ — for a dock with no
// room even for one disc and a ✕ (app.js pillCap). The browser contract
// (tests/browser/people-menu.test.mjs) holds this to the drawn width.
export const pillWidth = (discs) => (discs <= 0 ? 26 : 7 + 20 + 14 * (discs - 1) + 20);

export function ensurePill(wrap, { onFaces, onClear } = {}) {
  let pill = wrap.querySelector(':scope > .hl-pill');
  if (pill) return pill;
  pill = node('span', 'hl-pill');
  const bg = node('span', 'hl-bg'); // the body, clipped as it opens (v3.css)
  bg.setAttribute('aria-hidden', 'true');
  const faces = node('button', 'hl-faces');
  faces.type = 'button';
  faces.setAttribute('aria-haspopup', 'listbox');
  faces.setAttribute('aria-expanded', 'false');
  const x = node('button', 'hl-x', '✕');
  x.type = 'button';
  x.setAttribute('aria-label', PEOPLE_WORDS.clear);
  faces.addEventListener('click', () => onFaces && onFaces());
  x.addEventListener('click', () => onClear && onClear());
  pill.append(bg, faces, x);
  // After the avatar, before the menu: the menu stays the wrap's last child.
  const you = wrap.querySelector(':scope > .you-avatar');
  if (you) you.after(pill); else wrap.prepend(pill);
  return pill;
}

// `people`: [{ name, bg, stroke }] — the highlighted, in the crew's order.
function paintFaces(pill, people, cap) {
  const faces = pill.querySelector('.hl-faces');
  // Folded to the avatar's size: the faces still open the menu, whose
  // Everyone clears; the ✕ waits for a dock with room for it.
  if (cap <= 0) pill.dataset.compact = ''; else delete pill.dataset.compact;
  const { faces: shown, more } = pillFaces(people, cap);
  const have = new Map([...faces.querySelectorAll('.avatar[data-name]')].map((a) => [a.dataset.name, a]));
  const kids = [];
  for (const p of shown) {
    const a = have.get(p.name) || node('span', 'avatar');
    a.dataset.name = p.name;
    a.textContent = p.name.charAt(0).toUpperCase();
    a.style.background = p.bg;
    a.style.border = `1px solid ${p.stroke}`;
    a.setAttribute('aria-hidden', 'true');
    kids.push(a);
  }
  if (more) {
    const m = faces.querySelector('.avatar.more') || node('span', 'avatar more');
    m.textContent = shown.length ? `+${more}` : String(more);
    m.setAttribute('aria-hidden', 'true');
    kids.push(m);
  }
  faces.replaceChildren(...kids);
  faces.setAttribute('aria-label', PEOPLE_WORDS.faces(people.map((p) => p.name)));
}

// ---- the slot: avatar ↔ pill, and the motion between them ------------------------------
// The wrap says which it is (`data-slot`); v3.css shows one and hides the
// other. Returns true when the slot's WIDTH changed — the caller then brings
// its day row to rest and slides the tabs (app.js slideTabs, the existing
// FLIP), because the row, not this module, owns the tabs.
//
// `sources`: Map name → a rect the faces travel FROM (the menu's marks on a
// close); without one a new face grows where it lands. `animate` is the
// caller's canAnimate. The storyboard (PEOPLE-BUILD.md §C, D, F) in order.
export function setSlot(wrap, { pill: want, people = [], cap = PILL_FACES, sources = null, animate = false }) {
  const you = wrap.querySelector(':scope > .you-avatar');
  const pill = wrap.querySelector(':scope > .hl-pill');
  if (!you || !pill) return false;
  const was = wrap.dataset.slot === 'pill';
  const wasW = wrap.getBoundingClientRect().width;
  const oldFaces = new Map([...pill.querySelectorAll('.hl-faces .avatar')].map((a) => [a.dataset.name || '+', a.getBoundingClientRect()]));
  // A ghost of whatever is leaving, drawn where it stood, so it can go
  // somewhere instead of vanishing in place.
  const ghostOf = (el) => {
    if (!animate || !el || typeof el.animate !== 'function') return null;
    const r = el.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    if (!r.width) return null;
    const g = el.cloneNode(true);
    g.removeAttribute('id');
    g.classList.add('hl-ghost');
    g.setAttribute('aria-hidden', 'true');
    g.inert = true;
    for (const b of g.querySelectorAll('button')) b.tabIndex = -1;
    g.style.left = `${r.left - w.left}px`;
    g.style.top = `${r.top - w.top}px`;
    g.style.width = `${r.width}px`;
    g.style.height = `${r.height}px`;
    wrap.appendChild(g);
    return g;
  };
  const leaving = was && !want ? ghostOf(pill) : !was && want ? ghostOf(you) : null;
  if (want) paintFaces(pill, people, cap);
  // Focus follows the door that is still there (a keyboard on the ✕ or the
  // faces lands on the avatar, and the other way round).
  const focusIn = (el) => el && el.contains(document.activeElement);
  const hadPillFocus = was && !want && focusIn(pill);
  const hadYouFocus = !was && want && document.activeElement === you;
  wrap.dataset.slot = want ? 'pill' : 'avatar';
  if (hadPillFocus) try { you.focus({ preventScroll: true }); } catch { /* not focusable */ }
  if (hadYouFocus) try { pill.querySelector('.hl-faces').focus({ preventScroll: true }); } catch { /* not focusable */ }
  const nowW = wrap.getBoundingClientRect().width;
  if (!animate) {
    if (leaving) leaving.remove();
    return Math.abs(nowW - wasW) >= 0.5;
  }
  const gone = (g) => () => g.remove();
  if (want) {
    // The pill: opening from the avatar's circle (or from its own old width)
    // to its full width, from the left; the faces travelling in; the ✕ last.
    const pw = pill.getBoundingClientRect().width;
    const fromW = was ? wasW : Math.min(pw, you.offsetWidth || 26);
    // Its right edge moves in step with the day row's tabs (app.js slideTabs:
    // CASCADE, the arrival curve), so the two never overlap and never part.
    if (Math.abs(pw - fromW) >= 0.5) {
      pill.querySelector('.hl-bg').animate([{ clipPath: `inset(0 ${pw - fromW}px 0 0 round 999px)` }, { clipPath: 'inset(0 0 0 0 round 999px)' }],
        { duration: CASCADE_MS, easing: EASE_ARRIVE });
    }
    [...pill.querySelectorAll('.hl-faces .avatar')].forEach((a, i) => {
      const key = a.dataset.name || '+';
      const to = a.getBoundingClientRect();
      const from = (sources && sources.get(key)) || oldFaces.get(key) || null;
      if (from && from.width) {
        const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
        const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
        const k = from.width / to.width;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(k - 1) < 0.01) return;
        a.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${k})` }, { transform: 'none' }],
          { duration: GROW_MS, delay: i * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' });
      } else {
        a.animate([{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'none' }],
          { duration: GROW_MS, delay: i * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' });
      }
    });
    if (!was) {
      pill.querySelector('.hl-x').animate([{ opacity: 0, transform: 'translateX(-4px)' }, { opacity: 1, transform: 'none' }],
        { duration: CASCADE_MS, delay: GROW_MS / 2, easing: EASE_ARRIVE, fill: 'backwards' });
    }
    if (leaving) {
      // The letter steps back where it stood as the pill opens over it.
      // Gone before the first face lands on it.
      const a = leaving.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)' }],
        { duration: OUT_MS * 0.7, easing: EASE_LEAVE, fill: 'forwards' });
      a.onfinish = gone(leaving);
      a.oncancel = gone(leaving);
    }
  } else if (leaving) {
    // The pill closes into the slot's circle, its faces shrinking toward it,
    // and your letter grows back a beat later.
    // Its right edge closes in step with the tabs coming back (slideTabs'
    // way out: CASCADE, the surface curve); it fades over the second half.
    const lw = leaving.getBoundingClientRect().width;
    const toW = you.offsetWidth || 26;
    const a = leaving.querySelector('.hl-bg').animate([
      { clipPath: 'inset(0 0 0 0 round 999px)' },
      { clipPath: `inset(0 ${Math.max(0, lw - toW)}px 0 0 round 999px)` },
    ], { duration: CASCADE_MS, easing: EASE_SURFACE, fill: 'forwards' });
    a.onfinish = gone(leaving);
    a.oncancel = gone(leaving);
    // The ✕ goes first (the tabs are coming for its place), the faces shrink
    // toward the circle as it closes, and the body fades at the end.
    leaving.querySelector('.hl-x').animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-6px)' }],
      { duration: OUT_MS / 2, easing: EASE_LEAVE, fill: 'forwards' });
    leaving.querySelectorAll('.hl-faces .avatar').forEach((f, i) => f.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-4 - i * 6}px) scale(.4)` }],
      { duration: OUT_MS, easing: EASE_LEAVE, fill: 'forwards' }));
    leaving.querySelector('.hl-bg').animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }],
      { duration: CASCADE_MS, easing: 'linear', fill: 'forwards' });
    you.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }],
      { duration: GROW_MS, delay: STAGGER_MS * 2, easing: EASE_ARRIVE, fill: 'backwards' });
  }
  return Math.abs(nowW - wasW) >= 0.5;
}

// The marks, when the menu opens from the pill: each travels up from where
// its face was (the storyboard's E).
export function marksFromFaces(pop, faceRects, animate) {
  if (!animate || !faceRects || !faceRects.size) return;
  let i = 0;
  for (const b of pop.querySelectorAll('[data-person]')) {
    const from = faceRects.get(b.dataset.person);
    const m = b.querySelector('.mark');
    if (!from || !m || typeof m.animate !== 'function') continue;
    const to = m.getBoundingClientRect();
    if (!to.width) continue;
    const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
    const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
    m.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})` }, { transform: 'none' }],
      { duration: GROW_MS, delay: i * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' });
    i += 1;
  }
}
export function faceRects(wrap) {
  const out = new Map();
  if (!wrap || wrap.dataset.slot !== 'pill') return out;
  for (const a of wrap.querySelectorAll(':scope > .hl-pill .hl-faces .avatar[data-name]')) out.set(a.dataset.name, a.getBoundingClientRect());
  return out;
}
