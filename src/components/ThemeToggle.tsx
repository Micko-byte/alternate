import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** One tap flips light ↔ dark with a circular reveal from the button. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setChoice } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={(e) => setChoice(next, { x: e.clientX, y: e.clientY })}
      className={cn("grid h-10 w-10 place-items-center hover:bg-sunk", className)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {resolved === "dark" ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.6} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={1.6} />}
    </button>
  );
}

/** Light / Dark / System picker for the account page. */
export function ThemePicker() {
  const { choice, setChoice } = useTheme();
  const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "Match my phone", icon: Monitor },
  ];
  return (
    <div className="grid grid-cols-3 border border-rule" role="radiogroup" aria-label="Appearance">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          onClick={(e) => setChoice(o.value, { x: e.clientX, y: e.clientY })}
          className={cn("flex h-12 items-center justify-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-label", choice === o.value ? "bg-ink text-paper" : "text-muted hover:text-ink")}
        >
          <o.icon className="h-4 w-4" /> {o.label}
        </button>
      ))}
    </div>
  );
}
