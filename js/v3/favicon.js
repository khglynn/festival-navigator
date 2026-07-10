// Living favicon (design 21 intro + README): a 32px canvas gradient square
// (violet -> pink, ~22% corner radius) that breathes between the active
// fest's accent and brand violet, redrawn ~10s. Chrome/FF/Edge tabs only —
// Safari + PWA keep the static favicon.png. Skipped entirely in low power.
let timer = null;
let phase = 0;

function draw(accentRgb) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  const r = 7; // ~22% of 32
  g.beginPath();
  g.moveTo(r, 0); g.lineTo(32 - r, 0); g.quadraticCurveTo(32, 0, 32, r);
  g.lineTo(32, 32 - r); g.quadraticCurveTo(32, 32, 32 - r, 32);
  g.lineTo(r, 32); g.quadraticCurveTo(0, 32, 0, 32 - r);
  g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0);
  g.closePath();
  g.clip();
  const grad = g.createLinearGradient(0, 0, 32, 32);
  // Breathe: phase 0 = fest accent -> pink; phase 1 = brand violet -> pink.
  const start = phase === 0 && accentRgb ? `rgb(${accentRgb})` : '#8B5CF6';
  grad.addColorStop(0, start);
  grad.addColorStop(1, '#F472B6');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return c.toDataURL('image/png');
}

function swap(href) {
  let link = document.querySelector('link[rel="icon"][data-living]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.dataset.living = '1';
    document.head.appendChild(link);
  }
  link.href = href;
}

// Start (or restart) the living favicon for the given "R, G, B" accent.
export function startFavicon(accentRgb, { lowPower = false } = {}) {
  stopFavicon();
  if (lowPower) return; // static favicon.png stays
  const tick = () => { swap(draw(accentRgb)); phase = 1 - phase; };
  tick();
  timer = setInterval(tick, 10000);
}

export function stopFavicon() {
  if (timer) { clearInterval(timer); timer = null; }
  const link = document.querySelector('link[rel="icon"][data-living]');
  if (link) link.remove(); // the static <link rel=icon favicon.png> takes over
}
