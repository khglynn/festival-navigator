// Direction A — the served-module patches (2026-09-26, on v95 / 75ccf2f).
//
// The app worktree is read-only; these are string replacements applied to the
// bytes the rig SERVES, never to the files. Each one names the production line
// it hooks, must match exactly once (or the rig refuses to start), and hands
// the decision to `globalThis.__lv` (proto.mjs) so board mode is untouched
// production. Read together they are also the build's shape: five small hooks
// in wall.js, one in events.js, one line in index.html.
export const PATCHES = {
  '/js/v3/events.js': [
    // A room may bring its own ladder (the festival room: hours).
    ['const b = bandOf(m.startMin);', 'const b = (opts.bandOf || bandOf)(m.startMin);'],
    // Bands sort by where they start on the clock (the night ladder's own
    // order is already its start order, so Folsom is unchanged).
    ['.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))', '.sort((a, b) => (a.from ?? 1e9) - (b.from ?? 1e9) || order.indexOf(a.key) - order.indexOf(b.key))'],
  ],
  '/js/v3/wall.js': [
    // 1. timeGroups asks the proto which ladder this room reads on.
    ['for (const band of timeBandsOf(entries, { fallbackVenue })) {', 'for (const band of timeBandsOf(entries, { fallbackVenue, bandOf: globalThis.__lv && globalThis.__lv.list ? globalThis.__lv.bandOf(root) : undefined })) {'],
    // 2. In list mode a band head is a BUTTON (the time pin's door; the 44px
    //    floor comes with it) — word bands stay plain (proto decides).
    ["const head = mk('div', 'band-head');", "const head = mk(globalThis.__lv && globalThis.__lv.list && globalThis.__lv.isHour(band) ? 'button' : 'div', 'band-head'); if (head.tagName === 'BUTTON') { head.type = 'button'; head.dataset.from = String(band.from); }"],
    // 3. A grid set keeps the grid's own occurrence (the zoom, the notes key).
    ['place: byTimePlace(m), occ: occOf(m.e) });', 'place: byTimePlace(m), occ: m.e.__occ || occOf(m.e) });'],
    // 4. A place that only repeats the name says nothing (Despacio on Despacio).
    ['const byTimePlace = (m) => [m.venue, areaOf(m.e)].filter(Boolean);', 'const byTimePlace = (m) => [m.venue, areaOf(m.e)].filter((p) => p && p !== m.e.name);'],
    // 4b. A card from a RUN (an afters room's line-up, `order`) says its start
    //     and no more: "~10:30 PM", never "~10:30 PM – 3 AM" — 3 AM is the
    //     room's close, not the set's end. v94's line was written for Folsom,
    //     where every room is one party and its close IS the party's end.
    ["      : m.startStr ? [approxMark(e, m.startStr), close].filter(Boolean).join(' – ')", "      : m.startStr ? [approxMark(e, m.startStr), e.order ? null : close].filter(Boolean).join(' – ')"],
    // 5. Every section reads by time in list mode.
    ['function sectionBody(fest, key) {\n', 'function sectionBody(fest, key) {\n  if (globalThis.__lv && globalThis.__lv.list) return timeGroups;\n'],
    // 6. The festival room: its sets and extras, one list by time.
    ['      if (day.grid) {\n        const extras = festRoomExtras(fest, day, layout);',
      '      if (day.grid && globalThis.__lv && globalThis.__lv.list) {\n        const sets = state.getDayArtists(day.dayKey, day.weekend).map((a) => globalThis.__lv.asEntry(a, day));\n        timeGroups(room, [...sets, ...festRoomExtras(fest, day, layout)], ctx, { day, fest, fallbackVenue: festRoomSub(fest) });\n      } else if (day.grid) {\n        const extras = festRoomExtras(fest, day, layout);'],
    // 7. After every render (a pick re-renders too): the proto re-applies the
    //    pin and, on a wide screen, lines the rooms up.
    ['  sweepFit(); // the cards this render replaced stop being watched\n', '  sweepFit(); // the cards this render replaced stop being watched\n  if (globalThis.__lv && globalThis.__lv.after) globalThis.__lv.after(root, ctx);\n'],
  ],
  '/index.html': [
    ['<script type="module" src="/js/v3/app.js"></script>', '<link rel="stylesheet" href="/__proto/proto.css"><script type="module" src="/__proto/proto.mjs"></script><script type="module" src="/js/v3/app.js"></script>'],
  ],
};

export function applyPatches(urlPath, text) {
  const list = PATCHES[urlPath];
  if (!list) return text;
  for (const [from, to] of list) {
    const n = text.split(from).length - 1;
    if (n !== 1) throw new Error(`patch for ${urlPath} matched ${n} times: ${from.slice(0, 80)}`);
    text = text.replace(from, () => to);
  }
  return text;
}
