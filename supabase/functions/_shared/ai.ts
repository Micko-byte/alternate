// GPT-6 Astra helpers shared by the try-on engine and the upload checks.
// Every call returns structured JSON (strict schema) and its cost in USD.
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.88.0";

export const TEXT_MODEL = Deno.env.get("OPENAI_TEXT_MODEL") ?? "gpt-6-astra";
const TEXT_PRICE = { input: 10, output: 50 }; // USD per 1M tokens

export const CATEGORIES = ["dress", "top", "bottom", "skirt", "jumpsuit", "outerwear", "set", "shoes", "eyewear", "headwear", "jewellery", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

/** A message shoppers can read. Anything else is logged as a technical failure. */
export class UserError extends Error {}

export const CATEGORY_NAME: Record<string, string> = {
  dress: "a dress",
  top: "a top",
  bottom: "trousers",
  skirt: "a skirt",
  jumpsuit: "a jumpsuit",
  outerwear: "a jacket or coat",
  set: "a matching set",
  shoes: "shoes",
  eyewear: "glasses",
  headwear: "a hat",
  jewellery: "jewellery",
  other: "clothing",
};

/** Same rule as private.category_matches() in the database. */
export function categoryMatches(requested: string | null, detected: string[] | null | undefined) {
  if (!requested || !detected?.length || requested === "other") return true;
  if (detected.includes(requested)) return true;
  if ((requested === "top" || requested === "outerwear") && detected.some((c) => c === "top" || c === "outerwear")) return true;
  if (requested === "set" && detected.some((c) => ["top", "bottom", "skirt", "outerwear"].includes(c))) return true;
  return false;
}

export async function blobToDataUrl(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type || "image/png"};base64,${encodeBase64(bytes)}`;
}

export async function download(admin: SupabaseClient, bucket: string, path: string): Promise<Blob> {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Could not read ${bucket}/${path}`);
  return data;
}

type Content = { type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail?: "low" | "high" | "auto" };

async function askJson<T>(opts: { name: string; instructions: string; content: Content[]; schema: Record<string, unknown>; maxTokens: number }): Promise<{ data: T; costUsd: number }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set on the server");
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL,
      instructions: opts.instructions,
      max_output_tokens: opts.maxTokens,
      input: [{ role: "user", content: opts.content }],
      text: { format: { type: "json_schema", name: opts.name, strict: true, schema: opts.schema } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${opts.name} failed: ${body?.error?.message ?? res.status}`);
  const text = (body.output ?? [])
    .flatMap((o: { content?: { type: string; text?: string }[] }) => o.content ?? [])
    .find((c: { type: string }) => c.type === "output_text")?.text;
  const usage = body.usage ?? {};
  const costUsd = ((usage.input_tokens ?? 0) * TEXT_PRICE.input + (usage.output_tokens ?? 0) * TEXT_PRICE.output) / 1_000_000;
  try {
    return { data: JSON.parse(text) as T, costUsd };
  } catch {
    throw new Error(`${opts.name} returned unreadable JSON`);
  }
}

// ------------------------------------------------------------------ garment inspection

export type InspectionItem = { type: string; category: Category; colour: string; main: boolean; description: string };
export type Inspection = { is_wearable: boolean; items: InspectionItem[]; categories: Category[]; costUsd: number };

const INSPECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_wearable", "items"],
  properties: {
    is_wearable: { type: "boolean", description: "False if the photo shows no clothing, shoes or accessories a person could wear" },
    items: {
      type: "array",
      description: "Every wearable item clearly visible, most prominent first. Max 6.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "category", "colour", "main", "description"],
        properties: {
          type: { type: "string", description: "Specific type in 1-3 words, e.g. hoodie, quarter-zip, blazer, trench coat, cargo trousers, midi skirt, sneakers, aviator sunglasses, gold hoop earrings" },
          category: { type: "string", enum: [...CATEGORIES] },
          colour: { type: "string" },
          main: { type: "boolean", description: "True for the item the photo is mainly showing or selling" },
          description: { type: "string", description: "For virtual try-on, under 45 words: cut, neckline, sleeves, length, fit, fabric, exact colours, print, hardware" },
        },
      },
    },
  },
};

const INSPECTION_RULES = `You check photos for a virtual fitting room. List what is really in the photo; never guess what the shopper wants.
Category rules:
- top: T-shirts, shirts, blouses, polos, tank tops, crop tops, bodysuits, sweaters, jumpers, pullovers, hoodies, sweatshirts, quarter-zips, cardigans.
- outerwear: blazers, suit jackets, denim/leather/bomber/varsity jackets, coats, trench coats, puffers, gilets.
- bottom: trousers, jeans, chinos, cargo trousers, joggers, shorts, leggings. skirt: all skirts.
- dress, jumpsuit (includes playsuits and overalls), set (co-ords, suits, tracksuits sold together).
- shoes: all footwear. eyewear: glasses and sunglasses. headwear: caps, hats, beanies, headwraps, durags.
- jewellery: necklaces, chains, earrings, bracelets, watches, rings. other: bags, belts, scarves and anything else.
Only list items that are clearly visible and large enough to try on.`;

export async function inspectGarment(image: Blob, hint: string): Promise<Inspection> {
  const { data, costUsd } = await askJson<{ is_wearable: boolean; items: InspectionItem[] }>({
    name: "garment_inspection",
    instructions: INSPECTION_RULES,
    maxTokens: 700,
    schema: INSPECTION_SCHEMA,
    content: [
      { type: "input_text", text: `What wearable items are in this photo? Shopper's note (may be wrong or empty): ${hint.slice(0, 300)}` },
      { type: "input_image", image_url: await blobToDataUrl(image), detail: "low" },
    ],
  });
  const items = (data.items ?? []).slice(0, 6);
  return { is_wearable: data.is_wearable, items, categories: [...new Set(items.map((i) => i.category))], costUsd };
}

/** The inspected item that matches what the shopper asked for, main item first. */
export function itemFor(inspection: { items: InspectionItem[] }, requested: string | null) {
  const matching = inspection.items.filter((i) => categoryMatches(requested, [i.category]));
  return matching.find((i) => i.main) ?? matching[0] ?? null;
}

// ------------------------------------------------------------------ body profile

export type PhotoNote = { id: string; angle: string; full_body: boolean; arms_visible: boolean; legs_visible: boolean; clothing_fit: string; usable: boolean; issues: string };
export type BodyProfile = { summary: string; body: Record<string, string>; photos: PhotoNote[]; tips: string[]; costUsd: number };

const BODY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["photos", "body", "summary", "tips"],
  properties: {
    photos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "angle", "full_body", "arms_visible", "legs_visible", "clothing_fit", "usable", "issues"],
        properties: {
          index: { type: "integer", description: "1-based position of the photo in the order given" },
          angle: { type: "string", enum: ["front", "side", "back", "other"] },
          full_body: { type: "boolean", description: "Head to feet in frame" },
          arms_visible: { type: "boolean", description: "Bare or close-fitting sleeves, so arm thickness and length can be seen" },
          legs_visible: { type: "boolean", description: "Shorts, skirt or close-fitting trousers, so leg shape can be seen" },
          clothing_fit: { type: "string", enum: ["fitted", "regular", "loose"] },
          usable: { type: "boolean", description: "False if blurry, very dark, cropped badly, several people, or not a real person" },
          issues: { type: "string", description: "Short plain note, empty if none" },
        },
      },
    },
    body: {
      type: "object",
      additionalProperties: false,
      required: ["build", "shoulders", "chest", "waist", "hips", "arms", "legs", "torso_to_legs", "posture"],
      properties: {
        build: { type: "string" },
        shoulders: { type: "string" },
        chest: { type: "string" },
        waist: { type: "string" },
        hips: { type: "string" },
        arms: { type: "string", description: "Length and thickness of upper arms and forearms" },
        legs: { type: "string", description: "Length and shape of thighs and calves" },
        torso_to_legs: { type: "string", description: "Proportion, e.g. long torso, shorter legs" },
        posture: { type: "string" },
      },
    },
    summary: { type: "string", description: "Under 90 words, written for an image model dressing this person: proportions and limbs that change how clothes hang. Neutral and respectful." },
    tips: { type: "array", items: { type: "string" }, description: "Up to 3 short suggestions for photos to add for a more accurate fit, e.g. 'Add a side photo'. Empty if the set is already complete." },
  },
};

const BODY_RULES = `You build a body reference for a virtual fitting room from several photos of the same adult.
Describe only what matters for how clothes fit and hang: proportions, shoulder width, chest, waist, hips, arm and leg length and thickness, torso-to-leg ratio, posture.
Use the stated height and weight to calibrate. Loose clothing hides shape: rely on fitted photos, side views and visible arms and legs; say when something can't be seen.
Be factual and neutral. Never comment on attractiveness, health or ideal weight.`;

export async function analyzeBody(photos: { id: string; blob: Blob }[], facts: string): Promise<BodyProfile> {
  const content: Content[] = [{ type: "input_text", text: `${photos.length} photos of the same person, in order. ${facts}` }];
  for (const p of photos) content.push({ type: "input_image", image_url: await blobToDataUrl(p.blob), detail: "high" });
  const { data, costUsd } = await askJson<{
    photos: (Omit<PhotoNote, "id"> & { index: number })[];
    body: Record<string, string>;
    summary: string;
    tips: string[];
  }>({ name: "body_profile", instructions: BODY_RULES, maxTokens: 1200, schema: BODY_SCHEMA, content });
  const notes = (data.photos ?? [])
    .filter((n) => n.index >= 1 && n.index <= photos.length)
    .map(({ index, ...n }) => ({ ...n, id: photos[index - 1].id }));
  return { summary: data.summary, body: data.body, photos: notes, tips: (data.tips ?? []).slice(0, 3), costUsd };
}

/** Up-to-date body profile for a shopper: re-analysed only when their active photos change. */
export async function ensureBodyProfile(admin: SupabaseClient, userId: string) {
  const { data: photos } = await admin
    .from("body_photos")
    .select("id, storage_path, angle")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(6);
  const ids = (photos ?? []).map((p) => p.id).sort();
  if (!ids.length) return null;

  const { data: existing } = await admin.from("body_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (existing && [...existing.photo_ids].sort().join() === ids.join()) return existing;

  const { data: profile } = await admin.from("profiles").select("height_cm, weight_kg, shops_for").eq("id", userId).maybeSingle();
  const facts = [
    profile?.height_cm ? `Height ${profile.height_cm} cm.` : "",
    profile?.weight_kg ? `Weight ${profile.weight_kg} kg.` : "",
    `Photos labelled by the shopper as: ${(photos ?? []).map((p, i) => `${i + 1}=${p.angle}`).join(", ")}.`,
  ].join(" ");
  const blobs = await Promise.all((photos ?? []).map(async (p) => ({ id: p.id, blob: await download(admin, "body-photos", p.storage_path) })));
  const result = await analyzeBody(blobs, facts);
  const row = {
    user_id: userId,
    photo_ids: ids,
    summary: result.summary,
    body: result.body,
    photos: result.photos,
    tips: result.tips,
    cost_usd: Number(result.costUsd.toFixed(5)),
    updated_at: new Date().toISOString(),
  };
  await admin.from("body_profiles").upsert(row);
  return { ...row, costUsd: result.costUsd };
}

// ------------------------------------------------------------------ result check

export type QualityCheck = {
  garment_matches: boolean;
  identity_same: boolean;
  pose_same: boolean;
  anatomy_ok: boolean;
  rest_unchanged: boolean;
  photo_quality_ok: boolean;
  score: number;
  problems: string;
};

const QA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["garment_matches", "identity_same", "pose_same", "anatomy_ok", "rest_unchanged", "photo_quality_ok", "score", "problems"],
  properties: {
    garment_matches: { type: "boolean", description: "Image 3 shows the item from image 2: same type, colour, print, neckline, sleeves and length" },
    identity_same: { type: "boolean", description: "Same person as image 1: face, hair, skin tone" },
    pose_same: { type: "boolean", description: "Same pose, stance, framing and background as image 1" },
    anatomy_ok: { type: "boolean", description: "Natural body: correct number of arms, hands, fingers and legs; limbs the right length and thickness; nothing melted or merged" },
    rest_unchanged: { type: "boolean", description: "Everything that should not change (other clothes, shoes, what they hold) matches image 1" },
    photo_quality_ok: { type: "boolean", description: "As sharp and clean as image 1: no blur, smearing, noise, warped text or AI artefacts" },
    score: { type: "number", description: "0 to 1: how good a real shopper would find this try-on" },
    problems: { type: "string", description: "Under 30 words: what to fix, as instructions. Empty if nothing." },
  },
};

export async function checkResult(images: { customer: Blob; garment: Blob; result: Blob }, task: string): Promise<{ check: QualityCheck; costUsd: number }> {
  const { data, costUsd } = await askJson<QualityCheck>({
    name: "tryon_check",
    instructions:
      "You are a strict quality checker for a virtual fitting room. Image 1 is the customer's original photo, image 2 the item, image 3 the try-on result. Judge only image 3 against the task. A shopper must be able to trust it to decide whether to buy.",
    maxTokens: 400,
    schema: QA_SCHEMA,
    content: [
      { type: "input_text", text: `Task: ${task}` },
      { type: "input_image", image_url: await blobToDataUrl(images.customer), detail: "low" },
      { type: "input_image", image_url: await blobToDataUrl(images.garment), detail: "low" },
      { type: "input_image", image_url: await blobToDataUrl(images.result), detail: "high" },
    ],
  });
  return { check: { ...data, score: Math.max(0, Math.min(1, Number(data.score) || 0)) }, costUsd };
}

export function checkPassed(c: QualityCheck) {
  return c.garment_matches && c.pose_same && c.anatomy_ok && c.photo_quality_ok && c.score >= 0.72;
}
