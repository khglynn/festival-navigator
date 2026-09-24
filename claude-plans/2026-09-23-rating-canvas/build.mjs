// Build the rating canvas: ONE self-contained HTML file.
//   node build.mjs            -> canvas.html beside this script
// The production modules are bundled read-only from the repo; the repo is
// never written. See NOTES.md for why this differs from the 08-29 rig.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const HERE = new URL('.', import.meta.url).pathname;
const REPO = new URL('../../', import.meta.url).pathname; // the repo root, two levels up
const require = createRequire(import.meta.url);
// esbuild is not a dependency of this repo; install it once anywhere and point ESBUILD at it
// (the 2026-09-23 build borrowed another project's copy): ESBUILD=/path/to/node_modules/esbuild node build.mjs
const esbuild = require(process.env.ESBUILD || 'esbuild');
const read = (p) => readFileSync(p, 'utf8');

// ---- 1. the bundle, with two hook calls injected (bundle only) --------------------
// Each anchor must match exactly once, or the build fails loudly: a silent
// miss would render a canvas where a direction quietly does nothing.
const HOOKS = [
  {
    file: `${REPO}/js/v3/wall.js`,
    anchor: '  if (ctx.wireZoom) ctx.wireZoom(el, artistName, opts.occ || null);\n  return el;',
    insert: '  if (globalThis.__fnCardHook) globalThis.__fnCardHook(el, facts, ctx, opts);\n',
  },
  {
    file: `${REPO}/js/v3/card-facts.js`,
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
  // Storage never touches the artifact's origin: every read/write goes to an
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
const tokensRaw = read(`${REPO}/assets/v3-tokens.css`);
const v3Raw = read(`${REPO}/assets/v3.css`);
const indexHtml = read(`${REPO}/index.html`);
const shellRaw = indexHtml.slice(indexHtml.indexOf('<style>') + 7, indexHtml.indexOf('</style>'));
// Tokens that depend on the viewport are computed where they are DECLARED, so
// :root's copy is the page's. Re-declare them on every frame (and the zoom
// layer) so each resolves against its own --vw.
const rootBlock = blocks(tokensRaw.replace(/\/\*[\s\S]*?\*\//g, '')).find((b) => b.prelude === ':root').body;
const vwDecls = rootBlock.split(';').map((d) => d.trim()).filter((d) => /vw\b|--col-w|--sp-gutter/.test(d)).map(vwToVar);
const frameTokens = `.vp, #zoom-layer { ${vwDecls.join('; ')}; }\n`;

const anton = readFileSync(`${REPO}/assets/fonts/anton-400-latin.woff2`).toString('base64');
const inter = readFileSync(`${REPO}/assets/fonts/inter-var-latin.woff2`).toString('base64');
const fontCss = `@font-face { font-family: 'Anton'; font-style: normal; font-weight: 400; font-display: block; src: url(data:font/woff2;base64,${anton}) format('woff2'); }
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400 800; font-display: block; src: url(data:font/woff2;base64,${inter}) format('woff2'); }`;

const prodCss = [
  `:root { --vw: 100vw; }`,
  frameTokens,
  scopeCss(tokensRaw),
  scopeCss(v3Raw),
  scopeCss(shellRaw),
].join('\n');

// ---- 3. assemble ------------------------------------------------------------------
const canvasCss = read(`${HERE}canvas.css`);
const runtime = read(`${HERE}runtime.js`);
const body = read(`${HERE}body.html`);
const html = `<title>Rating on the card</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
${fontCss}
${prodCss}
</style>
<style>
${canvasCss}
</style>
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
})();
</script>
<script>
${bundle}
</script>
<script>
${runtime}
</script>
`;
writeFileSync(`${HERE}canvas.html`, html);
console.log(`canvas.html: ${(html.length / 1024).toFixed(0)} KB (bundle ${(bundle.length / 1024).toFixed(0)} KB)`);
