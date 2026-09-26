# Contact sheets for the Share design round: one image per part, frames side
# by side at a common height, each captioned with its id. Reads ./shots,
# writes ./shots/sheet-*.png. (PIL; images are git-ignored.)
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SHOTS = Path(__file__).parent / 'shots'
PARTS = {
    '1-plan-open-link': ['1a-sender-open-390', '1b-friend-welcome-390', '1c-friend-open-390'],
    '1-plan-open-link-1280': ['1d-sender-open-1280', '1e-friend-welcome-1280', '1f-friend-open-1280'],
    '2-text': ['2a-text-lines-390', '2b-text-slashes-390', '2c-text-nownext-390', '2d-text-lines-night-390'],
    '3-crew-link-390': ['3a-show-menu-390', '3b-people-menu-390', '3c-fest-name-390'],
    '3-crew-link-1280': ['3a-show-menu-1280', '3b-people-menu-1280', '3c-fest-name-1280'],
}
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 30)
except OSError:
    font = ImageFont.load_default()
for name, ids in PARTS.items():
    imgs = [Image.open(SHOTS / f'{i}.png').convert('RGB') for i in ids]
    h = 1200 if '1280' in name else 1400
    imgs = [im.resize((int(im.width * h / im.height), h)) for im in imgs]
    gap, cap = 24, 56
    W = sum(im.width for im in imgs) + gap * (len(imgs) + 1)
    sheet = Image.new('RGB', (W, h + cap + gap * 2), (18, 18, 24))
    d = ImageDraw.Draw(sheet)
    x = gap
    for i, im in zip(ids, imgs):
        d.text((x, gap), i, fill=(200, 200, 210), font=font)
        sheet.paste(im, (x, gap + cap))
        x += im.width + gap
    out = SHOTS / f'sheet-{name}.png'
    sheet.save(out, optimize=True)
    print(out.name, sheet.size)
