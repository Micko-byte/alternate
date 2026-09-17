import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEPARTMENTS, sizeText } from "@/lib/sizes";
import { CATEGORY_SINGULAR, errorMessage, kes, publicMediaUrl } from "@/lib/utils";
import { Button, ButtonLink, Empty, Input, PageHeader, Pill, Spinner } from "@/components/ui";
import { useStore } from "./types";

export default function Review() {
  const store = useStore();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string>();

  const queue = useQuery({
    queryKey: ["review-queue", store.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, department, price_kes, description, is_one_of_a_kind, source_caption, ai_draft, created_at, product_media(storage_path, kind, position, is_tryon_source), product_variants(id, size_label, size_system, size_min, size_max, stock_qty)")
        .eq("store_id", store.id)
        .eq("needs_review", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    queryClient.invalidateQueries({ queryKey: ["review-count"] });
    queryClient.invalidateQueries({ queryKey: ["studio-products"] });
  };

  const readyToList = (p: NonNullable<typeof queue.data>[number]) => p.price_kes > 0 && p.product_variants.length > 0 && p.name !== "Importing…";

  const listIt = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from("products").update({ status: "active", needs_review: false }).eq("id", id);
    setBusy(undefined);
    if (error) return toast.error(errorMessage(error));
    // Photo check, so shoppers' screenshots can be matched to this piece
    void supabase.functions.invoke("inspect-garment", { body: { product_id: id } });
    refresh();
  };

  const listAllReady = async () => {
    const ids = (queue.data ?? []).filter(readyToList).map((p) => p.id);
    if (!ids.length) return;
    setBusy("all");
    const { error } = await supabase.from("products").update({ status: "active", needs_review: false }).in("id", ids);
    setBusy(undefined);
    if (error) return toast.error(errorMessage(error));
    toast.success(`${ids.length} pieces listed`);
    for (const id of ids) void supabase.functions.invoke("inspect-garment", { body: { product_id: id } });
    refresh();
  };

  const setPrice = async (id: string, value: string) => {
    const price = Math.max(0, Math.round(Number(value) || 0));
    const { error } = await supabase.from("products").update({ price_kes: price }).eq("id", id);
    if (error) return toast.error(errorMessage(error));
    refresh();
  };

  const remove = async (id: string, media: { storage_path: string }[]) => {
    if (!window.confirm("Delete this imported piece?")) return;
    await supabase.storage.from("store-media").remove(media.map((m) => m.storage_path));
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(errorMessage(error));
    refresh();
  };

  if (queue.isLoading) return <div className="grid place-items-center py-24"><Spinner /></div>;
  const items = queue.data ?? [];
  const ready = items.filter(readyToList).length;

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Review" title={items.length ? `${items.length} to check` : "All checked"}>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/studio/import" variant="outline">Import more</ButtonLink>
          {ready > 0 && <Button variant="solid" onClick={listAllReady} loading={busy === "all"}>List {ready} ready</Button>}
        </div>
      </PageHeader>

      {!items.length ? (
        <Empty title="Nothing waiting">Imported pieces appear here so you can check the price and sizes before shoppers see them.</Empty>
      ) : (
        <div className="grid gap-4">
          {items.map((p) => {
            const images = p.product_media.filter((m) => m.kind === "image").sort((a, b) => Number(b.is_tryon_source) - Number(a.is_tryon_source) || a.position - b.position);
            const ok = readyToList(p);
            return (
              <article key={p.id} className="grid gap-5 border border-rule bg-surface p-4 sm:grid-cols-[160px_1fr] md:grid-cols-[180px_1fr_auto]">
                <div className="aspect-[3/4] overflow-hidden bg-sunk">
                  {images[0] && <img src={publicMediaUrl(images[0].storage_path)!} alt="" className="h-full w-full object-cover" />}
                </div>

                <div className="grid content-start gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Pill>{DEPARTMENTS.find((d) => d.value === p.department)?.label}</Pill>
                    <Pill>{CATEGORY_SINGULAR[p.category]}</Pill>
                    {p.is_one_of_a_kind && <Pill tone="warn">One of a kind</Pill>}
                    {!p.ai_draft && <Pill tone="bad">No AI draft</Pill>}
                  </div>
                  <h2 className="display text-[30px]">{p.name}</h2>
                  {p.description && <p className="max-w-[60ch] text-[14px] text-muted">{p.description}</p>}

                  <div className="flex flex-wrap items-end gap-6">
                    <label className="grid gap-1">
                      <span className={p.price_kes > 0 ? "label" : "label text-bad"}>{p.price_kes > 0 ? "Price" : "Add a price"}</span>
                      <Input type="number" min={0} defaultValue={p.price_kes || ""} placeholder="KES" onBlur={(e) => e.target.value !== String(p.price_kes) && setPrice(p.id, e.target.value)} className="num h-10 w-32" />
                    </label>
                    <div className="grid gap-1">
                      <span className={p.product_variants.length ? "label" : "label text-bad"}>{p.product_variants.length ? "Sizes · stock" : "Add sizes"}</span>
                      <div className="flex flex-wrap gap-1">
                        {p.product_variants.length ? (
                          p.product_variants.map((v) => (
                            <span key={v.id} className="num border border-rule px-2 py-1 text-[12px]">
                              {v.size_min == null ? v.size_label : sizeText(v.size_system, v.size_min) + (v.size_max !== v.size_min ? `–${sizeText(v.size_system, v.size_max)}` : "")} · {v.stock_qty}
                            </span>
                          ))
                        ) : (
                          <span className="text-[13px] text-muted">None found in the caption</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {p.source_caption && (
                    <details className="text-[13px] text-muted">
                      <summary className="label cursor-pointer">Your caption</summary>
                      <p className="mt-2 whitespace-pre-wrap">{p.source_caption}</p>
                    </details>
                  )}
                </div>

                <div className="flex flex-wrap content-start gap-2 sm:col-span-2 md:col-span-1 md:grid md:w-40">
                  <Button variant="solid" onClick={() => listIt(p.id)} loading={busy === p.id} disabled={!ok} title={ok ? "" : "Add a price and at least one size first"}>
                    List it{ok && p.price_kes ? ` · ${kes(p.price_kes)}` : ""}
                  </Button>
                  <ButtonLink to={`/studio/products/${p.id}?from=review`} variant="outline">Edit details</ButtonLink>
                  <Button variant="ghost" onClick={() => remove(p.id, p.product_media)}>Delete</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Link to="/studio/products" className="label text-ink underline underline-offset-4">All products</Link>
    </div>
  );
}
