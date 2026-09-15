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
import { Button, ButtonLink, Field, Input, Notice, PageHeader, Select } from "@/components/ui";
import { BodyPhotoUploader } from "@/components/BodyPhotoUploader";
import { Measurements } from "@/components/Measurements";
import { heightHint } from "@/components/BodyBasics";

const POLICY_VERSION = "2026-09-v1";

export default function Setup() {
  const setup = useSetupStatus();

  return (
    <div className="grid gap-10">
      <PageHeader eyebrow="Fitting profile" title="Set up your fitting room">
        {setup.ready && <ButtonLink to="/fitting-room" variant="solid">Open the fitting room</ButtonLink>}
      </PageHeader>
      <div className="grid gap-6">
        <Step n={1} title="About you" done={setup.steps.about}><AboutStep /></Step>
        <Step n={2} title="Sizes & fit" done={setup.steps.sizes} id="sizes"><SizesStep /></Step>
        <Step n={3} title="Privacy" done={setup.steps.privacy}><PrivacyStep /></Step>
        <Step n={4} title="Your photos" done={setup.steps.photos}>
          {setup.steps.about && setup.steps.privacy ? <PhotosStep /> : <Notice title="Finish steps 1 and 3 first">We need your age and photo consent before you upload body photos.</Notice>}
        </Step>
        {setup.steps.photos && (
          <Step n={5} title="Measurements" done={false} id="measurements"><Measurements /></Step>
        )}
      </div>
    </div>
  );
}

function Step({ n, title, done, id, children }: { n: number; title: string; done: boolean; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="grid gap-5 border border-rule bg-surface p-5 md:grid-cols-[220px_1fr] md:p-7">
      <div className="flex items-start gap-3 md:grid md:content-start">
        <span className={cn("grid h-8 w-8 place-items-center border num text-[13px]", done ? "border-good bg-good text-white" : "border-ink")}>{done ? <Check className="h-4 w-4" /> : n}</span>
        <h2 className="display text-[26px]">{title}</h2>
      </div>
      <div>{children}</div>
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
    if (form.date_of_birth && !isAdult(form.date_of_birth)) return toast.error("ALTERNATE try-on is for people aged 18 and over.");
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
        <Field label="Name"><Input value={form.display_name} onChange={set("display_name")} /></Field>
        <Field label="Phone (M-Pesa)"><Input type="tel" value={form.phone} onChange={set("phone")} placeholder="07XX XXX XXX" /></Field>
        <Field label="Date of birth" hint="You must be 18 or older"><Input type="date" required value={form.date_of_birth} onChange={set("date_of_birth")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Height (cm)" hint={heightHint(form.height_cm)}><Input type="number" min={100} max={250} value={form.height_cm} onChange={set("height_cm")} className="num" /></Field>
          <Field label="Weight (kg)"><Input type="number" min={25} max={300} value={form.weight_kg} onChange={set("weight_kg")} className="num" /></Field>
        </div>
      </div>
      <Button onClick={save} loading={busy} className="justify-self-start">Save</Button>
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
    { type: "terms", text: "I accept the ALTERNATE terms and privacy policy." },
    { type: "body_photo_processing", text: "I agree ALTERNATE may process my body photos, height and weight to create try-ons. They are private to me and I can delete them at any time." },
    { type: "cross_border_transfer", text: "I agree my photos may be sent to OpenAI in the United States to generate try-ons, and are not used to train their models." },
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
          Agree and continue
        </Button>
      )}
    </div>
  );
}

function PhotosStep() {
  const photos = useBodyPhotos();
  const queryClient = useQueryClient();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const entries = await Promise.all((photos.data ?? []).map(async (p) => [p.id, await signedUrl("body-photos", p.storage_path)] as const));
      setThumbs(Object.fromEntries(entries.filter(([, u]) => u)) as Record<string, string>);
    })();
  }, [photos.data]);

  const remove = async (photo: (typeof photos.data & object)[number]) => {
    const files = [
      photo.storage_path, photo.parts_map_path, photo.edit_mask_path, photo.face_mask_path, photo.mask_upper_path, photo.mask_lower_path,
      photo.mask_feet_path, photo.mask_eyes_path, photo.mask_head_path, photo.mask_jewellery_path,
    ];
    await supabase.storage.from("body-photos").remove(files.filter(Boolean) as string[]);
    const { error } = await supabase.from("body_photos").delete().eq("id", photo.id);
    if (error) return toast.error(errorMessage(error));
    queryClient.invalidateQueries({ queryKey: ["body-photos"] });
  };

  return (
    <div className="grid gap-6">
      {(photos.data?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-3">
          {photos.data!.map((p) => (
            <figure key={p.id} className="grid w-28 gap-1">
              <div className="aspect-[2/3] overflow-hidden bg-sunk">{thumbs[p.id] && <img src={thumbs[p.id]} alt={`${p.angle} photo`} className="h-full w-full object-cover" />}</div>
              <figcaption className="flex items-center justify-between">
                <span className="label">{p.angle}</span>
                <button onClick={() => remove(p)} aria-label={`Delete ${p.angle} photo`} className="p-1 text-muted hover:text-bad"><Trash2 className="h-4 w-4" /></button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <BodyPhotoUploader />
    </div>
  );
}
