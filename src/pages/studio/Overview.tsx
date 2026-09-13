import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { kes } from "@/lib/utils";
import { sizeText } from "@/lib/sizes";
import { Button, ButtonLink, Notice, PageHeader } from "@/components/ui";
import { useStore } from "./types";

export default function Overview() {
  const store = useStore();
  const link = `${window.location.origin}/s/${store.slug}?ref=${store.referral_code}`;

  const stats = useQuery({
    queryKey: ["studio-stats", store.id],
    queryFn: async () => {
      const [products, referrals, earnings, demand] = await Promise.all([
        supabase.from("products").select("id, status", { count: "exact" }).eq("store_id", store.id),
        supabase.from("referrals").select("referred_user_id", { count: "exact", head: true }).eq("store_id", store.id),
        supabase.from("referral_earnings").select("amount_kes, payout_id").eq("store_id", store.id),
        supabase.rpc("store_size_demand", { _store_id: store.id }),
      ]);
      const earned = (earnings.data ?? []).reduce((s, e) => s + Number(e.amount_kes), 0);
      const unpaid = (earnings.data ?? []).filter((e) => !e.payout_id).reduce((s, e) => s + Number(e.amount_kes), 0);
      return {
        listed: (products.data ?? []).filter((p) => p.status === "active").length,
        total: products.count ?? 0,
        shoppers: referrals.count ?? 0,
        earned,
        unpaid,
        demand: demand.data ?? [],
        isOwner: store.role === "owner",
      };
    },
  });

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("Link copied. Put it in your Instagram and TikTok bio.");
  };

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Overview" title={store.name}>
        <ButtonLink to="/studio/products/new" variant="accent">Add a piece</ButtonLink>
      </PageHeader>

      {store.status === "pending" && <Notice tone="warn" title="Your store is waiting for approval">You can add products now. Shoppers will see them once ALTERNATE approves your store.</Notice>}
      {store.status === "suspended" && <Notice tone="bad" title="Your store is suspended">Contact ALTERNATE support to reopen it.</Notice>}

      <dl className="grid grid-cols-2 gap-px border border-rule bg-rule md:grid-cols-4">
        {[
          ["Pieces listed", `${stats.data?.listed ?? "–"}`, `of ${stats.data?.total ?? "–"}`],
          ["Shoppers you brought", `${stats.data?.shoppers ?? "–"}`, "through your link"],
          ["Referral earnings", stats.data?.isOwner ? kes(stats.data?.earned) : "—", "all time"],
          ["Waiting to be paid", stats.data?.isOwner ? kes(stats.data?.unpaid) : "—", "to your M-Pesa"],
        ].map(([k, v, sub]) => (
          <div key={k} className="grid gap-1 bg-surface p-5">
            <dt className="label">{k}</dt>
            <dd className="num text-[28px] leading-tight">{v}</dd>
            <dd className="text-[12.5px] text-muted">{sub}</dd>
          </div>
        ))}
      </dl>

      <section className="grid gap-3 border border-ink bg-surface p-6">
        <span className="label text-accent">Your store link</span>
        <p className="text-muted">Shoppers who sign up through this link are yours. You earn 20% of every credit pack they buy.</p>
        <div className="flex flex-wrap gap-2">
          <code className="num flex h-11 min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap border border-rule bg-paper px-3 text-[13px]">{link}</code>
          <Button variant="outline" onClick={copy}><Copy className="h-4 w-4" /> Copy</Button>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="display text-[28px]">Sizes shoppers are waiting for</h2>
        <div className="overflow-x-auto border border-rule bg-surface">
          <table className="w-full min-w-[480px] text-left text-[14px]">
            <thead className="bg-sunk">
              <tr>
                <th className="label px-4 py-2.5 font-normal">Piece</th>
                <th className="label px-4 py-2.5 font-normal">Size</th>
                <th className="label px-4 py-2.5 text-right font-normal">Waiting</th>
              </tr>
            </thead>
            <tbody>
              {stats.data?.demand.length ? (
                stats.data.demand.map((d) => (
                  <tr key={`${d.product_id}-${d.size_system}-${d.size_value}`} className="border-t border-rule">
                    <td className="px-4 py-3">{d.product_name}</td>
                    <td className="num px-4 py-3">{sizeText(d.size_system, d.size_value)}</td>
                    <td className="num px-4 py-3 text-right">{d.waiting}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={3} className="px-4 py-6 text-muted">When a shopper asks to be told about a sold-out size, it shows here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
