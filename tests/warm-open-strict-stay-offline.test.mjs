// Stay offline with a saved festival the cached catalog does not list
// (Codex round 3, residual #1): the round-3 warm open painted a provisional
// Portola wall, settled it on the cached list, confirmed Portola as the saved
// choice and said ACL "isn't in the lineup any more" — all false. The strict
// warm open cannot paint this wall, so it takes the ordinary path and waits;
// nothing is overwritten and nothing is announced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { INDEX, FEST, crewDoc, heldNetwork, cachesHolding, SCREENS, festFile } from './helpers/warm-rig.mjs';

const TOKEN = 'warmstrictoff_01234567890'; // a made-up crew, never a real link
const net = heldNetwork();
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': INDEX.filter((f) => f.id !== 'acl-2026'),
  '/data/festivals/portola-2026.json': FEST,
  '/data/festivals/acl-2026.json': festFile('acl-2026'),
});
const DOC = crewDoc({ Kevin: { colorIndex: 0 } }, {});
DOC.festivals['acl-2026'] = { selections: {} };

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_settings_v1: JSON.stringify({ stayOffline: true }),
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(DOC),
    [`fn_crew_fest_v3_${TOKEN}`]: 'acl-2026',
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');

test('no provisional wall, no overwritten choice, no false toast', async () => {
  await settle(400);
  assert.deepEqual(shown(), [], 'nothing painted that is not the wall the person left');
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), 'acl-2026', 'the saved choice untouched');
  assert.doesNotMatch($('toast-root').textContent, /isn’t in the lineup/);
});
