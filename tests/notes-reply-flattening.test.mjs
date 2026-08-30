// The one-level reply rule's enforcer — `replyTo.re || replyTo.id` in
// js/v3/notes.js — used to have zero coverage: the only Reply affordance sat
// on the ROOT, above the whole reply list, so a reply to a REPLY had never
// been driven through the real save path (survey P1, 2026-08-30 ledger).
//
// Since the Direction A redesign every note carries Reply on its cue line, so
// this now walks the journey Kevin called "so strange": press Reply under an
// existing reply, get a composer right there in the thread with `@Name`
// already typed, send it, and watch it land FLAT under the root — one level,
// no third tier, no stray stub thread.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const notes = await import('../js/v3/notes.js');

const FID = 'flat-fest';
FESTIVAL_INDEX.push({ id: FID, status: 'lineup' });
FESTIVALS[FID] = { id: FID, name: 'Flat', artists: [{ name: 'GRiZ', day: 'Saturday' }] };
const TOKEN = 'flattesttoken_012345678901';
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 }, Drew: { colorIndex: 1 }, Nhu: { colorIndex: 2 } },
  festivals: { [FID]: { selections: {} } },
  affinity: {},
}, FID);

const ctx = {
  fid: FID, meName: 'Kevin', picks: {}, affinity: null, lowPower: true,
  onTap: () => {}, onOpenNotes: () => {}, onNotesChange: () => {},
};

const sheet = () => document.getElementById('artist-sheet');

test('replying to a reply flattens to the root — the one-level rule holds', () => {
  const rootTs = '2026-09-26T21:00:00.000Z';
  const rootId = model.makeNoteId('Drew', rootTs, 'root001');
  state.recordNote(FID, 'artist', 'GRiZ', rootId, { author: 'Drew', ts: rootTs, text: 'meet at the rail' });

  const replyTs = '2026-09-26T21:05:00.000Z';
  const replyId = model.makeNoteId('Nhu', replyTs, 'reply01');
  state.recordNote(FID, 'artist', 'GRiZ', replyId, {
    author: 'Nhu', ts: replyTs, text: 'works for me', re: rootId,
  });

  // Baseline before the new note lands: one thread, the existing reply
  // nested one level under the root.
  const before = model.threadsFor(state.crewDoc, FID, 'artist', 'GRiZ');
  assert.equal(before.length, 1, 'one thread — the existing reply nests, no phantom second thread');
  assert.equal(before[0].replies.length, 1);
  assert.equal(before[0].replies[0].id, replyId);

  notes.openArtistSheet('GRiZ', ctx, () => {});
  const replyRow = sheet().querySelector('.n-replies .n-note');
  assert.ok(replyRow, 'precondition: Nhu\'s reply is on screen');
  assert.equal(replyRow.querySelector('.n-text').textContent, 'works for me');

  // Press Reply on the REPLY — the affordance that did not exist before.
  const trigger = [...replyRow.querySelectorAll('.n-cue .note-action')].find((b) => b.textContent === 'Reply');
  assert.ok(trigger, 'a reply carries its own Reply now — this was the bug');
  trigger.dispatchEvent(new dom.window.Event('click'));

  const box = sheet().querySelector('.n-inline');
  assert.ok(box, 'the composer opened in the thread, never at the sheet foot');
  const ta = box.querySelector('textarea');
  assert.equal(ta.value, '@Nhu ', 'pre-filled with who you are answering — the words carry it, not the indentation');

  ta.value = '@Nhu agreed, see you there';
  [...box.querySelectorAll('.note-action')].find((b) => b.textContent === 'Reply')
    .dispatchEvent(new dom.window.Event('click'));

  const map = state.crewDoc.festivals[FID].notes.artist.GRiZ;
  const mine = Object.values(map).find((n) => n.author === 'Kevin' && /agreed, see you there/.test(n.text));
  assert.ok(mine, 'the new note landed in the doc');
  assert.equal(mine.re, rootId, 'flattened to the ROOT — the one-level rule\'s enforcer');
  assert.notEqual(mine.re, replyId, 'never points at the reply directly, even though that is what was pressed');

  const after = model.threadsFor(state.crewDoc, FID, 'artist', 'GRiZ');
  assert.equal(after.length, 1, 'still one thread — a misrouted re would create a stray stub thread (the server-side false-tombstone shape)');
  assert.equal(after[0].replies.length, 2, 'both replies sit flat under the same root');
  notes.closeSheet();
});

test('you are never made to @ yourself', () => {
  const map = state.crewDoc.festivals[FID].notes.artist.GRiZ;
  const mineId = Object.keys(map).find((id) => map[id].author === 'Kevin');
  notes.openArtistSheet('GRiZ', ctx, () => {});
  const ownReply = [...sheet().querySelectorAll('.n-replies .n-note')]
    .find((r) => r.dataset.note === mineId);
  assert.ok(ownReply, 'my own reply is on screen');
  [...ownReply.querySelectorAll('.n-cue .note-action')].find((b) => b.textContent === 'Reply')
    .dispatchEvent(new dom.window.Event('click'));
  assert.equal(sheet().querySelector('.n-inline textarea').value, '',
    'no @mention when the reply you pressed is your own');
  notes.closeSheet();
});
