# Going 3D: what is actually free, what it costs, and what it would take

Researched 22 Sept 2026. Prices and licences move fast — check each link before committing money.

## First, the uncomfortable bit

One TikTok ad reached about 3,000 people, produced roughly 80 profile views and an unknown number of
clicks, because the link was never tagged. That is not evidence that images do not sell. It is evidence
that the funnel was never measured. Clicks are tagged now (`?s=`), the sign-up is one screen and the
fitting profile is one screen, none of which was true when that ad ran.

3D is not a cheaper, easier version of what we already have. It is slower per item, it needs a GPU we do
not own, and none of it answers the shopper's question — *will this fit me* — better than a photo of
themselves wearing the piece. Read the rest of this as "what it would take", not "what we should do
next week".

## The three things people mean by "3D"

1. **A spinnable garment** — a mesh of the dress you can rotate on the product page. This is what Meshy,
   Tripo, TRELLIS and Hunyuan3D do from a photo.
2. **A 3D body of the shopper** with the garment draped on it and simulated. This is the one that would
   genuinely beat our images, and it is still research-grade.
3. **Something that merely *feels* 3D** — a turntable of the finished try-on: four to eight angles, or a
   short clip that orbits the shopper. Cheapest by far, and to a shopper on a phone it reads as 3D.

## Free and open: garment or object from one photo

| Tool | Licence | Runs on | Speed | Notes |
|---|---|---|---|---|
| **TRELLIS 2** (Microsoft) | MIT — commercial use fine | 16 GB VRAM, community builds ~8 GB | seconds | Cleanest topology of the open set; imports straight into Blender |
| **Hunyuan3D 2.1** (Tencent) | Community licence, allows commercial assets | 6 GB shape only, 12–16 GB with texture, ~29 GB full pipeline | 10–25 s | Best textures; PBR maps included |
| **TripoSR / Stable Fast 3D** | Open | modest GPU | seconds | Older, rougher, but light |

All three are free of licence cost. The cost is the GPU.

## Hosted, with free tiers

| Service | Free tier | Commercial on free tier? |
|---|---|---|
| **Meshy** | 100–200 credits a month | Non-commercial on free; paid from about $10/mo |
| **Tripo** | ~200–300 credits a month, 2,000 on signup | **No** — non-commercial licence |
| **Rodin / Hyper3D** | Free forever, pay only when you download | Paid tiers from about $12/mo |

The free tiers are for trying things, not for running a product: a shop with 200 pieces burns a month of
credits in a day, and two of the three forbid commercial use at that price.

**Higgsfield is not a 3D tool.** It bundles video models — Sora 2, Veo 3.1, Kling, Seedance — behind one
dashboard, from about $15/month with 10 free credits a day. Useful for option 3 (the orbit clip), useless
for meshes.

## What the GPU actually costs

Open models are "free" until you rent the machine. Serverless, billed by the second:

- A100 ≈ $2.72/hour ≈ **$0.00076 a second**
- Cold start, run, and a few idle seconds are all billed

A 25-second generation is roughly **KES 2.5–4** of GPU, in the same range as our current image try-on
(KES 8–11 all in). Two caveats: an idle worker still costs, and every model above needs its weights
loaded, so cold starts are real money at low volume.

## The honest assessment of each path

**Spinnable garment (option 1).** Doable this month. Take the store's photo, run TRELLIS 2 on a rented
GPU, show a rotating dress on the product page. It looks impressive. It does not tell anyone whether the
dress fits *them*, which is the thing they are paying KES 25 to learn.

**3D body plus draped garment (option 2).** This is the real moat, and it is not ready. The current
research (Image2Garment, ISP, FitVTON) predicts a sewing pattern, drapes it on an SMPL body and
simulates it. There is no maintained open pipeline that goes photo → fitted, simulated garment on a
specific person's body. Building one means: body mesh from a photo, garment pattern from a photo, cloth
simulation, then rendering — four research components glued together, each of which can fail. Months,
not weeks, and a GPU bill throughout.

**Turntable or orbit (option 3).** Cheapest and the only one that could ship this week. We already make
one photoreal try-on. Generate three or four more at different angles from the same inputs, or feed the
result to a video model for a two-second orbit. Cost: roughly one extra try-on's worth of tokens per
angle. Perceived as 3D by anyone scrolling.

## If we do go 3D, the order that makes sense

1. Ship option 3 on the existing try-on. Measure whether a spin raises paid conversion at all.
2. Only if it does: TRELLIS 2 on serverless GPU for store pieces, cached per product so the cost is paid
   once per garment rather than once per shopper.
3. Option 2 stays on the shelf until there is revenue to fund a research spike.

## Sources

- [Open Source AI 3D Model Generator: 7 Best Options for 2026](https://www.cmarix.com/blog/top-open-source-ai-models-for-3d-image-generation/)
- [Best Open Source 3D Model Generation APIs in 2026](https://www.pixazo.ai/blog/best-open-source-3d-model-generation-apis)
- [Hunyuan3D vs TRELLIS vs TripoSR (2026)](https://triposr.org/blog/hunyuan3d-vs-trellis)
- [TRELLIS 2 vs Hunyuan3D](https://www.3daistudio.com/blog/trellis-2-vs-hunyuan-3d-differences-explained)
- [Is Meshy Free? Free Plan Limits (2026)](https://costbench.com/software/ai-3d-generation/meshy/free-plan/)
- [Tripo AI Free Plan 2026](https://costbench.com/software/ai-3d-generation/tripo-ai/free-plan/)
- [Is Rodin (Hyper3D) Free?](https://costbench.com/software/ai-3d-generation/rodin-hyper3d/free-plan/)
- [Higgsfield AI Pricing 2026](https://techsifted.com/roundups/higgsfield-ai-pricing-2026/)
- [Runpod GPU pricing](https://www.runpod.io/pricing)
- [Image2Garment: Simulation-ready Garment Generation from a Single Image](https://arxiv.org/html/2601.09658v3)
- [ISP: Multi-Layered Garment Draping with Implicit Sewing Patterns](https://arxiv.org/pdf/2305.14100)
