// Polled by the viewer while a spin is being built. When the engine is done this downloads the model
// once, keeps it in our own private bucket, and hands back a link the page can open.
import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import { checkMeshy } from "../_shared/mesh.ts";

const HOUR = 60 * 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = adminClient();
  const user = await callerFrom(req, admin);
  if (!user) return json({ error: "Sign in first" }, 401);

  const { tryon_id } = await req.json().catch(() => ({}));
  const { data: mesh } = await admin
    .from("tryon_meshes")
    .select("*")
    .eq("tryon_id", tryon_id)
    .neq("status", "failed")
    .maybeSingle();
  if (!mesh || mesh.user_id !== user.id) return json({ error: "No 3D spin for that try-on" }, 404);

  const link = async (path: string) => (await admin.storage.from("tryon-meshes").createSignedUrl(path, 12 * HOUR)).data?.signedUrl ?? null;

  if (mesh.status === "succeeded" && mesh.storage_path) {
    return json({ status: "succeeded", url: await link(mesh.storage_path) });
  }
  if (!mesh.provider_task_id) return json({ status: mesh.status, progress: 0 });

  try {
    const task = await checkMeshy(mesh.provider_task_id);
    if (task.failed) {
      await admin.rpc("refund_mesh", { _mesh_id: mesh.id, _reason: task.message ?? "The 3D engine couldn't build this one" });
      return json({ status: "failed", error: "That one couldn't be built in 3D. Your credits are back." });
    }
    if (!task.done || !task.glb) return json({ status: "processing", progress: task.progress });

    // Keep our own copy: their link expires, and the shopper's body should live in our bucket
    const file = await fetch(task.glb);
    if (!file.ok) throw new Error("Couldn't download the finished model");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${mesh.user_id}/${mesh.id}.glb`;
    const { error: upload } = await admin.storage.from("tryon-meshes").upload(path, bytes, {
      contentType: "model/gltf-binary",
      cacheControl: "31536000", // a mesh never changes, so let the CDN hold it for a year
      upsert: true,
    });
    if (upload) throw new Error(upload.message);

    await admin
      .from("tryon_meshes")
      .update({ status: "succeeded", storage_path: path, completed_at: new Date().toISOString(), cost_usd: 0.225 })
      .eq("id", mesh.id);
    return json({ status: "succeeded", url: await link(path) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The 3D engine stopped answering";
    await admin.rpc("refund_mesh", { _mesh_id: mesh.id, _reason: message });
    console.error("mesh-status failed", tryon_id, message);
    return json({ status: "failed", error: `${message}. Your credits are back.` });
  }
});
