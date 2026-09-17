import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, Ruler, ScanFace, ShieldCheck, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ButtonLink } from "@/components/ui";
import { ProductCard, coverImage, type ProductWithRelations } from "@/components/ProductCard";
import { SiteImage } from "@/components/SiteImage";
import { PRODUCT_SELECT, useCreditPacks, useSizes } from "@/lib/queries";
import { kes } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import WarpText from "@/components/reactbits/WarpText";
import ScrollFloat from "@/components/reactbits/ScrollFloat";
import ScrollReveal from "@/components/reactbits/ScrollReveal";

/**
 * The public front page. Every photo is a named slot on Cloudinary, ALTERNATE/site/ (see docs/IMAGE_GUIDE.md):
 *   hero-photo.jpg · hero-item.jpg · hero-result.jpg
 *   women.jpg · men.jpg · screenshot.jpg · stores.jpg
 *   nairobi.jpg
 */
export default function Landing() {
  const { user } = useAuth();
  const { resolved: theme } = useTheme();
  const sizes = useSizes();
  const packs = useCreditPacks();
  const single = packs.data?.find((p) => p.is_active && p.credits === 1);

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
      {/* Hero: your photo + the piece = on you */}
      <section className="page grid gap-10 pb-16 pt-10 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-12">
        <div className="grid animate-rise gap-8">
          <span className="label">Virtual fitting room · Nairobi</span>
          <h1 className="sr-only">See it on you before you pay.</h1>
          <WarpText
            text={"See it on you\nbefore you pay."}
            color={theme === "dark" ? "#f3f1ec" : "#191710"}
            warpStrength={0.08}
            warpScale={1.7}
            speed={0.55}
            pointerInfluence={0.42}
            pointerStrength={0.38}
            refraction={0.018}
            ripple
            fontFamily='"Nohemi", "Satoshi", system-ui, sans-serif'
            fontSize="clamp(3rem, 10vw, 9rem)"
            fontWeight={800}
            style={{ height: "clamp(180px, 42vw, 320px)" }}
          />
          <p className="max-w-[48ch] text-[17px] text-muted">
            Add your photos once. Try on pieces from Kenyan Instagram and TikTok stores, or any screenshot you love, drawn to your real size and shape.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to={start} variant="solid" size="lg">Open the fitting room</ButtonLink>
            <ButtonLink to="/shop" variant="outline" size="lg">Shop new in</ButtonLink>
          </div>
        </div>

        <div className="grid animate-rise grid-cols-[0.75fr_1.25fr] items-end gap-3 [animation-delay:120ms]">
          <div className="grid gap-3">
            <figure className="grid gap-2">
              <SiteImage slot="hero-photo.jpg" alt="A shopper's own full-body photo" className="aspect-[2/3]" sizes="(max-width: 1024px) 38vw, 20vw" fallback={<PersonSketch />} />
              <figcaption className="label text-ink">Your photo</figcaption>
            </figure>
            <span className="grid h-9 w-9 place-items-center justify-self-center border border-ink bg-paper" aria-hidden>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
            </span>
            <figure className="grid gap-2">
              <SiteImage
                slot="hero-item.jpg"
                alt="A piece from a Nairobi store"
                className="aspect-[4/5]"
                sizes="(max-width: 1024px) 38vw, 20vw"
                fallback={covers[0] ? <img src={covers[0]} alt="" className="h-full w-full object-cover" /> : <PrintSketch />}
              />
              <figcaption className="label text-ink">The piece</figcaption>
            </figure>
          </div>
          <figure className="grid gap-2">
            <SiteImage
              slot="hero-result.jpg"
              alt="The same shopper wearing the piece, made by ALTERNATE"
              className="aspect-[2/3]"
              sizes="(max-width: 1024px) 62vw, 30vw"
              fallback={<div className="grid h-full place-items-center bg-accent p-6 text-center display text-[34px] text-white">On you, in your size</div>}
            />
            <figcaption className="label flex items-center gap-1.5 text-ink"><ShieldCheck className="h-3.5 w-3.5" /> On you · quality checked</figcaption>
          </figure>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-y border-rule">
        <div className="page grid divide-y divide-rule md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            { icon: ScanFace, title: "Your face stays yours", body: "The AI only changes the clothes. Your face, hair and pose are locked." },
            { icon: Ruler, title: "Your size, your shape", body: "Every photo you add teaches it your build, so clothes hang like they would on you." },
            { icon: Smartphone, title: "Pay with M-Pesa", body: single ? `${kes(single.price_kes)} a try-on. Bundles and plans save more.` : "Pay per try-on with M-Pesa." },
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
              <ScrollFloat containerClassName="pb-[0.12em]" textClassName="display text-[clamp(44px,6vw,88px)]">New on the rail</ScrollFloat>
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
            <ScrollFloat containerClassName="pb-[0.12em]" textClassName="display text-[clamp(52px,8vw,128px)]">Screenshot it. Try it on.</ScrollFloat>
            <ButtonLink to={start} variant="outline" size="lg" className="justify-self-start border-white text-white hover:bg-white hover:text-accent">
              Try a screenshot
            </ButtonLink>
          </div>
          <ol className="grid content-end gap-0 border-t border-white/25">
            {[
              ["Your photos", "Front, side, arms, legs. The more you add, the truer the fit."],
              ["The piece", "A screenshot, a store photo or a frame from a store video. We check what's really in it."],
              ["See it on you", "In a minute or two, drawn in your size and checked before you see it."],
            ].map(([t, b], i) => (
              <li key={t} className="grid grid-cols-[48px_1fr] gap-4 border-b border-white/25 py-6">
                <span className="num text-[13px] text-white/60">0{i + 1}</span>
                <div className="grid gap-1">
                  <ScrollReveal baseOpacity={0} enableBlur baseRotation={5} blurStrength={10} wordAnimationEnd="bottom center" textClassName="display text-[30px]">
                    {t}
                  </ScrollReveal>
                  <ScrollReveal baseOpacity={0} enableBlur baseRotation={5} blurStrength={10} wordAnimationEnd="bottom center" textClassName="text-white/70">
                    {b}
                  </ScrollReveal>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Four callouts */}
      <section className="page grid gap-4 py-20 sm:grid-cols-2 lg:grid-cols-4">
        <Callout to="/shop?d=women" slot="women.jpg" alt="Womenswear from Nairobi stores" fallbackImage={covers[1]} kicker="Shop" title="Womenswear" />
        <Callout to="/shop?d=men" slot="men.jpg" alt="Menswear from Nairobi stores" fallbackImage={covers[4]} kicker="Shop" title="Menswear" tone="navy" />
        <Callout to={start} slot="screenshot.jpg" alt="Trying on a look from a screenshot" fallbackImage={covers[2]} kicker="Fitting room" title="Try any screenshot" />
        <Callout to="/studio" slot="stores.jpg" alt="A Nairobi store owner with her rail" fallbackImage={covers[3]} kicker="For stores" title="Sell on ALTERNATE" tone="mustard" />
      </section>

      {/* Statement */}
      <section className="border-t border-rule">
        <div className="page grid gap-10 py-20 md:grid-cols-[1.3fr_1fr] md:py-28">
          <div className="grid content-start gap-8">
            <ScrollFloat containerClassName="pb-[0.12em]" textClassName="display text-[clamp(56px,9vw,144px)]">Made in Nairobi.</ScrollFloat>
            <SiteImage slot="nairobi.jpg" alt="Nairobi skyline with the expressway" className="aspect-[3/2]" sizes="(max-width: 768px) 100vw, 55vw" fallback={<div className="h-full bg-sunk" />} />
          </div>
          <div className="grid content-end gap-5 text-[17px] text-muted">
            <p>
              Kenya shops on Instagram, TikTok and at the stall. ALTERNATE lets you see a piece on your own body before you send the M-Pesa, and lets boutiques and mitumba sellers show every follower how it fits.
            </p>
            <p className="text-ink">Stores list for free and earn 20% of what their followers spend on ALTERNATE.</p>
            <Link to="/studio" className="label flex items-center gap-2 text-ink hover:underline">
              Open your store <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Callout({ to, slot, alt, fallbackImage, kicker, title, tone }: { to: string; slot: string; alt: string; fallbackImage?: string; kicker: string; title: string; tone?: "mustard" | "navy" }) {
  const toneClass = tone === "mustard" ? "bg-mustard" : tone === "navy" ? "bg-accent" : "bg-sunk";
  return (
    <Link to={to} className="group relative grid aspect-[4/5] content-end overflow-hidden bg-sunk">
      <SiteImage
        slot={slot}
        alt={alt}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        className="absolute inset-0"
        imgClassName="transition-transform duration-700 group-hover:scale-[1.03]"
        fallback={fallbackImage ? <img src={fallbackImage} alt="" className="h-full w-full object-cover" /> : <div className={`h-full w-full ${toneClass}`} />}
      />
      <div className="relative grid gap-3 bg-gradient-to-t from-black/70 to-transparent p-6 text-white">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-label text-white/75">{kicker}</span>
        <span className="display text-[clamp(34px,3.6vw,52px)]">{title}</span>
        <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-label">
          Shop now <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

function PersonSketch() {
  return (
    <svg viewBox="0 0 200 300" className="h-full w-full" aria-hidden>
      <rect width="200" height="300" fill="#ECEAE4" />
      <ellipse cx="100" cy="58" rx="19" ry="23" fill="#4A3228" />
      <path d="M79 46c4-20 38-22 44 0 3 10 2 22-2 28-2-15-10-24-20-24s-19 7-22 20c-2-7-2-16 0-24z" fill="#1B1414" />
      <path d="M92 80h16l2 12H90z" fill="#4A3228" />
      <path d="M72 98c9-6 19-8 28-8s19 2 28 8l6 70-10 2 4 110H72l4-110-10-2z" fill="#B9B4A8" />
      <path d="M66 168c-4 24-7 44-7 58l-9-2c2-18 6-40 10-58zM134 168c4 24 7 44 7 58l9-2c-2-18-6-40-10-58z" fill="#4A3228" />
    </svg>
  );
}

function PrintSketch() {
  return (
    <svg viewBox="0 0 200 250" className="h-full w-full" aria-hidden>
      <defs>
        <pattern id="print" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="22" height="22" fill="#222A41" />
          <circle cx="11" cy="11" r="5" fill="#DBAE49" />
          <circle cx="0" cy="0" r="2.5" fill="#F3F2EE" />
          <circle cx="22" cy="22" r="2.5" fill="#F3F2EE" />
        </pattern>
      </defs>
      <rect width="200" height="250" fill="#ECEAE4" />
      <path d="M84 30h32l6 22c10 4 18 12 20 20l8 158H50l8-158c2-8 10-16 20-20z" fill="url(#print)" />
      <path d="M84 30c4 10 28 10 32 0" stroke="#191710" strokeWidth="2" fill="none" />
    </svg>
  );
}
