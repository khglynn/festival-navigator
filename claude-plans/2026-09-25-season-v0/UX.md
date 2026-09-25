# The Austin season: goals, UX and live-usage rules (2026-09-25)

Written after Kevin's mid-build note (~1:45 PM PT): "recenter and think
through the goals and ux of these new views … be thoughtful about the live
usage, the fact that folks are live using the app rn." It sits beside
`PLAN.md` (what v0 is) and `VIEW-BRIEF.md` (the builder's brief); where they
disagree, this file is newer.

## The goal, in order of what it has to do

1. **Catch.** An artist you love announces an Austin show, and you hear
   about it while tickets still exist, with the on-sale and presale times.
   That is the MUNA miss, and it is the alert's job (Slack, v0 once).
2. **Decide.** Browse what is coming, see what your crew picked, and tap
   through to tickets or the event page. That is the view's job.
3. **Coordinate.** Picks and notes shared with the crew, as at a festival.

## The data's shape (measured on the trial feed, 2026-09-25)

About 890 upcoming shows at 76 locations. By month: Sep (rest of) 100, Oct
396, Nov 234, Dec 94, then Jan 11, Feb 23, Mar 17, Apr 10, May 3. The median
night has 4 shows; the busiest has 29. 107 artists play two or more nights.

So the near months are dense, and the view's problem there is scanning. The
far months are thin because the tours have not been announced yet, which
the alert exists for. A thin March is the truth, not a bug.

## Decisions

1. **Opening lands on today.** The current month is the first tab, and
   nights that are over are gone from it. Months that are over are gone.
2. **A month is one lineup in date and time order, with week heads.** A
   thin head per week (`OCT 5 – 11`) gives a 396-show month its rhythm;
   each card carries its own day and date, and the time is secondary.
   Weekends are where people go out, so the head is where the eye lands.
3. **The dense months lean on the lenses the app already has**, each of
   which must work on a 396-card month: the search box (v88), the people
   filter (it dims everyone else's cards), and the Spotify pill. The one
   new lens worth building is the location filter from the direction page
   ("15 of 76 locations", Kevin's word), since people have home rooms; it
   comes after the lineup itself is right, in v0 only if it fits.
4. **The zoom answers "should I go, and how".** Date, time (doors), the
   location opening a map, who else is on the bill, `Tix @ X · Info @ Y`,
   the on-sale line while it is in the future (with presales), and the
   artist's other Austin nights when there are any, because the pick covers
   every night (Kevin's call: one pick per artist).
5. **YOURS** shows only for people who connected Spotify: season shows by
   artists in their library or picked in any past fest, soonest first,
   arriving the way NOW does.
6. **No NOW tab in a season (v0).** Shows carry no end times, and "what is
   on tonight" is the current month opening on today anyway.
7. **Words.** Location, never room. Copy that reads wrong for a city
   ("festival notes") uses the season's name instead ("Austin notes").
8. **One show lives in one place.** A show another festival file already
   carries (ACL Fest Nights, about 33 of them, Sep 29 – Oct 11) stays in
   that festival and is not doubled in Austin under a second pick key. The
   festival grounds (Zilker Park, Auditorium Shores) are left out for the
   same reason.
9. **Austin sits after the upcoming festivals in every list**, under its
   own small head, not in start-date order: a rolling season always starts
   "today", so date order would pin it above Portola during Portola.

## Seasons, not one long list (Kevin, 2026-09-25 evening)

"I want to do seasons … Austin, winter, 27, and Austin, spring, 27 … they
should just be different entries and then they get archived after they're
over, just like festivals." So a city is a run of entries, each a festival
file with a window: Austin Fall '26 (Sep–Nov), Austin Winter '27 (Dec 2026 –
Feb 2027, named for its January), Austin Spring '27 (Mar–May), Austin Summer
'27 (Jun–Aug). Ids `austin-<season>-<year>`; each file carries `startsOn`,
`endsOn` and `updated` (the day the feed last ran), and the validator keeps
every show inside its window. The feed writes one file per season with
shows, adds each to the index and the freeze, and marks a season archived
once its window is over. A season's month tabs are its three months. The
description line says when it was last updated, in place of the old
"Winter + Spring" subtitle. One artist registry serves the whole city, so a
name is spelled the same in every season; picks are per season, like a
festival's.

Kevin, same evening: "we can show in the app just the next two seasons -
we can have the others tucked away." The lists show the season in progress
plus the one after it (on Sep 25: Fall '26 and Winter '27; from Dec 1:
Winter and Spring). Later seasons sit behind one collapsed "Later seasons"
row; a season the crew already has always shows; archived seasons go with
the past festivals. The alert still reads every season, so a show announced
far ahead is still caught.

## Live usage: Portola is live now; ACL is Oct 2–4 and 9–11

1. **Production stays on v88 until Kevin says otherwise, and never changes
   during a festival weekend.** The window between the two is Mon Sep 28 to
   Thu Oct 1.
2. **Only a throwaway demo crew picks Austin on the preview.** The preview
   writes to the production database. A pick there under a real crew adds
   `festivals.austin` to that crew's document, and production v88, which
   has no Austin in its index, then shows every crewmate a stray row on the
   landing and in Settings that will not open (`landingPairs` in
   `js/v3/model.js`, rendered in `js/v3/app.js` and `js/v3/settings.js`;
   checked 2026-09-25). Real crews pick Austin once production has it.
   The review (2026-09-25 evening) found it is wider than picking: merely
   OPENING Austin in a real crew writes `festivals.austin`
   (`ensureFestivalState`), and opening the invite sheet there sets the
   crew's `meta.inviteFestId` to `austin`, which production v89 ignores, so
   new joiners land on the default festival instead of the crew's own. On
   production v89 the stray row opens Portola with a "not in the lineup any
   more" toast. Nothing is rejected or lost, but it confuses live users, so
   the rule stands: demo crew only until Austin is on production.
3. **Few preview pushes.** Each push builds a preview; batching them keeps
   the build queue clear for a Portola hotfix.
4. **Main's NOW.md belongs to the Portola session this weekend.** This
   work's state lives on `seasons/austin-v0` and in the city-seasons
   `PROGRESS.md`; NOW gets its line when the season merges.
5. **Festivals render exactly as they do now**, proven by the browser
   contract suite, because the season's layout switches on `kind` alone.
