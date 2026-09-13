import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "solid" | "accent" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  solid: "bg-ink text-paper hover:bg-ink/85",
  accent: "bg-accent text-white hover:bg-accent-deep",
  outline: "border border-ink text-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink hover:bg-sunk",
  danger: "border border-bad/40 text-bad hover:bg-bad-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[11px]",
  md: "h-12 px-6 text-[12px]",
  lg: "h-14 px-8 text-[12.5px]",
};

export function buttonClass(variant: Variant = "solid", size: Size = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-mono font-semibold uppercase tracking-[0.08em] transition-colors disabled:pointer-events-none disabled:opacity-45",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "solid", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({ variant = "solid", size = "md", className, ...props }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

const fieldBase =
  "w-full border border-rule bg-surface px-3 text-[15px] text-ink placeholder:text-muted/60 transition-colors focus:border-ink focus:outline-none disabled:bg-sunk";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-[96px] py-2.5", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(fieldBase, "h-11 appearance-none bg-[length:12px] pr-8", className)} {...props} />;
});

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="text-[13px] text-bad">{error}</span> : hint ? <span className="text-[13px] text-muted">{hint}</span> : null}
    </label>
  );
}

type Tone = "neutral" | "accent" | "good" | "warn" | "bad" | "ink";
const tones: Record<Tone, string> = {
  neutral: "bg-sunk text-muted",
  accent: "bg-accent-soft text-accent",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  ink: "bg-ink text-paper",
};

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap px-2 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em]", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-muted", className)} aria-label="Loading" />;
}

export function PageHeader({ eyebrow, title, children, className }: { eyebrow?: string; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-6 pb-2", className)}>
      <div className="grid gap-4">
        {eyebrow && <span className="label">{eyebrow}</span>}
        <h1 className="display text-[clamp(44px,7.5vw,96px)]">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-3 border border-dashed border-rule px-6 py-14 text-center">
      <p className="display text-[34px]">{title}</p>
      {children && <div className="max-w-md text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "neutral", title, children, action }: { tone?: Tone; title: string; children?: ReactNode; action?: ReactNode }) {
  const bar: Record<Tone, string> = { neutral: "bg-sunk", accent: "bg-accent-soft", good: "bg-good-soft", warn: "bg-warn-soft", bad: "bg-bad-soft", ink: "bg-ink text-paper" };
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3.5", bar[tone])}>
      <div>
        <p className="font-semibold">{title}</p>
        {children && <div className="text-[14px] opacity-80">{children}</div>}
      </div>
      {action}
    </div>
  );
}
