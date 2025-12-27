#!/usr/bin/env python3
"""
Fetch album track details including preview URLs from Spotify.
Uses the auth token from the spotify-mcp server.
"""

import sys
import json
import time
from pathlib import Path

# Add the spotify-mcp src to path so we can reuse the auth
sys.path.insert(0, str(Path(__file__).parent.parent / "spotify-mcp"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / "spotify-mcp" / ".env")

from src.utils.auth import get_spotify_client

# Top 20 albums from the CSV (by saved songs count)
ALBUMS = [
    {"name": "Motown: The Complete No. 1's", "artist": "Various Artists", "url": "https://open.spotify.com/album/0iv3gV69jA1YY2H0UTy9yF", "saved": 55, "total": 202},
    {"name": "Next To Normal (Original Broadway Cast Recording)", "artist": "Tom Kitt & Brian Yorkey", "url": "https://open.spotify.com/album/0HLCM1PkLwDz5NLr5Kl4a4", "saved": 37, "total": 37},
    {"name": "The Platinum Collection", "artist": "Queen", "url": "https://open.spotify.com/album/52NFKuYav3gArQgbsxiHwS", "saved": 29, "total": 51},
    {"name": "Next To Normal", "artist": "Original Cast Recording", "url": "https://open.spotify.com/album/21OdgQdWFE4nczQRh4uasW", "saved": 26, "total": 37},
    {"name": "The Essential Billy Joel", "artist": "Billy Joel", "url": "https://open.spotify.com/album/7r36rel1M4gyBavfcJP6Yz", "saved": 24, "total": 36},
    {"name": "Across The Universe (Original Deluxe)", "artist": "Various Artists", "url": "https://open.spotify.com/album/2rHgctQLLQqcebs4jN82z1", "saved": 20, "total": 29},
    {"name": "Les Misérables - Original London Cast Recording", "artist": "Les Misérables-Original London Cast", "url": "https://open.spotify.com/album/6cc5EtgAkZ2Drf3dkie54R", "saved": 19, "total": 31},
    {"name": "Born This Way (Special Edition)", "artist": "Lady Gaga", "url": "https://open.spotify.com/album/5maeycU97NHBgwRr2h2A4O", "saved": 16, "total": 22},
    {"name": "Brat and it's the same but there's three more songs so it's not", "artist": "Charli xcx", "url": "https://open.spotify.com/album/316O0Xetgx2NJLRgJBw4uq", "saved": 15, "total": 18},
    {"name": "Dear Evan Hansen (Original Broadway Cast Recording)", "artist": "Various Artists", "url": "https://open.spotify.com/album/0LhDyJXelg31FKLW5GDcKi", "saved": 14, "total": 14},
    {"name": "The ArchAndroid", "artist": "Janelle Monáe", "url": "https://open.spotify.com/album/7MvSB0JTdtl1pSwZcgvYQX", "saved": 14, "total": 18},
    {"name": "The Essential The Chicks", "artist": "The Chicks", "url": "https://open.spotify.com/album/31St5diPbTZoCjOwWXSMWD", "saved": 13, "total": 30},
    {"name": "Cheers to the Fall", "artist": "Andra Day", "url": "https://open.spotify.com/album/6Blubl1glavmervPJa3QVs", "saved": 13, "total": 13},
    {"name": "Aida", "artist": "Various Artists", "url": "https://open.spotify.com/album/2v3UoAXux8q8caeYbGVPza", "saved": 12, "total": 22},
    {"name": "Til the Casket Drops", "artist": "ZZ Ward", "url": "https://open.spotify.com/album/57QGgDgbSf0Ij3QP41jF8D", "saved": 12, "total": 13},
    {"name": "Same Trailer Different Park", "artist": "Kacey Musgraves", "url": "https://open.spotify.com/album/6IGpQUt0KNi5rBUXZZOFI6", "saved": 12, "total": 12},
    {"name": "WHEN WE ALL FALL ASLEEP WHERE DO WE GO?", "artist": "Billie Eilish", "url": "https://open.spotify.com/album/0S0KGZnfBGSIssfF54WSJh", "saved": 12, "total": 14},
    {"name": "This Is Acting (Deluxe Version)", "artist": "Sia", "url": "https://open.spotify.com/album/2eV6DIPDnGl1idcjww6xyX", "saved": 12, "total": 19},
    {"name": "Into The Woods", "artist": "Stephen Sondheim & Musical Cast Recording", "url": "https://open.spotify.com/album/27nr57gugCPjxQIFFz2uK3", "saved": 12, "total": 19},
    {"name": "Rockferry (Deluxe Edition)", "artist": "Duffy", "url": "https://open.spotify.com/album/5Mxz1P0qfXLR6SgE6xbyBb", "saved": 12, "total": 17},
]


def extract_album_id(url: str) -> str:
    """Extract album ID from Spotify URL."""
    return url.split("/")[-1].split("?")[0]


def fetch_album_details(client, album_id: str) -> dict:
    """Fetch full album details including tracks."""
    album = client.album(album_id)

    # Get all tracks (handle pagination for large albums)
    tracks = []
    results = album["tracks"]
    tracks.extend(results["items"])

    while results["next"]:
        results = client.next(results)
        tracks.extend(results["items"])

    return {
        "id": album["id"],
        "name": album["name"],
        "artists": [a["name"] for a in album["artists"]],
        "release_date": album["release_date"],
        "total_tracks": album["total_tracks"],
        "images": album["images"],  # Different sizes available
        "external_url": album["external_urls"]["spotify"],
        "tracks": [
            {
                "id": t["id"],
                "name": t["name"],
                "track_number": t["track_number"],
                "duration_ms": t["duration_ms"],
                "preview_url": t.get("preview_url"),
                "artists": [a["name"] for a in t["artists"]],
            }
            for t in tracks
        ],
    }


def main():
    print("Connecting to Spotify...", file=sys.stderr)
    client = get_spotify_client()

    if client is None:
        print("Error: Not authenticated. Run spotify-mcp/setup_auth.py first.", file=sys.stderr)
        sys.exit(1)

    print(f"Fetching details for {len(ALBUMS)} albums...", file=sys.stderr)

    albums_data = []
    for i, album in enumerate(ALBUMS):
        album_id = extract_album_id(album["url"])
        print(f"  [{i+1}/{len(ALBUMS)}] {album['name'][:40]}...", file=sys.stderr)

        try:
            details = fetch_album_details(client, album_id)
            details["saved_songs"] = album["saved"]
            albums_data.append(details)
        except Exception as e:
            print(f"    Error: {e}", file=sys.stderr)

        time.sleep(0.2)  # Rate limiting

    # Output JSON
    print(json.dumps(albums_data, indent=2))
    print(f"\nFetched {len(albums_data)} albums successfully.", file=sys.stderr)


if __name__ == "__main__":
    main()
