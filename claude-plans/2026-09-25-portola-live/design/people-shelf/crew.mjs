// The made-up crew for the people-menu frames (2026-09-25; copied from the OURS round). Placeholder
// names, invented picks on the REAL Portola lineup — round one's picks for
// the same nine people, so the two rounds are comparable. Never real crew data.
// Levels: 1-3 picked, 4 must.
//
// NINE is the crew the model runs on (every member picks something, so
// US = 9 and the bar is 3). SIX and TWELVE exist only to test the people row's
// width at 320 and 390: six drops Gus..Ivy, twelve adds Jo, Kit and Lu with a
// few picks each (so their chips are real members, not blanks).

export const ME = 'Ana';
const ALL = ['Ana', 'Ben', 'Cy', 'Dot', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kit', 'Lu'];
export const CREWS = { 6: ALL.slice(0, 6), 9: ALL.slice(0, 9), 12: ALL };
export const MEMBERS = CREWS[9];
const peopleOf = (names) => Object.fromEntries(names.map((n) => [n, { colorIndex: ALL.indexOf(n) }]));
export const PEOPLE = peopleOf(MEMBERS);

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

// The three extra people the twelve-person row carries.
const EXTRA = {
  'Robyn': { Jo: 3, Kit: 2 }, 'Dog Blood': { Kit: 3, Lu: 2 }, 'Swedish House Mafia': { Jo: 4, Lu: 3 },
  'Four Tet': { Lu: 3 }, 'Tove Lo': { Jo: 2 },
};

// Round three's crowded zoom: a real Friday afters show with both doors
// (Tix @ AXS · Info @ DoTheBay) and a two-line name, picked by all twelve at
// every level, so the who-row is as long as it gets.
// No real show has both doors AND a name long enough to wrap in a phone's
// zoom, so the two-line name is proven on a second real card: the Folsom
// party Big Muscle: Bare Chest Calendar (Sat, DNA Lounge; an Info door only).
const CROWD = {
  'Femme Jatale b2b erika': { Ana: 2, Ben: 4, Cy: 3, Dot: 3, Eli: 3, Fay: 2, Gus: 2, Hal: 2, Lu: 2, Ivy: 1, Jo: 1, Kit: 1 },
  'Big Muscle: Bare Chest Calendar': { Ana: 3, Ben: 4, Cy: 4, Dot: 3, Eli: 2, Fay: 3, Gus: 2, Hal: 1, Lu: 2, Ivy: 1, Jo: 3, Kit: 1 },
};

// Picks for a crew of n (6, 9 or 12): members outside the crew are dropped.
export function selectionsFor(n = 9) {
  const keep = new Set(CREWS[n]);
  const out = {};
  for (const [artist, by] of Object.entries(SELECTIONS)) {
    const kept = Object.fromEntries(Object.entries({ ...by, ...(n === 12 ? EXTRA[artist] || {} : {}) }).filter(([p]) => keep.has(p)));
    if (Object.keys(kept).length) out[artist] = kept;
  }
  if (n === 12) for (const [artist, by] of Object.entries(EXTRA)) if (!out[artist]) out[artist] = { ...by };
  if (n === 12) Object.assign(out, structuredClone(CROWD));
  return out;
}

// The crew doc the stub /api serves (the browser harness pattern in
// tests/browser/now-jump.test.mjs). Never sent anywhere.
export function crewDoc(fid = 'portola-2026', n = 9) {
  return {
    v: 4, meta: { name: 'Design crew', inviteFestId: fid }, spotify: {}, affinity: {},
    people: peopleOf(CREWS[n]),
    festivals: { [fid]: { selections: selectionsFor(n) } },
  };
}
