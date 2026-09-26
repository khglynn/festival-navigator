// The join shelf's ways out (v92 — the independent review of 963e599). ONE
// close decision, whoever asks: Escape, the system Back, Look around, the
// dimmed wall. While an answer is in flight nothing closes the shelf — the
// answer decides where it goes (Escape mid-join used to take it down, and the
// late answer joined the person behind their back). Every way it closes leaves
// history exactly as it found it (Escape used to leave its entry behind, and a
// later Back landed on it with a second shelf still up). Focus goes back to
// what opened it, and Tab never walks out of it onto the wall.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle, settleUntil } from './helpers/shell-rig.mjs';
import { deepMerge } from '../js/merge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const CREW = 'shelfclosetest_crew_0123'; // made up, never a real link
let SERVER = {
  v: 4, meta: { name: 'Close Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } },
  festivals: { [FID]: { selections: { Robyn: { Maya: 2 } } } },
};
// A join that takes its time — as long as the test says: the answer waits
// on a gate the in-flight case opens, never on a timer that a loaded machine
// could let run out while the case is still checking what "in flight" means
// (Sol 6's night-clock run, 2026-09-26).
let joinGate = Promise.resolve();
let openJoinGate = () => {};
const writes = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  const method = opts.method || 'GET';
  if (method !== 'GET') writes.push({ method, url: u, body: opts.body ? JSON.parse(opts.body) : null });
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u === '/api/person') {
    if (method === 'GET') return json({ error: 'nobody' }, 404);
    const sent = opts.body ? JSON.parse(opts.body) : {};
    return json({ token: 'personshelfclose_token_01', id: 'pid_shelfclose_1', doc: { v: 1, name: sent.name || 'Ana', crews: (sent.data || {}).crews || {} } });
  }
  if (u.startsWith('/api/crew?')) {
    if (method !== 'GET') {
      await joinGate;
      SERVER = deepMerge(SERVER, JSON.parse(opts.body).data || {});
    }
    return json(SERVER);
  }
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({ url: `https://fest.kevinhg.com/#g=${CREW}&f=${FID}`, storage: { fn_welcome_v1: '1' }, fetch: network });
test.after(() => shell.close());
const crew = await import('../js/crew.js');
await settle(160);
const { window } = shell.dom;

const shelf = () => document.querySelector('.join-shelf');
// The next popstate and a beat for its handlers: a traversal is two jsdom
// tasks, and a fixed sleep read the page between them under load.
const popped = () => new Promise((r) => window.addEventListener('popstate', () => setTimeout(r, 0), { once: true }));
const noShelfEntry = () => !(history.state && history.state.joinShelf);
const escape = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
const you = () => document.getElementById('dock-you');
async function openFromYou() {
  you().focus();
  you().click();
  await settle(20);
  assert.ok(shelf(), 'the shelf is up');
  assert.equal(history.state && history.state.joinShelf, true, 'with its own history entry');
}

test('Escape closes the shelf and consumes its history entry — a reopened shelf and a Back behave', async () => {
  await openFromYou();
  let back = popped();
  escape();
  await back; // Escape consumes the entry by going Back itself
  assert.equal(shelf(), null, 'Escape took it down');
  assert.notEqual(history.state && history.state.joinShelf, true, 'and its entry is gone from history');
  await openFromYou();
  back = popped();
  history.back();
  await back;
  assert.equal(shelf(), null, 'Back takes the reopened shelf down (it used to land on the stale entry, shelf still up)');
  assert.notEqual(history.state && history.state.joinShelf, true);
  assert.deepEqual(writes, []);
});

test('closing the shelf gives focus back to what opened it', async () => {
  await openFromYou();
  let back = popped();
  escape();
  await back;
  assert.equal(document.activeElement, you(), 'Escape: focus is back on the + that asked');
  await openFromYou();
  back = popped();
  shelf().querySelector('.js-look').focus();
  shelf().querySelector('.js-look').click();
  await back;
  assert.equal(document.activeElement, you(), 'Look around: the same');
});

test('Escape over a join shelf the card’s shelf + opened hands focus back to the card — and grows no zoom there', async () => {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // a finger focuses nothing (iOS)
  const card = document.querySelector('#wall-root .card[data-artist="Robyn"]');
  card.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
  card.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
  card.click(); // a guest's finger: the card's shelf (the tap change)
  await settle(10);
  const notes = document.getElementById('artist-sheet');
  assert.ok(notes && !notes.classList.contains('join-shelf'), 'the card’s shelf is up');
  notes.querySelector('.sheet-card .f-step.plus').click();
  await settle(20);
  assert.ok(shelf(), 'the join shelf is up, in its place');
  escape(); // a real key: card-facts now believes the last input was the keyboard
  await settleUntil(() => !shelf() && noShelfEntry());
  await settle(60); // a regrown zoom used to appear within 50 ms
  assert.equal(shelf(), null, 'Escape took the shelf down');
  assert.equal(document.getElementById('artist-sheet'), null, 'and nothing is left under it');
  assert.equal(document.activeElement, document.querySelector('#wall-root .card[data-artist="Robyn"]'), 'focus is back on the card');
  assert.equal(document.querySelector('#zoom-layer .zoom-card'), null,
    'and no zoom grew there: a focus handed back is not keyboard navigation (it used to reopen within 50 ms)');
  assert.notEqual(history.state && history.state.joinShelf, true, 'the entry it took over is gone');
});

test('Tab never walks out of the shelf — not even from the shelf itself, where focus starts', async () => {
  await openFromYou();
  await settle(20);
  const sheet = shelf();
  sheet.focus();
  const tab = (shiftKey) => document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));
  tab(true);
  const doors = [...sheet.querySelectorAll('button, input')].filter((n) => !n.disabled);
  assert.equal(document.activeElement, doors[doors.length - 1], 'Shift+Tab from the shelf lands on its last door, not on the wall');
  tab(false);
  assert.equal(document.activeElement, doors[0], 'and Tab from the last wraps to the first');
  const back = popped();
  escape();
  await back;
});

test('Escape and Back while a join is in flight change nothing — the answer lands the person, and history comes out straight', async () => {
  joinGate = new Promise((r) => { openJoinGate = r; }); // the answer waits until this case lets it land
  await openFromYou();
  const field = shelf().querySelector('.js-field');
  field.value = 'Ana';
  field.dispatchEvent(new window.Event('input'));
  shelf().querySelector('.js-go').click();
  await settle(20);
  assert.equal(shelf().querySelector('.js-go').disabled, true, 'the answer is in flight');
  escape();
  await settle(20);
  assert.ok(shelf(), 'Escape does not take the shelf down mid-join');
  const back = popped();
  history.back();
  await back;
  assert.ok(shelf(), 'nor does Back');
  assert.equal(history.state && history.state.joinShelf, true, 'Back’s entry was put back: history still says the shelf is up');
  openJoinGate(); // now the answer lands
  await settleUntil(() => crew.me(CREW) === 'Ana' && !shelf() && noShelfEntry());
  assert.equal(crew.me(CREW), 'Ana', 'the answer landed: Ana is in, on the shelf she was looking at');
  assert.equal(shelf(), null, 'and then the shelf went down');
  assert.notEqual(history.state && history.state.joinShelf, true, 'leaving no shelf entry behind');
  const joins = writes.filter((w) => w.url.startsWith('/api/crew'));
  assert.equal(joins.length, 1, 'one join');
  assert.deepEqual(Object.keys(joins[0].body.data.people), ['Ana']);
});
