// Fidelity rig: render the REAL wall and the REAL notes sheet through the
// app's own modules (state.js, wall.js, notes.js, aura.js) in jsdom — the same
// way tests/wall-dom.test.mjs does — so every artboard grows from production
// output. Nothing here approximates a card; the cards ARE renderCard's.
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const REPO = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.HTMLElement = dom.window.HTMLElement;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });

const state = await import(`${REPO}/js/state.js`);
const { FESTIVALS, FESTIVAL_INDEX } = await import(`${REPO}/js/festivals.js`);
const wall = await import(`${REPO}/js/v3/wall.js`);
const notes = await import(`${REPO}/js/v3/notes.js`);
const model = await import(`${REPO}/js/v3/model.js`);
const aura = await import(`${REPO}/js/v3/aura.js`);
const palette = await import(`${REPO}/js/v3/palette.js`);

export const FID = 'portola-2026';
export const portola = JSON.parse(readFileSync(`${REPO}/data/festivals/${FID}.json`, 'utf8'));
const index = JSON.parse(readFileSync(`${REPO}/data/festivals/index.json`, 'utf8'));
FESTIVALS[FID] = portola;
FESTIVAL_INDEX.push(index.find((f) => f.id === FID));

export const ME = 'Ava';
// colorIndex follows the app's own assignment order (nextColorIndex): first
// four members land on the canonical first four hues.
export const PEOPLE = { Ava: { colorIndex: 0 }, Ben: { colorIndex: 1 }, Cleo: { colorIndex: 2 }, Dev: { colorIndex: 3 } };

const sat = portola.days.Saturday.artists;
const sun = portola.days.Sunday.artists;
const has = (list, name) => list.some((a) => a.name === name);
const pick = (list, wanted, fallbackIdx) => (has(list, wanted) ? wanted : list[fallbackIdx].name);

export const NAMES = {
  dogBlood: pick(sat, 'Dog Blood', 0),
  soulwax: pick(sat, 'Soulwax', 1),
  prospa: pick(sat, 'Prospa', 2),
  melanieC: pick(sat, 'Melanie C', 3),
  robyn: pick(sat, 'Robyn', 4),
  shm: pick(sun, 'Swedish House Mafia', 0),
  fourTet: pick(sun, 'Four Tet', 1),
  tiesto: pick(sun, 'Tiësto', 2),
  horse: pick(sun, 'horsegiirL', 3),
  kaytree: pick(sun, 'Kaytree', 4),
};

// Picks: level 1-3 = picked, 4 = must.
export const SELECTIONS = {
  [NAMES.dogBlood]: { Ava: 4, Ben: 2, Cleo: 1 },
  [NAMES.soulwax]: { Ava: 2, Cleo: 4 },
  [NAMES.prospa]: { Ben: 4, Ava: 1 },
  [NAMES.melanieC]: { Cleo: 3 },
  [NAMES.robyn]: { Ava: 3, Ben: 1 },
  [NAMES.shm]: { Ava: 4, Ben: 4, Cleo: 2, Dev: 1 },
  [NAMES.fourTet]: { Ava: 3, Cleo: 3 },
  [NAMES.tiesto]: { Ben: 3 },
  [NAMES.horse]: { Cleo: 4 },
  [NAMES.kaytree]: { Ava: 1 },
};

// Notes. A reply carries `re: <root id>` — the one new key this round adds.
// Stamps are RELATIVE to now so relTime reads '12m ago', not '1d ago', whenever the canvas is rebuilt.
const T = (minsAgo) => new Date(Date.now() - minsAgo * 60000).toISOString();
const nid = (author, ts, n) => model.makeNoteId(author, ts, n);
const mk = (author, ts, text, n, extra = {}) => [nid(author, ts, n), { author, ts, text, ...extra }];

const dbRoot = mk('Cleo', T(190), 'meet at the rail 10 min early — it fills fast', 'aaaaaa');
const dbR1 = mk('Ava', T(181), 'yes — coming straight from Warehouse', 'aaaaab', { re: dbRoot[0] });
const dbR2 = mk('Ben', T(95), 'save me a spot, I’ll be late from Prospa', 'aaaaac', { re: dbRoot[0] });
const dbRoot2 = mk('Ava', T(41), 'closing set — nobody leave early', 'aaaaad');
const dbR3 = mk('Dev', T(12), 'same — Prospa runs to 11 anyway, we can all walk over after', 'aaaaae', { re: dbRoot2[0] });

const satRoot = mk('Ava', T(26), 'Leaving right after Dog Blood — who’s in for the afters?', 'cccccc');
const sunRoot = mk('Ben', T(240), 'Lunch at the Pier 80 gate at 1? Doors are 1 PM', 'bbbbba');
const sunR1 = mk('Cleo', T(222), '1 works. I’m bringing the flags', 'bbbbbb', { re: sunRoot[0] });
const festRoot = mk('Dev', T(1500), 'Uber pickup is on Cesar Chavez, not the pier road', 'dddddd');
const festR1 = mk('Ava', T(1440), 'good call — the pier road was a parking lot last year', 'dddddd', { re: festRoot[0] });

export const NOTES = {
  artist: {
    [NAMES.dogBlood]: Object.fromEntries([dbRoot, dbR1, dbR2, dbRoot2, dbR3]),
  },
  day: {
    Saturday: Object.fromEntries([satRoot]),
    Sunday: Object.fromEntries([sunRoot, sunR1]),
  },
  fest: Object.fromEntries([festRoot, festR1]),
};
export const IDS = { dbRoot: dbRoot[0], dbR1: dbR1[0], dbR2: dbR2[0], dbRoot2: dbRoot2[0], dbR3: dbR3[0], satRoot: satRoot[0], sunRoot: sunRoot[0], sunR1: sunR1[0], festRoot: festRoot[0], festR1: festR1[0] };

// Spotify affinity for ME (lowercased artist -> {songs, followed}).
export const AFFINITY = {
  [NAMES.dogBlood.toLowerCase()]: { songs: 12, followed: true },
  [NAMES.shm.toLowerCase()]: { songs: 31, followed: true },
  [NAMES.fourTet.toLowerCase()]: { songs: 4, followed: false },
  [NAMES.soulwax.toLowerCase()]: { songs: 0, followed: true },
};

export const TOKEN = 'designrigtoken_0123456789';
export const DOC = {
  v: 4, meta: { name: 'Portola 26' }, spotify: {}, people: PEOPLE,
  festivals: { [FID]: { selections: SELECTIONS, notes: NOTES } },
  affinity: { [ME]: AFFINITY },
};

// Pins are device-local (notes.js loadPins reads fn_pins_v1).
export function setPins(ids) {
  localStorage.setItem('fn_pins_v1', JSON.stringify({ [FID]: ids }));
}

state.activateCrew(TOKEN, JSON.parse(JSON.stringify(DOC)), FID);

export function makeCtx(overrides = {}) {
  return {
    fid: FID,
    meName: ME,
    picks: model.picksFor(state.crewDoc, FID),
    affinity: AFFINITY,
    lowPower: false,
    weekend: 'all',
    filterPeople: [],
    soloStage: null,
    sort: 'billing',
    query: '',
    onTap: () => {},
    onOpenNotes: () => {},
    onOpenDayNotes: () => {},
    onNotesChange: () => {},
    now: new Date('2026-08-28T20:00:00Z'), // not festival day: no now line
    ...overrides,
  };
}

// The wall, exactly as production renders it, as a live jsdom element.
export function renderWallEl(ctx = makeCtx()) {
  const root = document.createElement('div');
  root.className = 'wall-wrap';
  root.id = 'wall-root';
  wall.renderWall(root, ctx);
  return root;
}

// The artist notes sheet, exactly as production renders it (sheet + backdrop).
export function renderArtistSheetEl(artist, ctx = makeCtx()) {
  notes.closeSheet();
  notes.openArtistSheet(artist, ctx, () => {});
  const sheet = document.getElementById('artist-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  return { sheet, backdrop };
}
export function renderDaySheetEl(day, ctx = makeCtx()) {
  notes.closeSheet();
  notes.openDayNotes(day, ctx, () => {});
  return { sheet: document.getElementById('artist-sheet'), backdrop: document.getElementById('sheet-backdrop') };
}

export const lib = { state, wall, notes, model, aura, palette };
export const document_ = document;

// Facts for one artist: what the hover panel / sheet header shows.
export function factsFor(artist) {
  const set = [...sat.map((a) => ({ ...a, day: 'Saturday' })), ...sun.map((a) => ({ ...a, day: 'Sunday' }))].find((a) => a.name === artist);
  const picksMap = SELECTIONS[artist] || {};
  const people = Object.entries(picksMap).map(([name, level]) => ({
    name, level, colorIndex: PEOPLE[name].colorIndex, isYou: name === ME,
  }));
  const ordered = aura.ordered(people);
  const noteList = model.notesFor(state.crewDoc, FID, 'artist', artist);
  const roots = noteList.filter((n) => !n.re);
  const newest = noteList.length ? noteList[noteList.length - 1] : null;
  const aff = AFFINITY[artist.toLowerCase()] || null;
  return {
    name: artist,
    day: set ? set.day : null,
    stage: set ? set.stage : null,
    time: set ? set.time : null,
    people: ordered,
    background: aura.auraBackground(people).background,
    animated: aura.auraBackground(people).animated,
    noteCount: noteList.length,
    rootCount: roots.length,
    newest,
    spotify: aff,
  };
}

export function hsl(ci, a) { return palette.hslOf(ci, a); }
export function stroke(ci, isYou) { return palette.strokeOf(ci, isYou); }
