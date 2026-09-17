import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/lib/theme";
import { supabaseConfigured } from "@/integrations/supabase/client";
import { registerServiceWorker } from "@/lib/install";
import "./index.css";

function SetupNeeded() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper p-6">
      <div className="grid max-w-lg gap-4">
        <img src="/brand/alternate-logo.png" alt="ALTERNATE" className="h-20 w-auto justify-self-start dark:hidden" />
        <img src="/brand/alternate-logo-white.png" alt="" aria-hidden className="hidden h-20 w-auto justify-self-start dark:block" />
        <h1 className="display text-[40px]">This site isn't connected to its database yet</h1>
        <p className="text-muted">
          Add <code className="num text-ink">VITE_SUPABASE_URL</code> and <code className="num text-ink">VITE_SUPABASE_PUBLISHABLE_KEY</code> (or connect the Supabase
          integration) in the hosting settings, then redeploy.
        </p>
      </div>
    </main>
  );
}

registerServiceWorker();

window.addEventListener("vite:preloadError", (event) => {
  const key = "alternate-reloaded-for-update";
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<ThemeProvider>{supabaseConfigured ? <App /> : <SetupNeeded />}</ThemeProvider>);
