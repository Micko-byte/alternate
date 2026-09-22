"""VAA ALTERNATE — the 3D ad for TikTok.

The story the photos already tell, then the payoff: the finished try-on as a model you can spin.
Spin frames come from spin/ (extracted from the Meshy turntable). 1080x1920, cut on a 94 BPM grid.
"""
import glob
import os
import subprocess

from PIL import Image, ImageDraw

import render_ad as R                      # helpers: fit, scrim, punch, drift, kinetic, label, stamp, flash, audio

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
SPIN = sorted(glob.glob(os.path.join(HERE, "spin", "*.jpg")))
W, H, FPS, BEAT = R.W, R.H, R.FPS, R.BEAT
PAPER, INK, MUSTARD, HOT, GREY = R.PAPER, R.INK, R.MUSTARD, R.HOT, R.GREY
LIME = (200, 240, 45)


def spin_frame(i):
    """One frame of the turntable, centred on a dark ground, looping."""
    src = Image.open(SPIN[i % len(SPIN)]).convert("RGB")
    frame = Image.new("RGB", (W, H), (14, 14, 16))
    frame.paste(src, (0, (H - src.height) // 2 - 60))
    return frame


# ---------------------------------------------------------------- the cut
B = BEAT
T = {}
T["her"] = (0.0, 4 * B)                      # 0.00 - 2.55
T["dress"] = (T["her"][1], T["her"][1] + 4 * B)
T["free"] = (T["dress"][1], T["dress"][1] + 5 * B)
T["paid"] = (T["free"][1], T["free"][1] + 5 * B)
T["ours"] = (T["paid"][1], T["paid"][1] + 5 * B)
T["spin"] = (T["ours"][1], T["ours"][1] + 17 * B)   # the payoff gets the room
T["end"] = (T["spin"][1], T["spin"][1] + 7 * B)
TOTAL = T["end"][1]


def build(t, A):
    def seg(name):
        a, b = T[name]
        return a <= t < b, t - T[name][0]

    on, ti = seg("her")
    if on:
        f = R.punch(R.drift(A["her"], ti, 2.6), ti, 1.12, 1.0, 0.9)
        f = R.scrim(f)
        f = R.kinetic(f, 60, 1180, "I saw this dress on Instagram.".split(), R.font(R.F_BLACK, 86), ti, 0.2, 0.125, hi="Instagram.")
        f = R.kinetic(f, 60, 1520, "I wanted it on ME first.".split(), R.font(R.F_BOLD, 54), ti, 1.4, 0.1, fill=GREY, hi="ME")
        return f

    on, ti = seg("dress")
    if on:
        f = R.punch(A["dress"], ti, 1.12, 1.02, 0.8)
        f = R.scrim(f, top=0.22, bottom=0.46)
        f = R.kinetic(f, 60, 1320, "The post said MINI.".split(), R.font(R.F_BLACK, 92), ti, 0.15, 0.115, hi="MINI.")
        return R.flash(f, ti)

    on, ti = seg("free")
    if on:
        f = R.punch(R.drift(A["free"], ti, 3.2, 0.06), ti, 1.12, 1.0, 0.75)
        f = R.scrim(f)
        f = R.label(f, (60, 980), "FREE AI", col=PAPER, fg=INK)
        f = R.kinetic(f, 60, 1100, "It gave me a MIDI.".split(), R.font(R.F_BLACK, 88), ti, 0.15, 0.115, hi="MIDI.")
        if ti > 1.5:
            f = R.ring(f, 560, 1430, 620, 330, t)
            f = R.stamp(f, (120, 1560), "WRONG LENGTH", ti - 1.8)
        return R.flash(f, ti)

    on, ti = seg("paid")
    if on:
        f = R.punch(R.drift(A["paid"], ti, 3.2, 0.06), ti, 1.12, 1.0, 0.75)
        f = R.scrim(f)
        f = R.label(f, (60, 980), "PAID AI", col=PAPER, fg=INK)
        f = R.kinetic(f, 60, 1100, "Nice. But those are not my SHOES.".split(), R.font(R.F_BLACK, 84), ti, 0.15, 0.11, hi="SHOES.")
        if ti > 1.6:
            f = R.ring(f, 570, 1760, 460, 200, t)
            f = R.stamp(f, (150, 1500), "NOT HER SHOES", ti - 1.9)
        return R.flash(f, ti)

    on, ti = seg("ours")
    if on:
        p = R.out_cubic(ti / 0.7)
        cut = int(H * p)
        f = A["paid"].copy()
        f.paste(A["ours"].crop((0, H - cut, W, H)), (0, H - cut))
        f = R.drift(f, ti, 3.2, 0.05)
        f = R.scrim(f)
        f = R.label(f, (60, 940), "VAA ALTERNATE", col=MUSTARD, fg=INK)
        f = R.kinetic(f, 60, 1060, "Same me. Same shoes. Just the DRESS.".split(), R.font(R.F_BLACK, 88), ti, 0.6, 0.11, hi="DRESS.")
        return R.flash(f, ti)

    on, ti = seg("spin")
    if on:
        f = spin_frame(int(ti * FPS))
        d = ImageDraw.Draw(f)
        # a ground line so the model reads as standing in the frame, not floating in a screenshot
        d.rectangle((0, H - 470, W, H - 466), fill=(38, 38, 42))
        if ti < 0.5:
            f = R.flash(f, ti, 0.35)
        f = R.label(f, (60, 150), "NEW", col=LIME, fg=INK, size=38)
        f = R.kinetic(f, 60, 250, "Now turn yourself around.".split(), R.font(R.F_BLACK, 82), ti, 0.35, 0.12, hi="around.")
        if ti > 2.2:
            f = R.kinetic(f, 60, 1560, "Front. Side. Back.".split(), R.font(R.F_BOLD, 58), ti, 2.2, 0.16, fill=PAPER)
        if ti > 4.0:
            f = R.kinetic(f, 60, 1660, "Your body. Your dress. Every angle.".split(), R.font(R.F_BOLD, 46), ti, 4.0, 0.08, fill=GREY)
        if ti > 7.0:
            f = R.stamp(f, (120, 1760), "WOULD YOU USE THIS?", ti - 7.0, col=LIME, size=40, rot=-4)
        return f

    ti = t - T["end"][0]
    f = Image.new("RGB", (W, H), INK)
    thumb = spin_frame(int((T["spin"][1] - T["spin"][0]) * FPS) - 1).crop((0, 300, W, 1500)).resize((int(W * 0.66), int(1200 * 0.66)))
    tp = R.out_back(ti / 0.7)
    if tp > 0:
        f.paste(thumb, (int(W / 2 - thumb.width / 2), int(230 - 70 * (1 - min(1, tp)))))
    f = R.kinetic(f, 60, 1180, "Try it on YOUR photo.".split(), R.font(R.F_BLACK, 96), ti, 0.35, 0.115, hi="YOUR")
    if ti > 1.6:
        f = R.kinetic(f, 60, 1470, "KES 25 a try-on. 2 for KES 50.".split(), R.font(R.F_BOLD, 52), ti, 1.6, 0.075, fill=MUSTARD)
    if ti > 2.5:
        f = R.kinetic(f, 60, 1580, "Pay with M-Pesa. Ready in a minute.".split(), R.font(R.F_BOLD, 44), ti, 2.5, 0.06, fill=GREY)
    if ti > 3.2:
        f = R.label(f, (60, 1720), "vaaalternate.lol", col=PAPER, fg=INK, size=40)
    return R.flash(f, ti, 0.14)


def main():
    if not SPIN:
        raise SystemExit("no spin frames: extract them from the turntable first")
    A = {
        "her": R.fit("01-her-photo.jpg", 0.10),
        "dress": R.fit("02-the-dress.jpg", 0.45, sat=1.2),
        "free": R.fit("03-free-ai-gemini.jpg", 0.10),
        "paid": R.fit("04-paid-chatgpt.jpg", 0.10),
        "ours": R.fit("05-alternate.jpg", 0.14),
    }
    os.makedirs(OUT, exist_ok=True)
    folder = os.path.join(OUT, "frames3d-%d" % os.getpid())
    os.makedirs(folder, exist_ok=True)
    n = int(TOTAL * FPS)
    for i in range(n):
        t = i / FPS
        frame = R.chrome(build(t, A), t, TOTAL)
        frame.save(os.path.join(folder, "f%04d.jpg" % i), "JPEG", quality=93)
    made = len([f for f in os.listdir(folder) if f.endswith(".jpg")])
    if made != n:
        raise SystemExit("only %d of %d frames" % (made, n))
    wav = os.path.join(OUT, "bed3d.wav")
    R.audio(wav, TOTAL)
    mp4 = os.path.join(OUT, "vaa-3d-ad.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(folder, "f%04d.jpg"),
                    "-i", wav, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "19",
                    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", mp4], check=True)
    for f in os.listdir(folder):
        os.remove(os.path.join(folder, f))
    os.rmdir(folder)
    print("wrote", mp4, os.path.getsize(mp4), "bytes;", round(TOTAL, 1), "s")


if __name__ == "__main__":
    main()
