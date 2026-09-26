// Every sheet's chrome (Kevin, from his iPhone at Portola, 2026-09-26): the
// grabber at the top of a sheet "doesn't work and isn't necessary", and the
// one on Invite someone can go too. So no sheet built by notes.js sheetChrome
// wears one — the artist's shelf, All notes, a date's and the festival's
// notes, Invite someone and the "… IS IN" that follows it (the share moment
// is held in bring-picks-after-share, the import sheet in the browser's
// import-flow) — and each still closes the four ways it always has: the ✕,
// Escape, Back and a tap on the dimmed wall. The real shell, a member of a
// made-up crew.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle, settleUntil } from './helpers/shell-rig.mjs';
import { deepMerge } from '../js/merge.js';
import { pointerClick } from './helpers/pointer-click.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const CREW = 'sheetchromeunit_crew_0123'; // made up, never a real link
const DOC = {
  v: 4, meta: { name: 'Chrome Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } },
  festivals: { [FID]: { selections: { Robyn: { Maya: 2 } } } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
// The made-up server keeps what it is sent, merged in as crew.js merges — so a
// push's answer (or a poll) carries this phone's own picks back. It used to
// answer every push with the untouched DOC, and under a loaded full-suite run
// at the night clock the sync timer fired mid-test and that answer wiped
// Kevin's pick (2026-09-26 evening: Robyn 1 → 0; 1 run in 3, never alone).
let served = DOC;
async function network(url, opts = {}) {
  const u = String(url);
  if ((opts.method || 'GET') !== 'GET') {
    if (u.startsWith('/api/crew')) {
      try { served = deepMerge(served, JSON.parse(opts.body || '{}').data || {}); } catch { /* not a crew write */ }
    }
    return json(served);
  }
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?')) return json(served);
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${CREW}&f=${FID}`,
  // The week before: no day of the festival is over, so every room head is a door.
  now: '2026-09-22T18:00:00Z',
  storage: {
    fn_welcome_v1: '1',
    fn_crews_v3: JSON.stringify([{ token: CREW, name: 'Chrome Crew' }]),
    [`fn_me_v3_${CREW}`]: 'Kevin',
    [`fn_crew_fest_v3_${CREW}`]: FID,
  },
  fetch: network,
});
test.after(() => shell.close());
await settle(160);
const { window } = shell.dom;

const sheet = () => document.getElementById('artist-sheet');
const backdrop = () => document.getElementById('sheet-backdrop');
async function gone() {
  await settleUntil(() => !sheet(), { timeout: 1500 });
  assert.equal(sheet(), null, 'the sheet is down');
}
// The anatomy: nothing above the head. A chrome sheet's first child is its
// title row (the title, then the ✕); the artist's shelf starts with its card.
function noGrabber(where) {
  const s = sheet();
  assert.ok(s, `${where}: the sheet is up`);
  assert.equal(s.querySelector('.grabber'), null, `${where}: no grabber`);
  assert.equal(document.querySelector('.grabber'), null, `${where}: none anywhere on the page`);
  return s;
}
const titleOf = (s) => s.querySelector('.sheet-title')?.textContent;
const closeX = (s) => s.querySelector('.sheet-close');
const escape = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

test('the artist\'s shelf: its card is the first thing on it, and its ✕ closes it', async () => {
  pointerClick(window, document.querySelector('#wall-root .card[data-artist="Robyn"]'), 'touch', { engine: 'webkit' });
  await settle(40);
  const s = noGrabber('the shelf');
  assert.ok(s.firstElementChild.querySelector(':scope > .sheet-card'), 'the card leads the sheet');
  closeX(s).click();
  await gone();
});

test('All notes: its title row leads, and Escape closes it', async () => {
  const { openAllNotes } = await import('../js/v3/notes.js');
  openAllNotes({ fid: FID, meName: 'Kevin', picks: {}, onOpenDayNotes() {}, onOpenFestNotes() {} });
  await settle(20);
  const s = noGrabber('All notes');
  assert.equal(titleOf(s.firstElementChild), 'ALL NOTES', 'the head is the first child');
  assert.ok(closeX(s.firstElementChild), 'with its ✕');
  escape();
  await gone();
});

test('a date\'s notes, opened by its room head: a tap on the dimmed wall closes them', async () => {
  const head = [...document.querySelectorAll('#wall-root button.room-head')][0];
  assert.ok(head, 'a room head that opens notes');
  head.click();
  await settle(40);
  const s = noGrabber('a date\'s notes');
  assert.ok(titleOf(s.firstElementChild), 'the head is the first child');
  backdrop().click();
  await gone();
});

test('Invite someone: no grabber, and Back closes it', async () => {
  const add = document.querySelector('.person-chip.add');
  assert.ok(add, 'the + Invite someone door');
  add.click();
  await settle(40);
  const s = noGrabber('Invite someone');
  assert.equal(titleOf(s.firstElementChild), 'INVITE SOMEONE');
  history.back();
  await gone();
});

test('… IS IN, the invite\'s answer: re-chromed without a grabber, and its ✕ closes it', async () => {
  document.querySelector('.person-chip.add').click();
  await settle(40);
  const s = sheet();
  const input = s.querySelector('input[aria-label="Their name"]');
  input.value = 'Sam';
  [...s.querySelectorAll('button')].find((b) => b.textContent === 'Add').click();
  await settleUntil(() => /IS IN/.test(titleOf(sheet()) || ''), { timeout: 1500 });
  const after = noGrabber('SAM IS IN');
  assert.equal(titleOf(after.firstElementChild), 'SAM IS IN', 'the head is still the first child');
  closeX(after).click();
  await gone();
});

test('the festival\'s notes: no grabber, and Escape closes them', async () => {
  const { openFestNotes } = await import('../js/v3/notes.js');
  openFestNotes({ fid: FID, meName: 'Kevin', picks: {} }, () => {});
  await settle(20);
  const s = noGrabber('the festival\'s notes');
  assert.ok(titleOf(s.firstElementChild), 'the head is the first child');
  escape();
  await gone();
});
