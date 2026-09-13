import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage, extensionOf, publicMediaUrl } from "@/lib/utils";
import { Button, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { useStore } from "./types";

export default function Settings() {
  const store = useStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: store.name, bio: store.bio ?? "", instagram_handle: store.instagram_handle ?? "", tiktok_handle: store.tiktok_handle ?? "", whatsapp_phone: store.whatsapp_phone ?? "", location: store.location ?? "" });
  const [payoutPhone, setPayoutPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const finance = useQuery({
    queryKey: ["store-finance", store.id],
    enabled: store.role === "owner",
    queryFn: async () => (await supabase.from("store_finance").select("*").eq("store_id", store.id).maybeSingle()).data,
  });

  useEffect(() => setPayoutPhone(finance.data?.payout_phone ?? ""), [finance.data]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("stores")
      .update({ ...form, instagram_handle: form.instagram_handle.replace(/^@/, "") || null, tiktok_handle: form.tiktok_handle.replace(/^@/, "") || null, bio: form.bio || null, whatsapp_phone: form.whatsapp_phone || null, location: form.location || null })
      .eq("id", store.id);
    if (!error && store.role === "owner") {
      const { error: fErr } = await supabase.from("store_finance").update({ payout_phone: payoutPhone || null }).eq("store_id", store.id);
      if (fErr) toast.error(errorMessage(fErr));
    }
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Store updated");
    queryClient.invalidateQueries({ queryKey: ["my-store"] });
  };

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    const path = `${store.id}/branding/logo-${Date.now()}.${extensionOf(file)}`;
    const { error } = await supabase.storage.from("store-media").upload(path, file, { contentType: file.type });
    if (error) return toast.error(errorMessage(error));
    const { error: uErr } = await supabase.from("stores").update({ logo_path: path }).eq("id", store.id);
    if (uErr) return toast.error(errorMessage(uErr));
    queryClient.invalidateQueries({ queryKey: ["my-store"] });
    toast.success("Logo updated");
  };

  return (
    <div className="grid max-w-3xl gap-8">
      <PageHeader eyebrow="Settings" title="Store details">
        <Button variant="accent" onClick={save} loading={busy}>Save</Button>
      </PageHeader>
      <section className="grid gap-4 border border-rule bg-surface p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden border border-rule bg-sunk">
            {store.logo_path ? <img src={publicMediaUrl(store.logo_path)!} alt="" className="h-full w-full object-cover" /> : <span className="font-display text-3xl">{store.name[0]}</span>}
          </div>
          <Field label="Logo"><Input type="file" accept="image/*" onChange={(e) => uploadLogo(e.target.files?.[0])} className="h-auto py-2 file:mr-3 file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-paper" /></Field>
        </div>
        <Field label="Store name"><Input value={form.name} onChange={set("name")} /></Field>
        <Field label="About"><Textarea value={form.bio} onChange={set("bio")} maxLength={500} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instagram"><Input value={form.instagram_handle} onChange={set("instagram_handle")} /></Field>
          <Field label="TikTok"><Input value={form.tiktok_handle} onChange={set("tiktok_handle")} /></Field>
          <Field label="WhatsApp for orders"><Input value={form.whatsapp_phone} onChange={set("whatsapp_phone")} /></Field>
          <Field label="Location"><Input value={form.location} onChange={set("location")} /></Field>
        </div>
      </section>
      {store.role === "owner" && (
        <section className="grid gap-4 border border-rule bg-surface p-6">
          <h2 className="display text-[26px]">Payouts</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="M-Pesa number for payouts" className="sm:col-span-2"><Input type="tel" value={payoutPhone} onChange={(e) => setPayoutPhone(e.target.value)} placeholder="2547XXXXXXXX" /></Field>
            <div className="grid gap-1.5">
              <span className="label">Your referral cut</span>
              <span className="num flex h-11 items-center">{finance.data ? `${Math.round(Number(finance.data.referral_rate) * 100)}%` : "–"}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
