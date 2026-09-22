import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Box } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMeshSettings } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui";
import { SpinStage } from "@/components/SpinStage";

const SPINNABLE = ["dress", "top", "bottom", "skirt", "jumpsuit", "outerwear", "set"];

type Status = { status: string; url?: string; progress?: number; error?: string };

/**
 * Buys and shows the 3D spin of one finished try-on. The picture is already right, so the model
 * inherits it: her body, her stance, her shoes — and the back, which a photo can never show.
 */
export function SpinButton({ tryonId, category }: { tryonId: string; category: string | null }) {
  const { mode, credits } = useMeshSettings();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const poll = useRef<number>();

  const mesh = useQuery({
    queryKey: ["mesh", tryonId],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("mesh-status", { body: { tryon_id: tryonId } });
      return (data ?? null) as Status | null;
    },
    retry: false,
  });

  useEffect(() => () => window.clearInterval(poll.current), []);

  if (mode === "off" || !category || !SPINNABLE.includes(category)) return null;

  const url = mesh.data?.status === "succeeded" ? mesh.data.url : undefined;

  const watch = () => {
    window.clearInterval(poll.current);
    poll.current = window.setInterval(async () => {
      const { data } = await supabase.functions.invoke("mesh-status", { body: { tryon_id: tryonId } });
      const next = (data ?? {}) as Status;
      setProgress(next.progress ?? 0);
      if (next.status === "succeeded" || next.status === "failed") {
        window.clearInterval(poll.current);
        setBusy(false);
        queryClient.invalidateQueries({ queryKey: ["mesh", tryonId] });
        queryClient.invalidateQueries({ queryKey: ["credits"] });
        if (next.status === "failed") toast.error(next.error ?? "That one couldn't be built in 3D.");
      }
    }, 4000);
  };

  const buy = async () => {
    setBusy(true);
    setProgress(0);
    const { data, error } = await supabase.functions.invoke("mesh-create", { body: { tryon_id: tryonId } });
    const failed = error || (data as { error?: string })?.error;
    if (failed) {
      setBusy(false);
      return toast.error(errorMessage(failed));
    }
    queryClient.invalidateQueries({ queryKey: ["credits"] });
    watch();
  };

  if (url) {
    return (
      <div className="grid gap-3">
        <SpinStage url={url} label="3D · turn it" />
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={buy} loading={busy}>
      <Box className="h-4 w-4" />
      {busy ? (progress ? `Building your 3D · ${progress}%` : "Building your 3D…") : `See it in 3D · ${credits} ${credits === 1 ? "credit" : "credits"}`}
    </Button>
  );
}
