import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeftRight, ArrowRight, Ruler, ScanFace, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ButtonLink } from "@/components/ui";
import { ProductCard, coverImage, type ProductWithRelations } from "@/components/ProductCard";
import { PRODUCT_SELECT, useCreditPacks, useSizes } from "@/lib/queries";
import { kes } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export default function Landing() {
  const { user } = useAuth();
  const sizes = useSizes();
  const packs = useCreditPacks();
  const starter = packs.data?.find((p) => p.is_active);

  const products = useQuery({
    queryKey: ["landing-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("status", "active")
        .eq("stores.status", "active")
        .order("created_at", { ascending: false })
        .limit(12);
      return (data ?? []) as unknown as ProductWithRelations[];
    },
  });

  const list = products.data ?? [];
  const covers = list.map((p) => coverImage(p.product_media)).filter(Boolean) as string[];
  const start = user ? "/fitting-room" : "/auth?mode=signup";

  return (
    <div>
      {/* Hero */}
      <section className="page grid gap-10 pb-16 pt-10 md:pt-16 lg:grid-cols-[1.25fr_1fr] lg:items-end lg:gap-12">
        <div className="grid animate-rise gap-8">
          <span className="label">Virtual fitting room · Nairobi</span>
          <h1 className="display text-[clamp(64px,10.5vw,168px)]">
            See it on you before you pay.
          </h1>
          <p className="max-w-[48ch] text-[17px] text-muted">
            Upload your photo once. Try on clothes from Kenyan Instagram and TikTok stores, or any screenshot you love, drawn to fit your real size.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to={start} variant="solid" size="lg">Open the fitting room</ButtonLink>
            <ButtonLink to="/shop" variant="outline" size="lg">Shop new in</ButtonLink>
          </div>
        </div>
        <Diptych inspiration={covers[0]} />
      </section>

      {/* Trust badges */}
      <section className="border-y border-rule">
        <div className="page grid divide-y divide-rule md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            { icon: ScanFace, title: "Face locked", body: "The AI never changes your face or hair." },
            { icon: Ruler, title: "Only your size", body: "Pieces in stock in your size, drawn to fit it." },
            { icon: Smartphone, title: "Pay with M-Pesa", body: starter ? `${kes(starter.price_kes)} for ${starter.credits} try-ons. No subscription.` : "Small credit packs. No subscription." },
          ].map((b) => (
            <div key={b.title} className="flex items-start gap-4 py-7 md:px-8 md:first:pl-0">
              <b.icon className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={1.4} aria-hidden />
              <div className="grid gap-1">
                <h2 className="label text-ink">{b.title}</h2>
                <p className="text-[14px] text-muted">{b.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top picks rail */}
      {list.length > 0 && (
        <section className="page grid gap-8 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-4">
              <span className="label">Our top picks this week</span>
              <h2 className="display text-[clamp(44px,6vw,88px)]">New on the rail</h2>
            </div>
            <Link to="/shop" className="label flex items-center gap-2 text-ink hover:underline">
              Shop all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="flex snap-x gap-4 overflow-x-auto pb-2">
            {list.map((p) => (
              <div key={p.id} className="w-[62vw] shrink-0 snap-start sm:w-[38vw] lg:w-[23%]">
                <ProductCard product={p} sizes={sizes.data} signedIn={!!user} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Feature band */}
      <section className="bg-accent text-white">
        <div className="page grid gap-12 py-20 md:grid-cols-[1.2fr_1fr] md:py-28">
          <div className="grid content-start gap-6">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-label text-white/60">Seen it on Instagram?</span>
            <h2 className="display text-[clamp(52px,8vw,128px)]">Screenshot it. Try it on.</h2>
            <ButtonLink to={start} variant="outline" size="lg" className="justify-self-start border-white text-white hover:bg-white hover:text-accent">
              Try a screenshot
            </ButtonLink>
          </div>
          <ol className="grid content-end gap-0 border-t border-white/25">
            {[
              ["Your photo", "One full-body photo. Your face and hair are locked."],
              ["Your inspiration", "A screenshot, a store photo or a frame from a store video."],
              ["See it on you", "In about a minute, drawn in your size. Then buy from the store."],
            ].map(([t, b], i) => (
              <li key={t} className="grid grid-cols-[48px_1fr] gap-4 border-b border-white/25 py-6">
                <span className="num text-[13px] text-white/60">0{i + 1}</span>
                <div className="grid gap-1">
                  <span className="display text-[30px]">{t}</span>
                  <span className="text-white/70">{b}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Three callouts */}
      <section className="page grid gap-4 py-20 sm:grid-cols-2 lg:grid-cols-4">
        <Callout to="/shop?d=women" image={covers[1] ?? covers[0]} kicker="Shop" title="Womenswear" />
        <Callout to="/shop?d=men" image={covers[4]} kicker="Shop" title="Menswear" tone="navy" />
        <Callout to={start} image={covers[2]} kicker="Fitting room" title="Try any screenshot" />
        <Callout to="/studio" image={covers[3]} kicker="For stores" title="Sell on ALTERNATE" tone="mustard" />
      </section>

      {/* Statement */}
      <section className="border-t border-rule">
        <div className="page grid gap-10 py-20 md:grid-cols-[1.3fr_1fr] md:py-28">
          <h2 className="display text-[clamp(56px,9vw,144px)]">Made in Nairobi.</h2>
          <div className="grid content-end gap-5 text-[17px] text-muted">
            <p>
              Kenya shops on Instagram, TikTok and at the stall. ALTERNATE lets you see a piece on your own body before you send the M-Pesa, and lets boutiques and mitumba sellers show every follower how it fits.
            </p>
            <p className="text-ink">Stores list for free and earn 20% of what their followers spend on try-ons.</p>
            <Link to="/studio" className="label flex items-center gap-2 text-ink hover:underline">
              Open your store <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Your photo ⇄ inspiration: the product's core move, shown as the hero object. */
function Diptych({ inspiration }: { inspiration?: string }) {
  return (
    <div className="grid animate-rise grid-cols-[1fr_auto_1fr] items-center gap-3 [animation-delay:120ms]">
      <Panel label="Your photo">
        <svg viewBox="0 0 200 300" className="h-full w-full" aria-hidden>
          <rect width="200" height="300" fill="#ECEAE4" />
          <ellipse cx="100" cy="58" rx="19" ry="23" fill="#4A3228" />
          <path d="M79 46c4-20 38-22 44 0 3 10 2 22-2 28-2-15-10-24-20-24s-19 7-22 20c-2-7-2-16 0-24z" fill="#1B1414" />
          <path d="M92 80h16l2 12H90z" fill="#4A3228" />
          <path d="M72 98c9-6 19-8 28-8s19 2 28 8l6 70-10 2 4 110H72l4-110-10-2z" fill="#B9B4A8" />
          <path d="M66 168c-4 24-7 44-7 58l-9-2c2-18 6-40 10-58zM134 168c4 24 7 44 7 58l9-2c-2-18-6-40-10-58z" fill="#4A3228" />
        </svg>
      </Panel>
      <span className="grid h-11 w-11 place-items-center border border-ink bg-paper" aria-hidden>
        <ArrowLeftRight className="h-5 w-5" strokeWidth={1.5} />
      </span>
      <Panel label="Inspiration">
        {inspiration ? (
          <img src={inspiration} alt="" className="h-full w-full object-cover" />
        ) : (
          <svg viewBox="0 0 200 300" className="h-full w-full" aria-hidden>
            <defs>
              <pattern id="print" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="22" height="22" fill="#222A41" />
                <circle cx="11" cy="11" r="5" fill="#DBAE49" />
                <circle cx="0" cy="0" r="2.5" fill="#F3F2EE" />
                <circle cx="22" cy="22" r="2.5" fill="#F3F2EE" />
              </pattern>
            </defs>
            <rect width="200" height="300" fill="#ECEAE4" />
            <path d="M84 40h32l6 26c10 4 18 12 20 22l10 190H48L58 88c2-10 10-18 20-22z" fill="url(#print)" />
            <path d="M84 40c4 10 28 10 32 0" stroke="#191710" strokeWidth="2" fill="none" />
          </svg>
        )}
      </Panel>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="grid gap-2">
      <div className="aspect-[2/3] overflow-hidden bg-sunk">{children}</div>
      <figcaption className="label text-ink">{label}</figcaption>
    </figure>
  );
}

function Callout({ to, image, kicker, title, tone }: { to: string; image?: string; kicker: string; title: string; tone?: "mustard" | "navy" }) {
  return (
    <Link to={to} className="group relative grid aspect-[4/5] content-end overflow-hidden bg-sunk">
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
      ) : (
        <div className={`absolute inset-0 ${tone === "mustard" ? "bg-mustard" : tone === "navy" ? "bg-accent" : "bg-sunk"}`} aria-hidden />
      )}
      <div className={`relative grid gap-3 p-6 ${image ? "bg-gradient-to-t from-ink/70 to-transparent text-white" : tone === "navy" ? "text-white" : "text-ink"}`}>
        <span className={`font-mono text-[11px] font-semibold uppercase tracking-label ${image || tone === "navy" ? "text-white/75" : "text-ink/60"}`}>{kicker}</span>
        <span className="display text-[clamp(34px,3.6vw,52px)]">{title}</span>
        <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-label">
          Shop now <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
