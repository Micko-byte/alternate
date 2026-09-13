// Garment-aware lock, part 1 (in the browser when a shopper adds a photo):
// - normalise the photo to 1024x1536 PNG (the size the try-on engine returns)
// - parse clothes and body parts
// - one edit mask per zone: transparent where that garment may change, opaque everywhere else
//   (face, hair, the other garments, hands, what they hold, shoes, background)
// The same mask is used to paste the untouched parts back after generation.
import { L, count, dilate, parseImage, select, subtract, union, type PartMap } from "@/lib/garmentParser";
import { loadImage } from "@/lib/utils";

export const PHOTO_W = 1024;
export const PHOTO_H = 1536;

const GRID_W = 256;
const GRID_H = 384;

export type PreparedPhoto = {
  photo: Blob;
  masks: { upper: Blob; lower: Blob; full: Blob; face: Blob };
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
  const [upper, lower, full, face] = await Promise.all([
    maskPng(zones.upper),
    maskPng(zones.lower),
    maskPng(zones.full),
    gridToPng(zones.face, (on) => (on ? [255, 255, 255, 255] : [0, 0, 0, 0])),
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
    masks: { upper, lower, full, face },
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
