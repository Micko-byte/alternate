// Waiting screens. Reading a photo takes seconds and a try-on takes a minute or two, so the wait
// is part of the product: it should look like the house, not like a stalled page.
//
// The motif is the name. ALTERNATE, so a band of the opposite colour sweeps down over the globe
// mark — ink over paper, paper over ink. Because both are theme tokens it inverts itself in dark
// mode with no second artwork.
//
// Nothing here invents a percentage. We cannot see inside a generation, so the bar is
// indeterminate and the stage lines say what is happening, never how much is left.
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** The globe, as a wireframe, with the alternating band running over it. */
export function AlternatingMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative block aspect-square w-20 overflow-hidden bg-paper", className)} aria-hidden>
      <Globe className="absolute inset-0 text-ink" />
      {/* The same globe again in the opposite colour, revealed only inside the travelling band */}
      <span className="absolute inset-0 animate-alternating bg-ink motion-reduce:hidden">
        <Globe className="absolute inset-0 text-paper" />
      </span>
    </span>
  );
}

function Globe({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn("h-full w-full", className)} fill="none" stroke="currentColor" strokeWidth="1.1" vectorEffect="non-scaling-stroke">
      <circle cx="50" cy="50" r="38" />
      {/* Meridians. They stay put: the band sweeping over them is the movement. */}
      <ellipse cx="50" cy="50" rx="13" ry="38" />
      <ellipse cx="50" cy="50" rx="26" ry="38" />
      <line x1="50" y1="12" x2="50" y2="88" />
      {/* Parallels */}
      <line x1="12" y1="50" x2="88" y2="50" />
      <path d="M19 30 Q50 39 81 30" />
      <path d="M19 70 Q50 61 81 70" />
    </svg>
  );
}

/**
 * A photo with a line travelling down it while it is read, scanlines and corner marks.
 * `active` off leaves the photo alone, so the same frame can stay on screen when the work is done.
 */
export function ScanFrame({ src, alt, active = true, className }: { src: string; alt: string; active?: boolean; className?: string }) {
  return (
    <div className={cn("relative aspect-[3/4] overflow-hidden border border-ink bg-sunk", className)}>
      <img src={src} alt={alt} className={cn("h-full w-full object-cover transition duration-700", active && "opacity-80 grayscale contrast-125")} />
      {active && (
        <>
          {/* Fine horizontal rules, the texture of something being read line by line */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:repeating-linear-gradient(to_bottom,rgb(var(--ink))_0px,rgb(var(--ink))_1px,transparent_1px,transparent_5px)]" />
          {/* The beam: a soft trail above a crisp leading edge, so it reads as travelling */}
          <div className="pointer-events-none absolute inset-x-0 h-12 animate-scan bg-gradient-to-b from-transparent to-ink/30 after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-ink after:content-[''] motion-reduce:top-1/2 motion-reduce:h-px motion-reduce:animate-none motion-reduce:bg-ink" />
          {/* Reticle corners */}
          {[
            "left-2 top-2 border-l border-t",
            "right-2 top-2 border-r border-t",
            "left-2 bottom-2 border-b border-l",
            "right-2 bottom-2 border-b border-r",
          ].map((corner) => (
            <span key={corner} className={cn("pointer-events-none absolute h-3.5 w-3.5 border-ink", corner)} />
          ))}
        </>
      )}
    </div>
  );
}

/** An indeterminate bar. It says work is happening, never how much is left. */
export function Crawl({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-[3px] w-full overflow-hidden bg-ink/10", className)} aria-hidden>
      <span className="absolute inset-y-0 w-1/3 animate-crawl bg-ink motion-reduce:left-0 motion-reduce:w-1/4 motion-reduce:animate-none" />
    </div>
  );
}

/**
 * Cycles through what is going on. Announced politely, so a screen reader hears the stage change
 * without the whole block being read out again.
 */
export function Pondering({ stages, className, interval = 2600 }: { stages: string[]; className?: string; interval?: number }) {
  const [at, setAt] = useState(0);
  useEffect(() => {
    setAt(0);
    if (stages.length < 2) return;
    const tick = setInterval(() => setAt((n) => (n + 1) % stages.length), interval);
    return () => clearInterval(tick);
  }, [stages, interval]);

  return (
    <p className={cn("min-h-[1.5em] font-mono text-[12px] uppercase tracking-label text-muted", className)} role="status" aria-live="polite">
      <span key={at} className="inline-block animate-rise">
        {stages[at]}
      </span>
    </p>
  );
}

/**
 * The standard wait: the mark, what is happening, and an indeterminate bar. `photo` puts the
 * picture being read beside it, scanning.
 */
export function LoadingPanel({
  title,
  stages,
  photo,
  note,
  className,
}: {
  title: string;
  stages: string[];
  photo?: { src: string; alt: string };
  note?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-5 border border-rule bg-surface p-6", photo && "sm:grid-cols-[minmax(0,160px)_1fr] sm:items-center sm:gap-7", className)}>
      {photo && <ScanFrame src={photo.src} alt={photo.alt} className="mx-auto w-full max-w-[200px]" />}
      <div className="grid content-center justify-items-center gap-4 text-center sm:justify-items-start sm:text-left">
        {!photo && <AlternatingMark className="w-16" />}
        <div className="grid gap-1.5">
          <h3 className="display text-[clamp(26px,4vw,34px)]">{title}</h3>
          <Pondering stages={stages} />
        </div>
        <Crawl className="max-w-[260px]" />
        {note && <p className="max-w-[34ch] text-[13px] text-muted">{note}</p>}
      </div>
    </div>
  );
}

/** What the browser is doing to a body photo, in the order it does it. */
export const BODY_PHOTO_STAGES = [
  "Reading your photo",
  "Finding your face and hair",
  "Mapping your top, trousers and shoes",
  "Drawing your fitting outline",
];

/** What the engine is doing to a try-on. */
export const TRYON_STAGES = [
  "Reading your body profile",
  "Matching the piece to your size",
  "Drawing it on you",
  "Checking the result",
];
