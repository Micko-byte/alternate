import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A marketing photo slot. Drop the file into public/site/ with the slot's name; until it exists
 * (or if it fails to load) the fallback shows instead. See docs/IMAGE_GUIDE.md for every slot.
 */
export function SiteImage({ slot, alt, fallback, className, imgClassName }: { slot: string; alt: string; fallback: ReactNode; className?: string; imgClassName?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("relative overflow-hidden bg-sunk", className)}>
      {failed ? (
        fallback
      ) : (
        <img src={`/site/${slot}`} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={cn("h-full w-full object-cover", imgClassName)} />
      )}
    </div>
  );
}
