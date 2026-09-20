import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  // NEXT_PUBLIC_* comes from the Vercel ↔ Supabase integration. Never add "SUPABASE_" here:
  // it would ship SUPABASE_SERVICE_ROLE_KEY and SUPABASE_JWT_SECRET to every browser.
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [react()],
  // The clothes parser worker loads the model on demand, which splits its code: only ES workers
  // can do that. A browser too old for them falls back to parsing on the page.
  worker: { format: "es" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
