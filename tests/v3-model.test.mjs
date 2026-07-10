// v4 data-layer semantics: version-aware reads, one-shot migration, notes
// merge safety. The concurrent-notes test is the load-bearing one — it proves
// the keyed-object shape survives what an array shape provably would not.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  docVersion, readLevel, picksFor, migrationOverlay, nextTapLevel,
  makeNoteId, notesFor, noteCount, totalNoteCount, noteOverlay,
  togglePin, sortWithPins,
} from '../js/v3/model.js';
import { deepMerge, validateIncoming, newCrewDoc } from '../api/_lib/crew-shared.mjs';

const V3_DOC = {
  v: 3,
  people: { Kevin: { color: '239, 68, 68' }, Colby: { color: '251, 191, 36' } },
  festivals: {
    'electric-forest-2026': {
      selections: {
        'H&RRY': { Kevin: 1 },
        'Alleycvt': { Kevin: 2, Colby: 3 },
        'Muzz': { Colby: 0 },
      },
    },
    'lollapalooza-2025': { selections: { 'Wild Rivers': { Kevin: 3 } } },
  },
};

test('legacy read mapping: 1->1 2->2 3->4, tombstones stay dead', () => {
  assert.equal(docVersion(V3_DOC), 3);
  assert.equal(readLevel(V3_DOC, 3), 4); // old Must See IS must
  assert.equal(readLevel(V3_DOC, 2), 2);
  assert.equal(readLevel(V3_DOC, 0), 0);
  const picks = picksFor(V3_DOC, 'electric-forest-2026');
  assert.deepEqual(picks, { 'H&RRY': { Kevin: 1 }, 'Alleycvt': { Kevin: 2, Colby: 4 } });
});

test('v4 docs read raw: 3 means picked x3, not must', () => {
  const v4 = { ...V3_DOC, v: 4 };
  assert.equal(readLevel(v4, 3), 3);
  assert.equal(picksFor(v4, 'lollapalooza-2025')['Wild Rivers'].Kevin, 3);
});

test('migration overlay converts every leaf, stamps v4, validates, is idempotent', () => {
  const overlay = migrationOverlay(V3_DOC);
  assert.equal(overlay.v, 4);
  assert.equal(overlay.festivals['electric-forest-2026'].selections['Alleycvt'].Colby, 4);
  assert.equal(overlay.festivals['lollapalooza-2025'].selections['Wild Rivers'].Kevin, 4);
  assert.equal(overlay.festivals['electric-forest-2026'].selections['Muzz'].Colby, 0);
  // The overlay must pass the server validator
  assert.deepEqual(validateIncoming(overlay), { ok: true });
  // Merged result reads identically to the pre-migration mapped view
  const before = picksFor(V3_DOC, 'electric-forest-2026');
  const merged = deepMerge(V3_DOC, overlay);
  assert.equal(docVersion(merged), 4);
  assert.deepEqual(picksFor(merged, 'electric-forest-2026'), before);
  // Second migration is a no-op
  assert.equal(migrationOverlay(merged), null);
});

test('tap cycle 0->1->2->3->4->0', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(nextTapLevel), [1, 2, 3, 4, 0]);
});

test('CONCURRENT NOTES SURVIVE: two writers, same artist, no loss', () => {
  const base = deepMerge(newCrewDoc('T', '2026-07-10T06:00:00Z'), {
    people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 1 } },
  });
  const a = noteOverlay('portola-2026', 'artist', 'Robyn',
    { author: 'Kevin', ts: '2026-07-10T06:01:00Z', text: 'front left' }, 'Kevin.1.aaaaaa');
  const b = noteOverlay('portola-2026', 'artist', 'Robyn',
    { author: 'Maya', ts: '2026-07-10T06:01:01Z', text: 'pit floods right' }, 'Maya.2.bbbbbb');
  assert.deepEqual(validateIncoming(a), { ok: true });
  assert.deepEqual(validateIncoming(b), { ok: true });
  // Simulate the race both ways: inline-UPDATE semantics mean the second
  // writer merges onto the first's committed doc.
  for (const [first, second] of [[a, b], [b, a]]) {
    const doc = deepMerge(deepMerge(base, first), second);
    const notes = notesFor(doc, 'portola-2026', 'artist', 'Robyn');
    assert.equal(notes.length, 2, 'both notes must survive');
    assert.deepEqual(notes.map((n) => n.author).sort(), ['Kevin', 'Maya']);
  }
});

test('note ordering, counts, and tombstones', () => {
  const doc = deepMerge(
    deepMerge(newCrewDoc('T', '2026-07-10T06:00:00Z'),
      noteOverlay('acl-2025', 'day', 'Friday',
        { author: 'Kevin', ts: '2026-07-10T06:05:00Z', text: 'later note' }, 'Kevin.2.later0')),
    noteOverlay('acl-2025', 'day', 'Friday',
      { author: 'Maya', ts: '2026-07-10T06:01:00Z', text: 'earlier note' }, 'Maya.1.early0'),
  );
  const notes = notesFor(doc, 'acl-2025', 'day', 'Friday');
  assert.deepEqual(notes.map((n) => n.text), ['earlier note', 'later note']);
  assert.equal(noteCount(doc, 'acl-2025', 'day', 'Friday'), 2);
  // Author tombstones their own note — count drops, other note untouched
  const killed = deepMerge(doc, noteOverlay('acl-2025', 'day', 'Friday',
    { author: 'Maya', ts: '2026-07-10T06:01:00Z', text: '', deleted: true }, 'Maya.1.early0'));
  assert.equal(noteCount(killed, 'acl-2025', 'day', 'Friday'), 1);
  // fest scope + total
  const withFest = deepMerge(killed, noteOverlay('acl-2025', 'fest', null,
    { author: 'Kevin', ts: '2026-07-10T06:09:00Z', text: 'parking pass under Maya' }, 'Kevin.3.fest00'));
  assert.equal(totalNoteCount(withFest, 'acl-2025'), 2);
});

test('server validator: new sections accept good and reject bad', () => {
  const ok = validateIncoming({
    v: 4,
    people: { Kevin: { colorIndex: 23 } },
    spotifyStats: { Kevin: { likedCount: 11423, artistCount: 342, lastSynced: '2026-06-24T00:00:00Z', user: 'kevglynn.sf' } },
    festivals: { 'portola-2026': { selections: { Robyn: { Kevin: 4 } } } },
  });
  assert.deepEqual(ok, { ok: true });
  assert.equal(validateIncoming({ v: 3 }).ok, false);       // one-way: only 4
  assert.equal(validateIncoming({ v: 5 }).ok, false);
  assert.equal(validateIncoming({ people: { K: { colorIndex: 24 } } }).ok, false);
  assert.equal(validateIncoming({ festivals: { f: { selections: { A: { K: 5 } } } } }).ok, false);
  assert.equal(validateIncoming({ festivals: { f: { notes: { artist: { A: { 'short': { author: 'K', ts: '2026-01-01', text: 'x' } } } } } } }).ok, false); // id too short
  assert.equal(validateIncoming({ festivals: { f: { notes: { artist: { A: { 'K.1.aaaaaa': { author: 'K', ts: 'nope', text: 'x' } } } } } } }).ok, false); // bad ts
  assert.equal(validateIncoming({ festivals: { f: { notes: { artist: { A: { 'K.1.aaaaaa': { author: 'K', ts: '2026-01-01', text: 'x'.repeat(501) } } } } } } }).ok, false);
  assert.equal(validateIncoming({ festivals: { f: { notes: { vibe: {} } } } }).ok, false); // unknown scope
});

test('pins: toggle + pinned-first sort, purely local', () => {
  let pins = {};
  pins = togglePin(pins, 'acl-2025', 'Maya.1.early0');
  assert.deepEqual(pins['acl-2025'], ['Maya.1.early0']);
  const sorted = sortWithPins(
    [{ id: 'a', ts: '2026-07-10T06:00:00Z' }, { id: 'Maya.1.early0', ts: '2026-07-10T07:00:00Z' }],
    pins['acl-2025'],
  );
  assert.equal(sorted[0].id, 'Maya.1.early0'); // pinned floats above older note
  pins = togglePin(pins, 'acl-2025', 'Maya.1.early0');
  assert.deepEqual(pins['acl-2025'], []);
});

test('makeNoteId sanitizes hostile authors into the server id alphabet', () => {
  const id = makeNoteId('K<img>|evil name', '2026-07-10T06:00:00Z', 'abc123');
  assert.match(id, /^[A-Za-z0-9|_.-]{8,80}$/);
  assert.ok(!id.includes('<') && !id.includes('|evil'));
});
