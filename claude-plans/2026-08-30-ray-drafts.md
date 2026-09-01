# Drafts for Ray — email APPROVED v3 (2026-09-01); both go out after the promote

v1 (2026-08-30) was written before Kevin's direction; v2 carries it: say
what shipped, what folds in his work, that Kevin likes the Discover tab
(the suggestions feed) and will probably pull it in after ACL because
friends are on the app for that one. Facts checked 2026-09-01 against the
branch: `fn-canonical-host` meta in index.html (line 13) with js/spotify.js
deriving from it; docs/fork-setup.md credits raypp2; threads + the
reply-to-reply refusal in api/_lib/crew-shared.mjs; per-fest previews via
api/share.js. **Send both AFTER PR #13 promotes** so every link points at
main. Email: Kevin sends from hello@kevinhg.com in the "Forked
festival-navigator" thread (last message is Ray's Aug 6 checkpoint). Issue
comment: posts from Kevin's GitHub account (gh, sandbox off).

## 1 · Email reply (thread "Forked festival-navigator") — v3, Kevin's edits 2026-09-01

*(His calls: cut the Discover/player compliment opener, tighten the issue
bullet, add the venue-shape bullet aimed at his citywide/MMW case using his
own July words ("~200 events across a whole city"), close "Fun stuff! /
Kevin + Kevin's Claude" — he likes acknowledging when the words aren't all
his.)*

> Ray! Finally got a real sit-down with everything, the checkpoint, the issue, the fork.
>
> What shipped on my side this week, all on main now:
>
> - Your issue is closed the way you suggested: one fn-canonical-host meta tag in index.html, everything derives from it, and git pull upstream stays clean. docs/fork-setup.md owes a lot to yours.
> - Notes have threads: one reply row per thread, one level deep. The server now refuses a reply-to-a-reply outright, and that rule exists because your client is the second one writing notes, so it's worth a pull.
> - For your citywide/MMW case: fests can mix a stage grid with around-town events now (Portola Week runs both), and venues have location links. Next up, the layout picks itself: stage columns where venues repeat, a time-sorted list where they don't.
> - Crew links unfurl as per-festival poster cards (fest.kevinhg.com/f/<fest-id>#g=…).
> - Pulled your GEMINI_MODEL fix upstream, credited. The pinned model was already 404ing for new keys, so your catch keeps add-a-festival working for every fresh fork. If the rest of your add pipeline is still fighting you, send the error my way.
>
> Discover: I like it a lot and I'll probably pull it in after ACL. A bunch of my friends are on the app for that one and I'm not touching the floor under them until it's done (mid October). Keep the checkpoints coming.
>
> Fun stuff!
> Kevin + Kevin's Claude

## 2 · Issue #6 closer (GitHub comment)

> Shipped on main: the host lives in one `fn-canonical-host` meta tag in index.html, and js/spotify.js plus every on-screen string that names the host derive from it, so a fork sets its domain once and `git pull upstream` stays clean. Your `HOST_ALLOW` note became docs/fork-setup.md (which owes a lot to the one in your fork).
>
> Your framing of the security half, a fork left on the upstream value handing its users' fragment tokens to my domain, is what moved this from nicety to shipped. Clearest issue this repo has had. Thank you.

## Context for the wrap
- Issue: https://github.com/khglynn/festival-navigator/issues/6 (open since
  Jul 24; the fix is commit c17763e on notes-desktop-round).
- Kevin's read of "his page of suggestions/ideas (whatever he calls that
  tab)" = the fork's **Discover** tab (Wall · Discover · My Day). If he meant
  Ray's planned-features list from the Jul 24 email instead, swap the
  Discover paragraph for: "Your build list from July is still the one I'd
  point at, and I'll probably start pulling from it after ACL."
