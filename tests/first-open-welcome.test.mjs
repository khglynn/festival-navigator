// The welcome card and the bring-your-picks offer take turns (v92). Both sit
// above the dock, and one thing at a time is the rule there: on a phone that
// has not been welcomed yet, the welcome goes first and the offer waits;
// "Got it" is the moment the offer may ask. A member sees the welcome once
// too (Kevin's default: once to everyone), in a member's words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { welcomeCopy } from '../js/v3/welcome.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));

// Made-up crews, never real links; built into URLs, never written after `#g=`.
const HERE = 'firstopenwelc_here_01234';
const ROSS = 'firstopenwelc_ross_01234';
const PID = 'pid_firstopen_welc';
const PERSON = { token: 'personfirstwelc_token_0123', id: PID, name: 'Kevin', crews: {} };
const crewDoc = (people, selections = {}) => ({
  v: 4, meta: { name: 'Here Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people, festivals: { [FID]: { selections } },
});
const HERE_DOC = crewDoc({ Kevin: { colorIndex: 0, pid: PID }, Nhu: { colorIndex: 1 } }, { Prospa: { Nhu: 3 } });
const ROSS_DOC = crewDoc({ Kev: { colorIndex: 0, pid: PID }, Ross: { colorIndex: 3 } }, { Soulwax: { Kev: 1 }, Kettama: { Kev: 4 } });

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u === '/api/person') return json({ id: PID, doc: { v: 1, name: 'Kevin', crews: {} } });
  if (u.startsWith('/api/crew?')) {
    if ((opts.method || 'GET') !== 'GET') return json({ error: 'not in this test' }, 503);
    return json(HERE_DOC);
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
const welcome = () => document.getElementById('welcome-card');
const offer = () => document.getElementById('bring-offer');
const buttonNamed = (root, label) => [...root.querySelectorAll('button')].find((b) => b.textContent === label);

await settle(160);

test('a recognized member is welcomed once too — in a member’s words — and the offer waits', () => {
  const box = welcome();
  assert.ok(box, 'the welcome is up');
  assert.match(box.querySelector('.bring-sub').textContent, /Tap any artist to add yours\.$/, 'a member adds theirs');
  assert.equal(offer(), null, 'the offer does not ask before the welcome has been read');
  assert.equal(buttonNamed(box, 'Pick with the crew'), undefined, 'a member is already picking: no door to join');
});

test('"Got it": the welcome goes, remembered on this phone, and the offer asks', async () => {
  buttonNamed(welcome(), 'Got it').click();
  await settle(20);
  assert.equal(welcome(), null);
  assert.equal(localStorage.getItem('fn_welcome_v1'), '1');
  assert.ok(offer(), 'now the offer');
  assert.match(offer().querySelector('.bring-line').textContent, /Bring your 2 Portola picks from your crew with Ross\?/);
});

test('the words for the other crews a friend can open onto', () => {
  const base = { crewName: 'Portola 26', festName: 'Portola' };
  assert.deepEqual(
    [welcomeCopy({ ...base, people: [] }).line, welcomeCopy({ ...base, people: [] }).sub],
    ['Nobody’s in this crew yet.', 'Tap any artist to be first — you’ll pick a name as you do.'],
  );
  assert.equal(welcomeCopy({ ...base, people: ['Kevin'], picked: false }).line, 'Kevin started this plan for Portola. Nobody’s picked yet.');
  assert.equal(welcomeCopy({ ...base, people: ['Kevin', 'Maya'], picked: false }).line, 'This is the crew’s plan for Portola. Nobody’s picked yet.');
  assert.equal(welcomeCopy({ ...base, people: ['Kevin'], picked: false, guest: false, meName: 'Kevin' }).line,
    'Your plan for Portola is ready. Nobody’s picked yet.', 'a creator is never told about themselves in the third person');
  assert.match(welcomeCopy({ ...base, people: ['Kevin'], picked: false }).sub, /Tap any artist to be first\.$/);
  assert.equal(welcomeCopy({ ...base, people: ['Kevin'], picked: true }).label, 'Portola 26');
  assert.equal(welcomeCopy({ ...base, people: ['Kevin'], picked: true, guest: true }).join, 'Pick with the crew');
  assert.equal(welcomeCopy({ ...base, people: [], guest: true }).join, 'Pick with the crew', 'an empty crew too: someone has to be first');
  assert.equal(welcomeCopy({ ...base, people: ['Kevin'], picked: true, guest: false }).join, null);
  assert.doesNotMatch(JSON.stringify(welcomeCopy({ ...base, people: ['Kevin'], picked: true })), /going\b|must see/i,
    'a pick is interest, not a ticket');
});
