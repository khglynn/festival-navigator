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
import { dayLabelParts } from '../time.js';
import { whoCorner, aboutCorner } from './aura.js';
import { BOARD } from './palette.js';
import { dayWhisper, festWhisper, shortDayLabel } from './notes.js'; // runtime-only cycle with this module (colorIndexOf) — safe
import { factsFor, timeRange } from './card-facts.js'; // same runtime-only cycle: the card's ONE model
import { passesPeople, columnsTemplate, railLabels, FEST_ROOM } from './filters.js';
import { nowOnDay, nowOffsetPx, clockLabel, festivalClock } from './now.js';
import { eventModelOf, venueGroupsOf, dateRuleLabel, occOf, hourLabelOf, approxMark, parseEventTime } from './events.js';
import { reduced } from './motion.js';

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
  // stays one tap away.
  // Digitizer jitter fires pointermove even on a still finger, so cancel only
  // past a real movement threshold (10px) — a genuine scroll-drag cancels,
  // a held finger does not (Codex P3 trail, finding 1).
  if (ctx.onPeek) {
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
      // gesture — a fire from the orphan would zoom a card that is gone.
      pressTimer = setTimeout(() => {
        // isConnected covers repaint detachment; offsetParent covers a screen
        // change hiding the wall mid-press (audit 10.2) — a zoom must never
        // pop over Settings or the landing after the fact.
        if (!el.isConnected || el.offsetParent === null) return;
        longPressed = true;
        ctx.onPeek(artistName, el, opts.occ || null);
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
  // The now window rides the NODE (venueGroups stamps it from the model), so a
  // refresh that dropped it would put the ring out on whoever is playing the
  // moment you picked them, until the next full repaint.
  if (el.dataset.nowFrom) {
    fresh.dataset.nowFrom = el.dataset.nowFrom;
    fresh.dataset.nowTo = el.dataset.nowTo;
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
// Which room a card is in, for the tie-break above: the key of the room
// block it sits in, or null on the wall itself.
export function roomOf(el) {
  const room = el && el.closest ? el.closest('.room') : null;
  return (room && room.dataset.room) || null;
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


// One lineup-style section: a day rule and a card grid. This is the SEARCH
// and flat-sort shape — a list of answers, not a night. The composed wall
// (below) never comes through here.
function renderLineupGroup(root, day, list, ctx, fest, { header, sub } = {}) {
  const meta = (fest.dayMeta || {})[day];
  // A day KEY is frozen pick data and can be verbose ("Wednesday, Sept 16
  // (Early Arrival Pre-Party)"); the rule shows the weekday and moves the
  // aside to its sub line — the same split the day tab and the day sheet use.
  const parts = day ? dayLabelParts(day) : null;
  root.appendChild(dayHeader(
    header || (parts && parts.head) || 'THE LINEUP',
    sub !== undefined ? sub : (day ? [dayRuleSub(meta), parts.aside].filter(Boolean).join(' · ') : (ctx.sort === 'billing' ? 'BILLING ORDER' : '')),
  ));
  renderCardGrid(root, list, ctx, { day, subLabelOf: lineupSubLabel });
}

// A lineup entry can be an EVENT (afters, Folsom) — venue rides in `stage`,
// hours in `time`. In a LIST (a lineup group, a flat sort, search) day and
// time share the first line and the venue takes its own (one crammed line
// hid both — Kevin, 2026-08-29); the .time element renders pre-line, so the
// newline is the break. Inside a day-first day the tile says only the time
// (the day is the day, the venue lives in the zoom) — see eventTileSubLabel.
function lineupSubLabel(a) {
  const time = a.time ? approxMark(a, a.time) : ''; // the tilde travels with `approx`
  // A dated show says where in `venue`; the legacy afters shape says it in
  // `stage` ("Sun · The Midway"). Either way the answer names its room.
  const where = a.stage || a.venue || '';
  let subLabel = [where, time].filter(Boolean).join(' · ');
  if (where && time) {
    const bits = where.split(' · ');
    subLabel = bits.length > 1
      ? `${bits[0]} · ${time}\n${bits.slice(1).join(' · ')}`
      : `${time}\n${where}`;
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
    // The occurrence comes from the model (events.js occOf), so a card found
    // in a search is the SAME card as the one on the wall — a dated show's
    // two nights included. Only the day falls back to the group's, for a
    // list whose entries carry none.
    grid.appendChild(renderCard(a.name, ctx, { tag, time: subLabelOf(a), occ: { ...occOf(a), day: a.day || day || null } }));
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
  return rule;
}

// A LIST section's day rule subtitle: real dates beat internal numbering
// (ST-4). A dated day says its own date — that sub comes composed from the
// model (events.js), which is the only place a weekend is still a thing.
function dayRuleSub(meta) {
  if (!meta) return '';
  return [meta.wd, meta.date || (meta.num ? `Day ${meta.num}` : '')].filter(Boolean).join(' · ');
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
export function computeTimesLayout(fest, solo = null) {
  const stages = model.canonicalStages(fest);
  // The columns are the festival's stages and nothing else. Anything that
  // is not a stage set on the clock — activities, a set whose stage is not
  // a column — renders as a venue group under the grid, in the festival's
  // own room (MODEL-V4 §1.3), never in a reserved column: a 9:30 AM yoga row
  // beside 5 PM sets was a column on a clock its items were not on (Kevin,
  // Electric Forest, 2026-09-02: "a cards section with our header").
  // Stage solo (design option D): one stage wide, the rest folded to rails.
  // The same template feeds the strip and every day, so a folded column is
  // folded everywhere — scrolling down a soloed stage stays on it.
  const cols = columnsTemplate(stages, solo);
  return {
    stages,
    solo: cols.solo,
    colsTemplate: cols.template,
    rails: railLabels(stages), // what each stage's folded rail says
  };
}

// A stage header is a button: tap to solo that stage, tap the soloed one to
// restore all. Folded stages render as slim rails (still tappable — tapping a
// rail moves the solo there). A muted head never solos; it folds
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
//
// The STRIP is not a scroller any more (2026-09-02). Mirroring it with
// scrollLeft from scroll events put it a frame behind the grid on every
// event — on a phone, where the grid scrolls on the compositor and the
// event lands on the main thread afterwards, that read as a stuttering,
// delayed slide of the stage names above a butter-smooth grid (Kevin's
// iPhone, 2026-09-02). Now the strip's own row FOLLOWS the group's lead
// grid: where the browser has scroll-driven animations the follow is a
// CSS animation on the grid's scroll timeline — the compositor moves both
// in the same frame and no script runs — and elsewhere a transform set
// from the lead's scroll event (still one frame late, but a transform, not
// a second scroll). Day scrollers keep mirroring each other as before.
export const isStripScroller = (s) => !!(s.closest && s.closest('.stage-strip'));
// Whether the engine has scroll timelines, asked once (the CSSOM must know the
// properties — jsdom's CSS.supports says yes to anything).
const SCROLL_TIMELINES = (() => {
  try {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function' || typeof window === 'undefined') return false;
    // The engine exposes the timeline as an object too; a DOM shim never does.
    if (typeof window.ScrollTimeline !== 'function') return false;
    return CSS.supports('animation-timeline: scroll()') && CSS.supports('timeline-scope: --a');
  } catch { return false; }
})();
// What a wall render wires beyond its own nodes — size observers, timeline
// names on a scope that outlives the render — undone by renderWall before the
// next render replaces it.
const teardowns = new WeakMap();
const undoOnRepaint = (root, undo) => {
  if (!teardowns.has(root)) teardowns.set(root, []);
  teardowns.get(root).push(undo);
};
let timelineSeq = 0;
function followStrip(strip, lead, root) {
  const row = strip.querySelector('.times-grid');
  if (!row) return;
  strip.classList.add('follows');
  // The CSS follow only where CSS animations run: the tokens file kills every
  // animation under reduced motion and under Low Power, and a killed follow
  // leaves the stage names frozen over sliding columns. Decided per render —
  // leaving Settings repaints the wall.
  if (SCROLL_TIMELINES && !reduced() && !document.body.classList.contains('low-power')) {
    // The timeline is named on the lead and scoped on the nearest ancestor
    // both share (a day's .tt-block, or the wall for the one-strip page).
    // The far keyframe is the lead's maximum scroll in px (--strip-max): the
    // row's own box is only as wide as the strip, its tracks overflow it,
    // so a percentage of the row would be a percentage of the wrong thing.
    // Re-measured whenever the lead or its grid changes size.
    const name = `--tt-${(timelineSeq += 1)}`;
    const setMax = () => row.style.setProperty('--strip-max', `${Math.max(0, lead.scrollWidth - lead.clientWidth)}px`);
    setMax();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(setMax) : null;
    if (ro) {
      ro.observe(lead);
      if (lead.firstElementChild) ro.observe(lead.firstElementChild);
    }
    lead.style.scrollTimeline = `${name} x`;
    row.style.animation = 'strip-follow linear both';
    row.style.animationTimeline = name;
    const scope = strip.closest('.tt-block') || root;
    scope.style.timelineScope = [scope.style.timelineScope, name].filter(Boolean).join(', ');
    undoOnRepaint(root, () => {
      if (ro) ro.disconnect();
      scope.style.timelineScope = '';
    });
    return;
  }
  // Set on the spot: scroll events already arrive at most once a frame, and
  // a transform write is a compositor update, not a layout.
  const follow = () => { row.style.transform = `translateX(${-lead.scrollLeft}px)`; };
  lead.addEventListener('scroll', follow, { passive: true });
  follow();
}
// The grid a strip follows is the one it SITS ABOVE — its own `.tt-block`'s.
// Every day's grid and its strip share `data-sync="grid"` so the days mirror
// one scroll position, and the wiring used to hand EVERY strip the group's
// first grid: the second call overwrote that grid's scroll-timeline name, and
// the second day's name ended up declared outside its own `timeline-scope`, so
// on any fest with two grid days BOTH strips froze while the columns slid
// under them and a stage name sat over another stage's set (real-browser walk,
// 2026-09-17, Portola). One rule: the lead is the grid underneath.
const gridUnderStrip = (strip) => {
  const block = strip.closest('.tt-block');
  return block ? [...block.querySelectorAll('.times-scroll')].find((s) => !isStripScroller(s)) : null;
};

export function wireTimesScrollSync(root) {
  const groups = new Map();
  for (const s of root.querySelectorAll('.times-scroll')) {
    const key = s.dataset.sync || '*';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const all of groups.values()) {
    const scrollers = all.filter((s) => !isStripScroller(s));
    if (!scrollers.length) continue;
    for (const strip of all) {
      if (!isStripScroller(strip)) continue;
      const lead = gridUnderStrip(strip);
      if (lead) followStrip(strip, lead, root);
    }
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

// The day's clock: rail + grid, inside its own `.tt-block` with a sticky
// stage strip — the festival room's body on a grid day.
function renderScheduledDayBody(root, day, ctx, layout, weekend, { strip = false } = {}) {
  const fest = state.fest();
  const computed = state.getDayArtists(day, weekend);
  const stages = layout.stages;
  const meta = (fest.dayMeta || {})[day];

  // A day with no timed sets must not mint a NaN grid (Math.min of nothing
  // is Infinity). Its billed names still render as the room's cards (the
  // caller's venue groups); a day with nothing at all says so.
  if (!computed.length) {
    if (!((fest.activities || {})[day] || []).length) {
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
  // The grid spans the WHOLE festival day — its doors to its close when the
  // file says them, else whole hours around the sets (MODEL-V4 §1.1). A now
  // line always has somewhere to sit, and empty rows at the day's edges are
  // the honest cost of that (Kevin, 2026-09-17: "otherwise the now line is
  // weird").
  const atMin = (t) => { const p = parseEventTime(t); return p ? p.startMin : null; };
  const firstSet = Math.min(...drawn.map((a) => a.startMin));
  const lastSet = Math.max(...drawn.map((a) => a.endMin));
  const dayStart = Math.min(atMin(meta && meta.doors) ?? firstSet, firstSet);
  const dayEnd = Math.max(atMin(meta && meta.close) ?? lastSet, lastSet);
  const startRow = Math.floor(dayStart / 60) * 4;
  const rows = Math.ceil(dayEnd / 60) * 4 - startRow;

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
    const label = document.createElement('div');
    label.className = 'hour-label';
    label.style.gridRow = String(r - startRow + 1);
    label.textContent = hourLabelOf(r * 15);
    rail.appendChild(label);
  }
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
    if (col === -1) continue; // not a column: the festival room's venue groups under this grid carry it (festRoomExtras)
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

// ---- the composed wall (MODEL-V4, 2026-09-16) ------------------------------------
// ONE RULE: stage columns on a clock only where the festival publishes a
// stage grid; everything else is a stack of cards under the place it
// happens, in play order.
//
// A day is composed of ROOMS, in order: the festival's own first — its
// timetable on a grid day, then anything of the festival's that is not on
// that grid (a set whose stage is not a column, a billed name with no set
// time yet, the day's activities) as venue groups — then each section that
// plays that night. Every room folds on a tap of its header; the shell owns
// which are folded.


// Which weekends a scheduled fest renders. A two-weekend one (ACL) gets six
// dated tabs — a weekend is not a filter any more, it is which day you are
// looking at (MODEL-V4 §2).
export function weekendsOf(fest) {
  const days = (fest && fest.days) || {};
  const tagged = Object.keys(days).some((d) =>
    (days[d].artists || []).some((a) => a.weekend === 'W1' || a.weekend === 'W2'));
  return tagged ? ['W1', 'W2'] : [null];
}

// The whole wall's plan. Null only where the wall is not a week at all — a
// flat sort or a search, which are lists of answers.
export function wallPlanFor(fest, ctx) {
  const scheduled = !!(fest.days && Object.keys(fest.days).length);
  if (!scheduled && !(ctx.sort === 'billing' || ctx.sort === 'day')) return null;
  const weekends = scheduled ? weekendsOf(fest) : [null];
  // A scheduled fest filters per DAY (each tab is its own weekend); a lineup
  // fest still filters the whole list.
  const artists = applyWeekend(fest.artists || [], scheduled ? null : ctx.weekend);
  const gridDays = scheduled ? Object.keys(fest.days) : [];
  const plan = eventModelOf(fest, groupByDay(artists, knownDaysOf(fest)), { gridDays, weekends });
  // A whole lineup with no day on it (EDC Orlando) is still a lineup — the
  // wall draws it as THE LINEUP and the exporter offers it. Only a fest with
  // nothing at all has no plan.
  if (!plan.days.length && !plan.extras.length && !plan.looseNoDay.length) return null;
  return { model: plan, scheduled, weekends, gridDays };
}

// What the day tabs (dock + rail) should list, in the wall's own order: the
// days, then the tabs that hang off the end (a dated section like ACL's Late
// nights). `key` is the jump id the wall stamps on its rule.
const dayTab = (d) => ({ key: d.key, short: d.short, num: d.num, long: d.long, iso: d.iso, dates: d.iso ? [d.iso] : [], dated: false });
// A group header a search draws for a section, or a lineup fest's own day.
const groupTab = (fest) => (day) => {
  const meta = (fest.dayMeta || {})[day];
  return {
    key: day,
    short: (meta?.wd || day).slice(0, 3).toUpperCase(),
    num: null,
    dates: [],
    // Rail tabs stay compact: a verbose day key shows its weekday only —
    // the same split the day rule and the day sheet use.
    long: (meta?.wd ? `${meta.wd} ${meta.num || ''}`.trim() : dayLabelParts(day).head).toUpperCase(),
    iso: null,
    dated: false,
  };
};

export function dayNavOf(fest, ctx) {
  const plan = wallPlanFor(fest, ctx);
  // A scheduled fest's SEARCH is its own week with the misses taken out, so
  // the tabs are the same axis either way — one list, and the keys match what
  // the wall stamps on its rules, or a tab jumps to nothing. Only a lineup
  // fest's flat search keeps its own group headers.
  if (plan && (!ctx.query || plan.scheduled)) {
    return [
      ...plan.model.days.map(dayTab),
      // A dated section is one tab over many dates, and each of those dates
      // is its own note thread (§4) — so the tab carries them all.
      ...plan.model.extras.map((e) => ({ key: e.key, short: e.short, num: null, long: e.long, iso: null, dates: [...(e.byDate || new Map()).keys()], dated: true })),
    ];
  }
  return [...groupByDay(fest.artists || [], knownDaysOf(fest)).keys()].filter(Boolean).map(groupTab(fest));
}

const mk = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};
// The same card twice is the same ARTIST in the same OCCURRENCE — the pair
// `cardFor` restores a zoom by, name plus the day/date/venue/stage/time
// identity `occOf` builds. A name alone is not it: an artist who plays Room A
// at 9 and Room B at 1 AM is two shows on one night, and folding them into one
// answer loses the second outright. An occurrence alone is not it either —
// every name billed on a day with no set yet shares one (day, no stage, no
// time). The one thing that IS a single show reached twice is a combined-day
// entry — Portola's Horse Meat Disco, day "Afters & Folsom", the same object
// handed to two rooms — and it comes back as the same pair, so it stays one,
// the same tie `cardFor` breaks with the room.
const dedupeByCard = (list, occFor = occOf) => {
  const seen = new Set();
  return list.filter((a) => {
    const key = JSON.stringify([a.name, occFor(a)]);
    return seen.has(key) ? false : (seen.add(key), true);
  });
};

// The card's time label in a stack: the range the venue posted, else the
// start with the tilde a guess wears. No time, no time line.
const stackTime = (m) => {
  if (m.endStr) return timeRange(m.e.time);
  return m.startStr ? approxMark(m.e, m.startStr) : undefined;
};

// THE LIST (MODEL-V4 §1.2). One `.venue-group` per venue: the venue's own
// stage header, its doors/close line, then the night's cards stacked top to
// bottom in play order. The people filter HIDES in a stack (there is no
// clock to keep in shape), so a group everyone filtered out goes with it.
export function venueGroups(root, entries, ctx, { day = null, fest = null, fallbackVenue = null } = {}) {
  const filtering = ctx.filterPeople && ctx.filterPeople.length;
  const grid = mk('div', 'venue-grid');
  if (day && day.iso) grid.dataset.iso = day.iso;
  if (fest && fest.timezone) grid.dataset.tz = fest.timezone;
  let shown = 0;
  const groups = venueGroupsOf(entries, { fallbackVenue })
    .map((g) => ({ g, members: filtering ? g.members.filter((m) => passesPeople(ctx.picks, m.e.name, ctx.filterPeople)) : g.members }))
    .filter((x) => x.members.length);
  // Where one room published its doors, the line holds its place across the
  // whole grid — otherwise the stacks in a row start on different lines and
  // the row reads ragged.
  const anySub = groups.some((x) => x.g.sub);
  for (const { g, members } of groups) {
    const group = mk('div', 'venue-group');
    // A venue head IS a stage header — the festival accent's third home.
    const head = stageHead(g.venue);
    head.classList.add('venue');
    group.appendChild(head);
    if (anySub) group.appendChild(mk('div', 'venue-sub', g.sub || ''));
    const stack = mk('div', 'stack');
    for (const m of members) {
      const card = renderCard(m.e.name, ctx, { time: stackTime(m), occ: occOf(m.e) });
      // A stack has no clock to draw a line on, so the card of whoever is
      // playing carries the mark instead. The window is the model's
      // (events.js): the ticker only reads it.
      if (m.nowFrom != null && m.nowTo != null) {
        card.dataset.nowFrom = String(m.nowFrom);
        card.dataset.nowTo = String(m.nowTo);
      }
      stack.appendChild(card);
      shown += 1;
    }
    group.appendChild(stack);
    grid.appendChild(group);
  }
  if (!shown) {
    if (filtering) root.appendChild(mk('div', 'section-empty', `No picks here from ${ctx.filterPeople.join(' or ')}.`));
    return 0;
  }
  root.appendChild(grid);
  return shown;
}

// The now mark on a stack (MODEL-V4 §1.2) — the now line's twin, same violet,
// same one-minute ticker, no repaint. A card is "now" when the festival's
// clock is inside the window venueGroupsOf gave it.
export function positionNowMarks(root, date = new Date()) {
  const here = root.matches && root.matches('.venue-grid[data-iso]') ? [root] : [];
  for (const grid of [...here, ...root.querySelectorAll('.venue-grid[data-iso]')]) {
    const clock = festivalClock(date, grid.dataset.tz || null);
    const today = grid.dataset.iso === clock.iso;
    for (const card of grid.querySelectorAll('.card[data-now-from]')) {
      const from = Number(card.dataset.nowFrom);
      const to = Number(card.dataset.nowTo);
      const on = today && clock.minutes >= from && clock.minutes < to;
      card.classList.toggle('now', on);
      const label = card.querySelector('.now-label');
      if (on && !label) card.insertBefore(mk('span', 'now-label in-card', 'NOW'), card.firstChild);
      else if (!on && label) label.remove();
    }
  }
}

// One room on a day: its header and body travel together, tagged with the
// key that folds them (app.js animates the fold).
function roomBlock(key) {
  const room = mk('div', 'room');
  room.dataset.room = key;
  return room;
}

// The festival's own room says where it is: "PORTOLA · PIER 80" — the venue
// festPlaceLine leads with, as text.
function festRoomSub(fest) {
  const venue = (fest.subtitle || '').split(' · ')[0].trim();
  return venue || fest.location || '';
}

// The chevron at the end of a room's header: down when the room is open, a
// quarter turn when it is folded.
function chevron() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  // SVG className is a read-only SVGAnimatedString — the attribute is the way.
  svg.setAttribute('class', 'chev');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M6 9l6 6 6-6');
  svg.appendChild(path);
  return svg;
}

// The room's header, and the one control that folds it (MODEL-V4 §3): a tap
// folds the body away and the sub becomes "<n> shows". The shell owns the
// state; this says what it is and asks for the change.
// `dayKey` is for the one room that is also a TAB — a dated section, which is
// a room and a day axis entry at once. It stamps the jump/scrollspy anchor and
// gives the header the day rule's weight, so the tab lands on something that
// looks like every other tab's landing.
export function sectionHeader(label, sub, { key = null, dayKey = null, folded = false, count = 0, onToggle = null } = {}) {
  const h = mk(onToggle ? 'button' : 'div', `sec-head${dayKey ? ' tab' : ''}${folded ? ' folded' : ''}`);
  if (key) h.dataset.section = key;
  if (dayKey) h.dataset.day = dayKey;
  h.append(
    mk('span', 'sec-label', String(label).toUpperCase()),
    mk('span', 'sec-sub', folded ? `${count} show${count === 1 ? '' : 's'}` : (sub || '')),
    mk('span', 'sec-line'),
  );
  if (onToggle) {
    h.type = 'button';
    h.setAttribute('aria-expanded', folded ? 'false' : 'true');
    h.setAttribute('aria-label', `${folded ? 'Show' : 'Hide'} ${label}`);
    h.appendChild(chevron());
    h.addEventListener('click', () => onToggle(key));
  }
  return h;
}

// A set whose stage is not one of the grid's columns is still the festival's
// — it goes in the festival's room as a card under its own place, never in a
// reserved column (Kevin, Electric Forest, 2026-09-02).
function straysOf(fest, day, weekend, stages) {
  return state.getDayArtists(day, weekend)
    // A computed set knows its stage and its clock but not its day key — the
    // occurrence needs both, or the zoom tells another card's story.
    .filter((a) => stages.indexOf(a.stage) === -1)
    .map((a) => ({ ...a, day, venue: a.stage || null }));
}
// The festival's activities (yoga, a workshop, the Brainery) are cards like
// any other now — one venue group per place, in the order venueGroupsOf puts
// them, which is the same clock every other card reads.
function activitiesOf(fest, day) {
  return ((fest.activities || {})[day] || [])
    .map((a) => ({ name: a.name, day, venue: a.venue || null, time: a.time || null }));
}

// Everything of the festival's that is not on this day's grid.
function festRoomExtras(fest, day, layout) {
  if (layout.solo) return []; // the solo promises "just that stage"
  const onGrid = new Set(state.getDayArtists(day.dayKey, day.weekend).map((a) => a.name));
  const billed = dedupeByCard(applyWeekend(day.billing || [], day.weekend)).filter((a) => !onGrid.has(a.name));
  return [...straysOf(fest, day.dayKey, day.weekend, layout.stages), ...billed, ...activitiesOf(fest, day.dayKey)];
}

function renderComposed(root, ctx, fest, { model: plan, scheduled }) {
  const folded = new Set(ctx.folded || []);
  const onToggle = ctx.onToggleFold || null;
  const layout = scheduled ? computeTimesLayout(fest, ctx.soloStage || null) : null;

  // A lineup wall's day-less block (THE LINEUP) leads, as it always has.
  if (!scheduled && plan.looseNoDay.length) renderLineupGroup(root, '', plan.looseNoDay, ctx, fest);

  for (const day of plan.days) {
    root.appendChild(dayRuleFor(day, ctx));
    // 1. the festival's own room: its timetable on a grid day, then anything
    //    of the festival's that is not on that grid; a lineup day's billing
    //    has no venue and no clock, so it stays the day's card grid.
    if (day.grid || day.billing) {
      const extras = day.grid ? festRoomExtras(fest, day, layout) : [];
      const room = roomBlock(FEST_ROOM);
      const isFolded = folded.has(FEST_ROOM);
      room.appendChild(sectionHeader(fest.name, festRoomSub(fest), {
        key: FEST_ROOM, folded: isFolded, onToggle,
        count: day.grid ? state.getDayArtists(day.dayKey, day.weekend).length + extras.length : day.billing.length,
      }));
      if (!isFolded && day.grid) {
        renderScheduledDayBody(room, day.dayKey, ctx, layout, day.weekend, { strip: true });
        if (extras.length) venueGroups(room, extras, ctx, { day, fest, fallbackVenue: festRoomSub(fest) });
      } else if (!isFolded) {
        renderCardGrid(room, day.billing, ctx, { day: day.dayKey });
      }
      root.appendChild(room);
    }
    // 2. each section that plays that night.
    for (const sec of plan.sections) {
      const list = sec.byDay.get(day.key);
      if (!list) continue;
      const room = roomBlock(sec.key);
      const isFolded = folded.has(sec.key);
      room.appendChild(sectionHeader(sec.label, sectionSub(fest, sec), {
        key: sec.key, folded: isFolded, onToggle, count: list.length,
      }));
      if (!isFolded) venueGroups(room, list, ctx, { day, fest });
      root.appendChild(room);
    }
  }

  // The tabs that hang off the end: a dated section (ACL's Late nights), and
  // any section whose entries never said which night.
  for (const extra of plan.extras) renderExtra(root, ctx, fest, extra, { folded, onToggle });

  // A scheduled fest's day-less names that sit on no grid.
  if (scheduled && plan.looseNoDay.length) {
    const onAnyGrid = new Set();
    for (const d of plan.days) if (d.grid) for (const a of state.getDayArtists(d.dayKey, d.weekend)) onAnyGrid.add(a.name);
    const loose = dedupeByCard(plan.looseNoDay.filter((a) => !onAnyGrid.has(a.name)));
    if (loose.length) renderLineupGroup(root, '', loose, ctx, fest, { header: 'EVERYTHING ELSE', sub: 'NO SET TIME YET' });
  }
  festNotesFoot(root, ctx, fest);
  wireTimesScrollSync(root);
  positionNowMarks(root, ctx.now || new Date());
}

// The date's newest note, under the rule that named that date. Every day
// note the wall opens is keyed by the DATE (MODEL-V4 §4) — two Fridays are
// two dates — so this is the one place the key is chosen. A note written
// under the old weekday label still belongs to this conversation; mapping it
// on the way in is the notes layer's job (notes.js, model.js).
function dayNoteDoor(root, iso, ctx) {
  if (!ctx.onOpenDayNotes) return;
  const label = shortDayLabel(iso);
  const w = dayWhisper(iso, label, ctx, () => ctx.onOpenDayNotes(iso, label));
  if (w) root.appendChild(w);
}

// A day's rule, and the newest note at its door. A day the file gives no
// date has no door — a label is not a date, and a section label
// ("Afters", "Late nights") is not a note target at all any more (§4).
function dayRuleFor(day, ctx) {
  const rule = dayHeader(dayLabelParts(day.dayKey).head, day.sub, { dayKey: day.key });
  if (day.iso) rule.dataset.iso = day.iso; // the day-of open lands here before doors
  const frag = document.createDocumentFragment();
  frag.appendChild(rule);
  if (day.iso) dayNoteDoor(frag, day.iso, ctx);
  return frag;
}

// A section's own sub line, when the file gives it one.
function sectionSub(fest, sec) {
  const meta = (fest.dayMeta || {})[sec.key] || {};
  return meta.sub || '';
}

// A tab off the end of the week (MODEL-V4 §2), and a ROOM like any other: one
// foldable header — so a tap folds it, the show menu can name it and the tab
// lands on it — holding either a `.date-rule` per date with its venue groups
// under it, or, for a section whose entries never said when, one set of venue
// groups. The header carries no note door; each date inside it does.
function renderExtra(root, ctx, fest, extra, { folded, onToggle }) {
  const room = roomBlock(extra.key);
  const lists = extra.byDate ? [...extra.byDate.values()] : [extra.entries || []];
  const isFolded = folded.has(extra.key);
  room.appendChild(sectionHeader(extra.label, extra.sub || '', {
    key: extra.key, dayKey: extra.key, folded: isFolded, onToggle,
    count: lists.reduce((n, l) => n + l.length, 0),
  }));
  root.appendChild(room);
  if (isFolded) return;
  if (!extra.byDate) { venueGroups(room, extra.entries || [], ctx, { fest }); return; }
  for (const [iso, list] of extra.byDate) {
    const dateRule = mk('div', 'date-rule');
    dateRule.dataset.iso = iso;
    dateRule.append(mk('span', 'd', dateRuleLabel(iso)), mk('span', 'line'));
    room.appendChild(dateRule);
    dayNoteDoor(room, iso, ctx);
    venueGroups(room, list, ctx, { day: { iso }, fest });
  }
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
    if (isStripScroller(s)) continue; // the strip follows its grid; it is never scrolled itself
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
  for (const undo of teardowns.get(root) || []) undo();
  teardowns.delete(root);
  renderWallInner(root, ctx);
  restoreEphemera(root, ephemera);
}

function renderWallInner(root, ctx) {
  root.textContent = '';
  const fest = state.fest();
  const scheduled = fest.days && Object.keys(fest.days).length;

  // The composed wall (MODEL-V4, 2026-09-16): a week of days, each holding
  // its rooms. One path for every fest that has days at all — a search and a
  // flat sort are lists of answers and take the paths below.
  if (!ctx.query) {
    const plan = wallPlanFor(fest, ctx);
    if (plan) { renderComposed(root, ctx, fest, plan); return; }
  }

  // Searching a scheduled fest must still answer "where and when" (CORE-4) —
  // and WHICH NIGHT, so a search is the wall's own week with everything that
  // does not match taken out. The same dated day axis the wall and the tabs
  // walk: a two-weekend fest is six days, so a Weekend 2 headliner answers
  // under the Friday they play (it used to ask a weekend preference that had
  // no selector left, default to W1, and say "No artists match"), and a room's
  // show answers under its night rather than under its section's name, which
  // is not a place any more (MODEL-V4 §2).
  if (scheduled) {
    const q = ctx.query.trim().toLowerCase();
    // Results are a LIST, so the people filter hides here rather than dims —
    // a filtered search must not resurface someone's non-pick.
    const wanted = (name) => name.toLowerCase().includes(q) && passesPeople(ctx.picks, name, ctx.filterPeople);
    const plan = wallPlanFor(fest, ctx);
    const answers = (cards, label, sub, opts) => {
      if (!cards.length) return false;
      root.appendChild(dayHeader(label, sub, opts));
      const grid = mk('div', 'wall-grid');
      for (const c of cards) grid.appendChild(c);
      root.appendChild(grid);
      return true;
    };
    let any = false;
    for (const day of (plan ? plan.model.days : [])) {
      const cards = [];
      const onGrid = new Set();
      if (day.grid) {
        const computed = state.getDayArtists(day.dayKey, day.weekend);
        computed.forEach((a) => onGrid.add(a.name));
        for (const a of computed.filter((a) => wanted(a.name)).sort((x, y) => x.startMin - y.startMin)) {
          cards.push(renderCard(a.name, ctx, { time: `${a.stage} · ${a.startStr}`, occ: { day: day.dayKey, stage: a.stage || null, time: a.time || null, weekend: a.weekend || null } }));
        }
      }
      // Then everything else of that night's, in the wall's order: the names
      // billed on the day with no set on its grid, then each room that plays.
      // One pass over both, deduped by the occurrence the card will carry: a
      // combined-day show is one entry reached through two rooms and answers
      // once, while two rooms on one night are two shows and answer twice.
      const billed = applyWeekend(day.billing || [], day.weekend).filter((a) => !onGrid.has(a.name));
      const rooms = plan.model.sections.flatMap((s) => s.byDay.get(day.key) || []);
      const occHere = (a) => ({ ...occOf(a), day: a.day || day.dayKey });
      for (const a of dedupeByCard([...billed, ...rooms].filter((a) => wanted(a.name)), occHere)) {
        cards.push(renderCard(a.name, ctx, { time: lineupSubLabel(a), occ: occHere(a) }));
      }
      any = answers(cards, dayLabelParts(day.dayKey).head, day.sub, { dayKey: day.key }) || any;
    }
    // A dated section's answers sit under their dates too — the date leads and
    // the section is the aside, because days are the days. Every one of them
    // carries the section's key: they are all the one tab, and a jump lands on
    // the first that answered.
    for (const extra of (plan ? plan.model.extras : [])) {
      for (const [iso, list] of (extra.byDate || new Map([[null, extra.entries || []]]))) {
        const cards = list.filter((a) => wanted(a.name))
          .map((a) => renderCard(a.name, ctx, { time: lineupSubLabel(a), occ: occOf(a) }));
        any = answers(cards, iso ? dateRuleLabel(iso) : extra.label,
          iso ? extra.label.toUpperCase() : (extra.sub || ''), { dayKey: extra.key }) || any;
      }
    }
    // Names the festival bills on no day at all.
    if (plan) {
      const onAnyGrid = new Set();
      for (const d of plan.model.days) if (d.grid) for (const a of state.getDayArtists(d.dayKey, d.weekend)) onAnyGrid.add(a.name);
      const loose = dedupeByCard(plan.model.looseNoDay.filter((a) => !onAnyGrid.has(a.name) && wanted(a.name)));
      any = answers(loose.map((a) => renderCard(a.name, ctx, { time: lineupSubLabel(a), occ: occOf(a) })),
        'EVERYTHING ELSE', 'NO SET TIME YET', {}) || any;
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
  const w = festWhisper(ctx, () => ctx.onOpenFestNotes());
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
// The shape behind the undo toast (design open question 1: tap-5 clears via
// undo window). A toast always goes away on its own — a notice that must
// outlive the glance is a strip, not a toast (see the new-build strip in
// app.js).
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
  toastTimer = setTimeout(() => { container.textContent = ''; }, ms);
}
export function showUndoToast(container, message, onUndo) {
  showActionToast(container, message, 'Undo', onUndo, 5000);
}

// ---- day-nav scrollspy ------------------------------------------------------------
// Where a day tab lands: a day rule, or the room header of a dated section,
// which is a room and a tab at once. Never a grid scroller — that carries
// data-day to name its own day.
export const DAY_ANCHOR = '.day-rule[data-day], .sec-head[data-day]';
// How far below --jump-offset a day rule may sit and still be the day you are
// standing in. A jump lands its rule AT the offset on Chromium and about 24px
// below it on WebKit; both are the same arrival.
const LANDED_WITHIN = 32;
// One observer drives every tab container (mobile dock + desktop rail): the
// active day is a single fact rendered in two places.
export function wireScrollspy(containers, wallRoot) {
  const list = Array.isArray(containers) ? containers : [containers];
  const tabs = list.flatMap((c) => [...c.querySelectorAll('.day-tab')]);
  if (!tabs.length) return () => {};
  const tabDays = new Set(tabs.map((t) => t.dataset.day));
  // Observe ONLY headers that correspond to a tab — the NOTES/EVERYTHING-ELSE
  // pseudo-headers share dayHeader() anatomy and used to de-highlight every
  // tab when they scrolled into the band (audit 1.3). A tab's landing is a day
  // rule, or the room header of a dated section, which is a room AND a tab —
  // and NOT a grid scroller, which carries data-day for its own reasons.
  const headers = [...wallRoot.querySelectorAll(DAY_ANCHOR)]
    .filter((h) => tabDays.has(h.dataset.day));
  // A tab row that cannot fit its days scrolls, and the day you are standing
  // in has to be IN it: ACL's seven tabs leave four off the end of a phone
  // dock, and the row stayed where it was, so it showed FRI 2 / SAT 3 while
  // the wall was in LATE NIGHTS (real-browser walk, 2026-09-17). This is the
  // one place the active day changes, so it is the one place the row moves.
  // `block: 'nearest'` because the page is not ours to scroll.
  let active = null;
  const setActive = (day) => {
    if (day === active) return;
    active = day;
    const glide = !reduced() && !document.body.classList.contains('low-power');
    tabs.forEach((t) => {
      const on = t.dataset.day === day;
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
      if (on && t.scrollIntoView) t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: glide ? 'smooth' : 'auto' });
    });
  };
  // …and the eye is told there is more, on the side there is more ON: a row
  // that fits is never dimmed, and the end of the row is never dimmed once you
  // are at it — which matters, because the tab you are standing in is often
  // the last one.
  const markOverflow = () => {
    for (const c of list) {
      const over = c.scrollWidth - c.clientWidth > 1;
      c.classList.toggle('overflowing', over);
      c.classList.toggle('more-left', over && c.scrollLeft > 1);
      c.classList.toggle('more-right', over && c.scrollLeft < c.scrollWidth - c.clientWidth - 1);
    }
  };
  markOverflow();
  const onResize = () => markOverflow();
  window.addEventListener('resize', onResize);
  for (const c of list) c.addEventListener('scroll', markOverflow, { passive: true });
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
    // The tolerance is not slop: a jump parks its rule NEAR the offset, and
    // WebKit parks it ~24px below where Chromium lands it exactly — so an
    // at-or-above test lit the day ABOVE the one filling the screen, on the
    // iPhone only (real-browser walk, 2026-09-17). A rule this close is the
    // day you are in, on every engine.
    let current = headers[0];
    for (const h of headers) {
      if (h.getBoundingClientRect().top <= offset + LANDED_WITHIN) current = h;
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
    window.removeEventListener('resize', onResize);
    for (const c of list) c.removeEventListener('scroll', markOverflow);
    if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
  };
}
