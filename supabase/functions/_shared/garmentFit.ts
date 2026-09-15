// Garment measurements against the shopper's body, area by area, as drawing instructions.
// Keep the thresholds identical to src/lib/garmentFit.ts.

type Stretch = "none" | "some" | "high";
type Garment = Partial<Record<"bust" | "waist" | "hips" | "thigh" | "length" | "shoulder" | "sleeve" | "inseam", number>>;
type Body = { bust_cm: number | null; waist_cm: number | null; hips_cm: number | null };

const ALLOWANCE: Record<Stretch, number> = { none: 0, some: 4, high: 10 };

function feel(ease: number, stretch: Stretch) {
  const a = ALLOWANCE[stretch];
  if (ease < -(a + 2)) return "too small: fabric strains hard and pulls, gaps between buttons, it can barely go on";
  if (ease < 0) return stretch === "none" ? "very tight: fabric pulls with tension lines" : "skin-tight: the stretch fabric is stretched over the body and follows every curve";
  if (ease < 4) return "close-fitting: follows the body's curves with almost no room";
  if (ease < 10) return "true to size: a little room, fabric skims the body";
  if (ease < 18) return "loose: clear room, fabric falls away from the body";
  return "very loose: lots of extra fabric, oversized";
}

/** One sentence per measured area, or "" when there is nothing to compare. */
export function measurementRule(garment: Garment | null | undefined, body: Body | null | undefined, stretch: string | null) {
  if (!garment || !body) return "";
  const s = (["none", "some", "high"].includes(stretch ?? "") ? stretch : "some") as Stretch;
  const parts: string[] = [];
  for (const area of ["bust", "waist", "hips"] as const) {
    const g = garment[area];
    const b = body[`${area}_cm`];
    if (!g || !b) continue;
    const ease = Math.round((g - b) * 2) / 2;
    const diff = ease === 0 ? "the same as" : ease < 0 ? `${-ease} cm smaller than` : `${ease} cm bigger than`;
    parts.push(`at the ${area === "bust" ? "bust/chest" : area} the garment is ${g} cm, ${diff} the customer's ${b} cm, so it is ${feel(ease, s)}`);
  }
  if (!parts.length) return "";
  return `MEASUREMENTS decide the tightness in each area (fabric: ${s === "none" ? "no stretch" : s === "some" ? "some stretch" : "very stretchy"}): ${parts.join("; ")}. Draw exactly this, area by area.`;
}
