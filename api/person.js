// Person store — one row per person, across crews (the "me link").
//
//   POST /api/person   {name}                 no X-Person-Token -> create, returns {token, id, doc}
//   GET  /api/person   X-Person-Token: <t>                      -> {id, doc}
//   POST /api/person   X-Person-Token: <t>   {data: <partial>}  -> validated deep-merge, returns {id, doc}
//
// Two identifiers, deliberately: the token is the credential (its doc lists
// every crew token the person is in — a master key, shared with nobody); the
// id is public and is what crew docs may reference (people.<Name>.pid). All
// lookups here go by token — the id is never an access path.
//
// The token travels in a HEADER, never a query param — unlike crew tokens
// (whose ?t= exposure is scoped to one crew), this one unlocks everything the
// person is in, and query strings land in platform logs and proxies (Codex
// gate, P1). There are no legacy clients to humor: header-only from birth.
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import {
  newPersonDoc, validatePersonIncoming, LIMITS, TOKEN_RE,
} from './_lib/crew-shared.mjs';
import { rateLimited, crossSite } from './_lib/guard.mjs';
import { PERSON_MERGE_SQL } from './_lib/crew-sql.mjs';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (crossSite(req)) return res.status(403).json({ error: 'Cross-origin requests are not allowed' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'Store not configured (DATABASE_URL missing)' });

  const sql = neon(process.env.DATABASE_URL);

  try {
    const token = (req.headers['x-person-token'] || '').toString();

    // ---- create ----
    if (req.method === 'POST' && !token) {
      if (rateLimited(req, 'person-create', 10, 60 * 60 * 1000)) return res.status(429).json({ error: 'Too many links created — try again later' });
      const body = req.body || {};
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const check = validatePersonIncoming({ name });
      if (!check.ok) return res.status(400).json({ error: check.error });
      const newToken = crypto.randomBytes(20).toString('base64url');
      const id = crypto.randomBytes(9).toString('base64url'); // 12 chars, public
      const doc = newPersonDoc(name, new Date().toISOString());
      await sql`INSERT INTO persons (id, token, doc) VALUES (${id}, ${newToken}, ${JSON.stringify(doc)}::jsonb)`;
      return res.status(201).json({ token: newToken, id, doc });
    }

    if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Missing or malformed link' });

    // ---- read ----
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, doc FROM persons WHERE token = ${token}`;
      if (!rows.length) return res.status(404).json({ error: 'Link not found' });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ id: rows[0].id, doc: rows[0].doc });
    }

    // ---- merge write (single atomic statement, size cap inside) ----
    if (req.method === 'POST') {
      const incoming = req.body && req.body.data;
      const check = validatePersonIncoming(incoming);
      if (!check.ok) return res.status(400).json({ error: check.error });
      const rows = await sql.query(PERSON_MERGE_SQL, [token, JSON.stringify(incoming), LIMITS.personDocBytes]);
      if (rows.length) return res.status(200).json({ id: rows[0].id, doc: rows[0].doc });
      const exists = await sql`SELECT 1 FROM persons WHERE token = ${token}`;
      if (!exists.length) return res.status(404).json({ error: 'Link not found' });
      return res.status(413).json({ error: 'This link is full — that should not happen; tell Kevin' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('person API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
