# A slow-motion strip, stacked top to bottom, each frame captioned with its
# time in the animation (people-rig.mjs slowmo).
#   python3 people-strip.py out.png [--cols N] "0ms" a.png "13ms" b.png ...
import sys
from PIL import Image, ImageDraw, ImageFont
out, rest = sys.argv[1], sys.argv[2:]
cols = 1
if rest and rest[0] == '--cols':
    cols = int(rest[1]); rest = rest[2:]
pairs = list(zip(rest[0::2], rest[1::2]))
ims = [(c, Image.open(p).convert('RGB')) for c, p in pairs]
if cols > 1:
    fw = max(im.width for _, im in ims); fh = max(im.height for _, im in ims)
    capH, pad = 34, 10
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (fw + pad) + pad, rows * (fh + capH + pad) + pad), (20, 18, 28))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
    except Exception:
        font = ImageFont.load_default()
    for i, (cap, im) in enumerate(ims):
        x = pad + (i % cols) * (fw + pad); y = pad + (i // cols) * (fh + capH + pad)
        d.text((x, y + 4), cap, fill=(220, 214, 240), font=font)
        sheet.paste(im, (x, y + capH))
    sheet.save(out)
    sys.exit(0)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
except Exception:
    font = ImageFont.load_default()
capW, pad = 110, 6
W = max(im.width for _, im in ims) + capW
H = sum(im.height + pad for _, im in ims)
sheet = Image.new('RGB', (W, H), (20, 18, 28))
d = ImageDraw.Draw(sheet)
y = 0
for cap, im in ims:
    d.text((10, y + im.height // 2 - 10), cap, fill=(220, 214, 240), font=font)
    sheet.paste(im, (capW, y))
    y += im.height + pad
sheet.save(out)
