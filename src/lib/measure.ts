// Bust (or chest), waist and hips from a front and a side photo, scaled by the shopper's height.
//
// Method: in each photo's parts map, find the crown and the floor, so height in pixels ↔ height in cm.
// In the band where each measurement sits on a standing adult, take the torso's width (front photo)
// and depth (side photo), arms excluded, then the circumference of that ellipse.
// Clothes and long hair change the outline, so fitted clothes, hair tied back and a side photo matter.
import { L, type PartMap } from "@/lib/garmentParser";

export type MeasureResult = {
  bust: number;
  waist: number;
  hips: number;
  accuracy: number;
  notes: string[];
};

type Frame = { crown: number; floor: number; height: number };

// Arms have their own labels, so they are never counted in the torso's width
const TORSO = new Set<number>([L["Upper-clothes"], L.Dress, L.Skirt, L.Pants, L.Belt, L.Scarf]);

function frameOf(map: PartMap): Frame | null {
  const { width: W, height: H, labels } = map;
  let top = H, bottom = -1, faceTop = H, faceBottom = -1, hairTop = H;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const l = labels[y * W + x];
      if (l === L.Background) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (l === L.Face) { if (y < faceTop) faceTop = y; if (y > faceBottom) faceBottom = y; }
      if ((l === L.Hair || l === L.Hat) && y < hairTop) hairTop = y;
    }
  if (bottom < 0) return null;
  const faceH = faceBottom - faceTop + 1;
  // Big hair isn't height: the crown is about a quarter of a face above the hairline
  const crown = faceBottom >= 0 ? Math.max(hairTop === H ? top : hairTop, faceTop - faceH * 0.28) : top;
  if (bottom >= H - 3) return null; // feet cut off: can't scale
  return { crown, floor: bottom, height: bottom - crown };
}

/** Torso extent across a row, arms left out. Null if the torso isn't visible on that row. */
function spanAt(map: PartMap, y: number) {
  const { width: W, labels } = map;
  let left = -1, right = -1;
  for (let x = 0; x < W; x++) {
    if (TORSO.has(labels[y * W + x])) {
      if (left < 0) left = x;
      right = x;
    }
  }
  if (left < 0) return null;
  return right - left + 1;
}

/** Widths (in grid cells) across a band of standing height, measured from the crown. */
function band(map: PartMap, frame: Frame, from: number, to: number) {
  const values: number[] = [];
  for (let y = Math.round(frame.crown + from * frame.height); y <= Math.round(frame.crown + to * frame.height); y++) {
    const s = spanAt(map, y);
    if (s) values.push(s);
  }
  return values;
}

const median3 = (v: number[]) => v.map((_, i) => [v[i - 1], v[i], v[i + 1]].filter((n) => n !== undefined).sort((a, b) => a - b)[1] ?? v[i]);

/** Hair falling over the chest hides the torso's edge. */
function hairOverTorso(map: PartMap, frame: Frame) {
  const { width: W, labels } = map;
  let hair = 0;
  for (let y = Math.round(frame.crown + 0.22 * frame.height); y <= Math.round(frame.crown + 0.32 * frame.height); y++)
    for (let x = 0; x < W; x++) if (labels[y * W + x] === L.Hair) hair++;
  return hair > frame.height * 0.3;
}

function ellipse(width: number, depth: number) {
  const a = width / 2;
  const b = depth / 2;
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

// Where each measurement sits, as a share of height below the crown, and typical depth/width if no side photo
const BANDS = {
  bust: { from: 0.25, to: 0.32, pick: "max" as const, depthRatio: 0.74 },
  waist: { from: 0.34, to: 0.44, pick: "min" as const, depthRatio: 0.72 },
  hips: { from: 0.45, to: 0.56, pick: "max" as const, depthRatio: 0.8 },
};

export function measure(front: PartMap, side: PartMap | null, heightCm: number, looseClothing: boolean): MeasureResult {
  const notes: string[] = [];
  const f = frameOf(front);
  if (!f) throw new Error("Your whole body, head to feet, needs to be in the front photo.");
  const s = side ? frameOf(side) : null;
  if (side && !s) notes.push("The side photo is cut off, so depth is estimated.");

  // grid cell → cm: the parts map is 256×384 over a 1024×1536 photo, the same scale both ways
  const cmPerCellFront = heightCm / f.height;
  const cmPerCellSide = s ? heightCm / s.height : 0;

  const out: Record<string, number> = {};
  for (const [name, b] of Object.entries(BANDS)) {
    const widths = median3(band(front, f, b.from, b.to));
    if (widths.length < 3) throw new Error(`We couldn't see your ${name} clearly in the front photo. Stand straight with arms slightly away from your body.`);
    const width = (b.pick === "max" ? Math.max(...widths) : Math.min(...widths)) * cmPerCellFront;
    let depth = width * b.depthRatio;
    if (s && side) {
      const depths = median3(band(side, s, b.from, b.to));
      if (depths.length >= 3) depth = (b.pick === "max" ? Math.max(...depths) : Math.min(...depths)) * cmPerCellSide;
    }
    out[name] = Math.round(ellipse(width, depth) * 2) / 2;
  }

  let accuracy = 3;
  if (hairOverTorso(front, f)) { accuracy += 2; notes.push("Long hair over your shoulders hides part of your outline. Tie it back for your measuring photo."); }
  if (!s) { accuracy += 3; notes.push("Add a side photo for depth: it makes these much more accurate."); }
  if (looseClothing) { accuracy += 3; notes.push("Loose clothes add to the outline. A photo in fitted clothes gives truer numbers."); }

  if (out.waist >= out.hips) notes.push("Your waist came out wider than your hips; check the photo is straight on and fitted.");
  return { bust: out.bust, waist: out.waist, hips: out.hips, accuracy, notes };
}

// Typical UK high-street chart (cm). Brands vary, so this is a starting point. Within 1 cm counts as fitting.
const UK_WOMEN = [
  { size: 6, bust: 79, waist: 61, hips: 84 },
  { size: 8, bust: 82, waist: 64, hips: 87 },
  { size: 10, bust: 87, waist: 69, hips: 92 },
  { size: 12, bust: 92, waist: 74, hips: 97 },
  { size: 14, bust: 97, waist: 79, hips: 102 },
  { size: 16, bust: 102, waist: 84, hips: 107 },
  { size: 18, bust: 107, waist: 89, hips: 112 },
  { size: 20, bust: 112, waist: 94, hips: 117 },
  { size: 22, bust: 117, waist: 99, hips: 122 },
  { size: 24, bust: 122, waist: 104, hips: 127 },
  { size: 26, bust: 127, waist: 109, hips: 132 },
];

const MEN_CHEST = [
  { size: 1, chest: 86 }, { size: 2, chest: 91 }, { size: 3, chest: 97 }, { size: 4, chest: 103 },
  { size: 5, chest: 109 }, { size: 6, chest: 116 }, { size: 7, chest: 123 }, { size: 8, chest: 130 },
];

const smallestFitting = <T extends { size: number }>(chart: T[], ok: (row: T) => boolean) => (chart.find(ok) ?? chart[chart.length - 1]).size;

/** Suggested sizes from measurements: UK sizes for womenswear, letter and waist sizes for menswear. */
export function suggestSizes(m: { bust: number | null; waist: number | null; hips: number | null }, menswear: boolean) {
  if (menswear) {
    const top = m.bust ? smallestFitting(MEN_CHEST, (r) => r.chest >= m.bust! - 1) : null;
    const waistIn = m.waist ? Math.max(26, Math.min(46, Math.ceil(m.waist / 2.54 / 2) * 2)) : null;
    return { top, outerwear: top, bottom: waistIn };
  }
  const upper = m.bust && m.waist ? smallestFitting(UK_WOMEN, (r) => r.bust >= m.bust! - 1 && r.waist >= m.waist! - 2) : null;
  const lower = m.hips && m.waist ? smallestFitting(UK_WOMEN, (r) => r.hips >= m.hips! - 1 && r.waist >= m.waist! - 1) : null;
  const dress = upper && lower ? Math.max(upper, lower) : upper ?? lower;
  return { top: upper, dress, jumpsuit: dress, outerwear: upper, skirt: lower, bottom: lower };
}
