import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { cloudinaryImage } from "@/lib/cloudinary";

/**
 * A marketing photo slot, served from Cloudinary as ALTERNATE/site/<slot>. If it fails to load, the fallback
 * shows instead. See docs/IMAGE_GUIDE.md for every slot.
 */
export function SiteImage({ slot, alt, fallback, className, imgClassName, sizes = "(max-width: 768px) 100vw, 50vw" }: {
  slot: string;
  alt: string;
  fallback: ReactNode;
  className?: string;
  imgClassName?: string;
  /** How wide the image shows, so phones download a phone-sized copy. */
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("relative overflow-hidden bg-sunk", className)}>
      {failed ? (
        fallback
      ) : (
        <img {...cloudinaryImage(`site/${slot.replace(/\.jpg$/, "")}`, sizes)} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={cn("h-full w-full object-cover", imgClassName)} />
      )}
    </div>
  );
}
