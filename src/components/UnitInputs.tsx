import { useEffect, useState } from "react";
import { feetAndInches, fromCm, toCm, useUnits, type HeightUnit, type LengthUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui";

function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <span className="inline-flex border border-rule" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("h-7 px-2.5 font-mono text-[11px] font-semibold", value === o.value ? "bg-ink text-paper" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

/** cm · in · m switch for measurement fields. One per section; every length field follows it. */
export function LengthUnitToggle() {
  const units = useUnits();
  return (
    <Chips<LengthUnit>
      label="Measurement units"
      value={units.length}
      onChange={(length) => units.update({ length })}
      options={[{ value: "cm", label: "cm" }, { value: "in", label: "inches" }, { value: "m", label: "m" }]}
    />
  );
}

/** A length typed in the chosen unit, handed back in cm (as a string, empty when blank). */
export function LengthInput({ valueCm, onChangeCm, className, ...rest }: { valueCm: string; onChangeCm: (cm: string) => void; className?: string; "aria-label"?: string }) {
  const { length: unit } = useUnits();
  const shown = (cm: string) => (cm === "" || !Number.isFinite(Number(cm)) ? "" : fromCm(Number(cm), unit));
  const [text, setText] = useState(shown(valueCm));

  // Follow outside changes (loading saved values, switching units) without fighting the typing
  useEffect(() => {
    const typedCm = text === "" ? "" : String(toCm(Number(text), unit));
    if (typedCm !== valueCm) setText(shown(valueCm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueCm, unit]);

  return (
    <div className="relative">
      <Input
        type="number"
        inputMode="decimal"
        step="any"
        min={0}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          onChangeCm(e.target.value === "" || !Number.isFinite(n) ? "" : String(toCm(n, unit)));
        }}
        className={cn("num pr-10", className)}
        aria-label={rest["aria-label"]}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-[12px] text-muted">{unit}</span>
    </div>
  );
}

/** Height in cm, metres, or feet and inches. */
export function HeightInput({ valueCm, onChangeCm }: { valueCm: string; onChangeCm: (cm: string) => void }) {
  const units = useUnits();
  const unit = units.height;
  const cm = valueCm === "" ? null : Number(valueCm);
  const [ft, setFt] = useState("");
  const [inch, setInch] = useState("");
  const [metres, setMetres] = useState("");

  useEffect(() => {
    if (cm == null) return;
    const total = Math.round(cm / 2.54);
    if (unit === "ft" && Math.round((Number(ft || 0) * 12 + Number(inch || 0)) * 2.54) !== cm) {
      setFt(String(Math.floor(total / 12)));
      setInch(String(total % 12));
    }
    if (unit === "m" && Math.round(Number(metres) * 100) !== cm) setMetres(String(cm / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cm, unit]);

  const fromFeet = (f: string, i: string) => {
    setFt(f);
    setInch(i);
    onChangeCm(f === "" && i === "" ? "" : String(Math.round((Number(f || 0) * 12 + Number(i || 0)) * 2.54)));
  };

  return (
    <div className="grid gap-2">
      <Chips<HeightUnit>
        label="Height units"
        value={unit}
        onChange={(height) => units.update({ height })}
        options={[{ value: "cm", label: "cm" }, { value: "m", label: "m" }, { value: "ft", label: "ft / in" }]}
      />
      {unit === "cm" && (
        <div className="relative">
          <Input type="number" inputMode="numeric" min={100} max={250} value={valueCm} onChange={(e) => onChangeCm(e.target.value)} className="num pr-10" aria-label="Height in cm" />
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-[12px] text-muted">cm</span>
        </div>
      )}
      {unit === "m" && (
        <div className="relative">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={1}
            max={2.5}
            value={metres}
            onChange={(e) => {
              setMetres(e.target.value);
              onChangeCm(e.target.value === "" ? "" : String(Math.round(Number(e.target.value) * 100)));
            }}
            className="num pr-10"
            aria-label="Height in metres"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-[12px] text-muted">m</span>
        </div>
      )}
      {unit === "ft" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Input type="number" inputMode="numeric" min={3} max={8} value={ft} onChange={(e) => fromFeet(e.target.value, inch)} className="num pr-8" aria-label="Height, feet" />
            <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-[12px] text-muted">ft</span>
          </div>
          <div className="relative">
            <Input type="number" inputMode="decimal" min={0} max={11.5} step="0.5" value={inch} onChange={(e) => fromFeet(ft, e.target.value)} className="num pr-8" aria-label="Height, inches" />
            <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-[12px] text-muted">in</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Weight in kg or lb, handed back in kg. */
export function WeightInput({ valueKg, onChangeKg }: { valueKg: string; onChangeKg: (kg: string) => void }) {
  const units = useUnits();
  const lb = units.weight === "lb";
  const [text, setText] = useState("");
  useEffect(() => {
    const kg = valueKg === "" ? null : Number(valueKg);
    const typedKg = text === "" ? null : lb ? Math.round(Number(text) * 0.45359237 * 10) / 10 : Number(text);
    if (kg !== typedKg) setText(kg == null ? "" : lb ? String(Math.round(kg / 0.45359237)) : String(kg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKg, lb]);

  return (
    <div className="grid gap-2">
      <Chips label="Weight units" value={units.weight} onChange={(weight) => units.update({ weight })} options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} />
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            onChangeKg(e.target.value === "" ? "" : String(lb ? Math.round(n * 0.45359237 * 10) / 10 : n));
          }}
          className="num pr-10"
          aria-label={`Weight in ${units.weight}`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-[12px] text-muted">{units.weight}</span>
      </div>
    </div>
  );
}

/** "165 cm (5 ft 5 in)" style hint under a height field. */
export function heightCheck(cm: string) {
  const n = Number(cm);
  if (!n || n < 100 || n > 250) return "Used to place hems and read measurements";
  return `That's ${n} cm, ${feetAndInches(n)}. Check it's right.`;
}
