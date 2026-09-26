// Folsom by time — the scratch fixture (v94 design round, 2026-09-25).
//
// Builds a copy of portola-2026.json whose Folsom section is the REAL pick
// list (research/gay-events/pick-list.json): the 68 parties Fri Sep 25 – Mon
// Sep 28, each on the NIGHT it belongs to (an after-midnight start is the
// night before's late hours: AFTERSHOCK at 3 AM Sunday is Saturday night,
// Nocturnal at 2:30 AM Monday is Sunday's). The ten parties the file already
// has keep the file's names (names are pick keys); Horse Meat Disco stays the
// file's one "Afters & Folsom" entry. Venue strings lose their street address
// (that belongs in venues{}, the map door) and `area` carries the pick list's
// neighbourhood. This is a DESIGN fixture — the real data is the data agent's
// (branch data/folsom-all); nothing here is written to the repo.
//
// Writes two files beside this one:
//   fixture/portola-2026.json        Folsom declared `layout: "by-time"`
//   fixture/portola-2026-venue.json  the same parties, today's venue stacks
//
// Run: APP=/path/to/v94 node fixture.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = process.env.APP;
if (!APP) throw new Error('set APP to the v94 worktree');
const fest = JSON.parse(fs.readFileSync(path.join(APP, 'data/festivals/portola-2026.json'), 'utf8'));
const picks = JSON.parse(fs.readFileSync(path.join(HERE, '../../research/gay-events/pick-list.json'), 'utf8'));

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const clock = (s) => {
  const m = /^~?(\d{1,2}):(\d\d) ([AP]M)$/.exec(String(s).trim());
  if (!m) return null;
  return `${Number(m[1])}${m[2] === '00' ? '' : `:${m[2]}`} ${m[3]}`;
};
const hour24 = (s) => { const [h, rest] = s.split(':'); const pm = /PM/.test(s); let n = Number(h) % 12; if (pm) n += 12; return n; };
const nightOf = (iso, start) => {
  const d = new Date(`${iso}T12:00:00Z`);
  if (hour24(start) < 9) d.setUTCDate(d.getUTCDate() - 1); // after midnight: the night before
  return { wd: WD[d.getUTCDay()], iso: d.toISOString().slice(0, 10) };
};
const cleanVenue = (v) => {
  if (/^TBA/.test(v)) return 'TBA (SF)';
  if (/^Folsom Street, 8th/.test(v)) return 'Folsom St, 8th-13th';
  if (/^City Nights/.test(v)) return 'City Nights SF';
  if (/^Private SoMa/.test(v)) return 'Private (SoMa)';
  if (/^9th & Ringold/.test(v)) return '9th & Ringold St';
  return v.replace(/\s*\(.*\)\s*$/, '').replace(/^SVN West.*/, 'SVN West').replace(/^Audio Nightclub$/, 'Audio').trim();
};
const cleanArea = (a) => (a === 'SF (unannounced)' ? null : a);

// The file's own Folsom names, by night + venue (+ start where a room has two).
const existing = fest.artists.filter((a) => a.day === 'Folsom');
const keep = (night, venue, time) => existing.find((a) => a.night === night && a.venue === venue
  && (!time || a.time.split(' - ')[0] === time.split(' - ')[0]));

const out = [];
const used = new Set();
for (const p of picks) {
  const n = nightOf(p.date, p.start);
  if (!['Fri', 'Sat', 'Sun'].includes(n.wd)) continue; // Thursday's four are before the window
  const start = clock(p.start);
  const end = clock(p.end);
  const time = end ? `${start} - ${end}` : start;
  const venue = cleanVenue(p.venue);
  // Horse Meat Disco is the file's "Afters & Folsom" entry — it already
  // renders in both rooms; don't add a second.
  if (/Horse Meat Disco/.test(p.name)) continue;
  const was = keep(n.wd, venue, venue === 'DNA Lounge' || venue === 'SF Eagle' ? time : null);
  if (was) { used.add(was); out.push({ ...was, area: cleanArea(p.neighbourhood) || undefined }); continue; }
  const link = p.links && p.links[0];
  let at = null;
  try { at = link ? new URL(link).hostname.replace(/^www\./, '').split('.').slice(-2, -1)[0] : null; } catch { at = null; }
  const AT = { eventbrite: 'Eventbrite', 'sf-eagle': 'SF Eagle', ra: 'Resident Advisor', dnalounge: 'DNA Lounge', dothebay: 'DoTheBay', tixr: 'Tixr', posh: 'Posh', partiful: 'Partiful' };
  const entry = { name: p.name, day: 'Folsom', stage: `${n.wd} · ${venue}`, night: n.wd, venue, time };
  const area = cleanArea(p.neighbourhood);
  if (area) entry.area = area;
  if (link && /^https:/.test(link)) entry.page = { url: link, at: AT[at] || (at ? at[0].toUpperCase() + at.slice(1) : 'Event page') };
  out.push(entry);
}
for (const a of existing) if (!used.has(a)) console.warn('not matched in the pick list:', a.name, a.night, a.venue);

const nights = {};
for (const e of out) nights[e.night] = (nights[e.night] || 0) + 1;
console.log(`Folsom entries: ${out.length}`, nights, '(+ Horse Meat Disco, Afters & Folsom, Fri)');

const artists = [...fest.artists.filter((a) => a.day !== 'Folsom'), ...out];
const venues = { ...fest.venues };
for (const e of out) if (!(e.venue in venues)) venues[e.venue] = null;
const byTime = { ...fest, artists, venues, dayMeta: { ...fest.dayMeta, Folsom: { ...fest.dayMeta.Folsom, layout: 'by-time' } } };
const byVenue = { ...fest, artists, venues };
fs.mkdirSync(path.join(HERE, 'fixture'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'fixture/portola-2026.json'), JSON.stringify(byTime, null, 1));
fs.writeFileSync(path.join(HERE, 'fixture/portola-2026-venue.json'), JSON.stringify(byVenue, null, 1));
console.log('wrote fixture/portola-2026.json and fixture/portola-2026-venue.json');
