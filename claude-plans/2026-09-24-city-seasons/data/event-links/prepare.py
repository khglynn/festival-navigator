#!/usr/bin/env python3
"""Event-page and ticket links for every non-grid show in Portola and ACL.

Kevin, 2026-09-24: "when it's afters or shows like this I naturally want to
click through to the event page… we need to do this for portola and other
afters and folsom and multi-location events everywhere."

Reads (all beside this file):
  dtb-portolaweek.json   DoTheBay's Portola Week listing (dothebay.com/portolaweek.json)
  acl-do512.json         each ACL Late nights Do512 page's own .json (buy_url)
  portola-unmatched.json the 15 Portola rows DoTheBay does not list, researched by hand
Writes:
  links.json             [{fid, key: {name, day, night|date, venue}, page, tickets}]

`page` is the show's own page for people (details, lineup, works before
tickets exist). `tickets` is {url, at}: the buy link exactly as the listing
printed it (DoStuff's referral tag kept: Kevin, "we're basically paying
them") and the seller's name for the "Tix @ AXS" line, read from the real
destination inside any referral wrapper. Nothing is guessed: a show with no
page found gets no `page`; no buy link, no `tickets`.
"""
import json, re, sys, urllib.parse, unicodedata
from pathlib import Path

HERE = Path(__file__).parent
REPO = HERE.parents[3]

SELLERS = [
    (r'ticketmaster\.com|livenation\.com', 'Ticketmaster'), (r'axs\.com', 'AXS'),
    (r'etix\.com', 'Etix'), (r'eventim\.us', 'Eventim'), (r'seetickets\.us', 'See Tickets'),
    (r'eventbrite\.', 'Eventbrite'), (r'tixr\.com', 'Tixr'), (r'dice\.fm', 'DICE'),
    (r'ticketweb\.', 'TicketWeb'), (r'posh\.vip', 'Posh'), (r'prekindle\.com', 'Prekindle'),
    (r'ra\.co', 'RA'), (r'ticketsauce\.com', 'Ticketsauce'), (r'dnalounge\.com', 'DNA Lounge'), (r'universe\.com', 'Universe'),
]
# Pages people read: the listing sites, then the venues and fests we link to.
SITES = [
    (r'dothebay\.com', 'DoTheBay'), (r'do512\.com', 'Do512'), (r'tixr\.com', 'Tixr'), (r'axs\.com', 'AXS'),
    (r'dnalounge\.com', 'DNA Lounge'), (r'folsomstreet\.org', 'Folsom Street'),
    (r'portolamusicfestival\.com', 'Portola'), (r'aclfestival\.com', 'ACL Fest'),
    (r'antonesnightclub\.com', "Antone's"), (r'concourseproject\.com', 'Concourse Project'),
    (r'devilmaycareatx\.com', 'Devil May Care'), (r'realbad\.org', 'Real Bad'), (r'sf-eagle\.com', 'SF Eagle'), (r'eventbrite\.', 'Eventbrite'), (r'ticketmaster\.com', 'Ticketmaster'),
]


def page_of(url):
    url = https(url)
    if not url:
        return None
    host = urllib.parse.urlparse(url).netloc.lower()
    for pat, name in SITES:
        if re.search(pat, host):
            return {'url': url, 'at': name}
    raise SystemExit(f'no site name for {host} ({url}): add it to SITES')


def real_destination(url):
    """The ticketer a referral wrapper points at (Impact, Partnerize, pxf)."""
    q = urllib.parse.urlparse(url)
    params = urllib.parse.parse_qs(q.query)
    if 'u' in params:
        return params['u'][0]
    m = re.search(r'destination:(https?%3A[^/?#]+[^\s]*)', url)
    if m:
        return urllib.parse.unquote(m.group(1))
    return url


def seller_of(url):
    dest = real_destination(url)
    host = urllib.parse.urlparse(dest).netloc.lower()
    for pat, name in SELLERS:
        if re.search(pat, host):
            return name
    return None


def norm(x):
    x = unicodedata.normalize('NFKD', x or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', x).replace(' the ', ' ').strip()


def https(url):
    return url if isinstance(url, str) and url.startswith('https://') else (
        'https://' + url[len('http://'):] if isinstance(url, str) and url.startswith('http://') else None)


def tickets_of(url):
    url = https(url)
    if not url:
        return None
    at = seller_of(url)
    if not at:
        # Never drop a buy link quietly (the War on Drugs' universe.com link
        # was, until the review of #29): name the seller and re-run.
        print(f'no seller name for {real_destination(url)}: add it to SELLERS', file=sys.stderr)
        return None
    return {'url': url, 'at': at}


def key_of(a):
    k = {'name': a['name'], 'day': a['day'], 'venue': a.get('venue')}
    if a.get('night'):
        k['night'] = a['night']
    if a.get('date'):
        k['date'] = a['date']
    return k


out, report = [], []
grid_of = lambda f: set(f.get('days', {}).keys())


def on_grid(a, fest):
    # "Saturday & Sunday" is two grid days, not a section (Despacio's room at Pier 80).
    return all(part.strip() in grid_of(fest) for part in str(a.get('day', '')).split('&'))

# ---- Portola: DoTheBay's Portola Week listing, matched by night + venue ----------
portola = json.loads((REPO / 'data/festivals/portola-2026.json').read_text())
dtb = json.loads((HERE / 'dtb-portolaweek.json').read_text())
NIGHT_ISO = {'Thu': '2026-09-24', 'Fri': '2026-09-25', 'Sat': '2026-09-26', 'Sun': '2026-09-27'}
unmatched = {(r['name'], r['night'][:3]): r for r in json.loads((HERE / 'portola-unmatched.json').read_text())}
for a in portola['artists']:
    if on_grid(a, portola):
        continue
    iso = NIGHT_ISO.get(a.get('night') or '')
    v = norm(a.get('venue'))
    hits = [e for e in dtb if iso and e['date'] == iso and v and (norm(e['venue']) in v or v in norm(e['venue']))]
    if hits:
        e = hits[0]
        entry = {'fid': 'portola-2026', 'key': key_of(a), 'page': page_of(e['permalink'])}
        t = tickets_of(e.get('buy'))
        if t:
            entry['tickets'] = t
        out.append(entry)
        continue
    r = unmatched.get((a['name'], (a.get('night') or '')[:3]))
    if r and (r.get('eventPage') or r.get('tickets')):
        entry = {'fid': 'portola-2026', 'key': key_of(a)}
        if https(r.get('eventPage')):
            entry['page'] = page_of(r['eventPage'])
        t = tickets_of(r.get('tickets'))
        if t:
            entry['tickets'] = t
        out.append(entry)
    else:
        report.append(f"portola: no link for {a['name']} ({a.get('day')}, {a.get('night')}, {a.get('venue')})")

# ---- ACL: every Late nights entry already carries its page in `source` ------------
acl = json.loads((REPO / 'data/festivals/acl-2026.json').read_text())
do512 = json.loads((HERE / 'acl-do512.json').read_text())
for a in acl['artists']:
    if on_grid(a, acl):
        continue
    page = page_of(a.get('source'))
    if not page:
        report.append(f"acl: no source for {a['name']} {a.get('date')}")
        continue
    entry = {'fid': 'acl-2026', 'key': key_of(a), 'page': page}
    d = do512.get(a['source']) or do512.get(page['url']) or {}
    t = tickets_of(d.get('buy'))
    if t:
        entry['tickets'] = t
    out.append(entry)

(HERE / 'links.json').write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
by = {}
for e in out:
    by.setdefault(e['fid'], [0, 0, 0])
    by[e['fid']][0] += 1
    by[e['fid']][1] += 'page' in e
    by[e['fid']][2] += 'tickets' in e
for fid, (n, p, t) in by.items():
    print(f'{fid}: {n} entries, {p} with a page, {t} with tickets')
for line in report:
    print(line, file=sys.stderr)
