// The invite QR (find your crew, slice 1 — claude-plans/2026-10-02-find-your-crew.md).
// The Invite sheet draws the crew link as a QR on the phone itself, so a
// friend standing next to you points a camera and is in. Held here, in Node
// (jsdom has no canvas; the drawn pixels on a real screen are the browser
// contracts', tests/browser/people-menu.test.mjs and qr-art.test.mjs):
//
//   - the encoder is uqr 0.1.3, vendored byte-for-byte under a licence
//     header: the body's sha256 is pinned, so an edit to the vendored file
//     (or a different copy) is a red build, not a silent change;
//   - every link shape the app builds (crew.js crewLink) round-trips: the
//     matrix, rendered to pixels, decodes back to EXACTLY the text;
//   - the branded card (v112, Kevin 2026-10-03: "can we do something that
//     looks cooler / is more branded?"): the code is painted by the pixel
//     (codePixels, a pure function), so the bytes decoded here are the very
//     bytes qrPng puts on its canvas — every shape at every module size; the
//     layout keeps every module pixel v111 gave the code; the colours are the
//     tokens', and every ink pixel holds 8:1 on the panel;
//   - the saved card (v112's review — Kevin: "bake that url / code into the
//     downloadable image and make it sexy"): what a long-press Save keeps is
//     its own render at one export size on every screen, whole pixels a
//     module, the quiet zone kept, read back like the sheet's, carrying the
//     crew's name and the fest's short name in the app's own type — never
//     the link or any of its text (the code line stays reserved);
//   - qrPng is honest about what it cannot do (no 2D canvas, no image data,
//     a canvas that reads back blank: it throws, and the sheet takes the QR
//     away), and it never logs or reports its text — the text is a crew
//     token, which IS the crew's data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import jsQR from 'jsqr';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

// crew.js reads location.origin and storage at import; a phone on the real host.
globalThis.location = { origin: 'https://fest.kevinhg.com', hostname: 'fest.kevinhg.com', hash: '' };
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
const crew = await import('../js/crew.js');
const { roomsOf } = await import('../js/v3/wall.js');
const { roomSlug } = await import('../js/v3/filters.js');
const { qrMatrix, qrPng, qrLayout, codePixels, QR_COLOURS, qrSaveCard, SAVE_CARD } = await import('../js/v3/qr.js');

// A made-up token of the real shape (27 base64url characters, api/crew.js) —
// never a real crew's.
const TOKEN = 'qrtesttoken_0123456789abcde';

// ---- the vendored encoder ----------------------------------------------------------
// The npm tarball's dist/index.mjs (uqr@0.1.3, registry integrity
// sha512-0rjE8iEJ…hrUJXA==), as it came out of the tarball.
const UQR_BODY_SHA256 = '7f0e61c2f13bb3724edee7bfb876e13c54ac9ee4fcfa283c9fa93cfb1241c325';

test('vendor/uqr.mjs is uqr 0.1.3 byte-for-byte below its licence header', () => {
  const src = read('vendor/uqr.mjs').replace(/\r\n/g, '\n'); // a CRLF checkout hashes as LF (sw-stamp.mjs does the same)
  const end = src.indexOf('*/\n');
  assert.ok(src.startsWith('/*! uqr 0.1.3 · MIT') && end > 0, 'one header comment first, naming the package, version and licence');
  const header = src.slice(0, end + 3);
  const body = src.slice(end + 3);
  assert.equal(createHash('sha256').update(body).digest('hex'), UQR_BODY_SHA256, 'the upstream bytes, unchanged');
  // MIT asks for the copyright and permission notice in every copy.
  assert.match(header, /Copyright \(c\) Project Nayuki/);
  assert.match(header, /Copyright \(c\) 2023 Anthony Fu/);
  assert.match(header, /Permission is hereby granted, free of charge/);
  assert.match(header, /THE SOFTWARE IS PROVIDED "AS IS"/);
  // Nothing in it reaches the network, the console or a global.
  assert.doesNotMatch(body, /\bimport\b|\bfetch\b|\bconsole\b|\bwindow\b|\bdocument\b|\bglobalThis\b|\beval\b/);
});

test('js/v3/qr.js imports only the vendored encoder, and never logs, records or tracks its text', () => {
  const src = read('js/v3/qr.js');
  const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['../../vendor/uqr.mjs']);
  const code = src.replace(/^\s*\/\/.*$/gm, ''); // what it does, not what its comments say
  assert.doesNotMatch(code, /\bimport\(/, 'no lazy imports of its own');
  assert.doesNotMatch(code, /console\.|\brecord\(|\btrack\(|errlog|localStorage|sessionStorage|indexedDB|fetch\(/, 'the text is a crew link: it goes nowhere but the canvas');
  // The card is the app's brand, never the festival's: the accent lives in
  // exactly four places (AGENTS.md), and an invite is none of them.
  assert.doesNotMatch(src, /--fest\b/, 'qr.js never reads, or names, the festival accent');
});

// ---- every link the app builds round-trips -------------------------------------------
// Pixels from a module grid: dark modules `dark`, the rest `light`, each
// module `scale` pixels square — the shape qrPng draws.
function rgbaOf(matrix, scale = 4, dark = [12, 10, 20], light = [255, 255, 255]) {
  const px = matrix.size * scale;
  const out = new Uint8ClampedArray(px * px * 4);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const on = matrix.data[Math.floor(y / scale)][Math.floor(x / scale)];
      const c = on ? dark : light;
      const i = (y * px + x) * 4;
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
    }
  }
  return { data: out, width: px, height: px };
}
// The k-th ring of modules in from the edge (0 is the outermost).
const QUIET = 4;
function ring(m, k) {
  const out = [];
  for (let i = k; i < m.size - k; i++) out.push(m.data[k][i], m.data[m.size - 1 - k][i], m.data[i][k], m.data[i][m.size - 1 - k]);
  return out;
}
const decode = ({ data, width, height }) => {
  const hit = jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
  return hit ? hit.data : null;
};

// The longest `&show=` a real festival can send: every room but the
// shortest-named one (all of them showing sends no `show` at all), across
// the catalogue — so a festival added later is measured too.
function longestShow() {
  const index = JSON.parse(read('data/festivals/index.json'));
  let best = { fid: null, show: null, len: -1 };
  for (const { id } of index.festivals || index) {
    let fest;
    try { fest = JSON.parse(read(`data/festivals/${id}.json`)); } catch { continue; }
    const slugs = roomsOf(fest, { people: {}, selections: {}, meName: null, fid: id }).map(roomSlug).filter(Boolean);
    if (slugs.length < 2) continue;
    const show = [...slugs].sort((a, b) => a.length - b.length).slice(1);
    const len = id.length + show.join(',').length;
    if (len > best.len) best = { fid: id, show, len };
  }
  return best;
}
const longestFid = () => {
  const index = JSON.parse(read('data/festivals/index.json'));
  return (index.festivals || index).map((f) => f.id).sort((a, b) => b.length - a.length)[0];
};
const LONG = longestShow();
const SHAPES = {
  bare: crew.crewLink(TOKEN),
  festival: crew.crewLink(TOKEN, 'acl-2026'),
  'the longest festival id': crew.crewLink(TOKEN, longestFid()),
  // A personal link (&me=) is never drawn — the sheet's IS IN state has no
  // QR — but the encoder must still carry percent-encoding exactly.
  me: crew.crewLink(TOKEN, 'acl-2026', 'Drew B ✔'),
  show: crew.crewLink(TOKEN, 'portola-2026', null, ['afters']),
  view: crew.crewLink(TOKEN, 'portola-2026', null, null, 'list'),
  'the longest show list, as a list': crew.crewLink(TOKEN, LONG.fid, null, LONG.show, 'list'),
};

test('the catalogue has a festival with rooms to name, so the longest show list is a real one', () => {
  assert.ok(LONG.fid && LONG.show.length >= 1, `measured ${JSON.stringify(LONG)}`);
  assert.match(SHAPES['the longest show list, as a list'], /&show=[a-z0-9,-]+&view=list$/);
});

for (const [shape, link] of Object.entries(SHAPES)) {
  test(`${shape}: the QR decodes back to exactly the link (${link.length} characters)`, () => {
    assert.ok(link.includes(`#g=${TOKEN}`), 'a crew link');
    const m = qrMatrix(link);
    assert.equal(m.data.length, m.size);
    assert.ok(m.data.every((row) => row.length === m.size), 'a square grid');
    // The quiet zone the QR spec asks for — four light modules all round —
    // is in the bitmap itself: a saved or copied PNG carries no tile around
    // it (the walk of 1b80842). Version v is 17 + 4v modules inside it.
    for (let k = 0; k < QUIET; k++) assert.ok(ring(m, k).every((dark) => !dark), `ring ${k} from the edge is quiet: ${m.size}`);
    assert.ok(ring(m, QUIET).some(Boolean), 'the code itself starts at the fifth ring');
    const version = (m.size - 2 * QUIET - 17) / 4;
    assert.ok(Number.isInteger(version) && version >= 1, `a QR size inside a ${QUIET}-module quiet zone: ${m.size}`);
    assert.equal(decode(rgbaOf(m)), link);
    // Small enough to scan off a phone in the sheet's smallest tile (124 CSS
    // px inside its margin on a short screen): version 10, 65 modules with
    // the quiet zone, still gets 3 device pixels a module at 2x.
    assert.ok(m.size <= 65, `${m.size} modules — the link grew past what the tile can show crisply`);
  });
}

// One exact size, so the error correction and the quiet zone are both
// pinned (a parity check let border 0, border 4 and ECC Q all through, the
// review of 1b80842): the festival link is version 5 at ECC M — 37 modules
// — inside the 4-module quiet zone. ECC L would be smaller, Q larger.
test('the festival link is version 5 at ECC M inside a 4-module quiet zone: 45 modules', () => {
  assert.equal(qrMatrix(SHAPES.festival).size, 45, `${SHAPES.festival} (${SHAPES.festival.length} characters)`);
});

// The same smudge on both: four module rows wiped across half the code,
// clear of the three finder patterns a scanner needs whole. It is real
// damage — the ECC L encoding of the same link no longer reads — and M's
// spare codewords carry it.
function smudged(matrix) {
  const img = rgbaOf(matrix, 4);
  const px = img.width;
  const y0 = Math.floor(px * 0.55);
  for (let y = y0; y < y0 + 16; y++) for (let x = Math.floor(px * 0.3); x < Math.floor(px * 0.8); x++) {
    const i = (y * px + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
  }
  return img;
}
test('the matrix is ECC M: a smudge that defeats ECC L still reads', async () => {
  const { encode } = await import('../vendor/uqr.mjs');
  const link = SHAPES.festival;
  assert.equal(decode(smudged(encode(link, { ecc: 'L', border: QUIET }))), null, 'the smudge is real damage');
  assert.equal(decode(smudged(qrMatrix(link))), link);
});

// ---- the colours ---------------------------------------------------------------------
// The card's colours are tokens (assets/v3-tokens.css :root), and QR_COLOURS
// is only their fallback — so the two must say the same thing.
const TOKENS_CSS = read('assets/v3-tokens.css');
function rootTokens() {
  const css = TOKENS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const start = css.indexOf(':root {');
  assert.ok(start >= 0, 'the tokens file opens a :root block');
  let depth = 0;
  let end = start;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) { end = i; break; }
  }
  const out = {};
  for (const m of css.slice(start, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const norm = (v) => String(v).replace(/\s+/g, '').toLowerCase();
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// WCAG 2's relative luminance and contrast ratio.
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test('QR_COLOURS is the tokens’ own values: the literals in qr.js are a fallback, never a second palette', () => {
  const t = rootTokens();
  const want = {
    auraBase: t['--aura-base'], auraOrange: t['--aura-orange'], auraMagenta: t['--aura-magenta'], auraBlue: t['--aura-blue'],
    panel: t['--qr-panel'], ink: [t['--qr-ink-1'], t['--qr-ink-2'], t['--qr-ink-3']], rim: t['--qr-rim'], seat: t['--qr-seat'],
  };
  for (const [k, v] of Object.entries(want)) {
    if (k === 'ink') assert.deepEqual(QR_COLOURS.ink.map(norm), v.map(norm), 'the three ink stops');
    else assert.equal(norm(QR_COLOURS[k]), norm(v), `${k} is the token's value`);
  }
  assert.deepEqual(Object.keys(QR_COLOURS).sort(), Object.keys(want).sort(), 'and nothing else');
  assert.ok(t['--qr-panel-ghost'], 'the placeholder’s empty window is a token too (v3.css)');
  // The hero button wears the same light, from the same tokens: the QR's
  // aura IS the hero's, so a change to one is a change to both.
  const at = TOKENS_CSS.indexOf('.hero-bg {');
  const hero = TOKENS_CSS.slice(at, TOKENS_CSS.indexOf('}', at));
  for (const name of ['--aura-orange', '--aura-magenta', '--aura-blue']) assert.match(hero, new RegExp(`hsla\\(var\\(${name}\\), `), `.hero-bg reads ${name}`);
  assert.match(hero, /var\(--aura-base\)/, 'and its base');
  assert.doesNotMatch(hero, /hsla\(\d/, 'no hue of its own left in it');
});

test('every point of the ink holds 8:1 on the panel — computed from the tokens, stops and the lines between them', () => {
  const t = rootTokens();
  const panel = hexRgb(t['--qr-panel']);
  const stops = ['--qr-ink-1', '--qr-ink-2', '--qr-ink-3'].map((k) => hexRgb(t[k]));
  let worst = Infinity;
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i <= 1000; i++) {
      const u = i / 1000;
      const c = [0, 1, 2].map((j) => Math.round(stops[k][j] + (stops[k + 1][j] - stops[k][j]) * u));
      worst = Math.min(worst, contrast(c, panel));
    }
  }
  assert.ok(worst >= 8, `the lightest ink is ${worst.toFixed(2)}:1 on the panel`);
  // The worst point is the fuchsia stop (luminance is convex along a straight
  // sRGB line, so the extreme is at a stop) — 8.03:1.
  assert.ok(Math.abs(worst - contrast(stops[2], panel)) < 1e-9, 'and it is the last stop');
});

// ---- the code, by the pixel ----------------------------------------------------------
// The ink the spec asks for at pixel (x, y) of a code `size` modules square at
// `s` pixels a module: a straight sRGB line through the three stops, deep
// violet at the symbol's top-left, fuchsia at its bottom-right, rounded to 8
// bits. The test's own statement of it, held against what codePixels paints.
function inkSpec(stops, size, s, x, y) {
  let t = (x + y + 1 - 2 * QUIET * s) / (2 * (size - 2 * QUIET) * s);
  t = Math.min(1, Math.max(0, t));
  const k = t > 0.5 ? 1 : 0;
  const u = k ? (t - 0.5) / 0.5 : t / 0.5;
  return [0, 1, 2].map((c) => Math.round(stops[k][c] + (stops[k + 1][c] - stops[k][c]) * u));
}
// Every module size the layouts give, and the edges of the style switch (4).
const SCALES = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];
// (Guarded so that a qr.js without these exports fails each test, not the file.)
const PANEL = QR_COLOURS ? hexRgb(QR_COLOURS.panel) : null;
const INK = QR_COLOURS ? QR_COLOURS.ink.map(hexRgb) : null;
const eyesOf = (size) => { const far = size - QUIET - 7; return [[QUIET, QUIET], [far, QUIET], [QUIET, far]]; };
const runs = (cells) => {
  const out = [];
  for (const c of cells) { if (out.length && out[out.length - 1][0] === c) out[out.length - 1][1]++; else out.push([c, 1]); }
  return out.map(([c, n]) => `${c}${n}`).join(' ');
};
// A screen at page zoom, or a camera close up: the same picture, each pixel
// k×k. jsQR samples on a grid of blocks, so a code at one pixel a module is
// read enlarged, exactly as it would be seen enlarged.
function enlarged({ data, side }, k) {
  if (k === 1) return { data, width: side, height: side };
  const w = side * k;
  const out = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) out.set(data.subarray(((Math.floor(y / k) * side) + Math.floor(x / k)) * 4, ((Math.floor(y / k) * side) + Math.floor(x / k)) * 4 + 4), (y * w + x) * 4);
  return { data: out, width: w, height: w };
}

for (const [shape, link] of Object.entries(SHAPES)) {
  test(`${shape}: the code as painted (codePixels — the very bytes qrPng puts on its canvas) decodes to exactly the link at every module size`, () => {
    const m = qrMatrix(link);
    for (const s of SCALES) {
      const code = codePixels(m, s, QR_COLOURS);
      assert.equal(code.side, m.size * s, 'the code and its quiet zone, size × s square');
      assert.equal(code.data.length, code.side * code.side * 4, 'RGBA');
      assert.ok(code.data instanceof Uint8ClampedArray, 'ImageData’s own array type');
      // At its own pixels from 2 a module; at 1, read at 2× (enlarged above).
      assert.equal(decode(enlarged(code, s === 1 ? 2 : 1)), link, `${s} px a module`);
    }
  });

  test(`${shape}: codePixels keeps a camera’s rules — the quiet zone is the panel, every module’s centre is exactly ink or exactly panel, the eyes read 1:1:3:1:1, every ink pixel 8:1`, () => {
    const m = qrMatrix(link);
    for (const s of SCALES) {
      const { data, side } = codePixels(m, s, QR_COLOURS);
      const q = QUIET * s;
      const px = (x, y) => { const o = (y * side + x) * 4; return [data[o], data[o + 1], data[o + 2], data[o + 3]]; };
      const is = (p, rgb) => p[0] === rgb[0] && p[1] === rgb[1] && p[2] === rgb[2] && p[3] === 255;
      const inkByDiag = Array.from({ length: 2 * side }, (_, k) => inkSpec(INK, m.size, s, k, 0));
      const contrastByDiag = inkByDiag.map((c) => contrast(c, PANEL));
      let quietOff = 0;
      let blended = 0;
      let outOfRange = 0;
      let opaque = 0;
      let worst = Infinity;
      for (let y = 0; y < side; y++) {
        for (let x = 0; x < side; x++) {
          const p = px(x, y);
          if (p[3] === 255) opaque++;
          if (x < q || y < q || x >= side - q || y >= side - q) { if (!is(p, PANEL)) quietOff++; continue; }
          const ink = inkByDiag[x + y];
          if (is(p, ink)) { worst = Math.min(worst, contrastByDiag[x + y]); continue; }
          if (is(p, PANEL)) continue;
          blended++;
          // A rounded edge's pixel is a mix of the two, channel by channel.
          for (let c = 0; c < 3; c++) if (p[c] < Math.min(ink[c], PANEL[c]) || p[c] > Math.max(ink[c], PANEL[c])) outOfRange++;
        }
      }
      assert.equal(opaque, side * side, `${s}: every pixel opaque`);
      assert.equal(quietOff, 0, `${s}: the ${QUIET}-module quiet zone is exactly the panel`);
      assert.equal(outOfRange, 0, `${s}: a blended pixel is only ever panel and ink mixed`);
      if (s < 4) assert.equal(blended, 0, `${s}: under 4 px a module, plain squares — every pixel exactly ink or exactly panel`);
      else assert.ok(blended > 0, `${s}: from 4 px a module, the liquid shapes (rounded corners blend)`);
      assert.ok(worst >= 8, `${s}: every fully inked pixel ${worst.toFixed(2)}:1 on the panel`);
      // Every module's centre pixel is what the matrix says, exactly.
      const c = Math.floor(s / 2);
      let wrong = 0;
      for (let my = 0; my < m.size; my++) {
        for (let mx = 0; mx < m.size; mx++) {
          const x = mx * s + c, y = my * s + c;
          if (!is(px(x, y), m.data[my][mx] ? inkByDiag[x + y] : PANEL)) wrong++;
        }
      }
      assert.equal(wrong, 0, `${s}: every module centre is the matrix's colour`);
      // The finder patterns, through each eye's centre, across and down:
      // separator, then dark 1, light 1, dark 3, light 1, dark 1, separator.
      const cell = (x, y) => { const p = px(x, y); return is(p, PANEL) ? 'L' : is(p, inkByDiag[x + y]) ? 'D' : '~'; };
      const want = `L${s} D${s} L${s} D${3 * s} L${s} D${s} L${s}`;
      for (const [ex, ey] of eyesOf(m.size)) {
        const mid = (ey + 3) * s + c;
        const midX = (ex + 3) * s + c;
        const across = [];
        const down = [];
        for (let k = (ex - 1) * s; k < (ex + 8) * s; k++) across.push(cell(k, mid));
        for (let k = (ey - 1) * s; k < (ey + 8) * s; k++) down.push(cell(midX, k));
        assert.equal(runs(across), want, `${s}: the eye at ${ex},${ey}, across its centre`);
        assert.equal(runs(down), want, `${s}: the eye at ${ex},${ey}, down its centre`);
      }
    }
  });
}

test('codePixels is pure: the same matrix, size and colours give the same bytes; other colours, other bytes', () => {
  const m = qrMatrix(SHAPES.festival);
  const a = codePixels(m, 6, QR_COLOURS);
  const b = codePixels(m, 6, QR_COLOURS);
  assert.deepEqual(a.data, b.data);
  const c = codePixels(m, 6, { ...QR_COLOURS, panel: '#FFFFFF', ink: ['#000000', '#000000', '#000000'] });
  const o = 0; // the top-left pixel: quiet zone
  assert.deepEqual([...c.data.subarray(o, o + 4)], [255, 255, 255, 255], 'the panel it is given');
  const at = ((QUIET * 6 + 3) * c.side + QUIET * 6 + 3) * 4; // inside the top-left eye's ring
  assert.deepEqual([...c.data.subarray(at, at + 4)], [0, 0, 0, 255], 'the ink it is given');
  assert.equal(decode({ data: c.data, width: c.side, height: c.side }), SHAPES.festival);
});

// ---- the layout ----------------------------------------------------------------------
// Pinned rows (the design's own table, 2026-10-03): {s, frame, d, e, panelR, w, origin}.
const PINS = [
  [132, 2, 45, [5, 16, 3, 0, 9, 263, 19]],
  [132, 2, 41, [6, 6, 3, 0, 9, 264, 9]],
  [196, 2, 45, [7, 27, 4, 7, 13, 391, 38]],
  [208, 2, 45, [8, 23, 5, 0, 14, 416, 28]],
  [208, 3, 45, [12, 35, 7, 0, 21, 624, 42]],
  [208, 3, 53, [10, 40, 7, 0, 21, 624, 47]],
  [208, 1, 45, [4, 11, 3, 0, 7, 208, 14]],
  [132, 1.5, 49, [4, 0, 1, 0, 3, 198, 1]], // no frame: the card is the panel
];
test('qrLayout: the pinned rows', () => {
  for (const [room, ratio, size, want] of PINS) {
    const L = qrLayout(size, room, ratio);
    assert.deepEqual([L.s, L.frame, L.d, L.e, L.panelR, L.w, L.origin], want, `${room}@${ratio}, ${size} modules: ${JSON.stringify(L)}`);
    assert.equal(L.h, L.w, 'square today: the code line’s band is reserved, not drawn');
  }
});

// Every tile the sheet has, at every pixel ratio a phone or laptop has, for
// every QR size a crew link can be (41 to 65 modules with the quiet zone).
// The rule's promise: the code never has fewer pixels a module than v111
// drew it with (the old 132px tile, and the old 176px tile the two larger
// ones replace) — the frame is paid for by the larger tiles, never by the code.
const RATIOS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.625, 2.75, 3, 3.5, 4];
const TILES = [[132, 132], [196, 176], [208, 176]];
test('qrLayout over 252 cases: whole device pixels, never past its room, the panel’s corner never bites the quiet zone, and never fewer pixels a module than v111', () => {
  let n = 0;
  const thin = [];
  for (const [tile, was] of TILES) {
    for (const ratio of RATIOS) {
      for (let size = 41; size <= 65; size += 4) {
        n++;
        const L = qrLayout(size, tile, ratio);
        const at = `${tile}@${ratio}, ${size} modules: ${JSON.stringify(L)}`;
        for (const k of ['budget', 'plain', 's', 'frame', 'd', 'e', 'panelR', 'cardR', 'panel', 'w', 'h', 'origin']) assert.ok(Number.isInteger(L[k]), `${k} a whole number — ${at}`);
        assert.equal(L.budget, Math.max(size, Math.floor(tile * ratio + 1e-6)), at);
        assert.ok(L.s >= Math.max(1, Math.floor((was * ratio) / size)), `no fewer pixels a module than v111's ${was}px tile — ${at}`);
        assert.ok(L.s <= L.plain, at);
        assert.ok(L.frame >= 0 && L.e >= 0 && L.d >= 0 && L.e <= 2 * L.s, at);
        assert.ok(L.w <= L.budget, `never wider than its room — ${at}`);
        assert.ok(L.d >= Math.ceil(L.panelR * (1 - Math.SQRT1_2)), `the panel's rounded corner stays outside the quiet zone — ${at}`);
        assert.equal(L.panel, size * L.s + 2 * (L.d + L.e), at);
        assert.equal(L.w, L.panel + 2 * L.frame, at);
        assert.equal(L.h, L.w, at);
        assert.equal(L.origin, L.frame + L.d + L.e, at);
        assert.equal(L.cardR, L.panelR + L.frame, at);
        if (L.frame / ratio < 2) thin.push(tile);
      }
    }
  }
  assert.equal(n, 252);
  assert.deepEqual([...new Set(thin)], [132], 'a frame under 2 CSS px only ever on the smallest tile, where the code keeps every pixel');
});

// …and the rooms the sheet REALLY gives, not only its caps: the tile is
// min(132px, 52vw) up to 640 tall, min(196px, 54vw) up to 759 and
// min(208px, 54vw) from 760 (v3.css), so a phone 320–362 wide and taller than
// 640 gives a room between the caps (172.8 at 320). v111's tile at the same
// screen was min(132px, 52vw) up to 640 and min(176px, 52vw) above. Between
// the caps the code once took a pixel a module less than v111 drew it with
// (the review of v112: 320×693 at 2x drew 6 where v111 drew 7; a Galaxy Fold
// cover, 344×882 at 2.625, 9 where it drew 10).
const roomOn = (w, h) => (h <= 640 ? Math.min(132, 0.52 * w) : h < 760 ? Math.min(196, 0.54 * w) : Math.min(208, 0.54 * w));
const v111RoomOn = (w, h) => (h <= 640 ? Math.min(132, 0.52 * w) : Math.min(176, 0.52 * w));
test('qrLayout on every room a phone 320–430 wide gives, at every ratio and link size: never fewer pixels a module than v111 drew on that same screen', () => {
  const short = [];
  let n = 0;
  for (let w = 320; w <= 430; w++) {
    for (const h of [568, 640, 667, 693, 740, 754, 759, 760, 800, 844, 882, 932]) {
      for (const ratio of RATIOS) {
        for (let size = 41; size <= 65; size += 4) {
          n++;
          const room = roomOn(w, h);
          const L = qrLayout(size, room, ratio);
          const was = Math.max(1, Math.floor((v111RoomOn(w, h) * ratio) / size + 1e-9));
          if (L.s < was) short.push(`${w}×${h}@${ratio}, ${size} modules (room ${room.toFixed(2)}): ${L.s} < ${was}`);
          assert.ok(L.w <= L.budget, `never wider than its room — ${w}×${h}@${ratio}, ${size}`);
        }
      }
    }
  }
  assert.ok(n > 100000);
  assert.deepEqual(short.slice(0, 6), [], `${short.length} rooms draw the code smaller than v111 did`);
});

// ---- what qrPng draws ----------------------------------------------------------------
// A page whose canvas records what is asked of it: every call and every
// property set in order, gradients with their stops, and REAL image data —
// createImageData, putImageData and getImageData over an RGBA backing — so
// what qrPng puts on its canvas is decoded, not just the matrix it started from.
function fakePage({ context = true, imageData = true, tokens = {}, readback = 'drawn', ratio = 2, overlay = true, styles = true, blob = false, fonts = false } = {}) {
  const made = [];
  const asked = [];
  const page = { made, asked, readback, styleCalls: 0, fontLoads: [] };
  const doc = {
    documentElement: { fake: 'root' },
    // A page's FontFaceSet, where asked for: it records what was loaded.
    fonts: fonts ? { load: (f) => { page.fontLoads.push(f); return Promise.resolve([]); } } : undefined,
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = { width: 300, height: 150, rgba: null, log: [], puts: [], reads: [], gradients: [], texts: [], ctxOpts: null, fake: 'canvas' };
      const backing = () => {
        if (!canvas.rgba || canvas.rgba.length !== canvas.width * canvas.height * 4) canvas.rgba = new Uint8ClampedArray(canvas.width * canvas.height * 4);
        return canvas.rgba;
      };
      const state = { fillStyle: '#000000', strokeStyle: '#000000', globalAlpha: 1, globalCompositeOperation: 'source-over', lineWidth: 1, shadowColor: 'rgba(0, 0, 0, 0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, imageSmoothingEnabled: true, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic' };
      const real = {
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData(img, x, y) {
          canvas.log.push(['putImageData', x, y, img.width, img.height]);
          canvas.puts.push({ x, y, width: img.width, height: img.height, data: img.data.slice() });
          const b = backing();
          for (let r = 0; r < img.height; r++) b.set(img.data.subarray(r * img.width * 4, (r + 1) * img.width * 4), ((y + r) * canvas.width + x) * 4);
        },
        getImageData(x, y, w, h) {
          canvas.reads.push([x, y, w, h]);
          if (page.readback === 'refused') throw new Error('SecurityError');
          const b = backing();
          const data = new Uint8ClampedArray(w * h * 4);
          for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) for (let k = 0; k < 4; k++) data[(r * w + c) * 4 + k] = page.readback === 'blank' ? 255 : b[((y + r) * canvas.width + x + c) * 4 + k];
          return { data, width: w, height: h };
        },
      };
      const plain = (v) => (v && typeof v === 'object' ? (v.fake || 'object') : v);
      const ctx = new Proxy(state, {
        get(t, k) {
          if (typeof k === 'symbol') return undefined;
          if (k in real) return imageData ? real[k] : undefined;
          if (k in t) return t[k];
          // Text as wide as half its size a character, in the font it is set in.
          if (k === 'measureText') return (text) => ({ width: String(text).length * 0.5 * Number((/(\d+(?:\.\d+)?)px/.exec(t.font) || [0, 10])[1]) });
          if (k === 'fillText') return (text, x, y) => { canvas.log.push(['fillText', String(text), x, y]); canvas.texts.push({ text: String(text), x, y, font: t.font, fillStyle: t.fillStyle, globalAlpha: t.globalAlpha, textAlign: t.textAlign }); };
          if (k === 'createRadialGradient' || k === 'createLinearGradient') {
            return (...a) => {
              const g = { fake: 'gradient', stops: [], addColorStop(o, col) { g.stops.push([o, col]); } };
              canvas.log.push([k, ...a]);
              canvas.gradients.push(g);
              return g;
            };
          }
          return (...a) => { canvas.log.push([k, ...a.map(plain)]); };
        },
        set(t, k, v) {
          canvas.log.push(['set', k, plain(v)]);
          if (k === 'globalCompositeOperation' && v === 'overlay' && !overlay) return true; // an engine that does not keep it
          t[k] = v;
          return true;
        },
      });
      canvas.getContext = (kind, opts) => {
        assert.equal(kind, '2d');
        canvas.ctxOpts = opts;
        return context ? ctx : null;
      };
      canvas.toDataURL = (type) => { canvas.encoded = [canvas.width, canvas.height]; return `data:${type};fake${made.indexOf(canvas)}`; };
      // An engine that encodes off the main thread hands back a Blob.
      if (blob) canvas.toBlob = (done, type) => { canvas.encoded = [canvas.width, canvas.height]; setTimeout(() => done(new Blob([`fake${made.indexOf(canvas)}`], { type })), 0); };
      made.push(canvas);
      return canvas;
    },
  };
  const win = {
    devicePixelRatio: ratio,
    getComputedStyle(el) {
      page.styleCalls++;
      assert.equal(el, doc.documentElement, 'the tokens are read off :root');
      if (!styles) throw new Error('no styles here');
      return { getPropertyValue: (name) => { asked.push(name); return tokens[name] === undefined ? '' : tokens[name]; } };
    },
  };
  page.doc = doc;
  page.win = win;
  return page;
}
function withPage(page, fn) {
  const saved = { document: globalThis.document, window: globalThis.window };
  globalThis.document = page.doc;
  globalThis.window = page.win;
  try { return fn(); } finally { globalThis.document = saved.document; globalThis.window = saved.window; }
}
// The tokens as a browser hands them back: the file's own words.
const PAGE_TOKENS = Object.fromEntries(Object.entries(rootTokens()).filter(([k]) => /^--(aura|qr)-/.test(k)).map(([k, v]) => [k, ` ${v}`]));
// What a card's canvas held when it was encoded (qrPng lets the canvas go
// after, so its width reads 0 by now): a square of it, or all of it.
const crop = (canvas, x0, y0, side) => {
  const [w] = canvas.encoded;
  const out = new Uint8ClampedArray(side * side * 4);
  for (let r = 0; r < side; r++) out.set(canvas.rgba.subarray(((y0 + r) * w + x0) * 4, ((y0 + r) * w + x0 + side) * 4), r * side * 4);
  return { data: out, width: side, height: side };
};
const whole = (canvas) => ({ data: canvas.rgba, width: canvas.encoded[0], height: canvas.encoded[1] });

for (const [ratio, room, shape] of [[2, 208, 'the longest show list, as a list'], [2, 132, 'festival'], [2.625, 196, 'festival'], [3, 208, 'bare'], [1, 208, 'festival']]) {
  test(`qrPng at ${ratio}x in a ${room}px room (${shape}): the card is the layout’s, whole pixels, shown at its own pixels — and the code it puts down is codePixels’ bytes, once, at the origin, and decodes to the link`, () => {
    const link = SHAPES[shape];
    const page = fakePage({ ratio, tokens: PAGE_TOKENS });
    const out = withPage(page, () => qrPng(link, room));
    const m = qrMatrix(link);
    const L = qrLayout(m.size, room, ratio);
    const [canvas] = page.made;
    assert.equal(out.src, 'data:image/png;fake0', 'a PNG data URL of the card’s canvas');
    assert.deepEqual(canvas.encoded, [L.w, L.h], 'the canvas is the card: qrLayout’s w × h');
    assert.equal(out.px, L.w, 'px is the bitmap’s width');
    assert.equal(out.h, out.px, 'square today (h === w): the code line’s band is reserved, not drawn');
    assert.ok(Math.abs(out.cssPx - L.w / ratio) < 1e-9 && Math.abs(out.cssH - L.h / ratio) < 1e-9, `shown at its own pixels: ${out.cssPx} CSS px is ${L.w} device px`);
    assert.ok(out.cssPx <= room, 'never wider than the room it was given');
    assert.deepEqual(canvas.ctxOpts, { willReadFrequently: true }, 'a canvas made to be read back');
    // The code: one putImageData of exactly codePixels' bytes at the origin.
    assert.equal(canvas.puts.length, 1, 'the code goes down whole, once');
    const put = canvas.puts[0];
    assert.deepEqual([put.x, put.y], [L.origin, L.origin], 'at the layout’s origin');
    const code = codePixels(m, L.s, QR_COLOURS);
    assert.equal(put.width, code.side);
    assert.ok(Buffer.from(put.data).equals(Buffer.from(code.data)), 'byte for byte what codePixels paints');
    assert.equal(put.width / m.size, L.s, 'whole device pixels a module');
    // Read back off the canvas: the code square alone, and the whole card
    // (around the code, nothing in this fake but the dark of an empty canvas).
    assert.equal(decode(crop(canvas, L.origin, L.origin, code.side)), link, 'the code square on the canvas scans to the link');
    assert.equal(decode(whole(canvas)), link, 'and so does the whole card');
    // readsBack looks at the centre of the top-left eye's solid core.
    const c = L.origin + Math.floor((QUIET + 3.5) * L.s);
    assert.deepEqual(canvas.reads, [[c, c, 1, 1]], 'one pixel read back: the eye’s core');
    assert.deepEqual([canvas.width, canvas.height], [0, 0], 'and the canvas let go once encoded, so a phone frees it at once');
  });
}

test('qrPng draws the aura card the design asks for: the aura in the frame only, three blobs that fade to their own hue, grain, a hairline, the panel seated by a shadow', () => {
  const page = fakePage({ ratio: 2, tokens: PAGE_TOKENS });
  withPage(page, () => qrPng(SHAPES.festival, 208));
  const [canvas] = page.made;
  const L = qrLayout(qrMatrix(SHAPES.festival).size, 208, 2);
  const log = canvas.log;
  const idx = (pred, from = 0) => { for (let i = from; i < log.length; i++) if (pred(log[i])) return i; return -1; };
  const clip = idx((e) => e[0] === 'clip');
  assert.ok(clip > 0 && log[clip][1] === 'evenodd', 'the aura is clipped to the frame’s ring (even-odd: the card minus the panel)');
  const base = idx((e) => e[0] === 'set' && e[1] === 'fillStyle' && e[2] === '#12101E');
  assert.ok(base > clip, 'the aura’s base, inside the clip');
  assert.deepEqual(log[base + 1], ['fillRect', 0, 0, L.w, L.h], 'the whole card');
  // Three blobs, bottom-up: blue, magenta, orange (the hero lists orange first, on top).
  assert.deepEqual(canvas.gradients.map((g) => g.stops), [
    [[0, 'hsla(221, 90%, 58%, 1)'], [0.55, 'hsla(221, 90%, 58%, 0.55)'], [1, 'hsla(221, 90%, 58%, 0)']],
    [[0, 'hsla(305, 85%, 65%, 0.95)'], [0.55, 'hsla(305, 85%, 65%, 0.5)'], [1, 'hsla(305, 85%, 65%, 0)']],
    [[0, 'hsla(28, 100%, 60%, 1)'], [0.55, 'hsla(28, 100%, 60%, 0.55)'], [1, 'hsla(28, 100%, 60%, 0)']],
  ], 'each fades to its own hue at nothing, never to transparent (which is black, and would grey the rim)');
  // Grain: overlaid, at .28, the seeded noise scaled over the card.
  const over = idx((e) => e[0] === 'set' && e[1] === 'globalCompositeOperation' && e[2] === 'overlay');
  assert.ok(over > base, 'the grain overlays the aura');
  const grain = idx((e) => e[0] === 'drawImage', over);
  assert.deepEqual(log[grain], ['drawImage', 'canvas', 0, 0, L.w, L.h]);
  assert.ok(log.slice(over, grain).some((e) => e[1] === 'globalAlpha' && e[2] === 0.28));
  // The hairline, then the clip is let go.
  const rim = idx((e) => e[0] === 'set' && e[1] === 'strokeStyle');
  assert.equal(log[rim][2], 'rgba(255, 255, 255, .16)');
  assert.ok(idx((e) => e[0] === 'stroke', rim) > rim);
  const restore = idx((e) => e[0] === 'restore', rim);
  // The panel: seated by a shadow (--qr-seat), then filled again without it.
  const seat = idx((e) => e[0] === 'set' && e[1] === 'shadowColor' && e[2] === 'rgba(6, 4, 14, .55)', restore);
  assert.ok(seat > restore, 'the seat’s shadow falls outside the clip');
  const fills = log.map((e, i) => [e, i]).filter(([e, i]) => i > seat && e[0] === 'fill').map(([, i]) => i);
  assert.ok(fills.length >= 2, 'the panel twice: with its shadow, then without');
  assert.ok(log.slice(seat).some((e) => e[0] === 'set' && e[1] === 'fillStyle' && e[2] === '#FFFCF8'), 'in --qr-panel');
  assert.ok(idx((e) => e[0] === 'putImageData') > fills[fills.length - 1], 'and the code on top of it all');
});

test('qrPng with no room for a frame (a 49-module link in 132px at 1.5x): the card is the panel — no aura, the code keeps every pixel', () => {
  const link = SHAPES.show;
  assert.equal(qrMatrix(link).size, 49);
  const L = qrLayout(49, 132, 1.5);
  assert.equal(L.frame, 0);
  const page = fakePage({ ratio: 1.5, tokens: PAGE_TOKENS });
  const out = withPage(page, () => qrPng(link, 132));
  const [canvas] = page.made;
  assert.equal(out.px, L.w);
  assert.equal(canvas.gradients.length, 0, 'no aura');
  assert.equal(canvas.log.filter((e) => e[0] === 'clip').length, 0);
  assert.ok(canvas.log.some((e) => e[0] === 'set' && e[1] === 'fillStyle' && e[2] === '#FFFCF8'), 'the panel');
  assert.deepEqual([canvas.puts[0].x, canvas.puts[0].y], [L.origin, L.origin]);
  assert.equal(decode(crop(canvas, L.origin, L.origin, 49 * L.s)), link);
});

test('qrPng where the engine will not keep an overlay composite: no grain, the rest as drawn', () => {
  const page = fakePage({ ratio: 2, tokens: PAGE_TOKENS, overlay: false });
  withPage(page, () => qrPng(SHAPES.festival, 196));
  const [canvas] = page.made;
  assert.equal(canvas.log.filter((e) => e[0] === 'drawImage').length, 0, 'no grain drawn in a mode the engine refused');
  assert.equal(canvas.gradients.length, 3, 'the aura all the same');
  assert.equal(canvas.puts.length, 1);
});

test('qrPng: everything but the modules is independent of the link — the same calls, the same grain, for two links of one size', () => {
  const a = crew.crewLink(TOKEN, 'acl-2026');
  const b = crew.crewLink('qrtesttoken_zyxwvutsrqponml', 'acl-2026');
  assert.notEqual(a, b);
  assert.equal(qrMatrix(a).size, qrMatrix(b).size);
  // A fresh grain for `a` (a size no test above drew), then one for `b` at
  // another framed size, then `b` back at the first: the grain made for it
  // then is the very noise made for `a`.
  const pa = fakePage({ ratio: 1.75, tokens: PAGE_TOKENS });
  withPage(pa, () => qrPng(a, 200));
  withPage(fakePage({ ratio: 1.75, tokens: PAGE_TOKENS }), () => qrPng(b, 204));
  const pb = fakePage({ ratio: 1.75, tokens: PAGE_TOKENS });
  withPage(pb, () => qrPng(b, 200));
  assert.equal(pa.made.length, 2, 'the card and its grain');
  assert.equal(pb.made.length, 2);
  assert.ok(Buffer.from(pa.made[1].rgba).equals(Buffer.from(pb.made[1].rgba)), 'the grain is seeded by a constant, never by the link');
  assert.deepEqual(pa.made[0].log, pb.made[0].log, 'every call and every colour the same; only the module bytes differ');
  assert.ok(!Buffer.from(pa.made[0].puts[0].data).equals(Buffer.from(pb.made[0].puts[0].data)), 'and those do');
});

test('qrPng reads its colours from the tokens — the allowlist only, once a draw, never --fest — and falls back per token to QR_COLOURS', () => {
  const ALLOWED = ['--aura-base', '--aura-orange', '--aura-magenta', '--aura-blue', '--qr-panel', '--qr-ink-1', '--qr-ink-2', '--qr-ink-3', '--qr-rim', '--qr-seat'];
  // The tokens as the page has them.
  const page = fakePage({ ratio: 2, tokens: PAGE_TOKENS });
  withPage(page, () => qrPng(SHAPES.bare, 196));
  assert.equal(page.styleCalls, 1, 'one getComputedStyle a draw');
  assert.deepEqual([...new Set(page.asked)].sort(), [...ALLOWED].sort(), 'exactly the allowlist: never --fest, never --page or --text-primary');
  // Others a page might have (a theme): taken, where they are well formed.
  const L = qrLayout(qrMatrix(SHAPES.bare).size, 196, 2);
  const themed = fakePage({ ratio: 2, tokens: { ...PAGE_TOKENS, '--qr-panel': '#FFFFFF', '--qr-ink-1': '#000000', '--aura-base': '#000000', '--aura-orange': '10, 50%, 50%', '--qr-rim': 'rgba(1, 2, 3, 0.5)' } });
  withPage(themed, () => qrPng(SHAPES.bare, 196));
  const t = themed.made[0];
  const want = codePixels(qrMatrix(SHAPES.bare), L.s, { ...QR_COLOURS, panel: '#FFFFFF', ink: ['#000000', QR_COLOURS.ink[1], QR_COLOURS.ink[2]] });
  assert.ok(Buffer.from(t.puts[0].data).equals(Buffer.from(want.data)), 'the panel and ink the tokens give');
  assert.ok(t.log.some((e) => e[1] === 'fillStyle' && e[2] === '#000000'), 'the base the tokens give');
  assert.ok(t.log.some((e) => e[1] === 'strokeStyle' && e[2] === 'rgba(1, 2, 3, 0.5)'));
  assert.equal(t.gradients[2].stops[0][1], 'hsla(10, 50%, 50%, 1)');
  // Garbage, one token at a time: each falls back on its own.
  const junk = fakePage({ ratio: 2, tokens: { ...PAGE_TOKENS, '--aura-base': 'red', '--qr-panel': '#FFF', '--qr-ink-2': 'var(--x)', '--aura-blue': '221 90% 58%', '--qr-rim': 'rgba(255,255,255)', '--qr-seat': 'url(x)', '--aura-magenta': '305, 85%, 65%); background: red' } });
  withPage(junk, () => qrPng(SHAPES.bare, 196));
  const j = junk.made[0];
  assert.ok(Buffer.from(j.puts[0].data).equals(Buffer.from(codePixels(qrMatrix(SHAPES.bare), L.s, QR_COLOURS).data)), 'the fallback panel and ink');
  assert.ok(j.log.some((e) => e[1] === 'fillStyle' && e[2] === '#12101E'));
  assert.ok(j.log.some((e) => e[1] === 'strokeStyle' && e[2] === 'rgba(255, 255, 255, .16)'));
  assert.ok(j.log.some((e) => e[1] === 'shadowColor' && e[2] === 'rgba(6, 4, 14, .55)'));
  assert.equal(j.gradients[0].stops[0][1], 'hsla(221, 90%, 58%, 1)');
  assert.equal(j.gradients[1].stops[0][1], 'hsla(305, 85%, 65%, 0.95)');
  // Unreadable styles, and no pixel ratio: QR_COLOURS at 1x.
  const none = fakePage({ ratio: null, styles: false }); // a page with no pixel ratio
  const out = withPage(none, () => qrPng(SHAPES.bare, 196));
  const n = none.made[0];
  const L1 = qrLayout(qrMatrix(SHAPES.bare).size, 196, 1);
  assert.equal(out.px, L1.w, 'at 1x');
  assert.equal(out.cssPx, L1.w, 'shown at its pixels');
  assert.ok(Buffer.from(n.puts[0].data).equals(Buffer.from(codePixels(qrMatrix(SHAPES.bare), L1.s, QR_COLOURS).data)));
  assert.equal(decode(crop(n, L1.origin, L1.origin, n.puts[0].width)), SHAPES.bare);
});

test('qrPng checks what the canvas reads back: one that hands back white (readback blocked) throws, so the sheet never shows a blank code; one that refuses to read is shown as drawn', () => {
  const blank = fakePage({ readback: 'blank', tokens: PAGE_TOKENS });
  assert.throws(() => withPage(blank, () => qrPng(SHAPES.festival, 208)), (e) => {
    assert.match(String(e && e.message), /reads back blank/);
    assert.doesNotMatch(String(e && e.message), new RegExp(TOKEN), 'the error never carries the link');
    return true;
  });
  const refused = fakePage({ readback: 'refused', tokens: PAGE_TOKENS });
  const out = withPage(refused, () => qrPng(SHAPES.festival, 208));
  assert.equal(out.src, 'data:image/png;fake0');
  assert.equal(refused.made[0].reads.length, 1, 'it asked');
});

test('qrPng throws where there is no 2D canvas, or no image data (jsdom, a locked-down browser) — the sheet then takes the QR away', () => {
  const noCanvas = fakePage({ context: false });
  assert.throws(() => withPage(noCanvas, () => qrPng(SHAPES.festival, 208)), (e) => {
    assert.equal(e.message, 'qr: no 2d canvas');
    return true;
  });
  const noData = fakePage({ imageData: false });
  assert.throws(() => withPage(noData, () => qrPng(SHAPES.festival, 208)), (e) => {
    assert.equal(e.message, 'qr: no image data');
    assert.doesNotMatch(String(e && e.message), new RegExp(TOKEN), 'the error never carries the link');
    return true;
  });
  // An engine whose createImageData hands back something that is not image
  // data: the same named failure, never a TypeError from inside the draw.
  const odd = fakePage();
  withPage(odd, () => {
    const make = document.createElement.bind(document);
    document.createElement = (tag) => {
      const c = make(tag);
      const get = c.getContext;
      c.getContext = (...a) => { const ctx = get(...a); return new Proxy(ctx, { get: (t, k) => (k === 'createImageData' ? () => ({}) : t[k]) }); };
      return c;
    };
    assert.throws(() => qrPng(SHAPES.festival, 208), { message: 'qr: no image data' });
  });
});

test('qrPng keeps its last card in memory, so the sheet opened again is instant — the same page, link, room, ratio and colours; anything else draws anew, and a failure is never kept', () => {
  const page = fakePage({ ratio: 3, tokens: PAGE_TOKENS });
  const first = withPage(page, () => qrPng(SHAPES.view, 197));
  const again = withPage(page, () => qrPng(SHAPES.view, 197));
  assert.deepEqual(again, first, 'the same card');
  assert.equal(page.made.filter((c) => c.encoded).length, 1, 'drawn once');
  withPage(page, () => qrPng(SHAPES.view, 196));
  assert.equal(page.made.filter((c) => c.encoded).length, 2, 'another room, another card');
  // A different page (a test's document; on a phone, never) draws its own.
  const other = fakePage({ ratio: 3, tokens: PAGE_TOKENS });
  withPage(other, () => qrPng(SHAPES.view, 196));
  assert.equal(other.made.filter((c) => c.encoded).length, 1);
  // A failure is not kept: blank, then drawn on the same page.
  const flaky = fakePage({ ratio: 3, tokens: PAGE_TOKENS, readback: 'blank' });
  assert.throws(() => withPage(flaky, () => qrPng(SHAPES.view, 150)), /reads back blank/);
  flaky.readback = 'drawn';
  assert.match(withPage(flaky, () => qrPng(SHAPES.view, 150)).src, /^data:image\/png;fake\d$/);
  // Nothing about it leaves memory (the import test above holds the source to that).
});

// ---- the code line's slot (slice 3: reserved, never drawn yet) ------------------------
// A crew's words under the panel are slice 3 (the codes do not exist yet).
// The slot is in the drawing now: `band` CSS px grows the card downward, and
// it may never cost the code anything — not a module pixel, not its place.
test('the code line’s band is reserved: off by default, and when asked for it grows the card downward with the code exactly where it was', () => {
  const link = SHAPES.festival;
  const plain = fakePage({ ratio: 2, tokens: PAGE_TOKENS });
  const p = withPage(plain, () => qrPng(link, 208));
  assert.equal(p.h, p.px, 'no band unless asked');
  const banded = fakePage({ ratio: 2, tokens: PAGE_TOKENS });
  const b = withPage(banded, () => qrPng(link, 208, { band: 30 }));
  assert.equal(b.px, p.px, 'as wide');
  assert.equal(b.h, p.px + 60, '30 CSS px taller at 2x');
  assert.equal(b.cssH, b.h / 2);
  const [pc] = plain.made;
  const [bc] = banded.made;
  assert.deepEqual([bc.puts[0].x, bc.puts[0].y, bc.puts[0].width], [pc.puts[0].x, pc.puts[0].y, pc.puts[0].width], 'the code where it was, at the size it was');
  assert.ok(Buffer.from(bc.puts[0].data).equals(Buffer.from(pc.puts[0].data)), 'the same pixels');
  assert.deepEqual(bc.log.find((e) => e[0] === 'fillRect'), ['fillRect', 0, 0, b.px, b.h], 'the aura fills the taller card');
  assert.equal(bc.log.filter((e) => e[0] === 'fillText' || e[0] === 'strokeText').length, 0, 'and nothing written in it: codes do not exist yet');
});

// ---- the saved card (what a long-press Save or a right-click keeps) ---------------------
// Kevin (2026-10-03): "When we add our code we and bake that url / code into
// the downloadable image and make it sexy please." The codes are slice 3 and
// do not exist yet, so their line stays reserved and nothing of the link is
// ever written into the image. What is in scope now: the card a person keeps
// is drawn for keeping — one export size whatever the screen (the sheet's own
// card is the size of its tile: 263px from a 320 phone), whole pixels a
// module, the quiet zone kept, read back like the sheet's — and it says whose
// it is: the crew's name and the fest's short name, in the app's own type.
const WORDS = { crew: 'Menu Crew', fest: 'ACL', year: "'26" };
const saveCard = (page, text, words = WORDS) => {
  const saved = { document: globalThis.document, window: globalThis.window };
  globalThis.document = page.doc;
  globalThis.window = page.win;
  // Restored once it has settled: the card is drawn after the fonts load.
  return Promise.resolve().then(() => qrSaveCard(text, words)).finally(() => { globalThis.document = saved.document; globalThis.window = saved.window; });
};

test('the saved card is one size on every screen: the export layout, whole pixels a module, the code at its origin decoding to the link, read back at the eye', async () => {
  const sizes = new Set();
  for (const ratio of [1, 2, 2.625, 3]) {
    for (const shape of ['festival', 'the longest show list, as a list']) {
      const link = SHAPES[shape];
      const page = fakePage({ ratio, tokens: PAGE_TOKENS });
      const out = await saveCard(page, link);
      const m = qrMatrix(link);
      const L = qrLayout(m.size, SAVE_CARD.room, SAVE_CARD.ratio);
      const card = page.made.find((c) => c.encoded);
      const at = `${ratio}x, ${shape}: ${JSON.stringify(out)}`;
      assert.ok(card, `a card was encoded — ${at}`);
      assert.equal(out.px, L.w, `as wide as the export layout, whatever this screen's ratio — ${at}`);
      assert.equal(out.h, L.h + Math.round(SAVE_CARD.band * SAVE_CARD.ratio), `and the band under it — ${at}`);
      assert.deepEqual(card.encoded, [out.px, out.h], at);
      sizes.add(`${out.px}x${out.h}`);
      assert.ok(out.px >= 1000, `big enough to keep: ${out.px}px wide`);
      assert.equal(card.puts.length, 1, 'the code goes down whole, once');
      const put = card.puts[0];
      assert.deepEqual([put.x, put.y], [L.origin, L.origin], 'at the layout’s origin');
      assert.ok(Buffer.from(put.data).equals(Buffer.from(codePixels(m, L.s, QR_COLOURS).data)), 'byte for byte what codePixels paints');
      assert.ok(Number.isInteger(put.width / m.size) && put.width / m.size === L.s, 'whole pixels a module');
      // The quiet zone: four modules of the panel all round, never written over.
      assert.equal(decode(crop(card, L.origin, L.origin, put.width)), link, 'the code square scans to the link');
      const c = L.origin + Math.floor((QUIET + 3.5) * L.s);
      assert.deepEqual(card.reads, [[c, c, 1, 1]], 'read back at the eye’s core, as the sheet’s card is');
      assert.ok(card.texts.every((t) => t.y > L.h && t.y < out.h), `its words in the band under the square card, never over the code — ${JSON.stringify(card.texts)}`);
      assert.deepEqual([card.width, card.height], [0, 0], 'the canvas let go once encoded');
    }
  }
  assert.equal(sizes.size, 2, `one size for each link shape, whatever the screen: ${[...sizes]}`);
});

test('the saved card says whose it is — the crew’s name and the fest’s short name, in the app’s own type — and never a word of the link', async () => {
  const link = SHAPES['the longest show list, as a list'];
  const page = fakePage({ ratio: 3, tokens: PAGE_TOKENS, fonts: true });
  await saveCard(page, link);
  const card = page.made.find((c) => c.encoded);
  const texts = card.texts.map((t) => t.text);
  assert.deepEqual(texts, ['MENU CREW', 'ACL', "'26"], 'the crew, then the fest and its year, as the header writes them');
  for (const t of card.texts) {
    assert.match(t.font, /\bAnton\b/, `${t.text}: the app’s display type (--font-display)`);
    assert.equal(t.fillStyle, '#ffffff', `${t.text}: white, as the hero’s label — never the fest accent`);
  }
  const crewLine = card.texts[0];
  const festLine = card.texts[1];
  assert.ok(Number(/(\d+)px/.exec(crewLine.font)[1]) > Number(/(\d+)px/.exec(festLine.font)[1]), 'the crew’s name leads');
  const year = card.texts[2];
  assert.ok(year.globalAlpha < 1 && Number(/(\d+)px/.exec(year.font)[1]) < Number(/(\d+)px/.exec(festLine.font)[1]), 'the year a step back, as .yr is');
  // Nothing of the link in the image: no URL, no token, no part of the hash.
  const all = card.log.filter((e) => e[0] === 'fillText' || e[0] === 'strokeText').map((e) => e[1]).join(' ');
  for (const bit of [TOKEN, 'g=', 'http', 'fest.kevinhg.com', '#', 'show=', 'view=']) assert.equal(all.includes(bit), false, `never "${bit}" in its words: ${all}`);
  // The type is loaded before it is drawn (a canvas draws a missing face in a fallback).
  assert.ok(page.fontLoads.some((f) => /Anton/.test(f)), `the display face asked for first: ${JSON.stringify(page.fontLoads)}`);
});

test('a long crew name fits the card: it gives way in size first, then ends in an ellipsis — never past the frame', async () => {
  for (const crewName of ['A crew whose name runs right across the card and on', 'Wilhelmina Featherstonhaugh’s Birthday Weekend Crew', 'The Extremely Long Crew Name For Testing']) {
    const page = fakePage({ ratio: 2, tokens: PAGE_TOKENS });
    const out = await saveCard(page, SHAPES.festival, { ...WORDS, crew: crewName });
    const card = page.made.find((c) => c.encoded);
    const line = card.texts[0];
    const px = Number(/(\d+(?:\.\d+)?)px/.exec(line.font)[1]);
    const L = qrLayout(qrMatrix(SHAPES.festival).size, SAVE_CARD.room, SAVE_CARD.ratio);
    assert.ok(line.text.length * 0.5 * px <= out.px - 2 * (L.frame + L.d + L.e) + 0.5, `inside the card's margins: "${line.text}" at ${px}px in ${out.px}`);
    assert.ok(line.text === crewName.toUpperCase() || line.text.endsWith('…'), `whole, or ending in an ellipsis: ${line.text}`);
    // Cut at a word, never through one (the review of the v115 head: "…NAME
    // FOR T…" read as a typo): what stands before the ellipsis is the name's
    // own first words, whole.
    if (line.text.endsWith('…')) {
      const kept = line.text.slice(0, -1);
      const name = crewName.toUpperCase();
      assert.ok(name.startsWith(kept) && /\s/.test(name[kept.length] || ' '), `cut at a word: "${line.text}" from "${name}"`);
    }
  }
});

// Two cards asked for at once (the review of the v115 head): a sheet's idle
// draw still encoding when a reopened sheet, or another crew's, asks. The
// same card asked twice is drawn once; and the card finished late never lets
// go of (revokes) the one the sheet holds now — only the last asked replaces
// the card kept.
test('two cards drawn at once: the same card asked twice is one draw, and the one finished late never revokes the card the sheet holds now', async () => {
  const page = fakePage({ ratio: 2, tokens: PAGE_TOKENS, blob: true });
  const make = page.doc.createElement.bind(page.doc);
  let n = 0;
  page.doc.createElement = (tag) => {
    const c = make(tag);
    if (n++ === 0) { const tb = c.toBlob; c.toBlob = (done, type) => setTimeout(() => tb(done, type), 40); } // the first one encodes slowly (a busy phone)
    return c;
  };
  const revoked = [];
  const realRevoke = URL.revokeObjectURL;
  URL.revokeObjectURL = (u) => { revoked.push(u); };
  const saved = { document: globalThis.document, window: globalThis.window };
  globalThis.document = page.doc;
  globalThis.window = page.win;
  try {
    const first = qrSaveCard(SHAPES.festival, { ...WORDS, crew: 'First Crew' });
    const again = qrSaveCard(SHAPES.festival, { ...WORDS, crew: 'First Crew' });
    const second = qrSaveCard(SHAPES.festival, { ...WORDS, crew: 'Second Crew' });
    const [a, a2, b] = await Promise.all([first, again, second]);
    assert.equal(a2.src, a.src, 'the same card asked twice is one draw');
    assert.equal(page.made.filter((c) => c.encoded).length, 2, 'two cards drawn, not three');
    assert.equal(revoked.includes(b.src), false, `the card asked last is never let go by the one finished late: ${JSON.stringify(revoked)}`);
    const later = await qrSaveCard(SHAPES.festival, { ...WORDS, crew: 'Second Crew' });
    assert.equal(later.src, b.src, 'and it is the card kept');
  } finally {
    URL.revokeObjectURL = realRevoke;
    globalThis.document = saved.document;
    globalThis.window = saved.window;
  }
});

test('the saved card encodes off the main thread where the engine can (a Blob, an object URL), and fails like the sheet’s card: blank read-back or no canvas reject, naming no link', async () => {
  const page = fakePage({ ratio: 2, tokens: PAGE_TOKENS, blob: true });
  const out = await saveCard(page, SHAPES.festival);
  assert.match(out.src, /^blob:/, `an object URL: ${out.src}`);
  const blank = fakePage({ ratio: 2, tokens: PAGE_TOKENS, readback: 'blank' });
  await assert.rejects(saveCard(blank, SHAPES.view), (e) => {
    assert.match(String(e && e.message), /reads back blank/);
    assert.doesNotMatch(String(e && e.message), new RegExp(TOKEN));
    return true;
  });
  await assert.rejects(saveCard(fakePage({ context: false }), SHAPES.bare), { message: 'qr: no 2d canvas' });
});
