# Spotify MCP Server - Complete Setup Guide

*Generated from Claude Code session on December 2, 2025*

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [What We Built](#what-we-built)
3. [Spotify API Research](#spotify-api-research)
4. [MCP Server Basics](#mcp-server-basics)
5. [Claude Code Web vs CLI vs Desktop](#claude-code-web-vs-cli-vs-desktop)
6. [Setup Instructions](#setup-instructions)
7. [Configuration](#configuration)
8. [Available Tools](#available-tools)
9. [Example Workflows](#example-workflows)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

### Your Use Cases
1. **Cross-reference library with festivals** - Compare your followed/liked artists against festival lineups
2. **Find albums for vinyl** - Find albums where you have 6+ saved songs (great album art candidates)
3. **Bulk playlist creation** - Create playlists from podcast song lists (Switched on Pop, This American Life)

### What's Possible with Spotify API
| Use Case | Feasibility | Notes |
|----------|-------------|-------|
| Get followed artists | ✅ Easy | Cursor-based pagination |
| Get artists from liked songs | ✅ Feasible | ~200 API calls for 10k songs |
| Album artwork retrieval | ✅ Easy | 640x640, 300x300, 64x64 sizes |
| Find albums with 6+ saved songs | ✅ Feasible | Local processing after fetch |
| Create playlists from song lists | ✅ Feasible | 100 tracks per request max |
| Song search/matching | ⚠️ Tricky | Needs fuzzy matching |

### Key Limitations
- **Hard limit: 10,000 saved tracks** per Spotify account
- **Rate limits**: ~10-20 requests/second safe
- **Development mode**: Limited to 25 authenticated users
- **Extended quota** (as of May 2025): Requires 250K MAU organization

---

## What We Built

A custom MCP server with **18 tools** for Spotify library analysis and playlist management.

### Project Location
```
GitHub: https://github.com/khglynn/festival-navigator
Branch: claude/spotify-mcp-server-01MT3SDyH8GQWfB5JbtN22LA
Path: festival-navigator/spotify-mcp/
```

### Project Structure
```
spotify-mcp/
├── .env.example         # Template for credentials
├── .gitignore
├── README.md
├── requirements.txt
├── setup_auth.py        # One-time OAuth setup
└── src/
    ├── server.py        # Main MCP server (18 tools)
    ├── spotify_client.py # API wrapper with rate limiting
    └── tools/
        ├── library.py   # Library analysis tools
        ├── search.py    # Batch search with confidence scoring
        └── playlist.py  # Playlist creation tools
```

---

## Spotify API Research

### Existing MCP Servers (Why We Built Custom)
| Server | Language | Best For |
|--------|----------|----------|
| PeterAkande/spotify_mcp | Python | General use (36 tools) |
| Beerspitnight/spotify-mcp-enhanced | Python | Bulk operations |
| marcelmarais/spotify-mcp-server | Node.js | Lightweight |

**None optimized for:**
- Bulk library scanning (10k songs)
- Cross-referencing with external data
- Intelligent song matching with human-in-the-loop

### Required OAuth Scopes
```
user-library-read      # Read saved tracks/albums
user-follow-read       # Read followed artists
playlist-modify-public # Create/edit public playlists
playlist-modify-private # Create/edit private playlists
```

### Rate Limit Strategy
- 0.2 second delay between search calls
- Automatic retry on 429 errors with exponential backoff
- Local caching (24-hour TTL) to reduce repeat calls

---

## MCP Server Basics

### What is MCP?
**Model Context Protocol** - An open protocol by Anthropic that connects LLMs to external tools and data sources. Think of it as "USB-C for AI applications."

### Core Concepts
- **Tools**: Functions the LLM can call (like `search_track`, `create_playlist`)
- **Resources**: Data the LLM can read
- **STDIO Transport**: Local servers communicate via stdin/stdout

### How It Works
1. You configure an MCP server in Claude Desktop/CLI
2. Claude sees the available tools
3. When you ask Claude to do something, it calls the appropriate tool
4. The tool runs locally on your machine and returns results

---

## Claude Code Web vs CLI vs Desktop

### Key Differences
| Feature | Web UI | CLI | Desktop App |
|---------|--------|-----|-------------|
| Files location | Cloud sandbox | Your Mac | Chat only* |
| Persists after session | Maybe not | Yes | N/A |
| Can run OAuth | No (no browser) | Yes | N/A |
| MCP server support | In sandbox | Yes, local | Yes, local |
| Cost | Pro subscription | API credits | Pro subscription |

*Desktop app with Claude Code preview may have local access

### Memory Systems
| File | Location | Scope |
|------|----------|-------|
| `~/.claude/CLAUDE.md` | Home directory | All projects |
| `./CLAUDE.md` | Project root | This project (shared) |
| `./CLAUDE.local.md` | Project root | This project (personal) |

### Exporting Chats
- **Web UI**: Select all (Cmd+A), copy, paste to file
- **CLI**: Chats stored in `~/.claude/projects/` as JSONL
- **Tool**: `pipx install claude-conversation-extractor`

---

## Setup Instructions

### Prerequisites
- Python 3.10+
- Spotify Developer account with app credentials
- Claude Desktop or Claude Code CLI

### Step 1: Clone the Repository
```bash
cd ~
git clone https://github.com/khglynn/festival-navigator.git
cd festival-navigator
git checkout claude/spotify-mcp-server-01MT3SDyH8GQWfB5JbtN22LA
```

### Step 2: Set Up Python Environment
```bash
cd spotify-mcp
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Configure Credentials
```bash
cp .env.example .env
open .env  # or nano .env
```

Add your Spotify credentials:
```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/callback
```

### Step 4: Authenticate with Spotify
```bash
source venv/bin/activate
python setup_auth.py
```
This opens a browser for Spotify login. Token is saved to `.spotify_cache/`.

### Step 5: Test It Works
```bash
python -c "from src.utils.auth import is_authenticated; print('Auth OK!' if is_authenticated() else 'Not authenticated')"
```

---

## Configuration

### For Claude Desktop (Mac App)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "spotify": {
      "command": "/Users/YOURUSERNAME/festival-navigator/spotify-mcp/venv/bin/python",
      "args": ["/Users/YOURUSERNAME/festival-navigator/spotify-mcp/src/server.py"]
    }
  }
}
```

### For Claude Code CLI

Edit `~/.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "spotify": {
      "command": "/Users/YOURUSERNAME/festival-navigator/spotify-mcp/venv/bin/python",
      "args": ["/Users/YOURUSERNAME/festival-navigator/spotify-mcp/src/server.py"]
    }
  }
}
```

### After Configuration
1. Restart Claude Desktop or CLI
2. Look for the hammer icon 🔨 showing available tools

---

## Available Tools

### Library Analysis (6 tools)
| Tool | Description |
|------|-------------|
| `check_auth_status` | Verify Spotify auth is working |
| `get_followed_artists` | Get all artists you follow |
| `get_saved_tracks` | Get all your liked songs |
| `get_library_artists` | Artists from saved songs, ranked by count |
| `get_albums_by_song_count` | Albums with N+ saved songs |
| `export_library_summary` | Complete library export |

### Search (4 tools)
| Tool | Description |
|------|-------------|
| `search_track` | Search for a single track with confidence score |
| `search_track_fuzzy` | Broader search when exact fails |
| `batch_search_tracks` | Search many tracks, categorize by confidence |
| `get_track_preview_url` | Get 30-second preview URL |

### Playlists (6 tools)
| Tool | Description |
|------|-------------|
| `create_playlist` | Create a new playlist |
| `add_tracks_to_playlist` | Add tracks to existing playlist |
| `import_and_create_playlist` | Full CSV → playlist workflow |
| `create_playlist_from_search_results` | Create from batch search |
| `add_reviewed_tracks` | Add reviewed/corrected tracks |
| `get_playlist_info` | Get playlist details |

### Utilities (2 tools)
| Tool | Description |
|------|-------------|
| `parse_song_list_csv` | Validate a song CSV |
| `export_review_csv` | Export uncertain matches for review |

---

## Example Workflows

### Get Your Top Artists by Saved Songs
Ask Claude:
> "What artists do I have the most saved songs from?"

Uses: `get_library_artists`

### Find Albums for Vinyl Shopping
Ask Claude:
> "Find albums where I have 6 or more saved songs, show me the artwork"

Uses: `get_albums_by_song_count(min_songs=6)`

### Create Playlist from Song List
1. Prepare CSV:
```csv
title,artist
Bohemian Rhapsody,Queen
Hotel California,Eagles
```

2. Ask Claude:
> "Create a playlist called 'My Mix' from this CSV: [paste CSV]"

Uses: `import_and_create_playlist`

### Bulk Podcast Playlist (500+ songs)
1. Ask Claude to use `batch_search_tracks` with your song list
2. Results categorized:
   - **HIGH (≥90%)**: Auto-added
   - **MEDIUM (70-89%)**: Review suggested
   - **LOW (<70%)**: Needs attention
3. Use `export_review_csv` for uncertain matches
4. Review in spreadsheet, edit 'action' column
5. Use `add_reviewed_tracks` with your corrections

---

## Troubleshooting

### "Not authenticated" Error
```bash
cd spotify-mcp
source venv/bin/activate
python setup_auth.py
```

### Rate Limit (429) Errors
- Wait a few minutes
- Server auto-retries with backoff
- Use caching (`use_cache=True`)

### Token Expired
Server auto-refreshes. If issues persist:
```bash
rm -rf .spotify_cache/
python setup_auth.py
```

### MCP Server Not Showing in Claude
1. Check config file syntax (valid JSON?)
2. Use absolute paths (not `~`)
3. Restart Claude completely
4. Check server runs manually:
   ```bash
   cd spotify-mcp
   source venv/bin/activate
   python src/server.py
   ```

### Concurrency Error (400) in CLI
Happens when web and CLI access same session:
1. Close all Claude tabs/windows
2. Wait 30 seconds
3. Start fresh session: `claude` (not `--teleport`)

---

## Security Notes

- `.env` file is gitignored (never committed)
- Auth tokens stored locally in `.spotify_cache/`
- **Rotate your client secret** if ever exposed
- Development mode = 25 user limit (fine for personal use)

---

## Quick Reference

### Start Fresh CLI Session
```bash
cd /path/to/festival-navigator
claude
```

### Check Auth Status
```bash
cd spotify-mcp && source venv/bin/activate
python -c "from src.utils.auth import is_authenticated; print(is_authenticated())"
```

### Re-authenticate
```bash
cd spotify-mcp && source venv/bin/activate
python setup_auth.py
```

### Config File Locations
| App | Path |
|-----|------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Code CLI | `~/.claude/settings.local.json` |

---

*This guide was generated from a Claude Code session. For updates, check the README in the spotify-mcp folder.*
