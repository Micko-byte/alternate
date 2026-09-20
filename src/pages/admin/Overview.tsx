import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, MessageSquare, Store, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usd, usdToKes } from "@/lib/admin";
import { cn, kes } from "@/lib/utils";
import { BarChart } from "@/components/BarChart";
import { PageHeader, Spinner } from "@/components/ui";

type Overview = {
  users_total: number; users_new: number; users_active: number;
  tryons: number; tryons_succeeded: number; tryons_failed: number;
  tryon_cost_usd: number; draft_cost_usd: number; drafts: number;
  revenue_kes: number; credits_sold: number; credits_granted: number; credits_used: number;
  ratings_up: number; ratings_down: number;
  stores_active: number; stores_pending: number; products_active: number;
  feedback_new: number; reports_open: number; deletions_open: number; tryon_limit: string | null;
  by_quality: { quality: string; tryons: number; succeeded: number; cost_usd: number; avg_cost_usd: number | null }[];
  daily: { day: string; signups: number; tryons: number; cost_usd: number; revenue_kes: number }[];
  top_users: { email: string; tryons: number; cost_usd: number }[];
};

const PERIODS = [7, 30, 90];

export default function AdminOverview() {
  const [days, setDays] = useState(30);
  const overview = useQuery({
    queryKey: ["admin-overview", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_overview", { _days: days });
      if (error) throw error;
      return data as unknown as Overview;
    },
  });

  const o = overview.data;
  const successRate = o && o.tryons ? Math.round((o.tryons_succeeded / o.tryons) * 100) : null;
  const rated = o ? o.ratings_up + o.ratings_down : 0;
  const satisfaction = o && rated ? Math.round((o.ratings_up / rated) * 100) : null;
  const totalCost = o ? Number(o.tryon_cost_usd) + Number(o.draft_cost_usd) : 0;
  const dayLabel = (d: string) => new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short" });

  return (
    <div className="grid gap-10">
      <PageHeader eyebrow="Admin · overview" title="How VAA ALTERNATE is doing">
        <div className="flex border border-rule" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p} role="tab" aria-selected={days === p} onClick={() => setDays(p)} className={cn("h-10 px-4 font-mono text-[11px] font-semibold uppercase tracking-label", days === p ? "bg-ink text-paper" : "text-muted hover:text-ink")}>
              {p} days
            </button>
          ))}
        </div>
      </PageHeader>

      {!o ? (
        <div className="grid place-items-center py-24"><Spinner /></div>
      ) : (
        <>
          {/* Needs attention */}
          {(o.feedback_new || o.reports_open || o.stores_pending || o.deletions_open) > 0 && (
            <div className="flex flex-wrap gap-2">
              {o.feedback_new > 0 && <Alert to="/admin/feedback" icon={MessageSquare} text={`${o.feedback_new} new feedback`} />}
              {o.reports_open > 0 && <Alert to="/admin/reports" icon={AlertTriangle} text={`${o.reports_open} open reports`} tone="bad" />}
              {o.stores_pending > 0 && <Alert to="/admin/stores" icon={Store} text={`${o.stores_pending} stores waiting for approval`} />}
              {o.deletions_open > 0 && <Alert to="/admin/users" icon={UserX} text={`${o.deletions_open} data deletion requests`} tone="bad" />}
            </div>
          )}

          {/* Headline numbers */}
          <dl className="grid grid-cols-2 gap-px border border-rule bg-rule lg:grid-cols-4">
            <Stat label="Users" value={o.users_total.toLocaleString()} sub={`${o.users_new} new · ${o.users_active} trying on`} />
            <Stat label="Try-ons" value={o.tryons.toLocaleString()} sub={successRate === null ? "None yet" : `${successRate}% succeeded · ${o.tryons_failed} failed`} />
            <Stat label="API cost" value={usd(totalCost)} sub={`≈ ${usdToKes(totalCost)} · try-ons ${usd(o.tryon_cost_usd)} · drafts ${usd(o.draft_cost_usd)}`} emphasis />
            <Stat label="Revenue" value={kes(o.revenue_kes)} sub={`${o.credits_sold} credits sold · ${o.credits_granted} given free`} />
            <Stat label="Avg cost per try-on" value={o.tryons_succeeded ? usd(Number(o.tryon_cost_usd) / o.tryons_succeeded, 3) : "—"} sub={o.tryons_succeeded ? `≈ ${usdToKes(Number(o.tryon_cost_usd) / o.tryons_succeeded)}` : "No successful try-ons yet"} />
            <Stat label="Satisfaction" value={satisfaction === null ? "—" : `${satisfaction}%`} sub={`${o.ratings_up} liked · ${o.ratings_down} didn't`} />
            <Stat label="Credits used" value={o.credits_used.toLocaleString()} sub={`Test cap: ${o.tryon_limit ?? "none"} per user`} />
            <Stat label="Stores" value={o.stores_active.toLocaleString()} sub={`${o.stores_pending} pending · ${o.products_active} pieces listed`} />
          </dl>

          {/* Trends: separate charts, one measure each */}
          <div className="grid gap-8 border border-rule bg-surface p-6 lg:grid-cols-2">
            <BarChart title="Try-ons per day" data={o.daily.map((d) => ({ label: dayLabel(d.day), value: Number(d.tryons) }))} format={(v) => Math.round(v).toString()} />
            <BarChart title="API cost per day (USD)" data={o.daily.map((d) => ({ label: dayLabel(d.day), value: Number(d.cost_usd) }))} format={(v) => usd(v)} />
            <BarChart title="New users per day" data={o.daily.map((d) => ({ label: dayLabel(d.day), value: Number(d.signups) }))} format={(v) => Math.round(v).toString()} />
            <BarChart title="Revenue per day (KES)" data={o.daily.map((d) => ({ label: dayLabel(d.day), value: Number(d.revenue_kes) }))} format={(v) => Math.round(v).toLocaleString("en-KE")} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="grid content-start gap-3">
              <h2 className="label text-ink">Cost by quality</h2>
              <Table
                head={["Quality", "Try-ons", "Succeeded", "Avg cost", "Total"]}
                rows={o.by_quality.map((q) => [q.quality, q.tryons, q.succeeded, q.avg_cost_usd == null ? "—" : `${usd(q.avg_cost_usd, 3)} (${usdToKes(q.avg_cost_usd)})`, usd(q.cost_usd)])}
                empty="No try-ons in this period"
              />
            </section>
            <section className="grid content-start gap-3">
              <h2 className="label text-ink">Highest-cost users</h2>
              <Table head={["User", "Try-ons", "Cost"]} rows={o.top_users.map((u) => [u.email, u.tryons, `${usd(u.cost_usd)} (${usdToKes(u.cost_usd)})`])} empty="No try-ons in this period" />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, emphasis }: { label: string; value: string; sub: string; emphasis?: boolean }) {
  return (
    <div className={cn("grid content-start gap-1.5 p-5", emphasis ? "bg-ink text-paper" : "bg-surface")}>
      <dt className={cn("label", emphasis && "text-paper/60")}>{label}</dt>
      <dd className="display text-[clamp(30px,3.4vw,44px)]">{value}</dd>
      <dd className={cn("text-[12.5px]", emphasis ? "text-paper/70" : "text-muted")}>{sub}</dd>
    </div>
  );
}

function Alert({ to, icon: Icon, text, tone }: { to: string; icon: typeof MessageSquare; text: string; tone?: "bad" }) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2 border px-3 py-2 text-[13px] font-semibold hover:border-ink", tone === "bad" ? "border-bad/40 bg-bad-soft text-bad" : "border-rule bg-surface")}>
      <Icon className="h-4 w-4" /> {text}
    </Link>
  );
}

export function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  return (
    <div className="overflow-x-auto border border-rule bg-surface">
      <table className="w-full min-w-[420px] text-left text-[14px]">
        <thead className="bg-sunk">
          <tr>{head.map((h, i) => <th key={h} className={cn("label px-4 py-2.5 font-normal", i > 0 && "text-right")}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((r, i) => (
            <tr key={i} className="border-t border-rule">
              {r.map((c, j) => <td key={j} className={cn("px-4 py-2.5", j > 0 && "num text-right")}>{c}</td>)}
            </tr>
          )) : <tr><td colSpan={head.length} className="px-4 py-6 text-muted">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
