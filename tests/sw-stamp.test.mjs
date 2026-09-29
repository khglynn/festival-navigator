// The service-worker asset stamp (2026-08-29): the same files must stamp the
// same on an LF checkout and a CRLF one (Windows, autocrlf), and binaries hash
// as bytes — decoding a woff2 as text drifted the stamp for no change at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { assetStamp } = await import('../scripts/sw-stamp.mjs');

const SW = "const APP_CORE = [\n  '/index.html',\n  '/js/a.js',\n  '/assets/f.woff2',\n];";
const font = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0xff, 0xfe, 0x00, 0x9a, 0xc3, 0x28]); // invalid UTF-8 on purpose

function fixture(eol) {
  const root = mkdtempSync(join(tmpdir(), 'sw-stamp-'));
  mkdirSync(join(root, 'js'), { recursive: true });
  mkdirSync(join(root, 'assets'), { recursive: true });
  writeFileSync(join(root, 'index.html'), `<!doctype html>${eol}<title>x</title>${eol}`);
  writeFileSync(join(root, 'js', 'a.js'), `export const a = 1;${eol}// two${eol}`);
  writeFileSync(join(root, 'assets', 'f.woff2'), font);
  return root;
}

test('LF and CRLF checkouts stamp identically; a binary hashes as bytes', () => {
  const lf = assetStamp(SW, fixture('\n'));
  const crlf = assetStamp(SW, fixture('\r\n'));
  assert.equal(lf, crlf);
  assert.match(lf, /^[0-9a-f]{8}$/);
});

test('a one-byte change in a cached asset changes the stamp', () => {
  const root = fixture('\n');
  const before = assetStamp(SW, root);
  writeFileSync(join(root, 'js', 'a.js'), 'export const a = 2;\n// two\n');
  assert.notEqual(assetStamp(SW, root), before);
});

// The page's own build (2026-09-29, LEDGER follow-up 2): index.html names the
// release in <meta name="fn-build">, so a crash report from a page no worker
// controls still says which build threw (js/errlog.js). The stamp script owns
// it beside CACHE_VERSION, and writes it BEFORE hashing — index.html is in
// APP_CORE, so a meta written after the hash would stale the stamp it just made.
function checkout(version = 104, pageBuild = 'v104') {
  const root = mkdtempSync(join(tmpdir(), 'sw-stamp-run-'));
  mkdirSync(join(root, 'js'), { recursive: true });
  writeFileSync(join(root, 'index.html'), `<!doctype html>\n<meta name="fn-build" content="${pageBuild}">\n<title>x</title>\n`);
  writeFileSync(join(root, 'js', 'a.js'), 'export const a = 1;\n');
  writeFileSync(join(root, 'service-worker.js'), `const CACHE_VERSION = 'festival-nav-v${version}';\nconst ASSET_STAMP = '00000000'; // old\nconst APP_CORE = [\n  '/index.html',\n  '/js/a.js',\n];\n`);
  return root;
}

test('a bump names the new build in index.html, and the stamp it writes is already fresh', async () => {
  const { stamp, readPageBuild } = await import('../scripts/sw-stamp.mjs');
  const root = checkout();
  assert.equal(stamp(root, []).code, 0);
  assert.equal(readPageBuild(readFileSync(join(root, 'index.html'), 'utf8')), 'v105');
  assert.match(readFileSync(join(root, 'service-worker.js'), 'utf8'), /festival-nav-v105/);
  assert.equal(stamp(root, ['--check']).code, 0, 'fresh straight after');
});

test('--check is red when index.html names another build than the worker; --keep puts it right', async () => {
  const { stamp, readPageBuild } = await import('../scripts/sw-stamp.mjs');
  const root = checkout(105, 'v99');
  const r = stamp(root, ['--check']);
  assert.equal(r.code, 1);
  assert.match(r.out, /index\.html says v99/);
  assert.equal(stamp(root, ['--keep']).code, 0);
  assert.equal(readPageBuild(readFileSync(join(root, 'index.html'), 'utf8')), 'v105');
  assert.equal(stamp(root, ['--check']).code, 0);
});

test('the repo\'s index.html names the build its worker caches', async () => {
  const { readPageBuild } = await import('../scripts/sw-stamp.mjs');
  const ROOT = join(fileURLToPath(new URL('..', import.meta.url)));
  const sw = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
  const v = sw.match(/const CACHE_VERSION = 'festival-nav-(v\d+)';/)[1];
  assert.equal(readPageBuild(readFileSync(join(ROOT, 'index.html'), 'utf8')), v);
});
