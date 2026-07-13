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

// Who-corner (bottom-right): lettered pills = musts (innermost, sorted
// first), 4px ticks = picks. Caps: 2 musts + 2 ticks, then one ghost "+n".
export function whoCorner(people) {
  const all = ordered(people);
  const musts = all.filter((p) => p.level === 4).slice(0, 2);
  const picks = all.filter((p) => p.level < 4).slice(0, 2);
  const shown = musts.length + picks.length;
  const overflow = all.length - shown;
  const marks = [
    ...musts.map((p) => ({
      kind: 'must',
      width: 24,
      label: initialFor(p, people),
      fill: hslOf(p.colorIndex, 0.5),
      stroke: strokeOf(p.colorIndex, p.isYou),
    })),
    ...picks.map((p) => ({
      kind: 'pick',
      width: 4,
      label: '',
      fill: hslOf(p.colorIndex, 0.5),
      stroke: strokeOf(p.colorIndex, p.isYou),
    })),
  ];
  if (overflow > 0) marks.push({ kind: 'ghost', label: `+${overflow}` });
  return marks;
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

// About-corner (bottom-left) data: violet notes bubble then green Spotify.
export function aboutCorner({ noteCount = 0, spotify = null } = {}) {
  const chips = [];
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
