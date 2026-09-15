// Polled by the checkout while the shopper completes M-Pesa or card, so credits appear immediately.
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import { confirmPayment } from "../_shared/paystack.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const user = await callerFrom(req, admin);
  if (!user) return json({ error: "Sign in to check your payment" }, 401);

  const { reference } = await req.json().catch(() => ({}));
  if (!reference) return json({ error: "Missing payment reference" }, 400);

  const { data: owned } = await admin
    .from("payments")
    .select("id")
    .eq("provider_reference", reference)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!owned) return json({ error: "Payment not found" }, 404);

  try {
    const result = await confirmPayment(admin, reference);
    return json(result);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Could not check the payment" }, 500);
  }
});
