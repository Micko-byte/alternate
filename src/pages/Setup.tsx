import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { isAdult, useBodyPhotos, useConsents, useProfile, useSetupStatus, useSizes } from "@/lib/queries";
import { cn, errorMessage, signedUrl } from "@/lib/utils";
import type { FitStyle, ShopsFor, SizeSystem } from "@/lib/sizes";
import { FitPicker } from "@/components/FitPicker";
import { ShopsForPicker, SizeFields, sizeKey } from "@/components/SizeFields";
import { Button, ButtonLink, Field, Input, Select, Spinner } from "@/components/ui";
import { BodyPhotoUploader } from "@/components/BodyPhotoUploader";
import { Measurements } from "@/components/Measurements";
import { PrivatePhoto } from "@/components/PrivatePhoto";
import { DeleteForever } from "@/components/DeleteForever";
import { deleteMyData } from "@/lib/deleteData";
import { HeightInput, WeightInput, heightCheck } from "@/components/UnitInputs";

const POLICY_VERSION = "2026-09-v1";

/**
 * One thing at a time: age and height, then the photo, then straight into the fitting room.
 * Sizes, measurements and the rest are offered at the end and can be skipped - the fitting room
 * asks for the size of whatever is being tried on anyway.
 */
export default function Setup() {
  const setup = useSetupStatus();
  const [showExtras, setShowExtras] = useState(false);

  if (setup.loading) {
    return <div className="grid min-h-[50dvh] place-items-center"><Spinner /></div>;
  }

  // Everything needed before a first try-on, on one screen: age, height, one tick, one photo.
  if (!setup.ready) {
    return (
      <div className="mx-auto grid w-full max-w-xl gap-5">
        <div className="grid gap-1.5">
          <span className="label">One screen, then you are in</span>
          <h1 className="display text-[clamp(30px,7vw,44px)]">Add your photo</h1>
          <p className="text-[15px] text-muted">Standing, phone at chest height, head to feet. That photo plus your height is all a try-on needs.</p>
        </div>

        <Card title="You" blurb="Your age because try-ons are 18+, your height so clothes are drawn at your real size.">
          <AboutStep />
        </Card>

        <Card title="Your photo">
          <div className="grid gap-6">
            <PrivacyStep />
            {setup.steps.about && setup.steps.privacy
              ? <PhotosStep />
              : <p className="border border-rule bg-sunk p-4 text-[14px] text-muted">Fill in the two answers above and tick the boxes, then the uploader opens here.</p>}
          </div>
        </Card>

        {setup.steps.photos && (
          <ButtonLink to="/fitting-room" variant="solid" size="lg" className="justify-self-start">Open the fitting room</ButtonLink>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-xl gap-5">
      <Card title="Your fitting room is ready" blurb="Screenshot any piece you like and see it on your own body, in your size.">
        <div className="grid gap-4">
          <ButtonLink to="/fitting-room" variant="solid" size="lg" className="justify-self-start">Open the fitting room</ButtonLink>
          <button type="button" onClick={() => setShowExtras((v) => !v)} className="label justify-self-start text-muted underline underline-offset-4 hover:text-ink">
            {showExtras ? "Hide the optional bits" : "Add sizes, measurements or more photos"}
          </button>
        </div>
      </Card>
      {showExtras && (
        <div className="grid gap-5">
          <Card title="More photos" blurb="Side and back angles make the fit truer. Optional."><PhotosStep /></Card>
          <Card title="Sizes & fit" blurb="Optional - the fitting room asks for the size of whatever you are trying on." id="sizes"><SizesStep /></Card>
          <Card title="Measurements" blurb="Optional. Typed measurements beat anything estimated from a photo." id="measurements"><Measurements /></Card>
        </div>
      )}
    </div>
  );
}

function Card({ title, blurb, id, children }: { title: string; blurb?: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="grid gap-5 border border-rule bg-surface p-5 md:p-7">
      <div className="grid gap-1.5">
        <h2 className="display text-[clamp(24px,5vw,30px)]">{title}</h2>
        {blurb && <p className="text-[14.5px] text-muted">{blurb}</p>}
      </div>
      {children}
    </section>
  );
}

function AboutStep() {
  const { user } = useAuth();
  const profile = useProfile();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ display_name: "", phone: "", date_of_birth: "", height_cm: "", weight_kg: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile.data) {
      setForm({
        display_name: profile.data.display_name ?? "",
        phone: profile.data.phone ?? "",
        date_of_birth: profile.data.date_of_birth ?? "",
        height_cm: profile.data.height_cm?.toString() ?? "",
        weight_kg: profile.data.weight_kg?.toString() ?? "",
      });
    }
  }, [profile.data]);

  const save = async () => {
    if (form.date_of_birth && !isAdult(form.date_of_birth)) return toast.error("VAA ALTERNATE try-on is for people aged 18 and over.");
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name || null,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      })
      .eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Saved");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date of birth" hint="You must be 18 or older"><Input type="date" required value={form.date_of_birth} onChange={set("date_of_birth")} /></Field>
        <Field label="Height" hint={heightCheck(form.height_cm)}><HeightInput valueCm={form.height_cm} onChangeCm={(v) => setForm({ ...form, height_cm: v })} /></Field>
      </div>
      <details className="grid gap-4">
        <summary className="label cursor-pointer text-muted hover:text-ink">Name, phone and weight (optional)</summary>
        <div className="grid gap-4 pt-4 sm:grid-cols-2">
          <Field label="Name"><Input value={form.display_name} onChange={set("display_name")} /></Field>
          <Field label="Phone (M-Pesa)"><Input type="tel" value={form.phone} onChange={set("phone")} placeholder="07XX XXX XXX" /></Field>
          <Field label="Weight" hint="Makes the fit truer; skip it if you would rather not"><WeightInput valueKg={form.weight_kg} onChangeKg={(v) => setForm({ ...form, weight_kg: v })} /></Field>
        </div>
      </details>
      <Button onClick={save} loading={busy} size="lg" className="justify-self-start" disabled={!form.date_of_birth || !form.height_cm}>Save and continue</Button>
    </div>
  );
}

function SizesStep() {
  const { user } = useAuth();
  const profile = useProfile();
  const sizes = useSizes();
  const queryClient = useQueryClient();
  const shopsFor = profile.data?.shops_for ?? null;
  const values = Object.fromEntries((sizes.data ?? []).map((s) => [sizeKey(s.category, s.size_system), String(s.size_value)]));

  const saveProfile = async (patch: { shops_for?: ShopsFor; preferred_fit?: FitStyle }) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", user!.id);
    if (error) return toast.error(errorMessage(error));
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const setSize = async (category: string, system: SizeSystem, value: string) => {
    const q = value
      ? supabase.from("user_sizes").upsert({ user_id: user!.id, category: category as never, size_system: system, size_value: Number(value) })
      : supabase.from("user_sizes").delete().eq("user_id", user!.id).eq("category", category as never).eq("size_system", system);
    const { error } = await q;
    if (error) return toast.error(errorMessage(error));
    queryClient.invalidateQueries({ queryKey: ["sizes"] });
  };

  return (
    <div className="grid gap-6">
      <ShopsForPicker value={shopsFor} onChange={(v) => saveProfile({ shops_for: v })} />
      <div className="grid gap-2">
        <p className="text-muted">Your usual sizes. You'll only be offered pieces a store has in stock in them, and try-ons are drawn to fit.</p>
        <SizeFields shopsFor={shopsFor} values={values} onChange={setSize} />
      </div>
      <FitPicker value={profile.data?.preferred_fit ?? "regular"} onChange={(v) => saveProfile({ preferred_fit: v })} name="preferred-fit" hint="how you usually like it" />
    </div>
  );
}

function PrivacyStep() {
  const { user } = useAuth();
  const consents = useConsents();
  const queryClient = useQueryClient();
  const active = new Set((consents.data ?? []).filter((c) => !c.withdrawn_at).map((c) => c.consent_type));
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const items = [
    { type: "terms", text: "I accept the terms and privacy policy." },
    { type: "body_photo_processing", text: "My photos may be used to make my try-ons. They stay private to me and I can delete them any time." },
    { type: "cross_border_transfer", text: "My photos may be sent to OpenAI in the US to draw the try-on. They are not used to train it." },
  ] as const;

  const save = async () => {
    const toAdd = items.filter((i) => !active.has(i.type) && checked[i.type]);
    if (!toAdd.length) return;
    setBusy(true);
    const { error } = await supabase.from("consents").insert(toAdd.map((i) => ({ user_id: user!.id, consent_type: i.type, policy_version: POLICY_VERSION })));
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    queryClient.invalidateQueries({ queryKey: ["consents"] });
    toast.success("Privacy choices saved");
  };

  return (
    <div className="grid gap-4">
      {items.map((i) => (
        <label key={i.type} className="flex cursor-pointer gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-ink"
            checked={active.has(i.type) || !!checked[i.type]}
            disabled={active.has(i.type)}
            onChange={(e) => setChecked({ ...checked, [i.type]: e.target.checked })}
          />
          <span className={cn(active.has(i.type) && "text-muted")}>{i.text}</span>
        </label>
      ))}
      {items.some((i) => !active.has(i.type)) && (
        <Button onClick={save} loading={busy} className="justify-self-start" disabled={!items.filter((i) => !active.has(i.type)).every((i) => checked[i.type])}>
          Agree
        </Button>
      )}
    </div>
  );
}

function PhotosStep() {
  const photos = useBodyPhotos();
  const queryClient = useQueryClient();
  const [thumbs, setThumbs] = useState<Record<string, { photo: string; face: string | null }>>({});

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(
        (photos.data ?? []).map(async (p) => [p.id, { photo: await signedUrl("body-photos", p.storage_path), face: await signedUrl("body-photos", p.face_mask_path) }] as const),
      );
      setThumbs(Object.fromEntries(entries.filter(([, u]) => u.photo)) as Record<string, { photo: string; face: string | null }>);
    })();
  }, [photos.data]);

  // Deleting on the server keeps the try-ons made with this photo
  const remove = async (photo: (typeof photos.data & object)[number]) => {
    await deleteMyData("photo", photo.id);
    toast.success("Photo deleted");
    queryClient.invalidateQueries({ queryKey: ["body-photos"] });
  };

  const downloadPhoto = async (url: string, angle: string) => {
    const blob = await (await fetch(url)).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `alternate-${angle}-photo.png`;
    a.click();
  };

  return (
    <div className="grid gap-6">
      {(photos.data?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-3">
          {photos.data!.map((p) => (
            <figure key={p.id} className="grid w-28 gap-1">
              <div className="aspect-[2/3] overflow-hidden bg-sunk">
                {thumbs[p.id] && <PrivatePhoto photoUrl={thumbs[p.id].photo} faceMaskUrl={thumbs[p.id].face} alt={`${p.angle} photo`} className="h-full w-full" />}
              </div>
              <figcaption className="flex items-center justify-between">
                <span className="label">{p.angle}</span>
                <DeleteForever
                  title={`Delete your ${p.angle} photo?`}
                  body="The photo and everything made from it for fitting are deleted from our servers. Try-ons you already made stay."
                  onDownload={thumbs[p.id] ? () => downloadPhoto(thumbs[p.id].photo, p.angle) : undefined}
                  onDelete={() => remove(p)}
                  trigger={(open) => (
                    <button onClick={open} aria-label={`Delete ${p.angle} photo`} className="p-1 text-muted hover:text-bad"><Trash2 className="h-4 w-4" /></button>
                  )}
                />
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <BodyPhotoUploader />
    </div>
  );
}
