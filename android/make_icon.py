"""生成 App 图标（纯 Python，无第三方依赖）"""
import os, math, struct, zlib

def write_png(path, w, h, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)

def lerp(a, b, t):
    return int(a + (b - a) * t)

def render(size, SS=3):
    W = size * SS
    px = [[(255, 255, 255, 0)] * W for _ in range(W)]
    c1 = (255, 132, 66)
    c2 = (247, 89, 26)
    for y in range(W):
        t = y / (W - 1)
        base = (lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t), 255)
        # 右上角柔和光斑
        for x in range(W):
            d = math.hypot(x / W - 0.78, y / W - 0.14)
            glow = max(0.0, 1 - d / 0.55) * 0.18
            r = min(255, int(base[0] + 255 * glow))
            g = min(255, int(base[1] + 255 * glow))
            b = min(255, int(base[2] + 245 * glow))
            px[y][x] = (r, g, b, 255)

    cx, cy = W * 0.5, W * 0.56
    R = W * 0.285
    rim_h = W * 0.075

    for y in range(W):
        for x in range(W):
            white = False
            # 碗身：半圆
            if y >= cy and math.hypot(x - cx, y - cy) <= R:
                white = True
            # 碗沿：横向胶囊
            if abs(y - cy) <= rim_h / 2 and abs(x - cx) <= R + W * 0.012:
                white = True
            if white:
                px[y][x] = (255, 252, 247, 255)

    # 蒸汽：三条向上弯的线
    for i, off in enumerate((-1, 0, 1)):
        bx = cx + off * R * 0.62
        thick = W * 0.022
        y0, y1 = cy - rim_h - W * 0.30, cy - rim_h - W * 0.02
        steps = int(y1 - y0)
        for s in range(steps):
            y = y0 + s
            t = s / max(1, steps)
            x = bx + math.sin(t * math.pi * 1.6 + i) * W * 0.030
            for dx in range(int(-thick), int(thick) + 1):
                for dy in range(-int(thick), int(thick) + 1):
                    if dx * dx + dy * dy <= thick * thick * 0.55:
                        yy, xx = int(y + dy), int(x + dx)
                        if 0 <= yy < W and 0 <= xx < W:
                            px[yy][xx] = (255, 255, 255, 255)

    # 下采样
    out = []
    for y in range(size):
        row = []
        for x in range(size):
            r = g = b = a = 0
            for dy in range(SS):
                for dx in range(SS):
                    p = px[y * SS + dy][x * SS + dx]
                    r += p[0]; g += p[1]; b += p[2]; a += p[3]
            n = SS * SS
            row += [r // n, g // n, b // n, a // n]
        out.append(row)
    return out

base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "res")
targets = {"mipmap-mdpi": 48, "mipmap-hdpi": 72, "mipmap-xhdpi": 96,
           "mipmap-xxhdpi": 144, "mipmap-xxxhdpi": 192}
for folder, s in targets.items():
    os.makedirs(os.path.join(base, folder), exist_ok=True)
    write_png(os.path.join(base, folder, "ic_launcher.png"), s, s, render(s))
    print("ok", folder, s)
