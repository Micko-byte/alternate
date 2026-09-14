import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usd, usdToKes } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { Empty, PageHeader, Pill, Spinner } from "@/components/ui";

const FILTERS = [
  ["all", "All"],
  ["succeeded", "Succeeded"],
  ["failed", "Failed"],
  ["processing", "Processing"],
] as const;

type Row = {
  id: string; created_at: string; status: string; quality: string; fit: string; credits_charged: number; cost_usd: number | null;
  rating: number | null; engine: string | null; error_message: string | null; result_path: string | null; garment_path: string | null;
  product_name: string | null; store_name: string | null; user_id: string; user_email: string;
};

export default function AdminTryons() {
  const [status, setStatus] = useState<string>("all");
  const tryons = useQuery({
    queryKey: ["admin-tryons", status],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_tryons", { _status: status === "all" ? null : (status as never), _limit: 120 });
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      const sign = async (bucket: string, paths: string[]) => {
        if (!paths.length) return {} as Record<string, string>;
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
        return Object.fromEntries((signed ?? []).map((s) => [s.path, s.signedUrl]));
      };
      const [results, garments] = await Promise.all([
        sign("tryon-results", rows.map((r) => r.result_path).filter(Boolean) as string[]),
        sign("garment-uploads", rows.map((r) => r.garment_path).filter(Boolean) as string[]),
      ]);
      return rows.map((r) => ({ ...r, resultUrl: r.result_path ? results[r.result_path] : undefined, garmentUrl: r.garment_path ? garments[r.garment_path] : undefined }));
    },
  });

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Admin · generations" title="Every try-on">
        <div className="flex border border-rule" role="tablist" aria-label="Status">
          {FILTERS.map(([v, label]) => (
            <button key={v} role="tab" aria-selected={status === v} onClick={() => setStatus(v)} className={cn("h-10 px-4 font-mono text-[11px] font-semibold uppercase tracking-label", status === v ? "bg-ink text-paper" : "text-muted hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
      </PageHeader>

      <p className="max-w-[70ch] text-[14px] text-muted">These are customers' photos. Open them only to check quality, costs or reports.</p>

      {tryons.isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : !tryons.data?.length ? (
        <Empty title="No try-ons here yet" />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-5">
          {tryons.data.map((t) => (
            <article key={t.id} className="grid content-start gap-2">
              <Link to={`/try/${t.id}`} className="relative block aspect-[2/3] overflow-hidden bg-sunk">
                {t.resultUrl ? (
                  <img src={t.resultUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full place-items-center p-3 text-center text-[12.5px] text-muted">{t.status === "failed" ? t.error_message ?? "Failed" : t.status}</span>
                )}
                {t.garmentUrl && <img src={t.garmentUrl} alt="Inspiration" className="absolute bottom-2 right-2 h-16 w-12 border border-paper bg-white object-contain" />}
                <span className="absolute left-2 top-2 flex gap-1">
                  <Pill tone={t.status === "succeeded" ? "good" : t.status === "failed" ? "bad" : "accent"}>{t.status}</Pill>
                  {t.rating === 1 && <span className="grid h-6 w-6 place-items-center bg-good text-white" aria-label="Liked"><ThumbsUp className="h-3.5 w-3.5" /></span>}
                  {t.rating === -1 && <span className="grid h-6 w-6 place-items-center bg-bad text-white" aria-label="Disliked"><ThumbsDown className="h-3.5 w-3.5" /></span>}
                </span>
              </Link>
              <span className="truncate text-[13px] font-medium" title={t.user_email}>{t.user_email}</span>
              <span className="text-[12px] text-muted">{t.product_name ? `${t.product_name} · ${t.store_name}` : "Inspiration upload"}</span>
              <span className="num text-[12px] text-muted">
                {t.quality} · {t.fit} · {t.cost_usd != null ? `${usd(t.cost_usd, 3)} (${usdToKes(t.cost_usd)})` : "no cost"}
              </span>
              <span className="num text-[11px] text-muted">{new Date(t.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
