// Fold a name or a query for comparison, never a stored name (names are pick
// keys): so "tiesto" finds Tiësto, "mull" finds MÜLL, "chloe" finds Chloé
// Caillet, and the other way round — nobody hunts for the ë on a phone
// keyboard in a field. NFD splits an accented letter into letter + mark and
// the marks go; the letters NFD leaves whole (a stroke or a ligature, not a
// mark: CØNTRA, Łaszewo, DØMINA) get their plain spelling from FOLD_LETTERS.
// And iOS types a curly ’ for ' (Smart Punctuation), so "it’s murph" finds
// It's Murph.
//
// Its own module (2026-09-26) because two things compare names now: every
// search (wall.js searchMatches) and the import from a festival app's
// schedule export (v3/import-match.js). One fold, so "the app ignores
// accents" stays true of both — the search had two folds once, and the
// scheduled-fest one had never folded at all (v91).
const FOLD_LETTERS = { 'ø': 'o', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'ħ': 'h', 'ı': 'i', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'þ': 'th' };
export function searchFold(s) {
  return String(s ?? '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[øłđðħıßæœþ]/g, (c) => FOLD_LETTERS[c])
    .replace(/[‘’ʼ]/g, "'");
}
