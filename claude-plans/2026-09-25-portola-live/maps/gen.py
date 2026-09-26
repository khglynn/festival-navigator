#!/usr/bin/env python3
import json, csv, re, urllib.parse, os

# Reads the festival file from the repo and writes the CSVs next to itself.
# Run from anywhere: python3 claude-plans/2026-09-25-portola-live/maps/gen.py
MAPS_DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(MAPS_DIR, "..", "..", "..", "data", "festivals", "portola-2026.json")
OUT = MAPS_DIR

d = json.load(open(SRC))
artists = d["artists"]
venues_raw = d["venues"]

# ---- verified addresses. Each starts from the map link baked into this
# live JSON's venues{} (researched 2026-09-16, re-confirmed by the file's own
# meta note as parties were carded 2026-09-25). Re-checked independently
# against the venue/promoter's own site, Yelp, or Facebook via web search
# 2026-09-26; zips added where a source gave one. None = no address published
# anywhere (TBA-style room) -- excluded from the CSVs, listed separately. ----
ADDRESS = {
    "DNA Lounge": "375 11th St, San Francisco, CA 94103",
    "SVN West": "10 South Van Ness Ave, San Francisco, CA 94103",
    "The Midway": "900 Marin St, San Francisco, CA 94124",
    "Folsom St, 8th-13th": "Folsom St & 9th St, San Francisco, CA 94103",
    "1015 Folsom": "1015 Folsom St, San Francisco, CA 94103",
    "SF Eagle": "398 12th St, San Francisco, CA 94103",
    "City Nights SF": "715 Harrison St, San Francisco, CA 94103",
    "TBA (SF)": None,
    "888 Garage": "900 Marin St, San Francisco, CA 94124",
    "Audio": "316 11th St, San Francisco, CA 94103",
    "Club Six": "60 6th St, San Francisco, CA 94103",
    "Great American Music Hall": "859 O'Farrell St, San Francisco, CA 94109",
    "Monarch": "101 6th St, San Francisco, CA 94103",
    "Pier 80 (loyalty invite)": "401 Cesar Chavez St, San Francisco, CA 94124",
    "Public Works": "161 Erie St, San Francisco, CA 94103",
    "Regency Ballroom": "1300 Van Ness Ave, San Francisco, CA 94109",
    "Rickshaw Stop": "155 Fell St, San Francisco, CA 94102",
    "The Great Northern": "119 Utah St, San Francisco, CA 94103",
    # --- new in the live file (Folsom weekend expansion) ---
    "Mr. S Leather": "385 8th St, San Francisco, CA 94103",
    "Folsom Street Community Center": "1286 Folsom St, San Francisco, CA 94103",
    "Kink Store": "224 6th St, San Francisco, CA 94103",
    "Power Exchange": "220 Jones St, San Francisco, CA 94102",
    "Beaux": "2344 Market St, San Francisco, CA 94114",
    "Powerhouse": "1347 Folsom St, San Francisco, CA 94103",
    "QBar": "456 Castro St, San Francisco, CA 94114",
    "TBA (SoMa)": None,
    "SF Mint": "88 5th St, San Francisco, CA 94103",
    "Jolene's": "2700 16th St, San Francisco, CA 94103",
    "F8": "1192 Folsom St, San Francisco, CA 94103",
    "Mayes Oyster House": "1233 Polk St, San Francisco, CA 94109",
    "Leather District Monument": "82 Ringold St, San Francisco, CA 94103",
    "Stopgap": None,
    "The Blackdoor": "288 7th St, San Francisco, CA 94103",
    "SOMArts": "934 Brannan St, San Francisco, CA 94103",
    "Kink.com Penthouse": "1717 Mission St, San Francisco, CA 94103",
    "The Foundry": "1425 Folsom St, San Francisco, CA 94103",
    "Eagle Plaza": "398 12th St, San Francisco, CA 94103",
    "Oasis": "298 11th St, San Francisco, CA 94103",
    "Transform1060": "1060 Folsom St, San Francisco, CA 94103",
    "Lone Star Saloon": "1354 Harrison St, San Francisco, CA 94103",
    "Halcyon": "314 11th St, San Francisco, CA 94103",
    "The Stud": "1123 Folsom St, San Francisco, CA 94103",
}

NIGHT_DATE = {"Thu": "2026-09-24", "Fri": "2026-09-25", "Sat": "2026-09-26", "Sun": "2026-09-27"}
NIGHT_LABEL = {"Thu": "Thu Sep 24", "Fri": "Fri Sep 25", "Sat": "Sat Sep 26", "Sun": "Sun Sep 27"}

TIME_RE = re.compile(r"^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$")

def parse_clock(s):
    m = TIME_RE.match(s.strip())
    if not m:
        return None
    h = int(m.group(1))
    mins = int(m.group(2) or 0)
    period = m.group(3)
    return h, mins, period

def to_h24(h, period):
    h = h % 12
    if period == "PM":
        h += 12
    return h

def hour_bucket(h, mins, period):
    # Afters "Time band": literal hour, minutes dropped
    return f"{h} {period}"

def folsom_band(h, period):
    h24 = to_h24(h, period)
    if 11 <= h24 <= 17:
        return "Daytime"
    if 18 <= h24 <= 20:
        return "Evening"
    if h24 == 21:
        return "9 PM"
    if h24 == 22:
        return "10 PM"
    if h24 == 23 or h24 == 0:
        return "Late"
    if 1 <= h24 <= 5:
        return "After-hours"
    return "Daytime"  # 6-10 AM fallback (unused in this data)

def fmt_clock(h, mins, period):
    return f"{h}:{mins:02d} {period}" if mins else f"{h} {period}"

def get_start_end(a):
    """Returns (start_str, end_str, start_parsed, doubtful_note_or_None)."""
    doubt = None
    if "time" in a and " - " in a["time"]:
        raw_start, raw_end = [p.strip() for p in a["time"].split(" - ")]
        sp = parse_clock(raw_start)
        return raw_start, raw_end, sp, doubt

    if "time" in a:
        raw_start = a["time"]
        approx = a.get("approx")
    elif "doors" in a:
        raw_start = a["doors"]
        approx = True
        doubt = f"{a['name']} ({a.get('night')}, {a.get('venue')}): no published set time — Start shown is DOORS time, marked ~"
    else:
        raw_start = ""
        approx = False

    start_str = ("~" + raw_start) if (approx and raw_start) else raw_start

    raw_end = a.get("close", "")
    end_str = ("~" + raw_end) if (a.get("closeApprox") and raw_end) else raw_end

    sp = parse_clock(raw_start) if raw_start else None
    return start_str, end_str, sp, doubt

def address_for(venue):
    return ADDRESS.get(venue)

def link_for(a):
    p = a.get("page") or {}
    return p.get("url", "")

rows_by_file = {}   # filename -> list of row dicts
doubtful = []
tba_events = []
missing_time_events = []

def add_row(fname, a, band):
    start_str, end_str, sp, doubt = get_start_end(a)
    if doubt:
        doubtful.append(doubt)
        missing_time_events.append(a["name"])
    addr = address_for(a["venue"])
    if addr is None:
        # TBA venue: no address to geocode. Leave OUT of the importable CSV
        # (task instruction: "list it separately, never guess") and report it.
        tba_events.append(
            f"{a['name']} — {fname} — {a['venue']} — {start_str}"
            + (f" - {end_str}" if end_str else "")
            + f" — {link_for(a)}"
        )
        return
    rows_by_file.setdefault(fname, []).append({
        "Name": a["name"],
        "Venue": a["venue"],
        "Address": addr,
        "Start": start_str,
        "End": end_str,
        "Time band": band,
        "Link": link_for(a),
    })

for a in artists:
    day = a.get("day")
    if day not in ("Afters", "Folsom", "Afters & Folsom"):
        continue
    night = a.get("night")
    sp = None
    # figure the start-hour for banding (need raw start regardless of ~)
    if "time" in a and " - " in a["time"]:
        raw_start = a["time"].split(" - ")[0].strip()
    elif "time" in a:
        raw_start = a["time"]
    elif "doors" in a:
        raw_start = a["doors"]
    else:
        raw_start = None
    sp = parse_clock(raw_start) if raw_start else None

    if day in ("Afters", "Afters & Folsom"):
        band = hour_bucket(*sp) if sp else ""
        add_row(f"{night} Afters", a, band)
    if day in ("Folsom", "Afters & Folsom"):
        band = folsom_band(sp[0], sp[2]) if sp else ""
        add_row(f"{night} Folsom", a, band)

# ---- write CSVs, in a sensible night order ----
NIGHT_ORDER = ["Thu", "Fri", "Sat", "Sun"]
TYPE_ORDER = ["Afters", "Folsom"]
ordered_names = []
for n in NIGHT_ORDER:
    for t in TYPE_ORDER:
        fn = f"{n} {t}"
        if fn in rows_by_file:
            ordered_names.append(fn)

os.makedirs(OUT, exist_ok=True)
counts = {}
for fname in ordered_names:
    rows = rows_by_file[fname]
    # sort by start time for readability: night order already fixed by file
    path = os.path.join(OUT, fname + ".csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["Name", "Venue", "Address", "Start", "End", "Time band", "Link"])
        w.writeheader()
        for r in rows:
            w.writerow(r)
    counts[fname] = len(rows)

print("FILES:")
for fname in ordered_names:
    print(f"  {fname}.csv : {counts.get(fname, 0)} rows")
print()
print("TOTAL relevant artist entries (Afters/Folsom/combo):", len([a for a in artists if a.get('day') in ('Afters','Folsom','Afters & Folsom')]))
print("Combo entry (Afters & Folsom) appears in both files, so file-row-sum > entry count is expected by 1")
print()
print("TBA venue events:")
for t in tba_events:
    print(" -", t)
print()
print("Doubtful (doors-fallback) events:")
for x in doubtful:
    print(" -", x)
