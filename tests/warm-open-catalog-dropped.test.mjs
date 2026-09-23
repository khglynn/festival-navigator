// The converse of warm-open-catalog-added (Codex review, 2026-09-23, finding
// 1): the cached catalog still lists a festival the live one has dropped, and
// it is this device's saved festival. The warm open paints it from cache —
// and when the live catalog lands, it moves to a festival that exists and
// says why, in the words a cold open uses. Its picks stay in the doc (the
// merge never deletes; the fest coming back brings them back).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, within, SCREENS } from './helpers/warm-rig.mjs';

const TOKEN = 'warmcatalogdrop_012345678'; // a made-up crew, never a real link
const GONE = { ...FEST, id: 'vanishing-fest-2026', name: 'Vanishing Fest' };
const STALE_INDEX = [{ id: GONE.id, name: GONE.name, year: '2026', status: 'lineup', startsOn: '2026-09-20' }, ...INDEX];
const net = heldNetwork();
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': STALE_INDEX,
  '/data/festivals/portola-2026.json': FEST,
  [`/data/festivals/${GONE.id}.json`]: GONE,
});
const DOC = crewDoc({ Kevin: { colorIndex: 0 } }, {});
DOC.festivals[GONE.id] = { selections: { Robyn: { Kevin: 1 } } };

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(DOC),
    [`fn_crew_fest_v3_${TOKEN}`]: GONE.id,
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const state = await import('../js/state.js');
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');

test('the warm open paints the saved festival from cache', async () => {
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null);
  assert.equal(state.activeFestivalId, GONE.id);
});

test('the live catalog dropped it: a real festival opens, and the toast says why', async () => {
  assert.equal(net.release((h) => h.u === '/data/festivals/index.json', () => json(INDEX)), 1);
  await settle(80);
  assert.equal(state.activeFestivalId, 'portola-2026', 'the fallback a cold open would pick');
  assert.match($('fest-name').textContent, /PORTOLA/);
  assert.match($('toast-root').textContent, /Vanishing Fest isn’t in the lineup any more — opened Portola instead\. Its picks are still saved\./);
  // Exactly what an ordinary open does with the same catalog: the invite's
  // festival (the doc's inviteFestId, Portola) opened, so it becomes the
  // saved one — decided on the LIVE list, never on the cached one.
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), 'portola-2026', 'confirmed as a cold open would');
  assert.equal(state.crewDoc.festivals[GONE.id].selections.Robyn.Kevin, 1, 'its picks are still in the doc');
});
