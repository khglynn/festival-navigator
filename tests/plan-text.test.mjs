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
const { planText, planPicks, planDays } = await import('../js/v3/plan-rows.js');
const { passesPeople } = await import('../js/v3/filters.js');
const state = await import('../js/state.js');
const NINE = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/plan-crew-nine.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
// The open plan's rows draw the crew's faces, so they read a crew doc: the
// nine, made up, on a made-up token (never a real link).
state.activateCrew(['plan', 'text', 'test', '0123456789'].join('_'), {
  v: 4, meta: {}, spotify: {}, affinity: {}, festivals: { 'portola-2026': { selections: {} } },
  people: Object.fromEntries(NINE.members.map((m, i) => [m, { colorIndex: i }])),
}, 'portola-2026', { festival: 'portola-2026' });
const plan = P.planOf(FEST, { picks: NINE.picks, members: NINE.members });
const ctx = { picks: NINE.picks };
const TOKEN = 'madeuptoken_0123456789'; // made up, never a real link
const linkFor = (night) => `https://fest.kevinhg.com/f/portola-2026#g=${TOKEN}&f=portola-2026&plan=${night}`; // app.js planLink's shape
const LINK = linkFor('2026-09-26');

// The open plan's rows for the night it lands on (plan-rows.js planDays, the
// list the shelf draws): the rows that night carries, the Earlier line included.
const nightRows = (route, { ctx: cx, plan: pl, peek = null, nowMin = null }) => [...planDays(pl, { ctx: cx, peek, from: route.id, nowMin })
  .querySelectorAll('.plan-row')].filter((r) => r.dataset.night === route.id);

// What app.js hands planText for a moment: the peek's night, the clock on it.
// A highlight is an input to the plan (plan.js rule 10), as app.js builds it.
function at(iso, highlight = []) {
  const date = new Date(iso);
  const pl = highlight.length ? P.planOf(FEST, { picks: NINE.picks, members: NINE.members, people: highlight }) : plan;
  const peek = P.peekOf(pl, FEST, date);
  const now = P.planAt(pl, FEST, date);
  const nowMin = peek.today && now && now.night.id === peek.night.id ? now.minutes : null;
  const opts = { ctx, plan: pl, peek, nowMin, fest: FEST.name, day: peek.night.wd, today: peek.today, link: linkFor(peek.night.iso) };
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

// A highlight filters the Share (Sol, on the release head; plan.js rule 10
// since the plan-days build): the plan is theirs, so the lines are their
// stops, a room named for what THEY picked there, and the five that are the
// most of THEM — passesPeople's question (filters.js, the one "did they pick
// this"), so the List and the Share never disagree. Still no name leaves the
// phone: one person's day goes out as "Picks", a few people's as "Our picks".
test('a highlight applies: their day, a room named for what they picked, and the head unnamed', () => {
  const { text } = at('2026-09-26T21:40:00-07:00', ['Cy']);
  assert.equal(text, [
    'Picks for Sat Portola, now till end of day',
    '',
    'Pier Stage for Dog Blood @ now till 10:15pm',
    'Crane Stage for Soulwax @ 9:55pm', // the pick his day gives up for Dog Blood: its or-line
    'Regency Ballroom for Parcels @ ~10:15pm',
    'Public Works for Milli Meng and Fcukers @ ~10:30pm', // Cy picked no Chloé Caillet
    '',
    `Full rundown: ${LINK}`,
  ].join('\n'));
  for (const [, acts] of text.matchAll(/ for (.+) @ /g)) for (const a of acts.split(/, | and /)) assert.ok(passesPeople(NINE.picks, a, ['Cy']), `${a}: Cy picked it`);
  assert.match(at('2026-09-26T21:40:00-07:00', ['Ana', 'Cy', 'Hal']).text, /^Our picks for Sat Portola, now till end of day\n/);
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
  // Three friends' afternoon: the places all three are at, not the crew's big
  // stops, at the times THEIR route reaches them — DJ Shadow from 6:10 and
  // Prospa from 9:45, where the crew's route got there at 6:30 and 10:15.
  assert.deepEqual(planPicks(...(({ route, opts }) => [route, opts])(at('2026-09-26T11:00:00-07:00', ['Ben', 'Eli', 'Gus']))).map((x) => [x.line, x.count]), [
    ['Warehouse for Groove Armada @ 4:45pm', 3],
    ['Crane Stage for DJ Shadow @ 6:10pm', 3],
    ['Warehouse for Kettama @ 7:15pm', 3],
    ['Warehouse for Prospa @ 9:45pm', 3],
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

// Sol, round two on the release head (2026-09-26): with a highlight on, a
// stop counted anyone who was in it at ANY point, then read "now" while the
// crew's stop ran. At 7:15 Ben has left Robyn for Kettama; a Ben-only Share
// said both were "now". A "now" line is the people there NOW.
test('a highlight\'s "now" is where they are now: Ben at 7:15 PM is at Kettama, not Robyn', () => {
  const { text } = at('2026-09-26T19:15:00-07:00', ['Ben']);
  assert.match(text, /Warehouse for Kettama @ now till 8:30pm/);
  assert.doesNotMatch(text, /Robyn/, 'he left Robyn at 7:15');
  assert.equal((text.match(/@ now/g) || []).length, 1, 'one person is in one place');
});

// The Share is a digest of the Full rundown, so it reads the rows the open
// plan shows and no others (round two: its own reading of the route named an
// or-line the rows never draw — a stop shows one, forkFor's — and, on a model
// change, a line the rows had folded away). Friday 8:45 PM: Public Works has
// two or-lines, Regency Ballroom (3) and 1015 Folsom (4); its row shows 1015
// Folsom, so the Share does too, and never the Regency one.
test('Friday 8:45 PM: an or-line the open plan does not show is not in the Share', () => {
  const { route, opts, text } = at('2026-09-25T20:45:00-07:00');
  assert.match(text, /1015 Folsom for 2manydjs @ ~12:30am/);
  assert.doesNotMatch(text, /Regency Ballroom/, 'the Regency stop is over, and its later or-line is not the row\'s');
  const rows = nightRows(route, opts).filter((r) => !r.classList.contains('past')).map((r) => r.textContent);
  assert.ok(!rows.some((t) => t.includes('Regency Ballroom')), 'the rows show no Regency line either');
});

// Every night, every five minutes, the whole crew and eight highlights, on
// Portola's nine and a made-up nine at ACL (its rooms, its two weekends):
// every line the Share could send is a row the open plan is showing (not
// folded into Earlier, not past), every "now till" is still to come, and a
// highlighted "now" has one of them there at that minute.
function aclNine() {
  const fest = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
  const picks = {};
  let h = 7; // a fixed seed: the same made-up crew every run
  for (const a of fest.artists) for (const m of NINE.members) {
    h = (h * 1103515245 + 12345) % 2147483648;
    if (h % 5 === 0) (picks[a.name] ||= {})[m] = 1 + ((h >> 8) % 4);
  }
  return { fest, offset: '-05:00', picks, members: NINE.members };
}
test('the Share only ever names what the open plan shows, and "now" only while it is on — every night, every five minutes', () => {
  const rigs = [{ fest: FEST, offset: '-07:00', picks: NINE.picks, members: NINE.members }, aclNine()];
  const clock = (t) => { let m = (Number(t[1]) % 12 + (t[3] === 'pm' ? 12 : 0)) * 60 + Number(t[2] || 0); return m < 5 * 60 ? m + 24 * 60 : m; };
  const problems = [];
  let lines = 0;
  for (const rig of rigs) {
    const pl = P.planOf(rig.fest, { picks: rig.picks, members: rig.members });
    const cx = { picks: rig.picks };
    const m = rig.members;
    const highlights = [[], [m[0]], [m[1]], [m[6]], [m[0], m[7]], [m[1], m[4], m[6]], m.slice(2, 5), m.slice(4, 9), m.slice(0, 8)];
    const plans = new Map(highlights.map((hl) => [hl.join(','), hl.length ? P.planOf(rig.fest, { picks: rig.picks, members: rig.members, people: hl }) : pl]));
    const shown = new Map();
    for (const n of pl.nights) {
      const stops = pl.night(n.id).items.filter((i) => i.kind === 'stop');
      if (!stops.length || !n.iso) continue;
      const midnight = new Date(`${n.iso}T00:00:00${rig.offset}`).getTime();
      for (let t = Math.min(...stops.map((s) => s.from)) - 30; t <= Math.max(...stops.map((s) => s.to)); t += P.STEP) {
        const date = new Date(midnight + t * 60000);
        for (const hl of highlights) {
          const hp = plans.get(hl.join(','));
          const peek = P.peekOf(hp, rig.fest, date);
          if (!peek || !peek.today) continue;
          const now = P.planAt(hp, rig.fest, date);
          const nowMin = now && now.night.id === peek.night.id ? now.minutes : null;
          const key = [hl.join(','), peek.night.id, nowMin, peek.tag, peek.stop.from, peek.stop.place.id].join('|');
          if (!shown.has(key)) {
            shown.set(key, nightRows(peek.night, { ctx: cx, plan: hp, peek, nowMin })
              .filter((r) => !r.classList.contains('past') && !r.classList.contains('earlier')).map((r) => r.textContent));
          }
          const rows = shown.get(key);
          const say = (why, x) => problems.length < 8 && problems.push(`${rig.fest.id} ${n.iso} ${P.quietClock(nowMin ?? t)} [${hl}] ${why}: ${x.line}`);
          for (const x of planPicks(peek.night, { ctx: cx, plan: hp, peek, nowMin, limit: Infinity })) {
            lines++;
            const title = x.line.split(' @ ')[0];
            const where = title.split(' for ')[0];
            // A set or a party is its act; a room is its place (its title names
            // the highlighted people's picks there, the row the whole crowd's).
            const act = (x.stop.placeKind || x.stop.place.kind) !== 'room' && title.includes(' for ') ? x.acts[0] : null;
            if (!rows.some((r) => r.includes(where) && (!act || r.includes(act)))) say('not in the open plan', x);
            const till = x.line.match(/now till (\d+)(?::(\d+))?(am|pm)/);
            if (till && clock(till) <= nowMin) say('over, and still "now"', x);
            if (/@ now/.test(x.line) && hl.length) {
              const here = (x.stop.timeline || x.stop.crowds || []).find((c) => c.t <= nowMin && nowMin < c.t + P.STEP);
              if (!here || !here.people.some((p) => hl.includes(p))) say('"now" with none of them there', x);
            }
          }
        }
      }
    }
  }
  assert.deepEqual(problems, []);
  assert.ok(lines > 20000, `the sweep read ${lines} lines`);
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

// Rule 9 (DESIGN.md A4, settled 2026-09-26): a drop-in room is not a place to
// meet at a time, so the Share leaves it out. The Despacio crew (the nine plus
// Despacio picked by seven) sends the nine's words exactly, at every minute a
// friend might share on Friday and Saturday.
test('a drop-in room never goes into the Share: the Despacio crew sends the nine\'s words', () => {
  const picks = { ...NINE.picks, Despacio: { Ana: 1, Ben: 1, Cy: 2, Dot: 1, Fay: 4, Gus: 4, Ivy: 1 } };
  const despacio = P.planOf(FEST, { picks, members: NINE.members });
  const textAt = (pl, cx, date) => {
    const peek = P.peekOf(pl, FEST, date);
    if (!peek) return null;
    const now = P.planAt(pl, FEST, date);
    const nowMin = peek.today && now && now.night.id === peek.night.id ? now.minutes : null;
    return planText(peek.night, { ctx: cx, plan: pl, peek, nowMin, fest: FEST.name, day: peek.night.wd, today: peek.today, link: linkFor(peek.night.iso) });
  };
  let n = 0;
  for (let t = Date.parse('2026-09-25T12:00:00-07:00'); t < Date.parse('2026-09-27T05:00:00-07:00'); t += 15 * 60000) {
    const d = new Date(t);
    const mine = textAt(despacio, { picks }, d);
    assert.equal(mine, textAt(plan, ctx, d), d.toISOString());
    if (mine) { n++; assert.doesNotMatch(mine, /Despacio|Pier 80/, d.toISOString()); }
  }
  assert.ok(n > 100, `${n} shares compared`);
});
