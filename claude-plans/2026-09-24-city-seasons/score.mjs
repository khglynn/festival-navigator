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
// --raw grades against the venue calendars as first read, ignoring the
// adjudication (how the 230 disputed listings were found in the first place).
const raw = args.includes('--raw')

function load(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
    const doc = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    return { file: f, name: f.replace(/\.json$/, ''), doc }
  })
}

const ENTITIES = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', '#39': "'", '#x27': "'", rsquo: "'", lsquo: "'" }

function norm(s) {
  return String(s ?? '')
    .replace(/&(#?\w+);/g, (m, e) => ENTITIES[e.toLowerCase()] ?? ' ')
    // Letters NFKD cannot split (Łaszewo, LØLØ), and the possessive
    // ("Michael Martin Murphey's Cowboy Christmas" is Michael Martin Murphey).
    .replace(/[łŁ]/g, 'l').replace(/[øØ]/g, 'o').replace(/[æÆ]/g, 'ae').replace(/ß/g, 'ss')
    .replace(/['’]s\b/gi, '')
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
// Billing prefixes that are not the act ("Official 2026 ACL Nights: Montclair",
// "Corey Knox Presents: Monday Night Funny").
const PREFIX = /^\s*(official\s+\d{4}\s+acl(\s+fest)?\s+nights|[^:]{0,40}\bpresents?)\s*:\s*/i
// Names that belong to a series or a promoter, never to one show: sharing one
// says nothing about two listings being the same show (Codex review,
// 2026-09-24: Stubb's Oct 1 Brandon Flowers and Montclair collapsed on
// "Official 2026 ACL Nights").
const GENERIC = /^(official \d{4} acl( fest)? nights|acl( fest)? nights|official|presents?|live|tour|tickets?|late show|early show|night one|night two|dj set|and more|more|tba)$/

function namesOf(ev) {
  const out = new Set()
  const add = (x) => { const n = norm(x); if (n.length >= 2 && !GENERIC.test(n)) out.add(n) }
  for (const a of ev.artists ?? []) add(String(a).replace(PREFIX, ''))
  const t = String(ev.title ?? '').replace(PREFIX, '')
  add(t)
  for (const part of t.split(/\s*(?::|\s[-–—|]\s|\bw\/|\bwith\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bpresents?\b|\bplus\b|\+|,|\/)\s*/i)) add(part)
  return out
}


function headliner(ev) {
  const first = (ev.artists ?? [])[0] ?? String(ev.title ?? '')
  const bare = String(first).replace(PREFIX, '')
  return norm(bare.split(/\s*(?::|\s[-–—|]\s|\s\/\s|\bw\/|\bwith\b|\bfeat\.?\s|\bft\.?\s)\s*/i)[0])
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
// Two listings with different printed start times are two shows (an early and
// a late show, two rooms), whatever their names share.
function clock(ev) {
  const m = String(ev.time ?? '').match(/T(\d{2}):(\d{2})|\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m/i)
  if (!m) return null
  if (m[1]) return Number(m[1]) * 60 + Number(m[2])
  return ((Number(m[3]) % 12) + (/p/i.test(m[5]) ? 12 : 0)) * 60 + Number(m[4] ?? 0)
}
function timesDiffer(a, b) { const x = clock(a), y = clock(b); return x != null && y != null && Math.abs(x - y) >= 60 }
// Not concerts: the season is music, so these never count for or against a source.
const NOT_MUSIC = /comedy|funny|stand-?up|trivia|bingo|brunch|screening|podcast|\bmarket\b|yoga|wrestling|lecture|\bfilm\b|drag brunch/i
function isMusic(ev) { return !/non-music/i.test(ev.notes ?? '') && !NOT_MUSIC.test(ev.title ?? '') }
function shiftDay(iso, d) {
  const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + d)
  return t.toISOString().slice(0, 10)
}

// Ground truth, with each venue's reach (the last date its calendar was read to).
// Venues that turned out to be one room under two names. The Parish's domain
// is gone and its address now trades as Brushy Street Commons (brushystreet.com);
// both ground-truth readers read that one calendar, so their reads are merged.
const ALIAS = { parish: 'brushy' }
const canon = v => ALIAS[v] ?? v

const gtFiles = load(GT_DIR)
const gt = []
const reach = {}
const gtComplete = {}
for (const { name, doc } of gtFiles) {
  const venue = canon(name)
  const events = (doc.events ?? []).filter(inScope)
  // A calendar nobody could read is not a calendar with no shows: leave the
  // venue out entirely rather than count every source listing there as false.
  if (!events.length && !doc.coverage?.complete) continue
  const last = doc.coverage?.lastDateReached ?? TO
  reach[venue] = reach[venue] && reach[venue] > last ? reach[venue] : last
  gtComplete[venue] = (gtComplete[venue] ?? true) && !!doc.coverage?.complete
  for (const ev of events) {
    const e = { ...ev, venue }
    // Two reads of one calendar (the Parish and Brushy files) spell the same
    // show differently; any shared name at the same venue and date is one show.
    const twins = gt.filter(g => g.venue === venue && g.date === ev.date)
    if (twins.some(g => affinity(g, e) >= 2 && !timesDiffer(g, e))) continue
    gt.push(e)
  }
}
// Adjudication (wave 3): every listing a source had that the first calendar
// read did not was judged by re-reading the venue and checking the ticketer or
// artist. Shows judged real ("gt-miss": the venue lists it and the first read
// missed it; "real-offcalendar": ticketed and real, not on the venue's page)
// join the truth (the rule for which ones is at the push below).
const verdictByListing = new Map()
const adjudicatedAdds = []
if (!raw && existsSync(join(DATA, 'adjudication'))) {
  const clusters = JSON.parse(readFileSync(join(DATA, 'unconfirmed-clusters.json'), 'utf8'))
  const verdicts = new Map()
  for (const { doc } of load(join(DATA, 'adjudication'))) for (const v of doc) if (typeof v.id === 'number') verdicts.set(v.id, v)
  const real = []
  for (const c of clusters) {
    const v = verdicts.get(c.id)
    if (!v) continue
    for (const [src, url] of Object.entries(c.sources)) {
      verdictByListing.set(`${src}|${url}`, v.verdict)
      verdictByListing.set(`${src}|${c.venue}|${c.date}|${c.headliner}`, v.verdict)
    }
    if ((v.verdict === 'gt-miss' || v.verdict === 'real-offcalendar') && inScope(c)) real.push({ c, v })
  }
  real.sort((a, b) => Object.keys(b.c.sources).length - Object.keys(a.c.sources).length)
  for (const { c, v } of real) {
    const venue = canon(c.venue)
    if (reach[venue] === undefined) continue
    // Only on a night the truth has no show at this venue yet. The adjudicators
    // marked support acts "gt-miss" when the venue bills them under the
    // headliner (Barrington Levy under Shyne, August Burns Red under Underoath),
    // so a second show on a night is far likelier a support act than a late
    // show; adding them would blame every headliner-only source for a miss.
    // The cost: a real second show the first read missed is not added.
    if (gt.some(g => g.venue === venue && g.date === c.date)) continue
    const e = { date: c.date, venue, title: c.titles[0] ?? c.headliner, artists: [c.headliner], adjudicated: v.verdict, url: (v.evidence || '').split(/\s/)[0] }
    gt.push(e)
    adjudicatedAdds.push(e)
  }
}

const gtByKey = new Map()
for (const ev of gt) {
  const k = ev.venue + '|' + ev.date
  if (!gtByKey.has(k)) gtByKey.set(k, [])
  gtByKey.get(k).push(ev)
}

function scoreSource({ name, doc }) {
  // Same show listed twice (a source that files one room under two names, or
  // repeats a listing) counts once, so a duplicate neither helps recall nor
  // hurts precision.
  const seen = new Set()
  const evs = (doc.events ?? []).filter(inScope)
    .map(e => ({ ...e, venue: canon(e.venue) }))
    .filter(e => reach[e.venue] !== undefined)
    .filter(e => { const k = e.venue + '|' + e.date + '|' + headliner(e); if (seen.has(k)) return false; seen.add(k); return true })
  // Every candidate pair, strongest first, so the result does not depend on the
  // order a source happened to list things in; a one-day-off pair only counts
  // when neither side found a same-day match.
  const pairs = []
  for (const ev of evs) {
    for (const d of [0, -1, 1]) {
      for (const g of gtByKey.get(ev.venue + '|' + shiftDay(ev.date, d)) ?? []) {
        const a = affinity(g, ev)
        if (a > 0) pairs.push({ g, ev, d, s: a - (d === 0 ? 0 : 1.5) })
      }
    }
  }
  pairs.sort((a, b) => b.s - a.s)
  const usedG = new Set(), usedE = new Set()
  const matches = [], offByOne = []
  for (const p of pairs) {
    if (usedG.has(p.g) || usedE.has(p.ev)) continue
    usedG.add(p.g); usedE.add(p.ev)
    if (p.d === 0) matches.push({ gt: p.g, src: p.ev, s: p.s })
    else offByOne.push({ gt: p.g, src: p.ev, d: p.d })
  }
  const unmatched = evs.filter(e => !usedE.has(e))
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
  // With adjudication: a listing is right if it matches the truth or was judged
  // real; wrong if judged stale, wrong-date, wrong-venue or unconfirmed (and a
  // one-day-off match is a wrong date); noise if a duplicate or not a concert.
  const verdictOf = (e) => verdictByListing.get(`${name}|${e.url}`) ?? verdictByListing.get(`${name}|${e.venue}|${e.date}|${headliner(e)}`) ?? null
  const tally = { right: matches.length, wrong: offByOne.length, noise: 0, unjudged: 0 }
  const wrongKinds = { 'wrong-date (±1 day)': offByOne.length }
  for (const e of judgeableUnmatched) {
    const v = verdictOf(e)
    if (v === 'gt-miss' || v === 'real-offcalendar') tally.right++
    else if (v === 'duplicate' || v === 'not-music') tally.noise++
    else if (v) { tally.wrong++; wrongKinds[v] = (wrongKinds[v] ?? 0) + 1 }
    else tally.unjudged++
  }
  const withBuy = matches.filter(m => m.src.ticketUrl).length
  const ticketers = {}
  for (const m of matches) { const t = m.src.ticketer ?? 'none'; ticketers[t] = (ticketers[t] ?? 0) + 1 }
  const statusDisagree = matches.filter(m => {
    const a = m.gt.status ?? 'scheduled', b = m.src.status ?? 'scheduled'
    const dead = s => /cancel|postpon|moved/.test(s)
    return dead(a) !== dead(b)
  })
  // A match that says "on" when the venue says cancelled (or the reverse) is
  // the right show with the wrong state: a wrong answer for someone deciding
  // whether to go.
  if (!raw && statusDisagree.length) {
    tally.right -= statusDisagree.length; tally.wrong += statusDisagree.length
    wrongKinds['wrong status'] = statusDisagree.length
  }
  return {
    source: name,
    listed: evs.length,
    recall: {
      all: bucket(() => true),
      near: bucket(g => g.date <= NEAR_END),
      far: bucket(g => g.date > NEAR_END),
      spring: bucket(g => g.date >= '2027-01-01'),
      bigRooms: bucket(g => BIG.has(g.venue)),
      clubs: bucket(g => !BIG.has(g.venue) && !ELECTRONIC.has(g.venue)),
      electronic: bucket(g => ELECTRONIC.has(g.venue)),
    },
    perVenue: Object.fromEntries(Object.keys(reach).map(v => [v, bucket(g => g.venue === v)])),
    precision: raw ? {
      judgeable: judgeable.length,
      unconfirmed: judgeableUnmatched.length + offByOne.length,
      precision: judgeable.length ? (judgeable.length - judgeableUnmatched.length - offByOne.length) / judgeable.length : null,
    } : {
      ...tally,
      wrongKinds,
      precision: tally.right + tally.wrong ? tally.right / (tally.right + tally.wrong) : null,
      noiseShare: evs.length ? tally.noise / evs.length : null,
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
function unionRecall(names, pred = () => true) {
  const hit = new Set()
  for (const s of sources) if (names.includes(s.source)) for (const g of s._matchedGt) if (isMusic(g) && pred(g)) hit.add(g)
  const of = music.filter(pred).length
  return of ? hit.size / of : 0
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
for (const c of combos.slice(0, 40)) {
  c.near = unionRecall(c.set, g => g.date <= NEAR_END)
  c.far = unionRecall(c.set, g => g.date > NEAR_END)
}

// Ground-truth shows no source had: the union's blind spot.
const everMatched = new Set(sources.flatMap(s => [...s._matchedGt]))
const orphans = music.filter(g => !everMatched.has(g))

const pct = x => x == null ? '—' : (100 * x).toFixed(0) + '%'
const cell = b => b.of ? `${pct(b.recall)} (${b.hit}/${b.of})` : '—'

if (unmatchedFor) {
  const s = sources.find(x => x.source === unmatchedFor)
  if (!s) { console.error('no source', unmatchedFor); process.exit(1) }
  // Write, then exit once flushed: a bare process.exit() cuts a piped stdout at 64 KB.
  process.stdout.write(JSON.stringify({ unconfirmed: s._unmatched, offByOne: s._offByOne.map(o => ({ gt: o.gt, src: o.src, d: o.d })) }, null, 2) + '\n', () => process.exit(0))
  await new Promise(() => {})
}

const out = {
  scoredAt: new Date().toISOString(),
  adjudicated: raw ? null : { added: adjudicatedAdds.length, shows: adjudicatedAdds.map(e => ({ date: e.date, venue: e.venue, name: e.artists[0], verdict: e.adjudicated })) },
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

if (wantJson) { process.stdout.write(JSON.stringify(out, null, 2) + '\n', () => process.exit(0)); await new Promise(() => {}) }

writeFileSync(join(DATA, raw ? 'scores-raw.json' : 'scores.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`Ground truth: ${gt.length} events (${music.length} music) at ${Object.keys(reach).length} venues\n`)
if (!raw) console.log(`Adjudication added ${adjudicatedAdds.length} shows the first calendar reads missed.\n`)
console.log('| Source | Listed | Recall all | Near | Far | Jan–May | Big rooms | Clubs | Electronic | Precision | Wrong | Noise | Buy link |')
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const s of [...sources].sort((a, b) => (b.recall.all.recall ?? 0) - (a.recall.all.recall ?? 0))) {
  const r = s.recall, p = s.precision
  const wrong = raw ? `${p.unconfirmed} unconfirmed` : `${p.wrong}${p.unjudged ? ` (+${p.unjudged} unjudged)` : ''}`
  const noise = raw ? '—' : `${p.noise}`
  console.log(`| ${s.source} | ${s.listed} | ${cell(r.all)} | ${cell(r.near)} | ${cell(r.far)} | ${cell(r.spring)} | ${cell(r.bigRooms)} | ${cell(r.clubs)} | ${cell(r.electronic)} | ${pct(p.precision)} | ${wrong} | ${noise} | ${pct(s.buyLinkShare)} |`)
}
const combo = c => `${c.set.join(' + ')} ${pct(c.recall)} (near ${pct(c.near)}, far ${pct(c.far)})`
console.log('\nBest pairs:', out.bestPairs.slice(0, 4).map(combo).join(' · '))
console.log('Best triples:', out.bestTriples.slice(0, 4).map(combo).join(' · '))
console.log(`Shows no source had: ${orphans.length}`)
