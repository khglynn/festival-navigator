// Picks are keyed by the exact artists[] name and the crew doc cannot rename a
// key — so once a festival is live for a crew, every artist name in its file
// is load-bearing. tests/fixtures/live-pick-keys.json freezes those names
// (scripts/freeze-pick-keys.mjs); this test is the tripwire that turns "I
// tidied the capitalization" into a red CI instead of a crew whose picks
// quietly vanished on set-times day (the Portola drop, 2026-08-27).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/live-pick-keys.json'), 'utf8'));

for (const [id, frozen] of Object.entries(fixture.festivals)) {
  test(`${id}: every frozen artist name still exists byte-for-byte (${frozen.names.length} names, frozen ${frozen.frozenAt})`, () => {
    const fest = JSON.parse(readFileSync(join(ROOT, 'data', 'festivals', `${id}.json`), 'utf8'));
    const live = new Set((fest.artists || []).map((a) => a && a.name));
    const gone = frozen.names.filter((n) => !live.has(n));
    // Name the near-miss when there is one: a case-only drift is the classic
    // way this breaks, and the message should say so.
    const lower = new Map([...live].map((n) => [n.toLowerCase(), n]));
    const detail = gone.map((n) => (lower.has(n.toLowerCase()) ? `${n} (now spelled ${JSON.stringify(lower.get(n.toLowerCase()))})` : n));
    assert.deepEqual(gone, [], `renamed or removed — picks under these names would orphan: ${detail.join(', ')}`);
    // Grid names are lineup names (the validator enforces it too) — repeated
    // here so a fixture-covered fest fails HERE with the name spelled out.
    for (const [day, d] of Object.entries(fest.days || {})) {
      for (const a of d.artists || []) assert.ok(live.has(a.name), `${day}: grid name ${JSON.stringify(a.name)} is not an artists[] name`);
    }
  });
}

test('the fixture covers the festivals KNOWN to have live picks as of 2026-08-27 (a hand-kept list — extend it when a fest goes live)', () => {
  // Festivals a crew has picks in are the ones whose names are load-bearing.
  // This list is hand-maintained from the crew store (36 crews, 2026-08-27);
  // it cannot notice a NEW live festival on its own — add the id here and run
  // scripts/freeze-pick-keys.mjs the day real people start picking there.
  const LIVE = ['portola-2026'];
  for (const id of LIVE) assert.ok(fixture.festivals[id], `${id} has live picks but no frozen names — run scripts/freeze-pick-keys.mjs ${id}`);
});
