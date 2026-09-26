// One thing at a time at the bottom of the screen (WebKit walk, iPhone 15,
// 2026-09-23). Adding Portola again from Home — a second crew at a festival
// you already picked in — plans the bring-your-picks offer, and the
// post-create "ONE LINK MAKES IT A CREW" share moment opened at the same
// instant, covering the card: a real tap on "Bring it" hit the sheet. The
// offer now waits for the share moment to close (Later, ✕, Escape, Back, the
// backdrop — no grabber since 2026-09-26), then arrives with its usual beat.
// Never both at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { FID, INDEX, FEST, crewDoc, json, within } from './helpers/warm-rig.mjs';

const ROSS = 'bringaftershare_ross_0123'; // made-up crews, never real links
const NEW = 'bringaftershare_new_01234';
const PID = 'pid_share_0001';
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
    fn_person_v1: JSON.stringify({ token: 'personshare_token_0123456', id: PID, name: 'Kevin', crews: {} }),
    fn_crews_v3: JSON.stringify([{ token: ROSS, name: '' }]),
    [`fn_me_v3_${ROSS}`]: 'Kev',
    [`fn_crew_doc_v3_${ROSS}`]: JSON.stringify(ROSS_DOC),
  },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const offer = () => document.getElementById('bring-offer');
const sheet = () => document.getElementById('artist-sheet');

test('a second Portola crew is created: the share moment comes up — and the offer does not come up under it', async () => {
  await settle(60);
  const portola = [...$('create-fests').querySelectorAll('button')].find((b) => /^PORTOLA/.test(b.textContent));
  portola.click();
  $('create-go-multi').click();
  assert.notEqual(await within(2000, () => !!sheet()), null, 'the share moment is up');
  assert.match(sheet().textContent, /ONE LINK MAKES IT A CREW/);
  assert.equal(sheet().querySelector('.grabber'), null, 'no grabber on it (Kevin, 2026-09-26): its ✕, Later and the dimmed wall close it');
  assert.equal(sheet().firstElementChild.querySelector('.sheet-title')?.textContent, 'ONE LINK MAKES IT A CREW', 'its title row leads');
  await settle(150);
  assert.equal(offer(), null, 'the offer waits: never both at once');
});

test('the share moment closes (Later): the offer arrives', async () => {
  const later = [...sheet().querySelectorAll('button')].find((b) => b.textContent === 'Later');
  later.click();
  assert.notEqual(await within(1500, () => !sheet()), null, 'the sheet is gone');
  assert.notEqual(await within(1500, () => !!offer()), null, 'and the offer arrives');
  assert.match(offer().querySelector('.bring-line').textContent, /from your crew with Ross\?/);
});
