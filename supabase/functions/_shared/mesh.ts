// The 3D engine behind one door: Meshy today, our own GPU when the bill says so.
// A mesh is always made from a finished try-on, so whatever the engine, the body is already right.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.88.0";

export const MESHY_API = "https://api.meshy.ai/openapi/v1";

export type MeshMode = "off" | "meshy" | "selfhost";

export async function meshMode(admin: SupabaseClient): Promise<MeshMode> {
  const { data } = await admin.from("app_settings").select("value").eq("key", "mesh_mode").maybeSingle();
  const value = data?.value as string | undefined;
  return value === "meshy" || value === "selfhost" ? value : "off";
}

export function meshyKey(): string | null {
  return Deno.env.get("MESHY_API_KEY") ?? null;
}

/** Ask Meshy to build a model from one picture. Returns their task id. */
export async function startMeshy(imageUrl: string): Promise<string> {
  const key = meshyKey();
  if (!key) throw new Error("The 3D engine isn't configured on the server yet");
  const res = await fetch(`${MESHY_API}/image-to-3d`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      ai_model: "latest",
      should_texture: true,
      enable_pbr: true,
      texture_resolution: "2k",   // 2k keeps the file small enough to open fast on a phone
      model_type: "standard",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`3D engine refused the job: ${body?.message ?? res.status}`);
  const id = body?.result ?? body?.id;
  if (!id) throw new Error("3D engine gave no task to follow");
  return String(id);
}

export type MeshyTask = { done: boolean; failed: boolean; progress: number; glb: string | null; message: string | null };

export async function checkMeshy(taskId: string): Promise<MeshyTask> {
  const key = meshyKey();
  if (!key) throw new Error("The 3D engine isn't configured on the server yet");
  const res = await fetch(`${MESHY_API}/image-to-3d/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`3D engine lost the job: ${body?.message ?? res.status}`);
  const status = String(body?.status ?? "").toUpperCase();
  return {
    done: status === "SUCCEEDED",
    failed: status === "FAILED" || status === "CANCELED",
    progress: Number(body?.progress ?? 0),
    glb: body?.model_urls?.glb ?? null,
    message: body?.task_error?.message ?? null,
  };
}
