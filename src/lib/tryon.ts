import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Quality = Database["public"]["Enums"]["tryon_quality"];

export const QUALITY_LABELS: Record<Quality, { name: string; blurb: string }> = {
  standard: { name: "Standard", blurb: "Quick look" },
  hd: { name: "HD", blurb: "Sharper fabric and print" },
  studio: { name: "Studio", blurb: "Our most realistic" },
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
}) {
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
  if (error) console.warn("tryon-process", error);
}
