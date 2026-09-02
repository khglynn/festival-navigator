# Portola Week 2026 — afters billing, read 2026-09-01 from DoTheBay's official Portola Week listing (Goldenvoice-fed)

Source index: https://dothebay.com/portolaweek (every show, doors, venue, event page). The portola-week
page on portolamusicfestival.com renders its list client-side (only an image in static HTML), so
DoTheBay's per-event pages are the citable source; AXS 1575408 stays the Midway's.
Rule applied: the name in the title is the headliner and CLOSES; "with A, B" is support in descending
prominence, so the LAST-named support opens. "+" between two names in a title = co-bill, first-named closes.

| night | venue | title billing (verbatim) | doors | close | opener → closer | notes |
|---|---|---|---|---|---|---|
| Fri | Regency Ballroom | Channel Tres, JYOTY, Gelli Haha | 8 PM | — | Gelli Haha → Jyoty → Channel Tres | https://dothebay.com/events/2026/9/25/channel-tres-jyoty-gelli-haha-tickets |
| Fri | Monarch | Sam Alfred (Skiis support per our file) | 10 PM | — | Skiis → Sam Alfred | https://dothebay.com/events/2026/9/25/sam-alfred-tickets |
| Fri | The Great Northern | Ranger Trucco (Loods support per our file) | 10 PM | 2 AM (printed) | Loods → Ranger Trucco | https://dothebay.com/events/2026/9/25/ranger-trucco-tickets |
| Sat | Audio | Max Styler with Airwolf Paradise | 10 PM (printed; our file had none) | — | Airwolf Paradise → Max Styler | https://dothebay.com/events/2026/9/26/max-styler-tickets |
| Sat | Monarch | jigitz with Clearcast | 10 PM | 3 AM (our file) | Clearcast → Jigitz | https://dothebay.com/events/2026/9/26/jigitz-tickets |
| Sat | Public Works | Fcukers (DJ Set) + Chloé Caillet | 10 PM (printed; our file had none) | — | Chloé Caillet → Fcukers | https://dothebay.com/events/2026/9/26/fcukers-dj-set-chloe-caillet-presented-by-goldenvoice-tickets |
| Sat | Regency Ballroom | Parcels with Velvet Trip | 10 PM | — | Velvet Trip → Parcels | https://dothebay.com/events/2026/9/26/parcels-tickets |
| Sun | Monarch | Silva Bumpa with Dean Turnley, Buck Wilson | 10 PM | 3 AM (our file) | **Buck Wilson** → Dean Turnley → Silva Bumpa | Buck Wilson is on the bill and MISSING from our file. https://dothebay.com/events/2026/9/27/silva-bumpa-tickets |
| Sun | Public Works | Overmono (DJ Set) + Ben UFO, with Kaytree, Erika b2b SFCowboy | 10 PM | 2 AM (our file) | erika b2b sfcowboy → **Kaytree** → Ben UFO → Overmono | Kaytree is on the bill and MISSING from our file; keep our spelling "erika b2b sfcowboy" (it is a pick key). https://dothebay.com/events/2026/9/27/overmono-dj-set-ben-ufo-tickets |
| Sun | Rickshaw Stop | JT (Naisha in the description) | 10 PM | — | Naisha → JT | https://dothebay.com/events/2026/9/27/jt-tickets |
| Sun | The Great Northern | SG Lewis (DJ Set) with Puffie | 10 PM | — | Puffie → SG Lewis | https://dothebay.com/events/2026/9/27/sg-lewis-dj-set-tickets |
| Sun | The Midway | horsegiirL with VTSS, MGNA Crrrta, Two Shell | 10 PM | ~2 AM (ours) | MGNA Crrrta → VTSS → Two Shell → horsegiirL (Kevin's read, unchanged) | https://www.axs.com/events/1575408/horsegiirl-tickets |

All 21+. No page prints set times or a curfew beyond what is noted. No room is a two-stage/loft bill.

```json
[
 {"night":"Fri","venue":"Regency Ballroom","source":"https://dothebay.com/events/2026/9/25/channel-tres-jyoty-gelli-haha-tickets","billing":"Channel Tres, JYOTY, Gelli Haha","doors":"8 PM","close":null,"order":["Gelli Haha","Jyoty","Channel Tres"],"missingFromFile":[],"confidence":"medium"},
 {"night":"Fri","venue":"Monarch","source":"https://dothebay.com/events/2026/9/25/sam-alfred-tickets","billing":"Sam Alfred","doors":"10 PM","close":null,"order":["Skiis","Sam Alfred"],"missingFromFile":[],"confidence":"medium"},
 {"night":"Fri","venue":"The Great Northern","source":"https://dothebay.com/events/2026/9/25/ranger-trucco-tickets","billing":"Ranger Trucco","doors":"10 PM","close":"2 AM","closeSource":true,"order":["Loods","Ranger Trucco"],"missingFromFile":[],"confidence":"medium"},
 {"night":"Sat","venue":"Audio","source":"https://dothebay.com/events/2026/9/26/max-styler-tickets","billing":"Max Styler with Airwolf Paradise","doors":"10 PM","close":null,"order":["Airwolf Paradise","Max Styler"],"missingFromFile":[],"confidence":"high"},
 {"night":"Sat","venue":"Monarch","source":"https://dothebay.com/events/2026/9/26/jigitz-tickets","billing":"jigitz with Clearcast","doors":"10 PM","close":"3 AM","closeSource":false,"order":["Clearcast","Jigitz"],"missingFromFile":[],"confidence":"high"},
 {"night":"Sat","venue":"Public Works","source":"https://dothebay.com/events/2026/9/26/fcukers-dj-set-chloe-caillet-presented-by-goldenvoice-tickets","billing":"Fcukers (DJ Set) + Chloé Caillet","doors":"10 PM","close":null,"order":["Chloé Caillet","Fcukers"],"missingFromFile":[],"confidence":"medium"},
 {"night":"Sat","venue":"Regency Ballroom","source":"https://dothebay.com/events/2026/9/26/parcels-tickets","billing":"Parcels with Velvet Trip","doors":"10 PM","close":null,"order":["Velvet Trip","Parcels"],"missingFromFile":[],"confidence":"high"},
 {"night":"Sun","venue":"Monarch","source":"https://dothebay.com/events/2026/9/27/silva-bumpa-tickets","billing":"Silva Bumpa with Dean Turnley, Buck Wilson","doors":"10 PM","close":"3 AM","closeSource":false,"order":["Buck Wilson","Dean Turnley","Silva Bumpa"],"missingFromFile":["Buck Wilson"],"confidence":"high"},
 {"night":"Sun","venue":"Public Works","source":"https://dothebay.com/events/2026/9/27/overmono-dj-set-ben-ufo-tickets","billing":"Overmono (DJ Set) + Ben UFO with Kaytree, Erika b2b SFCowboy","doors":"10 PM","close":"2 AM","closeSource":false,"order":["erika b2b sfcowboy","Kaytree","Ben UFO","Overmono"],"missingFromFile":["Kaytree"],"confidence":"medium"},
 {"night":"Sun","venue":"Rickshaw Stop","source":"https://dothebay.com/events/2026/9/27/jt-tickets","billing":"JT","doors":"10 PM","close":null,"order":["Naisha","JT"],"missingFromFile":[],"confidence":"medium"},
 {"night":"Sun","venue":"The Great Northern","source":"https://dothebay.com/events/2026/9/27/sg-lewis-dj-set-tickets","billing":"SG Lewis (DJ Set) with Puffie","doors":"10 PM","close":null,"order":["Puffie","SG Lewis"],"missingFromFile":[],"confidence":"high"}
]
```
