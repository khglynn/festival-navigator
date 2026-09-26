// The share/invite copy check (Kevin, 2026-09-23: "this share link copy is
// tooooo long… let's do a copy check"). Two names for the two links, and one
// wording per idea — held here so the next edit to one screen cannot quietly
// drift from the other:
//   - "crew link" brings people in; "My link" brings YOU back;
//   - the unclaimed-member line in Settings says exactly what the
//     Invite sheet says when you add someone by name — and since 2026-09-26
//     it says the link is for IF they ever want to pick (Kevin: adding a
//     friend by name is "a note for us that they're going there", often the
//     end state, not a wait until they join);
//   - My link is a master key, so its hint keeps the keep-it-private warning.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const APP = read('js/v3/app.js');
const SETTINGS = read('js/v3/settings.js');
const INDEX = read('index.html');

const CLAIM = /If \$\{\w+\} ever wants to pick, send this link\. Opening it makes the picks theirs\./g;

test('one wording: the unclaimed-member line is the add-someone sentence', () => {
  assert.equal((APP.match(CLAIM) || []).length, 1, 'the Invite sheet’s add says it');
  assert.equal((SETTINGS.match(CLAIM) || []).length, 1, 'and Settings → Crew says the very same thing');
});

test('two names: "My link" is the one that brings you back, wherever it is mentioned', () => {
  assert.match(APP, /copyBtn\.textContent = 'My link';/, 'the home card’s button');
  assert.match(SETTINGS, /Your own link \(My link\) is on the home page\./, 'Settings points at it by that name');
});

test('My link is a master key: its hint still says keep it to yourself, and why', () => {
  assert.match(APP, /Keep it to yourself — it makes whoever opens it you\./);
});

test('the short versions are the ones on screen', () => {
  assert.match(APP, /byName: 'Or add a friend',/, 'a peer of the link, not a step on the way to it');
  assert.match(APP, /'You pick for them; the crew sees where they’re going\.'/, 'complete as it stands');
  assert.doesNotMatch(APP, /until they open their link/, 'no waiting room');
  assert.match(INDEX, /Add your fests, then your people\.<br>Got a link\? Just open it\./);
  assert.match(SETTINGS, /’s in\. This link still gets them back in\./);
});
