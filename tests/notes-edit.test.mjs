// NT-1/NT-3 regression: notes are editable and deletable through the
// tombstone model (edit keeps id + ts so order is stable; delete hides the
// note and drops the count), and the all-notes HOME always offers a composer
// — even, especially, when there are no notes yet.
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

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
const { openAllNotes, closeSheet } = await import('../js/v3/notes.js');
const { validateIncoming } = await import('../api/_lib/crew-shared.mjs');

FESTIVAL_INDEX.push({ id: 'notes-fest', status: 'lineup' });
const TOKEN = 'notestesttoken_012345678';
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 0 } }, festivals: {}, affinity: {},
}, 'notes-fest');

test('edit keeps id and order; delete tombstones; overlays pass the validator', () => {
  const ts = '2026-07-11T20:00:00.000Z';
  const id = model.makeNoteId('Kevin', ts);
  state.recordNote('notes-fest', 'fest', null, id, { author: 'Kevin', ts, text: 'first draft' });
  assert.equal(model.notesFor(state.crewDoc, 'notes-fest', 'fest')[0].text, 'first draft');

  // Edit: same id, same ts, new words — the server sees a plain merge.
  state.recordNote('notes-fest', 'fest', null, id, { author: 'Kevin', ts, text: 'final wording' });
  const after = model.notesFor(state.crewDoc, 'notes-fest', 'fest');
  assert.equal(after.length, 1);
  assert.equal(after[0].text, 'final wording');
  assert.equal(after[0].id, id, 'edit never mints a new note');
  assert.equal(validateIncoming(state.pendingChanges).ok, true);

  // Delete: tombstone — gone from lists and counts, accepted by the server.
  state.recordNote('notes-fest', 'fest', null, id, { author: 'Kevin', ts, text: '', deleted: true });
  assert.equal(model.notesFor(state.crewDoc, 'notes-fest', 'fest').length, 0);
  assert.equal(model.totalNoteCount(state.crewDoc, 'notes-fest'), 0);
  assert.equal(validateIncoming(state.pendingChanges).ok, true);
});

test('the all-notes home offers a composer even with zero notes (NT-1)', () => {
  const ctx = { fid: 'notes-fest', meName: 'Kevin', onNotesChange: () => {} };
  openAllNotes(ctx);
  const sheet = document.getElementById('artist-sheet');
  assert.ok(sheet, 'sheet opened');
  const composerInput = sheet.querySelector('.composer input');
  assert.ok(composerInput, 'composer present in empty state');
  assert.match(composerInput.getAttribute('aria-label'), /festival note/i);
  closeSheet();
});
