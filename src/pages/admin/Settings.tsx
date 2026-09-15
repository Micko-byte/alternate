import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsOwner } from "@/lib/admin";
import { errorMessage } from "@/lib/utils";
import { Button, Field, Input, Notice, PageHeader, Pill } from "@/components/ui";
import { PricingEditor } from "./PricingEditor";

export default function AdminSettings() {
  const isOwner = useIsOwner();
  const [limit, setLimit] = useState("");
  const [email, setEmail] = useState("");
  const [creditEmail, setCreditEmail] = useState("");
  const [credits, setCredits] = useState("4");
  const [busy, setBusy] = useState<string>();

  const setting = useQuery({
    queryKey: ["setting-tryon-limit"],
    queryFn: async () => (await supabase.from("app_settings").select("value").eq("key", "tryon_limit_per_user").maybeSingle()).data?.value ?? null,
  });
  useEffect(() => setLimit(setting.data == null ? "" : String(setting.data)), [setting.data]);

  const admins = useQuery({
    queryKey: ["admin-list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_admins");
      if (error) throw error;
      return data ?? [];
    },
  });

  const audit = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => (await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const run = async (key: string, fn: () => PromiseLike<{ error: unknown }>, success: string, after?: () => void) => {
    setBusy(key);
    const { error } = await fn();
    setBusy(undefined);
    if (error) return toast.error(errorMessage(error));
    toast.success(success);
    after?.();
    audit.refetch();
  };

  return (
    <div className="grid max-w-4xl gap-10">
      <PageHeader eyebrow="Admin · settings" title="Controls" />

      <PricingEditor />

      <section className="grid gap-4 border border-rule bg-surface p-6">
        <div className="grid gap-1">
          <h2 className="display text-[28px]">Try-on cap</h2>
          <p className="text-muted">How many try-ons each person can make in total while testing. Failed try-ons don't count. Leave empty for no cap. You can give someone a different cap from Users.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Per person"><Input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No cap" className="num w-32" /></Field>
          <Button loading={busy === "limit"} onClick={() => run("limit", () => supabase.rpc("admin_set_setting", { _key: "tryon_limit_per_user", _value: limit === "" ? null : Number(limit) }), "Cap saved", () => setting.refetch())}>Save cap</Button>
        </div>
      </section>

      <section className="grid gap-4 border border-rule bg-surface p-6">
        <div className="grid gap-1">
          <h2 className="display text-[28px]">Give credits</h2>
          <p className="text-muted">Add credits to any account. Use a negative number to take them back.</p>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_120px_auto]">
          <Field label="Account email"><Input type="email" value={creditEmail} onChange={(e) => setCreditEmail(e.target.value)} /></Field>
          <Field label="Credits"><Input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} className="num" /></Field>
          <Button
            disabled={!creditEmail}
            loading={busy === "credits"}
            onClick={() => run("credits", () => supabase.rpc("admin_grant_credits", { _email: creditEmail, _credits: Number(credits) }), `${credits} credits given to ${creditEmail}`)}
          >
            Give credits
          </Button>
        </div>
      </section>

      <section className="grid gap-4 border border-rule bg-surface p-6">
        <div className="grid gap-1">
          <h2 className="display text-[28px]">Admins</h2>
          <p className="text-muted">Admins can see this dashboard. Only the owner can add or remove them.</p>
        </div>
        <ul className="grid gap-2">
          {admins.data?.map((a) => (
            <li key={a.user_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-rule py-2 last:border-0">
              <span className="flex items-center gap-2">
                {a.email}
                {a.roles.includes("owner") ? <Pill tone="ink">Owner</Pill> : <Pill tone="accent">Admin</Pill>}
              </span>
              {isOwner.data && !a.roles.includes("owner") && (
                <Button size="sm" variant="ghost" onClick={() => run(`remove-${a.email}`, () => supabase.rpc("owner_set_admin", { _email: a.email, _grant: false }), "Admin removed", () => admins.refetch())}>Remove</Button>
              )}
            </li>
          ))}
        </ul>
        {isOwner.data ? (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Add an admin by email" hint="They need an ALTERNATE account first."><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-72" /></Field>
            <Button disabled={!email} loading={busy === "add"} onClick={() => run("add", () => supabase.rpc("owner_set_admin", { _email: email, _grant: true }), `${email} is now an admin`, () => { setEmail(""); admins.refetch(); })}>Add admin</Button>
          </div>
        ) : (
          <Notice title="Only the owner can change admins" />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="label text-ink">Recent admin actions</h2>
        <div className="border border-rule bg-surface">
          {audit.data?.length ? audit.data.map((a) => (
            <div key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-rule px-4 py-2.5 text-[13px] last:border-0">
              <span>{a.action.replace(/_/g, " ")} <span className="text-muted">{JSON.stringify(a.details)}</span></span>
              <span className="num text-muted">{new Date(a.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
          )) : <p className="px-4 py-5 text-muted">No admin actions yet.</p>}
        </div>
      </section>
    </div>
  );
}
