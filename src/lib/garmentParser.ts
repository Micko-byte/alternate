// Clothes parsing in the browser (no per-use cost): labels every pixel as face, hair,
// upper clothes, pants, skirt, dress, arms, legs, shoes, bag… using SegFormer-B2 (ATR clothes).
// The model and the labelling live in @/lib/segment; this file hands the work to a worker so the
// page stays alive while it runs, and falls back to the page if the browser has no workers.
import { L, loadSegmenter, segmentPixels, type PartMap, type Pixels } from "@/lib/segment";

export { L, LABELS, type PartMap } from "@/lib/segment";

export type Zone = "upper" | "lower" | "full" | "feet" | "eyes" | "head" | "jewellery";

/** Which part of the body a garment type replaces. */
export function zoneFor(category: string | null | undefined): Zone {
  if (category === "top" || category === "outerwear") return "upper";
  if (category === "bottom" || category === "skirt") return "lower";
  if (category === "shoes") return "feet";
  if (category === "eyewear") return "eyes";
  if (category === "headwear") return "head";
  if (category === "jewellery") return "jewellery";
  return "full";
}

// The model reads a 512-pixel square whatever we give it, so a bigger canvas only costs a phone
// time and memory. Everything above this is shrunk first, keeping the shape of the photo.
const WORK_MAX_SIDE = 768;

type Reply = { type: "parsed"; id: number; labels?: Uint8Array; error?: string };

let worker: Worker | null | undefined;
let nextId = 1;
const waiting = new Map<number, { resolve: (labels: Uint8Array) => void; reject: (err: unknown) => void }>();

function dropWorker(reason: string) {
  worker = null;
  for (const pending of waiting.values()) pending.reject(new Error(reason));
  waiting.clear();
}

/** The one worker for the whole app: it outlives every screen, so leaving a page never stops it. */
function getWorker() {
  if (worker !== undefined) return worker;
  try {
    const started = new Worker(new URL("./segment.worker.ts", import.meta.url), { type: "module" });
    started.onmessage = ({ data }: MessageEvent<Reply>) => {
      if (data?.type !== "parsed") return;
      const pending = waiting.get(data.id);
      if (!pending) return;
      waiting.delete(data.id);
      if (data.labels) pending.resolve(data.labels);
      else pending.reject(new Error(data.error ?? "The photo reader stopped"));
    };
    started.onerror = () => dropWorker("The photo reader stopped");
    worker = started;
  } catch {
    worker = null;
  }
  return worker;
}

let warmed = false;

/**
 * Starts the 29 MB download early — while the shopper is still choosing a file — so the wait
 * afterwards is the parsing alone. Skipped for anyone who asked their phone to save data.
 */
export function warmGarmentParser() {
  if (warmed) return;
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
  warmed = true;
  const ready = getWorker();
  if (ready) ready.postMessage({ type: "warm" });
  else void loadSegmenter().catch(() => {});
}

/** RGBA pixels of a canvas, shrunk to the size the model actually reads. */
function readPixels(canvas: HTMLCanvasElement): Pixels {
  const scale = Math.min(1, WORK_MAX_SIDE / Math.max(canvas.width, canvas.height));
  if (scale === 1) {
    const full = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
    return { data: full.data, width: canvas.width, height: canvas.height };
  }
  const width = Math.max(1, Math.round(canvas.width * scale));
  const height = Math.max(1, Math.round(canvas.height * scale));
  const small = document.createElement("canvas");
  small.width = width;
  small.height = height;
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

function parseInWorker(pixels: Pixels, gridW: number, gridH: number) {
  const ready = getWorker();
  if (!ready) return Promise.reject(new Error("This browser reads photos on the page"));
  const id = nextId++;
  return new Promise<Uint8Array>((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    ready.postMessage({ type: "parse", id, pixels, gridW, gridH }, [pixels.data.buffer as ArrayBuffer]);
  });
}

/** Label map for an image, at the requested grid size. */
export async function parseImage(canvas: HTMLCanvasElement, gridW: number, gridH: number): Promise<PartMap> {
  let labels: Uint8Array;
  try {
    // The pixels are handed over, not copied, so they can only be read once
    labels = await parseInWorker(readPixels(canvas), gridW, gridH);
  } catch (err) {
    console.warn("Reading the photo on the page instead:", err);
    labels = await segmentPixels(readPixels(canvas), gridW, gridH);
  }
  return { width: gridW, height: gridH, labels };
}

export function select(map: PartMap, classes: number[]) {
  const set = new Set(classes);
  const out = new Uint8Array(map.labels.length);
  for (let i = 0; i < out.length; i++) if (set.has(map.labels[i])) out[i] = 1;
  return out;
}

export function count(mask: Uint8Array) {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
}

/** Grow a binary mask by r cells (separable max filter). */
export function dilate(src: Uint8Array, w: number, h: number, rx: number, ry = rx) {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let k = -rx; k <= rx; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w && src[y * w + xx]) {
          tmp[y * w + x] = 1;
          break;
        }
      }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let k = -ry; k <= ry; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h && tmp[yy * w + x]) {
          out[y * w + x] = 1;
          break;
        }
      }
  return out;
}

export function subtract(a: Uint8Array, b: Uint8Array) {
  const out = a.slice();
  for (let i = 0; i < out.length; i++) if (b[i]) out[i] = 0;
  return out;
}

export function union(...masks: Uint8Array[]) {
  const out = new Uint8Array(masks[0].length);
  for (const m of masks) for (let i = 0; i < out.length; i++) if (m[i]) out[i] = 1;
  return out;
}

/** Garment classes to keep when cutting a garment out of an inspiration photo. */
export function garmentClasses(category: string): number[] {
  switch (category) {
    case "top":
    case "outerwear":
      return [L["Upper-clothes"], L.Scarf];
    case "bottom":
      return [L.Pants, L.Belt];
    case "skirt":
      return [L.Skirt, L.Belt];
    case "dress":
      return [L.Dress, L["Upper-clothes"], L.Skirt, L.Belt];
    case "shoes":
      return [L["Left-shoe"], L["Right-shoe"]];
    case "eyewear":
      return [L.Sunglasses];
    case "headwear":
      return [L.Hat];
    case "jewellery":
      // Too small for the parser: the whole photo is used
      return [];
    default:
      return [L["Upper-clothes"], L.Pants, L.Skirt, L.Dress, L.Belt, L.Scarf];
  }
}
