// Per-festival link previews.
//
// A fest-scoped crew link looks like
// `https://fest.kevinhg.com/f/portola-2026#g=<token>&f=portola-2026`. The
// festival rides in the PATH (and again in the hash) because a link-preview
// crawler and a Vercel rewrite can both read a path and neither can read a
// fragment — and because a human scanning a chat message reads the festival
// name before the token noise starts. vercel.json rewrites `/f/:id` here,
// handing the segment over as `?f=<id>`.
//
// It is /f/<id> and NOT `/` with a query, and that is not a style choice. Vercel
// gives the filesystem precedence over rewrites — "The `source` property
// should NOT be a file because precedence is given to the filesystem prior to
// rewrites being applied" (vercel.json reference). A first cut rewrote `/`
// when a query `f` was present; on a live preview the CDN served index.html
// straight from cache (`x-vercel-cache: HIT`, default OG block) and this
// function was never invoked. Nothing sits at /f. Dropping the `has` matcher
// was a bonus: `has` also does not work under `vercel dev`.
//
// Every request that is not under /f goes to the static index.html and its
// default tags; this code never runs for them.
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
// Must stay in step with js/crew.js crewLink and the vercel.json rewrite;
// tests/brand-assets.test.mjs asserts all three agree and that no static file
// shadows this path.
const SHARE_PATH = '/f';
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
  const url = fest ? `${ORIGIN}${SHARE_PATH}/${fest.id}` : `${ORIGIN}/`;
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
  // /f exists to say something about ONE festival. With no festival to name —
  // an unknown id, junk, a bare /f — there is nothing to say, so send the
  // person to the app. A browser carries the fragment across a redirect whose
  // target has none, so the `#g=` crew token and the `&f=` hint both survive
  // and the app opens exactly where the link meant to put them; a crawler
  // follows the redirect and reads the static default tags at `/`.
  // The rewrite hands the path segment over as `?f=:id`. Vercel ALSO appends
  // any path param the destination does not consume, so `id` is read as a
  // fallback — belt and braces on the one thing that cannot be tested outside
  // a real deploy, and harmless either way since both go through the same
  // exact-id match below.
  const q = req.query || {};
  const fest = festivalFor(q.f !== undefined ? q.f : q.id, festivals());
  const html = fest ? shell() : null;
  const page = html && inject(html, fest);
  if (!page) {
    // Also the safety net for a shell that cannot be read or has lost its
    // markers: a broken invite link is far worse than a generic preview.
    res.setHeader('Location', '/');
    res.status(302).end();
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // The tags only change when a festival is added or renamed, i.e. on a deploy.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
  res.status(200).send(req.method === 'HEAD' ? '' : page);
}
