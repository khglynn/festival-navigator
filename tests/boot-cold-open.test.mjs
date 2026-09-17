// A cold open on one bar (2026-09-16). Boot used to wait on the festival
// index, THEN the crew doc (8 s budget), THEN the crew's custom festivals
// (8 s), THEN the festival file — with every screen display:none. On a
// festival network that hangs rather than fails, that was ~24 s of black
// page on a phone holding everything it needed. Now a loader is on screen
// from the first tick, the three requests leave together, and the custom
// festivals still merge only once the catalog is in (a custom must never
// shadow a canonical fest).
//
// The real shell boots against a network this file controls, one gate per
// request, so the ORDER is observable rather than inferred.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = 'coldopentest_0123456789'; // a made-up crew, never a real link
const FID = 'seismic-9';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const gates = {};
const gate = (name) => new Promise((open) => { gates[name] = open; });
const waits = { index: gate('index'), crew: gate('crew'), customs: gate('customs') };
const calls = [];

const DOC = {
  v: 4, meta: { name: 'Cold Open', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } },
  festivals: { [FID]: { selections: {} } },
};
// One custom tries to take a catalog fest's id; one is the crew's own.
const CUSTOMS = {
  festivals: [
    { id: FID, name: 'IMPOSTOR', status: 'lineup', artists: [] },
    { id: 'crew-own-fest', name: 'Backyard', year: '2026', status: 'lineup', artists: [{ name: 'The Neighbors' }] },
  ],
};

async function network(url) {
  const u = String(url);
  calls.push(u);
  if (u === '/data/festivals/index.json') { await waits.index; return json(INDEX); }
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/crew?')) { await waits.crew; return json(DOC); }
  if (u.startsWith('/api/festival-add?')) { await waits.customs; return json(CUSTOMS); }
  return json({ error: 'not in this test' }, 503);
}

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'Cold Open' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
  },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const festivals = await import('../js/festivals.js'); // the SAME instances app.js holds
const state = await import('../js/state.js');
const crew = await import('../js/crew.js');

const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const asked = (prefix) => calls.some((u) => u.startsWith(prefix));

test('a cold open: a loader at once, three requests together, customs merged only after the catalog', async () => {
  await settle(30);
  assert.deepEqual(shown(), [], 'no screen yet — boot is still waiting on the network');
  const boot = $('screen-boot');
  assert.ok(boot && boot.querySelector('.eq-loader'), 'but the page is not black: the loader is up');

  assert.ok(asked('/data/festivals/index.json'), 'the catalog left');
  assert.ok(asked('/api/crew?'), 'the crew doc left beside it — not after it');
  assert.ok(asked('/api/festival-add?'), 'and so did the crew\'s own festivals');

  gates.crew();
  gates.customs();
  await settle(30);
  assert.deepEqual(shown(), [], 'still waiting on the catalog');
  assert.equal(festivals.FESTIVALS[FID], undefined, 'the impostor was not merged ahead of the catalog');
  assert.ok(!festivals.FESTIVAL_INDEX.some((f) => f.custom), 'no custom joined a catalog that has not loaded');

  gates.index();
  for (let i = 0; i < 100 && !shown().length; i += 1) await settle(20);
  assert.deepEqual(shown(), ['screen-app'], 'the wall');
  assert.equal($('screen-boot'), null, 'the loader leaves when a screen arrives');
  assert.equal(state.fest().name, FEST.name, 'the catalog fest, from its own file');
  assert.ok(asked(`/data/festivals/${FID}.json`), 'fetched, not shadowed by the custom with its id');
  assert.ok(!festivals.FESTIVAL_INDEX.find((f) => f.id === FID).custom);
  assert.equal(festivals.FESTIVAL_INDEX.find((f) => f.id === 'crew-own-fest')?.custom, true, 'the crew\'s own fest joined the catalog');
});

test('the me-link fetch has a deadline like every other boot request', async () => {
  let init = null;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { init = opts; return json({ id: 'p', doc: {} }); };
  try {
    await crew.fetchPerson('persontokenfortest_0123456789');
  } finally {
    globalThis.fetch = real;
  }
  assert.ok(init && init.signal, 'an AbortSignal rides the request');
  assert.equal(init.headers['X-Person-Token'], 'persontokenfortest_0123456789', 'still header-only');
});
