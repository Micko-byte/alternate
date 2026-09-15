---
name: alternate-tryon
description: How ALTERNATE's AI virtual try-on works end to end — garment zones and masks (clothes, shoes, glasses, hats, jewellery), the clothes parser, cut-outs, garment inspections, body profiles from all photos, the quality check and redo loop, size and fit rules, the GPT Image prompt, credits and plans, and how to test changes. Use whenever changing try-on quality, masks, prompts, sizes/fits, the fitting room, product sizing, or the tryon-process edge function.
---

# ALTERNATE try-on

A shopper's photo + a garment (store product or uploaded inspiration) → a realistic photo of *them* wearing it, in their real size and chosen fit, with everything else about them unchanged.

## Pipeline (in order)

1. **Body photo upload** — `src/lib/bodyPhoto.ts` (browser)
   - Normalised to **1024×1536 PNG**. The engine output size is `1024x1536`; photo and masks MUST match it.
   - Clothes parser `src/lib/garmentParser.ts` (Xenova/segformer_b2_clothes, q8, ~29 MB, cached) labels: Background, Hat, Hair, Sunglasses, Upper-clothes, Skirt, Pants, Dress, Belt, Left/Right-shoe, Face, Left/Right-leg, Left/Right-arm, Bag, Scarf.
   - Saves one **edit mask per zone** to `body-photos/{user}/masks/{photo}-{upper|lower|full|face|feet|eyes|head|jewellery}.png`.
   - Photos from before accessories existed get `feet/eyes/head/jewellery` masks made on demand by `ensureAccessoryMasks` (called from `startTryon` when the item needs one). Mask paths must sit in the owner's folder (DB check constraint).
   - After upload the browser calls `analyze-body`: GPT-6 Astra reads ALL active photos (≤6) with height/weight and saves `body_profiles` (summary, per-photo notes: angle, arms/legs visible, fit, usable, issues; tips). Re-run only when the set of active photos changes.
   - Mask semantics: **alpha 0 = may change, alpha 255 = keep**. Face/hair/hat/sunglasses/bag are never editable.
2. **Inspiration upload** — `src/lib/garmentCutout.ts` + `InspirationForm` in `src/pages/FittingRoom.tsx`
   - Shopper picks a category and optionally a type (`src/lib/garments.ts`: hoodie, quarter-zip, blazer, cargo trousers, sneakers, sunglasses, earrings…). The parser pre-selects its best guess (`guessCategory`) and cuts out only those classes onto white → `garment_uploads.cutout_path`. Jewellery always uses the whole photo.
   - Right after saving, `inspect-garment` (server) lists what the ORIGINAL photo really contains → `garment_inspections` (server-only table). If the chosen category isn't there, the form offers the detected item instead. `request_tryon` also refuses a mismatch (`private.category_matches`: top↔outerwear and set↔top/bottom/skirt count as matches).
3. **Request** — `public.request_tryon(_body_photo_id, _product_id | _garment_upload_id, _quality, _fit)` (SQL, security definer)
   - Enforces 18+, consents, own photo, size rule, garment inspection, test cap; charges a monthly plan first (within its daily limit, Africa/Nairobi day) and credit packs otherwise; reuses in-progress/succeeded identical try-ons; refunds this shopper's try-ons stuck for 15+ minutes.
4. **Generate** — `supabase/functions/tryon-process/index.ts`
   - Zone from category: top/outerwear → `upper`; bottom/skirt → `lower`; shoes → `feet`; eyewear → `eyes`; headwear → `head`; jewellery → `jewellery`; everything else → `full`.
   - Inspection (cached by source image) must contain the category, else a shopper-readable `UserError` and refund. The matching inspected item's description becomes the garment notes (cached on products).
   - Sends person PNG + garment + up to N reference photos of the same shopper (picked from the body profile for the zone: side view, arms/legs visible, fitted) + zone mask, `input_fidelity=high` (dropped automatically if the model rejects it).
   - Tiers: standard = high quality, 1 reference, 2 attempts; hd = high, 2 references, 2 attempts; studio = max, 3 references, 3 attempts. Accessory zones use no references.
   - **Quality check** (`checkResult` in `_shared/ai.ts`): Astra compares original, item and result → garment_matches, identity, pose, anatomy (limbs/hands), rest unchanged, photo quality, score, problems. Pass = garment + pose + anatomy + photo quality + score ≥ 0.72.
   - Failed check → attempt saved to `tryon-work/{user}/{tryon}/attempt-n.png`, the function calls itself with the service key (each attempt gets its own time limit) and the next prompt includes the problems to fix. After the last attempt the best one is kept; if its garment is wrong or score < 0.45, `UserError` + refund.
   - Stores result, `qa` (all attempts), `identity_score` (best score), `reference_photo_ids`, `edit_mask_path`, `engine`, `cost_usd` (all attempts). Technical errors are saved as `Technical: …` and shown to shoppers as a generic message.
5. **View** — `src/components/FaceLockImage.tsx` pastes the original photo back wherever the tryon's `edit_mask_path` is opaque ("Keep the rest of me"). "AI version" shows the raw output.

## Parts maps, length, size and skin (current engine)

- New body photos upload a **parts map** (`body_photos.parts_map_path`, 256×384 PNG, red = 12 × SegFormer label) plus a face mask. Older photos get one made by `ensurePartsMap` in `startTryon`.
- `supabase/functions/_shared/body.ts` builds the mask for each try-on from the parts map (`editableGrid` → `maskPng`), saved as `body-photos/{user}/masks/tryon-{id}.png` (`tryons.edit_mask_path`, used for paste-back). Rules: visible arm skin only opens for three-quarter/long sleeves; leg skin only opens down to the new hem; skin that stays visible (tattoos) is locked; wide silhouettes get extra room.
- **Length** (`LENGTHS`: cropped … floor, as a share of standing height from crown/floor): shopper/store choice (`garment_uploads.length`, `products.length`) > `length_cm` with height (`lengthFromCm`; ignored if >2 steps from the design length, e.g. a mistyped height) > the inspection's design length.
- **Size**: `describeSize` compares the product variant or the inspiration's `size_label` with the shopper's usual size: smaller = visibly tight and slightly shorter, bigger = loose. No size = fit as designed.
- **Fit** texts are strong and distinct (fitted = skin-tight bodycon, regular = 2–4 cm ease). Height/weight are never used to describe the body; the body outline comes from the photos. `body_measurements` (bust/waist/hips, photo estimate from `src/lib/measure.ts` or tape) only guide tightness.
- Inspection items now include `length`, `sleeves`, `silhouette` and exact `colour`; older cached inspections are redone. The quality check also requires `colours_match`, `length_correct`, `fit_correct`, `skin_details_kept`.

## Zones — what each may change (legacy masks for photos without a parts map)

| Zone | Editable (then dilated) | Always kept |
|---|---|---|
| upper | Upper-clothes, Scarf, Dress, arms | Pants, Skirt, legs, shoes, face/hair, bag |
| lower | Pants, Skirt, Belt, Dress, legs (wider ±9 cells for wide/baggy legs) | Upper-clothes, Scarf, arms/hands (incl. what they hold), face/hair, bag |
| full | all clothes + arms + legs | face/hair, bag |
| feet | shoes + ankles | everything else |
| eyes | eye band from temple to temple | everything else |
| head | hair/hat and the space above, never below the brow | face, everything else |
| jewellery | ears, neck to collarbone, wrists/hands | face, everything else |

Grid is 256×384 (1 cell ≈ 4 px). If a new garment category is added: enum migration on its own, `private.category_name`/`category_matches`, `CATEGORIES`/`CATEGORY_NAME`/`categoryMatches` in `_shared/ai.ts`, `zoneFor` in BOTH `garmentParser.ts` and `tryon-process`, `garmentClasses`, `GARMENTS` in `src/lib/garments.ts`, `CATEGORY_LABELS/SINGULAR` in utils, and the `draft-product` schema.

## Sizes and fits (keep SQL and TS identical)

- Size systems: `uk_women` (UK 4–28), `letter` (1=XS … 8=4XL), `waist_in` (26–46).
- Fit styles: fitted, regular, relaxed (+1 step), oversized (+2), baggy (+2). Step = 1 for letter, 2 otherwise.
- Store products: target = usual size + fit offset, must be in stock (`private.fit_offset` in SQL ↔ `fitOffset` in `src/lib/sizes.ts`; `fitFor` in `src/lib/queries.ts` mirrors `request_tryon`).
- Inspirations: no stock check; fit is a styling instruction; size must exist for sized categories.
- Menswear shoppers prefer letter/waist sizes; womenswear prefer UK.

## Prompt rules (tryon-process `buildPrompt`)

- Say which image is the customer and that image 2 is only the garment.
- State the zone rule explicitly ("Replace ONLY the trousers… top, arms, hands, phone, shoes, pose stay").
- Include height, weight, usual size, worn size (sized-up note) and fit description.
- Forbid copying other clothes, accessories, pose or background from image 2.
- Never promise identity preservation in copy without the paste-back — the mask is guidance to the model; the paste-back is the guarantee.

## Testing a change

1. **SQL rules** — write a rollback script (see scratchpad examples `rls_flow_test.sql`, `fit_test.sql`): `begin; … set local role authenticated; select set_config('request.jwt.claims', …); …` then run `npx supabase@latest db query --linked -f file.sql`. Verify no rows persisted.
2. **Parser / cut-out** — in the dev app console: `const { parseInspiration, cutoutGarment } = await import('/src/lib/garmentCutout.ts')` on a CORS-enabled image (e.g. the transformers.js docs dataset) and check label shares.
3. **Engine** — deploy with `npx supabase@latest functions deploy tryon-process --use-api --project-ref yvtkvgzpcnlzbhnrjbwg`; run one try-on as an admin and read the "Test info" box (engine, cost, prompt, error).
4. `npm run typecheck && npm run build`.

## Store import (bulk → AI drafts → review)

- `src/pages/studio/Import.tsx`: stores pick up to 30 photos/videos and paste each caption. Videos: a frame at 30% becomes the try-on photo (`src/lib/media.ts`).
- Each item becomes a `products` row with `status='draft'`, `needs_review=true`, `import_source='bulk'`, `source_caption`.
- `supabase/functions/draft-product`: GPT-6 Astra with a strict JSON schema reads photo + caption → name, category, department, price (null if absent, never invented), sizes (UK / letter / waist), one-of-a-kind. Saves `ai_draft`, `ai_cost_usd`, replaces variants.
- `src/pages/studio/Review.tsx`: "List it" only when price > 0 and at least one size. "List N ready" lists all complete drafts.
- Stock drives status: trigger `sync_product_stock_status` sets active → sold_out at 0 stock and back when restocked (never touches drafts). Products list has a one-tap **Sold** (−1 per size).
- Only import a store's OWN content (their uploads, their captions). No scraping other accounts.

## Costs (measured)

- One high-quality generation on gpt-image-2.5-sunburst ≈ **$0.068 (KES ~9)** with 2 input images; each reference photo adds image-input tokens.
- Astra calls: inspection ≈ $0.01–0.02 (once per image), quality check ≈ $0.02 per attempt, body profile ≈ $0.05–0.08 (once per photo set).
- Budget ≈ KES 17 per checked Standard try-on including redos (used by the admin Prices "keep / credit" estimate).
- Parser, cut-outs and masks run in the browser: no server cost.
- Credits: standard 1, hd 2, studio 4. Packs: Single 1 = KES 50, 5 = KES 225, 12 = KES 480. Plans (30 days, no auto-renew): Lite KES 499 / 15 credits / 5 a day; Plus KES 999 / 35 / 10; Pro KES 1,999 / 70 / 20. All editable in Admin → Settings → Prices. Referred shoppers' payments (packs and plans) give the store `store_finance.referral_rate` (20%).

## Gotchas

- Old body photos (before garment zones) only have `edit_mask_path` + `face_mask_path`; the engine falls back to the full mask. Ask shoppers to re-upload for top-only / trouser-only locking.
- Edge functions have a wall-clock limit; never loop several generations inside one call — use the self-call continuation.
- Secrets (`OPENAI_API_KEY`, `PAYSTACK_SECRET_KEY`) are set by the owner, never typed by the assistant.
- Vite needs a dev-server restart after adding dependencies (stale optimized deps).
