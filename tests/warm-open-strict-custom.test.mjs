// A saved festival of the crew's OWN that this phone's custom list does not
// have yet (Codex round 3, residual #1): the round-3 warm open fell back to
// Portola, confirmed Portola as the saved choice before the customs arrived,
// and the arriving custom festival never got its place back. The strict warm
// open cannot paint it, so the cold path waits for the customs — and the
// crew's own festival opens, still the saved choice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, SCREENS, crewGet } from './helpers/warm-rig.mjs';

const TOKEN = 'warmstrictcustom_01234567'; // a made-up crew, never a real link
const CUSTOM = { ...FEST, id: 'crew-own-fest-2026', name: 'Backyard Fest' };
const net = heldNetwork();
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': INDEX,
  '/data/festivals/portola-2026.json': FEST,
});
const DOC = crewDoc({ Kevin: { colorIndex: 0 } }, {});
DOC.festivals = { [CUSTOM.id]: { selections: {} } };

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(DOC),
    [`fn_crew_fest_v3_${TOKEN}`]: CUSTOM.id,
    // no fn_custom_fests_v1 entry: this phone never stored the crew's own list
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const state = await import('../js/state.js');
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');

test('the crew’s own festival is not held here: the cold path waits', async () => {
  await settle(300);
  assert.deepEqual(shown(), []);
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), CUSTOM.id, 'nothing overwritten while waiting');
});

test('the customs arrive: the crew’s own festival opens, still the saved choice', async () => {
  net.release((h) => h.u === '/data/festivals/index.json', () => json(INDEX));
  net.release((h) => h.u.startsWith('/api/festival-add?'), () => json({ festivals: [CUSTOM] }));
  net.release(crewGet(TOKEN), () => json(DOC));
  await settle(100);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(state.activeFestivalId, CUSTOM.id);
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), CUSTOM.id);
});
