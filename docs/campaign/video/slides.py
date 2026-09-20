"""The carousel: six 1080x1350 JPGs, ready to upload to Instagram as one post."""
import os
from PIL import Image, ImageDraw, ImageEnhance, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = r"C:\Users\User\neggarman\alternate-style-hub\docs\campaign\assets"
OUT = os.path.join(HERE, "slides")
W, H = 1080, 1350

INK = (15, 14, 12); PAPER = (247, 245, 239)
MUSTARD = (255, 194, 31); HOT = (240, 59, 45); LIME = (200, 240, 45); SKY = (47, 168, 255); VIOLET = (122, 77, 255)

F_BLACK = r"C:\Windows\Fonts\ariblk.ttf"
F_BOLD = r"C:\Windows\Fonts\arialbd.ttf"
F_MONO = r"C:\Windows\Fonts\consolab.ttf"
_f = {}


def font(p, s):
    if (p, s) not in _f:
        _f[(p, s)] = ImageFont.truetype(p, s)
    return _f[(p, s)]


def measure(s, f):
    b = f.getbbox(s)
    return b[2] - b[0], b[3] - b[1]


def fit(name, focus=0.10, dim=1.0):
    im = Image.open(os.path.join(ASSETS, name)).convert("RGB")
    s = max(W / im.width, H / im.height)
    im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2
    y = max(0, min(im.height - H, int((im.height - H) * focus)))
    im = im.crop((x, y, x + W, y + H))
    im = ImageEnhance.Color(im).enhance(1.3)
    im = ImageEnhance.Contrast(im).enhance(1.08)
    return ImageEnhance.Brightness(im).enhance(dim)


def scrim(im, height=0.62):
    grad = Image.new("L", (1, H), 0)
    px = grad.load()
    for y in range(H):
        if y > H * (1 - height):
            k = (y - H * (1 - height)) / (H * height)
            px[0, y] = int(245 * (k ** 1.45))
    return Image.composite(Image.new("RGB", (W, H), (8, 8, 6)), im, grad.resize((W, H)))


def tag(d, xy, s, bg, fg, size=23, pad=(22, 13)):
    f = font(F_MONO, size)
    w, h = measure(s, f)
    d.rectangle((xy[0], xy[1], xy[0] + w + pad[0] * 2, xy[1] + h + pad[1] * 2 + 6), fill=bg)
    d.text((xy[0] + pad[0], xy[1] + pad[1]), s, font=f, fill=fg)
    return xy[0] + w + pad[0] * 2


def bar(im, accent):
    d = ImageDraw.Draw(im)
    tag(d, (46, 46), "VAA ALTERNATE", accent, INK)
    f = font(F_MONO, 23)
    s = "KES 25 . M-PESA"
    w, h = measure(s, f)
    d.rectangle((W - 46 - w - 44, 46, W - 46, 46 + h + 32), fill=PAPER)
    d.text((W - 46 - w - 22, 59), s, font=f, fill=INK)
    return im


def stripe(im, y, cols=(MUSTARD, HOT, LIME, SKY, VIOLET), h=22):
    d = ImageDraw.Draw(im)
    w = W // len(cols)
    for i, c in enumerate(cols):
        d.rectangle((i * w, y, (i + 1) * w if i < len(cols) - 1 else W, y + h), fill=c)
    return im


def headline(im, y, lines, size=100, hi=None, hi_bg=MUSTARD, hi_fg=INK, x=48):
    """Big type; one line can carry a solid colour block behind it."""
    d = ImageDraw.Draw(im)
    f = font(F_BLACK, size)
    lh = int(size * 1.08)
    for i, line in enumerate(lines):
        yy = y + i * lh
        if hi is not None and i == hi:
            w, _ = measure(line, f)
            d.rectangle((x - 14, yy - 6, x + w + 18, yy + size + 12), fill=hi_bg)
            d.text((x, yy), line, font=f, fill=hi_fg)
        else:
            d.text((x, yy), line, font=f, fill=PAPER)
    return y + len(lines) * lh


def sub(im, y, text, size=35, col=PAPER, x=48, width=26):
    d = ImageDraw.Draw(im)
    f = font(F_BOLD, size)
    words, line, lines = text.split(), "", []
    for w in words:
        t = (line + " " + w).strip()
        if len(t) > width:
            lines.append(line); line = w
        else:
            line = t
    lines.append(line)
    for i, l in enumerate(lines):
        d.text((x, y + i * int(size * 1.24)), l, font=f, fill=col)
    return y + len(lines) * int(size * 1.24)


def verdict(im, s, bg, fg):
    d = ImageDraw.Draw(im)
    f = font(F_MONO, 25)
    w, h = measure(s, f)
    layer = Image.new("RGBA", (w + 48, h + 36), bg + (255,))
    ImageDraw.Draw(layer).text((24, 12), s, font=f, fill=fg + (255,))
    layer = layer.rotate(-3.5, expand=True, resample=Image.BICUBIC)
    im.paste(layer, (W - layer.width - 40, 150), layer)
    return im


def photo_slide(src, focus, accent, verdict_text, verdict_bg, verdict_fg, kicker, lines, hi, hi_bg, hi_fg, subtitle, size=100):
    im = scrim(fit(src, focus))
    im = bar(im, accent)
    im = verdict(im, verdict_text, verdict_bg, verdict_fg)
    d = ImageDraw.Draw(im)
    y = 760
    tag(d, (48, y), kicker, verdict_bg, verdict_fg)
    y = headline(im, y + 90, lines, size, hi, hi_bg, hi_fg)
    y = sub(im, y + 26, subtitle)
    stripe(im, H - 92)
    return im


def flat_slide(bg, blocks):
    im = Image.new("RGB", (W, H), bg)
    return im


os.makedirs(OUT, exist_ok=True)

s1 = photo_slide("01-her-photo.jpg", 0.10, MUSTARD, "Her photo", PAPER, INK, "Start here",
                 ["This is", "her photo."], 1, MUSTARD, INK,
                 "Plain wall. White sneakers. Standing straight.", 104)

sd = photo_slide("02-the-dress.jpg", 0.40, MUSTARD, "The piece", MUSTARD, INK, "Seen on Instagram",
                 ["The dress", "she saw."], 1, MUSTARD, INK,
                 "The post said mini. Laid flat on the floor it only looks long.", 100)

s2 = photo_slide("03-free-ai-gemini.jpg", 0.16, MUSTARD, "Free AI", HOT, PAPER, "We asked a free AI",
                 ["It was told mini.", "It made a midi."], 1, HOT, PAPER,
                 "Same two pictures. A completely different dress.", 86)

s3 = photo_slide("04-paid-chatgpt.jpg", 0.10, SKY, "Paid AI", MUSTARD, INK, "So we paid for the good one",
                 ["Those heels", "are not hers."], 1, MUSTARD, INK,
                 "She was in sneakers. It changed her shoes, and how she stands.", 98)

s4 = photo_slide("05-alternate.jpg", 0.14, LIME, "Ours", LIME, INK, "VAA ALTERNATE",
                 ["Same me.", "Same shoes.", "Just the dress."], 2, LIME, INK,
                 "The mini, at its real length, on her own body.", 88)

# 5 - the three machines, flat violet
s5 = Image.new("RGB", (W, H), VIOLET)
d5 = ImageDraw.Draw(s5)
bar(s5, MUSTARD)
headline(s5, 200, ["One photo.", "Three machines."], 92, 1, MUSTARD, INK)
cols = [("03-free-ai-gemini.jpg", HOT, PAPER, "FREE AI", "WRONG LENGTH"),
        ("04-paid-chatgpt.jpg", MUSTARD, INK, "PAID AI", "NEW SHOES"),
        ("05-alternate.jpg", LIME, INK, "VAA", "JUST THE DRESS")]
cw, ch, gap = 320, 520, 12
x0 = (W - (cw * 3 + gap * 2)) // 2
for i, (src, col, fg, lab, verd) in enumerate(cols):
    im = Image.open(os.path.join(ASSETS, src)).convert("RGB")
    s = max(cw / im.width, ch / im.height)
    im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    im = ImageEnhance.Color(im).enhance(1.3)
    im = im.crop(((im.width - cw) // 2, int(im.height * 0.06), (im.width - cw) // 2 + cw, int(im.height * 0.06) + ch))
    x = x0 + i * (cw + gap)
    s5.paste(im, (x, 470))
    d5.rectangle((x - 6, 464, x + cw + 5, 470 + ch + 5), outline=col, width=6)
    d5.rectangle((x - 6, 470 + ch, x + cw + 5, 470 + ch + 96), fill=col)
    f = font(F_MONO, 19)
    for j, t in enumerate((lab, verd)):
        tw, _ = measure(t, f)
        d5.text((x + cw / 2 - tw / 2, 470 + ch + 20 + j * 34), t, font=f, fill=fg)
headline(s5, 1120, ["Two of them changed her."], 44, None)
headline(s5, 1180, ["One changed the clothes."], 44, 0, LIME, INK)
stripe(s5, H - 92)

# 6 - how it works + price, flat lime
s6 = Image.new("RGB", (W, H), LIME)
d6 = ImageDraw.Draw(s6)
tag(d6, (46, 46), "VAA ALTERNATE", INK, LIME)
tag(d6, (W - 250, 46), "NAIROBI", INK, PAPER)
f = font(F_BLACK, 104)
d6.text((48, 190), "Three steps.", font=f, fill=INK)
d6.text((48, 292), "One minute.", font=f, fill=INK)
steps = [("01", "Add one photo of yourself, standing.", HOT, PAPER),
         ("02", "Screenshot any dress on Instagram.", VIOLET, PAPER),
         ("03", "Pay KES 25 on M-Pesa. See it on you.", INK, MUSTARD)]
y = 480
for n, text, c, fg in steps:
    tag(d6, (48, y), n, c, fg, size=22)
    fb = font(F_BOLD, 42)
    words, line, lines = text.split(), "", []
    for w in words:
        t = (line + " " + w).strip()
        if len(t) > 26:
            lines.append(line); line = w
        else:
            line = t
    lines.append(line)
    for i, l in enumerate(lines):
        d6.text((160, y + 4 + i * 50), l, font=fb, fill=INK)
    y += 60 + len(lines) * 50
d6.rectangle((48, 1080, W - 48, 1240), fill=INK)
d6.text((76, 1108), "2 for KES 50", font=font(F_BLACK, 62), fill=PAPER)
d6.text((76, 1190), "vaaalternate.lol", font=font(F_MONO, 26), fill=MUSTARD)
stripe(s6, H - 92, (MUSTARD, HOT, SKY, VIOLET, INK))

for i, im in enumerate([s1, sd, s2, s3, s4, s5, s6], 1):
    p = os.path.join(OUT, "slide-%d.jpg" % i)
    im.save(p, "JPEG", quality=94)
    print("wrote", p)
