// The Show menu's fade out, raced (v92 — the re-review of b29aac0). Closed
// and reopened inside its 130 ms fade, the OLD fade's end used to hide the
// NEW menu while aria-expanded still said open and the dock stayed raised
// above the cards (z39). Now a fade ends the moment its menu is reopened, and
// a fade's end never hides the menu that is open. The raise and aria-expanded
// follow the real state on every path. jsdom has no Element.animate, so the
// menu's own element gets one whose ending this test controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = 'menufadetest_crew_012345'; // made up, never a real link
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const DOC = { v: 4, meta: { name: 'Fade Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/crew?')) return json(DOC);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_welcome_v1: '1',
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'Fade Crew' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
  },
  fetch: network,
});
test.after(() => shell.close());
await settle(160);
const { $ } = shell;

const link = () => $('dock-fest-link');
const dock = () => $('dock');
const pop = () => $('dock-fest-wrap').querySelector('.sort-pop');
// Every fade the menu starts, held until the test ends it.
const fades = [];
function holdFades() {
  const el = pop();
  el.animate = (frames, opts) => {
    const a = {
      frames, opts, onfinish: null, oncancel: null, ended: false,
      finish() { if (this.ended) return; this.ended = true; if (this.onfinish) this.onfinish(); },
      cancel() { if (this.ended) return; this.ended = true; if (this.oncancel) this.oncancel(); },
    };
    fades.push(a);
    return a;
  };
}
const shown = () => pop().style.display !== 'none';
const raised = () => dock().classList.contains('menu-up');
const expanded = () => link().getAttribute('aria-expanded');
const lastExit = () => [...fades].reverse().find((a) => a.frames[0].opacity === 1);

test('closed and reopened inside the fade: the old fade’s end never hides the new menu', () => {
  holdFades();
  link().click();
  assert.equal(shown(), true, 'open');
  link().click(); // close — the fade starts
  const oldFade = lastExit();
  assert.ok(oldFade && !oldFade.ended, 'fading out');
  assert.equal(expanded(), 'false');
  link().click(); // reopened before the fade is done
  assert.equal(shown(), true, 'open again');
  assert.equal(expanded(), 'true');
  assert.equal(raised(), true);
  oldFade.finish(); // the old fade's end arrives late
  assert.equal(shown(), true, 'the reopened menu is still showing');
  assert.equal(expanded(), 'true', 'and says so');
  assert.equal(raised(), true, 'and the dock is still above the cards');
  link().click(); // close for real
  lastExit().finish();
  assert.equal(shown(), false, 'closed');
  assert.equal(expanded(), 'false');
  assert.equal(raised(), false, 'the dock stepped back');
});

test('a rapid double close ends where one close ends', () => {
  holdFades();
  link().click();
  link().click(); // close: fading
  document.dispatchEvent(new shell.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); // a second close, nothing open
  assert.equal(expanded(), 'false');
  lastExit().finish();
  assert.equal(shown(), false);
  assert.equal(raised(), false);
});
