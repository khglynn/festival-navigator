// A wait that never waits (2026-10-04). Playwright's page.waitForFunction
// calls its predicate SYNCHRONOUSLY and stops at the first truthy result
// (playwright-core server/frames.js: `const success = predicate(); if
// (success) fulfill(success)`). A predicate that is async, or that returns
// an `import(...)` or a `.then(...)` chain, hands back a Promise — truthy
// at once — so the "wait" resolves on its first poll, whatever the page
// holds. people-menu's "QR module never comes" read the error journal one
// beat later and found nothing on a busy Linux WebKit runner (CI run
// 37218538542). An async check belongs to waitForAsync in
// tests/helpers/browser.mjs, which really polls.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SELF = path.basename(fileURLToPath(import.meta.url));

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'node_modules' || d.name === 'fixtures' ? [] : files(p);
    return /\.m?js$/.test(d.name) && d.name !== SELF ? [p] : [];
  });
}

// The predicate is the first argument: an async function, or an arrow whose
// body starts with import(...) or chains a .then(...) on its first line.
const ASYNC_PREDICATE = [
  /waitForFunction\(\s*async\b/,
  /waitForFunction\(\s*(?:\([^)]*\)|\w+)\s*=>\s*\(?\s*(?:await\b|import\()/,
  /waitForFunction\(\s*(?:\([^)]*\)|\w+)\s*=>[^\n]*?\.then\(/,
];

test('no waitForFunction is handed an async predicate — its Promise is truthy, so the wait returns at once', () => {
  const found = [];
  for (const f of files(here)) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return; // a comment naming the trap is not the trap
      if (ASYNC_PREDICATE.some((re) => re.test(line))) found.push(`${path.relative(path.join(here, '..'), f)}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(found, [], `use waitForAsync (tests/helpers/browser.mjs) for an async check:\n${found.join('\n')}`);
});

test('the rule catches the shapes it names, and leaves a plain predicate alone', () => {
  const hit = (s) => ASYNC_PREDICATE.some((re) => re.test(s));
  assert.ok(hit("await page.waitForFunction(async () => {"));
  assert.ok(hit("await page.waitForFunction(() => import('/js/errlog.js').then((m) => m.recent().length), null, {})"));
  assert.ok(hit("await page.waitForFunction(() => fetch('/x').then((r) => r.ok))"));
  assert.ok(hit("await page.waitForFunction(async () => ((await import('/js/state.js')).x === 1))"));
  assert.ok(!hit("await page.waitForFunction(() => document.querySelectorAll('.card').length > 5, null, { timeout: 20000 })"));
  assert.ok(!hit("await page.waitForFunction((sel) => !document.querySelector(sel), '.x')"));
  assert.ok(!hit("await page.waitForFunction(() => window.__errlog.recent().some((e) => e.kind === 'invite:qr'))"));
});
