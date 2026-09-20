// Runs the clothes parser away from the page, so scrolling, tapping and the spinner keep moving
// while a photo is read — on a phone that work takes seconds, and on the page it froze everything.
import { loadSegmenter, segmentPixels, type Pixels } from "@/lib/segment";

type Ask = { type: "warm" } | { type: "parse"; id: number; pixels: Pixels; gridW: number; gridH: number };

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<Ask>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

worker.onmessage = async ({ data: ask }) => {
  if (ask.type === "warm") {
    // Start the download while the shopper is still picking a photo
    void loadSegmenter().catch(() => {});
    return;
  }
  try {
    const labels = await segmentPixels(ask.pixels, ask.gridW, ask.gridH);
    worker.postMessage({ type: "parsed", id: ask.id, labels }, [labels.buffer]);
  } catch (err) {
    worker.postMessage({ type: "parsed", id: ask.id, error: (err as Error)?.message ?? String(err) });
  }
};
