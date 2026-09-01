// The notes/desktop round's UI against the real modules in jsdom: the day
// whisper (nothing until someone writes, then the newest note), the sheet
// whose header is the card, and — since Kevin picked "the open door" on
// 2026-08-30 — the always-visible Reply row that ends every thread, the two
// quiet actions revealed at the head line (Pin for anyone, Edit on your own),
// editing in place with Save · Cancel and Delete kept apart inside it, and a
// folded pinned root that shows a count and no door until it is opened.
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
// The two quiet words at a note's head line, for one note or the whole sheet.
const acts = (root = sheet()) => [...root.querySelectorAll('.n-head .n-acts button')];
const act = (label, root = sheet()) => acts(root).find((b) => b.textContent === label);
const rows = () => [...sheet().querySelectorAll('.n-note')];
const mine = () => rows().find((r) => r.querySelector('.n-who')?.textContent === 'you');
// The door, and the composer it becomes.
const doors = (root = sheet()) => [...root.querySelectorAll('.n-door')];
const send = (box, text) => {
  box.querySelector('textarea').value = text;
  click([...box.querySelectorAll('.n-fieldbar button')].find((b) => b.textContent === 'Save'));
};

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

test('every thread ends with an open door, and no note carries a Reply', () => {
  const t1 = '2026-09-26T21:00:00.000Z';
  const rootId = model.makeNoteId('Drew', t1, 'cccccc');
  state.recordNote(FID, 'artist', 'GRiZ', rootId, { author: 'Drew', ts: t1, text: 'rail crew assemble' });
  notes.openArtistSheet('GRiZ', ctx, () => {});
  assert.ok(sheet().querySelector('.sheet-card'), 'the header is the card');
  assert.equal(sheet().querySelector('.sheet-card .f-name').textContent, 'GRiZ');
  assert.equal(sheet().querySelectorAll('.f-pill').length, 2, 'both pickers as pills');
  assert.ok([...sheet().querySelectorAll('.f-pill')].some((p) => p.textContent.startsWith('You')), 'You, capitalised');

  // Kevin's law, held structurally: there is nowhere to ask for a nested reply.
  assert.equal(acts().find((b) => b.textContent === 'Reply'), undefined, 'no note carries a Reply');
  assert.equal(doors().length, 1, 'a root with no replies carries the door directly beneath it');
  const door = doors()[0];
  assert.equal(door.querySelector('.n-door-label').textContent, 'Reply…');
  assert.ok(door.querySelector('.avatar'), 'wearing your own avatar');
  assert.match(door.getAttribute('aria-label'), /reply/i);

  click(door);
  const box = sheet().querySelector('.n-inline');
  assert.ok(box, 'the door became the composer, in place');
  assert.equal(doors().length, 0, 'and stopped being a door while it is one');
  assert.equal(box.querySelector('textarea').value, '', 'no @Name to pre-fill — the door already says which thread');
  assert.equal(sheet().querySelector('.composer-wrap .n-field').value, '',
    'the bottom composer is untouched — it writes new notes only');

  send(box, 'ten minutes early');
  const map = state.crewDoc.festivals[FID].notes.artist.GRiZ;
  const landed = Object.values(map).find((n) => n.author === 'Kevin' && n.text === 'ten minutes early');
  assert.ok(landed, 'the reply landed in the doc');
  assert.equal(landed.re, rootId, 'as a reply to the root');
  assert.ok(sheet().querySelector('.n-replies .n-note'), 'and renders one gutter in');
  assert.equal(doors().length, 1, 'the door comes back below it, ready for the next voice');
  const v = validateIncoming(state.pendingChanges);
  assert.equal(v.ok, true, v.error);
  notes.closeSheet();
});

test('the head line reveals two quiet words: Pin for anyone, Edit on your own', () => {
  notes.openArtistSheet('GRiZ', ctx, () => {});
  const root = rows()[0];
  assert.deepEqual(acts(root).map((b) => b.textContent), ['Pin'], "someone else's root: Pin, and nothing else");
  assert.deepEqual(acts(mine()).map((b) => b.textContent), ['Edit'], 'my own reply: Edit — a reply has no Pin, pins fold by root');
  // At rest the actions live in the head row, so nothing below them can move.
  assert.ok(root.querySelector('.n-head .n-acts'), 'they sit at the head line, not under the words');
  assert.equal(root.querySelector('.n-cue'), null, 'the cue line under the words is gone');
  notes.closeSheet();
});

test('editing happens in place: Save and Cancel at the head, Delete kept apart below', () => {
  notes.openArtistSheet('GRiZ', ctx, () => {});
  click(act('Edit', mine()));
  const editor = sheet().querySelector('textarea[data-editing]');
  assert.ok(editor, 'the words became a field in place');
  assert.equal(editor.value, 'ten minutes early', 'pre-filled with what is there');

  const editing = rows().find((r) => r.querySelector('textarea[data-editing]'));
  assert.deepEqual(acts(editing).map((b) => b.textContent), ['Save', 'Cancel'],
    'the head line holds the two safe actions');
  const bar = editing.querySelector('.n-fieldbar');
  assert.deepEqual([...bar.querySelectorAll('button')].map((b) => b.textContent), ['Delete'],
    'and Delete waits in the opposite corner — never a neighbour of Save');
  assert.equal(bar.querySelector('button').getAttribute('aria-live'), 'polite',
    'the label changes meaning under focus, so it announces');

  // Cancel discards the draft and leaves the note exactly as it was.
  editor.value = 'scrapped';
  click(act('Cancel', rows().find((r) => r.querySelector('textarea[data-editing]'))));
  assert.equal(sheet().querySelector('textarea[data-editing]'), null, 'the editor is gone');
  assert.equal(model.notesFor(state.crewDoc, FID, 'artist', 'GRiZ').find((n) => n.author === 'Kevin').text,
    'ten minutes early', 'and nothing was written');

  // Edit again, and save for real.
  click(act('Edit', mine()));
  sheet().querySelector('textarea[data-editing]').value = 'fifteen minutes early';
  click(act('Save', rows().find((r) => r.querySelector('textarea[data-editing]'))));
  const after = model.notesFor(state.crewDoc, FID, 'artist', 'GRiZ').filter((n) => n.author === 'Kevin');
  assert.equal(after.length, 1, 'an edit never mints a second note');
  assert.equal(after[0].text, 'fifteen minutes early');
  notes.closeSheet();
});

test('Delete lives only inside editing, keeps its two-tap arm, and the arm survives a repaint', () => {
  notes.openArtistSheet('GRiZ', ctx, () => {});
  assert.equal(sheet().querySelector('.n-fieldbar'), null, 'no Delete anywhere until you are editing');
  click(act('Edit', mine()));
  const del = () => rows().find((r) => r.querySelector('textarea[data-editing]')).querySelector('.n-fieldbar button');

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

test('a folded pinned root shows a count and NO door until it is opened', () => {
  // Rebuild a thread so pinning folds something.
  const tr = '2026-09-26T21:20:00.000Z';
  state.recordNote(FID, 'artist', 'GRiZ', model.makeNoteId('Drew', tr, 'dddddd'),
    { author: 'Drew', ts: tr, text: 'bring the flag', re: model.makeNoteId('Drew', '2026-09-26T21:00:00.000Z', 'cccccc') });
  notes.openArtistSheet('GRiZ', ctx, () => {});

  click(act('Pin'));
  assert.equal(sheet().querySelector('.n-replies'), null, 'pinned: the thread folds to a count');
  assert.equal(doors().length, 0, 'and the door folds away with it — the count is the one way in');
  const count = sheet().querySelector('.n-head .n-count');
  assert.ok(count, 'the count sits with the name and the time — a fact, not an action');
  assert.equal(count.textContent, '1 reply');

  click(count);
  assert.ok(sheet().querySelector('.n-replies .n-note'), 'tapped open in place');
  assert.equal(doors().length, 1, 'and the door is back at the foot of the thread');
  click(doors()[0]);
  send(sheet().querySelector('.n-inline'), 'got it');
  assert.equal(sheet().querySelectorAll('.n-replies .n-note').length, 2, 'the reply landed, thread still open');
  assert.ok(act('Unpin'), 'and Pin became Unpin on the same head line');
  notes.closeSheet();
  localStorage.setItem('fn_pins_v1', '{}');
});

test('a deleted root leaves a stub, and its thread keeps its door', () => {
  const t1 = '2026-09-26T21:00:00.000Z';
  const rootId = model.makeNoteId('Drew', t1, 'cccccc');
  // Drew tombstones the root (only the author can — enforced server-side).
  state.recordNote(FID, 'artist', 'GRiZ', rootId, { author: 'Drew', ts: t1, text: '', deleted: true });
  notes.openArtistSheet('GRiZ', ctx, () => {});
  const stub = sheet().querySelector('.n-note.stub .n-text');
  assert.ok(stub, 'the stub renders');
  assert.equal(stub.textContent, 'Drew removed this note');
  assert.ok(sheet().querySelector('.n-replies .n-note'), 'the replies are still there');
  assert.equal(stub.closest('.n-note').querySelector('.n-acts'), null, 'the stub carries no actions of its own');

  // A conversation does not end because someone removed the first thing said.
  assert.equal(doors().length, 1, 'the thread keeps its door');
  click(doors()[0]);
  send(sheet().querySelector('.n-inline'), 'still on for this');
  const landed = model.notesFor(state.crewDoc, FID, 'artist', 'GRiZ').find((n) => n.text === 'still on for this');
  assert.equal(landed.re, rootId, 'it lands under the same (gone) root, one level, no orphan');
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
  const stubs = [...sheet().querySelectorAll('.n-note.stub .n-text')].map((n) => n.textContent);
  assert.ok(stubs.includes('you removed this note'), `the file's own "you" convention, got ${JSON.stringify(stubs)}`);
  notes.closeSheet();
});

test('a live repaint leaves the caret in the field you were typing in', () => {
  // You can be editing one note while a door is open on another thread. A
  // restore that simply focused the first live edit draft would yank the caret
  // out of whichever field you were actually in, mid-word.
  const t = '2026-09-26T23:00:00.000Z';
  state.recordNote(FID, 'artist', 'GRiZ', model.makeNoteId('Drew', t, 'gggggg'),
    { author: 'Drew', ts: t, text: 'one more thing' });
  const mineTs = '2026-09-26T23:05:00.000Z';
  state.recordNote(FID, 'artist', 'GRiZ', model.makeNoteId('Kevin', mineTs, 'hhhhhh'),
    { author: 'Kevin', ts: mineTs, text: 'noted' });
  notes.openArtistSheet('GRiZ', ctx, () => {});

  click(act('Edit', mine()));
  const drewThread = [...sheet().querySelectorAll('.n-thread')]
    .find((b) => b.querySelector('.n-text')?.textContent === 'one more thing');
  click(drewThread.querySelector('.n-door'));

  const box = sheet().querySelector('.n-inline textarea');
  assert.ok(box, 'both fields are open at once');
  assert.equal(document.activeElement, box, 'the caret went to the door you just opened');

  box.value = 'half a sen';
  box.dispatchEvent(new dom.window.Event('input'));
  notes.refreshOpenSheet();   // a crewmate's note lands
  const after = sheet().querySelector('.n-inline textarea');
  assert.equal(after.value, 'half a sen', 'the half-typed reply survived the repaint');
  assert.equal(document.activeElement, after, 'and the caret stayed with it, not with the open editor');
  assert.ok(sheet().querySelector('textarea[data-editing]'), 'the edit draft is still open too');
  notes.closeSheet();
});

test('the all-notes home carries a door for every scope, not just the festival', () => {
  notes.openAllNotes(ctx);
  const sections = [...sheet().querySelectorAll('.n-list.grouped')];
  assert.ok(sections.length >= 2, 'day and artist sections are both present');
  for (const host of sections) assert.ok(doors(host).length, 'every scope can be replied to here now');

  const dayHost = sections.find((h) => [...h.querySelectorAll('.n-text')].some((t) => t.textContent === 'ok'));
  assert.ok(dayHost, 'found the Saturday thread');
  click(doors(dayHost)[0]);
  // The home repaints every section, so the live hosts are fresh nodes.
  const opened = [...sheet().querySelectorAll('.n-list.grouped')].filter((h) => h.querySelector('.n-inline'));
  assert.equal(opened.length, 1, 'exactly the section whose door you tapped opens a composer');
  send(opened[0].querySelector('.n-inline'), 'see you at the gate');
  const landed = model.notesFor(state.crewDoc, FID, 'day', 'Saturday').find((n) => n.text === 'see you at the gate');
  assert.ok(landed, 'it landed in the DAY scope, from the all-notes home');
  assert.ok(landed.re, 'as a reply');
  assert.equal(validateIncoming(state.pendingChanges).ok, true);
  notes.closeSheet();
});
