// The words the open plan's Share sends (2026-09-26, Kevin's shape from the
// design round's review page): a head, at most five of our top picks from
// now on in time order, and the link that opens on the plan. The real
// Portola file and the made-up nine (tests/fixtures/plan-crew-nine.json),
// with the clock where a friend would be reading it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// plan-rows.js draws rows too, so it reads a document and storage at import.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
const store = new Map();
globalThis.localStorage = globalThis.localStorage || { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = await import('../js/v3/plan.js');
const { planText, planPicks } = await import('../js/v3/plan-rows.js');
const NINE = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/plan-crew-nine.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const plan = P.planOf(FEST, { picks: NINE.picks, members: NINE.members });
const ctx = { picks: NINE.picks };
const TOKEN = 'madeuptoken_0123456789'; // made up, never a real link
const LINK = `https://fest.kevinhg.com/f/portola-2026#g=${TOKEN}&f=portola-2026&plan=open`;

// What app.js hands planText for a moment: the peek's night, the clock on it.
function at(iso, highlight = []) {
  const date = new Date(iso);
  const peek = P.peekOf(plan, FEST, date, { people: highlight });
  const now = P.planAt(plan, FEST, date);
  const nowMin = peek.today && now && now.night.id === peek.night.id ? now.minutes : null;
  const opts = { ctx, plan, nowMin, highlight, fest: FEST.name, day: peek.night.wd, today: peek.today, link: LINK };
  return { route: peek.night, opts, text: planText(peek.night, opts) };
}

test('Saturday before the gates: the head, five of our top picks in time order, a blank line either side, the link last', () => {
  assert.equal(at('2026-09-26T11:00:00-07:00').text, [
    'Our crew\'s main picks for Sat Portola, now till end of day',
    '',
    'Pier Stage for Gelli Haha @ 2:40pm',
    'Pier Stage for Tove Lo @ 5:40pm',
    'Pier Stage for Robyn @ 7:10pm',
    'Pier Stage for Dog Blood @ 9pm',
    'Public Works for Milli Meng, Chloé Caillet and Fcukers @ ~10:55pm',
    '',
    `Full rundown: ${LINK}`,
  ].join('\n'));
});

test('Saturday 9:40 PM: what is on says till when, what is over is gone, and a room is one line at its first time', () => {
  assert.equal(at('2026-09-26T21:40:00-07:00').text, [
    'Our crew\'s main picks for Sat Portola, now till end of day',
    '',
    'Pier Stage for Dog Blood @ now till 10:15pm',
    'Crane Stage for Soulwax @ 10:15pm',
    'Warehouse for Prospa @ 10:15pm',
    'Public Works for Milli Meng, Chloé Caillet and Fcukers @ ~10:55pm',
    'The Great Northern for Groove Armada @ ~1:30am',
    '',
    `Full rundown: ${LINK}`,
  ].join('\n'));
});

test('the five are the most of us: nothing left out was picked by more than any line kept', () => {
  const { route, opts } = at('2026-09-26T21:40:00-07:00');
  const kept = planPicks(route, opts);
  assert.equal(kept.length, 5);
  const everything = planPicks(route, { ...opts, limit: Infinity });
  const lowest = Math.min(...kept.map((k) => k.count));
  for (const x of everything) if (!kept.some((k) => k.line === x.line)) assert.ok(x.count <= lowest, `${x.line} (${x.count}) outranks a kept line (${lowest})`);
});

test('a highlight applies: only the stops the highlighted people are in', () => {
  assert.equal(at('2026-09-26T21:40:00-07:00', ['Cy']).text, [
    'Our crew\'s main picks for Sat Portola, now till end of day',
    '',
    'Pier Stage for Dog Blood @ now till 10:15pm',
    'Public Works for Milli Meng, Chloé Caillet and Fcukers @ ~10:55pm',
    '',
    `Full rundown: ${LINK}`,
  ].join('\n'));
});

test('no one is named: artists, places and times only', () => {
  for (const iso of ['2026-09-26T11:00:00-07:00', '2026-09-26T21:40:00-07:00', '2026-09-25T12:00:00-07:00']) {
    const { text } = at(iso);
    for (const name of NINE.members) assert.doesNotMatch(text, new RegExp(`\\b${name}\\b`), `${name} in: ${text}`);
    assert.doesNotMatch(text, /\bpicked\b|[–—]/, 'no counts, no dashes');
  }
});

test('a night that is not tonight has no "now", and the text stands without a link', () => {
  const { route, opts } = at('2026-09-26T21:40:00-07:00');
  const text = planText(route, { ...opts, today: false, nowMin: null, link: '' });
  assert.match(text, /^Our crew's main picks for Sat Portola\n\n/);
  assert.doesNotMatch(text, /now|Full rundown/);
  assert.match(text, /Pier Stage for Gelli Haha @ 2:40pm/, 'the whole night, from its first stop');
});
