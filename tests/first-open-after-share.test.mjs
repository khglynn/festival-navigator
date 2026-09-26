// One thing at a time at the bottom of the screen, three deep (v92). A
// creator who has never been welcomed makes a second Portola crew: the share
// moment comes up first, the welcome waits for it to close, and the
// bring-your-picks offer waits for "Got it". Never two at once, and nothing
// arriving under a sheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, within } from './helpers/warm-rig.mjs';

const ROSS = 'firstopenshare_ross_0123'; // made-up crews, never real links
const NEW = 'firstopenshare_new_01234';
const PID = 'pid_firstopen_share';
const ROSS_DOC = crewDoc({ Kev: { colorIndex: 0, pid: PID }, Ross: { colorIndex: 3 } }, { Robyn: { Kev: 4 }, Soulwax: { Kev: 1 } });
const NEW_DOC = { ...crewDoc({ Kevin: { colorIndex: 0, pid: PID } }, {}), meta: { name: 'Portola 2026', inviteFestId: FID } };

async function network(url, opts = {}) {
  const u = String(url);
  const method = opts.method || 'GET';
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u === '/api/person') {
    const sent = opts.body ? JSON.parse(opts.body).data || {} : {};
    return json({ id: PID, doc: { v: 1, name: 'Kevin', crews: sent.crews || {} } });
  }
  if (u === '/api/crew' && method === 'POST') return json({ token: NEW, doc: NEW_DOC }, 201);
  if (u.startsWith(`/api/crew?t=${NEW}`)) return method === 'GET' ? json(NEW_DOC) : json({ error: 'not in this test' }, 503);
  return json({ error: 'not in this test' }, 503);
}

const shell = await bootShell({
  url: 'https://fest.kevinhg.com/#new',
  storage: {
    fn_person_v1: JSON.stringify({ token: 'personfirstshare_token_012', id: PID, name: 'Kevin', crews: {} }),
    fn_crews_v3: JSON.stringify([{ token: ROSS, name: '' }]),
    [`fn_me_v3_${ROSS}`]: 'Kev',
    [`fn_crew_doc_v3_${ROSS}`]: JSON.stringify(ROSS_DOC),
  },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const offer = () => document.getElementById('bring-offer');
const welcome = () => document.getElementById('welcome-card');
const sheet = () => document.getElementById('artist-sheet');
const buttonNamed = (root, label) => [...root.querySelectorAll('button')].find((b) => b.textContent === label);

await settle(60);

test('the share moment comes up first — no welcome and no offer under it', async () => {
  const portola = [...$('create-fests').querySelectorAll('button')].find((b) => /^PORTOLA/.test(b.textContent));
  portola.click();
  $('create-go-multi').click();
  assert.notEqual(await within(2000, () => !!sheet()), null, 'the share moment is up');
  await settle(150);
  assert.equal(welcome(), null, 'the welcome waits for the sheet');
  assert.equal(offer(), null, 'and the offer waits too');
});

test('the share moment closes: the welcome arrives, the offer still waits', async () => {
  buttonNamed(sheet(), 'Later').click();
  assert.notEqual(await within(1500, () => !sheet()), null, 'the sheet is gone');
  assert.notEqual(await within(1500, () => !!welcome()), null, 'the welcome arrives');
  await settle(100);
  assert.equal(offer(), null, 'never two at once');
});

test('"Got it": the welcome goes and the offer asks', async () => {
  buttonNamed(welcome(), 'Got it').click();
  assert.notEqual(await within(1500, () => !!offer()), null, 'the offer arrives');
  assert.equal(welcome(), null);
  assert.match(offer().querySelector('.bring-line').textContent, /from your crew with Ross\?/);
});
