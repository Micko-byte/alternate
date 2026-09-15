import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ImagePlus, Ruler, ScanFace, ShoppingBag, type LucideIcon } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

/**
 * First screen for people without an account: what ALTERNATE does, then sign up.
 * Images: drop files into public/onboarding/ named 1.jpg, 2.jpg, 3.jpg, 4.jpg.
 * Until a file exists, that slide shows a designed placeholder.
 */
const SLIDES: { image: string; kicker: string; title: string; body: string; icon: LucideIcon; tone: string }[] = [
  {
    image: "/onboarding/1.jpg",
    kicker: "Virtual fitting room",
    title: "See it on you before you pay.",
    body: "Add your photos, then try on clothes from Nairobi's stores. Drawn on your real body.",
    icon: ScanFace,
    tone: "bg-sunk text-ink",
  },
  {
    image: "/onboarding/2.jpg",
    kicker: "Seen it online?",
    title: "Screenshot it. Try it on.",
    body: "Upload any look from Instagram or TikTok and see yourself wearing it.",
    icon: ImagePlus,
    tone: "bg-accent text-white",
  },
  {
    image: "/onboarding/3.jpg",
    kicker: "Made to fit",
    title: "Your size. Your fit.",
    body: "Fitted to baggy, only pieces in stock in your size. Your face never changes.",
    icon: Ruler,
    tone: "bg-mustard text-ink",
  },
  {
    image: "/onboarding/4.jpg",
    kicker: "Womenswear & menswear",
    title: "Shop the stores you follow.",
    body: "Boutiques, thrift and mitumba sellers in one place. Pay with M-Pesa.",
    icon: ShoppingBag,
    tone: "bg-ink text-paper",
  },
];

const INTERVAL_MS = 4500;

export default function Onboarding() {
  const [params] = useSearchParams();
  const next = params.get("next");
  const withNext = (path: string) => (next ? `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}` : path);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [missing, setMissing] = useState<Record<number, boolean>>({});
  const startX = useRef<number | null>(null);

  const go = (i: number) => setIndex((i + SLIDES.length) % SLIDES.length);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (paused || reduced) return;
    const timer = window.setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused]);

  const slide = SLIDES[index];

  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Carousel */}
      <section
        className="relative h-[58dvh] min-h-[340px] overflow-hidden bg-sunk lg:order-1 lg:h-auto lg:min-h-dvh"
        aria-roledescription="carousel"
        aria-label="What ALTERNATE does"
        onPointerDown={(e) => {
          startX.current = e.clientX;
          setPaused(true);
        }}
        onPointerUp={(e) => {
          if (startX.current !== null) {
            const dx = e.clientX - startX.current;
            if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
          }
          startX.current = null;
          setPaused(false);
        }}
        onPointerLeave={() => {
          startX.current = null;
          setPaused(false);
        }}
      >
        <div className="flex h-full transition-transform duration-700 ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none" style={{ transform: `translateX(-${index * 100}%)` }}>
          {SLIDES.map((s, i) => (
            <div key={s.image} className="relative h-full w-full shrink-0" aria-hidden={i !== index} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${SLIDES.length}`}>
              {!missing[i] ? (
                <img
                  src={s.image}
                  alt=""
                  draggable={false}
                  onError={() => setMissing((m) => ({ ...m, [i]: true }))}
                  className="h-full w-full select-none object-cover"
                />
              ) : (
                <Placeholder slide={s} number={i + 1} />
              )}
            </div>
          ))}
        </div>

        <div className="absolute inset-x-5 top-5 flex items-start justify-between lg:inset-x-8 lg:top-8">
          <div className="bg-paper/90 px-3 py-2">
            <img src="/brand/alternate-mark.png" alt="ALTERNATE" className="h-9 w-auto dark:hidden" />
            <img src="/brand/alternate-mark-white.png" alt="" aria-hidden className="hidden h-9 w-auto dark:block" />
          </div>
          <ThemeToggle className="bg-paper/90" />
        </div>

        {/* Progress bars */}
        <div className="absolute inset-x-5 bottom-5 flex gap-1.5 lg:inset-x-8 lg:bottom-8">
          {SLIDES.map((s, i) => (
            <button key={s.image} onClick={() => go(i)} aria-label={`Show slide ${i + 1}`} aria-current={i === index} className="h-6 flex-1 py-2.5">
              <span className="block h-[3px] overflow-hidden bg-paper/45">
                <span
                  key={`${index}-${paused}`}
                  className={cn("block h-full bg-paper", i < index ? "w-full" : i === index ? (paused ? "w-full" : "animate-[grow_4.5s_linear_forwards] motion-reduce:w-full") : "w-0")}
                />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Copy + actions */}
      <section className="flex flex-1 flex-col justify-between gap-8 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-7 lg:order-2 lg:justify-center lg:px-16">
        <div className="grid gap-4" aria-live="polite">
          <span key={`k-${index}`} className="label animate-rise">{slide.kicker}</span>
          <h1 key={`t-${index}`} className="display animate-rise text-[clamp(40px,6.5vw,76px)]">
            {slide.title}
          </h1>
          <p key={`b-${index}`} className="max-w-[40ch] animate-rise text-[16px] text-muted">
            {slide.body}
          </p>
        </div>

        <div className="grid gap-3 lg:max-w-sm">
          <Link to={withNext("/auth?mode=signup")} className={buttonClass("solid", "lg", "w-full")}>
            Get started
          </Link>
          <Link to={withNext("/auth")} className={buttonClass("outline", "lg", "w-full")}>
            I already have an account
          </Link>
          <div className="flex flex-wrap justify-center gap-x-5 lg:justify-start">
            <Link to="/auth?mode=signup&as=store" className="label py-2 text-ink underline underline-offset-4">
              Selling clothes? Open a store
            </Link>
            <Link to="/welcome" className="label py-2 text-ink underline underline-offset-4">
              See how it works
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Placeholder({ slide, number }: { slide: (typeof SLIDES)[number]; number: number }) {
  const Icon = slide.icon;
  return (
    <div className={cn("grid h-full w-full place-items-center", slide.tone)}>
      <div className="grid justify-items-center gap-5 px-8 text-center">
        <Icon className="h-20 w-20 lg:h-28 lg:w-28" strokeWidth={1} />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-label opacity-60">{String(number).padStart(2, "0")}</span>
      </div>
    </div>
  );
}
