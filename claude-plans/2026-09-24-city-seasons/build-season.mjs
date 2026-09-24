#!/usr/bin/env node
// Turns the study's ground truth into a festival-shaped file, so the design
// canvas can render Austin through the app's own wall code and we can see
// what today's model does with a season before designing anything new.
//
//   node claude-plans/2026-09-24-city-seasons/build-season.mjs
//   -> claude-plans/2026-09-24-city-seasons/data/season-austin.json
//
// This file is canvas material, never a shipped festival: it lives in the
// study folder, not data/festivals/, and nobody picks in it.
//
// Shape (MODEL-V4 §6): one dated section per month ("October", "January"),
// every entry carries `date` + `venue`, so each month is its own tab and each
// date a room. Enrichment from Do512 (doors, buy link) only where Do512 lists
// the same show; nothing is invented.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const GT = join(HERE, 'data/ground-truth')
const OUT = join(HERE, 'data/season-austin.json')
const FROM = '2026-09-24', TO = '2027-05-31'

const VENUE_NAME = {
  'moody-center': 'Moody Center', 'moody-amphitheater': 'Moody Amphitheater', 'acl-live': 'ACL Live',
  '3ten': '3TEN', germania: 'Germania Amphitheater', stubbs: "Stubb's", mohawk: 'Mohawk',
  'scoot-inn': 'Scoot Inn', emos: "Emo's", antones: "Antone's", continental: 'Continental Club',
  concourse: 'Concourse Project', brushy: 'Brushy Street', kingdom: 'Kingdom', vulcan: 'Vulcan Gas Co.',
}
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const NOT_MUSIC = /comedy|funny|stand-?up|trivia|bingo|brunch|screening|podcast|\bmarket\b|yoga|wrestling|lecture|\bfilm\b|an evening of|in conversation/i
const ENT = { amp: '&', nbsp: ' ', quot: '"', '#39': "'" }
const clean = (s) => String(s ?? '').replace(/&(#?\w+);/g, (_m, e) => ENT[e] ?? ' ').replace(/\s+/g, ' ').trim()

// Listing names are messy ("Official 2026 ACL Nights: Montclair", "X @10pm, Y
// @11", "Ian Asher at The Concourse Project", "Album Release Party feat. …").
// This is the cleaning an importer would own; here it is only good enough
// for a canvas, and every original title survives in `billedAs`.
const PREFIX = /^\s*(official\s+\d{4}\s+acl(\s+fest)?\s+nights|[^:]{0,40}\bpresents?)\s*:?\s*/i
function headlinerOf(ev) {
  let first = clean((ev.artists ?? [])[0] ?? ev.title)
  if (PREFIX.test(first) && !first.replace(PREFIX, '').trim()) first = clean(ev.title)
  return first
    .replace(PREFIX, '')
    .replace(/\s+at\s+the\s+concourse\s+project\b.*$/i, '')
    .replace(/\s*@\s*\d.*$/, '')
    .split(/\s*(?::|\s[-–—|]\s|\s\/\s|,|\bw\/|\bwith\b|\bfeat\.?\s|\bft\.?\s|\bfeaturing\b)\s*/i)[0].trim()
}
const key = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function doorsOf(time) {
  const t = clean(time)
  let m = t.match(/T(\d{2}):(\d{2})/) || t.match(/\b(\d{1,2}):(\d{2})\s*([AP]M)?/i) || t.match(/\b(\d{1,2})\s*([AP]M)/i)
  if (!m) return null
  let h = Number(m[1]); const min = m[3] && /^\d+$/.test(m[2]) ? m[2] : (/^\d+$/.test(m[2] ?? '') ? m[2] : '00')
  const ap = (t.match(/[AP]M/i) || [])[0]
  if (!ap && h >= 13) { const h12 = h - 12; return `${h12}${min !== '00' ? ':' + min : ''} PM` }
  if (!ap && h === 12) return `12${min !== '00' ? ':' + min : ''} PM`
  if (!ap) return `${h}${min !== '00' ? ':' + min : ''} PM`
  return `${h}${min !== '00' ? ':' + min : ''} ${ap.toUpperCase()}`
}

const do512 = JSON.parse(readFileSync(join(HERE, 'data/sources/do512.json'), 'utf8')).events
const d512 = new Map()
for (const e of do512) d512.set(`${e.venue === 'parish' ? 'brushy' : e.venue}|${e.date}|${key(headlinerOf(e))}`, e)

const seen = new Set()
const artists = []
for (const f of readdirSync(GT).filter((x) => x.endsWith('.json'))) {
  const slug = f.replace(/\.json$/, '') === 'parish' ? 'brushy' : f.replace(/\.json$/, '')
  if (!VENUE_NAME[slug]) continue
  for (const ev of JSON.parse(readFileSync(join(GT, f), 'utf8')).events ?? []) {
    if (ev.date < FROM || ev.date > TO) continue
    if (NOT_MUSIC.test(clean(ev.title)) || /non-music/i.test(ev.notes ?? '')) continue
    const name = headlinerOf(ev)
    if (!name) continue
    const k = `${slug}|${ev.date}|${key(name)}`
    if (seen.has(k)) continue
    seen.add(k)
    const twin = d512.get(k)
    const month = MONTH[Number(ev.date.slice(5, 7)) - 1]
    const entry = { name, day: month, date: ev.date, venue: VENUE_NAME[slug] }
    const doors = doorsOf(ev.time) ?? (twin ? doorsOf(twin.time) : null)
    if (doors) entry.doors = doors
    if (clean(ev.title) !== name) entry.billedAs = clean(ev.title)
    entry.source = ev.url ?? twin?.url ?? null
    if (twin?.ticketUrl) entry.tickets = twin.ticketUrl
    if (/cancel/i.test(ev.status ?? '')) entry.cancelled = { on: FROM, source: ev.url, note: 'venue calendar marks it cancelled' }
    artists.push(entry)
  }
}
artists.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.venue < b.venue ? -1 : 1))

// A name that plays twice keeps one entry per show here; the app would merge
// them into one pick key, which is exactly the problem THINKING.md §2 names.
const months = [...new Set(artists.map((a) => a.day))]
const dayMeta = Object.fromEntries(months.map((m) => {
  const inM = artists.filter((a) => a.day === m)
  return [m, { date: `${inM.length} shows`, sub: 'Austin' }]
}))

const season = {
  id: 'austin-season-study',
  name: 'Austin',
  year: "'26–27",
  subtitle: 'Winter + Spring',
  location: 'Austin, TX',
  dates: 'Sep 2026 – May 2027',
  accent: '244, 114, 182',
  status: 'scheduled',
  timezone: 'America/Chicago',
  artists,
  meta: { announcementStatus: 'lineup', researchedAt: '2026-09-24', sources: ['claude-plans/2026-09-24-city-seasons/data/ground-truth'], note: 'Study material for the design canvas; not a shipped festival.' },
  dayMeta,
  venues: {},
  days: {},
}
writeFileSync(OUT, JSON.stringify(season, null, 1) + '\n')
const per = Object.fromEntries(months.map((m) => [m, artists.filter((a) => a.day === m).length]))
console.log(`season-austin.json: ${artists.length} shows`, per)
