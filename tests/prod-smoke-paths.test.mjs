// The post-ship smoke compares every APP_CORE file across the three hosts
// (ops/prod-smoke.mjs step 4). It read the list with a pattern that also
// caught the apostrophe in a comment inside it, so v115's smoke reported
// "50 files, 3 differ" while every host served identical bytes (prod-health
// PH-01, 2026-10-19). Here the smoke's reader is held to the real worker and
// to the suite's own reading of the same list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appCorePaths } from '../ops/app-core.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');

test('the smoke reads APP_CORE as root paths only — every one a file in the repo, none from a comment', () => {
  const paths = appCorePaths(sw);
  assert.ok(paths.length > 20, `read the list (${paths.length})`);
  for (const p of paths) {
    assert.match(p, /^\/[^\s']*$/, `a root path: ${JSON.stringify(p)}`);
    const file = p === '/' ? 'index.html' : p.slice(1);
    assert.doesNotThrow(() => readFileSync(join(ROOT, file)), `${p} is a file in the repo`);
  }
  assert.equal(new Set(paths).size, paths.length, 'no path twice');
});

test('a quote inside a comment in the list is not a path', () => {
  const text = "const APP_CORE = [\n  '/', '/a.js',\n  // The sheet's QR (find your crew's link)\n  '/b.js',\n];";
  assert.deepEqual(appCorePaths(text), ['/', '/a.js', '/b.js']);
});

test('the smoke reads the paths the suite does (tests/app-shell-complete.test.mjs), and the page itself', () => {
  const block = sw.match(/const APP_CORE = \[([\s\S]*?)\];/);
  const suite = new Set([...block[1].matchAll(/'(\/[^']+)'/g)].map((m) => m[1]));
  assert.deepEqual(new Set(appCorePaths(sw)), new Set(['/', ...suite]));
});
