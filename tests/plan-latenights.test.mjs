// Our picks on ACL's first Late night (2026-09-29): a ROOM stop with two
// picked acts — Mohawk Austin, Total Wife at a posted 8 PM, then Fcukers at
// a GUESSED ~8:45 PM (`approx`), close 12 AM. A made-up crew of five whose
// bar (3) is met only when Fcukers starts, so the stop begins at 8:45 PM.
//
// Two things the rows got wrong (the tonight probe,
// claude-plans/2026-09-29-tuesday/acl-latenights.md):
//   · the act a room stop "speaks for" (its node, the card grown under its
//     NOW row, and whether its time wears the tilde) was the EARLIEST of its
//     headliners, not the one most of its people picked as plan-rows.js
//     says: at 11:59 PM, with Fcukers on, the NOW row grew Total Wife's
//     card;
//   · so the stop's start, 8:45 PM — Fcukers' guessed start — was printed
//     without its tilde, in the row and in the Share: a guess read as fact.
//     The tilde now follows the act the start rests on: the room's act
//     playing at the stop's first minute.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { paintFree } from './helpers/paint-free.mjs';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
const store = new Map();
globalThis.localStorage = globalThis.localStorage || { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
paintFree(dom.window);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = await import('../js/v3/plan.js');
const { planText, stopRow, grownEl } = await import('../js/v3/plan-rows.js');
const state = await import('../js/state.js');
const FEST = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
const MEMBERS = ['Ada', 'Bo', 'Cal', 'Dee', 'Eve'];
const PICKS = { // invented
  'Total Wife': { Ada: 3, Bo: 2 },
  Fcukers: { Bo: 3, Dee: 2, Ada: 2 },
  'Brandon Flowers': { Bo: 3, Cal: 3 },
  Parcels: { Ada: 4, Eve: 2 },
  Lorde: { Ada: 4, Bo: 3 },
};
state.activateCrew(['late', 'nights', 'test', '0123456789'].join('_'), { // made up, never a real link
  v: 4, meta: {}, spotify: {}, affinity: {}, festivals: { 'acl-2026': { selections: PICKS } },
  people: Object.fromEntries(MEMBERS.map((m, i) => [m, { colorIndex: i }])),
}, 'acl-2026', { festival: 'acl-2026' });
const plan = P.planOf(FEST, { picks: PICKS, members: MEMBERS });
const ctx = { picks: PICKS, meName: 'Ada' };
const entry = (name, date) => FEST.artists.find((a) => a.name === name && a.date === date);

function at(iso) {
  const date = new Date(iso);
  const peek = P.peekOf(plan, FEST, date);
  const now = P.planAt(plan, FEST, date);
  const nowMin = peek.today && now && now.night.id === peek.night.id ? now.minutes : null;
  const opts = { ctx, plan, peek, nowMin, fest: FEST.name, day: 'Sep 29', today: peek.today, link: 'LINK' };
  return { peek, nowMin, text: planText(peek.night, opts) };
}

test('the shipped file: Total Wife is posted, Fcukers is a guess, one room', () => {
  assert.equal(entry('Total Wife', '2026-09-29').approx, undefined);
  assert.equal(entry('Fcukers', '2026-09-29').approx, true);
  assert.equal(entry('Fcukers', '2026-09-29').venue, entry('Total Wife', '2026-09-29').venue);
});

test('8:20 PM: the Mohawk stop starts at Fcukers’ guessed ~8:45 — the row and the Share both wear the tilde', () => {
  const { peek, text } = at('2026-09-29T20:20:00-05:00');
  assert.equal(peek.tag, 'next');
  assert.equal(peek.stop.place.place, 'Mohawk Austin');
  assert.equal(P.quietClock(peek.stop.from), '8:45 PM');
  const row = stopRow(peek.stop, { ctx, plan, tag: 'next' });
  assert.equal(row.querySelector('.plan-when .t').textContent, '~8:45 PM');
  assert.equal(text, [
    'Our crew\'s main picks for Sep 29 ACL Music Festival, now till end of day',
    '',
    'Mohawk Austin for Total Wife and Fcukers @ ~8:45pm',
    '',
    'Full rundown: LINK',
  ].join('\n'));
});

test('11:59 PM: the NOW row grows the card of the act most of the stop picked — Fcukers, who is on — not the opener', () => {
  const { peek } = at('2026-09-29T23:59:00-05:00');
  assert.equal(peek.tag, 'now');
  const card = grownEl(peek.stop, ctx);
  assert.equal(card.querySelector('.f-name').textContent, 'Fcukers');
});

test('a stop that starts on a posted time keeps it plain: Stubb’s at 8 PM would read "8 PM", its guessed 8:30 "~8:30"', () => {
  // Oct 1 at Stubb's: Jess Williamson posted at 8 PM, Brandon Flowers a
  // guessed 8:30. Bo and Cal (Brandon) and a third for Jess.
  const picks = { 'Jess Williamson': { Ada: 2, Eve: 2, Dee: 2 }, 'Brandon Flowers': { Bo: 3, Cal: 3, Ada: 3 } };
  const pl = P.planOf(FEST, { picks, members: MEMBERS });
  const stops = pl.night('2026-10-01').items.filter((i) => i.kind === 'stop' && i.place.place === 'Stubb\'s');
  assert.ok(stops.length > 0, JSON.stringify(pl.night('2026-10-01').items.map((i) => [i.kind, i.from])));
  const first = stops[0];
  const row = stopRow(first, { ctx: { picks, meName: 'Ada' }, plan: pl });
  const t = row.querySelector('.plan-when .t').textContent;
  assert.equal(t, P.quietClock(first.from) === '8 PM' ? '8 PM' : `~${P.quietClock(first.from)}`, `${t} for a stop from ${P.quietClock(first.from)}`);
});
