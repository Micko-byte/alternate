import { SHOPS_FOR, SIZE_SYSTEMS, sizeFieldsFor, type ShopsFor, type SizeSystem } from "@/lib/sizes";
import { cn } from "@/lib/utils";
import { Field, Select } from "@/components/ui";

export const sizeKey = (category: string, system: SizeSystem) => `${category}:${system}`;

export function ShopsForPicker({ value, onChange }: { value: ShopsFor | null | undefined; onChange: (v: ShopsFor) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="label mb-2">I shop for</legend>
      <div className="grid grid-cols-3 border border-rule">
        {SHOPS_FOR.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn("h-11 font-mono text-[11px] font-semibold uppercase tracking-label", value === o.value ? "bg-ink text-paper" : "text-muted hover:text-ink")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Size selects for the sections a shopper buys from (women's UK, letters, waist). */
export function SizeFields({
  shopsFor,
  values,
  onChange,
  required,
}: {
  shopsFor: ShopsFor | null | undefined;
  values: Record<string, string>;
  onChange: (category: string, system: SizeSystem, value: string) => void;
  required?: boolean;
}) {
  const fields = sizeFieldsFor(shopsFor);
  return (
    <div className={cn("grid gap-3", fields.length > 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3")}>
      {fields.map((f) => (
        <Field key={sizeKey(f.category, f.system)} label={f.label}>
          <Select required={required} value={values[sizeKey(f.category, f.system)] ?? ""} onChange={(e) => onChange(f.category, f.system, e.target.value)} className="num">
            <option value="">—</option>
            {SIZE_SYSTEMS[f.system].options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      ))}
    </div>
  );
}
