// The warm open paints from the catalog this phone cached — and that copy can
// be older than the live one (Codex review, 2026-09-23, finding 1). This
// device's saved festival is ACL; the cached catalog does not list ACL yet;
// the live one does. The warm open has to paint SOMETHING at once, so it
// opens the fallback — but it must not tell the person ACL "isn't in the
// lineup any more" on the word of a stale list, and when the live catalog
// lands it must open ACL, the festival they chose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, within, SCREENS, festFile, fileGet } from './helpers/warm-rig.mjs';

const TOKEN = 'warmcatalogadd_0123456789'; // a made-up crew, never a real link
const ACL = festFile('acl-2026');
const STALE_INDEX = INDEX.filter((f) => f.id !== 'acl-2026');
const net = heldNetwork();
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': STALE_INDEX,
  '/data/festivals/portola-2026.json': FEST,
  '/data/festivals/acl-2026.json': ACL,
});
const DOC = crewDoc({ Kevin: { colorIndex: 0 } }, {});
DOC.festivals['acl-2026'] = { selections: { 'Sabrina Carpenter': { Kevin: 4 } } };

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(DOC),
    [`fn_crew_fest_v3_${TOKEN}`]: 'acl-2026',
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const state = await import('../js/state.js');
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');

test('the warm open paints at once from the stale catalog — and does not call ACL gone on its word', async () => {
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null);
  assert.doesNotMatch($('toast-root').textContent, /isn’t in the lineup/, 'no accusation from a stale list');
});

test('the live catalog lands: the festival this device chose opens', async () => {
  assert.equal(net.release((h) => h.u === '/data/festivals/index.json', () => json(INDEX)), 1);
  await settle(60);
  net.release(fileGet('acl-2026'), () => json(ACL)); // if it had to ask the network for the file
  await settle(60);
  assert.equal(state.activeFestivalId, 'acl-2026', 'ACL, as saved');
  assert.match($('fest-name').textContent, /ACL/i, 'and the wall says so');
  assert.doesNotMatch($('toast-root').textContent, /isn’t in the lineup/);
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), 'acl-2026', 'the saved choice was never overwritten');
});
