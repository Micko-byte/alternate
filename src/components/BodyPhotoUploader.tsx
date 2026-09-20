import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { PreparedPhoto } from "@/lib/bodyPhoto";
import { warmGarmentParser } from "@/lib/garmentParser";
import { fileKey, forgetJob, useJob, useKept } from "@/lib/work";
import { errorMessage } from "@/lib/utils";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { BODY_PHOTO_STAGES, LoadingPanel } from "@/components/Loading";
import { PhotoPrivacyNote, usePrivacySetting } from "@/components/PhotoPrivacy";

type Angle = "front" | "back" | "side";

const readKey = (file: File) => `body-photo:${fileKey(file)}`;
const saveKey = (file: File) => `body-photo-save:${fileKey(file)}`;

/** Adds a full-body photo: finds face and hair in the browser, uploads photo + face-lock masks. */
export function BodyPhotoUploader({ onAdded, onCancel }: { onAdded?: (photoId: string) => void; onCancel?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Kept outside this screen: reading a photo takes seconds, and a tap on Wardrobe used to throw it away
  const [file, setFile] = useKept<File | null>("body-photo-file", null);
  const [angle, setAngle] = useKept<Angle>("body-photo-angle", "front");
  const [confirmSelf, setConfirmSelf] = useKept("body-photo-confirmed", false);
  const [saving, setSaving] = useKept("body-photo-saving", false);
  const privacy = usePrivacySetting();

  const [picked, setPicked] = useState<string>();
  useEffect(() => {
    if (!file) return setPicked(undefined);
    const url = URL.createObjectURL(file);
    setPicked(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const read = useJob(
    file ? readKey(file) : null,
    async () => {
      const { prepareBodyPhoto } = await import("@/lib/bodyPhoto");
      return prepareBodyPhoto(file!);
    },
    (photo) => URL.revokeObjectURL(photo.overlayUrl),
  );
  const prepared = read.status === "done" ? (read.value as PreparedPhoto) : null;

  const save = useJob(file && saving ? saveKey(file) : null, async () => {
    const { saveBodyPhoto } = await import("@/lib/bodyPhoto");
    return saveBodyPhoto(user!.id, angle, prepared!);
  });

  useEffect(() => {
    if (read.status === "failed") {
      toast.error(`We couldn't read that photo: ${errorMessage(read.error)}`);
      if (file) forgetJob(readKey(file));
      setFile(null);
    }
  }, [read.status, read.error, file, setFile]);

  const done = save.status === "done" ? (save.value as string) : null;
  useEffect(() => {
    if (!done || !file) return;
    toast.success("Photo added");
    const [reading, writing] = [readKey(file), saveKey(file)];
    setFile(null);
    setConfirmSelf(false);
    setSaving(false);
    forgetJob(reading);
    forgetJob(writing);
    void queryClient.invalidateQueries({ queryKey: ["body-photos"] });
    // Read all photos together in the background: body shape, limbs, and what to add next
    void supabase.functions.invoke("analyze-body").then(() => queryClient.invalidateQueries({ queryKey: ["body-profile"] }));
    onAdded?.(done);
    // onAdded is a fresh function every render; the photo id is what decides this runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  useEffect(() => {
    if (save.status !== "failed" || !file) return;
    toast.error(errorMessage(save.error));
    setSaving(false);
    forgetJob(saveKey(file));
  }, [save.status, save.error, file, setSaving]);

  const cancel = () => {
    if (file) {
      forgetJob(readKey(file));
      forgetJob(saveKey(file));
    }
    setFile(null);
    setConfirmSelf(false);
    setSaving(false);
    onCancel?.();
  };

  return (
    <div className="grid gap-5">
      <ul className="grid gap-1 text-[14px] text-muted">
        <li>Stand straight, head to feet in the frame, arms slightly away from your body.</li>
        <li>Good light, plain wall, fitted clothes. Only photos of yourself.</li>
        <li>More photos, more accurate fit: add a side view, one showing your arms, and one in shorts or fitted trousers.</li>
      </ul>
      <PhotoPrivacyNote />
      {privacy.profile && (
        <label className="flex cursor-pointer items-start gap-2 text-[13px] text-muted">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-ink" checked={privacy.profile.delete_photos_after_tryon} onChange={(e) => privacy.set("delete_photos_after_tryon", e.target.checked)} />
          Delete my photos from your servers after every try-on (you'll add a photo each time)
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <Field label="Angle">
          <Select value={angle} onChange={(e) => setAngle(e.target.value as Angle)}>
            <option value="front">Front</option>
            <option value="side">Side</option>
            <option value="back">Back</option>
          </Select>
        </Field>
        {/* The model is 29 MB, so it starts downloading when someone reaches for the picker
            rather than when they open this page — and not at all on a save-data connection. */}
        <Field label="Photo">
          <Input type="file" accept="image/*" onPointerEnter={warmGarmentParser} onFocus={warmGarmentParser} onClick={warmGarmentParser} onChange={(e) => { const picked = e.target.files?.[0]; if (picked) setFile(picked); e.target.value = ""; }} className="h-auto py-2 file:mr-3 file:border-0 file:bg-ink file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:uppercase file:text-paper" />
        </Field>
      </div>
      {read.status === "running" && (
        <LoadingPanel
          title="Reading you"
          stages={BODY_PHOTO_STAGES}
          photo={picked ? { src: picked, alt: "The photo you picked, being read" } : undefined}
          note="The first photo also downloads a 29 MB model. You can carry on using the app — this keeps going if you leave this page."
        />
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
              <Button variant="solid" onClick={() => setSaving(true)} loading={save.status === "running"} disabled={!confirmSelf}>
                Add this photo
              </Button>
              {onCancel && (
                <Button variant="ghost" onClick={cancel}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {!prepared && read.status !== "running" && onCancel && (
        <Button variant="ghost" onClick={cancel} className="justify-self-start">
          Cancel
        </Button>
      )}
    </div>
  );
}
