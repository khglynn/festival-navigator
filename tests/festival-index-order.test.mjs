// The catalog's order IS the default festival (docs/add-a-festival.md: "keep it
// ordered by date, archived last — the first non-archived entry is the
// default"). defaultFestivalId() reads that order and no clock, so an index
// left out of order quietly hands every newcomer the wrong festival. That
// happened in the off-season (v116, 2026-10-19): Portola and ACL were over but
// still "scheduled", so a fresh crew opened on Portola.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));

test('index.json: upcoming festivals first and soonest first, then archived ones, most recent first', () => {
  const firstPast = index.findIndex((f) => f.status === 'archived');
  const live = firstPast === -1 ? index : index.slice(0, firstPast);
  const past = firstPast === -1 ? [] : index.slice(firstPast);
  assert.ok(past.every((f) => f.status === 'archived'), `a live festival sits among the archived ones: ${past.filter((f) => f.status !== 'archived').map((f) => f.id).join(', ')}`);
  const asc = live.map((f) => f.startsOn);
  assert.deepEqual(asc, [...asc].sort(), 'upcoming festivals in date order');
  const desc = past.map((f) => f.startsOn);
  assert.deepEqual(desc, [...desc].sort().reverse(), 'archived festivals most recent first');
});

test('the default festival is the soonest one that has not been archived', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => structuredClone(index) });
  const { loadFestivalIndex, defaultFestivalId } = await import('../js/festivals.js');
  try { await loadFestivalIndex(); } finally { globalThis.fetch = realFetch; }
  const soonest = index.filter((f) => f.status !== 'archived').sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0];
  assert.equal(defaultFestivalId(), soonest.id);
});
