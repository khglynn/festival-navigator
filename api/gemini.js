// Generic server-side Gemini call (keeps the API key secret, no per-user setup).
// POST { prompt } -> { text }. Used by the Group Plan Optimizer (and any future AI tool).
export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { prompt } = await request.json();
    if (!prompt || typeof prompt !== 'string' || prompt.length > 6000) {
      return json({ error: 'Missing or invalid `prompt`' }, 400);
    }
    const KEY = process.env.GEMINI_API_KEY;
    if (!KEY) return json({ error: 'API key not configured' }, 500);

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      }
    );
    if (!r.ok) throw new Error('Gemini request failed: ' + r.status);
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return json({ text });
  } catch (error) {
    return json({ error: 'Failed to generate', details: String(error) }, 500);
  }
}
