// A made-up 10-person crew for the OURS frames (2026-09-25). Placeholder
// names, invented picks on the REAL Portola lineup. Never real crew data.
// Jo picked nothing: the member who is in the crew but not (yet) going.
// Levels: 1-3 picked, 4 must.

export const ME = 'Ana';
export const MEMBERS = ['Ana', 'Ben', 'Cy', 'Dot', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo'];
export const PEOPLE = Object.fromEntries(MEMBERS.map((n, i) => [n, { colorIndex: i }]));

const P = (o) => o;
export const SELECTIONS = {
  // ---- Thursday afters: scattered (nothing reaches three)
  'LAIMA': P({ Hal: 3, Ivy: 2 }),
  'Rau b2b Rivs': P({ Gus: 2 }),
  'Black Rave Culture': P({ Ben: 3, Eli: 2 }),

  // ---- Friday: a real fork across town
  'Horse Meat Disco': P({ Cy: 3, Dot: 3, Fay: 4, Hal: 2 }),
  '2manydjs': P({ Ana: 4, Ben: 3, Ivy: 3, Eli: 2 }),
  'Masha Mar': P({ Gus: 2 }),
  'BRUT SF': P({ Hal: 1 }),

  // ---- Saturday, Pier 80
  'Airwolf Paradise': P({ Ana: 2, Ben: 1 }),
  'Gelli Haha': P({ Ana: 3, Cy: 2, Dot: 1, Fay: 2 }),
  'Chloé Caillet': P({ Ben: 3, Eli: 2 }),
  'Tricky': P({ Gus: 3, Hal: 2, Ivy: 2 }),
  'Groove Armada': P({ Ben: 4, Eli: 3, Gus: 2, Ana: 1 }),
  'Fcukers': P({ Cy: 3, Dot: 2, Fay: 3, Ivy: 1 }),
  'Tove Lo': P({ Ana: 3, Cy: 2, Dot: 3, Fay: 2, Ivy: 2, Hal: 1 }),
  'DJ Shadow': P({ Gus: 3, Ben: 2, Eli: 2 }),
  'Robyn': P({ Ana: 4, Cy: 3, Dot: 4, Fay: 3, Ivy: 3, Hal: 2, Ben: 1 }),
  'Kettama': P({ Eli: 3, Gus: 3, Ben: 2 }),
  'Fatboy Slim': P({ Hal: 3, Gus: 2, Ivy: 2 }),
  'Dog Blood': P({ Ana: 4, Ben: 3, Cy: 3, Dot: 3, Eli: 2, Fay: 4, Hal: 2, Ivy: 2 }),
  'Prospa': P({ Gus: 4, Eli: 3, Ben: 2 }),
  'Soulwax': P({ Ana: 3, Cy: 2, Hal: 3, Ivy: 3, Dot: 2 }),
  'Melanie C': P({ Fay: 3 }),
  'Despacio': P({ Gus: 1 }),

  // ---- Saturday afters
  'Milli Meng': P({ Ana: 3, Dot: 3, Fay: 4, Cy: 2, Ivy: 2 }),
  'Emilio': P({ Ben: 3, Eli: 2, Gus: 3 }),
  'Galen': P({ Hal: 2 }),

  // ---- Sunday, Folsom Street Fair vs Pier 80
  'Folsom Street Fair': P({ Cy: 4, Dot: 3, Fay: 3, Hal: 2 }),
  'Channel Tres': P({ Ana: 3, Ben: 2, Ivy: 3 }),
  'SG Lewis': P({ Ana: 2, Ivy: 2, Ben: 2, Eli: 3 }),
  'Ben UFO': P({ Gus: 4, Eli: 3 }),
  'Mochakk': P({ Ana: 3, Ben: 3, Ivy: 2, Cy: 2, Dot: 2 }),
  'Tiësto': P({ Ben: 4, Ivy: 3, Eli: 2, Hal: 3 }),
  'Zara Larsson': P({ Ana: 4, Cy: 3, Dot: 3, Fay: 4, Hal: 2 }),
  'Overmono': P({ Gus: 3, Eli: 3, Ben: 2 }),
  'Swedish House Mafia': P({ Ana: 4, Ben: 4, Cy: 3, Dot: 3, Fay: 3, Hal: 3, Ivy: 4, Eli: 2 }),
  'Four Tet': P({ Gus: 4, Eli: 3, Ana: 2 }),
  'Parcels': P({ Cy: 3, Dot: 2, Fay: 3, Ivy: 2 }),

  // ---- Sunday afters
  'Kaytree': P({ Gus: 2, Eli: 3, Ana: 2 }),
  'Two Shell': P({ Cy: 3, Dot: 3, Fay: 2, Ivy: 3 }),
  'Real Bad 37': P({ Hal: 3, Cy: 2 }),
};

// The crew doc the stub /api serves (the browser harness pattern in
// tests/browser/now-jump.test.mjs). Never sent anywhere.
export function crewDoc(fid = 'portola-2026') {
  return {
    v: 4, meta: { name: 'Design crew', inviteFestId: fid }, spotify: {}, affinity: {},
    people: PEOPLE,
    festivals: { [fid]: { selections: structuredClone(SELECTIONS) } },
  };
}
