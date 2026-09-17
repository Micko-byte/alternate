import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";

type Setting = "delete_photos_after_tryon";

/** Save one privacy choice on the shopper's profile. */
export function usePrivacySetting() {
  const { user } = useAuth();
  const profile = useProfile();
  const queryClient = useQueryClient();
  const set = async (key: Setting, value: boolean) => {
    const { error } = await supabase.from("profiles").update({ [key]: value }).eq("id", user!.id);
    if (error) return toast.error(errorMessage(error));
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };
  return { profile: profile.data, set };
}

/** What happens to body photos, in plain words. Shown wherever photos are added. */
export function PhotoPrivacyNote() {
  return (
    <div className="grid gap-1.5 border border-rule bg-paper p-3 text-[13px] text-muted">
      <span className="flex items-center gap-1.5 font-medium text-ink"><Lock className="h-3.5 w-3.5" /> Private and encrypted</span>
      <p>
        Your photos are encrypted while they travel (TLS) and while stored (AES-256), in private storage only you can open: not stores, not other
        shoppers, and not our team in the app. Your face is blurred on screen until you choose to show it. Photos go securely to our image AI (OpenAI)
        only to make your try-ons, and OpenAI doesn't train its models on them. Delete them any time; deleting is permanent.
      </p>
    </div>
  );
}

/** Privacy switch: delete photos after every try-on. (Faces are always blurred on screen until shown.) */
export function PhotoPrivacySettings() {
  const { profile, set } = usePrivacySetting();
  if (!profile) return null;
  return (
    <div className="grid gap-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-ink" checked={profile.delete_photos_after_tryon} onChange={(e) => set("delete_photos_after_tryon", e.target.checked)} />
        <span className="grid gap-0.5">
          <span>Delete my photos after every try-on</span>
          <span className="text-[13px] text-muted">
            The photos used are deleted from our servers as soon as the try-on is made; the result is kept. You'll add a photo again for each try-on, and
            the fit is less accurate without your other photos.
          </span>
        </span>
      </label>
    </div>
  );
}
