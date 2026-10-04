// The Invite sheet's QR (find your crew, slice 1 — 2026-10-02, Kevin: "just
// put on top of it a QR code and people can take a screenshot or whatever"),
// and since v112 the app's own card (2026-10-03, Kevin: "I know white and
// back give us the best contrast but can we do something that looks cooler /
// is more branded?"). A friend beside you points a phone camera at it and is
// in: it IS the crew link printed under it, drawn here on the phone — never
// by an outside QR service, because the link carries the crew's token and
// the token is the crew's data. For the same reason nothing here logs,
// records or tracks the text; it goes into the canvas and nowhere else.
//
// The card: the aura is the brand, the panel is the scanner's. The hero
// button's own light — orange, magenta and blue over its dark base, with
// grain (assets/v3-tokens.css --aura-*, the very tokens .hero-bg reads) —
// fills a rounded card, and in it sits a barely-warm panel (--qr-panel)
// holding the code in a deep violet-to-fuchsia ink (--qr-ink-*, 8:1 or more
// on the panel at every point). Nothing that is not dark-on-light touches the
// code: the aura, its grain and the panel's seat shadow live outside the
// panel, and the panel is the 4-module quiet zone plus a few pixels, so its
// rounded corners never bite into it. Never the festival's accent: an invite
// is not one of the four places that colour lives (AGENTS.md).
//
// The code-line slot (find your crew, slice 3 — reserved, never drawn: the
// codes do not exist yet). `opts.band` CSS px grows the card downward under
// the panel, on the magenta that rises from the card's bottom; it never
// moves the code or takes a pixel from it (tests/qr.test.mjs). The result
// carries the card's height (h, cssH; h === px today), and app.js sizes the
// image by its width alone, so a taller card needs nothing new there. Its
// home is the saved card (qrSaveCard, below): the card a long-press keeps,
// drawn at one export size with the crew's and the fest's names in its band,
// so the sheet at 320×568 never grows.
//
// app.js reaches this module only through import('./qr.js'), so a vendored
// encoder an old engine cannot parse costs the sheet its QR, never the app
// its boot. The vendor file is uqr 0.1.3, byte-for-byte (tests/qr.test.mjs
// pins it). Plain canvas 2D, iOS Safari 15 and up: arcTo paths (no
// roundRect), radial gradients, one 'overlay' composite (skipped where the
// engine refuses it), a shadow, and the code put down as image data — no
// filters; text only in the saved card's band (fillText, in the app's face).
import { encode } from '../../vendor/uqr.mjs';

// The quiet zone the QR spec asks for, in modules: four light modules all
// round, in the bitmap itself, because a long-press Save or a right-click
// Copy takes the image without the sheet around it. Every part of this file
// that means the quiet zone reads this one number.
const QUIET = 4;

// The module grid for `text`: ECC level M (15% of it can be smudged, glared
// or cropped and it still reads) inside the quiet zone. `data[y][x]` is true
// for a dark module; `size` counts the quiet zone.
export function qrMatrix(text) {
  const { size, data } = encode(text, { ecc: 'M', border: QUIET });
  return { size, data };
}

// ---- colour -----------------------------------------------------------------------
// The card's colours are tokens (assets/v3-tokens.css :root), read once a
// draw. These literals are only the fallback, per token, where one cannot be
// read or does not look like itself (tests/qr.test.mjs holds them equal to
// the file). The tokens read are exactly these, an allowlist — never the
// festival's accent, never the page's own colours.
export const QR_COLOURS = Object.freeze({
  auraBase: '#12101E',
  auraOrange: '28, 100%, 60%',
  auraMagenta: '305, 85%, 65%',
  auraBlue: '221, 90%, 58%',
  panel: '#FFFCF8',
  ink: Object.freeze(['#3A1C96', '#64189C', '#8A1689']),
  rim: 'rgba(255, 255, 255, .16)',
  seat: 'rgba(6, 4, 14, .55)',
});
const HEX = /^#[0-9a-f]{6}$/i;
const HSL = /^\d+(\.\d+)?,\s*\d+(\.\d+)?%,\s*\d+(\.\d+)?%$/; // a triple for hsla(var(--x), a)
const RGBA = /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*(\d*\.)?\d+\s*\)$/;
function tokenColours() {
  let style = null;
  try { style = window.getComputedStyle(document.documentElement); } catch { style = null; }
  const read = (name, shape, fallback) => {
    try {
      const v = style ? String(style.getPropertyValue(name)).trim() : '';
      return shape.test(v) ? v : fallback;
    } catch { return fallback; }
  };
  return {
    auraBase: read('--aura-base', HEX, QR_COLOURS.auraBase),
    auraOrange: read('--aura-orange', HSL, QR_COLOURS.auraOrange),
    auraMagenta: read('--aura-magenta', HSL, QR_COLOURS.auraMagenta),
    auraBlue: read('--aura-blue', HSL, QR_COLOURS.auraBlue),
    panel: read('--qr-panel', HEX, QR_COLOURS.panel),
    ink: QR_COLOURS.ink.map((c, i) => read(`--qr-ink-${i + 1}`, HEX, c)),
    rim: read('--qr-rim', RGBA, QR_COLOURS.rim),
    seat: read('--qr-seat', RGBA, QR_COLOURS.seat),
  };
}
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---- layout -----------------------------------------------------------------------
// Where every pixel goes, in whole device pixels, for a code `size` modules
// square (quiet zone included) in a `room` CSS px square at `ratio` device
// pixels to one. Scanning first: module size is what makes a camera read
// (the design's measured ablation, 2026-10-03), so in any room short of the
// grown tiles' 196 the code keeps every pixel qr.js would give it plain and
// the aura lives on what is left, a hairline or more — the smallest tile, and
// a narrow phone's 54vw (172.8 at 320), which grew less over v111's 52vw than
// a frame costs (the review of v112: 320×693 at 2x drew 6 a module where v111
// drew 7). On the grown tiles (196, 208) the frame is guaranteed, and the
// growth over v111's 176 pays for it. Over every room a phone gives, at every
// ratio and link size, the code never has fewer pixels a module than v111
// drew on that screen (tests/qr.test.mjs).
//   s       pixels a module;     frame   the aura's width around the panel;
//   d       light beyond the quiet zone, so the panel's rounded corner never
//           reaches the quiet zone's corner (an arc sits r(1 - 1/√2) in);
//   e       up to two more modules of light, where the room has them spare;
//   panel   the panel's side (code + d + e each side); w, h the card's;
//   origin  where the code's top-left (quiet zone included) sits on the card.
const FRAME_ROOM = 196; // the smaller grown tile (v3.css): from here up, the frame is paid for
export function qrLayout(size, room, ratio) {
  const budget = Math.max(size, Math.floor(room * ratio + 1e-6));
  const target = clamp(room * 0.06, 5, 14) * ratio; // the frame we want: 12.5 CSS px at 208
  const fMin = Math.max(2, Math.round(target * 0.6));
  const fMax = Math.round(target * 1.15);
  let panelR = Math.max(2, Math.round(room * 0.034 * ratio));
  let d = Math.ceil(panelR * (1 - Math.SQRT1_2));
  const plain = Math.max(1, Math.floor(budget / size)); // what the plain code gets: the most that fit
  const frameAt = (k) => Math.floor((budget - size * k - 2 * d) / 2);
  const sFrame = Math.floor((budget - 2 * fMin - 2 * d) / size);
  const s = room < FRAME_ROOM ? plain : Math.max(1, Math.min(plain, sFrame));
  if (frameAt(s) < 0) {
    // Only the smallest tile with a long link: no room for even the light
    // beyond the quiet zone, so the panel's corner tightens to what is left.
    d = Math.max(0, Math.floor((budget - size * s) / 2));
    panelR = Math.floor(d / (1 - Math.SQRT1_2));
  }
  const left = budget - size * s - 2 * d;
  const frame = clamp(Math.floor(left / 2), 0, fMax);
  const e = clamp(Math.floor((left - 2 * frame) / 2), 0, 2 * s);
  const panel = size * s + 2 * (d + e);
  const w = panel + 2 * frame;
  return { budget, plain, s, frame, d, e, panelR, cardR: panelR + frame, panel, w, h: w, origin: frame + d + e };
}

// ---- the code, by the pixel ---------------------------------------------------------
// The ink at t (0 at the symbol's top-left, 1 at its bottom-right): straight
// lines between evenly spaced stops in sRGB, rounded to 8 bits. Relative
// luminance is convex along a straight sRGB line, so the lightest ink is at a
// stop — the fuchsia one, 8.03:1 on the panel.
function inkAt(stops, t) {
  t = clamp(t, 0, 1);
  const n = stops.length - 1;
  let k = 0;
  while (k < n - 1 && t > (k + 1) / n) k++;
  const t0 = k / n, t1 = (k + 1) / n;
  const u = (t - t0) / (t1 - t0);
  return [0, 1, 2].map((c) => Math.round(stops[k][c] + (stops[k + 1][c] - stops[k][c]) * u));
}
// Coverage from a signed distance (negative inside), one pixel of softening.
const cover = (dist) => (dist <= -0.5 ? 1 : dist >= 0.5 ? 0 : 0.5 - dist);
// Signed distance from (px, py) to a rounded square of half-side h, radius rr.
function sdBox(px, py, h, rr) {
  const qx = Math.abs(px) - h + rr, qy = Math.abs(py) - h + rr;
  const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0;
  return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - rr;
}
// The three finder patterns, 7×7 inside the quiet zone (matrix coordinates).
function finderAt(size) {
  const far = size - QUIET - 7;
  return [[QUIET, QUIET], [far, QUIET], [QUIET, far]];
}
// Which cells are an eye (7×7), and which an eye with its separator, as two
// flat grids: the module loop asks thousands of times.
function zones(size) {
  const eye = new Uint8Array(size * size), sep = new Uint8Array(size * size);
  for (const [fx, fy] of finderAt(size)) {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const X = fx + x, Y = fy + y;
        if (X < 0 || Y < 0 || X >= size || Y >= size) continue;
        sep[Y * size + X] = 1;
        if (x >= 0 && x < 7 && y >= 0 && y < 7) eye[Y * size + X] = 1;
      }
    }
  }
  return { eye, sep };
}

// The code and its quiet zone as RGBA bytes, `side` = size × s pixels square,
// every one opaque: a pure function of the matrix, the module size and the
// colours, so a test decodes the very bytes qrPng puts on its canvas.
//   - Under 4 device px a module: plain squares and square eyes — every pixel
//     exactly ink or exactly panel.
//   - From 4: liquid data modules — a dark module's corner rounds (half a
//     module) where neither neighbour touching it is dark, and a light
//     module outside the quiet zone and the eyes' separators gets an ink
//     fillet (0.36 module) in a corner that three dark neighbours close.
//   - The eyes: a ring one module wide (outer radius 1 module, inner 0.4)
//     around a solid 3×3 core (radius 0.3) — 1:1:3:1:1 exactly along every
//     centre line. Softened, never bubbled: a core rounded 0.7 and up, or a
//     ring 1.25 and up, lost jsQR framings in the design's measurements.
// Only curves blend; straight edges fall on whole pixels; a dark module's
// centre is exactly ink, a light one's exactly panel; the quiet zone is
// exactly the panel and never touched after the first fill.
export function codePixels(matrix, s, colours = QR_COLOURS) {
  const { size, data } = matrix;
  const side = size * s;
  const px = new Uint8ClampedArray(side * side * 4);
  const [pr, pg, pb] = hexRgb(colours.panel);
  for (let o = 0; o < px.length; o += 4) { px[o] = pr; px[o + 1] = pg; px[o + 2] = pb; px[o + 3] = 255; }
  // A pixel's place on the diagonal gradient depends only on x + y.
  const stops = colours.ink.map(hexRgb);
  const g0 = QUIET * s, span = (size - 2 * QUIET) * s;
  const lut = new Uint8Array(2 * side * 3);
  for (let k = 0; k < 2 * side; k++) lut.set(inkAt(stops, (k + 1 - 2 * g0) / (2 * span)), k * 3);
  // A pixel `a` of the way from the panel to the ink (a = 1: the ink itself).
  const mix = (x, y, a) => {
    if (a <= 0) return;
    const o = (y * side + x) * 4, c = (x + y) * 3;
    if (a >= 1) { px[o] = lut[c]; px[o + 1] = lut[c + 1]; px[o + 2] = lut[c + 2]; return; }
    px[o] = pr + (lut[c] - pr) * a;
    px[o + 1] = pg + (lut[c + 1] - pg) * a;
    px[o + 2] = pb + (lut[c + 2] - pb) * a;
  };
  const solid = (x0, y0) => { for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) mix(x, y, 1); };
  const dark = (x, y) => x >= 0 && y >= 0 && x < size && y < size && !!data[y][x];
  const styled = s >= 4;
  const { eye, sep } = zones(size);
  const eyes = finderAt(size);
  const r = s * 0.5, rf = s * 0.36;
  // The eye ring's outer corner rounds one module — the measured radius —
  // except where that arc would cut the pixel a camera samples at the corner
  // module's centre. An even module size has no middle pixel, so that pixel
  // sits half a pixel toward the bottom-right corner; at 4 px a module a full
  // module's arc takes 4% of it. There the corner rounds 3.9 px: the largest
  // arc that leaves it whole (the bound below), 0.1 px less, invisibly.
  const mid = Math.floor(s / 2);
  const ringR = Math.min(s, (Math.SQRT2 * (s - mid - 0.5) - 0.5) / (Math.SQRT2 - 1) - 0.01);
  for (let my = 0; my < size; my++) {
    for (let mx = 0; mx < size; mx++) {
      const x0 = mx * s, y0 = my * s;
      const on = !!data[my][mx];
      if (!styled) { if (on) solid(x0, y0); continue; }
      if (eye[my * size + mx]) {
        let fx = 0, fy = 0;
        for (const [ex, ey] of eyes) if (mx >= ex && mx < ex + 7 && my >= ey && my < ey + 7) { fx = ex; fy = ey; }
        const cx = (fx + 3.5) * s, cy = (fy + 3.5) * s;
        for (let v = 0; v < s; v++) {
          for (let u = 0; u < s; u++) {
            const qx = x0 + u + 0.5 - cx, qy = y0 + v + 0.5 - cy;
            const ring = Math.min(cover(sdBox(qx, qy, 3.5 * s, ringR)), 1 - cover(sdBox(qx, qy, 2.5 * s, 0.4 * s)));
            mix(x0 + u, y0 + v, Math.max(ring, cover(sdBox(qx, qy, 1.5 * s, 0.3 * s))));
          }
        }
        continue;
      }
      let bits = 0; // the corners to shape: 1 top-left, 2 top-right, 4 bottom-right, 8 bottom-left
      if (on) {
        const L = dark(mx - 1, my), R = dark(mx + 1, my), U = dark(mx, my - 1), D = dark(mx, my + 1);
        if (!L && !U) bits |= 1;
        if (!R && !U) bits |= 2;
        if (!R && !D) bits |= 4;
        if (!L && !D) bits |= 8;
        if (!bits) { solid(x0, y0); continue; }
      } else {
        if (mx < QUIET || my < QUIET || mx >= size - QUIET || my >= size - QUIET || sep[my * size + mx]) continue;
        const closed = (dx, dy) => dark(mx + dx, my) && dark(mx, my + dy) && dark(mx + dx, my + dy)
          && !sep[my * size + mx + dx] && !sep[(my + dy) * size + mx] && !sep[(my + dy) * size + mx + dx];
        if (closed(-1, -1)) bits |= 1;
        if (closed(1, -1)) bits |= 2;
        if (closed(1, 1)) bits |= 4;
        if (closed(-1, 1)) bits |= 8;
        if (!bits) continue;
      }
      const rad = on ? r : rf;
      for (let v = 0; v < s; v++) {
        for (let u = 0; u < s; u++) {
          const cu = u + 0.5, cv = v + 0.5;
          // Which corner square this pixel sits in, if any, and its circle's centre.
          let c = 0, ox = 0, oy = 0;
          if (cu < rad && cv < rad) { c = 1; ox = rad; oy = rad; }
          else if (cu > s - rad && cv < rad) { c = 2; ox = s - rad; oy = rad; }
          else if (cu > s - rad && cv > s - rad) { c = 4; ox = s - rad; oy = s - rad; }
          else if (cu < rad && cv > s - rad) { c = 8; ox = rad; oy = s - rad; }
          let a = on ? 1 : 0;
          if (bits & c) {
            const dx = cu - ox, dy = cv - oy;
            const dist = Math.sqrt(dx * dx + dy * dy) - rad;
            a = on ? cover(dist) : 1 - cover(dist);
          }
          mix(x0 + u, y0 + v, a);
        }
      }
    }
  }
  return { data: px, side };
}

// ---- the card ---------------------------------------------------------------------
// A rounded rectangle from arcTo (iOS 15 has no ctx.roundRect). Clockwise.
function rrect(ctx, x, y, w, h, rad) {
  const r = Math.max(0, Math.min(rad, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  if (r) ctx.arcTo(x + w, y, x + w, y + r, r); else ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - r);
  if (r) ctx.arcTo(x + w, y + h, x + w - r, y + h, r); else ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + r, y + h);
  if (r) ctx.arcTo(x, y + h, x, y + h - r, r); else ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  if (r) ctx.arcTo(x, y, x + r, y, r); else ctx.lineTo(x, y);
  ctx.closePath();
}
// The aura: .hero-bg's three lights, placed for a square card instead of a
// wide button — blue down the right, magenta rising from the bottom (where
// the code line will sit), orange down the left — a touch more opaque at
// the heart than the hero's (a 10px frame has less room to glow in than a
// button). x, y are fractions of the card's width and height; rx, ry of its
// longer side. Painted bottom-up: the hero lists orange first, i.e. on top.
const BLOBS = [
  { hue: 'auraBlue', x: 1.04, y: 0.08, rx: 0.74, ry: 0.92, a: [1, 0.55] },
  { hue: 'auraMagenta', x: 0.50, y: 1.10, rx: 0.85, ry: 0.58, a: [0.95, 0.5] },
  { hue: 'auraOrange', x: -0.04, y: 0.20, rx: 0.68, ry: 0.95, a: [1, 0.55] },
];
// Grain, as the hero's: seeded noise about a CSS pixel a grain, drawn
// smoothed and overlaid. Seeded by a constant, never by the link — the art
// is the same for everyone, and the link stays out of everything but the
// modules. The last grain made is kept: the sheet opens again and again at
// the same size, and the noise never changes.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let grainKept = null;
function grain(w, h, ratio) {
  try {
    const cell = Math.max(1, ratio);
    const gw = Math.max(1, Math.ceil(w / cell));
    const gh = Math.max(1, Math.ceil(h / cell));
    const key = `${gw}x${gh}`;
    if (grainKept && grainKept.key === key) return grainKept.canvas;
    const c = document.createElement('canvas');
    c.width = gw;
    c.height = gh;
    const g = c.getContext('2d');
    if (!g || typeof g.createImageData !== 'function' || typeof g.putImageData !== 'function') return null;
    const img = g.createImageData(gw, gh);
    const rnd = mulberry32(0x5eed);
    for (let i = 0; i < gw * gh; i++) {
      const v = 128 + (rnd() + rnd() - 1) * 80;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainKept = { key, canvas: c };
    return c;
  } catch { return null; } // no grain: the aura without its texture, never no card
}
// The aura in the frame's ring, its grain, a hairline of light at the
// card's edge, and the panel seated in it by a soft shadow.
function paintCard(ctx, W, H, L, colours, ratio) {
  const { frame: F, panel: P, panelR, cardR } = L;
  ctx.save();
  ctx.beginPath();
  rrect(ctx, 0, 0, W, H, cardR);
  // Only the ring the frame shows is painted — the panel covers the rest. The
  // hole stops 2px inside the panel's edge, so the panel lands on aura,
  // never on a clipped seam.
  rrect(ctx, F + 2, F + 2, P - 4, P - 4, Math.max(0, panelR - 2));
  ctx.clip('evenodd');
  ctx.fillStyle = colours.auraBase;
  ctx.fillRect(0, 0, W, H);
  try {
    const span = Math.max(W, H);
    for (const b of BLOBS) {
      const hue = colours[b.hue];
      const cx = b.x * W, cy = b.y * H, rx = b.rx * span, ry = b.ry * span;
      ctx.save();
      try {
        ctx.translate(cx, cy);
        ctx.scale(rx, ry);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        // Fading to the same hue at nothing, never to 'transparent' (black):
        // a canvas gradient interpolates unpremultiplied, and black greys the rim.
        g.addColorStop(0, `hsla(${hue}, ${b.a[0]})`);
        g.addColorStop(0.55, `hsla(${hue}, ${b.a[1]})`);
        g.addColorStop(1, `hsla(${hue}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(-cx / rx, -cy / ry, W / rx, H / ry);
      } finally { ctx.restore(); }
    }
  } catch { /* an engine that refuses a gradient: the aura's base alone */ }
  ctx.globalCompositeOperation = 'overlay';
  if (ctx.globalCompositeOperation === 'overlay') { // an engine that does not keep it gets no grain
    const noise = grain(W, H, ratio);
    if (noise) {
      ctx.globalAlpha = 0.28;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(noise, 0, 0, W, H);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // A hairline of light just inside the card's edge: glass, not a border.
  ctx.beginPath();
  rrect(ctx, 0.5, 0.5, W - 1, H - 1, Math.max(0, cardR - 0.5));
  ctx.lineWidth = Math.max(1, Math.round(ratio * 0.75));
  ctx.strokeStyle = colours.rim;
  ctx.stroke();
  ctx.restore();
  // The panel's seat: a soft shadow that falls on the aura only (outside the
  // panel, so outside the quiet zone); then the panel itself, opaque, over it.
  ctx.save();
  ctx.beginPath();
  rrect(ctx, F, F, P, P, panelR);
  ctx.shadowColor = colours.seat;
  ctx.shadowBlur = Math.max(2, F * 0.8);
  ctx.shadowOffsetY = Math.round(F * 0.15);
  ctx.fillStyle = colours.panel;
  ctx.fill();
  ctx.restore();
}

// ---- the image --------------------------------------------------------------------
// The last card drawn, in memory only (never logged, recorded or stored): the
// sheet opened again at the same room is instant — a cold draw is 22–65 ms
// on a phone-class CPU. One entry, for this page, this link, room, ratio,
// band and these colours; a failure is never kept.
let kept = null;

// `text` as the aura card, fitting `room` CSS px square, with whole device
// pixels a module at this screen's pixel ratio (a blurred or uneven edge is
// what makes a camera hesitate): `src`, a PNG data URL `px` × `h` pixels, and
// `cssPx` × `cssH`, the size to SHOW it at — its own pixels, one to each
// screen pixel. Shown any larger, even stretched 1.1× to fill its room, the
// modules alternate 7 and 8 pixels however crisply they were drawn (the walk
// of 1b80842), so the caller sizes the image to `cssPx`, never to its room;
// it is shown with `image-rendering: pixelated` all the same, for a page
// zoom. An <img>, not a canvas on the page, so a long-press offers Save Image
// (a PNG transparent outside the card's rounded corners, so it holds on any
// background), a right-click Copy Image, and a screenshot carries it like
// anything else on screen. Throws where there is no 2D canvas or no image
// data (jsdom, a browser that refuses one), or where the canvas reads back
// blank: the caller takes the QR away and the link below it stands alone, as
// it always did.
export function qrPng(text, room, opts = {}) {
  const matrix = qrMatrix(text);
  let ratio = 1;
  try { ratio = Number(window.devicePixelRatio) > 0 ? Number(window.devicePixelRatio) : 1; } catch { ratio = 1; }
  const colours = tokenColours();
  const bandCss = opts && Number(opts.band) > 0 ? Number(opts.band) : 0;
  const doc = typeof document !== 'undefined' ? document : null;
  const key = JSON.stringify([text, room, ratio, bandCss, colours]);
  if (kept && kept.doc === doc && kept.key === key) return { ...kept.out };
  const L = qrLayout(matrix.size, room, ratio);
  const W = L.w;
  const H = L.h + Math.round(bandCss * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  try {
    const ctx = drawCard(canvas, matrix, L, colours, ratio);
    if (!readsBack(ctx, L.origin, L.s)) throw new Error('qr: the canvas reads back blank');
    const out = { src: canvas.toDataURL('image/png'), px: W, cssPx: W / ratio, h: H, cssH: H / ratio };
    kept = { doc, key, out };
    return { ...out };
  } finally {
    // Let the bitmap go now: iOS holds a canvas's backing store until it is
    // collected, and the PNG is all that is needed from here.
    canvas.width = 0;
    canvas.height = 0;
  }
}
// The card on `canvas` (sized by the caller, band and all): the aura and its
// panel, then the code, painted by the pixel and put down whole, once.
function drawCard(canvas, matrix, L, colours, ratio) {
  // Read back at once (readsBack) and encoded (toDataURL): a CPU canvas
  // skips the GPU round trip; an engine that does not know the hint ignores it.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('qr: no 2d canvas');
  if (typeof ctx.createImageData !== 'function' || typeof ctx.putImageData !== 'function') throw new Error('qr: no image data');
  if (L.frame >= 1) paintCard(ctx, canvas.width, canvas.height, L, colours, ratio);
  // The panel, opaque — with no frame (the smallest tile, a long link) the
  // card is the panel alone.
  ctx.beginPath();
  rrect(ctx, L.frame, L.frame, L.panel, L.panel, L.panelR);
  ctx.fillStyle = colours.panel;
  ctx.fill();
  const code = codePixels(matrix, L.s, colours);
  const img = ctx.createImageData(code.side, code.side);
  if (!img || !img.data || img.data.length !== code.data.length) throw new Error('qr: no image data');
  img.data.set(code.data);
  ctx.putImageData(img, L.origin, L.origin);
  return ctx;
}

// ---- the saved card ---------------------------------------------------------------
// What a long-press Save to Photos (or a right-click Save Image) keeps — the
// review of v112: the sheet's own card is the size of its tile (263px from a
// 320 phone, wordless), and Kevin asked for the downloadable image to be
// "sexy", the code baked in once codes exist. So the card a person keeps is
// its own render: the sheet's card at one export size whatever the screen
// (the 216px tile's proportions at 5×, about 1080px wide), whole pixels a
// module, the quiet zone kept, read back like the sheet's — and in the band
// under it, on the magenta rising from the card's bottom, whose it is: the
// crew's name and the fest's short name with its year, in the app's display
// type (Anton, --font-display), white like the hero's label. Never a word of
// the link: the link IS the crew's credential, and a photo of the code is
// already that. The code line (slice 3) will take its place in this band.
// app.js lays it under the sheet's card, so the OS's long-press finds it.
export const SAVE_CARD = Object.freeze({ room: 216, ratio: 5, band: 64 });
const DISPLAY_FACE = 'Anton'; // --font-display's face (assets/v3-tokens.css), loaded by assets/fonts/fonts.css
let savedKept = null;
// The display face, before a canvas draws with it: a canvas draws a face that
// has not loaded in a fallback, for good. Not past a moment: a card in a
// fallback face is still the card.
function typeReady() {
  let f = null;
  try { f = document.fonts; } catch { f = null; }
  if (!f || typeof f.load !== 'function') return Promise.resolve();
  let timer = null;
  const late = new Promise((done) => { timer = setTimeout(done, 1500); });
  let load;
  try { load = Promise.resolve(f.load(`400 100px ${DISPLAY_FACE}`)).catch(() => {}); } catch { load = Promise.resolve(); }
  return Promise.race([load, late]).finally(() => clearTimeout(timer));
}
// One line of words, centred in the card at `y` (its baseline), as large as
// `size` allows inside `maxW`: smaller first (to 62% of it), then cut with an
// ellipsis. `parts` [[text, size scale, alpha]] are set side by side.
// The display face's tracking, as the fest's name is set (.04em, v3.css
// .fest-name), where the canvas can (letterSpacing: not on older engines).
function spaceOut(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(px * 0.04)}px`;
}
function fitLine(ctx, text, size, maxW) {
  const min = Math.round(size * 0.62);
  let px = size;
  const width = (t, p) => { ctx.font = `400 ${p}px ${DISPLAY_FACE}, sans-serif`; spaceOut(ctx, p); const m = ctx.measureText(t); return m && Number.isFinite(m.width) ? m.width : t.length * p * 0.5; };
  while (px > min && width(text, px) > maxW) px -= 2;
  let t = text;
  while (t.length > 1 && width(t, px) > maxW) t = `${t.slice(0, -2).trimEnd()}…`;
  ctx.font = `400 ${px}px ${DISPLAY_FACE}, sans-serif`;
  spaceOut(ctx, px);
  return { text: t, px };
}
function paintWords(ctx, W, H, L, words, ratio) {
  const crew = String((words && words.crew) || '').trim().toUpperCase();
  const fest = String((words && words.fest) || '').trim().toUpperCase();
  const year = String((words && words.year) || '').trim();
  if (!crew && !fest) return;
  const margin = L.frame + L.d + L.e; // the words keep the code's own edges
  const maxW = W - 2 * margin;
  const top = L.h;
  const bottom = H - L.frame;
  const crewSize = Math.round(W * 0.085);
  const festSize = Math.round(W * 0.052);
  const gap = Math.round(crewSize * 0.42);
  const cap = (px) => px * 0.73; // Anton's capitals, in ems
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  // The hero's label shadow (v3-tokens .hero-label), so white reads on any of the aura.
  ctx.shadowColor = 'rgba(0, 0, 0, .4)';
  ctx.shadowBlur = 6 * ratio;
  ctx.shadowOffsetY = Math.round(ratio);
  const c = crew ? fitLine(ctx, crew, crewSize, maxW) : null;
  const block = (c ? cap(c.px) : 0) + (c && fest ? gap : 0) + (fest ? cap(festSize) : 0);
  let y = top + (bottom - top - block) / 2;
  if (c) {
    y += cap(c.px);
    ctx.font = `400 ${c.px}px ${DISPLAY_FACE}, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(c.text, W / 2, Math.round(y));
    if (fest) y += gap;
  }
  if (fest) {
    // The fest and its year as the header sets them: the year a step back
    // (.65em, .75 — v3.css .fest-row .yr).
    y += cap(festSize);
    const f = fitLine(ctx, fest, festSize, maxW * 0.8);
    const yearPx = Math.round(f.px * 0.65);
    const fw = ctx.measureText(f.text).width || f.text.length * f.px * 0.5;
    ctx.font = `400 ${yearPx}px ${DISPLAY_FACE}, sans-serif`;
    spaceOut(ctx, yearPx);
    const yw = year ? (ctx.measureText(year).width || year.length * yearPx * 0.5) : 0;
    const space = year ? Math.round(f.px * 0.22) : 0;
    let x = (W - (fw + space + yw)) / 2;
    ctx.textAlign = 'left';
    ctx.font = `400 ${f.px}px ${DISPLAY_FACE}, sans-serif`;
    spaceOut(ctx, f.px);
    ctx.fillText(f.text, Math.round(x), Math.round(y));
    if (year) {
      x += fw + space;
      ctx.font = `400 ${yearPx}px ${DISPLAY_FACE}, sans-serif`;
      spaceOut(ctx, yearPx);
      ctx.globalAlpha = 0.75;
      ctx.fillText(year, Math.round(x), Math.round(y));
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}
// The canvas as a file: a Blob encoded off the main thread where the engine
// can (an object URL), a PNG data URL where it cannot.
function encodeCard(canvas) {
  if (typeof canvas.toBlob === 'function') {
    return new Promise((done) => {
      try { canvas.toBlob((blob) => done(blob || null), 'image/png'); } catch { done(null); }
    }).then((blob) => {
      if (blob) { try { return URL.createObjectURL(blob); } catch { /* no object URLs: the data URL */ } }
      return canvas.toDataURL('image/png');
    });
  }
  return Promise.resolve(canvas.toDataURL('image/png'));
}
// `text` as the card to keep, with `words` ({ crew, fest, year }) in its band:
// resolves to { src, px, h } (a blob: or data: URL, its pixels); rejects as
// qrPng throws (no canvas, no image data, a canvas that reads back blank),
// never with the text in the error. The last card is kept for this page.
export async function qrSaveCard(text, words = {}) {
  await typeReady();
  const matrix = qrMatrix(text);
  const colours = tokenColours();
  const { room, ratio, band } = SAVE_CARD;
  const doc = typeof document !== 'undefined' ? document : null;
  const key = JSON.stringify([text, words && words.crew, words && words.fest, words && words.year, colours]);
  if (savedKept && savedKept.doc === doc && savedKept.key === key) return { ...savedKept.out };
  const L = qrLayout(matrix.size, room, ratio);
  const W = L.w;
  const H = L.h + Math.round(band * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  let src;
  try {
    const ctx = drawCard(canvas, matrix, L, colours, ratio);
    paintWords(ctx, W, H, L, words, ratio);
    if (!readsBack(ctx, L.origin, L.s)) throw new Error('qr: the canvas reads back blank');
    src = await encodeCard(canvas);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
  const out = { src, px: W, h: H };
  if (savedKept && savedKept.out.src !== src && /^blob:/.test(savedKept.out.src)) {
    try { URL.revokeObjectURL(savedKept.out.src); } catch { /* already gone */ }
  }
  savedKept = { doc, key, out };
  return { ...out };
}
// A canvas can draw and still hand back a blank image: a browser that blocks
// canvas readback (Firefox's resistFingerprinting, Tor, the CanvasBlocker
// extension) gives toDataURL a white square, and the sheet showed it as a
// code under "Point a phone camera here" (the review of 116ab8e). The centre
// of the top-left eye's solid 3×3 core is ink in every QR at every module
// size: it must read back dark. Where reading back is refused outright there
// is nothing to judge, and the image is shown as drawn.
function readsBack(ctx, origin, s) {
  if (typeof ctx.getImageData !== 'function') return true;
  const at = origin + Math.floor((QUIET + 3.5) * s);
  let d = null;
  try { d = ctx.getImageData(at, at, 1, 1).data; } catch { return true; }
  if (!d || !(d.length >= 4)) return true;
  return d[3] > 127 && d[0] + d[1] + d[2] < 3 * 128;
}
