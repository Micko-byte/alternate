import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage, slugify } from "@/lib/utils";
import { Button, Field, Input, Textarea } from "@/components/ui";

export default function CreateStore() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", slug: "", instagram_handle: "", tiktok_handle: "", whatsapp_phone: "", location: "", bio: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value, ...(k === "name" && !slugTouched ? { slug: slugify(value) } : {}) }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("stores").insert({
      name: form.name.trim(),
      slug: form.slug,
      instagram_handle: form.instagram_handle.replace(/^@/, "") || null,
      tiktok_handle: form.tiktok_handle.replace(/^@/, "") || null,
      whatsapp_phone: form.whatsapp_phone || null,
      location: form.location || null,
      bio: form.bio || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message.includes("stores_slug_key") ? "That store link is taken. Try another." : errorMessage(error));
    toast.success("Store created. We'll review it shortly.");
    queryClient.invalidateQueries({ queryKey: ["my-store"] });
  };

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
      <div className="grid content-start gap-5">
        <span className="label text-accent">For stores</span>
        <h1 className="display text-[clamp(38px,6vw,64px)]">Open your store on VAA ALTERNATE</h1>
        <ul className="grid gap-3 text-muted">
          <li><strong className="text-ink">Free to list.</strong> Photos or videos, sizes and stock, for women or men.</li>
          <li><strong className="text-ink">Earn 20%</strong> of credits bought by shoppers who join through your link.</li>
          <li><strong className="text-ink">Fewer “does it fit?” DMs.</strong> Shoppers only see pieces in their size.</li>
        </ul>
      </div>
      <form onSubmit={submit} className="grid gap-4 border border-rule bg-surface p-6">
        <Field label="Store name"><Input required minLength={2} value={form.name} onChange={set("name")} placeholder="Wanjiru's Closet" /></Field>
        <Field label="Store link" hint={`alternate.co.ke/s/${form.slug || "your-store"}`}>
          <Input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: slugify(e.target.value) }); }} className="num" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instagram"><Input value={form.instagram_handle} onChange={set("instagram_handle")} placeholder="@yourstore" /></Field>
          <Field label="TikTok"><Input value={form.tiktok_handle} onChange={set("tiktok_handle")} placeholder="@yourstore" /></Field>
          <Field label="WhatsApp for orders"><Input type="tel" value={form.whatsapp_phone} onChange={set("whatsapp_phone")} placeholder="2547XXXXXXXX" /></Field>
          <Field label="Location"><Input value={form.location} onChange={set("location")} placeholder="Ngara, Nairobi" /></Field>
        </div>
        <Field label="About the store"><Textarea value={form.bio} onChange={set("bio")} maxLength={500} /></Field>
        <Button type="submit" variant="accent" size="lg" loading={busy}>Create store</Button>
      </form>
    </div>
  );
}
