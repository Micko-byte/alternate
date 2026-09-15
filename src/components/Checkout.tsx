import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Lock, Smartphone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/queries";
import { cn, kes } from "@/lib/utils";
import { Button, ButtonLink, Field, Input, Spinner } from "@/components/ui";

type Pack = { id: string; name: string; credits: number; price_kes: number };
type Step =
  | { kind: "choose" }
  | { kind: "sending" }
  | { kind: "prompt"; reference: string; startedAt: number }
  | { kind: "card"; reference: string }
  | { kind: "success"; credits: number; reference: string; paidAt: Date }
  | { kind: "failed"; message: string };

const PROMPT_TIMEOUT_MS = 150_000;
const POLL_MS = 3_000;

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try {
      const parsed = await (error as { context?: Response }).context?.json();
      if (parsed?.error) message = parsed.error;
    } catch {
      /* keep message */
    }
    throw new Error(message);
  }
  return data as T;
}

/** Buy a credit pack without leaving ALTERNATE. M-Pesa runs in our UI; cards use Paystack's secure window.
 *  `inline` renders it inside a page; otherwise it is an overlay with a close button. */
export function Checkout({ pack, onClose, inline }: { pack: Pack; onClose?: () => void; inline?: boolean }) {
  const queryClient = useQueryClient();
  const profile = useProfile();
  const [method, setMethod] = useState<"mpesa" | "card">("mpesa");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef<number>();

  useEffect(() => {
    if (profile.data?.phone && !phone) setPhone(profile.data.phone);
  }, [profile.data?.phone, phone]);

  useEffect(() => () => window.clearInterval(pollRef.current), []);

  const finish = (credits: number, reference: string) => {
    window.clearInterval(pollRef.current);
    setStep({ kind: "success", credits, reference, paidAt: new Date() });
    for (const key of ["credits", "ledger", "payments", "tryon-allowance"]) queryClient.invalidateQueries({ queryKey: [key] });
  };

  const check = async (reference: string) => {
    const result = await invoke<{ status: string; message: string | null }>("payments-verify", { reference });
    if (result.status === "success") finish(pack.credits, reference);
    else if (result.status === "failed") {
      window.clearInterval(pollRef.current);
      setStep({ kind: "failed", message: result.message || "The payment didn't go through. You haven't been charged." });
    }
    return result.status;
  };

  const startPolling = (reference: string, startedAt: number) => {
    window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      setNow(Date.now());
      if (Date.now() - startedAt > PROMPT_TIMEOUT_MS) {
        window.clearInterval(pollRef.current);
        const status = await check(reference).catch(() => "pending");
        if (status === "pending") setStep({ kind: "failed", message: "We didn't get a confirmation from M-Pesa. If money left your account, it will show up here within a few minutes." });
        return;
      }
      await check(reference).catch(() => undefined);
    }, POLL_MS);
  };

  const payMpesa = async () => {
    setStep({ kind: "sending" });
    try {
      const res = await invoke<{ reference: string }>("payments-init", { pack_id: pack.id, method: "mpesa", phone });
      const startedAt = Date.now();
      setStep({ kind: "prompt", reference: res.reference, startedAt });
      startPolling(res.reference, startedAt);
      if (!profile.data?.phone) {
        void supabase.from("profiles").update({ phone }).eq("id", profile.data?.id ?? "");
      }
    } catch (err) {
      setStep({ kind: "failed", message: err instanceof Error ? err.message : "Couldn't send the M-Pesa prompt" });
    }
  };

  const payCard = async () => {
    setStep({ kind: "sending" });
    try {
      const res = await invoke<{ reference: string; access_code: string }>("payments-init", { pack_id: pack.id, method: "card" });
      setStep({ kind: "card", reference: res.reference });
      const { default: Paystack } = await import("@paystack/inline-js");
      new Paystack().resumeTransaction(res.access_code, {
        onSuccess: async () => {
          const status = await check(res.reference).catch(() => "pending");
          if (status === "pending") startPolling(res.reference, Date.now());
        },
        onCancel: () => setStep({ kind: "choose" }),
        onError: (e: { message?: string }) => setStep({ kind: "failed", message: e?.message || "The card window couldn't open" }),
      });
    } catch (err) {
      setStep({ kind: "failed", message: err instanceof Error ? err.message : "Couldn't start the card payment" });
    }
  };

  const busy = step.kind === "sending" || step.kind === "prompt" || step.kind === "card";
  const secondsLeft = step.kind === "prompt" ? Math.max(0, Math.ceil((PROMPT_TIMEOUT_MS - (now - step.startedAt)) / 1000)) : 0;

  const panel = (
      <div className={cn("grid w-full gap-5 bg-paper p-6", inline ? "border border-ink" : "max-h-[92dvh] overflow-y-auto border-t border-ink sm:max-w-md sm:border")}>
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <span className="label">Checkout</span>
            <h2 id="checkout-title" className="display text-[34px]">{pack.credits} credits</h2>
            <span className="num text-[15px] text-muted">{pack.name} · {kes(pack.price_kes)}</span>
          </div>
          {!busy && onClose && (
            <button onClick={onClose} className="grid h-9 w-9 place-items-center hover:bg-sunk" aria-label="Close checkout">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {step.kind === "choose" && (
          <>
            <div className="grid grid-cols-2 border border-rule" role="tablist" aria-label="Payment method">
              {([["mpesa", "M-Pesa", Smartphone], ["card", "Card", CreditCard]] as const).map(([value, label, Icon]) => (
                <button key={value} role="tab" aria-selected={method === value} onClick={() => setMethod(value)} className={cn("flex h-12 items-center justify-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-label", method === value ? "bg-ink text-paper" : "text-muted hover:text-ink")}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>

            {method === "mpesa" ? (
              <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); payMpesa(); }}>
                <Field label="M-Pesa phone number" hint="We'll send a prompt to this phone. Enter your M-Pesa PIN there.">
                  <Input type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" className="num text-[17px]" />
                </Field>
                <Button type="submit" size="lg" disabled={phone.replace(/\D/g, "").length < 9}>Send M-Pesa prompt · {kes(pack.price_kes)}</Button>
              </form>
            ) : (
              <div className="grid gap-4">
                <p className="text-[14px] text-muted">Your card details go straight to Paystack's secure payment window. ALTERNATE never sees your card number.</p>
                <Button size="lg" onClick={payCard}>Pay {kes(pack.price_kes)} by card</Button>
              </div>
            )}
          </>
        )}

        {step.kind === "sending" && (
          <div className="grid justify-items-center gap-3 py-8 text-center">
            <Spinner className="h-6 w-6" />
            <span className="text-muted">{method === "mpesa" ? "Sending the prompt to your phone…" : "Opening the secure card window…"}</span>
          </div>
        )}

        {step.kind === "prompt" && (
          <div className="grid gap-5 py-2">
            <div className="grid justify-items-center gap-3 text-center">
              <span className="relative grid h-16 w-16 place-items-center border border-ink">
                <Smartphone className="h-7 w-7" strokeWidth={1.5} />
                <span className="absolute -right-1.5 -top-1.5 h-3 w-3 animate-ping bg-mustard motion-reduce:animate-none" aria-hidden />
              </span>
              <p className="display text-[26px]">Check your phone</p>
              <p className="max-w-[32ch] text-[14px] text-muted">
                Enter your M-Pesa PIN to pay <span className="num text-ink">{kes(pack.price_kes)}</span> to ALTERNATE. This page updates by itself.
              </p>
            </div>
            <div className="h-1 bg-sunk" aria-hidden>
              <div className="h-full bg-ink transition-[width] duration-1000 ease-linear" style={{ width: `${(secondsLeft / (PROMPT_TIMEOUT_MS / 1000)) * 100}%` }} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="num text-[12px] text-muted">Waiting up to {secondsLeft}s</span>
              <Button size="sm" variant="outline" onClick={() => check(step.reference)}>I've entered my PIN</Button>
            </div>
            <button onClick={() => { window.clearInterval(pollRef.current); setStep({ kind: "choose" }); }} className="label justify-self-center text-ink underline underline-offset-4">
              Didn't get it? Try again
            </button>
          </div>
        )}

        {step.kind === "card" && (
          <div className="grid justify-items-center gap-3 py-8 text-center">
            <Spinner className="h-6 w-6" />
            <span className="text-muted">Complete your card payment in the Paystack window…</span>
          </div>
        )}

        {step.kind === "success" && (
          <div className="grid gap-5 py-2">
            <div className="grid justify-items-center gap-3 text-center">
              <CheckCircle2 className="h-12 w-12 text-good" strokeWidth={1.4} />
              <p className="display text-[30px]">Payment received</p>
              <p className="text-muted"><span className="num text-ink">{step.credits}</span> credits added to your account.</p>
            </div>
            <dl className="grid gap-2 border-y border-rule py-4 text-[14px]">
              {[
                ["Paid", kes(pack.price_kes)],
                ["Method", method === "mpesa" ? "M-Pesa" : "Card"],
                ["Date", step.paidAt.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })],
                ["Reference", step.reference],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="label">{k}</dt>
                  <dd className="num break-all text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="grid w-full gap-2">
              <ButtonLink to="/fitting-room" size="lg" onClick={onClose}>Start trying on</ButtonLink>
              {onClose ? <Button variant="ghost" onClick={onClose}>Close</Button> : <ButtonLink to="/credits" variant="ghost">Back to credits</ButtonLink>}
            </div>
          </div>
        )}

        {step.kind === "failed" && (
          <div className="grid gap-4 py-2">
            <p className="border border-bad/40 bg-bad-soft p-4 text-[14px] text-bad">{step.message}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setStep({ kind: "choose" })}>Try again</Button>
              {onClose ? <Button variant="ghost" onClick={onClose}>Close</Button> : <ButtonLink to="/credits" variant="ghost">Back</ButtonLink>}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 border-t border-rule pt-4 text-muted">
          <Lock className="h-3.5 w-3.5" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-label">Secured and powered by Paystack</span>
        </div>
      </div>
  );

  if (inline) return panel;
  return (
    // Not a native <dialog>: Paystack's card window must be able to open above it
    <div className="fixed inset-0 z-40 grid place-items-end bg-black/55 sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      {panel}
    </div>
  );
}
