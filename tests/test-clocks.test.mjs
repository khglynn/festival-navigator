// No test runs on the machine's clock by accident (2026-09-27). The app is a
// festival clock, so a suite on the machine's clock tests whatever hour it
// runs at: at 10 AM PDT on 2026-09-27, when Portola's Saturday night ended and
// the wall folded Saturday away, 62 unit tests and 3 browser tests went red on
// every branch without a line of the app changing. These checks keep the
// class closed: the unit suite is pinned by the way it is run, and a new file
// cannot quietly step outside the pin. tests/README.md has the whole picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TEST_CLOCK } from './helpers/test-clock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const HELPER = './tests/helpers/night-clock.mjs';
// The real time, whatever Date has been told: the clock the pin moves is Date's.
const realNow = () => performance.timeOrigin + performance.now();
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 60_000, `${what}: ${new Date(a).toISOString()} is not near ${new Date(b).toISOString()}`);

test('npm test loads the clock into every test file’s own process', () => {
  const { scripts } = JSON.parse(read('package.json'));
  assert.match(scripts.test, /^node --import \.\/tests\/helpers\/night-clock\.mjs --test tests\/\*\.test\.mjs$/,
    'the unit suite runs through the clock (node --test hands --import to each file’s process)');
});

test('CI runs the unit suite only through npm test, so no step steps around the pin', () => {
  const ci = read('.github/workflows/ci.yml');
  const runs = [...ci.matchAll(/^\s*-?\s*run:\s*(.+)$/gm)].map((m) => m[1].trim());
  assert.deepEqual(runs.filter((r) => /\bnode\b[^|&;]*--test\b/.test(r)), [], 'a bare node --test in CI would run on the machine’s clock');
  assert.ok(runs.filter((r) => /(^|\s)npm test$/.test(r)).length >= 3, 'the plain, far-zone and live-night runs are all npm test');
  assert.match(ci, /NIGHT_CLOCK:\s*'2026-09-27T04:30:00Z'/, 'the live-night run keeps its own pin');
});

// The helper itself, in a fresh process each: the default, an explicit night,
// and the named way out.
const clockIn = (env) => {
  const r = spawnSync(process.execPath, ['--import', HELPER, '-e', 'process.stdout.write(String(Date.now()))'],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NIGHT_CLOCK: '', ...env } });
  assert.equal(r.status, 0, r.stderr);
  return Number(r.stdout);
};
test('the clock pins a week before Portola by default, an explicit NIGHT_CLOCK wins, and NIGHT_CLOCK=machine is the machine’s', () => {
  near(clockIn({}), Date.parse(TEST_CLOCK), 'the default');
  near(clockIn({ NIGHT_CLOCK: '2026-09-27T04:30:00Z' }), Date.parse('2026-09-27T04:30:00Z'), 'a live night');
  near(clockIn({ NIGHT_CLOCK: 'machine' }), realNow(), 'the machine');
  const bad = spawnSync(process.execPath, ['--import', HELPER, '-e', '0'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NIGHT_CLOCK: 'Saturday' } });
  assert.notEqual(bad.status, 0, 'a NIGHT_CLOCK that is not a date stops the run rather than running on the machine’s clock');
});

test('this file’s own process is on the pin', { skip: process.execArgv.join(' ').includes('night-clock.mjs') ? false : 'run outside npm test: nothing to check' }, () => {
  const asked = process.env.NIGHT_CLOCK;
  if (asked === 'machine') return near(Date.now(), realNow(), 'the machine, as asked');
  near(Date.now(), Date.parse(asked || TEST_CLOCK), asked ? 'NIGHT_CLOCK' : 'the default pin');
});

// ---- the browser suite ------------------------------------------------------
// Every page a browser test opens starts on TEST_CLOCK because every browser
// comes from the harness (tests/helpers/browser.mjs pinByDefault), and a
// test's own clock wins over it (tests/browser/clock-harness.test.mjs proves
// that in both engines). What can undo it is a file that launches its own
// browser, and a file that takes the way out. These read the files.
const BROWSER_DIR = path.join(ROOT, 'tests/browser');
const browserTests = () => fs.readdirSync(BROWSER_DIR).filter((f) => f.endsWith('.test.mjs'))
  .map((f) => ({ f, src: fs.readFileSync(path.join(BROWSER_DIR, f), 'utf8') }));
const OWN_LAUNCH = /\b(?:chromium|webkit|firefox)\s*\.\s*(?:launch|launchPersistentContext|launchServer|connect|connectOverCDP)\s*\(|\.launchPersistentContext\s*\(|\.connectOverCDP\s*\(/;

test('every browser test gets its browser from the harness, so every page starts on the pinned clock', () => {
  const HELPERS = path.join(ROOT, 'tests/helpers');
  const helpers = fs.readdirSync(HELPERS).filter((f) => f.endsWith('.mjs') && f !== 'browser.mjs')
    .map((f) => ({ f: `helpers/${f}`, src: fs.readFileSync(path.join(HELPERS, f), 'utf8') }));
  const own = [...browserTests(), ...helpers].filter(({ src }) => OWN_LAUNCH.test(src)).map(({ f }) => f);
  assert.deepEqual(own, [], 'launch through launchBrowser/launchWebkit (tests/helpers/browser.mjs): a browser of your own boots the app at whatever hour the suite runs');
  const harness = read('tests/helpers/browser.mjs');
  const launches = harness.split('\n').filter((l) => /\.launch\(/.test(l));
  assert.ok(launches.length >= 3 && launches.every((l) => l.includes('pinByDefault(')), `every launch in the harness goes through pinByDefault:\n${launches.join('\n')}`);
});

test('only the machine-clock smoke steps off the clock (and the harness’s own test of the way out, which boots no app)', () => {
  const out = browserTests().filter(({ src }) => /\bonMachineClock\b/.test(src)).map(({ f }) => f).sort();
  assert.deepEqual(out, ['clock-harness.test.mjs', 'machine-clock-smoke.test.mjs'],
    'a test that needs another moment names it (page.clock, or shiftDate); the machine’s clock is the smoke’s alone');
  const harnessTest = browserTests().find(({ f }) => f === 'clock-harness.test.mjs').src;
  assert.ok(!/serveStatic|#g=|server\.origin/.test(harnessTest), 'the harness’s own test stays on a bare page');
  assert.match(read('tests/README.md'), /machine-clock-smoke\.test\.mjs/, 'the tests’ README names the one real-clock test');
});

test('the harness pins a context by default, and the way out is unpinned and wants a reason (no browser needed)', async () => {
  const { pinByDefault, onMachineClock } = await import('./helpers/browser.mjs');
  const { shiftDate } = await import('./helpers/test-clock.mjs');
  const made = [];
  const fake = { newContext: async (o) => { const c = { o, scripts: [], addInitScript: async (fn, arg) => { c.scripts.push([fn, arg]); } }; made.push(c); return c; } };
  pinByDefault(fake);
  const pinned = await fake.newContext({ viewport: { width: 390, height: 844 } });
  assert.deepEqual(pinned.o, { viewport: { width: 390, height: 844 } }, 'the options pass through');
  assert.equal(pinned.scripts.length, 1);
  assert.equal(pinned.scripts[0][0], shiftDate, 'its first init script moves Date');
  assert.equal(pinned.scripts[0][1], Date.parse(TEST_CLOCK), 'to TEST_CLOCK');
  await assert.rejects(() => onMachineClock(fake, {}), /say why/);
  await assert.rejects(() => onMachineClock(fake, {}, '  '), /say why/);
  const raw = await onMachineClock(fake, {}, 'a reason');
  assert.equal(raw.scripts.length, 0, 'the way out adds nothing');
  await assert.rejects(() => onMachineClock({ newContext: async () => ({}) }, {}, 'a reason'), /launchBrowser or launchWebkit/, 'only a harness browser has a way out');
  assert.equal(pinByDefault(null), null, 'no browser, nothing to pin');
});
