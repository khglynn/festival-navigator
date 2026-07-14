// Crew store backed by Neon Postgres (one JSONB row per crew).
//
//   POST /api/crew            {name, people?}        -> create crew, returns {token, doc}
//   GET  /api/crew?t=<token>                         -> the crew document
//   POST /api/crew?t=<token>  {data: <partial doc>}  -> validated deep-merge, returns merged doc
//
// The unguessable token (160 bits) IS the access control — anyone with the
// crew link can read/write that crew, nobody can touch any other crew.
// Writes are validated leaf-by-leaf (api/_lib/crew-shared.mjs), then applied
// as ONE atomic UPDATE using the jsonb_deep_merge() SQL function, with the
// size + people-count invariants enforced in the same statement — so there
// is no read-modify-write race, ever. (Vercel Blob was tried first and
// dropped: its read path is eventually consistent, which measurably LOST
// writes under rapid-fire merges — see DEVLOG 2026-07-07.)
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import {
  deepMerge, newCrewDoc, validateIncoming, validateMergedDoc, LIMITS, TOKEN_RE,
} from './_lib/crew-shared.mjs';
import { rateLimited, crossSite } from './_lib/guard.mjs';
import { MERGE_SQL, DIAGNOSE_SQL } from './_lib/crew-sql.mjs';


export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (crossSite(req)) return res.status(403).json({ error: 'Cross-origin requests are not allowed' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'Store not configured (DATABASE_URL missing)' });

  const sql = neon(process.env.DATABASE_URL);

  try {
    const token = (req.query.t || '').toString();

    // ---- create ----
    if (req.method === 'POST' && !token) {
      if (rateLimited(req, 'crew-create', 10, 60 * 60 * 1000)) return res.status(429).json({ error: 'Too many crews created — try again later' });
      const body = req.body || {};
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      // `festivals` is accepted at birth (fest-first reshape, 2026-07-14) so a
      // board is created already knowing its fest — the old shape relied on
      // the first enterApp to add the key, which left multi-created boards as
      // festival-less ghosts until each was opened once.
      const seed = {
        meta: { name },
        ...(body.people ? { people: body.people } : {}),
        ...(body.festivals ? { festivals: body.festivals } : {}),
      };
      const check = validateIncoming(seed);
      if (!check.ok) return res.status(400).json({ error: check.error });

      // The same size/people invariants the merge path enforces (sweep P1,
      // 2026-07-12): creation used to skip them entirely, so a single crafted
      // create could mint a row past every cap the merge UPDATE guards.
      const newToken = crypto.randomBytes(20).toString('base64url');
      const doc = deepMerge(newCrewDoc(name, new Date().toISOString()), {
        ...(body.people ? { people: body.people } : {}),
        ...(body.festivals ? { festivals: body.festivals } : {}),
      });
      const merged = validateMergedDoc(doc);
      if (!merged.ok) return res.status(413).json({ error: merged.error });
      await sql`INSERT INTO crews (token, doc) VALUES (${newToken}, ${JSON.stringify(doc)}::jsonb)`;
      return res.status(201).json({ token: newToken, doc });
    }

    if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Missing or malformed crew token' });

    // ---- read ----
    if (req.method === 'GET') {
      const rows = await sql`SELECT doc FROM crews WHERE token = ${token}`;
      if (!rows.length) return res.status(404).json({ error: 'Crew not found' });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(rows[0].doc);
    }

    // ---- v3 -> v4 migration (server-computed, atomic, idempotent) ----
    // Maps every legacy selection level 3 ("Must See") to 4 (must) and stamps
    // v=4 in ONE statement guarded on the current version — no client payload,
    // so there is nothing to go stale and no partial stamp is possible.
    if (req.method === 'POST' && req.query.op === 'migrate') {
      const rows = await sql`
        UPDATE crews
        SET doc = jsonb_set(
          CASE WHEN doc ? 'festivals' THEN jsonb_set(doc, '{festivals}', COALESCE((
            SELECT jsonb_object_agg(f.key,
              CASE WHEN f.value ? 'selections' THEN jsonb_set(f.value, '{selections}', COALESCE((
                SELECT jsonb_object_agg(a.key, COALESCE((
                  SELECT jsonb_object_agg(p.key,
                    CASE WHEN p.value = '3'::jsonb THEN '4'::jsonb ELSE p.value END)
                  FROM jsonb_each(a.value) p), '{}'::jsonb))
                FROM jsonb_each(f.value->'selections') a), '{}'::jsonb))
              ELSE f.value END)
            FROM jsonb_each(doc->'festivals') f), '{}'::jsonb))
          ELSE doc END,
          '{v}', '4'::jsonb), updated_at = now()
        WHERE token = ${token} AND (doc->>'v') IS DISTINCT FROM '4'
        RETURNING doc`;
      if (rows.length) return res.status(200).json(rows[0].doc);
      const cur = await sql`SELECT doc FROM crews WHERE token = ${token}`;
      if (!cur.length) return res.status(404).json({ error: 'Crew not found' });
      return res.status(200).json(cur[0].doc); // already v4 — idempotent
    }

    // ---- merge write (single atomic statement; invariants inside) ----
    if (req.method === 'POST') {
      const incoming = req.body && req.body.data;
      const check = validateIncoming(incoming);
      if (!check.ok) return res.status(400).json({ error: check.error });

      // Semantics guard for STALE clients (offline-first: an old tab can
      // flush pending picks long after the doc migrated). Clients running v4
      // code declare it with sv:4; a write WITHOUT that declaration carries
      // legacy semantics, so if the stored doc is already v4 its level-3
      // leaves ("Must See") are mapped to 4 before merging. Both variants go
      // into ONE statement and SQL picks by the row's CURRENT version — no
      // read-then-write gap. (Codex P2 gate, finding 3.)
      const declaresV4 = req.body && req.body.sv === 4;
      const mapLegacyLevels = (data) => {
        if (declaresV4 || !data || !data.festivals) return data;
        const copy = JSON.parse(JSON.stringify(data));
        for (const entry of Object.values(copy.festivals || {})) {
          for (const byPerson of Object.values(entry?.selections || {})) {
            for (const [person, level] of Object.entries(byPerson)) {
              if (level === 3) byPerson[person] = 4;
            }
          }
        }
        return copy;
      };
      const incomingForV4 = mapLegacyLevels(incoming);

      // Merge is computed INLINE in the UPDATE (not via a CTE): when two
      // writes race, the second blocks on the row lock and then re-evaluates
      // against the winner's committed row, so `doc` here is always the
      // latest version. A CTE-based read would merge against a pre-lock
      // snapshot and lose the earlier write (verified: 2/6 concurrent merges
      // were lost with a CTE; 6/6 survive inline).
      // `meta.createdAt` and `v` need no SQL guard — validateIncoming rejects
      // both before we get here (v is only ever set by the migrate op above).
      const delta = JSON.stringify(incoming);
      const deltaV4 = JSON.stringify(incomingForV4);
      // The statement lives in api/_lib/crew-sql.mjs so that tests can execute
      // THESE EXACT BYTES against a real Postgres (tests/db-merge.test.mjs).
      // It used to be inline here, where nothing but production could reach it.
      const rows = await sql.query(MERGE_SQL, [token, deltaV4, delta, LIMITS.docBytes, LIMITS.activePeople]);
      if (rows.length) return res.status(200).json(rows[0].doc);

      // No row updated: the crew is gone, or one of the three invariants
      // refused the write. Ask WHICH — a blanket "would exceed limits" told a
      // person whose real problem was a duplicate name to go delete their picks.
      const exists = await sql`SELECT 1 FROM crews WHERE token = ${token}`;
      if (!exists.length) return res.status(404).json({ error: 'Crew not found' });

      const [why] = await sql.query(DIAGNOSE_SQL, [token, deltaV4, delta]);

      if (why && Number(why.dupes) > 0) {
        return res.status(400).json({ error: 'Someone in the crew already has that name — pick one that differs by more than capitalization' });
      }
      if (why && Number(why.active) > LIMITS.activePeople) {
        return res.status(413).json({ error: `This crew is full (${LIMITS.activePeople} people max)` });
      }
      return res.status(413).json({ error: `This crew's board is full (${LIMITS.docBytes} bytes max) — clearing some notes will make room` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('crew API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
