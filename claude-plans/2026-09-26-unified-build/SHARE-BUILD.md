# Sharing our picks — the build (2026-09-26, from 2:40 PM PT)

Branch `live/share`, cut from main at b1301a7 (v101, Our picks, live). The design
round and Kevin's answers are in `OUR-PLAN-BUILD.md` ("Kevin's Share answers"); the
frames are in `share-design/` on `live/plan-share`. The coordinator stamps, opens the
PR and merges; this branch is never stamped here.

## Scope (Kevin's answers, the coordinator's go at 2:40 PM)

1. **Share our picks** at the open plan's foot, phone and laptop. It hands the share
   sheet the day as text, in Kevin's shape:

       Our crew's main picks for Sat Portola, now till end of day

       Pier Stage for Dog Blood @ now till 10:15pm
       Ship Tent for … @ 10:30pm
       …up to five

       Full rundown: https://fest.kevinhg.com/f/portola-2026#g=…&f=portola-2026&plan=open

   The five are "our top picks overall across all locations based on applied filters":
   the day's stops and their or-lines still to come, the people highlight applied,
   hidden rooms already out (the plan's rule 8), ranked by how many of us, then listed
   in time order. No names of people. With no share sheet it reads **Copy our picks**
   and copies the same text.
2. **`&plan=open`** on that link: read once at boot, beside `&view=`, never written to
   the crew doc or the address bar. A member lands on Our picks open; a newcomer gets
   the welcome card first and the plan opens when the card goes. A day with no plan
   drops the flag.
3. **An ✕ on the welcome card**, upper right, like the other cards and sheets. It does
   what Look around does.
4. **Share the crew link**, a row in the Show menu above Settings: the share sheet with
   the invite text and the crew link (the rooms and Board/List being shown), or
   **Copy the crew link** and "Copied ✓" where there is none.
5. **The window's catches** (banked in v101): a touch during the peek's arrival, and a
   grab during a redraw's slide, catch the window where it is instead of snapping it to
   the peek or turning a slide into a slightly opened plan; a font that lands during
   the arrival retargets it instead of letting it land on old numbers and drop 23px.
   The mechanism: a pixel **lift** kept apart from the progress `p`. A catch during a
   settle takes progress (and the overshoot's remainder as lift); a catch during an
   arrival or a slide takes lift. The next settle takes the lift home.

## Steps (each a commit on live/share, pushed)

- [x] S1 the text: `planEntries` + `planText` in `js/v3/plan-rows.js`, goldens per clock
      state (morning, NOW, tomorrow, a highlight, nothing left)
- [x] S2 the link: `crewLink(…, { plan: true })` → `&plan=open` last; `planFromHash`
- [x] S3 the plan's foot: Share / Copy, the words on the button, laptop and phone
- [x] S4 `&plan=open` at boot, member and newcomer paths
- [x] S5 the welcome ✕
- [x] S6 the Show menu row
- [x] S7 the lift: arrival and slide catches, the font retarget
- [x] S8 browser tests for each; jsdom tests; docs (README/CLAUDE where they describe it)
- [ ] Gate: npm test, browser suite at 0 and 700 ms late, a Sonnet walker on the real
      app, Sol, CI both jobs; the SHA to the coordinator

## Log

1. **S1** (eedade2): `planPicks` + `planText` in plan-rows.js. A room listed
   twice in one night (a fork into it, then the route coming back) is one line
   at its first time: deduped by place, keeping the earliest start and the most
   of us. Goldens for 11 AM and 9:40 PM Saturday, a highlight, and not-today.
2. **S2** (36f128a): `crewLink(…, { plan: true })` puts `&plan=open` last, only
   with a festival; `planFromHash` reads it.
3. **S3**: the foot under the rows, fading with the head, inert in the peek, not
   a drag handle. The laptop pill needed a height of its own (36px; the 44px
   floor only reaches coarse pointers), and it follows the list rather than
   the panel's bottom, so it reads as the plan's last line. The share marks
   the page busy while the sheet is up (a new build waits). Walked in Chromium
   at 390 and 1280 with the made-up nine: the text matched the 9:40 golden.
4. **S4** (28fdd68): a member's `&plan=open` lands on the plan open (the peek's arrival,
   then `openPlan`, which the lift turns into one motion). A newcomer's waits while the
   welcome card is due and opens when it goes. The flag belongs to the crew it came with
   (`planOpenFor` holds that token), is dropped on a day with no plan, and never reaches
   the crew doc or the address bar.
5. **S5** (eb7e10f): the welcome card's ✕ is Look around by another name (`gotIt`).
6. **S6** (02d284c, 65fa0fc): "Share the crew link" in the Show menu above Settings: the
   share sheet with the invite text and the link to what is being shown, or Copy and
   "Copied ✓" with the menu left up. Both the row and the plan's foot say what their link
   opens on (the v92 rule: every place that hands out a link says so), and sharing stamps
   the invite's festival the way the Invite sheet does.
7. **S7** (393d025): the lift. A finger on the peek mid-arrival, or a grab mid-slide,
   keeps the window where it is; a font landing mid-arrival re-aims the arrival from where
   it stands (`reaim`), and a first observer answer with nothing changed is ignored. Each
   new test fails on the old shelf, except WebKit's font case, which the old shelf passed
   in its held form (noted in the test).
8. **S8** (fc86005): `tests/browser/plan-share.test.mjs`, ten cases in both engines, and
   the README's Our picks bullet.
9. **The gate so far** (3:40 PM PT). Local: the browser suite 361 of 363 at 0 and at 700 ms
   late, each run with one different timing failure in a file this branch does not touch
   (`fold-intent`, `tap-shelf-contract`) while other sessions loaded the machine; both
   files pass alone at 0 and 700. Node 1254 of 1257, the SW stamp the only red (the
   coordinator stamps). CI on fc86005: the browser job green on Linux, WebKit included;
   checks red only on the stamp. Sol and a Sonnet walker are running.
