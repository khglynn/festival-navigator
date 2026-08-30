#!/usr/bin/env node
// Stamp the service worker after touching any cached asset.
//
//   node scripts/sw-stamp.mjs            bump CACHE_VERSION by one + re-stamp
//   node scripts/sw-stamp.mjs --keep     re-stamp only (same version — while that
//                                       version is still unreleased, i.e. preview only)
//   node scripts/sw-stamp.mjs --check    exit 1 if the stamp is stale (CI)
//
// Why a stamp: a commit that changes cached JS/CSS without bumping
// CACHE_VERSION ships a shell that existing installs never fetch — they keep
// serving the old bytes until some later bump (Codex gate, 2026-08-29: the
// gate-round fixes landed under the unchanged v43). The stamp is a hash of
// every APP_CORE file; tests/app-shell-complete.test.mjs recomputes it, so a
// stale stamp is a red build, not a field failure. Bumping is the ritual
// this script makes one command.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW = join(ROOT, 'service-worker.js');

export function appCoreFiles(sw) {
  const block = sw.match(/const APP_CORE = \[([\s\S]*?)\];/);
  if (!block) throw new Error('service-worker.js declares no APP_CORE');
  return [...block[1].matchAll(/'(\/[^']+)'/g)].map((m) => m[1]).filter((f) => f !== '/service-worker.js');
}

const TEXT_RE = /\.(?:js|mjs|css|html|json|svg|txt|md)$/i;

export function assetStamp(sw, root = ROOT) {
  const h = createHash('sha1');
  for (const f of appCoreFiles(sw)) {
    h.update(f);
    // Text files are CRLF-normalised: a Windows checkout (autocrlf) must
    // stamp the same as the LF one, or the suite goes red on one machine only.
    // Binaries (the woff2 fonts) hash as bytes — decoding them as text
    // mangles invalid UTF-8 and the stamp drifts for no change at all.
    const bytes = readFileSync(join(root, f));
    h.update(TEXT_RE.test(f) ? bytes.toString('utf8').replace(/\r\n/g, '\n') : bytes);
  }
  return h.digest('hex').slice(0, 8);
}

export function readStamp(sw) {
  const m = sw.match(/const ASSET_STAMP = '([0-9a-f]{8})';/);
  return m ? m[1] : null;
}

const main = () => {
  const args = new Set(process.argv.slice(2));
  let sw = readFileSync(SW, 'utf8');
  const fresh = assetStamp(sw);
  const current = readStamp(sw);
  if (args.has('--check')) {
    if (current === fresh) { console.log(`sw-stamp: fresh (${fresh})`); return; }
    console.error(`sw-stamp: STALE — cached assets changed since ${current || 'no stamp'}; run node scripts/sw-stamp.mjs`);
    process.exit(1);
  }
  const vm = sw.match(/const CACHE_VERSION = 'festival-nav-v(\d+)';/);
  if (!vm) throw new Error('CACHE_VERSION line not found');
  const v = Number(vm[1]);
  const next = args.has('--keep') ? v : v + 1;
  sw = sw.replace(/const CACHE_VERSION = 'festival-nav-v\d+';/, `const CACHE_VERSION = 'festival-nav-v${next}';`);
  // Write with the worker's OWN line ending — never mix endings on a CRLF checkout.
  const eol = sw.includes('\r\n') ? '\r\n' : '\n';
  const stampLine = `const ASSET_STAMP = '${fresh}'; // sha1 of APP_CORE — node scripts/sw-stamp.mjs after any cached-asset change (the suite checks it)`;
  sw = current
    ? sw.replace(/const ASSET_STAMP = '[0-9a-f]{8}';[^\r\n]*/, stampLine)
    : sw.replace(/(const CACHE_VERSION = [^\r\n]*\r?\n)/, `$1${stampLine}${eol}`);
  writeFileSync(SW, sw);
  console.log(`sw-stamp: v${v} -> v${next}, stamp ${current || '(none)'} -> ${fresh}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
