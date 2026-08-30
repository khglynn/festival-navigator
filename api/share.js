// Per-festival link previews.
//
// A crew link carries its festival in the QUERY as well as the hash
// (js/crew.js crewLink) — `https://fest.kevinhg.com/?f=portola-2026#g=<token>…`
// — because a link-preview crawler and a Vercel rewrite can both read a query
// and neither can read a fragment. vercel.json rewrites `/` to this function
// only when a query `f` is present, so every other request goes straight to
// the static index.html and this code never runs.
//
// What it does: serve index.html with the <!-- OG:BEGIN --> … <!-- OG:END -->
// block swapped for that festival's tags. Nothing renders at request time —
// og:image points at a PNG/JPEG `npm run brand` produced ahead of time.
//
// What it trusts: nothing from the request. `?f=` selects a festival by exact
// id match against data/festivals/index.json and is NEVER echoed into the
// response, so an unknown id, junk, or an injection attempt all get the
// default tags. Every value that does reach the HTML is escaped anyway, and
// og:url is built from a hardcoded origin rather than the Host header — a
// spoofed Host must not be able to publish a link under our name.
//
// How it fails: safely. If the shell cannot be read (a bundling surprise, a
// path that moved), it redirects to `/` rather than 500ing — this rewrite sits
// on a URL REAL PEOPLE open, not just crawlers, and a broken invite link is a
// far worse outcome than a generic preview. The fragment survives a redirect,
// so the app still reads `&f=` from the hash and lands on the right festival.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ORIGIN = 'https://fest.kevinhg.com';
// Same shape js/crew.js and the festival validator enforce.
const FEST_ID_RE = /^[a-z0-9-]{1,64}$/;
const PROMISE = 'Pick artists with your people. Works with no signal.';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function monthOf(startsOn) {
  const [y, m] = String(startsOn || '').split('-');
  return MONTHS[Number(m) - 1] ? `${MONTHS[Number(m) - 1]} ${y}` : '';
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Read once per warm lambda. `null` means "tried and failed" — the caller
// degrades instead of retrying a read that will not start working.
let shellCache;
let indexCache;

function loadOnce(rel) {
  // process.cwd() is the project root for a Vercel Node function; the
  // import.meta fallback covers a local run from anywhere else.
  const candidates = [
    join(process.cwd(), rel),
    new URL(`../${rel}`, import.meta.url).pathname,
  ];
  for (const path of candidates) {
    try { return readFileSync(path, 'utf8'); } catch { /* try the next */ }
  }
  return null;
}

function shell() {
  if (shellCache === undefined) shellCache = loadOnce('index.html');
  return shellCache;
}

function festivals() {
  if (indexCache === undefined) {
    const raw = loadOnce('data/festivals/index.json');
    try { indexCache = raw ? JSON.parse(raw) : null; } catch { indexCache = null; }
  }
  return indexCache;
}

// The one festival this request names, or null. Exported for the test suite:
// the "trust nothing" rule is worth asserting rather than hoping for.
export function festivalFor(query, list) {
  const raw = Array.isArray(query) ? query[0] : query;
  if (typeof raw !== 'string' || !FEST_ID_RE.test(raw)) return null;
  return (list || []).find((f) => f.id === raw) || null;
}

export function tagsFor(fest) {
  const title = fest ? `${fest.name} ${fest.year || ''}`.trim() : 'Festival Navigator';
  const image = `${ORIGIN}/assets/og/${fest ? fest.id : 'default'}.jpg`;
  const url = fest ? `${ORIGIN}/?f=${fest.id}` : `${ORIGIN}/`;
  // Where and when, then the promise. The short date is derived from the
  // validated `startsOn`, NOT from `dates` — that field is prose written for
  // someone reading the board (one festival's runs to two clauses about a
  // pre-party) and a preview bubble truncates around 100 characters.
  // Deliberately duplicated from scripts/brand-assets.mjs rather than shared:
  // this function stays dependency-free and importable by nothing.
  const where = fest ? [fest.location, monthOf(fest.startsOn)].filter(Boolean).join(' · ') : '';
  const description = fest && where ? `${where}. ${PROMISE}` : PROMISE;
  const alt = fest ? `${title} on Festival Navigator` : 'Festival Navigator — pick artists with your people.';
  return [
    `<meta name="description" content="${esc(description)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Festival Navigator">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    '<meta property="og:image:type" content="image/jpeg">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${esc(alt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ].map((line) => `    ${line}`).join('\n');
}

const BLOCK_RE = /<!-- OG:BEGIN[\s\S]*?<!-- OG:END -->/;

// Exported so a test can prove the markers still exist in index.html: if they
// are ever edited away, every per-festival link silently falls back to the
// default card and nobody notices until a screenshot arrives.
export function inject(html, fest) {
  if (!BLOCK_RE.test(html)) return null;
  return html.replace(BLOCK_RE, `<!-- OG:BEGIN (per-festival) -->\n${tagsFor(fest)}\n    <!-- OG:END -->`);
}

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).end();
    return;
  }
  const html = shell();
  const page = html && inject(html, festivalFor(req.query && req.query.f, festivals()));
  if (!page) {
    // No shell, or the markers are gone: hand the person the real app.
    res.setHeader('Location', '/');
    res.status(302).end();
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // The tags only change when a festival is added or renamed, i.e. on a deploy.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
  res.status(200).send(req.method === 'HEAD' ? '' : page);
}
