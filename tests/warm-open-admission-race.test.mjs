// The strict warm open admits a festival on the CACHED catalog — and the
// live catalog can land in the middle of that admission (Codex round 4,
// 2026-09-23). The saved festival X is listed in the cached catalog and its
// file is in the cache, but reading that file is slow; meanwhile the live
// catalog arrives WITHOUT X. Admission said yes, and activation then re-read
// the replaced catalog: it picked Portola, asked the network for Portola's
// file (no first paint), overwrote the saved choice with the invite hint, and
// finally said X "isn't in the lineup". The admitted festival is carried into
// activation now; nothing re-decides it mid-admission, and the wall paints X
// — the live catalog then only refreshes, as a strict warm open promises.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { INDEX, FEST, crewDoc, json, heldNetwork, within, SCREENS } from './helpers/warm-rig.mjs';

const TOKEN = 'warmadmitrace_01234567890'; // a made-up crew, never a real link
const X = { ...FEST, id: 'vanishing-fest-2026', name: 'Vanishing Fest' };
const CACHED_INDEX = [{ id: X.id, name: X.name, year: '2026', status: 'lineup', startsOn: '2026-09-20' }, ...INDEX];
const net = heldNetwork();

// The worker's caches as the page sees them — with X's file read held open.
let releaseX;
const xRead = new Promise((r) => { releaseX = r; });
globalThis.caches = {
  match: async (req) => {
    const path = new URL(typeof req === 'string' ? req : req.url, 'https://fest.kevinhg.com').pathname;
    if (path === '/data/festivals/index.json') return json(CACHED_INDEX);
    if (path === `/data/festivals/${X.id}.json`) { await xRead; return json(X); }
    if (path === '/data/festivals/portola-2026.json') return json(FEST);
    return undefined;
  },
};
const DOC = crewDoc({ Kevin: { colorIndex: 0 } }, {}); // inviteFestId: Portola — the hint that used to overwrite
DOC.festivals[X.id] = { selections: { Robyn: { Kevin: 1 } } };

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(DOC),
    [`fn_crew_fest_v3_${TOKEN}`]: X.id,
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; });
const { $ } = shell;
const state = await import('../js/state.js');
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');

test('the live catalog (without X) lands while X’s cached file is still being read', async () => {
  await settle(30);
  assert.deepEqual(shown(), [], 'admission is still reading the file');
  assert.equal(net.release((h) => h.u === '/data/festivals/index.json', () => json(INDEX)), 1);
  await settle(30);
});

test('then the file arrives: the admitted festival paints — nothing re-decided mid-admission', async () => {
  releaseX();
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null, 'the warm wall paints');
  assert.equal(state.activeFestivalId, X.id, 'the festival admission checked is the one shown');
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), X.id, 'the saved choice untouched');
  assert.ok(!net.asked('/data/festivals/portola-2026.json'), 'no request for a festival nobody chose');
  await settle(30);
  assert.doesNotMatch($('toast-root').textContent, /isn’t in the lineup/, 'and no announcement — a warm wall never switches');
});
