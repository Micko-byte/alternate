import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";
import { Button, Field, Input, Notice, PageHeader, Pill, Spinner } from "@/components/ui";

export default function Admin() {
  const isAdmin = useIsAdmin();
  const [email, setEmail] = useState("");
  const [credits, setCredits] = useState("20");
  const [granting, setGranting] = useState(false);

  const stores = useQuery({
    queryKey: ["admin-stores"],
    enabled: !!isAdmin.data,
    queryFn: async () => (await supabase.from("stores").select("id, name, slug, status, instagram_handle, created_at").order("created_at", { ascending: false })).data ?? [],
  });

  if (isAdmin.isLoading) return <div className="grid place-items-center py-24"><Spinner /></div>;
  if (!isAdmin.data) return <Notice title="Admins only" />;

  const setStatus = async (id: string, status: "active" | "suspended" | "pending") => {
    const { error } = await supabase.rpc("admin_set_store_status", { _store_id: id, _status: status });
    if (error) return toast.error(errorMessage(error));
    stores.refetch();
  };

  const grant = async () => {
    setGranting(true);
    const { data, error } = await supabase.rpc("admin_grant_credits", { _email: email, _credits: Number(credits) });
    setGranting(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`${email} now has ${data} credits`);
  };

  return (
    <div className="grid gap-10">
      <PageHeader eyebrow="Admin" title="ALTERNATE control room" />
      <section className="grid gap-4 border border-rule bg-surface p-6">
        <h2 className="display text-[26px]">Give test credits</h2>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_120px_auto]">
          <Field label="Account email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Credits"><Input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} className="num" /></Field>
          <Button onClick={grant} loading={granting} disabled={!email}>Give credits</Button>
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="display text-[26px]">Stores</h2>
        <div className="overflow-x-auto border border-rule bg-surface">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <tbody>
              {(stores.data ?? []).map((s) => (
                <tr key={s.id} className="border-t border-rule first:border-0">
                  <td className="px-4 py-3"><Link to={`/s/${s.slug}`} className="font-medium hover:underline">{s.name}</Link><div className="text-[12.5px] text-muted">{s.instagram_handle ? `@${s.instagram_handle}` : s.slug}</div></td>
                  <td className="px-4 py-3"><Pill tone={s.status === "active" ? "good" : s.status === "pending" ? "warn" : "bad"}>{s.status}</Pill></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {s.status !== "active" && <Button size="sm" variant="accent" onClick={() => setStatus(s.id, "active")}>Approve</Button>}
                      {s.status === "active" && <Button size="sm" variant="danger" onClick={() => setStatus(s.id, "suspended")}>Suspend</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
