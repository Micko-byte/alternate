import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { Shirt, ShoppingBag, Sparkles, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCredits, useMyStore } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/Wordmark";

const nav = [
  { to: "/shop", label: "New in" },
  { to: "/shop?d=women", label: "Women" },
  { to: "/shop?d=men", label: "Men" },
  { to: "/fitting-room", label: "Fitting room" },
  { to: "/wardrobe", label: "Wardrobe" },
];

const announcements = ["KES 50 for 4 try-ons · pay with M-Pesa", "Your face is never changed", "Fitted to baggy, in your real size", "Womenswear & menswear", "Made in Nairobi"];

export function AppShell() {
  const { user } = useAuth();
  const credits = useCredits();
  const store = useMyStore();
  const { pathname, search } = useLocation();
  const fullBleed = pathname === "/";

  return (
    <div className="flex min-h-dvh flex-col pb-16 md:pb-0">
      <div className="overflow-hidden bg-accent text-white" aria-label="Announcements">
        <div className="flex w-max animate-marquee gap-12 py-2 motion-reduce:animate-none">
          {[...announcements, ...announcements].map((a, i) => (
            <span key={i} className="font-mono text-[11px] font-semibold uppercase tracking-label" aria-hidden={i >= announcements.length}>
              {a}
            </span>
          ))}
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="page flex h-[72px] items-center gap-10">
          <Wordmark />
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
            {nav.map((l) => {
              const active = l.to.includes("?") ? pathname + search === l.to : pathname === l.to && !search;
              return (
                <Link key={l.to} to={l.to} className={cn("font-mono text-[12px] font-semibold uppercase tracking-label transition-colors hover:text-ink", active ? "text-ink" : "text-muted")}>
                  {l.label}
                </Link>
              );
            })}
            <Link to="/studio" className="font-mono text-[12px] font-semibold uppercase tracking-label text-muted hover:text-ink">
              {store.data ? "Studio" : "For stores"}
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {user ? (
              <>
                <Link to="/credits" className="mr-2 flex items-baseline gap-1.5 px-2 py-1 hover:underline" aria-label={`${credits.data ?? 0} credits`}>
                  <span className="num text-[15px] font-medium">{credits.data ?? "–"}</span>
                  <span className="label">credits</span>
                </Link>
                <NavLink to="/wardrobe" className="hidden h-10 w-10 place-items-center hover:bg-sunk md:grid" aria-label="Wardrobe">
                  <Shirt className="h-[18px] w-[18px]" strokeWidth={1.6} />
                </NavLink>
                <NavLink to="/account" className="hidden h-10 w-10 place-items-center hover:bg-sunk md:grid" aria-label="Your account">
                  <User className="h-[18px] w-[18px]" strokeWidth={1.6} />
                </NavLink>
              </>
            ) : (
              <>
                <Link to="/auth" className="font-mono text-[12px] font-semibold uppercase tracking-label text-muted hover:text-ink">
                  Sign in
                </Link>
                <Link to="/auth?mode=signup" className="ml-5 hidden h-10 items-center bg-ink px-4 font-mono text-[11px] font-semibold uppercase tracking-label text-paper hover:bg-ink/85 sm:inline-flex">
                  Join
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={cn("flex-1", !fullBleed && "page py-10 md:py-14")}>
        <Outlet />
      </main>

      <footer className="border-t border-rule bg-paper">
        <div className="page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="grid content-start gap-4">
            <Wordmark full className="justify-self-start" />
            <p className="max-w-[34ch] text-muted">See clothes from Kenyan stores on your own photo, in your size, before you pay.</p>
          </div>
          {[
            ["Shop", [["New in", "/shop"], ["Women", "/shop?d=women"], ["Men", "/shop?d=men"], ["Fitting room", "/fitting-room"]]],
            ["Your account", [["Wardrobe", "/wardrobe"], ["Credits", "/credits"], ["Privacy & data", "/account"]]],
            ["Stores", [["Sell on ALTERNATE", "/studio"], ["Store Studio", "/studio"]]],
          ].map(([head, links]) => (
            <div key={head as string} className="grid content-start gap-3">
              <h2 className="label text-ink">{head as string}</h2>
              {(links as string[][]).map(([label, to]) => (
                <Link key={label} to={to} className="text-[14px] text-muted hover:text-ink">
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="page flex flex-wrap items-center justify-between gap-3 border-t border-rule py-5">
          <span className="label">© 2026 ALTERNATE. All rights reserved.</span>
          <span className="label">Nairobi, Kenya · KES</span>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
        {[
          { to: "/shop", label: "Shop", icon: ShoppingBag },
          { to: "/fitting-room", label: "Fitting", icon: Sparkles },
          { to: "/wardrobe", label: "Wardrobe", icon: Shirt },
          { to: "/account", label: "Account", icon: User },
        ].map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => cn("grid place-items-center gap-1 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-label text-muted", isActive && "text-ink")}>
            <l.icon className="h-5 w-5" strokeWidth={1.6} aria-hidden />
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
