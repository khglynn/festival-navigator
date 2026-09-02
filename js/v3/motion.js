// How this app moves, as numbers (Kevin, 2026-08-30: "things grow from where
// they already are … the way in has a little life, the way out is quick and
// plain"). ONE home for the constants every grown surface shares — the deck
// panel (deck.js) and the bucket toggle (app.js) read them from here.
//
// The zoom (card-facts.js, below its "the bloom" banner) still declares its
// own copies: that half of the file is being reworked on PR #14 in parallel
// (2026-09-01), so it was not touched. tests/motion-shared.test.mjs pins that
// the two declarations agree; once #14 lands, the follow-up is one import
// line there and the copies go.
export const GROW_MS = 240;        // the box, k→1
export const MATERIALIZE_MS = 90;  // the overlay's fade-in (the CSS content fade matches)
export const OUT_MS = 130;         // the way out: quick and plain
export const CASCADE_MS = 170;     // each grown line's arrival
export const STAGGER_MS = 30;      // the beat between arrivals
export const REFRESH_MS = 300;     // a pick while grown: pieces slide, arrivals grow in
export const EASE_ARRIVE = 'cubic-bezier(.2, 1.15, .35, 1)';  // in: a 4% overshoot, then settle
export const EASE_LEAVE = 'cubic-bezier(.4, 0, 1, 1)';        // out: quick, no flourish
export const EASE_SURFACE = 'cubic-bezier(.4, 0, .2, 1)';     // refresh crossfades: crisp, no bounce

export const reduced = () => typeof window !== 'undefined' && !!window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Low Power promises "no animation" and CSS cannot reach Element.animate() —
// the gate lives in code (survey, 2026-08-30). jsdom has no animate(), so
// every test path is the instant one; the motion itself is a real-browser
// walk's job.
export const canAnimate = (node, ctx) => !!node && typeof node.animate === 'function'
  && !reduced() && !(ctx && ctx.lowPower);
