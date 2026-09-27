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
const { passesPeople } = await import('../js/v3/filters.js');
const NINE = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/plan-crew-nine.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const plan = P.planOf(FEST, { picks: NINE.picks, members: NINE.members });
const ctx = { picks: NINE.picks };
const TOKEN = 'madeuptoken_0123456789'; // made up, never a real link
const linkFor = (night) => `https://fest.kevinhg.com/f/portola-2026#g=${TOKEN}&f=portola-2026&plan=${night}`; // app.js planLink's shape
const LINK = linkFor('2026-09-26');

// What app.js hands planText for a moment: the peek's night, the clock on it.
function at(iso, highlight = []) {
  const date = new Date(iso);
  const peek = P.peekOf(plan, FEST, date, { people: highlight });
  const now = P.planAt(plan, FEST, date);
  const nowMin = peek.today && now && now.night.id === peek.night.id ? now.minutes : null;
  const opts = { ctx, plan, nowMin, highlight, fest: FEST.name, day: peek.night.wd, today: peek.today, link: linkFor(peek.night.iso) };
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

// A highlight filters the Share (Sol, on the release head): only the stops
// the highlighted people are in, a room named for what THEY picked there, and
// the five that are the most of THEM — passesPeople's question (filters.js,
// the one "did they pick this"), so the List and the Share never disagree.
test('a highlight applies: only the stops the highlighted people are in, a room named for what they picked', () => {
  assert.equal(at('2026-09-26T21:40:00-07:00', ['Cy']).text, [
    'Our crew\'s main picks for Sat Portola, now till end of day',
    '',
    'Pier Stage for Dog Blood @ now till 10:15pm',
    'Public Works for Milli Meng and Fcukers @ ~10:55pm', // Cy picked no Chloé Caillet
    '',
    `Full rundown: ${LINK}`,
  ].join('\n'));
});

test('a highlight ranks by the highlighted: the five are the most of them, and every act named is one they picked', () => {
  const cases = [
    ['2026-09-26T11:00:00-07:00', ['Ben', 'Eli', 'Gus']],
    ['2026-09-26T21:40:00-07:00', ['Ben', 'Eli', 'Gus']],
    ['2026-09-26T11:00:00-07:00', ['Gus']],
    ['2026-09-27T12:00:00-07:00', ['Ana', 'Hal']],
  ];
  for (const [iso, people] of cases) {
    const { route, opts } = at(iso, people);
    const kept = planPicks(route, opts);
    const everything = planPicks(route, { ...opts, limit: Infinity });
    assert.ok(kept.length > 0, `${iso} ${people}: something to share`);
    const lowest = Math.min(...kept.map((k) => k.count));
    for (const x of everything) {
      assert.ok(x.count >= 1 && x.count <= people.length, `${x.line}: ${x.count} of ${people.length}`);
      for (const a of x.acts) assert.ok(passesPeople(NINE.picks, a, people), `${iso} ${people}: ${x.line} names ${a}, which none of them picked`);
      if (!kept.some((k) => k.line === x.line)) assert.ok(x.count <= lowest, `${iso} ${people}: ${x.line} (${x.count}) outranks a kept line (${lowest})`);
    }
  }
  // Three friends' afternoon: the places all three are at, not the crew's big stops.
  assert.deepEqual(planPicks(...(({ route, opts }) => [route, opts])(at('2026-09-26T11:00:00-07:00', ['Ben', 'Eli', 'Gus']))).map((x) => [x.line, x.count]), [
    ['Warehouse for Groove Armada @ 4:45pm', 3],
    ['Crane Stage for DJ Shadow @ 6:10pm', 3],
    ['Warehouse for Kettama @ 7:15pm', 3],
    ['Warehouse for Prospa @ 10:15pm', 3],
    ['Audio for Emilio and Airwolf Paradise @ ~11pm', 3],
  ]);
});

// Sol, on the release head (2026-09-26): the route's Pier Stage stop ran on
// to 8:15 past Zara Larsson's 8:05, so at 8:10 the Share said "Pier Stage for
// Zara Larsson @ now till 8:05pm". Nothing is "now" once it is over.
test('Sunday 8:10 PM: a set that ended at 8:05 is gone, and every "now" is still on', () => {
  const { text } = at('2026-09-27T20:10:00-07:00');
  assert.equal(text, [
    'Our crew\'s main picks for Sun Portola, now till end of day',
    '',
    'Warehouse for Tiësto @ now till 8:15pm', // a fork of her stop, and still on
    'Warehouse for Overmono @ 8:20pm',
    'Pier Stage for Swedish House Mafia @ 8:45pm',
    'Crane Stage for Parcels @ 10pm',
    'The Midway for Two Shell @ ~12:30am',
    '',
    `Full rundown: ${linkFor('2026-09-27')}`,
  ].join('\n'));
  assert.doesNotMatch(text, /Zara Larsson/);
  for (const [, h, m, ap] of text.matchAll(/now till (\d+)(?::(\d+))?(am|pm)/g)) {
    const min = (Number(h) % 12 + (ap === 'pm' ? 12 : 0)) * 60 + Number(m || 0);
    assert.ok(min > 20 * 60 + 10, `"now till ${h}${m ? `:${m}` : ''}${ap}" is over at 8:10pm`);
  }
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
