// The wall's address follows its festival (v96 — Sol's review of 3599950, and
// the independent walk). Since v96 the wall's address carries the festival
// twice — /f/<fest> for link previews, &f=<fest> for the app — and boot
// rewrites it. A festival switched in Settings is not a boot: it saved and
// showed the new festival and left the address on the old one. A link copied
// from the bar previewed the wrong festival, and a reload went back to it
// (the stale &f= is a hint, and a hint wins at boot). Now the address is
// rewritten when the wall comes back into view (closeSettings).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = 'festswitchaddress_0123456'; // a made-up crew, never a real link
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const fest = (id) => JSON.parse(readFileSync(join(ROOT, `data/festivals/${id}.json`), 'utf8'));
const FESTS = { 'portola-2026': fest('portola-2026'), 'acl-2026': fest('acl-2026') };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const DOC = {
  v: 4, meta: { name: 'Two Fests', inviteFestId: 'portola-2026' }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } },
  festivals: { 'portola-2026': { selections: {} }, 'acl-2026': { selections: {} } },
};
async function network(url) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  for (const [id, f] of Object.entries(FESTS)) if (u === `/data/festivals/${id}.json`) return json(f);
  if (u.startsWith('/api/crew?')) return json(DOC);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({
  url: `https://fest.kevinhg.com/f/portola-2026#g=${TOKEN}&f=portola-2026`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'Two Fests' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_fest_v3_${TOKEN}`]: 'portola-2026',
    fn_welcome_v1: '1',
  },
  fetch: network,
});
test.after(() => shell.close());
const { $, dom } = shell;
const until = async (ok) => { for (let i = 0; i < 200 && !ok(); i += 1) await settle(10); };
await until(() => $('screen-app').style.display !== 'none');
const app = await import('../js/v3/app.js');
const state = await import('../js/state.js');
const loc = dom.window.location;
const festOfHash = () => (/[#&]f=([^&]+)/.exec(loc.hash) || [])[1];

test('a festival switched in Settings moves the address with it, and a reload stays on it', async () => {
  assert.equal(loc.pathname, '/f/portola-2026', 'the wall opens on Portola’s address');
  $('gear-btn').click();
  await until(() => $('screen-settings').style.display !== 'none');
  const row = [...$('settings-root').querySelectorAll('button.fest-row')].find((b) => /ACL/i.test(b.textContent));
  assert.ok(row, 'Settings offers the crew’s other festival');
  row.click();
  await until(() => $('screen-app').style.display !== 'none' && state.activeFestivalId === 'acl-2026');
  await settle(40);
  assert.equal(state.activeFestivalId, 'acl-2026', 'the wall is ACL now');
  assert.equal(loc.pathname, '/f/acl-2026', 'and the address says so — a link from the bar previews ACL');
  assert.equal(festOfHash(), 'acl-2026', 'the app’s own copy of it too');
  assert.ok(loc.hash.startsWith(`#g=${TOKEN}`), 'the crew still in the hash, never in the path');

  // A reload: the page boots again from the address it has.
  await app.boot();
  await until(() => $('screen-app').style.display !== 'none');
  await settle(40);
  assert.equal(state.activeFestivalId, 'acl-2026', 'a reload stays on ACL — the address no longer sends it back to Portola');
  assert.equal(loc.pathname, '/f/acl-2026');
});
