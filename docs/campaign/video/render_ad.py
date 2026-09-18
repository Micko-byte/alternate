"""ALTERNATE — one vertical ad, cut on a beat.

Renders 1080x1920 frames with Pillow, synthesises a 128 BPM bed with numpy, muxes with ffmpeg.
Every picture is real: her photo, the piece, a free AI's try, a paid AI's try, and ours.
"""
import math, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = r"C:\Users\User\neggarman\alternate-style-hub\docs\campaign\assets"
OUT = os.path.join(HERE, "out")
W, H, FPS = 1080, 1920, 30
BPM = 128.0
BEAT = 60.0 / BPM              # 0.469s — every cut lands on one

PAPER = (243, 241, 236); INK = (16, 15, 13); MUSTARD = (232, 184, 74)
HOT = (214, 64, 52); NAVY = (34, 42, 65); GREY = (196, 192, 183)

F_BLACK = r"C:\Windows\Fonts\ariblk.ttf"
F_BOLD = r"C:\Windows\Fonts\arialbd.ttf"
F_MONO = r"C:\Windows\Fonts\consolab.ttf"
fcache = {}


def font(path, size):
    key = (path, size)
    if key not in fcache:
        fcache[key] = ImageFont.truetype(path, size)
    return fcache[key]


# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def out_cubic(p):
    return 1 - (1 - clamp(p)) ** 3


def out_back(p):
    p = clamp(p)
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2


# ---------------------------------------------------------------- pictures
def grade(im, sat=1.14, con=1.1, bright=1.02):
    im = ImageEnhance.Color(im).enhance(sat)
    im = ImageEnhance.Contrast(im).enhance(con)
    return ImageEnhance.Brightness(im).enhance(bright)


def fit(name, focus=0.10, sat=1.14):
    im = Image.open(os.path.join(ASSETS, name)).convert("RGB")
    s = max(W / im.width, H / im.height)
    im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2
    y = max(0, min(im.height - H, int((im.height - H) * focus)))
    return grade(im.crop((x, y, x + W, y + H)), sat=sat)


def punch(im, t_in, zoom_from=1.10, zoom_to=1.0, dur=0.8):
    """A scale-down settle on every cut, so each shot lands instead of sitting there."""
    z = zoom_from + (zoom_to - zoom_from) * out_cubic(t_in / dur)
    z = max(z, 1.0)
    w, h = int(W * z), int(H * z)
    big = im.resize((w, h), Image.LANCZOS)
    return big.crop(((w - W) // 2, (h - H) // 2, (w - W) // 2 + W, (h - H) // 2 + H))


def drift(im, t_in, total, amount=0.05):
    """Slow push in across a whole shot."""
    z = 1.0 + amount * clamp(t_in / max(total, 0.01))
    w, h = int(W * z), int(H * z)
    big = im.resize((w, h), Image.LANCZOS)
    return big.crop(((w - W) // 2, (h - H) // 2, (w - W) // 2 + W, (h - H) // 2 + H))


_SCRIMS = {}


def scrim(frame, top=0.30, bottom=0.52, strength=0.94):
    key = (top, bottom, strength)
    if key in _SCRIMS:
        return Image.composite(Image.new("RGB", (W, H), (8, 8, 7)), frame, _SCRIMS[key])
    grad = Image.new("L", (1, H), 0)
    px = grad.load()
    for y in range(H):
        a = 0
        if y < H * top:
            a = max(a, int(190 * (1 - y / (H * top))))
        if y > H * (1 - bottom):
            k = (y - H * (1 - bottom)) / (H * bottom)
            a = max(a, int(255 * strength * (k ** 1.5)))
        px[0, y] = a
    _SCRIMS[key] = grad.resize((W, H))
    return Image.composite(Image.new("RGB", (W, H), (8, 8, 7)), frame, _SCRIMS[key])


# ---------------------------------------------------------------- type
def measure(s, f):
    box = f.getbbox(s)
    return box[2] - box[0], box[3] - box[1]


def kinetic(frame, x, y, words, f, t_in, start=0.0, step=0.10, fill=PAPER, hi=None, hi_bg=MUSTARD,
            hi_fg=INK, line_gap=14, max_w=None):
    """Words pop in one by one and wrap inside the frame; a named word gets a solid block behind it."""
    max_w = max_w or (W - x - 56)
    space = measure(" ", f)[0]
    lh = int(f.size * 1.06) + line_gap

    lines, cur, cur_w = [], [], 0          # lay the words out first, then draw
    for word in words:
        wpx = measure(word, f)[0]
        if cur and cur_w + space + wpx > max_w:
            lines.append(cur); cur, cur_w = [], 0
        cur.append((word, wpx))
        cur_w += wpx + (space if len(cur) > 1 else 0)
    if cur:
        lines.append(cur)

    i = 0
    for row, line in enumerate(lines):
        cx = x
        cy = y + row * lh
        for word, wpx in line:
            p = out_back((t_in - start - i * step) / 0.34)
            i += 1
            if p <= 0:
                cx += wpx + space
                continue
            p = clamp(p, 0, 1.12)
            is_hi = hi is not None and word.strip(".,!?”").upper() == hi.strip(".,!?").upper()
            pad = 14
            layer = Image.new("RGBA", (wpx + pad * 2, lh + 26), (0, 0, 0, 0))
            dl = ImageDraw.Draw(layer)
            if is_hi:
                dl.rectangle((0, 4, wpx + pad * 2 - 2, f.size + 24), fill=hi_bg + (255,))
                dl.text((pad, 6), word, font=f, fill=hi_fg + (255,))
            else:
                dl.text((pad, 6), word, font=f, fill=fill + (int(255 * clamp(p)),))
            sc = 0.88 + 0.12 * p
            layer = layer.resize((max(1, int(layer.width * sc)), max(1, int(layer.height * sc))), Image.BICUBIC)
            frame.paste(layer, (int(cx - pad), int(cy - 6)), layer)
            cx += wpx + space
    return frame


def label(frame, xy, s, col=MUSTARD, fg=INK, size=34, pad=(18, 12)):
    f = font(F_MONO, size)
    w, h = measure(s, f)
    d = ImageDraw.Draw(frame)
    d.rectangle((xy[0], xy[1], xy[0] + w + pad[0] * 2, xy[1] + h + pad[1] * 2 + 6), fill=col)
    d.text((xy[0] + pad[0], xy[1] + pad[1]), s, font=f, fill=fg)
    return frame


def chrome(frame, t, total):
    """Brand line and a thin progress rule — the bits that make it read as an ad, not a clip."""
    d = ImageDraw.Draw(frame)
    d.text((60, 74), "ALTERNATE", font=font(F_MONO, 32), fill=PAPER)
    d.text((W - 60, 74), "NAIROBI", font=font(F_MONO, 32), fill=GREY, anchor="ra")
    d.rectangle((0, 0, int(W * clamp(t / total)), 7), fill=MUSTARD)
    return frame


def flash(frame, t_in, dur=0.12, col=(255, 255, 255)):
    if t_in > dur:
        return frame
    a = int(190 * (1 - t_in / dur))
    veil = Image.new("RGB", (W, H), col)
    return Image.blend(frame, veil, a / 255)


def ring(frame, cx, cy, rw, rh, t, col=MUSTARD, width=9):
    pulse = 1 + 0.045 * math.sin(t * 7)
    rw, rh = int(rw * pulse), int(rh * pulse)
    ImageDraw.Draw(frame).ellipse((cx - rw // 2, cy - rh // 2, cx + rw // 2, cy + rh // 2), outline=col, width=width)
    return frame


def stamp(frame, xy, s, t_in, col=HOT, size=44, rot=-7):
    p = out_back(t_in / 0.32)
    if p <= 0:
        return frame
    f = font(F_MONO, size)
    w, h = measure(s, f)
    tag = Image.new("RGBA", (w + 60, h + 44), col + (245,))
    ImageDraw.Draw(tag).text((30, 14), s, font=f, fill=PAPER + (255,))
    sc = 0.8 + 0.2 * clamp(p, 0, 1.1)
    tag = tag.resize((int(tag.width * sc), int(tag.height * sc)), Image.BICUBIC).rotate(rot, expand=True, resample=Image.BICUBIC)
    frame.paste(tag, xy, tag)
    return frame


def split(a, b, p, label_a="", label_b=""):
    """Two shots meeting at a sweeping divider."""
    cut = int(W * clamp(p))
    frame = a.copy()
    frame.paste(b.crop((cut, 0, W, H)), (cut, 0))
    d = ImageDraw.Draw(frame)
    d.rectangle((cut - 4, 0, cut + 4, H), fill=PAPER)
    if label_a:
        label(frame, (40, 1150), label_a, col=PAPER, fg=INK, size=30)
    if label_b:
        label(frame, (cut + 30, 1150), label_b, col=MUSTARD, fg=INK, size=30)
    return frame


# ---------------------------------------------------------------- the cut
SHOTS = []          # (start, end) filled as the storyboard is built
def at(t, a, b):
    return a <= t < b


def build_frame(t, A):
    beat = BEAT
    # ---- 1. hook: her photo
    if t < 3 * beat * 2:                                   # 0.00 - 2.81
        t0 = 0.0
        f = drift(A["her"], t - t0, 2.81)
        f = punch(f, t - t0, 1.12, 1.0, 0.7)
        f = scrim(f)
        f = kinetic(f, 60, 1180, "I saw this dress on Instagram.".split(), font(F_BLACK, 86), t - t0, 0.25, 0.085, hi="Instagram.")
        f = kinetic(f, 60, 1480, "I wanted it on ME first.".split(), font(F_BOLD, 56), t - t0, 1.3, 0.07, fill=GREY, hi="ME")
    # ---- 2. the piece
    elif t < 3 * beat * 3:                                 # 2.81 - 4.22
        t0 = 3 * beat * 2
        f = punch(A["dress"], t - t0, 1.14, 1.02, 0.5)
        f = scrim(f, top=0.22, bottom=0.46)
        f = kinetic(f, 60, 1320, "The post said MINI.".split(), font(F_BLACK, 92), t - t0, 0.1, 0.08, hi="MINI.")
        f = flash(f, t - t0)
    # ---- 3. free AI
    elif t < 3 * beat * 3 + 6 * beat:                      # 4.22 - 7.03
        t0 = 3 * beat * 3
        f = drift(A["free"], t - t0, 2.81, 0.06)
        f = punch(f, t - t0, 1.15, 1.0, 0.45)
        f = scrim(f)
        f = label(f, (60, 980), "FREE AI", col=PAPER, fg=INK)
        f = kinetic(f, 60, 1100, "It gave me a MIDI.".split(), font(F_BLACK, 88), t - t0, 0.15, 0.08, hi="MIDI.")
        if t - t0 > 1.0:
            f = ring(f, 560, 1430, 620, 330, t)
            f = stamp(f, (120, 1560), "WRONG LENGTH", t - t0 - 1.2)
        f = flash(f, t - t0)
    # ---- 4. paid AI
    elif t < 3 * beat * 3 + 12 * beat:                     # 7.03 - 9.84
        t0 = 3 * beat * 3 + 6 * beat
        f = drift(A["paid"], t - t0, 2.81, 0.06)
        f = punch(f, t - t0, 1.15, 1.0, 0.45)
        f = scrim(f)
        f = label(f, (60, 980), "PAID AI", col=PAPER, fg=INK)
        f = kinetic(f, 60, 1100, "Nice. But those are\n not my SHOES.".split(" "), font(F_BLACK, 84), t - t0, 0.15, 0.075, hi="SHOES.")
        if t - t0 > 1.1:
            f = ring(f, 570, 1770, 470, 210, t)
            f = stamp(f, (150, 1500), "NOT HER SHOES", t - t0 - 1.3)
        f = flash(f, t - t0)
    # ---- 5. the three crops, one per beat
    elif t < 3 * beat * 3 + 12 * beat + 6 * beat:          # 9.84 - 12.66
        t0 = 3 * beat * 3 + 12 * beat
        k = int((t - t0) / (2 * beat))
        shot = [A["crop_len"], A["crop_feet"], A["crop_waist"]][min(k, 2)]
        word = ["LENGTH", "SHOES", "SHAPE"][min(k, 2)]
        f = punch(shot, (t - t0) % (2 * beat), 1.16, 1.0, 0.4)
        f = scrim(f, top=0.2, bottom=0.44)
        f = stamp(f, (90, 1320), "CHANGED: " + word, (t - t0) % (2 * beat), col=HOT, size=52, rot=-5)
        f = flash(f, (t - t0) % (2 * beat), 0.1)
    # ---- 6. ours
    elif t < 3 * beat * 3 + 12 * beat + 6 * beat + 8 * beat:   # 12.66 - 16.41
        t0 = 3 * beat * 3 + 12 * beat + 6 * beat
        base = A["paid"]
        p = out_cubic((t - t0) / 0.5)
        cut = int(H * p)
        f = base.copy()
        f.paste(A["ours"].crop((0, H - cut, W, H)), (0, H - cut))
        f = drift(f, t - t0, 3.75, 0.05)
        f = scrim(f)
        f = label(f, (60, 940), "ALTERNATE", col=MUSTARD, fg=INK)
        f = kinetic(f, 60, 1060, "Same me.\n Same shoes.\n Just the DRESS.".split(" "), font(F_BLACK, 88), t - t0, 0.5, 0.075, hi="DRESS.")
        if t - t0 > 2.2:
            f = kinetic(f, 60, 1560, "Your face. Your body. Your shoes.".split(), font(F_BOLD, 48), t - t0, 2.2, 0.05, fill=GREY)
        f = flash(f, t - t0)
    # ---- 7. split screen
    elif t < 3 * beat * 3 + 12 * beat + 6 * beat + 14 * beat:  # 16.41 - 19.22
        t0 = 3 * beat * 3 + 12 * beat + 6 * beat + 8 * beat
        p = out_cubic((t - t0) / 1.1) * 0.5
        f = split(A["paid"], A["ours"], p, "PAID AI", "ALTERNATE")
        f = scrim(f, top=0.24, bottom=0.42)
        f = kinetic(f, 60, 1380, "One of these is still HER.".split(), font(F_BLACK, 76), t - t0, 0.6, 0.07, hi="HER.")
    # ---- 8. end card
    else:                                                   # 19.22 - 23.4
        t0 = 3 * beat * 3 + 12 * beat + 6 * beat + 14 * beat
        ti = t - t0
        f = Image.new("RGB", (W, H), INK)
        d = ImageDraw.Draw(f)
        sweep = int(W * out_cubic(ti / 0.5))
        d.rectangle((0, 0, sweep, H), fill=INK)
        thumb = A["ours"].resize((int(W * 0.72), int(H * 0.72)), Image.LANCZOS)
        tp = out_back(ti / 0.6)
        if tp > 0:
            box = thumb.crop((0, 120, thumb.width, 120 + 720))
            f.paste(box, (int(W / 2 - box.width / 2), int(300 - 80 * (1 - clamp(tp)))))
        f = kinetic(f, 60, 1130, "Try it on\n YOUR photo.".split(" "), font(F_BLACK, 96), ti, 0.35, 0.08, hi="YOUR")
        if ti > 1.1:
            f = kinetic(f, 60, 1450, "KES 25 a try-on. 2 for KES 50.".split(), font(F_BOLD, 52), ti, 1.1, 0.05, fill=MUSTARD)
        if ti > 1.8:
            f = kinetic(f, 60, 1560, "Pay with M-Pesa. Ready in a minute.".split(), font(F_BOLD, 44), ti, 1.8, 0.04, fill=GREY)
        if ti > 2.4:
            f = label(f, (60, 1700), "alternate-two.vercel.app", col=PAPER, fg=INK, size=40)
        f = flash(f, ti, 0.14)
    return f


def audio(path, seconds):
    """A dry 128 BPM bed: kick, hat, clap, sub. Swap it for a trending sound before posting."""
    sr = 44100
    n = int(sr * seconds)
    out = np.zeros(n)
    beat_n = int(sr * BEAT)

    def place(buf, at_s, sig):
        i = int(at_s * sr)
        j = min(n, i + len(sig))
        if i < n:
            buf[i:j] += sig[:j - i]

    tt = np.arange(int(sr * 0.22)) / sr
    kick = np.sin(2 * np.pi * (48 + 90 * np.exp(-tt * 34)) * tt) * np.exp(-tt * 13) * 0.9
    th = np.arange(int(sr * 0.05)) / sr
    hat = (np.random.default_rng(7).standard_normal(len(th)) * np.exp(-th * 140)) * 0.16
    tc = np.arange(int(sr * 0.18)) / sr
    clap = (np.random.default_rng(3).standard_normal(len(tc)) * np.exp(-tc * 26)) * 0.34
    tb = np.arange(int(sr * BEAT * 2)) / sr
    for b in range(int(seconds / BEAT) + 1):
        s = b * BEAT
        place(out, s, kick)
        place(out, s + BEAT / 2, hat * 0.7)
        place(out, s, hat)
        if b % 4 in (1, 3):
            place(out, s, clap)
        if b % 2 == 0:
            note = [55.0, 55.0, 73.42, 65.41][(b // 2) % 4]
            sub = np.sin(2 * np.pi * note * tb) * np.exp(-tb * 1.6) * 0.30
            place(out, s, sub)
    out = np.tanh(out * 1.25) * 0.72
    fade = int(sr * 0.6)
    out[-fade:] *= np.linspace(1, 0, fade)
    pcm = (out * 32767).astype(np.int16)
    import wave
    with wave.open(path, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def main():
    os.makedirs(OUT, exist_ok=True)
    her = fit("01-her-photo.jpg", 0.10)
    A = {
        "her": her,
        "dress": fit("02-the-dress.jpg", 0.45, sat=1.2),
        "free": fit("03-free-ai-gemini.jpg", 0.10),
        "paid": fit("04-paid-chatgpt.jpg", 0.10),
        "ours": fit("05-alternate.jpg", 0.14),
    }
    A["crop_len"] = grade(Image.open(os.path.join(ASSETS, "03-free-ai-gemini.jpg")).convert("RGB")
                          .resize((W, int(W * 1195 / 896)), Image.LANCZOS).crop((0, 700, W, 700 + H)) if False else A["free"])
    # three tight crops, cut from the pictures themselves
    def crop_of(img, box):
        c = img.crop(box)
        return c.resize((W, H), Image.LANCZOS)
    A["crop_len"] = crop_of(A["free"], (180, 900, 900, 2180 - 900 + 900))
    A["crop_feet"] = crop_of(A["paid"], (240, 1480, 840, 1920))
    A["crop_waist"] = crop_of(A["paid"], (260, 700, 820, 1300))

    total = 3 * BEAT * 3 + 12 * BEAT + 6 * BEAT + 14 * BEAT + 9 * BEAT
    folder = os.path.join(OUT, "frames")
    os.makedirs(folder, exist_ok=True)
    n = int(total * FPS)
    for i in range(n):
        t = i / FPS
        f = build_frame(t, A)
        f = chrome(f, t, total)
        f.save(os.path.join(folder, "f%04d.jpg" % i), "JPEG", quality=93)
    wav = os.path.join(OUT, "bed.wav")
    audio(wav, total)
    mp4 = os.path.join(OUT, "ALTERNATE-ad-vertical.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(folder, "f%04d.jpg"),
                    "-i", wav, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "19",
                    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", mp4], check=True)
    for f in os.listdir(folder):
        os.remove(os.path.join(folder, f))
    os.rmdir(folder)
    print("wrote", mp4, os.path.getsize(mp4), "bytes;", round(total, 2), "s")


if __name__ == "__main__":
    main()
