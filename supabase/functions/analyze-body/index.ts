// Builds (or refreshes) a shopper's body profile from all their active photos, right after they add
// or remove one, and returns tips like "Add a side photo" so the next try-on is more accurate.
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import { ensureBodyProfile } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const user = await callerFrom(req, admin);
  if (!user) return json({ error: "Sign in first" }, 401);

  try {
    const profile = await ensureBodyProfile(admin, user.id);
    if (!profile) return json({ photos: [], tips: ["Add a full-body photo from the front"] });
    return json({ photos: profile.photos, tips: profile.tips, estimates: (profile.body as { estimates?: unknown })?.estimates ?? null, updated_at: profile.updated_at });
  } catch (err) {
    console.error("analyze-body", err);
    return json({ error: "We couldn't check your photos right now. Try-ons still work." }, 502);
  }
});
