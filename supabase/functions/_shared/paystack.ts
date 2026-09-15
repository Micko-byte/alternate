import type { SupabaseClient } from "npm:@supabase/supabase-js@2.88.0";

export const PAYSTACK_API = "https://api.paystack.co";

export function paystackKey(): string | null {
  return Deno.env.get("PAYSTACK_SECRET_KEY") ?? null;
}

/** 0712 345 678 / 712345678 / +254712345678 → +254712345678, or null if not a Kenyan mobile number. */
export function kenyanPhone(input: string): string | null {
  const digits = String(input ?? "").replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("254")) local = local.slice(3);
  if (local.startsWith("0")) local = local.slice(1);
  return /^[17]\d{8}$/.test(local) ? `+254${local}` : null;
}

/**
 * Checks a reference with Paystack and credits the shopper once it is paid in full.
 * Safe to call repeatedly (polling, webhook, callback): complete_payment() only credits once.
 * "abandoned" is treated as still pending, because M-Pesa prompts can take a while.
 */
export async function confirmPayment(admin: SupabaseClient, reference: string) {
  const key = paystackKey();
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set on the server");

  const { data: payment } = await admin
    .from("payments")
    .select("id, user_id, amount_kes, credits, status")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (!payment) return { status: "not_found" as const, message: null };
  if (payment.status === "success") return { status: "success" as const, message: null };

  const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.json();
  const tx = body?.data;
  if (!res.ok || !tx) return { status: "pending" as const, message: null };

  if (tx.status === "success") {
    if (tx.currency !== "KES" || Number(tx.amount) !== payment.amount_kes * 100) {
      await admin.from("payments").update({ status: "failed", metadata: { mismatch: { currency: tx.currency, amount: tx.amount } } }).eq("id", payment.id);
      return { status: "failed" as const, message: "The amount paid didn't match the pack price." };
    }
    // A slow payment that was marked failed can still be credited when Paystack confirms it
    if (payment.status !== "pending") await admin.from("payments").update({ status: "pending" }).eq("id", payment.id);
    const { error } = await admin.rpc("complete_payment", { _provider_reference: reference });
    if (error) throw new Error(error.message);
    return { status: "success" as const, message: null };
  }

  if (tx.status === "failed" || tx.status === "reversed") {
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "pending");
    return { status: "failed" as const, message: tx.gateway_response || tx.message || null };
  }

  return { status: "pending" as const, message: tx.gateway_response || null };
}
