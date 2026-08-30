// Threads (2026-08-29): a reply is a note with one extra key — re, its root's
// id. The server accepts the shape (and only the shape: sync may deliver a
// reply before its root); the client groups one level deep, keeps orphaned
// replies under a stub so they keep their context, and counts replies as
// notes everywhere.
import test from 'node:test';
import assert from 'node:assert/strict';

const { validateIncoming } = await import('../api/_lib/crew-shared.mjs');
const model = await import('../js/v3/model.js');

const FID = 'threads-fest';
const T = (m) => new Date(Date.UTC(2026, 8, 26, 12, m)).toISOString();
const note = (author, min, text, extra = {}) => [model.makeNoteId(author, T(min), 'n' + min), { author, ts: T(min), text, ...extra }];

const [rootId, root] = note('Cleo', 0, 'meet at the rail');
const [r1Id, r1] = note('Ava', 5, 'yes', { re: rootId });
const [r2Id, r2] = note('Ben', 9, 'save me a spot', { re: rootId });
const [soloId, solo] = note('Ava', 20, 'closing set');
const [orphanId, orphan] = note('Dev', 30, 'same', { re: 'Ghost.1758888000000.zzzzzz' });

const docWith = (map) => ({ festivals: { [FID]: { notes: { artist: { 'Dog Blood': map } } } } });

test('the server accepts a reply and refuses a malformed or self-pointing one', () => {
  const ok = validateIncoming(docWith(Object.fromEntries([[rootId, root], [r1Id, r1]])));
  assert.equal(ok.ok, true, ok.error);
  const badRe = validateIncoming(docWith({ [r1Id]: { ...r1, re: 'nope!' } }));
  assert.equal(badRe.ok, false);
  assert.match(badRe.error, /bad re/);
  const selfRe = validateIncoming(docWith({ [r1Id]: { ...r1, re: r1Id } }));
  assert.equal(selfRe.ok, false);
  assert.match(selfRe.error, /reply to itself/);
});

test('a reply arriving BEFORE its root passes the server — sync order is not a validity rule', () => {
  const early = validateIncoming(docWith({ [r2Id]: r2 }));
  assert.equal(early.ok, true, early.error);
});

test('threadsFor groups one level deep, in time order', () => {
  const doc = docWith(Object.fromEntries([[soloId, solo], [rootId, root], [r2Id, r2], [r1Id, r1]]));
  const threads = model.threadsFor(doc, FID, 'artist', 'Dog Blood');
  assert.equal(threads.length, 2);
  assert.equal(threads[0].root.id, rootId, 'oldest root first');
  assert.deepEqual(threads[0].replies.map((n) => n.id), [r1Id, r2Id], 'replies oldest-first');
  assert.equal(threads[1].root.id, soloId);
  assert.deepEqual(threads[1].replies, []);
});

test('a pinned root sorts to the top without touching reply order', () => {
  const doc = docWith(Object.fromEntries([[rootId, root], [r1Id, r1], [soloId, solo]]));
  const threads = model.threadsFor(doc, FID, 'artist', 'Dog Blood', [soloId]);
  assert.equal(threads[0].root.id, soloId);
  assert.equal(threads[1].root.id, rootId);
  assert.deepEqual(threads[1].replies.map((n) => n.id), [r1Id]);
});

test('replies to a tombstoned root keep their context under a stub that still knows the author', () => {
  const doc = docWith(Object.fromEntries([
    [rootId, { author: 'Cleo', ts: T(0), text: '', deleted: true }],
    [r1Id, r1], [r2Id, r2],
  ]));
  const threads = model.threadsFor(doc, FID, 'artist', 'Dog Blood');
  assert.equal(threads.length, 1);
  assert.equal(threads[0].root, null);
  assert.equal(threads[0].stubAuthor, 'Cleo');
  assert.deepEqual(threads[0].replies.map((n) => n.id), [r1Id, r2Id]);
});

test('a reply whose root never arrived renders as a stub thread with no author', () => {
  const doc = docWith(Object.fromEntries([[orphanId, orphan]]));
  const threads = model.threadsFor(doc, FID, 'artist', 'Dog Blood');
  assert.equal(threads.length, 1);
  assert.equal(threads[0].root, null);
  assert.equal(threads[0].stubAuthor, null);
  assert.equal(threads[0].replies[0].id, orphanId);
});

test('counts include replies: a reply is a note', () => {
  const doc = docWith(Object.fromEntries([[rootId, root], [r1Id, r1], [r2Id, r2]]));
  assert.equal(model.noteCount(doc, FID, 'artist', 'Dog Blood'), 3);
});
