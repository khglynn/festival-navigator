# Contact sheets for the guest-shelf round: frames side by side at phone
# size, labelled. 320 frames are drawn at 320 wide (true relative size).
import os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
FR = os.path.join(HERE, 'frames')
BG = (12, 10, 20); INK = (237, 234, 244); SUB = (135, 127, 164)
def font(sz, bold=True):
    p = '/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf'
    return ImageFont.truetype(p, sz) if os.path.exists(p) else ImageFont.load_default()
def sheet(name, title, items):
    gap, head, lab = 28, 90, 56
    sizes = [(320, 568) if f.endswith('-320') else (390, 844) for f, _ in items]
    W = sum(w for w, _ in sizes) + (len(items) + 1) * gap
    H = head + lab + max(h for _, h in sizes) + gap
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    d.text((gap, 28), title, fill=INK, font=font(30))
    x = gap
    for (fid, label), (w, h) in zip(items, sizes):
        y = head
        d.text((x, y + 6), fid.split('-')[0].upper(), fill=INK, font=font(20))
        d.text((x + 34, y + 9), label, fill=SUB, font=font(16, False))
        f = Image.open(os.path.join(FR, fid + '.png')).convert('RGB').resize((w, h), Image.LANCZOS)
        im.paste(f, (x, y + lab))
        d.rectangle([x - 1, y + lab - 1, x + w, y + lab + h], outline=(43, 36, 64))
        x += w + gap
    im.save(os.path.join(HERE, name + '.png'), optimize=True)
    print(name, im.size)
sheet('sheet-1-guest', 'A guest: the welcome card, a tap opens the card, Pick shows asks on a shelf', [
    ('a-welcome-390', 'welcome, fixed'), ('a-welcome-320', '320'),
    ('b-guest-zoom-390', 'tap = look'), ('c-shelf-new-390', 'Pick shows → shelf'), ('c-shelf-new-320', '320')])
sheet('sheet-2-shelf', 'The join shelf: a returning member, the keyboard, the edges', [
    ('d-shelf-returning-390', 'returning: tap your name'), ('e-shelf-keyboard-390', 'new: type, keyboard up'),
    ('g-shelf-offline-pickshows-390', 'offline, from Pick shows'), ('f-shelf-12-long-320', '12 names, long name'),
    ('f2-shelf-12-keyboard-320', 'same, keyboard up')])
sheet('sheet-3-member', 'Everyone on a phone: tap opens the card, − notes + picks inside it', [
    ('h-member-zoom-0-390', 'not picked'), ('h-member-zoom-1-390', '+ once: picked'),
    ('h-member-zoom-must-390', '+ four times: must'), ('h-member-closed-must-390', 'closed: the card says must'),
    ('h-member-zoom-0-320', '320'), ('h-member-zoom-must-320', '320 must')])
