// The notes/desktop round's UI (2026-08-29), against the real modules in
// jsdom: the day whisper (nothing until someone writes, then the newest
// note), the sheet whose header is the card, Reply writing a note with `re`,
// and the pinned root that shows a count until tapped open.
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
const { validateIncoming } = await import('../api/_lib/crew-shared.mjs');

const FID = 'round-fest';
FESTIVAL_INDEX.push({ id: FID, status: 'lineup' });
FESTIVALS[FID] = { id: FID, name: 'Round', artists: [{ name: 'GRiZ', day: 'Saturday' }] };
const TOKEN = 'roundtesttoken_012345678';
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 }, Drew: { colorIndex: 1 } },
  festivals: { [FID]: { selections: { GRiZ: { Kevin: 2, Drew: 4 } } } },
  affinity: {},
}, FID);

const ctx = {
  fid: FID, meName: 'Kevin', picks: { GRiZ: { Kevin: 2, Drew: 4 } },
  affinity: null, lowPower: true,
  onTap: () => {}, onOpenNotes: () => {}, onNotesChange: () => {},
};

const sheet = () => document.getElementById('artist-sheet');

test('the whisper: nothing until someone writes, then the newest note and the count', () => {
  assert.equal(notes.dayWhisper('day', 'Saturday', ctx, () => {}), null, 'no notes, no whisper');
  const t1 = '2026-09-26T20:00:00.000Z';
  state.recordNote(FID, 'day', 'Saturday', model.makeNoteId('Kevin', t1, 'aaaaaa'), { author: 'Kevin', ts: t1, text: 'gate at 1' });
  const t2 = '2026-09-26T20:10:00.000Z';
  state.recordNote(FID, 'day', 'Saturday', model.makeNoteId('Drew', t2, 'bbbbbb'), { author: 'Drew', ts: t2, text: 'works for me', re: model.makeNoteId('Kevin', t1, 'aaaaaa') });
  let opened = false;
  const w = notes.dayWhisper('day', 'Saturday', ctx, () => { opened = true; });
  assert.ok(w, 'notes exist, the whisper renders');
  assert.equal(w.querySelector('.who').textContent, 'Drew', 'the NEWEST voice — a reply counts');
  assert.equal(w.querySelector('.text').textContent, 'works for me');
  assert.equal(w.querySelector('.more').textContent, '2 notes ›');
  w.dispatchEvent(new dom.window.Event('click'));
  assert.ok(opened, 'tapping the whisper opens the day notes');
});

test('the artist sheet opens with the card as its header, and Reply writes a note with re', () => {
  const t1 = '2026-09-26T21:00:00.000Z';
  const rootId = model.makeNoteId('Drew', t1, 'cccccc');
  state.recordNote(FID, 'artist', 'GRiZ', rootId, { author: 'Drew', ts: t1, text: 'rail crew assemble' });
  notes.openArtistSheet('GRiZ', ctx, () => {});
  assert.ok(sheet().querySelector('.sheet-card'), 'the header is the card');
  assert.equal(sheet().querySelector('.sheet-card .f-name').textContent, 'GRiZ');
  assert.equal(sheet().querySelectorAll('.f-pill').length, 2, 'both pickers as pills');
  assert.ok([...sheet().querySelectorAll('.f-pill')].some((p) => p.textContent.startsWith('You')), 'You, capitalised');
  assert.ok(sheet().querySelector('.sheet-card .sheet-close'), 'the close lives in the card');

  const reply = [...sheet().querySelectorAll('.note-action')].find((b) => b.textContent === 'Reply');
  assert.ok(reply, 'Reply sits in the root head line');
  reply.dispatchEvent(new dom.window.Event('click'));
  const label = sheet().querySelector('.reply-to');
  assert.equal(label.hidden, false);
  assert.equal(label.textContent, 'Replying to Drew');

  const input = sheet().querySelector('.composer input');
  input.value = 'ten minutes early';
  const save = [...sheet().querySelectorAll('.composer button')].find((b) => b.textContent === 'Save');
  save.dispatchEvent(new dom.window.Event('click'));

  const map = state.crewDoc.festivals[FID].notes.artist.GRiZ;
  const mine = Object.values(map).find((n) => n.author === 'Kevin' && n.text === 'ten minutes early');
  assert.ok(mine, 'the reply landed in the doc');
  assert.equal(mine.re, rootId, 'as a reply to the root');
  assert.ok(sheet().querySelector('.n-replies .n-note'), 'and renders one gutter in');
  const v = validateIncoming(state.pendingChanges);
  assert.equal(v.ok, true, v.error);
  notes.closeSheet();
});

test('a pinned root shows a reply count, never its thread, until tapped open', () => {
  const t1 = '2026-09-26T21:00:00.000Z';
  const rootId = model.makeNoteId('Drew', t1, 'cccccc');
  localStorage.setItem('fn_pins_v1', JSON.stringify({ [FID]: [rootId] }));
  notes.openArtistSheet('GRiZ', ctx, () => {});
  assert.equal(sheet().querySelector('.n-replies'), null, 'the thread is folded');
  const count = [...sheet().querySelectorAll('.note-action')].find((b) => /repl/.test(b.textContent));
  assert.ok(count, 'the count is the door');
  count.dispatchEvent(new dom.window.Event('click'));
  assert.ok(sheet().querySelector('.n-replies .n-note'), 'tapped open in place');
  notes.closeSheet();
  localStorage.setItem('fn_pins_v1', '{}');
});

test('a deleted root leaves a stub and its replies keep their context', () => {
  const t1 = '2026-09-26T21:00:00.000Z';
  const rootId = model.makeNoteId('Drew', t1, 'cccccc');
  // Drew tombstones the root (only the author can — enforced server-side).
  state.recordNote(FID, 'artist', 'GRiZ', rootId, { author: 'Drew', ts: t1, text: '', deleted: true });
  notes.openArtistSheet('GRiZ', ctx, () => {});
  const stub = sheet().querySelector('.n-note.stub .n-text');
  assert.ok(stub, 'the stub renders');
  assert.equal(stub.textContent, 'Drew removed this note');
  assert.ok(sheet().querySelector('.n-replies .n-note'), 'the reply is still there');
  notes.closeSheet();
});
