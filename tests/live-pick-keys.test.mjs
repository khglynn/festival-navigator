// Picks are keyed by the exact artists[] name, day notes by the exact day
// label, and the whole board by the festival id — and the crew doc cannot
// rename a key. So once a festival is live, those strings are load-bearing.
// tests/fixtures/live-pick-keys.json freezes them (scripts/freeze-pick-keys.mjs);
// this test — and scripts/validate-festivals.mjs in CI, through the same
// api/_lib/pick-keys.mjs — is the tripwire that turns "I tidied the
// capitalization" into a red build instead of a crew whose picks quietly
// vanished on set-times day (the Portola drop, 2026-08-27). It is written for
// the reader who has no memory of why: every failure message names the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frozenKeyProblems, freezeFestival, dayLabelsOf } from '../api/_lib/pick-keys.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/live-pick-keys.json'), 'utf8'));
const index = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const indexIds = new Set(index.map((f) => f.id));
const load = (id) => JSON.parse(readFileSync(join(ROOT, 'data', 'festivals', `${id}.json`), 'utf8'));

test('every live (non-archived) festival is frozen — a festival real people can pick in needs its keys protected', () => {
  const missing = index.filter((f) => f.status !== 'archived' && !fixture.festivals[f.id]).map((f) => f.id);
  assert.deepEqual(missing, [], `not frozen: ${missing.join(', ')} — run: node scripts/freeze-pick-keys.mjs ${missing.join(' ')}`);
});

for (const [id, frozen] of Object.entries(fixture.festivals)) {
  test(`${id}: every frozen key still exists byte-for-byte (${frozen.names.length} names, ${(frozen.days || []).length} day labels, frozen ${frozen.frozenAt})`, () => {
    const fest = load(id);
    assert.deepEqual(frozenKeyProblems(fest, frozen, { indexIds }), []);
    const live = new Set(fest.artists.map((a) => a.name));
    for (const [day, d] of Object.entries(fest.days || {})) {
      for (const a of d.artists || []) assert.ok(live.has(a.name), `${day}: grid name ${JSON.stringify(a.name)} is not an artists[] name`);
    }
  });
}

test('the freeze catches the three ways a data edit orphans crew data, and names the fix each time', () => {
  const fest = {
    id: 'x-2026', artists: [{ name: 'Overmono', day: 'Sunday' }, { name: 'Robyn', day: 'Saturday' }],
    days: { Saturday: { stages: ['S'], artists: [{ name: 'Robyn', stage: 'S', time: '9:00 PM' }] } },
  };
  const frozen = freezeFestival(fest, '2026-08-27');
  assert.deepEqual(frozen, { frozenAt: '2026-08-27', id: 'x-2026', names: ['Overmono', 'Robyn'], days: ['Saturday', 'Sunday'] });
  assert.deepEqual(frozenKeyProblems(fest, frozen, { indexIds: new Set(['x-2026']) }), [], 'unchanged file is clean');

  const caseDrift = { ...fest, artists: [{ name: 'overmono', day: 'Sunday' }, { name: 'Robyn', day: 'Saturday' }] };
  const p1 = frozenKeyProblems(caseDrift, frozen);
  assert.equal(p1.length, 1);
  assert.match(p1[0], /"Overmono" is now spelled "overmono"/);

  const removed = { ...fest, artists: [{ name: 'Robyn', day: 'Saturday' }] };
  const p2 = frozenKeyProblems(removed, frozen);
  assert.match(p2[0], /"Overmono" was removed or renamed/);
  assert.match(p2[0], /live-pick-keys\.json/, 'the message names the sanctioned fix');

  const dayRenamed = { ...fest, artists: [{ name: 'Overmono', day: 'Sun' }, { name: 'Robyn', day: 'Saturday' }] };
  const p3 = frozenKeyProblems(dayRenamed, frozen);
  assert.match(p3[0], /day label "Sunday" no longer exists/);

  const idRenamed = { ...fest, id: 'x-2027' };
  const p4 = frozenKeyProblems(idRenamed, frozen, { indexIds: new Set(['x-2027']) });
  assert.match(p4[0], /festival id changed/);
  assert.match(p4[1], /no longer listed in index\.json/);
});

test('day labels: atomic values, the parts of a combined label, and grid keys all count', () => {
  assert.deepEqual(dayLabelsOf({
    artists: [{ name: 'A', day: 'Saturday & Sunday' }, { name: 'B', day: 'Afters' }, { name: 'C' }],
    days: { Saturday: { stages: [], artists: [] } },
  }), ['Afters', 'Saturday', 'Saturday & Sunday', 'Sunday']);
});
