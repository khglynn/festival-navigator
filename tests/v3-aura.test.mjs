// The aura engine is a transcription of the design atlas's reference code —
// these tests pin the EXACT strings so a refactor can't drift the design.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD, hslOf, strokeOf, nextColorIndex } from '../js/v3/palette.js';
import {
  auraBackground, whoCorner, aboutCorner, nameColor, initialFor, CARD_BASE,
} from '../js/v3/aura.js';

// Atlas people: K=0 hsl(10,90,62) M=1 hsl(221,90,62) J=2 hsl(305,90,62) S=3 hsl(150,70,50)
const K = { name: 'Kevin', colorIndex: 0, isYou: true };
const M = { name: 'Maya', colorIndex: 1, isYou: false };
const J = { name: 'Jules', colorIndex: 2, isYou: false };
const S = { name: 'Sam', colorIndex: 3, isYou: false };
const p = (base, level) => ({ ...base, level });

test('board: 24 colors, canonical first four, all unique', () => {
  assert.equal(BOARD.length, 24);
  assert.deepEqual(BOARD[0], { h: 10, s: 90, l: 62 });
  assert.deepEqual(BOARD[1], { h: 221, s: 90, l: 62 });
  assert.deepEqual(BOARD[2], { h: 305, s: 90, l: 62 });
  assert.deepEqual(BOARD[3], { h: 150, s: 70, l: 50 });
  const keys = new Set(BOARD.map((c) => `${c.h}/${c.s}/${c.l}`));
  assert.equal(keys.size, 24);
});

test('atlas parity: Soulwax {M:2, K:1} produces the exact atlas gradient', () => {
  // renderVals: w={M:2,K:1} -> layers M@.75 anchor0, K@.5 anchor1, over #1C1731
  const { background, animated } = auraBackground([p(M, 2), p(K, 1)]);
  assert.equal(
    background,
    'radial-gradient(130% 130% at 20% 120%, hsla(221,90%,62%,0.75) 0%, hsla(221,90%,62%,0.375) 45%, transparent 78%), ' +
    'radial-gradient(130% 130% at 85% -20%, hsla(10,90%,62%,0.5) 0%, hsla(10,90%,62%,0.25) 45%, transparent 78%), ' +
    '#1C1731',
  );
  assert.equal(animated, true);
});

test('musts order first and render at alpha 1', () => {
  // Robyn: m=[K,M] -> both musts at alpha 1, input order kept (K then M)
  const { background } = auraBackground([p(K, 4), p(M, 4)]);
  assert.match(background, /^radial-gradient\(130% 130% at 20% 120%, hsla\(10,90%,62%,1\)/);
  assert.match(background, /at 85% -20%, hsla\(221,90%,62%,1\)/);
  // Four Tet: m=[K,J], w={M:1} -> M (a pick) must come AFTER both musts
  const ft = auraBackground([p(M, 1), p(K, 4), p(J, 4)]).background;
  const idx = (s) => ft.indexOf(s);
  assert.ok(idx('hsla(10,90%,62%,1)') < idx('hsla(305,90%,62%,1)'));
  assert.ok(idx('hsla(305,90%,62%,1)') < idx('hsla(221,90%,62%,0.5)'));
});

test('anchor cycle wraps at four layers', () => {
  const five = [p(K, 4), p(M, 4), p(J, 1), p(S, 2), { name: 'Pat', colorIndex: 4, level: 3 }];
  const { background } = auraBackground(five);
  const anchors = [...background.matchAll(/at ([^,]+),/g)].map((m) => m[1]);
  assert.deepEqual(anchors, ['20% 120%', '85% -20%', '-15% 30%', '115% 70%', '20% 120%']);
});

test('empty card: flat base, not animated', () => {
  const r = auraBackground([]);
  assert.equal(r.background, CARD_BASE);
  assert.equal(r.animated, false);
  assert.equal(nameColor([]), '#B9B3CC');
  assert.equal(nameColor([p(K, 1)]), '#fff');
});

test('who-corner: caps at 2 musts + 2 ticks then ghost +n; you get white stroke', () => {
  const six = [p(K, 4), p(M, 4), p(J, 4), p(S, 1),
    { name: 'Pat', colorIndex: 4, level: 2 }, { name: 'Quinn', colorIndex: 5, level: 3 }];
  const marks = whoCorner(six);
  assert.deepEqual(marks.map((m) => m.kind), ['must', 'must', 'pick', 'pick', 'ghost']);
  assert.equal(marks[4].label, '+2'); // J's must and Quinn's pick overflow
  assert.equal(marks[0].stroke, '#fff'); // Kevin isYou
  assert.equal(marks[1].stroke, 'hsl(221,85%,82%)'); // tint caps saturation at 85
});

test('duplicate initials get two letters', () => {
  const people = [p(K, 4), { name: 'Kara', colorIndex: 6, level: 4, isYou: false }];
  assert.equal(initialFor(people[0], people), 'KE');
  assert.equal(initialFor(people[1], people), 'KA');
  assert.equal(initialFor(people[0], [people[0]]), 'K');
});

test('about-corner: notes then spotify; affinity tiers drive the glow', () => {
  assert.deepEqual(aboutCorner({}), []);
  const chips = aboutCorner({ noteCount: 2, spotify: { songs: 41, followed: true } });
  assert.deepEqual(chips.map((c) => c.kind), ['notes', 'spotify']);
  assert.equal(chips[1].followed, true);
  assert.equal(chips[1].hot, true); // followed + 5+ songs = corner glow
  // Followed-only artists chip too (bookmark, no count) — supersedes the
  // atlas songs>0 gate (Kevin, 2026-07-13: a follow is a stronger signal
  // than one liked song).
  const followedOnly = aboutCorner({ spotify: { songs: 0, followed: true } });
  assert.equal(followedOnly.length, 1);
  assert.equal(followedOnly[0].label, '');
  assert.equal(followedOnly[0].followed, true);
  assert.equal(followedOnly[0].hot, false); // needs 5+ songs too
  // 4 songs + followed: chipped but no glow; 5 songs unfollowed: no glow.
  assert.equal(aboutCorner({ spotify: { songs: 4, followed: true } })[0].hot, false);
  assert.equal(aboutCorner({ spotify: { songs: 9, followed: false } })[0].hot, false);
  // Nothing at all still renders nothing.
  assert.deepEqual(aboutCorner({ spotify: { songs: 0, followed: false } }), []);
});

test('palette helpers: Sam tint respects sub-85 saturation; slots assign stable', () => {
  assert.equal(strokeOf(3, false), 'hsl(150,70%,82%)'); // 70 < 85 stays 70
  assert.equal(hslOf(3, 0.5), 'hsla(150,70%,50%,0.5)');
  assert.equal(nextColorIndex([0, 1, 2, 3]), 4);
  assert.equal(nextColorIndex([0, 2]), 1);
});
