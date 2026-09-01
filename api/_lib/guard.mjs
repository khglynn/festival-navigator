// Shared request guards for the API endpoints.
//
// Rate limiting here is per serverless instance (instances are ephemeral), so
// it is a speed bump against casual abuse, not a hard wall — acceptable for a
// hobby deployment where the worst case is a burned Gemini free-tier quota.

const buckets = new Map(); // `${bucket}:${ip}` -> {count, since}

export function rateLimited(req, bucket, max, windowMs) {
  const ip = (req.headers['x-forwarded-for'] || 'unknown').toString().split(',')[0].trim();
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const rec = buckets.get(key) || { count: 0, since: now };
  if (now - rec.since > windowMs) { rec.count = 0; rec.since = now; }
  rec.count++;
  buckets.set(key, rec);
  return rec.count > max;
}

// Browser cross-site JS is refused; requests without an Origin header (curl,
// same-origin GETs in some browsers) pass.
export function crossSite(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).host !== req.headers.host; } catch { return true; }
}

// Pinned models rot: this file pinned `gemini-2.5-flash`, which Google is
// retiring — generateContent already 404s for NEW keys while ListModels still
// shows the name (listing is not access), and the changelog shuts it down for
// everyone on 2026-10-16. A floating alias cannot decay the same way, and this
// caller is safe for one: nothing it returns is saved without a human
// confirming it on screen. The catch, the alias and the error surfacing below
// are lifted from Ray Perfetti's fork (raypp2/festival-navigator) — he paid
// for this knowledge with a long debug session.
export const GEMINI_MODEL = 'gemini-flash-latest';

export async function callGemini(promptText, { grounded = false } = {}) {
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return { error: 'API key not configured', status: 500 };
  const body = { contents: [{ role: 'user', parts: [{ text: promptText }] }] };
  // Google-search grounding: the model cites live web sources. NOTE: cannot
  // be combined with responseMimeType JSON — grounded callers parse JSON out
  // of the text themselves and validate hard.
  //
  // RATE LIMITS (Ray's field note, 2026-07-24): grounding works on the free
  // tier, but grounded calls trip its limits first — a burst can answer 429
  // "check your plan and billing details", which reads as a billing wall and
  // is not one. The endpoint's own 5/hour rate limit spaces real users out.
  if (grounded) body.tools = [{ google_search: {} }];
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  // Surface WHICH failure: 404 = model retired/renamed, 429 = quota, 400/403
  // = key. A bare "Gemini request failed: 404" reads as "key is wrong" and
  // cost Ray a long debug session before it cost us one.
  if (!r.ok) {
    let detail = '';
    try {
      const j = await r.json();
      const st = j?.error?.status;
      if (r.status === 404) detail = ' — model unavailable to this key; update GEMINI_MODEL';
      else if (r.status === 429) detail = ' — quota exceeded; grounded calls trip free-tier limits first';
      else if (st) detail = ' — ' + st;
    } catch { /* non-JSON body */ }
    return { error: 'Gemini request failed: ' + r.status + detail, status: 502 };
  }
  const data = await r.json();
  const cand = data?.candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text || '').join('') || '';
  // Grounding metadata -> source URLs (provenance travels with the value).
  // Checked across known response shapes (audit 5.1: live runs returned zero
  // sources) — groundingChunks is current, citationSources is the older
  // shape; the UI now also says out loud when NOTHING comes back.
  const chunks = cand?.groundingMetadata?.groundingChunks
    || cand?.groundingMetadata?.groundingAttributions
    || [];
  const cites = cand?.citationMetadata?.citationSources || [];
  const sources = [
    ...chunks.map((c) => c?.web?.uri || c?.sourceId?.web?.uri),
    ...cites.map((c) => c?.uri),
  ].filter(Boolean).slice(0, 12);
  return { text, sources };
}
