# Contact sheets for the button study: variants (rows) x cards (columns).
import os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); FR = os.path.join(HERE, 'frames')
BG = (12, 10, 20); INK = (237, 234, 244); SUB = (135, 127, 164)
def font(sz, bold=True):
    p = '/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf'
    return ImageFont.truetype(p, sz) if os.path.exists(p) else ImageFont.load_default()
def grid(name, title, rows, cols, cell_w=390):
    gap, head, rowlab = 24, 84, 190
    ims = {}
    for r, _ in rows:
        for c, _ in cols:
            f = os.path.join(FR, f'{r}-{c}.png')
            if os.path.exists(f):
                im = Image.open(f).convert('RGB'); ims[(r, c)] = im.resize((cell_w, round(im.height * cell_w / im.width)), Image.LANCZOS)
    rh = {r: max(ims[(r, c)].height for c, _ in cols if (r, c) in ims) for r, _ in rows}
    W = rowlab + len(cols) * (cell_w + gap) + gap; H = head + 30 + sum(rh.values()) + gap * (len(rows) + 1)
    out = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(out)
    d.text((gap, 26), title, fill=INK, font=font(28))
    for i, (c, lab) in enumerate(cols): d.text((rowlab + i * (cell_w + gap), head), lab, fill=SUB, font=font(17, False))
    y = head + 30
    for r, lab in rows:
        d.text((gap, y + 8), lab.split('\n')[0], fill=INK, font=font(22))
        for k, line in enumerate(lab.split('\n')[1:]): d.text((gap, y + 40 + k * 22), line, fill=SUB, font=font(15, False))
        for i, (c, _) in enumerate(cols):
            if (r, c) in ims: out.paste(ims[(r, c)], (rowlab + i * (cell_w + gap), y))
        y += rh[r] + gap
    out.save(os.path.join(HERE, name + '.png'), optimize=True); print(name, out.size)
CARDS = [('pale', 'pale wash (Nimino)'), ('dark', 'dark wash (Tricky)'), ('busy', 'busy: 12 people, both doors'), ('unpicked', 'unpicked (Airwolf)')]
if sys.argv[1:] == ['study']:
    grid('sheet-variants', 'The zoom row, four ways — each on four real cards (390, cropped)', [
        ('A', 'A\none segmented\nstepper'), ('B', 'B\nthree equal\nghost pills'), ('C', 'C\nbare − and +,\nnote is a pill'), ('D', 'D\nA with words')], CARDS)
def row(name, title, items, h=844):
    gap, head, lab = 28, 90, 56
    ims = []
    for fid, label in items:
        im = Image.open(os.path.join(FR, fid + '.png')).convert('RGB')
        w = round(im.width * h / im.height) if im.height > 1300 else im.width // 2
        hh = h if im.height > 1300 else im.height // 2
        ims.append((im.resize((w, hh), Image.LANCZOS), fid, label))
    W = sum(i.width for i, _, _ in ims) + gap * (len(ims) + 1); H = head + lab + max(i.height for i, _, _ in ims) + gap
    out = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(out); d.text((gap, 28), title, fill=INK, font=font(28))
    x = gap
    for im, fid, label in ims:
        d.text((x, head + 8), label, fill=SUB, font=font(17, False)); out.paste(im, (x, head + lab))
        d.rectangle([x - 1, head + lab - 1, x + im.width, head + lab + im.height], outline=(43, 36, 64)); x += im.width + gap
    out.save(os.path.join(HERE, name + '.png'), optimize=True); print(name, out.size)
if sys.argv[1:] == ['winner']:
    row('sheet-winner', 'A · the segmented stepper: 390, 320, a 1280 tablet, pressed and focused', [
        ('W-A-full-390', '390, the busy card'), ('W-A-full-320', '320'), ('W-A-full-1280', '1280 (touch)')], h=844)
    grid('sheet-winner-states', 'A on every wash, and its states (390, cropped)', [('W-A', 'A')],
         [('pale-390', 'pale'), ('dark-390', 'dark'), ('busy-390', 'busy'), ('unpicked-390', 'unpicked'), ('pressed-plus', 'pressed +'), ('focus-minus', 'keyboard focus on −')])
    row('sheet-family', 'One button family: the welcome card, a guest\'s zoom, the join shelf (390)', [
        ('F-A-welcome-390', 'welcome: Pick shows | Look around'), ('F-A-guest-zoom-390', 'guest zoom: + note | Pick shows'), ('F-A-shelf-390', 'shelf: Join as Sam | Look around')])
