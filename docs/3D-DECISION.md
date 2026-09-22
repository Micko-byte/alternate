# What we use, and what happens to each kind of garment

Decided 22 Sept 2026, from the Meshy turntable test on the floral mini.

## The decision in one line

**2D stays the product. 3D is a paid extra that runs on top of a finished try-on.**

A mesh costs more than a try-on sells for, so it can never be bundled. But it is made *from* our own
result, which means it inherits everything the engine already got right — her body, her stance, her
sneakers, the real length — and adds the one thing a photo cannot show: the back.

## The pipeline

```
her photo  ─┐
            ├─►  try-on engine (GPT Image 2.5 + masks + QA)  ─►  2D result  ─►  [ spin? ]  ─►  .glb  ─►  viewer
garment    ─┘                      KES 8-11, sells KES 25          stored        + KES 29        on the result page
```

The spin is a second, optional purchase on a result that already exists. If the try-on failed its
checks, no spin is offered — never sell a 3D copy of a bad result.

## Which engine

| Stage | Engine | Cost per mesh | Why |
|---|---|---|---|
| **Now** | Meshy API, image-to-3D with texture (30 credits) | ~KES 29 on the Studio plan | Nothing to run. One HTTP call. Proven on our own result. |
| **At volume** | TRELLIS 2 (MIT) on a serverless GPU | ~KES 2.5-4 | Same call shape, a tenth of the price, but it is ours to operate |

Build it the way the AI mode switch already works: one admin setting, `mesh_mode` = `off` / `meshy` /
`selfhost`, and one function that both engines sit behind. Swapping engines is then a setting, not a
rewrite. Start on `meshy`; move when the monthly mesh bill is bigger than a GPU.

**Price to the shopper: 2 credits (KES 50).** That leaves about KES 20 on Meshy and about KES 45 once we
host it ourselves. Do not price it at 1 credit: on Meshy that loses money on every spin.

## What happens to each kind of garment

The engine already treats categories differently for masks, length and sleeves. The spin needs its own
rule, because a 30k-triangle model of a whole person is generous with a dress and cruel to an earring.

| Category | 2D try-on | Offer the spin? | Why |
|---|---|---|---|
| **Dress** | Best case. Length rule, slit, bodice all handled | **Yes** | The back and the hem are exactly what a photo hides. This is the demo. |
| **Jumpsuit** | Same as dress, plus leg shape | **Yes** | Seat and leg line only read in the round |
| **Skirt** | Waist and hem rules | **Yes** | Seat fit is the whole question |
| **Bottom / trousers** | Waist, hips, thigh, inseam | **Yes** | Same reason. Back view sells denim |
| **Top** | Shoulders, sleeves, hem | **Yes** | Backless and cropped styles need it; plain tees gain least |
| **Set** | Two pieces, one look | **Yes** | Treated as one garment by the mesh |
| **Outerwear** | Layering over what she wears | **Careful** | The mesh fuses coat and inner into one shell. Fine closed, wrong open |
| **Shoes** | Feet only | **No** | A full-body mesh smears the shoe. Better as a 2D close-up |
| **Eyewear** | Face region, face stays locked | **No** | Frames vanish at this triangle count |
| **Headwear** | Hair and crown | **No** | Hair is already the weakest part of any mesh |
| **Jewellery** | Small, high detail | **No** | Chains and studs disappear entirely |
| **Other** | Generic | **No** | Unknown shape, unknown result |

So: **spin for the six sized categories** (dress, top, bottom, skirt, jumpsuit, outerwear) plus sets,
never for accessories. That matches `SIZED_CATEGORIES` in `src/lib/garments.ts`, which already exists.

## Where fabric decides the result

The `material` field the stores now fill in is not only for drape in 2D. It predicts whether a mesh will
look right:

- **Cotton, denim, linen, knit** — matte, structured. Meshes cleanly.
- **Polyester, satin, silk** — shiny. Highlights get baked into the texture, so the model can look
  plastic under the viewer's own light. Ours survived because the print is busy; a plain satin slip will
  not.
- **Chiffon, lace, mesh panels** — semi-transparent. TRELLIS 2 handles transparency, Meshy mostly does
  not. Expect solid patches where the fabric should be sheer.

Rule: offer the spin on everything in the six categories, but if complaints come, gate it by material
before gating it by category.

## Before the first mesh ships

1. **Consent.** The text names OpenAI. Meshy is another company in another country. Add it to the
   consent list and the privacy page, and re-prompt existing users, before a single body goes there.
2. **Storage.** A `.glb` is a few MB. It belongs in its own private bucket with the same rules as
   try-on results, and the same delete-forever path — deleting a try-on must delete its mesh.
3. **Failure.** Meshy takes tens of seconds and can fail. Charge the credit only when the file lands,
   exactly as `request_tryon` already refunds a failed try-on.

## Build order

1. Consent and processor update (blocks everything else).
2. `mesh_mode` admin switch, `tryon_meshes` table, private bucket.
3. `mesh-create` function: takes a succeeded try-on, calls the engine, stores the `.glb`, charges 2 credits.
4. `<model-viewer>` on the result page, with the spin behind a "See it in 3D — 2 credits" button.
5. Admin: spins sold, cost per spin, share of paid try-ons that buy one.

Stop after step 5 and look at the number. If fewer than about one in six paying shoppers buys a spin,
3D is a nice demo and not a business, and the Meshy bill should be switched off rather than optimised.
