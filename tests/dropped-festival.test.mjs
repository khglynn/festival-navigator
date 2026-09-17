// A festival can leave the catalog while crews are still pointed at it.
// Lost Lands 2026 left on 2026-09-16 (Kevin isn't going), and its id was
// already on devices: a crew doc carries `festivals['lost-lands-2026']` with
// everyone's picks, a phone carries the saved-fest key, and old share links
// carry `&f=lost-lands-2026`. None of that can be reached to clean up, and
// the doc merge has no delete — so the app has to meet a dead id every time
// one of those opens.
//
// The contract, all of it here: opening is never a crash and never a blank
// wall; the picks under the gone fest stay in the document untouched; and
// the swap is NOT silent — state names the id it could not honour so the app
// can say so, because a landing row that promises "tap this fest, get this
// fest" and quietly delivers another one is the row lying (same rule as the
// storage-blocked exit in that row's click handler).
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVAL_INDEX, defaultFestivalId } = await import('../js/festivals.js');

// The catalog as it is AFTER the removal — portola first, so it is the
// default a dropped id falls back to.
FESTIVAL_INDEX.push(
  { id: 'portola-2026', name: 'Portola', status: 'scheduled', startsOn: '2026-09-26' },
  { id: 'edc-orlando-2026', name: 'EDC Orlando', status: 'lineup', startsOn: '2026-11-06' },
);

const GONE = 'lost-lands-2026';
const TOKEN = 'testtoken_0123456789abcd';
// A real crew doc: picks at the fest that left, and picks at one that stayed.
const docWithGoneFest = () => ({
  v: 4,
  meta: {},
  spotify: {},
  people: { Kevin: { colorIndex: 0 } },
  festivals: {
    [GONE]: { selections: { Subtronics: { Kevin: 4 }, Wooli: { Kevin: 2 } } },
    'portola-2026': { selections: { Overmono: { Kevin: 3 } } },
  },
  affinity: {},
});

test('a device saved on the dropped fest opens a real one instead of stranding', () => {
  store.clear();
  localStorage.setItem(state.LS.fest(TOKEN), GONE);
  state.activateCrew(TOKEN, docWithGoneFest());
  assert.equal(state.activeFestivalId, defaultFestivalId());
  assert.ok(
    FESTIVAL_INDEX.some((f) => f.id === state.activeFestivalId),
    'the fest we land on must be one the catalog actually has',
  );
});

test('the swap is named, not silent — and an ordinary boot names nothing', () => {
  store.clear();
  localStorage.setItem(state.LS.fest(TOKEN), GONE);
  state.activateCrew(TOKEN, docWithGoneFest());
  assert.equal(state.missingFestivalId, GONE);

  store.clear();
  localStorage.setItem(state.LS.fest(TOKEN), 'edc-orlando-2026');
  state.activateCrew(TOKEN, docWithGoneFest());
  assert.equal(state.activeFestivalId, 'edc-orlando-2026');
  assert.equal(state.missingFestivalId, null);
});

test('an old share link naming the dropped fest is ignored, not reported as dropped', () => {
  // A hint is a suggestion from a link, not this device's own answer. It
  // already falls back; it must not raise the notice, or every stale link in
  // a group chat would accuse the app of losing a festival.
  store.clear();
  state.activateCrew(TOKEN, docWithGoneFest(), GONE);
  assert.equal(state.activeFestivalId, defaultFestivalId());
  assert.equal(state.missingFestivalId, null);
});

test('the picks under the dropped fest are still in the document', () => {
  store.clear();
  localStorage.setItem(state.LS.fest(TOKEN), GONE);
  state.activateCrew(TOKEN, docWithGoneFest());
  assert.deepEqual(state.crewDoc.festivals[GONE].selections, {
    Subtronics: { Kevin: 4 }, Wooli: { Kevin: 2 },
  });
  // And they are still readable as picks — nothing prunes an unknown fest.
  assert.deepEqual(
    Object.keys(model.picksFor(state.crewDoc, GONE)).sort(),
    ['Subtronics', 'Wooli'],
  );
});

test('the landing still shows the dropped fest, labelled from its id', () => {
  // The row is the crew's own history and stays. festLabelFor has no catalog
  // entry to read, so it prettifies the id rather than rendering blank.
  const crews = [{ token: TOKEN, name: 'The Crew' }];
  const pairs = model.landingPairs(crews, () => docWithGoneFest(), FESTIVAL_INDEX);
  const row = pairs.find((p) => p.fid === GONE);
  assert.ok(row, 'a crew doc entry for a dropped fest still gets a row');
  assert.equal(model.festLabelFor(GONE, FESTIVAL_INDEX).name, 'Lost Lands 2026');
  assert.equal(model.festLabelFor(GONE, FESTIVAL_INDEX).accent, null);
});

test('an empty catalog accuses nobody', () => {
  // Offline with no cached index: nothing is known, so everything would look
  // dropped. The notice stays quiet and the existing boot path handles it.
  const saved = FESTIVAL_INDEX.splice(0, FESTIVAL_INDEX.length);
  try {
    store.clear();
    localStorage.setItem(state.LS.fest(TOKEN), GONE);
    assert.throws(() => state.activateCrew(TOKEN, docWithGoneFest()));
    assert.equal(state.missingFestivalId, null);
  } finally {
    FESTIVAL_INDEX.push(...saved);
  }
});
