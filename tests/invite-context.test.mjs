// FLOW-1 regression: an invite opened on a new device must land the joiner on
// the crew's festival, not defaultFestivalId(). Two carriers, tested here:
//   (a) the share link's &f=<festId> hash param (new links, zero-write)
//   (b) meta.inviteFestId in the crew doc (heals already-distributed links)
// Browser globals are shimmed so the real modules run under node --test.
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

const crew = await import('../js/crew.js');
const state = await import('../js/state.js');
const { FESTIVAL_INDEX, defaultFestivalId } = await import('../js/festivals.js');
const { validateIncoming } = await import('../api/_lib/crew-shared.mjs');

// The index normally loads via fetch; seed it directly (ordered by date,
// like index.json — first non-archived entry is the default).
FESTIVAL_INDEX.push(
  { id: 'lost-lands-2026', status: 'scheduled' },
  { id: 'electric-forest-2026', status: 'scheduled' },
);

const TOKEN = 'testtoken_0123456789abcd';
const freshDoc = () => ({ v: 4, meta: {}, spotify: {}, people: {}, festivals: {}, affinity: {} });

test('crewLink carries the festival context in the hash', () => {
  assert.equal(crew.crewLink(TOKEN), `https://fest.kevinhg.com/#g=${TOKEN}`);
  assert.equal(
    crew.crewLink(TOKEN, 'electric-forest-2026'),
    `https://fest.kevinhg.com/#g=${TOKEN}&f=electric-forest-2026`,
  );
  // An id that fails the festival-id charset never rides the link.
  assert.equal(crew.crewLink(TOKEN, 'Bad Fest!'), `https://fest.kevinhg.com/#g=${TOKEN}`);
});

test('tokenFromHash and festFromHash parse a combined invite hash', () => {
  location.hash = `#g=${TOKEN}&f=electric-forest-2026`;
  assert.equal(crew.tokenFromHash(), TOKEN);
  assert.equal(crew.festFromHash(), 'electric-forest-2026');
  location.hash = `#g=${TOKEN}`;
  assert.equal(crew.tokenFromHash(), TOKEN);
  assert.equal(crew.festFromHash(), null);
  location.hash = '';
});

test('activateCrew: fest hint seeds a fresh device and persists', () => {
  store.clear();
  state.activateCrew(TOKEN, freshDoc(), 'electric-forest-2026');
  assert.equal(state.activeFestivalId, 'electric-forest-2026');
  // Persisted: the next boot (no hint) must land on the same fest.
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), 'electric-forest-2026');
});

test('activateCrew: a returning device keeps its own saved fest over the hint', () => {
  store.clear();
  localStorage.setItem(`fn_crew_fest_v3_${TOKEN}`, 'lost-lands-2026');
  state.activateCrew(TOKEN, freshDoc(), 'electric-forest-2026');
  assert.equal(state.activeFestivalId, 'lost-lands-2026');
});

test('activateCrew: unknown hint falls back to the default festival', () => {
  store.clear();
  state.activateCrew(TOKEN, freshDoc(), 'not-a-real-fest');
  assert.equal(state.activeFestivalId, defaultFestivalId());
});

test('recordInviteFest writes a merge overlay the server accepts', () => {
  store.clear();
  state.activateCrew(TOKEN, freshDoc());
  state.recordInviteFest('electric-forest-2026');
  assert.equal(state.pendingChanges.meta.inviteFestId, 'electric-forest-2026');
  assert.equal(state.crewDoc.meta.inviteFestId, 'electric-forest-2026');
  const check = validateIncoming(state.pendingChanges);
  assert.equal(check.ok, true, check.error);
});

test('busiestFestival: the crew home is where the picks live', async () => {
  const { busiestFestival } = await import('../js/v3/model.js');
  const doc = {
    v: 4,
    festivals: {
      'electric-forest-2026': { selections: { GRiZ: { Kevin: 4 }, Zeds: { Kevin: 2 }, Odesza: { Drew: 1 } } },
      'portola-2026': { selections: { Skrillex: { Kevin: 1 } } },
      'ghost-fest': { selections: { X: { Kevin: 4 } } }, // not in the catalog — never wins
      'lost-lands-2026': { selections: { Cleared: { Kevin: 0 } } }, // tombstones don't count
    },
  };
  const known = ['electric-forest-2026', 'portola-2026', 'lost-lands-2026'];
  assert.equal(busiestFestival(doc, known), 'electric-forest-2026');
  assert.equal(busiestFestival({ v: 4, festivals: {} }, known), null, 'no picks anywhere = no signal');
});

test('validator: meta.inviteFestId is the one extra meta field', () => {
  assert.equal(validateIncoming({ meta: { inviteFestId: 'electric-forest-2026' } }).ok, true);
  assert.equal(validateIncoming({ meta: { name: 'The Crew', inviteFestId: 'ef' } }).ok, true);
  assert.equal(validateIncoming({ meta: { inviteFestId: 'NOT VALID!' } }).ok, false);
  assert.equal(validateIncoming({ meta: { inviteFestId: 42 } }).ok, false);
  // Everything else stays rejected — createdAt and v are server-owned.
  assert.equal(validateIncoming({ meta: { createdAt: '2026-01-01' } }).ok, false);
  assert.equal(validateIncoming({ v: 4 }).ok, false);
});
