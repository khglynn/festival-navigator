#!/usr/bin/env node
// One-time migration: legacy global store (festival-data-v2.json via
// /api/selections) -> a v3 crew document (via /api/crew).
//
// Run against a server that has blob credentials (local `vercel dev` or the
// preview deploy):
//   node scripts/migrate-legacy.mjs --base http://localhost:3111 [--name "The Crew"] [--dry-run]
//
// Cleanups performed (deliberate, verified against the live doc before write):
//   - electric-forest-2025 id -> electric-forest-2026 (the id always held 2026
//     data; the crew doc is a fresh namespace so the remap is finally safe)
//   - tombstoned people dropped; their selections dropped
//   - level-0 selection leaves dropped (they only existed to sync removals)
//   - Kevin's static Spotify affinity snapshot imported as affinity.Kevin
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return dflt;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
const BASE = flag('base', 'http://localhost:3111');
const CREW_NAME = flag('name', 'The Crew');
const DRY = !!flag('dry-run', false);
const ID_REMAP = { 'electric-forest-2025': 'electric-forest-2026' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Kevin's static affinity snapshot (window.SPOTIFY_AFFINITY assignment).
function loadLegacyAffinity() {
  const src = readFileSync(join(root, 'data', 'spotify-affinity.js'), 'utf8');
  const m = src.match(/window\.SPOTIFY_AFFINITY\s*=\s*(\{.*?\});/s);
  if (!m) return {};
  const parsed = JSON.parse(m[1]);
  const out = {};
  for (const [artist, aff] of Object.entries(parsed)) {
    out[artist] = {};
    if (aff.followed) out[artist].followed = true;
    if (aff.songs) out[artist].songs = aff.songs;
  }
  return out;
}

// Read the legacy doc straight from the OLD public blob store (the legacy
// /api/selections endpoint is retired). Token comes from the pre-rewire
// snapshot: --legacy-env .env.legacy-snapshot
const legacyEnvFile = flag('legacy-env', join(root, '.env.legacy-snapshot'));
const legacyToken = readFileSync(legacyEnvFile, 'utf8').match(/BLOB_READ_WRITE_TOKEN="?(vercel_blob_rw_[A-Za-z0-9_]+)"?/)?.[1];
if (!legacyToken) { console.error(`No legacy BLOB_READ_WRITE_TOKEN in ${legacyEnvFile}`); process.exit(1); }
const { list } = await import('@vercel/blob');
const { blobs } = await list({ token: legacyToken });
const legacyBlob = blobs.find((b) => b.pathname === 'festival-data-v2.json');
if (!legacyBlob) { console.error('festival-data-v2.json not found in legacy store'); process.exit(1); }
const legacy = await (await fetch(legacyBlob.url, { cache: 'no-store' })).json();
console.log(`Legacy store: ${Object.keys(legacy).length} festival(s): ${Object.keys(legacy).join(', ')}`);

// People: union across festivals, tombstones dropped, first color wins.
const people = {};
const festivals = {};
for (const [fid, entry] of Object.entries(legacy)) {
  const newFid = ID_REMAP[fid] || fid;
  const activeNames = new Set();
  for (const [name, p] of Object.entries(entry.people || {})) {
    if (!p || p.removed) continue;
    activeNames.add(name);
    if (!people[name]) people[name] = { color: p.color };
  }
  const selections = {};
  for (const [artist, byPerson] of Object.entries(entry.selections || {})) {
    for (const [person, level] of Object.entries(byPerson || {})) {
      if (!activeNames.has(person)) continue;
      if (!Number.isInteger(level) || level < 1 || level > 3) continue;
      (selections[artist] = selections[artist] || {})[person] = level;
    }
  }
  if (Object.keys(selections).length) festivals[newFid] = { selections };
}

const affinity = { Kevin: loadLegacyAffinity() };

const stats = {
  people: Object.keys(people).length,
  festivals: Object.keys(festivals).map((f) => `${f}(${Object.keys(festivals[f].selections).length} artists)`),
  kevinAffinityArtists: Object.keys(affinity.Kevin).length,
};
console.log('Crew doc to create:', JSON.stringify(stats, null, 2));

if (DRY) { console.log('--dry-run: not writing.'); process.exit(0); }

const createRes = await fetch(`${BASE}/api/crew`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: CREW_NAME, people }),
});
if (!createRes.ok) { console.error('create failed:', createRes.status, await createRes.text()); process.exit(1); }
const { token } = await createRes.json();

const mergeRes = await fetch(`${BASE}/api/crew?t=${token}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: { festivals, affinity } }),
});
if (!mergeRes.ok) { console.error('merge failed:', mergeRes.status, await mergeRes.text()); process.exit(1); }
const doc = await mergeRes.json();

// Verify: every migrated selection survived byte-for-byte.
let checked = 0;
for (const [fid, entry] of Object.entries(festivals)) {
  for (const [artist, byPerson] of Object.entries(entry.selections)) {
    for (const [person, level] of Object.entries(byPerson)) {
      if (doc.festivals?.[fid]?.selections?.[artist]?.[person] !== level) {
        console.error(`❌ VERIFY FAILED: ${fid}/${artist}/${person} expected ${level}`);
        process.exit(1);
      }
      checked++;
    }
  }
}
console.log(`✅ Crew created and verified (${checked} selection leaves match).`);
console.log(`\nCrew link: ${BASE}/#g=${token}`);
console.log('Share that link with the crew. Production link uses the real domain + same token.');
