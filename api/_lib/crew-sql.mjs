// The crew merge, as SQL, in ONE place.
//
// Why this file exists: every concurrency guarantee this app makes lives in
// these statements — "no read-modify-write race, ever", "6 of 6 concurrent
// merges survive". Until the finish pass (2026-07-12) not one of them was
// executed by a single test. The SQL sat inline in api/crew.js where nothing
// but production could reach it, and the suite tested a JS "reference twin"
// whose own comments admit it is NOT what production enforces. A regression in
// the real statement — a dropped WHERE clause, a botched merge — would have
// shipped green.
//
// Exporting the statements as parameterized text lets tests/db-merge.test.mjs
// run THE EXACT BYTES production runs against a real Postgres (PGlite, in
// process, no server). A test against a re-typed copy of the SQL would pass
// through precisely the regression it exists to catch.
//
// The merge expression is repeated inside each statement rather than hoisted
// into a CTE. That is deliberate and load-bearing: a CTE evaluates against a
// pre-lock snapshot and measurably LOST 2 of 6 concurrent writes (DEVLOG
// 2026-07-07). Inline, the second writer blocks on the row lock and then
// re-evaluates against the winner's committed row. Ugly beats lossy.

// $1 token · $2 delta with v4 semantics · $3 delta as sent · $4 max bytes · $5 max active people
export const MERGE_SQL = `
UPDATE crews
SET doc = jsonb_deep_merge(doc,
      CASE WHEN doc->>'v' = '4' THEN $2::jsonb ELSE $3::jsonb END),
    updated_at = now()
WHERE token = $1
  AND octet_length(jsonb_deep_merge(doc,
      CASE WHEN doc->>'v' = '4' THEN $2::jsonb ELSE $3::jsonb END)::text) <= $4
  AND (SELECT count(*)
       FROM jsonb_each(COALESCE(jsonb_deep_merge(doc,
         CASE WHEN doc->>'v' = '4' THEN $2::jsonb ELSE $3::jsonb END)->'people', '{}'::jsonb)) p
       WHERE NOT COALESCE((p.value->>'removed')::boolean, false)) <= $5
  AND (SELECT count(DISTINCT lower(p.key)) = count(*)
       FROM jsonb_each(COALESCE(jsonb_deep_merge(doc,
         CASE WHEN doc->>'v' = '4' THEN $2::jsonb ELSE $3::jsonb END)->'people', '{}'::jsonb)) p
       WHERE NOT COALESCE((p.value->>'removed')::boolean, false))
RETURNING doc`;

// The person merge — same atomic inline-merge discipline as crews, fewer
// invariants (a person doc has no people list to cap or dedupe; only the
// size guard). Same reason it lives here: tests run these exact bytes.
// $1 token · $2 delta · $3 max bytes
export const PERSON_MERGE_SQL = `
UPDATE persons
SET doc = jsonb_deep_merge(doc, $2::jsonb),
    updated_at = now()
WHERE token = $1
  AND octet_length(jsonb_deep_merge(doc, $2::jsonb)::text) <= $3
RETURNING id, doc`;

// Why did the merge refuse? A blanket "would exceed limits" once told someone
// whose actual problem was a duplicate name to go and delete their picks.
// $1 token · $2 delta v4 · $3 delta
export const DIAGNOSE_SQL = `
SELECT
  octet_length(jsonb_deep_merge(doc,
    CASE WHEN doc->>'v' = '4' THEN $2::jsonb ELSE $3::jsonb END)::text) AS bytes,
  (SELECT count(*)
     FROM jsonb_each(COALESCE(jsonb_deep_merge(doc,
       CASE WHEN doc->>'v' = '4' THEN $2::jsonb ELSE $3::jsonb END)->'people', '{}'::jsonb)) p
     WHERE NOT COALESCE((p.value->>'removed')::boolean, false)) AS active,
  (SELECT count(*) - count(DISTINCT lower(p.key))
     FROM jsonb_each(COALESCE(jsonb_deep_merge(doc,
       CASE WHEN doc->>'v' = '4' THEN $2::jsonb ELSE $3::jsonb END)->'people', '{}'::jsonb)) p
     WHERE NOT COALESCE((p.value->>'removed')::boolean, false)) AS dupes
FROM crews WHERE token = $1`;
