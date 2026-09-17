// Where things sit on a standing body, and the edit mask for one item, built from a photo's parts map.
//
// Parts map: a small PNG (256x384) made in the browser where every pixel's red value is 12 x its label
// (the SegFormer clothes labels below). From it we find the crown and the floor, place landmarks like
// "mid-calf" at their real height, and decide pixel by pixel what the image model may change:
// clothing that is being replaced, skin the new item will cover, and nothing else. Skin that stays
// visible (with its tattoos) is locked, so it is pasted back exactly.
import { decode, encode } from "npm:fast-png@6.2.0";

export const GRID_W = 256;
export const GRID_H = 384;
export const PHOTO_W = 1024;
export const PHOTO_H = 1536;

const L = {
  Background: 0, Hat: 1, Hair: 2, Sunglasses: 3, UpperClothes: 4, Skirt: 5, Pants: 6, Dress: 7, Belt: 8,
  LeftShoe: 9, RightShoe: 10, Face: 11, LeftLeg: 12, RightLeg: 13, LeftArm: 14, RightArm: 15, Bag: 16, Scarf: 17,
} as const;

// Height above the floor as a share of standing height (adult averages)
export const LENGTHS: Record<string, { fromFloor: number; name: string }> = {
  cropped: { fromFloor: 0.66, name: "cropped, above the navel" },
  waist: { fromFloor: 0.62, name: "at the natural waist" },
  high_hip: { fromFloor: 0.57, name: "just below the waist, at the high hip" },
  hip: { fromFloor: 0.52, name: "at the hips" },
  upper_thigh: { fromFloor: 0.45, name: "at the upper thigh (a mini length)" },
  mid_thigh: { fromFloor: 0.4, name: "at mid-thigh" },
  above_knee: { fromFloor: 0.32, name: "just above the knee" },
  knee: { fromFloor: 0.285, name: "at the knee" },
  below_knee: { fromFloor: 0.24, name: "just below the knee" },
  mid_calf: { fromFloor: 0.17, name: "at mid-calf (a midi length)" },
  ankle: { fromFloor: 0.05, name: "at the ankle (a maxi length)" },
  floor: { fromFloor: 0, name: "to the floor" },
};
const ORDER = Object.keys(LENGTHS);

/** Nearest named length for a hem at this height above the floor (share of height). */
export function nearestLength(fromFloor: number) {
  return ORDER.reduce((best, k) => (Math.abs(LENGTHS[k].fromFloor - fromFloor) < Math.abs(LENGTHS[best].fromFloor - fromFloor) ? k : best), ORDER[0]);
}

/** How many named steps apart two lengths are (positive = b is longer). */
export function lengthSteps(a: string, b: string) {
  return ORDER.indexOf(b) - ORDER.indexOf(a);
}

/**
 * Where a garment of this measured length ends on someone this tall.
 * Dresses, tops, jumpsuits and coats are measured from the shoulder; skirts and trousers from the waist.
 */
export function lengthFromCm(category: string, lengthCm: number, heightCm: number) {
  const startsAt = ["bottom", "skirt"].includes(category) ? 0.62 : 0.82;
  return nearestLength(Math.max(0, (startsAt * heightCm - lengthCm) / heightCm));
}

export type PartsMap = { labels: Uint8Array };

export function readPartsMap(png: Uint8Array): PartsMap {
  const img = decode(png);
  if (img.width !== GRID_W || img.height !== GRID_H) throw new Error(`Parts map is ${img.width}x${img.height}`);
  const labels = new Uint8Array(GRID_W * GRID_H);
  const step = img.channels;
  for (let i = 0; i < labels.length; i++) labels[i] = Math.min(17, Math.round(Number(img.data[i * step]) / 12));
  return { labels };
}

type Grid = Uint8Array;
const W = GRID_W;
const H = GRID_H;

function select(map: PartsMap, classes: number[]): Grid {
  const set = new Set(classes);
  const out = new Uint8Array(W * H);
  for (let i = 0; i < out.length; i++) if (set.has(map.labels[i])) out[i] = 1;
  return out;
}

function union(...grids: Grid[]) {
  const out = new Uint8Array(W * H);
  for (const g of grids) for (let i = 0; i < out.length; i++) if (g[i]) out[i] = 1;
  return out;
}

function subtract(a: Grid, b: Grid) {
  const out = a.slice();
  for (let i = 0; i < out.length; i++) if (b[i]) out[i] = 0;
  return out;
}

function rows(g: Grid, fromY: number, toY: number) {
  const out = new Uint8Array(W * H);
  for (let y = Math.max(0, Math.floor(fromY)); y <= Math.min(H - 1, Math.ceil(toY)); y++)
    for (let x = 0; x < W; x++) out[y * W + x] = g[y * W + x];
  return out;
}

function rect(x0: number, y0: number, x1: number, y1: number) {
  const out = new Uint8Array(W * H);
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++)
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) out[y * W + x] = 1;
  return out;
}

function dilate(src: Grid, rx: number, ry = rx) {
  const tmp = new Uint8Array(W * H);
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let k = -rx; k <= rx; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < W && src[y * W + xx]) { tmp[y * W + x] = 1; break; }
      }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let k = -ry; k <= ry; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < H && tmp[yy * W + x]) { out[y * W + x] = 1; break; }
      }
  return out;
}

/**
 * Skin right where a sleeve or hem ends may change (a short sleeve becomes bare skin). Only straight above or
 * below the edge: arm skin touching the side of the body stays locked, with any tattoo on it.
 */
function sleeveEdge(clothes: Grid) {
  return dilate(clothes, 0, 4);
}

type Box = { x0: number; y0: number; x1: number; y1: number; w: number; h: number };
function box(g: Grid): Box | null {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (g[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Crown and floor rows of the person in the parts map. */
export function bodyFrame(map: PartsMap) {
  const person = new Uint8Array(W * H);
  for (let i = 0; i < person.length; i++) if (map.labels[i] !== L.Background) person[i] = 1;
  const all = box(person);
  const face = box(select(map, [L.Face]));
  const hair = box(select(map, [L.Hair, L.Hat]));
  if (!all) return null;
  // Big hair or a hat shouldn't count as height: the crown sits about a quarter of a face above the hairline
  const crown = face ? Math.max(hair?.y0 ?? all.y0, face.y0 - face.h * 0.28) : all.y0;
  let floor = all.y1;
  let feetVisible = floor < H - 3;
  if (!feetVisible && face) {
    // Cut off at the bottom: an adult is about 7.5 heads tall
    floor = crown + (face.h / 0.75) * 7.5;
    feetVisible = false;
  }
  return { crown, floor, height: floor - crown, face, feetVisible };
}

export function rowForLength(frame: { floor: number; height: number }, length: string) {
  return frame.floor - LENGTHS[length].fromFloor * frame.height;
}

export type Zone = "upper" | "lower" | "full" | "feet" | "eyes" | "head" | "jewellery";

export type MaskOptions = {
  zone: Zone;
  /** The new item has sleeves past the elbow. */
  coversArms: boolean;
  /** Named length where the new item ends, if known. */
  length: string | null;
  /** Wide silhouettes (A-line, flared, oversized, wide-leg) need room beyond the body outline. */
  wide: boolean;
};

/** Editable cells (1 = may change) for one item. */
export function editableGrid(map: PartsMap, o: MaskOptions): Grid {
  const frame = bodyFrame(map);
  const face = select(map, [L.Face]);
  const locked = dilate(select(map, [L.Face, L.Hair, L.Hat, L.Sunglasses, L.Bag]), 2);
  const upperClothes = select(map, [L.UpperClothes, L.Scarf]);
  const lowerClothes = select(map, [L.Pants, L.Skirt, L.Belt]);
  const dress = select(map, [L.Dress]);
  const arms = select(map, [L.LeftArm, L.RightArm]);
  const legs = select(map, [L.LeftLeg, L.RightLeg]);
  const shoes = select(map, [L.LeftShoe, L.RightShoe]);
  const hemRow = frame && o.length ? rowForLength(frame, o.length) : null;
  const margin = frame ? frame.height * 0.02 : 4;
  const spread = o.wide ? 16 : 9;

  let editable: Grid;
  switch (o.zone) {
    case "upper": {
      editable = dilate(union(upperClothes, rows(dress, 0, box(upperClothes)?.y1 ?? H)), 6, 5);
      if (o.coversArms) editable = union(editable, dilate(arms, 2));
      // A longer top may cover the waistband or the hips of what they wear below
      const topEnd = box(upperClothes)?.y1 ?? 0;
      if (hemRow !== null && hemRow > topEnd) editable = union(editable, dilate(rows(union(lowerClothes, dress), 0, hemRow + margin), spread, 2));
      editable = subtract(editable, union(shoes, rows(legs, (hemRow ?? topEnd) + margin, H)));
      editable = subtract(editable, rows(lowerClothes, Math.max(topEnd, hemRow ?? 0) + margin, H));
      if (!o.coversArms) editable = subtract(editable, subtract(arms, sleeveEdge(upperClothes)));
      break;
    }
    case "lower": {
      editable = dilate(union(lowerClothes, rows(dress, box(lowerClothes)?.y0 ?? 0, H)), spread, 4);
      // Longer than what they wear now: open the legs down to the new hem
      if (hemRow !== null) editable = union(editable, dilate(rows(legs, 0, hemRow + margin), spread, 2));
      editable = subtract(editable, union(upperClothes, arms, shoes));
      if (hemRow !== null) editable = subtract(editable, rows(legs, hemRow + margin * 2, H));
      else editable = subtract(editable, subtract(legs, sleeveEdge(lowerClothes)));
      break;
    }
    case "full": {
      // Flared and wide designs only need extra room below the waist, never over the arms
      const waistRow = frame ? rowForLength(frame, "waist") : H * 0.45;
      const clothes = union(upperClothes, lowerClothes, dress);
      editable = union(dilate(rows(clothes, 0, waistRow), 6, 5), dilate(rows(clothes, waistRow, H), spread, 5));
      if (o.coversArms) editable = union(editable, dilate(arms, 2));
      else editable = subtract(editable, subtract(arms, sleeveEdge(union(upperClothes, dress))));
      if (hemRow !== null) {
        editable = union(editable, dilate(rows(legs, 0, hemRow + margin), spread, 2));
        editable = subtract(editable, rows(legs, hemRow + margin * 2, H));
      } else {
        editable = subtract(editable, subtract(legs, sleeveEdge(union(lowerClothes, dress))));
      }
      editable = subtract(editable, shoes);
      break;
    }
    case "feet": {
      const shoeBox = box(shoes);
      const legBox = box(legs);
      const ankleTop = shoeBox ? shoeBox.y0 - H * 0.05 : legBox ? legBox.y1 - legBox.h * 0.15 : H * 0.85;
      editable = dilate(union(shoes, rows(legs, ankleTop, H), shoeBox ? new Uint8Array(W * H) : rect(W * 0.3, ankleTop, W * 0.7, H - 1)), 4, 3);
      break;
    }
    case "eyes": {
      const f = box(face) ?? frame?.face;
      editable = f ? rect(f.x0 - f.w * 0.18, f.y0 + f.h * 0.22, f.x1 + f.w * 0.18, f.y0 + f.h * 0.58) : new Uint8Array(W * H);
      return editable;
    }
    case "head": {
      const f = box(face);
      const hairGrid = select(map, [L.Hair, L.Hat]);
      if (!f) return dilate(hairGrid, 3);
      const top = Math.max(0, (box(hairGrid)?.y0 ?? f.y0) - f.h * 0.45);
      return subtract(union(dilate(hairGrid, 3), rect(f.x0 - f.w * 0.35, top, f.x1 + f.w * 0.35, f.y0 + f.h * 0.2)), rect(0, f.y0 + f.h * 0.3, W - 1, H - 1));
    }
    case "jewellery": {
      const f = box(face);
      let out = new Uint8Array(W * H);
      if (f) {
        out = union(
          rect(f.x0 - f.w * 0.22, f.y0 + f.h * 0.35, f.x0 + f.w * 0.08, f.y1 + f.h * 0.1),
          rect(f.x1 - f.w * 0.08, f.y0 + f.h * 0.35, f.x1 + f.w * 0.22, f.y1 + f.h * 0.1),
          rect(f.x0 - f.w * 0.35, f.y1 - f.h * 0.05, f.x1 + f.w * 0.35, f.y1 + f.h * 0.95),
        );
      }
      for (const arm of [L.LeftArm, L.RightArm]) {
        const m = select(map, [arm]);
        const b = box(m);
        if (b) out = union(out, dilate(rows(m, b.y1 - b.h * 0.2, H), 3, 3));
      }
      return out;
    }
  }
  return subtract(editable, locked);
}

/** Full-size mask PNG for OpenAI and for pasting back: transparent where the item may change, opaque elsewhere. */
export function maskPng(editable: Grid): Uint8Array {
  const out = new Uint8Array(PHOTO_W * PHOTO_H * 4);
  const sx = GRID_W / PHOTO_W;
  const sy = GRID_H / PHOTO_H;
  const at = (x: number, y: number) => editable[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let y = 0; y < PHOTO_H; y++) {
    const gy = (y + 0.5) * sy - 0.5;
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    for (let x = 0; x < PHOTO_W; x++) {
      const gx = (x + 0.5) * sx - 0.5;
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      // Bilinear, so the edge between kept and changed pixels is soft
      const e = (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
      const i = (y * PHOTO_W + x) * 4;
      out[i + 3] = Math.round((1 - e) * 255);
    }
  }
  return encode({ width: PHOTO_W, height: PHOTO_H, data: out, channels: 4, depth: 8 });
}
