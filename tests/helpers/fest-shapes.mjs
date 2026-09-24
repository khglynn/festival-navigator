// The cards that stress a festival's wall, found in its own data file
// (2026-09-24). The browser contracts run their laws on every festival we
// ship, not only the one in front of us — ACL follows Portola by a week, and
// its wall is a different shape (two weekends of dated tabs, Late nights
// stacks), as are a lineup-only wall (EDC, Seismic: cards, no clock) and
// Electric Forest's (activities as venue groups). A set-times drop must
// re-aim a case, never break it, so every case here is chosen by SHAPE — the
// shortest set on the clock, the longest name, a card under a venue — and
// never by an artist's name.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeDayArtists } from '../../js/time.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const festData = (fid) => JSON.parse(fs.readFileSync(path.join(ROOT, `data/festivals/${fid}.json`), 'utf8'));

const byLength = (names) => [...new Set(names)].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
const cancelled = (a) => !!(a && a.cancelled);

// Where each name renders, in the wall's own terms (wall.js): on the CLOCK (a
// set whose stage is one of the grid's columns — the columns are every day's
// stages, wall.js computeTimesLayout), in a STACK under a venue (a section's
// show, an activity, a set whose stage is not a column), or as a plain card
// with no place of its own (`listed`: a lineup fest's names, and a grid day's
// billed names with no set yet, which the wall stacks under that day's grid).
export function shapesOf(fest) {
  const days = fest.days || {};
  const columns = [...new Set(Object.values(days).flatMap((d) => d.stages || []))];
  // A two-weekend fest draws each weekend's days as their own tabs
  // (wall.js weekendsOf), so a set's cell is sized within ITS weekend.
  const tagged = Object.values(days).some((d) => (d.artists || []).some((a) => a.weekend === 'W1' || a.weekend === 'W2'));
  const weekends = tagged ? ['W1', 'W2'] : [null];
  const clock = [];
  const strays = [];
  for (const [day, d] of Object.entries(days)) {
    for (const w of weekends) {
      const sets = (d.artists || []).filter((a) => !w || !a.weekend || a.weekend === 'both' || a.weekend === w);
      if (!sets.length) continue;
      for (const a of computeDayArtists({ ...d, artists: sets })) {
        // The display floor (wall.js renderScheduledDayBody): 30 minutes, 44px.
        const span = Math.max(a.endMin ?? a.startMin + 60, a.startMin + 30) - a.startMin;
        const col = columns.indexOf(a.stage);
        if (col === -1) strays.push(a.name);
        else clock.push({ name: a.name, day, weekend: w, span, col });
      }
    }
  }
  const onClock = new Set(clock.map((s) => s.name));
  const live = (fest.artists || []).filter((a) => !cancelled(a));
  const sectioned = live.filter((a) => a.venue || a.date || a.night).map((a) => a.name);
  const activities = Object.values(fest.activities || {}).flat().map((a) => a.name);
  const gridDays = new Set(Object.keys(days));
  const listed = live.filter((a) => !(a.venue || a.date || a.night) && !onClock.has(a.name) && (!a.day || !gridDays.has(a.day) || !days[a.day].artists.some((s) => s.name === a.name))).map((a) => a.name);
  const last = columns.length - 1;
  return {
    columns,
    // The 44px cell: a set drawn at the display floor, a whole column wide.
    short: byLength(clock.filter((s) => s.span <= 30).map((s) => s.name)),
    cells: byLength(clock.map((s) => s.name)),
    // The right-most column: a cell that scrolls to the screen's edge.
    rightmost: byLength(clock.filter((s) => s.col === last).map((s) => s.name)),
    stacked: byLength([...sectioned, ...activities, ...strays]),
    listed: byLength(listed),
  };
}

// A made-up crew of seven — Kevin is you — with every shape the corners can
// take, placed on the cards that stress THIS festival: you at 1, 2, 3 and
// must; a card all seven picked, with notes and a followed Spotify pill, on
// the longest name each kind of card carries; the 44px cell under a crowd;
// cards only the others picked. `roles` says which card got which load, so a
// test can find it again without knowing a name.
export const CREW = { Kevin: 0, Drew: 1, Kat: 2, Nhu: 3, Pegah: 4, Ross: 5, Sam: 6 };
const ALL7 = (you) => ({ Kevin: you, Drew: 4, Kat: 4, Nhu: 3, Pegah: 2, Ross: 1, Sam: 1 });
const LOADS = {
  crowd: { levels: ALL7(4), spotify: { songs: 41, followed: true }, notes: 2 },
  crowdLow: { levels: ALL7(1), spotify: { songs: 5, followed: true }, notes: 1 },
  crowd3: { levels: ALL7(3), spotify: { songs: 99, followed: true }, notes: 1 },
  mixed: { levels: { Kevin: 3, Drew: 4, Kat: 1, Nhu: 2, Ross: 1 }, spotify: { songs: 7 }, notes: 1 },
  pair: { levels: { Kevin: 2, Drew: 2, Pegah: 4 }, spotify: { songs: 0, followed: true } },
  low: { levels: { Kevin: 1, Ross: 4, Sam: 1 } },
  others: { levels: { Drew: 4, Kat: 4, Nhu: 1, Sam: 2 } },
  solo: { levels: { Kevin: 2 }, spotify: { songs: 23, followed: true } },
  must: { levels: { Kevin: 4 } },
};
// [role, pool, load] — each role takes the first name in its pool that no
// earlier role took. A pool a festival does not have (a lineup fest has no
// clock) simply casts nobody.
const RECIPE = [
  ['cellCrowd', 'cells', 'crowd'],
  ['shortCrowd', 'short', 'crowd'],
  ['stackCrowd', 'stacked', 'crowd'],
  ['listCrowd', 'listed', 'crowd'],
  ['edgeCrowd', 'rightmost', 'crowd3'],
  ['shortLow', 'short', 'crowdLow'],
  ['cellLow', 'cells', 'crowdLow'],
  ['listLow', 'listed', 'crowdLow'],
  ['stack3', 'stacked', 'crowd3'],
  ['cellMixed', 'cells', 'mixed'],
  ['listMixed', 'listed', 'mixed'],
  ['stackMixed', 'stacked', 'mixed'],
  ['cellPair', 'cells', 'pair'],
  ['listPair', 'listed', 'pair'],
  ['stackPair', 'stacked', 'pair'],
  ['cellLowYou', 'cells', 'low'],
  ['listLowYou', 'listed', 'low'],
  ['cellOthers', 'cells', 'others'],
  ['listOthers', 'listed', 'others'],
  ['stackOthers', 'stacked', 'others'],
  ['edgeMust', 'rightmost', 'must'],
  ['listMust', 'listed', 'must'],
];

export function stressCrew(fest) {
  const shapes = shapesOf(fest);
  const taken = new Set();
  const roles = {};
  const selections = {};
  const affinity = {};
  const noted = [];
  for (const [role, pool, load] of RECIPE) {
    const name = shapes[pool].find((n) => !taken.has(n));
    if (!name) continue;
    taken.add(name);
    roles[role] = name;
    const l = LOADS[load];
    selections[name] = { ...l.levels };
    if (l.spotify) affinity[name] = { ...l.spotify };
    for (let i = 0; i < (l.notes || 0); i++) noted.push(name);
  }
  // The shortest name on the clock, you alone on it (Portola's "Oh").
  const tiny = [...shapes.cells].reverse().find((n) => !taken.has(n));
  if (tiny) { roles.cellTiny = tiny; selections[tiny] = { ...LOADS.solo.levels }; affinity[tiny] = { ...LOADS.solo.spotify }; }
  return { selections, affinity, noted, roles, shapes };
}
