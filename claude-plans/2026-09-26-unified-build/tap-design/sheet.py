# Contact sheets from the rig's frames (python3 sheet.py [engine]) -> frames/contact-<engine>-*.png
import sys, os
from PIL import Image, ImageDraw, ImageFont
E = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frames')
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
except Exception: font = ImageFont.load_default()
def row(names, w):
    ims = []
    for n, label in names:
        p = os.path.join(D, f'{E}-{n}.png')
        if not os.path.exists(p): continue
        im = Image.open(p).convert('RGB')
        im = im.resize((w, int(im.height * w / im.width)))
        ims.append((im, label))
    return ims
def sheet(name, rows, w):
    built = [row(r, w) for r in rows]
    built = [b for b in built if b]
    if not built: return
    H = sum(max(im.height for im, _ in b) + 44 for b in built) + 20
    W = max(len(b) for b in built) * (w + 20) + 20
    out = Image.new('RGB', (W, H), (8, 7, 14))
    d = ImageDraw.Draw(out)
    y = 10
    for b in built:
        x = 20
        for im, label in b:
            d.text((x, y), label, fill=(210, 205, 230), font=font)
            out.paste(im, (x, y + 34))
            x += w + 20
        y += max(im.height for im, _ in b) + 44
    p = os.path.join(D, f'contact-{E}-{name}.png')
    out.save(p)
    print(p)
sheet('phone', [
    [('390-member-robyn-open', '390 member: tap Robyn'), ('390-member-robyn-plus1', '+ (you join; row holds)'), ('390-member-robyn-must', '+ + + : MUST, + dims'), ('390-member-robyn-thread-end', 'long thread, composer sticks'), ('390-member-robyn-closed', 'closed: the card’s meter')],
    [('390-member-unpicked-open', 'nobody picked it'), ('390-member-unpicked-plus1', '+ : card grows UP, row holds'), ('390-member-boysnoize-doors', 'doors out: Tix · Info'), ('390-member-robyn-typing', 'keys up (508 tall)')],
    [('390-guest-robyn-open', 'guest: tap Robyn'), ('390-guest-robyn-thread-end', 'guest: the door in'), ('390-guest-robyn-plus-asks', 'guest + : join shelf'), ('320-member-robyn-open', '320: tap Robyn'), ('320-member-robyn-plus1', '320: +'), ('320-member-boysnoize-doors', '320: doors out')],
], 300)
sheet('alt', [[('390-member-unpicked-plus1', 'CORNERS (shipped): Oskar +'), ('390-ALT-own-line-oskar-plus1', 'ALT own line: Oskar +'), ('390-member-robyn-plus1', 'CORNERS (shipped): Robyn +'), ('390-ALT-own-line-robyn-plus1', 'ALT own line: Robyn +')]], 360)
sheet('desktop', [[('1280-mouse-robyn-zoom', '1280 mouse: hover grows the zoom'), ('1280-mouse-robyn-shelf', 'its note door: the same shelf'), ('1280-mouse-robyn-shelf-plus1', '+ on the shelf')]], 760)
sheet('motion', [
    [(f'390-motion-arrive-{i}', f'arrive x10 slow, {i*42}ms') for i in range(8)],
    [(f'390-motion-plus-{i}', f'+ x10 slow, {i*45}ms') for i in range(8)],
], 220)
