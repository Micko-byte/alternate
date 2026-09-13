import { useOutletContext } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

export type Store = Database["public"]["Tables"]["stores"]["Row"] & { role: Database["public"]["Enums"]["store_member_role"] };

export function useStore() {
  return useOutletContext<Store>();
}
