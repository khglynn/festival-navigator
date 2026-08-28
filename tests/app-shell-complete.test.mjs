// The offline app shell must carry every module the app imports — a worker
// that caches app.js and wall.js but not the two modules they just grew
// boots online and dies offline on the first missing import (Codex gate,
// 2026-08-27). This walks the static import graph from the entry module and
// fails when service-worker.js's APP_CORE falls behind, so adding a module
// without caching it is a red build, not a field failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = '/js/v3/app.js';

// Static imports, re-exports AND dynamic `import('./x.js')` calls — a module
// only ever loaded lazily still has to be in the offline shell.
function staticImports(file) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const out = [];
  for (const m of src.matchAll(/^\s*(?:import|export)\s+[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/gm)) out.push(m[1]);
  for (const m of src.matchAll(/^\s*import\s+['"](\.{1,2}\/[^'"]+)['"]/gm)) out.push(m[1]);
  for (const m of src.matchAll(/\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) out.push(m[1]);
  return out.map((spec) => '/' + relative(ROOT, resolve(join(ROOT, dirname(file)), spec)).split('\\').join('/'));
}

// Only the atomic core counts: a module demoted to the best-effort
// APP_EXTRAS list would still be missing on a phone whose install skipped it.
function appCore(sw) {
  const block = sw.match(/const APP_CORE = \[([\s\S]*?)\];/);
  assert.ok(block, 'service-worker.js declares APP_CORE');
  return new Set([...block[1].matchAll(/'(\/[^']+)'/g)].map((m) => m[1]));
}

function walk(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const dep of staticImports(file)) walk(dep, seen);
  return seen;
}

test('every module reachable from js/v3/app.js by static import is in the service worker\'s APP_CORE', () => {
  const sw = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
  const core = appCore(sw);
  const reachable = [...walk(ENTRY)].sort();
  assert.ok(reachable.length > 20, `walked ${reachable.length} modules — the walker found the graph`);
  const missing = reachable.filter((f) => !core.has(f));
  assert.deepEqual(missing, [], `add to APP_CORE in service-worker.js (and bump CACHE_VERSION): ${missing.join(', ')}`);
});

test('the walker would catch a module that is imported but not cached', () => {
  const sw = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
  const core = appCore(sw);
  assert.ok(core.has('/js/v3/filters.js') && core.has('/js/v3/now.js'), 'the two modules v40 forgot are in the core');
  // Remove one from a copy of the core and the same check must fail.
  const without = new Set([...core].filter((f) => f !== '/js/v3/now.js'));
  const missing = [...walk(ENTRY)].filter((f) => !without.has(f));
  assert.deepEqual(missing, ['/js/v3/now.js']);
});
