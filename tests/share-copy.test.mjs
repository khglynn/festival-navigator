// The share/invite copy check (Kevin, 2026-09-23: "this share link copy is
// tooooo long… let's do a copy check"). Two names for the two links, and one
// wording per idea — held here so the next edit to one screen cannot quietly
// drift from the other:
//   - "crew link" brings people in; "My link" brings YOU back;
//   - the unclaimed-member line in Settings says exactly what the
//     Invite sheet says when you add someone by name (on its friend step
//     since 2026-10-03, whose own line ends on the same words) — and since 2026-09-26
//     it says the link is for IF they ever want to pick (Kevin: adding a
//     friend by name is "a note for us that they're going there", often the
//     end state, not a wait until they join);
//   - My link is a master key, so its hint keeps the keep-it-private warning;
//   - the Invite sheet's QR (find your crew, slice 1, 2026-10-02) says what
//     scanning it does, and only ever draws the crew link: never a personal
//     (&me=) link — a QR of Drew's link tells whoever scans it "this is
//     yours" — and never My link.
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
  // Picking for a friend (Kevin, 2026-10-03: "pick for your friend (they can
  // join anytime later) << probs tighter copy"): one quiet row under the
  // link, and a step of its own that keeps the section's words — Kevin, the
  // same day: "I didn't think we'd change the copy on the pick a person or
  // add name shelf". Only the "Or" went, with the link it followed.
  assert.match(APP, /friend: 'Pick for a friend',/, 'the row');
  assert.match(APP, /friendSub: 'They can join anytime',/, 'and its second line, Kevin’s words, tightened');
  assert.match(APP, /friendTitle: 'ADD A FRIEND',/, 'the step keeps the section’s name');
  assert.match(APP, /friendLine: 'You pick for them; the crew sees where they’re going\.',/, 'and its line, as it was');
  assert.doesNotMatch(APP, /Or add a friend/, 'no "Or": the step follows nothing on its own screen');
  assert.doesNotMatch(APP, /until they open their link/, 'no waiting room');
  assert.match(INDEX, /Add your fests, then your people\.<br>Got a link\? Just open it\./);
  assert.match(SETTINGS, /’s in\. This link still gets them back in\./);
});

test('the QR says what scanning it does — the link is the credential, so the words say anyone is in', () => {
  assert.match(APP, /qrAlt: 'QR code for the crew link',/);
  assert.match(APP, /qrCaption: 'Point a phone camera here to join\. Anyone who scans it is in\.',/);
});

test('the QR only ever draws the crew link: never a personal link, never My link', () => {
  const JS = ['js/v3/app.js', 'js/v3/settings.js', 'js/v3/people-menu.js', 'js/v3/plan-shelf.js', 'js/crew.js', 'js/v3/qr.js'];
  const calls = [];
  for (const f of JS) {
    for (const m of read(f).matchAll(/\b(inviteQr|qrPng|qrMatrix)\(([^)]*)\)/g)) calls.push({ f, fn: m[1], args: m[2] });
  }
  assert.ok(calls.some((c) => c.fn === 'inviteQr' && c.args === 'link'), 'the Invite sheet draws its link');
  for (const c of calls) {
    assert.doesNotMatch(c.args, /meLink|theirs|canonical|meName|personal|#p=/, `${c.f}: ${c.fn}(${c.args}) — a QR of anything but the crew link`);
  }
  // The one sheet that draws it, drawing the link it prints: inviteLink()
  // with no name, the bytes in the box under it.
  const sheet = APP.slice(APP.indexOf('function openInvite('), APP.indexOf('const succeed = '));
  assert.match(sheet, /const link = inviteLink\(\);/);
  assert.match(sheet, /inviteQr\(link\), inviteLinkRow\(link, 'Crew invite link'\)/, 'the QR on top of the box, the same link in both');
  const done = APP.slice(APP.indexOf('const succeed = '), APP.indexOf('let waiting = false;'));
  assert.doesNotMatch(done, /inviteQr|qrPng/, 'the IS IN state — a personal link — has no QR');
});
