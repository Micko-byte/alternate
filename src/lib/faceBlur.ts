// Blurs a face on a canvas using the photo's face mask (white where the face and hair are).
import { loadImage } from "@/lib/utils";

/** Returns a new canvas: the source with the masked area blurred. */
export async function blurFaceOn(source: HTMLCanvasElement | HTMLImageElement, maskUrl: string) {
  const w = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
  const h = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;
  const mask = await loadImage(maskUrl);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(source, 0, 0, w, h);

  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  const lctx = layer.getContext("2d")!;
  // Soft-edged mask, then a strong blur of the image inside it
  lctx.filter = `blur(${Math.max(4, Math.round(w / 100))}px)`;
  lctx.drawImage(mask, 0, 0, w, h);
  lctx.filter = `blur(${Math.max(8, Math.round(w / 30))}px)`;
  lctx.globalCompositeOperation = "source-in";
  lctx.drawImage(source, 0, 0, w, h);
  ctx.drawImage(layer, 0, 0);
  return out;
}
