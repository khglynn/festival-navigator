// A phone left open on the wall sees a set-times drop when it comes back to
// the app (v116, LEDGER follow-up 52). The festival file was refreshed on a
// warm open only, so a phone that stayed open — the normal state of a phone
// in a pocket all week — kept the file it booted with until it was closed
// and opened again. EDC Orlando's and Seismic's set times land in the weeks
// before each, while friends' phones sit open on the lineup.
//
// Now coming back to the page (visibilitychange → visible) asks for the file
// again, at most once in five minutes, never under Stay offline, never while
// something is in progress; a changed file repaints the wall the way any
// data push does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, within, SCREENS, fileGet } from './helpers/warm-rig.mjs';

const TOKEN = 'resumefestfile_0123456789'; // a made-up crew, never a real link
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
// The clock the throttle reads, moved forward on demand. Only Date.now: the
// wall's own sense of time (new Date()) stays where it is.
const realNow = Date.now;
let ahead = 0;
Date.now = () => realNow.call(Date) + ahead;
test.after(() => { Date.now = realNow; shell.close(); delete globalThis.caches; });
const { $, dom } = shell;
const state = await import('../js/state.js');
const asks = () => net.calls.filter((c) => c === `GET /data/festivals/${FID}.json`).length;
const resume = async () => {
  Object.defineProperty(dom.window.document, 'visibilityState', { value: 'hidden', configurable: true });
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
  Object.defineProperty(dom.window.document, 'visibilityState', { value: 'visible', configurable: true });
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
  await settle(20);
};
const FRESH = 'Resume Fresh Act';

test('the warm open asks for the file once, as before', async () => {
  assert.notEqual(await within(1500, () => SCREENS.filter((id) => $(id).style.display !== 'none').includes('screen-app')), null, 'the wall');
  await settle(30);
  assert.equal(asks(), 1);
  net.release(fileGet(FID), () => json(FEST)); // nothing changed yet
  await settle(20);
});

test('a resume inside five minutes of the last ask does nothing', async () => {
  ahead = 4 * 60 * 1000;
  await resume();
  assert.equal(asks(), 1, 'no second ask');
});

test('a resume under Stay offline asks nothing, however long it has been', async () => {
  ahead = 10 * 60 * 1000;
  globalThis.localStorage.setItem('fn_settings_v1', JSON.stringify({ stayOffline: true }));
  try {
    await resume();
    assert.equal(asks(), 1);
  } finally {
    globalThis.localStorage.removeItem('fn_settings_v1');
  }
});

test('a resume while something is in progress waits for the next one', async () => {
  dom.window.document.body.dataset.busy = 'join';
  try {
    await resume();
    assert.equal(asks(), 1, 'a join in flight is left alone');
  } finally {
    delete dom.window.document.body.dataset.busy;
  }
});

test('a resume after five minutes asks again, and a changed file repaints the wall', async () => {
  assert.doesNotMatch($('wall-root').textContent, new RegExp(FRESH));
  await resume();
  assert.equal(asks(), 2, 'the live file is asked for');
  const pushed = { ...FEST, artists: [...FEST.artists, { name: FRESH }] };
  assert.equal(net.release(fileGet(FID), () => json(pushed)), 1);
  await settle(40);
  assert.ok(state.fest().artists.some((a) => a.name === FRESH), 'the fresh file is the one in use');
  assert.match($('wall-root').textContent, new RegExp(FRESH), 'and the wall shows it');
  // And that ask starts the next five minutes.
  await resume();
  assert.equal(asks(), 2);
});
