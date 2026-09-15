import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCreditPacks, useCredits, useTryonPrices } from "@/lib/queries";
import { QUALITY_LABELS } from "@/lib/tryon";
import { kes } from "@/lib/utils";
import { ButtonLink, PageHeader, Pill } from "@/components/ui";

const ENTRY_LABELS: Record<string, string> = {
  purchase: "Bought credits",
  tryon_charge: "Try-on",
  tryon_refund: "Refund, try-on failed",
  adjustment: "Added by ALTERNATE",
};

export default function Credits() {
  const { user } = useAuth();
  const balance = useCredits();
  const packs = useCreditPacks();
  const prices = useTryonPrices();
  const payments = useQuery({
    queryKey: ["payments", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("id, amount_kes, credits, status, metadata, provider_reference, created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20);
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

  return (
    <div className="grid gap-10">
      <PageHeader eyebrow="Credits" title="Pay as you try">
        <div className="grid justify-items-end">
          <span className="num text-[44px] leading-none">{balance.data ?? 0}</span>
          <span className="label">credits left</span>
        </div>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-4">
          {packs.data?.filter((p) => p.is_active).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 border border-ink bg-surface p-6">
              <div className="grid gap-1">
                <span className="label">{p.name}</span>
                <span className="display text-[34px]">{p.credits} credits</span>
                <span className="flex items-center gap-1.5 text-[13px] text-muted">
                  <Lock className="h-3.5 w-3.5" /> M-Pesa or card · powered by Paystack
                </span>
              </div>
              <ButtonLink to={`/checkout/${p.id}`} size="lg">
                Buy · {kes(p.price_kes)}
              </ButtonLink>
            </div>
          ))}
        </div>
        <aside className="grid content-start gap-3 border border-rule bg-surface p-5">
          <span className="label">What a credit buys</span>
          {(["standard", "hd", "studio"] as const).map((q) => (
            <div key={q} className="flex items-baseline justify-between border-b border-rule pb-2 last:border-0">
              <span>{QUALITY_LABELS[q].name} try-on</span>
              <span className="num">{prices.data?.[q] ?? "–"} cr</span>
            </div>
          ))}
          <p className="text-[13px] text-muted">Failed try-ons are refunded automatically. Trying the same piece again with the same photo is free.</p>
        </aside>
      </div>

      {!!payments.data?.length && (
        <section className="grid gap-3">
          <h2 className="display text-[28px]">Payments</h2>
          <div className="overflow-x-auto border border-rule bg-surface">
            <table className="w-full min-w-[520px] text-left text-[14px]">
              <tbody>
                {payments.data.map((pm) => {
                  const method = (pm.metadata as { method?: string } | null)?.method;
                  return (
                    <tr key={pm.id} className="border-t border-rule first:border-0">
                      <td className="px-4 py-3">
                        <div className="grid">
                          <span>{pm.credits} credits · {method === "card" ? "Card" : method === "mpesa" ? "M-Pesa" : "Paystack"}</span>
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
        <h2 className="display text-[28px]">History</h2>
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
