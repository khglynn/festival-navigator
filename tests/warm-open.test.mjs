// The warm open on lie-fi (2026-09-23). At Pier 80 with 40k phones on one
// tower the network HANGS rather than fails, and a cold open used to sit on
// "Loading your festivals…" for up to ~16 s — catalog, crew doc, customs and
// festival file each spending their full network budget — while every byte
// it needed was already on the phone.
//
// A phone that holds this crew's doc, a claimed name in it, and (in the
// worker's caches) the catalog and the festival file now paints the wall from
// that copy at once. The network still gets asked, and what it says lands the
// ordinary way when it says it: a changed crew doc through the remote-change
// repaint (chips included), a data push through the same repaint — horizontal
// scroll kept, nothing yanked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, heldNetwork, cachesHolding, within, SCREENS } from './helpers/warm-rig.mjs';

const TOKEN = 'warmopentest_0123456789ab'; // a made-up crew, never a real link
const CACHED = crewDoc({ Kevin: { colorIndex: 0 }, Nhu: { colorIndex: 1 } }, { Robyn: { Kevin: 2 } });
const FRESH_ACT = 'Warm Open Fresh Act';

const net = heldNetwork();
globalThis.caches = cachesHolding({
  '/data/festivals/index.json': INDEX,
  [`/data/festivals/${FID}.json`]: FEST,
});

const t0 = performance.now();
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(CACHED),
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const state = await import('../js/state.js'); // the SAME instances app.js holds
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const booted = Math.round(performance.now() - t0); // jsdom + the module graph: machine load, not the app
const painted = await within(3000, () => shown().includes('screen-app'));

test('a warm open paints the wall from this phone’s copy while the network hangs', () => {
  // The network here NEVER answers — the cold path would never paint at all
  // (its festival file has no timeout of its own). So painting is the proof;
  // the bound only says "without waiting", measured from the moment the app's
  // modules finished loading so a busy test machine cannot fake a failure.
  assert.notEqual(painted, null, 'the wall never painted — it is waiting on a network that will not answer');
  console.log(`  warm first paint (jsdom): ${Math.round(painted)} ms after the modules loaded (${booted} ms to load them)`);
  assert.ok(painted < 1000, `painted ${Math.round(painted)} ms after load — should not wait on the network at all`);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(state.activeFestivalId, FID);
  assert.equal(state.crewDoc.festivals[FID].selections.Robyn.Kevin, 2, 'the cached picks');
  assert.match($('wall-root').textContent, /Robyn/, 'the festival file came from the cache');
});

test('the network is still asked — just not waited on', () => {
  assert.ok(net.asked('/api/crew?'), 'the crew doc is being fetched (the ordinary poll)');
  assert.ok(net.asked(`/data/festivals/${FID}.json`), 'and the live festival file, for a data push');
});

test('the crew doc, when it finally lands, arrives the ordinary way — wall and chips', async () => {
  const fresh = crewDoc(
    { Kevin: { colorIndex: 0 }, Nhu: { colorIndex: 1 }, Kat: { colorIndex: 2 } },
    { Robyn: { Kevin: 2 }, Soulwax: { Nhu: 4 } },
  );
  assert.equal(net.release((h) => h.method === 'GET' && h.u.startsWith('/api/crew?'), () => json(fresh)), 1);
  await settle(30);
  assert.equal(state.crewDoc.festivals[FID].selections.Soulwax.Nhu, 4, 'the remote pick applied');
  assert.match($('person-chips').textContent, /Kat/, 'a new crew-mate’s chip — the remote-change repaint ran');
  assert.deepEqual(shown(), ['screen-app'], 'still on the wall');
});

test('a data push lands on this open: the live festival file replaces the cached one, scroll kept', async () => {
  const scroller = [...$('wall-root').querySelectorAll('.times-scroll')].find((s) => !s.closest('.stage-strip'));
  assert.ok(scroller, 'the wall has a timetable');
  scroller.scrollLeft = 120;
  const pushed = { ...FEST, artists: [...FEST.artists, { name: FRESH_ACT }] };
  assert.equal(net.release((h) => h.u === `/data/festivals/${FID}.json`, () => json(pushed)), 1);
  await settle(30);
  assert.ok(state.fest().artists.some((a) => a.name === FRESH_ACT), 'the fresh file is the one in use');
  assert.match($('wall-root').textContent, new RegExp(FRESH_ACT), 'and the wall shows it');
  const again = [...$('wall-root').querySelectorAll('.times-scroll')].find((s) => !s.closest('.stage-strip'));
  assert.equal(again.scrollLeft, 120, 'the repaint boundary kept the horizontal scroll');
});

test('the catalog answering late changes nothing on the wall', async () => {
  const before = state.fest();
  net.release((h) => h.u === '/data/festivals/index.json', () => json(INDEX));
  await settle(20);
  assert.equal(state.fest(), before, 'same festival object — no repaint for nothing');
  assert.deepEqual(shown(), ['screen-app']);
});
