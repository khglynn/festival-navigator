// "Stay offline" is the field escape hatch (2026-09-23): one bar, the app
// crawling — flip it and the next open is instant, straight from this phone,
// without asking the network for anything it can do without. It used to gate
// sync only; boot still waited on the catalog, the crew doc and the crew's
// custom festivals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, within, SCREENS, fileGet } from './helpers/warm-rig.mjs';

const TOKEN = 'warmstayofftest_012345678'; // a made-up crew, never a real link
const net = heldNetwork();
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': INDEX,
  [`/data/festivals/${FID}.json`]: FEST,
});

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_settings_v1: JSON.stringify({ stayOffline: true }),
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(crewDoc({ Kevin: { colorIndex: 0 } }, { Robyn: { Kevin: 1 } })),
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');

test('Stay offline opens straight from the phone', async () => {
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null);
});

test('and asks the network for nothing it can do without', async () => {
  await settle(100);
  for (const path of ['/api/crew?', '/api/festival-add?', '/data/festivals/']) {
    assert.ok(!net.asked(path), `no request to ${path} (asked: ${net.calls.join(', ') || 'nothing'})`);
  }
  assert.match(document.querySelector('.sync-dot').className, /sync-offline/, 'and the dot says offline');
});

// Codex review, 2026-09-23, finding 5b: switching it back OFF resumed crew
// sync but never started the festival refresh the open had skipped — a data
// push stayed invisible until a reload.
test('switching Stay offline back off starts the refresh the open skipped', async () => {
  const state = await import('../js/state.js');
  $('gear-btn').click();
  await settle(10);
  $('settings-root').querySelector('button[role="switch"][aria-label="Stay offline"]').click();
  await settle(20);
  assert.ok(net.asked(`/data/festivals/${FID}.json`), 'the live festival file is asked for now');
  const pushed = { ...FEST, artists: [...FEST.artists, { name: 'Back Online Fresh Act' }] };
  net.release((h) => h.u === '/data/festivals/index.json', () => json(INDEX));
  net.release(fileGet(FID), () => json(pushed));
  await settle(60);
  assert.ok(state.fest().artists.some((a) => a.name === 'Back Online Fresh Act'), 'and the data push lands');
});
