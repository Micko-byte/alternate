import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bell, Heart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PRODUCT_SELECT, fitFor, useBodyPhotos, useCredits, useProfile, useSetupStatus, useSizes, useTryonPrices } from "@/lib/queries";
import { FITS, SIZE_SYSTEMS, sizeText, type FitStyle } from "@/lib/sizes";
import { QUALITY_LABELS, startTryon } from "@/lib/tryon";
import { CATEGORY_SINGULAR, cn, errorMessage, kes, publicMediaUrl, signedUrl } from "@/lib/utils";
import { Button, ButtonLink, Notice, Pill, Spinner } from "@/components/ui";
import type { ProductWithRelations } from "@/components/ProductCard";
import { FitPicker } from "@/components/FitPicker";

type Full = ProductWithRelations & {
  description: string | null;
  is_one_of_a_kind: boolean;
  stores: { id: string; name: string; slug: string; whatsapp_phone: string | null; instagram_handle: string | null };
};

export default function Product() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sizes = useSizes();
  const setup = useSetupStatus();
  const photos = useBodyPhotos();
  const prices = useTryonPrices();
  const credits = useCredits();
  const [active, setActive] = useState(0);
  const [quality, setQuality] = useState<"standard" | "hd" | "studio">("standard");
  const [photoId, setPhotoId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const profile = useProfile();
  const [fitStyle, setFitStyle] = useState<FitStyle>("regular");
  useEffect(() => {
    if (profile.data?.preferred_fit) setFitStyle(profile.data.preferred_fit);
  }, [profile.data?.preferred_fit]);

  const product = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as unknown as Full | null;
    },
  });

  const alerts = useQuery({
    queryKey: ["size-alerts", user?.id, id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("size_alerts").select("size_system, size_value").eq("product_id", id!).eq("user_id", user!.id);
      return (data ?? []).map((a) => `${a.size_system}:${a.size_value}`);
    },
  });

  const saved = useQuery({
    queryKey: ["saved", user?.id, id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("saved_products").select("product_id").eq("product_id", id!).eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  const thumbs = useQuery({
    queryKey: ["photo-thumbs", photos.data?.map((p) => p.id).join()],
    enabled: !!photos.data?.length,
    queryFn: async () => Object.fromEntries(await Promise.all(photos.data!.map(async (p) => [p.id, await signedUrl("body-photos", p.storage_path)]))),
  });

  if (product.isLoading) return <div className="grid place-items-center py-24"><Spinner /></div>;
  if (!product.data) return <Notice title="This item isn't available">It may have been removed by the store. <Link to="/shop" className="underline">Back to the shop</Link></Notice>;

  const p = product.data;
  const media = [...p.product_media].sort((a, b) => Number(b.is_tryon_source) - Number(a.is_tryon_source) || a.position - b.position);
  const current = media[active];
  const result = fitFor(p.product_variants, sizes.data, p.category, fitStyle);
  const fit = result.state;
  const mySizes = (sizes.data ?? []).filter((s) => s.category === p.category);
  const chosenPhoto = photoId ?? photos.data?.find((ph) => ph.angle === "front")?.id ?? photos.data?.[0]?.id;
  const cost = prices.data?.[quality] ?? 1;
  const hasImage = media.some((m) => m.kind === "image");

  const tryOn = async () => {
    if (!chosenPhoto) return;
    setBusy(true);
    try {
      const tryonId = await startTryon({ bodyPhotoId: chosenPhoto, productId: p.id, quality, fit: fitStyle, category: p.category });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      navigate(`/try/${tryonId}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  const notifyMe = async () => {
    const { error } = await supabase.from("size_alerts").insert({ user_id: user!.id, product_id: p.id, size_system: result.system!, size_value: result.target! });
    if (error && !error.message.includes("duplicate")) return toast.error(errorMessage(error));
    toast.success(`We'll tell you when ${sizeText(result.system, result.target)} is back`);
    alerts.refetch();
  };

  const toggleSave = async () => {
    if (saved.data) await supabase.from("saved_products").delete().eq("product_id", p.id).eq("user_id", user!.id);
    else await supabase.from("saved_products").insert({ product_id: p.id, user_id: user!.id });
    saved.refetch();
  };

  return (
    <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:gap-14">
      <div className="grid content-start gap-3">
        <div className="aspect-[3/4] overflow-hidden bg-sunk">
          {current?.kind === "video" ? (
            <video src={publicMediaUrl(current.storage_path)!} controls playsInline className="h-full w-full bg-ink object-contain" />
          ) : current ? (
            <img src={publicMediaUrl(current.storage_path)!} alt={p.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center font-display text-muted">No photos yet</div>
          )}
        </div>
        {media.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {media.map((m, i) => (
              <button key={m.storage_path} onClick={() => setActive(i)} className={cn("relative h-20 w-16 shrink-0 overflow-hidden border-2 bg-sunk", i === active ? "border-ink" : "border-transparent")} aria-label={`Show ${m.kind} ${i + 1}`}>
                {m.kind === "video" ? <span className="grid h-full place-items-center label">Video</span> : <img src={publicMediaUrl(m.storage_path)!} alt="" className="h-full w-full object-cover" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid content-start gap-7">
        <div className="grid gap-3">
          <Link to={`/s/${p.stores.slug}`} className="label hover:text-accent">{p.stores.name}</Link>
          <h1 className="display text-[clamp(34px,5vw,52px)]">{p.name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="num text-[20px]">{kes(p.price_kes)}</span>
            {p.is_one_of_a_kind && <Pill tone="warn">One of a kind</Pill>}
          </div>
          {p.description && <p className="max-w-[60ch] text-muted">{p.description}</p>}
        </div>

        <div className="grid gap-3">
          <div className="flex items-baseline justify-between">
            <span className="label">Sizes</span>
            {user && mySizes.length > 0 && (
              <span className="text-[13px] text-muted">
                Your {CATEGORY_SINGULAR[p.category]} size: <span className="num text-ink">{mySizes.map((s) => sizeText(s.size_system, s.size_value)).join(" · ")}</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {p.product_variants.map((v) => {
              const mine = result.variant?.id === v.id;
              return (
                <span key={v.id} className={cn("grid min-w-[56px] gap-0.5 border px-3 py-2 text-center", mine ? "border-ink" : "border-rule", v.stock_qty === 0 && "text-muted line-through")}>
                  <span className="num text-[14px] font-medium">{v.size_label}</span>
                  <span className="text-[10.5px] text-muted no-underline">{v.stock_qty === 0 ? "Sold out" : `${v.stock_qty} left`}</span>
                </span>
              );
            })}
          </div>
        </div>

        <TryPanel />

        <div className="flex flex-wrap gap-2 border-t border-rule pt-5">
          {p.stores.whatsapp_phone && (
            <a href={`https://wa.me/${p.stores.whatsapp_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${p.stores.name}, I'd like to buy "${p.name}" (${kes(p.price_kes)}) — found on ALTERNATE.`)}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 border border-rule bg-surface px-4 text-[14px] font-semibold hover:border-ink">
              <MessageCircle className="h-4 w-4" /> Buy on WhatsApp
            </a>
          )}
          {user && (
            <button onClick={toggleSave} className="inline-flex h-11 items-center gap-2 border border-rule bg-surface px-4 text-[14px] font-semibold hover:border-ink" aria-pressed={!!saved.data}>
              <Heart className={cn("h-4 w-4", saved.data && "fill-accent text-accent")} /> {saved.data ? "Saved" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  function TryPanel() {
    if (!user) return <Notice tone="accent" title="See this on you" action={<ButtonLink to={`/auth?next=/shop/${p.id}`} variant="accent" size="sm">Sign in</ButtonLink>}>Create a free account and add your photo.</Notice>;
    if (setup.loading) return <Spinner />;
    if (!hasImage) return <Notice title="Try-on coming soon">The store hasn't added a photo for try-on yet.</Notice>;
    if (fit === "sold-out") return <Notice tone="neutral" title="Sold out in every size" />;
    if (!setup.ready) return <Notice tone="accent" title="Finish your fitting profile to try this on" action={<ButtonLink to="/me/setup" variant="accent" size="sm">Set up</ButtonLink>}>Add your photo, age and privacy choices once.</Notice>;
    if (fit === "needs-size")
      return (
        <Notice tone="accent" title={`Add your ${CATEGORY_SINGULAR[p.category]} size (${SIZE_SYSTEMS[result.system ?? "uk_women"].label})`} action={<ButtonLink to="/me/setup#sizes" variant="solid" size="sm">Add size</ButtonLink>}>
          This store sizes it in {SIZE_SYSTEMS[result.system ?? "uk_women"].label}.
        </Notice>
      );
    const fitLabel = FITS.find((f) => f.value === fitStyle)!.label.toLowerCase();
    if (fit === "not-in-size") {
      const waiting = alerts.data?.includes(`${result.system}:${result.target}`);
      return (
        <div className="grid gap-4">
          <FitPicker value={fitStyle} onChange={setFitStyle} hint="looser fits size up" />
          <Notice
            tone="neutral"
            title={`Not in stock in ${sizeText(result.system, result.target)}${fitStyle === "regular" || fitStyle === "fitted" ? "" : ` (for a ${fitLabel} fit)`}`}
            action={waiting ? <Pill tone="good">We'll tell you</Pill> : <Button size="sm" variant="outline" onClick={notifyMe}><Bell className="h-4 w-4" /> Tell me when it's back</Button>}
          />
        </div>
      );
    }
    return (
      <div className="grid gap-4 border border-ink bg-surface p-5">
        <div className="flex items-center justify-between">
          <span className="display text-[26px]">{result.variant?.size_min == null ? "One size. Try it on." : `Size ${result.variant.size_label} for you.`}</span>
          <Link to="/credits" className="text-[13px] text-muted hover:text-ink"><span className="num text-ink">{credits.data ?? 0}</span> credits</Link>
        </div>
        <FitPicker value={fitStyle} onChange={setFitStyle} hint="looser fits size up" />
        <fieldset className="grid grid-cols-3 gap-2">
          <legend className="label mb-2">Quality</legend>
          {(["standard", "hd", "studio"] as const).map((q) => (
            <label key={q} className={cn("grid cursor-pointer gap-0.5 border px-3 py-2.5", quality === q ? "border-ink bg-sunk" : "border-rule")}>
              <input type="radio" name="quality" value={q} checked={quality === q} onChange={() => setQuality(q)} className="sr-only" />
              <span className="text-[14px] font-semibold">{QUALITY_LABELS[q].name}</span>
              <span className="num text-[12px] text-muted">{prices.data?.[q] ?? "–"} cr</span>
            </label>
          ))}
        </fieldset>
        {(photos.data?.length ?? 0) > 1 && (
          <fieldset className="grid gap-2">
            <legend className="label mb-2">Photo</legend>
            <div className="flex gap-2">
              {photos.data!.map((ph) => (
                <button type="button" key={ph.id} onClick={() => setPhotoId(ph.id)} className={cn("h-20 w-14 overflow-hidden border-2 bg-sunk", chosenPhoto === ph.id ? "border-accent" : "border-transparent")} aria-label={`Use ${ph.angle} photo`}>
                  {thumbs.data?.[ph.id] && <img src={thumbs.data[ph.id]!} alt="" className="h-full w-full object-cover" />}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {(credits.data ?? 0) < cost ? (
          <ButtonLink to="/credits" variant="accent" size="lg">Get credits to try on</ButtonLink>
        ) : (
          <Button variant="accent" size="lg" onClick={tryOn} loading={busy}>
            Try it on · {cost} {cost === 1 ? "credit" : "credits"}
          </Button>
        )}
        <p className="text-[12.5px] text-muted">Your face and hair stay exactly as in your photo. If a try-on fails, your credits come back.</p>
      </div>
    );
  }
}
