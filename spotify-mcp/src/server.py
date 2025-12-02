#!/usr/bin/env python3
"""
Spotify MCP Server

A Model Context Protocol server for Spotify library analysis
and playlist management.

Run with: python src/server.py
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

# Load environment variables before anything else
load_dotenv(Path(__file__).parent.parent / ".env")

from fastmcp import FastMCP

from src.utils.auth import is_authenticated, get_spotify_client
from src.tools import library, search, playlist

# Create the MCP server
mcp = FastMCP(
    "Spotify Library Manager",
    instructions="Analyze your Spotify library and create playlists from song lists",
)


# =============================================================================
# Authentication & User Info
# =============================================================================


@mcp.tool()
def check_auth_status() -> dict:
    """
    Check if Spotify authentication is set up and working.

    Returns current user info if authenticated.
    """
    if not is_authenticated():
        return {
            "authenticated": False,
            "message": "Not authenticated. Run 'python setup_auth.py' to authenticate.",
        }

    try:
        client = get_spotify_client()
        if client is None:
            return {
                "authenticated": False,
                "message": "Failed to get Spotify client. Check credentials.",
            }

        user = client.current_user()
        return {
            "authenticated": True,
            "user": {
                "id": user["id"],
                "display_name": user.get("display_name"),
                "email": user.get("email"),
                "country": user.get("country"),
                "product": user.get("product"),  # premium, free, etc.
            },
        }
    except Exception as e:
        return {
            "authenticated": False,
            "error": str(e),
        }


# =============================================================================
# Library Analysis Tools
# =============================================================================


@mcp.tool()
def get_followed_artists(use_cache: bool = True) -> dict:
    """
    Get all artists you follow on Spotify.

    Args:
        use_cache: Use cached data if available (faster, default True)

    Returns:
        List of followed artists with names, genres, popularity, and images.
    """
    return library.get_followed_artists(use_cache=use_cache)


@mcp.tool()
def get_saved_tracks(use_cache: bool = True) -> dict:
    """
    Get all your liked/saved songs on Spotify.

    Note: This may take 1-2 minutes for large libraries (10k songs).

    Args:
        use_cache: Use cached data if available (faster, default True)

    Returns:
        List of saved tracks with title, artist, album, and metadata.
    """
    return library.get_saved_tracks(use_cache=use_cache)


@mcp.tool()
def get_library_artists(use_cache: bool = True) -> dict:
    """
    Get unique artists from your saved songs, sorted by song count.

    This shows artists you have saved songs from (even if not followed),
    ranked by how many songs you've saved.

    Args:
        use_cache: Use cached data if available

    Returns:
        Artists with their saved song counts, sorted most-to-least.
    """
    return library.get_library_artists(use_cache=use_cache)


@mcp.tool()
def get_albums_by_song_count(min_songs: int = 6, use_cache: bool = True) -> dict:
    """
    Find albums where you have N or more saved songs.

    Great for finding albums worth buying on vinyl!

    Args:
        min_songs: Minimum saved songs to include album (default 6)
        use_cache: Use cached data if available

    Returns:
        Albums meeting the threshold, with artwork URLs and song lists.
    """
    return library.get_albums_by_song_count(min_songs=min_songs, use_cache=use_cache)


@mcp.tool()
def export_library_summary(use_cache: bool = True) -> dict:
    """
    Export a complete summary of your Spotify library.

    Includes:
    - Followed artists
    - Top artists by saved song count
    - Albums with most saved songs

    Args:
        use_cache: Use cached data if available

    Returns:
        Complete library summary with statistics.
    """
    return library.export_library_summary(use_cache=use_cache)


# =============================================================================
# Search Tools
# =============================================================================


@mcp.tool()
def search_track(title: str, artist: str, limit: int = 5) -> dict:
    """
    Search for a single track and get matches with confidence scores.

    Args:
        title: Track title
        artist: Artist name
        limit: Max results to return (default 5)

    Returns:
        Search results ranked by confidence, with preview URLs.
    """
    return search.search_track(title=title, artist=artist, limit=limit)


@mcp.tool()
def search_track_fuzzy(title: str, artist: str, limit: int = 10) -> dict:
    """
    Broader fuzzy search when exact match fails.

    Tries multiple strategies:
    1. Exact title + artist
    2. Title only
    3. Simplified title (removing parentheses, etc.)

    Args:
        title: Track title
        artist: Artist name
        limit: Max results per strategy

    Returns:
        Combined results from all search strategies.
    """
    return search.search_track_fuzzy(title=title, artist=artist, limit=limit)


@mcp.tool()
def batch_search_tracks(songs: list, delay_seconds: float = 0.2) -> dict:
    """
    Search for multiple tracks with confidence scoring.

    Categorizes results:
    - HIGH (>= 90%): Safe to auto-add
    - MEDIUM (70-89%): Should review
    - LOW (< 70%): Needs attention
    - NOT FOUND: No results

    Args:
        songs: List of {"title": "...", "artist": "..."} dicts
        delay_seconds: Delay between API calls (default 0.2s for rate limiting)

    Returns:
        Categorized results with statistics.

    Example input:
        [
            {"title": "Bohemian Rhapsody", "artist": "Queen"},
            {"title": "Hotel California", "artist": "Eagles"}
        ]
    """
    return search.batch_search_tracks(songs=songs, delay_seconds=delay_seconds)


@mcp.tool()
def get_track_preview_url(track_uri: str) -> dict:
    """
    Get the 30-second preview URL for a track.

    Args:
        track_uri: Spotify track URI (e.g., "spotify:track:xxx")

    Returns:
        Track info with preview URL (if available).
    """
    return search.get_track_preview_url(track_uri=track_uri)


# =============================================================================
# Playlist Tools
# =============================================================================


@mcp.tool()
def create_playlist(name: str, description: str = "", public: bool = False) -> dict:
    """
    Create a new Spotify playlist.

    Args:
        name: Playlist name
        description: Playlist description
        public: Whether playlist is public (default False)

    Returns:
        Created playlist info with URL.
    """
    return playlist.create_playlist(name=name, description=description, public=public)


@mcp.tool()
def add_tracks_to_playlist(playlist_id: str, track_uris: list) -> dict:
    """
    Add tracks to an existing playlist.

    Handles batching automatically (Spotify max 100 per request).

    Args:
        playlist_id: Playlist ID (not URI)
        track_uris: List of Spotify track URIs

    Returns:
        Result with count of tracks added.
    """
    return playlist.add_tracks_to_playlist(playlist_id=playlist_id, track_uris=track_uris)


@mcp.tool()
def create_playlist_from_search_results(
    name: str,
    batch_results: dict,
    include_confidence: str = "high",
    description: str = "",
    public: bool = False,
) -> dict:
    """
    Create a playlist from batch search results.

    Args:
        name: Playlist name
        batch_results: Results from batch_search_tracks
        include_confidence: Which confidence levels to include:
            - "high": Only >= 90% matches (safest)
            - "high_medium": >= 70% matches
            - "all": All matches (use with caution)
        description: Playlist description
        public: Whether playlist is public

    Returns:
        Created playlist info with statistics.
    """
    return playlist.create_playlist_from_search_results(
        name=name,
        batch_results=batch_results,
        include_confidence=include_confidence,
        description=description,
        public=public,
    )


@mcp.tool()
def import_and_create_playlist(
    name: str,
    csv_content: str,
    include_confidence: str = "high",
    description: str = "",
    public: bool = False,
) -> dict:
    """
    Full workflow: Parse song list CSV, search all tracks, create playlist.

    This is the main tool for bulk playlist creation from a list of songs.

    CSV format:
        title,artist
        Bohemian Rhapsody,Queen
        Hotel California,Eagles

    Args:
        name: Playlist name
        csv_content: CSV content with columns: title, artist
        include_confidence: "high", "high_medium", or "all"
        description: Playlist description
        public: Whether playlist is public

    Returns:
        Complete results including search stats, created playlist, and songs needing review.
    """
    return playlist.import_and_create_playlist(
        name=name,
        csv_content=csv_content,
        include_confidence=include_confidence,
        description=description,
        public=public,
    )


@mcp.tool()
def add_reviewed_tracks(playlist_id: str, reviewed_csv: str) -> dict:
    """
    Add tracks from a reviewed CSV to an existing playlist.

    Use this after reviewing uncertain matches from a batch search.

    The CSV should have an 'action' column:
    - 'approve': Add the matched track
    - 'reject': Skip this track
    - spotify:track:xxx: Use this specific URI instead

    Args:
        playlist_id: Existing playlist ID
        reviewed_csv: Reviewed CSV content with 'action' column

    Returns:
        Result with counts of added/rejected tracks.
    """
    return playlist.add_reviewed_tracks(playlist_id=playlist_id, reviewed_csv=reviewed_csv)


@mcp.tool()
def get_playlist_info(playlist_id: str) -> dict:
    """
    Get information about a playlist.

    Args:
        playlist_id: Playlist ID

    Returns:
        Playlist details including name, track count, and URL.
    """
    return playlist.get_playlist_info(playlist_id=playlist_id)


# =============================================================================
# Utility Tools
# =============================================================================


@mcp.tool()
def parse_song_list_csv(csv_content: str) -> dict:
    """
    Parse a CSV of songs into a structured list.

    Use this to validate your CSV before batch searching.

    Expected CSV format:
        title,artist
        Song Name,Artist Name

    Args:
        csv_content: CSV content as string

    Returns:
        Parsed list of songs ready for batch_search_tracks.
    """
    songs = search.parse_song_list_csv(csv_content)
    return {
        "count": len(songs),
        "songs": songs,
        "ready_for_search": len(songs) > 0,
    }


@mcp.tool()
def export_review_csv(batch_results: dict) -> dict:
    """
    Export medium/low confidence matches to a CSV for human review.

    Args:
        batch_results: Results from batch_search_tracks

    Returns:
        CSV content to review and edit.
    """
    csv_content = search.export_review_csv(batch_results)
    return {
        "csv_content": csv_content,
        "instructions": (
            "Edit the 'action' column:\n"
            "- 'approve': Add the matched track\n"
            "- 'reject': Skip this track\n"
            "- spotify:track:xxx: Use a different track URI\n"
            "Then use add_reviewed_tracks() to add to playlist."
        ),
    }


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    print("Starting Spotify MCP Server...", file=sys.stderr)
    mcp.run()
