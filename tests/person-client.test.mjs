// Client side of the me link (js/crew.js person helpers): the local person
// store, hash parsing, and the two network verbs — ensurePerson (create once,
// silently) and stampPersonCrew (idempotent via the local mirror, offline-
// tolerant). Failures must return null/false and never throw: identity
// plumbing does not stand between a person and their wall.
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

const P_TOKEN = 'persontoken_test_012345678';
const CREW_TOKEN = 'crewtoken_test_0123456789';

// One switchable fetch mock; each test sets its behavior.
let fetchImpl = () => { throw new Error('fetch not mocked'); };
globalThis.fetch = (...args) => fetchImpl(...args);
const jsonRes = (status, body) => ({
  ok: status < 400,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
});

test('myPerson roundtrip + meLink carries the token in #p=', () => {
  store.clear();
  assert.equal(crew.myPerson(), null);
  assert.equal(crew.meLink(), null, 'no person, no link');
  crew.setMyPerson({ token: P_TOKEN, id: 'pid_abc12345', name: 'Kevin', crews: {} });
  assert.equal(crew.myPerson().name, 'Kevin');
  assert.equal(crew.meLink(), `https://fest.kevinhg.com/#p=${P_TOKEN}`);
});

test('personFromHash parses; broken links are detected, absent ones are not', () => {
  location.hash = `#p=${P_TOKEN}`;
  assert.equal(crew.personFromHash(), P_TOKEN);
  assert.equal(crew.hashHasBrokenPersonLink(), false);
  location.hash = '#p=chopped';
  assert.equal(crew.personFromHash(), null);
  assert.equal(crew.hashHasBrokenPersonLink(), true, 'a me link that does not parse must say so');
  location.hash = `#g=${CREW_TOKEN}`;
  assert.equal(crew.personFromHash(), null);
  assert.equal(crew.hashHasBrokenPersonLink(), false, 'a crew link is not a broken me link');
  location.hash = '';
});

test('ensurePerson creates once, then reuses; failure and offline return null', async () => {
  store.clear();
  let creates = 0;
  fetchImpl = async () => { creates++; return jsonRes(201, { token: P_TOKEN, id: 'pid_abc12345', doc: { v: 1, name: 'Kevin', crews: {} } }); };
  const p = await crew.ensurePerson('Kevin');
  assert.equal(p.id, 'pid_abc12345');
  const again = await crew.ensurePerson('Kevin');
  assert.equal(again.token, P_TOKEN);
  assert.equal(creates, 1, 'second call reuses the stored person — no duplicate records');

  store.clear();
  fetchImpl = async () => jsonRes(429, { error: 'Too many links created — try again later' });
  assert.equal(await crew.ensurePerson('Kevin'), null, 'server refusal is a quiet null');
  fetchImpl = async () => { throw new TypeError('network down'); };
  assert.equal(await crew.ensurePerson('Kevin'), null, 'offline is a quiet null');
});

test('two ensurePerson calls in flight converge on ONE record (double-create race)', async () => {
  // Two tabs both see no fn_person_v1 and both POST. Whoever lands first
  // wins; the loser must adopt the winner's record, not overwrite it — a
  // device split across two person records leaves the crew pid pointing at
  // a record the me link can't reach (Codex gate, P1).
  store.clear();
  let n = 0;
  const gates = [];
  fetchImpl = () => new Promise((resolve) => {
    const mine = ++n;
    gates.push(() => resolve(jsonRes(201, {
      token: `persontoken_race_${mine}_0123456789`.slice(0, 27),
      id: `pid_race_${mine}000`,
      doc: { v: 1, name: 'Kevin', crews: {} },
    })));
  });
  const a = crew.ensurePerson('Kevin');
  const b = crew.ensurePerson('Kevin');
  gates.forEach((open) => open()); // both responses land
  const [pa, pb] = await Promise.all([a, b]);
  assert.equal(pa.id, pb.id, 'both callers converge on the same record');
  assert.equal(crew.myPerson().id, pa.id, 'and it is the stored one');
});

test('the person token travels in a header, never in a URL', async () => {
  store.clear();
  crew.setMyPerson({ token: P_TOKEN, id: 'pid_abc12345', name: 'Kevin', crews: {} });
  const seen = [];
  fetchImpl = async (url, opts = {}) => {
    seen.push({ url: String(url), headers: opts.headers || {} });
    return jsonRes(200, { id: 'pid_abc12345', doc: { v: 1, name: 'Kevin', crews: {} } });
  };
  await crew.fetchPerson(P_TOKEN);
  await crew.stampPersonCrew(CREW_TOKEN, 'Kevin', 'EF 26');
  for (const req of seen) {
    assert.ok(!req.url.includes(P_TOKEN), `master key must not appear in a URL: ${req.url}`);
    assert.equal(req.headers['X-Person-Token'], P_TOKEN, 'header carries the credential');
  }
});

test('mayStampPerson: ownership is checked both ways — claimed and unclaimed crews', () => {
  const person = { name: 'Kevin', crews: { [CREW_TOKEN]: { name: 'Kevin', crewName: 'EF 26' } } };
  const other = 'othercrew_token_0123456789';
  // Claimed crew: only the claimed name, or a rename FROM it.
  assert.equal(crew.mayStampPerson(person, CREW_TOKEN, 'Kevin'), true, 'owner restamps freely');
  assert.equal(crew.mayStampPerson(person, CREW_TOKEN, 'Drew'), false,
    'a switched picker must not become the record owner');
  assert.equal(crew.mayStampPerson(person, CREW_TOKEN, 'KevinHG', { renameFrom: 'Kevin' }), true,
    'a rename from the claimed name is sanctioned');
  assert.equal(crew.mayStampPerson(person, CREW_TOKEN, 'Drew', { renameFrom: 'Drew Sr' }), false,
    'a rename NOT starting from the claimed name transfers nothing — the switched-picker rename door is closed');
  // Unclaimed crew: open only to a picker matching the record's own name.
  assert.equal(crew.mayStampPerson(person, other, 'Kevin'), true, 'the owner claims a new crew');
  assert.equal(crew.mayStampPerson(person, other, 'kevin'), true, 'case-insensitively');
  assert.equal(crew.mayStampPerson(person, other, 'Drew'), false,
    'a different picker in an unclaimed crew does NOT inherit the record — the mirror-empty door is closed');
  assert.equal(crew.mayStampPerson(null, CREW_TOKEN, 'Kevin'), false, 'no record — nothing may stamp');
});

test('same-tab concurrent ensurePerson calls make exactly ONE create POST', async () => {
  store.clear();
  let posts = 0;
  fetchImpl = () => new Promise((resolve) => setTimeout(() => {
    posts++;
    resolve(jsonRes(201, { token: P_TOKEN, id: 'pid_abc12345', doc: { v: 1, name: 'Kevin', crews: {} } }));
  }, 10));
  const [a, b] = await Promise.all([crew.ensurePerson('Kevin'), crew.ensurePerson('Kevin')]);
  assert.equal(posts, 1, 'the in-flight memo collapses the double-tap to one server row');
  assert.equal(a.id, b.id);
});

test('stampPersonCrew: mirrors skip the network, merges update the mirror, failures are false', async () => {
  store.clear();
  crew.setMyPerson({ token: P_TOKEN, id: 'pid_abc12345', name: 'Kevin', crews: {} });
  let posts = 0;
  fetchImpl = async (url, opts) => {
    posts++;
    const sent = JSON.parse(opts.body).data;
    assert.ok(sent.crews[CREW_TOKEN], 'delta targets the crew entry');
    return jsonRes(200, { id: 'pid_abc12345', doc: { v: 1, name: 'Kevin', crews: sent.crews } });
  };
  assert.equal(await crew.stampPersonCrew(CREW_TOKEN, 'Kevin', 'EF 26'), true);
  assert.equal(posts, 1);
  assert.equal(await crew.stampPersonCrew(CREW_TOKEN, 'Kevin', 'EF 26'), true, 'already mirrored');
  assert.equal(posts, 1, 'no redundant network write');
  assert.equal(await crew.stampPersonCrew(CREW_TOKEN, 'Kevin', 'EF 26 renamed'), true, 'changed crewName re-stamps');
  assert.equal(posts, 2);

  fetchImpl = async () => { throw new TypeError('network down'); };
  assert.equal(await crew.stampPersonCrew(CREW_TOKEN, 'Kevin', 'Other'), false, 'offline is a quiet false');
  assert.equal(await crew.stampPersonCrew('x'.repeat(25), 'Kevin', 'Other'), false);

  store.clear();
  assert.equal(await crew.stampPersonCrew(CREW_TOKEN, 'Kevin', 'EF 26'), false, 'no person yet, nothing to stamp');
});
