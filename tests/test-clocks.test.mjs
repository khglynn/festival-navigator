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
