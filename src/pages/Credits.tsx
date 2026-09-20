import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useShopPacks, useSubscriptionPlans, useTryonPrices, useWallet } from "@/lib/queries";
import { QUALITY_LABELS } from "@/lib/tryon";
import { cn, kes } from "@/lib/utils";
import { ButtonLink, PageHeader, Pill } from "@/components/ui";

const ENTRY_LABELS: Record<string, string> = {
  purchase: "Bought credits",
  tryon_charge: "Try-on",
  tryon_refund: "Refund, try-on failed",
  adjustment: "Added by VAA ALTERNATE",
};

const dateText = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" });

/**
 * Paystack sends shoppers back here with ?reference= after its own checkout page (the card window
 * inside VAA ALTERNATE never leaves, so this only runs on that fallback). Confirms the payment and
 * tidies the address bar.
 */
function usePaystackReturn() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const reference = params.get("reference") || params.get("trxref");

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("payments-verify", { body: { reference } });
      if (cancelled) return;
      const status = (data as { status?: string; message?: string } | null)?.status;
      if (error || status === "failed") toast.error((data as { message?: string } | null)?.message || "That payment didn't go through. You haven't been charged.");
      else if (status === "success") {
        toast.success("Payment received. Your credits are in.");
        for (const key of ["credits", "wallet", "ledger", "payments", "tryon-allowance"]) queryClient.invalidateQueries({ queryKey: [key] });
      } else toast("Still waiting for the payment to confirm. Credits appear here as soon as it does.");
      const next = new URLSearchParams(params);
      next.delete("reference");
      next.delete("trxref");
      setParams(next, { replace: true });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);
}

export default function Credits() {
  const { user } = useAuth();
  const wallet = useWallet();
  usePaystackReturn();
  const { lead, starter, others } = useShopPacks();
  const plans = useSubscriptionPlans();
  const prices = useTryonPrices();
  const w = wallet.data;

  const payments = useQuery({
    queryKey: ["payments", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount_kes, credits, status, metadata, provider_reference, created_at, subscription_plans(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const history = useQuery({
    queryKey: ["ledger", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("credit_ledger").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  const activePlans = plans.data?.filter((p) => p.is_active) ?? [];
  // Everything is shown as a saving against the starter pack, the cheapest everyday way in
  const starterEach = starter ? starter.price_kes / starter.credits : 0;
  const savingVsStarter = (price: number, credits: number) =>
    starterEach ? Math.round((1 - price / credits / starterEach) * 100) : 0;

  return (
    <div className="grid gap-12">
      <PageHeader eyebrow="Credits" title="Try-ons & credits">
        <div className="grid justify-items-end gap-1">
          <span className="num text-[44px] leading-none">{w?.spendable ?? 0}</span>
          <span className="label">credits to spend</span>
          {w?.plan && (
            <span className="text-right text-[12.5px] text-muted">
              <span className="num text-ink">{w.plan.credits_left}</span> {w.plan.name} · <span className="num text-ink">{w.credits}</span> pack
            </span>
          )}
        </div>
      </PageHeader>

      {w?.plan && (
        <section className="grid gap-4 border border-ink bg-surface p-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid gap-3">
            <span className="label">Your plan</span>
            <span className="display text-[40px]">{w.plan.name}</span>
            <div className="h-1.5 max-w-md bg-sunk" aria-hidden>
              <div className="h-full bg-ink" style={{ width: `${(w.plan.credits_left / w.plan.credits_total) * 100}%` }} />
            </div>
            <p className="text-[14px] text-muted">
              <span className="num text-ink">{w.plan.credits_left}</span> of {w.plan.credits_total} credits left until {dateText(w.plan.ends_at)}
              {w.plan.daily_limit ? <> · <span className="num text-ink">{w.plan.used_today}</span> of {w.plan.daily_limit} try-ons used today</> : null}
              {w.paid_until && w.paid_until !== w.plan.ends_at ? <> · next month already paid, to {dateText(w.paid_until)}</> : null}
            </p>
          </div>
          {activePlans.find((p) => p.code === w.plan?.code) && (
            <ButtonLink to={`/checkout/plan/${activePlans.find((p) => p.code === w.plan?.code)!.id}`} variant="outline">Pay for next month</ButtonLink>
          )}
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <section className="grid content-start gap-4">
          <div className="grid gap-2">
            <h2 className="display text-[clamp(30px,3.4vw,44px)]">Pay as you go</h2>
            <p className="text-muted">Credits that never expire. One credit is one Standard try-on.</p>
          </div>
          {lead && (
            <div className="grid gap-5 border-2 border-ink bg-ink p-6 text-paper md:grid-cols-[1fr_auto] md:items-center">
              <div className="grid gap-2">
                <span className="w-fit bg-mustard px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-label text-ink">
                  {lead.first_purchase_only ? "Launch offer · first buy only" : "Start here"}
                </span>
                <span className="display text-[clamp(38px,5vw,56px)]">{lead.credits} try-ons for {kes(lead.price_kes)}</span>
                <span className="flex items-center gap-1.5 text-[14px] text-paper/75">
                  <Lock className="h-3.5 w-3.5" /> {kes(Math.round(lead.price_kes / lead.credits))} a try-on · M-Pesa or card · never expires
                </span>
              </div>
              <ButtonLink to={`/checkout/${lead.id}`} size="lg" variant="outline" className="border-paper text-paper hover:bg-paper hover:text-ink">
                Buy {lead.credits} try-ons · {kes(lead.price_kes)}
              </ButtonLink>
            </div>
          )}
          {others.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 border border-rule bg-surface p-5">
              <div className="grid gap-1">
                <span className="flex items-center gap-2">
                  <span className="label">{p.name}</span>
                  {savingVsStarter(p.price_kes, p.credits) > 0 && (
                    <span className="bg-good-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-label text-good">Save {savingVsStarter(p.price_kes, p.credits)}%</span>
                  )}
                </span>
                <span className="display text-[30px]">{p.credits} try-ons</span>
                <span className="flex items-center gap-1.5 text-[13px] text-muted">
                  <Lock className="h-3.5 w-3.5" /> {kes(Math.round(p.price_kes / p.credits))} each{starterEach && p.price_kes / p.credits < starterEach ? ` instead of ${kes(Math.round(starterEach))}` : ""} · M-Pesa or card
                </span>
              </div>
              <ButtonLink to={`/checkout/${p.id}`} size="lg">
                Buy · {kes(p.price_kes)}
              </ButtonLink>
            </div>
          ))}
        </section>
        <aside className="grid content-start gap-3 border border-rule bg-surface p-5">
          <span className="label">What a try-on costs</span>
          {(["standard", "hd", "studio"] as const).map((q) => (
            <div key={q} className="grid gap-0.5 border-b border-rule pb-2 last:border-0">
              <div className="flex items-baseline justify-between">
                <span>{QUALITY_LABELS[q].name}</span>
                <span className="num">{prices.data?.[q] ?? "–"} cr</span>
              </div>
              <span className="text-[12.5px] text-muted">{QUALITY_LABELS[q].blurb}</span>
            </div>
          ))}
          <p className="text-[13px] text-muted">
            Plan credits are used first. Failed try-ons are refunded automatically. If a store brought you to VAA ALTERNATE, part of what you pay goes to that store.
          </p>
        </aside>
      </div>

      {!!activePlans.length && (
        <section className="grid gap-5">
          <div className="grid gap-2">
            <h2 className="display text-[clamp(34px,4vw,52px)]">Try on a lot? Save with a plan</h2>
            <p className="max-w-[60ch] text-muted">Pay once for 30 days of try-ons with M-Pesa or card. Nothing renews by itself; pay again when you want another month.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {activePlans.map((p, i) => (
              <article key={p.id} className={cn("grid content-between gap-6 border p-6", i === 1 ? "border-ink bg-ink text-paper" : "border-rule bg-surface")}>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("label", i === 1 && "text-paper/70")}>{p.name}</span>
                    {i === 1 && <span className="bg-mustard px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-label text-ink">Most chosen</span>}
                  </div>
                  <p className="flex items-baseline gap-1.5">
                    <span className="display text-[44px]">{kes(p.price_kes)}</span>
                    <span className={cn("text-[14px]", i === 1 ? "text-paper/70" : "text-muted")}>/ month</span>
                  </p>
                  <ul className={cn("grid gap-1.5 text-[14px]", i === 1 ? "text-paper/85" : "text-muted")}>
                    <li><span className="num">{p.monthly_credits}</span> credits ({p.monthly_credits} Standard try-ons)</li>
                    {p.daily_limit && <li>Up to <span className="num">{p.daily_limit}</span> try-ons a day</li>}
                    <li>
                      About <span className="num">{kes(Math.round(p.price_kes / p.monthly_credits))}</span> a try-on
                      {savingVsStarter(p.price_kes, p.monthly_credits) > 0 ? ` · save ${savingVsStarter(p.price_kes, p.monthly_credits)}%` : ""}
                    </li>
                    {p.blurb && <li>{p.blurb}</li>}
                  </ul>
                </div>
                <ButtonLink to={`/checkout/plan/${p.id}`} size="lg" variant={i === 1 ? "outline" : "solid"} className={i === 1 ? "border-paper text-paper hover:bg-paper hover:text-ink" : undefined}>
                  Choose {p.name}
                </ButtonLink>
              </article>
            ))}
          </div>
        </section>
      )}

      {!!payments.data?.length && (
        <section className="grid gap-3">
          <h2 className="display text-[28px]">Payments</h2>
          <div className="overflow-x-auto border border-rule bg-surface">
            <table className="w-full min-w-[520px] text-left text-[14px]">
              <tbody>
                {payments.data.map((pm) => {
                  const method = (pm.metadata as { method?: string } | null)?.method;
                  const plan = (pm as { subscription_plans?: { name: string } | null }).subscription_plans;
                  return (
                    <tr key={pm.id} className="border-t border-rule first:border-0">
                      <td className="px-4 py-3">
                        <div className="grid">
                          <span>{plan ? `${plan.name} plan, 1 month` : `${pm.credits} credits`} · {method === "card" ? "Card" : method === "mpesa" ? "M-Pesa" : "Paystack"}</span>
                          <span className="num text-[11px] text-muted">{pm.provider_reference}</span>
                        </div>
                      </td>
                      <td className="num px-4 py-3 text-[13px] text-muted">{new Date(pm.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td className="px-4 py-3"><Pill tone={pm.status === "success" ? "good" : pm.status === "pending" ? "warn" : "bad"}>{pm.status === "success" ? "Paid" : pm.status}</Pill></td>
                      <td className="num px-4 py-3 text-right">{kes(pm.amount_kes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="display text-[28px]">Pack credit history</h2>
        <div className="border border-rule bg-surface">
          {history.data?.length ? (
            history.data.map((h) => (
              <div key={h.id} className="flex items-center justify-between border-b border-rule px-4 py-3 last:border-0">
                <div className="grid">
                  <span>{ENTRY_LABELS[h.entry_type]}</span>
                  <span className="num text-[12px] text-muted">{new Date(h.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
                <span className={`num text-[15px] ${h.amount > 0 ? "text-good" : ""}`}>{h.amount > 0 ? `+${h.amount}` : h.amount}</span>
              </div>
            ))
          ) : (
            <p className="px-4 py-6 text-muted">No activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
