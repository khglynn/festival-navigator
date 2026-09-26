// D — Full-width rows — the prototype, run INSIDE the real app (v95 + v93's
// shell), 2026-09-26. Loaded before app.js (patch.mjs puts the tag in
// index.html). It keeps a-rooms-by-time's contract with the patched wall.js
// (`globalThis.__lv`: list, bandOf, isHour, asEntry, after) and drops its time
// pin and its side-by-side desktop (the pin is punted; the riff is one column).
// It adds three things, each only ever layered on what the app painted:
//   1. the full-width row (CSS; `d_card` = 'flow' (the pick) | 'edges')
//   2. the past, folded by default behind one line per room that flips
//      between "EARLIER · 7 SETS" and "HIDE EARLIER" in the same spot
//   3. the fest name's menu affordance: sync dot left, a three-line glyph
//      right (in place of v93's caret); the menu holds the rooms and the
//      Board · List glyph row, no Earlier row.
import { TIME_BANDS, hourLabelOf } from '/js/v3/events.js';
import { festivalClock } from '/js/v3/now.js';
import { nightMinutes } from '/js/v3/wall.js';
import { reduced, CASCADE_MS, EASE_ARRIVE } from '/js/v3/motion.js';

const FEST_ROOM = ':fest';
const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
const H = 60;
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// ---- the ladders (a-rooms-by-time's, unchanged) ---------------------------------
const AFTER = TIME_BANDS.find((b) => b.key === 'after');
const TBA = { key: 'tba', label: 'Time TBA', from: null, to: null };
function hourBandOf(startMin) {
  if (startMin == null) return TBA;
  if (startMin >= AFTER.from) return AFTER;
  const h = Math.floor(startMin / H);
  return { key: `h${h}`, label: hourLabelOf(h * H), from: h * H, to: h * H + H };
}
const nightBandOf = (startMin) => (startMin == null ? TBA : TIME_BANDS.find((b) => startMin >= b.from && startMin < b.to) || TBA);
const shortStage = (s) => String(s || '').replace(/\s+stage$/i, '').trim();

const LV = {
  list: read('lv_view', 'list') === 'list',
  bandOf(root) { return root && root.dataset && root.dataset.room === FEST_ROOM ? hourBandOf : nightBandOf; },
  isHour() { return false; }, // no pin in this riff: every head stays a plain divider
  asEntry(a, day) {
    return { ...a, day: day.dayKey, venue: shortStage(a.stage),
      __occ: { day: day.dayKey, stage: a.stage || null, time: a.time || null, weekend: a.weekend || null } };
  },
  after(root) {
    const b = document.body;
    b.classList.toggle('lv-list', LV.list);
    b.classList.add('lv-stage-caps');
    b.classList.toggle('d-full', LV.list);
    b.classList.toggle('d-edges', read('d_card', 'flow') === 'edges');
    burger();
    if (!LV.list) return;
    rowCards(root);
    foldPast(root);
  },
};
globalThis.__lv = LV;

// ---- 1. the row --------------------------------------------------------------------
// The card's own spans, gathered into two groups a row can place: the time
// and the place on one line (.d-meta), your meter and the crew's marks as one
// cluster on the right (.d-people). Nothing is re-rendered or re-measured.
function rowCards(root) {
  for (const card of root.querySelectorAll('.band-grid > .card')) {
    if (card.querySelector(':scope > .d-meta')) continue;
    const meta = mk('span', 'd-meta');
    const time = card.querySelector(':scope > .time');
    const place = card.querySelector(':scope > .place');
    if (time) meta.appendChild(time);
    if (place) meta.appendChild(place);
    const people = mk('span', 'd-people');
    for (const c of card.querySelectorAll(':scope > .corner-about, :scope > .corner-who')) people.appendChild(c);
    card.append(meta, people);
  }
}

// ---- 2. the past ------------------------------------------------------------------
// Over = the card's NOW ring can never light again (m-menu-past-persist §3):
// the clock on its own night has reached the end of its now window. A card
// with no window is over only when its whole night is.
const openRooms = new Set(); // `<iso>|<room>` — a reveal lives for the page, never stored
const clockNow = () => new Date();
function hostState(host) {
  const clock = festivalClock(clockNow(), host.dataset.tz || null);
  const at = nightMinutes(host.dataset.iso, clock);
  const days = Math.round((Date.parse(`${clock.iso}T00:00:00Z`) - Date.parse(`${host.dataset.iso}T00:00:00Z`)) / 86400000);
  const cards = [...host.querySelectorAll('.card')];
  const timed = cards.filter((c) => c.dataset.nowTo);
  const nightOver = days >= 2 || (days >= 1 && timed.every((c) => at != null && at >= Number(c.dataset.nowTo)));
  const over = (c) => nightOver || (days >= 0 && at != null && c.dataset.nowTo != null && at >= Number(c.dataset.nowTo));
  return { cards, over };
}
const noun = (room, n) => {
  const [one, many] = room.dataset.room === 'Folsom' ? ['party', 'parties'] : ['set', 'sets'];
  return `${n} ${n === 1 ? one : many}`;
};
let daysOpen = false; // the whole-days line's reveal, page memory only
function foldPast(root) {
  // Whole days over (Thu, Fri on a Saturday) go behind ONE line at the top
  // of the wall — the same line, the same flip — so the scroll to the top ends
  // there instead of two nights back.
  root.querySelectorAll(':scope > .d-earlier').forEach((e) => e.remove());
  const blocks = [...root.querySelectorAll('.day-block')];
  const overDays = blocks.filter((b) => {
    const lists = [...b.querySelectorAll('.time-list[data-iso]')];
    return lists.length && lists.every((l) => { const st = hostState(l); return st.cards.every(st.over); });
  });
  for (const b of blocks) b.classList.toggle('d-day-over', overDays.includes(b));
  root.classList.toggle('d-days-open', daysOpen);
  if (overDays.length) {
    const names = overDays.map((b) => b.dataset.day.slice(0, 3));
    const line = mk('button', 'd-earlier d-days');
    line.type = 'button';
    const label = mk('span', 'd-earlier-label');
    const caret = mk('span', 'd-earlier-caret'); caret.setAttribute('aria-hidden', 'true');
    const setText = (o) => { label.textContent = o ? 'Hide earlier' : `Earlier · ${names.join(' · ')}`; line.setAttribute('aria-expanded', String(o)); };
    setText(daysOpen);
    line.append(label, caret, mk('span', 'd-earlier-rule'));
    line.onclick = () => { daysOpen = !daysOpen; root.classList.toggle('d-days-open', daysOpen); setText(daysOpen); };
    overDays[0].before(line);
  }
  for (const list of root.querySelectorAll('.day-block:not(.d-day-over) .room .time-list[data-iso]')) {
    const room = list.closest('.room');
    const key = `${list.dataset.iso}|${room.dataset.room}`;
    const st = hostState(list);
    const over = st.cards.filter(st.over);
    list.querySelectorAll(':scope > .d-earlier').forEach((e) => e.remove());
    if (!over.length) continue;
    for (const c of over) c.classList.add('d-over');
    for (const band of list.querySelectorAll('.time-band')) {
      band.classList.toggle('d-past', [...band.querySelectorAll('.card')].every((c) => c.classList.contains('d-over')));
    }
    const open = openRooms.has(key);
    list.classList.toggle('d-open', open);
    list.classList.add('d-has-past');
    const line = mk('button', 'd-earlier');
    line.type = 'button';
    line.setAttribute('aria-expanded', String(open));
    const label = mk('span', 'd-earlier-label');
    const caret = mk('span', 'd-earlier-caret');
    caret.setAttribute('aria-hidden', 'true');
    const setText = (o) => { label.textContent = o ? 'Hide earlier' : `Earlier · ${noun(room, over.length)}`; line.setAttribute('aria-expanded', String(o)); };
    setText(open);
    line.append(label, caret, mk('span', 'd-earlier-rule'));
    line.onclick = () => toggle(list, key, setText);
    list.prepend(line);
  }
}
// Open: the past slides down into its bands from under the line while the
// line's words cross-fade to "Hide earlier"; the first row that was already
// showing stays where it was on screen. Fold: quick and plain.
function toggle(list, key, setText) {
  const open = !openRooms.has(key);
  if (open) openRooms.add(key); else openRooms.delete(key);
  const line = list.querySelector(':scope > .d-earlier');
  const keep = [...list.querySelectorAll('.card:not(.d-over)')][0];
  const before = keep ? keep.getBoundingClientRect().top : 0;
  const label = line.querySelector('.d-earlier-label');
  if (!reduced()) label.animate([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: CASCADE_MS, easing: EASE_ARRIVE });
  setText(open);
  list.classList.toggle('d-open', open);
  if (open) {
    // Hold the page: what you were reading stays put, the past grows above it.
    if (keep) window.scrollBy(0, keep.getBoundingClientRect().top - before);
    if (!reduced()) {
      const past = [...list.querySelectorAll('.card.d-over')];
      past.reverse().forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }],
        { duration: CASCADE_MS, delay: i * 30, easing: EASE_ARRIVE, fill: 'backwards' }));
    }
    // Then bring the last of the past down into view (at most 45% of the screen).
    const lineTop = line.getBoundingClientRect().top;
    window.scrollBy({ top: -Math.min(Math.max(0, (keep ? keep.getBoundingClientRect().top : 0) - lineTop - 60), innerHeight * 0.45), behavior: reduced() ? 'auto' : 'smooth' });
  } else if (keep) {
    window.scrollBy(0, keep.getBoundingClientRect().top - before);
  }
}

// ---- 3. the fest name: dot left, menu glyph right -----------------------------------
const NS = 'http://www.w3.org/2000/svg';
function svg(d, cls, size = 12) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 12 12'); s.setAttribute('width', String(size)); s.setAttribute('height', String(size));
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.4');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', cls);
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.appendChild(p);
  return s;
}
const BURGER = 'M1.5 2.75h9M1.5 6h9M1.5 9.25h9';
function burger() {
  for (const id of ['dock-fest-link', 'rail-fest-link']) {
    const link = document.getElementById(id);
    if (!link || link.dataset.dBurger) continue;
    link.dataset.dBurger = '1';
    const dot = link.querySelector('.sync-dot');
    if (dot) link.prepend(dot);
    const caret = link.querySelector('.menu-caret');
    const g = svg(BURGER, 'd-burger', 13);
    if (caret) caret.replaceWith(g); else link.appendChild(g);
  }
}
// The menu, as the next build would draw it: the rooms, a line, the Board ·
// List glyph row (m-menu-past-persist's variant B without its Earlier row),
// a line, Settings.
export async function openMenu({ desktop = false } = {}) {
  const link = document.getElementById(desktop ? 'rail-fest-link' : 'dock-fest-link');
  link.click();
  await new Promise((r) => setTimeout(r, 350));
  const pop = link.closest('.sort-wrap').querySelector('.sort-pop');
  if (pop.querySelector('.d-view')) return pop.getBoundingClientRect().toJSON();
  const div = pop.querySelector('.pop-div');
  const opt = (label, on, d) => {
    const b = mk('button', 'd-opt');
    b.type = 'button'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.append(svg(d, 'd-g'), mk('span', null, label));
    return b;
  };
  const v = mk('li', 'd-view'); v.setAttribute('role', 'group'); v.setAttribute('aria-label', 'View');
  v.append(opt('Board', !LV.list, 'M1.5 1.5v9M6 1.5v5M10.5 1.5v7'), opt('List', LV.list, 'M1.5 2.5h9M1.5 6h9M1.5 9.5h9'));
  const d2 = mk('li', 'pop-div'); d2.setAttribute('role', 'presentation');
  pop.insertBefore(d2, div);
  pop.insertBefore(v, div);
  return pop.getBoundingClientRect().toJSON();
}

// ---- rig helpers -----------------------------------------------------------------------
export function lightDay(wd) {
  for (const t of document.querySelectorAll('.day-tab')) t.classList.toggle('active', t.textContent.trim().startsWith(wd));
}
