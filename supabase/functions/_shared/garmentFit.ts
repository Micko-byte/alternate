// Garment measurements against the shopper's body, area by area, as drawing instructions.
// Typed-in measurements always win. When nothing was typed, they are estimated: the garment from its size
// (a size chart) plus the room it is designed to have (read from the photo), the body from the AI's
// reading of the shopper's photos.
// Keep charts and thresholds identical to src/lib/garmentFit.ts.

export type Stretch = "none" | "some" | "high";
export type Areas = { bust: number | null; waist: number | null; hips: number | null };
type Garment = Partial<Record<"bust" | "waist" | "hips" | "thigh" | "length" | "shoulder" | "sleeve" | "inseam", number>>;

const ALLOWANCE: Record<Stretch, number> = { none: 0, some: 4, high: 10 };

// Body measurements (cm) that each size is cut for
const UK_WOMEN: Record<number, [number, number, number]> = {
  4: [76, 58, 81], 6: [79, 61, 84], 8: [82, 64, 87], 10: [87, 69, 92], 12: [92, 74, 97], 14: [97, 79, 102],
  16: [102, 84, 107], 18: [107, 89, 112], 20: [112, 94, 117], 22: [117, 99, 122], 24: [122, 104, 127], 26: [127, 109, 132], 28: [132, 114, 137],
};
const LETTER_MEN: Record<number, [number, number, number]> = {
  1: [86, 71, 88], 2: [91, 76, 93], 3: [97, 81, 99], 4: [103, 87, 105], 5: [109, 94, 111], 6: [116, 101, 118], 7: [123, 108, 125], 8: [130, 116, 132],
};
// Women's letters as UK sizes: XS 6, S 8, M 11, L 14, XL 16, XXL 18, 3XL 20, 4XL 22
const LETTER_WOMEN_UK: Record<number, number> = { 1: 6, 2: 8, 3: 11, 4: 14, 5: 16, 6: 18, 7: 20, 8: 22 };

function ukWomen(value: number): [number, number, number] | null {
  const sizes = Object.keys(UK_WOMEN).map(Number);
  const lo = Math.max(...sizes.filter((s) => s <= value), 4);
  const hi = Math.min(...sizes.filter((s) => s >= value), 28);
  if (lo === hi) return UK_WOMEN[lo] ?? null;
  const t = (value - lo) / (hi - lo);
  return UK_WOMEN[lo].map((v, i) => v + (UK_WOMEN[hi][i] - v) * t) as [number, number, number];
}

/** The body a size is cut for. */
export function bodyForSize(system: string | null, value: number | null, menswear: boolean): Areas | null {
  if (!system || value == null) return null;
  let row: [number, number, number] | null = null;
  if (system === "uk_women") row = ukWomen(value);
  else if (system === "letter") row = menswear ? LETTER_MEN[value] ?? null : ukWomen(LETTER_WOMEN_UK[value] ?? 12);
  else if (system === "waist_in") {
    const waist = value * 2.54;
    row = [waist + 16, waist, waist + (menswear ? 14 : 22)];
  }
  return row ? { bust: row[0], waist: row[1], hips: row[2] } : null;
}

// Designed room by silhouette when the photo check couldn't say (cm, all the way round)
const SILHOUETTE_EASE: Record<string, Areas> = {
  bodycon: { bust: -2, waist: -2, hips: -2 },
  fitted: { bust: 4, waist: 4, hips: 4 },
  straight: { bust: 8, waist: 12, hips: 6 },
  a_line: { bust: 6, waist: 6, hips: 25 },
  flared: { bust: 6, waist: 4, hips: 30 },
  relaxed: { bust: 14, waist: 16, hips: 14 },
  oversized: { bust: 24, waist: 28, hips: 22 },
  wide_leg: { bust: 8, waist: 4, hips: 10 },
};

/** Garment measurements estimated from the size it's cut for plus its designed room. */
export function estimateGarment(sizeBody: Areas | null, designEase: Partial<Areas> | null | undefined, silhouette: string | null | undefined): Garment | null {
  if (!sizeBody) return null;
  const fallback = SILHOUETTE_EASE[silhouette ?? ""] ?? { bust: 8, waist: 8, hips: 8 };
  const out: Garment = {};
  for (const area of ["bust", "waist", "hips"] as const) {
    const body = sizeBody[area];
    const ease = designEase?.[area] ?? fallback[area];
    if (body != null && ease != null) out[area] = Math.round((body + ease) * 2) / 2;
  }
  return Object.keys(out).length ? out : null;
}

function feel(ease: number, stretch: Stretch) {
  const a = ALLOWANCE[stretch];
  if (ease < -(a + 2)) return "too small: fabric strains hard and pulls, gaps between buttons, it can barely go on";
  if (ease < 0) return stretch === "none" ? "very tight: fabric pulls with tension lines" : "skin-tight: the stretch fabric is stretched over the body and follows every curve";
  if (ease < 4) return "close-fitting: follows the body's curves with almost no room";
  if (ease < 10) return "true to size: a little room, fabric skims the body";
  if (ease < 18) return "loose: clear room, fabric falls away from the body";
  return "very loose: lots of extra fabric, oversized";
}

/** One sentence per area, or "" when there is nothing to compare. */
export function measurementRule(
  garment: Garment | null | undefined,
  body: Areas | null | undefined,
  stretch: string | null,
  sources: { garment: "typed" | "estimated"; body: "typed" | "estimated" },
) {
  if (!garment || !body) return "";
  const s = (["none", "some", "high"].includes(stretch ?? "") ? stretch : "some") as Stretch;
  const parts: string[] = [];
  for (const area of ["bust", "waist", "hips"] as const) {
    const g = garment[area];
    const b = body[area];
    if (!g || !b) continue;
    const ease = Math.round((g - b) * 2) / 2;
    const diff = ease === 0 ? "the same as" : ease < 0 ? `${-ease} cm smaller than` : `${ease} cm bigger than`;
    parts.push(`at the ${area === "bust" ? "bust/chest" : area} the garment is about ${g} cm, ${diff} the customer's ${b} cm, so it is ${feel(ease, s)}`);
  }
  if (!parts.length) return "";
  const basis = `garment ${sources.garment === "typed" ? "measured" : "estimated from its size and design"}, body ${sources.body === "typed" ? "measured" : "estimated from their photos"}`;
  return `MEASUREMENTS decide the tightness in each area (${basis}; fabric: ${s === "none" ? "no stretch" : s === "some" ? "some stretch" : "very stretchy"}): ${parts.join("; ")}. Draw exactly this, area by area.`;
}
