#!/usr/bin/env node
// Freeze a live festival's artist names so a later edit can't silently rename
// one. Picks, auras and notes are keyed by the EXACT artists[] name, and the
// crew doc has no rename path (additive merge can't delete the old key) — so
// a "tidy-up" of capitalization at set-times time orphans every pick under
// that name. tests/live-pick-keys.test.mjs asserts every frozen name still
// exists, byte for byte.
//
//   node scripts/freeze-pick-keys.mjs <festival-id> [...more ids]
//
// Run it the moment a festival goes live for a crew (and again after any
// publish that ADDS names). A rename you truly mean is a deliberate edit to
// the fixture — that edit is the "accept the orphaning knowingly" moment
// docs/add-a-festival.md talks about, made visible in the diff.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = join(ROOT, 'tests', 'fixtures', 'live-pick-keys.json');

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('usage: node scripts/freeze-pick-keys.mjs <festival-id> [...]');
  process.exit(2);
}

let fixture;
try { fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')); } catch { fixture = { _readme: '', festivals: {} }; }
fixture._readme = 'Frozen artist names per live festival. Every name listed here must exist in data/festivals/<id>.json artists[] byte-for-byte, or tests/live-pick-keys.test.mjs fails. Regenerate with scripts/freeze-pick-keys.mjs; removing a name is a deliberate decision to orphan its picks.';

for (const id of ids) {
  const fest = JSON.parse(readFileSync(join(ROOT, 'data', 'festivals', `${id}.json`), 'utf8'));
  const names = [...new Set((fest.artists || []).map((a) => a && a.name).filter(Boolean))].sort();
  const prev = (fixture.festivals[id] && fixture.festivals[id].names) || [];
  const gone = prev.filter((n) => !names.includes(n));
  if (gone.length) {
    console.error(`${id}: refusing to drop ${gone.length} previously frozen name(s): ${gone.join(', ')}`);
    console.error('If the rename is intended, edit tests/fixtures/live-pick-keys.json by hand — that edit is the decision.');
    process.exit(1);
  }
  fixture.festivals[id] = { frozenAt: new Date().toISOString().slice(0, 10), names };
  console.log(`${id}: froze ${names.length} names (${names.length - prev.length} new)`);
}
writeFileSync(FIXTURE, JSON.stringify(fixture, null, 2) + '\n');
