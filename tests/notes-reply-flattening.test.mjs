// The one-level reply rule's enforcer — `replyTo.re || replyTo.id` in
// js/v3/notes.js — used to have zero coverage: the only Reply affordance sat
// on the ROOT, above the whole reply list, so a reply to a REPLY had never
// been driven through the real save path (survey P1, 2026-08-30 ledger).
//
// Since Kevin picked "the open door" the UI cannot even ASK for a nested
// reply: no note carries a Reply, and a thread's one always-visible door sits
// below its replies. This walks that journey — open a thread that already has
// a reply, tap ITS door, send — and holds the same two assertions the original
// baseline did: the new note's `re` names the ROOT, and threadsFor shows
// everything flat beneath it. The rule is now structural in the UI and
// enforced server-side (tests/notes-threads.test.mjs); this is the client half.
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

test('a reply sent from a thread with replies still lands flat under the root', () => {
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
  assert.equal(replyRow.querySelector('.n-acts button[data-reply]'), null);
  assert.equal([...sheet().querySelectorAll('.n-head .n-acts button')].find((b) => b.textContent === 'Reply'), undefined,
    'no note offers a Reply — the nested case cannot be requested');

  // The thread's one door sits BELOW the existing reply: answering the
  // conversation and answering its last voice are the same gesture.
  const doors = [...sheet().querySelectorAll('.n-door')];
  assert.equal(doors.length, 1, 'one door for the whole thread');
  assert.ok(replyRow.compareDocumentPosition(doors[0]) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING,
    'and it comes after the reply, where the words will appear');
  doors[0].dispatchEvent(new dom.window.Event('click'));

  const box = sheet().querySelector('.n-inline');
  assert.ok(box, 'the door became the composer in place');
  assert.equal(box.querySelector('textarea').value, '', 'nothing to pre-fill — position carries the context');

  box.querySelector('textarea').value = 'agreed, see you there';
  [...box.querySelectorAll('.n-fieldbar button')].find((b) => b.textContent === 'Save')
    .dispatchEvent(new dom.window.Event('click'));

  const map = state.crewDoc.festivals[FID].notes.artist.GRiZ;
  const mine = Object.values(map).find((n) => n.author === 'Kevin' && n.text === 'agreed, see you there');
  assert.ok(mine, 'the new note landed in the doc');
  assert.equal(mine.re, rootId, 'flattened to the ROOT — the one-level rule\'s enforcer');
  assert.notEqual(mine.re, replyId, 'never points at the reply directly, even though it was answering it');

  const after = model.threadsFor(state.crewDoc, FID, 'artist', 'GRiZ');
  assert.equal(after.length, 1, 'still one thread — a misrouted re would create a stray stub thread (the server-side false-tombstone shape)');
  assert.equal(after[0].replies.length, 2, 'both replies sit flat under the same root');
  notes.closeSheet();
});
