import { supabase } from "@/integrations/supabase/client";

/** Permanently delete one of the shopper's try-ons or body photos (server side, storage and database). */
export async function deleteMyData(kind: "tryon" | "photo", id: string) {
  const { data, error } = await supabase.functions.invoke("delete-my-data", { body: { kind, id } });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context?.status === 404 && !(await context.clone().json().catch(() => null))?.error) {
      throw new Error("Deleting isn't switched on yet. Nothing was deleted; try again soon.");
    }
    const body = await context?.json().catch(() => null);
    throw new Error(body?.error ?? "We couldn't delete that. Nothing was deleted; try again.");
  }
  return data;
}
