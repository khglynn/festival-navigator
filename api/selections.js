export default async function handler(req, res) {
  // Enable CORS for frontend requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // For Vercel Blob, we'll use the @vercel/blob package
  const { put, list, del } = await import('@vercel/blob');
  
  const BLOB_FILENAME = 'festival-selections.json';

  try {
    if (req.method === 'GET') {
      // Get current selections from Blob
      try {
        const { blobs } = await list();
        const existingBlob = blobs.find(blob => blob.pathname === BLOB_FILENAME);
        
        if (existingBlob) {
          // Fetch the blob content
          const response = await fetch(existingBlob.url);
          const data = await response.json();
          return res.status(200).json(data);
        } else {
          // No data yet, return empty object
          return res.status(200).json({});
        }
      } catch (error) {
        console.error('Error reading blob:', error);
        return res.status(200).json({});
      }
    }
    
    if (req.method === 'POST') {
      // Update selections in Blob
      const { artistSelections } = req.body;
      
      if (!artistSelections) {
        return res.status(400).json({ error: 'Missing artistSelections data' });
      }

      // Delete old blob if exists
      try {
        const { blobs } = await list();
        const existingBlob = blobs.find(blob => blob.pathname === BLOB_FILENAME);
        if (existingBlob) {
          await del(existingBlob.url);
        }
      } catch (error) {
        console.error('Error deleting old blob:', error);
      }

      // Store the new selections
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
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}