import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const KES_PER_USD = 129.4;

export function usd(value: number | string | null | undefined, digits = 2) {
  return `$${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function usdToKes(value: number | string | null | undefined) {
  return `KES ${Math.round(Number(value ?? 0) * KES_PER_USD).toLocaleString("en-KE")}`;
}

export function useIsOwner() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-owner", user?.id],
    enabled: !!user,
    queryFn: async () => !!(await supabase.rpc("is_owner")).data,
  });
}

export function useTryonAllowance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tryon-allowance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_tryon_allowance");
      if (error) throw error;
      return data as unknown as { limit: number | null; used: number; remaining: number | null; exempt: boolean };
    },
  });
}

/** Calls the admin-users edge function and surfaces its error message. */
export async function adminUserAction(action: "ban" | "unban" | "delete", userId: string) {
  const { error } = await supabase.functions.invoke("admin-users", { body: { action, user_id: userId } });
  if (error) {
    let message = error.message;
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep message */
    }
    throw new Error(message);
  }
}
