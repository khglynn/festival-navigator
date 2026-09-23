// After a warm open the network only REFRESHES what is on screen — it never
// changes which festival is showing (2026-09-23, round 4, strict warm open).
// The cached catalog still lists this device's saved festival and its file is
// cached, so the warm open paints it. The live catalog has since dropped it:
// the wall stays exactly where it is (the next cold open resolves it, with its
// usual toast), and a note typed meanwhile is saved where it was typed — the
// round-3 correction re-aimed it into another festival (Codex round 3, new A).
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
const NOTE = 'Meet me at the entrance';

test('the warm open paints the saved festival from cache', async () => {
  assert.notEqual(await within(1500, () => shown().includes('screen-app')), null);
  assert.equal(state.activeFestivalId, GONE.id);
});

test('a note half-typed while the live catalog (which dropped this festival) lands is saved HERE', async () => {
  $('notes-chip').click();
  await settle(10);
  const ta = document.querySelector('#artist-sheet .composer textarea');
  assert.ok(ta, 'the all-notes composer is open');
  ta.value = NOTE;
  assert.equal(net.release((h) => h.u === '/data/festivals/index.json', () => json(INDEX)), 1);
  await settle(80);
  assert.equal(state.activeFestivalId, GONE.id, 'the festival on screen never changes under the person');
  const save = [...document.querySelectorAll('#artist-sheet .composer button')].find((b) => b.textContent === 'Save');
  save.click();
  await settle(20);
  const notesOf = (fid) => JSON.stringify(((state.crewDoc.festivals[fid] || {}).notes) || {});
  assert.match(notesOf(GONE.id), new RegExp(NOTE), 'the note is where it was typed');
  assert.doesNotMatch(notesOf('portola-2026'), new RegExp(NOTE), 'and not in another festival');
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), GONE.id, 'the saved choice untouched');
  assert.doesNotMatch($('toast-root').textContent, /isn’t in the lineup/, 'no switch, so nothing to announce');
});
