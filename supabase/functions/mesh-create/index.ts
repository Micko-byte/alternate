// Buys and starts a 3D spin of a finished try-on. request_mesh() takes the credits and refuses
// anything that isn't clothing; this hands the result picture to the engine and records the job.
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import { meshMode, startMeshy } from "../_shared/mesh.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const user = await callerFrom(req, admin);
  if (!user) return json({ error: "Sign in first" }, 401);

  const { tryon_id } = await req.json().catch(() => ({}));
  if (!tryon_id) return json({ error: "Which try-on?" }, 400);

  // Charges the credits, or throws with a message the shopper can act on
  const { data: mesh, error } = await admin.rpc("request_mesh", { _tryon_id: tryon_id });
  if (error) return json({ error: error.message }, 400);
  if (mesh.status === "succeeded") return json({ mesh });
  if (mesh.provider_task_id) return json({ mesh }); // already running, let the client poll

  try {
    const mode = await meshMode(admin);
    if (mode === "selfhost") throw new Error("Our own 3D engine isn't running yet");

    const { data: tryon } = await admin.from("tryons").select("result_path").eq("id", tryon_id).single();
    if (!tryon?.result_path) throw new Error("That try-on has no picture to build from");

    // The engine fetches the picture itself, so it needs a link that works without our keys
    const { data: signed } = await admin.storage.from("tryon-results").createSignedUrl(tryon.result_path, 60 * 60);
    if (!signed?.signedUrl) throw new Error("Couldn't share the picture with the 3D engine");

    const taskId = await startMeshy(signed.signedUrl);
    const { data: updated } = await admin
      .from("tryon_meshes")
      .update({ status: "processing", provider_task_id: taskId })
      .eq("id", mesh.id)
      .select()
      .single();
    return json({ mesh: updated ?? mesh });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The 3D engine didn't answer";
    await admin.rpc("refund_mesh", { _mesh_id: mesh.id, _reason: message });
    console.error("mesh-create failed", tryon_id, message);
    return json({ error: `${message}. Your credits are back.` }, 502);
  }
});
