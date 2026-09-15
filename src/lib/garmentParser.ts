// Clothes parsing in the browser (no per-use cost): labels every pixel as face, hair,
// upper clothes, pants, skirt, dress, arms, legs, shoes, bag… using SegFormer-B2 (ATR clothes).
// Model: Xenova/segformer_b2_clothes, quantized (~29 MB), downloaded once and cached by the browser.
type Segment = { label: string; mask: { data: ArrayLike<number>; channels: number; width: number; height: number } };
type Segmenter = (image: unknown, options?: Record<string, unknown>) => Promise<Segment[]>;

export const LABELS = [
  "Background", "Hat", "Hair", "Sunglasses", "Upper-clothes", "Skirt", "Pants", "Dress", "Belt",
  "Left-shoe", "Right-shoe", "Face", "Left-leg", "Right-leg", "Left-arm", "Right-arm", "Bag", "Scarf",
] as const;

export const L = Object.fromEntries(LABELS.map((l, i) => [l, i])) as Record<(typeof LABELS)[number], number>;

export type PartMap = { width: number; height: number; labels: Uint8Array };

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

let segmenter: Promise<Segmenter> | null = null;

function getSegmenter() {
  segmenter ??= import("@huggingface/transformers").then(({ pipeline }) =>
    pipeline("image-segmentation", "Xenova/segformer_b2_clothes", { dtype: "q8" }) as unknown as Promise<Segmenter>,
  );
  return segmenter;
}

/** Start downloading the model early (e.g. when the upload screen opens). */
export function warmGarmentParser() {
  void getSegmenter().catch(() => {
    segmenter = null;
  });
}

/** Label map for an image, at the requested grid size. */
export async function parseImage(canvas: HTMLCanvasElement, gridW: number, gridH: number): Promise<PartMap> {
  const [{ RawImage }, seg] = await Promise.all([import("@huggingface/transformers"), getSegmenter()]);
  const output = await seg(RawImage.fromCanvas(canvas), { target_sizes: [[gridH, gridW]] });
  const labels = new Uint8Array(gridW * gridH);
  for (const segment of output) {
    const index = (LABELS as readonly string[]).indexOf(segment.label);
    if (index <= 0) continue;
    const { data, channels, width, height } = segment.mask;
    const sx = width / gridW;
    const sy = height / gridH;
    for (let y = 0; y < gridH; y++) {
      const my = Math.min(height - 1, Math.floor(y * sy));
      for (let x = 0; x < gridW; x++) {
        const mx = Math.min(width - 1, Math.floor(x * sx));
        if (data[(my * width + mx) * channels] > 127) labels[y * gridW + x] = index;
      }
    }
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
