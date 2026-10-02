// plan_open counts every way the plan opens, once each (v108). Copilot's
// review: the drag let go past the line never passed through openPlan, so
// the shelf's most physical way in went uncounted. The count now lives at
// the one closed-to-open transition (plan-shelf.js settleTo).
//
// Portola's Saturday, 8:30 PM, three of us on Dog Blood: tonight's plan is up.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-26T20:30:00-07:00').getTime() });

const { bootShell, settle, settleUntil } = await import('./helpers/shell-rig.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const FID = 'portola-2026';
const TOKEN = 'usageplanopen_0123456789'; // made up
const KEY = 'phc_testkeyForFestivalNavigatorCI01';
const DOC = {
  v: 4, meta: { name: 'Three', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 }, Ana: { colorIndex: 2 } },
  festivals: { [FID]: { selections: { 'Dog Blood': { Kevin: 3, Ross: 2, Ana: 1 } } } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?') && (opts.method || 'GET') === 'GET') return json(DOC);
  return json({ error: 'not in this test' }, 503); // nothing leaves
}
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  reportKey: KEY,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'Three' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
    fn_welcome_v1: '1',
    fn_coach_v1: '1',
  },
  fetch: network,
});
test.after(() => { shell.close(); mock.timers.reset(); });
const { $, dom } = shell;
// "On screen" for jsdom (tests/plan-shelf.test.mjs's answer).
dom.window.Element.prototype.getClientRects = function () {
  for (let e = this; e; e = e.parentElement) {
    if (e.hidden || e.style.display === 'none' || e.classList.contains('hidden') || e.classList.contains('searching')) return [];
  }
  return [{ top: 0, left: 0, width: 1, height: 1 }];
};
const plan = () => $('plan');
const opens = () => JSON.parse(globalThis.localStorage.getItem('fn_telemetry_q_v1') || '[]')
  .filter((x) => x.k === 'usage' && x.e.event === 'plan_open').map((x) => x.e.properties.via);
const pointer = (type, target, y) => target.dispatchEvent(new dom.window.PointerEvent(type, { pointerId: 9, clientY: y, button: 0, bubbles: true }));

test('a drag let go past the line opens the plan and counts as one open, by drag; the grabber’s open counts as its own', async () => {
  await settleUntil(() => !!plan() && !plan().hidden, { timeout: 4000 });
  assert.equal(plan().dataset.state, 'peek');
  pointer('pointerdown', plan().querySelector('.plan-row.tagged') || plan(), 700);
  pointer('pointermove', plan(), 600);
  await new Promise((r) => setTimeout(r, 120)); // the hand stops, then lets go: no flick
  pointer('pointerup', plan(), 600);
  assert.equal(plan().dataset.state, 'open', 'released open');
  await new Promise((r) => setTimeout(r, 450)); // the click after a drag is swallowed for a moment
  plan().querySelector('.plan-grab').click(); // close
  await settle(40);
  assert.equal(plan().dataset.state, 'peek');
  plan().querySelector('.plan-grab').click(); // open again, by the grabber
  await settle(40);
  assert.equal(plan().dataset.state, 'open');
  await settle(2300);
  assert.deepEqual(opens(), ['drag', 'peek']);
});

// The Claude review of v108 (L6): during the festival the open lands on the
// now line — and that landing is a day view, today's, the one that matters
// most. It used to return before it was counted.
test('the live landing on the now line counts as today’s day view', async () => {
  const views = JSON.parse(globalThis.localStorage.getItem('fn_telemetry_q_v1') || '[]')
    .filter((x) => x.k === 'usage' && x.e.event === 'day_view').map((x) => x.e.properties);
  assert.deepEqual(views.map((v) => [v.via, v.is_today, v.day_kind]), [['boot', true, 'grid']]);
});
