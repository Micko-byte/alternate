// Checks what an inspiration photo (or a store piece's photo) really shows, straight after upload,
// so the fitting room can say "this is a hoodie, not trousers" before anyone pays.
// The result is saved server-side; request_tryon() refuses a category the photo doesn't contain.
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import { CATEGORY_NAME, categoryMatches, download, inspectGarment, itemFor } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const user = await callerFrom(req, admin);
  if (!user) return json({ error: "Sign in first" }, 401);

  const { garment_upload_id, product_id } = await req.json().catch(() => ({}));

  let bucket: string;
  let path: string;
  let category: string | null;
  let hint = "";
  let key: Record<string, string>;
  let keyColumn: string;

  if (garment_upload_id) {
    const { data: upload } = await admin
      .from("garment_uploads")
      .select("id, user_id, storage_path, category, garment_type, source_note")
      .eq("id", garment_upload_id)
      .maybeSingle();
    if (!upload || upload.user_id !== user.id) return json({ error: "Photo not found" }, 404);
    bucket = "garment-uploads";
    path = upload.storage_path;
    category = upload.category;
    hint = `${upload.garment_type ?? ""} ${upload.source_note ?? ""}`;
    key = { garment_upload_id: upload.id };
    keyColumn = "garment_upload_id";
  } else if (product_id) {
    const { data: product } = await admin.from("products").select("id, store_id, name, category").eq("id", product_id).maybeSingle();
    if (!product) return json({ error: "Piece not found" }, 404);
    const [{ data: member }, { data: adminRole }] = await Promise.all([
      admin.from("store_members").select("user_id").eq("store_id", product.store_id).eq("user_id", user.id).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
    ]);
    if (!member && !adminRole) return json({ error: "Only this store's team can check its pieces" }, 403);
    const { data: media } = await admin
      .from("product_media")
      .select("storage_path")
      .eq("product_id", product.id)
      .eq("kind", "image")
      .order("is_tryon_source", { ascending: false })
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!media) return json({ error: "Add a photo first" }, 400);
    bucket = "store-media";
    path = media.storage_path;
    category = product.category;
    hint = product.name;
    key = { product_id: product.id };
    keyColumn = "product_id";
  } else {
    return json({ error: "Nothing to check" }, 400);
  }

  let { data: inspection } = await admin.from("garment_inspections").select("categories, items, is_wearable, source_path").eq(keyColumn, key[keyColumn]).maybeSingle();
  const outdated = !!inspection && !(inspection.items ?? []).some((i: object) => "design_ease" in i);
  if (!inspection || outdated || inspection.source_path !== path) {
    try {
      const fresh = await inspectGarment(await download(admin, bucket, path), hint);
      const row = { ...key, source_path: path, categories: fresh.categories, items: fresh.items, is_wearable: fresh.is_wearable, cost_usd: Number(fresh.costUsd.toFixed(5)) };
      const { error } = await admin.from("garment_inspections").upsert(row, { onConflict: keyColumn });
      if (error) throw new Error(error.message);
      inspection = row;
    } catch (err) {
      console.error("inspect-garment", err);
      // Not fatal: the try-on engine checks again before generating
      return json({ checked: false });
    }
  }

  const main = inspection.items.find((i: { main: boolean }) => i.main) ?? inspection.items[0] ?? null;
  const matches = categoryMatches(category, inspection.categories);
  return json({
    checked: true,
    is_wearable: inspection.is_wearable,
    categories: inspection.categories,
    items: inspection.items.map(({ type, category: c, colour, main: m }: { type: string; category: string; colour: string; main: boolean }) => ({ type, category: c, colour, main: m })),
    matches,
    chosen_item: itemFor(inspection, category)?.type ?? null,
    chosen: (() => {
      const i = itemFor(inspection, category);
      return i
        ? { type: i.type, colour: i.colour, length: i.length ?? null, sleeves: i.sleeves ?? null, silhouette: i.silhouette ?? null, stretch: i.stretch ?? null, design_ease: i.design_ease ?? null }
        : null;
    })(),
    suggestion: main ? { category: main.category, type: main.type } : null,
    message: !inspection.is_wearable
      ? "We couldn't find clothes, shoes or accessories in this photo."
      : matches
        ? null
        : `This photo shows ${inspection.categories.map((c: string) => CATEGORY_NAME[c]).join(" and ")}, not ${CATEGORY_NAME[category ?? "other"]}.`,
  });
});
