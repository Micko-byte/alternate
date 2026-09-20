// The clothes parser itself, with no page or canvas in it, so the very same code can run inside the
// worker (where it belongs: it pins a CPU core for a few seconds) and, on a browser that has no
// workers, on the page as a fallback.
//
// Model: Xenova/segformer_b2_clothes, quantized (~29 MB), downloaded once and kept by the browser.
type Segment = { label: string; mask: { data: ArrayLike<number>; channels: number; width: number; height: number } };
type Segmenter = (image: unknown, options?: Record<string, unknown>) => Promise<Segment[]>;

export const LABELS = [
  "Background", "Hat", "Hair", "Sunglasses", "Upper-clothes", "Skirt", "Pants", "Dress", "Belt",
  "Left-shoe", "Right-shoe", "Face", "Left-leg", "Right-leg", "Left-arm", "Right-arm", "Bag", "Scarf",
] as const;

export const L = Object.fromEntries(LABELS.map((l, i) => [l, i])) as Record<(typeof LABELS)[number], number>;

export type PartMap = { width: number; height: number; labels: Uint8Array };

/** Raw RGBA pixels, the one shape that travels between the page and the worker for free. */
export type Pixels = { data: Uint8ClampedArray; width: number; height: number };

let segmenter: Promise<Segmenter> | null = null;

/** Downloads the model (once). A failed download is not remembered, so the next try starts over. */
export function loadSegmenter() {
  segmenter ??= import("@huggingface/transformers")
    .then(({ pipeline }) => pipeline("image-segmentation", "Xenova/segformer_b2_clothes", { dtype: "q8" }))
    .catch((err) => {
      segmenter = null;
      throw err;
    }) as Promise<Segmenter>;
  return segmenter;
}

/** Labels every pixel, returned at the requested grid size. */
export async function segmentPixels(pixels: Pixels, gridW: number, gridH: number): Promise<Uint8Array> {
  const [{ RawImage }, seg] = await Promise.all([import("@huggingface/transformers"), loadSegmenter()]);
  const output = await seg(new RawImage(pixels.data, pixels.width, pixels.height, 4), { target_sizes: [[gridH, gridW]] });
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
  return labels;
}
