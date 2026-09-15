// Runs a queued try-on: customer photo + item photo + zone mask (+ reference photos) -> GPT Image 2.5,
// then an automatic quality check. A result that fails the check is redone with the problems fixed;
// the best attempt is kept, and if none is good enough the credits go back.
// Credits were already charged by request_tryon(); any failure refunds them.
//
// Each attempt runs in its own function call (a single call has a time limit): when an attempt fails
// the check, this function calls itself with the service key to run the next one.
import { decodeBase64 } from "jsr:@std/encoding@1/base64";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.88.0";
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import {
  CATEGORY_NAME,
  UserError,
  categoryMatches,
  checkPassed,
  checkResult,
  download,
  ensureBodyProfile,
  inspectGarment,
  itemFor,
  type PhotoNote,
  type QualityCheck,
} from "../_shared/ai.ts";

const IMAGE_MODEL = Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-2.5-sunburst";
const OUTPUT_SIZE = "1024x1536"; // must match the photo and mask made in the browser

// Every tier renders at high quality or better; higher tiers add reference photos and attempts
const TIER: Record<string, { quality: string; references: number; attempts: number }> = {
  standard: { quality: "high", references: 1, attempts: 2 },
  hd: { quality: "high", references: 2, attempts: 2 },
  studio: { quality: "max", references: 3, attempts: 3 },
};

// USD per 1M tokens
const IMAGE_PRICE = { textIn: 5, imageIn: 8, imageOut: 30 };

let supportsInputFidelity = true;

type Tryon = {
  id: string;
  user_id: string;
  body_photo_id: string;
  product_id: string | null;
  garment_upload_id: string | null;
  quality: string;
  attempts: number;
  fit: string;
  size_system: string | null;
  size_value: number | null;
  size_label: string | null;
  garment_type: string | null;
  cost_usd: number | null;
  qa: { attempts?: Attempt[] } | null;
};

type Attempt = { n: number; path: string; check: QualityCheck | null; passed: boolean };

const TRYON_COLUMNS = "id, user_id, body_photo_id, product_id, garment_upload_id, quality, attempts, fit, size_system, size_value, size_label, garment_type, cost_usd, qa";

const FIT_STYLE: Record<string, string> = {
  fitted: "a fitted, close-to-the-body fit",
  regular: "a regular, true-to-size fit",
  relaxed: "a relaxed fit with easy room through the body",
  oversized: "an oversized fit: dropped shoulders, extra width and length",
  baggy: "a baggy fit: very loose and roomy, wide through the body and legs, fabric falling in soft folds",
};

const LETTERS = ["", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

type Zone = "upper" | "lower" | "full" | "feet" | "eyes" | "head" | "jewellery";

function zoneFor(category: string | null): Zone {
  switch (category) {
    case "top":
    case "outerwear":
      return "upper";
    case "bottom":
    case "skirt":
      return "lower";
    case "shoes":
      return "feet";
    case "eyewear":
      return "eyes";
    case "headwear":
      return "head";
    case "jewellery":
      return "jewellery";
    default:
      return "full";
  }
}

const MASK_COLUMN: Record<Zone, string> = {
  upper: "mask_upper_path",
  lower: "mask_lower_path",
  full: "edit_mask_path",
  feet: "mask_feet_path",
  eyes: "mask_eyes_path",
  head: "mask_head_path",
  jewellery: "mask_jewellery_path",
};

function zoneRule(category: string | null, zone: Zone) {
  const keep = "their exact pose and stance, hands, anything they are holding (for example a phone), and the background";
  switch (zone) {
    case "upper":
      return category === "outerwear"
        ? `Put this jacket or coat on the customer as the outer layer, over what they are wearing: their own top may show at the neckline or where the jacket is open, exactly as it would in real life. Their trousers or skirt, legs, shoes, ${keep} must stay exactly as in image 1.`
        : `Replace ONLY the customer's top. Their trousers or skirt, legs, shoes, ${keep} must stay exactly as in image 1.`;
    case "lower":
      return `Replace ONLY the customer's trousers or skirt. Their top, arms, shoes (unless the new trousers cover them), ${keep} must stay exactly as in image 1.`;
    case "feet":
      return `Replace ONLY the customer's shoes. Their clothes, legs above the ankle, ${keep} must stay exactly as in image 1. The shoes stand on the same ground, at a true-to-life size for their feet.`;
    case "eyes":
      return `Add ONLY these glasses to the customer's face, sitting naturally on the nose and ears at the correct size for their face. Their eyes, eyebrows, face shape, skin, hair, expression, clothes, ${keep} must stay exactly as in image 1.`;
    case "head":
      return `Put ONLY this hat or headwear on the customer's head at a realistic size. Hair changes only where the headwear covers it. Their face, clothes, ${keep} must stay exactly as in image 1.`;
    case "jewellery":
      return `Add ONLY this jewellery to the customer where it is worn (neck, ears, wrist or fingers) at a true-to-life size. Their face, skin, clothes, ${keep} must stay exactly as in image 1.`;
    default:
      return `Replace the customer's outfit with this garment. Their shoes, ${keep} must stay exactly as in image 1.`;
  }
}

function sizeName(system: string | null, value: number | null) {
  if (!system || value == null) return null;
  if (system === "letter") return `size ${LETTERS[value] ?? value}`;
  if (system === "waist_in") return `a ${value}-inch waist`;
  return `UK size ${value}`;
}

function isInternal(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return !!token && !!key && token === key;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const { tryon_id } = await req.json().catch(() => ({}));
  if (!tryon_id) return json({ error: "Missing try-on" }, 400);

  // Next attempt, started by this function itself
  if (isInternal(req)) {
    const { data } = await admin.from("tryons").select(TRYON_COLUMNS).eq("id", tryon_id).eq("status", "processing").maybeSingle();
    if (!data) return json({ status: "gone" });
    // @ts-ignore EdgeRuntime is provided by Supabase
    EdgeRuntime.waitUntil(runAttempt(admin, data as Tryon));
    return json({ status: "processing" }, 202);
  }

  const user = await callerFrom(req, admin);
  if (!user) return json({ error: "Sign in to try on clothes" }, 401);

  const { data: existing } = await admin.from("tryons").select("id, status").eq("id", tryon_id).eq("user_id", user.id).maybeSingle();
  if (!existing) return json({ error: "Try-on not found" }, 404);
  if (existing.status !== "queued") return json({ status: existing.status });

  // Claim it so a double call can't run the same try-on twice
  const { data: claimed } = await admin
    .from("tryons")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", tryon_id)
    .eq("status", "queued")
    .select(TRYON_COLUMNS)
    .maybeSingle();
  if (!claimed) return json({ status: "processing" });

  // @ts-ignore EdgeRuntime is provided by Supabase
  EdgeRuntime.waitUntil(runAttempt(admin, claimed as Tryon));
  return json({ status: "processing" }, 202);
});

async function runAttempt(admin: SupabaseClient, tryon: Tryon) {
  const tier = TIER[tryon.quality] ?? TIER.standard;
  const n = tryon.attempts + 1;
  const attempts: Attempt[] = [...(tryon.qa?.attempts ?? [])];
  let costUsd = Number(tryon.cost_usd ?? 0);

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set on the server");
    await admin.from("tryons").update({ attempts: n }).eq("id", tryon.id);

    const prepared = await prepare(admin, tryon);
    costUsd += prepared.costUsd;

    const fixes = attempts.map((a) => a.check?.problems).filter(Boolean).at(-1);
    const prompt = prepared.prompt + (fixes ? ` A previous attempt was rejected by quality control. Fix this: ${fixes}` : "");

    const generated = await generate(apiKey, {
      prompt,
      quality: tier.quality,
      person: prepared.person,
      garment: prepared.garment,
      mask: prepared.mask,
      references: prepared.references.map((r) => r.blob),
    });
    costUsd += generated.costUsd;

    const workPath = `${tryon.user_id}/${tryon.id}/attempt-${n}.png`;
    const { error: workError } = await admin.storage.from("tryon-work").upload(workPath, generated.png, { contentType: "image/png", upsert: true });
    if (workError) throw new Error(`Saving attempt failed: ${workError.message}`);

    // Quality check. If the checker itself is down, the result is kept rather than thrown away.
    let check: QualityCheck | null = null;
    try {
      const checked = await checkResult(
        { customer: prepared.person, garment: prepared.garment, result: new Blob([generated.png], { type: "image/png" }) },
        prepared.task,
      );
      check = checked.check;
      costUsd += checked.costUsd;
    } catch (err) {
      console.error("quality check unavailable", tryon.id, err);
    }
    const passed = check ? checkPassed(check) : true;
    attempts.push({ n, path: workPath, check, passed });

    const common = {
      engine: `openai:${IMAGE_MODEL}:${tier.quality}`,
      garment_instruction: prompt,
      garment_type: prepared.garmentType,
      reference_photo_ids: prepared.references.map((r) => r.id),
      edit_mask_path: prepared.maskPath,
      cost_usd: Number(costUsd.toFixed(5)),
    };

    if (!passed && n < tier.attempts) {
      await admin.from("tryons").update({ ...common, qa: { attempts } }).eq("id", tryon.id);
      await continueLater(tryon.id);
      return;
    }

    const best = [...attempts].sort((a, b) => Number(b.passed) - Number(a.passed) || (b.check?.score ?? 1) - (a.check?.score ?? 1))[0];
    if (!best.passed && best.check && (!best.check.garment_matches || best.check.score < 0.45)) {
      await admin.from("tryons").update({ ...common, qa: { attempts } }).eq("id", tryon.id);
      throw new UserError(
        `We couldn't make a try-on good enough to show you${best.check.problems ? ` (${best.check.problems.replace(/\.$/, "")})` : ""}. Your credits are back. A clearer photo of the item usually fixes this.`,
      );
    }

    const bestPng = best.n === n ? generated.png : new Uint8Array(await (await download(admin, "tryon-work", best.path)).arrayBuffer());
    const resultPath = `${tryon.user_id}/${tryon.id}.png`;
    const { error: uploadError } = await admin.storage.from("tryon-results").upload(resultPath, bestPng, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`Saving result failed: ${uploadError.message}`);

    await admin
      .from("tryons")
      .update({
        ...common,
        status: "succeeded",
        result_path: resultPath,
        identity_score: best.check ? Number(best.check.score.toFixed(3)) : null,
        qa: { attempts, chosen: best.n, passed: best.passed },
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", tryon.id);
  } catch (err) {
    const message = err instanceof UserError ? err.message : `Technical: ${err instanceof Error ? err.message : String(err)}`;
    console.error("tryon failed", tryon.id, message);
    await admin.from("tryons").update({ cost_usd: Number(costUsd.toFixed(5)) }).eq("id", tryon.id);
    await admin.rpc("refund_tryon", { _tryon_id: tryon.id, _reason: message.slice(0, 500) });
  }
}

async function continueLater(tryonId: string) {
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/tryon-process`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tryon_id: tryonId }),
  });
  if (!res.ok) throw new Error(`Couldn't start the next attempt (${res.status})`);
}

/** Everything one attempt needs: images, mask, references and the prompt. */
async function prepare(admin: SupabaseClient, tryon: Tryon) {
  let costUsd = 0;

  const { data: photo } = await admin
    .from("body_photos")
    .select("id, storage_path, edit_mask_path, mask_upper_path, mask_lower_path, mask_feet_path, mask_eyes_path, mask_head_path, mask_jewellery_path")
    .eq("id", tryon.body_photo_id)
    .single();
  if (!photo) throw new Error("Body photo row missing");

  const [person, { data: profile }, { data: sizeRows }] = await Promise.all([
    download(admin, "body-photos", photo.storage_path),
    admin.from("profiles").select("height_cm, weight_kg").eq("id", tryon.user_id).maybeSingle(),
    admin.from("user_sizes").select("category, size_system, size_value").eq("user_id", tryon.user_id),
  ]);
  const usualSize = (category: string | null) => {
    const row = sizeRows?.find((r) => r.category === category);
    return row ? sizeName(row.size_system, row.size_value) : null;
  };

  // ---- the item, and a server check of what the photo really shows
  let garment: Blob;
  let inspectedPath: string;
  let garmentName = "";
  let category: string | null;
  let hint: string;
  let isCutout = false;
  let cachedNotes = "";

  if (tryon.product_id) {
    const { data: product } = await admin.from("products").select("id, name, description, category, garment_notes").eq("id", tryon.product_id).single();
    const { data: media } = await admin
      .from("product_media")
      .select("storage_path")
      .eq("product_id", tryon.product_id)
      .eq("kind", "image")
      .order("is_tryon_source", { ascending: false })
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!product || !media) throw new UserError("This item has no photo to try on. Your credits are back.");
    garment = await download(admin, "store-media", media.storage_path);
    inspectedPath = media.storage_path;
    garmentName = product.name;
    category = product.category;
    cachedNotes = product.garment_notes ?? "";
    hint = `${product.name}. ${product.description ?? ""}`;
  } else {
    const { data: upload } = await admin.from("garment_uploads").select("storage_path, cutout_path, category, source_note").eq("id", tryon.garment_upload_id).single();
    if (!upload) throw new Error("Inspiration row missing");
    garment = await download(admin, "garment-uploads", upload.cutout_path ?? upload.storage_path);
    inspectedPath = upload.storage_path;
    category = upload.category;
    isCutout = !!upload.cutout_path;
    hint = `${tryon.garment_type ?? ""} ${upload.source_note ?? ""}`;
  }

  const key = tryon.product_id ? { product_id: tryon.product_id } : { garment_upload_id: tryon.garment_upload_id };
  const keyColumn = tryon.product_id ? "product_id" : "garment_upload_id";
  const keyValue = tryon.product_id ?? tryon.garment_upload_id;
  let { data: inspection } = await admin.from("garment_inspections").select("categories, items, is_wearable, source_path").eq(keyColumn, keyValue).maybeSingle();
  if (!inspection || inspection.source_path !== inspectedPath) {
    const original = tryon.product_id || !isCutout ? garment : await download(admin, "garment-uploads", inspectedPath);
    const fresh = await inspectGarment(original, hint);
    costUsd += fresh.costUsd;
    const row = { ...key, source_path: inspectedPath, categories: fresh.categories, items: fresh.items, is_wearable: fresh.is_wearable, cost_usd: Number(fresh.costUsd.toFixed(5)) };
    await admin.from("garment_inspections").upsert(row, { onConflict: keyColumn });
    inspection = row;
  }
  if (!inspection.is_wearable) throw new UserError("We couldn't find clothes, shoes or accessories in that photo. Your credits are back.");
  if (!categoryMatches(category, inspection.categories)) {
    const shows = inspection.categories.map((c: string) => CATEGORY_NAME[c]).join(" and ");
    throw new UserError(
      tryon.product_id
        ? `This piece's photo shows ${shows}, but it's listed as ${CATEGORY_NAME[category ?? "other"]}. Your credits are back.`
        : `This photo shows ${shows}, not ${CATEGORY_NAME[category ?? "other"]}. Your credits are back. Choose what the photo shows and try again.`,
    );
  }
  const item = itemFor(inspection, category);
  const garmentType = tryon.garment_type ?? item?.type ?? null;
  const notes = cachedNotes || item?.description || "";
  if (tryon.product_id && !cachedNotes && notes) await admin.from("products").update({ garment_notes: notes }).eq("id", tryon.product_id);

  // ---- mask for the zone this item changes
  const zone = zoneFor(category);
  const maskPath = (photo as Record<string, string | null>)[MASK_COLUMN[zone]] ?? (zone === "upper" || zone === "lower" ? photo.edit_mask_path : null);
  if (!maskPath) throw new UserError("Your photo needs a quick update before trying on this kind of item. Open the fitting room and try again. Your credits are back.");
  if (!maskPath.startsWith(`${tryon.user_id}/`)) throw new Error("Mask outside the owner's folder");
  const mask = await download(admin, "body-photos", maskPath);

  // ---- body profile from all photos, and the most useful other photos as references
  const tier = TIER[tryon.quality] ?? TIER.standard;
  let bodySummary = "";
  let references: { id: string; blob: Blob }[] = [];
  try {
    const body = await ensureBodyProfile(admin, tryon.user_id);
    if (body) {
      costUsd += (body as { costUsd?: number }).costUsd ?? 0;
      bodySummary = body.summary ?? "";
      const wanted = zone === "eyes" || zone === "head" || zone === "jewellery" ? 0 : tier.references;
      const ids = pickReferences(body.photos as PhotoNote[], photo.id, zone, wanted);
      if (ids.length) {
        const { data: refs } = await admin.from("body_photos").select("id, storage_path").in("id", ids).eq("user_id", tryon.user_id).eq("is_active", true);
        references = await Promise.all((refs ?? []).map(async (r) => ({ id: r.id, blob: await download(admin, "body-photos", r.storage_path) })));
      }
    }
  } catch (err) {
    // The try-on still works from the single photo
    console.error("body profile unavailable", tryon.id, err);
  }

  const measurements = [
    profile?.height_cm ? `${profile.height_cm} cm tall` : "",
    profile?.weight_kg ? `${profile.weight_kg} kg` : "",
    usualSize(category) ? `normally wears ${usualSize(category)}` : "",
  ].filter(Boolean);
  const wornSize = tryon.product_id ? (tryon.size_label ? `size ${tryon.size_label}` : sizeName(tryon.size_system, tryon.size_value)) : null;
  const style = FIT_STYLE[tryon.fit] ?? FIT_STYLE.regular;
  const sized = !["shoes", "eyewear", "headwear", "jewellery"].includes(category ?? "");
  const fit = !sized
    ? ""
    : wornSize
      ? `Show the garment in ${wornSize}${usualSize(category) && wornSize !== usualSize(category) ? ` (sized up from their usual ${usualSize(category)})` : ""}, worn with ${style}. It must hang exactly as that size would on this body: not tighter, looser, shorter or longer than it really would.`
      : `Style it with ${style}, as the garment would realistically look in the customer's usual size with that fit.`;
  const itemName = garmentType ?? CATEGORY_NAME[category ?? "other"];

  const prompt = [
    "Virtual try-on for a clothing shop.",
    `Image 1 is the customer. Image 2 shows ${isCutout ? "only the item, cut out on white" : "the item"}: ${itemName}${garmentName ? ` "${garmentName}"` : ""}.`,
    references.length
      ? `Images 3${references.length > 1 ? `-${references.length + 2}` : ""} are the same customer from other angles. Use them only to understand their real body: shoulder width, arm and leg length and thickness, torso and hips, so the item sits correctly. Do not copy their clothes, pose or background.`
      : "",
    zoneRule(category, zone),
    notes ? `The item: ${notes}` : "",
    bodySummary ? `The customer's body, from all their photos: ${bodySummary}` : "",
    measurements.length ? `The customer is ${measurements.join(", ")}.` : "",
    fit,
    "Keep the customer's face, hair, skin tone, body shape, limb proportions, pose, hands, background, lighting and camera framing exactly as in image 1. Do not copy anything else from image 2: no other clothes, accessories, pose or background.",
    "Reproduce the item's colour, print, fabric texture, stitching and details faithfully, sitting naturally on the customer with realistic folds, shadows and contact with the body.",
    "Match the sharpness, grain, colour balance and lighting of image 1 exactly, so the result looks like the same unedited photo. No blur, smoothing, text, logos, extra accessories or other people.",
  ]
    .filter(Boolean)
    .join(" ");

  const task = `Put ${itemName} (${CATEGORY_NAME[category ?? "other"]}) from image 2 on the customer in image 1. ${zoneRule(category, zone)}`;

  return { person, garment, mask, maskPath, references, prompt, task, garmentType, costUsd };
}

/** The other photos that show most about the body where this item sits. */
function pickReferences(notes: PhotoNote[] | null, targetId: string, zone: Zone, count: number) {
  if (!count || !notes?.length) return [];
  return notes
    .filter((p) => p.id !== targetId && p.usable)
    .map((p) => {
      let score = 1;
      if (p.angle === "side") score += 2;
      if (p.full_body) score += 1;
      if (p.clothing_fit === "fitted") score += 1;
      if ((zone === "upper" || zone === "full") && p.arms_visible) score += 2;
      if ((zone === "lower" || zone === "full" || zone === "feet") && p.legs_visible) score += 2;
      return { id: p.id, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((p) => p.id);
}

async function generate(
  apiKey: string,
  input: { prompt: string; quality: string; person: Blob; garment: Blob; mask: Blob; references: Blob[] },
): Promise<{ png: Uint8Array; costUsd: number }> {
  const send = (withFidelity: boolean) => {
    const form = new FormData();
    form.append("model", IMAGE_MODEL);
    form.append("prompt", input.prompt);
    form.append("size", OUTPUT_SIZE);
    form.append("quality", input.quality);
    form.append("output_format", "png");
    form.append("n", "1");
    if (withFidelity) form.append("input_fidelity", "high");
    form.append("image[]", new File([input.person], "customer.png", { type: "image/png" }));
    form.append("image[]", new File([input.garment], "item", { type: input.garment.type || "image/jpeg" }));
    input.references.forEach((r, i) => form.append("image[]", new File([r], `reference-${i + 1}.png`, { type: "image/png" })));
    form.append("mask", new File([input.mask], "mask.png", { type: "image/png" }));
    return fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  };

  let res = await send(supportsInputFidelity);
  let body = await res.json();
  if (!res.ok && supportsInputFidelity && /input_fidelity/i.test(body?.error?.message ?? "")) {
    supportsInputFidelity = false;
    res = await send(false);
    body = await res.json();
  }
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${body?.error?.message ?? "image edit failed"}`);

  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  const usage = body.usage ?? {};
  const details = usage.input_tokens_details ?? {};
  const costUsd =
    ((details.text_tokens ?? 0) * IMAGE_PRICE.textIn + (details.image_tokens ?? 0) * IMAGE_PRICE.imageIn + (usage.output_tokens ?? 0) * IMAGE_PRICE.imageOut) / 1_000_000;
  return { png: decodeBase64(b64), costUsd };
}
