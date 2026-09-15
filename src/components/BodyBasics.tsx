import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";
import { Button, Field, Input } from "@/components/ui";

/** Shows 165 cm as 5 ft 5 in, so a wrong height is easy to spot. */
export function heightHint(cm: string) {
  const n = Number(cm);
  if (!n || n < 100 || n > 250) return "Used to place hems and read measurements";
  const inches = Math.round(n / 2.54);
  return `That's ${Math.floor(inches / 12)} ft ${inches % 12} in. Check it's right.`;
}

/** Height and weight, editable any time. */
export function BodyBasics() {
  const { user } = useAuth();
  const profile = useProfile();
  const queryClient = useQueryClient();
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHeight(profile.data?.height_cm?.toString() ?? "");
    setWeight(profile.data?.weight_kg?.toString() ?? "");
  }, [profile.data?.height_cm, profile.data?.weight_kg]);

  const save = async () => {
    const h = height ? Number(height) : null;
    const w = weight ? Number(weight) : null;
    if (h !== null && (h < 100 || h > 250)) return toast.error("Height should be in cm, between 100 and 250.");
    if (w !== null && (w < 25 || w > 300)) return toast.error("Weight should be in kg, between 25 and 300.");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ height_cm: h, weight_kg: w }).eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Saved");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const changed = height !== (profile.data?.height_cm?.toString() ?? "") || weight !== (profile.data?.weight_kg?.toString() ?? "");

  return (
    <div className="grid items-end gap-3 sm:grid-cols-[180px_180px_auto]">
      <Field label="Height (cm)" hint={heightHint(height)}>
        <Input type="number" min={100} max={250} value={height} onChange={(e) => setHeight(e.target.value)} className="num" />
      </Field>
      <Field label="Weight (kg)" hint="Private. Never used to change your body in try-ons.">
        <Input type="number" min={25} max={300} value={weight} onChange={(e) => setWeight(e.target.value)} className="num" />
      </Field>
      <Button onClick={save} loading={busy} disabled={!changed} className="mb-6 justify-self-start">Save</Button>
    </div>
  );
}
