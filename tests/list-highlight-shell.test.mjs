// The List's highlight filter in the real shell (v103): the phone reads the
// festival as a List, the people menu highlights Ross, and the wall thins in
// place — his rows stay, the rest leave, the rooms he picked nothing in go
// quiet. Everyone brings it all back. Nothing is written: no crew-doc change,
// no request that is not a GET. The Board beside it still dims. The motion is
// the real-browser contract's (tests/browser/list-view.test.mjs); jsdom has no
// animate(), so this is the instant path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const TOKEN = 'listhighlightshell_01234'; // a made-up crew, never a real link
const DOC = {
  v: 4, meta: { name: 'The Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 }, Nhu: { colorIndex: 3 } },
  festivals: { [FID]: { selections: { 'Milli Meng': { Ross: 3 }, Galen: { Ross: 1, Nhu: 2 }, Soulwax: { Nhu: 4 }, Despacio: { Ross: 3 } } } },
};
// Every write to a crew (a boot's own person ping, /api/person, is not the
// highlight's and is left out).
const writes = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  if ((opts.method || 'GET') !== 'GET' && !u.startsWith('/api/person')) writes.push(`${opts.method} ${u.split('?')[0]}`);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/crew?')) return json(DOC);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'The Crew' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
    fn_welcome_v1: '1',
    fn_welcome_joined_v1: '1',
    [`fn_view_v1_${FID}`]: 'list',
  },
  fetch: network,
  now: '2026-09-25T16:00:00Z', // Friday 9 AM at Portola: nothing live, Thursday over
});
test.after(() => shell.close());
const { $, dom } = shell;
for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
await settle(100);
const state = await import('../js/state.js'); // the SAME instance the page booted

const wall = () => $('wall-root');
const room = (day, key) => wall().querySelector(`.day-block[data-day="${day}"] .room[data-room="${key}"]`);
const names = (el) => [...el.querySelectorAll('.card[data-artist]')].map((c) => c.dataset.artist);
const pop = () => document.querySelector('#dock-you-wrap .hl-pop');
const isOpen = () => !!pop() && pop().style.display !== 'none';
async function until(check, what, ms = 3000) {
  for (let t = 0; !check(); t += 5) {
    if (t > ms) assert.fail(`still waiting for ${what}`);
    await settle(5);
  }
}
async function pick(person) {
  if (!isOpen()) $('dock-you').click();
  await until(isOpen, 'the people menu');
  [...pop().querySelectorAll('[data-person]')].find((b) => b.dataset.person === person).click();
  await settle(40);
}

test('the phone reads the festival as a List', () => {
  assert.equal(wall().dataset.view, 'list');
  assert.ok(names(room('Saturday', ':fest')).length > 20, 'everyone’s rows to start with');
});

test('highlighting Ross in the List: his rows stay, the rest leave, the rooms he picked nothing in go quiet — and nothing is written', async () => {
  const doc = JSON.stringify(state.crewDoc);
  await pick('Ross');
  assert.deepEqual(names(room('Saturday', ':fest')), ['Despacio']);
  assert.deepEqual(names(room('Saturday', 'Afters')), ['Milli Meng', 'Galen']);
  const folsom = room('Saturday', 'Folsom');
  assert.ok(folsom.classList.contains('quiet'), 'Folsom is one quiet line');
  assert.equal(folsom.querySelector('.room-head .quiet-words').textContent, 'nothing Ross picked');
  assert.ok(isOpen(), 'the menu stays up while you choose');
  assert.equal(JSON.stringify(state.crewDoc), doc, 'the crew document is untouched');
  assert.deepEqual(writes, [], 'and nothing was written to the crew');
});

test('adding Nhu widens it (either of them picked it); Everyone brings every row back', async () => {
  await pick('Nhu');
  assert.ok(names(room('Saturday', ':fest')).includes('Soulwax'), 'Nhu’s Soulwax is back');
  assert.equal(room('Saturday', 'Folsom').querySelector('.room-head .quiet-words').textContent, 'nothing Ross or Nhu picked');
  await pick('');
  assert.ok(names(room('Saturday', ':fest')).length > 20, 'every row back');
  assert.equal(wall().querySelectorAll('.room.quiet').length, 0, 'no quiet rooms');
  assert.deepEqual(writes, []);
});

test('the Board beside it still dims, never hides', async () => {
  await pick('Ross');
  // Board, through the Show menu's view row.
  $('dock-fest-link').click();
  await settle(40);
  const board = document.querySelector('#dock-fest-wrap .sort-pop .view-row [data-view="board"]');
  board.click();
  await settle(200);
  assert.notEqual(wall().dataset.view, 'list');
  const soulwax = wall().querySelector('.card[data-artist="Soulwax"]');
  assert.ok(soulwax, 'Soulwax is on the Board');
  assert.ok(soulwax.classList.contains('dim'), 'dimmed, not hidden');
  assert.equal(wall().querySelectorAll('.room.quiet').length, 0);
  assert.deepEqual(writes, []);
});
