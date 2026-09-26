// People behind your avatar — the prototype, run INSIDE the real v92 app
// (2026-09-25). The Highlight menu is built from the Show menu's own
// component (.sort-pop and its row buttons); the claim step is the real join
// shelf (showJoinShelf); the highlight itself is the app's real people filter,
// seeded by the rig, so every dimmed card on a frame is the wall's own dim.
import * as state from '../../../../js/state.js';
import { colorIndexOf } from '../../../../js/v3/wall.js';
import { hslOf, strokeOf } from '../../../../js/v3/palette.js';
import { showJoinShelf } from '../../../../js/v3/join-shelf.js';

const ME = 'Ana';
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const FID = 'portola-2026';

export async function ensureCss() {
  if (document.getElementById('ps-css')) return;
  const l = document.createElement('link');
  l.id = 'ps-css';
  l.rel = 'stylesheet';
  l.href = new URL('./proto.css', import.meta.url).href;
  const done = new Promise((r) => { l.onload = r; });
  document.head.appendChild(l);
  await done;
}
const highlighted = () => { try { return JSON.parse(sessionStorage.getItem(`fn_filter_people_v1_${FID}`) || '[]'); } catch { return []; } };
const colourOf = (name) => { const p = state.people()[name]; const ci = colorIndexOf(name, p); return { ci, bg: hslOf(ci, 0.5), full: hslOf(ci, 1), stroke: strokeOf(ci, name === ME) }; };

// The mobile "after": the people row leaves the top of the wall.
export async function after() { await ensureCss(); document.body.classList.add('ps-after'); }

// A row the Show menu's way: a real <button role="option"> in an <li>, a
// check column, a label, an optional chevron.
function row({ check = '', mark = null, label, you = false, selected = null, chev = false, cls = '' }) {
  const li = mk('li');
  li.setAttribute('role', 'presentation');
  const b = mk('button', cls || null);
  b.type = 'button';
  b.setAttribute('role', 'option');
  if (selected != null) b.setAttribute('aria-selected', selected ? 'true' : 'false');
  const c = mk('span', 'check' + (check === '+' ? ' plus' : ''));
  c.setAttribute('aria-hidden', 'true');
  if (mark) c.appendChild(mark); else c.textContent = check;
  const t = mk('span', 'nm', label);
  if (you) t.appendChild(mk('span', 'you', 'you'));
  b.append(c, t);
  if (chev) { const v = mk('span', 'chev', '›'); v.setAttribute('aria-hidden', 'true'); b.appendChild(v); }
  li.appendChild(b);
  return li;
}

// The Highlight menu, from the avatar: the Show menu's twin.
export async function highlightMenu({ guest = false } = {}) {
  await ensureCss();
  document.querySelectorAll('.hl-wrap .sort-pop').forEach((e) => e.remove());
  const you = document.getElementById('dock-you');
  let wrap = you.closest('.hl-wrap');
  if (!wrap) { wrap = mk('span', 'sort-wrap hl-wrap'); you.before(wrap); wrap.appendChild(you); }
  const on = new Set(highlighted());
  const pop = mk('ul', 'sort-pop hl-pop');
  pop.setAttribute('role', 'listbox');
  pop.setAttribute('aria-label', 'Highlight people');
  pop.setAttribute('aria-multiselectable', 'true');
  const head = mk('li', 'pop-head', 'Highlight');
  head.setAttribute('role', 'presentation');
  pop.appendChild(head);
  pop.appendChild(row({ check: on.size ? '' : '✓', label: 'Everyone', selected: !on.size }));
  for (const [name] of state.activePeople()) {
    const sel = on.has(name);
    const m = mk('span', 'mark' + (sel ? ' on' : ''), sel ? '✓' : '');
    m.style.setProperty('--c', colourOf(name).full);
    pop.appendChild(row({ mark: m, label: name, you: !guest && name === ME, selected: sel }));
  }
  const div = mk('li', 'pop-div');
  div.setAttribute('role', 'presentation');
  pop.appendChild(div);
  pop.appendChild(row({ label: 'Our plan', chev: true, cls: 'act plan' }));
  if (guest) {
    pop.appendChild(row({ label: 'Join the crew', chev: true, cls: 'act' }));
  } else {
    pop.appendChild(row({ label: 'Pick as someone else', chev: true, cls: 'act' }));
    pop.appendChild(row({ check: '+', label: 'Add someone', cls: 'act' }));
  }
  wrap.appendChild(pop);
  const fest = document.getElementById('dock-fest-wrap');
  if (fest) {
    const gap = wrap.getBoundingClientRect().top - fest.getBoundingClientRect().top;
    pop.style.bottom = `calc(100% + ${8 + Math.round(gap)}px)`;
  }
  you.classList.add('open');
  you.setAttribute('aria-expanded', 'true');
  return pop.getBoundingClientRect().toJSON();
}

// The right menu, opened the production way (a tap on the fest name).
export function showMenu() {
  const link = document.getElementById('dock-fest-link');
  link.click();
  const pop = document.querySelector('#dock-fest-wrap .sort-pop');
  return pop ? pop.getBoundingClientRect().toJSON() : null;
}

// Highlight on, menu closed: the avatar slot becomes the faces and a ✕.
export async function pill() {
  await ensureCss();
  document.querySelectorAll('.hl-pill').forEach((e) => e.remove());
  const you = document.getElementById('dock-you');
  const names = highlighted();
  const p = mk('span', 'hl-pill');
  const faces = mk('button', 'faces');
  faces.type = 'button';
  faces.setAttribute('aria-label', `Highlighting ${names.join(' and ')}: open Highlight`);
  for (const n of names.slice(0, 3)) {
    const c = colourOf(n);
    const a = mk('span', 'avatar', n.charAt(0).toUpperCase());
    a.style.background = c.bg;
    a.style.border = `1px solid ${c.stroke}`;
    faces.appendChild(a);
  }
  const x = mk('button', 'x', '✕');
  x.type = 'button';
  x.setAttribute('aria-label', 'Show everyone again');
  p.append(faces, x);
  you.style.display = 'none';
  you.after(p);
  // The day row gets back whatever the pill does not take; re-centre the day.
  const days = document.getElementById('dock-days');
  const act = days && days.querySelector('.day-tab.active');
  if (act) { const r = days.getBoundingClientRect(); const a = act.getBoundingClientRect(); days.scrollLeft += (a.left + a.width / 2) - (r.left + r.width / 2); }
  return p.getBoundingClientRect().toJSON();
}

// "Pick as someone else": the join shelf's own claim step (the real
// component), with the member's words where a guest's would be — and a name
// tapped, so the frame shows the step's answer ("I'm Ben").
export async function pickAs({ tap = 'Ben' } = {}) {
  await ensureCss();
  const people = state.activePeople().map(([name]) => { const c = colourOf(name); return { name, bg: c.bg, stroke: strokeOf(c.ci, false) }; });
  showJoinShelf({ people, onLook() {}, onClaim() {}, onAnswer() {} });
  await new Promise((r) => setTimeout(r, 450));
  const sheet = document.getElementById('artist-sheet');
  sheet.querySelector('.js-look').textContent = `Stay ${ME}`;
  sheet.querySelector('.js-sub').textContent = 'Tap a name, then confirm.';
  const me = sheet.querySelector(`.js-name[data-name="${ME}"]`);
  if (me) me.appendChild(mk('span', 'js-you', ' · you'));
  const chip = sheet.querySelector(`.js-name[data-name="${tap}"]`);
  if (chip) chip.click();
  return sheet.getBoundingClientRect().toJSON();
}

export function cap(text) {
  document.querySelectorAll('.ps-cap').forEach((e) => e.remove());
  if (text) document.body.appendChild(mk('div', 'ps-cap', text));
}
