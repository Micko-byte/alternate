import { LENGTH_OPTIONS } from "@/lib/garments";
import { MEASURES_FOR, MEASURE_LABELS, STRETCH_OPTIONS, convertAround, toMeasurements, type GarmentMeasurements, type MeasureKey, type Stretch } from "@/lib/garmentFit";
import { cn } from "@/lib/utils";
import { Field, Input } from "@/components/ui";
import { LengthInput, LengthUnitToggle } from "@/components/UnitInputs";

/** A garment's size and dimensions as typed. Measurement inputs are kept in cm. */
export type Dimensions = {
  length: string | null;
  sizeLabel: string;
  inputs: Partial<Record<MeasureKey, string>>;
  measuredFlat: boolean;
  stretch: Stretch | "";
};

export function dimensionsFrom(row: { length: string | null; size_label: string | null; measurements: unknown; stretch: string | null }, fallback?: { length?: string | null; stretch?: string | null }): Dimensions {
  const saved = (row.measurements ?? {}) as GarmentMeasurements;
  return {
    length: row.length ?? fallback?.length ?? null,
    sizeLabel: row.size_label ?? "",
    inputs: Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, String(v)])),
    measuredFlat: false,
    stretch: ((row.stretch ?? fallback?.stretch) as Stretch) || "",
  };
}

export const EMPTY_DIMENSIONS: Dimensions = { length: null, sizeLabel: "", inputs: {}, measuredFlat: false, stretch: "" };

/** Anything the shopper actually typed or picked. */
export function hasDimensions(d: Dimensions) {
  return !!(d.length || d.sizeLabel.trim() || d.stretch || Object.values(d.inputs).some((v) => v));
}

/** Database columns for these dimensions. */
export function dimensionsRow(category: string, d: Dimensions) {
  const measures = MEASURES_FOR[category] ?? [];
  return {
    length: ((LENGTH_OPTIONS[category] && d.length) || null) as never,
    size_label: d.sizeLabel.trim().slice(0, 12) || null,
    measurements: toMeasurements(Object.fromEntries(Object.entries(d.inputs).filter(([k]) => measures.includes(k as MeasureKey))), d.measuredFlat) as never,
    length_cm: null,
    stretch: (d.stretch || null) as never,
  };
}

/** Length, label size, measurements and fabric stretch for one garment. */
export function DimensionFields({ category, value, onChange, lengthFromPhoto }: {
  category: string;
  value: Dimensions;
  onChange: (next: Dimensions) => void;
  /** The length shown was read from the photo, not chosen. */
  lengthFromPhoto?: boolean;
}) {
  const lengths = LENGTH_OPTIONS[category] ?? [];
  const measures = MEASURES_FOR[category] ?? [];
  if (!lengths.length && !measures.length) return null;
  const set = (patch: Partial<Dimensions>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-5">
      {!!lengths.length && (
        <fieldset className="grid gap-2">
          <legend className="label mb-2">How long is it?</legend>
          <div className="flex flex-wrap gap-1.5">
            {lengths.map((o) => (
              <button key={o.value} type="button" onClick={() => set({ length: value.length === o.value ? null : o.value })} aria-pressed={value.length === o.value} className={cn("h-9 border px-3 text-[13px]", value.length === o.value ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink")}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[12.5px] text-muted">{lengthFromPhoto ? "We picked this from the photo. Change it if it's wrong." : "Where it ends on you. Leave it empty and we'll read it from the photo."}</p>
        </fieldset>
      )}

      {!!measures.length && (
        <>
          <Field label="Size on the label" hint="e.g. UK 10, M, 32. Smaller than yours looks tighter.">
            <Input value={value.sizeLabel} onChange={(e) => set({ sizeLabel: e.target.value })} maxLength={12} className="max-w-[200px]" />
          </Field>

          <fieldset className="grid gap-3 border border-rule p-4">
            <legend className="label px-1">Measurements</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12.5px] text-muted">Leave any empty and we'll estimate it. Anything you type is used exactly.</p>
              <LengthUnitToggle />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {measures.map((k) => (
                <Field key={k} label={MEASURE_LABELS[k].label} hint={MEASURE_LABELS[k].around && value.measuredFlat ? "Laid flat, side to side" : MEASURE_LABELS[k].hint}>
                  <LengthInput valueCm={value.inputs[k] ?? ""} onChangeCm={(cm) => set({ inputs: { ...value.inputs, [k]: cm } })} />
                </Field>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={value.measuredFlat}
                onChange={(e) => set({ measuredFlat: e.target.checked, inputs: convertAround(value.inputs, e.target.checked) })}
                className="h-4 w-4 accent-ink"
              />
              I measured it laid flat (we double bust, waist, hips and thigh)
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[13px] text-muted">Fabric:</span>
              {STRETCH_OPTIONS.map((o) => (
                <button key={o.value} type="button" onClick={() => set({ stretch: value.stretch === o.value ? "" : o.value })} aria-pressed={value.stretch === o.value} className={cn("h-8 border px-2.5 text-[12.5px]", value.stretch === o.value ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink")}>
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}
