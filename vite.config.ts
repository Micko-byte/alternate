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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
