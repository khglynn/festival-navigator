// Short, tight festival names (Kevin, 2026-10-03: "For ACL we can just say
// 'ACL' with the year not ACL music festival. Music festival is implied lol.
// Pretty much all our fests should have short tight names"). The header
// shows the name with the year beside it ("ACL '26"), and the name rides
// into the room heads, the Share's first line, the toasts and the link
// previews — so it is the name people say, never the poster's full title.
//
// The rule (api/_lib/festival-rules.mjs festNameProblems): at most 20
// characters, and never ending in "Festival". The curated-file validator
// (scripts/validate-festivals.mjs, run by CI) holds it, and holds each
// file's name equal to its index.json entry's — the landing reads one, the
// wall the other; that the validator fails on both is
// tests/data-guards.test.mjs's, against a copy of the repo. Display only: a
// festival's name is no pick key (the freeze,
// tests/fixtures/live-pick-keys.json, holds ids, artist names and day
// labels), so renaming one moves nobody's picks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { festNameProblems, FEST_NAME_MAX } from '../api/_lib/festival-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'data', 'festivals');
const INDEX = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));
const fileOf = (id) => JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8'));

test('the rule: the name people say — 20 characters at most, and never "… Festival"', () => {
  assert.equal(FEST_NAME_MAX, 20);
  for (const ok of ['ACL', 'Seismic', 'Portola', 'EDC Orlando', 'Tomorrowland Winter', 'Outside Lands', 'Festival d’Été']) {
    assert.deepEqual(festNameProblems(ok), [], `${ok} is short and tight`);
  }
  const acl = festNameProblems('ACL Music Festival');
  assert.equal(acl.length, 1, 'ACL Music Festival: 18 characters, but the festival is implied');
  assert.match(acl[0], /ends in "Festival"/);
  const seismic = festNameProblems('Seismic Dance Event 9.0');
  assert.equal(seismic.length, 1);
  assert.match(seismic[0], /23 chars/, 'over the cap, and it says by how much');
  assert.equal(festNameProblems('Outside Lands Music and Arts Festival').length, 2, 'too long and a "Festival" both');
  assert.equal(festNameProblems('Lost Lands festival ').length, 1, 'any case, a stray space');
  assert.deepEqual(festNameProblems(''), [], 'a missing name is the schema’s error, said once (validateFestivalDoc)');
  assert.deepEqual(festNameProblems(undefined), []);
});

test('every festival we ship has a short name, the same in its file and in index.json — ACL is ACL, Seismic is Seismic', () => {
  for (const entry of INDEX) {
    assert.deepEqual(festNameProblems(entry.name), [], `${entry.id}: ${entry.name}`);
    assert.equal(fileOf(entry.id).name, entry.name, `${entry.id}: the file and index.json say the same name`);
  }
  const named = Object.fromEntries(INDEX.map((e) => [e.id, e.name]));
  assert.equal(named['acl-2026'], 'ACL', 'the year shows beside it: ACL \'26');
  assert.equal(named['acl-2025'], 'ACL');
  assert.equal(named['seismic-9'], 'Seismic');
  // The others were already short (Kevin named only these two).
  for (const [id, name] of [['portola-2026', 'Portola'], ['edc-orlando-2026', 'EDC Orlando'], ['electric-forest-2026', 'Electric Forest'], ['lollapalooza-2025', 'Lollapalooza'], ['tomorrowland-winter-2027', 'Tomorrowland Winter'], ['ubbi-dubbi-2026', 'Ubbi Dubbi'], ['wicked-oaks-2025', 'Wicked Oaks']]) {
    assert.equal(named[id], name, `${id} keeps its name`);
  }
});
