// A show's doors out (2026-09-24). Kevin: "when it's afters or shows like
// this I naturally want to click through to the event page. we have tix but
// do those always have details… and what about before tix are available… we
// need to do this for portola and other afters and folsom and multi-location
// events everywhere." And the words: "For all of these lets do 'Tixs @
// [location]' - tigher and clearer."
//
// An artists[] entry may carry `page: { url, at }` and `tickets: { url, at }`;
// the zoom reads them as "Tix @ AXS · Info @ DoTheBay" (events.js linksOf).
// Shape: docs/add-a-festival.md, "Event pages and tickets".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.cancelAnimationFrame = () => {};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const state = await import('../js/state.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { factsFor, sheetCard } = await import('../js/v3/card-facts.js');
const { linksOf } = await import('../js/v3/events.js');
const { validateFestivalDoc } = await import('../api/_lib/festival-rules.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (id) => JSON.parse(readFileSync(join(ROOT, 'data/festivals', `${id}.json`), 'utf8'));
const onGrid = (fest, a) => String(a.day || '').split('&').every((p) => Object.keys(fest.days || {}).includes(p.trim()));

const PAGE = { url: 'https://dothebay.com/events/2026/9/25/six-sex-tickets', at: 'DoTheBay' };
const TIX = { url: 'https://www.axs.com/events/1579125/six-sex-tickets?cid=usaffdostuff', at: 'AXS' };

test('linksOf: tickets first, then the page, each in Kevin’s words', () => {
  assert.deepEqual(linksOf({ page: PAGE, tickets: TIX }), [
    { kind: 'tix', text: 'Tix @ AXS', url: TIX.url },
    { kind: 'info', text: 'Info @ DoTheBay', url: PAGE.url },
  ]);
});

test('linksOf: before tickets exist the page is the one door; tickets alone are one door too', () => {
  assert.deepEqual(linksOf({ page: PAGE }), [{ kind: 'info', text: 'Info @ DoTheBay', url: PAGE.url }]);
  assert.deepEqual(linksOf({ tickets: TIX }), [{ kind: 'tix', text: 'Tix @ AXS', url: TIX.url }]);
});

test('linksOf: when the page IS the ticket page, one door says it', () => {
  const same = { url: 'https://www.eventbrite.com/e/deviants-123', at: 'Eventbrite' };
  assert.deepEqual(linksOf({ page: same, tickets: { ...same, url: 'https://eventbrite.com/e/deviants-123/' } }).map((l) => l.text), ['Tix @ Eventbrite']);
});

test('linksOf: a cancelled show keeps its page (what happened) and loses its tickets', () => {
  assert.deepEqual(linksOf({ page: PAGE, tickets: TIX }, { cancelled: true }).map((l) => l.text), ['Info @ DoTheBay']);
  assert.equal(linksOf({ tickets: TIX }, { cancelled: true }), null);
});

test('linksOf: nothing insecure, nothing unnamed, and nothing at all for a festival set', () => {
  assert.equal(linksOf({ page: { url: 'http://dothebay.com/x', at: 'DoTheBay' } }), null);
  assert.equal(linksOf({ tickets: { url: 'https://axs.com/1', at: '  ' } }), null);
  assert.equal(linksOf({ page: 'https://dothebay.com/x' }), null, 'a bare string is not the shape');
  assert.equal(linksOf({ name: 'Soulwax', day: 'Saturday' }), null);
  assert.equal(linksOf(null), null);
});

test('the validator: page and tickets are { url: https, at: a short name }, and nothing else', () => {
  const doc = (extra) => ({
    id: 'x-2026', name: 'X', year: "'26", dates: 'Sep 1', status: 'lineup', location: 'Austin, TX',
    artists: [{ name: 'A', day: 'Late nights', date: '2026-09-29', venue: 'Mohawk', ...extra }],
  });
  const errs = (extra) => validateFestivalDoc(doc(extra)).errors.filter((e) => /\.(page|tickets)/.test(e));
  assert.deepEqual(errs({ page: PAGE, tickets: TIX }), []);
  assert.match(errs({ page: { url: 'http://x.com', at: 'X' } }).join(), /page\.url must be an https URL/);
  assert.match(errs({ tickets: { url: 'https://x.com' } }).join(), /tickets\.at must name the site/);
  assert.match(errs({ tickets: { url: 'https://x.com', at: 'A name far too long for one zoom line' } }).join(), /24 chars at most/);
  assert.match(errs({ page: { ...PAGE, label: 'x' } }).join(), /page\.label is not a field/);
  assert.match(errs({ page: 'https://x.com' }).join(), /page must be an object \{ url, at \}/);
});

for (const id of ['portola-2026', 'acl-2026']) {
  test(`${id}: every link is https and named, no festival set carries one, and a room's bill shares its links`, () => {
    const fest = load(id);
    const off = fest.artists.filter((a) => !onGrid(fest, a));
    assert.ok(off.length > 50, 'the afters / late nights are there');
    for (const a of fest.artists) {
      for (const f of ['page', 'tickets']) {
        if (!a[f]) continue;
        assert.ok(!onGrid(fest, a), `${a.name}: a festival set carries no ${f}`);
        assert.match(a[f].url, /^https:\/\/\S+$/, `${a.name}.${f}.url`);
        assert.ok(a[f].at && a[f].at.length <= 24, `${a.name}.${f}.at`);
      }
    }
    // One room on one night is one show with one page: a name added to a
    // bill that already has a page takes the room's page (and its tickets).
    // Forgetting to is how S.I.M, Espurr and New Nostalgia first arrived on
    // Sun The Midway with no doors (2026-09-25). A brand-new room with no
    // known page yet is fine: its page comes when there is one.
    const rooms = new Map();
    for (const a of off) {
      if (a.cancelled) continue;
      const k = `${a.day}|${a.night || a.date}|${a.venue}`;
      if (!rooms.has(k)) rooms.set(k, []);
      rooms.get(k).push(a);
    }
    for (const [k, bill] of rooms) {
      const withPage = bill.filter((a) => a.page);
      if (!withPage.length) continue;
      const missing = bill.filter((a) => !a.page).map((a) => a.name);
      assert.deepEqual(missing, [], `${k}: these names are on a bill whose room has a page; copy its page and tickets onto them`);
    }
  });
}

test('the zoom’s facts: a Portola afters set says where to buy and where to read; a festival set says nothing new', () => {
  const portola = load('portola-2026');
  FESTIVALS['portola-2026'] = portola;
  if (!FESTIVAL_INDEX.some((f) => f.id === 'portola-2026')) FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' });
  // A throwaway crew in memory; its token is a fake and never leaves the test.
  state.activateCrew('showlinkstesttoken_0123456', {
    v: 4, meta: {}, spotify: {}, people: { Ava: { colorIndex: 0 } },
    festivals: { 'portola-2026': { selections: {} } }, affinity: {},
  }, 'portola-2026');
  state.setActiveFestivalId('portola-2026');
  const ctx = { picks: {}, meName: 'Ava', fid: 'portola-2026', affinity: null };
  const gelli = portola.artists.find((a) => a.name === 'Gelli Haha' && a.venue === 'Regency Ballroom');
  const occ = { day: gelli.day, stage: gelli.stage, time: gelli.time, date: null, venue: gelli.venue };
  const run = factsFor('Gelli Haha', ctx, occ);
  assert.deepEqual(run.links.map((l) => l.text), ['Tix @ AXS', 'Info @ DoTheBay']);
  const setOnly = portola.days.Saturday.artists[0];
  assert.equal(factsFor(setOnly.name, ctx, { day: 'Saturday', stage: setOnly.stage, time: setOnly.time }).links, null);
  // The notes sheet's header is the same builder: the doors ride along.
  const sheet = sheetCard(run, {});
  assert.deepEqual([...sheet.querySelectorAll('.f-links a.f-link')].map((a) => a.textContent), ['Tix @ AXS', 'Info @ DoTheBay']);
});
