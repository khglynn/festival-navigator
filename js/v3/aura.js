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

// The aura's colour layers alone, without the card base under them: one
// radial glow per person, at their level's brightness, from the four anchors
// in turn. '' for nobody. The zoom's who-chips (card-facts.js whoPills) wear
// these same layers over a scrim, so a chip is a small piece of the card's
// own aura rather than a second colour system (2026-09-23).
export function auraLayers(people) {
  return ordered(people).map((p, i) => {
    const a = p.level === 4 ? 1 : PICK_ALPHA[p.level - 1];
    const at = ANCHORS[i % 4];
    return (
      `radial-gradient(130% 130% at ${at}, ` +
      `${hslOf(p.colorIndex, a)} 0%, ` +
      `${hslOf(p.colorIndex, a * 0.5)} 45%, transparent 78%)`
    );
  }).join(', ');
}

// Background CSS for a card. Empty -> flat base, no animation, no grain.
export function auraBackground(people) {
  const layers = auraLayers(people);
  if (!layers) return { background: CARD_BASE, animated: false };
  return { background: `${layers}, ${CARD_BASE}`, animated: true };
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
//   6. the notes count (the zoom's notes chip is the same door),
//   7. in a timetable cell too narrow for your meter beside its start time
//      (a lane of a 30-minute set), the time itself — the hour rail beside
//      the grid and the zoom still say when; nothing else says your level,
//   8. your meter, only where the artist's NAME runs down into the band (a
//      30-minute cell in a lane, a name on two lines): a name is never cut
//      (v3.css .card.cell .name), and the aura and the zoom still say your
//      level. Anywhere else your meter stays — it is why the corner changed.
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
  { time: false },
  { meter: false },
];

// Widths as v3.css draws each piece — measured in Chromium on macOS on
// 2026-09-23 (Inter 800, Anton) and logged in claude-plans/2026-09-23-meter-build.md.
// They are the fit's FIRST GUESS, never its last word: Linux draws Inter
// wider (Robyn's corners landed 1.4px apart in CI), and so will real phones,
// so wall.js reads back what each card really drew and gives way further
// wherever the corners crowd (confirmFit). Counts
// are summed from Inter 800's own digit widths (em, measured the same day;
// no kerning between digits) and rounded up, so an estimate errs, if at all,
// toward giving way a touch early; CLEAR keeps the two corners apart even so.
// The browser contract (tests/browser/meter-contract.test.mjs) measures the
// real thing on every card. `base` is every card; `cell` is a timetable cell,
// whose chips draw a pixel smaller.
const GEO = {
  base: { left: 6, right: 5, chip: 14, font: 8.5, meter: 24.5, must: 31.5 },
  cell: { left: 5, right: 4, chip: 12, font: 8, meter: 22.5, must: 28.5 },
};
const EM = { 0: 0.692, 1: 0.441, 2: 0.638, 3: 0.657, 4: 0.689, 5: 0.634, 6: 0.663, 7: 0.606, 8: 0.665, 9: 0.663, '+': 0.686 };
const textWidth = (text, px) => Math.ceil([...String(text || '')].reduce((w, ch) => w + (EM[ch] ?? 0.7), 0) * px * 10) / 10;
const GAP = 3;    // between chips (.corner-about gap), and before every mark (.mark margin-left)
export const CLEAR = 4;  // the least air left between the two corners (wall.js measures against it too)
const FLAG = 7;   // the followed bookmark (+3 when a count sits beside it)
const MARK = { must: 26, pick: 6 }; // 24px / 4px plus a 1px stroke each side

function chipWidth(c, g, s) {
  if (c.kind === 'meter') return c.level === 4 ? g.must : g.meter;
  if (c.kind === 'notes') return g.chip + textWidth(c.label, g.font);
  const count = s.spotCount ? textWidth(c.label, g.font) : 0;
  return g.chip + count + (c.followed ? FLAG + (count ? GAP : 0) : 0);
}
// The ghost: 7.5px type in 4px padding and a 1px ring, cell or not.
const markWidth = (m) => (m.kind === 'ghost' ? 10 + textWidth(m.label, 7.5) : MARK[m.kind]);

// Centred text can sit down in the corners' band of a short timetable cell
// (wall.js bandText): `middle` is the widest line that may step back — a
// 30-minute cell's start time, a tall cell's "until" — and `name` the widest
// line of the artist's name there, which never does. The corners fit around
// whichever is wider: each keeps to its own side with CLEAR to spare, so a
// crowd never lands on the time a set starts or on who is playing.
function layoutAt({ people = [], about = [] }, step, { cell = false, middle = 0, name = 0 } = {}) {
  const g = cell ? GEO.cell : GEO.base;
  const s = Object.assign({ spotCount: true, spot: true, notes: true, crew: true, musts: 2, picks: 2, time: true, meter: true }, ...GIVE_WAY.slice(0, step + 1));
  const obstacle = Math.max(s.time ? middle : 0, name); // a time that stepped back is nothing to fit around
  const shown = about.filter((c) => (c.kind !== 'spotify' || s.spot) && (c.kind !== 'notes' || s.notes) && (c.kind !== 'meter' || s.meter));
  const marks = s.crew ? whoCorner(people, { musts: s.musts, picks: s.picks }) : [];
  const aboutW = shown.reduce((w, c, i) => w + (i ? GAP : 0) + chipWidth(c, g, s), 0);
  const whoW = marks.reduce((w, m) => w + GAP + markWidth(m), 0);
  const need = obstacle > 0
    ? 2 * Math.max(g.left + aboutW, whoW + g.right) + obstacle + 2 * CLEAR
    : g.left + aboutW + (aboutW && whoW ? CLEAR : 0) + whoW + g.right;
  return { step, spotCount: s.spotCount, spot: s.spot, notes: s.notes, crew: s.crew, time: s.time, meter: s.meter, about: shown, marks, need };
}

// What the card's corners need, in px of its padding box, at one give-way step.
export const needAt = (parts, step, opts) => layoutAt(parts, step, opts).need;

// The corners for a card `width` px wide (its padding box): the first step of
// GIVE_WAY that fits, or the last. No width yet (a card not laid out, jsdom)
// means everything — the fit only ever takes away what a real width says
// cannot fit. `from` starts the search at a later step: what the engine
// really drew said the steps before it crowd (wall.js confirmFit).
export function fitCorners(parts, width, opts = {}) {
  const from = Math.min(Math.max(0, opts.from || 0), GIVE_WAY.length - 1);
  let out = layoutAt(parts, from, opts);
  if (!(width > 0)) return out;
  for (let step = from + 1; step < GIVE_WAY.length && out.need > width; step++) out = layoutAt(parts, step, opts);
  return out;
}
