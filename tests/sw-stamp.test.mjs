// The service-worker asset stamp (2026-08-29): the same files must stamp the
// same on an LF checkout and a CRLF one (Windows, autocrlf), and binaries hash
// as bytes — decoding a woff2 as text drifted the stamp for no change at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
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
