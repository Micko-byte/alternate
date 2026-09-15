import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/integrations/supabase/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function kes(amount: number | null | undefined) {
  return `KES ${Number(amount ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Readable message from a Supabase / fetch / thrown error. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Try again.") {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  const e = err as { message?: string; error_description?: string; context?: { error?: string } };
  return e.context?.error || e.message || e.error_description || fallback;
}

export function publicMediaUrl(path: string | null | undefined) {
  if (!path) return null;
  return supabase.storage.from("store-media").getPublicUrl(path).data.publicUrl;
}

export async function signedUrl(bucket: string, path: string | null | undefined, seconds = 3600) {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export function extensionOf(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type.split("/")[1] ?? "bin";
}

export const CATEGORY_LABELS: Record<string, string> = {
  dress: "Dresses",
  top: "Tops & shirts",
  bottom: "Trousers & jeans",
  skirt: "Skirts",
  jumpsuit: "Jumpsuits",
  outerwear: "Jackets",
  set: "Sets & suits",
  shoes: "Shoes",
  eyewear: "Glasses",
  headwear: "Hats",
  jewellery: "Jewellery",
  other: "Other",
};

export const CATEGORY_SINGULAR: Record<string, string> = {
  dress: "dress",
  top: "top",
  bottom: "trouser",
  skirt: "skirt",
  jumpsuit: "jumpsuit",
  outerwear: "jacket",
  set: "set",
  shoes: "shoes",
  eyewear: "glasses",
  headwear: "hat",
  jewellery: "jewellery",
  other: "clothing",
};

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

