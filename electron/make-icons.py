#!/usr/bin/env python3
"""Generate APEX CIRCUIT icons without third-party packages."""
import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = 1024
OUT = os.path.join(ROOT, 'assets', 'icon-source.png')


def inside_triangle(px, py, ax, ay, bx, by, cx, cy):
    def sign(x1, y1, x2, y2, x3, y3):
        return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3)
    d1 = sign(px, py, ax, ay, bx, by)
    d2 = sign(px, py, bx, by, cx, cy)
    d3 = sign(px, py, cx, cy, ax, ay)
    neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (neg and pos)


def dist_to_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


rows = bytearray()
for y in range(SIZE):
    row = bytearray([0])  # PNG filter type 0
    py = y / SIZE
    for x in range(SIZE):
        px = x / SIZE
        # Dark radial backdrop with a slight cyan tint toward the centre.
        d = math.hypot(px - 0.5, py - 0.5)
        glow = max(0.0, 1 - d * 2.1)
        r = int(6 + glow * 8)
        g = int(9 + glow * 26)
        b = int(16 + glow * 38)
        # Speed stripes.
        stripe = (math.sin((px * 7 + py * 3) * math.pi) > 0.94) and (py > 0.62)
        if stripe:
            r, g, b = r + 8, g + 22, b + 30
        # Triangle vertices (apex up).
        ax, ay = 0.50, 0.17
        bx, by = 0.15, 0.79
        cx, cy = 0.85, 0.79
        edge = min(
            dist_to_segment(px, py, ax, ay, bx, by),
            dist_to_segment(px, py, bx, by, cx, cy),
            dist_to_segment(px, py, cx, cy, ax, ay),
        )
        if edge < 0.045:
            r, g, b = 72, 230, 255
        elif inside_triangle(px, py, ax, ay, bx, by, cx, cy) and edge < 0.11:
            r, g, b = 255, 62, 157
        # Rounded-corner mask.
        edge_dist = min(px, py, 1 - px, 1 - py)
        alpha = 255 if edge_dist > 0.045 else int(255 * max(0.0, edge_dist / 0.045))
        row += bytes((min(255, r), min(255, g), min(255, b), alpha))
    rows += row


def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)


png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(bytes(rows), 9))
png += chunk(b'IEND', b'')
with open(OUT, 'wb') as f:
    f.write(png)
print(OUT)
