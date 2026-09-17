// Day notes are keyed by the DATE (MODEL-V4 §4, Kevin 2026-09-17: artist, fest
// and dates — "a defensible MVP"). Three things have to be true at once:
//
//   1. a new note lands on an ISO date, never on a day label;
//   2. a note someone already wrote under a weekday label still shows up, under
//      the date that label means — on BOTH dates of a two-weekend fest, because
//      that is what one thread against "Friday" always meant;
//   3. a note written against a SECTION ("Afters") stays readable and is never
//      added to — sections are not a note target any more.
//
// Nothing is renamed, nothing is migrated: the mapping happens at read time and
// the old keys keep their bytes. The freeze is untouched.
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

// One weekend (Portola's shape): two grid days with dates, two section labels
// with none. Afters plays Thursday through Sunday, so Sep 24 is a real date the
// fest has even though no dayMeta entry names it — the shell hands that list in.
const ONE = 'dates-one-weekend';
FESTIVAL_INDEX.push({ id: ONE, status: 'lineup' });
FESTIVALS[ONE] = {
  id: ONE,
  name: 'Portolite',
  dayMeta: {
    Saturday: { wd: 'Sat', date: 'Sep 26', iso: '2026-09-26' },
    Sunday: { wd: 'Sun', date: 'Sep 27', iso: '2026-09-27' },
    Afters: { date: 'Sep 24-27' },
  },
  artists: [{ name: 'Robyn', day: 'Saturday' }],
};

// Two weekends (ACL's shape): one label, two dates.
const TWO = 'dates-two-weekend';
FESTIVAL_INDEX.push({ id: TWO, status: 'lineup' });
FESTIVALS[TWO] = {
  id: TWO,
  name: 'Aclite',
  dayMeta: {
    Friday: { wd: 'Fri', date: 'Oct 2 & 9', isos: { W1: '2026-10-02', W2: '2026-10-09' } },
    Saturday: { wd: 'Sat', date: 'Oct 3 & 10', isos: { W1: '2026-10-03', W2: '2026-10-10' } },
  },
  artists: [{ name: 'Chappell', day: 'Friday' }],
};

const sheet = () => document.getElementById('artist-sheet');
const click = (el) => el.dispatchEvent(new dom.window.Event('click'));
const labels = () => [...sheet().querySelectorAll('.micro-label')].map((l) => l.textContent);
// The section a micro-label heads: everything up to the next label.
const groupUnder = (label) => {
  const all = [...sheet().querySelectorAll('.micro-label')];
  const head = all.find((l) => l.textContent === label);
  if (!head) return null;
  const out = [];
  for (let n = head.nextElementSibling; n && !n.classList.contains('micro-label'); n = n.nextElementSibling) out.push(n);
  return out;
};
const textsUnder = (label) => (groupUnder(label) || [])
  .flatMap((n) => [...n.querySelectorAll('.n-text')].map((t) => t.textContent));
const doorsUnder = (label) => (groupUnder(label) || []).flatMap((n) => [...n.querySelectorAll('.n-door')]);
const send = (box, text) => {
  box.querySelector('textarea').value = text;
  click([...box.querySelectorAll('.n-fieldbar button')].find((b) => b.textContent === 'Save'));
};

function openOne(ctxOverrides = {}) {
  const ctx = {
    fid: ONE, meName: 'Kevin', picks: {}, affinity: null, lowPower: true,
    // The day axis the shell composes — grid days plus the nights the sections
    // play. Sep 24 and Sep 25 are afters nights; no dayMeta entry names them.
    festDates: [
      { iso: '2026-09-24', label: 'Thursday' },
      { iso: '2026-09-25', label: 'Friday' },
      { iso: '2026-09-26', label: 'Saturday' },
      { iso: '2026-09-27', label: 'Sunday' },
    ],
    onTap: () => {}, onOpenNotes: () => {}, onNotesChange: () => {},
    ...ctxOverrides,
  };
  notes.openAllNotes(ctx);
  return ctx;
}

test('setup: one crew per fest shape', () => {
  state.activateCrew('datestesttoken_0123456789', {
    v: 4, meta: {}, spotify: {},
    people: { Kevin: { colorIndex: 0 }, Drew: { colorIndex: 1 } },
    festivals: { [ONE]: { selections: {} } },
    affinity: {},
  }, ONE);
  assert.equal(state.fest().id, ONE);
});

test('a legacy weekday note renders under its date — and is still stored under the weekday', () => {
  const ts = '2026-09-20T18:00:00.000Z';
  state.recordNote(ONE, 'day', 'Saturday', model.makeNoteId('Drew', ts, 'aaaaaa'),
    { author: 'Drew', ts, text: 'meet at Crane by 4' });

  openOne();
  assert.ok(labels().includes('Saturday'), `the date's row is headed the way the wall heads it — got ${JSON.stringify(labels())}`);
  assert.equal(labels().filter((l) => l === 'Saturday').length, 1,
    'one row, headed the way the wall heads that day — not one for the key and one for the date');
  assert.deepEqual(textsUnder('Saturday'), ['meet at Crane by 4'], 'the legacy note reads under the date');

  // Read-time only: nothing was renamed, nothing was migrated.
  const day = state.crewDoc.festivals[ONE].notes.day;
  assert.ok(day.Saturday, 'the bytes stayed under "Saturday"');
  assert.equal(day['2026-09-26'], undefined, 'no date key was minted to hold it');
  notes.closeSheet();
});

test('a quiet date has no row in the sheet — you write from where you are standing (§3a.3)', () => {
  const ctx = openOne();
  assert.equal(labels().includes('Sunday'), false, 'nobody has written on Sunday, so Sunday is not a row');
  assert.equal(sheet().querySelectorAll('.n-door.new').length, 0, 'and there is no "+ Add a note for…" door anywhere');

  // The wall's day rule is the door; the sheet lists what came of it.
  notes.openDayNotes('2026-09-27', 'Sun · Sep 27', ctx, () => {});
  const composer = sheet().querySelector('.composer .n-field');
  composer.value = 'sunday plan: start at the pier';
  click(sheet().querySelector('.composer .btn-tonal'));
  const day = state.crewDoc.festivals[ONE].notes.day;
  const landed = Object.values(day['2026-09-27'] || {}).find((n) => n.text === 'sunday plan: start at the pier');
  assert.ok(landed, 'it landed under the ISO date');
  assert.equal(landed.re, undefined, 'as a root, not a reply');
  assert.equal(validateIncoming(state.pendingChanges).ok, true, 'and the server accepts a date key');
  notes.closeSheet();

  openOne();
  assert.ok(labels().includes('Sunday'), 'and now the date IS a row');
  notes.closeSheet();
});

test('a legacy note and a new one share one date’s conversation', () => {
  const ts = '2026-09-21T18:00:00.000Z';
  state.recordNote(ONE, 'day', '2026-09-26', model.makeNoteId('Kevin', ts, 'bbbbbb'),
    { author: 'Kevin', ts, text: 'gate opens at 1' });
  openOne();
  assert.deepEqual(textsUnder('Saturday').sort(), ['gate opens at 1', 'meet at Crane by 4'],
    'both keys read as one date');
  notes.closeSheet();
});

test('a synthetic night keeps its legacy notes: "Thursday" reads under the Thursday row', () => {
  // Portola's afters play Thursday and Friday. Neither night is in dayMeta —
  // the wall derives the date from the section's `night` — so a note written
  // under "Thursday" before V4 had no dayMeta entry to map through, and its
  // door vanished off a wall where afters are half the week.
  const ts = '2026-09-19T18:00:00.000Z';
  state.recordNote(ONE, 'day', 'Thursday', model.makeNoteId('Drew', ts, 'cccccc'),
    { author: 'Drew', ts, text: 'warehouse line is round the back' });

  openOne();
  assert.deepEqual(textsUnder('Thursday'), ['warehouse line is round the back'],
    'the afters note reads under its date');
  assert.equal(labels().filter((l) => l === 'Thursday').length, 1, 'one row, not a second for the raw weekday key');

  const day = state.crewDoc.festivals[ONE].notes.day;
  assert.ok(day.Thursday, 'still stored under "Thursday" \u2014 read-time only, no migration');
  assert.equal(day['2026-09-24'], undefined, 'no date key was minted to hold it');

  // And it is no longer stranded in the read-only section list.
  const stranded = model.sectionNoteKeys(state.crewDoc, ONE, FESTIVALS[ONE],
    ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  assert.equal(stranded.includes('Thursday'), false, 'a date claimed it, so it is not a section any more');
  notes.closeSheet();
});

test('the whisper is keyed by the date, and counts both keys', () => {
  const ctx = { fid: ONE, meName: 'Kevin', affinity: null, lowPower: true };
  assert.equal(notes.dayWhisper('2026-09-25', 'Fri · Sep 25', ctx, () => {}), null, 'a quiet date, no whisper');

  let opened = false;
  const w = notes.dayWhisper('2026-09-26', 'Sat · Sep 26', ctx, () => { opened = true; });
  assert.ok(w, 'the date has notes, so the whisper renders');
  assert.equal(w.querySelector('.who').textContent, 'you', 'the newest voice across both keys');
  assert.equal(w.querySelector('.text').textContent, 'gate opens at 1');
  assert.equal(w.querySelector('.more').textContent, '2 notes ›');
  assert.match(w.getAttribute('aria-label'), /Sat · Sep 26/, 'the short form in the label, never a raw key');
  click(w);
  assert.ok(opened);
});

test('a section on a date is its own thread: written from the header, listed once, rolled up nowhere', () => {
  const ctx = openOne();
  notes.closeSheet();
  // The wall's Folsom header on Friday hands this key down.
  notes.openDayNotes('2026-09-25|Folsom', 'Folsom · Friday', ctx, () => {});
  assert.equal(sheet().querySelector('.sheet-title').textContent, 'FOLSOM · FRIDAY', 'it says where you are standing');
  sheet().querySelector('.composer .n-field').value = 'Folsom line is round the corner';
  click(sheet().querySelector('.composer .btn-tonal'));
  const day = state.crewDoc.festivals[ONE].notes.day;
  assert.ok(Object.values(day['2026-09-25|Folsom'] || {}).some((n) => n.text === 'Folsom line is round the corner'),
    'stored under <iso>|<section>, additive — nothing else reads that key');
  assert.equal(day['2026-09-25'], undefined, 'and the date itself is untouched');
  assert.equal(validateIncoming(state.pendingChanges).ok, true, 'the server accepts the key');
  notes.closeSheet();

  openOne();
  assert.equal(labels().filter((l) => l === 'Folsom · Friday').length, 1, 'listed once, under the section and the day');
  assert.deepEqual(textsUnder('Folsom · Friday'), ['Folsom line is round the corner']);
  assert.equal(labels().includes('Friday'), false, 'Friday itself is still quiet — nothing rolls up');
  assert.equal(textsUnder('Friday').includes('Folsom line is round the corner'), false);
  assert.equal(labels().includes('2026-09-25|Folsom'), false, 'and a storage key never reaches the screen');

  // A Friday note is a different conversation, and the sheet keeps them apart.
  notes.closeSheet();
  notes.openDayNotes('2026-09-25', 'Friday', ctx, () => {});
  sheet().querySelector('.composer .n-field').value = 'Friday is a late one';
  click(sheet().querySelector('.composer .btn-tonal'));
  notes.closeSheet();

  openOne();
  assert.deepEqual(textsUnder('Friday'), ['Friday is a late one']);
  assert.deepEqual(textsUnder('Folsom · Friday'), ['Folsom line is round the corner']);
  assert.ok(labels().indexOf('Friday') < labels().indexOf('Folsom · Friday'), 'the day, then its rooms — wall order');
  notes.closeSheet();
});

test('a section-on-a-date is never mistaken for a stranded section key', () => {
  const dates = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
  const stranded = model.sectionNoteKeys(state.crewDoc, ONE, FESTIVALS[ONE], dates);
  assert.equal(stranded.includes('2026-09-25|Folsom'), false, 'it has a date and a door; it is not history');
  assert.deepEqual(model.sectionDateKeysOn(state.crewDoc, ONE, '2026-09-25'), [{ key: '2026-09-25|Folsom', section: 'Folsom' }]);
  assert.deepEqual(model.sectionDateKeysOn(state.crewDoc, ONE, '2026-09-26'), [], 'another night, another list');
  assert.deepEqual(model.dayNoteKeysFor(FESTIVALS[ONE], '2026-09-25|Folsom'), ['2026-09-25|Folsom'],
    'a new key has no older convention to read');
  assert.equal(model.parseSectionDateKey('2026-09-25'), null, 'a bare date is not one');
  assert.equal(model.parseSectionDateKey('Folsom'), null, 'nor is a bare section');
});

test('a section note stays readable and has no door', () => {
  const ts = '2026-09-19T18:00:00.000Z';
  state.recordNote(ONE, 'day', 'Afters', model.makeNoteId('Drew', ts, 'cccccc'),
    { author: 'Drew', ts, text: 'Halcyon is the one' });
  openOne();
  assert.ok(labels().includes('Afters'), 'it keeps its own label — nothing is lost');
  assert.deepEqual(textsUnder('Afters'), ['Halcyon is the one'], 'and it still reads');
  assert.equal(doorsUnder('Afters').length, 0, 'but there is no way to add to it — sections are not a note target');

  // And no date section quietly absorbed it either.
  for (const d of ['Thursday', 'Friday', 'Saturday', 'Sunday']) {
    assert.equal(textsUnder(d).includes('Halcyon is the one'), false, `${d} did not absorb the section note`);
  }
  notes.closeSheet();
});

test('a day sheet opened on anything but a date takes nothing new', () => {
  // The section headers lose their note chips under V4, so nothing should get
  // here — but the law is worth holding structurally rather than by nobody
  // calling it: a day note is written to a DATE.
  const ctx = { fid: ONE, meName: 'Kevin', affinity: null, lowPower: true, onTap: () => {}, onOpenNotes: () => {}, onNotesChange: () => {} };
  notes.openDayNotes('Afters', null, ctx, () => {});
  assert.equal(sheet().querySelector('.sheet-title').textContent, 'AFTERS', 'it says its own label');
  assert.deepEqual([...sheet().querySelectorAll('.n-text')].map((t) => t.textContent), ['Halcyon is the one'], 'and still reads');
  assert.equal(sheet().querySelector('.composer'), null, 'no composer');
  assert.equal(sheet().querySelector('.n-door'), null, 'and no reply door');
  notes.closeSheet();

  assert.equal(notes.dayWhisper('Afters', null, ctx, () => {}), null, 'and no whisper — only a date has a day’s notes');
});

test('the day sheet opens on a date, reads both keys, and writes to the date', () => {
  const ctx = {
    fid: ONE, meName: 'Kevin', picks: {}, affinity: null, lowPower: true,
    onTap: () => {}, onOpenNotes: () => {}, onNotesChange: () => {},
  };
  notes.openDayNotes('2026-09-26', 'Sat · Sep 26', ctx, () => {});
  assert.equal(sheet().querySelector('.sheet-title').textContent, 'SAT · SEP 26', 'the short form heads the sheet');
  const texts = [...sheet().querySelectorAll('.n-text')].map((t) => t.textContent).sort();
  assert.deepEqual(texts, ['gate opens at 1', 'meet at Crane by 4'], 'both keys, one conversation');

  const composer = sheet().querySelector('.composer .n-field');
  composer.value = 'bring the flag';
  click(sheet().querySelector('.composer .btn-tonal'));
  const day = state.crewDoc.festivals[ONE].notes.day;
  assert.ok(Object.values(day['2026-09-26']).some((n) => n.text === 'bring the flag'), 'a new root lands on the date');
  assert.equal(Object.values(day.Saturday).some((n) => n.text === 'bring the flag'), false, 'never on the legacy key');
  notes.closeSheet();
});

test('a reply to a legacy thread lands under the legacy key, where its root lives', () => {
  // Read-time mapping does not move bytes, so a reply has to go where the root
  // is or it would render as an orphan stub under a root it can see.
  notes.openDayNotes('2026-09-26', 'Sat · Sep 26', { fid: ONE, meName: 'Kevin', affinity: null, lowPower: true, onTap: () => {}, onOpenNotes: () => {}, onNotesChange: () => {} }, () => {});
  const thread = [...sheet().querySelectorAll('.n-thread')]
    .find((b) => b.querySelector('.n-text')?.textContent === 'meet at Crane by 4');
  click(thread.querySelector('.n-door'));
  send(sheet().querySelector('.n-inline'), 'crane it is');
  const day = state.crewDoc.festivals[ONE].notes.day;
  const landed = Object.values(day.Saturday).find((n) => n.text === 'crane it is');
  assert.ok(landed, 'the reply sits with its root, under "Saturday"');
  assert.ok(landed.re, 'as a reply');
  assert.equal(sheet().querySelectorAll('.n-note.stub').length, 0, 'and nothing orphaned');
  assert.equal(validateIncoming(state.pendingChanges).ok, true);
  notes.closeSheet();
});

// A sheet that reads two keys renders two thread hosts and hands them ONE
// editing map. Pruning that map inside a host, against that host's own notes,
// makes each host throw the other's drafts away: tapping Edit on the date-keyed
// note opened no editor at all (the legacy host swept it on the very repaint the
// tap asked for), and a repaint closed an open legacy edit. The map belongs to
// the sheet, so the sheet prunes it — once, against every note it displays.
test('one editing state across a date’s two keys: an edit on either survives a repaint', () => {
  const ctx = { fid: ONE, meName: 'Kevin', affinity: null, lowPower: true, onTap: () => {}, onOpenNotes: () => {}, onNotesChange: () => {} };
  notes.openDayNotes('2026-09-26', 'Sat · Sep 26', ctx, () => {});

  const rowFor = (text) => [...sheet().querySelectorAll('.n-note')]
    .find((n) => n.querySelector('.n-text')?.textContent === text);
  const editOn = (row) => [...row.querySelectorAll('.n-acts button')].find((b) => b.textContent === 'Edit');
  const open = () => [...sheet().querySelectorAll('textarea[data-editing]')].map((t) => t.dataset.editing).sort();

  const isoId = rowFor('gate opens at 1').dataset.note;      // stored under 2026-09-26
  const legacyId = rowFor('crane it is').dataset.note;       // stored under "Saturday"
  assert.notEqual(isoId, legacyId);

  click(editOn(rowFor('gate opens at 1')));
  assert.deepEqual(open(), [isoId], 'tapping Edit on the date-keyed note opens its editor');

  click(editOn(rowFor('crane it is')));
  assert.deepEqual(open(), [isoId, legacyId].sort(), 'and the legacy note opens beside it — both drafts live');

  notes.refreshOpenSheet(); // a crew-mate's note lands on the 25 s poll
  assert.deepEqual(open(), [isoId, legacyId].sort(), 'a repaint keeps both open');

  // The prune still does its job: a draft whose note a remote sync tombstoned
  // has nowhere to land, and goes.
  state.recordNote(ONE, 'day', '2026-09-26', isoId,
    { author: 'Kevin', ts: '2026-09-21T18:00:00.000Z', text: '', deleted: true });
  notes.refreshOpenSheet();
  assert.deepEqual(open(), [legacyId], 'the tombstoned note’s draft is swept; the other is not');
  notes.closeSheet();
});

test('two weekends: one legacy Friday note shows on BOTH Fridays, a new note on one', () => {
  state.activateCrew('datestesttoken_9876543210', {
    v: 4, meta: {}, spotify: {},
    people: { Kevin: { colorIndex: 0 }, Drew: { colorIndex: 1 } },
    festivals: { [TWO]: { selections: {} } },
    affinity: {},
  }, TWO);
  const ts = '2026-09-28T18:00:00.000Z';
  state.recordNote(TWO, 'day', 'Friday', model.makeNoteId('Drew', ts, 'dddddd'),
    { author: 'Drew', ts, text: 'ride share from Rainey' });

  const ctx = {
    fid: TWO, meName: 'Kevin', picks: {}, affinity: null, lowPower: true,
    festDates: [
      { iso: '2026-10-02', label: 'Fri · Oct 2' },
      { iso: '2026-10-03', label: 'Sat · Oct 3' },
      { iso: '2026-10-09', label: 'Fri · Oct 9' },
      { iso: '2026-10-10', label: 'Sat · Oct 10' },
    ],
    onTap: () => {}, onOpenNotes: () => {}, onNotesChange: () => {},
  };
  notes.openAllNotes(ctx);
  assert.deepEqual(textsUnder('Fri · Oct 2'), ['ride share from Rainey'], 'weekend one sees it');
  assert.deepEqual(textsUnder('Fri · Oct 9'), ['ride share from Rainey'], 'weekend two sees it — one thread meant both');
  assert.deepEqual(textsUnder('Sat · Oct 3'), [], 'and Saturday does not');

  // Now a note on one Friday only. Two Fridays are two dates: solved.
  notes.closeSheet();
  notes.openDayNotes('2026-10-09', 'Fri · Oct 9', ctx, () => {});
  sheet().querySelector('.composer .n-field').value = 'second weekend only';
  click(sheet().querySelector('.composer .btn-tonal'));
  const day = state.crewDoc.festivals[TWO].notes.day;
  assert.ok(Object.values(day['2026-10-09']).some((n) => n.text === 'second weekend only'));
  assert.equal(day['2026-10-02'], undefined, 'the other Friday is untouched');

  notes.openAllNotes(ctx);
  assert.deepEqual(textsUnder('Fri · Oct 9').sort(), ['ride share from Rainey', 'second weekend only']);
  assert.deepEqual(textsUnder('Fri · Oct 2'), ['ride share from Rainey'], 'weekend one still shows only the shared one');
  notes.closeSheet();
});

test('a fest nobody has written on: the sheet is the composer and nothing else', () => {
  const QUIET = 'dates-quiet';
  FESTIVAL_INDEX.push({ id: QUIET, status: 'lineup' });
  FESTIVALS[QUIET] = {
    id: QUIET,
    name: 'Quietfest',
    dayMeta: { Saturday: { wd: 'Sat', date: 'Oct 17', iso: '2026-10-17' } },
    artists: [{ name: 'Nobody', day: 'Saturday' }],
  };
  state.activateCrew('datestesttoken_5555555555', {
    v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 0 } },
    festivals: { [QUIET]: { selections: {} } }, affinity: {},
  }, QUIET);
  notes.openAllNotes({
    fid: QUIET, meName: 'Kevin', picks: {}, affinity: null, lowPower: true,
    festDates: [{ iso: '2026-10-17', label: 'Saturday' }],
    onTap: () => {}, onOpenNotes: () => {}, onNotesChange: () => {},
  });
  assert.ok(sheet().querySelector('.composer'), 'the festival composer is always there');
  assert.deepEqual(labels(), [], 'no date rows for dates nobody has written on');
  assert.equal(sheet().querySelectorAll('.n-door').length, 0, 'and no doors at all');
  assert.ok(sheet().querySelector('.n-empty'), 'just the line that says so');
  notes.closeSheet();
});

test('the key mapping itself, without a DOM', () => {
  const one = FESTIVALS[ONE];
  assert.deepEqual(model.dayNoteKeysFor(one, '2026-09-26'), ['Saturday', '2026-09-26'],
    'oldest convention first; the date is the write target');
  // Sep 24 is an AFTERS night: dayMeta never names it, and the pre-V4 wall
  // keyed its notes by the long weekday it synthesised. So the weekday is a
  // legacy key for the date whether or not the file lists it — otherwise half
  // of Portola's wall loses its door.
  assert.deepEqual(model.dayNoteKeysFor(one, '2026-09-24'), ['Thursday', '2026-09-24'],
    'a synthetic night\u2019s weekday still reaches its date');
  assert.deepEqual(model.legacyDayKeysFor(one, '2026-09-26'), ['Saturday'],
    'a grid day names its weekday once, not twice');

  const two = FESTIVALS[TWO];
  assert.deepEqual(model.legacyDayKeysFor(two, '2026-10-02'), ['Friday']);
  assert.deepEqual(model.legacyDayKeysFor(two, '2026-10-09'), ['Friday'], 'the same label on both weekends');
  assert.deepEqual(model.legacyDayKeysFor(two, '2026-10-03'), ['Saturday']);
  assert.deepEqual(model.isosOfDayMeta(two.dayMeta.Friday), ['2026-10-02', '2026-10-09']);
  assert.deepEqual(model.isosOfDayMeta(one.dayMeta.Afters), [], 'a section label stands for no date');
  assert.deepEqual(model.isosOfDayMeta(null), []);
});
