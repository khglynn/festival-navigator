// The wall — v3's main screen (atlas 21c/21d, lineup mode). Renders day
// sections of aura cards from the live crew doc, owns the tap cycle with the
// undo toast, search/sort, and the mobile dock's scrollspy.
//
// SECURITY RULE (Codex P2 gate, finding 6): every artist name, person name,
// and note text in this file goes through textContent / createElement — no
// innerHTML interpolation of doc-derived strings, ever.
import * as state from '../state.js';
import * as model from './model.js';
import { LEVEL_LABELS_V4 } from '../parse.js';
import { computeLanes } from '../overlap.js';
import { activityMinutes, dayLabelParts } from '../time.js';
import { whoCorner, aboutCorner } from './aura.js';
import { BOARD } from './palette.js';
import { dayWhisper } from './notes.js'; // runtime-only cycle with this module (colorIndexOf) — safe
import { factsFor, timeRange } from './card-facts.js'; // same runtime-only cycle: the card's ONE model
import { passesPeople, columnsTemplate, railLabels } from './filters.js';
import { nowOnDay, nowOffsetPx, clockLabel, festivalClock } from './now.js';
import { eventModelOf, timetableOf, sortForTiles, bucketsOf, occOf, hourLabelOf, approxMark, parseEventTime, FEST_BUCKET } from './events.js';

// ---- person -> board color ---------------------------------------------------
// v4 people carry colorIndex. Legacy people carry a "R, G, B" string from the
// old 12-color palette; map its palette position onto the board (both are
// hue-spread, positions correspond) — deterministic on every device, no
// writes needed. Unknown strings hash the name (stable, collision-tolerable).
export function colorIndexOf(name, personObj) {
  if (Number.isInteger(personObj?.colorIndex)) return personObj.colorIndex;
  const legacyIdx = state.COLOR_PALETTE.indexOf(personObj?.color);
  if (legacyIdx >= 0) return legacyIdx % BOARD.length;
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % BOARD.length;
}

const BOOKMARK_PATH = 'M1 1h8v11l-4-3-4 3z';

function svgBookmark() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '7'); svg.setAttribute('height', '9'); svg.setAttribute('viewBox', '0 0 10 13');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', BOOKMARK_PATH); path.setAttribute('fill', '#fff');
  svg.appendChild(path);
  return svg;
}

export function renderCard(artistName, ctx, opts = {}) {
  // opts.occ = { day, stage, time }: the occurrence THIS card is (an artist
  // can appear twice — a grid set and an afters event, or two EF days). The
  // zoom, the peek, and the sheet all tell this card's story, never the
  // first match's (Codex gate, 2026-08-29).
  // ONE model for the resting card, the zoom and the sheet header
  // (card-facts.js factsFor) — a detail cannot exist in one and not another.
  const facts = factsFor(artistName, ctx, opts.occ || null);
  const people = facts.people;
  const el = document.createElement('div');
  el.className = 'card' + (opts.cell ? ' cell' : '') + (opts.time && !opts.cell ? ' timed' : '');
  // The people filter dims a card nobody selected has picked. Computed here,
  // from ctx, so refreshCard (a single-card repaint after a tap) reproduces
  // it without being told — a dimmed card you tap stays dimmed until the
  // filtered person picks it, which is exactly what the filter means.
  if (ctx.filterPeople && ctx.filterPeople.length && !passesPeople(ctx.picks, artistName, ctx.filterPeople)) el.classList.add('dim');
  el.dataset.artist = artistName;
  // Keyboard-first card (AX-1): real button semantics, and the accessible
  // name carries what SIGHTED users see — your level, the crew's picks, note
  // count, Spotify badge (audit 4.3). The explicit label overrides children,
  // so anything not folded in here is invisible to AT.
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  const myLevel = (ctx.picks[artistName] || {})[ctx.meName] || 0;
  const crewCount = people.filter((p) => !p.isYou).length;
  const labelParts = [`${artistName} — ${myLevel === 4 ? 'must' : (LEVEL_LABELS_V4[myLevel] || 'not picked').toLowerCase()}`];
  if (crewCount) labelParts.push(`picked by ${crewCount} other${crewCount === 1 ? '' : 's'}`);
  if (facts.noteCount) labelParts.push(`${facts.noteCount} note${facts.noteCount === 1 ? '' : 's'}`);
  if (facts.spotify) labelParts.push('in your Spotify');
  el.setAttribute('aria-label', labelParts.join(', '));
  el.title = artistName; // lane-split cells truncate hard — hover recovers (audit 9.2)
  el.addEventListener('keydown', (e) => {
    // Only the CARD's own focus picks: Enter on the notes button nested in the
    // grown block bubbles here too, and the browser then activates the button
    // — a pick and an open from one keypress (Codex gate, 2026-08-29).
    if (e.target !== el) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.onTap(artistName, el); }
  });
  // Stash render opts on the node so refreshCard can reproduce this exact
  // render — a single-card refresh must preserve every invariant the full
  // render established (CORE-1/CORE-3).
  if (opts.time) el.dataset.time = opts.time;
  if (opts.occ) el.dataset.occ = JSON.stringify(opts.occ);
  if (opts.tag) {
    el.dataset.tag = opts.tag;
    const tag = document.createElement('span');
    tag.className = 'chip-weekend';
    tag.textContent = opts.tag;
    el.appendChild(tag);
  }
  el.style.background = facts.background;
  if (facts.animated && !ctx.lowPower) {
    el.classList.add('animated');
    const grain = document.createElement('span');
    grain.className = 'card-grain';
    el.appendChild(grain);
  }
  const nm = document.createElement('span');
  nm.className = 'name';
  nm.style.color = facts.nameColor;
  nm.textContent = artistName;
  el.appendChild(nm);
  if (opts.time) {
    const t = document.createElement('span');
    t.className = 'time';
    t.style.color = facts.subColor;
    t.textContent = opts.time;
    el.appendChild(t);
  }
  if (opts.tall) {
    el.classList.add('tall');
    el.dataset.tall = '1'; // refreshCard replays this exact render (a pick must not un-tall Despacio)
    if (opts.until) el.dataset.until = opts.until;
    if (opts.until) {
      const u = document.createElement('span');
      u.className = 'until';
      u.style.color = facts.subColor;
      u.textContent = `until ${opts.until}`;
      el.appendChild(u);
    }
  }

  const about = document.createElement('span');
  about.className = 'corner-about';
  for (const chip of aboutCorner({ noteCount: facts.noteCount, spotify: facts.spotify })) {
    // The clickable note-count chip is a real button (audit 4.4); the Spotify
    // chip stays a passive span.
    const clickable = chip.kind === 'notes' && ctx.onOpenNotes;
    const c = document.createElement(clickable ? 'button' : 'span');
    c.className = chip.kind === 'notes' ? 'chip-notes' : 'chip-spotify';
    c.textContent = chip.label;
    if (chip.kind === 'spotify' && chip.followed) c.appendChild(svgBookmark());
    // Corner glow for high-affinity artists (followed + 5+ songs): a soft
    // Spotify-green mini-aura behind the badge corner — same visual language
    // as the people-auras, card geometry untouched (Kevin picked this over
    // rings/outlines 2026-07-13; thicker outlines broke pixel rhythm before).
    if (chip.kind === 'spotify' && chip.hot) {
      const glow = document.createElement('span');
      glow.className = 'spot-glow';
      glow.setAttribute('aria-hidden', 'true');
      el.appendChild(glow);
    }
    if (clickable) {
      c.style.cursor = 'pointer';
      c.setAttribute('aria-label', `${chip.label} note${chip.label === '1' ? '' : 's'} for ${artistName}`);
      c.addEventListener('click', (e) => { e.stopPropagation(); ctx.onOpenNotes(artistName, opts.occ || null); });
    }
    about.appendChild(c);
  }
  el.appendChild(about);

  // Long-press (touch) ZOOMS the card (~500ms, 10px slop — the OS constants;
  // 2026-08-29 round): the grown card carries the notes chip, so the sheet
  // stays one tap away. Falls back to opening notes where no peek is wired.
  // Digitizer jitter fires pointermove even on a still finger, so cancel only
  // past a real movement threshold (10px) — a genuine scroll-drag cancels,
  // a held finger does not (Codex P3 trail, finding 1).
  if (ctx.onOpenNotes) {
    let pressTimer = null;
    let longPressed = false;
    let startX = 0, startY = 0;
    el.addEventListener('pointerdown', (e) => {
      // A finger (or a pen) holds; a mouse hovers. A held mouse button used
      // to arm this too and open a touch-style zoom — one that ignores
      // hover-out and swallows its next click (found 2026-09-02).
      if (e.pointerType === 'mouse') return;
      longPressed = false;
      startX = e.clientX; startY = e.clientY;
      // If a poll repaint detached this node mid-press, the new node owns the
      // gesture — a fire from the orphan would open the sheet uninvited.
      pressTimer = setTimeout(() => {
        // isConnected covers repaint detachment; offsetParent covers a screen
        // change hiding the wall mid-press (audit 10.2) — a sheet must never
        // pop over Settings or the landing after the fact.
        if (!el.isConnected || el.offsetParent === null) return;
        longPressed = true;
        if (ctx.onPeek) ctx.onPeek(artistName, el, opts.occ || null); else ctx.onOpenNotes(artistName);
      }, 500);
    });
    const cancel = () => clearTimeout(pressTimer);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('pointermove', (e) => {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancel();
    });
    el.addEventListener('click', (e) => { if (longPressed) { e.stopImmediatePropagation(); longPressed = false; } }, true);
  }

  const who = document.createElement('span');
  who.className = 'corner-who';
  for (const m of whoCorner(people)) {
    const s = document.createElement('span');
    s.className = 'mark' + (m.kind === 'ghost' ? ' ghost' : '');
    if (m.kind !== 'ghost') {
      s.style.width = m.width + 'px';
      s.style.background = m.fill;
      s.style.border = '1px solid ' + m.stroke;
      s.style.fontSize = m.kind === 'must' ? '7.5px' : '0px';
    }
    s.textContent = m.label;
    who.appendChild(s);
  }
  el.appendChild(who);

  el.addEventListener('click', (e) => {
    // Belt over the chips' own stopPropagation (the research's Ant Design
    // lesson): a real button inside the card (the notes chip) is its own
    // control, never a pick. Everything else on the face — the name, the
    // time, the marks, the Spotify badge — is the card, and a tap on the card
    // means pick. (The 2026-08-29 version excluded a whole grown block here,
    // which is how a zoomed card stopped taking picks.)
    if (e.target !== el && e.target.closest && e.target.closest('button')) return;
    ctx.onTap(artistName, el);
  });
  if (ctx.wireZoom) ctx.wireZoom(el, artistName, opts.occ || null);
  return el;
}

// Re-render one card in place after a pick change (no full-wall repaint).
// The fresh card must land exactly where the old one was: same render opts
// (cell variant, time line) AND the placement the full render computed —
// grid position and lane split live as inline styles on the node (CORE-1).
const PLACEMENT_PROPS = ['grid-column', 'grid-row', 'width', 'margin-left', 'min-height'];
export function refreshCard(el, artistName, ctx, { onSwap = null } = {}) {
  const fresh = renderCard(artistName, ctx, {
    cell: el.classList.contains('cell'),
    time: el.dataset.time || undefined,
    tag: el.dataset.tag || undefined,
    tall: el.dataset.tall === '1',
    until: el.dataset.until || null,
    occ: el.dataset.occ ? JSON.parse(el.dataset.occ) : undefined,
  });
  for (const prop of PLACEMENT_PROPS) {
    const v = el.style.getPropertyValue(prop);
    if (v) fresh.style.setProperty(prop, v);
  }
  // Keyboard users keep their place: replacing a focused node silently dumps
  // focus to <body>, forcing a full re-Tab per pick tap (audit 4.1).
  const hadFocus = document.activeElement === el;
  // The fresh node lands FIRST and any standing zoom is handed to it BEFORE
  // the old node goes. Chrome fires the old node's blur from inside the
  // removal steps (node still attached, relatedTarget null), and while the
  // zoom still pointed at the old node its focusout guard read that blur as
  // "focus left the card" and closed the zoom — then the hover intent re-grew
  // it a beat later. Every pick made on a focused card blinked, on
  // production too (Kevin's journal, 2026-09-01: "focus left the card" ×2
  // within a second of each overlay press). Once the zoom already owns the
  // fresh node, the old node's blur is a stale node's blur and is ignored.
  el.before(fresh);
  if (onSwap) onSwap(fresh);
  el.remove();
  if (hadFocus) fresh.focus();
  return fresh;
}

// The card a zoom should be restored onto after a repaint: the one carrying
// this artist AND this occurrence. Both facts are needed — in Portola one
// name can be two cards (a grid billing and an event), and the wrong one is
// the wrong story.
//
// `room` breaks the one remaining tie. A combined-day show (Portola's Horse
// Meat Disco, day "Afters & Folsom") is ONE occurrence rendered in TWO rooms
// — that is deliberate, one show and one pick key (review round finding 19) —
// so its two cards carry byte-identical `data-occ` and the plain lookup
// returns whichever comes first in document order. A zoom standing on the
// Folsom tile then came back on the Afters cell: the overlay jumped rooms,
// which is one way "hover shows some other random looking card" happens.
// Passing the room the zoom was in keeps it where the person left it, and
// costs nothing when there is only one match.
export function cardFor(root, artist, occ, { room = null } = {}) {
  const want = occ ? JSON.stringify(occ) : '';
  const all = [...root.querySelectorAll('.card[data-artist]')]
    .filter((el) => el.dataset.artist === artist && (el.dataset.occ || '') === want);
  if (all.length > 1 && room) {
    const here = all.find((el) => roomOf(el) === room);
    if (here) return here;
  }
  return all[0] || null;
}
// Which room a card is in, for the tie-break above: the bucket of the room
// block it sits in, or the wall itself.
export function roomOf(el) {
  const room = el && el.closest ? el.closest('.room') : null;
  return (room && room.dataset.bucket) || null;
}

// ---- day grouping (lineup mode) -----------------------------------------------
// Split a combined day string ("Saturday & Sunday") into real days. Returns
// null unless EVERY part matches a known day name — an unrecognized part means
// the string isn't a clean combination and stays a literal group (ST-1).
export function splitDays(dayStr, knownDays) {
  if (!dayStr || !knownDays?.length) return null;
  // No comma in the separator set: real combinations use & / + / "and", while
  // commas live inside single-day labels ("Wednesday, Sept 16 (pre-party)").
  const parts = String(dayStr).split(/\s*[&+/]\s*|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const canon = new Map(knownDays.map((d) => [d.toLowerCase(), d]));
  const mapped = parts.map((p) => canon.get(p.toLowerCase()));
  return mapped.every(Boolean) ? mapped : null;
}

// The festival's real days, in intended order: dayMeta keys when curated,
// else the atomic (non-combined) day values in first-appearance order.
export function knownDaysOf(fest) {
  const meta = Object.keys(fest.dayMeta || {});
  if (meta.length) return meta;
  const days = [];
  for (const a of fest.artists || []) {
    if (!a.day || /[&+/]|\s+and\s+/i.test(a.day)) continue;
    if (!days.includes(a.day)) days.push(a.day);
  }
  return days;
}

// Artists keep billing order inside each group. Groups follow known-day order
// first, then first appearance; artists with no day form THE LINEUP block.
// A multi-day artist appears under EACH of its days (spec F4), never as a
// combined "Day X & Day Y" section.
export function groupByDay(artists, knownDays = []) {
  const groups = new Map();
  const add = (key, a) => {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  };
  for (const a of artists) {
    const split = splitDays(a.day, knownDays);
    if (split) for (const d of split) add(d, a);
    else add(a.day || '', a);
  }
  if (!knownDays.length) return groups;
  const ordered = new Map();
  if (groups.has('')) ordered.set('', groups.get(''));
  for (const d of knownDays) if (groups.has(d)) ordered.set(d, groups.get(d));
  for (const [k, v] of groups) if (!ordered.has(k)) ordered.set(k, v);
  return ordered;
}

// What a SCHEDULED wall still owes the lineup list: the artists[] entries the
// grid does not carry. Two kinds, in one ordered map —
//   - sections keyed to a non-grid day ("Afters", "Folsom"): events with a
//     venue in `stage` and hours in `time`, rendered as card sections under
//     the grid exactly as the lineup wall rendered them. A combined day
//     ("Afters & Folsom") lands in each. A lineup artist's afters show is a
//     separate artists[] entry, so it lands here even though the SAME name
//     also sits on the grid — one artist, one pick, cards in both places.
//   - '' (everything else): a lineup artist with no set on any grid day yet.
//     Grid-day entries whose name IS on the grid are skipped — that's the
//     grid's job. Deduped by name.
// Weekend-filtered like the grid, so a W2-only act stays out of a W1 view.
export function extraSectionsOf(fest, scheduledNames, weekend) {
  const gridDays = Object.keys(fest.days || {});
  const known = knownDaysOf(fest);
  const groups = new Map();
  const seenLoose = new Set();
  const add = (key, a) => {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  };
  for (const a of applyWeekend(fest.artists || [], weekend)) {
    const days = splitDays(a.day, known) || [a.day || ''];
    for (const d of days) {
      if (gridDays.includes(d)) {
        if (scheduledNames.has(a.name) || seenLoose.has(a.name)) continue;
        seenLoose.add(a.name);
        add('', a);
      } else if (d) {
        add(d, a);
      } else if (!scheduledNames.has(a.name) && !seenLoose.has(a.name)) {
        seenLoose.add(a.name);
        add('', a);
      }
    }
  }
  const ordered = new Map();
  for (const d of known) if (groups.has(d) && !gridDays.includes(d)) ordered.set(d, groups.get(d));
  for (const [k, v] of groups) if (k && !ordered.has(k)) ordered.set(k, v);
  if (groups.has('')) ordered.set('', groups.get(''));
  return ordered;
}

// One lineup-style section: a day rule, a card grid, the day's notes. Shared
// by the lineup wall and by the scheduled wall's extra sections so an afters
// card looks and behaves the same whichever wall it sits on.
function renderLineupGroup(root, day, list, ctx, fest, { header, sub } = {}) {
  const meta = (fest.dayMeta || {})[day];
  // A day KEY is frozen pick data and can be verbose ("Wednesday, Sept 16
  // (Early Arrival Pre-Party)"); the rule shows the weekday and moves the
  // aside to its sub line — the same split the day tab and the day sheet use.
  const parts = day ? dayLabelParts(day) : null;
  root.appendChild(dayHeader(
    header || (parts && parts.head) || 'THE LINEUP',
    sub !== undefined ? sub : (day ? [dayRuleSub(meta), parts.aside].filter(Boolean).join(' · ') : (ctx.sort === 'billing' ? 'BILLING ORDER' : '')),
    day && ctx.onOpenDayNotes ? {
      noteCount: model.noteCount(state.crewDoc, ctx.fid, 'day', day),
      onOpenNotes: () => ctx.onOpenDayNotes(day),
    } : {},
  ));
  // On a list (no clock to keep in shape) the people filter HIDES the cards
  // nobody selected has picked — and says so when that leaves nothing, so an
  // empty section reads as "no picks here" rather than "the data is gone".
  if (day && ctx.onOpenDayNotes) {
    const w = dayWhisper('day', day, ctx, () => ctx.onOpenDayNotes(day));
    if (w) root.appendChild(w);
  }
  renderCardGrid(root, list, ctx, { day, subLabelOf: lineupSubLabel });
  // A guessed time wears its tilde on every surface it prints on, and the
  // ONE whisper that explains it follows it here too (a search result, a
  // flat sort) — never a tilde with nothing to say what it means.
  if (list.some((a) => a.approx === true)) root.appendChild(approxWhisper());
}

// A lineup entry can be an EVENT (afters, Folsom) — venue rides in `stage`,
// hours in `time`. In a LIST (a lineup group, a flat sort, search) day and
// time share the first line and the venue takes its own (one crammed line
// hid both — Kevin, 2026-08-29); the .time element renders pre-line, so the
// newline is the break. Inside a day-first day the tile says only the time
// (the day is the day, the venue lives in the zoom) — see eventTileSubLabel.
function lineupSubLabel(a) {
  const time = a.time ? approxMark(a, a.time) : ''; // the tilde travels with `approx`
  let subLabel = [a.stage, time].filter(Boolean).join(' · ');
  if (a.stage && time) {
    const bits = a.stage.split(' · ');
    subLabel = bits.length > 1
      ? `${bits[0]} · ${time}\n${bits.slice(1).join(' · ')}`
      : `${time}\n${a.stage}`;
  }
  return subLabel || undefined;
}

// The card grid every list section shares: the people filter HIDES here (no
// clock to keep in shape) and says so when that leaves nothing, so an empty
// section reads as "no picks here" rather than "the data is gone".
function renderCardGrid(root, list, ctx, { day = null, subLabelOf = lineupSubLabel, className = 'wall-grid' } = {}) {
  const filtering = ctx.filterPeople && ctx.filterPeople.length;
  const shown = filtering ? list.filter((a) => passesPeople(ctx.picks, a.name, ctx.filterPeople)) : list;
  const grid = document.createElement('div');
  grid.className = className;
  const showTags = !ctx.weekend || ctx.weekend === 'all';
  for (const a of shown) {
    const tag = showTags && (a.weekends === 'W1' || a.weekends === 'W2') ? a.weekends : undefined;
    grid.appendChild(renderCard(a.name, ctx, { tag, time: subLabelOf(a), occ: { day: a.day || day || null, stage: a.stage || null, time: a.time || null, weekend: a.weekends || null } }));
  }
  if (filtering && !shown.length) {
    const none = document.createElement('div');
    none.className = 'section-empty';
    none.textContent = `No picks here from ${ctx.filterPeople.join(' or ')}.`;
    root.appendChild(none);
  }
  root.appendChild(grid);
  return shown;
}

// `opts.dayKey` is the jump / scrollspy key when the visible label is not
// the key itself — a day-first rule shows a verbose key's weekday head
// ("Wednesday, Sept 16 (Early Arrival Pre-Party)" → WEDNESDAY) the way
// every other path does, while the tabs still find it by its key.
function dayHeader(label, sub, opts = {}) {
  const rule = document.createElement('div');
  rule.className = 'day-rule';
  rule.dataset.day = opts.dayKey || label;
  const d = document.createElement('span');
  d.className = 'day';
  d.textContent = label.toUpperCase();
  const dt = document.createElement('span');
  dt.className = 'date';
  dt.textContent = sub || '';
  const line = document.createElement('span');
  line.className = 'line';
  rule.append(d, dt, line);
  // Day notes live at the day's front door (NT-2), not three scrolls past it.
  if (opts.onOpenNotes) {
    const chip = document.createElement('button');
    chip.className = 'chip-notes';
    chip.style.cssText = 'height: 17px; cursor: pointer; flex: none;';
    chip.textContent = opts.noteCount ? `${opts.noteCount} ✎` : '+ ✎';
    chip.setAttribute('aria-label', `Notes for ${label}`);
    chip.addEventListener('click', opts.onOpenNotes);
    rule.appendChild(chip);
  }
  return rule;
}

// The day rule's subtitle: real dates beat internal numbering (ST-4).
// A two-weekend scheduled fest carries per-weekend dates in meta.dates
// ({W1: 'Oct 2', W2: 'Oct 9'}) — the day key is the same "Friday" both
// weekends, so the sub is where the actual date lives.
function dayRuleSub(meta, weekend) {
  if (!meta) return '';
  const date = (weekend && meta.dates && meta.dates[weekend]) || meta.date;
  return [meta.wd, date || (meta.num ? `Day ${meta.num}` : '')].filter(Boolean).join(' · ');
}

// Which weekend a SCHEDULED two-weekend fest should render. Null = this fest
// has no weekend-tagged sets (single-weekend — the common case, no filter).
// A stored 'all' maps to W1: a clock grid showing BOTH weekends' Friday would
// double-book every stage with duplicate cards — "Both" is a lineup-view
// concept; on a timetable you are looking at one weekend or the other (ST-3).
export function scheduledWeekendOf(fest, pref) {
  const days = fest.days || {};
  const tagged = Object.keys(days).some((d) =>
    (days[d].artists || []).some((a) => a.weekend === 'W1' || a.weekend === 'W2'));
  if (!tagged) return null;
  return pref === 'W2' ? 'W2' : 'W1';
}

// ---- search / sort / weekend -----------------------------------------------------
// Fold diacritics so "tiesto" finds Tiësto — nobody hunts for the ë on a
// phone keyboard in a field (audit walker anomaly, verified real).
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function applyFilter(artists, query) {
  const q = fold((query || '').trim());
  if (!q) return artists;
  return artists.filter((a) => fold(a.name).includes(q));
}

// Multi-weekend fests (ST-3): 'all' shows everyone; W1/W2 shows that
// weekend's lineup (artists playing both always stay).
export function applyWeekend(artists, weekend) {
  if (!weekend || weekend === 'all') return artists;
  return artists.filter((a) => !a.weekends || a.weekends === 'both' || a.weekends === weekend);
}

export function applySort(artists, mode, ctx) {
  const arr = [...artists];
  const myLevel = (a) => (ctx.picks[a.name] || {})[ctx.meName] || 0;
  const crewHeat = (a) => Object.values(ctx.picks[a.name] || {}).reduce((s, l) => s + l, 0);
  if (mode === 'az') arr.sort((a, b) => a.name.localeCompare(b.name));
  else if (mode === 'mine') arr.sort((a, b) => myLevel(b) - myLevel(a));
  else if (mode === 'crew') arr.sort((a, b) => crewHeat(b) - crewHeat(a));
  return arr; // 'billing' and 'day' keep source order; day grouping handles days
}

// ---- set-times grid (atlas 21d: the same cards, on a clock) ---------------------
// One vertical page: every day gets a rule + a clock grid. Mobile shows ~2
// stages and swipes; desktop fits them all.
//
// The stage columns are CANONICAL across days (model.canonicalStages): every
// day renders the same columns in the same order on the same template, all
// day scrollers mirror ONE horizontal position, and a single sticky strip
// carries the stage names for the whole page — so scrolling straight down a
// column stays on one stage from Thursday to Sunday. The strip lives OUTSIDE
// the horizontal scrollers because position:sticky can't escape an
// overflow-x container (the same physics that put the hour rail outside).
export function computeTimesLayout(fest, getDayArtists, solo = null) {
  const stages = model.canonicalStages(fest);
  const days = Object.keys(fest.days || {});
  // The everything-else column is reserved festival-wide: if ANY day needs
  // it, every day gets it, or the shared template (and the strip) would lie.
  const hasEE = days.some((d) => ((fest.activities || {})[d] || []).length > 0
    || getDayArtists(d).some((a) => !stages.includes(a.stage)));
  // Stage solo (design option D): one stage wide, the rest folded to rails.
  // The same template feeds the strip and every day, so a folded column is
  // folded everywhere — scrolling down a soloed stage stays on it.
  const cols = columnsTemplate(stages, hasEE, solo);
  return {
    stages,
    hasEE,
    solo: cols.solo,
    colsTemplate: cols.template,
    rails: railLabels(stages), // what each stage's folded rail says
  };
}

// A stage header is a button: tap to solo that stage, tap the soloed one to
// restore all. Folded stages render as slim rails (still tappable — tapping a
// rail moves the solo there). The everything-else head never solos; it folds
// with the others.
function stageHead(label, { muted = false, layout = null, ctx = null } = {}) {
  const canSolo = !muted && ctx && typeof ctx.onSoloStage === 'function';
  const h = document.createElement(canSolo ? 'button' : 'div');
  h.className = 'stage-head';
  if (muted) h.style.color = 'var(--text-secondary)'; // neutral tint — not a stage
  h.title = label; // long names ellipsize — hover recovers
  const solo = layout && layout.solo;
  // The text sits in an inner label so the ellipsis clips THAT, not the
  // button — overflow:hidden on the button would also clip the ::after that
  // gives a 32px-tall head its 44px tap target (Codex gate, 2026-08-27).
  const text = document.createElement('span');
  text.className = 'label';
  h.appendChild(text);
  if (solo && label !== solo) {
    h.classList.add('rail');
    // Bounded to what a rail can show (filters.js railLabels — Codex round
    // 4, 2026-08-27); the full name stays in title and aria-label.
    text.textContent = muted ? 'ELSE' : ((layout.rails || {})[label] || label.slice(0, 4));
    h.setAttribute('aria-label', muted ? 'Everything else (folded)' : `Solo ${label}`);
  } else {
    text.textContent = label;
    if (solo === label) {
      h.setAttribute('aria-pressed', 'true');
      h.setAttribute('aria-label', `${label} — showing only this stage; tap for all stages`);
      const off = document.createElement('span');
      off.className = 'solo-off';
      off.textContent = '✕ all stages';
      text.appendChild(off);
    } else if (canSolo) {
      h.setAttribute('aria-pressed', 'false');
      h.setAttribute('aria-label', `Solo ${label}`);
    }
  }
  if (canSolo) h.addEventListener('click', () => ctx.onSoloStage(solo === label ? null : label));
  return h;
}

function renderStageStrip(layout, ctx) {
  const strip = document.createElement('div');
  strip.className = 'times-wrap stage-strip';
  const spacer = document.createElement('div');
  spacer.className = 'strip-rail'; // matches the hour rail's width for column alignment
  const scroll = document.createElement('div');
  scroll.className = 'times-scroll';
  const grid = document.createElement('div');
  grid.className = 'times-grid';
  grid.style.gridTemplateColumns = layout.colsTemplate;
  grid.style.gridTemplateRows = '32px';
  for (const s of layout.stages) grid.appendChild(stageHead(s, { layout, ctx }));
  if (layout.hasEE) grid.appendChild(stageHead('EVERYTHING ELSE', { muted: true, layout, ctx }));
  scroll.appendChild(grid);
  strip.append(spacer, scroll);
  return strip;
}

// ---- the now line --------------------------------------------------------------
// Rows are 15 minutes; a row is ROW_PX tall plus ROW_GAP between rows, so the
// pitch per row is their sum. Kept here beside the grid that uses them.
const ROW_PX = 20;
const ROW_GAP = 4;
const ROW_PITCH = ROW_PX + ROW_GAP;

// Draw (or move) the now line on every timetable grid whose day is today.
// Each grid carries its geometry as data attributes, so this can run from
// a one-minute ticker without a repaint. Removes a line whose day has ended.
export function positionNowLines(root, date = new Date()) {
  for (const grid of root.querySelectorAll('.times-grid[data-iso]')) {
    const clock = festivalClock(date, grid.dataset.tz || null); // the grid knows its festival's zone
    const rail = grid.parentElement && grid.parentElement.parentElement
      ? grid.parentElement.parentElement.querySelector('.times-rail') : null;
    const isToday = grid.dataset.iso === clock.iso;
    const top = isToday ? nowOffsetPx(clock.minutes, {
      startRow: Number(grid.dataset.startRow), rows: Number(grid.dataset.rows), pitch: ROW_PITCH,
    }) : null;
    let line = grid.querySelector('.now-line');
    let label = rail ? rail.querySelector('.now-label') : null;
    if (top == null) {
      if (line) line.remove();
      if (label) label.remove();
      continue;
    }
    if (!line) {
      line = document.createElement('div');
      line.className = 'now-line';
      line.setAttribute('aria-hidden', 'true');
      grid.appendChild(line);
    }
    line.style.top = `${top - 1}px`;
    line.dataset.minutes = String(clock.minutes);
    if (rail && !label) {
      label = document.createElement('span');
      label.className = 'now-label';
      rail.appendChild(label);
    }
    if (label) {
      label.style.top = `${top}px`;
      label.textContent = clockLabel(clock.minutes);
      label.setAttribute('aria-label', `Now, ${clockLabel(clock.minutes)}`);
    }
  }
}

// The day-of open: land the now line about a third of the way down the
// viewport so the next hour is in view. Before doors on festival day there
// is no line yet — land on today's day header instead. Returns the target
// it scrolled to ('now' | 'day') or null when today is not on this wall.
export function scrollToNowLine(root, { date = new Date(), viewportHeight = window.innerHeight, scrollTo = (y) => window.scrollTo({ top: y, behavior: 'auto' }), timeZone = null } = {}) {
  const pageY = (el) => el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
  const line = root.querySelector('.now-line');
  if (line) {
    scrollTo(Math.max(0, pageY(line) - viewportHeight * 0.33));
    return 'now';
  }
  // "Today" in the festival's zone — the grids carry it; the caller may too.
  const zoned = root.querySelector('.times-grid[data-tz]');
  const todayIso = festivalClock(date, timeZone || (zoned ? zoned.dataset.tz : null)).iso;
  const rule = root.querySelector(`.day-rule[data-iso="${todayIso}"]`);
  if (!rule) return null;
  // The day rule's scroll-margin-top is the sticky chrome's height (app.js
  // measures it into --jump-offset); land below it like a day-tab jump does.
  const offset = (typeof window !== 'undefined' && window.getComputedStyle)
    ? parseFloat(window.getComputedStyle(rule).scrollMarginTop) || 0 : 0;
  scrollTo(Math.max(0, pageY(rule) - offset));
  return 'day';
}

// Mirror one horizontal position across the strip and every day's scroller.
// Setting scrollLeft programmatically fires a scroll event on the target; the
// lastSet map recognizes that echo (same element, same value) and drops it
// instead of ping-ponging.
// Scrollers mirror within their GROUP (`data-sync`): the main grid's strip
// and days are one group; on a day-first wall every events timetable is its
// own (its venues are not the grid's stages, so its position is its own).
// Scrollers with no group — the grid-only wall — are one group, as before.
export function wireTimesScrollSync(root) {
  const groups = new Map();
  for (const s of root.querySelectorAll('.times-scroll')) {
    const key = s.dataset.sync || '*';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const scrollers of groups.values()) {
    if (scrollers.length < 2) continue;
    const lastSet = new Map();
    for (const s of scrollers) {
      s.addEventListener('scroll', () => {
        if (lastSet.get(s) === s.scrollLeft) { lastSet.delete(s); return; }
        for (const o of scrollers) {
          if (o !== s && o.scrollLeft !== s.scrollLeft) {
            lastSet.set(o, s.scrollLeft);
            o.scrollLeft = s.scrollLeft;
          }
        }
      }, { passive: true });
    }
  }
}

function renderScheduledDay(root, day, ctx, layout, weekend) {
  const fest = state.fest();
  const meta = (fest.dayMeta || {})[day];
  const rule = dayHeader(day, dayRuleSub(meta, weekend), {
    noteCount: model.noteCount(state.crewDoc, ctx.fid, 'day', day),
    onOpenNotes: ctx.onOpenDayNotes ? () => ctx.onOpenDayNotes(day) : null,
  });
  // The day rule knows its date too: on festival day, before doors, the
  // day-of open lands here when there is no now line yet to land on.
  const ruleIso = (meta && (weekend && meta.isos ? meta.isos[weekend] : meta.iso)) || null;
  if (ruleIso) rule.dataset.iso = ruleIso;
  root.appendChild(rule);
  // The whisper (2026-08-29): nothing until someone writes, then the newest
  // note at the day's door. The rule's ✎ chip stays the add door + count.
  if (ctx.onOpenDayNotes) {
    const w = dayWhisper('day', day, ctx, () => ctx.onOpenDayNotes(day));
    if (w) root.appendChild(w);
  }
  renderScheduledDayBody(root, day, ctx, layout, weekend);
}

// The day's clock: rail + grid. With `strip`, the day carries its OWN sticky
// stage strip inside a `.tt-block` (a day-first wall, where events
// timetables sit between grid days and one page-wide strip would name the
// wrong columns); without it, the wall's single strip above serves every day.
function renderScheduledDayBody(root, day, ctx, layout, weekend, { strip = false } = {}) {
  const fest = state.fest();
  const computed = state.getDayArtists(day, weekend);
  const stages = layout.stages;
  const meta = (fest.dayMeta || {})[day];

  const acts = (fest.activities || {})[day] || [];

  // A day with no timed sets must not mint a NaN grid (Math.min of nothing
  // is Infinity). Activities-only days render as a quiet list; truly empty
  // days say so instead of rendering nothing.
  if (!computed.length) {
    if (acts.length && !layout.solo) {
      const list = document.createElement('div');
      list.className = 'ee-col';
      for (const a of acts) list.appendChild(eeActivityRow(a));
      root.appendChild(list);
    } else {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: var(--text-tertiary); font-size: 12px; font-weight: 600; padding: 6px 0 2px;';
      empty.textContent = 'No set times for this day yet.';
      root.appendChild(empty);
    }
    return;
  }

  // Cards are laid out on DISPLAY extents: every set gets at least 30 visual
  // minutes (2 rows) so its name + time always fit. The lane math further
  // down runs on these same extents — the readability floor can make two
  // sets overlap VISUALLY that never overlap in time, and they need lanes
  // exactly like real overlaps (Codex arc gate, P1).
  const drawn = computed.map((a) => ({
    ...a, endMin: Math.max(a.endMin ?? a.startMin + 60, a.startMin + 30),
  }));
  const dayStart = Math.min(...drawn.map((a) => a.startMin));
  const dayEnd = Math.max(...drawn.map((a) => a.endMin));
  const startRow = Math.floor(dayStart / 15);
  const rows = Math.ceil(dayEnd / 15) - startRow;

  // Rail and grid are siblings sharing one rows template: the hour axis stays
  // pinned at the left while stage columns scroll (CORE-2). Stage names live
  // in the shared sticky strip above, not in per-day header rows.
  const rowsTemplate = `repeat(${rows}, 20px)`;
  const wrap = document.createElement('div');
  wrap.className = 'times-wrap';
  const rail = document.createElement('div');
  rail.className = 'times-rail';
  rail.style.gridTemplateRows = rowsTemplate;
  const scroll = document.createElement('div');
  scroll.className = 'times-scroll';
  scroll.dataset.day = day;
  const grid = document.createElement('div');
  grid.className = 'times-grid';
  grid.style.gridTemplateRows = rowsTemplate;
  grid.style.gridTemplateColumns = layout.colsTemplate;

  for (let r = startRow; r < startRow + rows; r++) {
    if (r % 4 !== 0) continue; // hour marks only
    const mins = r * 15;
    const hr = Math.floor(mins / 60) % 24;
    const label = document.createElement('div');
    label.className = 'hour-label';
    label.style.gridRow = String(r - startRow + 1);
    label.textContent = `${hr % 12 === 0 ? 12 : hr % 12} ${hr < 12 ? 'AM' : 'PM'}`;
    rail.appendChild(label);
  }
  // Everything that isn't a stage set lives in ONE far-right column (ST-2):
  // activities (workshops, ceremonies) and any set whose stage isn't a known
  // column. Anything with stage+time stays on the clock.
  const strays = drawn.filter((a) => stages.indexOf(a.stage) === -1);
  const dayHasEE = acts.length > 0 || strays.length > 0;

  // Same-stage overlaps split their column into side-by-side lanes (the old
  // grid's fix, dropped in the first v3 pass — the Codex P6 sweep surfaced
  // that EF genuinely has these; js/overlap.js is very much alive). Lanes are
  // computed on the drawn extents above, so display-floored collisions split
  // the column too.
  // The grid remembers its own geometry so the now line can be placed and
  // moved by the ticker without a repaint.
  grid.dataset.startRow = String(startRow);
  grid.dataset.rows = String(rows);
  const iso = (meta && (weekend && meta.isos ? meta.isos[weekend] : meta.iso)) || null;
  if (iso) grid.dataset.iso = iso;
  if (fest.timezone) grid.dataset.tz = fest.timezone;

  const lanes = computeLanes(drawn);
  for (const a of drawn) {
    const col = stages.indexOf(a.stage);
    if (col === -1) continue; // strays render in the everything-else column
    // A folded (non-solo) column is a 34px rail — its cards don't render.
    if (layout.solo && a.stage !== layout.solo) continue;
    const row = Math.floor(a.startMin / 15) - startRow + 1;
    // endMin here IS the display extent — minimum 2 rows (44px), below which
    // the name + time can't fit (Kevin's screenshot, 2026-07-12).
    const span = Math.max(1, Math.ceil((a.endMin - a.startMin) / 15));
    // A set three hours or longer (Despacio runs seven) is a TALL cell: its
    // name sits at the top edge like a printed grid and the bottom edge says
    // when it ends — centred content put the name three screens down and the
    // column read as an empty slab (Kevin's screenshot, 2026-08-31).
    const tall = span >= 12;
    const cell = renderCard(a.name, ctx, { cell: true, tall, until: tall ? a.endStr || null : null, time: a.startStr, occ: { day, stage: a.stage || null, time: a.time || null, weekend: a.weekend || null } });
    cell.style.gridColumn = String(col + 1);
    cell.style.gridRow = `${row} / span ${span}`;
    cell.style.minHeight = '0';
    const lane = lanes.get(a);
    if (lane && lane.lanes > 1) {
      // Lane math assumes border-box sizing (v3.css sets it on .card):
      // width% + margin-left% ≤ 100% keeps every lane inside its own column.
      cell.style.width = `calc(${(100 / lane.lanes).toFixed(3)}% - 2px)`;
      cell.style.marginLeft = `${((lane.lane * 100) / lane.lanes).toFixed(3)}%`;
    }
    grid.appendChild(cell);
  }

  if (dayHasEE && !layout.solo) {
    const col = document.createElement('div');
    col.className = 'ee-col';
    col.style.gridColumn = String(stages.length + 1);
    col.style.gridRow = `1 / span ${rows}`;
    const entries = [
      ...strays.map((a) => ({ min: a.startMin, artist: a })),
      ...acts.map((a) => ({ min: activityMinutes((a.time || '').split(' - ')[0] || '12:00 PM'), act: a })),
    ].sort((x, y) => x.min - y.min);
    for (const e of entries) {
      if (e.artist) {
        col.appendChild(renderCard(e.artist.name, ctx, { cell: true, time: e.artist.startStr, occ: { day, stage: e.artist.stage || null, time: e.artist.time || null, weekend: e.artist.weekend || null } }));
      } else {
        col.appendChild(eeActivityRow(e.act));
      }
    }
    grid.appendChild(col);
  }
  scroll.appendChild(grid);
  wrap.append(rail, scroll);
  if (strip) {
    const block = document.createElement('div');
    block.className = 'tt-block';
    const stripEl = renderStageStrip(layout, ctx);
    stripEl.querySelector('.times-scroll').dataset.sync = 'grid';
    scroll.dataset.sync = 'grid';
    block.append(stripEl, wrap);
    root.appendChild(block);
  } else {
    root.appendChild(wrap);
  }
  // Today's grid gets the now line on first paint (the ticker keeps it moving).
  if (iso && nowOnDay(fest, day, weekend, ctx.now || new Date()) != null) positionNowLines(wrap, ctx.now || new Date());
}

// One quiet row in the everything-else column (also the whole body of an
// activities-only day).
function eeActivityRow(act) {
  const rowEl = document.createElement('div');
  rowEl.className = 'ee-item';
  const t = document.createElement('span');
  t.className = 'ee-time';
  t.textContent = act.time || '';
  const n = document.createElement('span');
  n.className = 'ee-name';
  n.textContent = act.name;
  const v = document.createElement('span');
  v.className = 'ee-venue';
  v.textContent = act.venue || '';
  rowEl.append(t, n, v);
  return rowEl;
}

// ---- day-first (MODEL-V3, 2026-09-01) --------------------------------------------
// The day tabs are THE days — the union of grid days and event nights — and
// one day renders its rooms in order: the festival's own (the grid, or a
// lineup day's billing), then one section per events section active that
// night, each laid out by the rule events.js computes ONCE per fest.
//
// Whether a fest is day-first at all is the events model's call (a section
// entry must carry a night, and every day key must own one weekday); null
// here means "render exactly as before". Shared with the day nav so the tab
// bar and the wall can never disagree about what the days are.
export function dayFirstModelFor(fest, ctx) {
  const scheduled = !!(fest.days && Object.keys(fest.days).length);
  // A lineup wall's flat sorts (A → Z, my picks, most picked) are one list,
  // not days — only the grouped sorts compose by day.
  if (!scheduled && !(ctx.sort === 'billing' || ctx.sort === 'day')) return null;
  const wk = scheduled ? scheduledWeekendOf(fest, ctx.weekend) : null;
  const artists = applyWeekend(fest.artists || [], scheduled ? wk : ctx.weekend);
  const gridDays = scheduled ? Object.keys(fest.days) : [];
  const model = eventModelOf(fest, groupByDay(artists, knownDaysOf(fest)), { gridDays, weekend: wk });
  if (!model.dayFirst) return null;
  return { model, scheduled, wk, gridDays };
}

// What the day tabs (dock + rail) should list, in the wall's own order.
export function dayNavOf(fest, ctx) {
  const scheduled = !!(fest.days && Object.keys(fest.days).length);
  if (!ctx.query) {
    const plan = dayFirstModelFor(fest, ctx);
    if (plan) return plan.model.days.map((d) => ({ key: d.key, short: d.short, long: d.long }));
  }
  // Grid days plus the sections the wall renders under the grid (afters,
  // Folsom) — the tab bar mirrors what the wall shows, or a section exists
  // with no way to jump to it. Lineup fests: the same split-aware grouping
  // the wall renders, so a "Saturday & Sunday" artist never mints a tab.
  let groups;
  if (scheduled) {
    const wk = scheduledWeekendOf(fest, ctx.weekend);
    const scheduledNames = new Set();
    for (const d of Object.keys(fest.days)) for (const a of state.getDayArtists(d, wk)) scheduledNames.add(a.name);
    groups = [...Object.keys(fest.days), ...[...extraSectionsOf(fest, scheduledNames, wk).keys()].filter(Boolean)];
  } else {
    groups = [...groupByDay(fest.artists || [], knownDaysOf(fest)).keys()].filter(Boolean);
  }
  return groups.map((day) => {
    const meta = (fest.dayMeta || {})[day];
    return {
      key: day,
      short: (meta?.wd || day).slice(0, 3).toUpperCase(),
      // Rail tabs stay compact: a verbose day key shows its weekday only —
      // the same split the day rule and the day sheet use.
      long: (meta?.wd ? `${meta.wd} ${meta.num || ''}`.trim() : dayLabelParts(day).head).toUpperCase(),
    };
  });
}

const mk = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};
const dedupeByName = (list) => {
  const seen = new Set();
  return list.filter((a) => (seen.has(a.name) ? false : (seen.add(a.name), true)));
};

function renderDayFirst(root, ctx, fest, { model: plan, scheduled, wk, gridDays }) {
  const buckets = bucketsOf(fest, plan);
  // A stored key the fest no longer offers (a section renamed, a fest that
  // lost one) is nobody's: ignored here, and never named in the whisper.
  const known = new Set(buckets.map((b) => b.key));
  const hidden = new Set((ctx.bucketsOff || []).filter((k) => known.has(k)));
  if (buckets.length > 1) root.appendChild(bucketRow(buckets, hidden, ctx));
  const festOn = !hidden.has(FEST_BUCKET);
  const now = ctx.now || new Date();
  const dayArtists = (d) => state.getDayArtists(d, wk);
  const layout = scheduled ? computeTimesLayout(fest, dayArtists, ctx.soloStage || null) : null;
  const gridNames = new Map();
  if (scheduled) for (const d of gridDays) gridNames.set(d, new Set(dayArtists(d).map((a) => a.name)));
  const anyGridName = new Set([...gridNames.values()].flatMap((s) => [...s]));

  // A lineup wall's day-less block (THE LINEUP) leads, as it always has.
  if (!scheduled && festOn && plan.looseNoDay.length) renderLineupGroup(root, '', plan.looseNoDay, ctx, fest);

  const whispered = new Set();
  for (const day of plan.days) {
    const rule = dayHeader(dayLabelParts(day.key).head, day.sub, {
      dayKey: day.key,
      noteCount: model.noteCount(state.crewDoc, ctx.fid, 'day', day.key),
      onOpenNotes: ctx.onOpenDayNotes ? () => ctx.onOpenDayNotes(day.key) : null,
    });
    if (day.iso) rule.dataset.iso = day.iso; // the day-of open lands here before doors
    root.appendChild(rule);
    if (ctx.onOpenDayNotes) {
      const w = dayWhisper('day', day.key, ctx, () => ctx.onOpenDayNotes(day.key));
      if (w) root.appendChild(w);
    }
    let rooms = 0;
    if (festOn && day.grid) {
      rooms += 1;
      const room = roomBlock(FEST_BUCKET);
      room.appendChild(sectionHeader(fest.name, festRoomSub(fest), { key: FEST_BUCKET }));
      renderScheduledDayBody(room, day.key, ctx, layout, wk, { strip: true });
      root.appendChild(room);
      // Billed on this day, not on this day's grid: still this day's, not
      // an orphan at the foot of the page.
      const loose = dedupeByName((day.billing || []).filter((a) => !gridNames.get(day.key).has(a.name)));
      if (loose.length) {
        rooms += 1;
        const more = roomBlock(FEST_BUCKET);
        more.appendChild(sectionHeader('Everything else', 'No set time yet', { key: FEST_BUCKET }));
        renderCardGrid(more, loose, ctx, { day: day.key });
        root.appendChild(more);
      }
    } else if (festOn && day.billing) {
      rooms += 1;
      const room = roomBlock(FEST_BUCKET);
      room.appendChild(sectionHeader(fest.name, '', { key: FEST_BUCKET }));
      renderCardGrid(room, day.billing, ctx, { day: day.key });
      root.appendChild(room);
    }
    for (const sec of plan.sections) {
      if (hidden.has(sec.key)) continue;
      const list = sec.byDay.get(day.key);
      if (!list) continue;
      rooms += 1;
      const room = roomBlock(sec.key);
      // The section's notes keep their key (frozen-key law): the ✎ chip on
      // every day's sub-rule opens the same "Afters" thread.
      room.appendChild(sectionHeader(sec.label, '', {
        key: sec.key,
        noteCount: model.noteCount(state.crewDoc, ctx.fid, 'day', sec.key),
        onOpenNotes: ctx.onOpenDayNotes ? () => ctx.onOpenDayNotes(sec.key) : null,
      }));
      // The newest-note whisper once per scroll, at the section's first door.
      if (!whispered.has(sec.key) && ctx.onOpenDayNotes) {
        const w = dayWhisper('day', sec.key, ctx, () => ctx.onOpenDayNotes(sec.key));
        if (w) { room.appendChild(w); whispered.add(sec.key); }
      }
      if (sec.mode === 'columns') renderEventsTimetable(room, list, ctx, { fest, section: sec, day, now });
      else renderEventTiles(room, list, ctx, { day });
      root.appendChild(room);
    }
    if (!rooms) {
      root.appendChild(mk('div', 'section-empty', `Everything on ${dayLabelParts(day.key).head} is hidden — tap a chip at the top to bring it back.`));
    }
  }
  // Section entries that never said which night render the old way, after
  // the days — partial data degrades to yesterday's wall, never to nothing.
  for (const sec of plan.sections) if (!hidden.has(sec.key) && sec.loose.length) renderLineupGroup(root, sec.key, sec.loose, ctx, fest);
  // A scheduled fest's day-less names that sit on no grid: everything else.
  if (scheduled && festOn) {
    const loose = dedupeByName(plan.looseNoDay.filter((a) => !anyGridName.has(a.name)));
    if (loose.length) renderLineupGroup(root, '', loose, ctx, fest, { header: 'EVERYTHING ELSE', sub: 'NO SET TIME YET' });
  }
  const whisper = hidden.size ? hiddenWhisper(buckets, hidden) : null;
  if (whisper) root.appendChild(whisper);
  festNotesFoot(root, ctx, fest);
  wireTimesScrollSync(root);
}

// One room on a day: the sub-rule and its body travel together, tagged with
// the bucket that can hide them (app.js animates the room out and in).
function roomBlock(bucket) {
  const room = mk('div', 'room');
  room.dataset.bucket = bucket;
  return room;
}

// The festival's own room says where it is: "PORTOLA · PIER 80" — the venue
// festPlaceLine leads with, as text (the header above already has the door).
function festRoomSub(fest) {
  const venue = (fest.subtitle || '').split(' · ')[0].trim();
  return venue || fest.location || '';
}

// The section sub-rule — the day-rule's quieter sibling. A ✎ chip when the
// section has a notes key of its own.
function sectionHeader(label, sub, { key = null, noteCount = 0, onOpenNotes = null } = {}) {
  const h = mk('div', 'sec-head');
  if (key) h.dataset.section = key;
  h.append(mk('span', 'sec-label', String(label).toUpperCase()), mk('span', 'sec-sub', sub || ''), mk('span', 'sec-line'));
  if (onOpenNotes) {
    const chip = mk('button', 'chip-notes', noteCount ? `${noteCount} ✎` : '+ ✎');
    chip.style.cssText = 'height: 17px; cursor: pointer; flex: none;';
    chip.setAttribute('aria-label', `Notes for ${label}`);
    chip.addEventListener('click', onOpenNotes);
    h.appendChild(chip);
  }
  return h;
}

// The bucket filter (MODEL-V3 §3): one chip per room the fest has. Off = a
// dashed outline in the people-chip vocabulary; on = the app's own brand
// tint — never the festival accent, which has exactly four homes.
function bucketRow(buckets, hidden, ctx) {
  const row = mk('div', 'bucket-row');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Show or hide parts of the festival');
  for (const b of buckets) {
    const on = !hidden.has(b.key);
    const chip = mk('button', 'bucket-chip');
    chip.type = 'button';
    chip.dataset.bucket = b.key;
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    chip.setAttribute('aria-label', `${on ? 'Hide' : 'Show'} ${b.label}`);
    const check = mk('span', 'bc-check', on ? '✓' : '');
    check.setAttribute('aria-hidden', 'true');
    chip.append(check, mk('span', 'bc-label', String(b.label).toUpperCase()));
    if (ctx.onToggleBucket) chip.addEventListener('click', () => ctx.onToggleBucket(b.key));
    row.appendChild(chip);
  }
  return row;
}

// The foot-whisper that keeps the way back visible.
function hiddenWhisper(buckets, hidden) {
  const names = buckets.filter((b) => hidden.has(b.key)).map((b) => b.label);
  if (!names.length) return null;
  const one = names.length === 1;
  const list = one ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return mk('div', 'wall-whisper', `${list} ${one ? 'is' : 'are'} hidden — tap ${one ? 'its chip' : 'their chips'} to bring ${one ? 'it' : 'them'} back.`);
}

const tileSubLabel = (e) => (parseEventTime(e.time) ? approxMark(e, timeRange(e.time)) : undefined);
const bare = () => undefined;

// TIME TBA: the quiet row the timeless land in, under a section that has a
// clock (or timed tiles) above it — and VENUE TBA, its sibling for a set
// that has a time but no room yet (the time stays; a real time is never
// hidden). The people filter hides here; when it hides everything, the row
// goes too — the shape above already says the day.
function tbaBlock(list, ctx, day, { label = 'TIME TBA', subLabelOf = bare } = {}) {
  const filtering = ctx.filterPeople && ctx.filterPeople.length;
  const shown = filtering ? list.filter((a) => passesPeople(ctx.picks, a.name, ctx.filterPeople)) : list;
  if (!shown.length) return null;
  const block = mk('div', 'tba');
  block.appendChild(mk('div', 'tba-label', label));
  renderCardGrid(block, shown, ctx, { day: day.key, subLabelOf });
  return block;
}
// The LOCKED copy (MODEL-V3 §5): no terminal period.
const approxWhisper = () => mk('div', 'sec-whisper', '~ marks a guessed set time — the order is the plan');

// Tiles: time-sorted, the timeless at the end. Resting tiles stay CLEAN
// (Kevin, 2026-08-31): name + time when there is one, nothing else — the
// venue, its map door and any TBA talk live in the zoom.
function renderEventTiles(room, list, ctx, { day }) {
  const filtering = ctx.filterPeople && ctx.filterPeople.length;
  const sorted = sortForTiles(list);
  const visible = filtering ? sorted.filter((a) => passesPeople(ctx.picks, a.name, ctx.filterPeople)) : sorted;
  if (!visible.length) {
    room.appendChild(mk('div', 'section-empty', `No picks here from ${ctx.filterPeople.join(' or ')}.`));
    return;
  }
  const timed = visible.filter((e) => parseEventTime(e.time));
  const untimed = visible.filter((e) => !parseEventTime(e.time));
  if (timed.length) renderCardGrid(room, timed, ctx, { day: day.key, subLabelOf: tileSubLabel });
  if (untimed.length) {
    if (timed.length) room.appendChild(tbaBlock(untimed, ctx, day));
    else renderCardGrid(room, untimed, ctx, { day: day.key, subLabelOf: bare });
  }
  if (list.some((e) => e.approx === true)) room.appendChild(approxWhisper());
}

// Columns: the main grid's grammar with venues as stages — a sticky venue
// strip scoped to THIS timetable, 15-minute rows, the hour rail outside the
// scroller. Every venue's night is ONE vertical run, stacked top to bottom in
// play order — never lanes, never a deck (events.js timetableOf decides).
function renderEventsTimetable(room, list, ctx, { fest, section, day, now }) {
  const tt = timetableOf(list);
  // A night with nothing to put on a clock (no timed set with a room) is
  // tiles for the night — never a bare TIME TBA heading over an empty grid.
  // The section keeps its columns on the nights that earn them.
  if (!tt.venues.length) { renderEventTiles(room, list, ctx, { day }); return; }
  {
    const syncKey = `${section.key}|${day.key}`;
    // Capped columns: a two-venue Thursday must not become two 600px cards.
    const colsTemplate = `repeat(${tt.venues.length}, minmax(150px, 240px))`;
    const block = mk('div', 'tt-block');
    const strip = mk('div', 'times-wrap stage-strip');
    const sscroll = mk('div', 'times-scroll');
    sscroll.dataset.sync = syncKey;
    const sgrid = mk('div', 'times-grid');
    sgrid.style.gridTemplateColumns = colsTemplate;
    sgrid.style.gridTemplateRows = '32px';
    for (const v of tt.venues) {
      const head = stageHead(v); // a venue head is a stage header (the accent's home) — but never a solo button
      head.classList.add('venue');
      sgrid.appendChild(head);
    }
    sscroll.appendChild(sgrid);
    strip.append(mk('div', 'strip-rail'), sscroll);

    const rowsTemplate = `repeat(${tt.rows}, 20px)`;
    const wrap = mk('div', 'times-wrap');
    const rail = mk('div', 'times-rail');
    rail.style.gridTemplateRows = rowsTemplate;
    const scroll = mk('div', 'times-scroll');
    scroll.dataset.sync = syncKey;
    scroll.dataset.day = day.key;
    scroll.dataset.section = section.key;
    const grid = mk('div', 'times-grid');
    grid.style.gridTemplateRows = rowsTemplate;
    grid.style.gridTemplateColumns = colsTemplate;
    grid.dataset.startRow = String(tt.startRow);
    grid.dataset.rows = String(tt.rows);
    if (day.iso) grid.dataset.iso = day.iso; // the now line finds tonight's timetable too
    if (fest.timezone) grid.dataset.tz = fest.timezone;
    for (let r = tt.startRow; r < tt.startRow + tt.rows; r++) {
      if (r % 4 !== 0) continue;
      const label = mk('div', 'hour-label', hourLabelOf(r * 15));
      label.style.gridRow = String(r - tt.startRow + 1);
      rail.appendChild(label);
    }
    for (const c of tt.cells) {
      const t = c.entry;
      const tall = c.span >= 12;
      const cell = renderCard(t.e.name, ctx, { cell: true, tall, until: tall ? t.endStr || null : null, time: approxMark(t.e, t.startStr), occ: occOf(t.e) });
      cell.style.gridColumn = String(c.col);
      cell.style.gridRow = `${c.row} / span ${c.span}`;
      cell.style.minHeight = '0';
      grid.appendChild(cell);
    }
    scroll.appendChild(grid);
    wrap.append(rail, scroll);
    block.append(strip, wrap);
    room.appendChild(block);
    if (day.iso) positionNowLines(wrap, now);
  }
  if (tt.loose.length) {
    const block = tbaBlock(sortForTiles(tt.loose), ctx, day, { label: 'VENUE TBA', subLabelOf: tileSubLabel });
    if (block) room.appendChild(block);
  }
  if (tt.tba.length) {
    const block = tbaBlock(tt.tba, ctx, day);
    if (block) room.appendChild(block);
  }
  if (list.some((e) => e.approx === true)) room.appendChild(approxWhisper());
}

// ---- the wall ------------------------------------------------------------------
// The repaint boundary preserves ephemeral client state (audit Class 1): a
// remote sync tearing down #wall-root must never cost the user their scroll
// position or a half-typed note. Harvest before teardown, restore after.
function harvestEphemera(root) {
  const scrolls = new Map();
  // Every timetable scroller mirrors one shared position within its sync
  // group (the grid-only wall is one group) — harvest one per group.
  for (const s of root.querySelectorAll('.times-scroll')) {
    const key = s.dataset.sync || '*';
    if (!scrolls.has(key) && s.scrollLeft) scrolls.set(key, s.scrollLeft);
  }
  const drafts = new Map();
  for (const input of root.querySelectorAll('.composer input[data-draft-key]')) {
    if (input.value) {
      drafts.set(input.dataset.draftKey, {
        value: input.value,
        focused: document.activeElement === input,
        caret: input.selectionStart,
      });
    }
  }
  return { scrolls, drafts };
}

function restoreEphemera(root, { scrolls, drafts }) {
  for (const s of root.querySelectorAll('.times-scroll')) {
    const left = scrolls.get(s.dataset.sync || '*');
    if (left) s.scrollLeft = left;
  }
  for (const input of root.querySelectorAll('.composer input[data-draft-key]')) {
    const d = drafts.get(input.dataset.draftKey);
    if (!d) continue;
    input.value = d.value;
    if (d.focused) {
      input.focus();
      try { input.setSelectionRange(d.caret, d.caret); } catch { /* type quirks */ }
    }
  }
}

export function renderWall(root, ctx) {
  const ephemera = harvestEphemera(root);
  renderWallInner(root, ctx);
  restoreEphemera(root, ephemera);
}

function renderWallInner(root, ctx) {
  root.textContent = '';
  const fest = state.fest();
  const scheduled = fest.days && Object.keys(fest.days).length;

  // Day-first (MODEL-V3, 2026-09-01): a fest whose sections say which NIGHT
  // each show is on renders one day at a time — the grid, then that night's
  // sections. Every other fest takes the paths below, untouched.
  if (!ctx.query) {
    const plan = dayFirstModelFor(fest, ctx);
    if (plan) { renderDayFirst(root, ctx, fest, plan); return; }
  }

  if (scheduled && !ctx.query) {
    const wk = scheduledWeekendOf(fest, ctx.weekend);
    const dayArtists = (d) => state.getDayArtists(d, wk);
    const layout = computeTimesLayout(fest, dayArtists, ctx.soloStage || null);
    if (layout.stages.length) root.appendChild(renderStageStrip(layout, ctx));
    for (const day of Object.keys(fest.days)) renderScheduledDay(root, day, ctx, layout, wk);
    wireTimesScrollSync(root);
    // The grid carries the festival days; everything the lineup list still
    // owns (afters, Folsom, sets not yet timed) follows it as card sections.
    // Without this, flipping a fest to `scheduled` silently deleted every
    // afters card the crew had been picking on for weeks.
    const scheduledNames = new Set();
    for (const day of Object.keys(fest.days)) for (const a of dayArtists(day)) scheduledNames.add(a.name);
    for (const [day, list] of extraSectionsOf(fest, scheduledNames, wk)) {
      renderLineupGroup(root, day, list, ctx, fest, day ? {} : { header: 'EVERYTHING ELSE', sub: 'NO SET TIME YET' });
    }
    festNotesFoot(root, ctx, fest);
    return;
  }

  // Searching a scheduled fest must still answer "where and when" (CORE-4):
  // matches render per day, chronological, each card carrying stage · time.
  if (scheduled) {
    const q = ctx.query.trim().toLowerCase();
    // Search respects the selected weekend too — you've declared which grid
    // you're standing in, and a W2-only answer to a W1 search is a wrong turn.
    const wk = scheduledWeekendOf(fest, ctx.weekend);
    const scheduledNames = new Set();
    let any = false;
    for (const day of Object.keys(fest.days)) {
      const computed = state.getDayArtists(day, wk);
      computed.forEach((a) => scheduledNames.add(a.name));
      // Search results are a LIST, so the people filter hides here rather
      // than dims — a filtered search must not resurface someone's non-pick.
      const matches = computed.filter((a) => a.name.toLowerCase().includes(q))
        .filter((a) => passesPeople(ctx.picks, a.name, ctx.filterPeople))
        .sort((x, y) => x.startMin - y.startMin);
      if (!matches.length) continue;
      any = true;
      const meta = (fest.dayMeta || {})[day];
      root.appendChild(dayHeader(day, dayRuleSub(meta, wk) || (meta ? `${meta.wd || ''} ${meta.num || ''}`.trim() : '')));
      const grid = document.createElement('div');
      grid.className = 'wall-grid';
      for (const a of matches) grid.appendChild(renderCard(a.name, ctx, { time: `${a.stage} · ${a.startStr}`, occ: { day, stage: a.stage || null, time: a.time || null, weekend: a.weekend || null } }));
      root.appendChild(grid);
    }
    // Afters/Folsom cards and lineup entries with no set time yet still
    // deserve to be findable — within the selected weekend: a W2-only act
    // must not resurface here after the grid correctly filtered it out.
    for (const [day, list] of extraSectionsOf(fest, scheduledNames, wk)) {
      const matches = applyFilter(list, ctx.query).filter((a) => passesPeople(ctx.picks, a.name, ctx.filterPeople));
      if (!matches.length) continue;
      any = true;
      renderLineupGroup(root, day, matches, ctx, { ...fest, dayMeta: fest.dayMeta }, day ? {} : { header: 'EVERYTHING ELSE', sub: 'NO SET TIME YET' });
    }
    if (!any) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-align: center; padding: 30px 0;';
      empty.textContent = 'No artists match — try fewer letters.';
      root.appendChild(empty);
    }
    return;
  }

  const artists = applySort(applyFilter(applyWeekend(fest.artists || [], ctx.weekend), ctx.query), ctx.sort, ctx);

  if (!artists.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-align: center; padding: 30px 0;';
    empty.textContent = ctx.query ? 'No artists match — try fewer letters.' : 'Lineup coming soon — notes work now.';
    root.appendChild(empty);
    if (ctx.query) return;
    festNotesFoot(root, ctx, fest, { invite: true });
    return;
  }

  const grouped = ctx.sort === 'billing' || ctx.sort === 'day'
    ? groupByDay(artists, knownDaysOf(fest))
    : new Map([['', artists]]);
  for (const [day, list] of grouped) renderLineupGroup(root, day, list, ctx, fest);

  festNotesFoot(root, ctx, fest);
}

// Fest-wide notes close the wall (21c bottom) — as the whisper once anyone
// has written. On a lineup-less fest (when planning notes matter MOST,
// CORE-10) a quiet add-first door keeps the invitation alive.
function festNotesFoot(root, ctx, fest, { invite = false } = {}) {
  if (!ctx.onOpenFestNotes) return;
  const has = model.noteCount(state.crewDoc, ctx.fid, 'fest', null) > 0;
  if (!has && !invite) return;
  root.appendChild(dayHeader(`NOTES · ${fest.name.toUpperCase()}`, ''));
  const w = dayWhisper('fest', null, ctx, () => ctx.onOpenFestNotes());
  if (w) { root.appendChild(w); return; }
  const add = document.createElement('button');
  add.className = 'btn-ghost add-first-note';
  add.style.cssText = 'font-size: 12px; padding: 9px 14px;';
  add.textContent = '+ Add a note';
  add.addEventListener('click', () => ctx.onOpenFestNotes());
  root.appendChild(add);
}

let toastTimer = null;

// A toast with no action — for states the user can't undo (migration gate,
// offline explanations). Never render a button that does nothing (CORE-17).
export function showToast(container, message, ms = 4000) {
  container.textContent = '';
  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  const msg = document.createElement('span');
  msg.textContent = message;
  toast.appendChild(msg);
  container.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { container.textContent = ''; }, ms);
}

// ---- action toast: a line and one button ---------------------------------------
// The undo toast (design open question 1: tap-5 clears via undo window) and
// the new-build toast are the same shape with a different verb.
export function showActionToast(container, message, label, onAction, ms = 5000) {
  container.textContent = '';
  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  const msg = document.createElement('span');
  msg.textContent = message;
  const btn = document.createElement('button');
  btn.className = 'undo-btn';
  btn.textContent = label;
  btn.addEventListener('click', () => { clearTimeout(toastTimer); container.textContent = ''; onAction(); });
  toast.append(msg, btn);
  container.appendChild(toast);
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => { container.textContent = ''; }, ms);
}
export function showUndoToast(container, message, onUndo) {
  showActionToast(container, message, 'Undo', onUndo, 5000);
}

// ---- day-nav scrollspy ------------------------------------------------------------
// One observer drives every tab container (mobile dock + desktop rail): the
// active day is a single fact rendered in two places.
export function wireScrollspy(containers, wallRoot) {
  const list = Array.isArray(containers) ? containers : [containers];
  const tabs = list.flatMap((c) => [...c.querySelectorAll('.day-tab')]);
  if (!tabs.length) return () => {};
  const tabDays = new Set(tabs.map((t) => t.dataset.day));
  // Observe ONLY headers that correspond to a tab — the NOTES/EVERYTHING-ELSE
  // pseudo-headers share dayHeader() anatomy and used to de-highlight every
  // tab when they scrolled into the band (audit 1.3).
  const headers = [...wallRoot.querySelectorAll('.day-rule[data-day]')]
    .filter((h) => tabDays.has(h.dataset.day));
  const setActive = (day) => {
    tabs.forEach((t) => {
      const on = t.dataset.day === day;
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
    });
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      setActive(e.target.dataset.day);
    }
  }, { rootMargin: '-10% 0px -80% 0px' });
  headers.forEach((h) => io.observe(h));

  // The observer only speaks when a header crosses a thin band at 10–20% of the
  // viewport. Any scroll big enough to clear that band in one go — a scrollbar
  // drag, End, Page-Down, a hard fling on a 6,000px page — never trips it, so
  // the day tab kept pointing at Thursday while you stood in Sunday's grid, and
  // stayed wrong until a header happened to drift back through the band. A nav
  // indicator that lies about where you are is worse than no indicator.
  //
  // So geometry gets the last word: after every scroll, the active day is simply
  // the last day-rule you have scrolled past. rAF-throttled, and it reads the
  // same --jump-offset the day-tab jump lands against, so the two agree.
  let ticking = false;
  const syncFromGeometry = () => {
    ticking = false;
    if (!headers.length) return;
    const offset = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--jump-offset'),
    ) || 8;
    let current = headers[0];
    for (const h of headers) {
      if (h.getBoundingClientRect().top <= offset + 1) current = h;
      else break; // headers are in document order
    }
    setActive(current.dataset.day);
  };
  // The initial claim. At load the first day is on screen — say so instead
  // of nothing. But this also runs on every re-wire (a people filter or a
  // stage solo repaints the wall), and there the page may be scrolled deep
  // into Sunday: claiming "Saturday" was a lie the tab wore until the next
  // scroll event (UI walk, 2026-08-27). Read the geometry whenever there is
  // scroll to read; position 0 keeps the first-day shortcut so a fresh load
  // never depends on layout having settled.
  let frame = 0;
  if (window.scrollY > 0) {
    syncFromGeometry();
    // …and once more next frame: the caller measures the sticky chrome
    // (--jump-offset) AFTER wiring, and entering or leaving search adds or
    // drops the stage strip, so the first read can be against the old
    // offset (Codex round 4, 2026-08-27).
    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(syncFromGeometry);
  } else setActive(tabs[0].dataset.day);
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(syncFromGeometry);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    io.disconnect();
    window.removeEventListener('scroll', onScroll);
    if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
  };
}
