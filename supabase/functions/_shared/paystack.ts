import type { SupabaseClient } from "npm:@supabase/supabase-js@2.88.0";

export const PAYSTACK_API = "https://api.paystack.co";

export function paystackKey(): string | null {
  return Deno.env.get("PAYSTACK_SECRET_KEY") ?? null;
}

/**
 * Confirms a reference with Paystack and, if it is paid in full, credits the shopper.
 * Safe to call more than once: complete_payment() only credits a pending payment.
 */
export async function confirmPayment(admin: SupabaseClient, reference: string) {
  const key = paystackKey();
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set on the server");

  const { data: payment } = await admin
    .from("payments")
    .select("id, user_id, amount_kes, status")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (!payment) return { status: "not_found" as const, payment: null };
  if (payment.status !== "pending") return { status: payment.status, payment };

  const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.json();
  const tx = body?.data;

  if (!res.ok || !tx) return { status: "pending" as const, payment };

  if (tx.status === "success") {
    if (tx.currency !== "KES" || Number(tx.amount) !== payment.amount_kes * 100) {
      await admin.from("payments").update({ status: "failed", metadata: { mismatch: { currency: tx.currency, amount: tx.amount } } }).eq("id", payment.id);
      return { status: "failed" as const, payment };
    }
    const { data: completed, error } = await admin.rpc("complete_payment", { _provider_reference: reference });
    if (error) throw new Error(error.message);
    return { status: "success" as const, payment: completed };
  }

  if (tx.status === "failed" || tx.status === "abandoned" || tx.status === "reversed") {
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "pending");
    return { status: "failed" as const, payment };
  }

  return { status: "pending" as const, payment };
}
