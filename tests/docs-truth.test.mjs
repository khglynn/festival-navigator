// Docs that CAN drift eventually DO drift. This suite is the forcing function:
// the "current truth" docs (README, VERCEL_SETUP, CLAUDE.md) are asserted against
// the code they describe, so a lie fails CI instead of misleading a forker.
//
// Written 2026-07-12 after the finish-pass audit found the README describing a
// version of this app that has not existed for two releases: a `js/render/`
// directory that was deleted, an `npm run css` Tailwind step for a framework the
// v3 redesign dropped, API endpoints that were removed, and the old
// "Nice to See / Must See / Highlight" pick vocabulary.
//
// It also retired VERCEL_SETUP.md, which was a complete setup guide for Vercel
// Blob — the backend this project BANNED after it lost writes. Its surviving
// content is the README's setup section.
//
// Scope note: DEVLOG.md and claude-plans/ are HISTORY — they are supposed to
// mention Tailwind and Blob in the past tense. Only the docs that claim to
// describe the app AS IT IS NOW are checked here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const pkg = JSON.parse(read('package.json'));

// The docs that describe the present tense. History files are exempt on purpose.
const CURRENT_DOCS = ['README.md', 'CLAUDE.md', 'AGENTS.md'];

// A passage that explicitly marks something as gone is the whole point of writing
// it down — "Blob was tried and dropped" must not be read as "use Blob".
// Markdown soft-wraps sentences across lines, so scan whole PARAGRAPHS: a
// line-by-line scan splits "Blob is not an option / it was dropped" in half and
// flags the first half as a lie.
const marksAsRemoved = (text) => /\b(removed|dropped|banned|no longer|never|not an option|superseded|retired)\b/i.test(text);
const paragraphs = (text) => text.split(/\n\s*\n/);

test('every path the README names in its structure block actually exists', () => {
  const readme = read('README.md');
  const block = readme.match(/```\n([\s\S]*?)```/);
  assert.ok(block, 'README should still have a fenced project-structure block');

  // Every entry is a FULL repo-relative path (no indented nesting): a nested tree
  // renders prettily but cannot be checked, and an uncheckable doc is one that
  // drifts. Paying a little beauty for a doc that cannot lie is the right trade.
  const missing = [];
  for (const line of block[1].split('\n')) {
    const token = line.trim().split(/\s+/)[0];
    if (!token || !/^[a-zA-Z0-9._/-]+$/.test(token)) continue;
    if (!token.includes('/') && !token.includes('.')) continue; // prose, not a path
    const clean = token.replace(/\/$/, '');
    if (!existsSync(new URL(clean, root))) missing.push(clean);
  }
  assert.deepEqual(missing, [], `README names paths that do not exist: ${missing.join(', ')}`);
});

test('no current doc tells anyone to run an npm script that does not exist', () => {
  const scripts = new Set(Object.keys(pkg.scripts || {}));
  const bad = [];
  for (const doc of CURRENT_DOCS) {
    if (!existsSync(new URL(doc, root))) continue;
    for (const para of paragraphs(read(doc))) {
      if (marksAsRemoved(para)) continue;
      for (const m of para.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) {
        if (!scripts.has(m[1])) bad.push(`${doc}: npm run ${m[1]}`);
      }
    }
  }
  assert.deepEqual(bad, [], `docs reference npm scripts that do not exist: ${bad.join(' | ')}`);
});

test('no current doc presents removed tech as part of the stack', () => {
  // Tailwind was dropped in the v3 redesign (styles are hand-written CSS).
  // Vercel Blob is BANNED for the crew doc — its read path is eventually
  // consistent and it measurably lost writes (DEVLOG 2026-07-07).
  const banned = [/tailwind/i, /@vercel\/blob/i, /vercel blob/i];
  const bad = [];
  for (const doc of CURRENT_DOCS) {
    if (!existsSync(new URL(doc, root))) continue;
    for (const para of paragraphs(read(doc))) {
      if (marksAsRemoved(para)) continue;
      for (const re of banned) {
        if (re.test(para)) bad.push(`${doc}: ${para.trim().slice(0, 70)}`);
      }
    }
  }
  assert.deepEqual(bad, [], `docs present removed tech as current: ${bad.join(' | ')}`);
});

test('the README does not re-state the festival list — index.json is the only source', () => {
  const index = JSON.parse(read('data/festivals/index.json'));
  const readme = read('README.md');

  // The count may be quoted (it is a fact about the app worth stating), but it
  // has to be RIGHT. Names must not be enumerated: a hand-kept list is a second
  // source of truth and it always rots. `data/festivals/index.json` is the one.
  const claim = readme.match(/\*\*Festivals loaded:\*\*\s*(\d+)/);
  assert.ok(claim, 'README should state the festival count in the form "**Festivals loaded:** N"');
  assert.equal(
    Number(claim[1]), index.length,
    `README says ${claim[1]} festivals; data/festivals/index.json has ${index.length}`,
  );
});

test('the README uses the real pick vocabulary', () => {
  // The UI vocabulary is exactly: picked / must / notes / fest. The pre-v3
  // ladder ("Nice to See" / "Must See" / "Highlight") no longer exists anywhere
  // in the app, and a README that teaches it teaches a stranger the wrong model.
  const readme = read('README.md');
  const dead = ['Nice to See', 'Must See', 'Highlight', 'crew favorites'];
  const found = dead.filter((t) => readme.includes(t));
  assert.deepEqual(found, [], `README uses retired pick vocabulary: ${found.join(', ')}`);
});

test('package.json describes the app that exists, not one festival', () => {
  // The description used to hardcode "Electric Forest '26 (Lollapalooza archived)".
  // Festivals come and go from data/festivals/; the description must not name them
  // or it is stale the day a festival is added.
  const index = JSON.parse(read('data/festivals/index.json'));
  const named = index
    .map((f) => f.name)
    .filter((name) => pkg.description.includes(name));
  assert.deepEqual(
    named, [],
    `package.json description names specific festivals (${named.join(', ')}) — it will rot; describe the app instead`,
  );
});
