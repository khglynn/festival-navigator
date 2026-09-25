// Build the city-seasons canvas: ONE self-contained HTML file.
//   ESBUILD=~/DevKev/personal/ynai/node_modules/esbuild node build.mjs  -> canvas.html beside this script
// Forked from claude-plans/2026-09-23-rating-canvas/build.mjs. The production
// modules are bundled read-only from the repo; the repo is never written.
// See NOTES.md for what differs.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const HERE = new URL('.', import.meta.url).pathname;
const STUDY = new URL('../', import.meta.url).pathname;     // claude-plans/2026-09-24-city-seasons/
const REPO = new URL('../../../', import.meta.url).pathname; // the repo root, three levels up
const require = createRequire(import.meta.url);
// esbuild is not a dependency of this repo; point ESBUILD at any install of it.
const esbuild = require(process.env.ESBUILD || 'esbuild');
const read = (p) => readFileSync(p, 'utf8');

// ---- 0. the season, enriched from the venues' own calendars ------------------------
// season-austin.json carries a buy link only where Do512 listed the show (and
// often an affiliate hop). The ground truth the file was built from is each
// venue's own calendar, which names the ticketer and links the venue's own
// buy page. Prefer that; fall back to Do512's. Every one of the 425 shows
// matches its ground-truth event by venue + date + billed title (checked).
const VENUE_NAME = {
  'moody-center': 'Moody Center', 'moody-amphitheater': 'Moody Amphitheater', 'acl-live': 'ACL Live',
  '3ten': '3TEN', germania: 'Germania Amphitheater', stubbs: "Stubb's", mohawk: 'Mohawk',
  'scoot-inn': 'Scoot Inn', emos: "Emo's", antones: "Antone's", continental: 'Continental Club',
  concourse: 'Concourse Project', brushy: 'Brushy Street', parish: 'Brushy Street', kingdom: 'Kingdom', vulcan: 'Vulcan Gas Co.',
};
const ENT = { amp: '&', nbsp: ' ', quot: '"', '#39': "'" };
const clean = (s) => String(s ?? '').replace(/&(#?\w+);/g, (_m, e) => ENT[e] ?? ' ').replace(/\s+/g, ' ').trim();
const gt = new Map();
for (const f of readdirSync(`${STUDY}data/ground-truth`)) {
  const slug = f.replace(/\.json$/, '');
  if (!VENUE_NAME[slug]) continue;
  for (const e of JSON.parse(read(`${STUDY}data/ground-truth/${f}`)).events || []) {
    gt.set(`${VENUE_NAME[slug]}|${e.date}|${clean(e.title)}`, e);
  }
}
const season = JSON.parse(read(`${STUDY}data/season-austin.json`));
let matched = 0;
for (const a of season.artists) {
  const e = gt.get(`${a.venue}|${a.date}|${a.billedAs || a.name}`);
  if (!e) continue;
  matched += 1;
  if (e.ticketUrl && /^https:\/\//.test(e.ticketUrl)) a.buy = { url: e.ticketUrl, ticketer: e.ticketer || null, from: 'venue' };
}
if (matched !== season.artists.length) console.warn(`ground truth matched ${matched} of ${season.artists.length}`);
// On-sale times: Do512's JSON carries `ticket_onsale_time` (onSaleAt in the
// study's copy) — 7 shows on Sep 24, all Fri Sep 25, 10 AM CT. Real, so used.
let onSales = 0;
for (const e of JSON.parse(read(`${STUDY}data/sources/do512.json`)).events || []) {
  if (!e.onSaleAt) continue;
  const venue = VENUE_NAME[e.venue];
  const a = season.artists.find((x) => x.venue === venue && x.date === e.date && clean(e.title).toLowerCase().includes(x.name.toLowerCase().slice(0, 6)));
  if (a) { a.onSale = e.onSaleAt; onSales += 1; } else console.warn(`do512 on-sale not matched: ${e.venue} ${e.date} ${e.title}`);
}

// ---- 1. the bundle, with two hook calls injected (bundle only) --------------------
// Each anchor must match exactly once, or the build fails loudly: a silent
// miss would render a canvas where a direction quietly does nothing.
const HOOKS = [
  {
    file: `${REPO}js/v3/wall.js`,
    anchor: '  if (ctx.wireZoom) ctx.wireZoom(el, artistName, opts.occ || null);\n  watchFit(el);\n  return el;',
    insert: '  if (globalThis.__fnCardHook) globalThis.__fnCardHook(el, facts, ctx, opts);\n',
    before: '  watchFit(el);',
  },
  {
    file: `${REPO}js/v3/card-facts.js`,
    anchor: '  if (chips.childNodes.length) grown.appendChild(chips);\n  return grown;',
    insert: '  if (globalThis.__fnGrownHook) globalThis.__fnGrownHook(grown, facts);\n',
    before: '  return grown;',
  },
];
const hookPlugin = {
  name: 'canvas-hooks',
  setup(build) {
    for (const h of HOOKS) {
      const filter = new RegExp(`${h.file.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`);
      build.onLoad({ filter }, () => {
        const src = read(h.file);
        const n = src.split(h.anchor).length - 1;
        if (n !== 1) throw new Error(`hook anchor matched ${n}x in ${h.file}`);
        const cut = h.before ? h.anchor.indexOf(h.before) : 0;
        const patched = src.replace(h.anchor, h.anchor.slice(0, cut) + h.insert + h.anchor.slice(cut));
        return { contents: patched, loader: 'js' };
      });
    }
    // The enriched season as a module the entry imports.
    build.onResolve({ filter: /^season:data$/ }, () => ({ path: 'season', namespace: 'season' }));
    build.onLoad({ filter: /.*/, namespace: 'season' }, () => ({ contents: JSON.stringify(season), loader: 'json' }));
  },
};
const bundle = (await esbuild.build({
  entryPoints: [`${HERE}entry.mjs`],
  bundle: true,
  format: 'iife',
  write: false,
  target: 'es2020',
  legalComments: 'none',
  minifyWhitespace: true,
  plugins: [hookPlugin],
  // Storage never touches the page's origin: every read/write goes to an
  // in-memory map the runtime owns (so no token, fake or not, persists).
  define: {
    localStorage: '__memLS', sessionStorage: '__memSS',
    'window.localStorage': '__memLS', 'window.sessionStorage': '__memSS',
  },
})).outputFiles[0].text;

// ---- 2. the production CSS, with viewport queries rewritten into frame scopes -----
// A phone frame and a desktop frame share one page, so a width or pointer
// media query cannot decide for them. Each becomes a class scope carried by
// the frame (and by the zoom layer while a zoom is open from that frame).
const MEDIA = [
  [/^\(min-width:\s*720px\)$/, '.desk'],
  [/^\(min-width:\s*1100px\)$/, '.wide'],
  [/^\(max-width:\s*719\.98px\)$/, '.phone'],
  [/^\(pointer:\s*coarse\)$/, '.phone'],
  [/^\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)$/, '.desk'],
];
const vwToVar = (css) => css.replace(/(\d*\.?\d+)vw\b/g, (_, n) => (n === '100' ? 'var(--vw)' : `calc(var(--vw) * ${n} / 100)`));

function blocks(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) { const rest = css.slice(i).trim(); if (rest) out.push({ prelude: rest, body: null }); break; }
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    out.push({ prelude: css.slice(i, open).trim(), body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}
function prefix(sel, scope) {
  return sel.split(',').map((s) => {
    s = s.trim();
    if (!s) return s;
    if (s.startsWith(':root')) return scope + s.slice(5);
    if (/^(html|body)\b/.test(s)) return `${scope}${s.replace(/^(html|body)/, '')}`;
    return `${scope} ${s}`;
  }).join(', ');
}
function scopeCss(css) {
  css = vwToVar(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  let out = '';
  for (const b of blocks(css)) {
    if (b.body == null) { out += b.prelude + '\n'; continue; }
    const m = b.prelude.match(/^@media\s+(.+)$/);
    if (m) {
      const hit = MEDIA.find(([re]) => re.test(m[1].trim()));
      if (!hit) { out += `${b.prelude} {${b.body}}\n`; continue; }
      for (const r of blocks(b.body)) if (r.body != null) out += `${prefix(r.prelude, hit[1])} {${r.body}}\n`;
      continue;
    }
    out += `${b.prelude} {${b.body}}\n`;
  }
  return out;
}
const tokensRaw = read(`${REPO}assets/v3-tokens.css`);
const v3Raw = read(`${REPO}assets/v3.css`);
const indexHtml = read(`${REPO}index.html`);
const shellRaw = indexHtml.slice(indexHtml.indexOf('<style>') + 7, indexHtml.indexOf('</style>'));
// Tokens that depend on the viewport are computed where they are DECLARED, so
// :root's copy is the page's. Re-declare them on every frame (and the zoom
// layer) so each resolves against its own --vw.
const rootBlock = blocks(tokensRaw.replace(/\/\*[\s\S]*?\*\//g, '')).find((b) => b.prelude === ':root').body;
const vwDecls = rootBlock.split(';').map((d) => d.trim()).filter((d) => /vw\b|--col-w|--sp-gutter/.test(d)).map(vwToVar);
const frameTokens = `.vp, #zoom-layer { ${vwDecls.join('; ')}; }\n`;

const anton = readFileSync(`${REPO}assets/fonts/anton-400-latin.woff2`).toString('base64');
const inter = readFileSync(`${REPO}assets/fonts/inter-var-latin.woff2`).toString('base64');
const fontCss = `@font-face { font-family: 'Anton'; font-style: normal; font-weight: 400; font-display: block; src: url(data:font/woff2;base64,${anton}) format('woff2'); }
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400 800; font-display: block; src: url(data:font/woff2;base64,${inter}) format('woff2'); }`;

const prodCss = [
  `:root { --vw: 100vw; }`,
  frameTokens,
  scopeCss(tokensRaw),
  scopeCss(v3Raw),
  scopeCss(shellRaw),
].join('\n');

// The app's mark, for the alert's avatar (the brand script draws it).
const mark = `data:image/svg+xml;base64,${readFileSync(`${REPO}assets/mark.svg`).toString('base64')}`;

// The app screen's own markup (index.html #screen-app: header, toolbar, day
// rail, wall root, dock), so every frame wears the real chrome. Ids become
// data-id (a page of frames would repeat them); the runtime fills the parts
// app.js would paint.
const shellFrom = indexHtml.indexOf('<div class="shell">', indexHtml.indexOf('id="screen-app"'));
const shellTo = indexHtml.indexOf('<!-- Settings (atlas 21h)');
if (shellFrom < 0 || shellTo < 0) throw new Error('index.html: app screen markup not found');
let appShell = indexHtml.slice(shellFrom, shellTo).trim();
appShell = appShell.slice(0, appShell.lastIndexOf('</div>')); // the #screen-app wrapper's own close
appShell = appShell.replace(/<!--[\s\S]*?-->/g, '').replace(/\sid="/g, ' data-id="');

// ---- 3. assemble ------------------------------------------------------------------
const canvasCss = read(`${HERE}canvas.css`);
const runtime = read(`${HERE}runtime.js`);
const body = read(`${HERE}body.html`);
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Austin, month by month</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
${fontCss}
${prodCss}
</style>
<style>
${canvasCss}
</style>
</head>
<body>
${body}
<script>
// In-memory storage for the bundled app modules (build.mjs define).
(function () {
  function mem() { var m = new Map(); return {
    getItem: function (k) { return m.has(k) ? m.get(k) : null; },
    setItem: function (k, v) { m.set(k, String(v)); },
    removeItem: function (k) { m.delete(k); },
    clear: function () { m.clear(); },
    key: function (i) { return Array.from(m.keys())[i] || null; },
    get length() { return m.size; } }; }
  window.__memLS = mem(); window.__memSS = mem();
  window.__MARK = ${JSON.stringify(mark)};
  window.__APP_SHELL = ${JSON.stringify(appShell)};
})();
</script>
<script>
${bundle}
</script>
<script>
${runtime}
</script>
</body>
</html>
`;
writeFileSync(`${HERE}canvas.html`, html);
// The Artifact host wraps a page in its own doctype, head and body, so the
// published copy is the same page without them (canvas.html keeps them, so a
// local file:// check renders in standards mode, not quirks).
const fragment = html
  .replace(/^<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n/, '')
  .replace('</head>\n<body>\n', '')
  .replace(/<\/body>\n<\/html>\n$/, '');
if (/<\/?(html|head|body)\b|<!doctype/i.test(fragment.slice(0, 2000) + fragment.slice(-200))) throw new Error('publish.html still carries a document wrapper');
// Written outside the repo (PUBLISH_OUT, default the system temp dir): it is
// a build product for one publish, not something to commit.
const publishOut = process.env.PUBLISH_OUT || (await import('node:os')).tmpdir();
writeFileSync(`${publishOut}/city-seasons-canvas.html`, fragment);
console.log(`publish copy: ${publishOut}/city-seasons-canvas.html`);
console.log(`canvas.html: ${(html.length / 1024).toFixed(0)} KB (bundle ${(bundle.length / 1024).toFixed(0)} KB, ${season.artists.length} shows, ${season.artists.filter((a) => a.buy).length} with the venue's own buy link, ${onSales} on-sale times)`);
