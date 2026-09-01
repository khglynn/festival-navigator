#!/usr/bin/env node
// Brand rasters — the mark, the app icons, and one link-preview image per
// festival — rendered from ONE source of truth: the SVG built in this file.
//
//   node scripts/brand-assets.mjs          write everything
//   npm run brand                          same
//
// Why a generator instead of checked-in art: the mark IS the living favicon
// (js/v3/favicon.js), and the OG cards are the app's own card language at
// poster scale. Hand-drawn copies of either would drift the first time a token
// moved. Here the aura math, the anchors, the palette and the grain all come
// from the same places the app reads them, so "regenerate" is the only way the
// art can ever be wrong-but-fixable rather than wrong-and-unnoticed.
//
// Three mechanics that cost a probe each (2026-08-30) — do not re-discover:
//
//   1. resvg cannot read woff2. fontdb rejects assets/fonts/*.woff2 as
//      "malformed font" and then renders in a fallback face without failing.
//      We decompress woff2 -> ttf in memory (wawoff2) so the SHIPPED font
//      files stay the one source of truth for the typeface.
//   2. font.fontBuffers does NOT register family names; font.fontFiles does.
//      Identical Anton bytes render as Anton via fontFiles and as a generic
//      sans via fontBuffers, silently. So the TTFs go to a temp dir.
//   3. Inter is a VARIABLE font and resvg takes its default instance — every
//      font-weight renders as 400. The micro-label's 800 is faked with a
//      hairline stroke in the fill colour.
//
// And because (1) and (2) both fail SILENTLY, assertFontsLoaded() proves Anton
// is really Anton before a single asset is written.
//
// Formats, and why they differ:
//   - Icons are PNG and carry NO grain. The living favicon is a clean gradient
//     square (js/v3/favicon.js draws no texture), grain is a card/hero FINISH
//     the app itself drops in low-power and reduced-motion, and at 48px it is
//     dither. It also costs 5x the bytes: a 512 icon is 87 KB clean and 465 KB
//     grained, downloaded on every PWA install.
//   - Link previews are JPEG. They are photographic surfaces — a 1200x630 card
//     of soft gradients, where the grain is doing real work as DITHER (an 8-bit
//     PNG of a gradient this wide bands, and chat clients re-encode it anyway).
//     Per-pixel noise is the one thing PNG cannot compress: the same card is
//     1.6 MB as PNG and 120 KB as a q88 JPEG. Every OG image on the web is a
//     JPEG for exactly this reason.
import { Resvg } from '@resvg/resvg-js';
import { encode as encodeJpeg } from 'jpeg-js';
import { decompress } from 'wawoff2';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hslOf, strokeOf } from '../js/v3/palette.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p));

// ---- the palette, quoted from assets/v3-tokens.css --------------------------------
// Look values up, never invent (CLAUDE.md). If one of these moves in the
// tokens file it has to move here too — that is the price of rendering
// outside the browser.
const T = {
  cardUnpicked: '#1C1731', // --card-unpicked, the artist-card ground
  textHeader: '#EDEAF4',   // --text-header
  textBody: '#C6CBD6',     // --text-body
  tertiary: '#877FA4',     // --text-tertiary
  brand: '#C084FC',        // rgb(--brand)
  pink: '#F472B6',         // the pulse's pink
  violet: '#8B5CF6',       // the pulse's deep violet
};

// The living favicon's gradient, exactly (js/v3/favicon.js draw()).
const MARK_FROM = T.violet;
const MARK_TO = T.pink;
// js/v3/favicon.js: r = 7 on a 32px canvas.
const MARK_RADIUS = 7 / 32;

// js/v3/aura.js ANCHORS, as objectBoundingBox fractions. A CSS
// `radial-gradient(130% 130% at X Y)` is an SVG radialGradient at (X, Y) with
// r = 0.65 — half of 130%.
const ANCHORS = [
  { cx: 0.20, cy: 1.20 },
  { cx: 0.85, cy: -0.20 },
  { cx: -0.15, cy: 0.30 },
  { cx: 1.15, cy: 0.70 },
];
const AURA_R = 0.65;
// The mark's three washes: WHICH anchor, WHICH colour, HOW strong.
//
// Read them as one card that a crew has picked. The first two are the app's
// own violets counter-flowing across the base gradient — deep violet pushed in
// from the right, bright violet from the left — which is what gives the square
// depth instead of the flat CSS ramp the living favicon draws. The third is
// the FIRST CREW MEMBER'S colour (palette slot 0), kept to a whisper: a warm
// note arriving from the bottom-left corner, the way somebody else's pick
// arrives on a card you already picked.
//
// Alphas are low on purpose. Tried at .5+ and the blooms wash the base out to
// a pale lavender — the square stops being the living favicon, which is the
// one thing it must stay.
const MARK_WASHES = [
  { anchor: 3, color: T.violet, alpha: 0.55 },
  { anchor: 2, color: T.brand, alpha: 0.45 },
  { anchor: 0, color: hslOf(0), alpha: 0.22 },
];

const xml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
));

// One aura layer, with aura.js's own stop structure: full alpha at 0,
// half at 45%, gone by 78%.
function auraLayer(id, anchor, color, alpha) {
  const a = (v) => `<stop offset="${v[0]}" stop-color="${color}" stop-opacity="${v[1]}"/>`;
  return `<radialGradient id="${id}" cx="${anchor.cx}" cy="${anchor.cy}" r="${AURA_R}">`
    + [[0, alpha], [0.45, alpha * 0.5], [0.78, 0]].map(a).join('')
    + '</radialGradient>';
}

// --grain, as a filter rather than the token's tiled data-URI: same
// feTurbulence, one canvas-sized rect instead of a 140px tile.
const GRAIN_FILTER = '<filter id="grain" x="0" y="0" width="100%" height="100%">'
  + '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2"/></filter>';

// ---- fonts -------------------------------------------------------------------------
function loadFonts() {
  const dir = mkdtempSync(join(tmpdir(), 'fn-brand-'));
  const write = async (src, name) => {
    const ttf = Buffer.from(await decompress(read(src)));
    const path = join(dir, name);
    writeFileSync(path, ttf);
    return path;
  };
  return (async () => ({
    dir,
    files: [
      await write('assets/fonts/anton-400-latin.woff2', 'anton.ttf'),
      await write('assets/fonts/inter-var-latin.woff2', 'inter.ttf'),
    ],
  }))();
}

const raster = (svg, files) => new Resvg(svg, {
  font: { fontFiles: files, loadSystemFonts: false, defaultFontFamily: 'Inter' },
  logLevel: 'error',
}).render();

const render = (svg, files) => raster(svg, files).asPng();

// q88: high enough that the aura's soft ramps stay clean, low enough that a
// 1200x630 card lands around 120 KB. Above ~q92 the grain starts costing more
// than it is worth; below ~q80 the ramps block up.
const renderJpeg = (svg, files, quality = 88) => {
  const img = raster(svg, files);
  return encodeJpeg({ data: Buffer.from(img.pixels), width: img.width, height: img.height }, quality).data;
};

// Both font failure modes are silent, so prove the face is real: the same
// string set in Anton and in a family that cannot exist must NOT rasterise to
// the same bytes.
function assertFontsLoaded(files) {
  const probe = (family) => render(
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="120">`
    + `<text x="8" y="90" font-family="${family}" font-size="80" fill="#fff">Anton?</text></svg>`,
    files,
  );
  if (probe('Anton').equals(probe('__no_such_family__'))) {
    throw new Error(
      'Anton did not load — resvg fell back silently. Check the woff2 decompression '
      + 'and that fontFiles (not fontBuffers) is used.',
    );
  }
}

// Real advance width, measured by rendering the text alone and reading its
// bounding box. Beats guessing an average glyph width: it is what lets a long
// festival name shrink to fit instead of running off the canvas.
function measure(text, { family, size, tracking = 0 }, files) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="6000" height="${Math.ceil(size * 2)}">`
    + `<text x="0" y="${size}" font-family="${family}" font-size="${size}"`
    + ` letter-spacing="${tracking}" fill="#fff">${xml(text)}</text></svg>`;
  const box = new Resvg(svg, {
    font: { fontFiles: files, loadSystemFonts: false, defaultFontFamily: 'Inter' },
    logLevel: 'error',
  }).getBBox();
  return box ? box.width : 0;
}

// ---- the mark ----------------------------------------------------------------------
// One artist card that two people have picked: the living favicon's gradient
// square, two aura washes at real anchors, the card's grain.
//
// bleed=true drops the corner radius and pulls the auras inward — an Android
// maskable icon is masked to a circle/squircle and clips everything outside a
// 40% safe radius, so a rounded square declared maskable throws away the one
// shape decision the mark makes.
// The mark's washes, as SVG defs + the rects that paint them. One function so
// the 512 icon and the 54px lockup on a link preview are the same object.
function markPaint(prefix, { bleed = false } = {}) {
  // Inside an Android mask the anchors sit outside the box and get clipped, so
  // pull them toward the middle and let the blooms read inside the safe zone.
  const pull = (a) => (bleed ? { cx: 0.5 + (a.cx - 0.5) * 0.55, cy: 0.5 + (a.cy - 0.5) * 0.55 } : a);
  const ids = MARK_WASHES.map((_, i) => `${prefix}w${i}`);
  return {
    defs: MARK_WASHES.map((w, i) => auraLayer(ids[i], pull(ANCHORS[w.anchor]), w.color, w.alpha)).join(''),
    ids,
  };
}

function markSvg({ size = 512, bleed = false } = {}) {
  // Authored once in a 512-unit box and only ever SCALED, so the mark is the
  // same object at 48 and at 512. Sizing the geometry per-raster instead would
  // give each icon subtly its own proportions — a mark must not do that.
  const V = 512;
  const r = bleed ? 0 : V * MARK_RADIUS;
  const { defs, ids } = markPaint('m', { bleed });
  const wash = ids.map((id) => `    <rect width="${V}" height="${V}" fill="url(#${id})"/>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${V} ${V}">
  <title>Festival Navigator</title>
  <!-- Generated by scripts/brand-assets.mjs (npm run brand). Edit the script, not this file:
       every icon and every link preview is drawn from the same code. -->
  <defs>
    <linearGradient id="mbase" x1="0" y1="0" x2="${V}" y2="${V}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${MARK_FROM}"/><stop offset="1" stop-color="${MARK_TO}"/>
    </linearGradient>
    ${defs}
    <clipPath id="mclip"><rect width="${V}" height="${V}" rx="${r}" ry="${r}"/></clipPath>
  </defs>
  <g clip-path="url(#mclip)">
    <rect width="${V}" height="${V}" fill="url(#mbase)"/>
${wash}
  </g>
</svg>`;
}

// ---- the link preview --------------------------------------------------------------
const OG_W = 1200;
const OG_H = 630;
const PAD = 76;
// The landing screen's own words (index.html #screen-landing). Not new copy.
const PROMISE = 'Pick artists with your people. Works with no signal.';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// LOCATION · MONTH YEAR, built from `location` + the validated `startsOn`.
// Deliberately NOT from `dates`: that field is prose written for someone
// reading the board ("...a separately-billed \"Early Arrival\" pre-party runs
// Wednesday Sept 16..."), and prose does not survive poster scale.
function subLine(fest) {
  const [y, m] = String(fest.startsOn || '').split('-');
  const when = MONTHS[Number(m) - 1] ? `${MONTHS[Number(m) - 1]} ${y}` : '';
  return [fest.location, when].filter(Boolean).join('  ·  ').toUpperCase();
}

// Anton at the biggest size that still fits the measure, then wrapped onto a
// second line only if even the floor is too wide.
function fitDisplay(text, { max, min, budget, trackingEm = 0.05 }, files) {
  for (let size = max; size >= min; size -= 2) {
    if (measure(text, { family: 'Anton', size, tracking: size * trackingEm }, files) <= budget) {
      return { size, lines: [text] };
    }
  }
  const words = text.split(' ');
  if (words.length > 1) {
    // Break at the point that leaves the two halves most even.
    let best = 1;
    for (let i = 1; i < words.length; i++) {
      const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
      const bd = Math.abs(words.slice(0, best).join(' ').length - words.slice(best).join(' ').length);
      if (d < bd) best = i;
    }
    const lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    for (let size = max; size >= min; size -= 2) {
      const wide = Math.max(...lines.map((l) => measure(l, { family: 'Anton', size, tracking: size * trackingEm }, files)));
      if (wide <= budget) return { size, lines };
    }
  }
  return { size: min, lines: [text] };
}

// A micro-label: Inter, uppercase, wide tracking. The 800 weight the app uses
// cannot render (variable-font default instance), so a hairline stroke in the
// fill colour carries the weight instead.
function microLabel(text, { x, y, size = 21, fill = T.tertiary }) {
  return `<text x="${x}" y="${y}" font-family="Inter" font-size="${size}"`
    + ` letter-spacing="${(size * 0.13).toFixed(2)}" fill="${fill}"`
    + ` stroke="${fill}" stroke-width="0.65">${xml(text)}</text>`;
}

function ogFrame(inner, { accent }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">
  <defs>
    ${auraLayer('f1', ANCHORS[1], accent, 0.60)}
    ${auraLayer('f2', ANCHORS[0], T.violet, 0.55)}
    ${auraLayer('f3', ANCHORS[3], T.pink, 0.34)}
    <linearGradient id="pulse" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${T.brand}"/><stop offset="0.45" stop-color="${T.pink}"/>
      <stop offset="1" stop-color="${T.violet}"/>
    </linearGradient>
    ${GRAIN_FILTER}
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="${T.cardUnpicked}"/>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#f2)"/>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#f1)"/>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#f3)"/>
  <rect width="${OG_W}" height="${OG_H}" filter="url(#grain)" opacity="0.16"/>
${inner}
</svg>`;
}

// The same mark, drawn small into a link preview at (x, y).
function markInline(x, y, size) {
  const r = size * MARK_RADIUS;
  const { defs, ids } = markPaint('i');
  const box = `x="${x}" y="${y}" width="${size}" height="${size}"`;
  return `<defs>
    <linearGradient id="ibase" x1="${x}" y1="${y}" x2="${x + size}" y2="${y + size}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${MARK_FROM}"/><stop offset="1" stop-color="${MARK_TO}"/>
    </linearGradient>
    ${defs}
    <clipPath id="iclip"><rect ${box} rx="${r}" ry="${r}"/></clipPath>
  </defs>
  <g clip-path="url(#iclip)">
    <rect ${box} fill="url(#ibase)"/>
    ${ids.map((id) => `<rect ${box} fill="url(#${id})"/>`).join('\n    ')}
  </g>`;
}

function festOg(fest, files) {
  const accent = `rgb(${fest.accent})`;
  const budget = OG_W - PAD * 2 - 112; // room for the superscript year mark
  const { size, lines } = fitDisplay(fest.name.toUpperCase(), { max: 122, min: 62, budget }, files);
  const gap = size * 1.06;
  // One line sits on the same baseline a two-line block ends on, so the block
  // grows upward and the sub-line never moves: a row of these reads as one family.
  const lastBaseline = 404;
  const body = lines.map((line, i) => {
    const y = lastBaseline - (lines.length - 1 - i) * gap;
    const yr = i === lines.length - 1 && fest.year
      ? `<tspan font-size="${(size * 0.45).toFixed(1)}" dy="${(-size * 0.52).toFixed(1)}" fill-opacity="0.7"> ${xml(fest.year)}</tspan>`
      : '';
    return `<text x="${PAD}" y="${y.toFixed(1)}" font-family="Anton" font-size="${size}"`
      + ` letter-spacing="${(size * 0.05).toFixed(2)}" fill="${accent}">${xml(line)}${yr}</text>`;
  }).join('\n  ');

  return ogFrame(`  ${markInline(PAD, 62, 54)}
  <text x="${PAD + 54 + 20}" y="105" font-family="Anton" font-size="25" letter-spacing="3.1"
        fill="${T.textHeader}" fill-opacity="0.92">FESTIVAL NAVIGATOR</text>
  ${body}
  ${microLabel(subLine(fest), { x: PAD, y: 456 })}
  <text x="${PAD}" y="558" font-family="Inter" font-size="26" fill="${T.textBody}"
        fill-opacity="0.9">${xml(PROMISE)}</text>`, { accent });
}

// No festival: the landing screen's own lockup, NAVIGATOR in the pulse. The
// wordmark IS the identity here, so the small corner mark that the fest cards
// carry is dropped — repeating it beside a 100px wordmark reads as a stray
// swatch. Everything else sits exactly where a fest card puts it, so the
// default and the eleven fests are one family.
function defaultOg(files) {
  const budget = OG_W - PAD * 2;
  const size = fitDisplay('NAVIGATOR', { max: 116, min: 70, budget }, files).size;
  const gap = size * 1.06;
  const lastBaseline = 404;
  return ogFrame(`  <text x="${PAD}" y="${(lastBaseline - gap).toFixed(1)}" font-family="Anton" font-size="${size}"
        letter-spacing="${(size * 0.05).toFixed(2)}" fill="${T.textHeader}">FESTIVAL</text>
  <text x="${PAD}" y="${lastBaseline}" font-family="Anton" font-size="${size}"
        letter-spacing="${(size * 0.05).toFixed(2)}" fill="url(#pulse)">NAVIGATOR</text>
  ${microLabel('EVERY GROUP GETS ITS OWN LINK', { x: PAD, y: 456 })}
  <text x="${PAD}" y="558" font-family="Inter" font-size="26" fill="${T.textBody}"
        fill-opacity="0.9">${xml(PROMISE)}</text>`, { accent: T.brand });
}

// ---- main --------------------------------------------------------------------------
async function main() {
  const { dir, files } = await loadFonts();
  try {
    assertFontsLoaded(files);

    // The mark, as the one committed vector source.
    const mark = markSvg({ size: 512 });
    writeFileSync(join(ROOT, 'assets/mark.svg'), `${mark}\n`);

    const icons = [
      ['favicon.png', markSvg({ size: 48 })],
      ['icon-192.png', markSvg({ size: 192 })],
      ['icon-512.png', mark],
      // Android maskable: full-bleed, masked to a circle/squircle by the OS.
      ['icon-maskable-512.png', markSvg({ size: 512, bleed: true })],
      // iOS applies its OWN rounding to an apple-touch-icon, so this one is
      // full-bleed too. Handing iOS a pre-rounded square with transparent
      // corners gets those corners composited against black on the home
      // screen — a dark notch at each corner of the icon. 180 is the size
      // iOS actually asks for.
      ['apple-touch-icon.png', markSvg({ size: 180, bleed: true })],
    ];
    for (const [name, svg] of icons) {
      writeFileSync(join(ROOT, name), render(svg, files));
      console.log(`brand: ${name}`);
    }

    mkdirSync(join(ROOT, 'assets/og'), { recursive: true });
    const index = JSON.parse(read('data/festivals/index.json').toString('utf8'));
    const preview = (name, svg) => {
      writeFileSync(join(ROOT, `assets/og/${name}.jpg`), renderJpeg(svg, files));
      console.log(`brand: assets/og/${name}.jpg`);
    };
    preview('default', defaultOg(files));
    for (const fest of index) preview(fest.id, festOg(fest, files));
    console.log(`brand: done — ${icons.length} icons, ${index.length + 1} previews`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
