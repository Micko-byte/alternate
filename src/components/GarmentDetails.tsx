import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GARMENTS, GARMENT_BY_CATEGORY, closestLength } from "@/lib/garments";
import { cn, errorMessage } from "@/lib/utils";
import { Button, Notice } from "@/components/ui";
import { DimensionFields, dimensionsFrom, dimensionsRow, type Dimensions } from "@/components/DimensionFields";

export type GarmentRow = {
  id: string;
  category: string | null;
  garment_type: string | null;
  length: string | null;
  size_label: string | null;
  measurements: unknown;
  stretch: string | null;
};

export type Seen = { type: string; colour: string; length: string | null; sleeves: string | null; silhouette: string | null; stretch?: string | null } | null;

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
  // Typed values win; otherwise start from what the photo check read
  const [dimensions, setDimensions] = useState<Dimensions>(
    dimensionsFrom(garment, { length: closestLength(garment.category ?? "", seen?.length), stretch: seen?.stretch }),
  );
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const noun = garmentType.toLowerCase() || GARMENT_BY_CATEGORY[category]?.label.toLowerCase() || "item";

  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const { error } = await supabase
        .from("garment_uploads")
        .update({ category: category as never, garment_type: garmentType.trim().slice(0, 40) || null, ...dimensionsRow(category, dimensions) })
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
              <button key={g.category} type="button" onClick={() => { setCategory(g.category); setGarmentType(""); setDimensions({ ...dimensions, length: null }); }} aria-pressed={category === g.category} className={cn("h-9 border px-3 font-mono text-[11px] font-semibold uppercase tracking-label", category === g.category ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink")}>
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

      <DimensionFields category={category} value={dimensions} onChange={setDimensions} lengthFromPhoto={!!seen?.length && !garment.length} />

      <div className="flex gap-2">
        <Button variant="solid" onClick={save} loading={busy}>{allowCategory ? "Save changes" : `Use this ${noun}`}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>{allowCategory ? "Cancel" : "Skip"}</Button>}
      </div>
    </div>
  );
}
