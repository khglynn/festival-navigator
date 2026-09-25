// "Send crash reports to Kevin" (v88, Kevin 2026-09-24): one toggle in
// Settings → App, on by default, with a line beside it saying what goes —
// your name included. It is this phone's choice alone: it lives in the
// device's own settings and never in the crew doc (CLAUDE.md: mute/hide and
// every viewer-side choice stay off the shared doc). Off throws away what was
// waiting and nothing leaves after that; the journal on the phone keeps
// working. A build with no report key sends nothing, so it offers nothing.
//
// The real shell, booted as a warm open (the network never answers) on a
// pinned clock, so nothing is live and NOW never renders.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-10T17:00:00Z').getTime() });

const { bootShell, settle } = await import('./helpers/shell-rig.mjs');
const { FID, INDEX, FEST, crewDoc, heldNetwork, cachesHolding, within, SCREENS } = await import('./helpers/warm-rig.mjs');

const TOKEN = 'reporttoggle_0123456789ab'; // a made-up crew, never a real link
const KEY = 'phc_testkeyForFestivalNavigatorCI01';
const LABEL = 'Send crash reports to Kevin';

globalThis.caches = cachesHolding({ '/data/festivals/index.json': INDEX, [`/data/festivals/${FID}.json`]: FEST });
const net = heldNetwork();
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  reportKey: KEY,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(crewDoc({ Kevin: { colorIndex: 0 } })),
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; mock.timers.reset(); });
const { $, dom } = shell;
const errlog = await import('../js/errlog.js'); // the SAME instances app.js holds
const state = await import('../js/state.js');
const settingsSaved = () => JSON.parse(globalThis.localStorage.getItem('fn_settings_v1') || '{}');
const toggle = () => $('settings-root').querySelector(`button[role="switch"][aria-label="${LABEL}"]`);
const openSettings = async () => { $('gear-btn').click(); await settle(10); };
const closeSettings = async () => { $('settings-root').querySelector('.back-btn').click(); await settle(10); };

test('the toggle sits with the other device switches, on by default, saying what goes', async () => {
  assert.notEqual(await within(1500, () => SCREENS.filter((id) => $(id).style.display !== 'none').includes('screen-app')), null, 'the wall');
  errlog.record('error', new TypeError('before the switch'));
  assert.equal(errlog.pendingReports(), 1);
  await openSettings();
  const t = toggle();
  assert.ok(t, 'the toggle is there');
  assert.equal(t.getAttribute('aria-checked'), 'true', 'on by default');
  const row = t.closest('.list-row');
  assert.equal(row.querySelector('.row-title').textContent, LABEL);
  assert.match(row.querySelector('.row-sub').textContent, /your name/, 'the line beside it says the name goes');
  assert.match(row.querySelector('.row-sub').textContent, /never notes or crew links/);
  const rows = [...$('settings-root').querySelectorAll('button[role="switch"]')].map((b) => b.getAttribute('aria-label'));
  assert.deepEqual(rows, ['Low power', 'Stay offline', LABEL], 'the same component as its neighbours, right after them');
});

test('switching it off: saved on this device, the waiting report dropped, nothing written to the crew doc', async () => {
  const pendingBefore = JSON.stringify(state.pendingChanges);
  toggle().click();
  await settle(10);
  assert.equal(toggle().getAttribute('aria-checked'), 'false');
  assert.equal(settingsSaved().crashReports, false, 'the device\'s own settings');
  assert.equal(errlog.pendingReports(), 0, 'what was waiting is gone');
  assert.equal(JSON.stringify(state.pendingChanges), pendingBefore, 'the crew never hears about it');
  errlog.record('error', new TypeError('while off'));
  assert.equal(errlog.pendingReports(), 0, 'nothing queued while off');
  assert.equal(errlog.recent().at(-1).msg, 'while off', 'the journal on the phone still keeps it');
});

test('back on, and it survives closing Settings', async () => {
  toggle().click();
  await settle(10);
  assert.equal(settingsSaved().crashReports, true);
  await closeSettings();
  await openSettings();
  assert.equal(toggle().getAttribute('aria-checked'), 'true');
  errlog.record('error', new TypeError('on again'));
  assert.equal(errlog.pendingReports(), 1);
  assert.equal(net.calls.filter((c) => c.includes('/fn-i/')).length, 0, 'nothing was sent: no sync has succeeded');
});

test('a build with no report key offers no toggle', async () => {
  await closeSettings();
  dom.window.document.querySelector('meta[name="fn-report-key"]').setAttribute('content', '');
  await openSettings();
  assert.equal(toggle(), null);
  assert.ok($('settings-root').querySelector('button[role="switch"][aria-label="Stay offline"]'), 'the rest of the list is untouched');
});
