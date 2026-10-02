// A stand-in's plan sends no link (v107: linkOf is null), so its foot must
// not say what a link would open on. v107's last review found the one path
// that still did: under a highlight the foot read "Opens on everyone's
// picks" — about a link the Share never sends.
//
// Portola's Saturday, 8:30 PM: ACL will not load (no signal), this phone
// holds Portola, and the crew has picks there, so tonight's plan is up.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-26T20:30:00-07:00').getTime() });

const { bootShell, settle, settleUntil } = await import('./helpers/shell-rig.mjs');
const { cachesHolding } = await import('./helpers/warm-rig.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const PORTOLA = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const TOKEN = 'heldfallback_planfoot_01'; // made up
const FID = 'acl-2026';
const DOC = {
  v: 4, meta: { name: 'ACL Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 }, Ana: { colorIndex: 2 } }, // a plan needs three (FLOOR_MIN)
  festivals: { [FID]: { selections: {} }, 'portola-2026': { selections: { 'Dog Blood': { Kevin: 3, Ross: 2, Ana: 1 } } } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u.startsWith('/api/crew?')) return json(DOC);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/data/festivals/')) throw new TypeError('Load failed');
  return json({ error: 'not in this test' }, 503);
}

globalThis.caches = cachesHolding({ '/data/festivals/portola-2026.json': PORTOLA });
const shell = await bootShell({
  url: 'https://fest.kevinhg.com/',
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'ACL Crew' }]),
    fn_active_crew_v3: TOKEN,
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(DOC),
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    fn_welcome_v1: '1',
    fn_coach_v1: '1', // the welcome card puts the plan away; this phone has seen it
  },
  fetch: network,
});
test.after(() => { shell.close(); delete globalThis.caches; mock.timers.reset(); });
const { $, dom } = shell;
const state = await import('../js/state.js');
// "On screen" for jsdom (tests/plan-shelf.test.mjs's answer): not inside
// anything hidden.
dom.window.Element.prototype.getClientRects = function () {
  for (let e = this; e; e = e.parentElement) {
    if (e.hidden || e.style.display === 'none' || e.classList.contains('hidden') || e.classList.contains('searching')) return [];
  }
  return [{ top: 0, left: 0, width: 1, height: 1 }];
};

test('a stand-in’s plan foot promises no link, with a highlight or without', async () => {
  await settleUntil(() => $('screen-app').style.display !== 'none', { timeout: 4000 });
  assert.equal(state.isShownForNow(), true, 'Portola stands in for ACL');
  const foot = () => document.querySelector('#plan .opens');
  await settleUntil(() => !!foot() && !document.getElementById('plan').hidden, { timeout: 3000 });
  assert.ok(foot(), 'tonight’s plan is up');
  assert.equal(foot().textContent, '', 'no highlight');
  document.querySelector('#person-chips .person-chip.you').click();
  await settle(100);
  assert.equal(document.querySelector('#person-chips .person-chip.you').getAttribute('aria-pressed'), 'true', 'you are highlighted');
  assert.equal(foot().textContent, '', `under a highlight: "${foot().textContent}"`);
});
