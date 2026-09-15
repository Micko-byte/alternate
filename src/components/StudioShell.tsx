import { NavLink, Outlet, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyStore } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Pill, Spinner } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import CreateStore from "@/pages/studio/CreateStore";

export function StudioShell() {
  const store = useMyStore();
  const reviewCount = useQuery({
    queryKey: ["review-count", store.data?.id],
    enabled: !!store.data,
    queryFn: async () => {
      const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.data!.id).eq("needs_review", true);
      return count ?? 0;
    },
  });

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Wordmark suffix="Studio" />
          {store.data && (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-muted">/</span>
              <span className="font-medium">{store.data.name}</span>
              <Pill tone={store.data.status === "active" ? "good" : store.data.status === "pending" ? "warn" : "bad"}>{store.data.status}</Pill>
            </div>
          )}
          <ThemeToggle className="ml-auto" />
          <Link to="/shop" className="text-[14px] font-medium text-muted hover:text-ink">Back to shop</Link>
        </div>
        {store.data && (
          <nav className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-5" aria-label="Studio">
            {[
              ["/studio", "Overview"],
              ["/studio/products", "Products"],
              ["/studio/import", "Import"],
              ["/studio/review", `Review${reviewCount.data ? ` (${reviewCount.data})` : ""}`],
              ["/studio/settings", "Settings"],
            ].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/studio"}
                className={({ isActive }) => cn("border-b-2 py-3 text-[14px] font-medium", isActive ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 md:py-10">
        {store.isLoading ? (
          <div className="grid place-items-center py-24"><Spinner /></div>
        ) : store.data ? (
          <Outlet context={store.data} />
        ) : (
          <CreateStore />
        )}
      </main>
    </div>
  );
}
