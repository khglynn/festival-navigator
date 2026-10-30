// What api/festival-add.js asks Gemini for, and how a researched grid is
// settled before validation (2026-10-30: Kevin's friend was heading to Freaky
// Deaky the next day, and the add path only ever brought back a lineup — the
// prompt never asked for stages or set times, so there was nowhere to put
// them even when the schedule was on the page Gemini read).
//
// The research may now return a stage grid (days{}, dayMeta, timezone) when a
// published schedule prints set times. A grid is all or nothing: it passes
// the same validator the canonical files pass, or it is dropped and the
// candidate goes back to the lineup it always was, with a note saying why. A
// partial or broken grid never costs the person the lineup.
import { validateFestivalDoc } from './festival-rules.mjs';
import { searchFold } from '../../js/fold.mjs';

const HEAD = (name) => `Research the music festival "${name}" using web search. Return ONLY a JSON object (no markdown fence, no prose before or after) with this exact shape:`;
const RULES = 'Rules: artist names must use the artist\'s own official spelling/casing. Include the COMPLETE announced lineup, not a sample. If a field is unknown, omit it rather than guessing — never invent dates or artists. If you cannot find this festival at all, return {"notFound": true, "closest": ["<candidate names you did find>"]}.';
const IDENTITY = `  "id": "<lowercase-slug-with-year, e.g. bonnaroo-2026>",
  "name": "<festival display name, no year>",
  "year": "<'YY with apostrophe, e.g. '26>",
  "subtitle": "<venue name>",
  "location": "<City, ST or City, Country>",
  "dates": "<human-readable dates>",`;
const ARTISTS = '  "artists": [{"name": "<official spelling>", "day": "<Friday etc, omit if unknown>"}]';

// `grid: false` is the pre-v118 ask, the lineup alone: the endpoint falls back
// to it once when a full lineup plus a grid comes back cut off or unparseable.
export function researchPrompt(name, { grid = true } = {}) {
  if (!grid) {
    return `${HEAD(name)}
{
${IDENTITY}
  "status": "<lineup if artists are announced but not set times; archived if the festival already happened; lineup if unsure>",
${ARTISTS}
}
${RULES}`;
  }
  return `${HEAD(name)}
{
${IDENTITY}
  "status": "<archived if the festival already happened; scheduled if you include days below; otherwise lineup>",
  "timezone": "<IANA time zone of the venue, e.g. America/Chicago — only together with days>",
${ARTISTS},
  "dayMeta": {"<day label>": {"wd": "<Fri>", "date": "<Oct 30>", "iso": "<2026-10-30>"}},
  "days": {"<day label>": {"stages": ["<stage name>"], "artists": [{"name": "<artist>", "stage": "<one of this day's stages>", "time": "<6:30 PM - 7:30 PM>"}]}}
}
${RULES}
Set times: include days, dayMeta and timezone ONLY when a published schedule prints the set times (the festival's own site or app, or a page reproducing that schedule). If set times are not out, leave all three out — never estimate, round or fill in a time.
When you include days:
- Give a days entry for EVERY day label used in artists[].day, keyed by exactly that label, and list every set that day, on every stage.
- Copy each set's name character for character from artists[]. If the schedule shows an act that is missing from artists, add it to artists with its day.
- time is 12-hour with AM/PM: "6:30 PM - 7:30 PM", or just the start ("6:30 PM") when no end is printed. A set that ends at midnight ends at "12 AM".
- stage must be one of that day's stages, spelled the same way.
- Billing extras like "(DJ Set)" or "(Live)" are not part of a name.`;
}

const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const SPLIT_DAY = /\s*[&+/]\s*|\s+and\s+/i;
const GRID_KEYS = ['days', 'dayMeta', 'timezone'];
// A billing extra the schedule prints after a name ("Tiësto (DJ Set)"): never
// part of the name (docs/add-a-festival.md), so never a new act.
const BILLING = /\s*\((?:dj set|dj|live|live set|hybrid set|b2b[^)]*|extended set|sunrise set|sunset set|special guest)\)\s*$/i;
const nameKey = (s) => searchFold(String(s).replace(BILLING, '').replace(/\s+/g, ' ').trim());
const labelKey = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();

// Back to a lineup: no grid, no grid dates, and never "scheduled" without one.
function asLineup(c) {
  for (const k of GRID_KEYS) delete c[k];
  if (c.status === 'scheduled') c.status = 'lineup';
}

// Settle a candidate's grid IN PLACE before the endpoint validates it.
// Returns { gridNote, added }: gridNote is null when the grid stands (or there
// never was one), else one line saying why it was dropped; added lists the
// acts only the schedule showed, which joined the lineup. The preview shows
// both, so the person approving sees what research changed.
export function settleGrid(candidate) {
  if (!plain(candidate)) return { gridNote: null, added: [] };
  const days = candidate.days;
  if (!plain(days) || Object.keys(days).length === 0 || !Array.isArray(candidate.artists)) {
    asLineup(candidate);
    return { gridNote: null, added: [] };
  }
  const lineupBefore = JSON.parse(JSON.stringify(candidate.artists));
  const dropGrid = (why) => {
    candidate.artists = lineupBefore;
    asLineup(candidate);
    const line = String(why).replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 160);
    return { gridNote: `Set times came back but ${line}, so this is the lineup only.`, added: [] };
  };

  // Day labels key the tabs and the day notes, and the wall matches them
  // EXACTLY (events.js): "friday" in the lineup beside a "Friday" grid draws
  // two Fridays. The grid's own keys win; a lineup day or dayMeta key that
  // matches one but for case or spacing takes its spelling, and a dayMeta
  // entry that matches no grid day goes (a research grid has no sections).
  const gridKey = new Map(Object.keys(days).map((k) => [labelKey(k), k]));
  const missing = new Set();
  for (const a of candidate.artists) {
    if (!plain(a) || typeof a.day !== 'string' || !a.day.trim()) continue;
    const parts = a.day.split(SPLIT_DAY).map((p) => p.trim()).filter(Boolean);
    const exact = parts.map((p) => gridKey.get(labelKey(p)));
    parts.forEach((p, i) => { if (!exact[i]) missing.add(p); });
    if (exact.every(Boolean)) a.day = exact.join(' & ');
  }
  // A grid that covers only some of the days would turn the uncovered days'
  // artists into sections with no night or venue, which the validator refuses
  // (festival-rules.mjs checkEventFields) — so a half grid is no grid.
  if (missing.size) return dropGrid(`not for ${[...missing].join(', ')}`);
  if (plain(candidate.dayMeta)) {
    const meta = {};
    for (const [k, v] of Object.entries(candidate.dayMeta)) {
      const lk = labelKey(k);
      const to = gridKey.get(lk)
        || (lk.length >= 3 ? Object.keys(days).find((g) => labelKey(g).startsWith(lk)) : undefined);
      if (to && !meta[to]) meta[to] = v;
    }
    candidate.dayMeta = meta;
  }

  // Grid names are pick keys, matched byte for byte to artists[]. Nobody has
  // picked in a festival that is still a preview, so this is the moment a
  // spelling can be aligned for free: a set that matches a lineup act once
  // case, accents, spacing and a billing extra are set aside takes the
  // lineup's spelling. Anything else the schedule shows joins artists[] on its
  // day (a local stage's openers), with any billing extra cut from its name,
  // and is listed for the person approving. Two spellings of one act would
  // split the crew's picks between two cards forever.
  const byKey = new Map();
  for (const a of candidate.artists) {
    if (plain(a) && typeof a.name === 'string' && !byKey.has(nameKey(a.name))) byKey.set(nameKey(a.name), a.name);
  }
  const added = [];
  for (const [label, day] of Object.entries(days)) {
    if (!plain(day) || !Array.isArray(day.artists)) continue;
    for (const s of day.artists) {
      if (!plain(s) || typeof s.name !== 'string' || !s.name.trim()) continue;
      const same = byKey.get(nameKey(s.name));
      if (same) { s.name = same; continue; }
      s.name = s.name.replace(BILLING, '').replace(/\s+/g, ' ').trim();
      candidate.artists.push({ name: s.name, day: label });
      byKey.set(nameKey(s.name), s.name);
      added.push(s.name);
    }
  }

  if (candidate.status !== 'archived') candidate.status = 'scheduled';
  const { errors } = validateFestivalDoc(candidate);
  if (errors.length) return dropGrid(`did not check out (${errors[0]})`);
  return { gridNote: null, added };
}
