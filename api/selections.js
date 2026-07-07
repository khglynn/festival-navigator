// RETIRED (2026-07-07): the global shared store was replaced by per-crew
// documents (api/crew.js). The legacy blob's data was migrated into a crew
// via scripts/migrate-legacy.mjs. Old cached clients hitting this endpoint
// get a clear signal instead of silently diverging; their local picks are
// safe in localStorage and re-sync once the updated app shell loads.
export default async function handler(req, res) {
  return res.status(410).json({
    error: 'This endpoint has been retired. Reload the app to get the crew-based version.',
  });
}
