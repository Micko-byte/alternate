import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_SINGULAR, errorMessage, kes, publicMediaUrl } from "@/lib/utils";
import { Button, ButtonLink, Empty, Notice, PageHeader, Pill, Select, Spinner } from "@/components/ui";
import { useStore } from "./types";

const STATUS_TONE = { active: "good", draft: "neutral", sold_out: "ink", archived: "neutral" } as const;

export default function Products() {
  const store = useStore();
  const products = useQuery({
    queryKey: ["studio-products", store.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, price_kes, status, needs_review, updated_at, product_media(kind, storage_path, position, is_tryon_source), product_variants(id, size_label, stock_qty)")
        .eq("store_id", store.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Products" title="Your rail">
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/studio/import" variant="outline">Import many</ButtonLink>
          <ButtonLink to="/studio/products/new" variant="solid">Add a piece</ButtonLink>
        </div>
      </PageHeader>
      {(products.data ?? []).some((p) => p.needs_review) && (
        <Notice tone="accent" title={`${(products.data ?? []).filter((p) => p.needs_review).length} imported pieces to check`} action={<ButtonLink to="/studio/review" variant="solid" size="sm">Review</ButtonLink>}>
          Check the price and sizes the AI wrote, then list them.
        </Notice>
      )}
      {products.isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : !products.data?.length ? (
        <Empty title="No pieces yet">Add your first piece with photos or a video, its sizes and stock.</Empty>
      ) : (
        <div className="overflow-x-auto border border-rule bg-surface">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead className="bg-sunk">
              <tr>
                {["Piece", "Status", "Stock", "Try-on photo", "Price", ""].map((h, i) => (
                  <th key={h || "actions"} className={`label px-4 py-2.5 font-normal ${i >= 4 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.data.map((p) => {
                const images = p.product_media.filter((m) => m.kind === "image").sort((a, b) => a.position - b.position);
                const stock = p.product_variants.reduce((s, v) => s + v.stock_qty, 0);
                const hasSource = images.length > 0;
                return (
                  <tr key={p.id} className="border-t border-rule hover:bg-paper">
                    <td className="px-4 py-3">
                      <Link to={`/studio/products/${p.id}`} className="flex items-center gap-3">
                        <span className="h-14 w-11 shrink-0 overflow-hidden bg-sunk">{images[0] && <img src={publicMediaUrl(images[0].storage_path)!} alt="" className="h-full w-full object-cover" />}</span>
                        <span className="grid">
                          <span className="font-medium hover:underline">{p.name}</span>
                          <span className="text-[12.5px] capitalize text-muted">{CATEGORY_SINGULAR[p.category]}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><Pill tone={p.needs_review ? "warn" : STATUS_TONE[p.status]}>{p.needs_review ? "to review" : p.status.replace("_", " ")}</Pill></td>
                    <td className="num px-4 py-3">{stock}</td>
                    <td className="px-4 py-3">{hasSource ? <Pill tone="good">Ready</Pill> : <Pill tone="warn">Add a photo</Pill>}</td>
                    <td className="num px-4 py-3 text-right">{kes(p.price_kes)}</td>
                    <td className="px-4 py-3 text-right">
                      <SoldButton variants={p.product_variants} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** One tap when a piece sells: takes 1 off that size. At 0 stock everywhere it shows as sold out. */
function SoldButton({ variants }: { variants: { id: string; size_label: string; stock_qty: number }[] }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const inStock = variants.filter((v) => v.stock_qty > 0);
  if (!inStock.length) return <span className="label">Sold out</span>;

  const sell = async (variantId: string) => {
    const v = inStock.find((x) => x.id === variantId);
    if (!v) return;
    setBusy(true);
    const { error } = await supabase.from("product_variants").update({ stock_qty: v.stock_qty - 1 }).eq("id", v.id).eq("stock_qty", v.stock_qty);
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`Sold one ${v.size_label}. ${v.stock_qty - 1} left.`);
    queryClient.invalidateQueries({ queryKey: ["studio-products"] });
  };

  if (inStock.length === 1)
    return (
      <Button size="sm" variant="outline" loading={busy} onClick={() => sell(inStock[0].id)}>
        Sold
      </Button>
    );
  return (
    <Select aria-label="Mark a size as sold" value="" disabled={busy} onChange={(e) => sell(e.target.value)} className="h-9 w-32 font-mono text-[11px] uppercase">
      <option value="">Sold…</option>
      {inStock.map((v) => (
        <option key={v.id} value={v.id}>
          {v.size_label} ({v.stock_qty})
        </option>
      ))}
    </Select>
  );
}
