// Turns an imported photo (+ the caption the store pasted) into a draft product:
// name, type, section, price, sizes, one-of-a-kind. The store reviews before listing.
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";

const TEXT_MODEL = Deno.env.get("OPENAI_TEXT_MODEL") ?? "gpt-6-astra";
const PRICE = { input: 10, output: 50 }; // USD per 1M tokens

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "category", "garment_type", "department", "price_kes", "description", "garment_notes", "is_one_of_a_kind", "size_system", "stretch", "sizes"],
  properties: {
    name: { type: "string", description: "Short shop name for the piece, max 60 characters, no emojis or prices" },
    category: { type: "string", enum: ["dress", "top", "bottom", "skirt", "jumpsuit", "outerwear", "set", "shoes", "eyewear", "headwear", "jewellery", "other"], description: "Hoodies, jumpers, quarter-zips and cardigans are top; blazers and coats are outerwear" },
    garment_type: { type: "string", description: "Specific type in 1-3 words, e.g. hoodie, quarter-zip, blazer, cargo trousers, sneakers" },
    department: { type: "string", enum: ["women", "men", "unisex"] },
    price_kes: { type: ["integer", "null"], description: "Price in Kenyan shillings from the caption, or null if no price is given" },
    description: { type: "string", description: "One or two plain sentences for shoppers: fabric, fit, colour" },
    garment_notes: { type: "string", description: "Exact visual description of the garment for virtual try-on, under 70 words" },
    is_one_of_a_kind: { type: "boolean", description: "True for single thrift/mitumba pieces or captions like '1 piece', 'one only'" },
    size_system: { type: ["string", "null"], enum: ["uk_women", "letter", "waist_in", null] },
    stretch: { type: ["string", "null"], enum: ["none", "some", "high", null], description: "Only if the caption or fabric makes it clear (e.g. 'stretchy', 'bodycon', 'rigid denim')" },
    sizes: {
      type: "array",
      description: "Sizes stated in the caption only. Empty if none are stated.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "min", "max", "stock", "measurements"],
        properties: {
          label: { type: "string", description: "As the store writes it, e.g. 12, M, 32" },
          min: { type: ["integer", "null"] },
          max: { type: ["integer", "null"] },
          stock: { type: ["integer", "null"] },
          measurements: {
            type: "object",
            additionalProperties: false,
            description: "Garment measurements in cm from the caption only, else null. Bust, waist, hips and thigh are ALL THE WAY ROUND: double flat or 'pit to pit' numbers. Convert inches to cm.",
            required: ["bust", "waist", "hips", "thigh", "length", "shoulder", "sleeve", "inseam"],
            properties: {
              bust: { type: ["number", "null"] },
              waist: { type: ["number", "null"] },
              hips: { type: ["number", "null"] },
              thigh: { type: ["number", "null"] },
              length: { type: ["number", "null"] },
              shoulder: { type: ["number", "null"] },
              sleeve: { type: ["number", "null"] },
              inseam: { type: ["number", "null"] },
            },
          },
        },
      },
    },
  },
};

const INSTRUCTIONS = `You list clothes for a Kenyan fashion marketplace from a store's photo and caption.
Rules:
- Only use facts visible in the photo or written in the caption. Never invent a price, sizes or stock.
- Prices: read formats like "2,500/=", "ksh 2500", "2.5k", "@1500". If there is no price, use null.
- Size systems: women's numeric sizes (8, 10, 12…) → "uk_women" with min=max=that number. Letters XS–4XL → "letter" with numbers 1=XS 2=S 3=M 4=L 5=XL 6=XXL 7=3XL 8=4XL. Trouser waists in inches (28–46) → "waist_in".
- Ranges like "sizes 8-16" become one entry per even UK size (8, 10, 12, 14, 16). "S-XL" becomes S, M, L, XL. "Free size"/"one size" → one entry with min=max=null and size_system null.
- If no sizes are stated, return an empty sizes array and size_system null.
- Stock per size only if the caption says it (e.g. "2 pieces"); otherwise null.
- Mitumba, thrift, "bale", "1 piece", "one only" → is_one_of_a_kind true and stock 1.
- Measurements: only copy numbers the caption states, per size. "Pit to pit 50" means bust 100 all the way round; "waist flat 36" means waist 72. Inches × 2.54.
- If the photo shows several garments, describe the main one the caption is selling.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const user = await callerFrom(req, admin);
  if (!user) return json({ error: "Sign in to import pieces" }, 401);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY is not set on the server" }, 503);

  const { product_id } = await req.json().catch(() => ({}));
  const { data: product } = await admin
    .from("products")
    .select("id, store_id, source_caption, product_media(storage_path, kind, position, is_tryon_source)")
    .eq("id", product_id)
    .maybeSingle();
  if (!product) return json({ error: "Piece not found" }, 404);

  const { data: member } = await admin.from("store_members").select("user_id").eq("store_id", product.store_id).eq("user_id", user.id).maybeSingle();
  if (!member) return json({ error: "Only this store's team can import pieces" }, 403);

  const image = [...(product.product_media ?? [])]
    .filter((m) => m.kind === "image")
    .sort((a, b) => Number(b.is_tryon_source) - Number(a.is_tryon_source) || a.position - b.position)[0];
  if (!image) return json({ error: "Add a photo first" }, 400);
  const imageUrl = admin.storage.from("store-media").getPublicUrl(image.storage_path).data.publicUrl;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL,
      instructions: INSTRUCTIONS,
      max_output_tokens: 900,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: `Caption from the store:\n${product.source_caption?.trim() || "(no caption)"}` },
            { type: "input_image", image_url: imageUrl },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "product_draft", strict: true, schema: SCHEMA } },
    }),
  });
  const body = await res.json();
  if (!res.ok) return json({ error: `AI draft failed: ${body?.error?.message ?? res.status}` }, 502);

  const text = (body.output ?? [])
    .flatMap((o: { content?: { type: string; text?: string }[] }) => o.content ?? [])
    .find((c: { type: string }) => c.type === "output_text")?.text;
  let draft;
  try {
    draft = JSON.parse(text);
  } catch {
    return json({ error: "AI draft was not readable" }, 502);
  }

  const usage = body.usage ?? {};
  const cost = ((usage.input_tokens ?? 0) * PRICE.input + (usage.output_tokens ?? 0) * PRICE.output) / 1_000_000;

  const { error: updateError } = await admin
    .from("products")
    .update({
      name: String(draft.name || "New piece").slice(0, 120),
      category: draft.category,
      garment_type: String(draft.garment_type || "").slice(0, 40) || null,
      department: draft.department,
      price_kes: Math.max(0, draft.price_kes ?? 0),
      description: draft.description?.slice(0, 2000) || null,
      garment_notes: draft.garment_notes || null,
      is_one_of_a_kind: !!draft.is_one_of_a_kind,
      stretch: draft.stretch ?? null,
      ai_draft: draft,
      ai_cost_usd: Number(cost.toFixed(5)),
      needs_review: true,
    })
    .eq("id", product.id);
  if (updateError) return json({ error: updateError.message }, 500);

  // Replace any earlier AI sizes with the new suggestion
  await admin.from("product_variants").delete().eq("product_id", product.id);
  const system = draft.size_system ?? "uk_women";
  const sizes = (draft.sizes ?? []).slice(0, 20);
  if (sizes.length) {
    const seen = new Set<string>();
    const rows = sizes
      .filter((s: { label: string }) => s.label && !seen.has(s.label) && seen.add(s.label))
      .map((s: { label: string; min: number | null; max: number | null; stock: number | null; measurements?: Record<string, number | null> }) => ({
        product_id: product.id,
        size_label: s.label.slice(0, 20),
        size_system: system,
        size_min: draft.size_system ? s.min : null,
        size_max: draft.size_system ? (s.max ?? s.min) : null,
        stock_qty: Math.max(0, s.stock ?? 1),
        measurements: cleanMeasurements(s.measurements),
      }));
    const { error: variantError } = await admin.from("product_variants").insert(rows);
    if (variantError) return json({ draft, warning: `Sizes need checking: ${variantError.message}` });
  }

  return json({ draft, cost_usd: cost });
});

/** Keeps only stated, sensible measurements; null when there are none. */
function cleanMeasurements(m: Record<string, number | null> | undefined) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m ?? {})) if (typeof v === "number" && v >= 5 && v <= 300) out[k] = Math.round(v * 2) / 2;
  return Object.keys(out).length ? out : null;
}
