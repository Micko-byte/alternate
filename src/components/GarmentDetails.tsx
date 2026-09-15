import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GARMENTS, GARMENT_BY_CATEGORY, LENGTH_OPTIONS, closestLength } from "@/lib/garments";
import { MEASURES_FOR, MEASURE_LABELS, STRETCH_OPTIONS, convertAround, toMeasurements, type GarmentMeasurements, type MeasureKey, type Stretch } from "@/lib/garmentFit";
import { cn, errorMessage } from "@/lib/utils";
import { Button, Field, Input, Notice } from "@/components/ui";

export type GarmentRow = {
  id: string;
  category: string | null;
  garment_type: string | null;
  length: string | null;
  size_label: string | null;
  measurements: unknown;
  stretch: string | null;
};

export type Seen = { type: string; colour: string; length: string | null; sleeves: string | null; silhouette: string | null } | null;

/**
 * Everything that decides how a saved garment is drawn: what it is, length, label size, measurements
 * and stretch. Used right after upload (with what the AI saw) and to edit a garment later.
 */
export function GarmentDetails({ garment, previewUrl, seen, allowCategory, onDone, onCancel }: {
  garment: GarmentRow;
  previewUrl?: string;
  seen?: Seen;
  /** Editing later can change what the item is; straight after the photo check it's already settled. */
  allowCategory?: boolean;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [category, setCategory] = useState(garment.category ?? "top");
  const [garmentType, setGarmentType] = useState(garment.garment_type ?? "");
  const [length, setLength] = useState<string | null>(garment.length ?? closestLength(garment.category ?? "", seen?.length));
  const [sizeLabel, setSizeLabel] = useState(garment.size_label ?? "");
  const saved = (garment.measurements ?? {}) as GarmentMeasurements;
  const [inputs, setInputs] = useState<Partial<Record<MeasureKey, string>>>(Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, String(v)])));
  const [measuredFlat, setMeasuredFlat] = useState(false);
  const [stretch, setStretch] = useState<Stretch | "">((garment.stretch as Stretch) ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const lengths = LENGTH_OPTIONS[category] ?? [];
  const measures = MEASURES_FOR[category] ?? [];
  const noun = garmentType.toLowerCase() || GARMENT_BY_CATEGORY[category]?.label.toLowerCase() || "item";

  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const measurements = toMeasurements(Object.fromEntries(Object.entries(inputs).filter(([k]) => measures.includes(k as MeasureKey))), measuredFlat);
      const { error } = await supabase
        .from("garment_uploads")
        .update({
          category: category as never,
          garment_type: garmentType.trim().slice(0, 40) || null,
          length: (lengths.length && length ? length : null) as never,
          size_label: sizeLabel.trim().slice(0, 12) || null,
          measurements: measurements as never,
          length_cm: null,
          stretch: (stretch || null) as never,
        })
        .eq("id", garment.id);
      if (error) throw error;
      if (allowCategory && category !== garment.category) {
        // The photo must actually show the new choice
        const { data: check } = await supabase.functions.invoke("inspect-garment", { body: { garment_upload_id: garment.id } });
        if (check?.checked && !check.matches) {
          await supabase.from("garment_uploads").update({ category: garment.category as never }).eq("id", garment.id);
          setCategory(garment.category ?? "top");
          setProblem(`${check.message} Try-ons only draw what's really in the photo.`);
          return;
        }
      }
      toast.success("Saved");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5">
      {(previewUrl || seen) && (
        <div className="grid grid-cols-[88px_1fr] items-start gap-4">
          {previewUrl ? <img src={previewUrl} alt="" className="aspect-[3/4] w-full bg-sunk object-cover" /> : <span />}
          {seen && (
            <div className="grid gap-1">
              <span className="label">We see</span>
              <p className="font-medium capitalize">{seen.type}</p>
              {seen.colour && <p className="text-[13px] text-muted">{seen.colour}</p>}
              <p className="text-[13px] text-muted">
                {[seen.sleeves && seen.sleeves !== "n/a" ? `${seen.sleeves.replace("_", "-")} sleeves` : "", seen.silhouette && seen.silhouette !== "n/a" ? seen.silhouette.replace("_", "-") : ""].filter(Boolean).join(" · ")}
              </p>
            </div>
          )}
        </div>
      )}

      {problem && <Notice tone="warn" title="That doesn't match the photo">{problem}</Notice>}

      {allowCategory && (
        <fieldset className="grid gap-2">
          <legend className="label mb-2">What is it?</legend>
          <div className="flex flex-wrap gap-1.5">
            {GARMENTS.map((g) => (
              <button key={g.category} type="button" onClick={() => { setCategory(g.category); setGarmentType(""); setLength(null); }} aria-pressed={category === g.category} className={cn("h-9 border px-3 font-mono text-[11px] font-semibold uppercase tracking-label", category === g.category ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink")}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(GARMENT_BY_CATEGORY[category]?.types ?? []).map((t) => (
              <button key={t} type="button" onClick={() => setGarmentType(garmentType === t ? "" : t)} aria-pressed={garmentType === t} className={cn("h-8 border px-2.5 text-[12.5px]", garmentType === t ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink")}>
                {t}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {!!lengths.length && (
        <fieldset className="grid gap-2">
          <legend className="label mb-2">How long is it?</legend>
          <div className="flex flex-wrap gap-1.5">
            {lengths.map((o) => (
              <button key={o.value} type="button" onClick={() => setLength(length === o.value ? null : o.value)} aria-pressed={length === o.value} className={cn("h-9 border px-3 text-[13px]", length === o.value ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink")}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[12.5px] text-muted">{seen?.length && !garment.length ? "We picked this from the photo. Change it if it's wrong." : "Where it ends on you. Leave it empty and we'll go by the photo."}</p>
        </fieldset>
      )}

      {!!measures.length && (
        <>
          <Field label="Size on the label (optional)" hint="e.g. UK 10, M, 32. Smaller than yours looks tighter.">
            <Input value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)} maxLength={12} className="max-w-[200px]" />
          </Field>

          <fieldset className="grid gap-3 border border-rule p-4">
            <legend className="label px-1">Garment measurements in cm (optional, most accurate)</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {measures.map((k) => (
                <Field key={k} label={MEASURE_LABELS[k].label} hint={MEASURE_LABELS[k].around && measuredFlat ? "Laid flat, side to side" : MEASURE_LABELS[k].hint}>
                  <Input type="number" inputMode="decimal" min={1} max={300} value={inputs[k] ?? ""} onChange={(e) => setInputs({ ...inputs, [k]: e.target.value })} className="num" />
                </Field>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" checked={measuredFlat} onChange={(e) => { setMeasuredFlat(e.target.checked); setInputs(convertAround(inputs, e.target.checked)); }} className="h-4 w-4 accent-ink" />
              I measured it laid flat (we double bust, waist, hips and thigh)
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[13px] text-muted">Fabric:</span>
              {STRETCH_OPTIONS.map((o) => (
                <button key={o.value} type="button" onClick={() => setStretch(stretch === o.value ? "" : o.value)} aria-pressed={stretch === o.value} className={cn("h-8 border px-2.5 text-[12.5px]", stretch === o.value ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink")}>
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <div className="flex gap-2">
        <Button variant="solid" onClick={save} loading={busy}>{allowCategory ? "Save changes" : `Use this ${noun}`}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>{allowCategory ? "Cancel" : "Skip"}</Button>}
      </div>
    </div>
  );
}
