// A guest's doors (v92 — Kevin, 2026-09-25: "The zoom has no special 'Pick
// shows' button"; the tap change, 2026-09-26: a finger's tap opens the card's
// SHELF, a guest's included). Every door asks who they are on the join shelf,
// naming the artist, and only + carries a pick through the join: − and the
// note door just join, so their shelf promises nothing more. A card that HAS
// notes shows them to read on its shelf, the "Add yourself" door under them.
// The join shelf takes the notes shelf's place AND its history entry, so
// "Look around" lands on the wall, never on a sheet the page no longer shows.
// A mouse's zoom (a desktop guest) carries the same doors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { deepMerge } from '../js/merge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const CREW = 'firstopendoors_crew_0123'; // made up, never a real link
let SERVER = {
  v: 4, meta: { name: 'Door Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } },
  festivals: { [FID]: {
    selections: { Robyn: { Maya: 2 } },
    notes: { artist: { 'Dog Blood': { 'Maya.1790000000000.abc123': { author: 'Maya', ts: '2026-09-20T20:00:00.000Z', text: 'Front left.' } } } },
  } },
};
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
    return json({ token: 'persondoors_token_01234567', id: 'pid_doors_0001', doc: { v: 1, name: sent.name || 'Ana', crews: (sent.data || {}).crews || {} } });
  }
  if (u.startsWith('/api/crew?')) {
    if (method !== 'GET') SERVER = deepMerge(SERVER, JSON.parse(opts.body).data || {});
    return json(SERVER);
  }
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({ url: `https://fest.kevinhg.com/#g=${CREW}&f=${FID}`, storage: { fn_welcome_v1: '1' }, fetch: network });
test.after(() => shell.close());
const state = await import('../js/state.js');
const crew = await import('../js/crew.js');
await settle(160);

const cardOf = (artist) => document.querySelector(`#wall-root .card[data-artist="${artist}"]`);
const zoomCard = () => document.querySelector('#zoom-layer .zoom-card');
const notesShelf = () => { const s = document.getElementById('artist-sheet'); return s && !s.classList.contains('join-shelf') ? s : null; };
const door = (sel) => notesShelf().querySelector(`.sheet-card .f-step-row > ${sel}`);
const shelf = () => document.querySelector('.join-shelf');
const shelfLine = () => shelf().querySelector('.js-line').textContent;
const press = (el, pointerType) => el.dispatchEvent(new shell.dom.window.PointerEvent('pointerdown', { bubbles: true, pointerType }));
const fingerTap = (el) => { press(el, 'touch'); el.click(); };
const layers = () => (history.state && history.state.layers) || [];
async function openCard(artist) {
  fingerTap(cardOf(artist));
  await settle(10);
  assert.ok(notesShelf(), `${artist}'s shelf is open`);
  assert.equal(zoomCard(), null, 'a finger grows no zoom');
}
async function lookAround() { shelf().querySelector('.js-look').click(); await settle(60); }

test('− on a guest’s shelf asks naming the artist, promises no pick — and the question takes the shelf’s place', async () => {
  await openCard('Robyn');
  assert.equal(door('.f-meter').classList.contains('empty'), true, 'a guest’s meter is hollow');
  assert.ok(layers().some((k) => k.startsWith('sheet:notes:')), 'the notes shelf has its entry');
  door('.f-step.minus').click();
  await settle(10);
  assert.equal(notesShelf(), null, 'the notes shelf gave way');
  assert.ok(shelf(), 'the question is up');
  assert.equal(shelfLine(), 'Join the plan for Robyn as…');
  assert.equal(shelf().getAttribute('aria-label'), 'Join the plan for Robyn as');
  assert.equal(history.state && history.state.joinShelf, true, 'on the notes shelf’s own entry, not a second one');
  await lookAround();
  assert.equal(shelf(), null);
  assert.equal(notesShelf(), null, 'Look around lands on the wall');
  assert.equal(layers().length, 0, 'and the history under it holds no sheet');
  assert.deepEqual(writes, []);
});

test('the note door’s place asks the same way, naming the artist', async () => {
  await openCard('Robyn');
  assert.equal(notesShelf().querySelector('.composer'), null, 'a guest has no composer');
  const join = notesShelf().querySelector('button.join-door');
  assert.equal(join.textContent, 'Add yourself to write a note');
  join.click();
  await settle(10);
  assert.ok(shelf());
  assert.equal(shelfLine(), 'Join the plan for Robyn as…');
  await lookAround();
  assert.deepEqual(writes, []);
});

test('a card with notes shows them to read, the door in under them', async () => {
  await openCard('Dog Blood');
  assert.match(notesShelf().textContent, /Front left\./);
  assert.equal(notesShelf().querySelector('.composer'), null, 'read-only for a guest');
  assert.ok(notesShelf().querySelector('button.join-door'), 'and the door in waits under them');
  history.back();
  await settle(60);
  assert.equal(notesShelf(), null, 'Back closes it');
  assert.deepEqual(writes, []);
});

test('a mouse’s zoom (a desktop guest) carries the same doors: its − asks the same way', async () => {
  const el = cardOf('Robyn');
  el.dispatchEvent(new shell.dom.window.PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 30, clientY: 30 }));
  await settle(260);
  assert.ok(zoomCard(), 'hover grew the zoom');
  assert.equal(zoomCard().querySelector('.f-step-row > button.f-chip.notes').textContent, '+ note', 'the zoom keeps its note door');
  zoomCard().querySelector('.f-step.minus').click();
  await settle(10);
  assert.equal(zoomCard(), null, 'the zoom goes back into its card');
  assert.equal(shelfLine(), 'Join the plan for Robyn as…');
  await lookAround();
  el.dispatchEvent(new shell.dom.window.PointerEvent('pointerleave', { pointerType: 'mouse' }));
});

test('a finger’s tap on another card while a zoom stands opens THAT card’s shelf — nothing is eaten any more', async () => {
  const el = cardOf('Robyn');
  el.dispatchEvent(new shell.dom.window.PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 30, clientY: 30 }));
  await settle(260);
  assert.ok(zoomCard(), 'a mouse’s zoom on a touch screen');
  fingerTap(cardOf('Dog Blood'));
  await settle(20);
  assert.equal(zoomCard(), null, 'the press outside closed the zoom');
  assert.equal(notesShelf() && notesShelf().querySelector('.f-name').textContent, 'Dog Blood', 'and the tap opened its card');
  history.back();
  await settle(60);
});

test('joining from − joins, and picks nothing', async () => {
  await openCard('Robyn');
  door('.f-step.minus').click();
  await settle(10);
  const f = shelf().querySelector('.js-field');
  assert.equal(f.placeholder, 'Add your name');
  f.value = 'Ana';
  f.dispatchEvent(new shell.dom.window.Event('input'));
  shelf().querySelector('.js-go').click();
  await settle(200);
  assert.equal(crew.me(CREW), 'Ana', 'Ana is in');
  assert.equal(shelf(), null);
  assert.equal((state.crewDoc.festivals[FID].selections.Robyn || {}).Ana, undefined, 'no pick on Robyn');
  assert.equal(state.pendingChanges.festivals?.[FID]?.selections?.Robyn, undefined, 'and none queued');
  const crewPosts = writes.filter((w) => w.url.startsWith('/api/crew'));
  assert.equal(crewPosts.length, 1, 'one write to the crew: the join');
  assert.deepEqual(Object.keys(crewPosts[0].body.data.people), ['Ana']);
  assert.equal(crewPosts[0].body.data.festivals, undefined);
});
