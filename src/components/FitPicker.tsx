import { FITS, type FitStyle } from "@/lib/sizes";
import { cn } from "@/lib/utils";

/** Fitted → Baggy. On store pieces, looser fits size up automatically. */
export function FitPicker({ value, onChange, name = "fit", hint }: { value: FitStyle; onChange: (fit: FitStyle) => void; name?: string; hint?: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="label mb-2">Fit{hint ? ` · ${hint}` : ""}</legend>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(58px,1fr))] gap-1">
        {FITS.map((f) => (
          <label
            key={f.value}
            title={f.blurb}
            className={cn(
              "grid cursor-pointer place-items-center gap-0.5 border px-1 py-2 text-center",
              value === f.value ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink",
            )}
          >
            <input type="radio" name={name} value={f.value} checked={value === f.value} onChange={() => onChange(f.value)} className="sr-only" />
            <FitGlyph fit={f.value} />
            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em]">{f.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A T-shirt outline that widens from fitted to baggy. */
function FitGlyph({ fit }: { fit: FitStyle }) {
  const w = { fitted: 0, regular: 2, relaxed: 4, oversized: 6, baggy: 8 }[fit];
  return (
    <svg viewBox="0 0 40 32" className="h-5 w-7" aria-hidden>
      <path
        d={`M${14 - w / 2} 4 L${8 - w} 9 L${4 - w / 2} 15 L${9 - w / 2} 18 L${12 - w / 2} 14 L${12 - w / 2} ${28 + w / 3} L${28 + w / 2} ${28 + w / 3} L${28 + w / 2} 14 L${31 + w / 2} 18 L${36 + w / 2} 15 L${32 + w} 9 L${26 + w / 2} 4 Q20 9 ${14 - w / 2} 4 Z`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
