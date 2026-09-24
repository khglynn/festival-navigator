// A superseded boot must not render over a newer one (Codex round 4,
// inherited from main, 2026-09-23). The `#new` page and the landing each
// await the catalog before rendering; if the person has moved on to a crew
// meanwhile and its wall has painted, the old boot's late catalog used to
// throw the create page or the landing over that wall while the crew stayed
// active underneath. Every branch checks it is still the current boot after
// its await.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, within, SCREENS } from './helpers/warm-rig.mjs';

const TOKEN = 'bootstaleentry_0123456789'; // a made-up crew, never a real link
const net = heldNetwork();
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': INDEX,
  [`/data/festivals/${FID}.json`]: FEST,
});

const shell = await bootShell({
  url: 'https://fest.kevinhg.com/#new',
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
const state = await import('../js/state.js');
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const index = (h) => h.u === '/data/festivals/index.json';

test('#new waits on its catalog; the person opens their crew meanwhile — the wall paints', async () => {
  await settle(20);
  assert.deepEqual(shown(), [], '#new is waiting for the catalog');
  location.hash = `#g=${TOKEN}`;
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null);
});

test('the old #new boot’s catalog lands late: the wall stays', async () => {
  net.release(index, () => json(INDEX));
  await settle(40);
  assert.deepEqual(shown(), ['screen-app'], 'no create page thrown over the newer wall');
  assert.equal(state.getCrewToken(), TOKEN);
});

test('the same for the landing: back to the list, then straight into the crew again', async () => {
  location.hash = '';               // a later boot with no crew link: the landing waits on the catalog
  await settle(20);
  location.hash = `#g=${TOKEN}`;    // … and the person is already back in their crew
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null);
  net.release(index, () => json(INDEX)); // the landing boot's catalog lands late
  await settle(40);
  assert.deepEqual(shown(), ['screen-app'], 'no landing thrown over the newer wall');
});
