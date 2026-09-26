// Review round 3 (2026-09-26). Three ways a join, or a member, could come
// apart, walked through the real shell:
//
//   a member whose storage reads start failing after the wall painted keeps
//   WRITING — "guest" is a fact set when the session entered as one, never
//   re-read from storage, so a hiccup cannot silently stop a member's picks;
//
//   a join whose network fails is entered with the doors held until the entry
//   has settled — no second answer can land and take the promised pick;
//
//   a join whose POST never settles is let go at a deadline: the doors open,
//   the person is in on this phone (the offline join), and the app says so.
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

// Made-up crews, never real links; built into URLs, never written after `#g=`.
const MEMBER = 'firstopenhold_member_012';
const OFFL = 'firstopenhold_offl_01234';
const HANG = 'firstopenhold_hang_01234';
const crewDoc = (people, selections = {}) => ({
  v: 4, meta: { name: 'Hold Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people, festivals: { [FID]: { selections } },
});
const SERVER = {
  [MEMBER]: crewDoc({ Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } }, { Robyn: { Maya: 2 } }),
  [OFFL]: crewDoc({ Kevin: { colorIndex: 0 } }, { Robyn: { Kevin: 2 } }),
  [HANG]: crewDoc({ Kevin: { colorIndex: 0 } }, { Robyn: { Kevin: 2 } }),
};

const writes = [];
let slowEntry = false; // the join's entry takes its time, so the join screen is still up while it runs
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const never = (signal) => new Promise((_, reject) => {
  if (signal) signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
});
async function network(url, opts = {}) {
  const u = String(url);
  const method = opts.method || 'GET';
  if (method !== 'GET') writes.push({ method, url: u, body: opts.body ? JSON.parse(opts.body) : null });
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) {
    if (slowEntry && u.includes(OFFL)) await new Promise((r) => setTimeout(r, 300));
    return json({ festivals: [] });
  }
  if (u === '/api/person') return json({ error: 'not in this test' }, 503);
  if (u.startsWith('/api/crew?')) {
    const t = new URL(u, 'https://x').searchParams.get('t');
    if (!SERVER[t]) return json({ error: 'Crew not found' }, 404);
    if (method !== 'GET') {
      if (t === OFFL) throw new TypeError('Failed to fetch'); // no signal: the offline join
      if (t === HANG) return never(opts.signal); // a request that never settles
      SERVER[t] = deepMerge(SERVER[t], JSON.parse(opts.body).data || {});
    }
    return json(SERVER[t]);
  }
  return json({ error: 'not in this test' }, 503);
}

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${MEMBER}&f=${FID}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: MEMBER, name: '' }]),
    [`fn_me_v3_${MEMBER}`]: 'Kevin',
    [`fn_crew_fest_v3_${MEMBER}`]: FID,
  },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const state = await import('../js/state.js');
const crew = await import('../js/crew.js');
const cardOf = (artist) => document.querySelector(`#wall-root .card[data-artist="${artist}"]`);
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shownScreens = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const crewWrites = (t) => writes.filter((w) => w.url.startsWith('/api/crew') && w.url.includes(t));
async function open(hash) { location.hash = hash; await settle(160); }
// The join shelf (a guest is asked over the wall).
const shelf = () => document.querySelector('.join-shelf');
const shelfChip = (name) => [...shelf().querySelectorAll('.js-name')].find((b) => b.dataset.name === name);
const shelfGo = () => shelf().querySelector('.js-go');
const typeName = (v) => { const f = shelf().querySelector('.js-field'); f.value = v; f.dispatchEvent(new shell.dom.window.Event('input')); };
const clickCard = (artist) => {
  const c = cardOf(artist);
  c.dispatchEvent(new shell.dom.window.PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
  c.dispatchEvent(new shell.dom.window.PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }));
  c.click();
};

await settle(160);

test('a member whose storage reads start failing after the wall painted keeps their name and keeps picking — and every pick sends', async () => {
  assert.equal($('dock-you').textContent, 'K', 'Kevin’s wall');
  const getItem = localStorage.getItem;
  localStorage.getItem = () => { throw new Error('SecurityError: storage went away'); };
  try {
    // A mouse's clicks, press and all (clickCard): since the tap change a
    // click with no press of its own is an assistive activation, which opens
    // the card rather than picking — this case is about picking.
    clickCard('Soulwax');
    assert.equal(crew.me(MEMBER), 'Kevin', 'a failed read answers with the name this page knows');
    assert.equal($('dock-you').textContent, 'K', 'still Kevin on the wall after the repaint');
    assert.ok(!$('dock-you').classList.contains('guest'), 'never turned into a guest');
    clickCard('Soulwax'); // and keeps picking: the second click is a 2
    assert.deepEqual(shownScreens(), ['screen-app'], 'no join screen');
    await settle(1500); // past the push debounce
    const sent = crewWrites(MEMBER).filter((w) => w.body && w.body.data && w.body.data.festivals);
    assert.ok(sent.length, 'the picks left the phone');
    assert.equal(SERVER[MEMBER].festivals[FID].selections.Soulwax.Kevin, 2, 'and the crew has both taps');
  } finally {
    localStorage.getItem = getItem;
  }
});

test('an offline join is entered with the doors held — no second answer takes the promised pick', async () => {
  await open(`#g=${OFFL}&f=${FID}`);
  assert.equal(crew.me(OFFL), null, 'a guest');
  clickCard('Robyn');
  await settle(10);
  assert.ok(shelf(), 'the question is up');
  typeName('Sam');
  slowEntry = true;
  shelfGo().click(); // the POST fails at once; entry takes ~300 ms
  await settle(60);
  assert.ok(shelf(), 'still entering');
  const kevin = shelfChip('Kevin');
  assert.equal(kevin.disabled, true, 'still held while the offline entry runs');
  kevin.click();
  shelfGo().click();
  await settle(600);
  slowEntry = false;
  assert.equal(crew.me(OFFL), 'Sam');
  const robyn = state.crewDoc.festivals[FID].selections.Robyn;
  assert.equal(robyn.Sam, 1, 'Robyn is Sam’s first pick');
  assert.equal(robyn.Kevin, 2, 'and Kevin’s own level is untouched');
  assert.match($('toast-root').textContent, /You’re in on this phone/, 'said plainly: the crew has not seen them yet');
});

test('a join that never answers is let go at the deadline: the doors open and the person is in on this phone', async () => {
  await open(`#g=${HANG}&f=${FID}`);
  clickCard('Robyn');
  await settle(10);
  typeName('Tia');
  const go = shelfGo();
  go.click();
  await settle(200);
  assert.equal(go.disabled, true, 'waiting on the answer');
  await settle(12500); // JOIN_DEADLINE_MS (12 s) and a beat
  assert.equal(shelf(), null, 'never held shut for good: the shelf went down and the wall is theirs');
  assert.equal(crew.me(HANG), 'Tia', 'in on this phone');
  assert.equal(state.crewDoc.festivals[FID].selections.Robyn.Tia, 1, 'with Robyn, as promised');
  assert.match($('toast-root').textContent, /You’re in on this phone/);
});
