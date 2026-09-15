import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Check, ImagePlus, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBodyPhotos, useBodyProfile, useCredits, useProfile, useSetupStatus, useSizes, useTryonPrices, type BodyProfileNotes } from "@/lib/queries";
import { SIZE_SYSTEMS, defaultSystemFor, sizeText, type FitStyle } from "@/lib/sizes";
import { QUALITY_LABELS, startTryon } from "@/lib/tryon";
import { CATEGORY_SINGULAR, cn, errorMessage, extensionOf } from "@/lib/utils";
import { Button, ButtonLink, Field, Input, Notice, Select, Spinner } from "@/components/ui";
import { BodyPhotoUploader } from "@/components/BodyPhotoUploader";
import { TryonView } from "@/components/TryonView";
import { FitPicker } from "@/components/FitPicker";
import { useTryonAllowance } from "@/lib/admin";
import { FeedbackButton } from "@/components/FeedbackButton";
import type { ParsedInspiration } from "@/lib/garmentCutout";
import { GARMENTS, GARMENT_BY_CATEGORY, SIZED_CATEGORIES } from "@/lib/garments";

type Quality = "standard" | "hd" | "studio";

export default function FittingRoom() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const setup = useSetupStatus();
  const photos = useBodyPhotos();
  const bodyProfile = useBodyProfile();
  const sizes = useSizes();
  const prices = useTryonPrices();
  const credits = useCredits();
  const allowance = useTryonAllowance();
  const usedUp = !!allowance.data && !allowance.data.exempt && allowance.data.remaining === 0;

  const [photoId, setPhotoId] = useState<string>();
  const [inspirationId, setInspirationId] = useState<string>();
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [pendingInspiration, setPendingInspiration] = useState<File | null>(null);
  const profile = useProfile();
  const [fit, setFit] = useState<FitStyle>("regular");
  const [quality, setQuality] = useState<Quality>("standard");
  const [busy, setBusy] = useState(false);
  const [activeTryon, setActiveTryon] = useState<string>();
  const resultRef = useRef<HTMLDivElement>(null);

  const photoUrls = useQuery({
    queryKey: ["photo-urls", photos.data?.map((p) => p.id).join()],
    enabled: !!photos.data?.length,
    queryFn: () => signMany("body-photos", photos.data!.map((p) => [p.id, p.storage_path])),
    staleTime: 50 * 60_000,
  });

  const inspirations = useQuery({
    queryKey: ["inspirations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("garment_uploads")
        .select("id, storage_path, cutout_path, category, garment_type, source_note, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      const urls = await signMany("garment-uploads", (data ?? []).map((g) => [g.id, g.cutout_path ?? g.storage_path]));
      return (data ?? []).map((g) => ({ ...g, url: urls[g.id] }));
    },
  });

  const recent = useQuery({
    queryKey: ["wardrobe", user?.id, "recent"],
    queryFn: async () => {
      const { data } = await supabase.from("tryons").select("id, status, result_path, created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(8);
      const urls = await signMany("tryon-results", (data ?? []).filter((t) => t.result_path).map((t) => [t.id, t.result_path!]));
      return (data ?? []).map((t) => ({ ...t, url: urls[t.id] }));
    },
  });

  useEffect(() => {
    if (profile.data?.preferred_fit) setFit(profile.data.preferred_fit);
  }, [profile.data?.preferred_fit]);

  const profileStale = !!photos.data?.length && bodyProfile.isSuccess && (bodyProfile.data?.photo_ids?.length ?? 0) !== photos.data.length;
  useEffect(() => {
    if (!profileStale) return;
    void supabase.functions.invoke("analyze-body").then(() => queryClient.invalidateQueries({ queryKey: ["body-profile"] }));
  }, [profileStale, queryClient]);

  // Paste a screenshot straight into the fitting room
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        setPendingInspiration(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    if (!photoId && photos.data?.length) setPhotoId(photos.data.find((p) => p.angle === "front")?.id ?? photos.data[0].id);
  }, [photos.data, photoId]);

  useEffect(() => {
    if (!inspirationId && inspirations.data?.length) setInspirationId(inspirations.data[0].id);
  }, [inspirations.data, inspirationId]);

  const inspiration = inspirations.data?.find((g) => g.id === inspirationId);
  const category = inspiration?.category ?? null;
  const needsSize = !!category && SIZED_CATEGORIES.includes(category);
  const mySize = category ? (sizes.data ?? []).find((sz) => sz.category === category) : undefined;
  const askSystem = category ? defaultSystemFor(category, profile.data?.shops_for) : "uk_women";
  const cost = prices.data?.[quality] ?? 1;
  const canUpload = setup.steps.about && setup.steps.privacy;

  const setSize = async (value: string) => {
    if (!category || !value) return;
    const { error } = await supabase.from("user_sizes").upsert({ user_id: user!.id, category: category as never, size_system: askSystem, size_value: Number(value) });
    if (error) return toast.error(errorMessage(error));
    queryClient.invalidateQueries({ queryKey: ["sizes"] });
  };

  const removeInspiration = async (g: { id: string; storage_path: string; cutout_path: string | null }) => {
    await supabase.storage.from("garment-uploads").remove([g.storage_path, g.cutout_path].filter(Boolean) as string[]);
    const { error } = await supabase.from("garment_uploads").delete().eq("id", g.id);
    if (error) return toast.error(errorMessage(error));
    if (inspirationId === g.id) setInspirationId(undefined);
    inspirations.refetch();
  };

  const swap = async () => {
    if (!photoId || !inspirationId) return;
    setBusy(true);
    try {
      const id = await startTryon({ bodyPhotoId: photoId, garmentUploadId: inspirationId, quality, fit, category });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["tryon-allowance"] });
      recent.refetch();
      setActiveTryon(id);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (setup.loading) return <div className="grid place-items-center py-24"><Spinner /></div>;

  return (
    <div className="grid gap-12">
      <header className="grid gap-4">
        <span className="label">Fitting room</span>
        <h1 className="display text-[clamp(48px,8.5vw,120px)]">
          Your photo.
          <br />
          <span className="text-muted">Their look.</span>
        </h1>
      </header>

      {!canUpload && (
        <Notice tone="accent" title="Finish your fitting profile to start" action={<ButtonLink to="/me/setup" variant="solid" size="sm">Set up</ButtonLink>}>
          Your age, sizes and privacy choices, once.
        </Notice>
      )}

      <section className="grid gap-8 lg:grid-cols-[1fr_300px_1fr] lg:gap-6">
        {/* 01 Your photo */}
        <div className="grid content-start gap-4">
          <div className="flex items-baseline justify-between border-b border-ink pb-3">
            <h2 className="label text-ink">01 · Your photo</h2>
            <Link to="/me/setup" className="label hover:text-ink">Manage</Link>
          </div>
          {addingPhoto ? (
            <BodyPhotoUploader onAdded={(id) => { setPhotoId(id); setAddingPhoto(false); }} onCancel={() => setAddingPhoto(false)} />
          ) : (
            <>
              <div className="aspect-[3/4] overflow-hidden bg-sunk">
                {photoId && photoUrls.data?.[photoId] ? (
                  <img src={photoUrls.data[photoId]} alt="Your selected photo" className="h-full w-full object-cover" />
                ) : (
                  <EmptyPanel title="Add a full-body photo" body="Front-facing, head to feet. Your face and hair stay locked." />
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.data?.map((p) => (
                  <button key={p.id} onClick={() => setPhotoId(p.id)} className={cn("relative h-24 w-[64px] shrink-0 overflow-hidden bg-sunk outline-offset-2", photoId === p.id && "outline outline-2 outline-ink")} aria-label={`Use ${p.angle} photo`} aria-pressed={photoId === p.id}>
                    {photoUrls.data?.[p.id] && <img src={photoUrls.data[p.id]} alt="" className="h-full w-full object-cover" />}
                    <span className="absolute inset-x-0 bottom-0 bg-paper/90 py-0.5 text-center font-mono text-[9px] uppercase">{p.angle}</span>
                  </button>
                ))}
                <AddTile label="Photo" disabled={!canUpload} onClick={() => setAddingPhoto(true)} />
              </div>
              {!!photos.data?.length && <PhotoChecklist notes={bodyProfile.data?.photos} tips={bodyProfile.data?.tips} checking={profileStale} />}
            </>
          )}
        </div>

        {/* Swap */}
        <div className="grid content-center gap-5 border-y border-rule py-8 lg:border-0 lg:py-0">
          <div className="mx-auto grid h-16 w-16 place-items-center border border-ink" aria-hidden>
            <ArrowLeftRight className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <FitPicker value={fit} onChange={setFit} />
          <fieldset className="grid gap-1.5">
            <legend className="label mb-2 text-center">Quality</legend>
            {(["standard", "hd", "studio"] as const).map((q) => (
              <label key={q} className={cn("flex cursor-pointer items-center justify-between border px-3 py-2", quality === q ? "border-ink bg-ink text-paper" : "border-rule")}>
                <input type="radio" name="quality" checked={quality === q} onChange={() => setQuality(q)} className="sr-only" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-label">{QUALITY_LABELS[q].name}</span>
                <span className="num text-[12px]">{prices.data?.[q] ?? "–"} cr</span>
              </label>
            ))}
          </fieldset>

          {needsSize && (
            mySize !== undefined ? (
              <p className="text-center text-[13px] text-muted">
                Drawn on your usual <span className="num text-ink">{sizeText(mySize.size_system, mySize.size_value)}</span> {CATEGORY_SINGULAR[category!]}, {fit} fit
              </p>
            ) : (
              <Field label={`Your ${CATEGORY_SINGULAR[category!]} size`} hint="Needed so it fits like the real thing">
                <Select value="" onChange={(e) => setSize(e.target.value)} className="num">
                  <option value="">Choose</option>
                  {SIZE_SYSTEMS[askSystem].options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
            )
          )}

          {usedUp ? (
            <div className="grid gap-2 border border-ink p-4 text-center">
              <span className="font-semibold">You've used all {allowance.data?.limit} test try-ons</span>
              <span className="text-[13px] text-muted">Thanks for testing. Tell us what you think.</span>
              <FeedbackButton variant="link" label="Send feedback" />
            </div>
          ) : (credits.data ?? 0) < cost ? (
            <ButtonLink to="/credits" variant="solid" size="lg">Get credits</ButtonLink>
          ) : (
            <Button variant="solid" size="lg" onClick={swap} loading={busy} disabled={!photoId || !inspirationId || (needsSize && mySize === undefined)}>
              Try it on · {cost} cr
            </Button>
          )}
          <p className="text-center text-[12px] text-muted">
            <span className="num text-ink">{credits.data ?? 0}</span> credits left
            {allowance.data && !allowance.data.exempt && allowance.data.limit !== null && (
              <> · <span className="num text-ink">{allowance.data.remaining}</span> of {allowance.data.limit} test try-ons left</>
            )}
            {" "}· failed try-ons are refunded
          </p>
        </div>

        {/* 02 Inspiration */}
        <div className="grid content-start gap-4">
          <div className="flex items-baseline justify-between border-b border-ink pb-3">
            <h2 className="label text-ink">02 · Inspiration</h2>
            <Link to="/shop" className="label hover:text-ink">Or pick from the shop</Link>
          </div>
          {!pendingInspiration && inspiration && (
            <UploadZone compact onFile={setPendingInspiration} />
          )}
          {pendingInspiration ? (
            <InspirationForm
              file={pendingInspiration}
              onFile={setPendingInspiration}
              onSaved={(id) => { setInspirationId(id); setPendingInspiration(null); inspirations.refetch(); }}
              onCancel={() => setPendingInspiration(null)}
            />
          ) : (
            <>
              <div className="relative aspect-[3/4] overflow-hidden bg-sunk">
                {inspiration?.url ? (
                  <>
                    <img src={inspiration.url} alt="Selected inspiration" className="h-full w-full object-contain" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-paper/90 px-3 py-2">
                      <span className="label text-ink">{inspiration.garment_type ?? CATEGORY_SINGULAR[inspiration.category ?? "other"]}</span>
                      <button onClick={() => removeInspiration(inspiration)} className="p-1 text-muted hover:text-bad" aria-label="Delete this inspiration"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </>
                ) : (
                  <UploadZone onFile={setPendingInspiration} />
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {inspirations.data?.map((g) => (
                  <button key={g.id} onClick={() => setInspirationId(g.id)} className={cn("h-24 w-[64px] shrink-0 overflow-hidden bg-sunk outline-offset-2", inspirationId === g.id && "outline outline-2 outline-ink")} aria-label="Use this inspiration" aria-pressed={inspirationId === g.id}>
                    {g.url && <img src={g.url} alt="" className="h-full w-full object-cover" />}
                  </button>
                ))}
                <AddFileTile label="Upload" onFile={setPendingInspiration} />
              </div>
            </>
          )}
        </div>
      </section>

      {activeTryon && (
        <section ref={resultRef} className="grid scroll-mt-28 gap-6 border-t border-ink pt-8">
          <h2 className="label text-ink">03 · Result</h2>
          <TryonView id={activeTryon} />
        </section>
      )}

      {!!recent.data?.length && (
        <section className="grid gap-4">
          <div className="flex items-baseline justify-between border-b border-rule pb-3">
            <h2 className="label text-ink">Recent try-ons</h2>
            <Link to="/wardrobe" className="label hover:text-ink">Wardrobe</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recent.data.map((t) => (
              <button key={t.id} onClick={() => { setActiveTryon(t.id); setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 50); }} className="grid w-28 shrink-0 gap-1 text-left">
                <span className="aspect-[2/3] overflow-hidden bg-sunk">{t.url ? <img src={t.url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center label">{t.status}</span>}</span>
                <span className="num text-[11px] text-muted">{new Date(t.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Which kinds of photo the AI has to work from. Every photo is used for every try-on. */
function PhotoChecklist({ notes, tips, checking }: { notes?: BodyProfileNotes[]; tips?: string[]; checking: boolean }) {
  const usable = (notes ?? []).filter((n) => n.usable);
  const items = [
    { label: "Front, head to feet", done: usable.some((n) => n.angle === "front" && n.full_body) },
    { label: "Side view", done: usable.some((n) => n.angle === "side") },
    { label: "Arms showing", done: usable.some((n) => n.arms_visible) },
    { label: "Legs showing", done: usable.some((n) => n.legs_visible) },
    { label: "Fitted clothes", done: usable.some((n) => n.clothing_fit === "fitted") },
  ];
  const issues = (notes ?? []).filter((n) => !n.usable || n.issues).map((n) => n.issues).filter(Boolean);
  return (
    <div className="grid gap-2 border border-rule bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label text-ink">More photos, better fit</span>
        {checking && <span className="flex items-center gap-1.5 text-[11px] text-muted"><Spinner className="h-3 w-3" /> Reading your photos</span>}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <li key={i.label} className={cn("flex h-7 items-center gap-1 border px-2 text-[12px]", i.done ? "border-good/40 bg-good-soft text-good" : "border-rule text-muted")}>
            {i.done ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {i.label}
          </li>
        ))}
      </ul>
      {!!tips?.length && <p className="text-[12.5px] text-muted">{tips.join(" · ")}</p>}
      {!!issues.length && <p className="text-[12.5px] text-warn">{issues.slice(0, 2).join(" · ")}</p>}
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid h-full content-center gap-3 p-8 text-center">
      <p className="display text-[30px]">{title}</p>
      <p className="mx-auto max-w-[28ch] text-[14px] text-muted">{body}</p>
    </div>
  );
}

function AddTile({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="grid h-24 w-[64px] shrink-0 place-items-center content-center gap-1 border border-dashed border-ink/40 text-muted hover:border-ink hover:text-ink disabled:opacity-40">
      <Plus className="h-4 w-4" />
      <span className="font-mono text-[9px] font-semibold uppercase tracking-label">{label}</span>
    </button>
  );
}

function UploadZone({ onFile, compact }: { onFile: (file: File) => void; compact?: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
        if (file) onFile(file);
      }}
      className={cn(
        "grid cursor-pointer place-items-center content-center gap-3 border border-dashed text-center transition-colors",
        compact ? "flex h-14 justify-center gap-2 px-4" : "h-full p-8",
        over ? "border-ink bg-sunk" : "border-ink/35 hover:border-ink",
      )}
    >
      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <ImagePlus className={compact ? "h-4 w-4" : "h-8 w-8"} strokeWidth={1.4} aria-hidden />
      {compact ? (
        <span className="font-mono text-[11px] font-semibold uppercase tracking-label">Upload new clothes</span>
      ) : (
        <>
          <span className="display text-[30px]">Upload the clothes you want</span>
          <span className="mx-auto max-w-[30ch] text-[14px] text-muted">Tap to choose, drag a photo here, or paste a screenshot from Instagram or TikTok.</span>
          <span className="inline-flex h-11 items-center bg-ink px-5 font-mono text-[11px] font-semibold uppercase tracking-label text-paper">Choose a photo</span>
        </>
      )}
    </label>
  );
}

function AddFileTile({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  return (
    <label className="grid h-24 w-[64px] shrink-0 cursor-pointer place-items-center content-center gap-1 border border-dashed border-ink/40 text-muted hover:border-ink hover:text-ink">
      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <Plus className="h-4 w-4" />
      <span className="font-mono text-[9px] font-semibold uppercase tracking-label">{label}</span>
    </label>
  );
}

function InspirationForm({ file, onFile, onSaved, onCancel }: { file: File; onFile: (file: File) => void; onSaved: (id: string) => void; onCancel: () => void }) {
  const { user } = useAuth();
  const [preview, setPreview] = useState<string>();
  const [category, setCategory] = useState("top");
  const [garmentType, setGarmentType] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [mismatch, setMismatch] = useState<{ id: string; message: string; suggestion: { category: string; type: string } | null } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParsedInspiration | null>(null);
  const [parsing, setParsing] = useState(true);
  const [cutout, setCutout] = useState<{ blob: Blob; url: string } | null | undefined>(undefined);
  const [useWhole, setUseWhole] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setParsed(null);
    setParsing(true);
    setUseWhole(false);
    setTouched(false);
    setMismatch(null);
    let cancelled = false;
    import("@/lib/garmentCutout")
      .then(({ parseInspiration }) => parseInspiration(file))
      .then(async (p) => {
        if (cancelled) return;
        setParsed(p);
        const { guessCategory } = await import("@/lib/garmentCutout");
        const guess = guessCategory(p);
        if (guess) setCategory((c) => (touchedRef.current ? c : guess));
      })
      .catch(() => !cancelled && setParsed(null))
      .finally(() => !cancelled && setParsing(false));
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const touchedRef = useRef(false);
  touchedRef.current = touched;

  useEffect(() => {
    if (!parsed || category === "jewellery") {
      setCutout(parsing ? undefined : null);
      return;
    }
    let cancelled = false;
    import("@/lib/garmentCutout")
      .then(({ cutoutGarment }) => cutoutGarment(parsed, category))
      .then((c) => !cancelled && setCutout(c))
      .catch(() => !cancelled && setCutout(null));
    return () => {
      cancelled = true;
    };
  }, [parsed, parsing, category]);

  const save = async () => {
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const path = `${user!.id}/${id}.${extensionOf(file)}`;
      const { error: upErr } = await supabase.storage.from("garment-uploads").upload(path, file, { contentType: file.type || "image/png" });
      if (upErr) throw upErr;
      let cutoutPath: string | null = null;
      if (cutout && !useWhole) {
        cutoutPath = `${user!.id}/${id}-cutout.png`;
        const { error: cutErr } = await supabase.storage.from("garment-uploads").upload(cutoutPath, cutout.blob, { contentType: "image/png" });
        if (cutErr) throw cutErr;
      }
      const { error } = await supabase
        .from("garment_uploads")
        .insert({ id, user_id: user!.id, storage_path: path, cutout_path: cutoutPath, category: category as never, garment_type: garmentType, source_note: note || null });
      if (error) throw error;

      // The server checks what the photo really shows before anyone pays
      const { data: check } = await supabase.functions.invoke("inspect-garment", { body: { garment_upload_id: id } });
      if (check?.checked && (!check.matches || !check.is_wearable)) {
        setMismatch({ id, message: check.message, suggestion: check.is_wearable ? check.suggestion : null });
        return;
      }
      if (check?.checked && !garmentType && check.chosen_item) {
        await supabase.from("garment_uploads").update({ garment_type: String(check.chosen_item).slice(0, 40) }).eq("id", id);
      }
      onSaved(id);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const noun = garmentType?.toLowerCase() ?? CATEGORY_SINGULAR[category];

  const useSuggestion = async () => {
    if (!mismatch?.suggestion) return;
    const { error } = await supabase
      .from("garment_uploads")
      .update({ category: mismatch.suggestion.category as never, garment_type: mismatch.suggestion.type.slice(0, 40) })
      .eq("id", mismatch.id);
    if (error) return toast.error(errorMessage(error));
    onSaved(mismatch.id);
  };

  const discardMismatch = async () => {
    if (!mismatch) return;
    await supabase.from("garment_uploads").delete().eq("id", mismatch.id);
    setMismatch(null);
  };

  if (mismatch) {
    const label = mismatch.suggestion ? mismatch.suggestion.type : null;
    return (
      <div className="grid gap-4">
        {preview && <img src={preview} alt="Your inspiration photo" className="aspect-[3/4] w-full bg-sunk object-contain" />}
        <Notice tone="warn" title="That doesn't match">
          {mismatch.message} Try-ons only draw what's really in the photo.
        </Notice>
        <div className="flex flex-wrap gap-2">
          {label && <Button variant="solid" onClick={useSuggestion}>Try on the {label.toLowerCase()}</Button>}
          <Button variant="outline" onClick={discardMismatch}>Choose again</Button>
          <Button variant="ghost" onClick={() => discardMismatch().then(onCancel)}>Cancel</Button>
        </div>
      </div>
    );
  }

  const groupOf = GARMENT_BY_CATEGORY[category];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2">
        <figure className="grid gap-1.5">
          <div className="relative aspect-[3/4] overflow-hidden bg-sunk">
            {preview && <img src={preview} alt="Your inspiration photo" className="h-full w-full object-contain" />}
            <label className="absolute right-1.5 top-1.5 cursor-pointer bg-paper/95 px-2 py-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-label hover:bg-paper">
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
              Change
            </label>
          </div>
          <figcaption className="label">Your photo</figcaption>
        </figure>
        <figure className="grid gap-1.5">
          <div className="grid aspect-[3/4] place-items-center overflow-hidden border border-ink bg-white">
            {cutout === undefined ? (
              <span className="grid justify-items-center gap-2 p-3 text-center text-[12.5px] text-muted">
                <Spinner className="h-5 w-5" />
                Finding the {noun}…
              </span>
            ) : cutout && !useWhole ? (
              <img src={cutout.url} alt={`Just the ${noun}`} className="h-full w-full object-contain" />
            ) : (
              <span className="p-4 text-center text-[13px] text-muted">
                {cutout ? "Using the whole photo" : category === "jewellery" ? "Jewellery is small, so we'll use the whole photo." : `We couldn't find the ${noun} on its own, so we'll use the whole photo.`}
              </span>
            )}
          </div>
          <figcaption className="label text-ink">What we'll try on</figcaption>
        </figure>
      </div>
      <fieldset className="grid gap-3">
        <legend className="label mb-2">What do you want from this photo?</legend>
        {(["Clothing", "Shoes & accessories"] as const).map((group) => (
          <div key={group} className="grid gap-1.5">
            <span className="text-[12px] text-muted">{group}</span>
            <div className="flex flex-wrap gap-1.5">
              {GARMENTS.filter((g) => g.group === group).map((g) => (
                <button
                  key={g.category}
                  type="button"
                  onClick={() => { setCategory(g.category); setGarmentType(null); setTouched(true); }}
                  aria-pressed={category === g.category}
                  className={cn("h-9 border px-3 font-mono text-[11px] font-semibold uppercase tracking-label", category === g.category ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink")}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {groupOf && (
          <div className="grid gap-1.5 border-t border-rule pt-3">
            <span className="text-[12px] text-muted">Which {groupOf.label.toLowerCase()}? (optional, helps accuracy)</span>
            <div className="flex flex-wrap gap-1.5">
              {groupOf.types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGarmentType(garmentType === t ? null : t)}
                  aria-pressed={garmentType === t}
                  className={cn("h-8 border px-2.5 text-[12.5px]", garmentType === t ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink")}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </fieldset>
      {cutout && (
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={useWhole} onChange={(e) => setUseWhole(e.target.checked)} className="h-4 w-4 accent-ink" />
          The cut-out missed part of it. Use the whole photo instead.
        </label>
      )}
      <p className="flex items-center gap-1.5 text-[12.5px] text-muted"><ShieldCheck className="h-3.5 w-3.5" /> We check what's in the photo, so you only pay for try-ons that make sense.</p>
      <Field label="Details (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. the beige pleated trousers" maxLength={200} />
      </Field>
      <div className="flex gap-2">
        <Button variant="solid" onClick={save} loading={busy} disabled={cutout === undefined}>{busy ? "Checking the photo…" : `Use this ${noun}`}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

async function signMany(bucket: string, items: [string, string][]) {
  if (!items.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(items.map(([, p]) => p), 3600);
  const byPath = Object.fromEntries((data ?? []).map((d) => [d.path, d.signedUrl]));
  return Object.fromEntries(items.map(([id, p]) => [id, byPath[p]])) as Record<string, string>;
}
