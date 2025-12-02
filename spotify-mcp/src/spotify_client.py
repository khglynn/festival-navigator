"""
Spotify API client wrapper with pagination and rate limit handling.
"""

import sys
import time
from typing import Any, Dict, Generator, List, Optional

import spotipy
from spotipy.exceptions import SpotifyException

from .utils.auth import get_spotify_client
from .utils.cache import load_cache, save_cache


class SpotifyClient:
    """Wrapper around spotipy with pagination and caching."""

    def __init__(self):
        self._client: Optional[spotipy.Spotify] = None

    @property
    def client(self) -> spotipy.Spotify:
        """Get or create the Spotify client."""
        if self._client is None:
            self._client = get_spotify_client(interactive=False)
            if self._client is None:
                raise RuntimeError(
                    "Not authenticated. Run 'python setup_auth.py' first."
                )
        return self._client

    def _handle_rate_limit(self, func, *args, **kwargs) -> Any:
        """Execute a function with rate limit retry."""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except SpotifyException as e:
                if e.http_status == 429:
                    retry_after = int(e.headers.get("Retry-After", 5)) + 1
                    print(f"Rate limited. Waiting {retry_after}s...", file=sys.stderr)
                    time.sleep(retry_after)
                else:
                    raise
        raise RuntimeError("Max retries exceeded for rate limit")

    # =========================================================================
    # User Profile
    # =========================================================================

    def get_current_user(self) -> Dict[str, Any]:
        """Get the current user's profile."""
        return self._handle_rate_limit(self.client.current_user)

    # =========================================================================
    # Library - Followed Artists
    # =========================================================================

    def get_followed_artists(self, use_cache: bool = True) -> List[Dict[str, Any]]:
        """
        Get all followed artists.

        Args:
            use_cache: Whether to use cached data if available

        Returns:
            List of artist objects
        """
        if use_cache:
            cached = load_cache("followed_artists")
            if cached:
                return cached

        artists = []
        after = None

        while True:
            result = self._handle_rate_limit(
                self.client.current_user_followed_artists,
                limit=50,
                after=after,
            )

            items = result["artists"]["items"]
            artists.extend(items)

            print(f"Fetched {len(artists)} followed artists...", file=sys.stderr)

            # Cursor-based pagination
            cursors = result["artists"].get("cursors", {})
            after = cursors.get("after")
            if not after:
                break

            time.sleep(0.1)  # Be nice to the API

        save_cache("followed_artists", artists, ttl_hours=24)
        return artists

    # =========================================================================
    # Library - Saved Tracks
    # =========================================================================

    def get_saved_tracks_paginated(
        self, limit: int = 50
    ) -> Generator[List[Dict[str, Any]], None, None]:
        """
        Generator that yields batches of saved tracks.

        Args:
            limit: Tracks per batch (max 50)

        Yields:
            Batches of saved track objects
        """
        offset = 0
        total = None

        while True:
            result = self._handle_rate_limit(
                self.client.current_user_saved_tracks,
                limit=limit,
                offset=offset,
            )

            if total is None:
                total = result["total"]
                print(f"Total saved tracks: {total}", file=sys.stderr)

            items = result["items"]
            if not items:
                break

            yield items

            offset += len(items)
            print(f"Fetched {offset}/{total} saved tracks...", file=sys.stderr)

            if offset >= total:
                break

            time.sleep(0.1)  # Be nice to the API

    def get_all_saved_tracks(self, use_cache: bool = True) -> List[Dict[str, Any]]:
        """
        Get all saved tracks (may take a while for large libraries).

        Args:
            use_cache: Whether to use cached data if available

        Returns:
            List of saved track objects
        """
        if use_cache:
            cached = load_cache("saved_tracks")
            if cached:
                return cached

        all_tracks = []
        for batch in self.get_saved_tracks_paginated():
            all_tracks.extend(batch)

        save_cache("saved_tracks", all_tracks, ttl_hours=24)
        return all_tracks

    # =========================================================================
    # Library - Saved Albums
    # =========================================================================

    def get_saved_albums(self, use_cache: bool = True) -> List[Dict[str, Any]]:
        """Get all saved albums."""
        if use_cache:
            cached = load_cache("saved_albums")
            if cached:
                return cached

        albums = []
        offset = 0

        while True:
            result = self._handle_rate_limit(
                self.client.current_user_saved_albums,
                limit=50,
                offset=offset,
            )

            items = result["items"]
            if not items:
                break

            albums.extend(items)
            offset += len(items)

            print(f"Fetched {offset} saved albums...", file=sys.stderr)

            if offset >= result["total"]:
                break

            time.sleep(0.1)

        save_cache("saved_albums", albums, ttl_hours=24)
        return albums

    # =========================================================================
    # Search
    # =========================================================================

    def search_track(
        self,
        query: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Search for tracks.

        Args:
            query: Search query (can include track: and artist: filters)
            limit: Number of results (max 50)

        Returns:
            List of track objects
        """
        result = self._handle_rate_limit(
            self.client.search,
            q=query,
            type="track",
            limit=limit,
        )
        return result["tracks"]["items"]

    def search_track_by_name_artist(
        self,
        track_name: str,
        artist_name: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Search for a track by name and artist.

        Args:
            track_name: Track name
            artist_name: Artist name
            limit: Number of results

        Returns:
            List of track objects
        """
        # Build a structured query
        query = f'track:"{track_name}" artist:"{artist_name}"'
        return self.search_track(query, limit)

    # =========================================================================
    # Playlists
    # =========================================================================

    def create_playlist(
        self,
        name: str,
        description: str = "",
        public: bool = False,
    ) -> Dict[str, Any]:
        """
        Create a new playlist.

        Args:
            name: Playlist name
            description: Playlist description
            public: Whether playlist is public

        Returns:
            Created playlist object
        """
        user = self.get_current_user()
        return self._handle_rate_limit(
            self.client.user_playlist_create,
            user=user["id"],
            name=name,
            public=public,
            description=description,
        )

    def add_tracks_to_playlist(
        self,
        playlist_id: str,
        track_uris: List[str],
    ) -> None:
        """
        Add tracks to a playlist (handles batching for >100 tracks).

        Args:
            playlist_id: Playlist ID
            track_uris: List of Spotify track URIs
        """
        # Spotify allows max 100 tracks per request
        batch_size = 100
        total = len(track_uris)

        for i in range(0, total, batch_size):
            batch = track_uris[i : i + batch_size]
            self._handle_rate_limit(
                self.client.playlist_add_items,
                playlist_id=playlist_id,
                items=batch,
            )
            print(f"Added {min(i + batch_size, total)}/{total} tracks...", file=sys.stderr)
            time.sleep(0.2)

    def get_playlist_tracks(self, playlist_id: str) -> List[Dict[str, Any]]:
        """Get all tracks in a playlist."""
        tracks = []
        offset = 0

        while True:
            result = self._handle_rate_limit(
                self.client.playlist_tracks,
                playlist_id=playlist_id,
                offset=offset,
                limit=100,
            )

            items = result["items"]
            if not items:
                break

            tracks.extend(items)
            offset += len(items)

            if offset >= result["total"]:
                break

            time.sleep(0.1)

        return tracks


# Singleton instance
spotify_client = SpotifyClient()
