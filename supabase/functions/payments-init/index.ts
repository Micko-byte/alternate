// Starts a payment for a credit pack or a monthly plan without leaving VAA ALTERNATE:
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

  const { pack_id, plan_id, method, phone } = await req.json().catch(() => ({}));
  if (method !== "mpesa" && method !== "card") return json({ error: "Choose M-Pesa or card" }, 400);

  const msisdn = method === "mpesa" ? kenyanPhone(phone) : null;
  if (method === "mpesa" && !msisdn) return json({ error: "Enter a Kenyan M-Pesa number, like 0712 345 678" }, 400);

  // What is being bought: a credit pack, or a month of a plan (its credits land when payment is confirmed)
  let item: { id: string; credits: number; price_kes: number; kind: "pack" | "plan" } | null = null;
  if (plan_id) {
    const { data: plan } = await admin.from("subscription_plans").select("id, monthly_credits, price_kes").eq("id", plan_id).eq("is_active", true).maybeSingle();
    if (plan) item = { id: plan.id, credits: plan.monthly_credits, price_kes: plan.price_kes, kind: "plan" };
    if (!item) return json({ error: "That plan isn't available" }, 404);
  } else {
    const { data: pack } = await admin
      .from("credit_packs")
      .select("id, credits, price_kes, first_purchase_only, available_until")
      .eq("id", pack_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!pack || (pack.available_until && new Date(pack.available_until) < new Date())) {
      return json({ error: "That credit pack isn't available" }, 404);
    }
    if (pack.first_purchase_only) {
      const { count } = await admin.from("payments").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "success");
      if (count) return json({ error: "The launch offer is for your first purchase. Pick another pack." }, 409);
    }
    item = { id: pack.id, credits: pack.credits, price_kes: pack.price_kes, kind: "pack" };
  }

  const reference = `ALT-${crypto.randomUUID()}`;
  const { error: insertError } = await admin.from("payments").insert({
    user_id: user.id,
    credit_pack_id: item.kind === "pack" ? item.id : null,
    subscription_plan_id: item.kind === "plan" ? item.id : null,
    credits: item.credits,
    amount_kes: item.price_kes,
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
    amount: item.price_kes * 100,
    currency: "KES",
    reference,
    metadata: { user_id: user.id, [item.kind === "plan" ? "plan_id" : "pack_id"]: item.id, credits: item.credits },
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
