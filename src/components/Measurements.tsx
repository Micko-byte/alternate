import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ruler } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBodyMeasurements, useBodyPhotos, useBodyProfile, useProfile } from "@/lib/queries";
import { SIZE_SYSTEMS, sizeText, type SizeSystem } from "@/lib/sizes";
import { cn, errorMessage } from "@/lib/utils";
import { Button, Field, Input, Notice, Pill, Spinner } from "@/components/ui";

type Fields = { bust: number | null; waist: number | null; hips: number | null };
const FIELDS = ["bust", "waist", "hips"] as const;
const CATEGORY_NAMES: Record<string, string> = { top: "Tops", outerwear: "Jackets", dress: "Dresses", jumpsuit: "Jumpsuits", skirt: "Skirts", bottom: "Trousers" };

/** Bust/chest, waist and hips: estimated from photos, or typed in from a tape measure. Private to the shopper. */
export function Measurements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const photos = useBodyPhotos();
  const bodyProfile = useBodyProfile();
  const menswear = profile.data?.shops_for === "men";
  const upperName = menswear ? "Chest" : "Bust";

  const saved = useBodyMeasurements();

  const [busy, setBusy] = useState<"photo" | "tape" | "sizes" | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [tape, setTape] = useState({ bust: "", waist: "", hips: "" });

  useEffect(() => {
    const t = (saved.data?.tape ?? {}) as Partial<Record<(typeof FIELDS)[number], number>>;
    setTape({ bust: t.bust?.toString() ?? "", waist: t.waist?.toString() ?? "", hips: t.hips?.toString() ?? "" });
    setNotes(((saved.data?.photo_estimate as { notes?: string[] } | null)?.notes) ?? []);
  }, [saved.data]);

  const current: Fields = { bust: saved.data?.bust_cm ?? null, waist: saved.data?.waist_cm ?? null, hips: saved.data?.hips_cm ?? null };
  const sources = (saved.data?.sources ?? {}) as Record<string, string>;
  const height = profile.data?.height_cm;

  const persist = async (photoEstimate: Record<string, unknown> | null, tapeValues: Record<string, number | null> | null) => {
    const photo = (photoEstimate ?? saved.data?.photo_estimate ?? null) as (Fields & { accuracy?: number }) | null;
    const tapeRow = tapeValues ?? ((saved.data?.tape ?? null) as Fields | null);
    const values: Record<string, number | null> = {};
    const src: Record<string, string> = {};
    for (const f of FIELDS) {
      if (tapeRow?.[f]) { values[`${f}_cm`] = tapeRow[f]; src[f] = "tape"; }
      else if (photo?.[f]) { values[`${f}_cm`] = photo[f]; src[f] = "photo"; }
      else values[`${f}_cm`] = null;
    }
    const { error } = await supabase.from("body_measurements").upsert({
      user_id: user!.id,
      ...values,
      sources: src,
      accuracy_cm: Object.values(src).includes("photo") ? photo?.accuracy ?? null : null,
      photo_estimate: photo as never,
      tape: tapeRow as never,
    });
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  const fromPhotos = async (silent = false) => {
    const list = photos.data ?? [];
    const notesById = Object.fromEntries((bodyProfile.data?.photos ?? []).map((n) => [n.id, n]));
    const pick = (angle: string) =>
      list
        .filter((p) => p.angle === angle && notesById[p.id]?.usable !== false)
        .sort((a, b) => Number(notesById[b.id]?.clothing_fit === "fitted") - Number(notesById[a.id]?.clothing_fit === "fitted"))[0];
    const front = pick("front");
    const side = pick("side") ?? null;
    if (!height) return silent ? undefined : toast.error("Add your height first. It sets the scale.");
    if (!front) return silent ? undefined : toast.error("Add a front photo, head to feet, first.");
    setBusy("photo");
    try {
      const [{ ensurePartsMap, loadPartsMap }, { measure }] = await Promise.all([import("@/lib/bodyPhoto"), import("@/lib/measure")]);
      const load = async (p: typeof front) => {
        const path = await ensurePartsMap(p);
        const { data } = await supabase.storage.from("body-photos").createSignedUrl(path, 600);
        if (!data) throw new Error("Couldn't open your photo");
        return loadPartsMap(data.signedUrl);
      };
      const [frontMap, sideMap] = await Promise.all([load(front), side ? load(side) : Promise.resolve(null)]);
      const loose = [front, side].some((p) => p && notesById[p.id]?.clothing_fit === "loose");
      const result = measure(frontMap, sideMap, height, loose);
      await persist(
        { ...result, front_photo_id: front.id, side_photo_id: side?.id ?? null, height_cm: height, measured_at: new Date().toISOString() },
        null,
      );
      setNotes(result.notes);
      if (!silent) toast.success("Measured from your photos");
    } catch (err) {
      if (!silent) toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const saveTape = async () => {
    const values: Record<string, number | null> = {};
    for (const f of FIELDS) {
      const n = Number(tape[f]);
      values[f] = tape[f] === "" ? null : n >= 40 && n <= 220 ? n : NaN;
      if (Number.isNaN(values[f])) return toast.error(`${f === "bust" ? upperName : f[0].toUpperCase() + f.slice(1)} should be in cm, between 40 and 220.`);
    }
    setBusy("tape");
    try {
      await persist(null, { ...values, measured_at: Date.now() });
      toast.success("Tape measurements saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  // Nothing measured yet but photos and a height are there: measure straight away, quietly
  const autoTried = useRef(false);
  useEffect(() => {
    if (autoTried.current || saved.isLoading || saved.data || !height || !photos.data?.some((p) => p.angle === "front") || bodyProfile.isLoading) return;
    autoTried.current = true;
    void fromPhotos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.isLoading, saved.data, height, photos.data, bodyProfile.isLoading]);

  // Profiles read before estimates existed, or before a height change, are re-read once in the background
  const refreshed = useRef(false);
  useEffect(() => {
    const bp = bodyProfile.data;
    if (refreshed.current || !bp || !photos.data?.length || (bp.estimates && bp.heightUsed === (height ?? null))) return;
    refreshed.current = true;
    void supabase.functions.invoke("analyze-body").then(() => queryClient.invalidateQueries({ queryKey: ["body-profile"] }));
  }, [bodyProfile.data, photos.data, height, queryClient]);

  const estimates = bodyProfile.data?.estimates ?? null;
  const aiValue: Record<string, number | null> = { bust: estimates?.bust_cm ?? null, waist: estimates?.waist_cm ?? null, hips: estimates?.hips_cm ?? null };
  const heightOff =
    height && estimates?.height_min_cm && estimates?.height_max_cm && (height < estimates.height_min_cm - 5 || height > estimates.height_max_cm + 5)
      ? { min: estimates.height_min_cm, max: estimates.height_max_cm }
      : null;

  const [suggestion, setSuggestion] = useState<Record<string, number | null> | null>(null);
  // Sizes from typed or photo-measured values, else from the AI's estimate
  const forSizes = current.bust || current.waist || current.hips ? current : { bust: aiValue.bust, waist: aiValue.waist, hips: aiValue.hips };
  useEffect(() => {
    if (!forSizes.bust && !forSizes.waist && !forSizes.hips) return setSuggestion(null);
    import("@/lib/measure").then(({ suggestSizes }) => setSuggestion(suggestSizes(forSizes, menswear) as Record<string, number | null>));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forSizes.bust, forSizes.waist, forSizes.hips, menswear]);

  const systemFor = (category: string): SizeSystem => (menswear ? (category === "bottom" ? "waist_in" : "letter") : "uk_women");

  const applySuggestedSizes = async () => {
    if (!suggestion) return;
    setBusy("sizes");
    const rows = Object.entries(suggestion)
      .filter(([, v]) => v != null)
      .map(([category, value]) => ({ user_id: user!.id, category: category as never, size_system: systemFor(category), size_value: value! }));
    const { error } = await supabase.from("user_sizes").upsert(rows);
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    queryClient.invalidateQueries({ queryKey: ["sizes"] });
    toast.success("Sizes updated from your measurements");
  };

  if (saved.isLoading) return <div className="grid place-items-center py-8"><Spinner /></div>;
  const hasAny = FIELDS.some((f) => current[f]);

  return (
    <div className="grid gap-6">
      <p className="text-muted">
        Try-ons use these to draw how tightly clothes sit on you. Anything you type in is used as it is; anything missing is estimated from your photos. Only you can see them; ALTERNATE staff can't.
      </p>

      {heightOff && (
        <Notice tone="warn" title="Check your height">
          Your photos look like someone about {heightOff.min}–{heightOff.max} cm tall, but your height is saved as {height} cm. A wrong height moves hems and measurements.
        </Notice>
      )}

      <div className="grid grid-cols-3 gap-2">
        {FIELDS.map((f) => (
          <div key={f} className="grid gap-1 border border-rule bg-paper p-4">
            <span className="label">{f === "bust" ? upperName : f === "waist" ? "Waist" : "Hips"}</span>
            {current[f] ? (
              <>
                <span className="num text-[28px] leading-none">{current[f]}<span className="ml-1 text-[13px] text-muted">cm</span></span>
                <span className="num text-[12px] text-muted">{(current[f]! / 2.54).toFixed(1)} in</span>
                <Pill tone={sources[f] === "tape" ? "good" : "neutral"} className="justify-self-start">
                  {sources[f] === "tape" ? "Tape" : `Photo ±${saved.data?.accuracy_cm ?? "?"} cm`}
                </Pill>
              </>
            ) : aiValue[f] ? (
              <>
                <span className="num text-[28px] leading-none text-muted">~{aiValue[f]}<span className="ml-1 text-[13px]">cm</span></span>
                <span className="num text-[12px] text-muted">{(aiValue[f]! / 2.54).toFixed(1)} in</span>
                <Pill tone="accent" className="justify-self-start">AI estimate</Pill>
              </>
            ) : (
              <span className="text-[13px] text-muted">Not measured yet</span>
            )}
          </div>
        ))}
      </div>

      {!!notes.length && <Notice tone="warn" title="To make these more accurate">{notes.join(" ")}</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => fromPhotos()} loading={busy === "photo"} disabled={!photos.data?.length}>
          <Ruler className="h-4 w-4" /> {hasAny ? "Measure again from my photos" : "Measure from my photos"}
        </Button>
        <span className="text-[13px] text-muted">Uses your front and side photos and your height. Best in fitted clothes.</span>
      </div>

      <details className="group border border-rule bg-paper p-4" open={Object.values(sources).includes("tape")}>
        <summary className="cursor-pointer font-medium">Enter tape measurements (most accurate)</summary>
        <div className="mt-4 grid gap-4">
          <ul className="grid gap-1 text-[13.5px] text-muted">
            <li><span className="text-ink">{upperName}:</span> around the fullest part, tape level all the way round, not tight.</li>
            <li><span className="text-ink">Waist:</span> around the narrowest part, usually just above the belly button. Breathe out normally.</li>
            <li><span className="text-ink">Hips:</span> around the widest part of the hips and bottom, feet together.</li>
          </ul>
          <div className="grid grid-cols-3 gap-3">
            {FIELDS.map((f) => (
              <Field key={f} label={`${f === "bust" ? upperName : f === "waist" ? "Waist" : "Hips"} (cm)`}>
                <Input type="number" inputMode="decimal" min={40} max={220} value={tape[f]} onChange={(e) => setTape({ ...tape, [f]: e.target.value })} className="num" />
              </Field>
            ))}
          </div>
          <Button variant="outline" onClick={saveTape} loading={busy === "tape"} className="justify-self-start">Save tape measurements</Button>
        </div>
      </details>

      {suggestion && Object.values(suggestion).some((v) => v != null) && (
        <div className="grid gap-3 border border-ink p-4">
          <span className="label text-ink">Sizes these measurements suggest</span>
          <ul className="flex flex-wrap gap-2">
            {Object.entries(suggestion)
              .filter(([, v]) => v != null)
              .map(([category, v]) => (
                <li key={category} className={cn("border border-rule px-2.5 py-1 text-[13px]")}>
                  {CATEGORY_NAMES[category] ?? category}: <span className="num text-ink">{sizeText(systemFor(category), v!)}</span>
                </li>
              ))}
          </ul>
          <p className="text-[12.5px] text-muted">From a typical {menswear ? "menswear" : "UK high-street"} size chart ({SIZE_SYSTEMS[systemFor("top")].label}). Brands vary.</p>
          <Button size="sm" variant="outline" onClick={applySuggestedSizes} loading={busy === "sizes"} className="justify-self-start">Use these as my sizes</Button>
        </div>
      )}
    </div>
  );
}
