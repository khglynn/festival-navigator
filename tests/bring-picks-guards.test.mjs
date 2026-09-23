// Bring-your-picks, the two ways it could move the wrong picks (Codex review,
// 2026-09-23), walked through the real shell:
//
//   1. A BORROWED PHONE. The device's person is Kevin; the picker on this
//      phone in this crew is Drew, a placeholder with no pid, and the person
//      record has no mirror entry for the crew. Kevin's other crew holds
//      Robyn: must. The offer used to appear, and accepting it queued
//      Robyn.Drew = 4. Ownership is affirmative now, on both sides.
//   2. THE CARD AND THE TAP DISAGREEING. The card names Ross's crew; Robyn
//      gets picked here while it is up; the tap used to re-plan from scratch
//      and import Nhu's Soulwax under words that still said Ross. The tap now
//      brings only what is left of the crew the card named — or says there is
//      nothing left.
//   And a picker switch in Settings → You takes the offer away.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, SCREENS } from './helpers/warm-rig.mjs';

// Made-up crews, never real links; built into URLs, never written after `#g=`.
const BORROW = 'bringguard_borrow_0123456';
const TWOSRC = 'bringguard_twosrc_0123456';
const SWITCH = 'bringguard_switch_0123456';
const ROSS = 'bringguard_ross_01234567';
const NHU = 'bringguard_nhu_012345678';
const PID = 'pid_guard_0001';
const MINE = { colorIndex: 0, pid: PID };

const DOCS = {
  [BORROW]: crewDoc({ Kevin: MINE, Drew: { colorIndex: 2 } }),
  [TWOSRC]: crewDoc({ Kevin: MINE }),
  [SWITCH]: crewDoc({ Kevin: MINE, Nhu: { colorIndex: 1 } }),
};
const ROSS_DOC = crewDoc({ Kev: MINE, Ross: { colorIndex: 3 } }, { Robyn: { Kev: 4 } });
const NHU_DOC = crewDoc({ Kevin: MINE, Nhu: { colorIndex: 1 } }, { Soulwax: { Kevin: 4 } });

async function network(url, opts = {}) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u === '/api/person') {
    const sent = opts.body ? JSON.parse(opts.body).data || {} : {};
    return json({ id: PID, doc: { v: 1, name: 'Kevin', crews: sent.crews || {} } });
  }
  if (u.startsWith('/api/crew?')) {
    if ((opts.method || 'GET') !== 'GET') return json({ error: 'not in this test' }, 503); // pending stays pending
    const t = new URL(u, 'https://x').searchParams.get('t');
    return DOCS[t] ? json(DOCS[t]) : json({ error: 'Crew not found' }, 404);
  }
  return json({ error: 'not in this test' }, 503);
}

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${BORROW}`,
  storage: {
    fn_person_v1: JSON.stringify({ token: 'personguard_token_0123456', id: PID, name: 'Kevin', crews: {} }),
    fn_crews_v3: JSON.stringify([{ token: ROSS, name: '' }, { token: NHU, name: '' }]),
    [`fn_me_v3_${ROSS}`]: 'Kev',
    [`fn_crew_doc_v3_${ROSS}`]: JSON.stringify(ROSS_DOC),
    [`fn_me_v3_${NHU}`]: 'Kevin',
    [`fn_crew_doc_v3_${NHU}`]: JSON.stringify(NHU_DOC),
    // The borrowed phone: this crew's picker is Drew.
    [`fn_me_v3_${BORROW}`]: 'Drew',
    [`fn_me_v3_${TWOSRC}`]: 'Kevin',
    [`fn_me_v3_${SWITCH}`]: 'Kevin',
  },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const state = await import('../js/state.js'); // the SAME instances app.js holds
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const offer = () => document.getElementById('bring-offer');
const buttonNamed = (root, label) => [...root.querySelectorAll('button')].find((b) => b.textContent === label);
async function open(hash) { location.hash = hash; await settle(120); }

await settle(150);

test('repro 1: a borrowed phone’s placeholder picker is never offered the owner’s picks', () => {
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(state.getCrewToken(), BORROW);
  assert.equal(offer(), null, 'no offer to bring Kevin’s picks onto Drew');
  const sels = state.crewDoc.festivals[FID].selections;
  assert.equal((sels.Robyn || {}).Drew, undefined, 'and nothing queued for Drew');
});

test('repro 2: the tap brings only from the crew the card named — never silently from another', async () => {
  await open(`#g=${TWOSRC}`);
  assert.equal(state.getCrewToken(), TWOSRC);
  assert.ok(offer(), 'the offer is up');
  assert.match(offer().querySelector('.bring-line').textContent, /from your crew with Ross\?/, 'it names Ross’s crew');
  // Robyn gets picked here while the card is up (the same two writes a tap makes).
  state.recordSelection('Robyn', 'Kevin', 1);
  (state.crewDoc.festivals[FID].selections.Robyn = state.crewDoc.festivals[FID].selections.Robyn || {}).Kevin = 1;
  buttonNamed(offer(), 'Bring it').click();
  await settle(20);
  const sels = state.crewDoc.festivals[FID].selections;
  assert.equal((sels.Soulwax || {}).Kevin, undefined, 'Nhu’s-crew Soulwax was NOT imported under words about Ross');
  assert.equal(sels.Robyn.Kevin, 1, 'and the Robyn picked here stands');
  assert.match(offer().querySelector('.bring-line').textContent, /nothing new/i, 'the card says so, honestly');
});

test('switching who you are on this phone (Settings → You) takes the offer away', async () => {
  await open(`#g=${SWITCH}`);
  assert.ok(offer(), 'the offer is up for Kevin');
  $('gear-btn').click();
  const you = [...$('settings-root').querySelectorAll('button')].find((b) => b.textContent === 'Not you? Switch');
  you.click();
  const nhu = [...$('settings-root').querySelectorAll('button')].find((b) => /I’m Nhu/.test(b.textContent));
  nhu.click();
  await settle(10);
  assert.equal(offer(), null, 'Kevin’s offer is not Nhu’s');
});
