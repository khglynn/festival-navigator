#!/usr/bin/env node
// Grades each candidate source against the venues' own calendars.
//
//   node claude-plans/2026-09-24-city-seasons/score.mjs [--json] [--unmatched <source>]
//
// Ground truth: data/ground-truth/<venue>.json (what each venue's own site lists).
// Candidates:   data/sources/<source>.json (what each source lists at the same venues).
// Both use the same event shape (see PROGRESS.md, "The sources study").
//
// Matching is deliberately plain so the table can be re-run as an eval later:
// same venue slug, same date, and the headliner of one appears among the other's
// names (after normalising case, accents, punctuation and "the"). A same-venue
// match one day off is reported separately rather than counted, because it is
// either an after-midnight convention or a real error, and we want to see which.

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// SEASONS_DATA points the scorer at another data folder (the self-test uses it).
const DATA = process.env.SEASONS_DATA ?? join(HERE, 'data')
const GT_DIR = join(DATA, 'ground-truth')
const SRC_DIR = join(DATA, 'sources')

const FROM = '2026-09-24'
const NEAR_END = '2026-11-23'
const TO = '2027-05-31'
const ELECTRONIC = new Set(['concourse', 'brushy', 'kingdom', 'summit', 'vulcan'])
const BIG = new Set(['moody-center', 'moody-amphitheater', 'acl-live', 'germania', 'stubbs'])

const args = process.argv.slice(2)
const wantJson = args.includes('--json')
const unmatchedFor = args.includes('--unmatched') ? args[args.indexOf('--unmatched') + 1] : null

function load(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
    const doc = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    return { file: f, name: f.replace(/\.json$/, ''), doc }
  })
}

function norm(s) {
  return String(s ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the /, '')
    .trim()
}

// Every name an event could be known by: its artists, plus its title cut at the
// usual separators ("MUNA: Gets So Hot Tour", "X w/ Y", "X presents Y").
function namesOf(ev) {
  const out = new Set()
  for (const a of ev.artists ?? []) if (norm(a)) out.add(norm(a))
  const t = String(ev.title ?? '')
  if (norm(t)) out.add(norm(t))
  for (const part of t.split(/\s*(?::|\s[-–—|]\s|\bw\/|\bwith\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bpresents?\b|\bplus\b|\+|,|\/)\s*/i)) {
    const n = norm(part)
    if (n.length >= 2) out.add(n)
  }
  return out
}

function headliner(ev) {
  return norm((ev.artists ?? [])[0] ?? String(ev.title ?? '').split(/\s*(?::|\s[-–—|]\s|\bw\/|\bwith\b)\s*/i)[0])
}

function containsWord(hay, needle) {
  if (!needle || needle.length < 2) return false
  return (' ' + hay + ' ').includes(' ' + needle + ' ')
}

// How strongly two events at the same venue and date are the same show.
// 3 = headliners equal, 2 = one side's headliner is among the other's names,
// 1 = any shared name or a word-boundary containment, 0 = none.
function affinity(a, b) {
  const ha = headliner(a), hb = headliner(b)
  if (ha && ha === hb) return 3
  const na = namesOf(a), nb = namesOf(b)
  if ((ha && nb.has(ha)) || (hb && na.has(hb))) return 2
  for (const x of na) if (nb.has(x)) return 1
  for (const x of na) for (const y of nb) if (containsWord(x, y) || containsWord(y, x)) return 1
  return 0
}

function inScope(ev) { return ev.date >= FROM && ev.date <= TO }
function isMusic(ev) { return !/non-music/i.test(ev.notes ?? '') }
function shiftDay(iso, d) {
  const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + d)
  return t.toISOString().slice(0, 10)
}

// Ground truth, with each venue's reach (the last date its calendar was read to).
const gtFiles = load(GT_DIR)
const gt = []
const reach = {}
const gtComplete = {}
for (const { name, doc } of gtFiles) {
  const last = doc.coverage?.lastDateReached ?? TO
  reach[name] = last
  gtComplete[name] = !!doc.coverage?.complete
  for (const ev of doc.events ?? []) if (inScope(ev)) gt.push({ ...ev, venue: ev.venue ?? name })
}
const gtByKey = new Map()
for (const ev of gt) {
  const k = ev.venue + '|' + ev.date
  if (!gtByKey.has(k)) gtByKey.set(k, [])
  gtByKey.get(k).push(ev)
}

function scoreSource({ name, doc }) {
  const evs = (doc.events ?? []).filter(inScope).filter(e => reach[e.venue] !== undefined)
  const used = new Set()
  const matches = [], offByOne = [], unmatched = []
  for (const ev of evs) {
    let best = null
    for (const d of [0, -1, 1]) {
      const cands = gtByKey.get(ev.venue + '|' + shiftDay(ev.date, d)) ?? []
      for (const g of cands) {
        if (used.has(g)) continue
        const s = affinity(g, ev) - (d === 0 ? 0 : 0.5)
        if (s > 0.5 && (!best || s > best.s)) best = { g, s, d }
      }
      if (best && best.d === 0) break
    }
    if (best && best.d === 0) { used.add(best.g); matches.push({ gt: best.g, src: ev, s: best.s }) }
    else if (best) { used.add(best.g); offByOne.push({ gt: best.g, src: ev, d: best.d }) }
    else unmatched.push(ev)
  }
  const matchedGt = new Set(matches.map(m => m.gt))
  const bucket = (pred) => {
    const denom = gt.filter(g => isMusic(g) && pred(g))
    const hit = denom.filter(g => matchedGt.has(g))
    return { hit: hit.length, of: denom.length, recall: denom.length ? hit.length / denom.length : null }
  }
  // A source listing past the date a venue's calendar was read to cannot be
  // judged, so precision only counts what the ground truth could have confirmed.
  const judgeable = evs.filter(e => e.date <= reach[e.venue])
  const judgeableUnmatched = unmatched.filter(e => e.date <= reach[e.venue])
  const withBuy = matches.filter(m => m.src.ticketUrl).length
  const ticketers = {}
  for (const m of matches) { const t = m.src.ticketer ?? 'none'; ticketers[t] = (ticketers[t] ?? 0) + 1 }
  const statusDisagree = matches.filter(m => {
    const a = m.gt.status ?? 'scheduled', b = m.src.status ?? 'scheduled'
    const dead = s => /cancel|postpon|moved/.test(s)
    return dead(a) !== dead(b)
  })
  return {
    source: name,
    listed: evs.length,
    recall: {
      all: bucket(() => true),
      near: bucket(g => g.date <= NEAR_END),
      far: bucket(g => g.date > NEAR_END),
      bigRooms: bucket(g => BIG.has(g.venue)),
      clubs: bucket(g => !BIG.has(g.venue) && !ELECTRONIC.has(g.venue)),
      electronic: bucket(g => ELECTRONIC.has(g.venue)),
    },
    perVenue: Object.fromEntries(Object.keys(reach).map(v => [v, bucket(g => g.venue === v)])),
    precision: {
      judgeable: judgeable.length,
      unconfirmed: judgeableUnmatched.length,
      precision: judgeable.length ? (judgeable.length - judgeableUnmatched.length) / judgeable.length : null,
    },
    offByOne: offByOne.length,
    buyLinkShare: matches.length ? withBuy / matches.length : null,
    ticketers,
    statusDisagree: statusDisagree.map(m => ({ date: m.gt.date, venue: m.gt.venue, gt: m.gt.status, src: m.src.status, name: headliner(m.gt) })),
    _matchedGt: matchedGt,
    _unmatched: judgeableUnmatched,
    _offByOne: offByOne,
  }
}

const sources = load(SRC_DIR).map(scoreSource)

// Best unions of two and three sources — the "small set of robust sources" question.
const music = gt.filter(isMusic)
function unionRecall(names) {
  const hit = new Set()
  for (const s of sources) if (names.includes(s.source)) for (const g of s._matchedGt) hit.add(g)
  return music.length ? hit.size / music.length : 0
}
const names = sources.map(s => s.source)
const combos = []
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    combos.push({ set: [names[i], names[j]], recall: unionRecall([names[i], names[j]]) })
    for (let k = j + 1; k < names.length; k++) combos.push({ set: [names[i], names[j], names[k]], recall: unionRecall([names[i], names[j], names[k]]) })
  }
}
combos.sort((a, b) => b.recall - a.recall)

// Ground-truth shows no source had: the union's blind spot.
const everMatched = new Set(sources.flatMap(s => [...s._matchedGt]))
const orphans = music.filter(g => !everMatched.has(g))

const pct = x => x == null ? '—' : (100 * x).toFixed(0) + '%'
const cell = b => b.of ? `${pct(b.recall)} (${b.hit}/${b.of})` : '—'

if (unmatchedFor) {
  const s = sources.find(x => x.source === unmatchedFor)
  if (!s) { console.error('no source', unmatchedFor); process.exit(1) }
  console.log(JSON.stringify({ unconfirmed: s._unmatched, offByOne: s._offByOne.map(o => ({ gt: o.gt, src: o.src, d: o.d })) }, null, 2))
  process.exit(0)
}

const out = {
  scoredAt: new Date().toISOString(),
  groundTruth: {
    venues: Object.keys(reach).length,
    events: gt.length,
    musicEvents: music.length,
    perVenue: Object.fromEntries(Object.keys(reach).map(v => [v, { events: gt.filter(g => g.venue === v).length, reach: reach[v], complete: gtComplete[v] }])),
  },
  sources: sources.map(({ _matchedGt, _unmatched, _offByOne, ...rest }) => rest),
  bestPairs: combos.filter(c => c.set.length === 2).slice(0, 8),
  bestTriples: combos.filter(c => c.set.length === 3).slice(0, 8),
  orphans: orphans.map(g => ({ date: g.date, venue: g.venue, name: headliner(g), title: g.title })),
}

if (wantJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0) }

writeFileSync(join(DATA, 'scores.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`Ground truth: ${gt.length} events (${music.length} music) at ${Object.keys(reach).length} venues\n`)
console.log('| Source | Listed | Recall all | Near | Far | Big rooms | Clubs | Electronic | Precision | ±1 day | Buy link |')
console.log('|---|---|---|---|---|---|---|---|---|---|---|')
for (const s of [...sources].sort((a, b) => (b.recall.all.recall ?? 0) - (a.recall.all.recall ?? 0))) {
  const r = s.recall
  console.log(`| ${s.source} | ${s.listed} | ${cell(r.all)} | ${cell(r.near)} | ${cell(r.far)} | ${cell(r.bigRooms)} | ${cell(r.clubs)} | ${cell(r.electronic)} | ${pct(s.precision.precision)} (${s.precision.unconfirmed} unconfirmed) | ${s.offByOne} | ${pct(s.buyLinkShare)} |`)
}
console.log('\nBest pairs:', out.bestPairs.slice(0, 4).map(c => `${c.set.join(' + ')} ${pct(c.recall)}`).join(' · '))
console.log('Best triples:', out.bestTriples.slice(0, 4).map(c => `${c.set.join(' + ')} ${pct(c.recall)}`).join(' · '))
console.log(`Shows no source had: ${orphans.length}`)
