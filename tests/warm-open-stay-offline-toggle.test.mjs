// "Stay offline" switched ON while a warm open's network reads are still out
// (Codex review, 2026-09-23, finding 5a). The setting is read at every late
// continuation, not once at boot: the catalog answering late must not start
// a fresh customs request, and the crew poll answering late may land its
// data but must not turn the dot back to online — the person asked for
// offline, and offline is what the dot says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, within, SCREENS, crewGet } from './helpers/warm-rig.mjs';

const TOKEN = 'warmstaytoggle_0123456789'; // a made-up crew, never a real link
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
const state = await import('../js/state.js');
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const dot = () => document.querySelector('.sync-dot').className;

test('warm open with the network out, then Stay offline switched on', async () => {
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null);
  assert.ok(net.asked('/api/crew?'), 'the crew poll is out');
  $('gear-btn').click();
  await settle(10);
  $('settings-root').querySelector('button[role="switch"][aria-label="Stay offline"]').click();
  await settle(10);
  assert.match(dot(), /sync-offline/);
});

test('the late catalog does not start a customs request', async () => {
  const before = net.calls.filter((c) => c.includes('/api/festival-add?')).length;
  net.release((h) => h.u === '/data/festivals/index.json', () => json(INDEX));
  await settle(40);
  assert.equal(net.calls.filter((c) => c.includes('/api/festival-add?')).length, before, 'no new request while offline was asked for');
});

test('the late crew poll lands its data, and the dot stays offline', async () => {
  const fresh = crewDoc({ Kevin: { colorIndex: 0 }, Kat: { colorIndex: 2 } }, { Robyn: { Kevin: 1 }, Soulwax: { Kat: 4 } });
  assert.equal(net.release(crewGet(TOKEN), () => json(fresh)), 1);
  await settle(40);
  assert.equal(state.crewDoc.festivals[FID].selections.Soulwax.Kat, 4, 'what arrived is kept');
  assert.match(dot(), /sync-offline/, 'offline, as asked');
});
