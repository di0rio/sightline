"""Draws Sightline's mark and everything made from it:

    python3 tools/logo.py

public/icon.png (512), public/favicon.png (32), public/apple-touch-icon.png (180),
public/og.png (1200x630, the preview chat apps unfurl) and assets/banner.png (the README header).

The mark is 32x32 pixel art, Deskline's sibling: an eye with a dark outline, and in its iris the
dusk from luannzin.com's dither strip (violet, plum, ember, gold) in a 4x4 Bayer ordered dither,
the same sky the app draws behind everything. Pixels are placed one by one and scaled up with
nearest-neighbour, so every size stays crisp.

The banner and the preview are the same world at their sizes: a field of dots on a grid dithered
from the night down to a dusk glow, the mark, and the name in a 5x7 pixel face drawn here.
"""

import math
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, "..", "public")
ASSETS = os.path.join(HERE, "..", "assets")


def rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5)) + (255,)


NIGHT = rgb("#110d24")
DUSK = [rgb("#3a2a6b"), rgb("#7a3361"), rgb("#e0703f"), rgb("#ffd180")]
LINE = rgb("#1a1424")  # outlines
WHITE = rgb("#e8e4f0")
WHITE_LIT = rgb("#ffffff")
WHITE_SHADE = rgb("#b4acc8")
INK = rgb("#f5f5f5")
MUTED = rgb("#b2b2b2")
CLEAR = (0, 0, 0, 0)
BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))


def dither(ramp, t, x, y):
    """Colour of cell (x, y) at position t (0..1) along `ramp`, ordered-dithered."""
    step = t * (len(ramp) - 1) + BAYER[y % 4][x % 4] / 16 - 0.5
    return ramp[max(0, min(len(ramp) - 1, round(step)))]


def lid(x):
    """Half the eye's opening at column x (pixel centres), an almond 27 wide."""
    u = (x + 0.5 - 16) / 13.6
    return 0 if abs(u) >= 1 else 9.6 * (1 - u * u) ** 0.85


def mark():
    """The 32x32 mark."""
    img = Image.new("RGBA", (32, 32), CLEAR)
    px = img.load()
    cx, cy = 16, 16

    def inside(x, y):
        return abs(y + 0.5 - cy) < lid(x)

    # the white of the eye, lit from the upper left, shaded toward the lower right
    for y in range(32):
        for x in range(32):
            if inside(x, y):
                px[x, y] = WHITE_SHADE if (y - cy) > lid(x) * 0.45 else WHITE
                if (y - cy) < -lid(x) * 0.55 and x < cx:
                    px[x, y] = WHITE_LIT
    # the iris: dusk, night at its top, the glow at its bottom, ringed in the outline colour
    r = 7.5
    for y in range(32):
        for x in range(32):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d < r and inside(x, y):
                t = (y + 0.5 - (cy - r)) / (2 * r)
                px[x, y] = LINE if d > r - 1.2 else dither(DUSK, t, x, y)
    # the pupil, and the catchlight that makes it look back at you
    for y in range(32):
        for x in range(32):
            if math.hypot(x + 0.5 - cx, y + 0.5 - cy) < 2.9:
                px[x, y] = NIGHT
    for x, y in ((17, 12), (18, 12), (17, 13), (18, 13), (13, 19)):
        px[x, y] = WHITE_LIT
    # outline: every clear pixel that touches the eye
    edge = [
        (x, y)
        for y in range(32)
        for x in range(32)
        if px[x, y] == CLEAR
        and any(
            0 <= x + dx < 32 and 0 <= y + dy < 32 and px[x + dx, y + dy] not in (CLEAR, LINE)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
        )
    ]
    for x, y in edge:
        px[x, y] = LINE
    return img


def scaled(img, size):
    """Nearest-neighbour up to a multiple, then down to `size` with a box filter so odd sizes
    stay sharp-edged without uneven pixels."""
    k = max(1, -(-size // img.width))
    big = img.resize((img.width * k, img.height * k), Image.NEAREST)
    return big if big.width == size else big.resize((size, size), Image.BOX)


# 5x7 pixel face: one string of 35 cells per glyph, rows top to bottom.
FONT = {
    "A": ".###.#...##...#######...##...##...#",
    "B": "####.#...##...#####.#...##...#####.",
    "C": ".###.#...##....#....#....#...#.###.",
    "D": "####.#...##...##...##...##...#####.",
    "E": "######....#....####.#....#....#####",
    "G": ".###.#...##....#.####...##...#.####",
    "H": "#...##...##...#######...##...##...#",
    "I": ".###...#....#....#....#....#...###.",
    "K": "#...##..#.#.#..##...#.#..#..#.#...#",
    "L": "#....#....#....#....#....#....#####",
    "N": "#...###..##.#.##..###...##...##...#",
    "O": ".###.#...##...##...##...##...#.###.",
    "P": "####.#...##...#####.#....#....#....",
    "R": "####.#...##...#####.#.#..#..#.#...#",
    "S": ".#####....#.....###.....#....#####.",
    "T": "#####..#....#....#....#....#....#..",
    "U": "#...##...##...##...##...##...#.###.",
    "W": "#...##...##...##.#.##.#.##.#.#.#.#.",
    "Y": "#...##...#.#.#...#....#....#....#..",
    "·": "." * 17 + "#" + "." * 17,
    " ": "." * 35,
}


def text(img, s, x, y, scale, color):
    """Draw `s` in the 5x7 face, `scale` image pixels per font pixel, 1 font pixel between
    letters. Returns the x after the last letter."""
    px = img.load()
    for ch in s.upper():
        for i, c in enumerate(FONT[ch]):
            if c == "#":
                gx, gy = x + (i % 5) * scale, y + (i // 5) * scale
                for yy in range(gy, gy + scale):
                    for xx in range(gx, gx + scale):
                        px[xx, yy] = color
        x += 6 * scale
    return x


def field(w, h, glow, reach, cell=4):
    """A field of dots on a grid, night at the top dithering down to the dusk glow at `glow`."""
    img = Image.new("RGBA", (w, h), NIGHT)
    px = img.load()
    ramp = [NIGHT] + DUSK
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            near = max(0.0, 1 - ((x - glow[0]) ** 2 + ((y - glow[1]) * 1.6) ** 2) ** 0.5 / reach)
            t = max(near**1.6, 0.08 + 0.25 * (y / h) ** 2)
            c = dither(ramp, t, x // cell, y // cell)
            if c != NIGHT:
                for yy in range(y, min(h, y + cell - 1)):  # a dot, with a 1px gap: the grid shows
                    for xx in range(x, min(w, x + cell - 1)):
                        px[xx, yy] = c
    return img


def banner():
    """1600x420: the field with the glow at the bottom right, where the mark sits."""
    img = field(1600, 420, (1300, 330), 900)
    img.alpha_composite(scaled(mark(), 256), (1172, 82))
    text(img, "SIGHTLINE", 110, 120, 14, INK)
    text(img, "SHOW YOUR SCREEN WITH A LINK", 112, 260, 4, INK)
    text(img, "IN THE BROWSER · PEER TO PEER · WITH SOUND", 112, 310, 3, MUTED)
    return img


def preview():
    """1200x630, what Discord and friends show under a pasted link."""
    img = field(1200, 630, (600, 700), 820)
    m = scaled(mark(), 224)
    img.alpha_composite(m, ((1200 - 224) // 2, 96))
    name = "SIGHTLINE"
    w = len(name) * 6 * 10 - 10
    text(img, name, (1200 - w) // 2, 360, 10, INK)
    line = "OPEN THE LINK TO WATCH"
    w = len(line) * 6 * 4 - 4
    text(img, line, (1200 - w) // 2, 470, 4, INK)
    return img


def main():
    os.makedirs(PUBLIC, exist_ok=True)
    os.makedirs(ASSETS, exist_ok=True)
    art = mark()
    scaled(art, 512).save(os.path.join(PUBLIC, "icon.png"))
    art.save(os.path.join(PUBLIC, "favicon.png"))
    # iOS puts the touch icon on a white tile: give it the night instead
    touch = Image.new("RGBA", (180, 180), NIGHT)
    touch.alpha_composite(scaled(art, 160), (10, 10))
    touch.save(os.path.join(PUBLIC, "apple-touch-icon.png"))
    preview().convert("RGB").save(os.path.join(PUBLIC, "og.png"), optimize=True)
    banner().save(os.path.join(ASSETS, "banner.png"), optimize=True)
    print("wrote", ", ".join(sorted(os.listdir(PUBLIC) + os.listdir(ASSETS))))


if __name__ == "__main__":
    main()
