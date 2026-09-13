import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PRODUCT_SELECT, fitFor, useSizes } from "@/lib/queries";
import { CATEGORY_LABELS, cn } from "@/lib/utils";
import { Empty, PageHeader, Spinner } from "@/components/ui";
import { ProductCard, type ProductWithRelations } from "@/components/ProductCard";

export default function Shop() {
  const { user } = useAuth();
  const sizes = useSizes();
  const [params, setParams] = useSearchParams();
  const category = params.get("c") ?? "all";
  const department = params.get("d") ?? "all";
  const setFilter = (key: "c" | "d", value: string) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const setCategory = (c: string) => setFilter("c", c);
  const [onlyMine, setOnlyMine] = useState(false);

  const products = useQuery({
    queryKey: ["shop-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .in("status", ["active", "sold_out"])
        .eq("stores.status", "active")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ProductWithRelations[];
    },
  });

  const categories = useMemo(() => Array.from(new Set((products.data ?? []).map((p) => p.category))), [products.data]);

  const visible = (products.data ?? []).filter((p) => {
    if (department !== "all" && p.department !== department && p.department !== "unisex") return false;
    if (category !== "all" && p.category !== category) return false;
    if (onlyMine) return fitFor(p.product_variants, sizes.data, p.category).state === "fits";
    return true;
  });

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow={category === "all" ? "New in" : CATEGORY_LABELS[category] ?? category} title={department === "men" ? "Menswear" : department === "women" ? "Womenswear" : "Shop Nairobi's stores"}>
        {user && (
          <label className="flex cursor-pointer items-center gap-3 text-[14px] font-medium">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="h-4 w-4 accent-[#222A41]" />
            Only pieces in my size
          </label>
        )}
      </PageHeader>

      <div className="flex gap-6 border-b border-rule" role="tablist" aria-label="Department">
        {[["all", "Everyone"], ["women", "Women"], ["men", "Men"]].map(([value, label]) => (
          <button key={value} role="tab" aria-selected={department === value} onClick={() => setFilter("d", value)} className={cn("-mb-px border-b-2 pb-3 font-mono text-[12px] font-semibold uppercase tracking-label", department === value ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}>
            {label}
          </button>
        ))}
      </div>

      {(categories.length > 1 || category !== "all") && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
          {["all", ...categories].map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={cn("h-9 shrink-0 border px-4 font-mono text-[11px] font-semibold uppercase tracking-label", category === c ? "border-ink bg-ink text-paper" : "border-rule bg-surface text-muted hover:border-ink hover:text-ink")}
            >
              {c === "all" ? "Everything" : CATEGORY_LABELS[c] ?? c}
            </button>
          ))}
        </div>
      )}

      {products.isLoading ? (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      ) : visible.length === 0 ? (
        <Empty title={onlyMine ? "Nothing in your size yet" : "The rail is empty"}>
          {onlyMine ? (
            "Turn off the size filter to see everything, or check back as stores add stock."
          ) : (
            <>
              Stores are still setting up. Sell clothes? <Link to="/studio" className="font-semibold text-ink underline decoration-accent underline-offset-4">Open your store</Link>.
            </>
          )}
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} sizes={sizes.data} signedIn={!!user} />
          ))}
        </div>
      )}
    </div>
  );
}
