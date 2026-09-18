import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fitOffset, type FitStyle, type SizeSystem, type UserSize } from "@/lib/sizes";

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSizes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sizes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_sizes").select("category, size_system, size_value").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as UserSize[];
    },
  });
}

export function useConsents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["consents", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consents")
        .select("*")
        .eq("user_id", user!.id)
        .order("granted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBodyPhotos() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["body-photos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_photos")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function isAdult(dob: string | null | undefined) {
  if (!dob) return false;
  const d = new Date(dob);
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 18);
  return d <= limit;
}

/** What's still missing before the shopper can try things on. */
export function useSetupStatus() {
  const profile = useProfile();
  const consents = useConsents();
  const photos = useBodyPhotos();
  const sizes = useSizes();

  const active = new Set((consents.data ?? []).filter((c) => !c.withdrawn_at).map((c) => c.consent_type));
  const steps = {
    about: isAdult(profile.data?.date_of_birth) && !!profile.data?.height_cm,
    sizes: (sizes.data ?? []).length > 0,
    privacy: active.has("body_photo_processing") && active.has("cross_border_transfer"),
    photos: (photos.data ?? []).length > 0,
  };
  return {
    loading: profile.isLoading || consents.isLoading || photos.isLoading || sizes.isLoading,
    steps,
    ready: steps.about && steps.sizes && steps.privacy && steps.photos,
  };
}

export type Wallet = {
  credits: number;
  spendable: number;
  plan: { id: string; name: string; code: string; credits_left: number; credits_total: number; daily_limit: number | null; used_today: number; ends_at: string } | null;
  paid_until: string | null;
};

/** Pack credits plus this month's plan credits. */
export function useWallet() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["credits", user?.id, "wallet"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_wallet");
      if (error) throw error;
      return data as unknown as Wallet;
    },
  });
}

/** Everything the shopper can spend right now (plan credits + pack credits). */
export function useCredits() {
  const wallet = useWallet();
  return { ...wallet, data: wallet.data?.spendable } as Omit<typeof wallet, "data"> & { data: number | undefined };
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_plans").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type BodyEstimates = { bust_cm: number | null; waist_cm: number | null; hips_cm: number | null; height_min_cm: number | null; height_max_cm: number | null };

export type BodyProfileNotes = { id: string; angle: string; full_body: boolean; arms_visible: boolean; legs_visible: boolean; clothing_fit: string; usable: boolean; issues: string };

/** What all of the shopper's photos show together, and what to add for a better fit. */
/** The shopper's bust/chest, waist and hips (tape or photo estimate). Private to them. */
export function useBodyMeasurements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["measurements", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("body_measurements").select("*").eq("user_id", user!.id).maybeSingle()).data,
  });
}

export function useBodyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["body-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("body_profiles").select("photo_ids, photos, tips, body, updated_at").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const body = (data.body ?? {}) as { estimates?: BodyEstimates; height_used?: number | null };
      return { ...data, photos: (data.photos ?? []) as unknown as BodyProfileNotes[], estimates: body.estimates ?? null, heightUsed: body.height_used ?? null };
    },
  });
}

export function useTryonPrices() {
  return useQuery({
    queryKey: ["tryon-prices"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("tryon_prices").select("*");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.quality, p.credits])) as Record<string, number>;
    },
  });
}

export function useCreditPacks() {
  return useQuery({
    queryKey: ["credit-packs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_packs").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * The packs a shopper should see: the launch offer only on a first purchase, the everyday
 * starter pack (cheapest way in), and the bundles. `lead` is the one to push.
 */
export function useShopPacks() {
  const { user } = useAuth();
  const packs = useCreditPacks();

  const firstPurchase = useQuery({
    queryKey: ["first-purchase", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase.from("payments").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("status", "success");
      return !count;
    },
  });

  const live = (packs.data ?? []).filter((p) => p.is_active && (!p.available_until || new Date(p.available_until) > new Date()));
  const everyday = live.filter((p) => !p.first_purchase_only);
  const starter = [...everyday].sort((a, b) => a.price_kes - b.price_kes || b.credits - a.credits)[0] ?? null;
  const launch = (!user || firstPurchase.data) ? live.find((p) => p.first_purchase_only) ?? null : null;
  const lead = launch ?? starter;
  return { lead, starter, others: live.filter((p) => p !== lead).sort((a, b) => a.sort_order - b.sort_order) };
}

export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin");
      return !!data;
    },
  });
}

export function useMyStore() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-store", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_members")
        .select("role, stores(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.stores ? { ...data.stores, role: data.role } : null;
    },
  });
}

export const PRODUCT_SELECT =
  "id, name, description, category, department, price_kes, status, is_one_of_a_kind, stretch, store_id, created_at, stores!inner(id, name, slug, status, whatsapp_phone, instagram_handle), product_media(id, kind, storage_path, position, is_tryon_source), product_variants(id, size_label, size_system, size_min, size_max, stock_qty, measurements)";

export type Variant = { id: string; size_label: string; size_system: SizeSystem; size_min: number | null; size_max: number | null; stock_qty: number; measurements?: unknown };

export type FitState = "fits" | "not-in-size" | "needs-size" | "sold-out";

export type FitResult = { state: FitState; variant?: Variant; system?: SizeSystem; target?: number };

/**
 * The size rule (mirrors request_tryon): only pieces in stock in the shopper's size,
 * sizing up for relaxed, oversized and baggy fits.
 */
export function fitFor(variants: Variant[], sizes: UserSize[] | undefined, category: string, fit: FitStyle = "regular"): FitResult {
  const inStock = variants.filter((v) => v.stock_qty > 0);
  if (inStock.length === 0) return { state: "sold-out" };
  const oneSize = inStock.find((v) => v.size_min === null);
  if (oneSize) return { state: "fits", variant: oneSize };

  const mine = (sizes ?? []).filter((s) => s.category === category);
  let knownSystem: SizeSystem | undefined;
  let target: number | undefined;
  for (const v of [...inStock].sort((a, b) => (a.size_min ?? 0) - (b.size_min ?? 0))) {
    const size = mine.find((s) => s.size_system === v.size_system);
    if (!size) continue;
    knownSystem = v.size_system;
    target = size.size_value + fitOffset(v.size_system, fit);
    if (target >= (v.size_min ?? 0) && target <= (v.size_max ?? 0)) return { state: "fits", variant: v, system: v.size_system, target };
  }
  if (!knownSystem) {
    const everHas = variants.some((v) => mine.some((s) => s.size_system === v.size_system));
    if (!everHas) return { state: "needs-size", system: variants[0]?.size_system };
    const s = mine.find((m) => variants.some((v) => v.size_system === m.size_system))!;
    return { state: "not-in-size", system: s.size_system, target: s.size_value + fitOffset(s.size_system, fit) };
  }
  return { state: "not-in-size", system: knownSystem, target };
}
