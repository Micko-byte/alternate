import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCreditPacks, useSubscriptionPlans, useTryonPrices } from "@/lib/queries";
import { cn, errorMessage, kes } from "@/lib/utils";
import { Button, Input } from "@/components/ui";

// Rough numbers for deciding prices. Worst case: every buyer was referred by a store.
const VAT = 0.16;
const PAYSTACK = 0.015;
const STORE_SHARE = 0.2;
const AI_COST_PER_CREDIT_KES = 11; // a checked Standard try-on in Saver, including redos; Premium is about KES 17

/** What ALTERNATE keeps from one credit sold at this price, after VAT, Paystack, the store's share and AI cost. */
function keepPerCredit(pricePerCredit: number, storeShare: number) {
  return pricePerCredit / (1 + VAT) - pricePerCredit * (PAYSTACK + storeShare) - AI_COST_PER_CREDIT_KES;
}

function Keep({ price, credits, storeShare = STORE_SHARE }: { price: number; credits: number; storeShare?: number }) {
  const value = credits > 0 ? keepPerCredit(price / credits, storeShare) : 0;
  return <span className={cn("num text-[13px]", value < 5 ? "text-bad" : value < 12 ? "text-warn" : "text-good")}>{kes(Math.round(value))}</span>;
}

type Row = Record<string, string | boolean>;

export function PricingEditor() {
  const queryClient = useQueryClient();
  const plans = useSubscriptionPlans();
  const packs = useCreditPacks();
  const prices = useTryonPrices();
  const [planRows, setPlanRows] = useState<Record<string, Row>>({});
  const [packRows, setPackRows] = useState<Record<string, Row>>({});
  const [priceRows, setPriceRows] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>();

  useEffect(() => {
    setPlanRows(Object.fromEntries((plans.data ?? []).map((p) => [p.id, { name: p.name, price_kes: String(p.price_kes), monthly_credits: String(p.monthly_credits), daily_limit: p.daily_limit ? String(p.daily_limit) : "", is_active: p.is_active }])));
  }, [plans.data]);
  useEffect(() => {
    setPackRows(Object.fromEntries((packs.data ?? []).map((p) => [p.id, {
      name: p.name,
      price_kes: String(p.price_kes),
      credits: String(p.credits),
      store_share: p.store_share == null ? "" : String(Math.round(Number(p.store_share) * 1000) / 10),
      first_purchase_only: p.first_purchase_only,
      available_until: p.available_until ? p.available_until.slice(0, 10) : "",
      is_active: p.is_active,
    }])));
  }, [packs.data]);
  useEffect(() => setPriceRows(Object.fromEntries(Object.entries(prices.data ?? {}).map(([k, v]) => [k, String(v)]))), [prices.data]);

  const save = async (key: string, run: () => PromiseLike<{ error: unknown }>, invalidate: string) => {
    setBusy(key);
    const { error } = await run();
    setBusy(undefined);
    if (error) return toast.error(errorMessage(error));
    toast.success("Saved. Shoppers see the new price straight away.");
    queryClient.invalidateQueries({ queryKey: [invalidate] });
  };

  const cell = "h-9 px-2 text-[14px]";

  return (
    <section className="grid gap-6 border border-rule bg-surface p-6">
      <div className="grid gap-1">
        <h2 className="display text-[28px]">Prices</h2>
        <p className="text-muted">
          "Keep / credit" estimates what ALTERNATE keeps from each credit if the buyer came through a store: after 16% VAT, 1.5% Paystack, that pack's store share and about {kes(AI_COST_PER_CREDIT_KES)} of AI per Standard try-on in Saver. Red means too thin.
        </p>
      </div>

      <div className="grid gap-2">
        <h3 className="label text-ink">Monthly plans</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="label"><tr><th className="py-2">Name</th><th>Price / month</th><th>Credits</th><th>Per day</th><th>Keep / credit</th><th>Listed</th><th /></tr></thead>
            <tbody>
              {(plans.data ?? []).map((p) => {
                const r = planRows[p.id];
                if (!r) return null;
                const set = (k: string, v: string | boolean) => setPlanRows({ ...planRows, [p.id]: { ...r, [k]: v } });
                return (
                  <tr key={p.id} className="border-t border-rule">
                    <td className="py-2 pr-2"><Input className={cell} value={r.name as string} onChange={(e) => set("name", e.target.value)} /></td>
                    <td className="pr-2"><Input className={cn(cell, "num w-24")} type="number" min={1} value={r.price_kes as string} onChange={(e) => set("price_kes", e.target.value)} /></td>
                    <td className="pr-2"><Input className={cn(cell, "num w-20")} type="number" min={1} value={r.monthly_credits as string} onChange={(e) => set("monthly_credits", e.target.value)} /></td>
                    <td className="pr-2"><Input className={cn(cell, "num w-20")} type="number" min={1} placeholder="Any" value={r.daily_limit as string} onChange={(e) => set("daily_limit", e.target.value)} /></td>
                    <td className="pr-2"><Keep price={Number(r.price_kes)} credits={Number(r.monthly_credits)} /></td>
                    <td className="pr-2"><input type="checkbox" className="h-4 w-4 accent-ink" checked={r.is_active as boolean} onChange={(e) => set("is_active", e.target.checked)} aria-label="Listed" /></td>
                    <td>
                      <Button size="sm" variant="outline" loading={busy === p.id} onClick={() => save(p.id, () => supabase.from("subscription_plans").update({ name: String(r.name).trim(), price_kes: Number(r.price_kes), monthly_credits: Number(r.monthly_credits), daily_limit: r.daily_limit ? Number(r.daily_limit) : null, is_active: !!r.is_active }).eq("id", p.id), "subscription-plans")}>Save</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-2">
        <h3 className="label text-ink">Pay as you go</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead className="label"><tr><th className="py-2">Name</th><th>Price</th><th>Credits</th><th>Store share</th><th>First buy only</th><th>Ends</th><th>Keep / credit</th><th>Listed</th><th /></tr></thead>
            <tbody>
              {(packs.data ?? []).map((p) => {
                const r = packRows[p.id];
                if (!r) return null;
                const set = (k: string, v: string | boolean) => setPackRows({ ...packRows, [p.id]: { ...r, [k]: v } });
                return (
                  <tr key={p.id} className="border-t border-rule">
                    <td className="py-2 pr-2"><Input className={cell} value={r.name as string} onChange={(e) => set("name", e.target.value)} /></td>
                    <td className="pr-2"><Input className={cn(cell, "num w-24")} type="number" min={1} value={r.price_kes as string} onChange={(e) => set("price_kes", e.target.value)} /></td>
                    <td className="pr-2"><Input className={cn(cell, "num w-20")} type="number" min={1} value={r.credits as string} onChange={(e) => set("credits", e.target.value)} /></td>
                    <td className="pr-2"><Input className={cn(cell, "num w-20")} type="number" min={0} max={50} step={0.5} placeholder="Usual" value={r.store_share as string} onChange={(e) => set("store_share", e.target.value)} aria-label="Store share %" /></td>
                    <td className="pr-2"><input type="checkbox" className="h-4 w-4 accent-ink" checked={r.first_purchase_only as boolean} onChange={(e) => set("first_purchase_only", e.target.checked)} aria-label="First purchase only" /></td>
                    <td className="pr-2"><Input className={cn(cell, "num w-36")} type="date" value={r.available_until as string} onChange={(e) => set("available_until", e.target.value)} aria-label="Last day on sale" /></td>
                    <td className="pr-2"><Keep price={Number(r.price_kes)} credits={Number(r.credits)} storeShare={r.store_share === "" ? undefined : Number(r.store_share) / 100} /></td>
                    <td className="pr-2"><input type="checkbox" className="h-4 w-4 accent-ink" checked={r.is_active as boolean} onChange={(e) => set("is_active", e.target.checked)} aria-label="Listed" /></td>
                    <td>
                      <Button size="sm" variant="outline" loading={busy === p.id} onClick={() => save(p.id, () => supabase.from("credit_packs").update({
                        name: String(r.name).trim(),
                        price_kes: Number(r.price_kes),
                        credits: Number(r.credits),
                        store_share: r.store_share === "" ? null : Number(r.store_share) / 100,
                        first_purchase_only: !!r.first_purchase_only,
                        available_until: r.available_until ? new Date(`${r.available_until}T23:59:59`).toISOString() : null,
                        is_active: !!r.is_active,
                      }).eq("id", p.id), "credit-packs")}>Save</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-2">
        <h3 className="label text-ink">Credits per try-on</h3>
        <div className="flex flex-wrap items-end gap-3">
          {(["standard", "hd", "studio"] as const).map((q) => (
            <label key={q} className="grid gap-1">
              <span className="label capitalize">{q === "hd" ? "HD" : q}</span>
              <Input className={cn(cell, "num w-20")} type="number" min={1} value={priceRows[q] ?? ""} onChange={(e) => setPriceRows({ ...priceRows, [q]: e.target.value })} />
            </label>
          ))}
          <Button
            size="sm"
            variant="outline"
            loading={busy === "tryon-prices"}
            onClick={() =>
              save(
                "tryon-prices",
                async () => {
                  for (const q of ["standard", "hd", "studio"] as const) {
                    const { error } = await supabase.from("tryon_prices").update({ credits: Number(priceRows[q]) }).eq("quality", q);
                    if (error) return { error };
                  }
                  return { error: null };
                },
                "tryon-prices",
              )
            }
          >
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}
