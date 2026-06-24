// Shared festival data store backed by Vercel Blob.
// GET  -> returns the whole document: { [festivalId]: { people, selections } }
// POST -> { data } is DEEP-MERGED into the stored document (so two people
//         editing at once never clobber each other) and the merged result
//         is returned.

const BLOB_FILENAME = 'festival-data-v2.json';

// Deep merge where the incoming `overlay` wins at the leaf level.
function deepMerge(base, overlay) {
  if (overlay === undefined || overlay === null) return base;
  if (typeof overlay !== 'object') return overlay;
  const out = (base && typeof base === 'object' && !Array.isArray(base)) ? { ...base } : {};
  for (const k in overlay) out[k] = deepMerge(out[k], overlay[k]);
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { put, list, del } = await import('@vercel/blob');

  async function readStore() {
    try {
      const { blobs } = await list();
      const existing = blobs.find(b => b.pathname === BLOB_FILENAME);
      if (!existing) return {};
      const r = await fetch(existing.url, { cache: 'no-store' });
      return await r.json();
    } catch (e) {
      console.error('readStore error:', e);
      return {};
    }
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await readStore());
    }

    if (req.method === 'POST') {
      const incoming = req.body && req.body.data;
      if (!incoming || typeof incoming !== 'object') {
        return res.status(400).json({ error: 'Missing or invalid `data`' });
      }
      const current = await readStore();
      const merged = deepMerge(current, incoming);

      // Replace the blob with the merged document.
      try {
        const { blobs } = await list();
        const existing = blobs.find(b => b.pathname === BLOB_FILENAME);
        if (existing) await del(existing.url);
      } catch (e) { console.error('del error:', e); }

      await put(BLOB_FILENAME, JSON.stringify(merged), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      });

      return res.status(200).json(merged);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
