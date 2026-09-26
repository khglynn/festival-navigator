#!/usr/bin/env node
// The Austin season feed (v0, 2026-09-25): reads Do512, JamBase and
// Ticketmaster, merges them, and writes one festival file per season
// (data/festivals/austin-<fall|winter|spring|summer>-<year>.json), their
// index rows and their frozen names (claude-plans/2026-09-25-season-v0/PLAN.md,
// UX.md "Seasons"). Run by hand for now:
//
//   set -a; source ~/.env; set +a        # JAMBASE_API_KEY, TICKETMASTER_API_KEY
//   node scripts/season-feed.mjs [--dry] [--fresh] [--no-jambase] [--no-ticketmaster]
//
// A run is a release: it rewrites index.json, which is part of the cached app
// shell, so follow it with `node scripts/sw-stamp.mjs`, the tests and a PR,
// and never on a festival weekend (a new build puts the reload strip in front
// of everyone at the festival).
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
import { freezeFestival } from '../api/_lib/pick-keys.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// SEASON_OUT_DIR / SEASON_REGISTRY point a trial run somewhere other than the
// repo; a trial run leaves the index and the freeze alone.
const FEST_DIR = join(ROOT, 'data/festivals');
const OUT_DIR = process.env.SEASON_OUT_DIR || FEST_DIR;
const TRIAL = OUT_DIR !== FEST_DIR;
const REGISTRY = process.env.SEASON_REGISTRY || join(ROOT, 'data/seasons/austin-artists.json');
const FREEZE = join(ROOT, 'tests/fixtures/live-pick-keys.json');
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
  // Letters of every script count (a Japanese or Cyrillic name keeps its own
  // key); a name with no letters at all ("!!!") keys as itself. An empty key
  // would match every other empty key and merge unrelated acts for good.
  const raw = ascii(clean(s)).toLowerCase();
  const key = raw.replace(/[łŁ]/g, 'l').replace(/[øØ]/g, 'o').replace(/'s\b/g, '')
    .replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/^the /, '').trim();
  return key || raw.replace(/\s+/g, ' ').trim();
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
  // No clock is no clock, never midnight: JamBase dates its festivals
  // "2026-11-13" alone, and reading that as 00:00 moved them a day early.
  if (!/^\d{2}:\d{2}$/.test(String(hhmm ?? ''))) return dateIso;
  const h = Number(String(hhmm).slice(0, 2));
  if (h >= 5) return dateIso;
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
          // A festival listing is the festival, with its lineup as the bill:
          // naming it after its first act would make Freaky Deaky "AHEE".
          const fest = /festival/i.test(e.category_param || '') && artists.length > 2;
          shows.push({
            source: 'do512', id: String(e.id), date: nightOf(date, hhmm), time: clockOf(hhmm), venue: name,
            title: clean(e.title), headliner: fest ? clean(e.title) : artists[0] || headlinerFromTitle(e.title), with: fest ? artists : artists.slice(1),
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
      const fest = e['@type'] === 'Festival';
      const offers = (e.offers || []).filter((o) => o && o.url && !/stubhub|vividseats|tickpick|gametime|viagogo|seatgeek/i.test(destinationOf(o.url)));
      shows.push({
        source: 'jambase', id: String(e.identifier || e['@id'] || ''), date: nightOf(date, hhmm), time: clockOf(hhmm),
        venue: venueName(e.location?.name), address: clean(e.location?.address?.streetAddress) || null, title: clean(e.name), headliner: fest ? clean(e.name) : performers[0] || headlinerFromTitle(e.name), with: fest ? performers : performers.slice(1),
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
  if (x === y) return true;
  // One name plus words, only when the shorter is a full name in itself:
  // "Gable Price" / "Gable Price And Friends" yes, "Band" / "Band of Horses" no.
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (long.startsWith(`${short} `)) return short.includes(' ') || short.length >= 8;
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
  const ka = keyOf(a.headliner), kb = keyOf(b.headliner);
  const ta = minutes(a.time), tb = minutes(b.time);
  if (!sameSource && ka === kb) return true;
  // A near spelling is the same act only within doors-to-start of each other.
  if (!sameSource && nearName(ka, kb) && !(ta != null && tb != null && Math.abs(ta - tb) >= 90)) return true;
  // One source listing a show twice (JamBase: "Alaska Thunderfuck" and
  // "Alaska Thunderf**k", both 8 PM): one act cannot open two shows at once.
  if (ta != null && ta === tb && nearName(keyOf(a.headliner), keyOf(b.headliner))) return true;
  if (ta != null && tb != null && Math.abs(ta - tb) >= 60) return false;
  const na = new Set([a.headliner, ...a.with].map(keyOf).filter(Boolean));
  const nb = [b.headliner, ...b.with].map(keyOf).filter(Boolean);
  // A headliner named inside the other listing's title, never a key so short it names nothing.
  return nb.some((n) => na.has(n)) || (kb.length >= 3 && keyOf(a.title).includes(kb)) || (ka.length >= 3 && keyOf(b.title).includes(ka));
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
  // The same pass learns how the app already spells every artist it knows.
  // A name that matches another festival's pick key takes that spelling, so
  // "BOB MOSES" (Ticketmaster) reads "Bob Moses" as it does at Portola, and
  // YOURS and the alert meet the same name everywhere.
  for (const f of index) {
    if (f.kind === 'season') continue;
    const file = join(ROOT, 'data/festivals', `${f.id}.json`);
    if (!existsSync(file)) continue;
    for (const a of JSON.parse(readFileSync(file, 'utf8')).artists || []) if (a.name && !knownSpelling.has(keyOf(a.name))) knownSpelling.set(keyOf(a.name), a.name);
  }
  for (const f of index) {
    if (f.id === 'austin' || f.kind === 'season' || f.status === 'archived' || !/austin/i.test(f.location || '')) continue;
    const file = join(ROOT, 'data/festivals', `${f.id}.json`);
    if (!existsSync(file)) continue;
    for (const a of JSON.parse(readFileSync(file, 'utf8')).artists || []) if (a.date && a.name) keys.add(`${a.date}|${keyOf(a.name)}`);
  }
  return keys;
}
// The app's own Austin festivals by name ("Seismic Dance Event 9.0" ->
// "seismic dance event"): a listing of the festival itself belongs there.
function festNameKeys() {
  const index = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
  return index.filter((f) => f.kind !== 'season' && f.status !== 'archived' && /austin/i.test(f.location || ''))
    .map((f) => keyOf(f.name).replace(/(\s\d+)+$/, '').trim()).filter((k) => k.length >= 6);
}
const knownSpelling = new Map();
const shouting = (n) => /[A-Z]{3}/.test(n) && n === n.toUpperCase();
// Which spelling a new name takes: the app's own (another festival's), then
// Ticketmaster's unless it is shouting and another source is not, then the
// source that listed it.
function spellingOf(s) {
  for (const n of [s.tmName, s.headliner]) if (n && knownSpelling.has(keyOf(n))) return knownSpelling.get(keyOf(n));
  if (s.tmName && !(shouting(s.tmName) && s.headliner && !shouting(s.headliner) && keyOf(s.headliner) === keyOf(s.tmName))) return s.tmName;
  return s.headliner;
}
// A pick key the crew document accepts is at most 100 characters.
export const clampName = (n) => (n.length <= 100 ? n : n.slice(0, 100).replace(/\s+\S*$/, '').trim());

// ---- the seasons -----------------------------------------------------------------
// A city is a run of seasons, each its own entry like a festival (Kevin,
// 2026-09-25: "they should just be different entries and then they get
// archived after they're over, just like festivals"): Austin Fall '26, Austin
// Winter '27, … Winter is December to February and wears the year of its
// January. Each season file's id, its artist names and its month labels are
// pick keys, so none of them ever changes once written.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CITY = { id: 'austin', name: 'Austin', location: 'Austin, TX' };
const SEASONS = {
  winter: { name: 'Winter', first: 12, accent: '125, 196, 255' },
  spring: { name: 'Spring', first: 3, accent: '244, 114, 182' },
  summer: { name: 'Summer', first: 6, accent: '250, 204, 90' },
  fall: { name: 'Fall', first: 9, accent: '240, 146, 76' },
};
export const monthOf = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1];
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // m is 1-based
export function seasonOf(iso) {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7));
  const key = m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'fall';
  const s = SEASONS[key];
  const startY = key === 'winter' && m <= 2 ? y - 1 : y;
  const endY = key === 'winter' ? startY + 1 : startY;
  const endM = (s.first + 1) % 12 + 1;
  const named = key === 'winter' ? endY : startY; // Winter '27 runs Dec 2026 – Feb 2027
  const mon = (mm) => MONTHS[mm - 1].slice(0, 3);
  return {
    id: `${CITY.id}-${key}-${named}`, key, name: `${CITY.name} ${s.name}`, year: `'${String(named).slice(2)}`,
    startsOn: `${startY}-${String(s.first).padStart(2, '0')}-01`, endsOn: lastDay(endY, endM), accent: s.accent,
    dates: startY === endY ? `${mon(s.first)} – ${mon(endM)} ${startY}` : `${mon(s.first)} ${startY} – ${mon(endM)} ${endY}`,
  };
}

async function main() {
  const problems = [];
  const today = todayIso();
  const fresh = args.has('--fresh');
  const index = JSON.parse(readFileSync(join(FEST_DIR, 'index.json'), 'utf8'));
  const isCitySeason = (row) => row.kind === 'season' && row.id.startsWith(`${CITY.id}-`);
  const fixture = JSON.parse(readFileSync(FREEZE, 'utf8'));
  // --fresh drops every name a season file holds, so it is refused once any
  // season is frozen: taking a season out of the freeze by hand is the
  // decision to orphan its picks, and this script never makes it.
  const frozenSeasons = Object.keys(fixture.festivals || {}).filter((id) => id.startsWith(`${CITY.id}-`));
  if (fresh && frozenSeasons.length && !TRIAL) {
    console.error(`--fresh refused: ${frozenSeasons.join(', ')} ${frozenSeasons.length === 1 ? 'is' : 'are'} frozen (crews pick in them). Run without --fresh.`);
    process.exit(2);
  }
  // A source with no key is a source silently missing, which would mark its
  // shows unlisted and drop every on-sale time: name it or skip it on purpose.
  for (const [flag, envKey] of [['--no-jambase', 'JAMBASE_API_KEY'], ['--no-ticketmaster', 'TICKETMASTER_API_KEY']]) {
    if (!args.has(flag) && !process.env[envKey]) { console.error(`${envKey} is not set: load ~/.env, or pass ${flag} to run without it`); process.exit(2); }
  }
  // --fresh ignores the files on disk: only while no season has reached
  // production, since every name it drops must also leave the freeze. After
  // that, never: names are pick keys.
  const prevById = new Map();
  if (!fresh) {
    for (const row of index.filter(isCitySeason)) {
      const file = join(OUT_DIR, `${row.id}.json`);
      if (existsSync(file)) prevById.set(row.id, JSON.parse(readFileSync(file, 'utf8')));
    }
  }
  const prevShows = [...prevById.values()].flatMap((f) => f.artists || []);
  const registry = !fresh && existsSync(REGISTRY) ? JSON.parse(readFileSync(REGISTRY, 'utf8')) : { note: '', names: {} };
  // alias key -> canonical name, one registry for the city, so an artist is
  // spelled the same in every season.
  const aliasToName = new Map();
  for (const [name, aliases] of Object.entries(registry.names)) for (const a of [name, ...aliases]) aliasToName.set(keyOf(a), name);
  for (const a of prevShows) if (!aliasToName.has(keyOf(a.name))) aliasToName.set(keyOf(a.name), a.name);

  const do512 = await readDo512(problems);
  const jb = args.has('--no-jambase') ? { shows: [], calls: 0 } : await readJamBase(process.env.JAMBASE_API_KEY, problems);
  const tm = args.has('--no-ticketmaster') ? [] : await readTicketmaster(process.env.TICKETMASTER_API_KEY, problems);
  const raw = [...do512, ...jb.shows, ...tm].filter((s) => s.date >= today && s.venue && s.headliner
    && !FESTIVAL_GROUNDS.test(s.venue) && !NOT_MUSIC.test(`${s.title} ${s.headliner}`));
  const elsewhere = otherFestShows();
  const festNames = festNameKeys();
  const inOtherFest = (s) => [s.headliner, s.tmName].some((n) => n && elsewhere.has(`${s.date}|${keyOf(n)}`))
    || festNames.some((k) => keyOf(s.title).includes(k) || keyOf(s.headliner).includes(k));
  for (const s of raw) s.headliner = tidyHeadliner(s.headliner, s.venue);
  const allMerged = mergeShows(raw);
  // JamBase alone putting an artist in one room while Do512 or Ticketmaster
  // puts them in another that night is a show that moved (Jane Remover, Sep
  // 29: Emo's on JamBase, Stubb's everywhere else). The better sources win.
  const trusted = new Set(allMerged.filter((s) => s.sources.do512 || s.sources.ticketmaster).map((s) => `${s.date}|${keyOf(s.headliner)}`));
  const moved = (s) => Object.keys(s.sources).join() === 'jambase' && trusted.has(`${s.date}|${keyOf(s.headliner)}`);
  const merged = allMerged.filter((s) => !inOtherFest(s) && !moved(s));

  const before = new Map(prevShows.map((a) => [`${a.name}|${a.date}|${a.venue}`, a]));
  const entries = [];
  for (const s of merged) {
    const spelled = clampName(spellingOf(s));
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
    if (s.cancelled) e.cancelled = before.get(`${name}|${s.date}|${s.venue}`)?.cancelled || { on: today, source: s.page?.url || s.tickets?.url || 'https://do512.com/', note: 'A source lists it as cancelled.' };
    e.sources = s.sources;
    entries.push(e);
  }
  // Keep every name a file already had: past shows as they were, and a
  // future show no source lists any more marked unlisted (never dropped).
  const seen = new Set(entries.map((e) => `${e.name}|${e.date}|${e.venue}`));
  let kept = 0, unlisted = 0;
  for (const a of prevShows) {
    if (seen.has(`${a.name}|${a.date}|${a.venue}`)) continue;
    const e = { ...a };
    // Sources drop a show once it starts, so tonight's show going quiet
    // means nothing; only a show still ahead has been taken down.
    if (a.date > today && !a.unlisted) { e.unlisted = today; unlisted++; }
    if (a.date === today && a.unlisted === today) delete e.unlisted;
    entries.push(e); kept++;
  }
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (minutes(a.time) ?? 1440) - (minutes(b.time) ?? 1440) || a.venue.localeCompare(b.venue)));

  const counts = { do512: do512.length, jambase: jb.shows.length, ticketmaster: tm.length, jambaseCalls: jb.calls, merged: merged.length, inAnotherFest: allMerged.filter(inOtherFest).length, movedPerJamBaseOnly: allMerged.filter((s) => !inOtherFest(s) && moved(s)).length, keptFromBefore: kept, newlyUnlisted: unlisted };
  const addressOf = {};
  for (const s of merged) if (s.address && !addressOf[s.venue]) addressOf[s.venue] = s.address;

  // One file per season that has a show; a season already in the index keeps
  // its file even when this run found nothing for it.
  const bySeason = new Map();
  for (const e of entries) {
    const season = seasonOf(e.date);
    if (!bySeason.has(season.id)) bySeason.set(season.id, { season, shows: [] });
    bySeason.get(season.id).shows.push(e);
  }
  for (const id of prevById.keys()) if (!bySeason.has(id)) bySeason.set(id, { season: seasonOf(prevById.get(id).startsOn), shows: prevById.get(id).artists || [] });
  const generatedAt = new Date().toISOString();
  const files = [...bySeason.values()].sort((a, b) => a.season.startsOn.localeCompare(b.season.startsOn)).map(({ season, shows }) => {
    const prev = prevById.get(season.id);
    const months = [...new Set(shows.map((e) => e.day))];
    const venuesSeen = [...new Set(shows.map((e) => e.venue))];
    return {
      id: season.id, kind: 'season', name: season.name, year: season.year, location: CITY.location,
      dates: season.dates, startsOn: season.startsOn, endsOn: season.endsOn, updated: today,
      status: today > season.endsOn ? 'archived' : 'scheduled', timezone: TZ, accent: prev?.accent || season.accent,
      artists: shows,
      dayMeta: Object.fromEntries(months.map((m) => { const any = shows.find((e) => e.day === m); return [m, { date: `${m.slice(0, 3)} ${any.date.slice(0, 4)}` }]; })),
      venues: Object.fromEntries(venuesSeen.map((v) => [v, VENUE_MAPS[v] || prev?.venues?.[v] || mapSearch(v, addressOf[v], CITY.location)])),
      meta: {
        announcementStatus: 'scheduled', researchedAt: today,
        sources: ['https://do512.com/', 'https://data.jambase.com/', 'https://developer.ticketmaster.com/'],
        feed: { generatedAt, counts, problems },
        note: 'Generated by scripts/season-feed.mjs; do not hand-edit shows (a re-run keeps names, never overwrites a past show). Plan: claude-plans/2026-09-25-season-v0/PLAN.md.',
      },
      days: {},
    };
  });

  // Expected ranges (the data rule: decide what is plausible before trusting a run).
  const future = entries.filter((e) => e.date >= today && !e.unlisted);
  const next90 = future.filter((e) => e.date <= new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10));
  const range = [];
  if (future.length < 200 || future.length > 6000) range.push(`${future.length} upcoming shows is outside 200–6000`);
  if (next90.length < 100) range.push(`only ${next90.length} shows in the next 90 days`);
  if (!do512.length) range.push('Do512 returned nothing');
  if (!args.has('--no-jambase') && !jb.shows.length) range.push('JamBase returned nothing');
  if (!args.has('--no-ticketmaster') && !tm.length) range.push('Ticketmaster returned nothing');
  if (unlisted > 150) range.push(`${unlisted} shows vanished from every source at once — a source is probably broken`);
  const errors = [], warnings = [];
  for (const f of files) {
    const r = validateFestivalDoc(f, { filename: `${f.id}.json` });
    errors.push(...r.errors.map((x) => `${f.id}: ${x}`)); warnings.push(...r.warnings);
  }
  const report = { counts, upcoming: future.length, next90: next90.length, seasons: Object.fromEntries(files.map((f) => [f.id, f.artists.length])), problems, range, errors: errors.slice(0, 10), warnings: warnings.length };
  console.log(JSON.stringify(report, null, 1));
  // Names only grow: a season whose frozen names this run no longer has
  // stops the run before anything is written.
  const nextFreeze = new Map(files.map((f) => [f.id, freezeFestival(f, today)]));
  for (const [id, next] of TRIAL ? [] : nextFreeze) {
    const old = fixture.festivals[id];
    const gone = old ? old.names.filter((n) => !next.names.includes(n)) : [];
    if (gone.length) errors.push(`${id}: frozen names missing from this run: ${gone.slice(0, 5).join(', ')}`);
  }
  if (errors.length || range.length) { console.error('not written: fix the errors or range problems above'); process.exit(1); }
  if (DRY) { console.log('dry run: nothing written'); return; }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of files) writeFileSync(join(OUT_DIR, `${f.id}.json`), JSON.stringify(f, null, 2) + '\n');
  if (!TRIAL) {
    // The index lists each season like a festival: its window, its status
    // (archived once over, as festivals are) and the day the feed last ran.
    const rows = files.map((f) => ({
      id: f.id, kind: 'season', name: f.name, year: f.year, startsOn: f.startsOn, endsOn: f.endsOn,
      status: f.status, dates: f.dates, updated: f.updated, location: f.location, timezone: f.timezone, accent: f.accent,
    }));
    const at = index.findIndex(isCitySeason);
    const rest = index.filter((r) => !isCitySeason(r));
    const insertAt = at >= 0 ? at : Math.max(0, rest.findIndex((r) => r.status === 'archived'));
    rest.splice(insertAt, 0, ...rows);
    writeFileSync(join(FEST_DIR, 'index.json'), JSON.stringify(rest, null, 2) + '\n');
    // A season is in the freeze from its first run: every name only ever
    // grows (the freeze refuses a drop), and CI wants every listed season frozen.
    for (const f of files) {
      const next = nextFreeze.get(f.id);
      const old = fixture.festivals[f.id];
      fixture.festivals[f.id] = old ? { ...next, frozenAt: old.frozenAt } : next;
    }
    writeFileSync(FREEZE, JSON.stringify(fixture, null, 2) + '\n');
  }
  mkdirSync(dirname(REGISTRY), { recursive: true });
  registry.note = 'Canonical Austin season names (the pick keys) and every other spelling a source has used for them. A new spelling maps to the name already here; a name is never renamed. Written by scripts/season-feed.mjs.';
  registry.names = Object.fromEntries(Object.entries(registry.names).sort(([a], [b]) => a.localeCompare(b)));
  for (const e of entries) registry.names[e.name] ||= [];
  writeFileSync(REGISTRY, JSON.stringify(registry, null, 1) + '\n');
  console.log(`wrote ${files.map((f) => `${f.id} (${f.artists.length})`).join(', ')} and ${REGISTRY}`);
  if (!TRIAL) console.log('next: node scripts/sw-stamp.mjs && npm test, then a PR (index.json is in the cached app shell); never on a festival weekend');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
