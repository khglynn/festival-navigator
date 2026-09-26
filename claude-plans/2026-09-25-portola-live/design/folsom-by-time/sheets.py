# Contact sheets for the Folsom-by-time round (v94, 2026-09-25): frames side
# by side at true relative size (a 320 frame is drawn narrower than a 390),
# labelled. Run after rig.mjs.
import os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
FR = os.path.join(HERE, 'frames')
BG = (12, 10, 20); INK = (237, 234, 244); SUB = (135, 127, 164)
def font(sz, bold=True):
    p = '/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf'
    return ImageFont.truetype(p, sz) if os.path.exists(p) else ImageFont.load_default()
def sheet(name, title, items, scale=0.5):
    gap, head, lab = 36, 96, 56
    ims = []
    for f, label in items:
        im = Image.open(os.path.join(FR, f + '.png')).convert('RGB')
        ims.append((im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS), f, label))
    W = sum(i.width for i, _, _ in ims) + (len(ims) + 1) * gap
    H = head + lab + max(i.height for i, _, _ in ims) + gap
    out = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(out)
    d.text((gap, 30), title, fill=INK, font=font(30))
    x = gap
    for im, f, label in ims:
        d.text((x, head + 4), label, fill=INK, font=font(19))
        d.text((x, head + 28), f + '.png', fill=SUB, font=font(14, False))
        out.paste(im, (x, head + lab))
        d.rectangle([x - 1, head + lab - 1, x + im.width, head + lab + im.height], outline=(43, 36, 64))
        x += im.width + gap
    out.save(os.path.join(HERE, name + '.png'), optimize=True)
    print(name, out.size)

sheet('sheet-1-phone', 'Folsom by time on a phone: every party of the night in start order, two across (real 68 parties)', [
    ('today-venue-sat-390', 'TODAY: venue stacks, Sat, 390'),
    ('sat-390', 'By time: Sat, 390'), ('fri-390', 'Fri, 390 (11:30 PM: open = ring)'),
    ('sun-390', 'Sun, 390'), ('sat-320', 'Sat, 320'), ('fri-320', 'Fri, 320')])
sheet('sheet-2-desktop', 'Folsom by time at 1280: as many columns as fit; under Saturday\'s clock the columns sit under the clock\'s', [
    ('fri-1280', 'Fri, 1280 (no clock that day)'), ('sat-1280', 'Sat, 1280 (under the Portola clock)'),
    ('today-venue-sat-1280', 'TODAY: venue stacks, Sat, 1280')], scale=0.4)
sheet('sheet-3-in-context', 'In context on a phone: what the screen shows, the rooms above, and the zoom', [
    ('view-sat-390', 'Sat: afters above, Folsom below'), ('today-venue-view-sat-390', 'TODAY, same spot'),
    ('view-fri-390', 'Fri: FRI FOLSOM'), ('zoom-sat-390', 'Hold a card: the zoom, Tix/Info, − note +'),
    ('view-sat-320', 'Sat, 320')])

# 2026-09-26: the merged data (data/folsom-all + the 18 same-venue parties),
# and the clock-day decision shown both ways.
sheet('sheet-4-full-data', 'Folsom by time with ALL the data (65 cards: Fri 20, Sat 24, Sun 21), 390', [
    ('real-fri-390', 'FRI FOLSOM (11:30 PM: open = ring)'), ('real-sat-390', 'SAT FOLSOM'), ('real-sun-390', 'SUN FOLSOM')])
sheet('sheet-5-clock-day', 'Sat under the clock · A (built): two full columns · B (v91 rule): 40px in, scrolls', [
    ('real-A-view-sat-390', 'A (built): 390'), ('real-B-view-sat-390', 'B (v91 rule): 390'),
    ('real-A-view-sat-320', 'A (built): 320'), ('real-B-view-sat-320', 'B (v91 rule): 320')], scale=0.5)
