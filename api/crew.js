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
  deepMerge, newCrewDoc, validateIncoming, LIMITS, TOKEN_RE,
} from './_lib/crew-shared.mjs';
import { rateLimited, crossSite } from './_lib/guard.mjs';


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
      const seed = { meta: { name }, ...(body.people ? { people: body.people } : {}) };
      const check = validateIncoming(seed);
      if (!check.ok) return res.status(400).json({ error: check.error });

      const newToken = crypto.randomBytes(20).toString('base64url');
      const doc = deepMerge(newCrewDoc(name, new Date().toISOString()), body.people ? { people: body.people } : {});
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

    // ---- merge write (single atomic statement; invariants inside) ----
    if (req.method === 'POST') {
      const incoming = req.body && req.body.data;
      const check = validateIncoming(incoming);
      if (!check.ok) return res.status(400).json({ error: check.error });

      // Merge is computed INLINE in the UPDATE (not via a CTE): when two
      // writes race, the second blocks on the row lock and then re-evaluates
      // against the winner's committed row, so `doc` here is always the
      // latest version. A CTE-based read would merge against a pre-lock
      // snapshot and lose the earlier write (verified: 2/6 concurrent merges
      // were lost with a CTE; 6/6 survive inline).
      // `v` and `meta.createdAt` need no SQL guard — validateIncoming
      // rejects both before we get here.
      const delta = JSON.stringify(incoming);
      const rows = await sql`
        UPDATE crews
        SET doc = jsonb_deep_merge(doc, ${delta}::jsonb), updated_at = now()
        WHERE token = ${token}
          AND octet_length(jsonb_deep_merge(doc, ${delta}::jsonb)::text) <= ${LIMITS.docBytes}
          AND (SELECT count(*)
               FROM jsonb_each(COALESCE(jsonb_deep_merge(doc, ${delta}::jsonb)->'people', '{}'::jsonb)) p
               WHERE NOT COALESCE((p.value->>'removed')::boolean, false)) <= ${LIMITS.activePeople}
        RETURNING doc`;
      if (rows.length) return res.status(200).json(rows[0].doc);

      // No row updated: either the crew doesn't exist or an invariant tripped.
      const exists = await sql`SELECT 1 FROM crews WHERE token = ${token}`;
      if (!exists.length) return res.status(404).json({ error: 'Crew not found' });
      return res.status(413).json({ error: `Crew document would exceed limits (${LIMITS.docBytes} bytes / ${LIMITS.activePeople} active people)` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('crew API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
