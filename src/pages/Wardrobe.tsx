import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ButtonLink, Empty, PageHeader, Pill, Spinner } from "@/components/ui";

export default function Wardrobe() {
  const { user } = useAuth();

  const tryons = useQuery({
    queryKey: ["wardrobe", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tryons")
        .select("id, status, quality, result_path, created_at, products(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const paths = (data ?? []).map((t) => t.result_path).filter(Boolean) as string[];
      const signed = paths.length ? (await supabase.storage.from("tryon-results").createSignedUrls(paths, 3600)).data ?? [] : [];
      const urlByPath = Object.fromEntries(signed.map((s) => [s.path, s.signedUrl]));
      return (data ?? []).map((t) => ({ ...t, url: t.result_path ? urlByPath[t.result_path] : null }));
    },
  });

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Wardrobe" title="Everything you've tried on">
        <ButtonLink to="/shop" variant="outline">Find more</ButtonLink>
      </PageHeader>
      {tryons.isLoading ? (
        <div className="grid place-items-center py-24"><Spinner /></div>
      ) : !tryons.data?.length ? (
        <Empty title="Nothing tried on yet">Pick something in your size from the shop, or try on a screenshot.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
          {tryons.data.map((t) => (
            <Link key={t.id} to={`/try/${t.id}`} className="group grid gap-2">
              <div className="relative aspect-[2/3] overflow-hidden bg-sunk">
                {t.url ? <img src={t.url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center font-display text-muted">{t.status === "failed" ? "Refunded" : "Fitting…"}</div>}
                {t.status !== "succeeded" && <Pill tone={t.status === "failed" ? "bad" : "accent"} className="absolute left-2 top-2">{t.status}</Pill>}
              </div>
              <span className="text-[14px] font-medium group-hover:underline group-hover:decoration-accent group-hover:underline-offset-4">{t.products?.name ?? "Screenshot try-on"}</span>
              <span className="num text-[12px] text-muted">{new Date(t.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
