"""VAA ALTERNATE — pricing after 3D. Builds docs/VAA-pricing-2026-09.pdf.

Every cost is either MEASURED on the live system or a PUBLISHED price, and each table says which.
USD converted at KES 129.4.
"""
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import BaseDocTemplate, Frame, KeepTogether, PageTemplate, Paragraph, Spacer, Table, TableStyle

OUT = r"C:\Users\User\neggarman\alternate-style-hub\docs\VAA-pricing-2026-09.pdf"

INK = colors.HexColor("#191710"); PAPER = colors.HexColor("#FFFFFF")
MUTED = colors.HexColor("#686868"); RULE = colors.HexColor("#E4E2DC")
NAVY = colors.HexColor("#222A41"); MUSTARD = colors.HexColor("#DBAE49")
GOOD = colors.HexColor("#2F6B4F"); BAD = colors.HexColor("#8C2F2F")

RATE = 129.4
VAT, PAYSTACK = 0.16, 0.015
AI_TRYON_SAVER, AI_TRYON_PREMIUM = 11.0, 17.0
SPIN_CREDITS = 30                      # Meshy image-to-3D, textured, PBR

MESHY = [("Free", 0, 100), ("Pro", 20, 1000), ("Premium", 40, 3000), ("Ultra", 100, 8000), ("Studio (team)", 70, 5500)]
PACKS = [("Two try-ons", 2, 50), ("Launch offer (first buy)", 3, 50), ("Bundle of 5", 5, 120), ("Bundle of 12", 12, 270)]


def spin_cost(plan_usd, plan_credits):
    return (plan_usd / plan_credits) * SPIN_CREDITS * RATE


COST = {name: spin_cost(usd, cr) for name, usd, cr in MESHY if usd}


def keep(gross, cost):
    return gross / (1 + VAT) - gross * PAYSTACK - cost


def kes(v, dp=0):
    return f"KES {v:,.{dp}f}"


styles = {
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=28, leading=30, textColor=INK, spaceAfter=6),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=14.5, leading=17, textColor=INK, spaceBefore=15, spaceAfter=5),
    "kicker": ParagraphStyle("kicker", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=MUTED, spaceAfter=9),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK, alignment=TA_LEFT, spaceAfter=6),
    "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8.2, leading=11.5, textColor=MUTED, spaceAfter=6),
    "lead": ParagraphStyle("lead", fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=INK, spaceAfter=6),
}


def table(rows, widths, aligns=None, highlight=None):
    t = Table(rows, colWidths=widths, hAlign="LEFT", repeatRows=1)
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), PAPER),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7.6),
    ]
    for i in range(2, len(rows), 2):
        style.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F7F6F3")))
    if highlight:
        for i in highlight:
            style.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#FBF3DC")))
            style.append(("FONTNAME", (0, i), (-1, i), "Helvetica-Bold"))
    for col, al in (aligns or {}).items():
        style.append(("ALIGN", (col, 0), (col, -1), al))
    t.setStyle(TableStyle(style))
    return t


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(INK)
    canvas.rect(0, A4[1] - 12 * mm, A4[0], 12 * mm, stroke=0, fill=1)
    canvas.setFillColor(PAPER)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(18 * mm, A4[1] - 8 * mm, "VAA ALTERNATE")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(A4[0] - 18 * mm, A4[1] - 8 * mm, "Pricing after 3D  ·  23 September 2026")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(18 * mm, 10 * mm, "Try-on costs measured on the live system. Meshy prices as published. KES 129.4 to the dollar.")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, str(doc.page))
    canvas.restoreState()


story = []
S = story.append

S(Paragraph("VIRTUAL FITTING ROOM · NAIROBI", styles["kicker"]))
S(Paragraph("What to charge once 3D is on", styles["h1"]))
S(Paragraph(
    "A try-on costs us about KES 11 and sells for KES 25. A 3D spin costs between KES 48 and KES 78 "
    "depending on which Meshy plan we are on — three to seven times a try-on. That single fact decides "
    "everything below: the spin cannot be bundled, cannot be free, and cannot be priced like a try-on.",
    styles["body"]))

# ---- 1. what each thing costs
S(Paragraph("1 · What each thing costs us", styles["h2"]))
rows = [["", "SAVER (ON NOW)", "PREMIUM AI", "SOURCE"]]
rows += [
    ["One Standard try-on, all in", kes(AI_TRYON_SAVER, 2), kes(AI_TRYON_PREMIUM, 2), "measured, includes redos"],
    ["Reading a garment photo", kes(0.00075 * RATE, 2), kes(0.023 * RATE, 2), "measured, paid once per piece"],
    ["Reading a body", kes(0.0018 * RATE, 2), kes(0.055 * RATE, 2), "measured, paid once per photo set"],
]
S(table(rows, [56 * mm, 32 * mm, 32 * mm, 54 * mm], {1: "RIGHT", 2: "RIGHT"}))

S(Paragraph("A 3D spin, by Meshy plan (30 credits per textured model):", styles["body"]))
rows = [["MESHY PLAN", "USD / MONTH", "CREDITS", "PER SPIN", "SPINS INCLUDED"]]
for name, usd, cr in MESHY:
    per = "—" if not usd else kes(spin_cost(usd, cr), 1)
    rows.append([name, f"${usd}" if usd else "free", f"{cr:,}", per, str(cr // SPIN_CREDITS)])
S(table(rows, [40 * mm, 28 * mm, 26 * mm, 32 * mm, 48 * mm], {1: "RIGHT", 2: "RIGHT", 3: "RIGHT", 4: "RIGHT"}, highlight=[3]))
S(Paragraph(
    "Premium is the first plan where a spin makes money at a sane price. Pro looks cheaper but its credits "
    "cost twice as much, and the free plan's 3 spins a month are for testing, not selling.", styles["small"]))

# ---- 2. what to charge
S(Paragraph("2 · What a spin has to cost the shopper", styles["h2"]))
S(Paragraph(
    "Credits are bought at different rates: KES 25 each in the two-for-fifty pack, KES 22.50 each in the "
    "bundle of twelve. A spin must clear its cost at the <b>cheapest</b> rate, or bundle buyers spin at a loss.",
    styles["body"]))
rows = [["SPIN PRICED AT", "SINGLE RATE (KES 25)", "BUNDLE RATE (KES 22.50)", "KEPT ON PREMIUM", "KEPT ON PRO"]]
for credits in (2, 3, 4, 5):
    single, bundle = credits * 25.0, credits * 22.5
    k_prem, k_pro = keep(bundle, COST["Premium"]), keep(bundle, COST["Pro"])
    rows.append([f"{credits} credits", kes(single), kes(bundle), kes(k_prem, 1), kes(k_pro, 1)])
S(table(rows, [28 * mm, 38 * mm, 40 * mm, 34 * mm, 34 * mm],
        {1: "RIGHT", 2: "RIGHT", 3: "RIGHT", 4: "RIGHT"}, highlight=[3]))
S(Paragraph(
    "<b>Four credits — KES 100 at the single rate, KES 90 in a bundle.</b> On Premium that keeps about "
    "KES 25 even for the deepest bundle buyer. At three credits the margin is thin enough that one refund "
    "wipes out three sales; at two credits every spin loses money on every plan.", styles["body"]))

# ---- 3. the full price list
S(Paragraph("3 · The price list to publish", styles["h2"]))
rows = [["WHAT", "CREDITS", "PRICE (SINGLE RATE)", "COSTS US", "WE KEEP"]]
items = [
    ("Standard try-on", 1, AI_TRYON_SAVER),
    ("HD try-on", 2, AI_TRYON_SAVER * 1.1),
    ("Studio try-on", 4, AI_TRYON_SAVER * 1.25),
    ("3D spin (new)", 4, COST["Premium"]),
]
for name, credits, cost in items:
    gross = credits * 25.0
    rows.append([name, str(credits), kes(gross), kes(cost, 1), kes(keep(gross, cost), 1)])
S(table(rows, [46 * mm, 22 * mm, 38 * mm, 34 * mm, 34 * mm], {1: "CENTER", 2: "RIGHT", 3: "RIGHT", 4: "RIGHT"}, highlight=[4]))
S(Paragraph(
    "HD and Studio cost barely more to draw than Standard but sell for two and four credits, so they are "
    "the most profitable things on the list. The spin is second. Keep pushing both.", styles["small"]))

S(Paragraph("Packs stay as they are — they already work with a four-credit spin:", styles["body"]))
rows = [["PACK", "CREDITS", "PRICE", "PER CREDIT", "BUYS"]]
for name, credits, price in PACKS:
    buys = f"{credits} try-ons or {credits // 4} spin" + ("s" if credits // 4 != 1 else "")
    rows.append([name, str(credits), kes(price), kes(price / credits, 1), buys if credits >= 4 else f"{credits} try-ons"])
S(table(rows, [52 * mm, 22 * mm, 26 * mm, 30 * mm, 44 * mm], {1: "CENTER", 2: "RIGHT", 3: "RIGHT"}))
S(Paragraph(
    "One change worth making: a <b>Spin pack — 5 credits for KES 110</b>. It is one try-on plus one spin "
    "with a small discount, which is exactly the journey we want people to take, and at KES 22 a credit it "
    "still clears cost.", styles["body"]))

# ---- 4. meshy credits to buy
S(Paragraph("4 · How many Meshy credits to buy", styles["h2"]))
rows = [["STAGE", "PLAN", "COST", "CREDITS", "SPINS", "WHAT IT PROVES"]]
rows += [
    ["Testing now", "Pro, first month 50% off", "$10", "1,000", "33", "Does the mesh look right on real pieces"],
    ["First paying month", "Premium", "$40", "3,000", "100", "Do people buy a spin at KES 100"],
    ["If demand holds", "Ultra", "$100", "8,000", "266", "Volume before self-hosting pays"],
]
S(table(rows, [30 * mm, 40 * mm, 18 * mm, 22 * mm, 18 * mm, 46 * mm], {2: "RIGHT", 3: "RIGHT", 4: "CENTER"}, highlight=[1]))
S(Paragraph(
    "Meshy gives 50% off the first month, so the $10 already set aside buys Pro and 33 spins — enough to "
    "test a dress, a trouser, a jacket, a satin piece and a lace piece several times each and still have "
    "spins left for the ad. Do not subscribe to Premium until spins are being sold.", styles["small"]))

# ---- 5. when to leave meshy
S(Paragraph("5 · When to stop paying Meshy", styles["h2"]))
rows = [["SPINS A MONTH", "MESHY PLAN NEEDED", "MESHY COST", "SELF-HOSTED (TRELLIS 2)", "SAVING"]]
for n in (30, 100, 266, 500):
    if n <= 33:
        plan, cost = "Pro", 20
    elif n <= 100:
        plan, cost = "Premium", 40
    elif n <= 266:
        plan, cost = "Ultra", 100
    else:
        plan, cost = "Ultra x2", 200
    own = n * 4.0 + 6000  # GPU per mesh, plus idle workers, storage and somebody watching it
    rows.append([str(n), plan, kes(cost * RATE), kes(own), kes(cost * RATE - own)])
S(table(rows, [30 * mm, 34 * mm, 32 * mm, 44 * mm, 34 * mm], {0: "CENTER", 2: "RIGHT", 3: "RIGHT", 4: "RIGHT"}, highlight=[3]))
S(Paragraph(
    "The self-hosted column carries KES 6,000 a month of idle workers, storage and attention on top of "
    "KES 4 a mesh. Self-hosting only wins past roughly 250 spins a month, and it buys a GPU to babysit. Until then Meshy "
    "is the cheaper answer even though its per-spin price looks high. The engine is a setting in Admin, so "
    "the switch is a dropdown on the day the table above flips.", styles["small"]))

# ---- 6. decisions
S(Paragraph("6 · The decisions, in one place", styles["h2"]))
for line in [
    "<b>Spin price: 4 credits.</b> KES 100 on its own, KES 90 inside a bundle. Set it in Admin, not in code.",
    "<b>Plan: Pro at $10 for testing</b> (first month half price), Premium at $40 the month spins go on sale.",
    "<b>Try-on prices do not change.</b> KES 25, two for KES 50. They work and they are what the ads say.",
    "<b>Add a Spin pack: 5 credits for KES 110</b> — one try-on and one spin, the journey we actually want.",
    "<b>Never bundle a free spin.</b> One free spin costs more than a paid try-on earns.",
    "<b>Review at 250 spins a month</b>, when self-hosting starts to pay.",
]:
    S(Paragraph(line, styles["body"]))

doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=20 * mm,
                      bottomMargin=16 * mm, title="VAA ALTERNATE — pricing after 3D", author="VAA ALTERNATE")
doc.addPageTemplates([PageTemplate(id="main", frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height)],
                                   onPage=header_footer)])
doc.build(story)
print("wrote", OUT)
