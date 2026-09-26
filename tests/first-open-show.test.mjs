// A share link's starting view (v92, 2026-09-25 — SD1). A link can say which
// rooms of the week it opens on — `&show=folsom` beside `g=` in the hash —
// and the receiving phone takes it ONCE, on its own fold, never the crew doc:
//
//   only a phone that has never shown that festival (its own view, even
//   "everything", is its choice), never over a fold of its own, never a
//   list that would hide every room, and only rooms its festival file knows;
//   it says so on arrival — "Opened on Folsom. · Show all" — and Show all
//   brings every room back.
//
// The sender's side: every link carries the rooms the sharer is showing, and
// nothing at all when they show everything (which is also what an old build
// does with any link).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { roomSlug, showOf, foldFromShow, showLabel, FEST_ROOM } from '../js/v3/filters.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));

// ---- the shell half ----------------------------------------------------------------
const A = 'firstopenshow_aaaa_01234';
const B = 'firstopenshow_bbbb_01234';
const C = 'firstopenshow_cccc_01234';
const D = 'firstopenshow_dddd_01234';
const E = 'firstopenshow_eeee_01234';
const doc = () => ({
  v: 4, meta: { name: 'Show Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: { Robyn: { Kevin: 2 } } } },
});
const writes = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  if ((opts.method || 'GET') !== 'GET') { writes.push(u); return json({ error: 'not in this test' }, 503); }
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?')) return json(doc());
  return json({ error: 'not in this test' }, 503);
}

const FOLD = `fn_fold_v1_${FID}`;
const shell = await bootShell({
  url: `https://fest.kevinhg.com/f/${FID}#g=${A}&f=${FID}&show=nope,zzz`,
  storage: { fn_welcome_v1: '1' }, // the welcome card is its own file's story
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const crew = await import('../js/crew.js');
const rooms = () => new Set([...document.querySelectorAll('#wall-root .room[data-room]')].map((r) => r.dataset.room));
const toast = () => $('toast-root').textContent;
async function open(hash) {
  location.hash = hash;
  await settle(140);
}
// A phone that has never shown the festival: forget every crew it knew.
const freshPhone = () => { for (const c of crew.knownCrews()) crew.forgetCrew(c.token); };

await settle(160);

// ---- the pure half (registered after the boot: a test file's tests run once the shell is up) ----
const ROOMS = [
  { key: FEST_ROOM, label: 'Portola' },
  { key: 'Afters', label: 'Afters' },
  { key: 'Folsom', label: 'Folsom' },
];

test('a room’s slug is readable in a chat: fest for the festival’s own room, the label for the rest', () => {
  assert.equal(roomSlug(ROOMS[0]), 'fest');
  assert.equal(roomSlug(ROOMS[1]), 'afters');
  assert.equal(roomSlug({ key: 'Late nights', label: 'Late nights' }), 'late-nights');
  assert.equal(roomSlug({ key: 'weekend:W2', label: 'Weekend 2' }), 'weekend-2');
  assert.equal(roomSlug({ key: 'Día', label: 'Día de Fiesta!' }), 'dia-de-fiesta', 'accents off, punctuation a dash');
});

test('the sender’s view: the rooms it shows, or nothing when it shows them all (or none)', () => {
  assert.equal(showOf(ROOMS, []), null, 'everything showing: no view to send');
  assert.deepEqual(showOf(ROOMS, ['Folsom']), ['fest', 'afters']);
  assert.deepEqual(showOf(ROOMS, [FEST_ROOM, 'Afters']), ['folsom']);
  assert.equal(showOf(ROOMS, [FEST_ROOM, 'Afters', 'Folsom']), null, 'everything hidden is not a view to send');
  assert.equal(showLabel(ROOMS, ['Folsom']), 'Portola + Afters');
});

test('the receiver’s fold: the rooms the view leaves out — never all of them, never an unknown room', () => {
  assert.deepEqual(foldFromShow(ROOMS, ['folsom']), [FEST_ROOM, 'Afters']);
  assert.deepEqual(foldFromShow(ROOMS, ['fest', 'afters']), ['Folsom']);
  assert.equal(foldFromShow(ROOMS, ['fest', 'afters', 'folsom']), null, 'a view of everything hides nothing');
  assert.equal(foldFromShow(ROOMS, ['nope']), null, 'a room this festival does not have is ignored — not "hide everything"');
  assert.deepEqual(foldFromShow(ROOMS, ['nope', 'folsom']), [FEST_ROOM, 'Afters'], 'the known part of a list still counts');
  assert.equal(foldFromShow(ROOMS, []), null);
  assert.equal(foldFromShow([ROOMS[0]], ['fest']), null, 'a one-room fest has nothing to fold');
});


test('crewLink puts the view last, beside the festival, and showFromHash reads it back', () => {
  const link = crew.crewLink(A, FID, null, ['fest', 'afters']);
  assert.match(link, new RegExp(`#g=${A}&f=${FID}&show=fest,afters$`));
  assert.match(crew.crewLink(A, FID, 'Drew', ['folsom']), /&me=Drew&show=folsom$/, 'a personal link carries it too');
  assert.doesNotMatch(crew.crewLink(A, null, null, ['fest']), /show=/, 'no festival, no view');
  assert.doesNotMatch(crew.crewLink(A, FID, null, null), /show=/);
  // replaceState, not location.hash: read the parsers without booting.
  const was = location.href;
  history.replaceState(history.state, '', `#g=${A}&f=${FID}&show=Fest,afters,%3Cscript%3E,,folsom`);
  try {
    assert.deepEqual(crew.showFromHash(), ['fest', 'afters', 'folsom'], 'lowercased, anything that is not a slug dropped');
    assert.equal(crew.festFromHash(), FID, 'the parsers before it are untouched');
    assert.equal(crew.tokenFromHash(), A);
    assert.equal(crew.meFromHash(), null);
  } finally {
    history.replaceState(history.state, '', was);
  }
});

test('a view naming no room this festival has does nothing at all', async () => {
  // The boot above opened A with show=nope,zzz.
  await settle(20);
  assert.equal(localStorage.getItem(FOLD), null, 'no fold written');
  assert.doesNotMatch(toast(), /Opened on/);
  assert.ok(rooms().has(':fest') || rooms().size > 0, 'the whole week');
});

test('a view of everything hides nothing, and says nothing', async () => {
  freshPhone();
  await open(`#g=${B}&f=${FID}&show=fest,afters,folsom`);
  assert.equal(localStorage.getItem(FOLD), null);
  assert.doesNotMatch(toast(), /Opened on/);
});

test('a fold of its own is never overridden, even on a phone that forgot every crew', async () => {
  freshPhone();
  localStorage.setItem(FOLD, JSON.stringify(['Afters']));
  await open(`#g=${E}&f=${FID}&show=folsom`);
  assert.deepEqual(JSON.parse(localStorage.getItem(FOLD)), ['Afters']);
  assert.doesNotMatch(toast(), /Opened on/);
});

test('a fresh phone opens on the link’s view — folded before the first paint, said on arrival', async () => {
  freshPhone();
  localStorage.removeItem(FOLD); // the phone above let its own fold go
  await open(`#g=${C}&f=${FID}&show=folsom`);
  assert.deepEqual(new Set(JSON.parse(localStorage.getItem(FOLD))), new Set([':fest', 'Afters']), 'this phone’s own fold');
  assert.ok(!rooms().has(':fest') && !rooms().has('Afters'), 'Portola and the afters are not on the wall');
  assert.ok(rooms().has('Folsom'));
  assert.match(toast(), /Opened on Folsom\./);
  assert.deepEqual(writes, [], 'a view is never written to the crew');
});

test('Show all brings every room back', async () => {
  const btn = [...$('toast-root').querySelectorAll('button')].find((b) => b.textContent === 'Show all');
  assert.ok(btn, 'one door back, on the toast');
  btn.click();
  await settle(20);
  assert.equal(localStorage.getItem(FOLD), null, 'the fold is empty again');
  assert.ok(rooms().has(':fest') && rooms().has('Afters') && rooms().has('Folsom'));
});

test('a phone that has shown the festival is never re-folded by a link — showing everything was its choice', async () => {
  await open(`#g=${D}&f=${FID}&show=afters`);
  assert.equal(localStorage.getItem(FOLD), null);
  assert.doesNotMatch(toast(), /Opened on/);
});

