# Comment-thread UI survey — notes desktop round
**2026-08-30.** Researching the fix for: reply always jumps to the root composer even when
you pressed Reply under a nested reply ("so strange"), the row has "too many options," and
the ask is "an elegant way to nest delete in the UI of edit and maybe to have replies not be
a button."

This app's shape: ONE level of nesting (root + replies, no reply-to-a-reply-to-a-reply), a
note is plain text on a colour wash keyed to the author (name above, no boxes/bubbles),
replies indented one gutter. Today: top row of text-button actions, own = Edit·Delete·Reply·Pin,
others' = Reply·Pin. Delete is a two-tap arm (Delete → "Sure?" for 3s).

---

## Per-product findings (with sources)

**GitHub PR review threads** — Delete/Edit live in the comment's top-right corner, one
click opens the option (not a permanent row). Feb 2026 update: you can now quote-reply to an
existing comment directly from a side panel, and resolved/unresolved filters were fixed so
state updates correctly. Resolve is its own explicit action ("Resolve conversation"),
separate from delete. Source: [Commenting on a pull request](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/commenting-on-a-pull-request) ·
[Access all PR comments without leaving Files changed — Feb 19 2026 changelog](https://github.blog/changelog/2026-02-19-access-all-pull-request-comments-without-leaving-the-new-files-changed-page/) ·
[Reviewing proposed changes](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request).
Important structural point (general PR-review knowledge, not from these pages): a Reply typed
under any comment in a review thread posts right there, under that comment — it does not
jump to a single distant composer. That's the direct fix for this app's bug.

**Linear** — hovering a comment reveals a "···" in the top-right; clicking it offers Edit
(comment becomes inline-editable, Save to commit) and, separately, Delete — both live behind
the SAME one disclosure control, not as two standing buttons. Reactions (emoji) are a
separate, lighter-weight affordance directly on the comment/thread. Source: [Comments and reactions – Linear Docs](https://linear.app/docs/comment-on-issues).

**Figma** — comments are literally pins on the canvas; opening a pin shows the thread with a
single Reply field at the bottom of that thread's modal (not a global composer). An overflow
menu (mark unread / copy link / delete thread) is separate from Reply. Nearby pins cluster
when zoomed out — a different problem (spatial density) than this app has, but the modal's
"one composer per open thread, not one composer for the whole file" is the transferable
piece. Source: [View and manage comments](https://help.figma.com/hc/en-us/articles/360041547593-View-and-manage-comments) ·
[Guide to comments in Figma](https://help.figma.com/hc/en-us/articles/360039825314-Guide-to-comments-in-Figma).

**Notion** — hover reveals a "···" top-right; Edit comment / Delete comment are two lines in
that one menu (same sibling-item pattern as Linear). A separate hover-revealed button in the
same corner adds an emoji reaction. Long threads collapse and expand on click rather than
always rendering full. Source: [Comments, mentions & reminders](https://www.notion.com/help/comments-mentions-and-reminders).

**Slack** — hover reveals a "···" that holds Edit message / Delete message / Pin to this
channel / reply-notification toggles, all as sibling menu items behind one disclosure.
Threads are structurally ONE level by protocol — there is no "reply to a reply," a reply
inside a thread is just another message in that same thread; Slack does nothing special to
mark which prior reply you were answering (people @mention manually if it matters). Source:
[Edit or delete messages](https://slack.com/help/articles/202395258-Edit-or-delete-messages) ·
[Use threads to organize discussions](https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions).

**Instagram** — this is the clean answer for "reply to a reply" in a one-level system.
Before its threaded-replies update, tapping Reply on any comment just prefixed `@name` into
one shared composer; the resulting comment posted flat, at one level, with the @mention as
the only signal of who you were answering. Source: [Instagram makes comments easy to
navigate with threaded replies — Digital Trends](https://www.digitaltrends.com/social-media/instagram-comments-threaded-replies/).
(Instagram itself has since added deeper nesting for its own reasons, but the flat +
@mention-prefix pattern is the one worth borrowing here, and it's exactly how YouTube still
behaves.)

**YouTube** — replying to a reply appends a new second-level comment with `@name`
auto-inserted, no third level. Separately, the creator can Heart (quick appreciation, no
text) or Pin (single comment promoted to the top) — both are creator-only, both live in the
comment's own action row/overflow, and Heart and Pin are treated as genuinely different
actions (append vs. spotlight), not one control. Source: [Post and interact with
comments](https://support.google.com/youtube/answer/6000964) · [How to Pin and Heart YouTube
Comments (2026)](https://www.commentshark.com/blog/how-to-pin-and-heart-youtube-comments).

**Reddit** — search didn't surface a current (2025–2026) redesign doc for the comment row
itself; what's confirmed is the standing pattern (collapse/expand a subtree, reply nests
under the exact comment you replied to, edit/delete sit behind a "···"/overflow). Treat this
entry as thin evidence — the general shape is well known but I could not date-stamp a source
for the current UI. Genuinely not this app's shape anyway (Reddit nests arbitrarily deep).

**Substack Notes** — Notes/Threads/Chat are three distinct surfaces; a Note's replies form a
single conversation people describe as staying "in your own thread" — not much documented
about the reply-composer mechanics specifically. Separately relevant: Jeff Kaufman's essay
argues FOR single-level nesting generally — each top-level comment is its own topic +
jumping-off point, multiple side conversations coexist without a deep tree, and this holds up
fine at normal (non-massive) discussion sizes, which is this app's exact scale (a festival
crew, not a public feed). Source: [What is the difference between Notes and Chat? –
Substack](https://support.substack.com/hc/en-us/articles/18791701372180-What-is-the-difference-between-Notes-and-Chat) ·
[Single-Level Nesting — Jeff Kaufman](https://jefftkaufman.substack.com/p/single-level-nesting).

**Bluesky** — no edit, ever (by design — matches this app's "notes are honest, timestamped"
instinct more than it might first seem, though this app does want edit). Its interesting
contribution is on delete/moderation: "hide reply" is separate from delete and is
thread-owner-scoped, not author-scoped — a different axis (who can act on a note) than this
survey needs, but worth knowing it exists as a pattern if crew-moderation ever comes up.
Source: [New Anti-Toxicity Features on Bluesky — Aug 28 2024](https://bsky.social/about/blog/08-28-2024-anti-toxicity-features).

**Threads (Meta)** — "Hide reply" lives behind a "···" next to the reply; edit exists but
only within 5 minutes of posting. Nothing here suggests a materially different affordance
placement than Slack/Notion/Linear's overflow-menu norm. Source: [To remove a reply, select
the three dots next to it, then "Hide for everyone" — Threads](https://www.threads.com/@threads/post/DVZVwXWEpID/).

**iMessage / Apple Notes** — the most relevant NATIVE pattern for a phone-first app with zero
resting chrome. Tapbacks: double-tap or touch-and-hold a bubble to get a floating reaction
picker — nothing is visible on the bubble at rest. iOS 17+ swipe-to-reply: swipe right on a
specific bubble to target a reply at it (visually highlights that bubble + opens a compose
field), an alternative to the older long-press-then-tap-Reply flow. Apple Notes
collaboration: swipe right on the note (or swipe up on an Activity card) to see change
history; @mention a collaborator by typing `@name` inline. None of these ever show a button
at rest — every action is gesture-first. Source: [React with Tapbacks in Messages –
Apple](https://support.apple.com/guide/iphone/react-with-tapbacks-iph018d3c336/ios) ·
[How to Quickly Reply to Messages on iPhone —
MacRumors](https://www.macrumors.com/how-to/swipe-to-reply-messages-iphone/) · [Share notes
and collaborate on iPhone – Apple](https://support.apple.com/guide/iphone/iphe4d04f674/ios).

**Are.na** — deliberately has no comment/like/reply affordances at all on its core object
(the "connection" IS the interaction — adding a block to your own channel is the entire
social action). Blocks do have a lightweight comment thread, but the philosophy — minimal
chrome, avoid interaction affordances that don't need to exist — is the most relevant
takeaway for a no-boxes app: the fewer standing controls, the more "elegant" it reads. Source:
[Connections – Are.na Help](https://help.are.na/docs/getting-started/connections).

**Basecamp (Campfire)** — this is the closest existing product match to "nest delete in the
UI of edit." Clicking "···" next to your own message reveals a pencil icon; tapping it turns
the message into an editable line; Delete is reachable from that SAME "···" (not from inside
the edit field itself, so it's sibling-not-nested like Linear/Notion, but it's one disclosure
for both). Admins can delete others' messages but cannot edit them — edit stays author-only,
delete can be broader. Source: [NEW: Repeating To-dos, Don't Forget, Editing Campfire/Pings,
and more — 37signals](https://updates.37signals.com/post/new-recurring).

**Discourse** — a pencil icon appears on your own post (or one you can edit) for inline
editing; other actions (quote, link, more) sit behind a "···"-style expand. Selecting text
pops a contextual "Quote" button right where you selected it — i.e., some actions are
triggered by selecting content itself, not by hunting for a button, which is one more data
point for "the content can be the trigger." Source: [Why would a post (reply) not have a
pencil icon appear? – Discourse Meta](https://meta.discourse.org/t/why-would-a-post-reply-not-have-a-pencil-icon-appear/408658).

---

## Cross-cutting patterns

1. **Standing multi-button rows are rare and unloved.** Every desktop-grade product surveyed
   (GitHub, Linear, Figma, Notion, Slack) collapses reply/edit/delete/pin behind ONE
   hover-revealed disclosure ("···" or a corner icon), not a permanent row of separate text
   buttons. A row that changes width/shape between "your note" and "someone else's note" —
   which is exactly what this app does today — is the one thing none of them do; they keep
   the trigger's shape constant and vary only the menu's CONTENTS.
2. **Reply-to-a-reply in a one-level system = append + @mention, not a UI feature.**
   Instagram (pre-nesting) and YouTube both solve "who are you answering" with a plain
   `@name` text prefix on a comment that still lands flat, one level down from root. No
   surveyed product invents a visual sub-indent for this — the words carry the context, not
   the layout. This is a direct, low-effort model for the fix.
2b. **Reply composer opens where you tapped, never at a fixed distant location.** GitHub PR
   threads and Figma's per-thread modal both put the reply field immediately under the
   comment you engaged, scoped to that thread. Slack is different only because its whole
   thread already lives in a separate pane — the field is at the bottom of THAT thread, not
   of some other, unrelated place. None of them do what this app does (always snapping to one
   composer at the sheet's bottom regardless of where you pressed Reply) — that's the literal
   bug, not a stylistic choice anyone's copying.
3. **Delete confirmation is "open a menu, then confirm" — never a label-swap on a standing
   button.** GitHub/Slack/Notion/Linear/Discourse/Basecamp all require a deliberate menu-open
   before Delete is even visible, then a system/native confirm. This app's own two-tap arm
   ("Delete" → "Sure?" for 3s) is already a *good*, tested pattern (nobody hunted for
   evidence it's wrong) — the fix isn't to change the confirm, it's to change WHERE the first
   tap lives.
4. **"Edit owns delete" has real precedent, at two different depths:**
   - *Sibling-in-one-menu* (Linear, Notion, Basecamp): Edit and Delete are two lines in the
     same "···" — one disclosure, still two separate items.
   - *Delete-only-reachable-from-inside-edit* (no surveyed product does this exactly, but
     Basecamp's flow is one step away from it, and it's the more literal reading of "nest
     delete IN the UI of edit"): entering edit mode is the only way to see Delete at all — it
     appears as a small control alongside Save/Cancel, not as a menu item you could also
     reach without editing first.
5. **Pin is always overflow, never a standing button, and always sparse.** YouTube (creator
   heart/pin), Slack (pin-to-channel) — both live inside the "···", used occasionally, never
   presented as an always-visible top-row action competing for space with Reply/Edit/Delete.
6. **Touch/mouse parity is usually "same menu, different trigger," not two different
   designs.** Hover reveals the "···" on desktop; on touch, the same glyph is either
   always-faintly-visible (Notion/Slack mobile) or reached by a tap/long-press — but the
   MENU that opens is identical either way. The two systems that diverge on purpose
   (iMessage's swipe vs. long-press, at least two real gestures on the same surface) do so
   because messaging apps assume high familiarity with iOS gesture vocabulary; a general web
   app usually can't assume that and sticks to one shared trigger.
7. **What reads as "elegant" in minimal/typographic products (Are.na, Basecamp, iMessage) is
   literally nothing visible at rest.** The chrome exists only in response to a deliberate
   press/hover, and even then it's rendered as more of the SAME material (text, no boxes) —
   never a bordered dropdown. Are.na goes furthest: it questions whether some interactions
   (likes) need to exist as UI at all.

## What doesn't fit this app

- Reddit/GitHub/Discourse-depth nesting — wrong shape entirely, this app is deliberately one
  level.
- Bluesky's no-edit-ever and Threads' 5-minute edit window — this app's notes are a shared
  planning surface, not a public feed; unlimited edit (with the existing two-tap delete) is
  the right call already and nothing here argues against it.
- Boxed dropdown menus (GitHub/Slack/Notion's literal menu chrome, which is a bordered
  floating panel) — conflicts with "no boxes, no bubbles"; whatever disclosure this app uses
  has to be rendered as more type on the same colour wash, not a panel.

---

## Three directions

### Direction A — Press reveals plain-text cues; delete lives only inside Edit
**Resting note:** nothing but name + text, on every note, own or others' — identical to a
note nobody can act on. This is the one direction where the row genuinely disappears.

**Reply:** press-and-hold (mobile) or hover (desktop) on ANY note fades in one line of plain
words directly under the text — for someone else's note: `Reply · Pin`; for your own:
`Edit · Reply · Pin`. Tapping/clicking "Reply" opens the composer INLINE, directly beneath
the note you pressed (root or reply) — never the sheet's bottom. Replying to a reply
pre-fills `@Name ` in that inline composer (the Instagram/YouTube solve); the new note still
posts as a normal second-level entry appended at the end of the thread, since the app is
genuinely one level — the `@Name` is what carries "who I'm answering," not indentation.

**Edit + delete:** tapping "Edit" turns the note's own text into an editable field in place.
The cue line below it changes to `Save · Cancel · Delete` — Delete is now visible ONLY
because you are editing; there is no other path to it. This is the literal reading of "nest
delete in the UI of edit." Delete here keeps the existing two-tap arm (Delete → "Sure?" for
3s) rather than inventing a new confirm pattern.

**Pin:** rides along on the same press-reveal as Reply, for everyone, own notes included.

**Touch/mouse parity:** one interaction to build — press-and-hold and hover both reveal the
identical plain-text line and open the identical inline composer/edit field; only the trigger
gesture differs per input type.

**Risk:** on your OWN note, "press" now has to disclose a small menu (`Edit · Reply · Pin`)
rather than directly doing one thing, because your own note needs both Edit and Reply
available — so it's not literally "the note IS the reply button" for own notes, only for
others' (where press could arguably jump straight to Reply with no intermediate line at all).
Worth deciding explicitly which of those two you want; this doc assumes the safer,
consistent one (always show the cue line, never skip straight into an action) so the gesture
means the same thing everywhere. Also: long-press can fight the browser's native
text-selection/copy gesture on mobile, and hover-based reveals do nothing for
keyboard/switch-control users — a visible-on-focus fallback is required for accessibility,
not optional.

### Direction B — One overflow dot per note, reply composer inline under the thread
**Resting note:** name + text, plus one small persistent `···` (plain characters, not an
icon) sitting at the note's trailing edge, muted-tint, visible at rest on every note.

**Reply:** tapping `···` opens a tiny stacked-text menu (no border/box — a soft
colour-matched wash a shade darker than the note, floating just below it) listing
`Reply` (+ `Pin`, + `Edit` / `Delete` if it's your own). Choosing Reply opens an inline
composer directly under the specific note you opened the menu from. Reply-to-a-reply behaves
the same as Direction A: `@Name` prefix, flat append.

**Edit + delete:** both are two lines in the SAME `···` menu — siblings, the Linear/Notion/
Basecamp pattern. This is a lighter, more conventional solve than "nested inside edit," and
doesn't literally satisfy "nest delete in the UI of edit" — delete is one tap away in the
same disclosure as edit, not reachable only from inside it.

**Pin:** also a line in the `···` menu, for anyone.

**Touch/mouse parity:** the strongest of the three — `···` is always visible and always
tappable, so touch and mouse are IDENTICAL, no hover state needed anywhere.

**Risk:** the `···` is a small piece of permanent chrome sitting on every note forever — far
lighter than today's full button row, but it's still one more thing occupying the colour
wash at rest, and it doesn't literally satisfy either half of the owner's ask ("replies not a
button" — Reply still lives behind a shared control; "nest delete in edit" — delete is a
sibling, not nested).

### Direction C — Swipe/long-press on phone, hover on desktop; edit is a mode that owns delete
**Resting note:** clean, no chrome, on both platforms — identical to A at rest.

**Reply:** mobile — swipe the note left slightly to reveal the single word "Reply" in the
space behind it (iOS Mail's swipe pattern), release to open the inline composer under that
note; long-press is the fallback, opening a small floating list (`Reply` / `Pin` /
`Edit`-if-own) for anyone who doesn't discover swipe. Desktop — hover fades in the same
"Reply" cue beneath the note; click opens the same inline composer. Reply-to-a-reply: same
`@Name`-prefix, flat-append behavior as A and B.

**Edit + delete:** long-press (mobile) or hover+click (desktop) on your OWN note enters an
actual editing state — the note's wash intensifies slightly as a mode signal, text becomes
editable, and the ONLY controls that appear are `Save`, `Cancel`, and a small trash mark.
Delete is reachable exclusively through this mode — the same literal "nested in edit" solve
as Direction A, arrived at via a different gesture.

**Pin:** rides the same long-press/hover reveal as Reply (both are "for anyone" actions,
distinct from the "for owner" Edit-mode).

**Touch/mouse parity:** deliberately DIFFERENT primary gestures per platform (swipe on phone,
hover on desktop), with long-press/click as the shared fallback on both — two things to
design, build, and test instead of one, in exchange for each feeling native to that
platform's habits.

**Risk:** a horizontal swipe on a note is easy to trigger by accident during ordinary
scrolling on a touch list (a slightly diagonal scroll can register as a swipe) — needs a real
distance/velocity threshold and a cancel-on-release-outside. The platform split is also
structurally two code paths that can drift apart over time (this repo's own history — the
44px-floor bug, the WebIDL/storage-getter browser gaps — is a record of exactly this kind of
divergence going unnoticed by Node tests).

---

## Recommendation

**Direction A, with its own-note ambiguity resolved by always showing the cue line** (never
skipping straight to an action) — for the same reason the app already earned the "44px on
`button`, not a list" rule: a rule that always shows a small disclosure is legible and hard
to get wrong later, where "press does something different depending on whose note it is"
is the kind of implicit special-casing this repo's own CLAUDE.md has been burned by before.

Why A over B and C:

1. **It's the closest literal answer to what was asked.** "Nest delete in the UI of edit"
   only Direction A and C give you (delete reachable ONLY from inside editing, not a sibling
   menu item); "replies not be a button" is best honored by A/C's "nothing at rest, plain
   words on press" over B's permanent `···` glyph.
2. **It fits the no-boxes aesthetic furthest.** A's revealed cue line is literally more of
   the same typographic material the note is already made of (words on a wash) — no icon,
   no bordered menu, no persistent glyph competing with the colour wash the way B's `···`
   does forever, on every note, whether or not anyone ever taps it.
3. **It's one interaction to build, not two.** Against C: A uses the SAME trigger
   (press-and-hold / hover) and the SAME resulting UI on both platforms, where C
   deliberately forks into swipe-vs-hover with separate edge cases (swipe-vs-scroll
   collision on mobile) — for an app already thin on engineering hands, one well-tested path
   beats two.
4. **The reply-to-a-reply fix is free and shared across all three.** Whichever direction
   ships, adopt the Instagram/YouTube pattern: the composer opens wherever you pressed
   Reply (root or a specific reply), pre-fills `@Name` when replying to a reply, and the
   resulting note still posts flat at the thread's end — this alone fixes the "so strange"
   jump-to-root bug regardless of which chrome direction is chosen.

Before shipping, this needs the same real-device discipline the rest of the notes/desktop
round already leans on: a hover-vs-press reveal is invisible to keyboard/switch-control users
by default, so the cue line needs a focus-visible fallback, and — per this repo's own
standing note that Node tests are blind to real browser/touch behavior — it should get an
actual pointer-input walk (not `element.click()`) before promotion, the same way the
zoom/hop fixes earlier this round did.
