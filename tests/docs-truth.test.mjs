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
  // The description used to hardcode "Electric Forest '26 (Lollapalooza archived)"
  // and the keywords still listed "electric-forest" one line below. Festivals come
  // and go from data/festivals/; naming one here is stale the day another is added.
  const index = JSON.parse(read('data/festivals/index.json'));
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const haystack = `${pkg.description} ${(pkg.keywords || []).join(' ')}`.toLowerCase();

  const named = index
    .map((f) => f.name)
    .filter((name) => haystack.includes(name.toLowerCase()) || haystack.includes(slug(name)));

  assert.deepEqual(
    named, [],
    `package.json names specific festivals (${named.join(', ')}) in its description/keywords — it will rot; describe the app instead`,
  );
});

// NOW.md is the one-screen cursor every session (and every compaction) reads
// first. By 2026-09-16 it had grown to 76 KB of newest-first history that
// contradicted itself, and the compaction hook fed it back into every
// resumed session. History belongs in DEVLOG.md; NOW stays small enough to
// read in one go.
const NOW_MAX_BYTES = 12 * 1024;

test('NOW.md stays a one-screen cursor', () => {
  const bytes = Buffer.byteLength(read('NOW.md'));
  assert.ok(
    bytes <= NOW_MAX_BYTES,
    `NOW.md is ${bytes} bytes (limit ${NOW_MAX_BYTES}) — replace stale lines in place and move history to DEVLOG.md`,
  );
});

test('every repo path NOW.md and CLAUDE.md cite in backticks exists', () => {
  // Only words that look like repo files: relative, at least one slash, and
  // either a file extension or a trailing slash. Branch names (origin/main,
  // fix/docs), URLs and bare hostnames, globs and CSS/JS identifiers do not match.
  const looksLikePath = /^\.?[\w-]+(\/[\w.-]+)*\/([\w-][\w.-]*\.[a-z0-9]+|)$/i;
  const missing = [];
  for (const doc of ['NOW.md', 'CLAUDE.md']) {
    for (const [, span] of read(doc).matchAll(/`([^`]+)`/g)) {
      for (const word of span.split(/\s+/)) {
        const path = word.replace(/:\d+(-\d+)?$/, '');
        if (!looksLikePath.test(path)) continue;
        if (!existsSync(new URL(path.replace(/\/$/, ''), root))) missing.push(`${doc}: ${path}`);
      }
    }
  }
  assert.deepEqual(missing, [], `docs cite paths that do not exist: ${missing.join(', ')}`);
});

// MODEL-V4 §3a.4 names all eight rows — their ORDER and their words — as Kevin's
// own, and the wall gave up its inline tilde whisper on the strength of one of
// them, so the explanation lives in exactly one place. Copy is the easiest thing
// in a repo to "improve" in passing, and an order is the easiest thing to lose
// while moving a row; this holds both. Same forcing function the rest of this
// file applies to the README.
test('Settings → How it works says Kevin\u2019s rows, word for word and in his order', () => {
  const settings = read('js/v3/settings.js');
  const flat = (t) => t.replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ');
  const spec = flat(read('claude-plans/2026-09-16-wall-v4/MODEL-V4.md'));
  const rows = [
    ['Highlight a friend\u2019s picks.', 'Tap their name. Switch who you pick as in Settings.'],
    ['Invite your people.', 'Tap + Invite someone, or share the crew link \u2014 anyone who opens it is in, no account needed.'],
    ['Add your color to an artist.', 'Tap it, then +. Each + fills a bar. 4 = must see.'],
    ['Everyone else\u2019s picks land on the card.', 'Ticks are picks; a letter is a must.'],
    ['Details and notes.', 'Open the card. Violet = crew notes; pin one to keep it on top. Green = it\u2019s in your Spotify (connect in Settings).'],
    ['~ a guessed start time and artist order.', 'Based on limited intel.'],
    ['Show or hide parts of the week.', 'Tap the fest name.'],
    ['Sync, at a glance.', 'Green dot = synced. Gray = offline (still works); red = something\u2019s wrong.'],
    ['Switch fests and more in Settings.', ''],
  ];
  let at = -1;
  for (const [strong, sub] of rows) {
    assert.ok(spec.includes(flat(sub)) || !sub, `the spec still carries "${sub}" \u2014 if Kevin changed it, change it in both places`);
    const call = `, '${strong}', '${sub}'));`;
    const i = settings.indexOf(call);
    assert.notEqual(i, -1, `How it works must say "${strong} ${sub}" exactly (MODEL-V4 §3a.4)`);
    assert.ok(i > at, `"${strong}" is out of order \u2014 the rows are grouped the way the screen reads (§3a.4)`);
    at = i;
  }
  // ONE fest link, drawn as the real component, carrying both facts (Kevin,
  // 2026-09-17: it was drawn twice, differently, five rows apart).
  assert.equal((settings.match(/festLinkDemo\(\)/g) || []).length, 2, 'defined once, used once');
  assert.equal(settings.includes('festNameDemo'), false, 'and the half-component that drifted is gone');
  // Its label is the fixed `ACL '26`, never the current fest's name (a long
  // name broke out of the box at 390 — ship round, 2026-09-17), and the
  // picture wears brand, not the fest accent: the accent has four homes and
  // this drill is not one of them (CLAUDE.md).
  const demo = /function festLinkDemo\(\) \{([\s\S]*?)\n\}/.exec(settings)[1];
  assert.ok(demo.includes(`"ACL '26"`), 'the one fest name, coded in');
  assert.equal(/state\.fest\(/.test(demo), false, 'the current fest is never asked');
  assert.ok(demo.includes(`setProperty('--fest', 'var(--brand)')`), 'the accent is re-scoped to brand on the picture');
  const drill = /function openHowItWorks\(actions\) \{([\s\S]*?)\n\}/.exec(settings)[1];
  assert.equal(/var\(--fest\)/.test(demo + drill), false, 'and no picture in the drill paints the accent by hand');
  // "don't need to explain now" — the now mark gets no lesson row.
  assert.equal(/lesson\(\([^)]*\)\s*=>[\s\S]{0,400}?'[^']*\bnow\b[^']*',/i.test(settings), false,
    'the now mark explains itself on the day; it gets no row');
});
