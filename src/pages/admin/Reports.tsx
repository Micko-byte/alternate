import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";
import { Button, Empty, PageHeader, Pill, Spinner } from "@/components/ui";

type Row = { id: string; created_at: string; reason: string; details: string | null; status: string; tryon_id: string | null; product_id: string | null; store_id: string | null; reporter_email: string | null };

const REASONS: Record<string, string> = { not_me: "Doesn't look like me", inappropriate: "Inappropriate", offensive: "Offensive", copyright: "Copyright", other: "Other" };

export default function AdminReports() {
  const { user } = useAuth();
  const reports = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_reports");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const setStatus = async (id: string, status: "reviewing" | "actioned" | "dismissed") => {
    const { error } = await supabase.from("reports").update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(errorMessage(error));
    reports.refetch();
  };

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Admin · reports" title="Reported content" />
      {reports.isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : !reports.data?.length ? (
        <Empty title="Nothing reported">Reports from the “Not me” button on try-ons appear here.</Empty>
      ) : (
        <div className="grid gap-3">
          {reports.data.map((r) => {
            const open = r.status === "open" || r.status === "reviewing";
            return (
              <article key={r.id} className={`flex flex-wrap items-start justify-between gap-4 border bg-surface p-5 ${open ? "border-bad/50" : "border-rule"}`}>
                <div className="grid gap-1.5">
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={open ? "bad" : "neutral"}>{r.status}</Pill>
                    <Pill>{REASONS[r.reason] ?? r.reason}</Pill>
                  </div>
                  {r.details && <p>{r.details}</p>}
                  <p className="text-[12.5px] text-muted">
                    {r.reporter_email ?? "Deleted account"} · {new Date(r.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                    {r.tryon_id && <> · <Link to={`/try/${r.tryon_id}`} className="underline">open the try-on</Link></>}
                    {r.product_id && <> · <Link to={`/shop/${r.product_id}`} className="underline">open the piece</Link></>}
                  </p>
                </div>
                {open && (
                  <div className="flex flex-wrap gap-2">
                    {r.status === "open" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "reviewing")}>Reviewing</Button>}
                    <Button size="sm" onClick={() => setStatus(r.id, "actioned")}>Dealt with</Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "dismissed")}>Dismiss</Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
