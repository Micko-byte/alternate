// Garment measurements against body measurements, area by area.
// Circumferences in cm (bust, waist, hips, thigh); lengths in cm (length, shoulder, sleeve, inseam).
// Keep the thresholds identical to supabase/functions/_shared/garmentFit.ts.

export type MeasureKey = "bust" | "waist" | "hips" | "thigh" | "length" | "shoulder" | "sleeve" | "inseam";
export type GarmentMeasurements = Partial<Record<MeasureKey, number>>;
export type Stretch = "none" | "some" | "high";
export type Body = { bust: number | null; waist: number | null; hips: number | null };

export const MEASURE_LABELS: Record<MeasureKey, { label: string; hint: string; around: boolean }> = {
  bust: { label: "Bust / chest", hint: "All the way round, armpit level", around: true },
  waist: { label: "Waist", hint: "All the way round", around: true },
  hips: { label: "Hips", hint: "All the way round, widest part", around: true },
  thigh: { label: "Thigh", hint: "All the way round the leg, top of the thigh", around: true },
  length: { label: "Length", hint: "Shoulder to hem (tops, dresses) or waistband to hem", around: false },
  shoulder: { label: "Shoulder", hint: "Seam to seam across the back", around: false },
  sleeve: { label: "Sleeve", hint: "Shoulder seam to cuff", around: false },
  inseam: { label: "Inseam", hint: "Crotch to hem", around: false },
};

export const MEASURES_FOR: Record<string, MeasureKey[]> = {
  top: ["bust", "waist", "length", "shoulder", "sleeve"],
  outerwear: ["bust", "waist", "length", "shoulder", "sleeve"],
  dress: ["bust", "waist", "hips", "length"],
  jumpsuit: ["bust", "waist", "hips", "length", "inseam"],
  set: ["bust", "waist", "hips", "length"],
  skirt: ["waist", "hips", "length"],
  bottom: ["waist", "hips", "thigh", "length", "inseam"],
};

export const STRETCH_OPTIONS: { value: Stretch; label: string }[] = [
  { value: "none", label: "No stretch" },
  { value: "some", label: "Some stretch" },
  { value: "high", label: "Very stretchy" },
];

/** How much smaller than the body a fabric can be and still go on comfortably (cm). */
const ALLOWANCE: Record<Stretch, number> = { none: 0, some: 4, high: 10 };

export type Feel = "too_small" | "skin_tight" | "close" | "some_room" | "loose" | "very_loose";

export const FEEL_LABELS: Record<Feel, string> = {
  too_small: "Too small",
  skin_tight: "Skin-tight",
  close: "Close fit",
  some_room: "Some room",
  loose: "Loose",
  very_loose: "Very loose",
};

export function feelFor(ease: number, stretch: Stretch = "none"): Feel {
  const a = ALLOWANCE[stretch];
  if (ease < -(a + 2)) return "too_small";
  if (ease < 0) return "skin_tight";
  if (ease < 4) return "close";
  if (ease < 10) return "some_room";
  if (ease < 18) return "loose";
  return "very_loose";
}

export type AreaFit = { area: "bust" | "waist" | "hips"; garment: number; body: number; ease: number; feel: Feel };

/** Areas that both the garment and the body have measurements for. */
export function areaFits(garment: GarmentMeasurements | null | undefined, body: Body | null | undefined, stretch: Stretch = "none"): AreaFit[] {
  if (!garment || !body) return [];
  return (["bust", "waist", "hips"] as const)
    .filter((a) => garment[a] && body[a])
    .map((area) => {
      const ease = Math.round((garment[area]! - body[area]!) * 2) / 2;
      return { area, garment: garment[area]!, body: body[area]!, ease, feel: feelFor(ease, stretch) };
    });
}

/** Ease wanted at the key areas for each fit style (cm). */
function targetRange(fit: string, stretch: Stretch): [number, number] {
  switch (fit) {
    case "fitted": return [-ALLOWANCE[stretch], 4];
    case "relaxed": return [8, 18];
    case "oversized":
    case "baggy": return [14, 60];
    default: return [2, 10];
  }
}

/** The in-stock size whose measurements best give the chosen fit, if sizes have measurements. */
export function recommendSize<V extends { id: string; stock_qty: number; measurements?: unknown }>(
  variants: V[],
  body: Body | null | undefined,
  fit: string,
  stretch: Stretch = "none",
): V | null {
  const [lo, hi] = targetRange(fit, stretch);
  // Ties go to the size nearest the middle of the range, not one right at the stretch limit
  const mid = (lo + Math.min(hi, lo + 20)) / 2;
  let best: { v: V; score: number } | null = null;
  for (const v of variants) {
    if (v.stock_qty <= 0) continue;
    const areas = areaFits(v.measurements as GarmentMeasurements, body, stretch);
    if (!areas.length) continue;
    const score = areas.reduce(
      (sum, a) => sum + (a.ease < lo ? lo - a.ease : a.ease > hi ? a.ease - hi : 0) + (a.feel === "too_small" ? 50 : 0) + Math.abs(a.ease - mid) * 0.05,
      0,
    );
    if (!best || score < best.score) best = { v, score };
  }
  return best?.v ?? null;
}

/** Switching between "all the way round" and "laid flat" converts what is already typed, so nothing is doubled twice. */
export function convertAround(inputs: Partial<Record<MeasureKey, string>>, toFlat: boolean): Partial<Record<MeasureKey, string>> {
  const out: Partial<Record<MeasureKey, string>> = { ...inputs };
  for (const [key, raw] of Object.entries(inputs) as [MeasureKey, string][]) {
    const n = Number(raw);
    if (!MEASURE_LABELS[key].around || !raw || !Number.isFinite(n)) continue;
    out[key] = String(Math.round((toFlat ? n / 2 : n * 2) * 2) / 2);
  }
  return out;
}

/** Input values → stored measurements (cm). "Measured flat" doubles the all-the-way-round ones. */
export function toMeasurements(inputs: Partial<Record<MeasureKey, string>>, measuredFlat: boolean): GarmentMeasurements | null {
  const out: GarmentMeasurements = {};
  for (const [key, raw] of Object.entries(inputs) as [MeasureKey, string][]) {
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n <= 0) continue;
    const value = MEASURE_LABELS[key].around && measuredFlat ? n * 2 : n;
    if (value >= 5 && value <= 300) out[key] = Math.round(value * 2) / 2;
  }
  return Object.keys(out).length ? out : null;
}
