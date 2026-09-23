// A tiny crash journal (2026-08-31). Twenty entries in localStorage, written
// by the global error hooks and by belt-and-suspenders catches (the zoom's
// airbag). It exists because a stranded UI in Safari was invisible to every
// tool we had — the suite is green, the server sees nothing, and the only
// witness was a screen recording. This is the witness that is always running.
// Settings → App → Diagnostics reads it back and copies a shareable dump.
// Never write anything secret here: no tokens, no note text, no names.
const KEY = 'fn_errlog_v1';
const CAP = 20;

// The session's journal lives in MEMORY, seeded once from storage; storage is
// best-effort persistence on top. Every touch of storage sits in a try —
// Chrome with site data blocked throws from the GETTER itself (project rule,
// 2026-08-27) — and a browser where storage is refused still keeps this
// session's entries, which is exactly the session someone is debugging.
let mem = null;
function seed() {
  if (mem) return mem;
  try { mem = JSON.parse(window.localStorage.getItem(KEY) || '[]'); } catch { mem = []; }
  if (!Array.isArray(mem)) mem = [];
  return mem;
}

export function record(kind, err) {
  try {
    const list = seed();
    list.push({
      t: new Date().toISOString(),
      kind,
      msg: String((err && err.message) || err || 'unknown').slice(0, 300),
      stack: err && err.stack ? String(err.stack).slice(0, 700) : null,
    });
    if (list.length > CAP) list.splice(0, list.length - CAP);
    try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* memory still has it */ }
  } catch { /* a journal must never be the thing that throws */ }
}

export function recent() {
  try { return [...seed()]; } catch { return []; }
}

export function hookGlobalErrors() {
  window.addEventListener('error', (e) => record('error', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => record('promise', e.reason));
}

// The motion facts behind a "the stage names stutter" report (2026-09-23), so
// the next one answers itself in one paste: whether the phone asks for
// reduced motion, whether the app's Low power is on, and which way the stage
// strip on the current wall follows its columns — 'timeline' (the compositor
// moves it with the grid), 'transform' (a scroll handler, a frame behind on a
// phone) or 'none' (no grid on the wall right now). The route is the one the
// wall TOOK (wall.js followStrip writes it on the strip); `stripAnimation` is
// the engine's own word for the follow's animation, so a rule that froze it
// would show here as 'none'. Unknown is null, never a guess.
function motionFacts() {
  const facts = { reducedMotion: null, lowPower: null, stripRoute: 'none', stripAnimation: null };
  try { facts.reducedMotion = !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* no media queries */ }
  try { facts.lowPower = document.body.classList.contains('low-power'); } catch { /* no body yet */ }
  try {
    const strip = document.querySelector('#wall-root .stage-strip[data-follow]');
    if (strip) {
      facts.stripRoute = strip.dataset.follow;
      const row = strip.querySelector('.times-grid');
      facts.stripAnimation = (row && window.getComputedStyle(row).animationName) || null;
    }
  } catch { /* a journal must never be the thing that throws */ }
  return facts;
}

// The shareable dump: enough to see what a phone saw, nothing private.
export async function diagnostics() {
  let build = 'unknown';
  try {
    const keys = await window.caches.keys();
    build = keys.find((k) => k.startsWith('festival-nav-v')) || 'no-cache';
  } catch { /* no SW, private mode */ }
  return {
    build,
    ua: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    online: navigator.onLine,
    ...motionFacts(),
    at: new Date().toISOString(),
    errors: recent(),
  };
}
