// v3 aura card engine — pure functions from picks to CSS, ported from the
// design atlas reference implementation (Screens.dc.html turn 21 renderVals;
// spec restated in claude-plans/v3-inventory.md). Do not "improve" the
// gradient math — the values are the design.
import { hslOf, strokeOf } from './palette.js';

export const CARD_BASE = '#1C1731';
const PICK_ALPHA = [0.5, 0.75, 1.0]; // levels 1-3; must (4) renders at 1.0
const ANCHORS = ['20% 120%', '85% -20%', '-15% 30%', '115% 70%'];

// people: [{ name, colorIndex, isYou, level }] — level 1-3 picked, 4 must.
// Returns people ordered as the design orders everything: musts first
// (innermost chips, first gradient layers), then picks; input order kept
// within each group.
export function ordered(people) {
  const musts = people.filter((p) => p.level === 4);
  const picks = people.filter((p) => p.level >= 1 && p.level <= 3);
  return [...musts, ...picks];
}

// Background CSS for a card. Empty -> flat base, no animation, no grain.
export function auraBackground(people) {
  const all = ordered(people);
  if (!all.length) return { background: CARD_BASE, animated: false };
  const layers = all.map((p, i) => {
    const a = p.level === 4 ? 1 : PICK_ALPHA[p.level - 1];
    const at = ANCHORS[i % 4];
    return (
      `radial-gradient(130% 130% at ${at}, ` +
      `${hslOf(p.colorIndex, a)} 0%, ` +
      `${hslOf(p.colorIndex, a * 0.5)} 45%, transparent 78%)`
    );
  });
  return { background: `${layers.join(', ')}, ${CARD_BASE}`, animated: true };
}

// Two-letter disambiguation: members sharing a first initial show two letters.
export function initialFor(person, people) {
  const mine = person.name.trim();
  const first = mine.charAt(0).toUpperCase();
  const clash = people.some(
    (o) => o !== person && o.name.trim().charAt(0).toUpperCase() === first,
  );
  return clash ? mine.slice(0, 2).toUpperCase() : first;
}

// Who-corner (bottom-right): EVERYONE ELSE. Lettered pills = musts
// (innermost, sorted first), 4px ticks = picks. Caps: 2 musts + 2 ticks, then
// one ghost "+n". You are never in it (2026-09-23): your level has its own
// meter on the left (meterOf), because in here a busy card could fold you
// into "+n" and you vanished from your own pick. So the "+n" counts other
// people, always. `caps` lets a card too narrow for the whole corner fold
// more of them into the count (fitCorners); the count stays true either way.
export function whoCorner(people, { musts: mustCap = 2, picks: pickCap = 2 } = {}) {
  const others = ordered(people.filter((p) => !p.isYou));
  const musts = others.filter((p) => p.level === 4).slice(0, mustCap);
  const picks = others.filter((p) => p.level < 4).slice(0, pickCap);
  const overflow = others.length - musts.length - picks.length;
  const marks = [
    ...musts.map((p) => ({
      kind: 'must',
      width: 24,
      label: initialFor(p, others),
      fill: hslOf(p.colorIndex, 0.5),
      stroke: strokeOf(p.colorIndex),
    })),
    ...picks.map((p) => ({
      kind: 'pick',
      width: 4,
      label: '',
      fill: hslOf(p.colorIndex, 0.5),
      stroke: strokeOf(p.colorIndex),
    })),
  ];
  if (overflow > 0) marks.push({ kind: 'ghost', label: `+${overflow}` });
  return marks;
}

// YOUR meter (2026-09-23): how much you want this set, said on the card so
// you can scroll your picks and decide to go up or down (a friend's ask, via
// Kevin). Three bars lit one per level (1, 2, 3); at 4 the word MUST. Your
// colour at .5 with the white edge that means you (strokeOf isYou) — the
// crew marks' own language, and never --brand or --fest. Null when you have
// not picked the artist: no chip.
export function meterOf(you) {
  if (!you || !(you.level >= 1 && you.level <= 4)) return null;
  const must = you.level === 4;
  return {
    kind: 'meter',
    level: you.level,
    bars: must ? 0 : you.level,
    label: must ? 'MUST' : '',
    fill: hslOf(you.colorIndex, 0.5),
    stroke: strokeOf(you.colorIndex, true),
  };
}

// Text colors follow pick state (atlas: unpicked names are #B9B3CC).
export function nameColor(people) {
  return ordered(people).length ? '#fff' : '#B9B3CC';
}
// Unpicked sub text tracks the AX-3 tertiary retune (was #5D5578, 2.5:1 on
// the unpicked card base) — this is text legibility, not gradient math.
export function subColor(people) {
  return ordered(people).length ? 'rgba(255,255,255,.75)' : '#877FA4';
}

// About-corner (bottom-left) data: YOUR meter at the corner's edge (the same
// place on every card, so a scroll through your picks reads down one line),
// then the violet notes bubble, then green Spotify.
export function aboutCorner({ noteCount = 0, spotify = null, you = null } = {}) {
  const chips = [];
  const meter = meterOf(you);
  if (meter) chips.push(meter);
  if (noteCount > 0) chips.push({ kind: 'notes', label: String(noteCount) });
  // Followed-only artists (0 saved songs) chip too — a follow is a stronger
  // signal than one liked song, and showing nothing for it read as "Spotify
  // doesn't know this artist" (Kevin, 2026-07-13; supersedes the atlas rule
  // that gated the chip on songs > 0).
  if (spotify && (spotify.songs > 0 || spotify.followed)) {
    chips.push({
      kind: 'spotify',
      label: spotify.songs > 0 ? String(spotify.songs) : '',
      followed: !!spotify.followed,
      // 'hot' drives the corner glow: followed AND 5+ saved songs — the
      // artists this person demonstrably already loves.
      hot: !!spotify.followed && spotify.songs >= 5,
    });
  }
  return chips;
}

// ---- one bottom edge, two corners: what gives way (2026-09-23) --------------
// The about corner grows from the left and the crew corner from the right, on
// one 12px line. A crowded card — your MUST, a notes count, a followed Spotify
// pill with its count, two musts, two ticks and a "+n" — needs ~210px, and a
// phone's column is ~176, so when a card runs out of room things give way in
// this order, the least a person loses first:
//   1. the Spotify count (the pill stays; "41 liked songs" is in the zoom),
//   2. the crew's ticks fold into "+n", one at a time (the count stays true),
//   3. the Spotify pill (the zoom still says it),
//   4. the crew's musts fold into "+n", one at a time,
//   5. the "+n" itself (the aura still carries everyone's colour),
//   6. the notes count (the zoom's notes chip is the same door).
// Your meter never gives way: it is why the corner changed.
export const GIVE_WAY = [
  {},
  { spotCount: false },
  { picks: 1 },
  { picks: 0 },
  { spot: false },
  { musts: 1 },
  { musts: 0 },
  { crew: false },
  { notes: false },
];

// Widths as v3.css draws each piece — measured in Chromium on 2026-09-23 (Inter
// 800, Anton) and logged in claude-plans/2026-09-23-meter-build.md. A count
// is charged at the WIDEST digit, so an estimate can only err toward giving
// way a touch early, never toward a collision; the browser contract
// (tests/browser/meter-contract.test.mjs) measures the real thing. `base` is
// every card; `cell` is a timetable cell, whose chips are a pixel smaller.
const GEO = {
  base: { left: 6, right: 5, chip: 14, digit: 5.9, meter: 24.5, must: 31.5 },
  cell: { left: 5, right: 4, chip: 12, digit: 5.6, meter: 22.5, must: 28.5 },
};
const GAP = 3;    // between chips (.corner-about gap), and before every mark (.mark margin-left)
const CLEAR = 4;  // the least air left between the two corners
const FLAG = 7;   // the followed bookmark (+3 when a count sits beside it)
const MARK = { must: 26, pick: 6 }; // 24px / 4px plus a 1px stroke each side
const digits = (label) => String(label || '').length;

function chipWidth(c, g, s) {
  if (c.kind === 'meter') return c.level === 4 ? g.must : g.meter;
  if (c.kind === 'notes') return g.chip + g.digit * digits(c.label);
  const count = s.spotCount ? digits(c.label) : 0;
  return g.chip + g.digit * count + (c.followed ? FLAG + (count ? GAP : 0) : 0);
}
// The ghost is 7.5px type in 4px padding and a dashed 1px edge: "+" then digits.
const markWidth = (m) => (m.kind === 'ghost' ? 15.2 + 5.2 * (m.label.length - 1) : MARK[m.kind]);

function layoutAt({ people = [], about = [] }, step, { cell = false } = {}) {
  const g = cell ? GEO.cell : GEO.base;
  const s = Object.assign({ spotCount: true, spot: true, notes: true, crew: true, musts: 2, picks: 2 }, ...GIVE_WAY.slice(0, step + 1));
  const shown = about.filter((c) => (c.kind !== 'spotify' || s.spot) && (c.kind !== 'notes' || s.notes));
  const marks = s.crew ? whoCorner(people, { musts: s.musts, picks: s.picks }) : [];
  const aboutW = shown.reduce((w, c, i) => w + (i ? GAP : 0) + chipWidth(c, g, s), 0);
  const whoW = marks.reduce((w, m) => w + GAP + markWidth(m), 0);
  const need = g.left + aboutW + (aboutW && whoW ? CLEAR : 0) + whoW + g.right;
  return { step, spotCount: s.spotCount, spot: s.spot, notes: s.notes, crew: s.crew, about: shown, marks, need };
}

// What the card's corners need, in px of its padding box, at one give-way step.
export const needAt = (parts, step, opts) => layoutAt(parts, step, opts).need;

// The corners for a card `width` px wide (its padding box): the first step of
// GIVE_WAY that fits, or the last. No width yet (a card not laid out, jsdom)
// means everything — the fit only ever takes away what a real width says
// cannot fit.
export function fitCorners(parts, width, opts = {}) {
  let out = layoutAt(parts, 0, opts);
  if (!(width > 0)) return out;
  for (let step = 1; step < GIVE_WAY.length && out.need > width; step++) out = layoutAt(parts, step, opts);
  return out;
}
