// Touching the wall is engaging (v92, the guest shelf round): a guest's tap on
// a card takes the welcome card down — its words have done their job — and
// opens the card's shelf (the tap change, 2026-09-26). A file of its own,
// because the welcome shows once per page. (A member's first tap does the
// same: app.js handleTap asks nobody's name before taking it down.)
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
const CREW = 'firstopentapwelc_crew_012'; // made up, never a real link
const DOC = {
  v: 4, meta: { name: 'Tap Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: { Robyn: { Kevin: 2 } } } },
};
const writes = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  if ((opts.method || 'GET') !== 'GET') { writes.push(u); return json({ error: 'not in this test' }, 503); }
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?')) return json(DOC);
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({ url: `https://fest.kevinhg.com/#g=${CREW}&f=${FID}`, fetch: network });
test.after(() => shell.close());
await settle(160);

test('a guest’s finger tap on a card takes the welcome down and opens the card’s shelf', async () => {
  assert.ok(document.getElementById('welcome-card'), 'the welcome is up');
  const card = document.querySelector('#wall-root .card[data-artist="Robyn"]');
  card.dispatchEvent(new shell.dom.window.PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
  card.click();
  await settle(20);
  assert.equal(document.getElementById('welcome-card'), null, 'its words have done their job');
  assert.equal(localStorage.getItem('fn_welcome_v1'), '1', 'read, on this phone');
  const sheet = document.getElementById('artist-sheet');
  assert.ok(sheet && sheet.querySelector('.sheet-card .f-step-row'), 'the card is open on its shelf, − · meter · + along the floor');
  assert.equal(document.querySelector('#zoom-layer .zoom-card'), null, 'no zoom');
  assert.equal(document.querySelector('.join-shelf'), null, 'nothing asked: a tap looks');
  assert.deepEqual(writes, []);
});
