# Spotify MCP Server

## What This Is
A custom MCP (Model Context Protocol) server that connects Claude to your Spotify account for library analysis and playlist management. Built to support three main use cases: cross-referencing your music library with festival lineups, finding albums worth buying on vinyl (6+ saved songs), and bulk-creating playlists from podcast song lists.

## Quick Reference
- **GitHub:** https://github.com/khglynn/festival-navigator (branch: `claude/spotify-mcp-server-01MT3SDyH8GQWfB5JbtN22LA`)
- **Local path:** `~/Desktop/KevinIsDev/claude-code-cli/festival-navigator/spotify-mcp/`
- **Run server:** `cd spotify-mcp && source venv/bin/activate && python src/server.py`
- **Re-authenticate:** `python setup_auth.py`
- **Env vars needed:** `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`

## How to Modify
- **Add new tools:** Edit `src/tools/` files, register in `src/server.py` with `@mcp.tool()` decorator
- **Change search logic:** Edit `src/tools/search.py` - confidence scoring is in `calculate_match_confidence()`
- **Adjust rate limits:** Edit delays in `src/spotify_client.py` (currently 0.1-0.2s between calls)
- **Clear cached data:** Delete `.spotify_cache/` folder (except `token.cache` for auth)

## Decisions & Context

### Why build custom vs use existing MCP servers
Existing Spotify MCP servers (PeterAkande, Beerspitnight, marcelmarais) focus on playback control or general library access. None were optimized for:
- Bulk library scanning (10k songs efficiently)
- Cross-referencing with external data (festival lineups)
- Confidence-based song matching with human-in-the-loop review

### Why Python over Node.js
- `spotipy` library handles OAuth complexity well
- `FastMCP` makes tool creation simple
- Easier to read/modify for non-developers
- `thefuzz` library for fuzzy string matching

### Confidence scoring approach
Songs searched get categorized:
- **HIGH (≥90%):** Auto-add to playlist
- **MEDIUM (70-89%):** Review suggested
- **LOW (<70%):** Needs manual attention

This lets bulk operations (500+ songs) proceed automatically while flagging uncertain matches.

### Spotify API constraints we designed around
- 10,000 saved tracks hard limit per account
- 50 items max per request (requires pagination)
- Rate limits ~10-20 req/sec (built-in delays)
- Development mode = 25 users max (fine for personal use)

## Session Log

### December 2, 2025 - Initial Build

**What happened:** Built complete Spotify MCP server with 18 tools. Researched existing MCP servers and Spotify API limitations. Set up in festival-navigator repo on feature branch.

**Key decisions:**
- **Custom build over forking:** Existing servers didn't match use cases
- **Python + FastMCP:** Best library support, easiest to modify
- **Batch search with tiers:** Enables bulk ops while catching mistakes
- **Local-only first:** OAuth simpler, no deployment complexity

**Pivots & problems:**
- FastMCP API changed (`description` → `instructions` param) - quick fix
- Claude Code web vs local confusion - user needed handholding on where files actually live
- Concurrency errors when web + CLI accessed same session - documented fix
- User's skills weren't synced to cloud sandbox - skills are per-environment

**Files changed:**
- `spotify-mcp/` - entire new directory (15 files)
- `docs/spotify-mcp-setup-guide.md` - comprehensive setup docs
- `docs/MUX - Spotify MCP Server.md` - this file

**Still TODO:**
- [ ] User needs to complete local setup (venv, credentials, auth)
- [ ] Configure Claude Desktop MCP settings
- [ ] Test tools work end-to-end
- [ ] Rotate Spotify client secret (was exposed in screenshot)
