"""Render the ALTERNATE motion ads as real 1080x1920 MP4s.

Each ad is a list of beats; a beat draws one frame at time t. Frames go through ffmpeg.
Assets come from the repo folder docs/campaign/assets.
"""
import math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = r"C:\Users\User\neggarman\alternate-style-hub\docs\campaign\assets"
OUT = os.path.join(HERE, "out")
W, H, FPS = 1080, 1920, 30

INK = (25, 23, 16); PAPER = (243, 241, 236); MUSTARD = (219, 174, 73)
NAVY = (34, 42, 65); BAD = (140, 47, 47)

F_BLACK = r"C:\Windows\Fonts\ariblk.ttf"
F_BOLD = r"C:\Windows\Fonts\arialbd.ttf"
F_MONO = r"C:\Windows\Fonts\consolab.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def ease(t):
    """Ease-out cubic, clamped."""
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def load(name, zoom=1.0, focus=0.32):
    """An asset cropped to the 9:16 frame, `focus` = which part of the height to keep centred."""
    im = Image.open(os.path.join(ASSETS, name)).convert("RGB")
    scale = max(W / im.width, H / im.height) * zoom
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    x = (im.width - W) // 2
    y = int((im.height - H) * focus)
    y = max(0, min(im.height - H, y))
    return im.crop((x, y, x + W, y + H))


def scrim(frame, top=0.34, bottom=0.55, strength=0.92):
    """Darken the top and bottom so type reads on any photo."""
    grad = Image.new("L", (1, H), 0)
    px = grad.load()
    for y in range(H):
        a = 0
        if y < H * top:
            a = max(a, int(200 * (1 - y / (H * top))))
        if y > H * (1 - bottom):
            k = (y - H * (1 - bottom)) / (H * bottom)
            a = max(a, int(255 * strength * (k ** 1.4)))
        px[0, y] = a
    mask = grad.resize((W, H))
    dark = Image.new("RGB", (W, H), (10, 9, 8))
    return Image.composite(dark, frame, mask)


def text(draw, xy, s, f, fill, spacing=10, anchor=None, alpha=255):
    if alpha >= 255:
        draw.multiline_text(xy, s, font=f, fill=fill, spacing=spacing, anchor=anchor)
    else:
        draw.multiline_text(xy, s, font=f, fill=fill + (alpha,), spacing=spacing, anchor=anchor)


def rise(draw, x, y, s, f, fill, t, start, dur=0.55, spacing=12):
    """A line that fades and slides up into place."""
    p = ease((t - start) / dur)
    if p <= 0:
        return
    off = int(46 * (1 - p))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(layer)
    d2.multiline_text((x, y + off), s, font=f, fill=fill + (int(255 * p),), spacing=spacing)
    draw._image.paste(layer, (0, 0), layer)


def brandbar(frame, right="KES 25 · M-PESA"):
    d = ImageDraw.Draw(frame)
    f = font(F_MONO, 30)
    d.text((64, 78), "ALTERNATE", font=f, fill=MUSTARD)
    d.text((W - 64, 78), right, font=f, fill=(200, 196, 186), anchor="ra")
    return frame


# ---------------------------------------------------------------- the ads
def ad_heels(t):
    """Her photo holds, the paid AI's version fades over it, the shoes get ringed and stamped."""
    her = ad_heels.her
    paid = ad_heels.paid
    feet = ad_heels.feet
    z = 1.0 + 0.03 * (t / 12.0)
    base = her if t < 3.6 else paid
    frame = base.resize((int(W * z), int(H * z)), Image.LANCZOS)
    frame = frame.crop(((frame.width - W) // 2, 0, (frame.width - W) // 2 + W, H))
    if 3.2 <= t < 3.6:  # crossfade
        p = (t - 3.2) / 0.4
        nxt = paid.resize((int(W * z), int(H * z)), Image.LANCZOS)
        nxt = nxt.crop(((nxt.width - W) // 2, 0, (nxt.width - W) // 2 + W, H))
        frame = Image.blend(frame, nxt, p)
    frame = scrim(frame)
    frame = brandbar(frame)
    d = ImageDraw.Draw(frame)

    if t < 3.4:
        rise(d, 64, 1180, "This is her photo.", font(F_BLACK, 96), PAPER, t, 0.5)
        rise(d, 64, 1320, "White sneakers.\nStanding straight.", font(F_BOLD, 52), (226, 222, 212), t, 1.1)
    else:
        rise(d, 64, 980, "We paid for\nthe good AI.", font(F_BLACK, 96), PAPER, t, 3.7, spacing=4)
        rise(d, 64, 1220, "Beautiful picture.", font(F_BOLD, 54), (226, 222, 212), t, 4.6)
        if 5.4 < t < 8.8:  # the ring sits on the shoes themselves
            pulse = 1 + 0.05 * math.sin((t - 5.4) * 5)
            rw, rh = int(460 * pulse), int(200 * pulse)
            cx, cy = 570, 1760
            d.ellipse((cx - rw // 2, cy - rh // 2, cx + rw // 2, cy + rh // 2), outline=MUSTARD, width=8)
        if 6.2 < t < 8.8:
            p = ease((t - 6.2) / 0.4)
            tag = Image.new("RGBA", (560, 96), BAD + (int(240 * p),))
            dt = ImageDraw.Draw(tag)
            dt.text((30, 26), "NOT HER SHOES", font=font(F_MONO, 42), fill=PAPER)
            tag = tag.rotate(-6, expand=True, resample=Image.BICUBIC)
            frame.paste(tag, (240, 1470), tag)
        if t > 8.9:  # the two feet side by side, so nobody has to take our word for it
            p = ease((t - 8.9) / 0.5)
            band_h = int(430 * p)
            band = Image.new("RGB", (W, band_h), (10, 9, 8))
            frame.paste(band, (0, H - band_h))
            if p > 0.55:
                for i, (img, lab, col) in enumerate(((ad_heels.feet_her, "HER PHOTO", PAPER),
                                                     (ad_heels.feet, "THE PAID AI", MUSTARD))):
                    box = img.resize((452, 246), Image.LANCZOS)
                    x = 52 + i * 524
                    frame.paste(box, (x, H - 300))
                    ImageDraw.Draw(frame).rectangle((x - 3, H - 303, x + 455, H - 51), outline=col, width=4)
                    ImageDraw.Draw(frame).text((x, H - 350), lab, font=font(F_MONO, 30), fill=col)
                ImageDraw.Draw(frame).text((52, H - 420), "Those heels are not hers.", font=font(F_BOLD, 52), fill=PAPER)
    return frame


def ad_ours(t):
    """Her photo wipes up into our result, then the price."""
    her, ours = ad_ours.her, ad_ours.ours
    frame = her.copy()
    if t > 2.4:
        p = ease((t - 2.4) / 1.0)
        cut = int(H * p)
        frame.paste(ours.crop((0, H - cut, W, H)), (0, H - cut))
    frame = scrim(frame)
    frame = brandbar(frame)
    d = ImageDraw.Draw(frame)
    if t < 2.6:
        rise(d, 64, 1240, "Her photo.", font(F_BLACK, 104), PAPER, t, 0.4)
        rise(d, 64, 1400, "Her shoes. Her stand.", font(F_BOLD, 52), (226, 222, 212), t, 1.0)
    else:
        rise(d, 64, 1120, "Same me.\nSame shoes.\nJust the dress.", font(F_BLACK, 92), PAPER, t, 3.4, spacing=6)
        rise(d, 64, 1500, "ALTERNATE changes the clothes\nand nothing else.", font(F_BOLD, 48), (226, 222, 212), t, 5.0)
        if t > 7.0:
            rise(d, 64, 1700, "KES 25 on M-Pesa. 2 for KES 50.", font(F_MONO, 40), MUSTARD, t, 7.0)
    return frame


def render(name, fn, seconds, assets):
    for k, v in assets.items():
        setattr(fn, k, v)
    folder = os.path.join(OUT, name)
    os.makedirs(folder, exist_ok=True)
    n = int(seconds * FPS)
    for i in range(n):
        fn(i / FPS).save(os.path.join(folder, "f%04d.jpg" % i), "JPEG", quality=92)
    mp4 = os.path.join(OUT, name + ".mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(folder, "f%04d.jpg"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
                    "-movflags", "+faststart", mp4], check=True)
    for f in os.listdir(folder):
        os.remove(os.path.join(folder, f))
    os.rmdir(folder)
    print("wrote", mp4, os.path.getsize(mp4), "bytes")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    her = load("01-her-photo.jpg", focus=0.10)
    paid = load("04-paid-chatgpt.jpg", focus=0.10)
    ours = load("05-alternate.jpg", focus=0.14)
    feet = Image.open(os.path.join(ASSETS, "07-feet-paid-chatgpt.jpg")).convert("RGB")
    feet_her = Image.open(os.path.join(ASSETS, "06-feet-her.jpg")).convert("RGB")
    which = sys.argv[1] if len(sys.argv) > 1 else "heels"
    if which == "heels":
        render("02-not-her-shoes", ad_heels, 12.0, {"her": her, "paid": paid, "feet": feet, "feet_her": feet_her})
    else:
        render("03-just-the-dress", ad_ours, 9.5, {"her": her, "ours": ours})
