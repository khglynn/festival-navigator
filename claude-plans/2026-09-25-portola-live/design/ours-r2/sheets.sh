#!/bin/sh
# Rebuilds the three contact sheets from the frames (run after node frames.mjs).
set -e
cd "$(dirname "$0")"
SP="${TMPDIR:-/tmp}/ours-r2-sheets"; mkdir -p "$SP"
python3 sheet.py frames/overview.png --scale 0.5 "R1 door: pinned people line" frames/R1-door.png "Shelf: planning (Sat 11 AM)" frames/R1-plan.png "Shelf: NOW (Sat 9:40 PM)" frames/R1-now.png "R2: the plan opens the day" frames/R2-open.png "R3: the peek, NEXT" frames/R3-next.png "R3: the peek, NOW" frames/R3-now.png
python3 sheet.py frames/docks.png --crop -120,120 --scale 0.75 "Today (v91) · 390" frames/D0-390.png "D1 · NOW in the day row · 390" frames/D1-390.png "D2 · NOW floats · 390" frames/D2-390.png "R3 · NOW in the peek · 390" frames/R3-now.png "Today (v91) · 320" frames/D0-320.png "D1 · 320" frames/D1-320.png "D2 · 320" frames/D2-320.png "R3 · 320" frames/R3-320.png
python3 sheet.py "$SP/a.png" --crop 0,200 --scale 0.75 "(a) today's row, plan chip first · 320 · crew of 6" frames/PR-a-320-6.png "(a) 320 · crew of 12" frames/PR-a-320-12.png "(a) 390 · crew of 6" frames/PR-a-390-6.png "(a) 390 · crew of 12" frames/PR-a-390-12.png
python3 sheet.py "$SP/b.png" --crop 0,110 --scale 0.75 "(b) pinned line · 320 · crew of 6" frames/PR-b-320-6.png "(b) 320 · crew of 12" frames/PR-b-320-12.png "(b) 390 · crew of 6" frames/PR-b-390-6.png "(b) 390 · crew of 12" frames/PR-b-390-12.png
python3 - "$SP" <<'PY'
import sys
from PIL import Image
sp = sys.argv[1]
a, b = Image.open(f'{sp}/a.png'), Image.open(f'{sp}/b.png')
s = Image.new('RGB', (a.width + b.width, max(a.height, b.height)), (20, 18, 28))
s.paste(a, (0, 0)); s.paste(b, (a.width, 0)); s.save('frames/R1-people-test.png'); print('frames/R1-people-test.png', s.size)
PY
# Round three.
python3 sheet.py frames/round3-phone.png --scale 0.5 "Peek · NEXT (Sat 11 AM)" frames/Q-peek-next-390.png "Peek · NOW (Sat 9:40 PM)" frames/Q-peek-now-390.png "Opened · planning" frames/Q-plan-390.png "Opened · NOW" frames/Q-plan-now-390.png "320 · peek" frames/Q-peek-320.png "320 · planning" frames/Q-plan-320.png "320 · NOW" frames/Q-plan-now-320.png
python3 sheet.py frames/round3-desktop.png --scale 0.3 "1440 · corner card (NEXT)" frames/DT-peek-1440.png "1280 · hover: the affordance" frames/DT-peek-hover-1280.png "1280 · the panel (NOW)" frames/DT-plan-1280.png "1440 · the panel (planning)" frames/DT-plan-1440.png
python3 sheet.py frames/round3-desktop-2.png --scale 0.3 "1280 · corner stack: welcome + plan" frames/DT-welcome-1280.png "1280 · join stays a centred dialog" frames/DT-join-1280.png "1280 · zoom, ghost − · note · +" frames/Z-1280.png "1280 · zoom, Folsom card" frames/Z2-1280.png
python3 sheet.py frames/round3-zoom.png --scale 0.5 "390 · both doors, 12 people" frames/Z-390.png "320 · both doors" frames/Z-320.png "390 · long name" frames/Z2-390.png "320 · long name, two lines" frames/Z2-320.png
