import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { blurFaceOn } from "@/lib/faceBlur";
import { cn, loadImage } from "@/lib/utils";

/** A body photo shown with the face blurred until the shopper chooses to see it. */
export function PrivatePhoto({ photoUrl, faceMaskUrl, alt, className, showToggle = true }: {
  photoUrl: string;
  faceMaskUrl: string | null | undefined;
  alt: string;
  className?: string;
  /** Small thumbnails follow the big photo's choice and don't get their own button. */
  showToggle?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [blurred, setBlurred] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const img = await loadImage(photoUrl);
        const view = blurred && faceMaskUrl ? await blurFaceOn(img, faceMaskUrl) : img;
        const canvas = ref.current;
        if (!canvas || cancelled) return;
        canvas.width = view instanceof HTMLCanvasElement ? view.width : img.naturalWidth;
        canvas.height = view instanceof HTMLCanvasElement ? view.height : img.naturalHeight;
        canvas.getContext("2d")!.drawImage(view, 0, 0);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photoUrl, faceMaskUrl, blurred]);

  if (failed) return <div className={cn("bg-sunk", className)} role="img" aria-label={alt} />;

  return (
    <div className={cn("relative", className)}>
      <canvas ref={ref} role="img" aria-label={alt} className="h-full w-full object-cover" />
      {showToggle && faceMaskUrl && (
        <button
          type="button"
          onClick={() => setBlurred((b) => !b)}
          className="absolute left-2 top-2 flex h-9 items-center gap-1.5 bg-paper/90 px-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-label text-ink hover:bg-paper"
          aria-pressed={!blurred}
        >
          {blurred ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {blurred ? "Show face" : "Blur face"}
        </button>
      )}
    </div>
  );
}
