#!/usr/bin/env python3
"""Generate the PI-Desktop macOS app icon.

Draws the brand mark (geometric pi glyph on a charcoal squircle) with
Pillow, supersampled for clean edges, then emits:

  apps/desktop/build/icon.iconset/  - all macOS iconset sizes
  apps/desktop/build/icon.icns      - via `iconutil` (macOS only)
  apps/desktop/build/icon_1024.png  - master render for reuse

Run: python3 scripts/make-icon.py
"""

from __future__ import annotations

import math
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "apps" / "desktop" / "build"

# Master canvas. Rendered 4x and downscaled for antialiasing.
BASE = 1024
SS = 4
S = BASE * SS


def superellipse_mask(size: int, box: float, n: float = 5.0) -> Image.Image:
    """Apple-style squircle mask: |x/a|^n + |y/b|^n = 1."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    a = box / 2.0
    cx = cy = size / 2.0
    pts = []
    steps = 720
    for i in range(steps):
        t = 2.0 * math.pi * i / steps
        ct, st = math.cos(t), math.sin(t)
        x = cx + a * (abs(ct) ** (2.0 / n)) * (1 if ct >= 0 else -1)
        y = cy + a * (abs(st) ** (2.0 / n)) * (1 if st >= 0 else -1)
        pts.append((x, y))
    draw.polygon(pts, fill=255)
    return mask


def vertical_gradient(size: int, top: tuple, bottom: tuple) -> Image.Image:
    grad = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / (size - 1)
        grad.putpixel(
            (0, y),
            tuple(round(top[c] + (bottom[c] - top[c]) * t) for c in range(3)),
        )
    return grad.resize((size, size))


def main() -> None:
    # Charcoal plate matching the app shell (#181818 family), lifted at top.
    plate_top = (0x33, 0x36, 0x3B)
    plate_bottom = (0x15, 0x16, 0x18)
    img = vertical_gradient(S, plate_top, plate_bottom).convert("RGBA")

    # Soft top-center highlight for a subtle "lit plate" feel.
    hl = Image.new("L", (S, S), 0)
    hld = ImageDraw.Draw(hl)
    hld.ellipse(
        (S * 0.10, -S * 0.35, S * 0.90, S * 0.35),
        fill=46,
    )
    hl = hl.filter(ImageFilter.GaussianBlur(S * 0.06))
    img = Image.composite(
        Image.new("RGBA", (S, S), (255, 255, 255, 255)), img, hl.point(lambda p: p // 3)
    )

    draw = ImageDraw.Draw(img)

    # Geometric pi mark, round caps, optically centered.
    ink = (0xF5, 0xF6, 0xF7, 255)
    w = 0.075 * S  # stroke width
    r = w / 2.0

    bar_y = 0.392 * S
    bar_x0, bar_x1 = 0.268 * S, 0.732 * S
    leg_l_x = 0.392 * S
    leg_r_x = 0.608 * S
    leg_bottom = 0.700 * S

    def capsule(x0, y0, x1, y1):
        draw.line((x0, y0, x1, y1), fill=ink, width=round(w))
        for (px, py) in ((x0, y0), (x1, y1)):
            draw.ellipse((px - r, py - r, px + r, py + r), fill=ink)

    # Top bar
    capsule(bar_x0, bar_y, bar_x1, bar_y)
    # Left leg
    capsule(leg_l_x, bar_y, leg_l_x, leg_bottom)
    # Right leg with outward foot (classic pi tail): descend, then a quarter
    # arc curving right, ending with a horizontal tangent.
    tail_r = 0.085 * S
    capsule(leg_r_x, bar_y, leg_r_x, leg_bottom - tail_r)
    cx, cy = leg_r_x + tail_r, leg_bottom - tail_r  # arc circle center
    outer = tail_r + r  # PIL arc width grows inward from the outer radius
    arc_box = (cx - outer, cy - outer, cx + outer, cy + outer)
    draw.arc(arc_box, start=90, end=180, fill=ink, width=round(w))
    # round caps: tail end (bottom tangent point) and leg/arc joint
    draw.ellipse((cx - r, leg_bottom - r, cx + r, leg_bottom + r), fill=ink)
    draw.ellipse((leg_r_x - r, cy - r, leg_r_x + r, cy + r), fill=ink)

    # Clip to Apple squircle (824/1024 of canvas) with transparent margin.
    mask = superellipse_mask(S, box=S * 824 / 1024, n=5.0)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)

    master = out.resize((BASE, BASE), Image.LANCZOS)

    BUILD.mkdir(parents=True, exist_ok=True)
    master.save(BUILD / "icon_1024.png")

    iconset = BUILD / "icon.iconset"
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir()
    sizes = [16, 32, 128, 256, 512]
    for sz in sizes:
        master.resize((sz, sz), Image.LANCZOS).save(iconset / f"icon_{sz}x{sz}.png")
        master.resize((sz * 2, sz * 2), Image.LANCZOS).save(
            iconset / f"icon_{sz}x{sz}@2x.png"
        )

    icns = BUILD / "icon.icns"
    subprocess.run(
        ["iconutil", "-c", "icns", str(iconset), "-o", str(icns)], check=True
    )
    print(f"wrote {icns}")


if __name__ == "__main__":
    main()
