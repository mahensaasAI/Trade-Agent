from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

class Text:
    def __init__(self, path):
        self.font = TTFont(path)
        self.upm = self.font["head"].unitsPerEm
        self.cmap = self.font.getBestCmap()
        self.gs = self.font.getGlyphSet()
        self.hmtx = self.font["hmtx"]

    def advance(self, ch):
        return self.hmtx[self.cmap[ord(ch)]][0]

    def run(self, s, size, x=0, y=0, tracking=0.0, anchor="start"):
        """Return (svg path data, width). y is the baseline. tracking in em."""
        scale = size / self.upm
        track_u = tracking * self.upm
        total = sum(self.advance(c) for c in s) + track_u * (len(s) - 1)
        w = total * scale
        if anchor == "middle":
            x -= w / 2
        elif anchor == "end":
            x -= w
        out, cur = [], 0.0
        for c in s:
            g = self.cmap[ord(c)]
            pen = SVGPathPen(self.gs, ntos=lambda v: f"{v:.2f}")
            tp = TransformPen(pen, Transform(scale, 0, 0, -scale, x + cur * scale, y))
            self.gs[g].draw(tp)
            d = pen.getCommands()
            if d:
                out.append(d)
            cur += self.advance(c) + track_u
        return " ".join(out), w

T = Text(FONT)

# ---- the mark -------------------------------------------------------------
S = 512
R = S * 11 / 40                     # same corner radius ratio as the live page
y_d, _ = T.run("Y", S * 24 / 40, x=S * 17 / 40, y=S * 29 / 40, anchor="middle")
two_d, _ = T.run("2", S * 12 / 40, x=S * 30 / 40, y=S * 16 / 40, anchor="middle")

DEFS = f'''<defs>
<linearGradient id="ylg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#4f46e5"/><stop offset=".55" stop-color="#7c3aed"/><stop offset="1" stop-color="#db2777"/>
</linearGradient>
<linearGradient id="ysh" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#ffffff" stop-opacity=".28"/><stop offset=".6" stop-color="#ffffff" stop-opacity="0"/>
</linearGradient>
</defs>'''

def mark(size=S, x=0, y=0, rounded=True):
    k = size / S
    rx = f'{R * k:.2f}' if rounded else "0"
    return (f'<g transform="translate({x},{y}) scale({k:.6f})">'
            f'<rect width="{S}" height="{S}" rx="{R:.2f}" fill="url(#ylg)"/>'
            f'<rect width="{S}" height="{S}" rx="{R:.2f}" fill="url(#ysh)"/>'
            f'<path d="{y_d}" fill="#ffffff"/><path d="{two_d}" fill="#fbbf24"/></g>')

open("brand/ysquare-mark.svg", "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}" '
    f'role="img" aria-label="Y Square">{DEFS}{mark()}</svg>\n')

# square mark on a flat background, for places that flatten transparency
open("brand/ysquare-mark-square.svg", "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}" '
    f'role="img" aria-label="Y Square">{DEFS}'
    f'<rect width="{S}" height="{S}" fill="url(#ylg)"/><rect width="{S}" height="{S}" fill="url(#ysh)"/>'
    f'<path d="{y_d}" fill="#ffffff"/><path d="{two_d}" fill="#fbbf24"/></svg>\n')

# ---- horizontal lockup ----------------------------------------------------
MS = 160                              # mark size in the lockup
GAP = 34
PAD = 28
name_size = 74
sub_size = 25
name_d, name_w = T.run("Y Square", name_size, x=0, y=0)
sub_d, sub_w = T.run("WORKPLACE", sub_size, x=0, y=0, tracking=0.16)

text_w = max(name_w, sub_w)
LW = PAD + MS + GAP + text_w + PAD
LH = PAD + MS + PAD
mark_y = PAD
name_base = PAD + 74
sub_base = PAD + 118

def lockup(name_fill, sub_fill, bg=None):
    bgrect = f'<rect width="{LW:.0f}" height="{LH:.0f}" fill="{bg}"/>' if bg else ""
    tx = PAD + MS + GAP
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {LW:.0f} {LH:.0f}" '
            f'width="{LW:.0f}" height="{LH:.0f}" role="img" aria-label="Y Square Workplace">'
            f'{DEFS}{bgrect}{mark(MS, PAD, mark_y)}'
            f'<g transform="translate({tx:.0f},{name_base})"><path d="{name_d}" fill="{name_fill}"/></g>'
            f'<g transform="translate({tx:.0f},{sub_base})"><path d="{sub_d}" fill="{sub_fill}"/></g>'
            f'</svg>\n')

open("brand/ysquare-lockup-light.svg", "w").write(lockup("#0d1220", "#4f46e5"))
open("brand/ysquare-lockup-dark.svg", "w").write(lockup("#ffffff", "#a5b4fc"))

print("mark + lockups written", int(LW), int(LH))
