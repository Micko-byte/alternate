---
name: alternate-tryon
description: How ALTERNATE's AI virtual try-on works end to end — garment zones and masks, the clothes parser, cut-outs, size and fit rules, the GPT Image prompt, credits, and how to test changes. Use whenever changing try-on quality, masks, prompts, sizes/fits, the fitting room, product sizing, or the tryon-process edge function.
---

# ALTERNATE try-on

A shopper's photo + a garment (store product or uploaded inspiration) → a realistic photo of *them* wearing it, in their real size and chosen fit, with everything else about them unchanged.

## Pipeline (in order)

1. **Body photo upload** — `src/lib/bodyPhoto.ts` (browser)
   - Normalised to **1024×1536 PNG**. The engine output size is `1024x1536`; photo and masks MUST match it.
   - Clothes parser `src/lib/garmentParser.ts` (Xenova/segformer_b2_clothes, q8, ~29 MB, cached) labels: Background, Hat, Hair, Sunglasses, Upper-clothes, Skirt, Pants, Dress, Belt, Left/Right-shoe, Face, Left/Right-leg, Left/Right-arm, Bag, Scarf.
   - Saves one **edit mask per zone** to `body-photos/{user}/masks/{photo}-{upper|lower|full|face}.png`.
   - Mask semantics: **alpha 0 = may change, alpha 255 = keep**. Face/hair/hat/sunglasses/bag are never editable.
2. **Inspiration upload** — `src/lib/garmentCutout.ts` + `InspirationForm` in `src/pages/FittingRoom.tsx`
   - Shopper picks what they want from the photo (top / trouser / dress…). Parser cuts out only those classes onto white → `garment-uploads/{user}/{id}-cutout.png` (`garment_uploads.cutout_path`). "Use whole photo" is the fallback.
3. **Request** — `public.request_tryon(_body_photo_id, _product_id | _garment_upload_id, _quality, _fit)` (SQL, security definer)
   - Enforces 18+, consents, own photo, size rule, credits; charges once; reuses in-progress/succeeded identical try-ons.
4. **Generate** — `supabase/functions/tryon-process/index.ts`
   - Zone from category: top/outerwear → `upper`; bottom/skirt → `lower`; everything else → `full`.
   - Sends person PNG + garment (cut-out if present) + zone mask to OpenAI `images/edits` (`gpt-image-2.5-sunburst`; quality standard→medium, hd→high, studio→max).
   - GPT-6 Astra writes a garment description once per product (cached in `products.garment_notes`).
   - Stores result, `edit_mask_path`, `engine`, `cost_usd`. Any error → `refund_tryon`.
5. **View** — `src/components/FaceLockImage.tsx` pastes the original photo back wherever the tryon's `edit_mask_path` is opaque ("Keep the rest of me"). "AI version" shows the raw output.

## Zones — what each may change

| Zone | Editable (then dilated) | Always kept |
|---|---|---|
| upper | Upper-clothes, Scarf, Dress, arms | Pants, Skirt, legs, shoes, face/hair, bag |
| lower | Pants, Skirt, Belt, Dress, legs (wider ±9 cells for wide/baggy legs) | Upper-clothes, Scarf, arms/hands (incl. what they hold), face/hair, bag |
| full | all clothes + arms + legs | face/hair, bag |

Grid is 256×384 (1 cell ≈ 4 px). If a new garment type is added, update `zoneFor` in BOTH `garmentParser.ts` and `tryon-process`, and `garmentClasses` for cut-outs.

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

- HD try-on on gpt-image-2.5-sunburst ≈ **$0.068 (KES ~9)** including image inputs.
- Parser and cut-outs run in the browser: no server cost.
- Credits: standard 1, hd 3, studio 5; Starter pack KES 50 = 4 credits (tables `tryon_prices`, `credit_packs`).

## Gotchas

- Old body photos (before garment zones) only have `edit_mask_path` + `face_mask_path`; the engine falls back to the full mask. Ask shoppers to re-upload for top-only / trouser-only locking.
- Secrets (`OPENAI_API_KEY`, `PAYSTACK_SECRET_KEY`) are set by the owner, never typed by the assistant.
- Vite needs a dev-server restart after adding dependencies (stale optimized deps).
