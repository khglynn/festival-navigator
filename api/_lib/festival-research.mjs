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

export function researchPrompt(name) {
  return `Research the music festival "${name}" using web search. Return ONLY a JSON object (no markdown fence, no prose before or after) with this exact shape:
{
  "id": "<lowercase-slug-with-year, e.g. bonnaroo-2026>",
  "name": "<festival display name, no year>",
  "year": "<'YY with apostrophe, e.g. '26>",
  "subtitle": "<venue name>",
  "location": "<City, ST or City, Country>",
  "dates": "<human-readable dates>",
  "status": "<archived if the festival already happened; scheduled if you include days below; otherwise lineup>",
  "timezone": "<IANA time zone of the venue, e.g. America/Chicago — only together with days>",
  "artists": [{"name": "<official spelling>", "day": "<Friday etc, omit if unknown>"}],
  "dayMeta": {"<day label>": {"wd": "<Fri>", "date": "<Oct 30>", "iso": "<2026-10-30>"}},
  "days": {"<day label>": {"stages": ["<stage name>"], "artists": [{"name": "<artist>", "stage": "<one of this day's stages>", "time": "<6:30 PM - 7:30 PM>"}]}}
}
Rules: artist names must use the artist's own official spelling/casing. Include the COMPLETE announced lineup, not a sample. If a field is unknown, omit it rather than guessing — never invent dates or artists. If you cannot find this festival at all, return {"notFound": true, "closest": ["<candidate names you did find>"]}.
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

// Back to a lineup: no grid, no grid dates, and never "scheduled" without one.
function asLineup(c) {
  for (const k of GRID_KEYS) delete c[k];
  if (c.status === 'scheduled') c.status = 'lineup';
}

// Settle a candidate's grid IN PLACE before the endpoint validates it.
// Returns { gridNote }: null when the grid stands (or there never was one),
// else one line saying why it was dropped — the preview shows it, so the
// person approving knows set times were looked for and not kept.
export function settleGrid(candidate) {
  if (!plain(candidate)) return { gridNote: null };
  const days = candidate.days;
  if (!plain(days) || Object.keys(days).length === 0 || !Array.isArray(candidate.artists)) {
    asLineup(candidate);
    return { gridNote: null };
  }
  const lineupBefore = JSON.parse(JSON.stringify(candidate.artists));
  const dropGrid = (why) => {
    candidate.artists = lineupBefore;
    asLineup(candidate);
    const line = String(why).replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 160);
    return { gridNote: `Set times came back but ${line}, so this is the lineup only.` };
  };

  // Grid names are pick keys, matched byte for byte to artists[]. Nobody has
  // picked in a festival that is still a preview, so this is the one moment a
  // spelling can be aligned for free: a case-only difference takes the lineup's
  // spelling, and an act the schedule shows but the lineup missed (a local
  // stage's openers) joins artists[] on its day.
  const exact = new Set();
  const byUpper = new Map();
  for (const a of candidate.artists) {
    if (!plain(a) || typeof a.name !== 'string') continue;
    exact.add(a.name);
    if (!byUpper.has(a.name.toUpperCase())) byUpper.set(a.name.toUpperCase(), a.name);
  }
  for (const [label, day] of Object.entries(days)) {
    if (!plain(day) || !Array.isArray(day.artists)) continue;
    for (const s of day.artists) {
      if (!plain(s) || typeof s.name !== 'string' || !s.name.trim() || exact.has(s.name)) continue;
      const same = byUpper.get(s.name.toUpperCase());
      if (same) { s.name = same; continue; }
      candidate.artists.push({ name: s.name, day: label });
      exact.add(s.name);
      byUpper.set(s.name.toUpperCase(), s.name);
    }
  }

  // A grid that covers only some of the days would turn the uncovered days'
  // artists into sections with no night or venue, which the validator refuses
  // (festival-rules.mjs checkEventFields) — so a half grid is no grid.
  const gridDays = new Set(Object.keys(days).map((d) => d.toLowerCase()));
  const missing = new Set();
  for (const a of candidate.artists) {
    if (!plain(a) || typeof a.day !== 'string' || !a.day.trim()) continue;
    for (const part of a.day.split(SPLIT_DAY).map((p) => p.trim()).filter(Boolean)) {
      if (!gridDays.has(part.toLowerCase())) missing.add(part);
    }
  }
  if (missing.size) return dropGrid(`not for ${[...missing].join(', ')}`);

  if (candidate.status !== 'archived') candidate.status = 'scheduled';
  const { errors } = validateFestivalDoc(candidate);
  if (errors.length) return dropGrid(`did not check out (${errors[0]})`);
  return { gridNote: null };
}
