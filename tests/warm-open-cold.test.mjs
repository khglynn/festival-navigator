// The first open of a crew on this phone still waits for the network
// (2026-09-23). The warm open needs a copy of the crew doc AND a name this
// device claimed in it; without the doc there is nothing true to paint, so a
// hanging network keeps the loader up — exactly as before — and the wall
// arrives when the crew doc does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, SCREENS } from './helpers/warm-rig.mjs';

const TOKEN = 'warmcoldtest_0123456789ab'; // a made-up crew, never a real link
const net = heldNetwork();
// The worker holds the catalog and the festival: only the crew doc is missing.
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': INDEX,
  [`/data/festivals/${FID}.json`]: FEST,
});

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin', // claimed … but no cached doc
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');

test('no cached crew doc: the loader stays up while the network hangs', async () => {
  await settle(400);
  assert.deepEqual(shown(), [], 'no screen guessed from nothing');
  assert.ok($('screen-boot'), 'the loader is up');
  assert.ok(net.asked('/api/crew?'), 'the crew doc was asked for');
});

test('and the wall arrives with the crew doc', async () => {
  net.release((h) => h.u === '/data/festivals/index.json', () => json(INDEX));
  net.release((h) => h.u.startsWith('/api/festival-add?'), () => json({ festivals: [] }));
  net.release((h) => h.method === 'GET' && h.u.startsWith('/api/crew?'),
    () => json(crewDoc({ Kevin: { colorIndex: 0 } }, { Robyn: { Kevin: 3 } })));
  await settle(40);
  net.release((h) => h.u === `/data/festivals/${FID}.json`, () => json(FEST));
  await settle(60);
  assert.deepEqual(shown(), ['screen-app']);
});
