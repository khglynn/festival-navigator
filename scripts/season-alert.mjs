#!/usr/bin/env node
// The season alert (v0, 2026-09-25): which upcoming Austin shows are by
// artists a person loves, as one Slack message. v0 runs once, by hand, to
// show the idea (claude-plans/2026-09-25-season-v0/PLAN.md); a schedule and
// "only what is new since last time" come later.
//
//   node scripts/season-alert.mjs --loved loved.json            # print the message
//   node scripts/season-alert.mjs --loved loved.json --post C…  # post it (SLACK_BOT_TOKEN)
//   … --post C… --update <ts>                                   # edit a message it posted
//
// loved.json is [{ "name": "Four Tet", "why": "picked at Portola 2026" }, …],
// read from the crew database by whoever runs it. It is personal, so it never
// lives in this repo.
//
// The message follows the shared Slack design
// (claude-plans/2026-09-24-analytics/slack-alert-design.md §0): the first
// words say which app, a field with nothing to say is left out, anything a
// source typed is plain_text, and a message with nothing in it is not sent.
// One difference, on purpose: a show's time prints in Austin time as plain
// text, because doors are at 8 PM in Austin wherever the reader is. On-sale
// and presale moments are absolute, so those use Slack's date token and read
// in the reader's own zone.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keyOf } from './season-feed.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TZ = 'America/Chicago';
const DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });

// "9 PM" / "7:30 PM" -> minutes after midnight, or null.
export function minutesOf(clock) {
  const m = String(clock || '').match(/^(\d{1,2})(?::(\d{2}))? (AM|PM)$/);
  return m ? ((Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2] || 0) : null;
}

// A wall-clock time in Austin as a UTC instant (DST-correct for that date).
export function austinInstant(dateIso, minutes) {
  const [y, mo, d] = dateIso.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const seen = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (seen - guess));
}

const gcal = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// Google Calendar's "add event" link. A show with no time is an all-day
// event, never a guessed hour; a timed show runs three hours.
export function calendarUrl(show, place) {
  const start = minutesOf(show.time);
  let dates;
  if (start == null) {
    const next = new Date(`${show.date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    dates = `${show.date.replace(/-/g, '')}/${next.toISOString().slice(0, 10).replace(/-/g, '')}`;
  } else {
    // The feed files a 1 AM set under the night before; the clock is the next morning.
    const t = new Date(austinInstant(show.date, start).getTime() + (start < 5 * 60 ? 864e5 : 0));
    dates = `${gcal(t)}/${gcal(new Date(t.getTime() + 3 * 3600e3))}`;
  }
  const details = [show.tickets && `Tickets: ${show.tickets.url}`, show.page && `Info: ${show.page.url}`].filter(Boolean).join('\n');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `${show.name} at ${show.venue}`, dates, location: place, ctz: TZ });
  if (details) q.set('details', details);
  return `https://calendar.google.com/calendar/render?${q}`;
}

// Loved artists' shows, soonest first. A show counts when the headliner is
// loved, or someone loved is on the bill (they get named).
export function matchShows(fest, loved, today) {
  const byKey = new Map(loved.map((l) => [keyOf(l.name), l]));
  const out = [];
  for (const a of fest.artists || []) {
    if (a.date < today || a.cancelled || a.unlisted) continue;
    const head = byKey.get(keyOf(a.name));
    const act = head ? null : (a.with || []).find((w) => byKey.has(keyOf(w)));
    const support = act ? byKey.get(keyOf(act)) : null;
    // The act is named as the show spells it; the reason is the person's.
    if (head || support) out.push({ show: a, why: (head || support).why, via: act || null });
  }
  return out.sort((x, y) => (x.show.date < y.show.date ? -1 : x.show.date > y.show.date ? 1 : (minutesOf(x.show.time) ?? 1440) - (minutesOf(y.show.time) ?? 1440)));
}

// mrkdwn needs & < > escaped; a link's URL must not carry | or >.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const link = (url, text) => `<${String(url).replace(/[|>\s]/g, encodeURIComponent)}|${esc(text)}>`;
const token = (iso, fallback) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? `<!date^${Math.floor(t / 1000)}^{date_short_pretty} at {time}|${esc(fallback)}>` : null;
};

// Slack takes at most 50 blocks: a header, three per show and a closing line
// leave room for 16 shows; the rest are counted, never silently dropped.
const MAX_SHOWS = 16;
export function buildMessage(fest, allMatches, now = new Date()) {
  if (!allMatches.length) return null; // no message beats an empty one
  const n = allMatches.length;
  const matches = allMatches.slice(0, MAX_SHOWS);
  const title = `Festival Navigator · ${fest.name}: ${n} show${n === 1 ? '' : 's'} by artists you love`;
  const blocks = [{ type: 'header', text: { type: 'plain_text', text: title.slice(0, 150) } }];
  matches.forEach(({ show, why, via }, i) => {
    const when = `${DAY.format(new Date(`${show.date}T12:00:00Z`))}${show.time ? `, ${show.time}` : ''}`;
    blocks.push({ type: 'section', text: { type: 'plain_text', text: `${show.name} — ${when} · ${show.venue}`.slice(0, 3000) } });
    const facts = [];
    // The bill's own words when they say more than the name ("ACL TV Taping:
    // Lola Young" is a taping, not a ticketed show).
    if (show.billedAs) facts.push(esc(show.billedAs));
    facts.push(esc(via ? `${via} is on the bill (${why})` : why));
    const onSale = show.onSale && Date.parse(show.onSale) > now.getTime() ? token(show.onSale, show.onSale.slice(0, 10)) : null;
    if (onSale) facts.push(`on sale ${onSale}`);
    const pre = (show.presales || []).find((p) => Date.parse(p.start) > now.getTime());
    if (pre) facts.push(`${esc(pre.name)} ${token(pre.start, pre.start.slice(0, 10))}`);
    if (show.soldOut) facts.push('sold out');
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: facts.join(' · ') }] });
    // The doors as buttons, the app's own words (the zoom's "Tix @ AXS ·
    // Info @ Do512"): a thumb on a phone hits a button, not a text link.
    const button = (id, text, url, primary) => ({ type: 'button', action_id: `${id}-${i}`, text: { type: 'plain_text', text: text.slice(0, 75) }, url, ...(primary ? { style: 'primary' } : {}) });
    const doors = [];
    if (show.tickets) doors.push(button('tix', `Tix @ ${show.tickets.at}`, show.tickets.url, true));
    if (show.page) doors.push(button('info', `Info @ ${show.page.at}`, show.page.url));
    doors.push(button('cal', 'Add to calendar', calendarUrl(show, `${show.venue}, Austin, TX`)));
    blocks.push({ type: 'actions', elements: doors });
  });
  if (n > matches.length) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `+${n - matches.length} more later in the season` }] });
  const first = matches[0].show;
  const text = `Festival Navigator · ${fest.name}: ${esc(first.name)} ${DAY.format(new Date(`${first.date}T12:00:00Z`))}${n > 1 ? ` and ${n - 1} more` : ''} by artists you love`;
  return { text, blocks, unfurl_links: false, unfurl_media: false };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const lovedFile = opt('--loved');
  if (!lovedFile) { console.error('usage: node scripts/season-alert.mjs --loved loved.json [--post <channel id>]'); process.exit(2); }
  // Every Austin season that is not over, as one city (a season is its own
  // entry in the app; the alert is about the city).
  const index = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
  const files = opt('--season') ? [opt('--season')]
    : index.filter((f) => f.kind === 'season' && f.id.startsWith('austin-') && f.status !== 'archived').map((f) => join(ROOT, 'data/festivals', `${f.id}.json`));
  const fest = { name: 'Austin', artists: files.flatMap((file) => JSON.parse(readFileSync(file, 'utf8')).artists || []) };
  const loved = JSON.parse(readFileSync(lovedFile, 'utf8'));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const msg = buildMessage(fest, matchShows(fest, loved, today));
  if (!msg) { console.log('nothing to send: no upcoming show by a loved artist'); return; }
  const channel = opt('--post');
  const replace = opt('--update'); // the ts of a message this bot posted: edit it instead of posting again
  if (!channel) { console.log(JSON.stringify(msg, null, 1)); return; }
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) { console.error('SLACK_BOT_TOKEN is not set'); process.exit(2); }
  const res = await fetch(`https://slack.com/api/${replace ? 'chat.update' : 'chat.postMessage'}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ channel, ...(replace ? { ts: replace } : {}), ...msg }),
  }).then((r) => r.json());
  if (!res.ok) { console.error(`slack said no: ${res.error}`); process.exit(1); }
  console.log(`${replace ? 'updated' : 'posted'} ${msg.blocks.length} blocks in ${channel} (ts ${res.ts})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
