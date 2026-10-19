// One <main> landmark, holding every screen (v116; Lighthouse's
// landmark-one-main was the landing's one accessibility failure, 2026-10-19).
// A screen reader's "jump to main" lands on whichever screen is showing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const { document } = new JSDOM(html).window;
// app.js's own list, read from the source so a new screen is held to this too.
const app = readFileSync(join(ROOT, 'js/v3/app.js'), 'utf8');
const SCREENS = JSON.parse(app.match(/const SCREENS = (\[[^\]]+\]);/)[1].replace(/'/g, '"'));

test('index.html has exactly one <main>, and every screen is inside it', () => {
  const mains = document.querySelectorAll('main, [role="main"]');
  assert.equal(mains.length, 1, 'one main landmark');
  assert.ok(SCREENS.length >= 7, `the screens list was read (${SCREENS.join(', ')})`);
  for (const id of SCREENS) {
    const el = document.getElementById(id);
    assert.ok(el, `#${id} exists`);
    assert.ok(mains[0].contains(el), `#${id} is inside <main>`);
  }
  // Toasts and the live region announce over whatever screen is up; they are
  // not a screen's content.
  assert.ok(!mains[0].contains(document.getElementById('toast-root')), 'the toast root sits outside it');
});
