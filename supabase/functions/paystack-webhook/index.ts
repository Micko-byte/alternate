// Paystack server-to-server notification. Verified by HMAC signature, then re-checked with the API.
import { adminClient, json } from "../_shared/http.ts";
import { confirmPayment, paystackKey } from "../_shared/paystack.ts";

async function hmacSha512Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = paystackKey();
  if (!secret) return json({ error: "Not configured" }, 503);

  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  if ((await hmacSha512Hex(secret, raw)) !== signature) return json({ error: "Bad signature" }, 401);

  const event = JSON.parse(raw);
  if (event?.event === "charge.success" && event?.data?.reference) {
    try {
      await confirmPayment(adminClient(), event.data.reference);
    } catch (err) {
      console.error("webhook confirm failed", err);
      return json({ error: "Retry later" }, 500);
    }
  }
  return json({ received: true });
});
