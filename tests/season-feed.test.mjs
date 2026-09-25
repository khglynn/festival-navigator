// The Austin season feed's judgment calls (2026-09-25), each pinned to the
// real listing that taught it. The feed (scripts/season-feed.mjs) merges
// Do512, JamBase and Ticketmaster into data/festivals/austin.json, and every
// name it writes becomes a pick key that can never be renamed, so a wrong
// merge or a wrong split is permanent. These run offline: no source is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  keyOf, venueName, headlinerFromTitle, tidyHeadliner, nightOf, ticketsOf,
  nearName, mergeShows, clampName,
} from '../scripts/season-feed.mjs';

const show = (o) => ({ date: '2026-10-02', venue: 'Mohawk', title: o.headliner, with: [], ...o });

test('one headliner in one room on one night is one show, whatever the two clocks say', () => {
  // Do512 printed the doors (7 PM), Ticketmaster the start (8 PM): the trial
  // run of 2026-09-25 had "Fcukers 7 PM / Fcukers 8 PM" as two cards.
  const out = mergeShows([
    show({ source: 'do512', id: '1', headliner: 'Fcukers', time: '7 PM', page: { url: 'https://do512.com/x', at: 'Do512' } }),
    show({ source: 'ticketmaster', id: 't1', headliner: 'Fcukers', time: '8 PM', presales: [] }),
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual(Object.keys(out[0].sources).sort(), ['do512', 'ticketmaster']);
});

test('one source listing an early and a late show keeps two shows, and each pairs with its own time', () => {
  const out = mergeShows([
    show({ source: 'do512', id: 'e', headliner: 'Matt Mathews', time: '7 PM' }),
    show({ source: 'do512', id: 'l', headliner: 'Matt Mathews', time: '10:15 PM' }),
    show({ source: 'ticketmaster', id: 'tl', headliner: 'Matt Mathews', time: '10:15 PM', tickets: { url: 'https://www.ticketmaster.com/l', at: 'Ticketmaster' } }),
  ]);
  assert.equal(out.length, 2);
  const late = out.find((s) => s.time === '10:15 PM');
  assert.equal(late.sources.ticketmaster, 'tl', 'the late listing joins the late show');
  assert.equal(out.find((s) => s.time === '7 PM').sources.ticketmaster, undefined);
});

test('two sources spelling one act differently in one room merge; different acts do not', () => {
  assert.equal(nearName(keyOf('Gable Price'), keyOf('Gable Price And Friends')), true);
  assert.equal(nearName(keyOf('Joy Oladukun'), keyOf('Joy Oladokun')), true);
  assert.equal(nearName(keyOf('Alaska Thunderfuck'), keyOf('Alaska Thunderf**k')), true);
  assert.equal(nearName(keyOf('Chat Pile'), keyOf('Virga')), false);
  // Short names are never fuzzy: one letter apart is a different band.
  assert.equal(nearName(keyOf('Muna'), keyOf('Mura')), false);
});

test('a source listing one show twice at the same minute is one show', () => {
  const out = mergeShows([
    show({ source: 'jambase', id: 'a', headliner: 'Alaska Thunderfuck', time: '8 PM' }),
    show({ source: 'jambase', id: 'b', headliner: 'Alaska Thunderf**k', time: '8 PM' }),
  ]);
  assert.equal(out.length, 1);
});

test('two rooms or two nights are never merged', () => {
  const out = mergeShows([
    show({ source: 'do512', id: '1', headliner: 'ZHU', time: '9 PM', date: '2026-10-23' }),
    show({ source: 'ticketmaster', id: '2', headliner: 'ZHU', time: '9 PM', date: '2026-10-25' }),
    show({ source: 'ticketmaster', id: '3', headliner: 'ZHU', time: '9 PM', date: '2026-10-23', venue: "Stubb's" }),
  ]);
  assert.equal(out.length, 3);
});

test('what a listing adds to a name comes off, so night 2 shares night 1\'s pick', () => {
  assert.equal(tidyHeadliner('ZHU (Night 1) at The Concourse Project', 'Concourse Project'), 'ZHU');
  assert.equal(tidyHeadliner('Bob Schneider (Early Show)', 'Antone\'s'), 'Bob Schneider');
  // "at" that is not the room stays: it is part of the name.
  assert.equal(tidyHeadliner('Live at the Apollo Revue', 'Mohawk'), 'Live at the Apollo Revue');
  assert.equal(headlinerFromTitle('Official 2026 ACL Nights: Bleachers w/ Montclair'), 'Bleachers');
});

test('the sources\' spellings of a room land on one location', () => {
  assert.equal(venueName('The Mohawk-Austin'), 'Mohawk');
  assert.equal(venueName('Mohawk Austin'), 'Mohawk');
  assert.equal(venueName('Radio East'), 'Radio/East');
  assert.equal(venueName('ACL Live at The Moody Theater'), 'ACL Live');
  assert.equal(venueName('13th floor'), '13th Floor');
});

test('an after-midnight start belongs to the night before', () => {
  assert.equal(nightOf('2026-10-03', '01:30'), '2026-10-02');
  assert.equal(nightOf('2026-10-03', '21:00'), '2026-10-03');
});

test('a ticket link names its seller, and resale sites are not sellers', () => {
  assert.deepEqual(ticketsOf('http://www.ticketmaster.com/event/1'), { url: 'https://www.ticketmaster.com/event/1', at: 'Ticketmaster' });
  assert.equal(ticketsOf('https://www.stubhub.com/x'), null);
  assert.equal(ticketsOf('not a url'), null);
});

test('a name longer than a pick key may be is cut at a word', () => {
  const long = `${'Word '.repeat(30)}End`;
  const cut = clampName(long);
  assert.ok(cut.length <= 100);
  assert.ok(!cut.endsWith(' '));
  assert.equal(clampName('MUNA'), 'MUNA');
});
