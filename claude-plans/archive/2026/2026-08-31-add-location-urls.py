#!/usr/bin/env python3
"""One-off script: add top-level locationUrl to festival files (after 'location' key).
Never touches artists/day/stage/time/name/dates. Preserves each file's own
trailing-newline convention. Run from repo root."""
import json
import collections
import os

LOCATION_URLS = {
    "data/festivals/acl-2025.json": "https://maps.google.com/?q=Zilker+Park,+2100+Barton+Springs+Rd,+Austin",
    "data/festivals/acl-2026.json": "https://maps.google.com/?q=Zilker+Park,+2100+Barton+Springs+Rd,+Austin",
    "data/festivals/edc-orlando-2026.json": "https://maps.google.com/?q=Tinker+Field,+287+S+Tampa+Ave,+Orlando",
    "data/festivals/electric-forest-2026.json": "https://maps.google.com/?q=Double+JJ+Resort,+5900+S+Water+Rd,+Rothbury",
    "data/festivals/lollapalooza-2025.json": "https://maps.google.com/?q=Grant+Park,+337+E+Randolph+St,+Chicago",
    "data/festivals/lost-lands-2026.json": "https://maps.google.com/?q=Legend+Valley,+7585+Kindle+Rd,+Thornville",
    "data/festivals/portola-2026.json": "https://maps.google.com/?q=Pier+80,+401+Cesar+Chavez+St,+San+Francisco",
    "data/festivals/seismic-9.json": "https://maps.google.com/?q=The+Concourse+Project,+8509+Burleson+Rd,+Austin",
    "data/festivals/tomorrowland-winter-2027.json": "https://maps.google.com/?q=Alpe+d'Huez,+70+Avenue+de+Brandes,+France",
    "data/festivals/ubbi-dubbi-2026.json": "https://maps.google.com/?q=Panther+Island+Pavilion,+395+Purcey+St,+Fort+Worth",
    "data/festivals/wicked-oaks-2025.json": "https://maps.google.com/?q=Carson+Creek+Ranch,+701+Dalton+Ln,+Austin",
}

PORTOLA_NEW_VENUES = {
    "888 Garage": "https://maps.google.com/?q=888+Garage,+888+Marin+St,+San+Francisco",
    "Audio": "https://maps.google.com/?q=Audio,+316+11th+St,+San+Francisco",
    "Club Six": "https://maps.google.com/?q=Club+Six,+60+6th+St,+San+Francisco",
    "Great American Music Hall": "https://maps.google.com/?q=Great+American+Music+Hall,+859+O'Farrell+St,+San+Francisco",
    "Monarch": "https://maps.google.com/?q=Monarch,+101+6th+St,+San+Francisco",
    "Pier 80 (loyalty invite)": "https://maps.google.com/?q=Pier+80,+401+Cesar+Chavez+St,+San+Francisco",
    "Public Works": "https://maps.google.com/?q=Public+Works,+161+Erie+St,+San+Francisco",
    "Regency Ballroom": "https://maps.google.com/?q=Regency+Ballroom,+1300+Van+Ness+Ave,+San+Francisco",
    "Rickshaw Stop": "https://maps.google.com/?q=Rickshaw+Stop,+155+Fell+St,+San+Francisco",
    "The Great Northern": "https://maps.google.com/?q=The+Great+Northern,+119+Utah+St,+San+Francisco",
}


def load_ordered(path):
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    trailing_newline = raw.endswith("\n")
    data = json.loads(raw, object_pairs_hook=collections.OrderedDict)
    return data, trailing_newline


def dump(path, data, trailing_newline):
    s = json.dumps(data, indent=2, ensure_ascii=False)
    if trailing_newline:
        s += "\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(s)


def add_location_url(path, url):
    data, tn = load_ordered(path)
    if "locationUrl" in data:
        print(f"SKIP (already has locationUrl): {path}")
        return
    new = collections.OrderedDict()
    for k, v in data.items():
        new[k] = v
        if k == "location":
            new["locationUrl"] = url
    if "locationUrl" not in new:
        new["locationUrl"] = url  # fallback if no 'location' key
    dump(path, new, tn)
    print(f"OK: {path}")


def add_portola_venues():
    path = "data/festivals/portola-2026.json"
    data, tn = load_ordered(path)
    venues = data["venues"]
    added = []
    for k, v in PORTOLA_NEW_VENUES.items():
        if k not in venues:
            venues[k] = v
            added.append(k)
    dump(path, data, tn)
    print(f"Portola venues added: {added}")


if __name__ == "__main__":
    for path, url in LOCATION_URLS.items():
        add_location_url(path, url)
    add_portola_venues()
