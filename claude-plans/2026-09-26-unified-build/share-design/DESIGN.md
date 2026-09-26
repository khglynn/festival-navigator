# Sharing our picks — the design round (2026-09-26, afternoon)

Kevin, via the coordinator: "Those en dashes in your export are wild I think we can type
simpler. What's the share idea and is it different than a normal share link? … Designs on
that would be nice since I also asked about quicker ways to grab the share link. And yeah
sharing with shelf open should share shelf open." Nothing here is built to ship; the draft
runs on `live/plan-share` so the frames are the real app.

Review page (the frames, the five calls, answers saved on the page):
https://claude.ai/artifact/D2fJQFmUfhgQ9bq9bqdmsh (login kevin.hq@tecovas.com).
Source: `review.html` beside this. Frames: `node frames.mjs` (the rig in `rig.mjs`: the
production app over the real Portola file, the made-up nine from round two, every write
refused, nothing off the machine), `python3 sheet.py` for contact sheets, `node texts.mjs`
for the three text formats. PNGs land in `shots/` (git-ignored).

## The answer to "is it different from a normal share link?"

Both. The plan's Share sends the day written out for the group chat and, under it, the
crew link with `&plan=open`, so tapping it opens the app on Our picks the way `&view=list`
opens a List.

## The calls, with my pick

1. **What the Share sends** — the text and the link (pick); the text only; the link only.
   The link is the crew link, so anyone in that chat can pick with the crew, as with any
   invite today (the Invite sheet already sends `inviteText` + the link the same way).
2. **A friend opening it** — lands on Our picks open. A member sees it on arrival; a
   newcomer gets the welcome card first and the plan opens when the card goes (pick). The
   flag is read once at boot, never written to the crew doc or the address bar (the v93
   history lesson), and rides only the plan's own Share.
3. **The text's format** — A, one line a stop (pick): the header
   `Portola, Sat Sep 26: our picks`, then `5:40pm Tove Lo (Pier Stage), 6 picked`, the
   or-line indented under it without the word `picked`. Once the day is under way what is
   over drops off and `now till 10:15pm` leads. B (slashes, 780 characters) is hard to
   scan; C (now and next) tells only two stops. Plain punctuation: commas, parentheses, a
   tilde for a guessed time. No names of people, only artists, places, times and counts.
4. **Where the Share sits** — `Share our picks` at the plan's foot (pick): the same on
   phone and laptop, in thumb reach, and the laptop head is itself a button. With no share
   sheet it reads `Copy our picks` and copies the text with the link as its last line.
5. **A quicker crew link** — A, a `Share the crew link` row in the Show menu above
   Settings (pick): two taps from anywhere, straight to the share sheet (Copy + "Copied ✓"
   where there is none), carrying the current rooms and Board/List. B, a people-menu row,
   repeats + Invite someone one row below it. C, a mark in the day rail, is one tap but only
   fits a laptop: on the phone it pushed THU off the dock (frame 3c-fest-name-390).

## Also seen

- The welcome card still says "This is the crew's plan for Portola." — flagged to the
  coordinator for its copy pass with the other "plan" words (welcome.js, join shelf).
- A guest (opened the link, not joined) gets the Share too; it hands on the link they
  opened.

## When Kevin answers

Build on `live/plan-share` (merge `live/plan` first): the text from `planText` in
`js/v3/plan-rows.js` with a golden test per clock state, the `&plan=open` read beside
`viewFromHash`, the Show menu row, browser tests with a stubbed `navigator.share` and the
Copy path; then the full gate, an independent review, and the SHA to the coordinator.
