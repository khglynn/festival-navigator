// A guest's zoom has the same − · note · + a member's does (v92 — Kevin,
// 2026-09-25: "The zoom has no special 'Pick shows' button"). Every door asks
// who they are on the join shelf, naming the artist, and only + carries a pick
// through the join: − and the notes door just join, so their shelf promises
// nothing more. One judgment call pinned here and flagged in the build log: a
// notes door that HAS notes opens them to read (the sheet's own "Add yourself"
// door waits under them); an empty one asks, because there is nothing to read.
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
const door = (sel) => zoomCard().querySelector(`.f-step-row > ${sel}`);
const shelf = () => document.querySelector('.join-shelf');
const shelfLine = () => shelf().querySelector('.js-line').textContent;
const press = (el, pointerType) => el.dispatchEvent(new shell.dom.window.PointerEvent('pointerdown', { bubbles: true, pointerType }));
const fingerTap = (el) => { press(el, 'touch'); el.click(); };
async function openCard(artist) {
  fingerTap(cardOf(artist));
  await settle(10);
  assert.ok(zoomCard(), `${artist} is open`);
}
async function lookAround() { shelf().querySelector('.js-look').click(); await settle(40); }

test('− asks on the shelf naming the artist, and promises no pick', async () => {
  await openCard('Robyn');
  door('.f-step.minus').click();
  await settle(10);
  assert.equal(zoomCard(), null, 'the zoom goes back into its card');
  assert.ok(shelf(), 'the shelf is up');
  assert.equal(shelfLine(), 'Join the plan for Robyn as…');
  assert.equal(shelf().getAttribute('aria-label'), 'Join the plan for Robyn as');
  await lookAround();
  assert.equal(shelf(), null);
  assert.deepEqual(writes, []);
});

test('an empty notes door asks on the shelf the same way', async () => {
  await openCard('Robyn');
  const notes = door('button.f-chip.notes');
  assert.equal(notes.textContent, '+ note');
  notes.click();
  await settle(10);
  assert.ok(shelf());
  assert.equal(shelfLine(), 'Join the plan for Robyn as…');
  await lookAround();
  assert.deepEqual(writes, []);
});

test('a notes door with notes opens them to read, with the sheet’s own door in', async () => {
  await openCard('Dog Blood');
  const notes = door('button.f-chip.notes');
  assert.equal(notes.textContent, '1 note');
  notes.click();
  await settle(20);
  assert.equal(shelf(), null, 'no question: there is something to read');
  const sheet = document.getElementById('artist-sheet');
  assert.ok(sheet, 'the notes are open');
  assert.match(sheet.textContent, /Front left\./);
  assert.equal(sheet.querySelector('.composer'), null, 'read-only for a guest');
  assert.ok(sheet.querySelector('button.join-door'), 'and the door in waits under them');
  history.back();
  await settle(60);
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
