import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** The ALTERNATE globe logo. `full` adds "EST. 2025"; `light` is for dark backgrounds. */
export function Wordmark({ className, suffix, full, light }: { className?: string; suffix?: string; full?: boolean; light?: boolean }) {
  const src = `/brand/alternate-${full ? "logo" : "mark"}${light ? "-white" : ""}.png`;
  return (
    <Link to="/" className={cn("group inline-flex items-center gap-3", className)} aria-label="ALTERNATE home">
      <img src={src} alt="ALTERNATE" className={cn("w-auto select-none", full ? "h-20" : "h-11")} draggable={false} />
      {suffix && <span className="font-mono text-[11px] font-semibold uppercase tracking-label text-muted">{suffix}</span>}
    </Link>
  );
}
