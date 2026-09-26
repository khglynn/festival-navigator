// The welcome card is for someone NEW here (v92, Kevin 2026-09-25: "people
// that have already connected to a person in the fest should just go to now /
// the top / their filter selected"). A phone that recognizes you lands exactly
// as it did in v91 — no card, and the bring-your-picks offer asks at once. A
// member taking their own name on the join screen is not new either. Someone
// who has just joined under a NEW name is: the card, in a member's words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { welcomeCopy, WORDS } from '../js/v3/welcome.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));

// Made-up crews, never real links; built into URLs, never written after `#g=`.
const HERE = 'firstopenwelc_here_01234';
const ROSS = 'firstopenwelc_ross_01234';
const KNOWN = 'firstopenwelc_known_0123';
const DREW = 'firstopenwelc_drew_01234';
const NEWC = 'firstopenwelc_newc_01234';
const PID = 'pid_firstopen_welc';
const PERSON = { token: 'personfirstwelc_token_0123', id: PID, name: 'Kevin', crews: {} };
const crewDoc = (people, selections = {}) => ({
  v: 4, meta: { name: 'Here Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people, festivals: { [FID]: { selections } },
});
const DOCS = {
  [HERE]: crewDoc({ Kevin: { colorIndex: 0, pid: PID }, Nhu: { colorIndex: 1 } }, { Prospa: { Nhu: 3 } }),
  [KNOWN]: crewDoc({ Maya: { colorIndex: 3 }, Nhu: { colorIndex: 1 } }, { Robyn: { Maya: 2 } }),
  [DREW]: crewDoc({ Kevin: { colorIndex: 0 }, Drew: { colorIndex: 2 } }, { Robyn: { Kevin: 2 } }),
  [NEWC]: crewDoc({ Kevin: { colorIndex: 0 } }, { Robyn: { Kevin: 2 } }),
};
const ROSS_DOC = crewDoc({ Kev: { colorIndex: 0, pid: PID }, Ross: { colorIndex: 3 } }, { Soulwax: { Kev: 1 }, Kettama: { Kev: 4 } });

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u === '/api/person') return json({ id: PID, doc: { v: 1, name: 'Kevin', crews: {} } });
  if (u.startsWith('/api/crew?')) {
    const t = new URL(u, 'https://x').searchParams.get('t');
    if ((opts.method || 'GET') !== 'GET') {
      // Only NEWC takes a join here; everything else stays pending.
      if (t !== NEWC) return json({ error: 'not in this test' }, 503);
      const people = (JSON.parse(opts.body).data || {}).people || {};
      DOCS[NEWC] = { ...DOCS[NEWC], people: { ...DOCS[NEWC].people, ...people } };
      return json(DOCS[NEWC]);
    }
    return DOCS[t] ? json(DOCS[t]) : json({ error: 'Crew not found' }, 404);
  }
  return json({ error: 'not in this test' }, 503);
}

const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${HERE}&f=${FID}`,
  storage: {
    fn_person_v1: JSON.stringify(PERSON),
    fn_crews_v3: JSON.stringify([{ token: ROSS, name: '' }, { token: KNOWN, name: '' }]),
    [`fn_me_v3_${ROSS}`]: 'Kev',
    [`fn_crew_doc_v3_${ROSS}`]: JSON.stringify(ROSS_DOC),
    [`fn_me_v3_${KNOWN}`]: 'Maya', // a phone that knows its name in this crew
    [`fn_crew_fest_v3_${KNOWN}`]: FID,
  },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const welcome = () => document.getElementById('welcome-card');
const offer = () => document.getElementById('bring-offer');
const buttonNamed = (root, label) => [...root.querySelectorAll('button')].find((b) => b.textContent === label);
async function open(hash) { location.hash = hash; await settle(140); }

await settle(160);

test('a recognized phone lands as it did in v91: no welcome card, and the offer asks at once', () => {
  assert.deepEqual(['screen-app'].filter((id) => $(id).style.display !== 'none'), ['screen-app']);
  assert.match($('toast-root').textContent, /Welcome back, Kevin/);
  assert.equal(welcome(), null, 'no card for someone the crew already knows');
  assert.ok(offer(), 'the bring-your-picks offer, as before');
  assert.match(offer().querySelector('.bring-line').textContent, /Bring your 2 Portola picks from your crew with Ross\?/);
  assert.equal(localStorage.getItem('fn_welcome_v1'), null, 'and nothing marked: the card is still owed if this phone is ever new somewhere');
});

test('a phone that knows its name lands with no card either', async () => {
  await open(`#g=${KNOWN}`);
  assert.equal(welcome(), null);
  assert.equal($('dock-you').textContent, 'M');
});

test('a member taking their own name on the join screen is not new: no card', async () => {
  await open(`#g=${DREW}&f=${FID}&me=Drew`);
  assert.notEqual($('screen-join').style.display, 'none', 'a personal link asks first');
  const drew = [...$('join-people').querySelectorAll('button')].find((b) => /Drew/.test(b.textContent));
  drew.click();
  await settle(160);
  assert.equal($('dock-you').textContent, 'D');
  assert.equal(welcome(), null, 'members never get the card');
  assert.equal(localStorage.getItem('fn_welcome_v1'), null);
});

test('someone who has just joined under a new name is new: the card, in a member’s words, with no door to join', async () => {
  await open(`#g=${NEWC}&f=${FID}&me=Zed`); // a personal link for a name not in the crew: the join screen asks
  assert.notEqual($('screen-join').style.display, 'none');
  $('join-name-input').value = 'Ana';
  $('join-add-btn').click();
  await settle(200);
  assert.equal($('dock-you').textContent, 'A');
  const box = welcome();
  assert.ok(box, 'the welcome, for someone new');
  assert.match(box.querySelector('.bring-sub').textContent, /Tap any artist to add yours\.$/);
  assert.ok(buttonNamed(box, 'Got it') && buttonNamed(box, 'How it works'));
  assert.equal(buttonNamed(box, 'Pick shows'), undefined, 'already joined: no door to join');
  buttonNamed(box, 'Got it').click();
  await settle(20);
  assert.equal(welcome(), null);
  assert.equal(localStorage.getItem('fn_welcome_v1'), '1', 'once per phone');
});

test('the words: one table, a clear choice for a guest, and the crews a friend can open onto', () => {
  const base = { crewName: 'Portola 26', festName: 'Portola' };
  const guest = welcomeCopy({ ...base, people: ['Kevin'], picked: true, guest: true });
  assert.deepEqual([guest.yes, guest.more, guest.join], [WORDS.look, WORDS.how, WORDS.join]);
  assert.deepEqual([guest.yes, guest.join], ['Look around', 'Pick shows']);
  assert.equal(guest.sub, 'Every friend has a color — the more color on a card, the more of us want to go.', 'the buttons say the choice');
  const member = welcomeCopy({ ...base, people: ['Kevin'], picked: true, guest: false });
  assert.deepEqual([member.yes, member.join], ['Got it', null]);
  assert.deepEqual(
    [welcomeCopy({ ...base, people: [] }).line, welcomeCopy({ ...base, people: [] }).sub],
    ['Nobody’s in this crew yet.', 'Tap any artist to be first — you’ll pick a name as you do.'],
  );
  assert.equal(welcomeCopy({ ...base, people: [], guest: true }).join, 'Pick shows', 'an empty crew too: someone has to be first');
  assert.equal(welcomeCopy({ ...base, people: ['Kevin'], picked: false }).line, 'Kevin started this plan for Portola. Nobody’s picked yet.');
  assert.equal(welcomeCopy({ ...base, people: ['Kevin', 'Maya'], picked: false }).line, 'This is the crew’s plan for Portola. Nobody’s picked yet.');
  assert.equal(welcomeCopy({ ...base, people: ['Kevin'], picked: false, guest: false, meName: 'Kevin' }).line,
    'Your plan for Portola is ready. Nobody’s picked yet.', 'never told about yourself in the third person');
  assert.equal(guest.label, 'Portola 26');
  assert.doesNotMatch(JSON.stringify(guest), /going\b|must see/i, 'a pick is interest, not a ticket');
});
