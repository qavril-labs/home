# Renders the product images used on the site: a 3D-perspective dashboard for each product,
# with the product's services as floating labels. Output: site/img/dashboards/<slug>.png
# The figures are sample data and the image is labelled as an illustrative preview.
import json, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "site", "img", "dashboards")
os.makedirs(OUT, exist_ok=True)
products = json.load(open(os.path.join(ROOT, "scripts", "product-images.json"), encoding="utf8"))

FONT_B = "C:/Windows/Fonts/arialbd.ttf"
FONT = "C:/Windows/Fonts/arial.ttf"
W, H = 1600, 900
SW, SH = 1280, 720  # the screen being shown
HUES = {"lime": (198, 255, 61), "cyan": (61, 232, 255), "pink": (255, 79, 163), "violet": (139, 107, 255), "yellow": (255, 225, 77)}
INK = (13, 11, 31)
CREAM = (255, 244, 220)
BLACK = (10, 10, 15)
CARD = (22, 18, 46)


def f(path, size):
    return ImageFont.truetype(path, size)


def find_coeffs(dst, src):
    # Solve the 8 coefficients that map output (dst) points to input (src) points.
    matrix = []
    for (x, y), (u, v) in zip(dst, src):
        matrix.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        matrix.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    b = []
    for (x, y), (u, v) in zip(dst, src):
        b.append(u)
        b.append(v)
    n = 8
    a = [row[:] + [b[i]] for i, row in enumerate(matrix)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(a[r][col]))
        a[col], a[pivot] = a[pivot], a[col]
        for r in range(n):
            if r != col and a[col][col] != 0:
                factor = a[r][col] / a[col][col]
                for c in range(col, n + 1):
                    a[r][c] -= factor * a[col][c]
    return [a[i][n] / a[i][i] for i in range(n)]


def screen(name, kpis, services, hue):
    img = Image.new("RGB", (SW, SH), INK)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, SW - 1, 64), radius=0, fill=CARD)
    for i, c in enumerate([(255, 79, 163), (255, 225, 77), (198, 255, 61)]):
        d.ellipse((24 + i * 24, 22, 40 + i * 24, 38), fill=c)
    d.text((120, 18), name, font=f(FONT_B, 26), fill=CREAM)
    d.text((SW - 430, 24), "Illustrative preview · sample data", font=f(FONT, 18), fill=(191, 186, 217))
    # KPI tiles
    values = ["1,240", "38", "92%"]
    for i, label in enumerate(kpis[:3]):
        x = 40 + i * 410
        d.rounded_rectangle((x, 100, x + 380, 220), radius=22, fill=CARD, outline=hue, width=3)
        d.text((x + 24, 124), label, font=f(FONT, 22), fill=(191, 186, 217))
        d.text((x + 24, 160), values[i], font=f(FONT_B, 44), fill=CREAM)
    # Bar chart
    d.rounded_rectangle((40, 250, 860, 680), radius=26, fill=CARD)
    d.text((70, 272), "Activity this month", font=f(FONT_B, 22), fill=CREAM)
    seed = sum(ord(ch) for ch in name)
    for i in range(14):
        h = 60 + ((seed * (i + 3) * 31) % 260)
        x = 80 + i * 54
        color = hue if i % 2 else (139, 107, 255)
        d.rounded_rectangle((x, 640 - h, x + 34, 640), radius=8, fill=color)
    # Side list of services
    d.rounded_rectangle((900, 250, SW - 40, 680), radius=26, fill=CARD)
    d.text((930, 272), "Services", font=f(FONT_B, 22), fill=CREAM)
    for i, s in enumerate(services[:4]):
        y = 326 + i * 84
        d.rounded_rectangle((930, y, SW - 70, y + 56), radius=16, fill=(35, 29, 70))
        d.ellipse((948, y + 20, 966, y + 38), fill=hue)
        d.text((984, y + 16), s[:34], font=f(FONT, 20), fill=CREAM)
    return img


def scene(name, kpis, services, hue_name):
    hue = HUES[hue_name]
    bg = Image.new("RGB", (W, H), (18, 12, 40))
    # Soft colour glow
    glow = Image.new("RGB", (W, H), (18, 12, 40))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-200, -250, 700, 450), fill=(255, 79, 163))
    gd.ellipse((1000, -200, 1800, 450), fill=hue)
    gd.ellipse((400, 600, 1200, 1100), fill=(139, 107, 255))
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    bg = Image.blend(bg, glow, 0.6)

    src = screen(name, kpis, services, hue)
    # Destination quad: the screen tilted in 3D space
    dst = [(230, 190), (1380, 110), (1400, 740), (210, 690)]
    coeffs = find_coeffs(dst, [(0, 0), (SW, 0), (SW, SH), (0, SH)])

    # Shadow under the screen
    shadow_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow_mask).polygon([(x + 24, y + 34) for x, y in dst], fill=200)
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(26))
    dark = Image.new("RGB", (W, H), (0, 0, 0))
    bg = Image.composite(dark, bg, shadow_mask)

    # Screen edge (depth) behind the screen
    edge_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(edge_mask).polygon([(x, y + 16) for x, y in dst], fill=255)
    edge = Image.new("RGB", (W, H), hue)
    bg = Image.composite(edge, bg, edge_mask)

    # The screen itself, warped into perspective
    warped = src.transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(dst, fill=255)
    out = Image.composite(warped, bg, mask)

    # Service labels float around the screen
    d = ImageDraw.Draw(out)
    labels = services[:4]
    spots = [(60, 120), (1210, 60), (80, 700), (1180, 730)]
    for (x, y), label in zip(spots, labels):
        text = label[:30]
        width = int(d.textlength(text, font=f(FONT_B, 22))) + 36
        d.rounded_rectangle((x, y, x + width, y + 46), radius=23, fill=hue, outline=BLACK, width=3)
        d.text((x + 18, y + 10), text, font=f(FONT_B, 22), fill=BLACK)
    return out.convert("RGB")


for p in products:
    hue = "lime" if len(p["slug"]) % 2 else "cyan"
    image = scene(p["name"], p["kpis"], p["services"], hue)
    path = os.path.join(OUT, p["slug"] + ".png")
    image.quantize(colors=256, method=Image.Quantize.MEDIANCUT).convert("RGB").save(path, "PNG", optimize=True)
    print("wrote", os.path.relpath(path, ROOT), image.size)
