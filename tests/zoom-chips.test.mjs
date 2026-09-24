// The zoom's who-row as blended chips (Kevin, 2026-09-23: "cool blended chips
// if multiple people have the same vote ... in a wrapping row rather than a
// stack"; then "aura and names — best mix of style and clarity").
//
// ONE chip per level anyone chose — MUST, then three bars, two, one — loudest
// first, in one wrapping row. A chip's fill is the card's own aura mix of the
// people at that level (one person alone is just their colour); its level is
// the card meter's own glyph; its people are first names, You first, two at
// most and then "+n"; the aria-label names everyone. The chip you are in wears
// `.you` (the white edge). Canvas: claude-plans/2026-09-23-rating-canvas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRig } from './helpers/zoom-rig.mjs';

const rig = await makeRig();
const { state, zoom, makeCtx, FID } = rig;
const aura = await import('../js/v3/aura.js');
const { hslOf } = await import('../js/v3/palette.js');

// A crew of fifteen, in the order they joined. Kevin is you.
const CREW = ['Kevin', 'Drew', 'Maya Lopez', 'Nhu', 'Kat', 'Pegah', 'Gus', 'Hal', 'Ivy', 'Jo', 'Lou', 'Max', 'Nia', 'Oli', 'Rae'];
for (const [i, n] of CREW.entries()) state.crewDoc.people[n] = { colorIndex: i };
const person = (name, level) => ({ name, level, colorIndex: CREW.indexOf(name), isYou: name === 'Kevin' });

test('one chip per level anyone chose, loudest first; you lead your own chip', () => {
  // The order factsFor hands over: musts first, then picks in picking order.
  const people = aura.ordered([person('Drew', 4), person('Maya Lopez', 2), person('Kevin', 2), person('Nhu', 1), person('Kat', 4)]);
  const chips = zoom.whoChips(people);
  assert.deepEqual(chips.map((c) => c.level), [4, 2, 1], 'MUST, then two bars, then one — no empty level gets a chip');
  assert.deepEqual(chips[1].members.map((p) => p.name), ['Kevin', 'Maya Lopez'], 'you first, then the others');
  assert.deepEqual(chips[0].members.map((p) => p.name), ['Drew', 'Kat']);
  assert.deepEqual(chips.map((c) => c.you), [false, true, false], 'only the chip you are in is yours');
});

test('the others sit alphabetically — never in the doc\'s key order, which the server rewrites', () => {
  // Postgres jsonb stores keys shortest-first, so the order picks arrive in
  // is not the order people picked in, and a local pick and its echo could
  // disagree. Alphabetical is the same on every device, every render.
  const chips = zoom.whoChips(aura.ordered([person('Nhu', 2), person('Drew', 2), person('Kat', 2), person('Kevin', 2)]));
  assert.deepEqual(chips[0].members.map((p) => p.name), ['Kevin', 'Drew', 'Kat', 'Nhu']);
  assert.deepEqual(chips[0].names, ['You', 'Drew']);
});

test('two members who share a first word are shown by their whole names', () => {
  const crew = ['Kevin', 'Drew Smith', 'Drew Jones', 'Nhu'];
  const p = (name, level) => ({ name, level, colorIndex: 0, isYou: name === 'Kevin' });
  const [chip] = zoom.whoChips([p('Drew Smith', 3), p('Drew Jones', 3), p('Nhu', 3)], crew);
  assert.deepEqual(chip.names, ['Drew Jones', 'Drew Smith'], 'not "Drew · Drew" — compared by name, never by object');
  const [solo] = zoom.whoChips([p('Nhu', 1)], crew);
  assert.deepEqual(solo.names, ['Nhu'], 'a first word nobody shares stays a first name');
  // The whole crew counts, not only the pickers: a Drew who did not pick
  // still makes the one who did ambiguous.
  const [alone] = zoom.whoChips([p('Drew Smith', 2)], crew);
  assert.deepEqual(alone.names, ['Drew Smith']);
});

test('names: first names, You for you, two at most and then +n', () => {
  const chips = zoom.whoChips(aura.ordered([person('Pegah', 3), person('Kevin', 3), person('Maya Lopez', 3), person('Nhu', 3), person('Kat', 1)]));
  assert.deepEqual(chips[0].names, ['You', 'Maya'], 'a first name only; "You" capitalised like a name');
  assert.equal(chips[0].more, 2, 'the rest fold into +n — the count is the people not named');
  assert.deepEqual(chips[1].names, ['Kat']);
  assert.equal(chips[1].more, 0, 'nobody left over, no +n');
});

test('the chip says everyone to a screen reader, in the app\'s own words', () => {
  const chips = zoom.whoChips(aura.ordered([person('Gus', 4), person('Hal', 4), person('Lou', 4), person('Kevin', 2), person('Jo', 2), person('Kat', 1)]));
  assert.equal(chips[0].label, 'Must: Gus, Hal and Lou', 'every name, even the ones folded into +n');
  assert.equal(chips[1].label, 'Picked ×2: You and Jo');
  assert.equal(chips[2].label, 'Picked: Kat');
});

test('the row: a list of chips, the glyph and the names hidden behind the label', () => {
  const facts = { people: aura.ordered([person('Drew', 4), person('Kevin', 2), person('Maya Lopez', 2), person('Nhu', 1)]) };
  const row = zoom.whoPills(facts);
  assert.ok(row.classList.contains('f-who'));
  assert.equal(row.getAttribute('role'), 'list');
  const chips = [...row.children];
  assert.equal(chips.length, 3);
  for (const c of chips) {
    assert.ok(c.classList.contains('f-pill'), 'every chip keeps .f-pill — the zoom\'s cascade and refresh key on it');
    assert.equal(c.getAttribute('role'), 'listitem');
    assert.ok(c.getAttribute('aria-label'), 'and says who is in it');
    for (const inner of c.children) assert.equal(inner.getAttribute('aria-hidden'), 'true', 'the glyph and the names are for the eye; the label speaks');
  }
  assert.deepEqual(chips.map((c) => c.dataset.level), ['4', '2', '1']);
  assert.deepEqual(chips.map((c) => c.classList.contains('you')), [false, true, false], '.you (the white edge) on your chip only');
});

test('the level is the card meter\'s own glyph: lit bars, and MUST as the word', () => {
  const row = zoom.whoPills({ people: aura.ordered([person('Drew', 4), person('Kevin', 2), person('Nhu', 1)]) });
  const [must, two, one] = row.children;
  assert.equal(must.querySelector('.must').textContent, 'MUST');
  assert.equal(must.querySelector('.bars'), null, 'MUST is a word, not a full meter');
  assert.equal(two.querySelectorAll('.bars .bar').length, 3, 'the three bars, as on the card');
  assert.equal(two.querySelectorAll('.bars .bar.on').length, 2, 'two lit for picked ×2');
  assert.equal(one.querySelectorAll('.bars .bar.on').length, 1);
});

test('the fill is the card\'s aura mix of the people at that level; one person alone is their colour, as bright as their level', () => {
  const people = aura.ordered([person('Drew', 3), person('Maya Lopez', 3), person('Kevin', 1)]);
  const row = zoom.whoPills({ people });
  const [three, one] = row.children;
  const pair = people.filter((p) => p.level === 3);
  // The DOM normalises colours as it stores them, so compare like with like:
  // the value the chip should wear, put through the same style serialiser.
  const as = (bg) => { const probe = rig.document.createElement('span'); probe.style.background = bg; return probe.style.background; };
  const fillOf = (c) => c.querySelector(':scope > .f-fill');
  assert.equal(fillOf(three).style.background, as(`${aura.auraLayers(pair)}, rgba(12, 10, 20, .28)`), 'exactly the card\'s radial layers for those two, at that level\'s brightness, over the scrim');
  assert.match(fillOf(three).style.background, /radial-gradient/);
  const solo = hslOf(CREW.indexOf('Kevin'), 0.45);
  assert.equal(fillOf(one).style.background, as(`linear-gradient(${solo}, ${solo}), rgba(12, 10, 20, .28)`), 'alone at one bar: your colour at that level\'s brightness, over the same scrim');
  const must = zoom.whoPills({ people: [person('Kevin', 4)] }).children[0];
  const deep = hslOf(CREW.indexOf('Kevin'), 0.85);
  assert.equal(fillOf(must).style.background, as(`linear-gradient(${deep}, ${deep}), rgba(12, 10, 20, .28)`), 'alone at MUST: the deepest glow');
  for (const c of [...row.children, must]) {
    assert.equal(c.style.background, '', 'the chip itself wears nothing: the fill layer does (so its width can be a scale)');
    assert.equal(fillOf(c).getAttribute('aria-hidden'), 'true');
    assert.doesNotMatch(fillOf(c).getAttribute('style'), /--fest/, 'never the festival accent');
  }
});

test('every name says whose it is, so a name can move as itself between chips', () => {
  const [chip] = zoom.whoPills({ people: aura.ordered([person('Kevin', 2), person('Drew', 2)]) }).children;
  const names = [...chip.querySelectorAll('.f-nm')];
  assert.deepEqual(names.map((n) => n.dataset.person), ['Kevin', 'Drew'], 'the real member name, not the shown one');
  assert.ok(names[0].classList.contains('you') && !names[1].classList.contains('you'));
  assert.deepEqual(JSON.parse(chip.dataset.people), ['Kevin', 'Drew'], 'the chip lists everyone in it, the +n folded ones too');
});

test('the aura layers are the card\'s own: auraBackground is those layers over the card base', () => {
  const people = [person('Drew', 4), person('Kevin', 2)];
  assert.equal(aura.auraBackground(people).background, `${aura.auraLayers(people)}, ${aura.CARD_BASE}`);
  assert.equal(aura.auraLayers([]), '');
  assert.deepEqual(aura.auraBackground([]), { background: aura.CARD_BASE, animated: false });
});

test('names are rendered as the chip lists them: two, then +n', () => {
  const people = aura.ordered(['Kevin', 'Gus', 'Hal', 'Ivy', 'Jo'].map((n) => person(n, 2)));
  const [chip] = zoom.whoPills({ people }).children;
  assert.deepEqual([...chip.querySelectorAll('.f-nm')].map((n) => n.textContent), ['You', 'Gus']);
  assert.equal(chip.querySelector('.f-more').textContent, '+3');
});

test('a crew of fifteen with thirteen in is four chips, never thirteen pills', () => {
  const levels = { Gus: 4, Hal: 4, Lou: 4, Drew: 3, 'Maya Lopez': 3, Jo: 3, Kevin: 2, Ivy: 2, Max: 2, Nhu: 2, Kat: 1, Pegah: 1, Oli: 1 };
  const people = aura.ordered(Object.entries(levels).map(([n, l]) => person(n, l)));
  const row = zoom.whoPills({ people });
  assert.equal(row.children.length, 4);
  assert.deepEqual([...row.children].map((c) => c.querySelector('.f-more')?.textContent || ''), ['+1', '+1', '+2', '+1']);
});

test('the zoom and the notes sheet header draw the same chips (one builder)', () => {
  const ctx = makeCtx();
  const facts = zoom.factsFor('GRiZ', ctx, null);
  const header = zoom.sheetCard(facts, { onClose: () => {} });
  const chips = [...header.querySelectorAll('.f-who .f-pill')];
  assert.deepEqual(chips.map((c) => c.dataset.level), ['4', '1'], 'Drew\'s MUST, then your one bar');
  assert.equal(chips[1].getAttribute('aria-label'), 'Picked: You');
  assert.equal(state.crewDoc.festivals[FID].selections.GRiZ.Drew, 4);
});
