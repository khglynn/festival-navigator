// Import from a festival app's schedule export (2026-09-26, Kevin at Portola:
// "Portola has this export feature that gives you PNGs. I would love if folks
// could import these to add to their lists"). The server reads each image and
// returns only what is printed on it (api/import-schedule.js); this module
// matches what was printed to THIS festival's lineup. Pure — no DOM, no
// state — so the whole matching contract is a node test
// (tests/import-match.test.mjs).
//
// Picks are keyed by artist NAME, so a match is a name match, and the name
// that comes back is always the lineup's own bytes (the pick key), never the
// image's spelling. The day and the stage only break a tie between two lineup
// entries that fold to the same name, and tell the person what matched.
//
// How far a name may travel, and no further:
//   1. exact — the same letters, case and outer spaces aside;
//   2. folded — accents (the app's one fold, js/fold.mjs), punctuation, and
//      how a back-to-back is written (b2b, B2B, b 2 b, x, ×, &) aside.
// Nothing fuzzier. A near miss is "not on this fest's lineup", shown to the
// person — a wrong guess would put a pick on someone they never chose, and
// they would find it on the wall with no idea where it came from.
import { searchFold } from '../fold.mjs';

// The comparison key for a name. Folded as search folds (accents, the
// stroke and ligature letters, a curly apostrophe), then NFKD for the
// compatibility forms search never meets (a ligature ﬁ, fullwidth letters),
// then a back-to-back said one way, then punctuation out.
export function importKey(name) {
  return searchFold(String(name ?? '').normalize('NFKD'))
    .replace(/[̀-ͯ]/g, '')
    // A back-to-back, however it is printed: "A b2b B", "A B2B B", "A b 2 b B",
    // "A x B", "A × B", "A & B" all say the same set. Only BETWEEN two words:
    // a name that ends in X (Malcolm X) is not a back-to-back.
    .replace(/\s+(?:b\s*2\s*b|x|×|&)\s+/g, ' b2b ')
    // Apostrophes and periods close up ("It's" and "Its", "D.J." and "DJ");
    // every other mark is a space ("Dj-Shadow" and "DJ Shadow").
    .replace(/['.]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const exactKey = (name) => String(name ?? '').trim().toLowerCase();

// A stage as the export prints it ("WAREHOUSE", "PIER") against the lineup's
// ("Warehouse", "Pier Stage"): folded, and the word "stage" does not count.
export function stageKey(stage) {
  return importKey(stage).replace(/\bstage\b/g, '').replace(/\s+/g, ' ').trim();
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function weekdayOf(text) {
  const t = importKey(text);
  for (const wd of WEEKDAYS) {
    if (new RegExp(`\\b${wd}\\b`).test(t) || new RegExp(`\\b${wd.slice(0, 3)}\\b`).test(t)) return wd;
  }
  return null;
}
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// "9/26" -> "9-26"; also "Sep 26" -> "9-26". Null when the text carries no date.
function monthDayOf(text) {
  const s = String(text || '');
  let m = s.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) return `${Number(m[1])}-${Number(m[2])}`;
  m = s.toLowerCase().match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/);
  if (m) return `${MONTHS.indexOf(m[1]) + 1}-${Number(m[2])}`;
  return null;
}
function isoMonthDay(iso) {
  const m = String(iso || '').match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[1])}-${Number(m[2])}` : null;
}

// Which of this festival's grid days an image's day chip ("Saturday 9/26")
// names, or null. A printed date that matches a day's date wins (a
// two-weekend fest has two Saturdays under one key, and a festival counted
// "Day 1..4" names no weekday in its keys); otherwise the weekday, from the
// key itself or the day's `wd`. Never a guess: a chip naming no day of this
// festival is null, and the review just says which day the image said.
export function festDayOf(fest, label) {
  const days = Object.keys((fest && fest.days) || {});
  if (!days.length || !label) return null;
  const meta = (fest && fest.dayMeta) || {};
  const md = monthDayOf(label);
  if (md) {
    for (const key of days) {
      const m = meta[key] || {};
      const isos = [m.iso, ...Object.values(m.isos || {})].filter(Boolean);
      const dates = [m.date, ...Object.values(m.dates || {})].filter(Boolean);
      if (isos.some((iso) => isoMonthDay(iso) === md) || dates.some((d) => monthDayOf(d) === md)) return key;
    }
  }
  const wd = weekdayOf(label);
  if (!wd) return null;
  const hits = days.filter((key) => weekdayOf(key) === wd || weekdayOf((meta[key] || {}).wd) === wd);
  return hits.length === 1 ? hits[0] : null;
}

// Every place a name is on this festival: its grid sets (day, stage, time)
// and its lineup entries (a section's night, venue and time, or a bare day).
function occurrencesOf(fest) {
  const out = [];
  for (const [day, d] of Object.entries((fest && fest.days) || {})) {
    for (const a of (d && d.artists) || []) {
      if (a && typeof a.name === 'string') out.push({ name: a.name, day, grid: true, stage: a.stage || null, time: a.time || null });
    }
  }
  for (const a of (fest && fest.artists) || []) {
    if (a && typeof a.name === 'string') {
      out.push({ name: a.name, day: a.day || null, grid: false, stage: a.stage || a.venue || null, time: a.time || null, cancelled: !!a.cancelled });
    }
  }
  return out;
}

// The index one import matches against, built once per festival.
export function lineupIndex(fest) {
  const exact = new Map();  // exactKey -> [occurrence]
  const folded = new Map(); // importKey -> [occurrence]
  for (const o of occurrencesOf(fest)) {
    const e = exactKey(o.name);
    const f = importKey(o.name);
    if (e) (exact.get(e) || exact.set(e, []).get(e)).push(o);
    if (f) (folded.get(f) || folded.set(f, []).get(f)).push(o);
  }
  return { fest, exact, folded };
}

// The lineup name a tie goes to, and the occurrence the review shows for it.
// Several lineup NAMES can share one folded key only where the lineup itself
// spells one act two ways (the validator refuses a case-only pair); the one
// on the image's day and stage wins, then the one on its day, then the first.
function choose(occs, day, stage) {
  const sk = stage ? stageKey(stage) : '';
  const onDay = (o) => day && o.grid && o.day === day;
  const onStage = (o) => sk && o.stage && stageKey(o.stage) === sk;
  const score = (o) => (onDay(o) ? 2 : 0) + (onDay(o) && onStage(o) ? 1 : 0) + (o.grid ? 0.5 : 0);
  let best = occs[0];
  for (const o of occs) if (score(o) > score(best)) best = o;
  return best;
}

// One printed item against the index. `day` is the festival's day key the
// image named (festDayOf), or null.
//   { name, occ, via: 'exact'|'folded', offDay, where } for a match —
//     name: the lineup's spelling (the pick key);
//     occ: the set the review shows ({ day, stage, time, grid });
//     offDay: the image said a day this name does not play here (it still
//       matches — picks are by name — and the review says so);
//     where: the days (or sections) it does play here, for that line.
//   { name: null, printed } when the lineup has no such name.
export function matchItem(index, item, day = null) {
  const printed = String((item && item.name) || '').trim();
  if (!printed) return { name: null, printed };
  let via = 'exact';
  let occs = index.exact.get(exactKey(printed));
  if (!occs || !occs.length) { via = 'folded'; occs = index.folded.get(importKey(printed)); }
  if (!occs || !occs.length) return { name: null, printed };
  const best = choose(occs, day, item.stage);
  const name = best.name;
  const mine = occs.filter((o) => o.name === name);
  const gridDays = [...new Set(mine.filter((o) => o.grid).map((o) => o.day))];
  const anyDays = gridDays.length ? gridDays : [...new Set(mine.map((o) => o.day).filter(Boolean))];
  const offDay = !!day && anyDays.length > 0 && !gridDays.includes(day);
  const onImageDay = mine.find((o) => o.grid && o.day === day);
  const occ = onImageDay || mine.find((o) => o.grid) || best;
  return {
    name,
    printed,
    via,
    occ: { day: occ.day, stage: occ.stage, time: occ.time, grid: !!occ.grid },
    offDay,
    where: anyDays,
    // Called off: every entry for the name is cancelled (a cancelled act's set
    // comes off the grid, so a name still on the grid is on).
    cancelled: mine.every((o) => o.cancelled),
  };
}

// A whole read — { day: <the chip as printed>, items: [...] } — against the
// festival. The same name twice in one image is one pick (the first stays).
export function matchRead(index, read) {
  const label = String((read && read.day) || '').trim();
  const day = festDayOf(index.fest, label);
  const matched = [];
  const unknown = [];
  const seen = new Set();
  for (const item of (read && Array.isArray(read.items) ? read.items : [])) {
    const m = matchItem(index, item, day);
    if (!m.name) {
      if (m.printed && !unknown.includes(m.printed)) unknown.push(m.printed);
      continue;
    }
    if (seen.has(m.name)) continue;
    seen.add(m.name);
    matched.push({ ...m, start: item.start || null, end: item.end || null, printedStage: item.stage || null });
  }
  return { label, day, matched, unknown };
}

// What the review should start each matched set at (Kevin: "start them at
// like mid — 2 level pick"), given what the person already has. A set they
// already picked keeps their level and is never lowered — or raised — by
// the import: it is theirs already, and it is not part of the import.
export const IMPORT_START_LEVEL = 2;
export function startLevel(current) {
  return current > 0 ? current : IMPORT_START_LEVEL;
}

// The picks one "Add" writes: every matched set not already picked, at the
// level the person landed it (0 = they tapped it off — skipped), each name
// once even when two images carry it (the higher level wins).
export function picksToWrite(entries) {
  const out = new Map();
  for (const e of entries) {
    if (!e || !e.name || e.already || !(e.level >= 1 && e.level <= 4)) continue;
    out.set(e.name, Math.max(out.get(e.name) || 0, e.level));
  }
  return [...out].map(([name, level]) => ({ name, level }));
}
