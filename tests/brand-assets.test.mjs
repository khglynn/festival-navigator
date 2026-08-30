// The brand rasters and the link-preview wiring.
//
// The failure this exists to catch is quiet by nature: someone adds a
// festival to data/festivals/index.json, never runs `npm run brand`, and the
// new fest's crew link unfurls with a 404 image — a blank grey card in
// iMessage, which is exactly the bug this whole piece of work was for. There
// is no error anywhere; the page is fine, the app is fine, only the preview is
// missing, and nobody sees a preview of their own link.
//
// So: every festival in the index must have a preview file, the file must be
// the right size and shape, and the tags api/share.js emits must point at
// files that exist on disk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const path = (p) => new URL(p, root);
const read = (p) => readFileSync(path(p));
const index = JSON.parse(read('data/festivals/index.json').toString('utf8'));

// ---- tiny header readers (no image library; these are twelve bytes each) ------------
function pngSize(buf) {
  assert.equal(buf.subarray(1, 4).toString('latin1'), 'PNG', 'not a PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegSize(buf) {
  assert.equal(buf.readUInt16BE(0), 0xffd8, 'not a JPEG');
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    // Any SOF frame carries the dimensions; DHT/DAC/RST do not.
    const isSof = marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('no SOF marker — not a readable JPEG');
}

// ---- the icons ---------------------------------------------------------------------
test('every icon the app and the manifest reference exists at its declared size', () => {
  const expected = [
    ['favicon.png', 48],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['icon-maskable-512.png', 512],
    ['apple-touch-icon.png', 180],
  ];
  for (const [name, size] of expected) {
    assert.ok(existsSync(path(name)), `${name} is missing — run npm run brand`);
    const { width, height } = pngSize(read(name));
    assert.deepEqual({ width, height }, { width: size, height: size }, `${name} is the wrong size`);
  }

  // The manifest may only point at icons that exist, at the size it claims.
  const manifest = JSON.parse(read('manifest.json').toString('utf8'));
  for (const icon of manifest.icons) {
    const file = icon.src.replace(/^\//, '');
    assert.ok(existsSync(path(file)), `manifest.json points at ${icon.src}, which does not exist`);
    const { width } = pngSize(read(file));
    assert.equal(`${width}x${width}`, icon.sizes, `manifest.json claims ${icon.src} is ${icon.sizes}`);
  }

  // A maskable icon is a DIFFERENT shape from a rounded one: Android clips
  // everything outside a 40% safe radius, so a rounded square declared
  // maskable loses its corners. The two must not be the same file.
  const maskable = manifest.icons.filter((i) => (i.purpose || '').includes('maskable'));
  assert.equal(maskable.length, 1, 'exactly one maskable icon');
  assert.ok(
    !manifest.icons.some((i) => i.src === maskable[0].src && (i.purpose || '') === 'any'),
    'the same file is declared both "any" and "maskable" — one of the two is being shown wrong',
  );
});

test('assets/mark.svg is the committed vector source', () => {
  assert.ok(existsSync(path('assets/mark.svg')), 'assets/mark.svg is missing — run npm run brand');
  const svg = read('assets/mark.svg').toString('utf8');
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, 'not an SVG');
  assert.match(svg, /viewBox="0 0 512 512"/, 'the mark is authored in a 512-unit box');
});

// ---- the link previews -------------------------------------------------------------
test('every festival in the index has a link-preview image, at 1200x630', () => {
  const missing = [];
  for (const fest of [{ id: 'default' }, ...index]) {
    const file = `assets/og/${fest.id}.jpg`;
    if (!existsSync(path(file))) { missing.push(file); continue; }
    const { width, height } = jpegSize(read(file));
    assert.deepEqual(
      { width, height }, { width: 1200, height: 630 },
      `${file} is ${width}x${height}; every platform expects 1200x630`,
    );
  }
  assert.deepEqual(
    missing, [],
    `add these with \`npm run brand\` — a festival with no preview unfurls as a blank card: ${missing.join(', ')}`,
  );
});

test('no preview is too heavy to be fetched', () => {
  // WhatsApp gives up on a preview image over ~300 KB, and every client pays
  // the bytes on every unfurl. A grained 1200x630 card is 1.6 MB as a PNG and
  // ~130 KB as a q88 JPEG — if this ever trips, the format regressed.
  const CAP = 300 * 1024;
  const heavy = [{ id: 'default' }, ...index]
    .map((f) => `assets/og/${f.id}.jpg`)
    .filter((f) => existsSync(path(f)) && statSync(path(f)).size > CAP);
  assert.deepEqual(heavy, [], `previews over 300 KB: ${heavy.join(', ')}`);
});

// ---- the wiring --------------------------------------------------------------------
test('index.html carries the default tags, between the markers share.js needs', () => {
  const html = read('index.html').toString('utf8');
  assert.match(html, /<!-- OG:BEGIN/, 'the OG:BEGIN marker is gone — every per-fest link would silently fall back');
  assert.match(html, /<!-- OG:END -->/, 'the OG:END marker is gone');
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']) {
    assert.ok(html.includes(tag), `index.html is missing ${tag}`);
  }
  assert.match(html, /content="summary_large_image"/, 'twitter:card must be summary_large_image');

  // Every icon index.html links must exist on disk.
  for (const m of html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)) {
    assert.ok(existsSync(path(m[1].replace(/^\//, ''))), `index.html links ${m[1]}, which does not exist`);
  }

  // The default og:image must be a real file and an absolute URL — a relative
  // one resolves against the crawler, not against us.
  const image = /<meta property="og:image" content="([^"]+)"/.exec(html);
  assert.ok(image, 'no og:image in index.html');
  assert.match(image[1], /^https:\/\/fest\.kevinhg\.com\//, 'og:image must be absolute');
  assert.ok(existsSync(path(image[1].replace('https://fest.kevinhg.com/', ''))), `${image[1]} does not exist`);
});

test('api/share.js emits tags that point at files that exist', async () => {
  const share = await import('../api/share.js');
  for (const fest of [null, ...index]) {
    const tags = share.tagsFor(fest);
    const image = /<meta property="og:image" content="([^"]+)"/.exec(tags)[1];
    const file = image.replace('https://fest.kevinhg.com/', '');
    assert.ok(existsSync(path(file)), `share.js points ${fest ? fest.id : 'the default'} at ${file}, which does not exist`);
    assert.match(tags, /twitter:card" content="summary_large_image"/);
    // og:url is built from a hardcoded origin, never the request's Host header.
    assert.match(tags, /<meta property="og:url" content="https:\/\/fest\.kevinhg\.com\//);
  }
});

test('api/share.js trusts nothing from the query', async () => {
  const share = await import('../api/share.js');
  const junk = [
    '"><script>alert(1)</script>',
    '../../etc/passwd',
    'PORTOLA-2026',            // case matters; ids are lowercase
    'portola-2026 ',           // trailing space
    '',
    undefined,
    null,
    {},
    'a'.repeat(65),            // past the id length ceiling
  ];
  for (const value of junk) {
    assert.equal(share.festivalFor(value, index), null, `festivalFor accepted ${JSON.stringify(value)}`);
  }
  // A repeated param arrives as an array; take the first and still validate it.
  assert.equal(share.festivalFor(['portola-2026', 'x'], index).id, 'portola-2026');
  assert.equal(share.festivalFor(['<script>', 'portola-2026'], index), null);

  // Nothing from the query is ever echoed into the page.
  const html = read('index.html').toString('utf8');
  const page = share.inject(html, share.festivalFor('"><script>alert(1)</script>', index));
  assert.ok(page, 'inject returned nothing — the markers moved');
  assert.ok(!page.includes('alert(1)'), 'query content reached the response');
  assert.ok(page.includes('assets/og/default.jpg'), 'an unknown id must fall back to the default card');
});

test('.gitignore still names every raster that ships', () => {
  // The repo is PUBLIC and denies images by default, because an audit run once
  // dumped 50 screenshots into the root and a screenshot can carry a crew
  // token. That deny is only safe if the files that SHOULD ship are named.
  const ignore = read('.gitignore').toString('utf8');
  for (const line of ['*.png', '*.jpg', '!favicon.png', '!icon-192.png', '!icon-512.png',
    '!icon-maskable-512.png', '!apple-touch-icon.png', '!assets/og/*.jpg']) {
    assert.ok(
      ignore.split('\n').includes(line),
      `.gitignore is missing \`${line}\` — a shipped raster would be silently untracked, or a stray one committed`,
    );
  }
});
