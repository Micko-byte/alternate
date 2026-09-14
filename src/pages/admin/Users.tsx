import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminUserAction, useIsOwner, usd, usdToKes } from "@/lib/admin";
import { cn, errorMessage } from "@/lib/utils";
import { Button, Empty, Field, Input, PageHeader, Pill, Spinner } from "@/components/ui";

type Row = {
  id: string; email: string; display_name: string | null; created_at: string; last_sign_in_at: string | null; banned_until: string | null;
  roles: string[]; shops_for: string | null; credits: number; tryons: number; tryons_succeeded: number; cost_usd: number;
  tryon_limit: number | null; store_name: string | null; feedback_count: number;
};

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string>();
  const users = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_users", { _search: search || null });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const date = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—");

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Admin · users" title="People">
        <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email or name" className="w-72" />
      </PageHeader>

      {users.isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : !users.data?.length ? (
        <Empty title="No one found" />
      ) : (
        <div className="overflow-x-auto border border-rule bg-surface">
          <table className="w-full min-w-[860px] text-left text-[14px]">
            <thead className="bg-sunk">
              <tr>
                {["Person", "Joined", "Last sign-in", "Credits", "Try-ons", "API cost", ""].map((h, i) => (
                  <th key={h || "x"} className={cn("label px-4 py-2.5 font-normal", i >= 3 && i <= 5 && "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => {
                const banned = u.banned_until && new Date(u.banned_until) > new Date();
                return (
                  <FragmentRow key={u.id}>
                    <tr className={cn("border-t border-rule", open === u.id && "bg-paper")}>
                      <td className="px-4 py-3">
                        <div className="grid gap-1">
                          <span className="font-medium">{u.email}</span>
                          <span className="flex flex-wrap gap-1">
                            {u.roles.includes("owner") && <Pill tone="ink">Owner</Pill>}
                            {u.roles.includes("admin") && !u.roles.includes("owner") && <Pill tone="accent">Admin</Pill>}
                            {banned && <Pill tone="bad">Banned</Pill>}
                            {u.store_name && <Pill>{u.store_name}</Pill>}
                            {u.shops_for && <Pill>{u.shops_for}</Pill>}
                          </span>
                        </div>
                      </td>
                      <td className="num px-4 py-3 text-[13px]">{date(u.created_at)}</td>
                      <td className="num px-4 py-3 text-[13px]">{date(u.last_sign_in_at)}</td>
                      <td className="num px-4 py-3 text-right">{u.credits}</td>
                      <td className="num px-4 py-3 text-right">{u.tryons_succeeded}/{u.tryons}{u.tryon_limit !== null && <span className="text-muted"> · cap {u.tryon_limit}</span>}</td>
                      <td className="num px-4 py-3 text-right">{usd(u.cost_usd)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant={open === u.id ? "solid" : "outline"} onClick={() => setOpen(open === u.id ? undefined : u.id)}>Manage</Button>
                      </td>
                    </tr>
                    {open === u.id && (
                      <tr className="border-t border-rule bg-paper">
                        <td colSpan={7} className="px-4 py-5">
                          <ManageUser user={u} banned={!!banned} onDone={() => users.refetch()} />
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ManageUser({ user, banned, onDone }: { user: Row; banned: boolean; onDone: () => void }) {
  const queryClient = useQueryClient();
  const isOwner = useIsOwner();
  const [credits, setCredits] = useState("4");
  const [limit, setLimit] = useState(user.tryon_limit?.toString() ?? "");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<string>();
  const isStaff = user.roles.includes("admin") || user.roles.includes("owner");
  const isOwnerRow = user.roles.includes("owner");

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(success);
      onDone();
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(undefined);
    }
  };

  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(name as never, args as never);
    if (error) throw error;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <div className="grid content-start gap-2">
        <span className="label text-ink">Give credits</span>
        <div className="flex gap-2">
          <Input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} className="num h-10 w-24" />
          <Button size="sm" loading={busy === "credits"} onClick={() => run("credits", () => rpc("admin_grant_credits", { _email: user.email, _credits: Number(credits) }), `${credits} credits given`)}>Give</Button>
        </div>
        <span className="text-[12.5px] text-muted">Use a negative number to take credits back.</span>
      </div>

      <div className="grid content-start gap-2">
        <span className="label text-ink">Try-on cap</span>
        <div className="flex gap-2">
          <Input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Default" className="num h-10 w-24" />
          <Button size="sm" loading={busy === "limit"} onClick={() => run("limit", () => rpc("admin_set_tryon_limit", { _user_id: user.id, _limit: limit === "" ? null : Number(limit) }), "Cap updated")}>Save</Button>
        </div>
        <span className="text-[12.5px] text-muted">Empty uses the default for everyone. Admins have no cap.</span>
      </div>

      <div className="grid content-start gap-2">
        <span className="label text-ink">Access</span>
        {!isOwnerRow && (
          <Button size="sm" variant="outline" loading={busy === "ban"} onClick={() => run("ban", () => adminUserAction(banned ? "unban" : "ban", user.id), banned ? "Access restored" : "User banned")}>
            {banned ? "Unban" : "Ban"}
          </Button>
        )}
        {isOwner.data && !isOwnerRow && (
          <Button size="sm" variant="outline" loading={busy === "admin"} onClick={() => run("admin", () => rpc("owner_set_admin", { _email: user.email, _grant: !isStaff }), isStaff ? "Admin removed" : "Now an admin")}>
            {isStaff ? "Remove admin" : "Make admin"}
          </Button>
        )}
        {isOwnerRow && <span className="text-[13px] text-muted">The owner account can't be changed here.</span>}
      </div>

      {!isOwnerRow && (
        <div className="grid content-start gap-2">
          <span className="label text-bad">Delete account</span>
          <Field label={`Type ${user.email} to confirm`}>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-10" />
          </Field>
          <Button size="sm" variant="danger" disabled={confirm.trim().toLowerCase() !== user.email.toLowerCase()} loading={busy === "delete"} onClick={() => run("delete", () => adminUserAction("delete", user.id), "Account and photos deleted")}>
            Delete permanently
          </Button>
          <span className="text-[12.5px] text-muted">Removes their photos, try-ons and account. Cost so far: {usd(user.cost_usd)} ({usdToKes(user.cost_usd)}).</span>
        </div>
      )}
    </div>
  );
}
