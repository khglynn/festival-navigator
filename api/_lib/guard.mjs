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

export async function callGemini(promptText, { grounded = false } = {}) {
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return { error: 'API key not configured', status: 500 };
  const body = { contents: [{ role: 'user', parts: [{ text: promptText }] }] };
  // Google-search grounding: the model cites live web sources. NOTE: cannot
  // be combined with responseMimeType JSON — grounded callers parse JSON out
  // of the text themselves and validate hard.
  if (grounded) body.tools = [{ google_search: {} }];
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!r.ok) return { error: 'Gemini request failed: ' + r.status, status: 502 };
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
