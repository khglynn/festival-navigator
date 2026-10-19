// The worker's APP_CORE list, read out of service-worker.js's text: every
// quoted ROOT PATH inside `const APP_CORE = [...]`. Its own module so the
// smoke (ops/prod-smoke.mjs) and a unit test read it the same way.
//
// Paths only — a leading slash and no whitespace: the list carries comments,
// and a quote in one ("The Invite sheet's QR", v115) paired with the next
// path's opening quote and turned the smoke's step 4 into three false
// mismatches (PH-01, 2026-10-19). tests/app-shell-complete.test.mjs reads the
// list the same way, except that it skips the bare '/' (the page itself,
// which it has no imports to follow from); the smoke compares that too.
export function appCorePaths(swText) {
  const block = (String(swText).match(/const APP_CORE = \[([\s\S]*?)\];/) || [])[1] || '';
  return [...block.matchAll(/'(\/[^'\s]*)'/g)].map((m) => m[1]);
}
