import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PRODUCT_SELECT, useSizes } from "@/lib/queries";
import { publicMediaUrl } from "@/lib/utils";
import { Empty, Notice, Spinner } from "@/components/ui";
import { ProductCard, type ProductWithRelations } from "@/components/ProductCard";

export default function StorePage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const sizes = useSizes();

  const store = useQuery({
    queryKey: ["store", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").eq("slug", slug!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const products = useQuery({
    queryKey: ["store-products", store.data?.id],
    enabled: !!store.data,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("store_id", store.data!.id)
        .in("status", ["active", "sold_out"])
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as ProductWithRelations[];
    },
  });

  if (store.isLoading) return <div className="grid place-items-center py-24"><Spinner /></div>;
  if (!store.data) return <Notice title="Store not found">Check the link, or the store may not be open yet.</Notice>;
  const s = store.data;

  return (
    <div className="grid gap-10">
      <header className="grid items-end gap-6 border-b border-rule pb-8 md:grid-cols-[auto_1fr]">
        <div className="grid h-24 w-24 place-items-center overflow-hidden border border-rule bg-surface">
          {s.logo_path ? <img src={publicMediaUrl(s.logo_path)!} alt="" className="h-full w-full object-cover" /> : <span className="font-display text-4xl">{s.name[0]}</span>}
        </div>
        <div className="grid gap-2">
          <span className="label text-accent">{s.location || "Kenya"}</span>
          <h1 className="display text-[clamp(36px,6vw,64px)]">{s.name}</h1>
          {s.bio && <p className="max-w-[60ch] text-muted">{s.bio}</p>}
          <div className="flex flex-wrap gap-4 text-[14px] font-medium">
            {s.instagram_handle && <a className="underline decoration-accent underline-offset-4" href={`https://instagram.com/${s.instagram_handle.replace(/^@/, "")}`} target="_blank" rel="noreferrer">Instagram</a>}
            {s.tiktok_handle && <a className="underline decoration-accent underline-offset-4" href={`https://tiktok.com/@${s.tiktok_handle.replace(/^@/, "")}`} target="_blank" rel="noreferrer">TikTok</a>}
          </div>
        </div>
      </header>
      {s.status !== "active" && <Notice tone="warn" title="This store isn't open to shoppers yet">Only the store team can see this page until VAA ALTERNATE approves it.</Notice>}
      {products.data?.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {products.data.map((p) => <ProductCard key={p.id} product={p} sizes={sizes.data} signedIn={!!user} />)}
        </div>
      ) : (
        <Empty title="No pieces listed yet" />
      )}
    </div>
  );
}
