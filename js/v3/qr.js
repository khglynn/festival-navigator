// The Invite sheet's QR (find your crew, slice 1 — 2026-10-02, Kevin: "just
// put on top of it a QR code and people can take a screenshot or whatever").
// A friend beside you points a phone camera at it and is in: it IS the crew
// link printed under it, drawn here on the phone — never by an outside QR
// service, because the link carries the crew's token and the token is the
// crew's data. For the same reason nothing here logs, records or tracks the
// text; it goes into the canvas and nowhere else.
//
// app.js reaches this module only through import('./qr.js'), so a vendored
// encoder an old engine cannot parse costs the sheet its QR, never the app
// its boot. The vendor file is uqr 0.1.3, byte-for-byte (tests/qr.test.mjs
// pins it).
import { encode } from '../../vendor/uqr.mjs';

// The module grid for `text`: ECC level M (15% of it can be smudged, glared
// or cropped and it still reads) and a 2-module quiet border; the sheet's
// white tile adds the rest of the margin a scanner wants. `data[y][x]` is
// true for a dark module; `size` counts the border.
export function qrMatrix(text) {
  const { size, data } = encode(text, { ecc: 'M', border: 2 });
  return { size, data };
}

// The page's own colours (assets/v3-tokens.css): the modules are --page's
// near-black on --text-primary's white — dark on light, the way every camera
// expects a QR. The literals are the fallback where the tokens can't be read.
const DARK = '#0C0A14';
const LIGHT = '#FFFFFF';
function tokenColour(name, fallback) {
  try {
    const v = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
  } catch { return fallback; }
}

// A PNG data URL of `text` as a QR about `cssPx` CSS pixels square: whole
// device pixels per module at this screen's pixel ratio (a blurred edge is
// what makes a camera hesitate), the image shown with `image-rendering:
// pixelated` so the browser never smooths it either. An <img>, not a canvas
// on the page, so a long-press offers Save Image, a right-click Copy Image,
// and a screenshot carries it like anything else on screen. Throws where
// there is no 2D canvas (jsdom, a browser that refuses one): the caller
// takes the QR away and the link below it stands alone, as it always did.
export function qrPng(text, cssPx) {
  const { size, data } = qrMatrix(text);
  let ratio = 1;
  try { ratio = Number(window.devicePixelRatio) > 0 ? Number(window.devicePixelRatio) : 1; } catch { ratio = 1; }
  const scale = Math.max(1, Math.floor((cssPx * ratio) / size));
  const px = size * scale;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('qr: no 2d canvas');
  ctx.fillStyle = tokenColour('--text-primary', LIGHT);
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = tokenColour('--page', DARK);
  for (let y = 0; y < size; y++) {
    const row = data[y];
    // A run of dark modules is one rect: fewer calls, and no seam between
    // neighbours on an engine that antialiases rect edges.
    for (let x = 0; x < size;) {
      if (!row[x]) { x++; continue; }
      let end = x + 1;
      while (end < size && row[end]) end++;
      ctx.fillRect(x * scale, y * scale, (end - x) * scale, scale);
      x = end;
    }
  }
  return canvas.toDataURL('image/png');
}
