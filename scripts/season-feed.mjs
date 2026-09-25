#!/usr/bin/env node
// The Austin season feed (v0, 2026-09-25): reads Do512, JamBase and
// Ticketmaster, merges them into one festival-shaped file the app renders as
// a season (claude-plans/2026-09-25-season-v0/PLAN.md), and writes
// data/festivals/austin.json. Run by hand for now:
//
//   set -a; source ~/.env; set +a        # JAMBASE_API_KEY, TICKETMASTER_API_KEY
//   node scripts/season-feed.mjs [--dry] [--fresh] [--no-jambase] [--no-ticketmaster]
//
// Why these three (the sources study, claude-plans/2026-09-24-city-seasons/STUDY.md):
// Do512 had 84% of the shows at our venues and was wrong twice, and its buy
// links pay Do512; JamBase fills the months Do512 is thin on; Ticketmaster's
// API carries on-sale and presale times, which an alert needs.
//
// The laws it keeps:
// - Names are pick keys and never disappear. A show no source lists any more
//   stays in the file with `unlisted` set; a past show stays as it was. A new
//   spelling of a known artist maps to the name already in the file
//   (data/seasons/austin-artists.json holds every alias seen).
// - Nothing is guessed. A field no source printed stays absent.
// - It validates before it writes: a run that would break the validator, or
//   that lands outside the expected ranges, writes nothing and says why.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFestivalDoc } from '../api/_lib/festival-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// SEASON_OUT / SEASON_REGISTRY point a trial run somewhere other than the repo.
const OUT = process.env.SEASON_OUT || join(ROOT, 'data/festivals/austin.json');
const REGISTRY = process.env.SEASON_REGISTRY || join(ROOT, 'data/seasons/austin-artists.json');
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36';
const AUSTIN = { lat: 30.2672, lon: -97.7431, miles: 15 };
const TZ = 'America/Chicago';
const JAMBASE_MAX_CALLS = 40; // the free tier is 1,000 a month
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- locations -------------------------------------------------------------------
// The rooms the study graded, by Do512 slug, and the name the app shows. Any
// other Austin room a source lists keeps its own name (tidied).
const COVERED = [
  ['moody-center', 'Moody Center'], ['moody-amphitheater-at-waterloo-park', 'Moody Amphitheater'],
  ['acl-live-at-the-moody-theater', 'ACL Live'], ['3ten', '3TEN'], ['germania-insurance-amphitheater', 'Germania Amphitheater'],
  ['stubb-s', "Stubb's"], ['mohawk-austin', 'Mohawk'], ['historic-scoot-inn', 'Scoot Inn'], ['emo-s', "Emo's"],
  ['antone-s', "Antone's"], ['the-continental-club', 'Continental Club'], ['the-concourse-project', 'Concourse Project'],
  ['brushy-street-commons', 'Brushy Street'], ['kingdom-austin', 'Kingdom'], ['vulcan-gas-company', 'Vulcan Gas Co.'],
];
// How the sources spell those rooms (checked 2026-09-24/25).
const VENUE_ALIASES = [
  [/^(acl live|austin city limits live)\b/, 'ACL Live'], [/^3ten\b/, '3TEN'],
  [/^moody amphitheater/, 'Moody Amphitheater'], [/^moody center/, 'Moody Center'],
  [/^germania|^circuit of the americas amphitheater/, 'Germania Amphitheater'], [/^stubb/, "Stubb's"],
  [/^mohawk/, 'Mohawk'], [/^(historic )?scoot inn/, 'Scoot Inn'], [/^emo'?s/, "Emo's"], [/^antone/, "Antone's"],
  [/^(the )?continental club/, 'Continental Club'], [/^(the )?concourse project/, 'Concourse Project'],
  [/^brushy street|^the parish/, 'Brushy Street'], [/^kingdom/, 'Kingdom'], [/^vulcan gas/, 'Vulcan Gas Co.'],
  [/^radio[\s/-]*east/, 'Radio/East'], [/^circuit of the americas/, 'Germania Amphitheater'],
];
// Where each graded room is (checked by hand for the seed, 2026-09-25). Any
// other room gets a map search from the street address a source printed, or
// from its name when none did.
const VENUE_MAPS = {
  '3TEN': 'https://maps.google.com/?q=3TEN+ACL+Live,+310+Willie+Nelson+Blvd,+Austin',
  'ACL Live': 'https://maps.google.com/?q=ACL+Live+at+the+Moody+Theater,+310+W+Willie+Nelson+Blvd,+Austin',
  "Antone's": "https://maps.google.com/?q=Antone's+Nightclub,+305+E+5th+St,+Austin",
  'Brushy Street': 'https://maps.google.com/?q=Brushy+Street+Commons,+Austin',
  'Concourse Project': 'https://maps.google.com/?q=The+Concourse+Project,+8509+Burleson+Rd,+Austin',
  'Continental Club': 'https://maps.google.com/?q=The+Continental+Club,+1315+S+Congress+Ave,+Austin',
  "Emo's": "https://maps.google.com/?q=Emo's+Austin,+2015+E+Riverside+Dr,+Austin",
  'Germania Amphitheater': 'https://maps.google.com/?q=Germania+Insurance+Amphitheater,+9201+Circuit+of+the+Americas+Blvd,+Austin',
  Kingdom: 'https://maps.google.com/?q=Kingdom+Nightclub,+Austin',
  Mohawk: 'https://maps.google.com/?q=Mohawk+Austin,+912+Red+River+St,+Austin',
  'Moody Amphitheater': 'https://maps.google.com/?q=Moody+Amphitheater+at+Waterloo+Park,+Austin',
  'Moody Center': 'https://maps.google.com/?q=Moody+Center,+2001+Robert+Dedman+Dr,+Austin',
  'Scoot Inn': 'https://maps.google.com/?q=Historic+Scoot+Inn,+1308+E+4th+St,+Austin',
  "Stubb's": "https://maps.google.com/?q=Stubb's+Waller+Creek+Amphitheater,+801+Red+River+St,+Austin",
  'Vulcan Gas Co.': 'https://maps.google.com/?q=Vulcan+Gas+Company,+418+E+6th+St,+Austin',
};
const mapSearch = (...parts) => `https://maps.google.com/?q=${encodeURIComponent(parts.filter(Boolean).join(', ')).replace(/%20/g, '+')}`;
// Festival grounds: those shows belong to the festival's own file (ACL at Zilker).
const FESTIVAL_GROUNDS = /^(zilker park|auditorium shores)$/i;
const ascii = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'");
export function venueName(raw) {
  const s = ascii(raw).toLowerCase().trim().replace(/^the\s+/, '');
  for (const [re, name] of VENUE_ALIASES) if (re.test(s)) return name;
  const tidy = String(raw ?? '').replace(/\s+/g, ' ').replace(/^The /, '').trim();
  // "13th floor" -> "13th Floor": a source that lowercases a name loses to one that doesn't.
  return (tidy === tidy.toLowerCase() ? tidy.replace(/\b([a-z])/g, (c) => c.toUpperCase()) : tidy) || null;
}

// ---- names -----------------------------------------------------------------------
const ENT = { amp: '&', nbsp: ' ', quot: '"', '#39': "'", apos: "'" };
const clean = (s) => String(s ?? '').replace(/&(#?\w+);/g, (_m, e) => ENT[e] ?? ' ').replace(/\s+/g, ' ').trim();
export function keyOf(s) {
  return ascii(clean(s)).toLowerCase().replace(/[łŁ]/g, 'l').replace(/[øØ]/g, 'o').replace(/'s\b/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/^the /, '').trim();
}
const PREFIX = /^\s*(official\s+\d{4}\s+acl(\s+fest)?\s+nights|[^:]{0,40}\bpresents?)\s*:\s*/i;
export function headlinerFromTitle(title) {
  return clean(title).replace(PREFIX, '')
    .replace(/\s*@\s*\d.*$/, '')
    .split(/\s*(?::|\s[-–—|]\s|\s\/\s|,|\bw\/|\bwith\b|\bfeat\.?\s|\bft\.?\s|\bfeaturing\b)\s*/i)[0].trim();
}
// What a listing adds to an artist's name that is not the artist: "ZHU (Night
// 1) at The Concourse Project" is ZHU, and night 2 must share night 1's pick.
export function tidyHeadliner(name, venue) {
  let n = clean(name).replace(/\s*\((night|show|early|late|matinee|evening|\d{1,2}(:\d\d)?\s*(am|pm))\b[^)]*\)/gi, '')
    .replace(/\s*[-–—]\s*(night|show)\s*\d+$/i, '').trim();
  const at = n.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (at && venue && (keyOf(at[2]).includes(keyOf(venue)) || keyOf(venue).includes(keyOf(at[2])))) n = at[1].trim();
  return n;
}
const NOT_MUSIC = /comedy|comedian|stand-?up|trivia|bingo|brunch|screening|podcast|\bmarket\b|yoga|wrestling|lecture|\bfilm\b|karaoke|open mic|drag (show|brunch)|burlesque|magic show|venue (history )?tour|guided .*tour \(|grand prix|formula 1/i;

// ---- time ------------------------------------------------------------------------
function clockOf(hhmm) {
  const m = String(hhmm ?? '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]), min = m[2];
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${min === '00' ? '' : `:${min}`} ${h >= 12 ? 'PM' : 'AM'}`;
}
// An after-midnight start belongs to the night before (a 1 AM set is Friday's).
export function nightOf(dateIso, hhmm) {
  const h = Number(String(hhmm ?? '').slice(0, 2));
  if (!Number.isFinite(h) || h >= 5) return dateIso;
  const d = new Date(`${dateIso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// ---- sellers and sites -----------------------------------------------------------
const SELLERS = [[/ticketmaster|livenation/, 'Ticketmaster'], [/axs\.com/, 'AXS'], [/etix/, 'Etix'], [/eventim/, 'Eventim'],
  [/seetickets/, 'See Tickets'], [/eventbrite/, 'Eventbrite'], [/prekindle/, 'Prekindle'], [/tixr/, 'Tixr'], [/dice\.fm/, 'DICE'],
  [/ticketweb/, 'TicketWeb'], [/universe\.com/, 'Universe'], [/ticketsauce/, 'Ticketsauce'], [/seatgeek/, 'SeatGeek'], [/frontgate/, 'Front Gate']];
function destinationOf(url) {
  try {
    const u = new URL(url);
    const p = u.searchParams.get('u') || u.searchParams.get('url');
    if (p) return p;
    const m = url.match(/destination:(https?%3A[^\s]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch { /* not a URL */ }
  return url;
}
export function ticketsOf(url) {
  if (typeof url !== 'string') return null;
  const https = url.replace(/^http:\/\//, 'https://');
  if (!/^https:\/\/\S+$/.test(https)) return null;
  let host = '';
  try { host = new URL(destinationOf(https)).hostname.toLowerCase(); } catch { return null; }
  const hit = SELLERS.find(([re]) => re.test(host));
  return hit ? { url: https, at: hit[1] } : null;
}

// ---- fetch -----------------------------------------------------------------------
async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } });
  if (!res.ok) throw new Error(`${res.status} ${url.replace(/apikey=[^&]+/, 'apikey=…')}`);
  return res.json();
}

async function readDo512(problems) {
  const shows = [];
  for (const [slug, name] of COVERED) {
    for (let page = 1; page <= 8; page++) {
      let d;
      try { d = await getJson(`https://do512.com/venues/${slug}.json?page=${page}`); } catch (e) { problems.push(`do512 ${slug}: ${e.message}`); break; }
      for (const g of d.event_groups || []) {
        for (const e of g.events || []) {
          if (e.category_param && !/music|concert|dj|dance|festival/i.test(e.category_param)) continue;
          const begin = String(e.begin_time || '');
          const date = begin.slice(0, 10), hhmm = begin.slice(11, 16);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
          const artists = (e.artists || []).map((a) => clean(a.title)).filter(Boolean);
          shows.push({
            source: 'do512', id: String(e.id), date: nightOf(date, hhmm), time: clockOf(hhmm), venue: name,
            title: clean(e.title), headliner: artists[0] || headlinerFromTitle(e.title), with: artists.slice(1),
            doors: typeof e.doors === 'string' && /\d/.test(e.doors) ? e.doors : null,
            page: e.permalink ? { url: `https://do512.com${e.permalink}`, at: 'Do512' } : null,
            tickets: ticketsOf(e.buy_url), onSale: e.ticket_onsale_time || null,
            cancelled: /cancel/i.test(e.title || ''), soldOut: e.sold_out === true,
          });
        }
      }
      const paging = d.paging || {};
      if (!paging.total_pages || page >= paging.total_pages) break;
      await sleep(500);
    }
  }
  return shows;
}

async function readJamBase(key, problems) {
  const shows = [];
  let calls = 0, next = `https://api.data.jambase.com/v3/events?geoLatitude=${AUSTIN.lat}&geoLongitude=${AUSTIN.lon}&geoRadiusAmount=${AUSTIN.miles}&geoRadiusUnits=mi&perPage=100`;
  while (next && calls < JAMBASE_MAX_CALLS) {
    let d;
    try { d = await getJson(next, { Authorization: `Bearer ${key}` }); calls++; } catch (e) { problems.push(`jambase: ${e.message}`); break; }
    for (const e of d.events || []) {
      const start = String(e.startDate || '');
      const date = start.slice(0, 10), hhmm = start.slice(11, 16);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const performers = (e.performer || []).map((p) => clean(p.name)).filter(Boolean);
      const offers = (e.offers || []).filter((o) => o && o.url && !/stubhub|vividseats|tickpick|gametime|viagogo|seatgeek/i.test(destinationOf(o.url)));
      shows.push({
        source: 'jambase', id: String(e.identifier || e['@id'] || ''), date: nightOf(date, hhmm), time: clockOf(hhmm),
        venue: venueName(e.location?.name), address: clean(e.location?.address?.streetAddress) || null, title: clean(e.name), headliner: performers[0] || headlinerFromTitle(e.name), with: performers.slice(1),
        doors: e.doorTime ? clockOf(String(e.doorTime).slice(11, 16)) : null,
        page: e.url && /^https:\/\//.test(e.url) ? { url: e.url, at: 'JamBase' } : null,
        tickets: offers.length ? ticketsOf(offers[0].url) : null, onSale: null,
        cancelled: /cancel|postpon/i.test(e.eventStatus || ''), soldOut: false,
      });
    }
    next = d.pagination?.nextPage || null;
    if (next) await sleep(400);
  }
  if (next) problems.push(`jambase: stopped at the ${JAMBASE_MAX_CALLS}-call cap with pages left`);
  return { shows, calls };
}

async function readTicketmaster(key, problems) {
  const shows = [];
  for (let page = 0; page < 5; page++) {
    let d;
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}&latlong=${AUSTIN.lat},${AUSTIN.lon}&radius=${AUSTIN.miles}&unit=miles&classificationName=music&size=200&page=${page}&sort=date,asc`;
    try { d = await getJson(url); } catch (e) { problems.push(`ticketmaster: ${e.message}`); break; }
    for (const e of d._embedded?.events || []) {
      const date = e.dates?.start?.localDate, hhmm = e.dates?.start?.localTime || '';
      if (!date) continue;
      const attractions = (e._embedded?.attractions || []).map((a) => clean(a.name)).filter(Boolean);
      const pub = e.sales?.public?.startDateTime;
      const presales = (e.sales?.presales || []).filter((p) => p.startDateTime).map((p) => ({ name: clean(p.name), start: p.startDateTime }));
      shows.push({
        source: 'ticketmaster', id: e.id, date: nightOf(date, hhmm), time: clockOf(hhmm),
        venue: venueName(e._embedded?.venues?.[0]?.name), address: clean(e._embedded?.venues?.[0]?.address?.line1) || null, title: clean(e.name), headliner: attractions[0] || headlinerFromTitle(e.name),
        with: attractions.slice(1), doors: null, page: null,
        tickets: e.url ? { url: e.url.replace(/^http:/, 'https:'), at: 'Ticketmaster' } : null,
        // Ticketmaster writes 1900-01-01 for "not known"; a date that can't be true is no date.
        onSale: pub && !pub.startsWith('1900') ? pub : null, presales,
        cancelled: e.dates?.status?.code === 'cancelled', soldOut: false,
      });
    }
    const pg = d.page || {};
    if (pg.number == null || pg.number + 1 >= pg.totalPages) break;
    await sleep(300);
  }
  return shows;
}

// ---- merge -----------------------------------------------------------------------
// One show = one location, one night, one headliner (by name, or by a shared
// name on the bill). A second start time an hour or more apart is a second show.
const minutes = (t) => { const m = String(t || '').match(/^(\d{1,2})(?::(\d{2}))? (AM|PM)$/); if (!m) return null; return ((Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2] || 0); };
// Two sources' spellings of one headliner: equal, one the other plus words
// ("Gable Price" / "Gable Price And Friends"), or a typo apart ("Joy
// Oladukun" / "Joy Oladokun"). Only ever asked about one room on one night.
export function nearName(x, y) {
  if (!x || !y) return false;
  if (x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `)) return true;
  if (Math.min(x.length, y.length) < 8 || Math.abs(x.length - y.length) > 2) return false;
  let row = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const next = [i];
    for (let j = 1; j <= y.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    row = next;
  }
  return row[y.length] <= 2;
}
export function sameShow(a, b) {
  if (a.date !== b.date || keyOf(a.venue) !== keyOf(b.venue)) return false;
  // The same headliner in one room on one night is one show, whatever the
  // clocks say: Do512 prints the doors (7 PM) where Ticketmaster prints the
  // start (8 PM). Only one source listing it twice means two shows (an early
  // and a late), and then the times decide.
  const sameSource = a.source === b.source || (a.sources && a.sources[b.source]);
  if (!sameSource && nearName(keyOf(a.headliner), keyOf(b.headliner))) return true;
  const ta = minutes(a.time), tb = minutes(b.time);
  // One source listing a show twice (JamBase: "Alaska Thunderfuck" and
  // "Alaska Thunderf**k", both 8 PM): one act cannot open two shows at once.
  if (ta != null && ta === tb && nearName(keyOf(a.headliner), keyOf(b.headliner))) return true;
  if (ta != null && tb != null && Math.abs(ta - tb) >= 60) return false;
  const na = new Set([a.headliner, ...a.with].map(keyOf).filter(Boolean));
  const nb = [b.headliner, ...b.with].map(keyOf).filter(Boolean);
  return nb.some((n) => na.has(n)) || keyOf(a.title).includes(keyOf(b.headliner)) || keyOf(b.title).includes(keyOf(a.headliner));
}
// Which source wins each field (the study): Do512's page and links (they pay
// Do512); Ticketmaster's artist name and on-sale times; JamBase fills gaps.
const RANK = { do512: 0, ticketmaster: 1, jambase: 2 };
export function mergeShows(all) {
  const shows = [];
  for (const s of all.sort((a, b) => RANK[a.source] - RANK[b.source])) {
    // Of the shows this could be, the one whose start is nearest: an early and
    // a late show listed by two sources pair early-with-early.
    const gap = (x) => { const a = minutes(x.time), b = minutes(s.time); return a == null || b == null ? 720 : Math.abs(a - b); };
    const hit = shows.filter((x) => sameShow(x, s)).sort((x, y) => gap(x) - gap(y))[0];
    if (!hit) { shows.push({ ...s, sources: { [s.source]: s.id } }); continue; }
    hit.sources[s.source] = s.id;
    if (s.source === 'ticketmaster' && s.headliner) hit.tmName = s.headliner;
    for (const f of ['time', 'doors', 'page', 'tickets', 'onSale', 'address']) if (!hit[f] && s[f]) hit[f] = s[f];
    if (s.presales?.length) hit.presales = s.presales;
    if (!hit.with.length && s.with.length) hit.with = s.with;
    hit.cancelled = hit.cancelled || s.cancelled;
  }
  return shows;
}

// One show lives in one place. A show another Austin festival's file already
// carries (ACL's Late nights, Sep 29 - Oct 11) stays there: doubling it here
// would give one night two pick keys, and the crew would split across them.
function otherFestShows() {
  const index = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
  const keys = new Set();
  for (const f of index) {
    if (f.id === 'austin' || f.kind === 'season' || f.status === 'archived' || !/austin/i.test(f.location || '')) continue;
    const file = join(ROOT, 'data/festivals', `${f.id}.json`);
    if (!existsSync(file)) continue;
    for (const a of JSON.parse(readFileSync(file, 'utf8')).artists || []) if (a.date && a.name) keys.add(`${a.date}|${keyOf(a.name)}`);
  }
  return keys;
}
// A pick key the crew document accepts is at most 100 characters.
export const clampName = (n) => (n.length <= 100 ? n : n.slice(0, 100).replace(/\s+\S*$/, '').trim());

// ---- the file --------------------------------------------------------------------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function monthOf(iso) { return MONTHS[Number(iso.slice(5, 7)) - 1]; }

async function main() {
  const problems = [];
  const today = todayIso();
  // --fresh ignores the file on disk: only for a season nobody has picked in yet
  // (the 2026-09-25 seed), since every name it drops must also leave the freeze.
  const prev = !args.has('--fresh') && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  const registry = existsSync(REGISTRY) ? JSON.parse(readFileSync(REGISTRY, 'utf8')) : { note: '', names: {} };
  // alias key -> canonical name, seeded from every name already in the file.
  const aliasToName = new Map();
  for (const [name, aliases] of Object.entries(registry.names)) for (const a of [name, ...aliases]) aliasToName.set(keyOf(a), name);
  for (const a of prev?.artists || []) if (!aliasToName.has(keyOf(a.name))) aliasToName.set(keyOf(a.name), a.name);

  const do512 = await readDo512(problems);
  const jb = args.has('--no-jambase') || !process.env.JAMBASE_API_KEY ? { shows: [], calls: 0 } : await readJamBase(process.env.JAMBASE_API_KEY, problems);
  const tm = args.has('--no-ticketmaster') || !process.env.TICKETMASTER_API_KEY ? [] : await readTicketmaster(process.env.TICKETMASTER_API_KEY, problems);
  const raw = [...do512, ...jb.shows, ...tm].filter((s) => s.date >= today && s.venue && s.headliner
    && !FESTIVAL_GROUNDS.test(s.venue) && !NOT_MUSIC.test(`${s.title} ${s.headliner}`));
  const elsewhere = otherFestShows();
  const inOtherFest = (s) => [s.headliner, s.tmName].some((n) => n && elsewhere.has(`${s.date}|${keyOf(n)}`));
  for (const s of raw) s.headliner = tidyHeadliner(s.headliner, s.venue);
  const allMerged = mergeShows(raw);
  // JamBase alone putting an artist in one room while Do512 or Ticketmaster
  // puts them in another that night is a show that moved (Jane Remover, Sep
  // 29: Emo's on JamBase, Stubb's everywhere else). The better sources win.
  const trusted = new Set(allMerged.filter((s) => s.sources.do512 || s.sources.ticketmaster).map((s) => `${s.date}|${keyOf(s.headliner)}`));
  const moved = (s) => Object.keys(s.sources).join() === 'jambase' && trusted.has(`${s.date}|${keyOf(s.headliner)}`);
  const merged = allMerged.filter((s) => !inOtherFest(s) && !moved(s));

  const entries = [];
  for (const s of merged) {
    const spelled = clampName(s.tmName || s.headliner);
    let name = aliasToName.get(keyOf(spelled)) || aliasToName.get(keyOf(s.headliner));
    if (!name) { name = spelled; aliasToName.set(keyOf(spelled), name); }
    const aliases = (registry.names[name] ||= []);
    for (const a of [s.headliner, s.tmName]) if (a && a !== name && !aliases.includes(a)) aliases.push(a);
    const e = { name, day: monthOf(s.date), date: s.date, venue: s.venue };
    if (s.time) e.time = s.time;
    if (s.doors) e.doors = s.doors;
    if (s.with.length) e.with = [...new Set(s.with.filter((w) => keyOf(w) !== keyOf(name)))].slice(0, 8);
    if (s.title && keyOf(s.title) !== keyOf(name)) e.billedAs = s.title.slice(0, 160);
    if (s.page) e.page = s.page;
    if (s.tickets && !s.cancelled) e.tickets = s.tickets;
    if (s.onSale) e.onSale = s.onSale;
    if (s.presales?.length) e.presales = s.presales.slice(0, 4);
    if (s.soldOut) e.soldOut = true;
    if (s.cancelled) e.cancelled = { on: today, source: s.page?.url || s.tickets?.url || 'https://do512.com/', note: 'A source lists it as cancelled.' };
    e.sources = s.sources;
    entries.push(e);
  }
  // Keep every name the file already had: past shows as they were, and a
  // future show no source lists any more marked unlisted (never dropped).
  const seen = new Set(entries.map((e) => `${e.name}|${e.date}|${e.venue}`));
  let kept = 0, unlisted = 0;
  for (const a of prev?.artists || []) {
    if (seen.has(`${a.name}|${a.date}|${a.venue}`)) continue;
    const e = { ...a };
    if (a.date >= today && !a.unlisted) { e.unlisted = today; unlisted++; }
    entries.push(e); kept++;
  }
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (minutes(a.time) ?? 1440) - (minutes(b.time) ?? 1440) || a.venue.localeCompare(b.venue)));

  const months = [...new Set(entries.map((e) => e.day))];
  const venuesSeen = [...new Set(entries.map((e) => e.venue))];
  const counts = { do512: do512.length, jambase: jb.shows.length, ticketmaster: tm.length, jambaseCalls: jb.calls, merged: merged.length, inAnotherFest: allMerged.filter(inOtherFest).length, movedPerJamBaseOnly: allMerged.filter((s) => !inOtherFest(s) && moved(s)).length, keptFromBefore: kept, newlyUnlisted: unlisted };
  const addressOf = {};
  for (const s of merged) if (s.address && !addressOf[s.venue]) addressOf[s.venue] = s.address;
  const fest = {
    id: 'austin', kind: 'season', name: 'Austin', year: "'26–27", subtitle: 'Winter + Spring', location: 'Austin, TX',
    dates: `${entries[0]?.date ? MONTHS[Number(entries[0].date.slice(5, 7)) - 1].slice(0, 3) : ''} ${entries[0]?.date?.slice(0, 4) || ''} – ${entries.at(-1)?.date ? MONTHS[Number(entries.at(-1).date.slice(5, 7)) - 1].slice(0, 3) : ''} ${entries.at(-1)?.date?.slice(0, 4) || ''}`.trim(),
    status: 'scheduled', timezone: TZ, accent: prev?.accent || '244, 114, 182',
    artists: entries,
    dayMeta: Object.fromEntries(months.map((m) => { const any = entries.find((e) => e.day === m); return [m, { date: `${m.slice(0, 3)} ${any.date.slice(0, 4)}` }]; })),
    venues: Object.fromEntries(venuesSeen.map((v) => [v, VENUE_MAPS[v] || prev?.venues?.[v] || mapSearch(v, addressOf[v], 'Austin, TX')])),
    meta: {
      announcementStatus: 'scheduled', researchedAt: today,
      sources: ['https://do512.com/', 'https://data.jambase.com/', 'https://developer.ticketmaster.com/'],
      feed: { generatedAt: new Date().toISOString(), counts, problems },
      note: 'Generated by scripts/season-feed.mjs; do not hand-edit shows (a re-run keeps names, never overwrites a past show). Plan: claude-plans/2026-09-25-season-v0/PLAN.md.',
    },
    days: {},
  };

  // Expected ranges (the data rule: decide what is plausible before trusting a run).
  const future = entries.filter((e) => e.date >= today && !e.unlisted);
  const next90 = future.filter((e) => e.date <= new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10));
  const range = [];
  if (future.length < 200 || future.length > 6000) range.push(`${future.length} upcoming shows is outside 200–6000`);
  if (next90.length < 100) range.push(`only ${next90.length} shows in the next 90 days`);
  if (!do512.length) range.push('Do512 returned nothing');
  if (unlisted > 150) range.push(`${unlisted} shows vanished from every source at once — a source is probably broken`);
  const { errors, warnings } = validateFestivalDoc(fest, { filename: 'austin.json' });
  const report = { counts, upcoming: future.length, next90: next90.length, months, problems, range, errors: errors.slice(0, 10), warnings: warnings.length };
  console.log(JSON.stringify(report, null, 1));
  if (errors.length || range.length) { console.error('not written: fix the errors or range problems above'); process.exit(1); }
  if (DRY) { console.log('dry run: nothing written'); return; }
  writeFileSync(OUT, JSON.stringify(fest, null, 2) + '\n');
  mkdirSync(dirname(REGISTRY), { recursive: true });
  registry.note = 'Canonical Austin season names (the pick keys) and every other spelling a source has used for them. A new spelling maps to the name already here; a name is never renamed. Written by scripts/season-feed.mjs.';
  registry.names = Object.fromEntries(Object.entries(registry.names).sort(([a], [b]) => a.localeCompare(b)));
  for (const e of entries) registry.names[e.name] ||= [];
  writeFileSync(REGISTRY, JSON.stringify(registry, null, 1) + '\n');
  console.log(`wrote ${OUT} (${entries.length} shows) and ${REGISTRY}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
