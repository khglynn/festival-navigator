// A dated show carries its DATE and its VENUE through the card's identity
// (MODEL-V4 §2 + §6: a section entry carries `night` xor `date`, plus
// `venue`, and "the structured pair wins when present").
//
// The bug this pins: ACL's 63 Fest Nights entries have a date, a venue and
// doors and no stage string at all, so an occurrence built from `day · stage ·
// time · weekend` was IDENTICAL for both of an artist's two late nights —
// Jess Williamson plays Oct 1 at Stubb's AND Oct 8 at The Continental Club,
// and one card's zoom could only ever tell the other card's story. A wrong
// fact is worse than a missing one, so the occurrence carries the whole
// identity and every derivation reads the structured fields first.
//
// Read from the SHIPPED festival file, never a hand fixture: the point is
// that the app tells the truth about the data we actually deploy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="wall-root"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.cancelAnimationFrame = () => {};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderWall, refreshCard, cardFor } = await import('../js/v3/wall.js');
const facts = await import('../js/v3/card-facts.js');
const { occOf, findEventEntry } = await import('../js/v3/events.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const acl = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));

const TOKEN = 'datedocctoken_0123456789';
FESTIVAL_INDEX.push({ id: 'acl-2026', status: 'scheduled' }, { id: 'portola-2026', status: 'scheduled' });
FESTIVALS['acl-2026'] = acl;
FESTIVALS['portola-2026'] = portola;
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 } },
  festivals: { 'acl-2026': { selections: {} }, 'portola-2026': { selections: {} } },
  affinity: {},
}, 'acl-2026');

const ctxFor = (fid, over = {}) => {
  const ctx = {
    fid, meName: 'Kevin', affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
    filterPeople: [], folded: [], now: new Date('2026-01-01T12:00:00'),
    taps: [], opened: [],
    picks: model.picksFor(state.crewDoc, fid),
    onOpenNotes: (a) => ctx.opened.push(a), onNotesChange: null, onOpenDayNotes: () => {},
    ...over,
  };
  ctx.onTap = over.onTap || ((artist, el) => { ctx.taps.push(artist); return refreshCard(el, artist, ctx); });
  return ctx;
};
const render = (fid, over = {}) => {
  state.setActiveFestivalId(fid);
  const root = document.getElementById('wall-root');
  const ctx = ctxFor(fid, over);
  renderWall(root, ctx);
  return { root, ctx };
};

// The two nights this whole file is about, straight out of the shipped file.
const lateNight = (name, date) => acl.artists.find((a) => a.name === name && a.day === 'Late nights' && a.date === date);
const JESS_1 = lateNight('Jess Williamson', '2026-10-01');
const JESS_8 = lateNight('Jess Williamson', '2026-10-08');
const BUNT_2 = lateNight('BUNT.', '2026-10-02');
const BUNT_9 = lateNight('BUNT.', '2026-10-09');

test('the shipped file really does bill one artist on two nights in two rooms', () => {
  for (const e of [JESS_1, JESS_8, BUNT_2, BUNT_9]) assert.ok(e, 'the pinned late-night entries are still in acl-2026.json');
  assert.equal(JESS_1.venue, "Stubb's");
  assert.equal(JESS_8.venue, 'The Continental Club');
  assert.equal(BUNT_2.venue, 'Emo\'s');
  assert.equal(BUNT_9.venue, 'The Concourse Project');
  // The map doors the whole fix exists to reach.
  for (const e of [JESS_1, JESS_8, BUNT_2, BUNT_9]) assert.ok(acl.venues[e.venue], `venues{} knows ${e.venue}`);
});

// ---- the occurrence ----------------------------------------------------------------

test('occOf carries the date and the venue, so two late nights are two occurrences', () => {
  const a = occOf(JESS_1);
  const b = occOf(JESS_8);
  // Each night carries its own start as well (posted since 2026-09-26: Stubb's
  // opener at its printed 8 PM show, the Continental Club's printed 10 PM).
  assert.deepEqual(a, { day: 'Late nights', stage: null, time: '8 PM', weekend: null, date: '2026-10-01', venue: 'Stubb\'s' });
  assert.deepEqual(b, { day: 'Late nights', stage: null, time: '10 PM', weekend: null, date: '2026-10-08', venue: 'The Continental Club' });
  assert.notEqual(JSON.stringify(a), JSON.stringify(b), 'the identity the wall writes into data-occ differs');
  assert.notEqual(JSON.stringify(occOf(BUNT_2)), JSON.stringify(occOf(BUNT_9)));
});

test('a weekday entry keeps the stage string it always had — nothing legacy moves', () => {
  const vtss = portola.artists.find((a) => a.name === 'VTSS' && a.day === 'Afters');
  assert.deepEqual(occOf(vtss), {
    day: 'Afters', stage: 'Sun · The Midway', time: '11:30 PM', weekend: null,
    date: null, venue: 'The Midway',
  });
  // A file that only carries the structured pair still synthesizes the stage.
  assert.equal(occOf({ day: 'Afters', night: 'Sat', venue: 'The Room' }).stage, 'Sat · The Room');
});

test('findEventEntry resolves each night to its OWN entry', () => {
  assert.equal(findEventEntry(acl, 'Jess Williamson', occOf(JESS_1)), JESS_1);
  assert.equal(findEventEntry(acl, 'Jess Williamson', occOf(JESS_8)), JESS_8);
  assert.equal(findEventEntry(acl, 'BUNT.', occOf(BUNT_2)), BUNT_2);
  assert.equal(findEventEntry(acl, 'BUNT.', occOf(BUNT_9)), BUNT_9);
  // Jess also plays Zilker on the Sunday — the grid billing is a third
  // occurrence and none of the three may answer for another.
  const billing = acl.artists.find((a) => a.name === 'Jess Williamson' && a.day === 'Sunday');
  assert.ok(billing);
  assert.notEqual(findEventEntry(acl, 'Jess Williamson', occOf(JESS_1)), billing);
  // A legacy occurrence (an old route key, a caller that never knew about
  // dates) still matches the way it always did: a missing field asks nothing.
  const legacy = { day: 'Afters', stage: 'Sun · The Midway', time: '11:30 PM', weekend: null };
  assert.equal(findEventEntry(portola, 'VTSS', legacy), portola.artists.find((a) => a.name === 'VTSS' && a.day === 'Afters'));
});

// ---- the facts -----------------------------------------------------------------------

test('factsFor tells each late night its own truth: the right venue, the right door, the right date', () => {
  const ctx = ctxFor('acl-2026');
  state.setActiveFestivalId('acl-2026');
  const one = facts.factsFor('Jess Williamson', ctx, occOf(JESS_1));
  // The room's window (MODEL-V3 §5): Stubb's outdoor show is over by the 10 PM
  // after-show indoors — an evidenced guess, so the close wears the tilde.
  assert.equal(one.when, 'Thu · Oct 1 · Runs 7 PM – ~10 PM');
  assert.equal(one.where, 'Stubb\'s');
  assert.equal(one.mapUrl, acl.venues['Stubb\'s']);
  const two = facts.factsFor('Jess Williamson', ctx, occOf(JESS_8));
  assert.equal(two.when, 'Thu · Oct 8 · Runs 9 PM – 11:30 PM', 'a printed window: no tilde');
  assert.equal(two.where, 'The Continental Club');
  assert.equal(two.mapUrl, acl.venues['The Continental Club']);
  assert.notEqual(one.where, two.where, 'the whole point: one card can never print the other room');

  const b2 = facts.factsFor('BUNT.', ctx, occOf(BUNT_2));
  const b9 = facts.factsFor('BUNT.', ctx, occOf(BUNT_9));
  // Emo's publishes no close, so its window is a guess: the hall's midnight,
  // stretched to BUNT.'s planned set (10:45 PM + 90). The Concourse prints its
  // 9 PM – 2 AM on the night's own ticket page.
  assert.equal(b2.when, 'Fri · Oct 2 · Runs 9 PM – ~12:15 AM');
  assert.equal(b2.where, 'Emo\'s');
  assert.equal(b9.when, 'Fri · Oct 9 · Runs 9 PM – 2 AM');
  assert.equal(b9.where, 'The Concourse Project');
});

test('a Portola run card\'s facts are byte-for-byte what they were', () => {
  const ctx = ctxFor('portola-2026');
  state.setActiveFestivalId('portola-2026');
  const vtss = portola.artists.find((a) => a.name === 'VTSS' && a.day === 'Afters');
  const f = facts.factsFor('VTSS', ctx, occOf(vtss));
  assert.equal(f.when, 'Sun · Runs 10 PM – ~3 AM');
  assert.equal(f.where, 'The Midway');
  assert.equal(f.mapUrl, portola.venues['The Midway']);
  assert.equal(f.approx, true);
  assert.deepEqual(f.order, { text: 'Guessing they’re 2nd of 4', url: vtss.order.source, confirmed: false });
  // And through a legacy occurrence — the pre-fix shape — the same answers.
  const legacy = facts.factsFor('VTSS', ctx, { day: 'Afters', stage: 'Sun · The Midway', time: '11:30 PM', weekend: null });
  assert.equal(legacy.when, f.when);
  assert.equal(legacy.where, f.where);
  assert.equal(legacy.mapUrl, f.mapUrl);
  state.setActiveFestivalId('acl-2026');
});

test('the artist sheet\'s header for a dated occurrence shows the venue as a map door, and no notes chip', () => {
  const ctx = ctxFor('acl-2026');
  state.setActiveFestivalId('acl-2026');
  const header = facts.sheetCard(facts.factsFor('Jess Williamson', ctx, occOf(JESS_8)), { onClose: () => {}, notesChip: false });
  assert.equal(header.querySelector('.f-sub').textContent, 'Thu · Oct 8 · Runs 9 PM – 11:30 PM');
  const door = header.querySelector('a.f-where');
  assert.ok(door, 'the venue is a door, not a missing line');
  assert.equal(door.textContent, 'The Continental Club');
  assert.equal(door.getAttribute('href'), acl.venues['The Continental Club']);
  assert.equal(header.querySelector('.f-chip.notes'), null, 'the sheet IS the thread (MODEL-V4 §4)');
});

// ---- the wall ------------------------------------------------------------------------

const lateCards = (root, artist) => [...root.querySelectorAll('.venue-grid .card')].filter((c) => c.dataset.artist === artist
  && (JSON.parse(c.dataset.occ || '{}').day === 'Late nights'));

test('the wall gives an artist\'s two late nights two cards with two identities', () => {
  const { root, ctx } = render('acl-2026');
  const cards = lateCards(root, 'Jess Williamson');
  assert.equal(cards.length, 2, 'both nights are on the wall');
  assert.notEqual(cards[0].dataset.occ, cards[1].dataset.occ, 'and they are not the same card twice');
  const occs = cards.map((c) => JSON.parse(c.dataset.occ));
  assert.deepEqual(occs.map((o) => [o.date, o.venue]), [['2026-10-01', 'Stubb\'s'], ['2026-10-08', 'The Continental Club']]);
  // Each card comes back as itself.
  for (const [i, occ] of occs.entries()) assert.equal(cardFor(root, 'Jess Williamson', occ), cards[i]);
  // And each is under its own date's head — a room per date, its venue grid
  // carrying the date the now mark reads.
  const dateOfCard = (card) => card.closest('.venue-grid').dataset.iso;
  assert.deepEqual(cards.map(dateOfCard), ['2026-10-01', '2026-10-08']);
  const headOfCard = (card) => card.closest('.room').querySelector(':scope > .room-head .name').textContent;
  assert.deepEqual(cards.map(headOfCard), ['THU LATE NIGHTS', 'THU LATE NIGHTS'], 'two Thursdays, a week apart');
  const subOfCard = (card) => card.closest('.room').querySelector(':scope > .room-head .sub').textContent;
  assert.deepEqual(cards.map(subOfCard).map((s) => s.split(' · ')[0]), ['Oct 1', 'Oct 8'], 'and each head says which');
  // The zoom on each card reads its own room.
  const seen = cards.map((card) => {
    const occ = JSON.parse(card.dataset.occ);
    return facts.factsFor('Jess Williamson', ctx, occ).where;
  });
  assert.deepEqual(seen, ['Stubb\'s', 'The Continental Club']);
});

test('a repaint puts the zoom back on the night it was on', () => {
  const { root, ctx } = render('acl-2026');
  const second = lateCards(root, 'Jess Williamson')[1];
  assert.equal(JSON.parse(second.dataset.occ).date, '2026-10-08');
  facts.zoomCard(second, 'Jess Williamson', ctx, { occ: JSON.parse(second.dataset.occ), instant: true });
  const keep = facts.zoomSnapshot();
  assert.ok(keep, 'the zoom is standing');
  facts.unzoom({ instant: true, why: 'wall repaint' });
  const after = render('acl-2026');
  const again = cardFor(after.root, keep.artist, keep.occ);
  assert.ok(again, 'the card came back');
  assert.equal(JSON.parse(again.dataset.occ).date, '2026-10-08', 'the SAME night, not its twin');
  assert.equal(again, lateCards(after.root, 'Jess Williamson')[1]);
  assert.equal(facts.factsFor('Jess Williamson', after.ctx, keep.occ).where, 'The Continental Club');
});

test('the route key round-trips a dated occurrence, so a reload reopens the right night', async () => {
  const { encodeNotesKey, decodeNotesKey } = await import('../js/v3/router.js');
  const occ = occOf(JESS_8);
  const back = decodeNotesKey(encodeNotesKey('Jess Williamson', occ));
  assert.equal(back.artist, 'Jess Williamson');
  assert.deepEqual(back.occ, occ);
  const ctx = ctxFor('acl-2026');
  state.setActiveFestivalId('acl-2026');
  assert.equal(facts.factsFor('Jess Williamson', ctx, back.occ).where, 'The Continental Club');
  // One thread per artist wherever they play: the occurrence only picks which
  // card heads the sheet, it is never part of the note key.
  assert.equal(model.noteCount(state.crewDoc, 'acl-2026', 'artist', 'Jess Williamson'), 0);
});

test('a search finds both nights too — a card in a list is the same card as the one on the wall', () => {
  const { root, ctx } = render('acl-2026', { query: 'jess williamson' });
  const cards = [...root.querySelectorAll('.card[data-artist="Jess Williamson"]')]
    .filter((c) => JSON.parse(c.dataset.occ || '{}').day === 'Late nights');
  assert.equal(cards.length, 2, 'a search answers "where and when" for both nights');
  const occs = cards.map((c) => JSON.parse(c.dataset.occ));
  assert.deepEqual(occs.map((o) => [o.date, o.venue]), [['2026-10-01', "Stubb's"], ['2026-10-08', 'The Continental Club']]);
  assert.deepEqual(occs.map((o) => facts.factsFor('Jess Williamson', ctx, o).where), ["Stubb's", 'The Continental Club']);
});
