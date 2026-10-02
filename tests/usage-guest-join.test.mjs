// The guest's way in, counted (v108; the Claude review's L1 and L2). A crew
// link on a phone the crew does not know opens the wall as a guest; a click
// on a card asks on the join shelf. join_shelf says open, look (every way the
// question is dropped: Look around, the system Back) and joined — and the
// join's return into the wall is the same festival still on screen, not a
// second fest_view.
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
const GUEST = 'usageguestjoin_crew_0123'; // made up, never a real link
const KEY = 'phc_testkeyForFestivalNavigatorCI01';
let server = {
  v: 4, meta: { name: 'The Test Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } },
  festivals: { [FID]: { selections: { Robyn: { Maya: 2 } } } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  const method = opts.method || 'GET';
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u === '/api/person') {
    if (method === 'GET') return json({ error: 'nobody' }, 404);
    return json({ token: 'personusageguest_tok_0123', id: 'pid_usageguest1', doc: { v: 1, name: 'Maya', crews: {} } });
  }
  if (u.startsWith('/api/crew?')) {
    if (method !== 'GET') server = deepMerge(server, JSON.parse(opts.body).data || {});
    return json(server);
  }
  return json({ error: 'not in this test' }, 503);
}

const shell = await bootShell({ url: `https://fest.kevinhg.com/f/${FID}#g=${GUEST}&f=${FID}`, reportKey: KEY, fetch: network });
test.after(() => shell.close());
const usage = (name) => JSON.parse(globalThis.localStorage.getItem('fn_telemetry_q_v1') || '[]')
  .filter((x) => x.k === 'usage' && x.e.event === name).map((x) => x.e.properties);
const cardOf = (artist) => document.querySelector(`#wall-root .card[data-artist="${artist}"]`);
const clickCard = (artist) => { pointerClick(shell.dom.window, cardOf(artist), 'mouse'); };
const shelf = () => document.querySelector('.join-shelf');
const popped = () => new Promise((r) => shell.dom.window.addEventListener('popstate', () => setTimeout(r, 0), { once: true }));
await settle(160);

test('open, look (by Look around and by Back), open, joined — and one fest_view for the whole visit', async () => {
  clickCard('Robyn');
  await settle(10);
  assert.ok(shelf(), 'the join shelf');
  shelf().querySelector('.js-look').click();
  await settleUntil(() => !shelf() && !(history.state && history.state.joinShelf));
  await settle(10);
  clickCard('Robyn');
  await settle(10);
  assert.ok(shelf());
  const p = popped();
  history.back();
  await p;
  await settle(10);
  assert.equal(shelf(), null, 'Back took it down');
  clickCard('Robyn');
  await settle(10);
  [...shelf().querySelectorAll('.js-name')].find((b) => b.dataset.name === 'Maya').click();
  shelf().querySelector('.js-go').click();
  await settleUntil(() => !shelf(), { timeout: 3000 });
  await settle(2300); // usage reaches the queue two seconds after it happens
  assert.deepEqual(usage('join_shelf').map((e) => e.step), ['open', 'look', 'open', 'look', 'open', 'joined']);
  assert.deepEqual(usage('fest_view').map((e) => e.via), ['link'], 'the join came back through the wall: still one view');
  assert.equal(usage('first_paint').length, 1);
});
