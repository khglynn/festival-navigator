// P4's measuring rig (2026-09-26 night): how often a stop runs past its own
// act, so that the peek says NOW for a set that is over. `node stop-ends.mjs`
// from this folder. It reads the plan model as it stands and changes nothing.
//
// It prints two things:
//   1. the made-up nine (tests/fixtures/plan-crew-nine.json) at Portola, and
//      the Share sweep's made-up ACL nine: every stop carried past its act,
//      and every five-minute moment the peek says NOW for an act that ended;
//   2. 240 seeded made-up crews (5, 9 and 15 people, 40 seeds each, at Portola
//      and ACL): how many stops are carried, for how many minutes, how many
//      crews meet it at least once, and how many forks outlive their stop.
// All crews are invented picks on the real lineups. Never real crew data.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// plan.js reaches wall.js, which reads a document and storage at import.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const P = await import(join(ROOT, 'js/v3/plan.js'));
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const NINE = read('tests/fixtures/plan-crew-nine.json');
const FESTS = { portola: { fest: read('data/festivals/portola-2026.json'), offset: '-07:00' }, acl: { fest: read('data/festivals/acl-2026.json'), offset: '-05:00' } };
const q = P.quietClock;

// A stop is carried when its place's act (a room: the room itself) ends
// before the stop does. tillOf is what the NOW row says.
const carriedOf = (s) => {
  const till = P.tillOf(s);
  return s.place.kind !== 'room' && till != null && s.to > till ? till : null;
};

// The same seeded crew as tests/plan-text.test.mjs's ACL sweep.
function seeded(fest, members, seed, every) {
  const picks = {};
  let h = seed;
  for (const a of fest.artists) for (const m of members) {
    h = (h * 1103515245 + 12345) % 2147483648;
    if (h % every === 0) (picks[a.name] ||= {})[m] = 1 + ((h >> 8) % 4);
  }
  return picks;
}

console.log('1. The made-up nine');
for (const [name, { fest, offset }] of Object.entries(FESTS)) {
  const picks = name === 'portola' ? NINE.picks : seeded(fest, NINE.members, 7, 5);
  const pl = P.planOf(fest, { picks, members: NINE.members });
  const carried = [];
  const nowOver = [];
  for (const n of pl.nights) {
    const stops = pl.night(n.id).items.filter((i) => i.kind === 'stop');
    if (!stops.length || !n.iso) continue;
    for (const s of stops) {
      const till = carriedOf(s);
      if (till != null) carried.push(`${n.iso} ${s.acts[0].name} ends ${q(till)}, its stop runs to ${q(s.to)}`);
    }
    const midnight = new Date(`${n.iso}T00:00:00${offset}`).getTime();
    for (let t = Math.min(...stops.map((s) => s.from)) - 30; t <= Math.max(...stops.map((s) => s.to)); t += P.STEP) {
      const date = new Date(midnight + t * 60000);
      const peek = P.peekOf(pl, fest, date);
      if (!peek || !peek.today || peek.tag !== 'now' || peek.stop.place.kind === 'room') continue;
      const now = P.planAt(pl, fest, date);
      const till = P.tillOf(peek.stop);
      if (till != null && now && till <= now.minutes) nowOver.push(`${n.iso} ${q(now.minutes)} NOW ${peek.stop.acts[0].name} (ended ${q(till)})`);
    }
  }
  console.log(`  ${name}: ${carried.length} stops carried past their act, ${nowOver.length} moments of NOW for an act that is over`);
  for (const x of [...carried, ...nowOver]) console.log(`    ${x}`);
}

console.log('\n2. 240 seeded made-up crews');
const table = {};
for (const [name, { fest }] of Object.entries(FESTS)) for (const size of [5, 9, 15]) {
  const row = (table[`${name} x${size}`] = { crews: 0, stops: 0, carried: 0, minutes: 0, crewsHit: 0, forksOutlive: 0 });
  const members = Array.from({ length: size }, (_, i) => `m${i}`);
  for (let seed = 1; seed <= 40; seed++) {
    const pl = P.planOf(fest, { picks: seeded(fest, members, seed * 7919, 6), members });
    row.crews++;
    let hit = false;
    for (const n of pl.nights) for (const s of pl.night(n.id).items.filter((i) => i.kind === 'stop')) {
      row.stops++;
      const till = carriedOf(s);
      if (till != null) { row.carried++; row.minutes += s.to - till; hit = true; }
      row.forksOutlive += s.forks.filter((f) => f.to > s.to).length;
    }
    if (hit) row.crewsHit++;
  }
}
console.table(table);
