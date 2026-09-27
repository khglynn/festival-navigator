// Where a stop ends (the plan-days build's P4, 2026-09-27; DESIGN.md "Banked
// from the Share release: where a stop ends"). routeOf folded a blip — a
// crowd shift under 15 minutes — into the stop before it even after that
// stop's set was over, so the stop outlived its act: with the nine on Sunday
// the Warehouse's ten-minute Tiësto blip kept Zara Larsson's stop running to
// 8:15 on a set that ends at 8:05, and the peek said "NOW · Zara Larsson ·
// till 8:05 PM" at 8:05 and 8:10. DESIGN.md's acceptance tests, written
// before the fix, at every five minutes of every festival day: Portola's
// made-up nine, the made-up ACL nine (plan-text.test.mjs aclNine), the ACL
// crew the browser suites use, and seeded crews that meet a carry (the nine
// meet it once; seeded crews of nine meet it far more often — P4-PREP.md).
// Test 3 (the Share names only rows the open plan shows) is the sweep in
// tests/plan-text.test.mjs, kept; here it runs over the seeded crews too.
// Test 5 (the dock's NOW and the peek's NOW) is a browser test:
// tests/browser/plan-stop-ends.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { paintFree } from './helpers/paint-free.mjs';

// plan-rows.js draws rows too, so it reads a document and storage at import.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
const store = new Map();
globalThis.localStorage = globalThis.localStorage || { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
paintFree(dom.window); // the sweeps read words and classes, never paint

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = await import('../js/v3/plan.js');
const { planDays, planPicks, rowsKey, stopKey } = await import('../js/v3/plan-rows.js');
const state = await import('../js/state.js');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const NINE = read('tests/fixtures/plan-crew-nine.json');
const EIGHT = read('tests/fixtures/plan-crew-acl.json');
const PORTOLA = read('data/festivals/portola-2026.json');
const ACL = read('data/festivals/acl-2026.json');

// The rows draw the crew's faces, so they read a crew doc: made up, on a
// made-up token (never a real link).
state.activateCrew(['stop', 'ends', 'test', '0123456789'].join('_'), {
  v: 4, meta: {}, spotify: {}, affinity: {}, festivals: {},
  people: Object.fromEntries([...new Set([...NINE.members, ...EIGHT.members])].map((m, i) => [m, { colorIndex: i % 10 }])),
}, 'portola-2026', { festival: 'portola-2026' });

// A made-up crew from a fixed seed: the same picks every run (P4-PREP.md's
// rig, stop-ends.mjs, and plan-text.test.mjs's aclNine use this generator).
function seeded(fest, members, seed, every) {
  const picks = {};
  let h = seed;
  for (const a of fest.artists) for (const m of members) {
    h = (h * 1103515245 + 12345) % 2147483648;
    if (h % every === 0) (picks[a.name] ||= {})[m] = 1 + ((h >> 8) % 4);
  }
  return picks;
}
// The festivals' clocks on their dates (both inside daylight time).
const OFFSET = { 'America/Los_Angeles': '-07:00', 'America/Chicago': '-05:00' };
const rig = (name, fest, picks, members) => ({ name, fest, picks, members, offset: OFFSET[fest.timezone] });
// Seeds found by the rig to carry a stop past its act (2026-09-27): Portola
// 7919 (three carries, Fcukers, Bassvictim, Ben UFO), 15838 (Tiësto) and
// 31676 (Fatboy Slim, JT); ACL 55433 (The Chainsmokers, Oct 2), 79190 (The
// Chainsmokers and Charli xcx) and 95028 (Charli xcx, Oct 9).
const RIGS = [
  rig('the nine', PORTOLA, NINE.picks, NINE.members),
  rig('the made-up ACL nine', ACL, seeded(ACL, NINE.members, 7, 5), NINE.members),
  rig('the ACL crew', ACL, EIGHT.picks, EIGHT.members),
  ...[7919, 15838, 31676].map((s) => rig(`a seeded nine (${s})`, PORTOLA, seeded(PORTOLA, NINE.members, s, 6), NINE.members)),
  ...[55433, 79190, 95028].map((s) => rig(`a seeded nine (${s})`, ACL, seeded(ACL, NINE.members, s, 6), NINE.members)),
];
for (const r of RIGS) assert.ok(r.offset, `${r.fest.id}: a clock for ${r.fest.timezone}`);

// Where what a stop is FOR is over: a set's (or a party's) act — tillOf's
// reading — and a room's close.
const placeEnd = (s) => {
  const p = s.place;
  if ((s.placeKind || p.kind) === 'room') return p.end;
  const a = p.acts[0];
  return a && a.to != null ? a.to : p.end;
};
const actOf = (s) => ((s.placeKind || s.place.kind) === 'room' ? s.place.place : `${(s.place.acts[0] || {}).name} (${s.place.place})`);
const at = (m) => P.quietClock(m);
// "till 8:05 PM" (a row) or "till 8:05pm" (the Share), on the night's axis:
// the first time on that clock face from two hours before `nowMin` on. The
// broken reading this sweep hunts is minutes stale, while a night's axis runs
// past 24:00 (an afters party prints "till 6 AM") and a day party can run
// from 10 AM to "12 AM".
const tillMin = (text, nowMin) => {
  const t = text.match(/till (\d+)(?::(\d+))? ?([AaPp])[Mm]/);
  if (!t) return null;
  const m = (Number(t[1]) % 12 + (/[Pp]/.test(t[3]) ? 12 : 0)) * 60 + Number(t[2] || 0);
  return m + 1440 * Math.max(0, Math.ceil((nowMin - 120 - m) / 1440));
};

// Every five minutes of every festival day, from the first night to the
// morning after the last, on the festival clock's day (5 AM to 5 AM): what
// the app hands the peek and the open plan at that minute (app.js
// planAnswer: the peek, and the clock on its night while it is tonight).
function* moments(r, pl) {
  const isos = pl.nights.map((n) => n.iso).filter(Boolean).sort();
  if (!isos.length) return;
  const day = (iso, k) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
  for (let iso = isos[0]; iso <= day(isos[isos.length - 1], 1); iso = day(iso, 1)) {
    const midnight = new Date(`${iso}T00:00:00${r.offset}`).getTime();
    for (let t = 5 * 60; t < 29 * 60; t += P.STEP) {
      const date = new Date(midnight + t * 60000);
      const peek = P.peekOf(pl, r.fest, date);
      if (!peek) continue;
      const now = P.planAt(pl, r.fest, date);
      const nowMin = peek.today && now && now.night.id === peek.night.id ? now.minutes : null;
      yield { iso, t, date, peek, nowMin, route: peek.night };
    }
  }
}

// The open plan's rows for the peek's night, as the shelf draws them
// (plan-rows.js planDays, Earlier closed), cached on the shelf's own repaint
// signature (rowsKey, the drop-in lines' clock included) plus the peek's row:
// the same key draws the same rows (test 6 holds it to that).
const drawn = new Map(); // rig -> key -> rows
function rowsOf(pl, r, cx, { peek, nowMin, route }) {
  if (!drawn.has(r)) drawn.set(r, new Map());
  const cache = drawn.get(r);
  const key = [route.id, peek.tag, peek.stop ? stopKey(peek.stop) : '', peek.count, rowsKey(route, { plan: pl, peek, nowMin })].join('~');
  if (!cache.has(key)) {
    const rows = [...planDays(pl, { ctx: cx, peek, from: route.id, nowMin }).querySelectorAll('.plan-row')]
      .filter((e) => e.dataset.night === route.id)
      .map((e) => ({ stop: e.dataset.stop, text: e.textContent, live: e.classList.contains('live'), past: e.classList.contains('past'),
        or: e.classList.contains('or'), earlier: e.classList.contains('earlier'), till: (e.querySelector('.plan-when .t') || {}).textContent || '' }));
    cache.set(key, rows);
  }
  return cache.get(key);
}

// The one or-line a stop's row draws (plan-rows.js orLineOf): forkFor's,
// and for the NOW row one still to come.
const orLine = (s, pl, peek, nowMin) => P.forkFor(s, pl.bar, peek && peek.tag === 'now' && peek.stop && stopKey(peek.stop) === stopKey(s) ? nowMin : null);

const plans = new Map(RIGS.map((r) => [r, P.planOf(r.fest, { picks: r.picks, members: r.members })]));

// 1. Nothing reads NOW for an act that is over: not the peek, not the open
// plan's NOW row (its "till" still to come, never past the place's end), not
// a "now" line in the Share.
test('1. nothing reads NOW for an act that is over — the peek, the NOW row and the Share, every five minutes of every day', () => {
  const problems = [];
  let nows = 0;
  for (const r of RIGS) {
    const pl = plans.get(r);
    const cx = { picks: r.picks };
    const say = (m, why) => problems.length < 12 && problems.push(`${r.fest.id}, ${r.name}, ${m.iso} ${at(m.t)}: ${why}`);
    for (const m of moments(r, pl)) {
      const { peek, nowMin, route } = m;
      if (peek.tag === 'now') {
        nows++;
        if (placeEnd(peek.stop) <= nowMin) say(m, `the peek says NOW for ${actOf(peek.stop)}, over at ${at(placeEnd(peek.stop))}`);
      }
      if (nowMin == null) continue;
      for (const row of rowsOf(pl, r, cx, m).filter((x) => x.live)) {
        const s = route.items.find((i) => i.kind === 'stop' && stopKey(i) === row.stop);
        if (!s) { say(m, `a NOW row for a stop the route does not have (${row.stop})`); continue; }
        const till = tillMin(row.till, nowMin);
        if (placeEnd(s) <= nowMin) say(m, `the NOW row is ${actOf(s)}, over at ${at(placeEnd(s))}`);
        else if (till == null || till <= nowMin || till > placeEnd(s)) say(m, `the NOW row for ${actOf(s)} says "${row.till}"`);
      }
      for (const x of planPicks(route, { ctx: cx, plan: pl, peek, nowMin, limit: Infinity })) {
        if (/@ now/.test(x.line) && placeEnd(x.stop) <= nowMin) say(m, `the Share says "${x.line}", over at ${at(placeEnd(x.stop))}`);
      }
    }
  }
  assert.deepEqual(problems, []);
  assert.ok(nows > 3000, `the sweep read ${nows} NOW peeks`);
});

// The same law, as the route holds it: a stop ends by the time its place
// does — a set's (or a party's) act, a room's close — so no reader of a
// stop's end (DESIGN.md's list) can carry it past. The crew and a few
// highlights (rule 10 routes a group on its own bar, and folds its blips the
// same way).
const HIGHLIGHTS = (m) => [[m[0]], [m[1], m[4], m[6]], m.slice(0, 5)];
const planFor = (r, people) => (people.length ? P.planOf(r.fest, { picks: r.picks, members: r.members, people }) : plans.get(r));
test('1, in the route: no stop outlives what it is for — a set\'s stop ends by its act\'s end, a room\'s by its close', () => {
  const problems = [];
  let stops = 0;
  for (const r of RIGS) {
    for (const people of [[], ...HIGHLIGHTS(r.members)]) {
      const pl = planFor(r, people);
      for (const n of pl.nights) for (const s of pl.night(n.id).items.filter((i) => i.kind === 'stop')) {
        stops++;
        if (s.to > placeEnd(s) && problems.length < 12) problems.push(`${r.fest.id}, ${r.name}${people.length ? ` [${people}]` : ''}, ${n.iso}: ${actOf(s)} ${at(s.from)}–${at(s.to)}, over at ${at(placeEnd(s))}`);
      }
    }
  }
  assert.deepEqual(problems, []);
  assert.ok(stops > 1000, `read ${stops} stops`);
});

// 2. A live or-line is on screen for as long as it plays: while a fork's
// crowd is there, the row it hangs from is not folded into Earlier or
// dimmed past, and once shown it stays shown (as an or-line, or as the NOW
// stop when the route moves to it) until it is over. The cut fix (capping a
// stop at its place's end after the fold) broke exactly this: Zara's stop
// folded away at 8:05 and took the Tiësto or-line, on till 8:15, with it.
test('2. a live or-line is on screen for as long as it plays — every five minutes of every day', () => {
  const problems = [];
  let live = 0;
  for (const r of RIGS) {
    const pl = plans.get(r);
    const cx = { picks: r.picks };
    let was = null; // { night, t, lines: [{ id, name, to }] }: the minute before's live or-lines
    const say = (m, why) => problems.length < 12 && problems.push(`${r.fest.id}, ${r.name}, ${m.iso} ${at(m.t)}: ${why}`);
    for (const m of moments(r, pl)) {
      const { peek, nowMin, route } = m;
      if (nowMin == null) { was = null; continue; }
      const rows = rowsOf(pl, r, cx, m);
      const onScreen = new Set(rows.filter((x) => x.or && !x.past).map((x) => x.stop));
      const lines = [];
      for (const s of route.items.filter((i) => i.kind === 'stop')) {
        const f = orLine(s, pl, peek, nowMin);
        if (!f || !(f.from <= nowMin && nowMin < f.to)) continue;
        live++;
        const name = actOf(f);
        if (!onScreen.has(`or|${stopKey(s)}`)) say(m, `the or-line ${name} (on till ${at(f.to)}) is not on screen — its row, ${actOf(s)} ${at(s.from)}–${at(s.to)}, is ${s.to <= nowMin ? 'over' : 'missing it'}`);
        else lines.push({ id: f.place.id, name, to: f.to });
      }
      if (was && was.night === route.id && was.nowMin === nowMin - P.STEP) {
        for (const l of was.lines) {
          if (l.to <= nowMin) continue; // over: it may go
          const nowStop = peek.tag === 'now' && peek.stop ? peek.stop.place.id : null;
          if (!lines.some((x) => x.id === l.id) && nowStop !== l.id) say(m, `the or-line ${l.name} left the screen while it plays till ${at(l.to)}`);
        }
      }
      was = { night: route.id, nowMin, lines };
    }
  }
  assert.deepEqual(problems, []);
  assert.ok(live > 300, `the sweep read ${live} live or-lines`);
});

// 3, over the seeded crews (the nine and the made-up ACL nine, with
// highlights, are tests/plan-text.test.mjs's sweep): every line the Share
// could send is a row the open plan is showing, and a "now" line is still on.
test('3. the Share names only rows the open plan shows, for the crews that meet a carry — every five minutes of every day', () => {
  const problems = [];
  let lines = 0;
  for (const r of RIGS) {
    const pl = plans.get(r);
    const cx = { picks: r.picks };
    for (const m of moments(r, pl)) {
      const { peek, nowMin, route } = m;
      if (!peek.today) continue;
      const rows = rowsOf(pl, r, cx, m).filter((x) => !x.past && !x.earlier).map((x) => x.text);
      for (const x of planPicks(route, { ctx: cx, plan: pl, peek, nowMin, limit: Infinity })) {
        lines++;
        const title = x.line.split(' @ ')[0];
        const where = title.split(' for ')[0];
        const act = (x.stop.placeKind || x.stop.place.kind) !== 'room' && title.includes(' for ') ? x.acts[0] : null;
        if (!rows.some((t) => t.includes(where) && (!act || t.includes(act))) && problems.length < 12) problems.push(`${r.fest.id}, ${r.name}, ${m.iso} ${at(m.t)}: not in the open plan: ${x.line}`);
        const till = tillMin(x.line, nowMin);
        if (/@ now/.test(x.line) && till != null && till <= nowMin && problems.length < 12) problems.push(`${r.fest.id}, ${r.name}, ${m.iso} ${at(m.t)}: over, and still "now": ${x.line}`);
      }
    }
  }
  assert.deepEqual(problems, []);
  assert.ok(lines > 20000, `the sweep read ${lines} lines`);
});

// 4. No fork shorter than 15 minutes survives, measured on the interval that
// is kept: a fork lives inside its stop (the part of it the stop's row can
// show), and that part is at least MIN_STOP. Under a highlight too (rule 10
// routes a group on its own bar).
test('4. no fork shorter than 15 minutes survives, measured on the interval kept — and every fork is inside its stop', () => {
  const problems = [];
  let forks = 0;
  for (const r of RIGS) {
    for (const people of [[], ...HIGHLIGHTS(r.members)]) {
      const pl = planFor(r, people);
      for (const n of pl.nights) for (const s of pl.night(n.id).items.filter((i) => i.kind === 'stop')) {
        for (const f of s.forks) {
          forks++;
          const kept = Math.min(f.to, s.to) - Math.max(f.from, s.from);
          const say = (why) => problems.length < 12 && problems.push(`${r.fest.id}, ${r.name}${people.length ? ` [${people}]` : ''}, ${n.iso}: ${actOf(f)} ${at(f.from)}–${at(f.to)} under ${actOf(s)} ${at(s.from)}–${at(s.to)} ${why}`);
          if (f.from < s.from || f.to > s.to) say('is not inside its stop');
          if (kept < P.MIN_STOP) say(`keeps ${kept} minutes`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
  assert.ok(forks > 300, `read ${forks} forks`);
});

// 6. The repaint key (the P1–P3 review's sixth finding, 2026-09-27). The
// shelf skips a repaint whose key has not changed (plan-shelf.js signature:
// per night, plan-rows.js rowsKey, with the peek's row), so two minutes with
// the same key must draw the same rows. The drop-in line says "drop in till
// 9:45 PM" once its room is open, and dims once it is over; neither was in
// the key, so a tick that changed only that left the line stale until
// something else repainted. Every run of minutes that share a key is drawn at
// both ends (the clock runs one way, so a state that flips inside the run
// shows at its ends), over the Despacio crew (the nine, plus Despacio picked
// by seven: plan-model.test.mjs's rule 9 crew), whose lines lead three of
// Portola's nights, the other Portola rigs, and the ACL crew. (Not the seeded
// ACL nines: eleven nights a draw, and ACL declares no drop-in — they would
// double the suite's time to say what the ACL crew says.)
test('6. the same repaint key draws the same rows — every run of minutes with one key, drawn at both ends, the drop-in lines included', () => {
  const DESPACIO = rig('the Despacio crew', PORTOLA, { ...NINE.picks, Despacio: { Ana: 1, Ben: 1, Cy: 2, Dot: 1, Fay: 4, Gus: 4, Ivy: 1 } }, NINE.members);
  const problems = [];
  let runs = 0;
  let lines = 0;
  for (const r of [DESPACIO, ...RIGS.filter((x) => x.fest === PORTOLA || x.name === 'the ACL crew')]) {
    const pl = plans.get(r) || P.planOf(r.fest, { picks: r.picks, members: r.members });
    const cx = { picks: r.picks };
    const keyOf = ({ peek, nowMin, route }) => [route.id, peek.tag, peek.stop ? stopKey(peek.stop) : '', peek.count, rowsKey(route, { plan: pl, peek, nowMin })].join('~');
    const draw = ({ peek, nowMin, route }) => [...planDays(pl, { ctx: cx, peek, from: route.id, nowMin }).querySelectorAll('.plan-row')]
      .filter((e) => e.dataset.night === route.id).map((e) => `${[...e.classList].sort().join('.')} ${e.textContent}`);
    let run = null;
    const close = () => {
      if (!run || run.first === run.last) return;
      runs++;
      const a = draw(run.first);
      const b = draw(run.last);
      lines += a.filter((x) => /\bdropin\b/.test(x)).length;
      if (a.join('\n') !== b.join('\n') && problems.length < 8) {
        const diff = b.filter((x) => !a.includes(x));
        problems.push(`${r.fest.id}, ${r.name}, ${run.first.iso} ${at(run.first.t)} → ${at(run.last.t)}, one key: ${a.filter((x) => !b.includes(x)).join(' | ')} → ${diff.join(' | ')}`);
      }
    };
    for (const m of moments(r, pl)) {
      if (m.nowMin == null) continue; // a night that is not tonight is keyed whole: it has no clock to change
      const key = keyOf(m);
      if (run && run.key === key && run.last.route.id === m.route.id) run.last = m;
      else { close(); run = { key, first: m, last: m }; }
    }
    close();
  }
  assert.deepEqual(problems, []);
  assert.ok(runs > 300, `${runs} runs of one key drawn at both ends`);
  assert.ok(lines > 20, `the drop-in lines were among them (${lines})`);
});
