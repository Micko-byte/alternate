// Runs a queued try-on: garment photo + customer photo + face-lock mask -> GPT Image 2.5.
// Credits were already charged by request_tryon(); any failure refunds them.
import { encodeBase64, decodeBase64 } from "jsr:@std/encoding@1/base64";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.88.0";
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";

const IMAGE_MODEL = Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-2.5-sunburst";
const TEXT_MODEL = Deno.env.get("OPENAI_TEXT_MODEL") ?? "gpt-6-astra";
const OUTPUT_SIZE = "1024x1536"; // must match the photo and mask made in the browser

const QUALITY: Record<string, string> = { standard: "medium", hd: "high", studio: "max" };

// USD per 1M tokens
const IMAGE_PRICE = { textIn: 5, imageIn: 8, imageOut: 30 };
const TEXT_PRICE = { input: 10, output: 50 };

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
};

const FIT_STYLE: Record<string, string> = {
  fitted: "a fitted, close-to-the-body fit",
  regular: "a regular, true-to-size fit",
  relaxed: "a relaxed fit with easy room through the body",
  oversized: "an oversized fit: dropped shoulders, extra width and length",
  baggy: "a baggy fit: very loose and roomy, wide through the body and legs, fabric falling in soft folds",
};

const LETTERS = ["", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

type Zone = "upper" | "lower" | "full";

function zoneFor(category: string | null): Zone {
  if (category === "top" || category === "outerwear") return "upper";
  if (category === "bottom" || category === "skirt") return "lower";
  return "full";
}

const ZONE_RULE: Record<Zone, string> = {
  upper: "Replace ONLY the customer's top. Their trousers or skirt, legs, shoes, hands, anything they are holding, and their exact pose must stay exactly as in image 1.",
  lower: "Replace ONLY the customer's trousers or skirt. Their top, arms, hands, anything they are holding (for example a phone), shoes, and their exact pose and stance must stay exactly as in image 1.",
  full: "Replace the customer's outfit with this garment. Their shoes, hands, anything they are holding, and their exact pose must stay exactly as in image 1.",
};

function sizeName(system: string | null, value: number | null) {
  if (!system || value == null) return null;
  if (system === "letter") return `size ${LETTERS[value] ?? value}`;
  if (system === "waist_in") return `a ${value}-inch waist`;
  return `UK size ${value}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const user = await callerFrom(req, admin);
  if (!user) return json({ error: "Sign in to try on clothes" }, 401);

  const { tryon_id } = await req.json().catch(() => ({}));
  if (!tryon_id) return json({ error: "Missing try-on" }, 400);

  const { data: existing } = await admin
    .from("tryons")
    .select("id, status")
    .eq("id", tryon_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) return json({ error: "Try-on not found" }, 404);
  if (existing.status !== "queued") return json({ status: existing.status });

  // Claim it so a double call can't run the same try-on twice
  const { data: claimed } = await admin
    .from("tryons")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", tryon_id)
    .eq("status", "queued")
    .select("id, user_id, body_photo_id, product_id, garment_upload_id, quality, attempts, fit, size_system, size_value, size_label")
    .maybeSingle();
  if (!claimed) return json({ status: "processing" });

  // @ts-ignore EdgeRuntime is provided by Supabase
  EdgeRuntime.waitUntil(run(admin, claimed as Tryon));
  return json({ status: "processing" }, 202);
});

async function run(admin: SupabaseClient, tryon: Tryon) {
  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set on the server");

    await admin.from("tryons").update({ attempts: tryon.attempts + 1 }).eq("id", tryon.id);

    const { data: photo } = await admin
      .from("body_photos")
      .select("storage_path, edit_mask_path, mask_upper_path, mask_lower_path")
      .eq("id", tryon.body_photo_id)
      .single();
    if (!photo) throw new Error("Body photo row missing");

    const personBlob = await download(admin, "body-photos", photo.storage_path);

    const [{ data: profile }, { data: sizeRows }] = await Promise.all([
      admin.from("profiles").select("height_cm, weight_kg").eq("id", tryon.user_id).maybeSingle(),
      admin.from("user_sizes").select("category, size_system, size_value").eq("user_id", tryon.user_id),
    ]);
    const usualSize = (category: string | null) => {
      const row = sizeRows?.find((r) => r.category === category);
      return row ? sizeName(row.size_system, row.size_value) : null;
    };

    let garmentBlob: Blob;
    let garmentNotes = "";
    let garmentName = "";
    let garmentCategory: string | null = null;
    let isCutout = false;
    let costUsd = 0;

    if (tryon.product_id) {
      const { data: product } = await admin
        .from("products")
        .select("id, name, description, category, garment_notes")
        .eq("id", tryon.product_id)
        .single();
      const { data: media } = await admin
        .from("product_media")
        .select("storage_path")
        .eq("product_id", tryon.product_id)
        .eq("kind", "image")
        .order("is_tryon_source", { ascending: false })
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!product || !media) throw new Error("This item has no photo to try on");
      garmentBlob = await download(admin, "store-media", media.storage_path);
      garmentName = product.name;
      garmentCategory = product.category;
      garmentNotes = product.garment_notes ?? "";
      if (!garmentNotes) {
        const described = await describeGarment(apiKey, garmentBlob, `${product.name} (${product.category}). ${product.description ?? ""}`);
        garmentNotes = described.text;
        costUsd += described.costUsd;
        if (garmentNotes) await admin.from("products").update({ garment_notes: garmentNotes }).eq("id", product.id);
      }
    } else {
      const { data: upload } = await admin
        .from("garment_uploads")
        .select("storage_path, cutout_path, category, source_note")
        .eq("id", tryon.garment_upload_id)
        .single();
      if (!upload) throw new Error("Screenshot row missing");
      garmentBlob = await download(admin, "garment-uploads", upload.cutout_path ?? upload.storage_path);
      garmentCategory = upload.category;
      isCutout = !!upload.cutout_path;
      const described = await describeGarment(apiKey, garmentBlob, `${upload.category ?? "garment"}. ${upload.source_note ?? ""}`);
      garmentNotes = described.text;
      costUsd += described.costUsd;
    }

    const zone = zoneFor(garmentCategory);
    const maskPath =
      (zone === "upper" ? photo.mask_upper_path : zone === "lower" ? photo.mask_lower_path : null) ?? photo.edit_mask_path;
    const maskBlob = maskPath ? await download(admin, "body-photos", maskPath) : null;

    const prompt = buildPrompt(garmentName, garmentNotes, zone, isCutout, {
      heightCm: profile?.height_cm ?? null,
      weightKg: profile?.weight_kg ?? null,
      usualSize: usualSize(garmentCategory),
      wornSize: tryon.product_id ? (tryon.size_label ? `size ${tryon.size_label}` : sizeName(tryon.size_system, tryon.size_value)) : null,
      fit: tryon.fit,
    });

    const form = new FormData();
    form.append("model", IMAGE_MODEL);
    form.append("prompt", prompt);
    form.append("size", OUTPUT_SIZE);
    form.append("quality", QUALITY[tryon.quality] ?? "medium");
    form.append("output_format", "png");
    form.append("n", "1");
    form.append("image[]", new File([personBlob], "customer.png", { type: "image/png" }));
    form.append("image[]", new File([garmentBlob], "garment", { type: garmentBlob.type || "image/jpeg" }));
    if (maskBlob) form.append("mask", new File([maskBlob], "mask.png", { type: "image/png" }));

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${body?.error?.message ?? "image edit failed"}`);

    const b64 = body?.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI returned no image");

    const usage = body.usage ?? {};
    const details = usage.input_tokens_details ?? {};
    costUsd +=
      ((details.text_tokens ?? 0) * IMAGE_PRICE.textIn +
        (details.image_tokens ?? 0) * IMAGE_PRICE.imageIn +
        (usage.output_tokens ?? 0) * IMAGE_PRICE.imageOut) /
      1_000_000;

    const resultPath = `${tryon.user_id}/${tryon.id}.png`;
    const { error: uploadError } = await admin.storage
      .from("tryon-results")
      .upload(resultPath, decodeBase64(b64), { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`Saving result failed: ${uploadError.message}`);

    await admin
      .from("tryons")
      .update({
        status: "succeeded",
        result_path: resultPath,
        engine: `openai:${IMAGE_MODEL}:${QUALITY[tryon.quality] ?? "medium"}`,
        garment_instruction: prompt,
        cost_usd: Number(costUsd.toFixed(5)),
        edit_mask_path: maskPath,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", tryon.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("tryon failed", tryon.id, message);
    await admin.rpc("refund_tryon", { _tryon_id: tryon.id, _reason: message.slice(0, 500) });
  }
}

async function download(admin: SupabaseClient, bucket: string, path: string): Promise<Blob> {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Could not read ${bucket}/${path}`);
  return data;
}

type Body = { heightCm: number | null; weightKg: number | null; usualSize: string | null; wornSize: string | null; fit: string };

function buildPrompt(name: string, notes: string, zone: Zone, isCutout: boolean, body: Body) {
  const measurements = [
    body.heightCm ? `${body.heightCm} cm tall` : "",
    body.weightKg ? `${body.weightKg} kg` : "",
    body.usualSize ? `normally wears ${body.usualSize}` : "",
  ].filter(Boolean);
  const style = FIT_STYLE[body.fit] ?? FIT_STYLE.regular;
  const fit = body.wornSize
    ? `Show the garment in ${body.wornSize}${body.usualSize && body.wornSize !== body.usualSize ? ` (sized up from their usual ${body.usualSize})` : ""}, worn with ${style}. It must hang exactly as that size would on this body: not tighter, looser, shorter or longer than it really would.`
    : `Style it with ${style}, as the garment would realistically look in the customer's usual size with that fit.`;
  return [
    "Virtual try-on for a clothing shop.",
    "Image 1 is the customer. Image 2 shows " + (isCutout ? "only the garment, cut out on white" : "the garment") + (name ? ` "${name}"` : "") + ".",
    ZONE_RULE[zone],
    notes ? `The garment: ${notes}` : "",
    measurements.length ? `The customer is ${measurements.join(", ")}.` : "",
    fit,
    "Dress the customer in exactly this garment.",
    "Keep the customer's face, hair, skin tone, body shape, pose, hands, background, lighting and camera framing exactly as in image 1. Do not copy anything else from image 2: no other clothes, accessories, pose or background.",
    "Reproduce the garment's colour, print, fabric, neckline, sleeves and length faithfully, hanging naturally on the customer's body in the requested fit, with realistic folds and shadows.",
    "Do not add accessories, text, logos or other people. Photorealistic, like an unedited phone photo.",
  ]
    .filter(Boolean)
    .join(" ");
}

// GPT-6 Astra writes a precise garment description once; it is cached on the product.
// If it fails, the try-on still runs with the image alone.
async function describeGarment(apiKey: string, garment: Blob, hint: string): Promise<{ text: string; costUsd: number }> {
  try {
    const bytes = new Uint8Array(await garment.arrayBuffer());
    const dataUrl = `data:${garment.type || "image/jpeg"};base64,${encodeBase64(bytes)}`;
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TEXT_MODEL,
        max_output_tokens: 400,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Describe only the main garment in this image for a virtual try-on, in one paragraph under 70 words: type, cut, neckline, sleeves, length, fit, fabric, exact colours and print. Ignore the person, background and accessories. Shop hint: " +
                  hint,
              },
              { type: "input_image", image_url: dataUrl },
            ],
          },
        ],
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      console.error("describeGarment", res.status, body?.error?.message);
      return { text: "", costUsd: 0 };
    }
    const text = (body.output ?? [])
      .flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? [])
      .filter((c: { type: string }) => c.type === "output_text")
      .map((c: { text?: string }) => c.text ?? "")
      .join(" ")
      .trim();
    const usage = body.usage ?? {};
    const costUsd = ((usage.input_tokens ?? 0) * TEXT_PRICE.input + (usage.output_tokens ?? 0) * TEXT_PRICE.output) / 1_000_000;
    return { text, costUsd };
  } catch (err) {
    console.error("describeGarment", err);
    return { text: "", costUsd: 0 };
  }
}
