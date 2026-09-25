// A city season shaped like the live feed (2026-09-25), for the tests and the
// walks. The seed file on the branch is the 2026-09-24 study (425 shows spread
// thin); the feed's trial run measured something much denser, and the view
// has to be designed and tested against THAT (claude-plans/2026-09-25-season-v0/
// UX.md): about 890 upcoming shows at 76 locations — the rest of September 100,
// October 396, November 234, December 94, then 11 / 23 / 17 / 10 / 3 — a median
// night of 4 shows, a busiest of 29, and 107 artists with two or more nights.
//
// Deterministic (a seeded generator, no clock): the same call builds the same
// file, so a test can find a shape again. Every field the feed writes is here
// somewhere — `time`, `doors`, `with`, `page`, `tickets`, `onSale`,
// `presales`, `soldOut`, a cancelled show — and the edge cases the brief names:
// a month with three shows, a night with nine, a 96-character name, a show with
// no time.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Mulberry32: small, fast, and the same everywhere.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Velvet', 'Neon', 'Paper', 'Golden', 'Quiet', 'Electric', 'Silver', 'Wild', 'Lunar', 'Honey', 'Static', 'Glass', 'Midnight', 'Copper', 'Holy', 'Tiny', 'Sun', 'Lone', 'Black', 'Pale'];
const SECOND = ['Coyote', 'Parade', 'Hearts', 'Machines', 'River', 'Ghosts', 'Tides', 'Choir', 'Signal', 'Harbor', 'Ponies', 'Lanterns', 'Wolves', 'Garden', 'Motel', 'Saints', 'Arcade', 'Canyon', 'Radio', 'Fever'];
export const LOCATIONS = [
  "Antone's", 'ACL Live', "Stubb's", 'Mohawk', 'Parish', 'Empire Control Room', 'Scoot Inn', 'Continental Club', 'Moody Center',
  'Moody Amphitheater', 'Emo’s', 'Kingdom', '3TEN', 'Concourse Project', 'Germania Insurance Amphitheater', 'Brushy Street',
  'Hole in the Wall', 'Cheer Up Charlies', 'Elysium', 'Paramount Theatre', 'The Far Out Lounge', 'Radio/East', 'Hotel Vegas',
];
export const LONG_NAME = 'Don Was & the Pan-Detroit Ensemble Celebrate the 50th Anniversary of Blues for Allah (NIGHT ONE)';

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const clock = (min) => { const h = Math.floor(min / 60) % 24; const m = min % 60; return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`; };

// `today` is the season's first night (the feed writes from today on); the
// months follow the measured distribution from there. `names` seeds the
// artists with real-looking names (the seed file's, say) before the made-up
// ones take over.
export function seasonShape({ today = '2026-09-25', names = [], seed = 2026 } = {}) {
  const r = rng(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const pool = [...new Set(names)];
  let made = 0;
  const nextName = () => pool.shift() || `${FIRST[made % FIRST.length]} ${SECOND[Math.floor(made++ / FIRST.length) % SECOND.length]}${made > FIRST.length * SECOND.length ? ` ${made}` : ''}`;
  // Shows per month, from today's month on (the measured shape).
  const perMonth = [100, 396, 234, 94, 11, 23, 17, 10, 3];
  const start = new Date(`${today}T12:00:00Z`);
  const artists = [];
  const multi = [];
  for (const [k, n] of perMonth.entries()) {
    const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + k, 1, 12));
    const month = MONTHS[first.getUTCMonth()];
    const from = k === 0 ? today : iso(first);
    const last = iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)));
    const days = [];
    for (let d = from; d <= last; d = addDays(d, 1)) days.push(d);
    for (let i = 0; i < n; i++) {
      // Weekends are busier: a Friday or Saturday is drawn three times as often.
      let date = pick(days);
      const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
      if (wd !== 5 && wd !== 6 && r() < 0.4) date = pick(days);
      const name = nextName();
      const e = { name, day: month, date, venue: pick(LOCATIONS) };
      const start = 18 * 60 + Math.floor(r() * 10) * 30; // 6 PM – 10:30 PM
      if (r() < 0.8) e.time = clock(start);
      if (r() < 0.85) e.doors = clock(start - 60);
      if (r() < 0.55) e.with = Array.from({ length: 1 + Math.floor(r() * 3) }, () => `${pick(FIRST)} ${pick(SECOND)}`);
      if (r() < 0.7) e.tickets = { url: `https://www.ticketmaster.com/event/${artists.length}`, at: 'Ticketmaster' };
      if (r() < 0.6) e.page = { url: `https://do512.com/events/${date.replace(/-/g, '/')}/${artists.length}`, at: 'Do512' };
      e.sources = ['do512'];
      artists.push(e);
      if (multi.length < 107 && r() < 0.14) multi.push(e);
    }
  }
  // 107 artists play again, a few days to a few weeks later.
  for (const e of multi) {
    const again = addDays(e.date, 1 + Math.floor(r() * 20));
    const month = MONTHS[Number(again.slice(5, 7)) - 1];
    artists.push({ ...e, day: month, date: again, venue: r() < 0.5 ? e.venue : pick(LOCATIONS) });
  }
  // The named edge cases, placed where a test can find them by shape.
  const oct = (d) => `${String(start.getUTCFullYear())}-10-${String(d).padStart(2, '0')}`;
  const nine = oct(17); // a Saturday in 2026: the night with nine shows at once
  for (let i = 0; i < 9; i++) artists.push({ name: `Ninefold ${SECOND[i]}`, day: 'October', date: nine, venue: LOCATIONS[i], time: clock(19 * 60 + i * 15), sources: ['do512'] });
  artists.push({ name: LONG_NAME, day: 'October', date: oct(9), venue: 'ACL Live', doors: '6:30 PM', time: '8 PM', with: ['Mikaela Davis'], sources: ['do512'] });
  artists.push({ name: 'No Clock Collective', day: 'October', date: oct(10), venue: 'Hotel Vegas', sources: ['do512'] });
  artists.push({ name: 'Called Off Band', day: 'October', date: oct(8), venue: 'Mohawk', time: '9 PM', cancelled: { on: today, source: 'https://do512.com/', note: 'A source lists it as cancelled.' }, page: { url: 'https://do512.com/events/called-off', at: 'Do512' }, sources: ['do512'] });
  artists.push({ name: 'Sold Right Out', day: 'October', date: oct(12), venue: 'Parish', time: '8 PM', soldOut: true, tickets: { url: 'https://www.axs.com/events/1', at: 'AXS' }, sources: ['do512'] });
  // On-sales in the future, one with presales (fields as the feed writes them).
  artists.push({ name: 'Presale Darlings', day: 'November', date: `${start.getUTCFullYear()}-11-14`, venue: 'Moody Center', time: '8 PM', doors: '7 PM', onSale: `${today}T10:00:00-05:00`.replace(today, addDays(today, 7)), presales: [{ name: 'Artist Presale', start: `${addDays(today, 5)}T10:00:00-05:00` }, { name: 'Spotify Fans First', start: `${addDays(today, 6)}T10:00:00-05:00` }], tickets: { url: 'https://www.ticketmaster.com/event/presale', at: 'Ticketmaster' }, sources: ['ticketmaster'] });
  artists.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const dayMeta = Object.fromEntries([...new Set(artists.map((a) => a.day))].map((m) => [m, { date: `${m.slice(0, 3)} ${artists.find((a) => a.day === m).date.slice(0, 4)}` }]));
  return {
    id: 'austin', kind: 'season', name: 'Austin', year: "'26–27", subtitle: 'Winter + Spring', location: 'Austin, TX',
    dates: 'Sep 2026 – May 2027', startsOn: artists[0].date, endsOn: artists.at(-1).date, status: 'scheduled', timezone: 'America/Chicago', accent: '244, 114, 182',
    artists, dayMeta, venues: { Mohawk: 'https://maps.google.com/?q=Mohawk+Austin' }, days: {},
    meta: { note: 'tests/helpers/season-shape.mjs — shaped like the 2026-09-25 trial feed' },
  };
}
