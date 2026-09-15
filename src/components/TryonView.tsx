import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Flag, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/queries";
import { kickTryon, QUALITY_LABELS } from "@/lib/tryon";
import { cn, errorMessage, kes, signedUrl } from "@/lib/utils";
import { sizeText } from "@/lib/sizes";
import { Button, ButtonLink, Notice, Pill, Spinner } from "@/components/ui";
import { FaceLockImage } from "@/components/FaceLockImage";
import { FeedbackButton } from "@/components/FeedbackButton";

/** A try-on with live status, the face-locked result, rating and buy actions. */
export function TryonView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const [locked, setLocked] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onReady = useCallback((c: HTMLCanvasElement) => (canvasRef.current = c), []);

  const tryon = useQuery({
    queryKey: ["tryon", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tryons")
        .select("*, body_photos(storage_path, face_mask_path), products(id, name, price_kes, stores(name, whatsapp_phone)), garment_uploads(storage_path, category)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (q.state.data && ["queued", "processing"].includes(q.state.data.status) ? 4000 : false),
  });

  const status = tryon.data?.status;

  useEffect(() => {
    const channel = supabase
      .channel(`tryon-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tryons", filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["tryon", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  useEffect(() => {
    if (status === "failed" || status === "succeeded") {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["wardrobe"] });
    }
  }, [status, queryClient]);

  const urls = useQuery({
    queryKey: ["tryon-urls", id, tryon.data?.result_path],
    enabled: status === "succeeded",
    queryFn: async () => ({
      result: await signedUrl("tryon-results", tryon.data!.result_path),
      photo: await signedUrl("body-photos", tryon.data!.body_photos?.storage_path),
      // Everything outside the edited garment zone is pasted back (older try-ons: face only)
      mask: await signedUrl("body-photos", tryon.data!.edit_mask_path ?? tryon.data!.body_photos?.face_mask_path),
      garment: tryon.data!.garment_uploads ? await signedUrl("garment-uploads", tryon.data!.garment_uploads.storage_path) : null,
    }),
    staleTime: 50 * 60_000,
  });

  if (tryon.isLoading) return <div className="grid place-items-center py-24"><Spinner /></div>;
  if (!tryon.data) return <Notice title="Try-on not found" />;
  const t = tryon.data;
  const title = t.products?.name ?? (t.garment_type ? `Your ${t.garment_type.toLowerCase()}` : "Your inspiration");
  const qa = t.qa as { attempts?: { n: number; passed: boolean }[]; passed?: boolean } | null;
  const attemptsSoFar = qa?.attempts?.length ?? 0;
  // Messages written for shoppers are shown as they are; technical ones get a plain explanation
  const failure = t.error_message && !t.error_message.startsWith("Technical:") && !/OpenAI|missing|not set|Could not read/i.test(t.error_message) ? t.error_message : null;

  const rate = async (rating: 1 | -1) => {
    const { error } = await supabase.from("tryons").update({ rating }).eq("id", t.id);
    if (error) return toast.error(errorMessage(error));
    tryon.refetch();
    toast.success("Thanks, that helps us improve");
  };

  const report = async () => {
    const { error } = await supabase.from("reports").insert({ tryon_id: t.id, reason: "not_me", details: "Reported from try-on" });
    if (error) return toast.error(errorMessage(error));
    toast.success("Reported. Our team will review it.");
  };

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return toast.error("Couldn't save the image");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `alternate-tryon-${t.id.slice(0, 8)}.png`;
      a.click();
    }, "image/png");
  };

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,460px)_1fr] md:gap-14">
      <div>
        {status === "succeeded" && urls.data?.result ? (
          <FaceLockImage resultUrl={urls.data.result} photoUrl={urls.data.photo} faceMaskUrl={urls.data.mask} locked={locked} onReady={onReady} />
        ) : status === "failed" ? (
          <div className="grid aspect-[2/3] place-items-center bg-sunk p-8 text-center display text-[32px] text-muted">That one didn't work</div>
        ) : (
          <div className="grid aspect-[2/3] place-items-center bg-sunk">
            <div className="grid gap-3 text-center">
              <Spinner className="mx-auto h-6 w-6" />
              <span className="display text-[40px]">{attemptsSoFar ? "Improving…" : "Fitting…"}</span>
              <span className="max-w-[30ch] text-[14px] text-muted">
                {attemptsSoFar
                  ? "Our quality check wasn't happy with the first result, so we're redoing it."
                  : "Usually 1–2 minutes. Every result is checked before you see it. You can leave this page."}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid content-start gap-6">
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Pill tone={status === "succeeded" ? "good" : status === "failed" ? "bad" : "accent"}>{status}</Pill>
            <Pill>{QUALITY_LABELS[t.quality].name}</Pill>
            <Pill>{t.fit} fit</Pill>
            {(t.size_label || t.size_value) && <Pill tone="ink">{t.size_label ? `Size ${t.size_label}` : sizeText(t.size_system, t.size_value)}</Pill>}
          </div>
          <h2 className="display text-[clamp(38px,5vw,64px)]">{title}</h2>
          {t.products && (
            <p className="text-muted">
              {t.products.stores?.name} · <span className="num">{kes(t.products.price_kes)}</span>
            </p>
          )}
        </div>

        {urls.data?.garment && (
          <figure className="flex items-center gap-3">
            <img src={urls.data.garment} alt="Inspiration" className="h-20 w-16 bg-sunk object-cover" />
            <figcaption className="label">Inspiration</figcaption>
          </figure>
        )}

        {status === "failed" && (
          <Notice tone="bad" title="We couldn't create this try-on">
            {failure ?? `Your ${t.credits_charged} ${t.credits_charged === 1 ? "credit was" : "credits were"} refunded. Try a clearer photo of the clothes, or a different quality.`}
          </Notice>
        )}

        {status === "queued" && (
          <Button variant="outline" onClick={() => kickTryon(t.id).then(() => tryon.refetch())} className="justify-self-start">
            Still waiting? Start it again
          </Button>
        )}

        {status === "succeeded" && (
          <>
            {qa?.passed && (
              <p className="flex items-center gap-2 text-[13px] text-muted">
                <ShieldCheck className="h-4 w-4 text-good" /> Checked for the right item, your pose, natural limbs and photo quality
                {attemptsSoFar > 1 ? `, best of ${attemptsSoFar} attempts` : ""}.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="label mr-2">View</span>
              {[true, false].map((v) => (
                <button key={String(v)} onClick={() => setLocked(v)} className={cn("h-9 border px-3 font-mono text-[11px] font-semibold uppercase tracking-label", locked === v ? "border-ink bg-ink text-paper" : "border-rule bg-surface text-muted")}>
                  {v ? "Keep the rest of me" : "AI version"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={t.rating === 1 ? "solid" : "outline"} size="sm" onClick={() => rate(1)}><ThumbsUp className="h-4 w-4" /> Looks right</Button>
              <Button variant={t.rating === -1 ? "solid" : "outline"} size="sm" onClick={() => rate(-1)}><ThumbsDown className="h-4 w-4" /> Not right</Button>
              <Button variant="ghost" size="sm" onClick={download}><Download className="h-4 w-4" /> Save</Button>
              <Button variant="ghost" size="sm" onClick={report}><Flag className="h-4 w-4" /> Not me</Button>
            </div>
            <FeedbackButton tryonId={t.id} variant="link" label="Tell us how this try-on went" />
            {t.products && (
              <div className="flex flex-wrap gap-2 border-t border-rule pt-5">
                <ButtonLink to={`/shop/${t.products.id}`} variant="solid">See the piece</ButtonLink>
                {t.products.stores?.whatsapp_phone && (
                  <a
                    className="inline-flex h-12 items-center border border-ink px-6 font-mono text-[12px] font-semibold uppercase tracking-label hover:bg-ink hover:text-paper"
                    href={`https://wa.me/${t.products.stores.whatsapp_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I tried on "${t.products.name}" on ALTERNATE and I'd like to buy it.`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buy on WhatsApp
                  </a>
                )}
              </div>
            )}
          </>
        )}

        {isAdmin.data && (
          <dl className="grid gap-1 border border-dashed border-rule p-4 text-[12.5px] text-muted">
            <dt className="label">Test info (admins only)</dt>
            <dd>Engine: <span className="num">{t.engine ?? "—"}</span></dd>
            <dd>Cost: <span className="num">{t.cost_usd != null ? `$${t.cost_usd} (≈ ${kes(Math.round(Number(t.cost_usd) * 129.4 * 100) / 100)})` : "—"}</span></dd>
            <dd>Attempts: <span className="num">{t.attempts}</span></dd>
            {qa?.attempts && <dd className="max-h-32 overflow-y-auto">Quality checks: <span className="num">{JSON.stringify(qa.attempts.map((a) => ({ n: a.n, passed: a.passed, ...((a as { check?: object }).check ?? {}) })))}</span></dd>}
            {t.garment_instruction && <dd className="max-h-32 overflow-y-auto">Prompt: {t.garment_instruction}</dd>}
            {t.error_message && <dd className="text-bad">Error: {t.error_message}</dd>}
          </dl>
        )}
      </div>
    </div>
  );
}
