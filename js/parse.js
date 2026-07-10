// Pure parsing helpers (DOM-free — importable by node tests).

// Parse a "Person: Artist (Level)" line from the bulk-add tool.
// Greedy artist group + end-anchor so names with parentheses survive the
// round-trip (e.g. "Suzanne (Opening) (Must See)").
export function parseBulkLine(line) {
  const m = line.match(/^([^:]+):\s*(.+)\s*\(([^)]+)\)\s*$/);
  if (!m) return null;
  const levelStr = m[3].trim().toLowerCase();
  let level = 1;
  if (levelStr === 'must see') level = 3;
  if (levelStr === 'highlight' || levelStr === 'new discovery') level = 2;
  return { person: m[1].trim(), artistName: m[2].trim(), level };
}

// v4 vocabulary (Picked x1-3, Must) with legacy labels accepted for old
// exports: Must See -> must(4), Highlight -> 2, Nice to See -> 1.
export function parseBulkLineV4(line) {
  const m = line.match(/^([^:]+):\s*(.+)\s*\(([^)]+)\)\s*$/);
  if (!m) return null;
  const s = m[3].trim().toLowerCase();
  let level = 1;
  if (s === 'must' || s === 'must see') level = 4;
  else if (s === 'picked x3' || s === 'picked ×3') level = 3;
  else if (s === 'picked x2' || s === 'picked ×2' || s === 'highlight' || s === 'new discovery') level = 2;
  return { person: m[1].trim(), artistName: m[2].trim(), level };
}

export const LEVEL_LABELS_V4 = { 1: 'Picked', 2: 'Picked ×2', 3: 'Picked ×3', 4: 'Must' };
