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
