// REAL concurrency, against a REAL Postgres, over INDEPENDENT sessions.
//
// Why this file exists, and it is worth being blunt about it: tests/db-merge.test.mjs
// contains a test called "CONCURRENT MERGES: every writer survives" and it is a
// rubber stamp. Codex proved it (finish gate, 2026-07-12) by swapping the inline
// UPDATE for the BANNED pre-lock CTE — the exact shape that lost 2 of 6 writes in
// production and got Vercel Blob's replacement thrown out — and re-running that
// test's six-way Promise.all for 50 rounds. It lost ZERO writes and stayed green.
// PGlite is a single connection: Promise.all just serializes the queries. The
// test could not fail on the regression it existed to catch.
//
// So db-merge.test.mjs tests SEMANTICS (recursive merge, arrays replaced whole,
// tombstones, every WHERE-clause invariant) — which is real value — and this file
// tests CONCURRENCY, which needs sessions that can actually collide. Neon's HTTP
// driver issues every query as an independent request, so Promise.all here really
// does put N writers on the row at once.
//
// Opt-in: needs DATABASE_URL. Skipped in CI (no database), run against a scratch
// Neon branch. The control test below is the point — it proves this harness can
// SEE a lost write. Without it we would just be trusting a green tick again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MERGE_SQL } from '../api/_lib/crew-sql.mjs';
import { LIMITS } from '../api/_lib/crew-shared.mjs';

const URL_ = process.env.DATABASE_URL;
const skip = URL_ ? false : 'set DATABASE_URL to run (uses a scratch Neon branch; never production)';

// The shape that was BANNED. Kept here, and only here, as a control: a test you
// cannot fail is a test you cannot trust, and this is how we know we could.
const CTE_MERGE_SQL = `
WITH cur AS (SELECT doc FROM crews WHERE token = $1)
UPDATE crews
SET doc = jsonb_deep_merge((SELECT doc FROM cur), $2::jsonb), updated_at = now()
WHERE token = $1
RETURNING doc`;

const WRITERS = ['Kev', 'Drew', 'Sam', 'Riley', 'Alex', 'Jo', 'Pat', 'Sky'];

// The HTTP driver takes one statement per request, and db/schema.sql is several —
// including a plpgsql body full of semicolons inside $fn$ ... $fn$. Split on
// semicolons only when we are OUTSIDE a dollar-quoted block.
function splitStatements(raw) {
  // Strip `--` line comments FIRST: db/schema.sql has prose comments containing
  // semicolons ("...drives in-app UI state; the REAL gate is..."), and splitting
  // on those cuts a sentence in half and hands Postgres a fragment.
  const sqlText = raw
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');

  const out = [];
  let buf = '';
  let tag = null; // the open dollar-quote tag, e.g. "$fn$"
  for (let i = 0; i < sqlText.length; i++) {
    if (!tag) {
      const m = /^\$[A-Za-z_]*\$/.exec(sqlText.slice(i));
      if (m) { tag = m[0]; buf += tag; i += tag.length - 1; continue; }
      if (sqlText[i] === ';') { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
    } else if (sqlText.startsWith(tag, i)) {
      buf += tag; i += tag.length - 1; tag = null; continue;
    }
    buf += sqlText[i];
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((s) => !/^\s*--/.test(s) && s.length > 0);
}

test('CONCURRENT MERGES on real Postgres: every writer survives', { skip }, async (t) => {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(URL_);
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  for (const stmt of splitStatements(schema)) await sql.query(stmt);

  const token = 'concurrency_test_000000001';
  const baseDoc = {
    v: 4, meta: { name: 'concurrency' }, spotify: {}, spotifyStats: {},
    people: {}, festivals: { ef: { selections: {} } }, affinity: {},
  };

  const reset = async () => {
    await sql.query('DELETE FROM crews WHERE token = $1', [token]);
    await sql.query('INSERT INTO crews (token, doc) VALUES ($1, $2::jsonb)', [token, JSON.stringify(baseDoc)]);
  };
  const pick = (who) => JSON.stringify({ festivals: { ef: { selections: { GRiZ: { [who]: 4 } } } } });
  const survivors = async () => {
    const r = await sql.query('SELECT doc FROM crews WHERE token = $1', [token]);
    return Object.keys(r[0].doc.festivals.ef.selections.GRiZ || {});
  };

  await t.test('the inline merge loses nothing, round after round', async () => {
    for (let round = 0; round < 3; round++) {
      await reset();
      await Promise.all(WRITERS.map((who) =>
        sql.query(MERGE_SQL, [token, pick(who), pick(who), LIMITS.docBytes, LIMITS.activePeople])));
      assert.deepEqual(
        (await survivors()).sort(), [...WRITERS].sort(),
        `round ${round}: all ${WRITERS.length} concurrent picks must survive — a lost write here is the bug that banned Vercel Blob`,
      );
    }
  });

  await t.test('CONTROL: the banned CTE shape DOES lose writes — so this harness can see one', async () => {
    // If this ever stops losing writes, the harness is no longer achieving real
    // concurrency, and the test above has quietly become a rubber stamp again.
    // That is exactly what happened under PGlite. Fail loudly rather than lie.
    let sawLoss = false;
    for (let round = 0; round < 5 && !sawLoss; round++) {
      await reset();
      await Promise.all(WRITERS.map((who) =>
        sql.query(CTE_MERGE_SQL, [token, pick(who)]).catch(() => {})));
      const left = await survivors();
      if (left.length < WRITERS.length) sawLoss = true;
    }
    assert.equal(
      sawLoss, true,
      'the pre-lock CTE must lose at least one of 8 concurrent writes. If it did not, these sessions are not actually racing, and the test above proves nothing.',
    );
  });

  await sql.query('DELETE FROM crews WHERE token = $1', [token]);
});
