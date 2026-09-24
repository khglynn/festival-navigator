// The aura engine is a transcription of the design atlas's reference code —
// these tests pin the EXACT strings so a refactor can't drift the design.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD, hslOf, strokeOf, nextColorIndex } from '../js/v3/palette.js';
import {
  auraBackground, whoCorner, aboutCorner, nameColor, initialFor, CARD_BASE,
  meterOf, fitCorners, needAt, GIVE_WAY,
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

test('who-corner: everyone ELSE — caps at 2 musts + 2 ticks then ghost +n, and you are never in it', () => {
  const six = [p(K, 4), p(M, 4), p(J, 4), p(S, 1),
    { name: 'Pat', colorIndex: 4, level: 2 }, { name: 'Quinn', colorIndex: 5, level: 3 }];
  const marks = whoCorner(six);
  assert.deepEqual(marks.map((m) => m.kind), ['must', 'must', 'pick', 'pick', 'ghost']);
  // Kevin (you) has his own meter on the left (2026-09-23): the corner is
  // Maya and Jules's musts, Sam and Pat's ticks, and Quinn in the +1.
  assert.deepEqual(marks.slice(0, 2).map((m) => m.label), ['M', 'J']);
  assert.equal(marks[4].label, '+1', 'the +n counts other people only');
  assert.equal(marks[0].stroke, 'hsl(221,85%,82%)'); // tint caps saturation at 85
  assert.ok(marks.every((m) => m.stroke !== '#fff'), 'the white edge is yours, and you are on the left now');
  // A busy card can no longer fold you into "+n": with you and five others
  // at plain picks, the corner is two ticks and +3 — all of them others.
  const busy = [p(K, 1), ...['A', 'B', 'C', 'D', 'E'].map((n, i) => ({ name: n, colorIndex: 6 + i, level: 1 }))];
  const b = whoCorner(busy);
  assert.deepEqual(b.map((m) => m.kind), ['pick', 'pick', 'ghost']);
  assert.equal(b[2].label, '+3');
  assert.deepEqual(whoCorner([p(K, 4)]), [], 'only you: the crew corner is empty');
});

test('who-corner: a caller can fold more into +n, and the count stays true', () => {
  const crew = [p(M, 4), p(J, 4), p(S, 1), { name: 'Pat', colorIndex: 4, level: 2 }, { name: 'Quinn', colorIndex: 5, level: 3 }];
  const ghostOf = (marks) => (marks.find((m) => m.kind === 'ghost') || { label: '' }).label;
  assert.equal(ghostOf(whoCorner(crew)), '+1');
  assert.equal(ghostOf(whoCorner(crew, { picks: 1 })), '+2');
  assert.equal(ghostOf(whoCorner(crew, { picks: 0 })), '+3');
  assert.equal(ghostOf(whoCorner(crew, { picks: 0, musts: 0 })), '+5');
  assert.deepEqual(whoCorner(crew, { picks: 0, musts: 0 }).map((m) => m.kind), ['ghost']);
});

test('your meter: first in the about corner, your colour at .5 with the white edge; bars 1-3, the word at 4', () => {
  assert.equal(meterOf(null), null);
  assert.equal(meterOf(p(K, 0)), null, 'not picked = no chip');
  for (const lvl of [1, 2, 3]) {
    const m = meterOf(p(K, lvl));
    assert.equal(m.kind, 'meter');
    assert.equal(m.bars, lvl);
    assert.equal(m.label, '');
  }
  const must = meterOf(p(K, 4));
  assert.equal(must.bars, 0);
  assert.equal(must.label, 'MUST');
  assert.equal(must.fill, 'hsla(10,90%,62%,0.5)', 'your hue at .5 — the crew marks’ own fill');
  assert.equal(must.stroke, '#fff', 'the white edge that means you');
  // Never the brand or the festival accent: it is your colour.
  assert.equal(/brand|fest/.test(JSON.stringify(must)), false);
  const chips = aboutCorner({ noteCount: 2, spotify: { songs: 41, followed: true }, you: p(M, 2) });
  assert.deepEqual(chips.map((c) => c.kind), ['meter', 'notes', 'spotify'], 'you sit at the corner’s edge, the same place on every card');
  assert.equal(chips[0].fill, 'hsla(221,90%,62%,0.5)');
  assert.deepEqual(aboutCorner({ you: p(K, 0) }), []);
});

// The two corners share one bottom edge. Widths below are the real ones
// measured in Chromium (claude-plans/2026-09-23-meter-build.md); the order is
// the one fitCorners documents, least lost first.
test('fit: everything stays while it fits, and a card with no width yet keeps everything', () => {
  const people = [p(K, 4), p(M, 4), p(J, 4), p(S, 1), { name: 'Pat', colorIndex: 4, level: 2 }, { name: 'Quinn', colorIndex: 5, level: 1 }];
  const about = aboutCorner({ noteCount: 12, spotify: { songs: 41, followed: true }, you: people[0] });
  for (const w of [undefined, 0, -2, NaN]) assert.equal(fitCorners({ people, about }, w).step, 0, `width ${w}`);
  const roomy = fitCorners({ people, about }, 400);
  assert.equal(roomy.step, 0);
  assert.equal(roomy.spotCount && roomy.spot && roomy.notes, true);
  assert.deepEqual(roomy.marks.map((m) => m.kind), ['must', 'must', 'pick', 'pick', 'ghost']);
});

test('fit: a crowded card gives way in order — Spotify count, ticks, Spotify pill, musts, the +n, notes — and keeps your meter', () => {
  const people = [p(K, 4), p(M, 4), p(J, 4), p(S, 1), { name: 'Pat', colorIndex: 4, level: 2 }, { name: 'Quinn', colorIndex: 5, level: 1 }];
  const about = aboutCorner({ noteCount: 12, spotify: { songs: 41, followed: true }, you: people[0] });
  const kinds = (f) => f.marks.map((m) => m.kind).join(' ');
  const ghost = (f) => (f.marks.find((m) => m.kind === 'ghost') || { label: '' }).label;
  let last = -1;
  const seen = [];
  for (let w = 240; w >= 20; w--) {
    const f = fitCorners({ people, about }, w);
    assert.ok(f.step >= last, `narrower never gives back (${w}px)`);
    if (f.step !== last) seen.push(f.step);
    last = f.step;
    if (f.step < GIVE_WAY.length - 1) assert.ok(f.need <= w, `step ${f.step} fits ${w}px`);
    // The +n always tells the truth about the others it stands for.
    const drawn = f.marks.filter((m) => m.kind !== 'ghost').length;
    if (f.crew) assert.equal(drawn + Number(ghost(f).slice(1) || 0), 5);
  }
  const at = (step) => fitCorners({ people, about }, Math.ceil(needAt({ people, about }, step)));
  assert.equal(at(1).spotCount, false); assert.equal(at(1).spot, true);
  assert.equal(kinds(at(2)), 'must must pick ghost'); assert.equal(ghost(at(2)), '+2');
  assert.equal(kinds(at(3)), 'must must ghost'); assert.equal(ghost(at(3)), '+3');
  assert.equal(at(4).spot, false);
  assert.equal(kinds(at(5)), 'must ghost');
  assert.equal(kinds(at(6)), 'ghost'); assert.equal(ghost(at(6)), '+5');
  assert.equal(at(7).crew, false); assert.deepEqual(at(7).marks, []);
  assert.equal(at(8).notes, false);
  // The meter is in the about corner at every step that has a width to hold it.
  for (let s = 0; s < GIVE_WAY.length - 1; s++) assert.equal(at(s).about[0].kind, 'meter');
  // With nothing in the band, it goes only on a card narrower than itself.
  assert.equal(fitCorners({ people, about }, 43).meter, true, 'MUST alone fits 43px');
  assert.equal(fitCorners({ people, about }, 30).meter, false);
});

test('fit: a name that runs down into a cell’s band is never covered — the corners fit around it, and only there does your meter step back', () => {
  const solo = { people: [p(K, 2)], about: aboutCorner({ you: p(K, 2) }) };
  const cell = { cell: true };
  // Half a column (padding box 85) with a two-line name whose second line
  // ("Seven", 36px) sits in the band: the meter (22.5) cannot sit beside it.
  const wide = fitCorners(solo, 85, { ...cell, middle: 36, name: 36 });
  assert.equal(wide.time, false, 'the time steps back first');
  assert.equal(wide.meter, false, 'then, the name being uncuttable, your meter');
  // A short second line ("Of", 14px) leaves room: the meter stays.
  const short = fitCorners(solo, 85, { ...cell, middle: 36, name: 14 });
  assert.equal(short.meter, true);
  assert.ok(short.need <= 85);
  // A full column's 30-minute cell with a two-line name keeps the meter.
  assert.equal(fitCorners(solo, 174, { ...cell, middle: 36, name: 90 }).meter, true);
});

test('fit: a 30-minute cell fits its corners around the start time, and a lane too narrow for your meter beside it lets the time go', () => {
  const people = [p(K, 4), p(M, 4), p(J, 4), p(S, 1), { name: 'Pat', colorIndex: 4, level: 2 }];
  const about = aboutCorner({ noteCount: 2, spotify: { songs: 7, followed: true }, you: people[0] });
  const cell = { cell: true };
  // A phone column's cell (padding box 174) with "7:00 PM" (36px) in the band.
  const open = fitCorners({ people, about }, 174, cell);
  const around = fitCorners({ people, about }, 174, { ...cell, middle: 36 });
  assert.ok(around.step > open.step, `the time costs the crowd room (${open.step} → ${around.step})`);
  assert.equal(around.time, true, 'and the time stays');
  // Each corner keeps to its own side of the time, with air to spare.
  assert.ok(around.need <= 174);
  // Only you, in half a column (2 lanes at 390: 87px, padding box 85): the
  // meter fits beside nothing, so the time steps back rather than sit under it.
  const solo = { people: [p(K, 4)], about: aboutCorner({ you: p(K, 4) }) };
  const lane = fitCorners(solo, 85, { ...cell, middle: 36 });
  assert.equal(lane.time, false);
  assert.equal(lane.about[0].kind, 'meter');
  // With no time in the band (a taller cell), nothing gives way at all.
  assert.equal(fitCorners(solo, 85, cell).step, 0);
  // A full column's 30-minute cell keeps its time beside your meter.
  assert.equal(fitCorners(solo, 174, { ...cell, middle: 36 }).step, 0);
});

test('fit: the phone column carries a crowded card with nothing folded but what it must; a grid cell measures tighter', () => {
  // 390px phone: --col-w is (390 - 2*14 - 6)/2 = 178, so a card's padding box is 176.
  const people = [p(K, 3), p(M, 4), p(S, 1), { name: 'Pat', colorIndex: 4, level: 2 }];
  const about = aboutCorner({ noteCount: 2, spotify: { songs: 7 }, you: people[0] });
  assert.equal(fitCorners({ people, about }, 176).step, 0, 'meter, notes, Spotify, a must and two ticks fit a phone card');
  // The same card as a grid cell draws smaller chips, so it needs less.
  assert.ok(needAt({ people, about }, 0, { cell: true }) < needAt({ people, about }, 0));
  // Only your meter, on the narrowest lane-split cell (a third of a 143px column).
  const solo = { people: [p(K, 4)], about: aboutCorner({ you: p(K, 4) }) };
  assert.equal(fitCorners(solo, 44, { cell: true }).step, 0, 'MUST alone fits a 44px-wide cell');
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
