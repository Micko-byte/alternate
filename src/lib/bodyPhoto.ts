// Body photos, in the browser when a shopper adds one:
// - normalise the photo to 1024x1536 PNG (the size the try-on engine returns)
// - label every part of it (face, hair, top, trousers, arms, legs, shoes…) with the clothes parser
// - save that label map as a small "parts map" PNG. The try-on engine builds the exact edit mask for each
//   item from it, and the measurements are read from it.
// - save a face mask for the preview (and for try-ons made before parts maps existed)
import { L, count, dilate, parseImage, select, type PartMap } from "@/lib/garmentParser";
import { supabase } from "@/integrations/supabase/client";
import { loadImage } from "@/lib/utils";

export const PHOTO_W = 1024;
export const PHOTO_H = 1536;

export const GRID_W = 256;
export const GRID_H = 384;

// Label values are stored ×12 in the red channel so they survive PNG encoding clearly
const LABEL_SCALE = 12;

export type PreparedPhoto = {
  photo: Blob;
  partsMap: Blob;
  faceMask: Blob;
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
  const face = dilate(select(map, [L.Face, L.Hair, L.Hat, L.Sunglasses]), GRID_W, GRID_H, 2);

  const [photo, partsMap, faceMask] = await Promise.all([
    canvasToBlob(canvas, "image/png"),
    partsMapPng(map),
    gridToPng(face, (on) => (on ? [255, 255, 255, 255] : [0, 0, 0, 0])),
  ]);

  // Preview: locked face and hair shaded. Drawn from the grid, not from the mask PNG we just made:
  // encoding and decoding a full-size PNG again costs a phone a second for a picture nobody keeps.
  const overlay = document.createElement("canvas");
  overlay.width = PHOTO_W;
  overlay.height = PHOTO_H;
  const octx = overlay.getContext("2d")!;
  octx.drawImage(canvas, 0, 0);
  const tint = grown(gridCanvas(face, (on) => (on ? [255, 255, 255, 255] : [0, 0, 0, 0])));
  const tctx = tint.getContext("2d")!;
  tctx.globalCompositeOperation = "source-in";
  tctx.fillStyle = "rgba(34, 42, 65, 0.42)";
  tctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
  octx.drawImage(tint, 0, 0);

  return {
    photo,
    partsMap,
    faceMask,
    overlayUrl: URL.createObjectURL(await canvasToBlob(overlay, "image/jpeg", 0.85)),
    faceFound: count(select(map, [L.Face])) > 40,
    bodyFound: count(select(map, [L["Upper-clothes"], L.Pants, L.Skirt, L.Dress, L["Left-leg"], L["Right-leg"]])) > GRID_W * GRID_H * 0.06,
  };
}

function partsMapPng(map: PartMap) {
  const canvas = document.createElement("canvas");
  canvas.width = GRID_W;
  canvas.height = GRID_H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(GRID_W, GRID_H);
  for (let i = 0; i < map.labels.length; i++) {
    img.data[i * 4] = map.labels[i] * LABEL_SCALE;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasToBlob(canvas, "image/png");
}

/** Reads a stored parts map back into labels. */
export async function loadPartsMap(url: string): Promise<PartMap> {
  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = GRID_W;
  canvas.height = GRID_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, GRID_W, GRID_H);
  const data = ctx.getImageData(0, 0, GRID_W, GRID_H).data;
  const labels = new Uint8Array(GRID_W * GRID_H);
  for (let i = 0; i < labels.length; i++) labels[i] = Math.min(17, Math.round(data[i * 4] / LABEL_SCALE));
  return { width: GRID_W, height: GRID_H, labels };
}

type PhotoRow = { id: string; user_id: string; storage_path: string; parts_map_path?: string | null };

/**
 * Photos added before parts maps existed get one made from the stored photo (in the browser, free).
 * Returns the parts map path.
 */
export async function ensurePartsMap(photo: PhotoRow) {
  if (photo.parts_map_path) return photo.parts_map_path;
  const { data } = await supabase.storage.from("body-photos").createSignedUrl(photo.storage_path, 600);
  if (!data) throw new Error("Couldn't open your photo");
  const img = await loadImage(data.signedUrl);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_W;
  canvas.height = PHOTO_H;
  canvas.getContext("2d")!.drawImage(img, 0, 0, PHOTO_W, PHOTO_H);
  const png = await partsMapPng(await parseImage(canvas, GRID_W, GRID_H));
  const path = `${photo.user_id}/masks/${photo.id}-parts.png`;
  const { error: uploadError } = await supabase.storage.from("body-photos").upload(path, png, { contentType: "image/png", upsert: true });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from("body_photos").update({ parts_map_path: path }).eq("id", photo.id);
  if (error) throw error;
  return path;
}

function gridCanvas(grid: Uint8Array, color: (on: boolean) => number[]) {
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
  return small;
}

/** The grid drawn at photo size, softened, the way the engine and the paste-back want it. */
function grown(small: HTMLCanvasElement) {
  const big = document.createElement("canvas");
  big.width = PHOTO_W;
  big.height = PHOTO_H;
  const bctx = big.getContext("2d")!;
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, PHOTO_W, PHOTO_H);
  return big;
}

function gridToPng(grid: Uint8Array, color: (on: boolean) => number[]) {
  return canvasToBlob(grown(gridCanvas(grid, color)), "image/png");
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), type, quality),
  );
}

/**
 * Saves a prepared photo: the photo itself, its parts map and its face mask go up together rather
 * than one after the other (three round trips on a phone is most of the wait), then the row.
 * Returns the new photo's id.
 */
export async function saveBodyPhoto(userId: string, angle: "front" | "back" | "side", prepared: PreparedPhoto) {
  const id = crypto.randomUUID();
  const paths = {
    photo: `${userId}/${id}.png`,
    parts: `${userId}/masks/${id}-parts.png`,
    face: `${userId}/masks/${id}-face.png`,
  };
  const bucket = supabase.storage.from("body-photos");
  const uploads = await Promise.all(
    ([
      [paths.photo, prepared.photo],
      [paths.parts, prepared.partsMap],
      [paths.face, prepared.faceMask],
    ] as [string, Blob][]).map(([path, blob]) => bucket.upload(path, blob, { contentType: "image/png" })),
  );
  const failed = uploads.find((u) => u.error);
  if (failed?.error) throw failed.error;

  const { error } = await supabase.from("body_photos").insert({
    id,
    user_id: userId,
    angle,
    storage_path: paths.photo,
    parts_map_path: paths.parts,
    face_mask_path: paths.face,
    width: PHOTO_W,
    height: PHOTO_H,
    confirmed_self: true,
  });
  if (error) throw error;
  return id;
}
