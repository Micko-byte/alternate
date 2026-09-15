// Starts a credit-pack payment without leaving ALTERNATE:
//  - method "mpesa": Paystack Charge API sends an M-Pesa STK prompt to the shopper's phone
//  - method "card":  returns an access code for Paystack's secure card window (InlineJS) over our page
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import { PAYSTACK_API, kenyanPhone, paystackKey } from "../_shared/paystack.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const user = await callerFrom(req, admin);
  if (!user) return json({ error: "Sign in to buy credits" }, 401);

  const key = paystackKey();
  if (!key) return json({ error: "Payments aren't switched on yet. Ask an admin for test credits." }, 503);

  const { pack_id, method, phone } = await req.json().catch(() => ({}));
  if (method !== "mpesa" && method !== "card") return json({ error: "Choose M-Pesa or card" }, 400);

  const msisdn = method === "mpesa" ? kenyanPhone(phone) : null;
  if (method === "mpesa" && !msisdn) return json({ error: "Enter a Kenyan M-Pesa number, like 0712 345 678" }, 400);

  const { data: pack } = await admin
    .from("credit_packs")
    .select("id, name, credits, price_kes")
    .eq("id", pack_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!pack) return json({ error: "That credit pack isn't available" }, 404);

  const reference = `ALT-${crypto.randomUUID()}`;
  const { error: insertError } = await admin.from("payments").insert({
    user_id: user.id,
    credit_pack_id: pack.id,
    credits: pack.credits,
    amount_kes: pack.price_kes,
    provider_reference: reference,
    metadata: { method, phone_last4: msisdn ? msisdn.slice(-4) : null },
  });
  if (insertError) return json({ error: insertError.message }, 500);

  const fail = async (message: string, status = 502) => {
    await admin.from("payments").update({ status: "failed", metadata: { method, error: message } }).eq("provider_reference", reference);
    return json({ error: message }, status);
  };

  const common = {
    email: user.email,
    amount: pack.price_kes * 100,
    currency: "KES",
    reference,
    metadata: { user_id: user.id, pack_id: pack.id, credits: pack.credits },
  };

  if (method === "mpesa") {
    const res = await fetch(`${PAYSTACK_API}/charge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...common, mobile_money: { phone: msisdn, provider: "mpesa" } }),
    });
    const body = await res.json();
    const data = body?.data;
    if (!res.ok || !data) return fail(body?.message ?? "Paystack couldn't send the M-Pesa prompt");
    if (data.status === "failed") return fail(data.message || data.gateway_response || "M-Pesa declined the request", 402);
    return json({
      reference,
      method,
      status: data.status, // usually "pay_offline" while the prompt is on the phone
      display_text: data.display_text ?? "Check your phone and enter your M-Pesa PIN",
    });
  }

  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...common, channels: ["card"] }),
  });
  const body = await res.json();
  if (!res.ok || !body?.data?.access_code) return fail(body?.message ?? "Paystack couldn't start the card payment");
  return json({ reference, method, access_code: body.data.access_code });
});
