// Crew-scoped festival add via LLM lineup research (and its set times, when a
// published schedule prints them — _lib/festival-research.mjs).
//
//   POST /api/festival-add?t=<crew token>  {name}
//       -> Gemini (search-grounded) researches the festival, returns a
//          VALIDATED candidate doc + source URLs. NOTHING IS SAVED — the
//          client shows a preview the user must confirm (the human approval
//          gate; this endpoint reads untrusted web content, so LLM output is
//          data only, schema-validated, never executed or trusted).
//   POST /api/festival-add?t=<token>  {confirm: true, festival: {...}, sources?: []}
//       -> re-validates server-side, upserts into custom_festivals keyed
//          (token, fest id). Idempotent; retries safe.
//   GET  /api/festival-add?t=<token>
//       -> this crew's custom festivals (loader merges with the static catalog).
//
// Custom festivals are PRIVATE to the crew (no moderation surface); the repo's
// data/festivals/*.json stays canonical for shared festivals.
import { neon } from '@neondatabase/serverless';
import { rateLimited, crossSite, callGemini, GEMINI_MODEL } from './_lib/guard.mjs';
import { TOKEN_RE, LIMITS } from './_lib/crew-shared.mjs';
import { validateFestivalDoc, SLUG_RE } from './_lib/festival-rules.mjs';
import { researchPrompt, settleGrid } from './_lib/festival-research.mjs';

const NAME_RE = /^[^\x00-\x1f<>"'`\\]{2,80}$/;

// Extract the first top-level JSON object from grounded (prose-capable) output.
function extractJson(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = inStr; continue; }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (crossSite(req)) return res.status(403).json({ error: 'Cross-origin requests are not allowed' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'Store not configured' });

  const token = (req.query.t || '').toString();
  if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Missing or malformed crew token' });
  const sql = neon(process.env.DATABASE_URL);

  try {
    const crew = await sql`SELECT 1 FROM crews WHERE token = ${token}`;
    if (!crew.length) return res.status(404).json({ error: 'Crew not found' });

    if (req.method === 'GET') {
      const rows = await sql`SELECT doc, source_urls, created_at FROM custom_festivals WHERE token = ${token} ORDER BY created_at`;
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ festivals: rows.map((r) => r.doc) });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = req.body || {};

    // ---- confirm & save (idempotent upsert) ----
    if (body.confirm === true) {
      if (rateLimited(req, 'festival-save', 20, 60 * 60 * 1000)) return res.status(429).json({ error: 'Too many saves — try later' });
      const fest = body.festival;
      const { errors } = validateFestivalDoc(fest);
      if (errors.length) return res.status(400).json({ error: `Festival failed validation: ${errors[0]}` });
      if (!SLUG_RE.test(fest.id)) return res.status(400).json({ error: 'Bad festival id' });
      const bytes = Buffer.byteLength(JSON.stringify(fest), 'utf8');
      if (bytes > LIMITS.docBytes) return res.status(413).json({ error: 'Festival document too large' });
      const sources = Array.isArray(body.sources) ? body.sources.filter((s) => typeof s === 'string' && s.startsWith('http')).slice(0, 12) : [];
      const createdBy = typeof body.person === 'string' ? body.person.slice(0, LIMITS.personName) : null;
      await sql`
        INSERT INTO custom_festivals (token, fest_id, doc, source_urls, model, created_by)
        VALUES (${token}, ${fest.id}, ${JSON.stringify(fest)}::jsonb, ${JSON.stringify(sources)}::jsonb, ${GEMINI_MODEL}, ${createdBy})
        ON CONFLICT (token, fest_id) DO UPDATE SET doc = EXCLUDED.doc, source_urls = EXCLUDED.source_urls, updated_at = now()`;
      return res.status(200).json({ saved: true, id: fest.id });
    }

    // ---- research (preview only; nothing saved) ----
    if (rateLimited(req, 'festival-research', 5, 60 * 60 * 1000)) return res.status(429).json({ error: 'Research limit reached — try again in an hour' });
    const name = (body.name || '').toString().trim();
    if (!NAME_RE.test(name)) return res.status(400).json({ error: 'Give the festival a plausible name (2-80 characters)' });

    let result = await callGemini(researchPrompt(name), { grounded: true });
    if (result.error) return res.status(result.status).json({ error: result.error });
    let candidate = extractJson(result.text);
    // A full lineup plus a grid is a long reply. If it came back cut off or
    // unparseable, ask once more for the lineup alone (the pre-v118 ask), so
    // a big festival never does worse than it did before set times.
    if (!candidate) {
      result = await callGemini(researchPrompt(name, { grid: false }), { grounded: true });
      if (result.error) return res.status(result.status).json({ error: result.error });
      candidate = extractJson(result.text);
    }
    if (!candidate) return res.status(502).json({ error: 'Research returned no usable data — try again or add manually' });
    if (candidate.notFound) return res.status(404).json({ error: 'Could not find that festival', closest: (candidate.closest || []).slice(0, 5) });

    // A show's page and ticket links (and any price on them) are data a
    // person checked, never something research writes: a page the model read
    // could steer it to a look-alike ticket site or a stale price that would
    // then read "Tix $9" to the whole crew (the review of the links row,
    // 2026-09-25).
    for (const a of Array.isArray(candidate.artists) ? candidate.artists : []) {
      if (a && typeof a === 'object') { delete a.page; delete a.tickets; }
    }
    // A researched stage grid stands whole or falls back to the lineup, with
    // the reason riding along for the preview (_lib/festival-research.mjs).
    const { gridNote, added } = settleGrid(candidate);
    const { errors, warnings } = validateFestivalDoc(candidate);
    if (errors.length) return res.status(502).json({ error: `Research result failed validation: ${errors[0]}` });
    return res.status(200).json({ candidate, warnings, sources: result.sources || [], gridNote, added });
  } catch (error) {
    console.error('festival-add error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
