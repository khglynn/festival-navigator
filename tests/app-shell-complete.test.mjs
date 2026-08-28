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

function staticImports(file) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const out = [];
  for (const m of src.matchAll(/^\s*import\s+[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/gm)) out.push(m[1]);
  for (const m of src.matchAll(/^\s*import\s+['"](\.{1,2}\/[^'"]+)['"]/gm)) out.push(m[1]);
  return out.map((spec) => '/' + relative(ROOT, resolve(join(ROOT, dirname(file)), spec)).split('\\').join('/'));
}

function walk(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const dep of staticImports(file)) walk(dep, seen);
  return seen;
}

test('every module reachable from js/v3/app.js by static import is in the service worker\'s APP_CORE', () => {
  const sw = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
  const core = new Set([...sw.matchAll(/'(\/[^']+)'/g)].map((m) => m[1]));
  const reachable = [...walk(ENTRY)].sort();
  assert.ok(reachable.length > 20, `walked ${reachable.length} modules — the walker found the graph`);
  const missing = reachable.filter((f) => !core.has(f));
  assert.deepEqual(missing, [], `add to APP_CORE in service-worker.js (and bump CACHE_VERSION): ${missing.join(', ')}`);
});
