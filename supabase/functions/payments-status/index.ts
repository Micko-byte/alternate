// Admins only: whether payments are on, and whether they take real money (live key) or are in test mode.
// Never returns the key itself.
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import { PAYSTACK_API, paystackKey } from "../_shared/paystack.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const user = await callerFrom(req, admin);
  if (!user) return json({ error: "Sign in first" }, 401);
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) return json({ error: "Admins only" }, 403);

  const key = paystackKey();
  if (!key) return json({ configured: false, mode: null, key_works: false });
  const mode = key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : "unknown";

  // A cheap authenticated call to confirm Paystack accepts the key
  const res = await fetch(`${PAYSTACK_API}/transaction?perPage=1`, { headers: { Authorization: `Bearer ${key}` } });
  const [{ count: attempted }, { count: paid }] = await Promise.all([
    admin.from("payments").select("id", { count: "exact", head: true }),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "success"),
  ]);
  return json({ configured: true, mode, key_works: res.ok, payments_attempted: attempted ?? 0, payments_paid: paid ?? 0 });
});
