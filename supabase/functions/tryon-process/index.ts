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
  type InspectionItem,
  type PhotoNote,
  type QualityCheck,
} from "../_shared/ai.ts";
import { LENGTHS, bakeInPhoto, editableGrid, lengthFromCm, lengthSteps, maskPng, readPartsMap } from "../_shared/body.ts";
import { bodyForSize, estimateGarment, measurementRule, type Areas } from "../_shared/garmentFit.ts";

const IMAGE_MODEL = Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-2.5-sunburst";
const OUTPUT_SIZE = "1024x1536"; // must match the photo and the masks

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
  variant_id: string | null;
  cost_usd: number | null;
  qa: { attempts?: Attempt[] } | null;
};

type Attempt = { n: number; path: string; check: QualityCheck | null; passed: boolean; check_error?: string };

const TRYON_COLUMNS = "id, user_id, body_photo_id, product_id, garment_upload_id, quality, attempts, fit, size_system, size_value, size_label, garment_type, variant_id, cost_usd, qa";

// The fit changes only how close the fabric sits, never the length or the design lines
const FIT_STYLE: Record<string, string> = {
  fitted: "FIT: FITTED, skin-tight like bodycon. The fabric hugs the bust, waist, hips and thighs and follows every curve with no loose fabric or gaps, with slight tension across the bust and hips. Design lines such as an A-line skirt stay, but everything that can sit close does.",
  regular: "FIT: REGULAR, true to size. The fabric follows the body's shape with a little room (about 2-4 cm), skimming rather than clinging, with soft natural folds. Clearly less tight than a fitted look.",
  relaxed: "FIT: RELAXED. Easy room through the body (about 6-10 cm), fabric falls away from the waist and hips instead of following them.",
  oversized: "FIT: OVERSIZED. Dropped shoulders, visibly extra width through the body and sleeves; the body's curves are not visible through the fabric.",
  baggy: "FIT: BAGGY. Very loose and roomy, wide through the body and legs, fabric falling in deep soft folds.",
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
    let checkError: string | undefined;
    try {
      const checked = await checkResult(
        { customer: prepared.person, garment: prepared.garment, result: new Blob([generated.png as Uint8Array<ArrayBuffer>], { type: "image/png" }) },
        prepared.task,
      );
      check = checked.check;
      costUsd += checked.costUsd;
    } catch (err) {
      checkError = (err instanceof Error ? err.message : String(err)).slice(0, 300);
      console.error("quality check unavailable", tryon.id, checkError);
    }
    const passed = check ? checkPassed(check) : true;
    attempts.push({ n, path: workPath, check, passed, ...(checkError ? { check_error: checkError } : {}) });

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

    let bestPng = best.n === n ? generated.png : new Uint8Array(await (await download(admin, "tryon-work", best.path)).arrayBuffer());
    const { data: privacy } = await admin.from("profiles").select("delete_photos_after_tryon").eq("id", tryon.user_id).maybeSingle();
    const deletePhotos = !!privacy?.delete_photos_after_tryon;
    if (deletePhotos) {
      // The viewer can't paste the original back once it's gone, so bake it into the result now
      bestPng = bakeInPhoto(bestPng, new Uint8Array(await prepared.person.arrayBuffer()), new Uint8Array(await prepared.mask.arrayBuffer()));
    }
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
        ...(deletePhotos ? { edit_mask_path: null } : {}),
      })
      .eq("id", tryon.id);

    if (deletePhotos) await deleteUsedPhotos(admin, tryon, [tryon.body_photo_id, ...prepared.references.map((r) => r.id)], attempts);
  } catch (err) {
    const message = err instanceof UserError ? err.message : `Technical: ${err instanceof Error ? err.message : String(err)}`;
    console.error("tryon failed", tryon.id, message);
    await admin.from("tryons").update({ cost_usd: Number(costUsd.toFixed(5)) }).eq("id", tryon.id);
    await admin.rpc("refund_tryon", { _tryon_id: tryon.id, _reason: message.slice(0, 500) });
  }
}

/** The shopper chose to have their photos deleted as soon as a try-on is made. */
async function deleteUsedPhotos(admin: SupabaseClient, tryon: Tryon, photoIds: string[], attempts: Attempt[]) {
  try {
    const { data: photos } = await admin
      .from("body_photos")
      .select("id, storage_path, parts_map_path, edit_mask_path, mask_upper_path, mask_lower_path, mask_feet_path, mask_eyes_path, mask_head_path, mask_jewellery_path")
      .in("id", photoIds)
      .eq("user_id", tryon.user_id);
    const files = (photos ?? []).flatMap((p) => [
      p.storage_path, p.parts_map_path, p.edit_mask_path, p.mask_upper_path, p.mask_lower_path, p.mask_feet_path, p.mask_eyes_path, p.mask_head_path, p.mask_jewellery_path,
    ]).filter((f): f is string => !!f && f.startsWith(`${tryon.user_id}/`));
    files.push(`${tryon.user_id}/masks/tryon-${tryon.id}.png`);
    await admin.storage.from("body-photos").remove(files);
    await admin.storage.from("tryon-work").remove(attempts.map((a) => a.path));
    // Rows stay (past try-ons point at them) but are no longer usable; the face mask is kept for blurring saved images
    await admin.from("body_photos").update({ is_active: false }).in("id", (photos ?? []).map((p) => p.id));
    await admin.from("body_profiles").delete().eq("user_id", tryon.user_id);
  } catch (err) {
    console.error("deleting photos after try-on failed", tryon.id, err);
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
    .select("id, storage_path, parts_map_path, edit_mask_path, mask_upper_path, mask_lower_path, mask_feet_path, mask_eyes_path, mask_head_path, mask_jewellery_path")
    .eq("id", tryon.body_photo_id)
    .single();
  if (!photo) throw new Error("Body photo row missing");

  const [person, { data: profile }, { data: sizeRows }, { data: measurements }] = await Promise.all([
    download(admin, "body-photos", photo.storage_path),
    admin.from("profiles").select("height_cm, shops_for").eq("id", tryon.user_id).maybeSingle(),
    admin.from("user_sizes").select("category, size_system, size_value").eq("user_id", tryon.user_id),
    admin.from("body_measurements").select("bust_cm, waist_cm, hips_cm, sources, accuracy_cm").eq("user_id", tryon.user_id).maybeSingle(),
  ]);
  const usualRow = (category: string | null) => sizeRows?.find((r) => r.category === category) ?? null;

  // ---- the item, and a server check of what the photo really shows
  let garment: Blob;
  let inspectedPath: string;
  let garmentName = "";
  let category: string | null;
  let hint: string;
  let isCutout = false;
  let cachedNotes = "";
  let chosenLength: string | null = null;
  let lengthCm: number | null = null;
  let labelSize: string | null = null;
  let garmentMeasurements: Record<string, number> | null = null;
  let stretch: string | null = null;
  let menswear = profile?.shops_for === "men";

  if (tryon.product_id) {
    const { data: product } = await admin.from("products").select("id, name, description, category, department, garment_notes, length, length_cm, stretch").eq("id", tryon.product_id).single();
    if (tryon.variant_id) {
      const { data: variant } = await admin.from("product_variants").select("measurements").eq("id", tryon.variant_id).maybeSingle();
      garmentMeasurements = (variant?.measurements as Record<string, number> | null) ?? null;
    }
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
    chosenLength = product.length;
    lengthCm = garmentMeasurements?.length ?? product.length_cm;
    stretch = product.stretch;
    menswear = product.department === "men";
  } else {
    const { data: upload } = await admin
      .from("garment_uploads")
      .select("storage_path, cutout_path, category, source_note, length, length_cm, size_label, measurements, stretch")
      .eq("id", tryon.garment_upload_id)
      .single();
    if (!upload) throw new Error("Inspiration row missing");
    garment = await download(admin, "garment-uploads", upload.cutout_path ?? upload.storage_path);
    inspectedPath = upload.storage_path;
    category = upload.category;
    isCutout = !!upload.cutout_path;
    hint = `${tryon.garment_type ?? ""} ${upload.source_note ?? ""}`;
    chosenLength = upload.length;
    garmentMeasurements = (upload.measurements as Record<string, number> | null) ?? null;
    lengthCm = garmentMeasurements?.length ?? upload.length_cm;
    labelSize = upload.size_label;
    stretch = upload.stretch;
  }

  const key = tryon.product_id ? { product_id: tryon.product_id } : { garment_upload_id: tryon.garment_upload_id };
  const keyColumn = tryon.product_id ? "product_id" : "garment_upload_id";
  const keyValue = tryon.product_id ?? tryon.garment_upload_id;
  let { data: inspection } = await admin.from("garment_inspections").select("categories, items, is_wearable, source_path").eq(keyColumn, keyValue).maybeSingle();
  // Re-check photos inspected before length, sleeves and silhouette were read
  const outdated = !!inspection && !(inspection.items ?? []).some((i: InspectionItem) => "design_ease" in i);
  if (!inspection || outdated || inspection.source_path !== inspectedPath) {
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
  const item: InspectionItem | null = itemFor(inspection, category);
  const garmentType = tryon.garment_type ?? item?.type ?? null;
  const notes = cachedNotes || item?.description || "";
  if (tryon.product_id && !cachedNotes && notes) await admin.from("products").update({ garment_notes: notes }).eq("id", tryon.product_id);

  // ---- length: chosen by the shopper or store > measured length in cm > as designed (read from the photo)
  const hasLength = !["shoes", "eyewear", "headwear", "jewellery"].includes(category ?? "");
  const designLength = item?.length && LENGTHS[item.length] ? item.length : null;
  let length: string | null = null;
  let lengthNote = "";
  if (hasLength) {
    if (chosenLength) {
      length = chosenLength;
      lengthNote = "as chosen";
    } else if (lengthCm && profile?.height_cm) {
      const measured = lengthFromCm(category ?? "dress", lengthCm, profile.height_cm);
      // A height typed wrongly would move the hem a long way: trust the design when they disagree badly
      if (designLength && Math.abs(lengthSteps(designLength, measured)) > 2) {
        length = designLength;
        lengthNote = "as designed";
      } else {
        length = measured;
        lengthNote = `${lengthCm} cm long on someone ${profile.height_cm} cm tall`;
      }
    } else if (designLength) {
      length = designLength;
      lengthNote = "as designed";
    }
  }

  // ---- size on the garment compared with what they normally wear
  const zone = zoneFor(category);
  const usual = usualRow(category);
  const worn = wornSize(tryon, usual, labelSize);
  const sizeText = describeSize(worn, usual);
  // Anything not typed in is read from the photo
  stretch = stretch ?? item?.stretch ?? null;

  // ---- mask: built for this exact item from the photo's parts map (older photos: stored zone masks)
  const sleeves = item?.sleeves ?? "";
  const coversArms = ["three_quarter", "long"].includes(sleeves) || (category === "outerwear" && sleeves !== "none" && sleeves !== "short");
  const wide = ["a_line", "flared", "oversized", "wide_leg", "relaxed"].includes(item?.silhouette ?? "") || ["oversized", "baggy"].includes(tryon.fit);
  let maskPath: string | null;
  let mask: Blob;
  if (photo.parts_map_path && photo.parts_map_path.startsWith(`${tryon.user_id}/`)) {
    const parts = readPartsMap(new Uint8Array(await (await download(admin, "body-photos", photo.parts_map_path)).arrayBuffer()));
    const png = maskPng(editableGrid(parts, { zone, coversArms, length, wide }));
    maskPath = `${tryon.user_id}/masks/tryon-${tryon.id}.png`;
    const { error } = await admin.storage.from("body-photos").upload(maskPath, png, { contentType: "image/png", upsert: true });
    if (error) throw new Error(`Saving mask failed: ${error.message}`);
    mask = new Blob([png as Uint8Array<ArrayBuffer>], { type: "image/png" });
  } else {
    maskPath = (photo as Record<string, string | null>)[MASK_COLUMN[zone]] ?? (zone === "upper" || zone === "lower" ? photo.edit_mask_path : null);
    if (!maskPath) throw new UserError("Your photo needs a quick update before trying on this kind of item. Open the fitting room and try again. Your credits are back.");
    if (!maskPath.startsWith(`${tryon.user_id}/`)) throw new Error("Mask outside the owner's folder");
    mask = await download(admin, "body-photos", maskPath);
  }

  // ---- body profile from all photos, and the most useful other photos as references
  const tier = TIER[tryon.quality] ?? TIER.standard;
  let bodySummary = "";
  let bodyEstimates: Areas | null = null;
  let references: { id: string; blob: Blob }[] = [];
  try {
    const body = await ensureBodyProfile(admin, tryon.user_id);
    if (body) {
      costUsd += (body as { costUsd?: number }).costUsd ?? 0;
      bodySummary = body.summary ?? "";
      const e = (body.body as { estimates?: { bust_cm: number | null; waist_cm: number | null; hips_cm: number | null } } | null)?.estimates;
      if (e && (e.bust_cm || e.waist_cm || e.hips_cm)) bodyEstimates = { bust: e.bust_cm, waist: e.waist_cm, hips: e.hips_cm };
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

  const itemName = garmentType ?? CATEGORY_NAME[category ?? "other"];
  const sized = hasLength;
  // Measurements: typed in wins; otherwise the body comes from the AI's reading of their photos and the
  // garment from the size it's cut for plus the room it's designed with (read from the photo)
  const typedBody: Areas | null = measurements && (measurements.bust_cm || measurements.waist_cm || measurements.hips_cm)
    ? { bust: measurements.bust_cm, waist: measurements.waist_cm, hips: measurements.hips_cm }
    : null;
  const bodyAreas = typedBody ?? bodyEstimates;
  let garmentAreas: Record<string, number> | null = garmentMeasurements;
  if (sized && !garmentAreas) {
    const basis = bodyForSize(worn?.system ?? usual?.size_system ?? null, worn?.value ?? usual?.size_value ?? null, menswear) ?? bodyAreas;
    garmentAreas = estimateGarment(basis, easeFor(item, tryon.fit, !tryon.product_id && !worn), item?.silhouette) as Record<string, number> | null;
  }
  const byMeasurement = sized
    ? measurementRule(garmentAreas, bodyAreas, stretch, { garment: garmentMeasurements ? "typed" : "estimated", body: typedBody ? "typed" : "estimated" })
    : "";
  // Typed garment measurements are exact; estimates still get the shopper's chosen fit described
  const fitRule = sized && !garmentMeasurements ? FIT_STYLE[tryon.fit] ?? FIT_STYLE.regular : "";
  const lengthRule = length ? `LENGTH: the hem must end ${LENGTHS[length].name} on the customer (${lengthNote}). Not longer, not shorter.` : "";
  const sleeveRule = sleeves && !["n/a", ""].includes(sleeves) ? `Sleeves: ${sleeves.replace("_", "-")}, exactly as in image 2.` : "";

  const prompt = [
    "Virtual try-on for a clothing shop.",
    `Image 1 is the customer. Image 2 shows ${isCutout ? "only the item, cut out (its background is not part of it)" : "the item"}: ${itemName}${garmentName ? ` "${garmentName}"` : ""}.`,
    references.length
      ? `Images 3${references.length > 1 ? `-${references.length + 2}` : ""} are the same customer from other angles, only for understanding their real body (shoulders, bust, waist, hips, arm and leg shape). Do not copy their clothes, pose or background.`
      : "",
    zoneRule(category, zone),
    "BODY: never change the customer's body. Their height, build, bust, waist, hips, arms and legs keep exactly the outline and proportions in image 1. Only the clothing changes.",
    notes ? `The item: ${notes}` : "",
    item?.colour ? `COLOURS must match image 2 exactly: ${item.colour}. Do not recolour, tint or swap any part of the print.` : "Colours must match image 2 exactly. Do not recolour any part of the print.",
    lengthRule,
    sleeveRule,
    sized && !byMeasurement ? sizeText : "",
    byMeasurement,
    fitRule,
    bodySummary ? `About the customer's body, from all their photos (do not reshape it): ${bodySummary}` : "",
    "SKIN: every tattoo, birthmark, scar, piercing and skin detail that is still visible after dressing must stay exactly as in image 1. Newly revealed skin matches their skin tone.",
    "Keep the face, hair, pose, hands, background, lighting and camera framing exactly as in image 1. Do not copy anything else from image 2: no other clothes, accessories, pose or background.",
    "Reproduce the item's fabric texture, stitching, straps, slits and details faithfully, with realistic folds, shadows and contact with the body.",
    "Match the sharpness, grain, colour balance and lighting of image 1 exactly, so the result looks like the same unedited photo. No blur, smoothing, text, logos, extra accessories or other people.",
  ]
    .filter(Boolean)
    .join(" ");

  const task = [
    `Put ${itemName} (${CATEGORY_NAME[category ?? "other"]}) from image 2 on the customer in image 1. ${zoneRule(category, zone)}`,
    item?.colour ? `Colours: ${item.colour}.` : "",
    length ? `The hem should end ${LENGTHS[length].name}.` : "",
    byMeasurement,
    fitRule,
    "Tattoos and skin marks that stay visible must be unchanged.",
  ]
    .filter(Boolean)
    .join(" ");

  return { person, garment, mask, maskPath, references, prompt, task, garmentType, costUsd };
}

const SIZE_STEP: Record<string, number> = { uk_women: 2, waist_in: 2, letter: 1 };

type Worn = { system: string; value: number; text: string };

/** The size of what is being tried on: the store size picked, or the size on the label typed in. */
function wornSize(tryon: Tryon, usual: { size_system: string; size_value: number } | null, labelSize: string | null): Worn | null {
  if (tryon.product_id && tryon.size_system && tryon.size_value != null) {
    return { system: tryon.size_system, value: tryon.size_value, text: tryon.size_label ? `size ${tryon.size_label}` : sizeName(tryon.size_system, tryon.size_value) ?? "" };
  }
  if (!labelSize) return null;
  const label = labelSize.trim().toUpperCase().replace(/^UK\s*/, "");
  const letter = LETTERS.indexOf(label === "XXXL" ? "3XL" : label);
  if (letter > 0) return { system: "letter", value: letter, text: `size ${label}` };
  if (/^\d{1,2}$/.test(label)) {
    // Numbers above 28 are trouser waists in inches; smaller ones are UK dress sizes
    const system = usual && usual.size_system !== "letter" ? usual.size_system : Number(label) > 28 ? "waist_in" : "uk_women";
    return { system, value: Number(label), text: sizeName(system, Number(label)) ?? label };
  }
  return null;
}

/**
 * Room the garment has at each area. Store pieces keep their design (the fit already chose the size);
 * an inspiration with no size is drawn with the shopper's chosen fit, keeping design flare at the hips.
 */
function easeFor(item: InspectionItem | null, fit: string, fitDecides: boolean): Partial<Areas> | null {
  const design = item?.design_ease ?? null;
  if (!fitDecides) return design;
  const target: Record<string, [number, number]> = { fitted: [-2, 3], regular: [4, 10], relaxed: [12, 18], oversized: [20, 30], baggy: [22, 34] };
  const [lo, hi] = target[fit] ?? target.regular;
  const clamp = (v: number | null | undefined, area: string) => {
    const base = v ?? (lo + hi) / 2;
    if (area === "hips" && ["a_line", "flared"].includes(item?.silhouette ?? "") && base > hi) return base;
    return Math.min(hi, Math.max(lo, base));
  };
  return { bust: clamp(design?.bust, "bust"), waist: clamp(design?.waist, "waist"), hips: clamp(design?.hips, "hips") };
}

/** How the garment's size compares with the customer's usual size, as a drawing instruction. */
function describeSize(worn: Worn | null, usual: { size_system: string; size_value: number } | null) {
  const usualText = usual ? sizeName(usual.size_system, usual.size_value) : null;

  if (!worn || !usual || worn.system !== usual.size_system) {
    return usualText
      ? `SIZE: no garment size given, so fit it onto the customer exactly as it is designed to be worn, in their usual ${usualText}: a mini stays a mini, a bodycon hugs, a wide leg stays wide.`
      : "SIZE: no garment size given, so fit it onto the customer exactly as it is designed to be worn: a mini stays a mini, a bodycon hugs, a wide leg stays wide.";
  }
  const steps = Math.round((worn.value - usual.size_value) / (SIZE_STEP[usual.size_system] ?? 2));
  if (steps === 0) return `SIZE: the garment is ${worn.text}, the customer's usual size: it fits them as intended, not tight and not loose.`;
  if (steps < 0) {
    const n = -steps;
    return `SIZE: the garment is ${worn.text}, ${n} size${n > 1 ? "s" : ""} smaller than the customer's usual ${usualText}. It must look ${n > 1 ? "very " : ""}tight: fabric strains across the bust, hips and thighs, seams pull, it rides slightly shorter, and it is narrower than their body would like.`;
  }
  return `SIZE: the garment is ${worn.text}, ${steps} size${steps > 1 ? "s" : ""} bigger than the customer's usual ${usualText}. It must look ${steps > 1 ? "clearly " : ""}loose: extra width through the body, shoulders sitting slightly wide, and a little extra length.`;
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
