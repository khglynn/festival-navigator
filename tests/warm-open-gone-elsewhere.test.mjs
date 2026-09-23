// A deleted crew's late 404 must not throw you off the crew you are in now
// (Codex review, 2026-09-23, finding 4). Warm-open crew A (its first poll
// hangs), open crew B, then A's poll finally answers "Crew not found". A is
// forgotten on this device — but B is on screen and stays there; the landing
// only takes over when the gone crew is the one you are looking at.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, within, SCREENS, crewGet } from './helpers/warm-rig.mjs';

const A = 'warmgoneaaa_0123456789ab'; // made-up crews, never real links
const B = 'warmgonebbb_0123456789ab';
const net = heldNetwork();
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': INDEX,
  [`/data/festivals/${FID}.json`]: FEST,
});
const doc = crewDoc({ Kevin: { colorIndex: 0 } }, { Robyn: { Kevin: 1 } });

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${A}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: A, name: '' }, { token: B, name: '' }]),
    [`fn_me_v3_${A}`]: 'Kevin',
    [`fn_crew_doc_v3_${A}`]: JSON.stringify(doc),
    [`fn_crew_fest_v3_${A}`]: FID,
    [`fn_me_v3_${B}`]: 'Kevin',
    [`fn_crew_doc_v3_${B}`]: JSON.stringify(doc),
    [`fn_crew_fest_v3_${B}`]: FID,
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const state = await import('../js/state.js');
const crew = await import('../js/crew.js');
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');

test('crew A opens warm, then crew B', async () => {
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null);
  assert.equal(state.getCrewToken(), A);
  location.hash = `#g=${B}`;
  assert.notEqual(await within(1500, () => state.getCrewToken() === B && shown().includes('screen-app')), null);
});

test('A’s late "Crew not found" forgets A — and leaves B on screen', async () => {
  assert.equal(net.release(crewGet(A), () => json({ error: 'Crew not found' }, 404)), 1);
  await settle(40);
  assert.ok(!crew.knownCrews().some((c) => c.token === A), 'A is forgotten on this device');
  assert.equal(state.getCrewToken(), B, 'B is still the crew');
  assert.deepEqual(shown(), ['screen-app'], 'and still on screen — no jump to the landing');
  assert.doesNotMatch($('toast-root').textContent, /no longer works/, 'no alarm about a crew you are not looking at');
});
