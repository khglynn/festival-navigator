// The made-up nine with Kevin's afternoon added (2026-09-26, the plan-days
// design round): round two's crew (design/ours-r2/crew.mjs selectionsFor(9) —
// the same picks as tests/fixtures/plan-crew-nine.json), plus Despacio picked
// by SEVEN of the nine at mixed levels, two of them as a must, on top of
// everything else they picked. Kevin's real crew had seven on Despacio on
// Saturday afternoon; this reproduces the shape without any real data.
// Placeholder names, invented picks on the real Portola lineup. Never real
// crew data. Levels: 1-3 picked, 4 must.
import { selectionsFor, CREWS } from '../../2026-09-25-portola-live/design/ours-r2/crew.mjs';

export const ME = 'Ana';
export const MEMBERS = CREWS[9];

// Despacio: Ana 1, Ben 1, Cy 2, Dot 1, Fay 4 (must), Gus 4 (must), Ivy 1.
// Eli and Hal did not pick it.
export const DESPACIO = { Ana: 1, Ben: 1, Cy: 2, Dot: 1, Fay: 4, Gus: 4, Ivy: 1 };

export function selectionsDespacio() {
  const s = selectionsFor(9);
  s.Despacio = { ...DESPACIO };
  return s;
}

const ALL = ['Ana', 'Ben', 'Cy', 'Dot', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy'];
const peopleOf = (names) => Object.fromEntries(names.map((n) => [n, { colorIndex: ALL.indexOf(n) }]));

// The crew doc the stub /api serves (never sent anywhere).
export function crewDocDespacio(fid = 'portola-2026') {
  return {
    v: 4, meta: { name: 'Design crew', inviteFestId: fid }, spotify: {}, affinity: {},
    people: peopleOf(MEMBERS),
    festivals: { [fid]: { selections: selectionsDespacio() } },
  };
}
