import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { PreparedPhoto } from "@/lib/bodyPhoto";
import { errorMessage } from "@/lib/utils";
import { Button, Field, Input, Notice, Select, Spinner } from "@/components/ui";

/** Adds a full-body photo: finds face and hair in the browser, uploads photo + face-lock masks. */
export function BodyPhotoUploader({ onAdded, onCancel }: { onAdded?: (photoId: string) => void; onCancel?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [angle, setAngle] = useState<"front" | "back" | "side">("front");
  const [prepared, setPrepared] = useState<PreparedPhoto | null>(null);
  const [processing, setProcessing] = useState(false);
  const [confirmSelf, setConfirmSelf] = useState(false);
  const [uploading, setUploading] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setProcessing(true);
    setPrepared(null);
    try {
      const { prepareBodyPhoto } = await import("@/lib/bodyPhoto");
      setPrepared(await prepareBodyPhoto(file));
    } catch (err) {
      toast.error(`We couldn't read that photo: ${errorMessage(err)}`);
    } finally {
      setProcessing(false);
    }
  };

  const upload = async () => {
    if (!prepared) return;
    setUploading(true);
    try {
      const id = crypto.randomUUID();
      const base = `${user!.id}/masks/${id}`;
      const paths = {
        photo: `${user!.id}/${id}.png`,
        full: `${base}-full.png`,
        upper: `${base}-upper.png`,
        lower: `${base}-lower.png`,
        face: `${base}-face.png`,
        feet: `${base}-feet.png`,
        eyes: `${base}-eyes.png`,
        head: `${base}-head.png`,
        jewellery: `${base}-jewellery.png`,
      };
      const bucket = supabase.storage.from("body-photos");
      const files: [string, Blob][] = [
        [paths.photo, prepared.photo],
        [paths.full, prepared.masks.full],
        [paths.upper, prepared.masks.upper],
        [paths.lower, prepared.masks.lower],
        [paths.face, prepared.masks.face],
        [paths.feet, prepared.masks.feet],
        [paths.eyes, prepared.masks.eyes],
        [paths.head, prepared.masks.head],
        [paths.jewellery, prepared.masks.jewellery],
      ];
      for (const [path, blob] of files) {
        const { error } = await bucket.upload(path, blob, { contentType: "image/png" });
        if (error) throw error;
      }
      const { error } = await supabase.from("body_photos").insert({
        id,
        user_id: user!.id,
        angle,
        storage_path: paths.photo,
        edit_mask_path: paths.full,
        mask_upper_path: paths.upper,
        mask_lower_path: paths.lower,
        face_mask_path: paths.face,
        mask_feet_path: paths.feet,
        mask_eyes_path: paths.eyes,
        mask_head_path: paths.head,
        mask_jewellery_path: paths.jewellery,
        width: 1024,
        height: 1536,
        confirmed_self: true,
      });
      if (error) throw error;
      toast.success("Photo added");
      setPrepared(null);
      setConfirmSelf(false);
      await queryClient.invalidateQueries({ queryKey: ["body-photos"] });
      // Read all photos together in the background: body shape, limbs, and what to add next
      void supabase.functions.invoke("analyze-body").then(() => queryClient.invalidateQueries({ queryKey: ["body-profile"] }));
      onAdded?.(id);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-5">
      <ul className="grid gap-1 text-[14px] text-muted">
        <li>Stand straight, head to feet in the frame, arms slightly away from your body.</li>
        <li>Good light, plain wall, fitted clothes. Only photos of yourself.</li>
        <li>More photos, more accurate fit: add a side view, one showing your arms, and one in shorts or fitted trousers.</li>
      </ul>
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <Field label="Angle">
          <Select value={angle} onChange={(e) => setAngle(e.target.value as typeof angle)}>
            <option value="front">Front</option>
            <option value="side">Side</option>
            <option value="back">Back</option>
          </Select>
        </Field>
        <Field label="Photo">
          <Input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} className="h-auto py-2 file:mr-3 file:border-0 file:bg-ink file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:uppercase file:text-paper" />
        </Field>
      </div>
      {processing && (
        <p className="flex items-center gap-2 text-muted">
          <Spinner className="h-4 w-4" /> Finding your face, top, trousers and shoes… (the first time downloads a 29 MB model)
        </p>
      )}
      {prepared && (
        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          <figure className="grid gap-2">
            <img src={prepared.overlayUrl} alt="Your photo with the locked face area shaded" className="aspect-[2/3] w-full bg-sunk object-cover" />
            <figcaption className="text-[12.5px] text-muted">Shaded area stays exactly as in your photo.</figcaption>
          </figure>
          <div className="grid content-start gap-3">
            {!prepared.bodyFound && <Notice tone="warn" title="We couldn't see a full body">Use a photo with your whole body in the frame for a better fit.</Notice>}
            {!prepared.faceFound && <Notice tone="warn" title="We couldn't find a face">Face lock works best when your face is clearly visible.</Notice>}
            <label className="flex cursor-pointer gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-ink" checked={confirmSelf} onChange={(e) => setConfirmSelf(e.target.checked)} />
              <span>This is a photo of me, and I'm 18 or older.</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="solid" onClick={upload} loading={uploading} disabled={!confirmSelf}>
                Add this photo
              </Button>
              {onCancel && (
                <Button variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {!prepared && !processing && onCancel && (
        <Button variant="ghost" onClick={onCancel} className="justify-self-start">
          Cancel
        </Button>
      )}
    </div>
  );
}
