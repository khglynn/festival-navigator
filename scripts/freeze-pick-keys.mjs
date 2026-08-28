#!/usr/bin/env node
// Freeze the strings a crew's data hangs off — festival id, exact artist
// names, exact day labels — so a later edit cannot rename one by accident.
// Why: the doc model has no rename path (additive merge never deletes), so a
// "tidy-up" of capitalization at set-times time orphans every pick under
// that name for every crew. tests/live-pick-keys.test.mjs and
// scripts/validate-festivals.mjs (CI) both fail when a frozen string goes
// missing; the message says what the sanctioned fix is.
//
//   node scripts/freeze-pick-keys.mjs <festival-id> [...more ids]
//   node scripts/freeze-pick-keys.mjs --all-live     # every non-archived festival
//
// Run it when a festival goes live for a crew, and again after any publish
// that ADDS names or days. It only ever ADDS to the snapshot: it refuses to
// drop a previously frozen string — that is a deliberate hand edit to the
// fixture (the "accept the orphaning knowingly" moment docs/add-a-festival.md
// describes), made visible in the diff.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freezeFestival } from '../api/_lib/pick-keys.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = join(ROOT, 'tests', 'fixtures', 'live-pick-keys.json');
const DATA = join(ROOT, 'data', 'festivals');

let ids = process.argv.slice(2);
if (ids.includes('--all-live')) {
  const index = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
  ids = index.filter((f) => f.status !== 'archived').map((f) => f.id);
}
if (!ids.length) {
  console.error('usage: node scripts/freeze-pick-keys.mjs <festival-id> [...]  |  --all-live');
  process.exit(2);
}

let fixture;
try { fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')); } catch { fixture = { festivals: {} } }
fixture._readme = 'Frozen pick keys per live festival: the id, every artist name, every day label. Each must still exist in data/festivals/<id>.json byte-for-byte, or the validator and tests/live-pick-keys.test.mjs fail. Every non-archived festival in index.json must have an entry. Regenerate with `node scripts/freeze-pick-keys.mjs <id>` (or --all-live); removing a string by hand is a deliberate decision to orphan the picks/notes under it.';
fixture.festivals = fixture.festivals || {};

const today = new Date().toISOString().slice(0, 10);
let refused = false;
for (const id of ids) {
  const fest = JSON.parse(readFileSync(join(DATA, `${id}.json`), 'utf8'));
  const next = freezeFestival(fest, today);
  const prev = fixture.festivals[id] || { names: [], days: [] };
  const gone = [
    ...prev.names.filter((n) => !next.names.includes(n)).map((n) => `artist ${JSON.stringify(n)}`),
    ...(prev.days || []).filter((d) => !next.days.includes(d)).map((d) => `day ${JSON.stringify(d)}`),
  ];
  if (gone.length) {
    console.error(`${id}: refusing to drop previously frozen ${gone.join(', ')}`);
    console.error('  A rename orphans every pick or note under the old string. If you mean it, edit tests/fixtures/live-pick-keys.json by hand — that edit is the decision.');
    refused = true;
    continue;
  }
  fixture.festivals[id] = next;
  console.log(`${id}: froze ${next.names.length} names, ${next.days.length} day labels (${next.names.length - prev.names.length} new names)`);
}
writeFileSync(FIXTURE, JSON.stringify(fixture, null, 2) + '\n');
process.exit(refused ? 1 : 0);
