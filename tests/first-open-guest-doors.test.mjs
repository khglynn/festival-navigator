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
import { bootShell, settle, settleUntil } from './helpers/shell-rig.mjs';
import { pointerClick } from './helpers/pointer-click.mjs';
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
// A finger's tap as an engine sends it: press, lift, and the click typed as
// WebKit types it (helpers/pointer-click; card-facts.js clickHand).
const fingerTap = (el) => { pointerClick(shell.dom.window, el, 'touch'); };
const layers = () => (history.state && history.state.layers) || [];
async function openCard(artist) {
  fingerTap(cardOf(artist));
  await settle(10);
  assert.ok(notesShelf(), `${artist}'s shelf is open`);
  assert.equal(zoomCard(), null, 'a finger grows no zoom');
}
// The next popstate and a beat for its handlers — never a fixed sleep: a
// traversal is two jsdom tasks, and a thread a loaded machine held past the
// sleep read the page between them (Sol 6's night-clock run, 2026-09-26).
const popped = () => new Promise((r) => shell.dom.window.addEventListener('popstate', () => setTimeout(r, 0), { once: true }));
async function goBack() { const p = popped(); history.back(); await p; }
async function lookAround() { shelf().querySelector('.js-look').click(); await settleUntil(() => !shelf() && !(history.state && history.state.joinShelf)); await settle(10); }

test('− on a guest’s shelf asks naming the artist, promises no pick — and the question takes the shelf’s place', async () => {
  await openCard('Robyn');
  assert.equal(notesShelf().querySelector('.sheet-card .f-who .f-nm.you'), null, 'a guest has no level: no chip of theirs in the who-row');
  assert.equal(notesShelf().querySelector('.sheet-card .f-step-row > :not(.f-step)'), null, 'and nothing between − and +');
  assert.ok(layers().some((k) => k.startsWith('sheet:notes:')), 'the notes shelf has its entry');
  door('.f-step.minus').click();
  await settle(10);
  assert.equal(notesShelf(), null, 'the notes shelf gave way');
  assert.ok(shelf(), 'the question is up');
  assert.equal(shelfLine(), 'Join the crew for Robyn as…');
  assert.equal(shelf().getAttribute('aria-label'), 'Join the crew for Robyn as');
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
  assert.equal(shelfLine(), 'Join the crew for Robyn as…');
  await lookAround();
  assert.deepEqual(writes, []);
});

test('a card with notes shows them to read, the door in under them', async () => {
  await openCard('Dog Blood');
  assert.match(notesShelf().textContent, /Front left\./);
  assert.equal(notesShelf().querySelector('.composer'), null, 'read-only for a guest');
  assert.ok(notesShelf().querySelector('button.join-door'), 'and the door in waits under them');
  await goBack();
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
  assert.equal(shelfLine(), 'Join the crew for Robyn as…');
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
  await goBack();
});

test('a guest\'s assistive activation (a click with no press of its own) opens the card\'s shelf, not the question (Sol 6\'s review)', async () => {
  cardOf('Robyn').click(); // what VoiceOver's double-tap sends
  await settle(20);
  assert.ok(notesShelf(), 'the card\'s shelf');
  assert.equal(shelf(), null, 'no join question before the guest asks');
  assert.equal(notesShelf().querySelector('.sheet-card .f-name').textContent, 'Robyn');
  await goBack();
  assert.deepEqual(writes, []);
});

test('the join shelf rides the keys through the same helper as the notes shelf, and stops when it goes', async () => {
  const { fakeKeys } = await import('./helpers/fake-keys.mjs');
  const kb = fakeKeys(shell.dom.window);
  await openCard('Robyn');
  assert.equal(kb.listening(), 2, 'the notes shelf rides');
  door('.f-step.minus').click();
  await settle(10);
  assert.ok(shelf(), 'the question took its place');
  assert.equal(kb.listening(), 2, 'the notes shelf let go; the question rides');
  kb.keys(300);
  assert.equal(shelf().style.bottom, '300px', 'the question stands on the keys');
  const cs = window.getComputedStyle(shelf());
  const edge = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((n, k) => n + (Number.parseFloat(cs[k]) || 0), 0);
  assert.equal(shelf().style.maxHeight, `${Math.floor(window.innerHeight - 300 - 12 - edge)}px`, 'its content box, padding counted');
  kb.keys(0);
  await lookAround();
  assert.equal(kb.listening(), 0, 'gone, and not listening');
  assert.deepEqual(writes, []);
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
