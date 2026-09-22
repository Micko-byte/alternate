import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn, errorMessage, kes } from "@/lib/utils";
import { Button, Pill } from "@/components/ui";

const USD_TO_KES = 129.4;
const money = (usd: number) => kes(Math.round(usd * USD_TO_KES * 100) / 100);

type Costs = {
  tryons: { mode: string; quality: string; n: number; avg_usd: number; max_usd: number }[];
  inspections: { n: number; avg_usd: number | null };
  body_profiles: { n: number; avg_usd: number | null };
};

const MODES = [
  {
    key: "saver",
    name: "Saver",
    blurb: "A small model reads the photos and checks the results. Try-ons are only redone when the item or its colours came out wrong.",
    note: "About KES 11 of AI per Standard try-on.",
  },
  {
    key: "premium",
    name: "Premium",
    blurb: "GPT-6 Astra reads the photos and checks the results, and any try-on that fails a check is redone.",
    note: "About KES 17 of AI per Standard try-on.",
  },
] as const;

/** One switch for the whole system: how much VAA ALTERNATE spends on reading photos and checking results. */
export function AiMode() {
  const queryClient = useQueryClient();

  const mode = useQuery({
    queryKey: ["setting-ai-mode"],
    queryFn: async () => ((await supabase.from("app_settings").select("value").eq("key", "ai_mode").maybeSingle()).data?.value ?? "saver") as string,
  });

  const costs = useQuery({
    queryKey: ["admin-ai-costs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_ai_costs");
      if (error) throw error;
      return data as unknown as Costs;
    },
  });

  const sources = useQuery({
    queryKey: ["admin-sources"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_sources");
      if (error) throw error;
      return data as unknown as { source: string; accounts: number; tried: number; paid: number }[];
    },
  });

  const payments = useQuery({
    queryKey: ["payments-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("payments-status");
      if (error) throw error;
      return data as { configured: boolean; mode: "live" | "test" | null; key_works: boolean; payments_attempted: number; payments_paid: number };
    },
  });

  const choose = async (key: string) => {
    const { error } = await supabase.rpc("admin_set_setting", { _key: "ai_mode", _value: key });
    if (error) return toast.error(errorMessage(error));
    toast.success(key === "saver" ? "Saver is on. Every try-on from now uses the cheap checks." : "Premium is on. Every try-on from now uses GPT-6 Astra.");
    queryClient.invalidateQueries({ queryKey: ["setting-ai-mode"] });
  };

  const tryons = costs.data?.tryons ?? [];

  return (
    <section className="grid gap-6 border border-rule bg-surface p-6">
      <div className="grid gap-1">
        <h2 className="display flex items-center gap-2 text-[28px]"><Sparkles className="h-5 w-5" aria-hidden /> AI setup</h2>
        <p className="text-muted">
          One switch for everybody. It changes the model that reads photos and checks results, not the try-on images themselves — those look the same either way.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {MODES.map((m) => {
          const on = mode.data === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => !on && choose(m.key)}
              aria-pressed={on}
              className={cn("grid content-start gap-2 border p-5 text-left transition-colors", on ? "border-ink bg-ink text-paper" : "border-rule hover:border-ink")}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="display text-[24px]">{m.name}</span>
                {on ? <Pill tone="accent">On now</Pill> : <span className="label text-muted">Switch on</span>}
              </span>
              <span className={cn("text-[14px]", on ? "text-paper/80" : "text-muted")}>{m.blurb}</span>
              <span className={cn("num text-[13px]", on ? "text-paper/70" : "text-muted")}>{m.note}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2">
        <h3 className="label text-ink">What it has really cost</h3>
        <p className="text-[13px] text-muted">Succeeded try-ons from the last 60 days, including redos and the checks. A try-on sold at KES 25 needs to stay well under that.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead className="label"><tr><th className="py-2">Setup</th><th>Quality</th><th>Try-ons</th><th>Average</th><th>Worst</th></tr></thead>
            <tbody>
              {tryons.length ? tryons.map((r) => (
                <tr key={`${r.mode}-${r.quality}`} className="border-t border-rule">
                  <td className="py-2 capitalize">{r.mode}</td>
                  <td className="capitalize">{r.quality}</td>
                  <td className="num">{r.n}</td>
                  <td className="num">{money(r.avg_usd)}</td>
                  <td className="num">{money(r.max_usd)}</td>
                </tr>
              )) : <tr className="border-t border-rule"><td colSpan={5} className="py-3 text-muted">No try-ons yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-muted">
          Reading a garment: <span className="num text-ink">{costs.data?.inspections.avg_usd != null ? money(costs.data.inspections.avg_usd) : "–"}</span> each
          {" · "}Reading a body: <span className="num text-ink">{costs.data?.body_profiles.avg_usd != null ? money(costs.data.body_profiles.avg_usd) : "–"}</span> each.
          Both are saved and reused, so they're paid once per garment and per set of photos.
        </p>
      </div>

      <div className="grid gap-2 border-t border-rule pt-5">
        <h3 className="label text-ink">Where people came from</h3>
        <p className="text-[13px] text-muted">Put <span className="num">?s=tiktok-bio</span> on the link in an ad or a bio. Accounts made from that link are counted here, with how many went on to try on and to pay.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[13px]">
            <thead className="label"><tr><th className="py-2">Link</th><th>Accounts</th><th>Tried on</th><th>Paid</th></tr></thead>
            <tbody>
              {(sources.data ?? []).length ? (sources.data ?? []).map((r) => (
                <tr key={r.source} className="border-t border-rule">
                  <td className="py-2">{r.source}</td>
                  <td className="num">{r.accounts}</td>
                  <td className="num">{r.tried}</td>
                  <td className="num">{r.paid}</td>
                </tr>
              )) : <tr className="border-t border-rule"><td colSpan={4} className="py-3 text-muted">No accounts in the last 90 days.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-2 border-t border-rule pt-5">
        <h3 className="label flex items-center gap-2 text-ink"><Wallet className="h-4 w-4" aria-hidden /> Payments</h3>
        {payments.isLoading ? (
          <p className="text-muted">Checking…</p>
        ) : payments.error ? (
          <p className="text-bad">{errorMessage(payments.error)}</p>
        ) : (
          <p className="text-[14px] text-muted">
            {payments.data?.configured ? (
              <>
                Paystack key: <span className={cn("font-medium", payments.data.mode === "live" ? "text-good" : "text-warn")}>{payments.data.mode === "live" ? "live" : "test"}</span>
                {" · "}{payments.data.key_works ? "working" : <span className="text-bad">not accepted by Paystack</span>}
                {" · "}<span className="num text-ink">{payments.data.payments_paid}</span> paid of <span className="num text-ink">{payments.data.payments_attempted}</span> started.
              </>
            ) : (
              <span className="text-bad">No Paystack key on the server yet, so nobody can pay.</span>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
