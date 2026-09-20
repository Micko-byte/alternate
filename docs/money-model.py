"""VAA ALTERNATE money model -> a PDF the founders can read.

Every figure is either MEASURED (from the try-ons already run) or an ASSUMPTION, and each
table says which. Costs in USD are converted at KES 129.4 to the dollar.
"""
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether

OUT = r"C:\Users\User\neggarman\alternate-style-hub\docs\VAA ALTERNATE-money-model.pdf"

INK = colors.HexColor("#191710")
PAPER = colors.HexColor("#FFFFFF")
MUTED = colors.HexColor("#686868")
RULE = colors.HexColor("#E4E2DC")
ACCENT = colors.HexColor("#222A41")
MUSTARD = colors.HexColor("#DBAE49")
GOOD = colors.HexColor("#2F6B4F")
BAD = colors.HexColor("#8C2F2F")

RATE = 129.4  # KES per USD

# ---------------------------------------------------------------- the model
VAT = 0.16
PAYSTACK = 0.015
AI_SAVER = 11.0    # KES of AI per Standard try-on, all in: generation, checks, redos, reused reading
AI_PREMIUM = 17.0

PACKS = [  # name, credits, price, store share
    ("Launch offer (first buy)", 3, 50, 0.10),
    ("Two try-ons", 2, 50, 0.10),
    ("Bundle of 5", 5, 120, 0.20),
    ("Bundle of 12", 12, 270, 0.20),
]
PLANS = [("Lite", 15, 499), ("Plus", 35, 999), ("Pro", 70, 1999)]


def economics(price, credits, share, ai, referred):
    net = price / (1 + VAT)
    fee = price * PAYSTACK
    store = price * share if referred else 0.0
    cost = credits * ai
    profit = net - fee - store - cost
    return net, fee, store, cost, profit, profit / credits


def kes(v, dp=0):
    return f"KES {v:,.{dp}f}"


# ---------------------------------------------------------------- page furniture
styles = {
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=30, leading=32, textColor=INK, spaceAfter=6),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=INK, spaceBefore=16, spaceAfter=6),
    "kicker": ParagraphStyle("kicker", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=MUTED, spaceAfter=10),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK, alignment=TA_LEFT, spaceAfter=6),
    "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8.2, leading=11.5, textColor=MUTED, spaceAfter=6),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, leading=11, textColor=INK),
    "cellb": ParagraphStyle("cellb", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=INK),
}


def table(rows, widths, aligns=None, head=True, zebra=True):
    t = Table(rows, colWidths=widths, hAlign="LEFT", repeatRows=1 if head else 0)
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
    ]
    if head:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), INK),
            ("TEXTCOLOR", (0, 0), (-1, 0), PAPER),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 7.6),
        ]
        if zebra:
            for i in range(2, len(rows), 2):
                style.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F7F6F3")))
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
    canvas.drawRightString(A4[0] - 18 * mm, A4[1] - 8 * mm, "What we make on every try-on  ·  18 September 2026")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(18 * mm, 10 * mm, "Prepared from try-ons already run on the live system. KES 129.4 to the dollar.")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, str(doc.page))
    canvas.restoreState()


story = []
S = story.append

S(Paragraph("VIRTUAL FITTING ROOM · NAIROBI", styles["kicker"]))
S(Paragraph("What we make on every try-on", styles["h1"]))
S(Paragraph(
    "Every try-on costs real money the moment somebody presses the button: OpenAI charges us to draw the picture, "
    "to read the garment, to read the body and to check the result. This is what comes in, what goes out, and what "
    "is left, at today's prices.", styles["body"]))

# --- 1. what OpenAI charges
S(Paragraph("1 · What the AI charges us", styles["h2"]))
S(Paragraph(
    "Two setups, one switch in Admin for the whole system. <b>Saver</b> is on now: a small model (GPT-5.6 Luna) reads "
    "photos and checks results, and a try-on is only redone when the item or its colours came out wrong. "
    "<b>Premium</b> uses GPT-6 Astra for the same jobs and redoes any try-on that fails a check. "
    "The try-on picture itself is drawn by the same model either way, so the quality a shopper sees does not change.",
    styles["body"]))

rows = [["JOB", "PREMIUM (GPT-6 ASTRA)", "SAVER (GPT-5.6 LUNA)", "SAVING", "SOURCE"]]
for job, prem, sav, src in [
    ("Read a garment photo", 0.0230, 0.00075, "both measured"),
    ("Check a finished try-on", 0.0150, 0.00120, "Luna measured"),
    ("Read a body (once per set of photos)", 0.0550, 0.00180, "Astra measured"),
]:
    rows.append([job, f"${prem:.4f} · {kes(prem * RATE, 2)}", f"${sav:.5f} · {kes(sav * RATE, 2)}",
                 f"{(1 - sav / prem) * 100:.0f}%", src])
S(table(rows, [54 * mm, 38 * mm, 38 * mm, 16 * mm, 28 * mm], {3: "RIGHT"}))
S(Paragraph(
    "Token prices per million: Astra $10 in / $50 out, Luna $0.20 in / $1.20 out. Garment readings and body profiles "
    "are saved and reused, so they are paid once per garment and once per set of photos, not on every try-on.",
    styles["small"]))

rows = [["WHAT WE PAY PER STANDARD TRY-ON", "PREMIUM", "SAVER"]]
rows += [
    ["Drawing the picture (GPT Image 2.5), measured average", kes(0.055 * RATE, 2), kes(0.055 * RATE, 2)],
    ["Reading and checking around it", kes(0.010 * RATE, 2), kes(0.002 * RATE, 2)],
    ["Redos and the reading that gets reused (planning allowance)", kes(17 - 0.065 * RATE, 2), kes(11 - 0.057 * RATE, 2)],
    ["Planning figure used everywhere below", kes(AI_PREMIUM, 2), kes(AI_SAVER, 2)],
]
S(table(rows, [94 * mm, 40 * mm, 40 * mm], {1: "RIGHT", 2: "RIGHT"}))
S(Paragraph(
    "Measured on the live system: a Standard try-on has cost KES 8.41 on average and KES 15.66 in the worst case "
    "(Premium). The planning figures above are deliberately higher so redos and refunds are already paid for.",
    styles["small"]))

# --- 2. what a shopper pays
S(Paragraph("2 · What a shopper pays, and what is left", styles["h2"]))
S(Paragraph(
    f"Out of every shilling: the taxman takes VAT at {VAT:.0%}, Paystack takes {PAYSTACK:.1%}, and a store that sent "
    "the shopper takes its share. The rest pays for the AI, and what remains is ours.", styles["body"]))

for referred in (False, True):
    label = "Shopper came through a store (store earns its share)" if referred else "Shopper came on their own (no store share)"
    S(Paragraph(label, styles["cellb"]))
    rows = [["PACK", "PRICE", "TRY-ONS", "AFTER VAT", "PAYSTACK", "STORE", "AI (SAVER)", "PROFIT", "PER TRY-ON"]]
    for name, credits, price, share in PACKS:
        net, fee, store, cost, profit, each = economics(price, credits, share, AI_SAVER, referred)
        rows.append([name, kes(price), str(credits), kes(net, 2), f"-{kes(fee, 2)}",
                     f"-{kes(store, 2)}" if store else "—", f"-{kes(cost, 2)}", kes(profit, 2), kes(each, 2)])
    t = table(rows, [32 * mm, 16 * mm, 13 * mm, 19 * mm, 18 * mm, 17 * mm, 20 * mm, 19 * mm, 19 * mm],
              {1: "RIGHT", 2: "CENTER", 3: "RIGHT", 4: "RIGHT", 5: "RIGHT", 6: "RIGHT", 7: "RIGHT", 8: "RIGHT"})
    S(KeepTogether([t, Spacer(1, 6)]))

S(Paragraph(
    "<b>The target was at least KES 10 of profit per try-on.</b> Two try-ons for KES 50 clears it at KES 10.18 when "
    "nobody referred the shopper, and makes KES 7.68 each when a store did. The launch offer (3 for KES 50) makes "
    "about KES 3 a try-on: it is marketing, not margin, which is why it is limited to a shopper's first purchase.",
    styles["body"]))

# --- 3. premium comparison
S(Paragraph("3 · What Premium mode would cost us", styles["h2"]))
rows = [["PACK", "PROFIT ON SAVER", "PROFIT ON PREMIUM", "DIFFERENCE PER PACK"]]
for name, credits, price, share in PACKS:
    _, _, _, _, p_saver, _ = economics(price, credits, share, AI_SAVER, False)
    _, _, _, _, p_prem, _ = economics(price, credits, share, AI_PREMIUM, False)
    rows.append([name, kes(p_saver, 2), kes(p_prem, 2), f"-{kes(p_saver - p_prem, 2)}"])
S(table(rows, [56 * mm, 39 * mm, 39 * mm, 40 * mm], {1: "RIGHT", 2: "RIGHT", 3: "RIGHT"}))
S(Paragraph(
    "Premium eats KES 6 of every try-on. On the KES 50 packs that is most of the profit, so Saver stays on unless "
    "quality complaints say otherwise. The switch is in Admin → Controls → AI setup and applies to everybody at once.",
    styles["small"]))

# --- 4. plans
S(Paragraph("4 · Monthly plans", styles["h2"]))
rows = [["PLAN", "PRICE", "CREDITS", "ALL CREDITS USED", "HALF GO UNUSED", "PER TRY-ON USED"]]
for name, credits, price in PLANS:
    _, _, _, _, full, each = economics(price, credits, 0.20, AI_SAVER, False)
    _, _, _, _, half, _ = economics(price, credits / 2, 0.20, AI_SAVER, False)
    rows.append([name, kes(price), str(credits), kes(full, 2), kes(half, 2), kes(each, 2)])
S(table(rows, [26 * mm, 22 * mm, 20 * mm, 38 * mm, 36 * mm, 30 * mm],
        {1: "RIGHT", 2: "CENTER", 3: "RIGHT", 4: "RIGHT", 5: "RIGHT"}))
S(Paragraph(
    "Plans are the best business we have: people pay for credits they do not always use, and heavy users are capped "
    "by the daily limit. A store referral takes 20% of a plan, which is KES 100 on Lite and KES 400 on Pro.",
    styles["small"]))

# --- 5. volume
S(Paragraph("5 · What a month looks like", styles["h2"]))
S(Paragraph(
    "Assumption: every try-on is sold at the everyday price of KES 25 (the 2 for KES 50 pack), 4 shoppers in 10 came "
    "through a store, Saver is on. Fixed costs are the list prices of what we run on.", styles["body"]))

def month(n, referred_share=0.4, ai=AI_SAVER):
    revenue = 25.0 * n
    vat = revenue - revenue / (1 + VAT)
    fees = revenue * PAYSTACK
    store = revenue * 0.10 * referred_share
    aicost = ai * n
    return revenue, vat, fees, store, aicost, revenue - vat - fees - store - aicost

FIXED = 3235 + 2588 + 1500  # Supabase Pro, Vercel Pro, domain + mail, KES
rows = [["TRY-ONS", "SHOPPERS PAY", "VAT", "PAYSTACK", "STORES", "AI", "PROFIT", "AFTER FIXED"]]
for n in (500, 1000, 2500, 5000, 10000):
    revenue, vat, fees, store, aicost, gross = month(n)
    rows.append([f"{n:,}", kes(revenue), f"-{kes(vat)}", f"-{kes(fees)}", f"-{kes(store)}", f"-{kes(aicost)}",
                 kes(gross), kes(gross - FIXED)])
S(table(rows, [18 * mm, 24 * mm, 20 * mm, 21 * mm, 20 * mm, 22 * mm, 24 * mm, 24 * mm],
        {1: "RIGHT", 2: "RIGHT", 3: "RIGHT", 4: "RIGHT", 5: "RIGHT", 6: "RIGHT", 7: "RIGHT"}))

break_even = FIXED / month(1)[5]
S(Paragraph(
    f"Fixed costs assumed: Supabase Pro {kes(3235)}, Vercel Pro {kes(2588)}, domain and email {kes(1500)} — "
    f"{kes(FIXED)} a month. <b>Break-even is about {break_even:,.0f} Standard try-ons a month</b>, roughly "
    f"{break_even / 2:,.0f} packs of two. Everything above that is profit; on Premium mode break-even would be about "
    f"{FIXED / month(1, ai=AI_PREMIUM)[5]:,.0f} try-ons.", styles["small"]))

# --- 6. what could go wrong
S(Paragraph("6 · What eats the margin", styles["h2"]))
for head, text in [
    ("Refunds", "A try-on that fails its checks is refunded, so we pay the AI and earn nothing. Every refund costs "
                f"about {kes(AI_SAVER)} — roughly one try-on's profit, so one refund in two try-ons wipes the margin."),
    ("Bundles pay stores 20%", "The KES 50 packs pay a referring store 10%, but bundles still pay 20%: "
                               f"{kes(economics(270, 12, 0.20, AI_SAVER, True)[4], 2)} left on Bundle of 12 against "
                               f"{kes(economics(270, 12, 0.20, AI_SAVER, False)[4], 2)} without a store. Dropping "
                               "bundles to 10-15% is the single easiest win."),
    ("HD and Studio", "HD costs 2 credits and Studio 4, and the picture costs us barely more than Standard, so they "
                      "are more profitable than Standard, not less. Worth pushing."),
    ("Worst-case try-ons", "The most expensive try-on so far cost KES 15.66. A run of difficult photos costs real "
                           "money; the Admin cost table shows the average and the worst of the last 60 days."),
    ("Prices move", "OpenAI can change prices at any time. The Admin switch means we can drop to Saver, or to an "
                    "even smaller model, without touching the app."),
]:
    S(Paragraph(f"<b>{head}.</b> {text}", styles["body"]))

doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=20 * mm, bottomMargin=16 * mm,
                      title="VAA ALTERNATE — what we make on every try-on", author="VAA ALTERNATE")
doc.addPageTemplates([PageTemplate(id="main", frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height)],
                                   onPage=header_footer)])
doc.build(story)
print("wrote", OUT)
