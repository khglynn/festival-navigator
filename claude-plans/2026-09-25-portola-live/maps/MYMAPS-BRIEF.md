# Brief: build the Folsom + afters Google My Map (2026-09-26)

Kevin is at Portola in San Francisco tonight and asked for a map of the
Folsom-weekend parties and the afters, grouped by time of day. He is on his
phone. You will build a Google My Map in his Chrome (via the claude-in-chrome
tools) so he gets one link that opens in the Google Maps app.

## Inputs
Seven CSVs in this folder (absolute path
`/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/claude-plans/2026-09-25-portola-live/maps/`):
`Thu Afters.csv`, `Fri Afters.csv`, `Fri Folsom.csv`, `Sat Afters.csv`,
`Sat Folsom.csv`, `Sun Afters.csv`, `Sun Folsom.csv`. Columns: Name, Venue,
Address, Start, End, Time band, Link. 130 rows total.

## Steps
1. `tabs_context_mcp` with `createIfEmpty: true`, then open a NEW tab in that
   group. Do not touch any other tab.
2. Go to `https://www.google.com/maps/d/` (My Maps). Read which Google account
   is signed in (the account avatar's label). It must be Kevin's PERSONAL
   account (kevin@trimm.co or a gmail.com address). If it is a tecovas.com
   account, or you cannot tell, STOP and report — do not create anything.
3. Create a new map. Title: `Portola 2026 · Folsom + afters`. Description:
   `Thu Sep 24 to Sun Sep 27, 2026. One layer per night and type. Pins colored by time band.`
4. For each CSV, in this order: Sat Folsom, Sat Afters, Sun Folsom,
   Sun Afters, Fri Folsom, Fri Afters, Thu Afters (tonight first):
   a. Use the existing empty "Untitled layer" for the first file; "Add layer"
      for the rest.
   b. Click the layer's Import link, then use `file_upload` on the dialog's
      file input with that CSV's absolute path. Never click the file input
      itself (it opens a native picker you cannot see).
   c. Position column: **Address**. Title column: **Name**.
   d. Rename the layer to the file name without `.csv` if Google did not.
   e. Layer style: "Uniform style" → group places by **Time band**.
   f. Note how many places the layer shows and any "rows could not be
      shown on the map" warning — list those rows by name.
5. Leave sharing PRIVATE. Do not change sharing, do not invite anyone.
6. Copy the map's URL (the `mid=` edit URL; also the view URL if shown).

## Bank as you go
After each layer, append one line to `MYMAPS-PROGRESS.md` in this folder:
layer name, places shown, rows that failed to geocode. Write the map URL
there as soon as the map exists (step 3), not at the end.

## If something blocks you
- `file_upload` rejects the path: stop and report the exact error. Do not
  move files elsewhere or try another upload route.
- A consent, sign-in, or CAPTCHA screen: stop and report. Never type
  credentials.
- Do not delete any existing map, layer, or place other than one you made
  in this run and mis-imported (then re-import that layer once).
- Do not spawn other agents.

## Report back
Map URL, account it lives in, per-layer place counts vs CSV rows (expected
Sat Folsom 23, Sat Afters 15, Sun Folsom 21, Sun Afters 25, Fri Folsom 18,
Fri Afters 21, Thu Afters 7), any pins that failed to geocode or landed
outside San Francisco (spot-check 3 pins per layer by clicking them), and
one screenshot description of the finished map.
