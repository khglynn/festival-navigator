# Fests × Circles × You — the locked model + reshape scope

**Dated 2026-07-14. Status: direction locked with Kevin ("Great aligned!");
reshape NOT yet built.** Visual map (canonical explainer, shown to and
confirmed by Kevin): claude.ai artifact "Fests × Circles × You"
(claude.ai/code/artifact/7324eb7c-c3c6-4269-8ebe-e7acaf5119d6).

## Why this exists

The v32 "WHO'S THIS WITH?" create step shipped to staging and Kevin's live
test rejected the framing: it asks a people question and answers with
crew names that look like festivals; a crew named "Portola 26" holding
Seismic opened on Seismic with no visible fest switcher. His model —
festival-first, ego-centric circles (he cited Google+ Circles, correctly) —
is captured here so no future session rebuilds toward the dead framing.

## The model (three pieces)

- **Festival** — what you plan. The home page lists these. Tap fest, get fest.
- **Circle** — one cluster of people sharing one link (internally this IS a
  crew; the word "crew" stays backstage, barely surfaced). A circle only
  sees itself: it is the consent/privacy boundary. Visibility inside a
  circle is symmetric — join it and they all see you too.
- **You** — the person record (me link). Everyone is the center of their own
  map: my home shows MY fests; each fest shows the union of MY circles
  there. Nobody ever sees the whole graph.

Kevin's real year that shaped this: Lolla with family (1 circle, only
Rosten recurs) · ACL with 15 people he cares about split 8/2/5 into
clusters who don't know each other · Illfest circle of 4 (Drew + Pega
recur) · EF with a 20-person mega group (he knows ~6, the apex guy wants
all 20) plus Drew+Caitlin as their own circle. Recurring humans (Drew in
3+ circles) are ONE linked person appearing in several clusters.

## Locked decisions

1. **Home = festivals.** Rows are (crew × fest) pairs rendered fest-first:
   fest name headline, that fest's people cluster. Legacy multi-fest crews
   render as multiple fest rows sharing people — true for The Crew, and the
   accidental Portola+Seismic pair gets hand-split as cleanup.
2. **"WHO'S THIS WITH?" dies.** Add-a-festival = multi-pick from the bank →
   boards created (each its own single-fest crew, just you). People
   questions live in "+ Add" on a fest.
3. **Two links, two jobs** (Kevin confirmed this exact framing):
   - Circle link = the group-chat link. Opening it joins the cluster —
     see everyone, be seen by everyone. Opens on the fest it was shared
     from; membership is to the circle.
   - Name link (&me=) = for one person you added yourself. Opening it makes
     that device BE that name, picks already theirs. Placeholder until
     claimed; linked (pid) after.
4. **+ Add sheet** gains: one-tap picker of people from your other fests
   (derivable from cached docs + pid), placeholder-vs-linked states, and
   per-name claim links.
5. **Join-time picker + mute (Phase B, with the merged board).** Mute
   surfaces ONLY when you open someone else's link into a big circle:
   one-time "who goes on your wall?", pre-checked for people who share
   another circle with you, strangers unchecked. Your-eyes-only, stored on
   your side (never the shared doc), silently reversible.
6. **The hard privacy line:** suggestions may RANK people you can already
   legitimately see (members of circles you're in); they never reach into
   circles you're not in. No cross-circle membership leaks, ever.
7. **Merged fest board = the one new engine** (own arc, real design needed):
   2+ circles at one fest render as one wall; my picks write to every
   circle I'm in at that fest; muted people fully excluded from my view.
   Until it exists, two circles at one fest = two rows on home (honest,
   unfused).
8. **Spotify orbits already match the model** — per-crew Client ID = a
   person at the center of ≤5 allowlisted people; orbits overlap freely.
   Nothing to change.

## Ship state at time of writing

- Prod = v31 (merge-semantics fix). Staging = v32 (me link + the now-dead
  who's-with step). **v32 is HELD on staging by Kevin's call** — the
  reshape lands on top, then promote. The me-link plumbing (persons table,
  header-auth API, pid, restore) is model-agnostic and fully load-bearing
  for circles; nothing from v32 is wasted.
- Known v32 bug to fix in the reshape: "+ A NEW CREW" text is invisible —
  `color: var(--brand)` where --brand is an RGB triple; needs rgb().
- Deferred hardening (from the two Codex gate rounds, documented in code):
  cross-tab double-create can orphan one person row; server-side ownership
  conditions + idempotent person create.

## Reshape kickoff checklist (next session)

Plan mode · full hg-ground-it four-doc read (tonight's pass read only the
legibility guide — deliberate budget call, Kevin aware) · scope = decisions
1-4 + the rgb() bug + README/user-flows F1-F2 rewrite shipping WITH the
code · Phase B (5, 7) is its own later arc · Codex gate before staging ·
prod promote stays Kevin's call.
