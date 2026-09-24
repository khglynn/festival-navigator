// A data push must not be thrown away because you looked at another festival
// first (Codex review, 2026-09-23, finding 2). The warm open paints Portola
// from cache and asks the network for the live file; before it answers, the
// person switches to ACL in Settings. The fresh Portola file then arrives —
// and used to be dropped, because Portola was no longer on screen. Switching
// back reused the cached copy: new set times invisible until a reload. The
// fresh file is kept whichever festival is on screen; only the repaint waits
// for it to be the one showing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, within, SCREENS, festFile, buttonMatching, fileGet } from './helpers/warm-rig.mjs';

const TOKEN = 'warmswitchtest_0123456789'; // a made-up crew, never a real link
const ACL = festFile('acl-2026');
const FRESH_ACT = 'Switch Test Fresh Act';
const net = heldNetwork();
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': INDEX,
  [`/data/festivals/${FID}.json`]: FEST,
});
const DOC = crewDoc({ Kevin: { colorIndex: 0 } }, { Robyn: { Kevin: 2 } });
DOC.festivals['acl-2026'] = { selections: {} };

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
const state = await import('../js/state.js');
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
async function switchTo(name, id) {
  $('gear-btn').click();
  await settle(10);
  buttonMatching($('settings-root'), name).click();
  await settle(10);
  net.release(fileGet(id), () => json(id === 'acl-2026' ? ACL : FEST)); // only if it had to ask
  await settle(60);
}

test('warm open on Portola, then over to ACL before Portola’s live file answers', async () => {
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null);
  await switchTo(/^ACL MUSIC FESTIVAL/, 'acl-2026');
  assert.equal(state.activeFestivalId, 'acl-2026');
});

test('the live Portola file lands while ACL is on screen — and is kept, not dropped', async () => {
  const pushed = { ...FEST, artists: [...FEST.artists, { name: FRESH_ACT }] };
  assert.equal(net.release(fileGet(FID), () => json(pushed)), 1);
  await settle(40);
  assert.equal(state.activeFestivalId, 'acl-2026', 'nothing yanked: ACL stays on screen');
  assert.ok(state.FESTIVALS[FID].artists.some((a) => a.name === FRESH_ACT), 'the fresh Portola file is the one held');
});

test('back on Portola: the new data is there without a reload', async () => {
  await switchTo(/^PORTOLA/, FID);
  assert.equal(state.activeFestivalId, FID);
  assert.match($('wall-root').textContent, new RegExp(FRESH_ACT));
});
