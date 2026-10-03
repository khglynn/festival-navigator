// The Invite QR as an image, in a real browser (v112: the aura card — Kevin,
// 2026-10-03: "can we do something that looks cooler / is more branded?").
// What tests/qr.test.mjs proves about the bytes qr.js paints, this proves
// about what an engine really makes of them: the PNG a long-press saves, and
// the screen a friend's camera is pointed at.
//
// For every room the sheet's tile can give (132, 196 and 208 today; 176 and
// 220 either side), at 1x, 2x and 3x, for the shortest link and the longest
// a real festival can send (every room but one shown, as a list):
//   - the PNG itself (its src, drawn back out of the <img>) scans to the
//     link, is the card qrLayout planned, and holds a camera's rules: the
//     quiet zone exactly the panel (#FFFCF8), the eye's core dark, every dark
//     module 7:1 or more against the panel (the ink's worst point is 8.03:1);
//     outside the card's rounded corners it is transparent, so a saved image
//     keeps its shape on any background, and the frame is the aura, not white;
//   - a screenshot of it on the sheet's own dark (#0A0812), JPEG at q100,
//     scans to the link.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, launchWebkit, NO_BROWSER } from '../helpers/browser.mjs';
import jpeg from 'jpeg-js';
import jsQR from 'jsqr';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await serveStatic(ROOT);
const chromium = await launchBrowser();
const webkit = await launchWebkit();
test.after(async () => { if (chromium) await chromium.close(); if (webkit) await webkit.close(); await server.close(); });

// The links, built the way the app builds them (crew.js crewLink, on the
// real host) — a made-up token of the real shape, never a real crew's.
globalThis.location = { origin: 'https://fest.kevinhg.com', hostname: 'fest.kevinhg.com', hash: '' };
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
const crew = await import('../../js/crew.js');
const { roomsOf } = await import('../../js/v3/wall.js');
const { roomSlug } = await import('../../js/v3/filters.js');
const fs = await import('node:fs');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const TOKEN = 'qrartcontract_0123456789abc';
function longestShow() {
  const index = readJson('data/festivals/index.json');
  let best = { fid: null, show: null, len: -1 };
  for (const { id } of index.festivals || index) {
    let fest;
    try { fest = readJson(`data/festivals/${id}.json`); } catch { continue; }
    const slugs = roomsOf(fest, { people: {}, selections: {}, meName: null, fid: id }).map(roomSlug).filter(Boolean);
    if (slugs.length < 2) continue;
    const show = [...slugs].sort((a, b) => a.length - b.length).slice(1);
    const len = id.length + show.join(',').length;
    if (len > best.len) best = { fid: id, show, len };
  }
  return best;
}
const LONG = longestShow();
const LINKS = {
  bare: crew.crewLink(TOKEN),
  'the longest show list, as a list': crew.crewLink(TOKEN, LONG.fid, null, LONG.show, 'list'),
};
const ROOMS = [132, 176, 196, 208, 220];
const RATIOS = [1, 2, 3];
const PANEL = [0xFF, 0xFC, 0xF8];
const SHEET = '#0A0812';

const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const scan = (data, width, height) => { const hit = jsQR(data, width, height, { inversionAttempts: 'dontInvert' }); return hit ? hit.data : null; };

// A page on the test server's origin with the real tokens, nothing else:
// the sheet's dark, and a stage for the image.
const PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/assets/v3-tokens.css">
<style>html, body { margin: 0; background: ${SHEET}; } #stage { display: inline-block; padding: 24px; background: ${SHEET}; }
#stage img { display: block; height: auto; image-rendering: pixelated; }</style>
<div id="stage"></div>`;

for (const [name, get] of [['Chromium', () => chromium], ['WebKit', () => webkit]]) {
  const skip = !get() && (name === 'Chromium' ? NO_BROWSER : 'WebKit is not installed (npx playwright install webkit)');
  for (const ratio of RATIOS) {
    test(`${name} at ${ratio}x: the aura card, saved and on screen, scans to the link at every room — panel quiet zone, a dark eye, 7:1 modules, a transparent outside`, { skip }, async () => {
      const ctx = await get().newContext({ viewport: { width: 800, height: 800 }, deviceScaleFactor: ratio, serviceWorkers: 'block' });
      await ctx.route(`${server.origin}/qr-art`, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE }));
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      try {
        await page.goto(`${server.origin}/qr-art`, { waitUntil: 'load' });
        assert.equal(await page.evaluate(() => devicePixelRatio), ratio);
        for (const room of ROOMS) {
          for (const [label, link] of Object.entries(LINKS)) {
            const at = `${room}px at ${ratio}x, ${label}`;
            const r = await page.evaluate(async ({ link, room }) => {
              const q = await import('/js/v3/qr.js');
              const out = q.qrPng(link, room);
              const m = q.qrMatrix(link);
              const L = q.qrLayout(m.size, room, devicePixelRatio);
              const img = new Image();
              img.alt = 'QR code for the crew link';
              img.style.width = `${out.cssPx}px`;
              img.src = out.src;
              await img.decode();
              document.getElementById('stage').replaceChildren(img);
              // The PNG's own pixels, as a long-press would save them.
              const c = document.createElement('canvas');
              c.width = img.naturalWidth;
              c.height = img.naturalHeight;
              const g = c.getContext('2d', { willReadFrequently: true });
              g.drawImage(img, 0, 0);
              const d = g.getImageData(0, 0, c.width, c.height).data;
              let bin = '';
              for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
              const shown = img.getBoundingClientRect();
              return { out: { px: out.px, cssPx: out.cssPx, h: out.h, cssH: out.cssH, png: out.src.startsWith('data:image/png;base64,') }, L, size: m.size, dark: m.data, natural: [img.naturalWidth, img.naturalHeight], shown: [shown.width, shown.height], rgba: btoa(bin) };
            }, { link, room });
            const { L, size } = r;
            assert.ok(r.out.png, `${at}: a PNG`);
            assert.deepEqual(r.natural, [L.w, L.h], `${at}: the card qrLayout planned`);
            assert.equal(r.out.px, L.w, at);
            assert.equal(r.out.h, r.out.px, `${at}: square today`);
            assert.ok(r.out.cssPx <= room, `${at}: never wider than its room`);
            // Within one layout unit (Chromium lays out in 1/64 px: at 3x a
            // 395px card is 131.667 CSS px, laid out at 131.656).
            assert.ok(Math.abs(r.shown[0] - r.out.cssPx) <= 1 / 64 && Math.abs(r.shown[1] - r.out.cssH) <= 1 / 64, `${at}: shown at its own pixels, height from its own ratio: ${r.shown}`);
            const W = L.w;
            const H = L.h;
            const px = Buffer.from(r.rgba, 'base64');
            assert.equal(px.length, W * H * 4, at);
            const get4 = (x, y) => { const o = (y * W + x) * 4; return [px[o], px[o + 1], px[o + 2], px[o + 3]]; };
            const isPanel = (p) => p[0] === PANEL[0] && p[1] === PANEL[1] && p[2] === PANEL[2] && p[3] === 255;
            // 1. The saved image scans.
            assert.equal(scan(new Uint8ClampedArray(px.buffer, px.byteOffset, px.byteLength), W, H), link, `${at}: the PNG itself scans to the link`);
            // 2. The quiet zone, all four modules of it, is exactly the panel.
            const s = L.s;
            const side = size * s;
            const O = L.origin;
            const q = 4 * s;
            let off = 0;
            for (let y = O; y < O + side; y++) {
              for (let x = O; x < O + side; x++) {
                if (x - O >= q && x - O < side - q && y - O >= q && y - O < side - q) continue;
                if (!isPanel(get4(x, y))) off++;
              }
            }
            assert.equal(off, 0, `${at}: the quiet zone is exactly #FFFCF8, corners and all`);
            // 3. The eye's core (what qr.js reads back) is dark.
            const core = get4(O + Math.floor(7.5 * s), O + Math.floor(7.5 * s));
            assert.ok(core[3] === 255 && core[0] + core[1] + core[2] < 384, `${at}: the eye's core is dark: ${core}`);
            // 4. Every module's centre: light ones exactly the panel, dark ones
            //    7:1 or better against it.
            let worst = Infinity;
            let lightOff = 0;
            const c = Math.floor(s / 2);
            for (let my = 0; my < size; my++) {
              for (let mx = 0; mx < size; mx++) {
                const p = get4(O + mx * s + c, O + my * s + c);
                if (r.dark[my][mx]) worst = Math.min(worst, p[3] === 255 ? contrast(p, PANEL) : 0);
                else if (!isPanel(p)) lightOff++;
              }
            }
            assert.equal(lightOff, 0, `${at}: every light module is the panel`);
            assert.ok(worst >= 7, `${at}: every dark module ${worst.toFixed(2)}:1 on the panel`);
            // 5. The card: transparent outside its rounded corner, the aura
            //    (dark and coloured, never the panel) in the frame.
            if (L.frame >= 1) {
              assert.equal(get4(0, 0)[3], 0, `${at}: outside the card's corner, nothing — a saved image keeps its shape`);
              const f = get4(Math.floor(L.frame / 2), Math.floor(H / 2));
              assert.ok(f[3] === 255 && f[0] + f[1] + f[2] < 600 && !isPanel(f), `${at}: the frame is the aura: ${f}`);
            }
            // 6. What a camera sees: the image on the sheet's dark, as the screen draws it.
            const shot = await page.locator('#stage').screenshot({ type: 'jpeg', quality: 100 });
            const j = jpeg.decode(shot, { useTArray: true });
            assert.equal(scan(new Uint8ClampedArray(j.data.buffer, j.data.byteOffset, j.data.byteLength), j.width, j.height), link, `${at}: a screenshot of it on the sheet scans to the link`);
          }
        }
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }
}
