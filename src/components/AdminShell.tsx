import { NavLink, Navigate, Outlet, Link } from "react-router-dom";
import { useIsAdmin } from "@/lib/queries";
import { useIsOwner } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { Pill, Spinner } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";

const tabs = [
  ["/admin", "Overview"],
  ["/admin/users", "Users"],
  ["/admin/tryons", "Try-ons"],
  ["/admin/feedback", "Feedback"],
  ["/admin/reports", "Reports"],
  ["/admin/stores", "Stores"],
  ["/admin/settings", "Settings"],
] as const;

export function AdminShell() {
  const isAdmin = useIsAdmin();
  const isOwner = useIsOwner();

  if (isAdmin.isLoading) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;
  if (!isAdmin.data) return <Navigate to="/" replace />;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-rule bg-surface">
        <div className="page flex h-[72px] items-center gap-5">
          <Wordmark suffix="Admin" />
          <Pill tone={isOwner.data ? "ink" : "accent"}>{isOwner.data ? "Owner" : "Admin"}</Pill>
          <ThemeToggle className="ml-auto" />
          <Link to="/fitting-room" className="label hover:text-ink">Back to the app</Link>
        </div>
        <nav className="page flex gap-7 overflow-x-auto" aria-label="Admin">
          {tabs.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin"}
              className={({ isActive }) => cn("shrink-0 border-b-2 py-3 font-mono text-[12px] font-semibold uppercase tracking-label", isActive ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="page py-10 md:py-12">
        <Outlet />
      </main>
    </div>
  );
}
