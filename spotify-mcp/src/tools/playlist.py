"""
Playlist creation and management tools for MCP.
"""

import csv
from io import StringIO
from typing import Any, Dict, List, Optional

from ..spotify_client import spotify_client
from .search import batch_search_tracks, parse_song_list_csv


def create_playlist(
    name: str,
    description: str = "",
    public: bool = False,
) -> Dict[str, Any]:
    """
    Create a new Spotify playlist.

    Args:
        name: Playlist name
        description: Playlist description
        public: Whether playlist is public (default False)

    Returns:
        Created playlist info
    """
    playlist = spotify_client.create_playlist(
        name=name,
        description=description,
        public=public,
    )

    return {
        "id": playlist["id"],
        "uri": playlist["uri"],
        "name": playlist["name"],
        "url": playlist["external_urls"]["spotify"],
        "public": playlist["public"],
    }


def add_tracks_to_playlist(
    playlist_id: str,
    track_uris: List[str],
) -> Dict[str, Any]:
    """
    Add tracks to a playlist.

    Handles batching automatically (Spotify allows max 100 per request).

    Args:
        playlist_id: Playlist ID (not URI)
        track_uris: List of Spotify track URIs

    Returns:
        Result with count added
    """
    # Filter out any invalid URIs
    valid_uris = [uri for uri in track_uris if uri and uri.startswith("spotify:track:")]

    if not valid_uris:
        return {
            "success": False,
            "error": "No valid track URIs provided",
            "tracks_added": 0,
        }

    spotify_client.add_tracks_to_playlist(playlist_id, valid_uris)

    return {
        "success": True,
        "playlist_id": playlist_id,
        "tracks_added": len(valid_uris),
    }


def create_playlist_from_search_results(
    name: str,
    batch_results: Dict[str, Any],
    include_confidence: str = "high",
    description: str = "",
    public: bool = False,
) -> Dict[str, Any]:
    """
    Create a playlist from batch search results.

    Args:
        name: Playlist name
        batch_results: Results from batch_search_tracks
        include_confidence: Which confidence levels to include:
            - "high": Only high confidence (>= 90%)
            - "high_medium": High and medium (>= 70%)
            - "all": All matches (use with caution)
        description: Playlist description
        public: Whether playlist is public

    Returns:
        Created playlist info with track counts
    """
    # Collect URIs based on confidence setting
    track_uris = []

    if include_confidence in ["high", "high_medium", "all"]:
        for match in batch_results.get("high_confidence", []):
            track_uris.append(match["uri"])

    if include_confidence in ["high_medium", "all"]:
        for match in batch_results.get("medium_confidence", []):
            track_uris.append(match["uri"])

    if include_confidence == "all":
        for match in batch_results.get("low_confidence", []):
            track_uris.append(match["uri"])

    if not track_uris:
        return {
            "success": False,
            "error": "No tracks to add based on confidence filter",
        }

    # Check playlist size limit
    if len(track_uris) > 10000:
        return {
            "success": False,
            "error": f"Too many tracks ({len(track_uris)}). Spotify max is 10,000 per playlist.",
            "suggestion": "Split into multiple playlists",
        }

    # Create playlist
    playlist = create_playlist(name=name, description=description, public=public)

    # Add tracks
    result = add_tracks_to_playlist(playlist["id"], track_uris)

    return {
        "success": True,
        "playlist": playlist,
        "tracks_added": result["tracks_added"],
        "confidence_filter": include_confidence,
        "skipped": {
            "medium": len(batch_results.get("medium_confidence", []))
            if include_confidence == "high"
            else 0,
            "low": len(batch_results.get("low_confidence", []))
            if include_confidence != "all"
            else 0,
            "not_found": len(batch_results.get("not_found", [])),
        },
    }


def import_and_create_playlist(
    name: str,
    csv_content: str,
    include_confidence: str = "high",
    description: str = "",
    public: bool = False,
) -> Dict[str, Any]:
    """
    Full workflow: Parse CSV, search all tracks, create playlist.

    This is the main tool for bulk playlist creation.

    Args:
        name: Playlist name
        csv_content: CSV with columns: title, artist
        include_confidence: "high", "high_medium", or "all"
        description: Playlist description
        public: Whether playlist is public

    Returns:
        Complete results including search stats and playlist info
    """
    # Parse CSV
    songs = parse_song_list_csv(csv_content)

    if not songs:
        return {
            "success": False,
            "error": "No songs found in CSV. Expected columns: title, artist",
        }

    # Batch search
    search_results = batch_search_tracks(songs)

    # Create playlist with matching tracks
    playlist_result = create_playlist_from_search_results(
        name=name,
        batch_results=search_results,
        include_confidence=include_confidence,
        description=description,
        public=public,
    )

    return {
        "search_summary": search_results["summary"],
        "playlist_result": playlist_result,
        "needs_review": {
            "medium_confidence": search_results["medium_confidence"]
            if include_confidence == "high"
            else [],
            "low_confidence": search_results["low_confidence"],
            "not_found": search_results["not_found"],
        },
    }


def add_reviewed_tracks(
    playlist_id: str,
    reviewed_csv: str,
) -> Dict[str, Any]:
    """
    Add tracks from a reviewed CSV to an existing playlist.

    The CSV should have an 'action' column:
    - 'approve': Add the matched track
    - 'reject': Skip this track
    - spotify:track:xxx: Use this specific URI instead

    Args:
        playlist_id: Existing playlist ID
        reviewed_csv: Reviewed CSV content

    Returns:
        Result with counts
    """
    reader = csv.DictReader(StringIO(reviewed_csv))

    approved_uris = []
    rejected = 0
    custom = 0

    for row in reader:
        action = row.get("action", "").strip()

        if action == "approve":
            uri = row.get("spotify_uri", "")
            if uri:
                approved_uris.append(uri)
        elif action == "reject" or action == "":
            rejected += 1
        elif action.startswith("spotify:track:"):
            approved_uris.append(action)
            custom += 1

    if not approved_uris:
        return {
            "success": False,
            "tracks_added": 0,
            "rejected": rejected,
            "error": "No tracks approved in review",
        }

    result = add_tracks_to_playlist(playlist_id, approved_uris)

    return {
        "success": True,
        "tracks_added": result["tracks_added"],
        "custom_replacements": custom,
        "rejected": rejected,
        "playlist_id": playlist_id,
    }


def get_playlist_info(playlist_id: str) -> Dict[str, Any]:
    """
    Get information about a playlist.

    Args:
        playlist_id: Playlist ID

    Returns:
        Playlist details
    """
    try:
        playlist = spotify_client.client.playlist(playlist_id)
        tracks = spotify_client.get_playlist_tracks(playlist_id)

        return {
            "id": playlist["id"],
            "name": playlist["name"],
            "description": playlist.get("description", ""),
            "url": playlist["external_urls"]["spotify"],
            "owner": playlist["owner"]["display_name"],
            "public": playlist["public"],
            "track_count": len(tracks),
            "followers": playlist["followers"]["total"],
        }
    except Exception as e:
        return {
            "error": str(e),
        }
