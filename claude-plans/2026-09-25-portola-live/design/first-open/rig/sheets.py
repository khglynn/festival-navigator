# Contact sheets: each set of frames side by side at phone size, labelled.
import os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, '..', 'shots')
BG = (12, 10, 20); INK = (237, 234, 244); SUB = (135, 127, 164)
def font(sz, bold=True):
    for p in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
def sheet(name, title, items, cols=None):
    cols = cols or len(items)
    w, h, gap, head, lab = 390, 844, 28, 90, 56
    rows = (len(items) + cols - 1) // cols
    W = cols * w + (cols + 1) * gap; H = head + rows * (h + lab + gap) + gap
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    d.text((gap, 28), title, fill=INK, font=font(30))
    for i, (sub, fid, label) in enumerate(items):
        r, c = divmod(i, cols)
        x = gap + c * (w + gap); y = head + r * (h + lab + gap)
        d.text((x, y + 6), fid, fill=INK, font=font(20))
        d.text((x + 8 + d.textlength(fid, font=font(20)), y + 9), label, fill=SUB, font=font(16, False))
        f = Image.open(os.path.join(SHOTS, sub, fid + '.png')).convert('RGB').resize((w, h), Image.LANCZOS)
        im.paste(f, (x, y + lab))
        d.rectangle([x - 1, y + lab - 1, x + w, y + lab + h], outline=(43, 36, 64))
    im.save(os.path.join(SHOTS, name + '.png'), optimize=True)
    print(name, im.size)
sheet('sheet-today', 'Today (v89): what a friend sees first', [
    ('today', 't1-cold-landing', 'cold, no link'), ('today', 't2-join-new-device', 'crew link, new phone'),
    ('today', 't3-join-empty-crew', 'crew with nobody'), ('today', 't4-first-wall-coach-mark', 'first wall, day-of open'),
    ('today', 't4b-first-wall-top', 'same wall, scrolled up'), ('today', 't5-share-moment', 'creator’s first page'),
    ('today', 't6-how-it-works', 'How it works page'), ('today', 't7-landing-returning', 'returning phone'),
], cols=4)
sheet('sheet-F1', 'F1 · The door: one welcome screen that is also the join screen', [
    ('frames', 'F1a', 'the door'), ('frames', 'F1b', 'nothing picked yet'), ('frames', 'F1c', 'guest on the wall')])
sheet('sheet-F2', 'F2 · Wall first: walk straight in, a welcome card, the name asked on first tap', [
    ('frames', 'F2a', 'welcome card'), ('frames', 'F2b', 'the "More"'), ('frames', 'F2c', 'tap → add yourself'), ('frames', 'F2d', 'nothing picked yet')])
sheet('sheet-F3', 'F3 · Three beats: a short story, then the wall', [
    ('frames', 'F3a', 'who'), ('frames', 'F3b', 'the colors'), ('frames', 'F3c', 'how to pick')])
sheet('sheet-shared', 'Shared by every direction: the share sheet and the landings', [
    ('frames', 'S1', 'share with a starting view'), ('frames', 'L1', 'cold landing'), ('frames', 'L2', 'returning landing')])
