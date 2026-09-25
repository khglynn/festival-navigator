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

// A city season is three months (Kevin, 2026-09-25: "seasons, so like winter
// and summer and spring, not like the full year"): Fall Sep–Nov, Winter Dec–Feb
// (named for its January), Spring Mar–May, Summer Jun–Aug. `today` picks the
// season it falls in, and its shows run from today to the season's end, in
// the measured density of those months (the fall's Sep 100 · Oct 396 ·
// Nov 234; a winter's 94 · 11 · 23). `names` seeds real-looking names before
// the made-up ones take over. The edge cases sit a few days after today, so
// a test finds them by shape on any day in any season.
const SEASONS = [['winter', 11], ['spring', 2], ['summer', 5], ['fall', 8]]; // first month, 0-based
export function seasonWindowOf(today) {
  const m = Number(today.slice(5, 7)) - 1;
  const y = Number(today.slice(0, 4));
  const [name, first] = m === 11 || m < 2 ? SEASONS[0] : m < 5 ? SEASONS[1] : m < 8 ? SEASONS[2] : SEASONS[3];
  const startYear = name === 'winter' && m < 2 ? y - 1 : y;
  const startsOn = iso(new Date(Date.UTC(startYear, first, 1, 12)));
  const endsOn = iso(new Date(Date.UTC(startYear, first + 3, 0, 12)));
  const label = name === 'winter' ? startYear + 1 : startYear; // Winter is named for its January
  return { season: name, startsOn, endsOn, label };
}
const DENSITY = { fall: [100, 396, 234], winter: [94, 11, 23], spring: [17, 10, 3], summer: [3, 2, 1] };

export function seasonShape({ today = '2026-09-25', names = [], seed = 2026, id = null } = {}) {
  const r = rng(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const pool = [...new Set(names)];
  let made = 0;
  const nextName = () => pool.shift() || `${FIRST[made % FIRST.length]} ${SECOND[Math.floor(made++ / FIRST.length) % SECOND.length]}${made > FIRST.length * SECOND.length ? ` ${made}` : ''}`;
  const win = seasonWindowOf(today);
  const perMonth = DENSITY[win.season];
  const first = new Date(`${win.startsOn}T12:00:00Z`);
  const monthIso = (k, d) => iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + k, d, 12)));
  const monthOfIso = (d) => MONTHS[Number(d.slice(5, 7)) - 1];
  const artists = [];
  const multi = [];
  for (const [k, n] of perMonth.entries()) {
    const from = [monthIso(k, 1), today].reduce((a, b) => (b > a ? b : a));
    const last = monthIso(k + 1, 0);
    const days = [];
    for (let d = from; d <= last; d = addDays(d, 1)) days.push(d);
    if (!days.length) continue;
    for (let i = 0; i < n; i++) {
      // Weekends are busier: a Friday or Saturday is drawn three times as often.
      let date = pick(days);
      const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
      if (wd !== 5 && wd !== 6 && r() < 0.4) date = pick(days);
      const name = nextName();
      const e = { name, day: monthOfIso(date), date, venue: pick(LOCATIONS) };
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
  // Artists who play again, a few days to a few weeks later, inside the window.
  for (const e of multi) {
    const again = addDays(e.date, 1 + Math.floor(r() * 20));
    if (again > win.endsOn) continue;
    artists.push({ ...e, day: monthOfIso(again), date: again, venue: r() < 0.5 ? e.venue : pick(LOCATIONS) });
  }
  // The named edge cases, a few days after today (never past the window's
  // end), so the wall shows them whatever day the suite runs on.
  const at = (n) => { const d = addDays(today, n); return d > win.endsOn ? win.endsOn : d; };
  const nine = at(12); // the night with nine shows at once
  for (let i = 0; i < 9; i++) artists.push({ name: `Ninefold ${SECOND[i]}`, day: monthOfIso(nine), date: nine, venue: LOCATIONS[i], time: clock(19 * 60 + i * 15), sources: ['do512'] });
  artists.push({ name: LONG_NAME, day: monthOfIso(at(4)), date: at(4), venue: 'ACL Live', doors: '6:30 PM', time: '8 PM', with: ['Mikaela Davis'], sources: ['do512'] });
  artists.push({ name: 'No Clock Collective', day: monthOfIso(at(5)), date: at(5), venue: 'Hotel Vegas', sources: ['do512'] });
  artists.push({ name: 'Called Off Band', day: monthOfIso(at(3)), date: at(3), venue: 'Mohawk', time: '9 PM', cancelled: { on: today, source: 'https://do512.com/', note: 'A source lists it as cancelled.' }, page: { url: 'https://do512.com/events/called-off', at: 'Do512' }, sources: ['do512'] });
  artists.push({ name: 'Sold Right Out', day: monthOfIso(at(7)), date: at(7), venue: 'Parish', time: '8 PM', soldOut: true, tickets: { url: 'https://www.axs.com/events/1', at: 'AXS' }, sources: ['do512'] });
  // On-sales in the future, one with presales (fields as the feed writes them).
  artists.push({ name: 'Presale Darlings', day: monthOfIso(at(20)), date: at(20), venue: 'Moody Center', time: '8 PM', doors: '7 PM', onSale: `${addDays(today, 7)}T10:00:00-05:00`, presales: [{ name: 'Artist Presale', start: `${addDays(today, 5)}T10:00:00-05:00` }, { name: 'Spotify Fans First', start: `${addDays(today, 6)}T10:00:00-05:00` }], tickets: { url: 'https://www.ticketmaster.com/event/presale', at: 'Ticketmaster' }, sources: ['ticketmaster'] });
  artists.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const monthsIn = [0, 1, 2].map((k) => monthIso(k, 1));
  const dayMeta = Object.fromEntries(monthsIn.map((d) => [monthOfIso(d), { date: `${monthOfIso(d).slice(0, 3)} ${d.slice(0, 4)}` }]));
  const short = (d) => monthOfIso(d).slice(0, 3);
  const dates = win.startsOn.slice(0, 4) === win.endsOn.slice(0, 4)
    ? `${short(win.startsOn)} – ${short(win.endsOn)} ${win.endsOn.slice(0, 4)}`
    : `${short(win.startsOn)} ${win.startsOn.slice(0, 4)} – ${short(win.endsOn)} ${win.endsOn.slice(0, 4)}`;
  const title = win.season[0].toUpperCase() + win.season.slice(1);
  return {
    id: id || `austin-${win.season}-${win.label}`, kind: 'season', name: `Austin ${title}`, year: `'${String(win.label).slice(2)}`,
    location: 'Austin, TX', dates, startsOn: win.startsOn, endsOn: win.endsOn, updated: today,
    status: 'scheduled', timezone: 'America/Chicago', accent: '240, 146, 76',
    artists, dayMeta, venues: { Mohawk: 'https://maps.google.com/?q=Mohawk+Austin' }, days: {},
    meta: { note: 'tests/helpers/season-shape.mjs — shaped like the 2026-09-25 trial feed, one three-month season' },
  };
}
