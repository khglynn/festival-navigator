import { put, head } from '@vercel/blob';

// API endpoint to handle artist selections
export default async function handler(req, res) {
  // Enable CORS for frontend requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const BLOB_FILENAME = 'festival-selections.json';

  try {
    if (req.method === 'GET') {
      // Get current selections
      try {
        const response = await fetch(`${process.env.BLOB_READ_WRITE_TOKEN}/${BLOB_FILENAME}`);
        if (response.ok) {
          const data = await response.json();
          return res.status(200).json(data);
        } else {
          // File doesn't exist yet, return empty selections
          return res.status(200).json({});
        }
      } catch (error) {
        // File doesn't exist, return empty selections
        return res.status(200).json({});
      }
    }
    
    if (req.method === 'POST') {
      // Update selections
      const { artistSelections } = req.body;
      
      if (!artistSelections) {
        return res.status(400).json({ error: 'Missing artistSelections data' });
      }

      // Store the selections as JSON in Vercel Blob
      const blob = await put(BLOB_FILENAME, JSON.stringify(artistSelections), {
        access: 'public',
        contentType: 'application/json',
      });

      return res.status(200).json({ 
        success: true, 
        url: blob.url,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}