import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCreditPacks, useCredits, useTryonPrices } from "@/lib/queries";
import { QUALITY_LABELS } from "@/lib/tryon";
import { errorMessage, kes } from "@/lib/utils";
import { Button, Notice, PageHeader } from "@/components/ui";

const ENTRY_LABELS: Record<string, string> = {
  purchase: "Bought credits",
  tryon_charge: "Try-on",
  tryon_refund: "Refund, try-on failed",
  adjustment: "Added by ALTERNATE",
};

export default function Credits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const balance = useCredits();
  const packs = useCreditPacks();
  const prices = useTryonPrices();
  const [buying, setBuying] = useState<string>();
  const [checking, setChecking] = useState(false);

  const history = useQuery({
    queryKey: ["ledger", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("credit_ledger").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  const reference = params.get("reference") ?? params.get("trxref");
  useEffect(() => {
    if (!reference) return;
    setChecking(true);
    supabase.functions
      .invoke("payments-verify", { body: { reference } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (data.status === "success") toast.success("Payment received. Your credits are ready.");
        else if (data.status === "failed") toast.error("The payment didn't go through. You weren't charged.");
        else toast("Payment is still processing. Credits appear as soon as M-Pesa confirms.");
      })
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => {
        setChecking(false);
        setParams({}, { replace: true });
        queryClient.invalidateQueries({ queryKey: ["credits"] });
        queryClient.invalidateQueries({ queryKey: ["ledger"] });
      });
  }, [reference, setParams, queryClient]);

  const buy = async (packId: string) => {
    setBuying(packId);
    const { data, error } = await supabase.functions.invoke("payments-init", { body: { pack_id: packId, return_url: `${window.location.origin}/credits` } });
    if (error || !data?.authorization_url) {
      setBuying(undefined);
      let message = errorMessage(error);
      try {
        const body = await (error as { context?: Response })?.context?.json();
        if (body?.error) message = body.error;
      } catch {
        /* keep generic message */
      }
      return toast.error(message);
    }
    window.location.href = data.authorization_url;
  };

  return (
    <div className="grid gap-10">
      <PageHeader eyebrow="Credits" title="Pay as you try">
        <div className="grid justify-items-end">
          <span className="num text-[44px] leading-none">{balance.data ?? 0}</span>
          <span className="label">credits left</span>
        </div>
      </PageHeader>

      {checking && <Notice tone="accent" title="Checking your payment…" />}

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-4">
          {packs.data?.filter((p) => p.is_active).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 border border-ink bg-surface p-6">
              <div className="grid gap-1">
                <span className="label text-accent">{p.name}</span>
                <span className="display text-[34px]">{p.credits} credits</span>
                <span className="text-muted">Pay with M-Pesa or card</span>
              </div>
              <Button variant="accent" size="lg" onClick={() => buy(p.id)} loading={buying === p.id}>
                Pay {kes(p.price_kes)}
              </Button>
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
