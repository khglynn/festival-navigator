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

// A sanity cap, not the proof (the order below is): generous for a loaded
// machine, and still under the shortest budget a cold path would have to
// burn through before it painted from the phone's copy (the boot's 8 s crew
// fetch, js/crew.js).
const PAINT_CAP_MS = 7000;

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
// What the network had done by the moment the wall painted — read at the
// paint, in the same check that sees it.
let atPaint = null;
const painted = await within(PAINT_CAP_MS, () => {
  if (!shown().includes('screen-app')) return false;
  atPaint ??= { gaveUp: [...net.gaveUp], pending: net.pending(), calls: [...net.calls] };
  return true;
});

test('a warm open paints the wall from this phone’s copy while the network hangs', () => {
  // The network here NEVER answers until a later test releases it. The proof
  // is an ORDER, not a stopwatch (LEDGER follow-up 59: a 1000 ms budget on
  // jsdom went red at ~3.9 s on a loaded machine, and a fast cold path could
  // pass one anyway): the wall painted before the app had given up on any
  // request — so it waited for no network budget to run out (the shortest,
  // the boot's crew fetch, is 8 s; the festival file's 12 s) — and every
  // request it had sent by then was still hanging. (On a quick runner the
  // paint comes before the requests go out at all; the next test checks
  // they do.)
  assert.notEqual(painted, null, `the wall never painted within ${PAINT_CAP_MS} ms — it is waiting on a network that will not answer`);
  console.log(`  warm first paint (jsdom): ${Math.round(painted)} ms after the modules loaded (${booted} ms to load them)`);
  assert.deepEqual(atPaint.gaveUp, [], 'no request had timed out or been dropped when the wall painted');
  assert.equal(atPaint.pending, atPaint.calls.length, `every request sent before the paint was still hanging (${atPaint.pending} of ${atPaint.calls.length})`);
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
