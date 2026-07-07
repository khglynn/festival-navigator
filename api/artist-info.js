// Artist blurbs (server key so users need no setup). Bounded input, per-IP
// rate limit, and a CDN cache per artist so repeat taps cost nothing.
// POST { artistName } -> { artistInfo }
import { rateLimited, crossSite, callGemini } from './_lib/guard.mjs';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (crossSite(req)) return res.status(403).json({ error: 'Cross-origin requests are not allowed' });
  if (rateLimited(req, 'artist-info', 30, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Slow down a little — try again in a few minutes' });
  }

  const artistName = req.body && req.body.artistName;
  if (!artistName || typeof artistName !== 'string' || artistName.length > 100 || /[\x00-\x1f]/.test(artistName)) {
    return res.status(400).json({ error: 'Invalid artist name' });
  }

  const prompt = `You are a music festival expert. Provide an exciting 3-4 sentence summary about "${artistName}" including:
    1. Their music genre/style
    2. What their live performances are known for
    3. Why festival-goers should see them
    Keep it enthusiastic and informative. Format as simple HTML with <p> tags only.`;

  try {
    const result = await callGemini(prompt);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.setHeader('Cache-Control', 's-maxage=3600'); // repeat taps on the same artist hit the CDN
    return res.status(200).json({ artistInfo: result.text });
  } catch (error) {
    console.error('artist-info error:', error);
    return res.status(500).json({ error: 'Failed to get artist info' });
  }
}
