import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Quality = Database["public"]["Enums"]["tryon_quality"];

export const QUALITY_LABELS: Record<Quality, { name: string; blurb: string }> = {
  standard: { name: "Standard", blurb: "High quality, checked, redone once if needed" },
  hd: { name: "HD", blurb: "Uses more of your photos for a truer fit" },
  studio: { name: "Studio", blurb: "Maximum detail, best of up to 3 attempts" },
};

/**
 * Charges credits (server enforces age, consent, size and balance), then starts generation.
 * Returns the try-on id to open.
 */
export async function startTryon(args: {
  bodyPhotoId: string;
  productId?: string;
  garmentUploadId?: string;
  quality: Quality;
  fit?: Database["public"]["Enums"]["fit_style"];
  /** What is being tried on. */
  category?: string | null;
}) {
  // The engine builds each item's mask from the photo's parts map; older photos get one made first
  const { data: photo } = await supabase.from("body_photos").select("id, user_id, storage_path, parts_map_path").eq("id", args.bodyPhotoId).single();
  if (photo && !photo.parts_map_path) {
    const { ensurePartsMap } = await import("@/lib/bodyPhoto");
    await ensurePartsMap(photo);
  }
  const { data, error } = await supabase.rpc("request_tryon", {
    _body_photo_id: args.bodyPhotoId,
    _product_id: args.productId ?? null,
    _garment_upload_id: args.garmentUploadId ?? null,
    _quality: args.quality,
    _fit: args.fit ?? null,
  });
  if (error) throw error;
  const tryon = data as unknown as Database["public"]["Tables"]["tryons"]["Row"];
  if (tryon.status === "queued") {
    await kickTryon(tryon.id);
  }
  return tryon.id;
}

export async function kickTryon(id: string) {
  const { error } = await supabase.functions.invoke("tryon-process", { body: { tryon_id: id } });
  if (!error) return;
  if ((error as { context?: Response }).context?.status === 401) {
    const { endStaleSession } = await import("@/lib/auth");
    return endStaleSession();
  }
  console.warn("tryon-process", error);
}
