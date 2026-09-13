// Starts an M-Pesa / card payment for a credit pack through Paystack.
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import { PAYSTACK_API, paystackKey } from "../_shared/paystack.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const user = await callerFrom(req, admin);
  if (!user) return json({ error: "Sign in to buy credits" }, 401);

  const key = paystackKey();
  if (!key) return json({ error: "Payments aren't switched on yet. Ask an admin for test credits." }, 503);

  const { pack_id, return_url } = await req.json().catch(() => ({}));
  const { data: pack } = await admin
    .from("credit_packs")
    .select("id, name, credits, price_kes")
    .eq("id", pack_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!pack) return json({ error: "That credit pack isn't available" }, 404);

  let callback: string | undefined;
  try {
    const url = new URL(return_url);
    if (url.protocol === "https:" || url.hostname === "localhost") callback = url.toString();
  } catch {
    callback = undefined;
  }

  const reference = `ALT-${crypto.randomUUID()}`;
  const { error: insertError } = await admin.from("payments").insert({
    user_id: user.id,
    credit_pack_id: pack.id,
    credits: pack.credits,
    amount_kes: pack.price_kes,
    provider_reference: reference,
  });
  if (insertError) return json({ error: insertError.message }, 500);

  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: user.email,
      amount: pack.price_kes * 100,
      currency: "KES",
      reference,
      channels: ["mobile_money", "card"],
      callback_url: callback,
      metadata: { user_id: user.id, pack_id: pack.id, credits: pack.credits },
    }),
  });
  const body = await res.json();
  if (!res.ok || !body?.data?.authorization_url) {
    await admin.from("payments").update({ status: "failed" }).eq("provider_reference", reference);
    return json({ error: body?.message ?? "Paystack could not start the payment" }, 502);
  }

  return json({ authorization_url: body.data.authorization_url, reference });
});
