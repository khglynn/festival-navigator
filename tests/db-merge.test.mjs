// The SQL this whole app rests on, finally executed by a test.
//
// Everything the crew store promises — "no read-modify-write race, ever",
// tombstones instead of deletes, keyed notes because arrays would eat each
// other, the size/people/duplicate-name invariants — lives in db/schema.sql and
// api/_lib/crew-sql.mjs. Before the finish pass (2026-07-12) not one line of it
// ran in CI: the suite exercised a JS "reference twin" whose own comments admit
// it is NOT what production enforces, so a real regression in the real
// statement would have shipped green.
//
// This runs REAL Postgres (PGlite, in-process, no server, no secrets) against
// the SAME statement text api/crew.js executes. No re-typed copy — a test
// against a copy passes through exactly the regression it exists to catch.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { MERGE_SQL, DIAGNOSE_SQL } from '../api/_lib/crew-sql.mjs';
import { LIMITS } from '../api/_lib/crew-shared.mjs';

let db;
const TOKEN = 'dbtest_token_0123456789';

const baseDoc = () => ({
  v: 4,
  meta: { name: 'DB Test', createdAt: '2026-07-12T00:00:00.000Z' },
  spotify: {}, spotifyStats: {},
  people: { Kev: { colorIndex: 0 } },
  festivals: { ef: { selections: {} } },
  affinity: {},
});

const seed = async (doc = baseDoc(), token = TOKEN) => {
  await db.query('DELETE FROM crews WHERE token = $1', [token]);
  await db.query('INSERT INTO crews (token, doc) VALUES ($1, $2::jsonb)', [token, JSON.stringify(doc)]);
};

// Exactly how api/crew.js calls it.
const merge = (delta, token = TOKEN) => db.query(MERGE_SQL, [
  token, JSON.stringify(delta), JSON.stringify(delta), LIMITS.docBytes, LIMITS.activePeople,
]);

const readDoc = async (token = TOKEN) => {
  const r = await db.query('SELECT doc FROM crews WHERE token = $1', [token]);
  return r.rows[0]?.doc;
};

before(async () => {
  db = new PGlite();
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await db.exec(schema); // the real schema file — not a paraphrase of it
});

after(async () => { await db?.close(); });

// ---- jsonb_deep_merge semantics ----------------------------------------------

test('merge is recursive: a pick lands without erasing its siblings', async () => {
  await seed();
  await merge({ festivals: { ef: { selections: { GRiZ: { Kev: 4 } } } } });
  await merge({ festivals: { ef: { selections: { 'Lane 8': { Kev: 3 } } } } });
  const doc = await readDoc();
  assert.equal(doc.festivals.ef.selections.GRiZ.Kev, 4, 'the first pick survives the second write');
  assert.equal(doc.festivals.ef.selections['Lane 8'].Kev, 3);
  assert.equal(doc.meta.name, 'DB Test', 'and untouched branches are untouched');
});

test('two people picking the same artist both land', async () => {
  await seed();
  await merge({ festivals: { ef: { selections: { GRiZ: { Kev: 4 } } } } });
  await merge({ festivals: { ef: { selections: { GRiZ: { Drew: 2 } } } } });
  const doc = await readDoc();
  assert.deepEqual(doc.festivals.ef.selections.GRiZ, { Kev: 4, Drew: 2 });
});

test('a leaf overwrite wins — changing your own pick level works', async () => {
  await seed();
  await merge({ festivals: { ef: { selections: { GRiZ: { Kev: 1 } } } } });
  await merge({ festivals: { ef: { selections: { GRiZ: { Kev: 4 } } } } });
  assert.equal((await readDoc()).festivals.ef.selections.GRiZ.Kev, 4);
});

test('ARRAYS ARE REPLACED WHOLESALE — this is why notes are keyed objects', async () => {
  // Load-bearing. If notes were ever stored as arrays, two people adding a note
  // at once would silently destroy one of them. This test is the reason the
  // rule exists, so it should fail loudly if the merge ever starts merging
  // arrays element-wise and someone "helpfully" switches notes back to a list.
  await seed({ ...baseDoc(), arr: ['a', 'b', 'c'] });
  await merge({ arr: ['z'] });
  assert.deepEqual((await readDoc()).arr, ['z'], 'the whole array is replaced, not merged');
});

test('deletion is inexpressible — which is why tombstones exist', async () => {
  await seed();
  await merge({ people: { Drew: { colorIndex: 1 } } });
  await merge({ people: { Drew: null } });
  const doc = await readDoc();
  assert.notEqual(doc.people.Drew, undefined, 'null cannot remove a key; only a {removed:true} tombstone can');
});

test('a note from each of two people survives both writes', async () => {
  await seed();
  const note = (author, id, text) => ({
    festivals: { ef: { notes: { artist: { GRiZ: { [id]: { author, ts: '2026-07-12T00:00:00.000Z', text } } } } } },
  });
  await merge(note('Kev', 'Kev.note-0001', 'meet at the rail'));
  await merge(note('Drew', 'Drew.note-0001', 'bring earplugs'));
  const notes = (await readDoc()).festivals.ef.notes.artist.GRiZ;
  assert.equal(Object.keys(notes).length, 2, 'concurrent notes must not eat each other');
});

// ---- the invariants, as production enforces them ------------------------------

test('the people cap is enforced by the WHERE clause, not by trust', async () => {
  await seed();
  const people = {};
  for (let i = 0; i < LIMITS.activePeople + 1; i++) people[`P${i}`] = { colorIndex: i % 24 };
  const r = await merge({ people });
  assert.equal(r.rows.length, 0, 'the write is refused — no row updated');
  assert.equal(Object.keys((await readDoc()).people).length, 1, 'and the stored doc is untouched');
});

test('removed people do not count against the cap', async () => {
  await seed(); // the base doc already holds one active member (Kev)
  const people = {};
  const room = LIMITS.activePeople - 1; // fill the crew exactly to the cap
  for (let i = 0; i < room; i++) people[`P${i}`] = { colorIndex: i % 24 };
  for (let i = 0; i < 8; i++) people[`Gone${i}`] = { removed: true }; // ...plus tombstones

  const r = await merge({ people });
  assert.equal(r.rows.length, 1, 'tombstones are free — a crew that churns members is not punished forever');

  const doc = await readDoc();
  const active = Object.values(doc.people).filter((p) => !p.removed).length;
  assert.equal(active, LIMITS.activePeople, 'exactly at the cap, with 8 tombstones alongside');
});

test('the size cap is enforced against the CANDIDATE doc, before it is stored', async () => {
  await seed();
  const big = 'x'.repeat(LIMITS.docBytes + 1000);
  const r = await merge({ meta: { name: big } });
  assert.equal(r.rows.length, 0);
  assert.equal((await readDoc()).meta.name, 'DB Test', 'the oversized write never lands');
});

test('two active members differing only by case are refused BY THE MERGE', async () => {
  // The clients each check this against their own in-memory doc — which cannot
  // see the other phone joining in the same breath. The merge is the only place
  // both writes are visible.
  await seed();
  await merge({ people: { Drew: { colorIndex: 1 } } });
  const r = await merge({ people: { drew: { colorIndex: 2 } } });
  assert.equal(r.rows.length, 0, '"Drew" and "drew" must not become two people');
  const doc = await readDoc();
  assert.equal(doc.people.drew, undefined);
  assert.equal(doc.people.Drew.colorIndex, 1);
});

test('a removed member frees their name for re-use in another case', async () => {
  await seed();
  await merge({ people: { Drew: { removed: true } } });
  const r = await merge({ people: { drew: { colorIndex: 2 } } });
  assert.equal(r.rows.length, 1, 'a tombstone must not haunt the namespace forever');
});

test('the diagnostic says WHICH invariant refused the write', async () => {
  await seed();
  await merge({ people: { Drew: { colorIndex: 1 } } });
  const delta = JSON.stringify({ people: { drew: { colorIndex: 2 } } });
  const r = await db.query(DIAGNOSE_SQL, [TOKEN, delta, delta]);
  assert.equal(Number(r.rows[0].dupes), 1, 'a duplicate name reports as a duplicate name...');
  assert.ok(Number(r.rows[0].active) <= LIMITS.activePeople, '...not as "your crew is full"');
});

// ---- the claim the comments have been making for months ------------------------

test('CONCURRENT MERGES: every writer survives — the claim, finally tested', async () => {
  // db/schema.sql and api/_lib/crew-sql.mjs both assert this in prose: the merge
  // is computed INSIDE the UPDATE, so a second writer blocks on the row lock and
  // re-evaluates against the winner's committed row. A CTE-based version
  // measurably lost 2 of 6 writes (DEVLOG 2026-07-07) and is what got that
  // approach thrown out. Nothing ever checked that the surviving version works.
  await seed();

  const writers = ['Kev', 'Drew', 'Sam', 'Riley', 'Alex', 'Jo'];
  await Promise.all(writers.map((who) =>
    merge({ festivals: { ef: { selections: { GRiZ: { [who]: 4 } } } } })));

  const picks = (await readDoc()).festivals.ef.selections.GRiZ;
  assert.deepEqual(
    Object.keys(picks).sort(), [...writers].sort(),
    `all ${writers.length} concurrent picks must survive — a lost write here is the bug that banned Vercel Blob`,
  );
});
