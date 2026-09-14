import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useSetupStatus } from "@/lib/queries";
import { Spinner } from "@/components/ui";
import { captureReferral } from "@/lib/referral";
import { AppShell } from "@/components/AppShell";
import { StudioShell } from "@/components/StudioShell";
import { RequireAuth } from "@/components/Guards";
import Onboarding from "@/pages/Onboarding";
import Auth from "@/pages/Auth";
import Shop from "@/pages/Shop";
import Product from "@/pages/Product";
import StorePage from "@/pages/StorePage";
import Setup from "@/pages/Setup";
import FittingRoom from "@/pages/FittingRoom";
import TryResult from "@/pages/TryResult";
import Wardrobe from "@/pages/Wardrobe";
import Credits from "@/pages/Credits";
import Account from "@/pages/Account";
import Admin from "@/pages/Admin";
import Overview from "@/pages/studio/Overview";
import Products from "@/pages/studio/Products";
import ProductEditor from "@/pages/studio/ProductEditor";
import Settings from "@/pages/studio/Settings";
import Import from "@/pages/studio/Import";
import Review from "@/pages/studio/Review";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
});

function ReferralCapture() {
  const { search } = useLocation();
  useEffect(() => captureReferral(search), [search]);
  return null;
}

/** Signed out: the welcome carousel. Signed in: straight into the app. */
function Home() {
  const { user, loading } = useAuth();
  const setup = useSetupStatus();
  if (loading || (user && setup.loading)) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!user) return <Onboarding />;
  return <Navigate to={setup.ready ? "/fitting-room" : "/me/setup"} replace />;
}

function NotFound() {
  return (
    <div className="grid place-items-center gap-4 py-24 text-center">
      <p className="display text-[56px]">Not on the rail</p>
      <Link to="/shop" className="font-semibold underline decoration-accent underline-offset-4">Back to the shop</Link>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ReferralCapture />
          <Toaster
            position="top-center"
            toastOptions={{ classNames: { toast: "!rounded-none !border !border-ink !bg-surface !text-ink !font-sans !shadow-none", description: "!text-muted" } }}
          />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<AppShell />}>
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/:id" element={<Product />} />
              <Route path="/s/:slug" element={<StorePage />} />
              <Route path="/me/setup" element={<RequireAuth><Setup /></RequireAuth>} />
              <Route path="/fitting-room" element={<RequireAuth><FittingRoom /></RequireAuth>} />
              <Route path="/try/new" element={<Navigate to="/fitting-room" replace />} />
              <Route path="/try/:id" element={<RequireAuth><TryResult /></RequireAuth>} />
              <Route path="/wardrobe" element={<RequireAuth><Wardrobe /></RequireAuth>} />
              <Route path="/credits" element={<RequireAuth><Credits /></RequireAuth>} />
              <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
              <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route element={<RequireAuth><StudioShell /></RequireAuth>}>
              <Route path="/studio" element={<Overview />} />
              <Route path="/studio/products" element={<Products />} />
              <Route path="/studio/products/:id" element={<ProductEditor />} />
              <Route path="/studio/import" element={<Import />} />
              <Route path="/studio/review" element={<Review />} />
              <Route path="/studio/settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
