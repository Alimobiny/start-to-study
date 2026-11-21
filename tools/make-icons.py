"""Generate the PWA icons: a golden sunrise over a horizon on the app's deep green.

Pure Python standard library (zlib + struct) — no external image packages.
Renders one master image at 1536 px (divisible by both targets) and box-downsamples
to icons/icon-192.png and icons/icon-512.png. Run from the project root:

    py tools/make-icons.py

Design is full-bleed (maskable-safe): the sunrise motif stays inside the central
80% circle, so launchers that crop to a circle cannot cut it.
"""

import struct
import zlib
from pathlib import Path

MASTER = 1536
TARGETS = {192: Path(__file__).resolve().parent.parent / "icons" / "icon-192.png",
           512: Path(__file__).resolve().parent.parent / "icons" / "icon-512.png"}

BG = (0x10, 0x26, 0x1F)      # deep forest green — the app theme color
BAND = (0x0B, 0x1D, 0x16)    # slightly darker band below the horizon
SUN = (0xF9, 0xD8, 0x8B)     # warm gold from the app's sky accent

HORIZON_Y = 0.62             # horizon line, fraction of height from the top
SUN_CX, SUN_CY, SUN_R = 0.5, 0.62, 0.18
GLOW_OUTER = SUN_R * 1.35


def blend(base, tint, t):
    return tuple(round(b + (s - b) * t) for b, s in zip(base, tint))


def pixel(x, y):
    """Color of one normalized point; y grows downward."""
    base = BAND if y >= HORIZON_Y else BG
    dx, dy = x - SUN_CX, y - SUN_CY
    d = (dx * dx + dy * dy) ** 0.5
    if d <= SUN_R:
        return SUN
    if d <= GLOW_OUTER and y < HORIZON_Y:
        t = 0.20 * (1.0 - (d - SUN_R) / (GLOW_OUTER - SUN_R))
        return blend(base, SUN, t)
    return base


def render_master():
    print(f"rendering {MASTER}x{MASTER} master ...")
    step = 1.0 / MASTER
    rows = []
    for iy in range(MASTER):
        y = (iy + 0.5) * step
        rows.append([pixel((ix + 0.5) * step, y) for ix in range(MASTER)])
    return rows


def downsample(rows, k):
    size = len(rows) // k
    print(f"downsampling to {size}x{size} (box {k}x{k}) ...")
    out = []
    for by in range(size):
        y0 = by * k
        line = []
        for bx in range(size):
            x0 = bx * k
            rs = gs = bs = 0
            for yy in range(y0, y0 + k):
                for xx in range(x0, x0 + k):
                    r, g, b = rows[yy][xx]
                    rs += r
                    gs += g
                    bs += b
            n = k * k
            line.append((rs // n, gs // n, bs // n))
        out.append(line)
    return out


def png_chunk(tag, payload):
    return (struct.pack(">I", len(payload)) + tag + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF))


def write_png(path, rows):
    size = len(rows)
    raw = bytearray()
    for row in rows:
        raw.append(0)  # filter type 0 (None) per scanline
        for r, g, b in row:
            raw += bytes((r, g, b))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x89PNG\r\n\x1a\n"
                     + png_chunk(b"IHDR", ihdr)
                     + png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
                     + png_chunk(b"IEND", b""))
    print(f"wrote {path} ({path.stat().st_size:,} bytes)")


def main():
    master = render_master()
    for size, k in ((512, 3), (192, 8)):
        write_png(TARGETS[size], downsample(master, k))
    print("done.")


if __name__ == "__main__":
    main()
