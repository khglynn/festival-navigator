// A warm open of a crew that no longer exists (2026-09-23). The wall paints
// from this phone's copy at once — and when our API finally answers "Crew not
// found" (a JSON 404), the crew-gone path still runs: forgotten on this
// device, back to the festival list, said plainly. A platform 404 (an HTML
// body: a broken deploy, a stale worker) is NOT that answer and must never
// forget a crew — crew.isApiNotFound exists for exactly this.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, within, SCREENS } from './helpers/warm-rig.mjs';

const TOKEN = 'warmgonetest_0123456789ab'; // a made-up crew, never a real link
const net = heldNetwork();
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': INDEX,
  [`/data/festivals/${FID}.json`]: FEST,
});

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(crewDoc({ Kevin: { colorIndex: 0 } }, { Robyn: { Kevin: 1 } })),
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const crew = await import('../js/crew.js');
const sync = await import('../js/sync.js');
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const crewGet = (h) => h.method === 'GET' && h.u.startsWith('/api/crew?');

test('the wall paints first, from the cache', async () => {
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null);
});

test('a platform 404 (HTML) is not our API speaking — the crew stays', async () => {
  assert.equal(net.release(crewGet, () => new Response('<h1>404</h1>', { status: 404, headers: { 'Content-Type': 'text/html' } })), 1);
  await settle(30);
  assert.deepEqual(shown(), ['screen-app'], 'still on the wall');
  assert.ok(crew.knownCrews().some((c) => c.token === TOKEN), 'still remembered');
});

test('our API saying "Crew not found" takes the crew-gone path', async () => {
  sync.pollSync(); // the next poll (the 25 s loop, or coming back to the tab)
  await settle(10);
  assert.equal(net.release(crewGet, () => json({ error: 'Crew not found' }, 404)), 1);
  await settle(40);
  assert.deepEqual(shown(), ['screen-landing'], 'back to the festival list');
  assert.ok(!crew.knownCrews().some((c) => c.token === TOKEN), 'forgotten on this device');
  assert.match($('toast-root').textContent, /no longer works/, 'and said plainly');
});
