// The keys a crew's data hangs off, and the freeze that keeps them stable.
//
// A crew doc references festival data by three strings and nothing else:
//   - the festival id           -> crewDoc.festivals[<id>]
//   - an artist's exact name    -> selections[<name>], notes.artist[<name>]
//   - a day's exact label       -> notes.day[<label>]
// The doc model is additive (jsonb_deep_merge never deletes), so there is no
// rename path: change any of these strings in a data file and every pick or
// note under the old string is orphaned for every crew, silently. This module
// is the tripwire. `freezeFestival` snapshots the strings a live festival
// exposes; `frozenKeyProblems` says which frozen strings a candidate file no
// longer carries. scripts/validate-festivals.mjs (CI) and
// tests/live-pick-keys.test.mjs both run it; scripts/freeze-pick-keys.mjs
// writes the snapshot. Removing a name from the fixture by hand is the ONE
// sanctioned way to rename — that edit is the decision, visible in the diff.

const SPLIT_DAY = /\s*[&+/]\s*|\s+and\s+/i;

// Day labels a crew could have written a day note under: every atomic
// artists[].day value, the parts of a combined label, and every days{} key.
export function dayLabelsOf(fest) {
  const labels = new Set();
  for (const a of fest.artists || []) {
    if (!a || typeof a.day !== 'string' || !a.day.trim()) continue;
    labels.add(a.day.trim());
    for (const part of a.day.split(SPLIT_DAY).map((s) => s.trim()).filter(Boolean)) labels.add(part);
  }
  for (const k of Object.keys(fest.days || {})) labels.add(k);
  return [...labels].sort();
}

export function artistNamesOf(fest) {
  return [...new Set((fest.artists || []).map((a) => a && a.name).filter((n) => typeof n === 'string' && n))].sort();
}

export function freezeFestival(fest, frozenAt) {
  return { frozenAt, id: fest.id, names: artistNamesOf(fest), days: dayLabelsOf(fest) };
}

// Problems = frozen strings the candidate file no longer exposes. Each is a
// full sentence that says what would break and what the sanctioned fix is,
// because the reader is often a small model or a cloud run with no memory of
// why this rule exists.
export function frozenKeyProblems(fest, frozen, { indexIds } = {}) {
  const problems = [];
  if (!frozen) return problems;
  if (frozen.id && fest.id !== frozen.id) {
    problems.push(`festival id changed ${JSON.stringify(frozen.id)} → ${JSON.stringify(fest.id)} — every crew's picks live under the old id; ids never change`);
  }
  if (frozen.id && indexIds && !indexIds.has(frozen.id)) {
    problems.push(`festival ${JSON.stringify(frozen.id)} is frozen (live crews pick in it) but is no longer listed in index.json`);
  }
  const names = new Set(artistNamesOf(fest));
  const lower = new Map([...names].map((n) => [n.toLowerCase(), n]));
  for (const n of frozen.names || []) {
    if (names.has(n)) continue;
    const near = lower.get(n.toLowerCase());
    problems.push(near
      ? `artist ${JSON.stringify(n)} is now spelled ${JSON.stringify(near)} — picks and notes key on exact bytes, so this splits the crew's picks; keep the frozen spelling`
      : `artist ${JSON.stringify(n)} was removed or renamed — picks and notes under it would be orphaned for every crew. If that is intended, delete it from tests/fixtures/live-pick-keys.json in the same change`);
  }
  const days = new Set(dayLabelsOf(fest));
  for (const d of frozen.days || []) {
    if (days.has(d)) continue;
    problems.push(`day label ${JSON.stringify(d)} no longer exists — day notes key on the label; keep it byte-identical (a scheduled grid's days{} keys must match the lineup phase's artists[].day values)`);
  }
  return problems;
}
