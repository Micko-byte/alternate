// Admin-only account actions that need the Supabase auth admin API: ban, unban, delete.
// Owners can't be banned or deleted; only the owner can ban or delete another admin.
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";

const USER_BUCKETS = ["body-photos", "garment-uploads", "tryon-results", "shared-looks"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const caller = await callerFrom(req, admin);
  if (!caller) return json({ error: "Sign in first" }, 401);

  const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", caller.id);
  const isAdmin = callerRoles?.some((r) => r.role === "admin");
  const isOwner = callerRoles?.some((r) => r.role === "owner");
  if (!isAdmin) return json({ error: "Admins only" }, 403);

  const { action, user_id } = await req.json().catch(() => ({}));
  if (!["ban", "unban", "delete"].includes(action) || !user_id) return json({ error: "Unknown action" }, 400);
  if (user_id === caller.id) return json({ error: "You can't do that to your own account" }, 400);

  const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", user_id);
  if (targetRoles?.some((r) => r.role === "owner")) return json({ error: "The owner account can't be banned or deleted" }, 403);
  if (targetRoles?.some((r) => r.role === "admin") && !isOwner) return json({ error: "Only the owner can ban or delete an admin" }, 403);

  const { data: target, error: lookupError } = await admin.auth.admin.getUserById(user_id);
  if (lookupError || !target?.user) return json({ error: "User not found" }, 404);
  const email = target.user.email;

  if (action === "ban" || action === "unban") {
    const { error } = await admin.auth.admin.updateUserById(user_id, { ban_duration: action === "ban" ? "876000h" : "none" });
    if (error) return json({ error: error.message }, 500);
  } else {
    // Remove their private files, then the account (database rows cascade)
    for (const bucket of USER_BUCKETS) {
      for (const prefix of [user_id, `${user_id}/masks`]) {
        const { data: files } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
        const paths = (files ?? []).filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
        if (paths.length) await admin.storage.from(bucket).remove(paths);
      }
    }
    await admin.from("data_deletion_requests").update({ completed_at: new Date().toISOString() }).eq("user_id", user_id).is("completed_at", null);
    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) return json({ error: error.message }, 500);
  }

  await admin.from("admin_audit_log").insert({ actor_id: caller.id, action: `${action}_user`, target_user_id: user_id, details: { email } });
  return json({ ok: true });
});
