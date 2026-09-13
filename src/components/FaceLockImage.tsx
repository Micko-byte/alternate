// Face lock, part 2: paste the shopper's original face and hair back over the AI result.
import { useEffect, useRef, useState } from "react";
import { cn, loadImage } from "@/lib/utils";

export function FaceLockImage({
  resultUrl,
  photoUrl,
  faceMaskUrl,
  locked,
  className,
  onReady,
}: {
  resultUrl: string;
  photoUrl: string | null;
  faceMaskUrl: string | null;
  locked: boolean;
  className?: string;
  onReady?: (canvas: HTMLCanvasElement) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await loadImage(resultUrl);
        const canvas = ref.current;
        if (!canvas || cancelled) return;
        const w = result.naturalWidth;
        const h = result.naturalHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(result, 0, 0, w, h);

        if (locked && photoUrl && faceMaskUrl) {
          const [photo, mask] = await Promise.all([loadImage(photoUrl), loadImage(faceMaskUrl)]);
          if (cancelled) return;
          const layer = document.createElement("canvas");
          layer.width = w;
          layer.height = h;
          const lctx = layer.getContext("2d")!;
          lctx.filter = "blur(5px)"; // feathered edge
          lctx.drawImage(mask, 0, 0, w, h);
          lctx.filter = "none";
          lctx.globalCompositeOperation = "source-in";
          lctx.drawImage(photo, 0, 0, w, h);
          ctx.drawImage(layer, 0, 0);
        }
        onReady?.(canvas);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resultUrl, photoUrl, faceMaskUrl, locked, onReady]);

  if (failed) return <img src={resultUrl} alt="Your try-on" className={cn("w-full", className)} />;
  return <canvas ref={ref} role="img" aria-label="Your try-on" className={cn("aspect-[2/3] w-full bg-sunk", className)} />;
}
