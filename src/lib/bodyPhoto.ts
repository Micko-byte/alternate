// Garment-aware lock, part 1 (in the browser when a shopper adds a photo):
// - normalise the photo to 1024x1536 PNG (the size the try-on engine returns)
// - parse clothes and body parts
// - one edit mask per zone: transparent where that garment may change, opaque everywhere else
//   (face, hair, the other garments, hands, what they hold, shoes, background)
// The same mask is used to paste the untouched parts back after generation.
import { L, count, dilate, parseImage, select, subtract, union, type PartMap } from "@/lib/garmentParser";
import { supabase } from "@/integrations/supabase/client";
import { loadImage } from "@/lib/utils";

export const PHOTO_W = 1024;
export const PHOTO_H = 1536;

const GRID_W = 256;
const GRID_H = 384;

export type PreparedPhoto = {
  photo: Blob;
  masks: { upper: Blob; lower: Blob; full: Blob; face: Blob; feet: Blob; eyes: Blob; head: Blob; jewellery: Blob };
  overlayUrl: string;
  faceFound: boolean;
  bodyFound: boolean;
};

export async function prepareBodyPhoto(file: File): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_W;
  canvas.height = PHOTO_H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ECE7E4";
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
  const scale = Math.min(PHOTO_W / bitmap.width, PHOTO_H / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (PHOTO_W - w) / 2, (PHOTO_H - h) / 2, w, h);
  bitmap.close();

  const map = await parseImage(canvas, GRID_W, GRID_H);
  const zones = buildZones(map);

  const photo = await canvasToBlob(canvas, "image/png");
  const [upper, lower, full, face, accessories] = await Promise.all([
    maskPng(zones.upper),
    maskPng(zones.lower),
    maskPng(zones.full),
    gridToPng(zones.face, (on) => (on ? [255, 255, 255, 255] : [0, 0, 0, 0])),
    accessoryMasks(map),
  ]);

  // Preview: locked face and hair shaded
  const overlay = document.createElement("canvas");
  overlay.width = PHOTO_W;
  overlay.height = PHOTO_H;
  const octx = overlay.getContext("2d")!;
  octx.drawImage(canvas, 0, 0);
  const tint = document.createElement("canvas");
  tint.width = PHOTO_W;
  tint.height = PHOTO_H;
  const tctx = tint.getContext("2d")!;
  tctx.drawImage(await loadImage(URL.createObjectURL(face)), 0, 0, PHOTO_W, PHOTO_H);
  tctx.globalCompositeOperation = "source-in";
  tctx.fillStyle = "rgba(34, 42, 65, 0.42)";
  tctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
  octx.drawImage(tint, 0, 0);

  return {
    photo,
    masks: { upper, lower, full, face, ...accessories },
    overlayUrl: URL.createObjectURL(await canvasToBlob(overlay, "image/jpeg", 0.85)),
    faceFound: count(select(map, [L.Face])) > 40,
    bodyFound: count(select(map, [L["Upper-clothes"], L.Pants, L.Skirt, L.Dress, L["Left-leg"], L["Right-leg"]])) > GRID_W * GRID_H * 0.06,
  };
}

function buildZones(map: PartMap) {
  const W = map.width;
  const H = map.height;
  const face = dilate(select(map, [L.Face, L.Hair, L.Hat, L.Sunglasses]), W, H, 2);
  const alwaysKeep = union(face, select(map, [L.Bag]));

  const upperClothes = select(map, [L["Upper-clothes"], L.Scarf, L.Dress]);
  const arms = select(map, [L["Left-arm"], L["Right-arm"]]);
  const lowerClothes = select(map, [L.Pants, L.Skirt, L.Belt, L.Dress]);
  const legs = select(map, [L["Left-leg"], L["Right-leg"]]);
  const shoes = select(map, [L["Left-shoe"], L["Right-shoe"]]);

  // Tops: the top and sleeves can grow a little; trousers, legs and shoes stay
  const upper = subtract(subtract(dilate(union(upperClothes, arms), W, H, 6, 5), union(select(map, [L.Pants, L.Skirt]), legs, shoes)), alwaysKeep);
  // Trousers & skirts: can widen (wide leg, baggy) and lengthen over the ankles; top, arms, hands stay
  const lower = subtract(subtract(dilate(union(lowerClothes, legs), W, H, 9, 4), union(select(map, [L["Upper-clothes"], L.Scarf]), arms)), alwaysKeep);
  // Full outfit
  const full = subtract(dilate(union(upperClothes, lowerClothes, arms, legs), W, H, 9, 5), alwaysKeep);
  return { upper, lower, full, face };
}

type Box = { x0: number; y0: number; x1: number; y1: number; w: number; h: number };

function box(mask: Uint8Array, W: number, H: number): Box | null {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (mask[y * W + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function rect(W: number, H: number, x0: number, y0: number, x1: number, y1: number) {
  const out = new Uint8Array(W * H);
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++)
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) out[y * W + x] = 1;
  return out;
}

function intersect(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] & b[i];
  return out;
}

/** Shoes, glasses, hats and jewellery: small editable areas, so everything else stays locked. */
function accessoryZones(map: PartMap) {
  const W = map.width;
  const H = map.height;
  const hair = select(map, [L.Hair, L.Hat]);
  const face: Box = box(select(map, [L.Face]), W, H) ?? box(hair, W, H) ?? { x0: W * 0.42, y0: H * 0.04, x1: W * 0.58, y1: H * 0.14, w: W * 0.16, h: H * 0.1 };

  // Shoes, plus the ankles just above them so boots and chunky sneakers have room
  const shoes = select(map, [L["Left-shoe"], L["Right-shoe"]]);
  const legs = select(map, [L["Left-leg"], L["Right-leg"]]);
  const shoeBox = box(shoes, W, H);
  const legBox = box(legs, W, H);
  const ankleTop = shoeBox ? shoeBox.y0 - H * 0.05 : legBox ? legBox.y1 - legBox.h * 0.15 : H * 0.85;
  const feet = dilate(
    union(shoes, intersect(legs, rect(W, H, 0, ankleTop, W - 1, H - 1)), shoeBox ? new Uint8Array(W * H) : rect(W, H, W * 0.3, ankleTop, W * 0.7, H - 1)),
    W, H, 4, 3,
  );

  // Glasses: the eye band, out to the ears
  const eyes = rect(W, H, face.x0 - face.w * 0.18, face.y0 + face.h * 0.22, face.x1 + face.w * 0.18, face.y0 + face.h * 0.58);

  // Hats: hair and the space above it, never the face below the brow
  const headTop = Math.max(0, (box(hair, W, H)?.y0 ?? face.y0) - face.h * 0.45);
  const head = subtract(
    union(dilate(hair, W, H, 3, 3), rect(W, H, face.x0 - face.w * 0.35, headTop, face.x1 + face.w * 0.35, face.y0 + face.h * 0.2)),
    rect(W, H, 0, face.y0 + face.h * 0.3, W - 1, H - 1),
  );

  // Jewellery: ears, neck and collarbone, wrists and hands
  const ears = union(
    rect(W, H, face.x0 - face.w * 0.22, face.y0 + face.h * 0.35, face.x0 + face.w * 0.08, face.y1 + face.h * 0.1),
    rect(W, H, face.x1 - face.w * 0.08, face.y0 + face.h * 0.35, face.x1 + face.w * 0.22, face.y1 + face.h * 0.1),
  );
  const neck = rect(W, H, face.x0 - face.w * 0.35, face.y1 - face.h * 0.05, face.x1 + face.w * 0.35, face.y1 + face.h * 0.95);
  let wrists = new Uint8Array(W * H);
  for (const arm of [L["Left-arm"], L["Right-arm"]]) {
    const m = select(map, [arm]);
    const b = box(m, W, H);
    if (b) wrists = union(wrists, dilate(intersect(m, rect(W, H, 0, b.y1 - b.h * 0.2, W - 1, H - 1)), W, H, 3, 3));
  }

  return { feet, eyes, head, jewellery: union(ears, neck, wrists) };
}

async function accessoryMasks(map: PartMap) {
  const z = accessoryZones(map);
  const [feet, eyes, head, jewellery] = await Promise.all([maskPng(z.feet), maskPng(z.eyes), maskPng(z.head), maskPng(z.jewellery)]);
  return { feet, eyes, head, jewellery };
}

const ACCESSORY_COLUMNS = { feet: "mask_feet_path", eyes: "mask_eyes_path", head: "mask_head_path", jewellery: "mask_jewellery_path" } as const;

type PhotoRow = { id: string; user_id: string; storage_path: string } & Partial<Record<(typeof ACCESSORY_COLUMNS)[keyof typeof ACCESSORY_COLUMNS], string | null>>;

/**
 * Photos added before shoes and accessories existed have no masks for them.
 * Makes them from the stored photo (in the browser, free) and saves them. Returns true if the photo was updated.
 */
export async function ensureAccessoryMasks(photo: PhotoRow, zone: string) {
  if (!(zone in ACCESSORY_COLUMNS) || photo[ACCESSORY_COLUMNS[zone as keyof typeof ACCESSORY_COLUMNS]]) return false;
  const { data } = await supabase.storage.from("body-photos").createSignedUrl(photo.storage_path, 600);
  if (!data) throw new Error("Couldn't open your photo");
  const img = await loadImage(data.signedUrl);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_W;
  canvas.height = PHOTO_H;
  canvas.getContext("2d")!.drawImage(img, 0, 0, PHOTO_W, PHOTO_H);
  const masks = await accessoryMasks(await parseImage(canvas, GRID_W, GRID_H));
  const update: Record<string, string> = {};
  for (const [key, column] of Object.entries(ACCESSORY_COLUMNS)) {
    const path = `${photo.user_id}/masks/${photo.id}-${key}.png`;
    const { error } = await supabase.storage.from("body-photos").upload(path, masks[key as keyof typeof masks], { contentType: "image/png", upsert: true });
    if (error) throw error;
    update[column] = path;
  }
  const { error } = await supabase.from("body_photos").update(update).eq("id", photo.id);
  if (error) throw error;
  return true;
}

/** Transparent where the garment may change, opaque (kept) everywhere else. */
function maskPng(editable: Uint8Array) {
  return gridToPng(editable, (on) => (on ? [0, 0, 0, 0] : [0, 0, 0, 255]));
}

async function gridToPng(grid: Uint8Array, color: (on: boolean) => number[]) {
  const small = document.createElement("canvas");
  small.width = GRID_W;
  small.height = GRID_H;
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(GRID_W, GRID_H);
  for (let i = 0; i < grid.length; i++) {
    const [r, g, b, a] = color(!!grid[i]);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = a;
  }
  sctx.putImageData(img, 0, 0);
  const big = document.createElement("canvas");
  big.width = PHOTO_W;
  big.height = PHOTO_H;
  const bctx = big.getContext("2d")!;
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, PHOTO_W, PHOTO_H);
  return canvasToBlob(big, "image/png");
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), type, quality),
  );
}
