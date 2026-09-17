// Units people measure in. Everything is stored in cm and kg; this only changes what is typed and shown.
import { useEffect, useState } from "react";

export type LengthUnit = "cm" | "in" | "m";
export type HeightUnit = "cm" | "m" | "ft";
export type WeightUnit = "kg" | "lb";
type Units = { length: LengthUnit; height: HeightUnit; weight: WeightUnit };

const KEY = "alternate-units";
const EVENT = "alternate-units-change";
const DEFAULTS: Units = { length: "cm", height: "cm", weight: "kg" };

function read(): Units {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

/** The shopper's preferred units, shared by every field on the page and remembered on this device. */
export function useUnits() {
  const [units, setUnits] = useState<Units>(read);
  useEffect(() => {
    const sync = () => setUnits(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const update = (patch: Partial<Units>) => {
    const next = { ...read(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: this page only */
    }
    setUnits(next);
    window.dispatchEvent(new Event(EVENT));
  };
  return { ...units, update };
}

const CM_PER: Record<LengthUnit, number> = { cm: 1, in: 2.54, m: 100 };

// Round to a sensible step, then print without float noise or trailing zeros (1.65, 36.25, 92.5)
const tidy = (n: number, step: number, decimals: number) => String(Number((Math.round(n / step) * step).toFixed(decimals)));

/** cm → the number to show in a unit. */
export function fromCm(cm: number, unit: LengthUnit) {
  return unit === "m" ? tidy(cm / 100, 0.005, 3) : unit === "in" ? tidy(cm / 2.54, 0.25, 2) : tidy(cm, 0.5, 1);
}

/** A typed number in a unit → cm (0.5 cm steps). */
export function toCm(value: number, unit: LengthUnit) {
  return Math.round(value * CM_PER[unit] * 2) / 2;
}

/** 165 → "165 cm", "64.9 in" or "1.65 m". */
export function formatLength(cm: number | null | undefined, unit: LengthUnit) {
  if (cm == null) return "";
  return `${fromCm(cm, unit)} ${unit}`;
}

/** 165 → "5 ft 5 in". */
export function feetAndInches(cm: number) {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)} ft ${inches % 12} in`;
}
