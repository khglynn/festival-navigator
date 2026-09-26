// A member's zoom door row (v92 — Kevin, 2026-09-25): − · note · + along the
// grown card's floor. + raises the level through picked 1–3 to must and stops;
// − lowers it toward not picked and stops; a door with nowhere to go is
// disabled, never hidden. The note door does what the notes chip did. A click
// on a RESTING card still cycles exactly as in v91 — the row is the zoom's
// precise control. The real shell, the zoom grown by a mouse's hover (since
// the tap change, 2026-09-26, a finger never grows a zoom: its tap opens the
// card's shelf, tests/tap-shelf.test.mjs, whose − · + are the same doors).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { pointerClick } from './helpers/pointer-click.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const CREW = 'zoomdoorrow_crew_0123456'; // made up, never a real link
const DOC = {
  v: 4, meta: { name: 'Row Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } },
  festivals: { [FID]: { selections: { Robyn: { Maya: 2 } } } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const posts = [];
async function network(url, opts = {}) {
  const u = String(url);
  if ((opts.method || 'GET') !== 'GET') { posts.push({ url: u, body: opts.body ? JSON.parse(opts.body) : null }); return json(DOC); }
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?')) return json(DOC);
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${CREW}&f=${FID}`,
  storage: {
    fn_welcome_v1: '1',
    fn_crews_v3: JSON.stringify([{ token: CREW, name: 'Row Crew' }]),
    [`fn_me_v3_${CREW}`]: 'Kevin',
    [`fn_crew_fest_v3_${CREW}`]: FID,
  },
  fetch: network,
});
test.after(() => shell.close());
const state = await import('../js/state.js');
const zoom = await import('../js/v3/card-facts.js');
await settle(160);
const { window } = shell.dom;

const cardOf = (artist) => document.querySelector(`#wall-root .card[data-artist="${artist}"]`);
const zoomCard = () => document.querySelector('#zoom-layer .zoom-card');
const doors = () => [...zoomCard().querySelectorAll('.f-step-row > *')];
const minus = () => zoomCard().querySelector('.f-step.minus');
const plus = () => zoomCard().querySelector('.f-step.plus');
const level = (artist) => (state.crewDoc.festivals[FID].selections[artist] || {}).Kevin || 0;
// A real hover: a mouse's pointerenter, then the intent delay (card-facts.js ZOOM_IN_MS).
async function hover(artist) {
  const el = cardOf(artist);
  el.dispatchEvent(new window.PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 40, clientY: 40 }));
  await settle(260);
  assert.ok(zoomCard(), `${artist} grew under the hover`);
  assert.equal(zoom.zoomedCard(), cardOf(artist));
}

test('a hover opens the zoom with − · note · + along its floor; at nothing picked, − has nowhere to go', async () => {
  await hover('Robyn');
  assert.deepEqual(doors().map((d) => d.textContent), ['−', '+ note', '+']);
  assert.equal(zoomCard().lastElementChild.classList.contains('f-step-row'), true, 'the row is the card’s floor');
  assert.equal(minus().disabled, true, 'nothing to lower');
  assert.equal(plus().disabled, false);
  assert.equal(plus().getAttribute('aria-label'), 'More for Robyn');
  assert.equal(minus().getAttribute('aria-label'), 'Less for Robyn');
  assert.equal(zoomCard().querySelector('button.f-chip.notes').getAttribute('aria-label'), 'Add a note for Robyn',
    'the notes door is the same button the chip was (v89’s first-tap fix and the Tab handoff find it by that)');
});

test('+ + − : the level follows, the zoom stays, and the resting card’s meter follows it', async () => {
  plus().click();
  assert.equal(level('Robyn'), 1, '+ picks at one bar');
  assert.ok(zoomCard(), 'the zoom stays up');
  assert.equal(zoom.zoomedCard(), cardOf('Robyn'), 'riding the fresh resting card');
  assert.match(cardOf('Robyn').getAttribute('aria-label'), /^Robyn — /);
  assert.equal(minus().disabled, false, 'now − has somewhere to go');
  plus().click();
  assert.equal(level('Robyn'), 2);
  minus().click();
  assert.equal(level('Robyn'), 1, '− lowers one level');
  assert.equal(state.pendingChanges.festivals[FID].selections.Robyn.Kevin, 1, 'through the ordinary pick path: queued to send');
});

test('+ climbs to must and stops there — never a wraparound', async () => {
  plus().click(); plus().click();
  assert.equal(level('Robyn'), 3);
  assert.equal(plus().getAttribute('aria-label'), 'Must for Robyn', 'the next + is must, and says so');
  plus().click();
  assert.equal(level('Robyn'), 4, 'must');
  assert.equal(plus().disabled, true, 'nowhere higher');
  plus().click();
  assert.equal(level('Robyn'), 4, 'a press on the spent + changes nothing');
  assert.ok(/must/.test(cardOf('Robyn').getAttribute('aria-label')), 'the resting card says must');
});

test('− walks back down to not picked and stops there', async () => {
  for (const want of [3, 2, 1, 0]) { minus().click(); assert.equal(level('Robyn'), want); }
  assert.equal(minus().disabled, true, 'nothing lower than not picked');
  minus().click();
  assert.equal(level('Robyn'), 0);
  assert.ok(zoomCard(), 'the zoom stood through all of it');
});

test('Tab walks the live doors in order, skipping one with nowhere to go', async () => {
  const card = cardOf('Robyn');
  card.focus();
  const tab = (el, shiftKey = false) => el.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));
  tab(card);
  assert.equal(document.activeElement, zoomCard().querySelector('button.f-chip.notes'), 'at nothing picked, − is skipped: the notes door first');
  tab(document.activeElement);
  assert.equal(document.activeElement, plus());
  tab(document.activeElement, true);
  assert.equal(document.activeElement.classList.contains('notes'), true, 'Shift+Tab steps back');
  tab(document.activeElement, true);
  assert.equal(document.activeElement, cardOf('Robyn'), 'and back to the card');
  assert.ok(zoomCard(), 'the zoom stands');
});

test('the note door opens the notes, as the chip did', async () => {
  cardOf('Robyn').focus(); // the card the notes sheet will hand focus back to
  zoomCard().querySelector('button.f-chip.notes').click();
  await settle(20);
  const sheet = document.getElementById('artist-sheet');
  assert.ok(sheet && !sheet.classList.contains('join-shelf'), 'the notes sheet');
  assert.ok(sheet.querySelector('.composer, textarea'), 'with a composer: a member writes');
  assert.equal(zoomCard(), null, 'the zoom went back into its card');
  // Escape closes it (a real key: the zoom module now believes the keyboard
  // is driving) and focus goes back to the card — quietly: no zoom grows on
  // a focus the app handed back (the independent walk of b29aac0).
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await settle(80);
  assert.equal(document.getElementById('artist-sheet'), null, 'Escape closed the notes');
  assert.equal(document.activeElement, cardOf('Robyn'), 'focus is back on the card');
  assert.equal(zoomCard(), null, 'and no zoom grew there');
});

test('a click on a RESTING card still cycles, as in v91 — including must back to nothing', async () => {
  const tap = () => { pointerClick(window, cardOf('Robyn'), 'mouse'); };
  tap();
  assert.equal(level('Robyn'), 1, 'a click picks — it does not open the zoom');
  tap(); tap(); tap();
  assert.equal(level('Robyn'), 4);
  tap();
  assert.equal(level('Robyn'), 0, 'the tap cycle wraps, as it always has');
  zoom.unzoom({ instant: true });
});

test('what the steps and taps settled on is what the crew is sent', async () => {
  await settle(1500); // the push's debounce
  const crewPosts = posts.filter((p) => p.url.startsWith('/api/crew'));
  assert.ok(crewPosts.length >= 1, 'the picks went out');
  const last = crewPosts[crewPosts.length - 1].body.data.festivals[FID].selections.Robyn;
  assert.deepEqual(last, { Kevin: 0 }, 'the last level, and only Kevin’s');
});
