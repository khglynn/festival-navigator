# Kevin's notes on the direction page, round 1 (2026-09-24, ~10:40 PM PT)

Ten comments left on https://claude.ai/artifact/HsB9FmNeWgAiKRXJkoLYbL,
pieced together from his screenshots (the session could not read the
comments itself: the profile's login had switched away from the page's
owner). Quoted as written; the anchor is where the comment sat on the page.
Truncated comments are marked […].

1. **Sources: Ticketmaster's free API / JamBase** — "cool yeah can you
   handle this with a browser teammate - I can log you in wheenever needed.
   this and jambase smart smart"
2. **Your call 4, emailing Do512** — "if they have referal codes i don't
   think we need to email them. other folks link to them all the time right
   and we're basically paying them. do they have docs saying […]"
3. **The MUNA timeline in the intro** — "what is this c row for? I don't get
   these. the rest makes sense"
4. **Sources / Your call 4** — "how much would these help? and do we know
   that jambase and ticketmaster are free or do they cost money? i'm open but
   i don't like the email ones unless we hav[e to …]"
5. **Your call 3, highlighted "one card per artist like the fest wall"** —
   "per artist. my biggest notes are two fold:
   1) I don't think splitting by name and location in the grid is necessary.
   if anything just do by weekend. but there's too many to list like this.
   we should just do like we do when we just know the lineup - a simple set
   of cards, sorted by date and time but just a responsive set of cards with
   details like location on hover.
   2) Let's link to the sources for the shows. when it's not a festival -
   when it's afters or shows like this I naturally want to click through to
   the event page. we have tix but do those always have deatails or are
   those links different? and what about before tix are availible. if I want
   more info where do I go? we need to do this for porotla and other afters
   and folsom and multi-location events everyhwere. would you wanna split
   that work with the porotola session or own it all or hand all of it off"
6. **Your call 2, alerts** — "slack yeah. use existing channel(S)"
7. **The zoom's ticket lines** — "For all of these lets do 'Tixs @
   [location]' - tigher and clearer"
8. **The zooms (shared grammar)** — "smart. nice. the copy on zoom is
   confusing"
9. **The rooms filter, "SHOW · 15 OF 21 ROOMS"** — "Let's call this
   location. 15 of 21 rooms. I think that makes. more sense in pretty much
   every context"
10. **A's Slack DM (MUNA)** — "add to cal option"

## What they decide

- **Cards:** one per artist, like the fest wall; picks stay keyed by artist
  name (the fest model), so an artist's two Austin nights share one pick.
  That reverses THINKING.md §2's show-id recommendation; Kevin saw the
  Bleachers edge case on the page and chose it.
- **Layout:** no night rooms, no venue stacks. Each month is the lineup
  view: one responsive set of cards sorted by date and time, place and the
  rest in the zoom. Weekend dividers at most.
- **Words:** "location", not "room" ("15 of 21 locations"). Ticket lines
  read "Tix @ Ticketmaster". The zoom's other lines need a plainer pass.
- **Alerts:** Slack, in his existing channel(s). Add-to-calendar on the
  alert.
- **Sources:** no emails (not Do512, not Bandsintown). Free keys for
  JamBase and Ticketmaster, signed up by a browser teammate with Kevin
  logging in.
- **Event links:** every non-festival show (afters, Folsom, Late nights,
  seasons) links to its event page, not only its tickets, including before
  tickets exist. He asked whether to split this with the Portola session,
  own it, or hand it off.
- **Still open:** which door (A, B, C). His notes read as A's months in the
  lineup layout with A's next-morning Slack alert; YOURS (B) was not
  mentioned. C's row in the timeline confused him.

## Kevin's go (2026-09-25, ~12:05 AM PT)

"great on the split. the other session is working on analtyics via posthog
right now this should slot in fine. great. yours tab is good but just plan
to not show if they don't have spotify. everything sounds great go."

- Event links: this session builds the data and the zoom line on main after
  v87 lands; the pre-Portola session (festival-navigator-d3) runs the
  release. Target: ride v88 (cut Fri Sep 25, 10 AM CT for this work), else
  v89 before Tue Sep 29.
- Season: A's month tabs in the lineup layout, A's next-morning Slack alert,
  and the YOURS tab kept but shown only to people who connected Spotify.
- Keys: the two developer accounts must be created by Kevin himself (an
  agent may not create accounts); a browser agent does the rest once he is
  logged in. Not needed for the event links.
