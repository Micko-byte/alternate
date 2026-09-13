import type { Database } from "@/integrations/supabase/types";

export type SizeSystem = Database["public"]["Enums"]["size_system"];
export type FitStyle = Database["public"]["Enums"]["fit_style"];
export type ShopsFor = Database["public"]["Enums"]["shops_for"];
export type Department = Database["public"]["Enums"]["department"];
export type UserSize = { category: string; size_system: SizeSystem; size_value: number };

export const FITS: { value: FitStyle; label: string; blurb: string }[] = [
  { value: "fitted", label: "Fitted", blurb: "Close to the body" },
  { value: "regular", label: "Regular", blurb: "True to size" },
  { value: "relaxed", label: "Relaxed", blurb: "One size up" },
  { value: "oversized", label: "Oversized", blurb: "Two sizes up" },
  { value: "baggy", label: "Baggy", blurb: "Loose and roomy" },
];

const LETTERS = ["", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

export const SIZE_SYSTEMS: Record<SizeSystem, { label: string; options: { value: number; label: string }[] }> = {
  uk_women: { label: "Women's UK", options: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28].map((n) => ({ value: n, label: `UK ${n}` })) },
  letter: { label: "XS – 4XL", options: LETTERS.slice(1).map((l, i) => ({ value: i + 1, label: l })) },
  waist_in: { label: "Waist (inches)", options: Array.from({ length: 21 }, (_, i) => 26 + i).map((n) => ({ value: n, label: `${n}"` })) },
};

export function sizeText(system: SizeSystem | null | undefined, value: number | null | undefined) {
  if (!system || value == null) return "";
  if (system === "letter") return LETTERS[value] ?? String(value);
  if (system === "waist_in") return `${value}" waist`;
  return `UK ${value}`;
}

/** Same rule as the database: relaxed = 1 step up, oversized / baggy = 2 steps. */
export function fitOffset(system: SizeSystem, fit: FitStyle) {
  const steps = fit === "relaxed" ? 1 : fit === "oversized" || fit === "baggy" ? 2 : 0;
  return steps * (system === "letter" ? 1 : 2);
}

type SizeField = { category: string; system: SizeSystem; label: string };

const WOMEN_FIELDS: SizeField[] = [
  { category: "dress", system: "uk_women", label: "Dress" },
  { category: "top", system: "uk_women", label: "Top" },
  { category: "bottom", system: "uk_women", label: "Trousers" },
];
const MEN_FIELDS: SizeField[] = [
  { category: "top", system: "letter", label: "Top / shirt" },
  { category: "bottom", system: "waist_in", label: "Trouser waist" },
];

export function sizeFieldsFor(shopsFor: ShopsFor | null | undefined): SizeField[] {
  if (shopsFor === "men") return MEN_FIELDS;
  if (shopsFor === "both") return [...WOMEN_FIELDS, ...MEN_FIELDS];
  return WOMEN_FIELDS;
}

/** Which size system to ask for when a shopper has no size yet for this garment type. */
export function defaultSystemFor(category: string, shopsFor: ShopsFor | null | undefined): SizeSystem {
  if (shopsFor === "men") return category === "bottom" ? "waist_in" : "letter";
  if (category === "outerwear" || category === "jumpsuit") return shopsFor === "women" ? "uk_women" : "letter";
  return "uk_women";
}

export const SHOPS_FOR: { value: ShopsFor; label: string }[] = [
  { value: "women", label: "Womenswear" },
  { value: "men", label: "Menswear" },
  { value: "both", label: "Both" },
];

export const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "unisex", label: "Unisex" },
];
