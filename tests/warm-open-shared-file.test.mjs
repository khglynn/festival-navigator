// A festival file is shared by every crew at that festival, so a fresh copy
// must repaint whichever wall is SHOWING that festival — not only the crew
// whose open asked for it (Codex round 3, new B). Crew A opens warm on
// Portola and asks for the live file; you open crew B, also on Portola, and
// it asks too. A's answer lands first with Dog Blood moved to 8:00: it used
// to update the shared data without a repaint (A was no longer on screen),
// and B's identical answer then changed nothing — B's wall said 9:00 while
// the data said 8:00.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, within, SCREENS, fileGet } from './helpers/warm-rig.mjs';

const A = 'warmsharedaaa_0123456789a'; // made-up crews, never real links
const B = 'warmsharedbbb_0123456789b';
const moveDogBlood = (fest, time) => ({
  ...fest,
  days: Object.fromEntries(Object.entries(fest.days).map(([day, d]) => [day, {
    ...d, artists: d.artists.map((a) => (a.name === 'Dog Blood' ? { ...a, time } : a)),
  }])),
});
const EIGHT = moveDogBlood(FEST, '8:00 PM - 9:15 PM');
const net = heldNetwork();
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': INDEX,
  [`/data/festivals/${FID}.json`]: FEST,
});
const doc = crewDoc({ Kevin: { colorIndex: 0 } }, {});

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${A}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: A, name: '' }, { token: B, name: '' }]),
    [`fn_me_v3_${A}`]: 'Kevin',
    [`fn_crew_doc_v3_${A}`]: JSON.stringify(doc),
    [`fn_crew_fest_v3_${A}`]: FID,
    [`fn_me_v3_${B}`]: 'Kevin',
    [`fn_crew_doc_v3_${B}`]: JSON.stringify(doc),
    [`fn_crew_fest_v3_${B}`]: FID,
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const state = await import('../js/state.js');
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const dogBlood = () => [...$('wall-root').querySelectorAll('.card[data-artist="Dog Blood"]')].map((c) => c.textContent).join(' | ');

test('A opens warm on Portola, then B, also on Portola — both ask for the live file', async () => {
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null);
  location.hash = `#g=${B}`;
  assert.notEqual(await within(1500, () => state.getCrewToken() === B && shown().includes('screen-app')), null);
  assert.equal(net.calls.filter((c) => c.endsWith(`/data/festivals/${FID}.json`)).length, 2);
  assert.match(dogBlood(), /9:00/);
});

test('A’s fresh file lands first: B’s wall — the one showing Portola — says 8:00', async () => {
  assert.equal(net.releaseFirst(fileGet(FID), () => json(EIGHT)), 1);
  await settle(40);
  assert.match(dogBlood(), /8:00/, 'the wall showing that festival repainted');
  assert.equal(net.releaseFirst(fileGet(FID), () => json(EIGHT)), 1, 'B’s identical answer');
  await settle(40);
  assert.match(dogBlood(), /8:00/);
});
