// Small pure helpers shared across modules.

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function cssEscape(s) {
  return String(s).replace(/(["\\])/g, '\\$1');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
