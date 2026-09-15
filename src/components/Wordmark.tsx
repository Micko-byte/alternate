import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** The ALTERNATE globe logo. `full` adds "EST. 2025". Switches to the white logo in dark mode (or always with `light`). */
export function Wordmark({ className, suffix, full, light }: { className?: string; suffix?: string; full?: boolean; light?: boolean }) {
  const base = `/brand/alternate-${full ? "logo" : "mark"}`;
  const size = full ? "h-20" : "h-11";
  return (
    <Link to="/" className={cn("group inline-flex items-center gap-3", className)} aria-label="ALTERNATE home">
      {light ? (
        <img src={`${base}-white.png`} alt="ALTERNATE" className={cn("w-auto select-none", size)} draggable={false} />
      ) : (
        <>
          <img src={`${base}.png`} alt="ALTERNATE" className={cn("w-auto select-none dark:hidden", size)} draggable={false} />
          <img src={`${base}-white.png`} alt="" aria-hidden className={cn("hidden w-auto select-none dark:block", size)} draggable={false} />
        </>
      )}
      {suffix && <span className="font-mono text-[11px] font-semibold uppercase tracking-label text-muted">{suffix}</span>}
    </Link>
  );
}
