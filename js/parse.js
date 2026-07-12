// Pure parsing helpers (DOM-free — importable by node tests).

// v4 vocabulary (Picked x1-3, Must) with legacy labels accepted for old
// exports: Must See -> must(4), Highlight -> 2, Nice to See -> 1.
// Unknown labels return null — silently coercing a typo'd level into a real
// level-1 pick corrupted crew data (CORE-8).
export function parseBulkLineV4(line) {
  const m = line.match(/^([^:]+):\s*(.+)\s*\(([^)]+)\)\s*$/);
  if (!m) return null;
  const s = m[3].trim().toLowerCase();
  let level = null;
  if (s === 'must' || s === 'must see') level = 4;
  else if (s === 'picked x3' || s === 'picked ×3') level = 3;
  else if (s === 'picked x2' || s === 'picked ×2' || s === 'highlight' || s === 'new discovery') level = 2;
  else if (s === 'picked' || s === 'picked x1' || s === 'picked ×1' || s === 'nice to see') level = 1;
  if (level === null) return null;
  return { person: m[1].trim(), artistName: m[2].trim(), level };
}

export const LEVEL_LABELS_V4 = { 1: 'Picked', 2: 'Picked ×2', 3: 'Picked ×3', 4: 'Must' };
