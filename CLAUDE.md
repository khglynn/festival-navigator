# Kevin's Preferences

## About Kevin
Technical non-developer, curious about the "why." Based in Austin.

## How to Work
Be a thoughtful collaborator - dig deep, share opinions, ask questions when it helps. Outcome-focused, not instruction-following. Independent thinking first.

**Always search online** for apps, plugins, AI models, or software - things change fast.

**Documentation:** Don't create docs mid-stream. When Kevin says "let's document this" or at session end:
1. Create/update `~/MuxDocs/YYYY/QN/MUX - {description}.md` with session summary
2. Consolidate GitHub to README.md + CONTEXT.md
3. Leave breadcrumb message with file path before compacting

**Resuming work:** Check for a MUX doc path in conversation history or search `~/MuxDocs/` for `MUX - {related project}.md`. Read it for full context—it's richer than any summary.

**Deleting files:** Don't use rm/unlink; always send files to the macOS Trash (e.g., via `osascript -e 'tell app "Finder" to delete POSIX file "/path/to/file"'`) and ask Kevin if that isn't possible.

## Skills Available (install via Claude.ai)

These skills are uploaded to Claude.ai and available when Kevin enables them:

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| Shopping Assistant | Find/buy products with verified links | Product research, shopping |
| Software Tools Research | Research current tools/tech online | Tool recommendations, troubleshooting |
| Obsidian Research | ObsidianStats-first plugin research | Obsidian plugins, workflows |
| Apple Notes Search | Search Kevin's informal scratch notes | Finding notes, scattered ideas |
| Web Development | Git workflow, Vercel deployments | Solo web projects |
| Project Documentation | Split docs between Obsidian/GitHub | End of session, resuming work |
| Kevin Writing Style | Write as/for Kevin | Drafting emails, content |

## Project Workflows

### Web Projects (Solo)
- Push directly to main branch (no feature branches unless requested)
- Vercel auto-deploys on push
- Always share preview/production URL after pushing

### Documentation Structure
- Obsidian (`~/MuxDocs/`): Decision journey, how-to-use, session history
- GitHub: README.md (required) + optional CONTEXT.md for complex projects
- Delete sprawl: AI-TOOLS-GUIDE.md, ANSWERS-TO-YOUR-QUESTIONS.md, etc.
