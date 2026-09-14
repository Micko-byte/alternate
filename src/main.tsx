import { createRoot } from "react-dom/client";
import App from "./App";
import { supabaseConfigured } from "@/integrations/supabase/client";
import "./index.css";

function SetupNeeded() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper p-6">
      <div className="grid max-w-lg gap-4">
        <img src="/brand/alternate-logo.png" alt="ALTERNATE" className="h-20 w-auto justify-self-start" />
        <h1 className="display text-[40px]">This site isn't connected to its database yet</h1>
        <p className="text-muted">
          Add <code className="num text-ink">VITE_SUPABASE_URL</code> and <code className="num text-ink">VITE_SUPABASE_PUBLISHABLE_KEY</code> (or connect the Supabase
          integration) in the hosting settings, then redeploy.
        </p>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(supabaseConfigured ? <App /> : <SetupNeeded />);
