// Permanently deletes a shopper's try-on or body photo, from storage and the database.
// Deleting a photo keeps the try-ons made with it: their untouched parts are baked into the result first,
// because the app can no longer paste them back from the original.
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import { download } from "../_shared/ai.ts";
import { bakeInPhoto } from "../_shared/body.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const user = await callerFrom(req, admin);
  if (!user) return json({ error: "Sign in first" }, 401);

  const { kind, id } = await req.json().catch(() => ({}));
  const mine = (path: string | null | undefined): path is string => !!path && path.startsWith(`${user.id}/`);

  if (kind === "tryon") {
    const { data: tryon } = await admin.from("tryons").select("id, user_id, result_path, qa, status").eq("id", id).maybeSingle();
    if (!tryon || tryon.user_id !== user.id) return json({ error: "Try-on not found" }, 404);
    if (tryon.status === "queued" || tryon.status === "processing") return json({ error: "Wait for this try-on to finish before deleting it." }, 409);
    const work = ((tryon.qa as { attempts?: { path: string }[] } | null)?.attempts ?? []).map((a) => a.path).filter(mine);
    if (mine(tryon.result_path)) await admin.storage.from("tryon-results").remove([tryon.result_path]);
    if (work.length) await admin.storage.from("tryon-work").remove(work);
    await admin.storage.from("body-photos").remove([`${user.id}/masks/tryon-${tryon.id}.png`]);
    const { error } = await admin.from("tryons").delete().eq("id", tryon.id);
    if (error) return json({ error: error.message }, 500);
    return json({ deleted: "tryon" });
  }

  if (kind === "photo") {
    const { data: photo } = await admin.from("body_photos").select("*").eq("id", id).maybeSingle();
    if (!photo || photo.user_id !== user.id) return json({ error: "Photo not found" }, 404);

    // Bake the original into every finished try-on that still relies on it for "Keep the rest of me"
    const { data: tryons } = await admin
      .from("tryons")
      .select("id, result_path, edit_mask_path")
      .eq("body_photo_id", photo.id)
      .eq("status", "succeeded");
    let photoPng: Uint8Array | null = null;
    for (const t of tryons ?? []) {
      if (!mine(t.result_path) || !mine(t.edit_mask_path)) continue;
      try {
        photoPng ??= new Uint8Array(await (await download(admin, "body-photos", photo.storage_path)).arrayBuffer());
        const [result, mask] = await Promise.all([
          download(admin, "tryon-results", t.result_path).then((b) => b.arrayBuffer()),
          download(admin, "body-photos", t.edit_mask_path).then((b) => b.arrayBuffer()),
        ]);
        const baked = bakeInPhoto(new Uint8Array(result), photoPng, new Uint8Array(mask));
        const { error } = await admin.storage.from("tryon-results").upload(t.result_path, baked, { contentType: "image/png", upsert: true });
        if (error) throw new Error(error.message);
        await admin.from("tryons").update({ edit_mask_path: null }).eq("id", t.id);
      } catch (err) {
        console.error("baking before photo delete failed", t.id, err);
        return json({ error: "We couldn't prepare your try-ons for this photo's deletion. Nothing was deleted. Try again." }, 502);
      }
    }

    // Everything made from the photo goes, except the face mask (a blank face shape, no image), kept so
    // faces on remaining try-ons can still be blurred
    const files = [
      photo.storage_path, photo.parts_map_path, photo.edit_mask_path, photo.mask_upper_path, photo.mask_lower_path,
      photo.mask_feet_path, photo.mask_eyes_path, photo.mask_head_path, photo.mask_jewellery_path,
      ...(tryons ?? []).map((t) => `${user.id}/masks/tryon-${t.id}.png`),
    ].filter(mine);
    if (files.length) await admin.storage.from("body-photos").remove(files);
    const { error } = await admin.from("body_photos").delete().eq("id", photo.id);
    if (error) return json({ error: error.message }, 500);
    // Re-read the remaining photos next time
    await admin.from("body_profiles").delete().eq("user_id", user.id);
    return json({ deleted: "photo", tryons_kept: tryons?.length ?? 0 });
  }

  return json({ error: "Nothing to delete" }, 400);
});
