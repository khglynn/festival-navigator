# Drafts for Ray — Kevin's yes required before either goes out (2026-08-30)

## 1 · Reply on issue #6 (posts from Kevin's GitHub account)

> Shipped — and you were right on every count. The host now lives in one
> `fn-canonical-host` meta tag in index.html; js/spotify.js and every
> on-screen string that names the host derive from it, so a fork sets its
> domain once and `git pull upstream` stays clean. Your `HOST_ALLOW` note
> landed as documentation: docs/fork-setup.md (which owes a lot to the one
> in your fork) points forks at `PUBLIC_BASE_URL`.
>
> Worth saying plainly: your framing of the security half — a fork left on
> the upstream value hands its users' fragment tokens to my domain — is
> what moved this from "nicety" to "shipped today." Thank you for the
> clearest issue this repo has had.

## 2 · Email reply to Ray (thread "Forked festival-navigator" — Kevin sends)

Subject: (reply in thread)

> Ray! Finally sat down with everything — the checkpoint demo, the issue,
> the fork. The probe-driven player work is wild (Spotify pretending it can
> carry, adjudicated by playhead shape — chef's kiss) and the discovery
> deck's core ideas are genuinely neat. I did hit scroll jank around the
> deck on my machine, and my instinct for the mainline stays what I said in
> July: keep the wall's tap-to-pick grammar sacred. If we ever do an artist
> page here, I'd want the pick easy to change ON the page without replacing
> the wall's grammar, and I'd fold your recommendation ideas into the
> Spotify likes-and-follows machinery we already run.
>
> Concrete stuff from this week you'll care about:
> - Issue #6 is closed properly — one meta tag, strings derive, and there's
>   a real docs/fork-setup.md now (it credits yours).
> - Crew links unfurl as per-festival cards now (fest.kevinhg.com/f/…), and
>   the notes got threads with a redesign I'm happy with.
> - The server now refuses a reply-to-a-reply outright — worth a pull into
>   your fork since your client is the second one writing notes.
>
> Your roadmap items 3–6 are parked on my board for a dedicated round —
> when I get there I'd love your eyes on it. Keep the checkpoints coming.
>
> — Kevin

## Context for the wrap
- Issue: https://github.com/khglynn/festival-navigator/issues/6 (open since
  Jul 24; the fix is commit c17763e on notes-desktop-round — post the reply
  AFTER PR #13 merges so the linked code is on main).
- The email thread's last message is Ray's Aug 6 checkpoint; ball has been
  in Kevin's court since.
