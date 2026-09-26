# Contact sheets for d-full-width (2026-09-26): frames side by side, captioned,
# each at its own scale. python3 sheet.py out.png "Caption" frames/a.png@0.5 ...
# A path may carry a crop in CSS px: frames/a.png@1.0[top:height(:left:width)]  (negative top = from bottom)
import sys, re
from PIL import Image, ImageDraw, ImageFont
out, rest = sys.argv[1], sys.argv[2:]
ims = []
for cap, spec in zip(rest[0::2], rest[1::2]):
    m = re.match(r'(.+?)@([\d.]+)(?:\[(-?\d+):(\d+)(?::(\d+):(\d+))?\])?$', spec)
    path, scale = m.group(1), float(m.group(2))
    im = Image.open(path).convert('RGB')
    if m.group(3) is not None:
        top, h = int(m.group(3)) * 2, int(m.group(4)) * 2
        if top < 0: top = im.height + top
        left, w = (int(m.group(5)) * 2, int(m.group(6)) * 2) if m.group(5) else (0, im.width)
        im = im.crop((left, top, left + w, min(im.height, top + h)))
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    ims.append((cap, im))
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 24)
pad, capH = 28, 44
W = sum(im.width for _, im in ims) + pad * (len(ims) + 1)
H = max(im.height for _, im in ims) + capH + 2 * pad
sheet = Image.new('RGB', (W, H), (20, 18, 28))
d = ImageDraw.Draw(sheet)
x = pad
for cap, im in ims:
    d.text((x, pad), cap, fill=(220, 214, 236), font=font)
    sheet.paste(im, (x, pad + capH))
    x += im.width + pad
sheet.save(out)
print(out, sheet.size)
