// A crew's own (custom, AI-added) festival changes on the server while the
// warm open shows the copy this phone kept (Codex review, 2026-09-23, finding
// 3). The fresh list used to replace the festival object and leave the wall
// — and the days computed from the old copy — as they were: 8:00 PM on the
// server, 9:00 PM on screen. A changed custom festival now takes the same
// path a canonical data push takes: its days forgotten, theme and wall
// repainted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, within, SCREENS } from './helpers/warm-rig.mjs';

const TOKEN = 'warmcustomtest_0123456789'; // a made-up crew, never a real link
const CUSTOM_ID = 'crew-own-fest-2026';
const OLD = { ...FEST, id: CUSTOM_ID, name: 'Backyard Fest' };
const moveDogBlood = (fest, time) => ({
  ...fest,
  days: Object.fromEntries(Object.entries(fest.days).map(([day, d]) => [day, {
    ...d, artists: d.artists.map((a) => (a.name === 'Dog Blood' ? { ...a, time } : a)),
  }])),
});
const NEW = moveDogBlood(OLD, '8:00 PM - 9:15 PM');
const net = heldNetwork();
globalThis.caches = cachesHolding({ '/data/festivals/index.json': INDEX });
const DOC = crewDoc({ Kevin: { colorIndex: 0 } }, {});
DOC.festivals = { [CUSTOM_ID]: { selections: {} } };

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(DOC),
    [`fn_crew_fest_v3_${TOKEN}`]: CUSTOM_ID,
    [`fn_custom_fests_v1_${TOKEN}`]: JSON.stringify([OLD]),
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const state = await import('../js/state.js');
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const dogBlood = () => [...$('wall-root').querySelectorAll('.card[data-artist="Dog Blood"]')].map((c) => c.textContent).join(' | ');

test('the warm open paints the crew’s own festival from this phone’s copy', async () => {
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null);
  assert.equal(state.activeFestivalId, CUSTOM_ID);
  assert.match(dogBlood(), /9:00/, 'Dog Blood at 9:00, as last stored');
});

test('the fresh copy moved Dog Blood to 8:00 — the wall says 8:00', async () => {
  net.release((h) => h.u === '/data/festivals/index.json', () => json(INDEX));
  await settle(20);
  assert.equal(net.release((h) => h.u.startsWith('/api/festival-add?'), () => json({ festivals: [NEW] })), 1);
  await settle(60);
  assert.match(dogBlood(), /8:00/, 'the wall shows the live time');
  assert.doesNotMatch(dogBlood(), /9:00 PM/, 'and not the old one');
});
