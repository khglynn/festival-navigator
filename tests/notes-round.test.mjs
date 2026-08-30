// The notes/desktop round's UI against the real modules in jsdom: the day
// whisper (nothing until someone writes, then the newest note), the sheet
// whose header is the card, and — since the Direction A redesign of
// 2026-08-30 — the cue line, the inline reply composer, editing in place with
// Cancel, Delete living only inside editing, Pin riding the same line, and a
// folded pinned thread opening when you reply into it.
//
// Two of this surface's rules are invisible to Node (CLAUDE.md's standing
// lesson): the hover / focus-within reveal is CSS, and Element.animate does
// not exist here, so every motion path takes its instant branch. Those want
// the real-browser walk; everything below is the logic underneath them.
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
const click = (el) => el.dispatchEvent(new dom.window.Event('click'));
// The cue line's words, for one note or for the whole sheet.
const cues = (root = sheet()) => [...root.querySelectorAll('.n-cue .note-action')];
const cue = (label, root = sheet()) => cues(root).find((b) => b.textContent === label);
const rows = () => [...sheet().querySelectorAll('.n-note')];

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
  click(w);
  assert.ok(opened, 'tapping the whisper opens the day notes');
});

test('at rest a note is a name, a time and words — and Reply opens a composer in the thread', () => {
  const t1 = '2026-09-26T21:00:00.000Z';
  const rootId = model.makeNoteId('Drew', t1, 'cccccc');
  state.recordNote(FID, 'artist', 'GRiZ', rootId, { author: 'Drew', ts: t1, text: 'rail crew assemble' });
  notes.openArtistSheet('GRiZ', ctx, () => {});
  assert.ok(sheet().querySelector('.sheet-card'), 'the header is the card');
  assert.equal(sheet().querySelector('.sheet-card .f-name').textContent, 'GRiZ');
  assert.equal(sheet().querySelectorAll('.f-pill').length, 2, 'both pickers as pills');
  assert.ok([...sheet().querySelectorAll('.f-pill')].some((p) => p.textContent.startsWith('You')), 'You, capitalised');
  assert.ok(sheet().querySelector('.sheet-card .sheet-close'), 'the close lives in the card');

  // The head line is the thing Kevin called crowded. It carries no actions now.
  assert.equal(sheet().querySelector('.n-head .note-action'), null, 'nothing but who and when above the words');
  assert.deepEqual(cues().map((b) => b.textContent), ['Reply', 'Pin'], "someone else's note: two plain words");

  click(cue('Reply'));
  const box = sheet().querySelector('.n-inline');
  assert.ok(box, 'the composer opened inside the thread, not at the sheet foot');
  assert.equal(sheet().querySelector('.composer-wrap .n-field').value, '', 'the bottom composer is untouched — it writes new notes only');
  assert.equal(sheet().querySelector('.reply-to'), null, 'and its old "Replying to…" state is gone');

  box.querySelector('textarea').value = 'ten minutes early';
  click([...box.querySelectorAll('.note-action')].find((b) => b.textContent === 'Reply'));

  const map = state.crewDoc.festivals[FID].notes.artist.GRiZ;
  const mine = Object.values(map).find((n) => n.author === 'Kevin' && n.text === 'ten minutes early');
  assert.ok(mine, 'the reply landed in the doc');
  assert.equal(mine.re, rootId, 'as a reply to the root');
  assert.ok(sheet().querySelector('.n-replies .n-note'), 'and renders one gutter in');
  assert.equal(sheet().querySelector('.n-inline'), null, 'the composer closes once the words are sent');
  const v = validateIncoming(state.pendingChanges);
  assert.equal(v.ok, true, v.error);
  notes.closeSheet();
});

test('your own note offers Edit, and editing owns Cancel and the only door to Delete', () => {
  notes.openArtistSheet('GRiZ', ctx, () => {});
  const mine = rows().find((r) => r.querySelector('.n-who').textContent === 'you');
  assert.ok(mine, 'the reply written above is mine');
  assert.deepEqual(cues(mine).map((b) => b.textContent), ['Edit', 'Reply'],
    'my own reply: Edit and Reply — and NO Delete anywhere at rest');

  click(cue('Edit', mine));
  const editor = sheet().querySelector('textarea[data-editing]');
  assert.ok(editor, 'the words became a field in place');
  assert.equal(editor.value, 'ten minutes early', 'pre-filled with what is there');
  const editing = rows().find((r) => r.querySelector('textarea[data-editing]'));
  assert.deepEqual(cues(editing).map((b) => b.textContent), ['Save', 'Cancel', 'Delete'],
    'the same line becomes the edit line — Delete exists only because you are editing');
  assert.equal(cues(editing)[2].getAttribute('aria-live'), 'polite', 'the label changes meaning under focus, so it announces');

  // Cancel discards the draft and leaves the note exactly as it was.
  editor.value = 'scrapped';
  click(cue('Cancel', editing));
  assert.equal(sheet().querySelector('textarea[data-editing]'), null, 'the editor is gone');
  assert.equal(model.notesFor(state.crewDoc, FID, 'artist', 'GRiZ').find((n) => n.author === 'Kevin').text,
    'ten minutes early', 'and nothing was written');

  // Edit again, and save for real.
  click(cue('Edit', rows().find((r) => r.querySelector('.n-who').textContent === 'you')));
  sheet().querySelector('textarea[data-editing]').value = 'fifteen minutes early';
  click(cue('Save', rows().find((r) => r.querySelector('textarea[data-editing]'))));
  const after = model.notesFor(state.crewDoc, FID, 'artist', 'GRiZ').filter((n) => n.author === 'Kevin');
  assert.equal(after.length, 1, 'an edit never mints a second note');
  assert.equal(after[0].text, 'fifteen minutes early');
  notes.closeSheet();
});

test('Delete inside editing keeps its two-tap arm, and the arm survives a repaint', () => {
  notes.openArtistSheet('GRiZ', ctx, () => {});
  click(cue('Edit', rows().find((r) => r.querySelector('.n-who').textContent === 'you')));
  const armRow = () => rows().find((r) => r.querySelector('textarea[data-editing]'));
  const del = () => cues(armRow()).find((b) => /Delete|Sure\?/.test(b.textContent));

  click(del());
  assert.equal(del().textContent, 'Sure?', 'one tap arms, it does not delete');
  assert.equal(model.notesFor(state.crewDoc, FID, 'artist', 'GRiZ').length, 2, 'nothing gone yet');

  // A crewmate's note arriving mid-arm repaints the sheet. The arm used to be
  // closure-local and silently reset (survey P3); it rides the draft map now.
  notes.refreshOpenSheet();
  assert.equal(del().textContent, 'Sure?', 'still armed after a live repaint');

  click(del());
  const live = model.notesFor(state.crewDoc, FID, 'artist', 'GRiZ');
  assert.equal(live.length, 1, 'the second tap tombstones it');
  assert.equal(live.filter((n) => n.author === 'Kevin').length, 0);
  assert.equal(validateIncoming(state.pendingChanges).ok, true);
  notes.closeSheet();
});

test('Pin rides the cue line, and a folded pinned thread opens when you reply into it', () => {
  // Rebuild a thread: Drew's root plus one reply, so pinning folds something.
  const tr = '2026-09-26T21:20:00.000Z';
  const rId = model.makeNoteId('Drew', tr, 'dddddd');
  state.recordNote(FID, 'artist', 'GRiZ', rId, { author: 'Drew', ts: tr, text: 'bring the flag', re: model.makeNoteId('Drew', '2026-09-26T21:00:00.000Z', 'cccccc') });
  notes.openArtistSheet('GRiZ', ctx, () => {});

  click(cue('Pin'));
  assert.equal(sheet().querySelector('.n-replies'), null, 'pinned: the thread folds to a count');
  const count = sheet().querySelector('.n-cue .n-count');
  assert.ok(count, 'the count sits in the cue line at rest — it is information, not an action');
  assert.equal(count.textContent, '1 reply');

  // Reply into the folded thread: it opens so you can see where the words land.
  click(cue('Reply'));
  const box = sheet().querySelector('.n-inline');
  assert.ok(box, 'the composer is there');
  assert.ok(sheet().querySelector('.n-replies .n-note'), 'and the thread unfolded around it');
  box.querySelector('textarea').value = 'got it';
  click([...box.querySelectorAll('.note-action')].find((b) => b.textContent === 'Reply'));
  assert.equal(sheet().querySelectorAll('.n-replies .n-note').length, 2, 'still open after the save');
  assert.ok(cue('Unpin'), 'and Pin became Unpin on the same line');
  notes.closeSheet();
  localStorage.setItem('fn_pins_v1', '{}');
});

test('a deleted root leaves a stub that still says "you", and its thread stays open for replies', () => {
  const t1 = '2026-09-26T21:00:00.000Z';
  const rootId = model.makeNoteId('Drew', t1, 'cccccc');
  // Drew tombstones the root (only the author can — enforced server-side).
  state.recordNote(FID, 'artist', 'GRiZ', rootId, { author: 'Drew', ts: t1, text: '', deleted: true });
  notes.openArtistSheet('GRiZ', ctx, () => {});
  const stub = sheet().querySelector('.n-note.stub .n-text');
  assert.ok(stub, 'the stub renders');
  assert.equal(stub.textContent, 'Drew removed this note');
  assert.ok(sheet().querySelector('.n-replies .n-note'), 'the replies are still there');

  // A conversation does not end because someone removed the first thing said.
  click(cue('Reply', sheet().querySelector('.n-note.stub')));
  const box = sheet().querySelector('.n-inline');
  assert.ok(box, 'the stub thread can still be answered');
  box.querySelector('textarea').value = 'still on for this';
  click([...box.querySelectorAll('.note-action')].find((b) => b.textContent === 'Reply'));
  const mine = model.notesFor(state.crewDoc, FID, 'artist', 'GRiZ').find((n) => n.text === 'still on for this');
  assert.equal(mine.re, rootId, 'it lands under the same (gone) root, one level, no orphan');
  notes.closeSheet();
});

test('the stub says "you" when the note you removed was your own', () => {
  const t = '2026-09-26T22:00:00.000Z';
  const mineId = model.makeNoteId('Kevin', t, 'eeeeee');
  state.recordNote(FID, 'day', 'Saturday', mineId, { author: 'Kevin', ts: t, text: 'meet by the gate' });
  const rt = '2026-09-26T22:05:00.000Z';
  state.recordNote(FID, 'day', 'Saturday', model.makeNoteId('Drew', rt, 'ffffff'), { author: 'Drew', ts: rt, text: 'ok', re: mineId });
  state.recordNote(FID, 'day', 'Saturday', mineId, { author: 'Kevin', ts: t, text: '', deleted: true });
  notes.openDayNotes('Saturday', ctx, () => {});
  const stub = [...sheet().querySelectorAll('.n-note.stub .n-text')].map((n) => n.textContent);
  assert.ok(stub.includes('you removed this note'), `the file's own "you" convention, got ${JSON.stringify(stub)}`);
  notes.closeSheet();
});

test('a live repaint leaves the caret in the field you were typing in', () => {
  // You can be editing one note while a reply composer is open on another
  // thread. A restore that simply focused the first live draft would yank the
  // caret out of whichever field you were actually in, mid-word.
  const t = '2026-09-26T23:00:00.000Z';
  const rootId = model.makeNoteId('Drew', t, 'gggggg');
  state.recordNote(FID, 'artist', 'GRiZ', rootId, { author: 'Drew', ts: t, text: 'one more thing' });
  const mineTs = '2026-09-26T23:05:00.000Z';
  state.recordNote(FID, 'artist', 'GRiZ', model.makeNoteId('Kevin', mineTs, 'hhhhhh'),
    { author: 'Kevin', ts: mineTs, text: 'noted' });
  notes.openArtistSheet('GRiZ', ctx, () => {});

  // Open an editor on my note, then open a reply composer on Drew's thread.
  click(cue('Edit', rows().find((r) => r.querySelector('.n-who').textContent === 'you')));
  const drew = rows().find((r) => r.querySelector('.n-text')?.textContent === 'one more thing');
  click(cue('Reply', drew));

  const box = sheet().querySelector('.n-inline textarea');
  assert.ok(box, 'both fields are open at once');
  assert.equal(document.activeElement, box, 'the caret went to the field you just opened');

  box.value = 'half a sen';
  box.dispatchEvent(new dom.window.Event('input'));
  notes.refreshOpenSheet();   // a crewmate's note lands
  const after = sheet().querySelector('.n-inline textarea');
  assert.equal(after.value, 'half a sen', 'the half-typed reply survived the repaint');
  assert.equal(document.activeElement, after, 'and the caret stayed with it, not with the open editor');
  assert.ok(sheet().querySelector('textarea[data-editing]'), 'the edit draft is still open too');
  notes.closeSheet();
});

test('the all-notes home can reply into a day thread and an artist thread, not just the festival', () => {
  notes.openAllNotes(ctx);
  const sections = [...sheet().querySelectorAll('.n-list.grouped')];
  assert.ok(sections.length >= 2, 'day and artist sections are both present');
  for (const host of sections) {
    assert.ok(cue('Reply', host), 'every scope offers Reply here now, not fest only');
  }
  // Drive one of them end to end: the day thread.
  const dayHost = sections.find((h) => [...h.querySelectorAll('.n-text')].some((t) => t.textContent === 'works for me'));
  assert.ok(dayHost, 'found the Saturday thread');
  click(cue('Reply', dayHost));
  // The home repaints every section, so the live host is a fresh node.
  const boxes = [...sheet().querySelectorAll('.n-list.grouped')]
    .filter((h) => h.querySelector('.n-inline'));
  assert.equal(boxes.length, 1, 'exactly the section you pressed in opens a composer');
  const box = boxes[0].querySelector('.n-inline');
  assert.ok([...boxes[0].querySelectorAll('.n-text')].some((t) => t.textContent === 'works for me'),
    'and it is the Saturday thread, not the festival one');
  box.querySelector('textarea').value = 'see you at the gate';
  click([...box.querySelectorAll('.note-action')].find((b) => b.textContent === 'Reply'));
  const landed = model.notesFor(state.crewDoc, FID, 'day', 'Saturday').find((n) => n.text === 'see you at the gate');
  assert.ok(landed, 'it landed in the DAY scope, from the all-notes home');
  assert.ok(landed.re, 'as a reply');
  assert.equal(validateIncoming(state.pendingChanges).ok, true);
  notes.closeSheet();
});
