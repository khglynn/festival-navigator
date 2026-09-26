// A show's doors out (2026-09-24). Kevin: "when it's afters or shows like
// this I naturally want to click through to the event page. we have tix but
// do those always have details… and what about before tix are available… we
// need to do this for portola and other afters and folsom and multi-location
// events everywhere." And the words: "For all of these lets do 'Tixs @
// [location]' - tigher and clearer."
//
// An artists[] entry may carry `page: { url, at }` and
// `tickets: { url, at, price?, checked? }`; the zoom reads them as
// "Tix $69 · Info" (events.js linksOf) — never the seller's name (Kevin,
// 2026-09-26: "we never need to see the name of the site where the tix are
// sold"). Shape: docs/add-a-festival.md, "Event pages and tickets".
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
const TIX = { url: 'https://www.axs.com/events/1579125/six-sex-tickets?cid=usaffdostuff', at: 'AXS', price: 69, checked: '2026-09-26' };

test('linksOf: tickets first, then the page, each a plain word — never the seller (2026-09-26)', () => {
  assert.deepEqual(linksOf({ page: PAGE, tickets: TIX }), [
    { kind: 'tix', text: 'Tix $69', url: TIX.url, at: 'AXS' },
    { kind: 'info', text: 'Info', url: PAGE.url, at: 'DoTheBay' },
  ]);
});

test('linksOf: no price on file reads a bare "Tix"; a $0 ticket reads "Tix free"', () => {
  const noPrice = { url: TIX.url, at: 'AXS' };
  assert.deepEqual(linksOf({ tickets: noPrice }).map((l) => l.text), ['Tix']);
  assert.deepEqual(linksOf({ tickets: { ...noPrice, price: 0, checked: '2026-09-26' } }).map((l) => l.text), ['Tix free']);
});

test('linksOf: before tickets exist the page is the one door; tickets alone are one door too', () => {
  assert.deepEqual(linksOf({ page: PAGE }), [{ kind: 'info', text: 'Info', url: PAGE.url, at: 'DoTheBay' }]);
  assert.deepEqual(linksOf({ tickets: TIX }), [{ kind: 'tix', text: 'Tix $69', url: TIX.url, at: 'AXS' }]);
});

test('linksOf: when the page IS the ticket page, one door says it', () => {
  const same = { url: 'https://www.eventbrite.com/e/deviants-123', at: 'Eventbrite' };
  assert.deepEqual(linksOf({ page: same, tickets: { ...same, url: 'https://eventbrite.com/e/deviants-123/' } }).map((l) => l.text), ['Tix']);
});

test('linksOf: a cancelled show keeps its page (what happened) and loses its tickets', () => {
  assert.deepEqual(linksOf({ page: PAGE, tickets: TIX }, { cancelled: true }).map((l) => l.text), ['Info']);
  assert.equal(linksOf({ tickets: TIX }, { cancelled: true }), null);
});

test('linksOf: nothing insecure, nothing unnamed, and nothing at all for a festival set', () => {
  assert.equal(linksOf({ page: { url: 'http://dothebay.com/x', at: 'DoTheBay' } }), null);
  assert.equal(linksOf({ tickets: { url: 'https://axs.com/1', at: '  ' } }), null);
  assert.equal(linksOf({ page: 'https://dothebay.com/x' }), null, 'a bare string is not the shape');
  assert.equal(linksOf({ name: 'Soulwax', day: 'Saturday' }), null);
  assert.equal(linksOf(null), null);
});

test('the validator: page and tickets are { url: https, at: a short name }, tickets may add price + checked', () => {
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
  // price and checked travel together, and only tickets carries them.
  assert.deepEqual(errs({ tickets: { url: 'https://x.com', at: 'AXS', price: 25, checked: '2026-09-26' } }), []);
  assert.deepEqual(errs({ tickets: { url: 'https://x.com', at: 'AXS', price: 0, checked: '2026-09-26' } }), []);
  assert.match(errs({ tickets: { url: 'https://x.com', at: 'AXS', price: 25 } }).join(), /price and checked travel together/);
  assert.match(errs({ tickets: { url: 'https://x.com', at: 'AXS', checked: '2026-09-26' } }).join(), /price and checked travel together/);
  assert.match(errs({ tickets: { url: 'https://x.com', at: 'AXS', price: 19.5, checked: '2026-09-26' } }).join(), /price must be a whole number/);
  assert.match(errs({ tickets: { url: 'https://x.com', at: 'AXS', price: -1, checked: '2026-09-26' } }).join(), /price must be a whole number/);
  assert.match(errs({ tickets: { url: 'https://x.com', at: 'AXS', price: 2001, checked: '2026-09-26' } }).join(), /price must be a whole number/);
  assert.match(errs({ tickets: { url: 'https://x.com', at: 'AXS', price: 25, checked: '2026-13-40' } }).join(), /checked must be the real/);
  assert.match(errs({ tickets: { url: 'https://x.com', at: 'AXS', price: 25, checked: '09-26-2026' } }).join(), /checked must be the real/);
  assert.match(errs({ page: { ...PAGE, price: 25, checked: '2026-09-26' } }).join(), /page\.price is not a field/);
  // A festival's own set carries neither: the doors belong to shows in a section.
  const grid = validateFestivalDoc({
    id: 'x-2026', name: 'X', year: "'26", dates: 'Sep 1', status: 'lineup', location: 'Austin, TX',
    days: { Saturday: { stages: ['Main'], artists: [] } },
    artists: [{ name: 'A', day: 'Saturday', tickets: TIX }],
  }).errors;
  assert.match(grid.join(), /a festival set carries no tickets/);
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
        // price and checked travel together, only on tickets (2026-09-26).
        if (f === 'tickets') {
          const hasPrice = a.tickets.price !== undefined;
          const hasChecked = a.tickets.checked !== undefined;
          assert.equal(hasPrice, hasChecked, `${a.name}.tickets: price and checked travel together`);
          if (hasPrice) {
            assert.ok(Number.isInteger(a.tickets.price) && a.tickets.price >= 0 && a.tickets.price <= 2000, `${a.name}.tickets.price must be a whole number 0–2000`);
            assert.match(a.tickets.checked, /^\d{4}-\d{2}-\d{2}$/, `${a.name}.tickets.checked must be YYYY-MM-DD`);
          }
        } else {
          assert.equal(a.page.price, undefined, `${a.name}.page carries no price — only tickets does`);
        }
      }
    }
    // One room on one night with one doors time is one show with one page
    // and one ticket link: every name on that bill carries the same two. A
    // name added to a bill that already has links takes them (S.I.M, Espurr
    // and New Nostalgia first arrived on Sun The Midway with none), and an
    // opener found on the venue's page takes its headliner's (five ACL Late
    // nights openers pointed at the venue or the festival instead, the review
    // of #29). Two doors times in one room are two shows (an early and a late
    // show) and may differ. A brand-new room with no known page yet is fine.
    const shows = new Map();
    for (const a of off) {
      if (a.cancelled) continue;
      const k = `${a.day}|${a.night || a.date}|${a.venue}|${a.doors || ''}`;
      if (!shows.has(k)) shows.set(k, []);
      shows.get(k).push(a);
    }
    for (const [k, bill] of shows) {
      if (!bill.some((a) => a.page)) continue;
      const links = new Set(bill.map((a) => JSON.stringify([a.page || null, a.tickets || null])));
      assert.equal(links.size, 1, `${k}: one show, one page and one ticket link; these differ: ${bill.map((a) => `${a.name} → ${a.page ? a.page.at : 'no page'} / ${a.tickets ? a.tickets.at : 'no tickets'}`).join('; ')}`);
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
  // Expected text is derived from the live data's own price (whatever it is
  // priced at today), not hardcoded — a re-priced show shouldn't break this.
  const wantLinks = linksOf({ page: gelli.page, tickets: gelli.tickets }).map((l) => l.text);
  assert.deepEqual(run.links.map((l) => l.text), wantLinks);
  // A card that knows only a name borrows nobody's links: Overmono is a
  // Sunday festival set AND a Public Works afters, and its name-only facts
  // take the festival set's when and where (the review of #29).
  assert.equal(factsFor('Overmono', ctx).links, null, 'no occurrence, no links');
  const setOnly = portola.days.Saturday.artists[0];
  assert.equal(factsFor(setOnly.name, ctx, { day: 'Saturday', stage: setOnly.stage, time: setOnly.time }).links, null);
  // The notes sheet's header is the same builder: the doors ride along.
  const sheet = sheetCard(run, {});
  assert.deepEqual([...sheet.querySelectorAll('.f-links a.f-link')].map((a) => a.textContent), wantLinks);
});
