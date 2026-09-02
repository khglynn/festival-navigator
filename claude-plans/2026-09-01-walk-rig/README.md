# The detached walk rig (2026-09-01)

Real-input browser walks that survive a Claude profile switch. Kevin switches
accounts mid-flow at usage limits, and that kills teammates, workflows and the
Playwright MCP profile; a plain OS process does not care. These scripts drive
headless system Chrome through Playwright's input layer — real mouse,
keyboard and touch events, never `element.click()` — and bank a Markdown
report after every step.

- `walk-zoom.cjs` — the card zoom checklist (hover, click-pick, wheel-follow,
  the keyboard Tab route, Escape, the map door, the notes chip, a skim,
  console, a phone hold). Run it against a preview AND against production:
  a shared result is pre-existing, a difference is a regression.
- `walk-events.cjs` — the day-first events UI (tabs, THU/FRI/SAT/SUN
  content, the deck opening/closing, the Midway run's tilde times and two-line
  zoom with the poster door, the bucket chips across a reload, phone).

## Run

```
mkdir -p /tmp/walk-rig && cd /tmp/walk-rig && npm init -y >/dev/null && npm i playwright
cp <repo>/claude-plans/2026-09-01-walk-rig/*.cjs .
export TOKEN=<a throwaway or design crew token — never a real crew, never committed>
(nohup node walk-zoom.cjs pr14 "<vercel share URL or https://fest.kevinhg.com>" > pr14.log 2>&1 &)
```

The report lands beside the script as `report-<kind>-<label>.md`; `FINISHED` or
`FATAL` is the last line.

## What bit, so you don't re-learn it

- **macOS has no `setsid`.** `setsid nohup …` fails silently and the walk never
  starts. Orphan with a subshell instead: `(nohup node … > log 2>&1 &)`.
- **A fresh browser lands on the crew's JOIN screen** ("Tap your name, or add
  yourself"). The names are `button.fest-row` whose text runs the initial, the
  name and a hint together ("AAvathis link is yours"); tap the one that
  *includes* the name. On a touch context use `touchscreen.tap`, not
  `mouse.click`.
- **Protected previews need the Vercel share link opened FIRST** (it sets the
  auth cookie); mint it on the unique deployment URL, not the branch alias —
  a new push moves the alias and kills the link.
- **The 44px floor is a `::after` hit area under `(pointer: coarse)`.** Measuring
  a chip's box on a desktop context reports 26px and is not a finding;
  measure `elementFromPoint` above/below the chip in a touch context.
- **CDP `Input.dispatchTouchEvent` does not trigger the app's long-press** (on
  prod either). The phone hold still needs a real phone or a teammate walk.
- **Expectations that were wrong in the first draft:** after Tab, Tab from the
  notes chip, focus lands on the NEXT card, which grows — the zoom is not
  "closed", it moved; and a 120px wheel only scrolls as far as the page can.

## The lesson of 2026-09-01 evening

Every "walked clean" run before the fix in PR #14 hovered a card and clicked
its grown overlay. None clicked the RESTING card first. A real person does —
it is the most common way to pick — and it focuses the card, which is what
made every later overlay click close and re-grow the zoom (the crash
journal's "focus left the card", twice a second). Walk the sequences people
use, not the ones that are convenient to script; and when Kevin's error
messages rhyme, that rhyme is the bug's fingerprint — read the journal
before the code.
