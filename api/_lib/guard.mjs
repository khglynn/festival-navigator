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

export async function callGemini(promptText) {
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return { error: 'API key not configured', status: 500 };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: promptText }] }] }),
    }
  );
  if (!r.ok) return { error: 'Gemini request failed: ' + r.status, status: 502 };
  const data = await r.json();
  return { text: data?.candidates?.[0]?.content?.parts?.[0]?.text || '' };
}
