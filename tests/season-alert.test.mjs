// The season alert (scripts/season-alert.mjs, 2026-09-25): which upcoming
// Austin shows go to a person, and the Slack message that carries them. The
// message rules are the shared design's
// (claude-plans/2026-09-24-analytics/slack-alert-design.md §0).
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchShows, buildMessage, calendarUrl, austinInstant } from '../scripts/season-alert.mjs';

const fest = {
  name: 'Austin',
  artists: [
    { name: 'Four Tet', date: '2026-10-31', time: '9 PM', venue: 'Concourse Project', tickets: { url: 'https://www.eventim.us/x', at: 'Eventim' } },
    { name: 'John Summit', date: '2026-11-06', time: '7 PM', venue: 'Moody Center', with: ['Alok', 'Jackie Hollander'] },
    { name: 'Old Show', date: '2026-09-01', time: '8 PM', venue: 'Mohawk' },
    { name: 'Robyn', date: '2026-12-01', time: '8 PM', venue: 'ACL Live', cancelled: { on: '2026-09-25' } },
    { name: 'Someone Else', date: '2026-12-02', time: '8 PM', venue: 'Mohawk' },
  ],
};
const loved = [
  { name: 'Four Tet', why: 'you picked them at Portola 2026' },
  { name: 'jackie hollander', why: 'you picked them at Electric Forest 2026' },
  { name: 'Old Show', why: 'x' }, { name: 'Robyn', why: 'x' },
];

test('a loved headliner or a loved act on the bill counts; past and cancelled shows never do', () => {
  const m = matchShows(fest, loved, '2026-09-25');
  assert.deepEqual(m.map((x) => x.show.name), ['Four Tet', 'John Summit']);
  assert.equal(m[1].via, 'Jackie Hollander', 'the bill names the loved act as the show spells it');
});

test('nothing to say sends nothing', () => {
  assert.equal(buildMessage(fest, []), null);
});

test('the message leads with the app, keeps typed names in plain_text, and leaves out empty fields', () => {
  const msg = buildMessage(fest, matchShows(fest, loved, '2026-09-25'), new Date('2026-09-25T12:00:00Z'));
  assert.match(msg.text, /^Festival Navigator · Austin: Four Tet/);
  assert.match(msg.blocks[0].text.text, /^Festival Navigator · Austin: 2 shows/);
  const sections = msg.blocks.filter((b) => b.type === 'section');
  assert.ok(sections.every((b) => b.text.type === 'plain_text'));
  assert.equal(sections[0].accessory.text.text, 'Tix @ Eventim');
  assert.equal(sections[1].accessory, undefined, 'no tickets, no button');
  const facts = msg.blocks.filter((b) => b.type === 'context').map((b) => b.elements[0].text);
  assert.ok(facts.every((t) => t.includes('|Add to calendar>')));
  assert.ok(!facts.join(' ').includes('undefined'));
});

test('a future on-sale time uses Slack\'s date token; a past one is not mentioned', () => {
  const show = { ...fest.artists[0], onSale: '2026-10-02T15:00:00Z' };
  const f2 = { name: 'Austin', artists: [show] };
  const before = buildMessage(f2, matchShows(f2, loved, '2026-09-25'), new Date('2026-09-25T12:00:00Z'));
  assert.match(before.blocks[2].elements[0].text, /on sale <!date\^\d+\^/);
  const after = buildMessage(f2, matchShows(f2, loved, '2026-09-25'), new Date('2026-10-03T12:00:00Z'));
  assert.doesNotMatch(after.blocks[2].elements[0].text, /on sale/);
});

test('calendar times are Austin wall-clock times, right on both sides of the DST change', () => {
  assert.equal(austinInstant('2026-10-31', 21 * 60).toISOString(), '2026-11-01T02:00:00.000Z'); // CDT
  assert.equal(austinInstant('2026-12-12', 21 * 60).toISOString(), '2026-12-13T03:00:00.000Z'); // CST
  const allDay = new URL(calendarUrl({ name: 'Freaky Deaky', venue: 'Expo Center', date: '2026-10-30' }, 'Expo Center, Austin, TX'));
  assert.equal(allDay.searchParams.get('dates'), '20261030/20261031', 'no time is an all-day event, never a guessed hour');
});
