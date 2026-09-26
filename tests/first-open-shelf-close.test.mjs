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
import { bootShell, settle } from './helpers/shell-rig.mjs';
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
const JOIN_MS = 400; // a join that takes its time
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
      await new Promise((r) => setTimeout(r, JOIN_MS));
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
  escape();
  await settle(60);
  assert.equal(shelf(), null, 'Escape took it down');
  assert.notEqual(history.state && history.state.joinShelf, true, 'and its entry is gone from history');
  await openFromYou();
  history.back();
  await settle(60);
  assert.equal(shelf(), null, 'Back takes the reopened shelf down (it used to land on the stale entry, shelf still up)');
  assert.notEqual(history.state && history.state.joinShelf, true);
  assert.deepEqual(writes, []);
});

test('closing the shelf gives focus back to what opened it', async () => {
  await openFromYou();
  escape();
  await settle(60);
  assert.equal(document.activeElement, you(), 'Escape: focus is back on the + that asked');
  await openFromYou();
  shelf().querySelector('.js-look').focus();
  shelf().querySelector('.js-look').click();
  await settle(60);
  assert.equal(document.activeElement, you(), 'Look around: the same');
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
  escape();
  await settle(60);
});

test('Escape and Back while a join is in flight change nothing — the answer lands the person, and history comes out straight', async () => {
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
  history.back();
  await settle(60);
  assert.ok(shelf(), 'nor does Back');
  assert.equal(history.state && history.state.joinShelf, true, 'Back’s entry was put back: history still says the shelf is up');
  await settle(JOIN_MS + 200);
  assert.equal(crew.me(CREW), 'Ana', 'the answer landed: Ana is in, on the shelf she was looking at');
  assert.equal(shelf(), null, 'and then the shelf went down');
  assert.notEqual(history.state && history.state.joinShelf, true, 'leaving no shelf entry behind');
  const joins = writes.filter((w) => w.url.startsWith('/api/crew'));
  assert.equal(joins.length, 1, 'one join');
  assert.deepEqual(Object.keys(joins[0].body.data.people), ['Ana']);
});
