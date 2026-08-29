# Notes + desktop round — the design canvas and the rig that built it (2026-08-29)

Canvas (Claude Design, 17 artboards): https://claude.ai/code/artifact/5e9504d4-ea25-4ab7-bc6f-a32bf8b3b635

Every wall on the canvas is rendered by production code, not drawn: `rig.mjs`
loads the real modules (state.js, wall.js, notes.js, aura.js) in jsdom the
way `tests/wall-dom.test.mjs` does, seeds a throwaway crew (Ava, Ben, Cleo,
Dev; picks; notes incl. `re:` replies), and hands `build.mjs` live DOM.
`build.mjs` slices that DOM into artboards, layers the round's new pieces
(whisper line, hover facts, expanded-card sheet header, threads, chip door)
on top with the app's own tokens and classes, and writes `out/*.dc.html` +
`canvas.json`. The 2026-08-27 canvas was rejected as "not up to snuff"
because its cards were approximations; this is the fix — the cards ARE
renderCard's.

Rebuild: `node claude-plans/2026-08-29-notes-desktop-canvas/build.mjs`
(writes `out/` beside the script; seed and publish with the `design`
skill's helper). Generated `out/` is not committed.
