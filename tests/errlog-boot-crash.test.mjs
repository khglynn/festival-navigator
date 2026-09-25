// The boot crash reaches Kevin (v88, 2026-09-24). Before v88, boot()'s catch
// wrote `console.error('boot failed', e)` and showed "WELL, THAT WASN'T THE
// PLAN" — and a CAUGHT error never reaches the global hooks, so the one crash
// that locks a friend out of the app was the one Diagnostics could not see
// (DESIGN §1). Now it names itself: journaled on the phone, queued as a
// `$exception` of kind `boot`, and sent the next time there is signal —
// scrubbed, with the crew link and the person token its message carried cut
// out, and with who it happened to (the public pid, the name in the crew).
//
// The real index.html and app.js, booted in jsdom. The crash is one this test
// writes on purpose — the crew document's `people` throws when the app
// reads it — so the test never leans on some other bug to fail.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// A fixed afternoon well before any fest in the catalogue: nothing is live, so
// NOW never renders during boot (a real night-time clock once did, 2026-09-24).
mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-10T17:00:00Z').getTime() });

const { bootShell, settle } = await import('./helpers/shell-rig.mjs');
const { INDEX, FID, FEST, SCREENS, within } = await import('./helpers/warm-rig.mjs');

const KEY = 'phc_testkeyForFestivalNavigatorCI01';
const CREW = randomBytes(20).toString('base64url'); // made the server's way, never committed
const PERSON = randomBytes(20).toString('base64url');
const PID = randomBytes(9).toString('base64url');

const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: () => 'application/json' },
  json: async () => body,
});
const broken = {
  v: 4, meta: { name: '', inviteFestId: FID }, spotify: {}, affinity: {}, festivals: { [FID]: { selections: {} } },
  get people() { throw new TypeError(`people unreadable for https://fest.kevinhg.com/#g=${CREW} (${PERSON})`); },
};
const reports = [];
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${CREW}`,
  reportKey: KEY,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: CREW, name: '' }]),
    [`fn_me_v3_${CREW}`]: 'Kevin',
    fn_person_v1: JSON.stringify({ token: PERSON, id: PID, name: 'Kevin', crews: { [CREW]: { name: 'Kevin', crewName: '' } } }),
  },
  fetch: async (url, opts = {}) => {
    const u = String(url);
    if (u === '/fn-i/batch') { reports.push(JSON.parse(opts.body)); return res({ status: 'Ok' }); }
    if (u.includes('/data/festivals/index.json')) return res(INDEX);
    if (u.includes(`/data/festivals/${FID}.json`)) return res(FEST);
    if (u.includes('/api/crew')) return res(broken);
    if (u.includes('/api/festival-add')) return res({ festivals: [] });
    return res({}, 503);
  },
});
test.after(() => { shell.close(); mock.timers.reset(); });
const { $, dom } = shell;
const errlog = await import('../js/errlog.js'); // the SAME instance app.js holds
const queued = () => JSON.parse(globalThis.localStorage.getItem('fn_telemetry_q_v1') || '[]');

test('the boot crash shows the error screen and is journaled on the phone', async () => {
  assert.notEqual(await within(2000, () => $('screen-error').style.display !== 'none'), null, 'the fatal screen');
  assert.deepEqual(SCREENS.filter((id) => $(id).style.display !== 'none'), ['screen-error']);
  const last = errlog.recent().at(-1);
  assert.equal(last.kind, 'boot');
  assert.ok(!last.msg.includes(CREW) && !last.msg.includes(PERSON), 'the journal Diagnostics pastes is scrubbed too');
});

test('it is queued as one fatal $exception, scrubbed, carrying the pid and the name', () => {
  const q = queued();
  assert.equal(q.length, 1);
  const raw = JSON.stringify(q);
  assert.ok(!raw.includes(CREW) && !raw.includes(PERSON), 'no token on the phone\'s queue either');
  const p = q[0].e.properties;
  assert.equal(p.kind, 'boot');
  assert.equal(p.$exception_level, 'fatal');
  assert.equal(p.$exception_list[0].type, 'TypeError');
  assert.equal(p.$exception_list[0].mechanism.handled, true);
  assert.equal(p.pid, PID);
  assert.equal(p.member_name, 'Kevin');
  assert.equal(p.$issue_name, undefined, 'a boot crash is named by its own message');
});

test('the next time there is signal, exactly one scrubbed report goes to the rewrite path', async () => {
  dom.window.dispatchEvent(new dom.window.Event('online'));
  await settle(50);
  assert.equal(reports.length, 1);
  const wire = JSON.stringify(reports[0]);
  for (const secret of [CREW, PERSON, '#g=']) assert.ok(!wire.includes(secret), `the wire never carries ${secret === '#g=' ? 'a crew link' : 'a token'}`);
  assert.equal(reports[0].api_key, KEY);
  assert.equal(reports[0].batch[0].properties.kind, 'boot');
  assert.deepEqual(queued(), [], 'sent, so off the phone');
});
