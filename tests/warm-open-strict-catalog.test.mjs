// The warm open is STRICT (2026-09-23, round 4 — the coordinator's call the
// day before the festival: fewer moving parts beats clever reconciliation).
// It paints only EXACTLY the wall the person left: a claimed name, the crew's
// cached doc, the saved festival IN the cached catalog, and that festival's
// file in the cache. Anything missing takes the ordinary cold path.
//
// Here the saved festival is ACL and the cached catalog does not list it (it
// is older than the live one). The warm open used to paint a provisional
// Portola wall and correct itself later — a correction that could re-aim a
// half-typed note into ACL (Codex round 3, new A) and confirm the fallback
// before anything authoritative arrived (residual #1). Now there is no
// provisional wall at all: the loader waits for the network, as main did,
// and ACL opens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, SCREENS, festFile, fileGet, crewGet } from './helpers/warm-rig.mjs';

const TOKEN = 'warmstrictcat_01234567890'; // a made-up crew, never a real link
const ACL = festFile('acl-2026');
const STALE_INDEX = INDEX.filter((f) => f.id !== 'acl-2026');
const net = heldNetwork();
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': STALE_INDEX,
  '/data/festivals/portola-2026.json': FEST,
  '/data/festivals/acl-2026.json': ACL,
});
const DOC = crewDoc({ Kevin: { colorIndex: 0 } }, {});
DOC.festivals['acl-2026'] = { selections: { 'Charli xcx': { Kevin: 4 } } };

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

test('the saved festival is not in the cached catalog: no provisional wall — the cold path waits', async () => {
  await settle(300);
  assert.deepEqual(shown(), [], 'no wall painted from a list that cannot show what was left');
  assert.ok($('screen-boot'), 'the loader is up');
  assert.ok(net.asked('/api/crew?'), 'the cold path asked for the crew doc');
  assert.doesNotMatch($('toast-root').textContent, /isn’t in the lineup/, 'and accused nothing');
});

test('the network answers: ACL opens, the saved choice untouched', async () => {
  net.release((h) => h.u === '/data/festivals/index.json', () => json(INDEX));
  net.release((h) => h.u.startsWith('/api/festival-add?'), () => json({ festivals: [] }));
  net.release(crewGet(TOKEN), () => json(DOC));
  await settle(60);
  net.release(fileGet('acl-2026'), () => json(ACL));
  await settle(80);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(state.activeFestivalId, 'acl-2026');
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), 'acl-2026');
  assert.doesNotMatch($('toast-root').textContent, /isn’t in the lineup/);
});
