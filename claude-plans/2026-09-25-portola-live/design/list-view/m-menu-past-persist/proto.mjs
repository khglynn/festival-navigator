// The Show menu's View + Past, and the past fold — a prototype run INSIDE the
// real app (list-view round, 2026-09-26). Nothing here is production code; it
// reads the app's own modules (the clock, nightMinutes) so the rule it draws
// is the rule a builder would write, and it only ever adds to the DOM the app
// already painted.
import { festivalClock } from '/js/v3/now.js';
import { nightMinutes } from '/js/v3/wall.js';

const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const NS = 'http://www.w3.org/2000/svg';
function glyph(kind) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 12 12'); s.setAttribute('width', '12'); s.setAttribute('height', '12');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.4');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', `g-${kind}`);
  const d = {
    board: 'M1.5 1.5v9M6 1.5v5M10.5 1.5v7', // three stage columns of different lengths
    list: 'M1.5 2.5h9M1.5 6h9M1.5 9.5h9',
  }[kind];
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.appendChild(p);
  return s;
}

export async function ensureCss() {
  if (document.getElementById('mp-css')) return;
  const l = document.createElement('link');
  l.id = 'mp-css'; l.rel = 'stylesheet'; l.href = '/__m/proto.css';
  const done = new Promise((r) => { l.onload = r; });
  document.head.appendChild(l);
  await done;
}

// ---- the menu ---------------------------------------------------------------
// Opens the REAL Show menu (a tap on the fest name, dock or rail), then adds
// the two settings. `variant`: 'rows' — View and Past as two labelled rows of
// bare words; 'room' — Past as one more check row ("Show … Past") and View as
// a single row of two glyph options.
export async function openMenu({ variant = 'rows', view = 'board', past = 'hide', desktop = false } = {}) {
  await ensureCss();
  const link = document.getElementById(desktop ? 'rail-fest-link' : 'dock-fest-link');
  link.click();
  await new Promise((r) => setTimeout(r, 350));
  const pop = link.closest('.sort-wrap').querySelector('.sort-pop');
  pop.classList.add('mp-pop', `mp-${variant}`);
  const div = pop.querySelector('.pop-div');
  const opt = (label, on, g) => {
    const b = mk('button', 'mp-opt');
    b.type = 'button'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', on ? 'true' : 'false');
    if (g) b.appendChild(glyph(g));
    b.appendChild(mk('span', null, label));
    return b;
  };
  if (variant === 'rows') {
    const seg = (name, a, b) => {
      const li = mk('li', 'mp-seg'); li.setAttribute('role', 'group'); li.setAttribute('aria-label', name);
      li.append(mk('span', 'mp-name', name), a, b);
      return li;
    };
    const d2 = mk('li', 'pop-div'); d2.setAttribute('role', 'presentation');
    pop.insertBefore(d2, div);
    pop.insertBefore(seg('View', opt('Board', view === 'board'), opt('List', view === 'list')), div);
    pop.insertBefore(seg('Past', opt('Show', past === 'show'), opt('Hide', past === 'hide')), div);
  } else {
    // Past is one more thing the menu can show: a check row after the rooms.
    const li = mk('li'); li.setAttribute('role', 'presentation');
    const row = mk('button', 'mp-past'); row.type = 'button'; row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', past === 'show' ? 'true' : 'false');
    const c = mk('span', 'check', past === 'show' ? '✓' : ''); c.setAttribute('aria-hidden', 'true');
    row.append(c, mk('span', null, 'Earlier'));
    li.appendChild(row);
    pop.insertBefore(li, div);
    const d2 = mk('li', 'pop-div'); d2.setAttribute('role', 'presentation');
    pop.insertBefore(d2, div);
    const v = mk('li', 'mp-seg mp-view'); v.setAttribute('role', 'group'); v.setAttribute('aria-label', 'View');
    v.append(opt('Board', view === 'board', 'board'), opt('List', view === 'list', 'list'));
    pop.insertBefore(v, div);
  }
  return pop.getBoundingClientRect().toJSON();
}

// ---- the past ---------------------------------------------------------------
// PAST (the spec, BRIEF.md §3): a card is over when the clock on ITS night
// (nightMinutes, across the 5 AM rollover) has reached the end of its now
// window (data-now-to). A card with no window (untimed on a timed night, TBA,
// cancelled) is over only when its whole night is. A night is over when every
// window on it has closed and the clock is on a later festival day, or when
// the clock is two days on.
function hostState(host, date) {
  const clock = festivalClock(date, host.dataset.tz || null);
  const at = nightMinutes(host.dataset.iso, clock);
  const days = Math.round((Date.parse(`${clock.iso}T00:00:00Z`) - Date.parse(`${host.dataset.iso}T00:00:00Z`)) / 86400000);
  const cards = [...host.querySelectorAll('.card')];
  const timed = cards.filter((c) => c.dataset.nowTo);
  const overCard = (c) => (days >= 2 ? true : days < 0 || at == null ? false : c.dataset.nowTo ? at >= Number(c.dataset.nowTo) : false);
  const nightOver = days >= 2 || (days >= 1 && timed.every((c) => at != null && at >= Number(c.dataset.nowTo)));
  return { at, days, cards, over: (c) => nightOver || overCard(c), nightOver };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function door(text, { open = false, cls = '' } = {}) {
  const b = mk('button', `mp-door ${cls}`.trim());
  b.type = 'button';
  b.setAttribute('aria-expanded', open ? 'true' : 'false');
  b.append(mk('span', 'mp-door-label', text));
  const c = mk('span', 'mp-caret', '⌃'); c.setAttribute('aria-hidden', 'true');
  b.append(c, mk('span', 'mp-rule'));
  return b;
}
// A fold: what is over, gathered in order, collapsed to a peek of its LAST
// row fading in from nothing. `peek` px of it show; open = everything.
function fold(children, { door: d, open = false, peek = 40 }) {
  const f = mk('div', 'mp-fold');
  f.style.setProperty('--peek', `${peek}px`);
  const body = mk('div', 'mp-fold-body');
  body.append(...children);
  f.append(body);
  if (open) f.classList.add('open');
  const wrap = mk('div', 'mp-cut');
  wrap.append(d, f);
  return wrap;
}

// Apply the fold to the whole wall. `open`: 'none' | 'all' | a room selector
// to show opened (the reveal), `mid`: 0..1 to freeze the reveal mid-motion.
export async function foldPast({ date, openDays = false, openRoom = null, mid = null } = {}) {
  await ensureCss();
  const root = document.getElementById('wall-root');
  const report = [];
  const overDays = [];
  for (const block of root.querySelectorAll('.day-block')) {
    const rooms = [...block.querySelectorAll(':scope .room')];
    const states = rooms.map((room) => {
      const hosts = [...room.querySelectorAll('.times-grid[data-iso]:not(.rides), .venue-grid[data-iso], .time-list[data-iso]')];
      const st = hosts.map((h) => hostState(h, date));
      const cards = st.flatMap((s) => s.cards);
      const over = st.every((s) => s.cards.every((c) => s.over(c)));
      return { room, hosts, st, over, n: cards.length, nOver: st.reduce((a, s) => a + s.cards.filter((c) => s.over(c)).length, 0) };
    });
    if (states.length && states.every((s) => s.over)) { overDays.push({ block, n: states.reduce((a, s) => a + s.n, 0) }); continue; }
    for (const s of states) {
      const label = s.room.dataset.room === ':fest' ? 'sets' : s.room.dataset.room === 'Folsom' ? 'parties' : 'sets';
      if (s.over && s.n) {
        // A whole room over, on a day that is not: its head stays (the note
        // door), and everything under it folds behind one line.
        const head = s.room.querySelector('.room-head');
        const body = [...s.room.children].filter((c) => c !== head && !c.classList.contains('whisper'));
        const isOpen = openRoom && s.room.matches(openRoom);
        s.room.appendChild(fold(body, { door: door(`All ${plural(s.n, label.slice(0, -1), label)} over`, { open: isOpen }), open: isOpen, peek: 0 }));
        s.room.classList.add('mp-over');
        report.push(`${block.dataset.day} ${s.room.dataset.room}: all ${s.n} over`);
        continue;
      }
      if (!s.nOver) continue;
      const isOpen = openRoom && s.room.matches(openRoom);
      for (let i = 0; i < s.hosts.length; i++) {
        const h = s.hosts[i];
        const st = s.st[i];
        if (h.matches('.times-grid')) cutGrid(h, st, date, { label, open: isOpen, mid });
        else if (h.matches('.time-list')) cutList(h, st, { label, open: isOpen, mid });
        else cutStacks(h, st, { label, open: isOpen });
      }
      report.push(`${block.dataset.day} ${s.room.dataset.room}: ${s.nOver}/${s.n} over`);
    }
  }
  if (overDays.length) {
    // Whole days over go behind ONE line at the top of the wall: the scroll
    // to the top ends here, not two nights back.
    const names = overDays.map((d) => (d.block.querySelector('.room-head .wd') || {}).textContent || d.block.dataset.day.slice(0, 3).toUpperCase());
    const n = overDays.reduce((a, d) => a + d.n, 0);
    const first = overDays[0].block;
    const anchor = mk('div', 'mp-days');
    first.before(anchor);
    const f = fold(overDays.map((d) => d.block), { door: door(`Earlier · ${names.join(' · ')}`, { open: openDays, cls: 'days' }), open: openDays, peek: 0 });
    f.querySelector('.mp-door-label').appendChild(mk('span', 'mp-count', ` · ${n}`));
    anchor.appendChild(f);
    report.push(`days over: ${names.join(',')} (${n} cards)`);
  }
  window.dispatchEvent(new Event('scroll'));
  return report;
}

// The stage grid on a clock. The CUT is the later of (a) the earliest start
// among sets still to come or playing — tall sets (3h+, the grid's own
// "tall") excluded, since Despacio's 2:45-to-9:45 would hold the whole
// afternoon open — and (b) now − 90 min; never later than now; floored to
// the hour, so the rail starts on a label. Above it, 40px of the grid show through a fade.
function cutGrid(grid, st, date, { label, open, mid }) {
  const wrap = grid.closest('.times-wrap');
  const startRow = Number(grid.dataset.startRow);
  const rows = Number(grid.dataset.rows);
  const pitch = grid.getBoundingClientRect().height / rows;
  const live = st.cards.filter((c) => !st.over(c) && (Number(c.dataset.nowTo) - Number(c.dataset.nowFrom)) < 180);
  const earliest = live.length ? Math.min(...live.map((c) => Number(c.dataset.nowFrom))) : st.at;
  // Never below now: in a gap between sets the earliest thing left can start
  // after now, and the now line must always show.
  let cut = Math.min(Math.max(earliest, st.at - 90), st.at);
  cut = Math.floor(cut / 60) * 60;
  const cutPx = Math.max(0, (cut / 15 - startRow) * pitch);
  if (cutPx < pitch * 2) return;
  const nOver = st.cards.filter((c) => st.over(c)).length;
  const PEEK = 40;
  const clip = mk('div', 'mp-gridclip');
  wrap.before(clip);
  const d = door(`Earlier · ${plural(nOver, label.slice(0, -1), label)}`, { open, cls: open ? 'static' : '' });
  const inner = mk('div', 'mp-mask');
  inner.appendChild(wrap);
  clip.append(d, inner);
  const shown = open ? 0 : mid != null ? cutPx * (1 - mid) : cutPx - PEEK;
  wrap.style.marginTop = `${-Math.max(0, shown)}px`;
  if (!open) clip.classList.add('cut');
  if (mid != null) { clip.classList.add('mid'); clip.style.setProperty('--mid', String(mid)); }
  // A set the cut crosses keeps its name in view: its words slide down to
  // sit just under the cut (the card itself does not move).
  if (!open && mid == null) {
    for (const c of st.cards) {
      const top = (Number(c.dataset.nowFrom) / 15 - startRow) * pitch;
      const bot = (Number(c.dataset.nowTo) / 15 - startRow) * pitch;
      if (top < cutPx && bot > cutPx + 30) {
        // A centred card moves its words to the middle of what shows; a tall
        // card (name at its top edge) moves them to just under the cut.
        const tall = c.classList.contains('tall');
        c.style.setProperty('--mp-shift', `${tall ? cutPx - top + 4 : (cutPx - top) / 2}px`);
        c.classList.add('mp-cross');
      }
    }
  }
}

// A time list (the Folsom rooms today; "List" everywhere tomorrow): the cards
// that are over leave their bands, in order, into one fold at the top of the
// list — its last row peeks through the fade. A band left empty goes too.
function cutList(list, st, { label, open, mid }) {
  const over = st.cards.filter((c) => st.over(c));
  if (open) {
    // Open, the past is back in its bands (the fold is only the closed form);
    // the line stays at the top to fold it again.
    const d = door(`Earlier · ${plural(over.length, label.slice(0, -1), label)}`, { open: true, cls: 'static' });
    list.prepend(d);
    return;
  }
  const grid = mk('div', 'band-grid');
  for (const c of over) grid.appendChild(c);
  for (const band of list.querySelectorAll('.time-band')) if (!band.querySelector('.card')) band.remove();
  const f = fold([grid], { door: door(`Earlier · ${plural(over.length, label.slice(0, -1), label)}`, { open }), open, peek: 0 });
  list.prepend(f);
  // The peek is the LAST row of what is over, whole and faded: what just
  // ended, read at a glance ("MILKED 1 – 4 PM"), fading into the page above.
  const tops = over.map((c) => c.offsetTop);
  const lastTop = Math.max(...tops);
  const rowH = Math.max(...over.filter((c) => c.offsetTop === lastTop).map((c) => c.offsetHeight));
  const fe = f.querySelector('.mp-fold');
  fe.style.setProperty('--peek', `${rowH}px`);
  if (mid != null) fe.style.maxHeight = `${rowH + mid * (grid.offsetHeight - rowH)}px`;
}

// Venue stacks: each column's finished acts fold into the top of that column,
// peeking; the room's line sits above them all.
function cutStacks(vg, st, { label, open }) {
  let n = 0;
  for (const group of vg.querySelectorAll('.venue-group')) {
    const over = [...group.querySelectorAll('.card')].filter((c) => st.over(c));
    if (!over.length) continue;
    n += over.length;
    const holder = over[0].parentElement;
    const f = mk('div', 'mp-fold col');
    f.style.setProperty('--peek', '28px');
    const body = mk('div', 'mp-fold-body');
    body.append(...over);
    f.appendChild(body);
    if (open) f.classList.add('open');
    holder.prepend(f);
  }
  if (n) vg.before(door(`Earlier · ${plural(n, label.slice(0, -1), label)}`, { open, cls: 'stacks' }));
}

// The scrollspy of a build that folds days would skip the fold; the
// prototype lights the day the page is really on.
export function lightDay({ wd }) {
  for (const t of document.querySelectorAll('.day-tab')) t.classList.toggle('active', t.textContent.trim().startsWith(wd));
}

export function cap(text) {
  document.querySelectorAll('.mp-capt').forEach((e) => e.remove());
  if (text) document.body.appendChild(mk('div', 'mp-capt', text));
}
