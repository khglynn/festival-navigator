// Strict warm open, the festival file piece (2026-09-23, round 4): the saved
// festival is in the cached catalog but its file is not in the cache, so the
// exact wall cannot be painted — the ordinary cold path runs (the crew doc,
// the catalog and the customs asked for together, the loader up), and the
// wall arrives when the network answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, SCREENS, fileGet, crewGet } from './helpers/warm-rig.mjs';

const TOKEN = 'warmstrictfile_0123456789'; // a made-up crew, never a real link
const net = heldNetwork();
globalThis.caches = cachesHolding({ '/data/festivals/index.json': INDEX }); // no festival file
const DOC = crewDoc({ Kevin: { colorIndex: 0 } }, { Robyn: { Kevin: 2 } });

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(DOC),
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');

test('the festival file is not cached: the cold path, loader up, crew doc asked', async () => {
  await settle(300);
  assert.deepEqual(shown(), []);
  assert.ok(net.asked('/api/crew?'), 'the cold path asks for the crew doc up front');
});

test('and the wall arrives with the network', async () => {
  net.release((h) => h.u === '/data/festivals/index.json', () => json(INDEX));
  net.release((h) => h.u.startsWith('/api/festival-add?'), () => json({ festivals: [] }));
  net.release(crewGet(TOKEN), () => json(DOC));
  await settle(60);
  net.release(fileGet(FID), () => json(FEST));
  await settle(80);
  assert.deepEqual(shown(), ['screen-app']);
});
