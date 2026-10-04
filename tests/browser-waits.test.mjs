// A wait that never waits (2026-10-04). Playwright's page.waitForFunction
// calls its predicate SYNCHRONOUSLY and stops at the first truthy result
// (playwright-core server/frames.js: `const success = predicate(); if
// (success) fulfill(success)`). A predicate that is async, or that returns
// an `import(...)` or a `.then(...)` chain, hands back a Promise — truthy
// at once — so the "wait" resolves on its first poll, whatever the page
// holds. people-menu's "QR module never comes" read the error journal one
// beat later and found nothing on a busy Linux WebKit runner (CI run
// 37218538542). An async check belongs to waitForAsync in
// tests/helpers/browser.mjs, which really polls — and whose own deadline
// holds even when a check never settles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForAsync } from './helpers/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SELF = path.basename(fileURLToPath(import.meta.url));
// The runtime guard's own evidence hands waitForFunction a Promise on purpose.
const EXEMPT = new Set([SELF, 'wait-guard.test.mjs']);

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'node_modules' || d.name === 'fixtures' ? [] : files(p);
    return /\.m?js$/.test(d.name) && !EXEMPT.has(d.name) ? [p] : [];
  });
}

// The source as code alone: comments and the insides of strings become
// spaces (newlines kept), so a comment naming the trap is not the trap, a
// paren inside a string does not unbalance the scan, and every offset still
// lands on its own line. Regex literals are rare in predicates and left be.
function codeOnly(src) {
  const out = src.split('');
  const blank = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { const e = src.indexOf('\n', i); const to = e < 0 ? src.length : e; blank(i, to); i = to; continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); const to = e < 0 ? src.length : e + 2; blank(i, to); i = to; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      blank(i + 1, j);
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

// The first argument of the call whose `(` is at `open`: up to the first
// comma or close at depth 0.
function firstArg(code, open) {
  let depth = 0;
  for (let k = open + 1; k < code.length; k++) {
    const c = code[k];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) return code.slice(open + 1, k); depth -= 1; }
    else if (c === ',' && depth === 0) return code.slice(open + 1, k);
  }
  return code.slice(open + 1);
}

// A predicate that can only hand back a Promise: declared async, or one that
// awaits, imports, chains a .then or builds a Promise anywhere in its body.
const ASYNC_BODY = /^\s*async\b|\bawait\b|\bimport\s*\(|\.then\s*\(|\bnew\s+Promise\b/;

function asyncWaits(src) {
  const code = codeOnly(src);
  const found = [];
  const call = /\bwaitForFunction\s*\(/g;
  let m;
  while ((m = call.exec(code))) {
    const open = m.index + m[0].length - 1;
    if (ASYNC_BODY.test(firstArg(code, open))) found.push(code.slice(0, m.index).split('\n').length);
  }
  return found;
}

test('no waitForFunction is handed an async predicate — its Promise is truthy, so the wait returns at once', () => {
  const found = [];
  for (const f of files(here)) {
    const src = fs.readFileSync(f, 'utf8');
    const lines = src.split('\n');
    for (const at of asyncWaits(src)) found.push(`${path.relative(path.join(here, '..'), f)}:${at}: ${lines[at - 1].trim().slice(0, 120)}`);
  }
  assert.deepEqual(found, [], `use waitForAsync (tests/helpers/browser.mjs) for an async check:\n${found.join('\n')}`);
});

test('the scanner catches the shapes it names, on one line or several, and leaves a plain predicate alone', () => {
  const caught = (s) => asyncWaits(s).length > 0;
  // One line.
  assert.ok(caught("await page.waitForFunction(async () => false);"));
  assert.ok(caught("await page.waitForFunction(() => import('/js/errlog.js').then((m) => m.recent().length), null, {});"));
  assert.ok(caught("await page.waitForFunction(() => fetch('/x').then((r) => r.ok));"));
  assert.ok(caught("await page.waitForFunction(async () => ((await import('/js/state.js')).x === 1));"));
  assert.ok(caught("await frame.waitForFunction(function () { return new Promise((r) => r(true)); });"));
  // Several lines (Copilot on #87): the call and its predicate apart, a block
  // body returning a chain.
  assert.ok(caught('await page.waitForFunction(\n  async () => false,\n  null,\n  { timeout: 50 },\n);'));
  assert.ok(caught("await page.waitForFunction(() => {\n  return import('/js/errlog.js')\n    .then((m) => m.recent().length > 0);\n}, null, { timeout: 4000 });"));
  assert.ok(caught('await page.waitForFunction(\n  () =>\n    caches.open("x")\n      .then((c) => c.match("/y")),\n);'));
  // Plain predicates, and the trap only named.
  assert.ok(!caught("await page.waitForFunction(() => document.querySelectorAll('.card').length > 5, null, { timeout: 20000 });"));
  assert.ok(!caught("await page.waitForFunction((sel) => !document.querySelector(sel), '.x');"));
  assert.ok(!caught("await page.waitForFunction(() => window.__errlog.recent().some((e) => e.kind === 'invite:qr'));"));
  assert.ok(!caught("await page.waitForFunction(() => document.title === 'await import(x).then(y)');"));
  assert.ok(!caught('// a Promise is truthy — `waitForFunction(async () =>\n// false)` returns at once'));
  assert.ok(!caught('/* page.waitForFunction(async () => x) */'));
  assert.ok(!caught("await page.waitForFunction(\n  (n) => document.querySelectorAll('.card').length >= n,\n  5,\n);"));
});

// waitForAsync's own deadline, against a stand-in page: it only calls evaluate.
const pageOf = (evaluate) => ({ evaluate });

test('waitForAsync: a check that never settles still ends in the named timeout, on time', async () => {
  const t0 = Date.now();
  await assert.rejects(waitForAsync(pageOf(() => new Promise(() => {})), () => true, null, { timeout: 200, what: 'a held module' }),
    /waitForAsync: a held module not true within 200ms/);
  const took = Date.now() - t0;
  assert.ok(took >= 190 && took < 1500, `the deadline holds: ${took}ms`);
});

test('waitForAsync: polls until the check is truthy and returns its value', async () => {
  let calls = 0;
  const value = await waitForAsync(pageOf(async () => { calls += 1; return calls >= 3 ? { ok: calls } : false; }), null, null, { timeout: 2000, every: 10 });
  assert.deepEqual(value, { ok: 3 });
  assert.equal(calls, 3);
});

test('waitForAsync: a check that stays false fails by its deadline, never early and never late', async () => {
  let calls = 0;
  const t0 = Date.now();
  await assert.rejects(waitForAsync(pageOf(async () => { calls += 1; return false; }), null, null, { timeout: 250, every: 40, what: 'nothing' }), /nothing not true within 250ms/);
  const took = Date.now() - t0;
  assert.ok(took >= 240 && took < 1500, `failed at its deadline: ${took}ms`);
  assert.ok(calls >= 3, `it kept asking: ${calls}`);
});

test('waitForAsync: a check that throws is the error, not a timeout', async () => {
  await assert.rejects(waitForAsync(pageOf(async () => { throw new Error('page.evaluate: ReferenceError: nope is not defined'); }), null, null, { timeout: 2000 }), /nope is not defined/);
});

test('waitForAsync: a navigation mid-check is "not yet", as page.waitForFunction treats one', async () => {
  let calls = 0;
  const value = await waitForAsync(pageOf(async () => {
    calls += 1;
    if (calls === 1) throw new Error('page.evaluate: Execution context was destroyed, most likely because of a navigation');
    return calls >= 2 && 'landed';
  }), null, null, { timeout: 2000, every: 10 });
  assert.equal(value, 'landed');
  assert.equal(calls, 2);
});
