# Contact sheets: frames side by side at a reduced scale, each captioned.
#   python3 sheet.py out.png "Caption A" frames/a.png "Caption B" frames/b.png ...
#   --scale 0.5 (default)  --crop top,height (CSS px at 2x = pixels/2) for strips
import sys
from PIL import Image, ImageDraw, ImageFont
args = sys.argv[1:]
scale = 0.5
crop = None
if '--scale' in args:
    i = args.index('--scale'); scale = float(args[i + 1]); del args[i:i + 2]
if '--crop' in args:
    i = args.index('--crop'); crop = [int(x) for x in args[i + 1].split(',')]; del args[i:i + 2]
out, rest = args[0], args[1:]
pairs = list(zip(rest[0::2], rest[1::2]))
ims = []
for cap, path in pairs:
    im = Image.open(path).convert('RGB')
    if crop:
        top, h = crop
        if top < 0: top = im.height + top * 2
        else: top *= 2
        im = im.crop((0, top, im.width, min(im.height, top + h * 2)))
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    ims.append((cap, im))
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
except Exception:
    font = ImageFont.load_default()
pad, capH = 24, 40
vertical = crop is not None
if vertical:
    W = max(im.width for _, im in ims) + 2 * pad
    H = sum(im.height + capH + pad for _, im in ims) + pad
else:
    W = sum(im.width for _, im in ims) + pad * (len(ims) + 1)
    H = max(im.height for _, im in ims) + capH + 2 * pad
sheet = Image.new('RGB', (W, H), (20, 18, 28))
d = ImageDraw.Draw(sheet)
x, y = pad, pad
for cap, im in ims:
    d.text((x, y), cap, fill=(220, 214, 236), font=font)
    sheet.paste(im, (x, y + capH))
    if vertical: y += im.height + capH + pad
    else: x += im.width + pad
sheet.save(out)
print(out, sheet.size)
