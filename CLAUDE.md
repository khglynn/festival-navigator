@AGENTS.md

<!-- This repo's agent instructions live in AGENTS.md, so Codex and other agents read the same file; Claude Code loads it through the import above. Edit AGENTS.md. Add a line here only for something that applies to Claude Code alone. -->

Claude Code only (moved from AGENTS.md, 2026-10-19):

- Hook command strings in `.claude/settings.json` must stay apostrophe-free
  (a `'` closes the shell quote and silently breaks compaction).
- The Write tool has serialized literal control bytes (`\x00`) into files in
  this repo twice when escape sequences were intended — after writing
  regexes/tests with `\xNN`, verify with `python3 -c "open(...,'rb')"`.
