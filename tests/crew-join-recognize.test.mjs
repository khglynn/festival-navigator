// The real shell, opening crew links on a device whose person is already a
// member (2026-09-23). Two promises, walked through boot → enterApp exactly
// the way a phone walks them:
//
//   RECOGNIZE YOU — the crew doc carries this device's pid on one active
//   member, so the link opens straight onto the wall as that member, with a
//   light "welcome back" and a one-tap "Not me" door. Ambiguity (two
//   members wearing my pid, a personal link naming someone else) still asks.
//
//   BRING YOUR PICKS — this device also knows Kevin's crew with Ross at the
//   same festival, so the wall offers, once, to bring his picks over: only
//   his, only the ones not already decided here, through the normal pick path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));

// Made-up crews, never real links; built into URLs, never written after `#g=`.
const HERE = 'recognizetest_here_012345';
const ROSS = 'recognizetest_ross_012345';
const TWIN = 'recognizetest_twin_012345';
const NOTME = 'recognizetest_notme_01234';
const PID = 'pid_recog_0001';
const PERSON = { token: 'personrecog_token_01234567', id: PID, name: 'Kevin', crews: {} };

const crewDoc = (people, selections = {}) => ({
  v: 4, meta: { name: '', inviteFestId: FID }, spotify: {}, affinity: {},
  people, festivals: { [FID]: { selections } },
});
const DOCS = {
  // Kevin is here already (his pid rides his name), and has decided Robyn.
  [HERE]: crewDoc({ Kevin: { colorIndex: 0, pid: PID }, Nhu: { colorIndex: 1 } }, {
    Robyn: { Kevin: 2 },
    Prospa: { Nhu: 3 },
  }),
  // Two members wearing one pid: a question, not a guess.
  [TWIN]: crewDoc({ Kevin: { colorIndex: 0, pid: PID }, Kev: { colorIndex: 1, pid: PID } }),
  [NOTME]: crewDoc({ Kevin: { colorIndex: 0, pid: PID }, Drew: { colorIndex: 2 } }),
};
// The other Portola crew, known to this device only through its cache.
const ROSS_DOC = crewDoc({ Kev: { colorIndex: 0, pid: PID }, Ross: { colorIndex: 3 } }, {
  Robyn: { Kev: 4 },             // decided here already (Kevin: 2) — never raised, never overwritten
  Soulwax: { Kev: 1 },
  Prospa: { Kev: 4, Ross: 2 },   // Nhu's pick here is not mine: mine still comes
  Kettama: { Kev: 4 },
  'Dog Blood': { Ross: 4 },      // Ross's, never Kevin's to bring
});

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
  url: `https://fest.kevinhg.com/#g=${HERE}&f=${FID}`,
  storage: {
    fn_person_v1: JSON.stringify(PERSON),
    fn_crews_v3: JSON.stringify([{ token: ROSS, name: '' }]),
    [`fn_me_v3_${ROSS}`]: 'Kev',
    [`fn_crew_doc_v3_${ROSS}`]: JSON.stringify(ROSS_DOC),
  },
  fetch: network,
});
test.after(() => shell.close());
const { $, dom } = shell;
const state = await import('../js/state.js'); // the SAME instances app.js holds
const crew = await import('../js/crew.js');
const { showToast } = await import('../js/v3/wall.js');

const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const toastText = () => $('toast-root').textContent;
const offer = () => document.getElementById('bring-offer');
const buttonNamed = (root, label) => [...root.querySelectorAll('button')].find((b) => b.textContent === label);
async function open(hash) {
  location.hash = hash;
  await settle(80);
}

await settle(120);

test('a crew link whose doc already carries my pid opens straight onto the wall, as me', () => {
  assert.deepEqual(shown(), ['screen-app'], 'no "who are you?" screen');
  assert.equal(crew.me(HERE), 'Kevin', 'claimed on this device');
  assert.match(toastText(), /Welcome back, Kevin/, 'a light acknowledgement, not a dialog');
  assert.ok(buttonNamed($('toast-root'), 'Not me'), 'and a one-tap way out if the phone is not mine');
});

test('the offer: my other Portola crew, named by its people, counting only what arrives', () => {
  const box = offer();
  assert.ok(box, 'the offer is up');
  assert.ok($('screen-app').contains(box), 'inside the wall screen — Settings and the landing hide it with the wall');
  assert.equal(box.querySelector('.bring-line').textContent,
    'Bring 3 more of your Portola picks from your crew with Ross?',
    'Soulwax, Prospa, Kettama — Robyn is already decided here');
  assert.match(box.querySelector('.bring-sub').textContent, /nothing you’ve picked here changes/);
  assert.ok(buttonNamed(box, 'Bring them') && buttonNamed(box, 'No thanks'));
});

test('a toast arriving under the offer makes it step up, and it settles back when the toast goes', async () => {
  // jsdom has no layout; give toasts a height so the neighbour can make room.
  const proto = dom.window.HTMLElement.prototype;
  const prev = Object.getOwnPropertyDescriptor(proto, 'offsetHeight');
  Object.defineProperty(proto, 'offsetHeight', {
    configurable: true,
    get() { return this.classList && this.classList.contains('undo-toast') ? 40 : 0; },
  });
  try {
    showToast($('toast-root'), 'Something else happened');
    await settle(5);
    assert.equal(offer().style.transform, 'translateY(-48px)', 'lifted by the toast plus a gap');
    $('toast-root').textContent = '';
    await settle(5);
    assert.equal(offer().style.transform, '', 'back down once the toast is gone');
  } finally {
    Object.defineProperty(proto, 'offsetHeight', prev);
  }
});

test('Bring them: only the missing picks, as mine, through the pick path — and it says so', async () => {
  buttonNamed(offer(), 'Bring them').click();
  const sels = state.crewDoc.festivals[FID].selections;
  assert.equal(sels.Robyn.Kevin, 2, 'Robyn stays what I decided here (never raised to Ross-crew’s must)');
  assert.equal(sels.Soulwax.Kevin, 1);
  assert.equal(sels.Prospa.Kevin, 4, 'mine arrives beside Nhu’s');
  assert.equal(sels.Prospa.Nhu, 3, 'Nhu’s untouched');
  assert.equal(sels.Kettama.Kevin, 4, 'a must arrives as a must');
  assert.equal(sels['Dog Blood'], undefined, 'Ross’s picks never travel');
  const pending = state.pendingChanges.festivals[FID].selections;
  assert.deepEqual(
    { Soulwax: pending.Soulwax.Kevin, Prospa: pending.Prospa.Kevin, Kettama: pending.Kettama.Kevin },
    { Soulwax: 1, Prospa: 4, Kettama: 4 },
    'queued for sync like any tap',
  );
  assert.equal(pending.Robyn, undefined, 'nothing written where nothing changed');
  assert.equal(offer().querySelector('.bring-line').textContent, 'Brought 3 picks over ✓', 'the question becomes its answer');
  assert.equal(offer().querySelector('button'), null, 'the buttons step back');
  assert.equal(localStorage.getItem(`fn_bring_picks_v1_${HERE}_${FID}`), 'brought', 'answered, on this device');
  await settle(1700);
  assert.equal(offer(), null, 'and the card leaves by itself');
});

test('asked once: coming back to the same crew and festival does not ask again', async () => {
  await open('');
  assert.deepEqual(shown(), ['screen-landing']);
  await open(`#g=${HERE}`);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(offer(), null);
});

test('two members wearing my pid is a question — the join screen asks', async () => {
  await open(`#g=${TWIN}`);
  assert.deepEqual(shown(), ['screen-join']);
  assert.equal(crew.me(TWIN), null);
});

test('"Not me" puts the question back, and forgets only the claim', async () => {
  await open(`#g=${NOTME}`);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(crew.me(NOTME), 'Kevin');
  // Two other Portola crews hold Kevin's picks now (Ross's, and HERE after
  // the bring): the offer takes the fullest and says it chose.
  assert.match(offer().querySelector('.bring-sub').textContent, /fullest of your 2 other Portola crews/);
  const notMe = buttonNamed($('toast-root'), 'Not me');
  assert.ok(notMe);
  notMe.click();
  assert.deepEqual(shown(), ['screen-join'], 'back to "who are you?"');
  assert.equal(offer(), null, 'the offer was Kevin’s — it goes with him');
  assert.equal(crew.me(NOTME), null, 'the claim is gone');
  assert.ok(crew.knownCrews().some((c) => c.token === NOTME), 'the crew itself is still remembered');
  assert.ok([...$('join-people').querySelectorAll('button')].some((b) => /Drew/.test(b.textContent)), 'Drew can tap himself in');
});

test('a personal link for someone else is never overridden by recognition', async () => {
  await open(`#g=${NOTME}&me=Drew`);
  assert.deepEqual(shown(), ['screen-join'], 'the link names Drew, the device is Kevin: ask');
  assert.match($('join-people').textContent, /this link is yours/);
});
