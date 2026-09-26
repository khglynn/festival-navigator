// One river — the prototype, run INSIDE the real v95 app (list-view round,
// 2026-09-26). Served at /__proto/ by rig.mjs; it imports the app's own
// modules by their absolute URLs, so the card, the aura, the corners, the now
// ring and the whisper are production code — only the ARRANGEMENT is new.
//
// A day becomes one timeline: every room's events (the festival's stages, the
// afters, the Folsom parties) in start order under hour dividers, each card
// wearing a quiet room word (never --fest). A long party is one card at its
// start, then a name in each later hour's ALL HOUR line; the line opens into
// the real cards on a tap. The day's one head carries each room's note door.
import * as state from '/js/state.js';
import * as model from '/js/v3/model.js';
import { renderCard, positionNowMarks } from '/js/v3/wall.js';
import { parseEventTime, venueGroupsOf, occOf, areaOf, approxMark, nightOf, hourLabelOf } from '/js/v3/events.js';
import { timeRange } from '/js/v3/card-facts.js';
import { dayWhisper } from '/js/v3/notes.js';

const ME = 'Ana';
const ROOMS = [
  { key: ':fest', word: 'Portola' },
  { key: 'Afters', word: 'Afters' },
  { key: 'Folsom', word: 'Folsom' },
];
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export async function ensureCss() {
  if (document.getElementById('rv-css')) return;
  const l = document.createElement('link');
  l.id = 'rv-css';
  l.rel = 'stylesheet';
  l.href = '/__proto/proto.css';
  const done = new Promise((r) => { l.onload = r; });
  document.head.appendChild(l);
  await done;
}

function viewCtx() {
  const fid = state.activeFestivalId;
  return {
    fid, meName: ME, picks: model.picksFor(state.crewDoc, fid), affinity: null,
    filterPeople: [], folded: [], lowPower: false,
    onTap() {}, onOpenNotes() {}, onOpenDayNotes() {},
  };
}

// ---- the day as one list of events ---------------------------------------------
// Each member: { name, room, place[], time (label), startMin, endMin, nowFrom,
// nowTo, occ } on the festival-day axis (9 AM = start of the day, after
// midnight = +24h — events.js parseEventTime).
function membersOf(dayKey) {
  const fest = state.fest();
  const meta = fest.dayMeta[dayKey];
  const wd = meta.wd;
  const out = [];
  // The festival's own sets, from its grid.
  const grid = (fest.days[dayKey] || {}).artists || [];
  for (const a of grid) {
    const t = parseEventTime(a.time);
    const e = { name: a.name, day: dayKey, stage: a.stage, time: a.time };
    out.push({ name: a.name, room: ':fest', place: [a.stage], time: timeRange(a.time), startMin: t && t.startMin, endMin: t && t.endMin, printedEnd: t && t.endMin, nowFrom: t && t.startMin, nowTo: t && t.endMin, occ: occOf(e) });
  }
  // Sections that play this night: afters as runs (venueGroupsOf's now
  // window), Folsom as one-party rooms (its printed end wins).
  for (const sec of ['Afters', 'Folsom']) {
    const list = fest.artists.filter((a) => String(a.day || '').split(/\s*&\s*/).includes(sec) && nightOf(a) === wd)
      .map((a) => ({ ...a, day: sec }));
    for (const g of venueGroupsOf(list)) {
      for (const m of g.members) {
        const t = parseEventTime(m.e.time);
        const printedEnd = t && t.endMin != null ? t.endMin : null;
        const endMin = sec === 'Folsom' ? printedEnd : (m.nowTo ?? null);
        const time = m.cancelled ? 'Cancelled' : m.endStr ? timeRange(m.e.time) : m.startStr ? approxMark(m.e, m.startStr) : '';
        out.push({
          name: m.e.name, room: sec, place: sec === 'Folsom' ? [g.venue, areaOf(m.e)].filter(Boolean) : [g.venue],
          time: time || undefined, startMin: t ? t.startMin : null, endMin, printedEnd,
          nowFrom: m.nowFrom, nowTo: sec === 'Folsom' && printedEnd != null ? printedEnd : m.nowTo, occ: occOf(m.e),
        });
      }
    }
  }
  const order = (r) => ROOMS.findIndex((x) => x.key === r);
  return out.sort((a, b) => (a.startMin ?? 1e9) - (b.startMin ?? 1e9) || order(a.room) - order(b.room));
}

// Festival-day minutes of a Date, for the day whose ISO is `iso`.
function festMinutes(date, iso, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).map((p) => [p.type, p.value]));
  const d = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
  const [y, mo, da] = iso.split('-').map(Number);
  const days = Math.round((d - Date.UTC(y, mo - 1, da)) / 864e5);
  return days * 1440 + (+parts.hour) * 60 + (+parts.minute);
}
const clockOf = (min) => { const h = Math.floor(min / 60) % 24; const m = min % 60; return `${h % 12 || 12}:${String(m).padStart(2, '0')}`; };

// ---- the river -----------------------------------------------------------------------
// opts.rooms   which rooms are on (the Show menu's checks — filters here)
// opts.past    'fold' (Kevin: "a scroll to the top cuts off with a gradient")
//              or 'show'
// opts.open    hour keys (minutes) whose ALL HOUR line is open into cards
export async function river(dayKey, { rooms = ROOMS.map((r) => r.key), past = 'fold', open = [], now = null } = {}) {
  await ensureCss();
  const fest = state.fest();
  const meta = fest.dayMeta[dayKey];
  const iso = meta.iso;
  const block = document.querySelector(`.day-block[data-day="${dayKey}"]`);
  const ctx = viewCtx();
  const nowDate = now ? new Date(now) : new Date();
  const nowMin = festMinutes(nowDate, iso, fest.timezone);
  const all = membersOf(dayKey).filter((m) => rooms.includes(m.room));
  const live = nowMin >= 9 * 60 && nowMin < 33 * 60; // inside this festival day

  block.querySelectorAll(':scope > .room, :scope > .rv').forEach((e) => { e.style.display = 'none'; if (e.classList.contains('rv')) e.remove(); });
  const rv = mk('div', 'rv');
  rv.dataset.rooms = String(rooms.length);
  block.appendChild(rv);

  // 1. The day's one head: the weekday, then each room on this day as its own
  //    note door (a note is written where you stand — the room word you tap),
  //    then the date. The festival's word opens the DATE (as SUN PORTOLA does
  //    today); a section's word opens that section on that date.
  const head = mk('div', 'rv-head');
  head.appendChild(mk('span', 'wd', meta.wd.toUpperCase()));
  const doors = mk('span', 'doors');
  const onDay = ROOMS.filter((r) => rooms.includes(r.key) && all.some((m) => m.room === r.key));
  onDay.forEach((r, i) => {
    if (i) doors.appendChild(mk('span', 'sep', '·'));
    const b = mk('button', 'door', r.word.toUpperCase());
    b.type = 'button';
    b.setAttribute('aria-label', `Notes for ${r.word} on ${meta.wd}`);
    doors.appendChild(b);
  });
  head.append(doors, mk('span', 'sub', (meta.date || '').toUpperCase()), mk('span', 'line'));
  rv.appendChild(head);
  // Each room's newest note, under the head, saying which door it came from.
  for (const r of onDay) {
    const target = r.key === ':fest' ? iso : model.sectionDateKey(iso, r.key);
    const w = dayWhisper(target, r.word, ctx, () => {});
    if (w) { w.classList.add('rv-whisper'); w.prepend(mk('span', 'rv-from', r.word.toUpperCase())); rv.appendChild(w); }
  }

  // 2. Hours. A member belongs to the hour it STARTS in; an hour with no
  //    start draws no divider. TBA last.
  const hours = new Map();
  for (const m of all) {
    const h = m.startMin == null ? 'tba' : Math.floor(m.startMin / 60) * 60;
    if (!hours.has(h)) hours.set(h, []);
    hours.get(h).push(m);
  }
  const keys = [...hours.keys()].filter((k) => k !== 'tba').sort((a, b) => a - b);
  if (hours.has('tba')) keys.push('tba');

  // ALL HOUR: started in an earlier hour and still on at the hour's END — the
  // long party that would otherwise either drown the list (a card every hour)
  // or vanish from it (a card only at 10 AM). A set that ends inside the hour
  // is not carried: the hour above already holds it.
  //    Only a PRINTED end carries (a set on the grid, a party's posted close):
  //    an afters DJ "ends" when the next one starts, a guess, never carried.
  //    And a party that began in the last half hour is not repeated — its
  //    card is right above the divider. In the live now-hour that exemption
  //    is off: the hours above are folded, so the line must be complete.
  const allHour = (h, exempt = true) => all.filter((m) => m.startMin != null && m.printedEnd != null
    && m.startMin <= h - (exempt ? 30 : 1) && m.printedEnd >= h + 60);

  const list = mk('div', 'time-list rv-list');
  list.dataset.iso = iso;
  if (fest.timezone) list.dataset.tz = fest.timezone;
  rv.appendChild(list);

  const nowHour = live ? Math.floor(nowMin / 60) * 60 : null;
  let folded = [];
  let over = 0;
  const card = (m, extra = '') => {
    const el = renderCard(m.name, ctx, { time: m.time, place: m.place, occ: m.occ });
    el.dataset.room = m.room;
    const word = mk('span', 'rv-room', ROOMS.find((r) => r.key === m.room).word.toUpperCase());
    const t = el.querySelector('.time');
    if (t) word.style.color = t.style.color;
    el.prepend(word);
    if (m.nowFrom != null && m.nowTo != null) { el.dataset.nowFrom = String(m.nowFrom); el.dataset.nowTo = String(m.nowTo); }
    if (extra) el.classList.add(extra);
    return el;
  };
  const picked = (m) => Object.values(ctx.picks[m.name] || {}).some((l) => l >= 1);
  const mine = (m) => ((ctx.picks[m.name] || {})[ME] || 0) >= 1;

  for (const h of keys) {
    let members = hours.get(h);
    // Past, folded: an hour that began before the current one leaves the
    // list; whatever of it is STILL PLAYING travels down into the now hour.
    if (past === 'fold' && live && h !== 'tba' && h < nowHour) {
      for (const m of members) {
        const on = m.endMin == null ? (m.nowTo != null && m.nowTo > nowMin) : m.endMin > nowMin;
        const long = m.printedEnd != null && m.printedEnd >= nowHour + 60; // the now hour's ALL HOUR line holds it
        if (!on) over += 1;
        if (on && !long) { if (!hours.get(nowHour)) hours.set(nowHour, []); hours.get(nowHour).__carried = (hours.get(nowHour).__carried || []).concat(m); }
        else folded.push(m);
      }
      continue;
    }
    const band = mk('section', 'time-band rv-band');
    band.dataset.h = String(h);
    const dh = mk('div', 'band-head rv-divider');
    dh.append(mk('span', 'label', h === 'tba' ? 'Time TBA' : hourLabelOf(h)), mk('span', 'line'));
    band.appendChild(dh);
    const grid = mk('div', 'band-grid');
    // ALL HOUR — names, the crew's picks first; a tap opens them into cards.
    const held = h === 'tba' ? [] : allHour(h, !(live && past === 'fold' && h === nowHour));
    if (held.length) {
      held.sort((a, b) => (mine(b) - mine(a)) || (picked(b) - picked(a)) || a.startMin - b.startMin);
      if (open.includes(h)) {
        const line = mk('button', 'rv-hold open');
        line.type = 'button';
        line.append(mk('span', 'k', 'All hour'), mk('span', 'names', `${held.length} already on`), mk('span', 'more', 'close'));
        band.appendChild(line);
        const hg = mk('div', 'band-grid rv-held');
        for (const m of held) hg.appendChild(card(m, 'held'));
        band.appendChild(hg);
      } else {
        const line = mk('button', 'rv-hold');
        line.type = 'button';
        line.setAttribute('aria-label', `All hour: ${held.map((m) => m.name).join(', ')}`);
        line.appendChild(mk('span', 'k', 'All hour'));
        // Grouped by room, each group led by its room word — the line has to
        // say WHERE as quietly as a card does ("FOLSOM Street Fair · BOOF").
        const names = mk('span', 'names');
        const groups = ROOMS.map((r) => [r, held.filter((m) => m.room === r.key)]).filter(([, l]) => l.length);
        groups.forEach(([r, l], gi) => {
          if (gi) names.appendChild(mk('span', 'gap', ' '));
          if (rooms.length > 1) names.appendChild(mk('span', 'rw', r.word.toUpperCase()));
          l.forEach((m, i) => {
            if (i) names.appendChild(mk('span', 'd', ' · '));
            names.appendChild(mk('span', picked(m) ? 'n p' : 'n', short(m.name)));
          });
        });
        line.appendChild(names);
        line.appendChild(mk('span', 'more', `${held.length}`));
        band.appendChild(line);
      }
    }
    const carried = members.__carried || [];
    const inHour = [...carried, ...members];
    if (live && h === nowHour) {
      // The now line's twin in a list: what is playing sits above it, what is
      // still to start below, and the line says the time.
      const before = inHour.filter((m) => m.startMin <= nowMin);
      const after = inHour.filter((m) => m.startMin > nowMin);
      for (const m of before) grid.appendChild(card(m));
      band.appendChild(grid);
      const nl = mk('div', 'rv-now');
      nl.append(mk('span', 'rule'), mk('span', 'pill', clockOf(nowMin)));
      band.appendChild(nl);
      const g2 = mk('div', 'band-grid');
      for (const m of after) g2.appendChild(card(m));
      band.appendChild(g2);
    } else {
      for (const m of inHour) grid.appendChild(card(m));
      band.appendChild(grid);
    }
    list.appendChild(band);
  }
  // The fold: the last row of what is over, fading up into the page, and the
  // one door back ("Earlier").
  if (folded.length) {
    const fold = mk('div', 'rv-fold');
    const g = mk('div', 'band-grid');
    for (const m of folded.slice(-2)) g.appendChild(card(m));
    const tail = mk('div', 'tail');
    tail.appendChild(g);
    const btn = mk('button', 'rv-earlier');
    btn.type = 'button';
    const first = keys.find((k) => k !== 'tba');
    btn.append(mk('span', 'k', 'Earlier'), mk('span', 'n', over ? `${over} over` : `from ${hourLabelOf(first)}`));
    fold.append(btn, tail);
    list.before(fold);
  }
  positionNowMarks(block, nowDate);
  return { members: all.length, hours: keys.length, folded: folded.length, over };
}
// A name in a line of names: the party's own words, before its colon/dash
// subtitle ("Party On The Plaza: Folsom Edition" → "Party On The Plaza").
function short(name) {
  return name.replace(/\s*[:(–-].*$/, '').replace(/^OFFICIAL\s+/i, '').trim() || name;
}

// Hide the board's rooms on every other day too? No — frames scroll within one
// day. This scrolls an hour's divider to `y` px under the top of the viewport.
export function toHour(dayKey, h, y = 0) {
  const band = document.querySelector(`.day-block[data-day="${dayKey}"] .rv-band[data-h="${h}"]`);
  if (!band) throw new Error(`no hour ${h}`);
  window.scrollTo(0, band.getBoundingClientRect().top + scrollY - y);
}
export function toSel(sel, y = 0) {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`no ${sel}`);
  window.scrollTo(0, el.getBoundingClientRect().top + scrollY - y);
}

// The Show menu, opened the production way, with this round's two rows added
// under the rooms: the view (List · Board) and what's over.
export async function showMenu({ list = true, past = false } = {}) {
  await ensureCss();
  document.getElementById('dock-fest-link').click();
  await new Promise((r) => setTimeout(r, 350));
  const pop = document.querySelector('#dock-fest-wrap .sort-pop');
  if (!pop) return null;
  const div = [...pop.children].find((c) => c.classList.contains('pop-div'));
  const row = (label, { on = null, seg = null } = {}) => {
    const li = mk('li'); li.setAttribute('role', 'presentation');
    const b = mk('button'); b.type = 'button'; b.setAttribute('role', 'option');
    if (on != null) b.setAttribute('aria-selected', on ? 'true' : 'false');
    const c = mk('span', 'check', on ? '✓' : ''); c.setAttribute('aria-hidden', 'true');
    b.append(c);
    if (seg) {
      b.classList.add('rv-seg');
      seg.forEach(([w, sel], i) => { if (i) b.appendChild(mk('span', 'sd', '·')); b.appendChild(mk('span', sel ? 'sw on' : 'sw', w)); });
    } else b.appendChild(mk('span', null, label));
    li.appendChild(b);
    return li;
  };
  const d2 = mk('li', 'pop-div'); d2.setAttribute('role', 'presentation');
  div.before(d2, row('', { seg: [['List', list], ['Board', !list]] }), row("What's over", { on: past }));
  return pop.getBoundingClientRect().toJSON();
}

// A room leaving the river, frozen mid-motion at `t` (0..1): its cards fade
// and shrink where they stood; everyone else is part-way to their new slot.
// Built as the AFTER layout with each survivor translated back by (1 - e(t))
// of its travel, and a ghost of each leaving card at its old place.
export async function leaveMid(dayKey, roomKey, t, riverOpts) {
  // Everything that travels: the cards, and each hour's divider and line.
  const cardsNow = () => [...document.querySelectorAll(`.day-block[data-day="${dayKey}"] .rv .card, .day-block[data-day="${dayKey}"] .rv .rv-divider, .day-block[data-day="${dayKey}"] .rv .rv-hold`)];
  const keyOf = (c) => (c.classList.contains('card') ? `${c.dataset.artist}|${c.dataset.occ}` : `${c.className}|${c.closest('.rv-band').dataset.h}`);
  const before = new Map(cardsNow().map((c) => [keyOf(c), { r: c.getBoundingClientRect(), c }]));
  const leaving = cardsNow().filter((c) => c.classList.contains('card') && c.dataset.room === roomKey).map((c) => ({ r: c.getBoundingClientRect(), clone: c.cloneNode(true) }));
  const heads = [...document.querySelectorAll(`.day-block[data-day="${dayKey}"] .rv .rv-divider`)].map((d) => ({ h: d.closest('.rv-band').dataset.h, r: d.getBoundingClientRect() }));
  const rooms = ROOMS.map((r) => r.key).filter((k) => k !== roomKey);
  // Anchor: the hour at the top of the screen stays where it is (the page
  // gets shorter above and below it; the reader's place does not move).
  const bandAt = [...document.querySelectorAll(`.day-block[data-day="${dayKey}"] .rv-band`)].find((b) => b.getBoundingClientRect().bottom > 0);
  const anchorH = bandAt && bandAt.dataset.h;
  const anchorTop = bandAt ? bandAt.getBoundingClientRect().top : 0;
  await river(dayKey, { ...riverOpts, rooms });
  const again = anchorH && document.querySelector(`.day-block[data-day="${dayKey}"] .rv-band[data-h="${anchorH}"]`);
  if (again) window.scrollBy(0, again.getBoundingClientRect().top - anchorTop);
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const k = 1 - ease(Math.min(1, t * 1.25)); // the survivors lead with the exit, then settle
  for (const c of cardsNow()) {
    const b = before.get(keyOf(c));
    if (!b) continue;
    const a = c.getBoundingClientRect();
    c.style.transform = `translate(${(b.r.left - a.left) * k}px, ${(b.r.top - a.top) * k}px)`;
    if (c.classList.contains('card')) c.style.zIndex = '2';
  }
  // Ghosts: the leaving cards, quick and plain — opacity and a small shrink.
  const exit = Math.min(1, t * 1.4); // the way out is quick and plain
  for (const g of leaving) {
    const holder = mk('div', 'rv-ghost');
    holder.appendChild(g.clone);
    const c = g.clone;
    Object.assign(holder.style, { left: `${g.r.left + scrollX}px`, top: `${g.r.top + scrollY}px`, width: `${g.r.width}px`, height: `${g.r.height}px`, opacity: String(1 - exit), transform: `scale(${1 - 0.06 * exit})` });
    c.style.width = '100%'; c.style.height = '100%'; c.style.boxSizing = 'border-box';
    document.body.appendChild(holder);
  }
  return { left: leaving.length, moved: before.size - leaving.length };
}

export function cap(text) {
  document.querySelectorAll('.rv-cap').forEach((e) => e.remove());
  if (text) document.body.appendChild(mk('div', 'rv-cap', text));
}
