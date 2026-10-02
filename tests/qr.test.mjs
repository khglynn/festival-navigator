// The invite QR (find your crew, slice 1 — claude-plans/2026-10-02-find-your-crew.md).
// The Invite sheet draws the crew link as a QR on the phone itself, so a
// friend standing next to you points a camera and is in. Three things are
// held here, in Node (jsdom has no canvas; the drawn pixels are the browser
// contract's, tests/browser/people-menu.test.mjs):
//
//   - the encoder is uqr 0.1.3, vendored byte-for-byte under a licence
//     header: the body's sha256 is pinned, so an edit to the vendored file
//     (or a different copy) is a red build, not a silent change;
//   - every link shape the app builds (crew.js crewLink) round-trips: the
//     matrix, rendered to pixels, decodes back to EXACTLY the text — and so
//     does what qrPng draws, through a canvas that paints into an RGBA buffer;
//   - qrPng is honest about what it cannot do (no 2D canvas: it throws, and
//     the sheet takes the QR away), and it never logs or reports its text —
//     the text is a crew token, which IS the crew's data.
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
const { qrMatrix, qrPng } = await import('../js/v3/qr.js');

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
  assert.doesNotMatch(code, /console\.|\brecord\(|\btrack\(|errlog|localStorage|fetch\(/, 'the text is a crew link: it goes nowhere but the canvas');
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
    // ECC M, a 2-module border: version v is 17 + 4v modules, plus 4.
    assert.equal((m.size - 4 - 17) % 4, 0, `a QR size with its 2-module border: ${m.size}`);
    assert.equal(decode(rgbaOf(m)), link);
    // Small enough to scan off a phone at the sheet's 160 CSS px: version 10
    // (61 modules with the border) still gives every module 2.6 px.
    assert.ok(m.size <= 61, `${m.size} modules — the link grew past what the tile can show crisply`);
  });
}

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
  assert.equal(decode(smudged(encode(link, { ecc: 'L', border: 2 }))), null, 'the smudge is real damage');
  assert.equal(decode(smudged(qrMatrix(link))), link);
});

// ---- what qrPng draws --------------------------------------------------------------
// A canvas that paints fillRect into an RGBA buffer, so what qrPng DRAWS is
// decoded, not just the matrix it started from.
function fakeCanvasDoc({ context = true, tokens = {} } = {}) {
  const made = [];
  const doc = {
    documentElement: {},
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = {
        width: 0, height: 0, rgba: null, fills: [],
        getContext(kind) {
          assert.equal(kind, '2d');
          if (!context) return null;
          const c = this;
          return {
            fillStyle: '#000000',
            fillRect(x, y, w, h) {
              if (!c.rgba) c.rgba = new Uint8ClampedArray(c.width * c.height * 4);
              const hex = String(this.fillStyle).replace('#', '');
              const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
              c.fills.push({ x, y, w, h, style: String(this.fillStyle) });
              for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
                const i = (yy * c.width + xx) * 4;
                c.rgba[i] = rgb[0]; c.rgba[i + 1] = rgb[1]; c.rgba[i + 2] = rgb[2]; c.rgba[i + 3] = 255;
              }
            },
          };
        },
        toDataURL(type) { return `data:${type};fake`; },
      };
      made.push(canvas);
      return canvas;
    },
  };
  const win = {
    devicePixelRatio: 2,
    getComputedStyle: () => ({ getPropertyValue: (name) => tokens[name] || '' }),
  };
  return { doc, win, made };
}
function withPage(page, fn) {
  const saved = { document: globalThis.document, window: globalThis.window };
  globalThis.document = page.doc;
  globalThis.window = page.win;
  try { return fn(); } finally { globalThis.document = saved.document; globalThis.window = saved.window; }
}

test('qrPng draws the link with whole-pixel modules at the screen’s pixel ratio, and what it draws decodes to the link', () => {
  const link = SHAPES['the longest show list, as a list'];
  const page = fakeCanvasDoc({ tokens: { '--page': ' #0C0A14', '--text-primary': ' #FFFFFF' } });
  const url = withPage(page, () => qrPng(link, 160));
  assert.equal(url, 'data:image/png;fake', 'a PNG data URL');
  const [canvas] = page.made;
  const { size } = qrMatrix(link);
  const scale = canvas.width / size;
  assert.ok(Number.isInteger(scale) && scale >= 1, `whole pixels per module (${canvas.width} / ${size})`);
  assert.equal(scale, Math.floor((160 * 2) / size), 'as many as fit 160 CSS px at 2x');
  assert.equal(canvas.height, canvas.width, 'square');
  assert.equal(decode({ data: canvas.rgba, width: canvas.width, height: canvas.height }), link);
  // Dark on light, from the tokens: the page's own near-black on white.
  assert.deepEqual([...new Set(canvas.fills.map((f) => f.style.toUpperCase()))].sort(), ['#0C0A14', '#FFFFFF']);
  assert.equal(canvas.fills[0].style.toUpperCase(), '#FFFFFF', 'light first, the whole square');
  assert.deepEqual([canvas.fills[0].w, canvas.fills[0].h], [canvas.width, canvas.height]);
});

test('qrPng falls back to the literal colours when the tokens cannot be read, and stays at 1x without a pixel ratio', () => {
  const link = SHAPES.festival;
  const page = fakeCanvasDoc();
  page.win.devicePixelRatio = undefined;
  page.win.getComputedStyle = () => { throw new Error('no styles here'); };
  withPage(page, () => qrPng(link, 160));
  const [canvas] = page.made;
  assert.equal(canvas.width / qrMatrix(link).size, Math.floor(160 / qrMatrix(link).size));
  assert.deepEqual([...new Set(canvas.fills.map((f) => f.style.toUpperCase()))].sort(), ['#0C0A14', '#FFFFFF']);
  assert.equal(decode({ data: canvas.rgba, width: canvas.width, height: canvas.height }), link);
});

test('qrPng throws where there is no 2D canvas (jsdom, a locked-down browser) — the sheet then takes the QR away', () => {
  const page = fakeCanvasDoc({ context: false });
  assert.throws(() => withPage(page, () => qrPng(SHAPES.festival, 160)), (e) => {
    assert.doesNotMatch(String(e && e.message), new RegExp(TOKEN), 'the error never carries the link');
    return true;
  });
});
