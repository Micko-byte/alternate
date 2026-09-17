import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";
import { Button, Field } from "@/components/ui";
import { HeightInput, WeightInput, heightCheck } from "@/components/UnitInputs";

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
    if (h !== null && (h < 100 || h > 250)) return toast.error("That height looks wrong. Between 1 m and 2.5 m (3 ft 4 in to 8 ft 2 in).");
    if (w !== null && (w < 25 || w > 300)) return toast.error("That weight looks wrong. Between 25 and 300 kg (55 to 660 lb).");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ height_cm: h, weight_kg: w }).eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Saved");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const changed = height !== (profile.data?.height_cm?.toString() ?? "") || weight !== (profile.data?.weight_kg?.toString() ?? "");

  return (
    <div className="grid items-end gap-3 sm:grid-cols-[220px_180px_auto]">
      <Field label="Height" hint={heightCheck(height)}>
        <HeightInput valueCm={height} onChangeCm={setHeight} />
      </Field>
      <Field label="Weight" hint="Private. Never used to change your body in try-ons.">
        <WeightInput valueKg={weight} onChangeKg={setWeight} />
      </Field>
      <Button onClick={save} loading={busy} disabled={!changed} className="mb-6 justify-self-start">Save</Button>
    </div>
  );
}
