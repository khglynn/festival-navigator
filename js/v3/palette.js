// v3 crew palette — the 24-board (12 hue families x bright/deep tones).
// Source of truth: design project Final.dc.html turn 12a AURA
// (AURA_H hues, mkPal tone rows) + the handoff README's canonical first four.
// Entries 0-3 are the README's literal values ("first four members land
// ~90-120 degrees apart"); note slot 3 is a curated green (150,70%,50%) that
// is NOT the board's naive 150-bright — greens at 90% saturation fail the
// must-survive-0.5-alpha-on-#141021 rule. Slots 4-23 fill the remaining
// board colors, interleaved bright/deep and hue-spread so nearby joiners
// stay visually far apart.

const AURA_H = [10, 28, 42, 72, 150, 172, 200, 221, 233, 262, 305, 345];
const BRIGHT = [90, 62]; // [saturation, lightness]
const DEEP = [75, 46];

const CANON_FIRST_FOUR = [
  { h: 10, s: 90, l: 62 },
  { h: 221, s: 90, l: 62 },
  { h: 305, s: 90, l: 62 },
  { h: 150, s: 70, l: 50 },
];

function buildBoard() {
  const board = [...CANON_FIRST_FOUR];
  // Hue order chosen to keep consecutive assignments far apart on the wheel.
  const spread = [42, 262, 172, 345, 200, 72, 28, 233];
  for (const h of spread) board.push({ h, s: BRIGHT[0], l: BRIGHT[1] });
  for (const h of AURA_H) {
    if (board.length >= 24) break;
    board.push({ h, s: DEEP[0], l: DEEP[1] });
  }
  return board.slice(0, 24);
}

export const BOARD = buildBoard();

export function hslOf(colorIndex, alpha) {
  const c = BOARD[((colorIndex % BOARD.length) + BOARD.length) % BOARD.length];
  return alpha == null
    ? `hsl(${c.h},${c.s}%,${c.l}%)`
    : `hsla(${c.h},${c.s}%,${c.l}%,${alpha})`;
}

// Lighter tint for strokes: same hue, saturation capped at 85, lightness 82.
// YOU are the only white-stroked element, handled by the caller via isYou.
export function strokeOf(colorIndex, isYou = false) {
  if (isYou) return '#fff';
  const c = BOARD[((colorIndex % BOARD.length) + BOARD.length) % BOARD.length];
  return `hsl(${c.h},${Math.min(c.s, 85)}%,82%)`;
}

// Auto-assign the lowest free slot; colorIndex is stable for a member's life.
export function nextColorIndex(taken) {
  const t = new Set(taken);
  for (let i = 0; i < BOARD.length; i++) if (!t.has(i)) return i;
  return taken.length % BOARD.length; // 25th member wraps
}
