// This Edge Function runs on Vercel's servers, keeping your API key secret
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // Enable CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { artistName } = await request.json();
    
    if (!artistName) {
      return new Response(JSON.stringify({ error: 'Artist name required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Your API key is stored as an environment variable in Vercel
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prompt = `You are a music festival expert. Provide an exciting 3-4 sentence summary about "${artistName}" including:
    1. Their music genre/style
    2. What their live performances are known for
    3. Why festival-goers should see them
    Keep it enthusiastic and informative. Format as simple HTML with <p> tags only.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }]
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Gemini API request failed');
    }

    const data = await response.json();
    const artistInfo = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ artistInfo }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=3600', // Cache for 1 hour to reduce API calls
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get artist info' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}