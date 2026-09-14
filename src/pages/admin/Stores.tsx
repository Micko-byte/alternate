import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/utils";
import { Button, Empty, PageHeader, Pill, Spinner } from "@/components/ui";

export default function AdminStores() {
  const stores = useQuery({
    queryKey: ["admin-stores"],
    queryFn: async () => (await supabase.from("stores").select("id, name, slug, status, instagram_handle, tiktok_handle, location, created_at").order("created_at", { ascending: false })).data ?? [],
  });

  const setStatus = async (id: string, status: "active" | "suspended") => {
    const { error } = await supabase.rpc("admin_set_store_status", { _store_id: id, _status: status });
    if (error) return toast.error(errorMessage(error));
    toast.success(status === "active" ? "Store approved" : "Store suspended");
    stores.refetch();
  };

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Admin · stores" title="Stores" />
      {stores.isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : !stores.data?.length ? (
        <Empty title="No stores yet" />
      ) : (
        <div className="overflow-x-auto border border-rule bg-surface">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <tbody>
              {stores.data.map((s) => (
                <tr key={s.id} className="border-t border-rule first:border-0">
                  <td className="px-4 py-3">
                    <Link to={`/s/${s.slug}`} className="font-medium hover:underline">{s.name}</Link>
                    <div className="text-[12.5px] text-muted">{[s.instagram_handle && `@${s.instagram_handle}`, s.tiktok_handle && `TikTok @${s.tiktok_handle}`, s.location].filter(Boolean).join(" · ") || s.slug}</div>
                  </td>
                  <td className="px-4 py-3"><Pill tone={s.status === "active" ? "good" : s.status === "pending" ? "warn" : "bad"}>{s.status}</Pill></td>
                  <td className="px-4 py-3 text-right">
                    {s.status !== "active" && <Button size="sm" onClick={() => setStatus(s.id, "active")}>Approve</Button>}
                    {s.status === "active" && <Button size="sm" variant="danger" onClick={() => setStatus(s.id, "suspended")}>Suspend</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
