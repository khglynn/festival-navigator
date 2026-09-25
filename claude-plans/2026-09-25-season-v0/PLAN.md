# Austin season v0: the build Kevin can show off this week (2026-09-25)

**Kevin, 2026-09-25 ~1 PM PT:** "Let's do it now if it's safe - I'd love to
show it off this week." Background: `claude-plans/2026-09-24-city-seasons/`
on branch `seasons/kickoff` (STUDY.md, KEVIN-NOTES-ROUND1.md, BUILD-PLAN.md).

## What "v0" is

1. **A feed** (`scripts/season-feed.mjs`): reads Do512 (the 15 covered
   locations' JSON), JamBase (Austin, 15 mi radius) and Ticketmaster
   Discovery (Austin music, 15 mi), merges them into ONE festival-shaped
   file, `data/festivals/austin.json`. Run by hand for now; a schedule comes
   after Oct 11.
2. **The Austin view**: the app renders a `kind: "season"` fest as month tabs,
   each month the lineup view (one responsive set of cards, one per artist,
   sorted by date and time), the date on the card, the location and the
   links in the zoom. YOURS shows only for people with Spotify connected.
3. **The alert, once**: a digest to Slack `#dont-miss` of the season's shows
   by artists Kevin loves (his picks across every fest), to show the idea.

## Safe, specifically

- **Production is untouched** until Kevin promotes. The season lives on a
  branch; he shows it off from its preview link.
- **The preview shares the production database.** Picks made there land in
  the crew's real doc under the new key `festivals.austin` (additive; exactly
  what production will do later). No new tables in v0: the feed writes a file.
- **Sources are read politely** and inside free tiers (JamBase: at most 40
  calls a run, 1,000 a month).
- **Slack** only ever posts to Kevin's own `#dont-miss`, and only when he says.

## The data contract (`data/festivals/austin.json`)

A festival file with no grid (`days: {}`) and one extra field:

```json
{
  "id": "austin", "kind": "season", "name": "Austin", "year": "'26–27",
  "subtitle": "Winter + Spring", "location": "Austin, TX", "dates": "…",
  "status": "scheduled", "timezone": "America/Chicago", "accent": "…",
  "artists": [
    { "name": "Victoria Monét", "day": "December", "date": "2026-12-02",
      "venue": "ACL Live", "time": "8 PM", "doors": "7 PM",
      "with": ["…support acts…"],
      "page": { "url": "https://do512.com/…", "at": "Do512" },
      "tickets": { "url": "https://…", "at": "Ticketmaster" },
      "onSale": "2026-09-16T10:00:00-05:00",
      "sources": ["do512", "jambase", "ticketmaster"] }
  ],
  "dayMeta": { "December": { "date": "Dec 2026" } },
  "venues": { "ACL Live": "https://maps.google.com/?q=…" },
  "meta": { "feed": { "generatedAt": "…", "counts": { … } }, "sources": [ … ] }
}
```

- One entry per SHOW (artist + date + location). `name` is the headliner and
  the pick key, so an artist's two nights share one pick (Kevin's call).
- `day` is the month label. Months are sections with `date`, which the
  validator already understands; `kind: "season"` tells the wall to draw
  them as lineup grids instead of a room per date.
- **Names never disappear** (the pick-key freeze holds): a past show stays in
  the file (the view hides months that are over), and a new spelling of a
  known artist maps to the existing name (the feed keeps
  `data/seasons/austin-artists.json`, canonical name + every alias seen).

## Who builds what

- **The feed, the contract, the validator and freeze rules, the alert:** the
  city-seasons session, branch `seasons/austin-v0`.
- **The view:** a builder on its own branch from `seasons/austin-v0`, brief
  in `VIEW-BRIEF.md` beside this file. It merges back here.
- **Release:** a preview link for Kevin; production only on his word, and not
  during a festival weekend's code freeze unless he says so.
