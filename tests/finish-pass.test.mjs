// Regression tests for the finish-pass fixes (2026-07-12).
//
// Every one of these bugs shipped because nothing asserted the behaviour: the
// app told a lie (a banner naming the wrong festival, an Export the app's own
// importer refuses) and every test stayed green. So each fix gets a test that
// fails against the code as it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

const state = await import('../js/state.js');
const crew = await import('../js/crew.js');
const { exportLikesText } = await import('../js/v3/tools.js');
const { festRow } = await import('../js/v3/tools.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');

FESTIVAL_INDEX.push({ id: 'fin-fest', status: 'scheduled' });
FESTIVALS['fin-fest'] = {
  id: 'fin-fest', name: 'Fin Fest', year: "'26", status: 'scheduled',
  stages: [], days: {}, artists: [{ name: 'GRiZ' }, { name: 'Lane 8' }],
};

// ---- Export must not emit what Bulk paste will refuse -------------------------

test('Export leaves out removed members — its output really is paste-ready', () => {
  state.activateCrew('fintoken_export_0123456', {
    v: 4, meta: {}, spotify: {},
    people: { Kev: { colorIndex: 0 }, Ghost: { colorIndex: 1, removed: true } },
    festivals: {
      'fin-fest': { selections: { GRiZ: { Kev: 4, Ghost: 3 }, 'Lane 8': { Ghost: 2 } } },
    },
    affinity: {},
  });
  state.setActiveFestivalId('fin-fest');

  const text = exportLikesText({ fid: 'fin-fest' });

  // Export's own caption promises the output is "paste-ready for Bulk paste",
  // and Bulk paste accepts active members only — so a Ghost line came straight
  // back as "Unknown people skipped: Ghost."
  assert.ok(text.includes('Kev: GRiZ'), 'an active member’s pick is exported');
  assert.ok(!text.includes('Ghost'), 'a removed member’s picks are not — the importer would reject them');
});

// ---- A broken link must say it is broken --------------------------------------

test('a truncated crew link is recognised as broken, not treated as no link', () => {
  location.hash = '#g=short';
  assert.equal(crew.tokenFromHash(), null);
  assert.equal(
    crew.hashHasBrokenToken(), true,
    'a clipped link used to fall silently through to the landing page, telling the person nothing',
  );

  location.hash = '';
  assert.equal(crew.hashHasBrokenToken(), false, 'no link at all is NOT a broken link — landing is correct');

  // Built, not written out: a valid-SHAPED token literal in a committed file is
  // exactly what the pre-commit token scan exists to stop, and a scanner that
  // cries wolf on its own test fixtures is one people learn to wave through.
  location.hash = '#g=' + 'a'.repeat(24);
  assert.equal(crew.hashHasBrokenToken(), false, 'a good link is not broken');

  location.hash = '';
});

// ---- One fest row, and past festivals look past --------------------------------

test('festRow mutes a past festival and badges it — on every screen that uses it', () => {
  const f = { id: 'x', name: 'Old Fest', year: "'25", dates: 'Oct 3', accent: '250, 204, 21' };

  const past = festRow(f, { muted: true, onPick: () => {} });
  assert.ok(parseFloat(past.style.opacity) < 1, 'a past festival is quiet');
  assert.ok(past.textContent.includes('PAST'), 'and says so');

  const live = festRow(f, { muted: false, onPick: () => {} });
  assert.ok(!(parseFloat(live.style.opacity) < 1), 'a live festival is not dimmed');
  assert.ok(!live.textContent.includes('PAST'));
});

test('festRow is ONE component — Settings’ chevron variant is an option, not a fork', () => {
  const f = { id: 'x', name: 'Fest', year: "'26", dates: 'Oct 3' };
  const withChev = festRow(f, { chev: true, sub: '3 artists picked', onPick: () => {} });
  const plain = festRow(f, { onPick: () => {} });

  assert.ok(withChev.querySelector('.chev'), 'Settings keeps its drill-in affordance');
  assert.equal(plain.querySelector('.chev'), null, 'the create-flow picker does not');
  assert.ok(withChev.textContent.includes('3 artists picked'), 'and its pick count');
  // Both are the same class and the same builder — which is the whole point.
  assert.equal(withChev.className, plain.className);
});

// ---- Sheets must give focus back --------------------------------------------

test('a no-op closeSheet() does not forget who opened the sheet', async () => {
  // The real bug, caught on staging with every piece of the fix already in
  // place: sheets open with `rememberOpener(); closeSheet();` — the closeSheet
  // being belt-and-braces in case one was already up. closeSheet() then nulled
  // the opener unconditionally, so it was thrown away a moment after capture and
  // focus fell to <body> on close. Green unit tests, broken app.
  const { rememberOpener, closeSheet } = await import('../js/v3/notes.js');

  const opener = document.createElement('button');
  opener.textContent = 'Open the sheet';
  document.body.appendChild(opener);
  opener.focus();
  assert.equal(document.activeElement, opener);

  rememberOpener();
  closeSheet();            // nothing is open — this must not forget the opener

  // Now a sheet really is up, and something inside it has focus.
  const sheet = document.createElement('div');
  sheet.id = 'artist-sheet';
  const inner = document.createElement('button');
  sheet.appendChild(inner);
  document.body.appendChild(sheet);
  inner.focus();

  closeSheet();            // the real close

  assert.equal(
    document.activeElement, opener,
    'focus returns to whatever opened the sheet, not to <body>',
  );
  opener.remove();
});

test('festRow fires its callback with the festival', () => {
  const f = { id: 'chosen', name: 'Fest', year: "'26" };
  let got = null;
  const row = festRow(f, { onPick: (x) => { got = x; } });
  row.dispatchEvent(new dom.window.Event('click'));
  assert.equal(got?.id, 'chosen');
});
