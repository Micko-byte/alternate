// Cuts just the chosen garment out of an inspiration photo (e.g. only the trousers,
// not the model's T-shirt or the jacket in their hand), on white, cropped with padding.
import { L, count, dilate, garmentClasses, parseImage, select, type PartMap } from "@/lib/garmentParser";
import { canvasToBlob } from "@/lib/bodyPhoto";

const MAX_SIDE = 1024;
const GRID = 320;

export type ParsedInspiration = { canvas: HTMLCanvasElement; map: PartMap };

export async function parseInspiration(file: File): Promise<ParsedInspiration> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const gridW = canvas.width >= canvas.height ? GRID : Math.round((GRID * canvas.width) / canvas.height);
  const gridH = canvas.height > canvas.width ? GRID : Math.round((GRID * canvas.height) / canvas.width);
  return { canvas, map: await parseImage(canvas, gridW, gridH) };
}

/** Best guess at what the photo is mainly showing, from the clothes parser (free, instant). The server checks again. */
export function guessCategory(parsed: ParsedInspiration): string | null {
  const { map } = parsed;
  const total = map.width * map.height;
  const areas: [string, number][] = [
    ["dress", count(select(map, [L.Dress]))],
    ["top", count(select(map, [L["Upper-clothes"]]))],
    ["bottom", count(select(map, [L.Pants]))],
    ["skirt", count(select(map, [L.Skirt]))],
    ["shoes", count(select(map, [L["Left-shoe"], L["Right-shoe"]])) * 2.5],
    ["headwear", count(select(map, [L.Hat])) * 2.5],
    ["eyewear", count(select(map, [L.Sunglasses])) * 4],
  ];
  const [best, area] = areas.sort((a, b) => b[1] - a[1])[0];
  return area > total * 0.02 ? best : null;
}

/** Returns a PNG of only that garment, or null if it can't be found in the photo. */
export async function cutoutGarment(parsed: ParsedInspiration, category: string): Promise<{ blob: Blob; url: string } | null> {
  const { canvas, map } = parsed;
  const classes = garmentClasses(category);
  if (!classes.length) return null;
  const garment = dilate(select(map, classes), map.width, map.height, 1);
  if (count(garment) < map.width * map.height * 0.015) return null;

  let minX = map.width, minY = map.height, maxX = 0, maxY = 0;
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++)
      if (garment[y * map.width + x]) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }

  // Mask at grid size → scaled up with smoothing, feathered edge
  const small = document.createElement("canvas");
  small.width = map.width;
  small.height = map.height;
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(map.width, map.height);
  for (let i = 0; i < garment.length; i++) img.data[i * 4 + 3] = garment[i] ? 255 : 0;
  sctx.putImageData(img, 0, 0);

  const layer = document.createElement("canvas");
  layer.width = canvas.width;
  layer.height = canvas.height;
  const lctx = layer.getContext("2d")!;
  lctx.imageSmoothingEnabled = true;
  lctx.filter = "blur(1.5px)";
  lctx.drawImage(small, 0, 0, canvas.width, canvas.height);
  lctx.filter = "none";
  lctx.globalCompositeOperation = "source-in";
  lctx.drawImage(canvas, 0, 0);

  const sx = canvas.width / map.width;
  const sy = canvas.height / map.height;
  const pad = 0.06 * Math.max(canvas.width, canvas.height);
  const x0 = Math.max(0, minX * sx - pad);
  const y0 = Math.max(0, minY * sy - pad);
  const x1 = Math.min(canvas.width, (maxX + 1) * sx + pad);
  const y1 = Math.min(canvas.height, (maxY + 1) * sy + pad);

  const out = document.createElement("canvas");
  out.width = Math.round(x1 - x0);
  out.height = Math.round(y1 - y0);
  const octx = out.getContext("2d")!;
  octx.fillStyle = "#FFFFFF";
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(layer, x0, y0, out.width, out.height, 0, 0, out.width, out.height);

  const blob = await canvasToBlob(out, "image/png");
  return { blob, url: URL.createObjectURL(blob) };
}
