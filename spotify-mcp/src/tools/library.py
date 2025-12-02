"""
Library analysis tools for MCP.
"""

from collections import defaultdict
from typing import Any, Dict, List

from ..spotify_client import spotify_client


def get_followed_artists(use_cache: bool = True) -> Dict[str, Any]:
    """
    Get all artists you follow on Spotify.

    Args:
        use_cache: Use cached data if available (default True)

    Returns:
        Dictionary with artist list and count
    """
    artists = spotify_client.get_followed_artists(use_cache=use_cache)

    # Simplify the response
    simplified = [
        {
            "name": a["name"],
            "id": a["id"],
            "uri": a["uri"],
            "genres": a.get("genres", []),
            "popularity": a.get("popularity", 0),
            "followers": a.get("followers", {}).get("total", 0),
            "image_url": a["images"][0]["url"] if a.get("images") else None,
        }
        for a in artists
    ]

    return {
        "count": len(simplified),
        "artists": simplified,
    }


def get_saved_tracks(
    use_cache: bool = True,
    include_audio_features: bool = False,
) -> Dict[str, Any]:
    """
    Get all your liked/saved songs on Spotify.

    Note: This may take a while for large libraries (10k songs = ~200 API calls).

    Args:
        use_cache: Use cached data if available (default True)
        include_audio_features: Include audio features (tempo, energy, etc.)

    Returns:
        Dictionary with track list and count
    """
    tracks = spotify_client.get_all_saved_tracks(use_cache=use_cache)

    # Simplify the response
    simplified = []
    for item in tracks:
        track = item["track"]
        if track is None:  # Sometimes tracks get removed from Spotify
            continue

        simplified.append({
            "name": track["name"],
            "id": track["id"],
            "uri": track["uri"],
            "artists": [{"name": a["name"], "id": a["id"]} for a in track["artists"]],
            "album": {
                "name": track["album"]["name"],
                "id": track["album"]["id"],
                "release_date": track["album"].get("release_date"),
                "image_url": track["album"]["images"][0]["url"]
                if track["album"].get("images")
                else None,
            },
            "duration_ms": track["duration_ms"],
            "popularity": track.get("popularity", 0),
            "added_at": item["added_at"],
            "preview_url": track.get("preview_url"),
        })

    return {
        "count": len(simplified),
        "tracks": simplified,
    }


def get_library_artists(use_cache: bool = True) -> Dict[str, Any]:
    """
    Get unique artists from your saved songs.

    This extracts all artists from your liked songs, giving you artists
    you may not follow but have saved songs from.

    Args:
        use_cache: Use cached data if available

    Returns:
        Dictionary with unique artists and song counts
    """
    tracks = spotify_client.get_all_saved_tracks(use_cache=use_cache)

    # Count songs per artist
    artist_songs: Dict[str, Dict[str, Any]] = {}

    for item in tracks:
        track = item["track"]
        if track is None:
            continue

        for artist in track["artists"]:
            artist_id = artist["id"]
            if artist_id not in artist_songs:
                artist_songs[artist_id] = {
                    "name": artist["name"],
                    "id": artist_id,
                    "uri": artist.get("uri", f"spotify:artist:{artist_id}"),
                    "song_count": 0,
                    "songs": [],
                }

            artist_songs[artist_id]["song_count"] += 1
            artist_songs[artist_id]["songs"].append({
                "name": track["name"],
                "id": track["id"],
            })

    # Sort by song count descending
    sorted_artists = sorted(
        artist_songs.values(),
        key=lambda x: x["song_count"],
        reverse=True,
    )

    return {
        "count": len(sorted_artists),
        "artists": sorted_artists,
    }


def get_albums_by_song_count(
    min_songs: int = 6,
    use_cache: bool = True,
) -> Dict[str, Any]:
    """
    Find albums where you have N or more saved songs.

    Great for finding albums you might want to buy on vinyl!

    Args:
        min_songs: Minimum saved songs to include album (default 6)
        use_cache: Use cached data if available

    Returns:
        Dictionary with qualifying albums
    """
    tracks = spotify_client.get_all_saved_tracks(use_cache=use_cache)

    # Group tracks by album
    albums: Dict[str, Dict[str, Any]] = {}

    for item in tracks:
        track = item["track"]
        if track is None:
            continue

        album = track["album"]
        album_id = album["id"]

        if album_id not in albums:
            albums[album_id] = {
                "name": album["name"],
                "id": album_id,
                "uri": album.get("uri", f"spotify:album:{album_id}"),
                "artists": [a["name"] for a in album.get("artists", [])],
                "release_date": album.get("release_date"),
                "total_tracks": album.get("total_tracks", 0),
                "saved_songs": [],
                "image_url": album["images"][0]["url"]
                if album.get("images")
                else None,
                "image_large": album["images"][0]["url"]
                if album.get("images")
                else None,
                "image_medium": album["images"][1]["url"]
                if album.get("images") and len(album["images"]) > 1
                else None,
                "image_small": album["images"][2]["url"]
                if album.get("images") and len(album["images"]) > 2
                else None,
            }

        albums[album_id]["saved_songs"].append({
            "name": track["name"],
            "id": track["id"],
        })

    # Filter and sort
    qualifying = [
        {
            **album,
            "saved_count": len(album["saved_songs"]),
            "percentage": round(
                len(album["saved_songs"]) / album["total_tracks"] * 100
                if album["total_tracks"] > 0
                else 0,
                1,
            ),
        }
        for album in albums.values()
        if len(album["saved_songs"]) >= min_songs
    ]

    # Sort by saved count descending
    qualifying.sort(key=lambda x: x["saved_count"], reverse=True)

    return {
        "count": len(qualifying),
        "min_songs_filter": min_songs,
        "albums": qualifying,
    }


def export_library_summary(use_cache: bool = True) -> Dict[str, Any]:
    """
    Export a complete summary of your Spotify library.

    Includes followed artists, saved tracks, and album statistics.

    Args:
        use_cache: Use cached data if available

    Returns:
        Complete library summary
    """
    followed = get_followed_artists(use_cache=use_cache)
    tracks = get_saved_tracks(use_cache=use_cache)
    library_artists = get_library_artists(use_cache=use_cache)
    albums = get_albums_by_song_count(min_songs=1, use_cache=use_cache)

    return {
        "summary": {
            "followed_artists": followed["count"],
            "saved_tracks": tracks["count"],
            "unique_artists_in_library": library_artists["count"],
            "unique_albums_in_library": albums["count"],
        },
        "followed_artists": followed["artists"],
        "top_artists_by_saved_songs": library_artists["artists"][:50],
        "albums_with_most_saved_songs": albums["albums"][:50],
    }
